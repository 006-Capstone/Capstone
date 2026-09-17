/**
 * Auto-Escalation System
 * Automatically sends nudges and notifications when staff risk scores exceed thresholds
 */

import { collection, addDoc, getDocs, query, where, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  calculateStaffRiskScore,
  calculate30DayPerformance,
  determineWarningStage,
  calculateTicketRisk
} from './performanceAnalytics';

// Risk thresholds for auto-escalation
const ESCALATION_THRESHOLDS = {
  MODERATE: 40,  // Yellow alert - monitor closely
  HIGH: 60,      // Orange alert - send gentle nudge
  CRITICAL: 80   // Red alert - send urgent nudge
};

// Cooldown period to prevent spam (in hours)
const NUDGE_COOLDOWN = 24;

const NUDGE_TEMPLATES = {
  gentle: {
    title: '🔔 Gentle Reminder',
    message: 'Hi! Just a friendly reminder that you have {count} pending ticket(s) that need attention. Take your time to review them when you can. Thanks for your hard work!'
  },
  urgent: {
    title: '⚠️ Urgent: Pending Tickets',
    message: 'You currently have {count} overdue ticket(s) requiring immediate attention. Please prioritize these to maintain service quality. Let us know if you need support.'
  },
  critical: {
    title: '🚨 Critical: Resolution Deadline Risk',
    message: 'CRITICAL: You have {count} ticket(s) at risk of exceeding the resolution deadline. Immediate action is required to prevent service disruption. Please address these tickets ASAP or request workload rebalancing.'
  }
};

/**
 * Check if a staff member has received a nudge recently (within cooldown period)
 * @param {string} staffId - Staff member ID
 * @returns {Promise<boolean>} - True if nudge was sent recently
 */
const hasRecentNudge = async (staffId) => {
  try {
    const cooldownTime = new Date();
    cooldownTime.setHours(cooldownTime.getHours() - NUDGE_COOLDOWN);
    
    const recentLogsQuery = query(
      collection(db, 'performance_logs'),
      where('action', '==', 'auto_nudge_sent'),
      where('staffId', '==', staffId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const logsSnapshot = await getDocs(recentLogsQuery);
    
    if (logsSnapshot.empty) return false;
    
    const lastNudge = logsSnapshot.docs[0].data();
    const lastNudgeTime = lastNudge.timestamp?.toDate() || new Date(0);
    
    return lastNudgeTime > cooldownTime;
  } catch (error) {
    console.error('Error checking recent nudge:', error);
    return false; // Assume no recent nudge on error
  }
};

/**
 * Send an automated nudge to a staff member
 * @param {object} staffData - Staff member data with risk metrics
 * @param {string} severity - Nudge severity (gentle, urgent, critical)
 * @returns {Promise<boolean>} - True if nudge was sent successfully
 */
const sendAutoNudge = async (staffData, severity) => {
  try {
    const template = NUDGE_TEMPLATES[severity];
    const message = template.message.replace('{count}', staffData.activeTickets);
    
    // Create notification in Firestore
    await addDoc(collection(db, 'notifications'), {
      userId: staffData.id,
      userType: 'staff',
      type: 'auto_performance_nudge',
      title: template.title,
      message: message,
      timestamp: serverTimestamp(),
      read: false,
      priority: severity === 'critical' ? 'high' : severity === 'urgent' ? 'medium' : 'low',
      metadata: {
        sentBy: 'system_auto_escalation',
        reason: 'performance_monitoring',
        staffName: staffData.name,
        ticketCount: staffData.activeTickets,
        overdueCount: staffData.overdueTickets,
        riskScore: staffData.riskScore,
        severity: severity,
        automated: true
      }
    });
    
    // Log the auto-nudge action
    await addDoc(collection(db, 'performance_logs'), {
      action: 'auto_nudge_sent',
      staffId: staffData.id,
      staffName: staffData.name,
      severity: severity,
      message: message,
      timestamp: serverTimestamp(),
      metrics: {
        activeTickets: staffData.activeTickets,
        overdueTickets: staffData.overdueTickets,
        riskScore: staffData.riskScore
      },
      automated: true
    });
    
    console.log(`Auto-nudge sent to ${staffData.name} (${severity})`);
    return true;
  } catch (error) {
    console.error('Error sending auto-nudge:', error);
    return false;
  }
};

/**
 * Evaluate a single staff member and send nudge if needed
 * @param {object} staff - Staff member data
 * @param {array} allRequests - All ticket data
 * @returns {Promise<object>} - Escalation result
 */
const evaluateStaffMember = async (staff, allRequests) => {
  try {
    // Get staff's tickets
    const staffRequests = allRequests.filter(r => {
      const assigned = (r.assignedTo || r.claimedBy || '').toLowerCase();
      return assigned === staff.name.toLowerCase();
    });
    
    const activeTickets = staffRequests.filter(r => 
      r.status !== 'Resolved' && r.status !== 'Cancelled'
    ).length;
    
    const overdueTickets = staffRequests.filter(r => {
      const { isOverdue } = calculateTicketRisk(r);
      return isOverdue && r.status !== 'Resolved';
    }).length;
    
    const riskScore = calculateStaffRiskScore({
      tickets: staffRequests,
      activeTickets,
      overdueTickets,
      avgResolutionTime: 36
    });
    
    const staffData = {
      id: staff.id,
      name: staff.name,
      office: staff.office,
      activeTickets,
      overdueTickets,
      riskScore
    };
    
    // Determine if escalation is needed
    let escalationNeeded = false;
    let severity = null;
    
    if (riskScore >= ESCALATION_THRESHOLDS.CRITICAL) {
      escalationNeeded = true;
      severity = 'critical';
    } else if (riskScore >= ESCALATION_THRESHOLDS.HIGH) {
      escalationNeeded = true;
      severity = 'urgent';
    } else if (riskScore >= ESCALATION_THRESHOLDS.MODERATE && overdueTickets > 3) {
      escalationNeeded = true;
      severity = 'gentle';
    }
    
    if (!escalationNeeded) {
      return {
        staffId: staff.id,
        staffName: staff.name,
        escalated: false,
        reason: 'Risk score within acceptable range'
      };
    }
    
    // Check cooldown
    const hasRecent = await hasRecentNudge(staff.id);
    if (hasRecent) {
      return {
        staffId: staff.id,
        staffName: staff.name,
        escalated: false,
        reason: 'Cooldown period active - nudge sent recently'
      };
    }
    
    // Send auto-nudge
    const sent = await sendAutoNudge(staffData, severity);
    
    return {
      staffId: staff.id,
      staffName: staff.name,
      escalated: sent,
      severity: severity,
      riskScore: riskScore,
      reason: sent ? 'Auto-nudge sent successfully' : 'Failed to send nudge'
    };
  } catch (error) {
    console.error(`Error evaluating staff ${staff.name}:`, error);
    return {
      staffId: staff.id,
      staffName: staff.name,
      escalated: false,
      reason: 'Error during evaluation'
    };
  }
};

/**
 * Run auto-escalation for all staff members
 * Should be run periodically (e.g., every hour or daily)
 * @returns {Promise<object>} - Summary of escalation results
 */
export const runAutoEscalation = async () => {
  try {
    console.log('Starting auto-escalation evaluation...');
    
    // Load all data
    const requestsSnapshot = await getDocs(collection(db, 'requests'));
    const staffSnapshot = await getDocs(collection(db, 'staff'));
    
    const allRequests = requestsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const allStaff = staffSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Evaluate each staff member
    const results = [];
    for (const staff of allStaff) {
      const result = await evaluateStaffMember(staff, allRequests);
      results.push(result);
    }
    
    // Generate summary
    const summary = {
      timestamp: new Date().toISOString(),
      totalStaffEvaluated: results.length,
      nudgesSent: results.filter(r => r.escalated).length,
      criticalAlerts: results.filter(r => r.severity === 'critical').length,
      urgentAlerts: results.filter(r => r.severity === 'urgent').length,
      gentleReminders: results.filter(r => r.severity === 'gentle').length,
      skippedCooldown: results.filter(r => r.reason?.includes('Cooldown')).length,
      details: results.filter(r => r.escalated)
    };
    
    // Log the auto-escalation run
    await addDoc(collection(db, 'performance_logs'), {
      action: 'auto_escalation_run',
      timestamp: serverTimestamp(),
      summary: summary,
      automated: true
    });
    
    console.log('Auto-escalation complete:', summary);
    return summary;
  } catch (error) {
    console.error('Error running auto-escalation:', error);
    throw error;
  }
};

/**
 * Get auto-escalation history
 * @param {number} days - Number of days to retrieve
 * @returns {Promise<array>} - Array of escalation runs
 */
export const getEscalationHistory = async (days = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const historyQuery = query(
      collection(db, 'performance_logs'),
      where('action', '==', 'auto_escalation_run'),
      orderBy('timestamp', 'desc'),
      limit(days * 2) // Allow for multiple runs per day
    );
    
    const historySnapshot = await getDocs(historyQuery);
    
    return historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching escalation history:', error);
    return [];
  }
};

export default {
  runAutoEscalation,
  getEscalationHistory,
  ESCALATION_THRESHOLDS
};
