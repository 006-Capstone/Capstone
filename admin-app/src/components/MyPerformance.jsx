import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FaBell, 
  FaClock, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaTrophy, 
  FaSearch, 
  FaTimes, 
  FaCalendarAlt, 
  FaChartLine, 
  FaInbox, 
  FaShieldAlt, 
  FaUserCircle, 
  FaArrowUp, 
  FaArrowDown, 
  FaBolt, 
  FaCheck,
  FaInfoCircle,
  FaDownload
} from 'react-icons/fa';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { OverviewCardsSkeleton, AnalyticsChartSkeleton } from './common/Skeleton';
import Notifications from './Notifications';
import '../styles/MyPerformance.css';

/* ---------------------------------------------------------------------------
   Date & Timestamp Normalization Helpers
--------------------------------------------------------------------------- */
const parseDate = (val) => {
  if (!val) return null;
  if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
  if (typeof val === 'string') {
    // If it's a date string like YYYY-MM-DD, parse as local calendar date
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  return null;
};

// Gets the deadline timestamp for an estimated completion date (end of that calendar day: 23:59:59.999)
const getEtcDeadline = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  const d = parseDate(val);
  if (!d) return null;
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }
  return d;
};

// Helper for performance grade tiers and badge classes
const getGradeInfo = (score) => {
  if (score >= 90) {
    return {
      grade: 'Grade A+',
      label: 'Outstanding',
      className: 'grade-badge--a-plus'
    };
  }
  if (score >= 80) {
    return {
      grade: 'Grade A',
      label: 'Commendable',
      className: 'grade-badge--a'
    };
  }
  if (score >= 70) {
    return {
      grade: 'Grade B',
      label: 'Satisfactory',
      className: 'grade-badge--b'
    };
  }
  if (score >= 60) {
    return {
      grade: 'Grade C',
      label: 'Acceptable',
      className: 'grade-badge--c'
    };
  }
  return {
    grade: 'Needs Focus',
    label: 'Needs Attention',
    className: 'grade-badge--needs-focus'
  };
};

export const GRADED_TIERS = [
  {
    grade: 'Grade A+',
    scoreRange: '90 – 100',
    minScore: 90,
    label: 'Outstanding Performance',
    badgeClass: 'grade-badge--a-plus',
    summary: 'Exceptional turnaround speed with prompt SLA adherence, healthy queue balance, and zero overdue tickets.'
  },
  {
    grade: 'Grade A',
    scoreRange: '80 – 89',
    minScore: 80,
    label: 'Commendable Delivery',
    badgeClass: 'grade-badge--a',
    summary: 'Consistently high on-time rate, reliable workload handling, and strong compliance with completion targets.'
  },
  {
    grade: 'Grade B',
    scoreRange: '70 – 79',
    minScore: 70,
    label: 'Satisfactory Standing',
    badgeClass: 'grade-badge--b',
    summary: 'Stable queue processing pace meeting standard institutional requirements, with minor turnaround variances.'
  },
  {
    grade: 'Grade C',
    scoreRange: '60 – 69',
    minScore: 60,
    label: 'Acceptable / Advisory',
    badgeClass: 'grade-badge--c',
    summary: 'Service turnaround is nearing threshold limits. Prompt attention recommended to prevent overdue requests.'
  },
  {
    grade: 'Needs Focus',
    scoreRange: 'Below 60',
    minScore: 0,
    label: 'Needs Priority Attention',
    badgeClass: 'grade-badge--needs-focus',
    summary: 'Performance index requires immediate focus. Prioritize clearing overdue backlog and pending active tickets.'
  }
];

const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = parseDate(date);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (date) => {
  if (!date) return '';
  const d = parseDate(date);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/* Anti-Hoarding System Limits */
const HOARDING_IN_PROGRESS_THRESHOLD = 10;
const HOARDING_DAILY_LIMIT = 5;

const MyPerformance = ({ userData }) => {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Time-range filter: 'all', 'month', '30days', '7days', 'today'
  const [timeRange, setTimeRange] = useState('all');

  // Performance request table states
  const [tableTab, setTableTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);

  // Graded Tiers Popover states
  const [showTierPopover, setShowTierPopover] = useState(false);
  const [isHoveringTier, setIsHoveringTier] = useState(false);
  const tierHoverTimeoutRef = useRef(null);
  const tierContainerRef = useRef(null);

  const handleMouseEnterTier = () => {
    if (tierHoverTimeoutRef.current) clearTimeout(tierHoverTimeoutRef.current);
    setIsHoveringTier(true);
  };

  const handleMouseLeaveTier = () => {
    tierHoverTimeoutRef.current = setTimeout(() => {
      setIsHoveringTier(false);
    }, 250);
  };

  const handleToggleTierPopover = (e) => {
    e?.stopPropagation?.();
    setShowTierPopover(prev => !prev);
  };

  // Close Graded Tiers popover when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tierContainerRef.current && !tierContainerRef.current.contains(event.target)) {
        setShowTierPopover(false);
        setIsHoveringTier(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowTierPopover(false);
        setIsHoveringTier(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (tierHoverTimeoutRef.current) clearTimeout(tierHoverTimeoutRef.current);
    };
  }, []);

  // Resolve staff user data (from prop or localStorage)
  const staffData = useMemo(() => {
    let data = userData && Object.keys(userData).length > 0 ? userData : null;
    if (!data) {
      try {
        const stored = localStorage.getItem('staffData');
        if (stored) data = JSON.parse(stored);
      } catch (e) {
        data = null;
      }
    }
    return data || {};
  }, [userData]);

  const staffName = (staffData.name || staffData.fullName || '').trim();
  const staffUid = staffData.uid || '';
  const staffOffice = staffData.office || '';

  // Real-time unread notifications listener
  useEffect(() => {
    if (!staffUid) return undefined;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', staffUid),
      where('recipientType', '==', 'staff')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const unread = querySnapshot.docs.filter(doc => !doc.data().isRead).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [staffUid]);

  // Real-time listener for requests in this staff member's office
  useEffect(() => {
    setLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = staffOffice 
      ? query(requestsRef, where('office', '==', staffOffice))
      : query(requestsRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            firestoreId: docSnap.id,
            id: data.requestId || docSnap.id,
            subject: data.subject || data.title || 'Untitled Request',
            title: data.subject || data.title || 'Untitled Request',
            student: data.studentName || data.student || 'Student',
            studentName: data.studentName || data.student || 'Student',
            studentId: data.studentId || '',
            isGuest: Boolean(data.isGuest),
            status: data.status || 'Pending',
            office: data.office || staffOffice,
            assignedTo: data.assignedTo || null,
            assignedToStaff: data.assignedToStaff || null,
            claimedBy: data.claimedBy || null,
            resolvedBy: data.resolvedBy || null,
            claimedAt: data.claimedAt || null,
            resolvedAt: data.resolvedAt || null,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            etc: data.etc || data.estimatedCompletion || data.eta || null,
            resolutionNote: data.resolutionNote || '',
            ...data
          };
        });

        // Newest first
        list.sort((a, b) => {
          const tA = parseDate(a.createdAt)?.getTime() || 0;
          const tB = parseDate(b.createdAt)?.getTime() || 0;
          return tB - tA;
        });

        setTickets(list);
        setLoading(false);
      },
      (error) => {
        console.error('[MyPerformance] Error loading requests:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [staffOffice]);

  // Filter requests handled by or assigned to this staff member
  const myAllTickets = useMemo(() => {
    if (!staffName && !staffUid) return [];

    const normalizedName = staffName.toLowerCase();

    return tickets.filter(t => {
      const assigned = String(t.assignedTo || '').trim().toLowerCase();
      const claimed = String(t.claimedBy || '').trim().toLowerCase();
      const resolved = String(t.resolvedBy || '').trim().toLowerCase();
      const assignedStaff = String(t.assignedToStaff || '').trim().toLowerCase();

      return (
        (normalizedName && (
          assigned === normalizedName ||
          claimed === normalizedName ||
          resolved === normalizedName ||
          assignedStaff === normalizedName
        )) ||
        (staffUid && (
          t.assignedToStaff === staffUid ||
          t.assignedTo === staffUid ||
          t.claimedBy === staffUid
        ))
      );
    });
  }, [tickets, staffName, staffUid]);

  // Filter by selected time period
  const myFilteredTickets = useMemo(() => {
    if (timeRange === 'all') return myAllTickets;

    const now = new Date();
    let thresholdTime = 0;

    if (timeRange === 'today') {
      thresholdTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (timeRange === '7days') {
      thresholdTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '30days') {
      thresholdTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    } else if (timeRange === 'month') {
      thresholdTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    return myAllTickets.filter(t => {
      const eventDate = parseDate(t.resolvedAt) || parseDate(t.claimedAt) || parseDate(t.createdAt);
      if (!eventDate) return false;
      return eventDate.getTime() >= thresholdTime;
    });
  }, [myAllTickets, timeRange]);

  // Compute detailed metrics for the staff member
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // 1. Overall Active in progress right now
    const currentActiveTickets = myAllTickets.filter(t => t.status === 'In Process');
    const activeCount = currentActiveTickets.length;

    // 2. Overdue active requests (past deadline and not due today)
    const overdueActiveTickets = currentActiveTickets.filter(t => {
      const deadline = getEtcDeadline(t.etc);
      if (!deadline) return false;
      const isDueToday = 
        deadline.getFullYear() === now.getFullYear() &&
        deadline.getMonth() === now.getMonth() &&
        deadline.getDate() === now.getDate();
      return !isDueToday && deadline < now;
    });
    const overdueCount = overdueActiveTickets.length;

    // 3. Due today active requests
    const dueTodayActiveTickets = currentActiveTickets.filter(t => {
      const deadline = getEtcDeadline(t.etc);
      if (!deadline) return false;
      return (
        deadline.getFullYear() === now.getFullYear() &&
        deadline.getMonth() === now.getMonth() &&
        deadline.getDate() === now.getDate()
      );
    });
    const dueTodayCount = dueTodayActiveTickets.length;

    // 4. Resolved tickets in the selected filtered period
    const resolvedInPeriod = myFilteredTickets.filter(t => t.status === 'Resolved');
    const resolvedCount = resolvedInPeriod.length;

    // 5. Total resolved all-time
    const allTimeResolvedTickets = myAllTickets.filter(t => t.status === 'Resolved');
    const allTimeResolved = allTimeResolvedTickets.length;

    // 6. On-Time calculations (for resolved requests in period)
    let onTimeCount = 0;
    let turnAroundTotalMs = 0;
    let turnAroundValidCount = 0;

    resolvedInPeriod.forEach(t => {
      const resolvedDate = parseDate(t.resolvedAt) || parseDate(t.updatedAt);
      const deadline = getEtcDeadline(t.etc);
      const claimedDate = parseDate(t.claimedAt) || parseDate(t.createdAt);

      if (resolvedDate && deadline) {
        if (resolvedDate <= deadline) {
          onTimeCount += 1;
        }
      } else {
        // If no ETC was stipulated, resolution counts toward positive SLA
        onTimeCount += 1;
      }

      if (resolvedDate && claimedDate) {
        const diff = resolvedDate.getTime() - claimedDate.getTime();
        if (diff > 0) {
          turnAroundTotalMs += diff;
          turnAroundValidCount += 1;
        }
      }
    });

    // All-time on-time rate fallback when current filter window has no resolved tickets
    let allTimeOnTimeCount = 0;
    allTimeResolvedTickets.forEach(t => {
      const resolvedDate = parseDate(t.resolvedAt) || parseDate(t.updatedAt);
      const deadline = getEtcDeadline(t.etc);
      if (resolvedDate && deadline) {
        if (resolvedDate <= deadline) allTimeOnTimeCount += 1;
      } else {
        allTimeOnTimeCount += 1;
      }
    });
    const allTimeOnTimeRate = allTimeResolved > 0
      ? Math.round((allTimeOnTimeCount / allTimeResolved) * 100)
      : 100;

    const onTimeRate = resolvedCount > 0
      ? Math.round((onTimeCount / resolvedCount) * 100)
      : (allTimeResolved > 0 ? allTimeOnTimeRate : 100);

    // Average Turnaround time
    let avgTurnaroundHours = 0;
    let avgTurnaroundDisplay = 'N/A';
    if (turnAroundValidCount > 0) {
      avgTurnaroundHours = Math.round(turnAroundTotalMs / (turnAroundValidCount * 1000 * 60 * 60) * 10) / 10;
      if (avgTurnaroundHours >= 48) {
        const days = Math.round((avgTurnaroundHours / 24) * 10) / 10;
        avgTurnaroundDisplay = `${days} days`;
      } else {
        avgTurnaroundDisplay = `${avgTurnaroundHours} hrs`;
      }
    }

    // 7. Today's claims (for anti-hoarding rule)
    const acceptedTodayCount = myAllTickets.filter(t => {
      const claimed = parseDate(t.claimedAt) || (t.status === 'In Process' ? parseDate(t.updatedAt || t.createdAt) : null);
      if (!claimed) return false;
      return claimed.getTime() >= startOfToday;
    }).length;

    const isRestrictedByHoarding = activeCount >= HOARDING_IN_PROGRESS_THRESHOLD;
    const isAtClaimLimit = isRestrictedByHoarding && acceptedTodayCount >= HOARDING_DAILY_LIMIT;

    // 8. Overall Performance Efficiency Score (0 to 100)
    // SLA On-Time compliance: up to 50 pts
    const slaScore = Math.round((onTimeRate / 100) * 50);

    // Queue & Overdue Health: up to 30 pts
    let queueScore = 30;
    if (activeCount > 0 && overdueCount > 0) {
      const overdueRatio = overdueCount / activeCount;
      const penalty = Math.min(30, Math.round(overdueRatio * 20) + (overdueCount * 4));
      queueScore = Math.max(0, 30 - penalty);
    }

    // Workload & Anti-Hoarding: up to 20 pts
    let workloadScore = 20;
    if (isRestrictedByHoarding) workloadScore -= 10;
    if (isAtClaimLimit) workloadScore -= 10;
    workloadScore = Math.max(0, workloadScore);

    // Resolution Productivity bonus: up to +10 pts
    const effectiveResolved = resolvedCount > 0 ? resolvedCount : allTimeResolved;
    const volumeBonus = Math.min(10, effectiveResolved * 2);

    const performanceScore = Math.max(0, Math.min(100, slaScore + queueScore + workloadScore + volumeBonus));

    // Standing Tier
    let standing = {
      level: 'good',
      label: 'Good Standing',
      icon: FaCheckCircle,
      description: 'Your queue is healthy, service delivery is on schedule, and requests are handled promptly.'
    };

    if (overdueCount > 0 || isAtClaimLimit) {
      standing = {
        level: 'critical',
        label: 'Attention Required',
        icon: FaExclamationTriangle,
        description: overdueCount > 0
          ? `${overdueCount} active request${overdueCount === 1 ? ' is' : 's are'} overdue past estimated completion date. Prioritize processing overdue tickets.`
          : `Daily claim limit reached (${acceptedTodayCount}/${HOARDING_DAILY_LIMIT} claims today) under the Anti-Hoarding policy. Resolve in-progress requests before accepting more.`
      };
    } else if (isRestrictedByHoarding || performanceScore < 70) {
      standing = {
        level: 'advisory',
        label: performanceScore < 60 ? 'Needs Focus' : 'Advisory Notice',
        icon: performanceScore < 60 ? FaExclamationTriangle : FaClock,
        description: isRestrictedByHoarding
          ? `Workload threshold reached with ${activeCount} active requests in progress. Daily limit of ${HOARDING_DAILY_LIMIT} claims applies.`
          : performanceScore < 60
          ? 'Performance index requires focus. Resolve pending requests to improve turnaround time and efficiency score.'
          : 'Service turnaround is nearing threshold. Continue processing your active queue.'
      };
    } else if (performanceScore >= 90) {
      standing = {
        level: 'outstanding',
        label: 'Outstanding Performance',
        icon: FaTrophy,
        description: 'Exceptional turnaround speed and prompt SLA adherence across all assigned tickets.'
      };
    }

    return {
      activeCount,
      overdueCount,
      dueTodayCount,
      resolvedCount,
      allTimeResolved,
      totalHandled: myFilteredTickets.length,
      allTimeTotal: myAllTickets.length,
      onTimeRate,
      avgTurnaroundDisplay,
      acceptedTodayCount,
      isRestrictedByHoarding,
      isAtClaimLimit,
      performanceScore,
      standing
    };
  }, [myAllTickets, myFilteredTickets]);

  // Daily Resolution Velocity Data (Last 7 Days) for custom bar chart
  const weeklyVelocityData = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const startOfDay = d.getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

      const dayLabel = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const fullDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const resolvedOnDay = myAllTickets.filter(t => {
        if (t.status !== 'Resolved') return false;
        const resDate = parseDate(t.resolvedAt) || parseDate(t.updatedAt);
        if (!resDate) return false;
        const ts = resDate.getTime();
        return ts >= startOfDay && ts <= endOfDay;
      }).length;

      days.push({
        label: dayLabel,
        fullDate: fullDateStr,
        count: resolvedOnDay
      });
    }

    const maxCount = Math.max(...days.map(d => d.count), 4);
    return { days, maxCount };
  }, [myAllTickets]);

  // Request list for the performance log table
  const tableTickets = useMemo(() => {
    let list = [...myFilteredTickets];
    const now = new Date();

    // Tab filtering
    if (tableTab === 'in_progress') {
      list = list.filter(t => t.status === 'In Process');
    } else if (tableTab === 'resolved') {
      list = list.filter(t => t.status === 'Resolved');
    } else if (tableTab === 'overdue') {
      list = list.filter(t => {
        if (t.status !== 'In Process') return false;
        const deadline = getEtcDeadline(t.etc);
        if (!deadline) return false;
        const isDueToday = 
          deadline.getFullYear() === now.getFullYear() &&
          deadline.getMonth() === now.getMonth() &&
          deadline.getDate() === now.getDate();
        return !isDueToday && deadline < now;
      });
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => 
        (t.id && String(t.id).toLowerCase().includes(q)) ||
        (t.subject && String(t.subject).toLowerCase().includes(q)) ||
        (t.student && String(t.student).toLowerCase().includes(q)) ||
        (t.studentId && String(t.studentId).toLowerCase().includes(q))
      );
    }

    return list;
  }, [myFilteredTickets, tableTab, searchQuery]);

  const handleTabChange = (tab) => {
    setTableTab(tab);
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Helper for status badge rendering
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'In Process':
        return 'status-inprocess';
      case 'Resolved':
        return 'status-resolved';
      case 'Pending':
        return 'status-pending';
      case 'Rejected':
      case 'Cancelled':
        return 'status-cancelled';
      default:
        return 'status-pending';
    }
  };

  // Helper for SLA performance compliance label
  const getTicketSlaTag = (ticket) => {
    const now = new Date();
    const deadline = getEtcDeadline(ticket.etc);
    const resolvedDate = parseDate(ticket.resolvedAt) || (ticket.status === 'Resolved' ? parseDate(ticket.updatedAt) : null);

    if (ticket.status === 'Resolved') {
      if (deadline && resolvedDate) {
        if (resolvedDate <= deadline) {
          return { label: 'On-Time', className: 'sla-ontime' };
        }
        return { label: 'Late', className: 'sla-late' };
      }
      return { label: 'Completed', className: 'sla-ontime' };
    }

    if (ticket.status === 'In Process') {
      if (!deadline) {
        return { label: 'No ETC Set', className: 'sla-pending' };
      }
      const isDueToday = 
        deadline.getFullYear() === now.getFullYear() &&
        deadline.getMonth() === now.getMonth() &&
        deadline.getDate() === now.getDate();

      if (isDueToday) {
        return { label: 'Due Today', className: 'sla-duetoday' };
      }
      if (deadline < now) {
        return { label: 'Overdue', className: 'sla-overdue' };
      }
      return { label: 'On Track', className: 'sla-ontrack' };
    }

    return { label: ticket.status, className: 'sla-pending' };
  };

  // Export table data to CSV
  const exportToCSV = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    
    // Add summary header with performance metrics
    let csv = `My Performance Report - ${staffName || 'Staff Member'}\n`;
    csv += `Time Period: ${timeRange === 'all' ? 'All Time' : timeRange === 'month' ? 'This Month' : timeRange === '30days' ? 'Last 30 Days' : timeRange === '7days' ? 'Last 7 Days' : 'Today'}\n`;
    csv += `Generated: ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n`;
    csv += '\n';
    
    // Performance Summary Section
    csv += 'PERFORMANCE SUMMARY\n';
    csv += `Efficiency Score,${metrics.performanceScore}/100\n`;
    csv += `Performance Grade,${getGradeInfo(metrics.performanceScore).grade}\n`;
    csv += `Standing,${metrics.standing.label}\n`;
    csv += `Active Requests,${metrics.activeCount}\n`;
    csv += `Overdue Requests,${metrics.overdueCount}\n`;
    csv += `Due Today,${metrics.dueTodayCount}\n`;
    csv += `Resolved Tickets,${metrics.resolvedCount}\n`;
    csv += `All-Time Resolved,${metrics.allTimeResolved}\n`;
    csv += `On-Time SLA Rate,${metrics.onTimeRate}%\n`;
    csv += `Average Turnaround,${metrics.avgTurnaroundDisplay}\n`;
    csv += `Accepted Today,${metrics.acceptedTodayCount}\n`;
    csv += `Anti-Hoarding Status,${metrics.isRestrictedByHoarding ? 'Restricted (10+ active)' : 'Normal'}\n`;
    csv += '\n';
    
    // Request Details Section
    csv += 'REQUEST DETAILS\n';
    csv += 'Request ID,Subject,Student Name,Student ID,Is Guest,Status,Office,Assigned To,Estimated Completion,SLA Compliance,Claimed At,Resolved At,Created At,Resolution Note\n';
    
    tableTickets.forEach(t => {
      const createdAt = parseDate(t.createdAt);
      const claimedAt = parseDate(t.claimedAt);
      const resolvedAt = parseDate(t.resolvedAt);
      const slaTag = getTicketSlaTag(t);
      const isGuest = Boolean(t.isGuest);
      const studentName = t.student || t.studentName || (isGuest ? 'Guest User' : 'Student');
      const studentId = t.studentId || t.studentID || t.idNumber || '';
      
      csv += [
        esc(t.id),
        esc(t.subject || t.title),
        esc(studentName),
        esc(studentId),
        esc(isGuest ? 'Yes' : 'No'),
        esc(t.status),
        esc(t.office),
        esc(t.assignedTo || 'Unassigned'),
        esc(formatDate(t.etc)),
        esc(slaTag.label),
        esc(claimedAt ? claimedAt.toISOString() : ''),
        esc(resolvedAt ? resolvedAt.toISOString() : ''),
        esc(createdAt ? createdAt.toISOString() : ''),
        esc(t.resolutionNote || '')
      ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const rangeLabel = timeRange === 'all' ? 'all-time' : timeRange;
    const staffSlug = (staffName || 'staff').toLowerCase().replace(/\s+/g, '-');
    link.download = `${staffSlug}-performance-${rangeLabel}-${timestamp}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="my-performance-container">
        <header className="performance-header">
          <div className="header-left">
            <div className="title-row">
              <h1 className="performance-title">My Performance</h1>
            </div>
            <p className="performance-subtitle">
              Track your personal request handling productivity, turnaround time, and institutional compliance standards
            </p>
          </div>
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
          <OverviewCardsSkeleton count={4} />
          <AnalyticsChartSkeleton height={320} />
        </div>
      </div>
    );
  }

  return (
    <div className="my-performance-container">
      {/* Top Header */}
      <header className="performance-header">
        <div className="header-left">
          <div className="title-row">
            <h1 className="performance-title">My Performance</h1>
          </div>
          <p className="performance-subtitle">
            Track your personal request handling productivity, turnaround time, and institutional compliance standards
          </p>
        </div>

        <div className="header-right">
          {/* Time Range Selector */}
          <div className="time-filter-pill-group" role="group" aria-label="Performance Time Range">
            <button
              type="button"
              className={`filter-pill ${timeRange === 'all' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('all')}
            >
              All Time
            </button>
            <button
              type="button"
              className={`filter-pill ${timeRange === 'month' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('month')}
            >
              This Month
            </button>
            <button
              type="button"
              className={`filter-pill ${timeRange === '30days' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('30days')}
            >
              Last 30D
            </button>
            <button
              type="button"
              className={`filter-pill ${timeRange === '7days' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('7days')}
            >
              Last 7D
            </button>
            <button
              type="button"
              className={`filter-pill ${timeRange === 'today' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('today')}
            >
              Today
            </button>
          </div>

          {/* Export CSV Button */}
          <button className="export-pdf-btn" onClick={exportToCSV}>
            <FaDownload />
            Export CSV
          </button>

          {/* Notification Bell */}
          <div
            className="notification-bell"
            onClick={() => setShowNotifications(true)}
            title="View notifications"
            role="button"
            tabIndex={0}
            aria-label="Open notifications"
          >
            <FaBell className="bell-icon" />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </div>
        </div>
      </header>

      {/* Standing & Anti-Hoarding Executive Banner */}
      <section className={`standing-executive-banner banner-${metrics.standing.level}`}>
        <div className="banner-left">
          <div className="banner-icon-box">
            <metrics.standing.icon className="banner-main-icon" />
          </div>
          <div className="banner-info">
            <div className="banner-heading-row">
              <h3 className="banner-heading">{metrics.standing.label}</h3>
              <span className="banner-staff-tag">Staff: <strong>{staffName || 'Staff Member'}</strong></span>
              {metrics.overdueCount > 0 && (
                <span className="banner-alert-chip">{metrics.overdueCount} Overdue</span>
              )}
            </div>
            <p className="banner-subtext">{metrics.standing.description}</p>
          </div>
        </div>

        <div className="banner-right">
          <div className="anti-hoard-strip">
            <span className="anti-hoard-policy" title="Anti-Hoarding Rule: Staff with 10+ requests in progress are limited to accepting 5 requests per day">
              <span className="policy-dot" />
              Anti-Hoarding: 10+ in progress → max 5 claims/day
            </span>
            <span
              className={`staff-load-badge ${metrics.isAtClaimLimit ? 'limit-reached' : metrics.isRestrictedByHoarding ? 'warning' : ''}`}
            >
              {metrics.isRestrictedByHoarding ? (
                <>Accepted Today: <strong>{metrics.acceptedTodayCount}/{HOARDING_DAILY_LIMIT}</strong></>
              ) : (
                <>In Progress: <strong>{metrics.activeCount}/{HOARDING_IN_PROGRESS_THRESHOLD}</strong></>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* High-Level Metric Cards Grid */}
      <section className="metrics-cards-grid">
        {/* 1. Performance Efficiency Score Card */}
        <div 
          className="perf-card perf-card--gauge"
          ref={tierContainerRef}
        >
          <div className="gauge-header">
            <div 
              className="gauge-title-interactive"
              onClick={handleToggleTierPopover}
              onMouseEnter={handleMouseEnterTier}
              onMouseLeave={handleMouseLeaveTier}
              tabIndex={0}
              role="button"
              aria-expanded={showTierPopover || isHoveringTier}
              aria-haspopup="dialog"
              aria-label="Efficiency Score. Click or hover to view Graded Tiers breakdown."
              title="Click or hover to view Graded Tiers breakdown"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleTierPopover(e);
                }
              }}
            >
              <span className="metric-micro-label">EFFICIENCY SCORE</span>
              <FaInfoCircle className="tier-info-icon" aria-hidden="true" />
            </div>

            {(() => {
              const grade = getGradeInfo(metrics.performanceScore);
              return (
                <span 
                  className={`score-grade-badge ${grade.className} score-grade-badge--interactive`}
                  onClick={handleToggleTierPopover}
                  onMouseEnter={handleMouseEnterTier}
                  onMouseLeave={handleMouseLeaveTier}
                  tabIndex={0}
                  role="button"
                  aria-expanded={showTierPopover || isHoveringTier}
                  aria-haspopup="dialog"
                  aria-label={`Current Grade: ${grade.grade}. Click or hover to view Graded Tiers.`}
                  title="Click or hover to view Graded Tiers breakdown"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleTierPopover(e);
                    }
                  }}
                >
                  <span className="grade-badge-dot" aria-hidden="true" />
                  {grade.grade}
                </span>
              );
            })()}
          </div>

          {/* Graded Tiers Hover/Click Popover */}
          {(showTierPopover || isHoveringTier) && (
            <div 
              className="graded-tiers-popover"
              role="dialog"
              aria-label="Graded Tiers & Score Breakdown"
              onMouseEnter={handleMouseEnterTier}
              onMouseLeave={handleMouseLeaveTier}
            >
              <div className="tiers-popover-header">
                <div className="tiers-popover-title-row">
                  <span className="tiers-popover-icon-box">
                    <FaTrophy />
                  </span>
                  <div>
                    <h4 className="tiers-popover-title">Efficiency Score Tiers</h4>
                    <span className="tiers-popover-subtitle">Grading scale & performance standards</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="tiers-popover-close-btn"
                  onClick={() => {
                    setShowTierPopover(false);
                    setIsHoveringTier(false);
                  }}
                  aria-label="Close graded tiers guide"
                >
                  <FaTimes />
                </button>
              </div>

              <p className="tiers-popover-intro">
                Your score (0–100) measures SLA promptness, active queue health, anti-hoarding limits, and resolution volume:
              </p>

              <div className="tiers-popover-list">
                {GRADED_TIERS.map(tier => {
                  const isCurrent = getGradeInfo(metrics.performanceScore).grade === tier.grade;
                  return (
                    <div 
                      key={tier.grade} 
                      className={`tier-popover-item ${isCurrent ? 'tier-current' : ''}`}
                    >
                      <div className="tier-item-top">
                        <div className="tier-item-badge-wrap">
                          <span className={`score-grade-badge ${tier.badgeClass}`}>
                            <span className="grade-badge-dot" aria-hidden="true" />
                            {tier.grade}
                          </span>
                          <span className="tier-range-pill">{tier.scoreRange}</span>
                        </div>
                        <div className="tier-item-label-wrap">
                          <span className="tier-item-name">{tier.label}</span>
                          {isCurrent && (
                            <span className="tier-current-tag">Current Standing</span>
                          )}
                        </div>
                      </div>
                      <p className="tier-item-desc">{tier.summary}</p>
                    </div>
                  );
                })}
              </div>

              <div className="tiers-popover-footer">
                <FaInfoCircle className="tiers-footer-icon" />
                <span>Hover or click anywhere outside to close. Target institutional standard is <strong>Grade A (80+)</strong>.</span>
              </div>
            </div>
          )}
          <div className="gauge-body">
            <div className="gauge-ring-wrap">
              <svg viewBox="0 0 100 100" className="gauge-svg" aria-label={`Score: ${metrics.performanceScore} percent`}>
                <circle
                  className="gauge-bg-circle"
                  cx="50"
                  cy="50"
                  r="42"
                />
                <circle
                  className="gauge-val-circle"
                  cx="50"
                  cy="50"
                  r="42"
                  strokeDasharray={`${(metrics.performanceScore / 100) * 263.89} 263.89`}
                  style={{
                    stroke: metrics.performanceScore >= 80 
                      ? 'var(--green-700)' 
                      : metrics.performanceScore >= 60 
                      ? 'var(--color-warning)' 
                      : 'var(--color-danger)'
                  }}
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-number">{metrics.performanceScore}</span>
                <span className="gauge-unit">/ 100</span>
              </div>
            </div>
            <div className="gauge-text-side">
              <span className="gauge-status-title">Service Index</span>
              <p className="gauge-status-sub">
                Based on prompt resolution, SLA timeline compliance, and workload balance.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Active Requests (In Process) */}
        <div className="perf-card perf-card--active">
          <div className="perf-card-top">
            <span className="metric-micro-label">ACTIVE WORKLOAD</span>
            <div className="perf-card-icon-wrap in-progress-tint">
              <FaClock className="perf-icon in-progress-color" />
            </div>
          </div>
          <div className="perf-card-middle">
            <span className="metric-large-number">{metrics.activeCount}</span>
            <span className="metric-context-chip">
              {metrics.activeCount === 1 ? '1 active ticket' : `${metrics.activeCount} active tickets`}
            </span>
          </div>
          <div className="perf-card-bottom">
            <span className="subtext-muted">
              {metrics.activeCount >= HOARDING_IN_PROGRESS_THRESHOLD 
                ? '⚠️ Above threshold capacity' 
                : '✓ Within safe handling capacity'}
            </span>
          </div>
        </div>

        {/* 3. Resolved Requests */}
        <div className="perf-card perf-card--resolved">
          <div className="perf-card-top">
            <span className="metric-micro-label">RESOLVED TICKETS</span>
            <div className="perf-card-icon-wrap resolved-tint">
              <FaCheckCircle className="perf-icon resolved-color" />
            </div>
          </div>
          <div className="perf-card-middle">
            <span className="metric-large-number">{metrics.resolvedCount}</span>
            <span className="metric-context-chip green-chip">
              {timeRange === 'all' ? 'All-Time' : 'In Selected Range'}
            </span>
          </div>
          <div className="perf-card-bottom">
            <span className="subtext-muted">
              {metrics.allTimeResolved} lifetime completed requests
            </span>
          </div>
        </div>

        {/* 4. On-Time Resolution Rate */}
        <div className="perf-card perf-card--ontime">
          <div className="perf-card-top">
            <span className="metric-micro-label">ON-TIME SLA RATE</span>
            <div className="perf-card-icon-wrap target-tint">
              <FaTrophy className="perf-icon target-color" />
            </div>
          </div>
          <div className="perf-card-middle">
            <span className="metric-large-number">{metrics.onTimeRate}%</span>
            <span className="metric-context-chip">Target: 90%</span>
          </div>
          <div className="perf-card-bottom">
            <span className="subtext-muted">
              {metrics.onTimeRate >= 90 ? '✓ Exceeding standard SLA' : 'Aim to complete before ETC'}
            </span>
          </div>
        </div>

        {/* 5. Average Turnaround Time */}
        <div className="perf-card perf-card--turnaround">
          <div className="perf-card-top">
            <span className="metric-micro-label">AVG. TURNAROUND</span>
            <div className="perf-card-icon-wrap speed-tint">
              <FaBolt className="perf-icon speed-color" />
            </div>
          </div>
          <div className="perf-card-middle">
            <span className="metric-large-number">{metrics.avgTurnaroundDisplay}</span>
            <span className="metric-context-chip">Claim to Resolve</span>
          </div>
          <div className="perf-card-bottom">
            <span className="subtext-muted">
              Average turnaround speed on completed cases
            </span>
          </div>
        </div>

        {/* 6. Overdue / Urgent Queue */}
        <div className="perf-card perf-card--overdue">
          <div className="perf-card-top">
            <span className="metric-micro-label">OVERDUE / AT RISK</span>
            <div className={`perf-card-icon-wrap ${metrics.overdueCount > 0 ? 'overdue-tint' : 'safe-tint'}`}>
              <FaExclamationTriangle className={`perf-icon ${metrics.overdueCount > 0 ? 'overdue-color' : 'safe-color'}`} />
            </div>
          </div>
          <div className="perf-card-middle">
            <span className={`metric-large-number ${metrics.overdueCount > 0 ? 'number-alert' : ''}`}>
              {metrics.overdueCount}
            </span>
            <span className={`metric-context-chip ${metrics.overdueCount > 0 ? 'red-chip' : ''}`}>
              {metrics.overdueCount > 0 ? 'Action Needed' : 'Zero Overdue'}
            </span>
          </div>
          <div className="perf-card-bottom">
            <span className="subtext-muted">
              {metrics.dueTodayCount > 0 ? `${metrics.dueTodayCount} due today` : 'No immediate pending lapse'}
            </span>
          </div>
        </div>
      </section>

      {/* Mid Visual Section: 7-Day Velocity Chart & Workload Distribution */}
      <section className="performance-charts-grid">
        {/* Left: Resolution Activity Chart */}
        <div className="chart-box velocity-chart-card">
          <div className="chart-box-header">
            <div>
              <h3 className="chart-title">7-Day Resolution Velocity</h3>
              <p className="chart-subtitle">Daily count of requests successfully closed by you</p>
            </div>
            <span className="chart-badge">Past 7 Days</span>
          </div>

          <div className="velocity-bars-wrapper">
            <div className="velocity-plot-area">
              {weeklyVelocityData.days.map((day, idx) => {
                const heightPercent = weeklyVelocityData.maxCount > 0
                  ? Math.max(8, (day.count / weeklyVelocityData.maxCount) * 100)
                  : 8;
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={idx}
                    className={`bar-column ${isHovered ? 'bar-hovered' : ''}`}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                  >
                    <div className="bar-hover-val">
                      <strong>{day.count}</strong> {day.count === 1 ? 'ticket' : 'tickets'}
                    </div>
                    <div className="bar-slot">
                      <div
                        className={`bar-fill ${day.count > 0 ? 'bar-has-val' : 'bar-empty'}`}
                        style={{ height: `${day.count > 0 ? heightPercent : 6}%` }}
                      />
                    </div>
                    <span className="bar-x-label">{day.label}</span>
                    <span className="bar-x-sub">{day.fullDate}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Service Standards & Workload Distribution */}
        <div className="chart-box breakdown-card">
          <div className="chart-box-header">
            <div>
              <h3 className="chart-title">Queue Breakdown & Health</h3>
              <p className="chart-subtitle">Status proportions in your current assigned scope</p>
            </div>
            <span className="chart-badge">Total: {metrics.totalHandled}</span>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="segmented-distribution-bar">
            {metrics.totalHandled > 0 ? (
              <>
                <div
                  className="seg-part seg-resolved"
                  style={{ width: `${(metrics.resolvedCount / metrics.totalHandled) * 100}%` }}
                  title={`Resolved: ${metrics.resolvedCount}`}
                />
                <div
                  className="seg-part seg-inprogress"
                  style={{ width: `${(Math.max(0, metrics.activeCount - metrics.overdueCount) / metrics.totalHandled) * 100}%` }}
                  title={`In Process (On Track): ${Math.max(0, metrics.activeCount - metrics.overdueCount)}`}
                />
                {metrics.overdueCount > 0 && (
                  <div
                    className="seg-part seg-overdue"
                    style={{ width: `${(metrics.overdueCount / metrics.totalHandled) * 100}%` }}
                    title={`Overdue: ${metrics.overdueCount}`}
                  />
                )}
              </>
            ) : (
              <div className="seg-part seg-empty" style={{ width: '100%' }} />
            )}
          </div>

          {/* Breakdown Items List */}
          <div className="breakdown-items-list">
            <div className="breakdown-item">
              <div className="breakdown-item-label">
                <span className="legend-dot dot-resolved" />
                <span>Resolved Requests</span>
              </div>
              <div className="breakdown-item-data">
                <strong>{metrics.resolvedCount}</strong>
                <span className="breakdown-pct">
                  {metrics.totalHandled > 0 ? `${Math.round((metrics.resolvedCount / metrics.totalHandled) * 100)}%` : '0%'}
                </span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-item-label">
                <span className="legend-dot dot-inprogress" />
                <span>Active In Process</span>
              </div>
              <div className="breakdown-item-data">
                <strong>{metrics.activeCount}</strong>
                <span className="breakdown-pct">
                  {metrics.totalHandled > 0 ? `${Math.round((metrics.activeCount / metrics.totalHandled) * 100)}%` : '0%'}
                </span>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-item-label">
                <span className="legend-dot dot-overdue" />
                <span>Overdue / Behind Schedule</span>
              </div>
              <div className="breakdown-item-data">
                <strong className={metrics.overdueCount > 0 ? 'text-danger' : ''}>{metrics.overdueCount}</strong>
                <span className="breakdown-pct">
                  {metrics.totalHandled > 0 ? `${Math.round((metrics.overdueCount / metrics.totalHandled) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick SLA Benchmarks */}
          <div className="sla-benchmark-footer">
            <div className="benchmark-stat">
              <span className="benchmark-title">Institutional Standard</span>
              <span className="benchmark-val">90% On-Time Target</span>
            </div>
            <div className="benchmark-divider" />
            <div className="benchmark-stat">
              <span className="benchmark-title">Current Standing</span>
              <span className={`benchmark-val ${metrics.onTimeRate >= 90 ? 'text-success' : 'text-warning'}`}>
                {metrics.onTimeRate}% Performance
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Handled Requests Performance Log Table */}
      <section className="tickets-section">
        <div className="tickets-toolbar">
          <div className="toolbar-left-group">
            <div className="tickets-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === 'all'}
                className={`tab ${tableTab === 'all' ? 'active' : ''}`}
                onClick={() => handleTabChange('all')}
              >
                <span>All Handled</span>
                <span className="tab-count">{myFilteredTickets.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === 'in_progress'}
                className={`tab ${tableTab === 'in_progress' ? 'active' : ''}`}
                onClick={() => handleTabChange('in_progress')}
              >
                <span>In Process</span>
                <span className="tab-count">
                  {myFilteredTickets.filter(t => t.status === 'In Process').length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === 'resolved'}
                className={`tab ${tableTab === 'resolved' ? 'active' : ''}`}
                onClick={() => handleTabChange('resolved')}
              >
                <span>Resolved</span>
                <span className="tab-count">
                  {myFilteredTickets.filter(t => t.status === 'Resolved').length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tableTab === 'overdue'}
                className={`tab ${tableTab === 'overdue' ? 'active' : ''}`}
                onClick={() => handleTabChange('overdue')}
              >
                <span>Overdue</span>
                <span className="tab-count">{metrics.overdueCount}</span>
              </button>
            </div>
          </div>

          <div className="toolbar-right-group">
            <div className="table-search-box">
              <FaSearch className="table-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="table-search-input"
                placeholder="Search by Request ID, subject, or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search handled requests"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="table-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {tableTickets.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              <FaInbox />
            </div>
            <h3 className="admin-empty-title">No Requests Found</h3>
            <p className="admin-empty-desc">
              {searchQuery
                ? `No requests match "${searchQuery}" in this filter.`
                : 'There are currently no requests matching the selected category.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: '12px' }}
                onClick={() => setSearchQuery('')}
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="an-recent-table-wrap">
              <table className="an-recent-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%' }}>Request</th>
                    <th style={{ width: '22%' }}>Student</th>
                    <th style={{ width: '15%' }}>Status</th>
                    <th style={{ width: '18%' }}>Estimated Date (ETC)</th>
                    <th style={{ width: '17%' }}>SLA Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {tableTickets.map((ticket, idx) => {
                    const ticketIdDisplay = ticket.id
                      ? String(ticket.id).startsWith('#')
                        ? ticket.id
                        : `#${ticket.id}`
                      : '#N/A';
                    const formattedDate = formatDate(ticket.createdAt);
                    const formattedEtc = formatDate(ticket.etc);
                    const formattedResolved = formatDate(ticket.resolvedAt);
                    const isGuest = Boolean(ticket.isGuest);
                    const studentName = ticket.student || ticket.studentName || (isGuest ? 'Guest User' : 'Student');
                    const studentId = ticket.studentId || ticket.studentID || ticket.idNumber;
                    const sla = getTicketSlaTag(ticket);

                    return (
                      <tr key={ticket.firestoreId || ticket.id || idx}>
                        <td>
                          <div className="an-recent-title">{ticket.title}</div>
                          <span className="an-recent-id">{ticketIdDisplay}</span>
                        </td>

                        <td>
                          <div className="an-recent-student">{studentName}</div>
                          <span className="an-recent-id">
                            {isGuest ? 'Guest Inquirer' : (studentId ? `ID: ${studentId}` : 'Student')}
                          </span>
                        </td>

                        <td>
                          <span className={`an-status-badge an-status-badge--${String(ticket.status || '').toLowerCase().replace(/\s+/g, '')}`}>
                            {ticket.status}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontWeight: 500, color: '#374151' }}>
                            {ticket.status === 'Resolved' && formattedResolved !== 'N/A'
                              ? `Resolved: ${formattedResolved}`
                              : formattedEtc}
                          </div>
                          {ticket.claimedAt && (
                            <span className="an-recent-id">
                              Claimed: {formatDate(ticket.claimedAt)}
                            </span>
                          )}
                        </td>

                        <td>
                          <span className={`sla-compliance-pill ${sla.className}`}>
                            {sla.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Advisory Information Footer */}
      <footer className="performance-info-footer">
        <FaInfoCircle className="footer-info-icon" />
        <div className="footer-info-text">
          <strong>Institutional Performance Guidelines:</strong>
          <span>
            Performance ratings and turnaround metrics are logged on the administration network to support balanced workflow allocation. 
            In compliance with our anti-hoarding policy, staff maintaining 10 or more active in-progress tickets are limited to 5 new claims per day.
          </span>
        </div>
      </footer>

      {/* Notifications Modal */}
      {showNotifications && (
        <Notifications
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
};

export default MyPerformance;
