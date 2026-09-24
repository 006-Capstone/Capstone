import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';

/**
 * Efficiency Score & Performance Helper for Admin App
 * Evaluates staff performance in real-time and determines warning thresholds (<= 60%).
 * Synchronized with Superadmin Department Health Monitor.
 */

export const parseDate = (val) => {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export const getEtcDeadline = (etcVal) => {
  if (!etcVal) return null;
  if (typeof etcVal === 'string') {
    const parts = etcVal.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59);
    }
    const d = new Date(etcVal);
    if (!isNaN(d.getTime())) return d;
  }
  if (etcVal?.toDate) return etcVal.toDate();
  if (etcVal instanceof Date) return etcVal;
  return null;
};

/**
 * Filter tickets that belong to the current staff member
 */
export const getStaffTickets = (tickets = [], staffName = '', staffUid = '') => {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];
  const nameLower = (staffName || '').trim().toLowerCase();
  const uid = (staffUid || '').trim();

  return tickets.filter(t => {
    const assigned = (t.assignedTo || '').trim().toLowerCase();
    const claimed = (t.claimedBy || '').trim().toLowerCase();
    const assignedStaff = (t.assignedToStaff || '').trim().toLowerCase();

    const matchesName = Boolean(
      nameLower && (assigned === nameLower || claimed === nameLower || assignedStaff === nameLower)
    );
    const matchesUid = Boolean(
      uid && (t.assignedToStaff === uid || t.claimedByUid === uid)
    );

    return matchesName || matchesUid;
  });
};

/**
 * Calculate the overall Performance Efficiency Score (0-100)
 * Evaluates SLA compliance, queue health, workload balance, and resolution volume.
 */
export const calculateEfficiencyMetrics = (staffTickets = []) => {
  const now = new Date();

  const currentActiveTickets = staffTickets.filter(t => {
    const s = (t.status || '').toLowerCase();
    return s !== 'resolved' && s !== 'cancelled' && s !== 'rejected';
  });
  const activeCount = currentActiveTickets.length;

  const overdueActiveTickets = currentActiveTickets.filter(t => {
    const deadline = getEtcDeadline(t.etc || t.estimatedCompletion);
    if (!deadline) {
      // Fallback: created > 72 hours ago
      const created = parseDate(t.createdAt);
      if (created) {
        return (now.getTime() - created.getTime()) > (72 * 60 * 60 * 1000);
      }
      return false;
    }
    const isDueToday = 
      deadline.getFullYear() === now.getFullYear() &&
      deadline.getMonth() === now.getMonth() &&
      deadline.getDate() === now.getDate();
    return !isDueToday && deadline < now;
  });
  const overdueCount = overdueActiveTickets.length;

  const resolvedTickets = staffTickets.filter(t => (t.status || '').toLowerCase() === 'resolved');
  const resolvedCount = resolvedTickets.length;

  // Calculate On-Time rate for resolved tickets
  let onTimeCount = 0;
  resolvedTickets.forEach(t => {
    const resolvedDate = parseDate(t.resolvedAt) || parseDate(t.updatedAt);
    const deadline = getEtcDeadline(t.etc || t.estimatedCompletion);
    if (resolvedDate && deadline) {
      if (resolvedDate <= deadline) onTimeCount++;
    } else {
      onTimeCount++;
    }
  });

  const onTimeRate = resolvedCount > 0
    ? Math.round((onTimeCount / resolvedCount) * 100)
    : (activeCount === 0 ? 100 : overdueCount === 0 ? 90 : 60);

  // 1. SLA On-Time compliance: up to 50 pts
  const slaScore = Math.round((onTimeRate / 100) * 50);

  // 2. Queue & Overdue Health: up to 30 pts
  let queueScore = 30;
  if (activeCount > 0 && overdueCount > 0) {
    const overdueRatio = overdueCount / activeCount;
    const penalty = Math.min(30, Math.round(overdueRatio * 20) + (overdueCount * 4));
    queueScore = Math.max(0, 30 - penalty);
  } else if (activeCount === 0 && overdueCount === 0) {
    queueScore = 30;
  }

  // 3. Workload Balance: up to 20 pts (optimal <= 15 tickets)
  let workloadScore = 20;
  if (activeCount > 15) {
    workloadScore = Math.max(5, 20 - Math.min(15, (activeCount - 15) * 2));
  }

  // 4. Resolution Productivity bonus: up to +10 pts
  const volumeBonus = Math.min(10, resolvedCount * 2);

  const score = Math.max(0, Math.min(100, slaScore + queueScore + workloadScore + volumeBonus));

  // Determine Graded Tier
  let tier = 'good';
  let tierLabel = 'Good Standing';
  let tierColor = '#16a34a';

  if (score >= 90) {
    tier = 'excellent';
    tierLabel = 'Excellent';
    tierColor = '#059669';
  } else if (score >= 75) {
    tier = 'good';
    tierLabel = 'Good Standing';
    tierColor = '#16a34a';
  } else if (score >= 60) {
    tier = 'advisory';
    tierLabel = 'Needs Focus';
    tierColor = '#d97706';
  } else {
    tier = 'critical';
    tierLabel = 'Critical Attention';
    tierColor = '#dc2626';
  }

  const isWarning = score <= 60;

  return {
    score,
    tier,
    tierLabel,
    tierColor,
    slaScore,
    queueScore,
    workloadScore,
    volumeBonus,
    activeCount,
    overdueCount,
    resolvedCount,
    totalCount: staffTickets.length,
    onTimeRate,
    isWarning,
    overdueTickets: overdueActiveTickets
  };
};

/**
 * Ensure an Efficiency Warning notification is registered in Firestore
 * when a staff member's score drops to 60% or lower.
 * Prevents spamming duplicates with a 24-hour cooldown or existing unread alert.
 */
export const ensureEfficiencyWarningNotification = async (staffData, efficiencyMetrics) => {
  if (!staffData?.uid || !efficiencyMetrics?.isWarning) return;

  try {
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('recipientId', '==', staffData.uid),
      where('recipientType', '==', 'staff'),
      where('type', '==', 'efficiency_score_warning'),
      limit(5)
    );

    const snapshot = await getDocs(q);
    const now = Date.now();
    const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24-hour cooldown

    let hasRecentNotification = false;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.isRead) {
        hasRecentNotification = true;
      }
      const createdDate = parseDate(data.createdAt || data.timestamp);
      if (createdDate && (now - createdDate.getTime()) < COOLDOWN_MS) {
        hasRecentNotification = true;
      }
    });

    if (hasRecentNotification) {
      return;
    }

    const score = efficiencyMetrics.score;
    const overdueCount = efficiencyMetrics.overdueCount || 0;

    await addDoc(notificationsRef, {
      recipientId: staffData.uid,
      recipientType: 'staff',
      userId: staffData.uid,
      userType: 'staff',
      type: 'efficiency_score_warning',
      title: `🚨 Performance Alert: Efficiency Score Dropped to ${score}%`,
      message: `Department Health Monitor Alert: Your Efficiency Score has dropped to ${score}%, falling below the required standard of 60%. ${
        overdueCount > 0 
          ? `You currently have ${overdueCount} overdue active request(s). ` 
          : ''
      }Please process pending requests immediately to restore department health.`,
      priority: 'high',
      isRead: false,
      read: false,
      score: score,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(),
      metadata: {
        source: 'department_health_monitor',
        staffName: staffData.name || '',
        score: score,
        office: staffData.office || staffData.department || ''
      }
    });
  } catch (err) {
    console.error('[Error] ensureEfficiencyWarningNotification failed:', err);
  }
};

