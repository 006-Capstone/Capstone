import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FaBell, 
  FaClock, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaTrophy, 
  FaTimes, 
  FaCalendarAlt, 
  FaChartLine, 
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
import { useOfficeTickets } from '../hooks/useOfficeTickets';
import { calculateEfficiencyMetrics, getStaffTickets } from '../utils/efficiencyHelper';
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

// Helper for clearance tier info and badge classes matching Superadmin Performance Monitor
const getClearanceInfo = (rate) => {
  if (rate >= 90) {
    return {
      tier: 'Outstanding',
      label: 'Outstanding Throughput',
      className: 'grade-badge--a-plus'
    };
  }
  if (rate >= 80) {
    return {
      tier: 'Good Standing',
      label: 'Target Standard',
      className: 'grade-badge--a'
    };
  }
  if (rate >= 60) {
    return {
      tier: 'Needs Focus',
      label: 'Review Advisory',
      className: 'grade-badge--c'
    };
  }
  return {
    tier: 'Warning Review',
    label: 'Under Warning Review',
    className: 'grade-badge--needs-focus'
  };
};

export const CLEARANCE_TIERS = [
  {
    tier: 'Outstanding',
    range: '90% – 100%',
    minScore: 90,
    label: 'Outstanding Throughput',
    badgeClass: 'grade-badge--a-plus',
    summary: 'Exceptional clearance rate with minimal backlogs and healthy intake vs. resolution balance.'
  },
  {
    tier: 'Good Standing',
    range: '80% – 89%',
    minScore: 80,
    label: 'Target Institutional Standard',
    badgeClass: 'grade-badge--a',
    summary: 'Strong resolution pace maintaining institutional expectations and preventing ticket accumulation.'
  },
  {
    tier: 'Needs Focus',
    range: '60% – 79%',
    minScore: 60,
    label: 'Formal Review Advisory',
    badgeClass: 'grade-badge--c',
    summary: 'Workload resolution pace is slowing down. Prompt queue attention is required to avoid monthly rollovers.'
  },
  {
    tier: 'Warning Review',
    range: 'Below 60%',
    minScore: 0,
    label: 'Warning Review / NTE Risk',
    badgeClass: 'grade-badge--needs-focus',
    summary: 'Clearance rate is below acceptable threshold. Unresolved bottlenecks trigger progressive administrative review (NTE).'
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Time-range filter: 'all', 'month', '30days', '7days', 'today'
  const [timeRange, setTimeRange] = useState('all');

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
  const staffOffice = staffData.office || staffData.department || '';

  // Single source of truth for tickets — identical to AdminDashboard
  const { tickets, loading, refresh } = useOfficeTickets(staffOffice);

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

  // Filter requests handled by or assigned to this staff member using unified helper
  const myAllTickets = useMemo(() => {
    return getStaffTickets(tickets, staffName, staffUid);
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

  // Compute detailed metrics for the staff member using unified calculation
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Unified Efficiency Metrics (Synchronized with Superadmin Health Monitor & Dashboard Alert Modal)
    const effMetrics = calculateEfficiencyMetrics(myAllTickets);

    const activeCount = effMetrics.activeCount;
    const overdueCount = effMetrics.overdueCount;
    const onTimeRate = effMetrics.onTimeRate;
    const performanceScore = effMetrics.score;

    // Active in progress tickets
    const currentActiveTickets = effMetrics.activeCount > 0
      ? myAllTickets.filter(t => {
          const s = (t.status || '').toLowerCase();
          return s !== 'resolved' && s !== 'cancelled' && s !== 'rejected';
        })
      : [];

    // Due today active requests
    const dueTodayActiveTickets = currentActiveTickets.filter(t => {
      const deadline = getEtcDeadline(t.etc || t.estimatedCompletion);
      if (!deadline) return false;
      return (
        deadline.getFullYear() === now.getFullYear() &&
        deadline.getMonth() === now.getMonth() &&
        deadline.getDate() === now.getDate()
      );
    });
    const dueTodayCount = dueTodayActiveTickets.length;

    // Resolved tickets in the selected filtered period
    const resolvedInPeriod = myFilteredTickets.filter(t => (t.status || '').toLowerCase() === 'resolved');
    const resolvedCount = resolvedInPeriod.length;

    // Total resolved all-time
    const allTimeResolvedTickets = myAllTickets.filter(t => (t.status || '').toLowerCase() === 'resolved');
    const allTimeResolved = allTimeResolvedTickets.length;

    // Average Turnaround time
    let turnAroundTotalMs = 0;
    let turnAroundValidCount = 0;

    resolvedInPeriod.forEach(t => {
      const resolvedDate = parseDate(t.resolvedAt) || parseDate(t.updatedAt);
      const claimedDate = parseDate(t.claimedAt) || parseDate(t.createdAt);

      if (resolvedDate && claimedDate) {
        const diff = resolvedDate.getTime() - claimedDate.getTime();
        if (diff > 0) {
          turnAroundTotalMs += diff;
          turnAroundValidCount += 1;
        }
      }
    });

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

    // Today's claims (for anti-hoarding rule)
    const acceptedTodayCount = myAllTickets.filter(t => {
      const claimed = parseDate(t.claimedAt) || ((t.status || '').toLowerCase().includes('process') ? parseDate(t.updatedAt || t.createdAt) : null);
      if (!claimed) return false;
      return claimed.getTime() >= startOfToday;
    }).length;

    const isRestrictedByHoarding = activeCount >= HOARDING_IN_PROGRESS_THRESHOLD;
    const isAtClaimLimit = isRestrictedByHoarding && acceptedTodayCount >= HOARDING_DAILY_LIMIT;

    // Standing Tier (Aligned with Unified Health Standards)
    let standing = {
      level: 'good',
      label: 'Good Standing',
      icon: FaCheckCircle,
      description: 'Your queue is healthy, service delivery is on schedule, and requests are handled promptly.'
    };

    if (overdueCount > 0 || isAtClaimLimit || performanceScore <= 60) {
      standing = {
        level: 'critical',
        label: performanceScore <= 60 ? 'Critical Attention' : 'Attention Required',
        icon: FaExclamationTriangle,
        description: overdueCount > 0
          ? `${overdueCount} active request${overdueCount === 1 ? ' is' : 's are'} overdue past estimated completion date or SLA limit (72 hrs). Prioritize processing overdue tickets.`
          : isAtClaimLimit
          ? `Daily claim limit reached (${acceptedTodayCount}/${HOARDING_DAILY_LIMIT} claims today) under the Anti-Hoarding policy. Resolve in-progress requests before accepting more.`
          : 'Your efficiency score has dropped to 60% or lower, indicating service bottleneck risk visible to Superadmin oversight.'
      };
    } else if (isRestrictedByHoarding || performanceScore < 75) {
      standing = {
        level: 'advisory',
        label: 'Needs Focus',
        icon: FaClock,
        description: isRestrictedByHoarding
          ? `Workload threshold reached with ${activeCount} active requests in progress. Daily limit of ${HOARDING_DAILY_LIMIT} claims applies.`
          : 'Service turnaround is nearing threshold. Continue processing your active queue to improve turnaround time and efficiency score.'
      };
    } else if (performanceScore >= 90) {
      standing = {
        level: 'outstanding',
        label: 'Outstanding Performance',
        icon: FaTrophy,
        description: 'Exceptional turnaround speed and prompt SLA adherence across all assigned tickets.'
      };
    }

    const totalHandled = myFilteredTickets.length;
    const clearanceRate = totalHandled > 0
      ? Math.round((resolvedCount / totalHandled) * 100)
      : 100;

    return {
      activeCount,
      overdueCount,
      dueTodayCount,
      resolvedCount,
      allTimeResolved,
      totalHandled,
      clearanceRate,
      allTimeTotal: myAllTickets.length,
      onTimeRate,
      avgTurnaroundDisplay,
      acceptedTodayCount,
      isRestrictedByHoarding,
      isAtClaimLimit,
      performanceScore,
      standing,
      slaScore: effMetrics.slaScore,
      queueScore: effMetrics.queueScore,
      workloadScore: effMetrics.workloadScore,
      volumeBonus: effMetrics.volumeBonus,
      tier: effMetrics.tier,
      tierLabel: effMetrics.tierLabel,
      tierColor: effMetrics.tierColor,
      isWarning: effMetrics.isWarning
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

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Helper for SLA performance compliance label
  const getTicketSlaTag = (ticket) => {
    const now = new Date();
    const deadline = getEtcDeadline(ticket.etc || ticket.estimatedCompletion);
    const resolvedDate = parseDate(ticket.resolvedAt) || ((ticket.status || '').toLowerCase() === 'resolved' ? parseDate(ticket.updatedAt) : null);
    const s = (ticket.status || '').toLowerCase();

    if (s === 'resolved') {
      if (deadline && resolvedDate) {
        if (resolvedDate <= deadline) {
          return { label: 'On-Time', className: 'sla-ontime' };
        }
        return { label: 'Late', className: 'sla-late' };
      }
      return { label: 'Completed', className: 'sla-ontime' };
    }

    if (s !== 'cancelled' && s !== 'rejected') {
      if (!deadline) {
        const created = parseDate(ticket.createdAt);
        if (created && (now.getTime() - created.getTime()) > (72 * 60 * 60 * 1000)) {
          return { label: 'Overdue (>72h)', className: 'sla-overdue' };
        }
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
    csv += `Monthly Clearance Rate,${metrics.clearanceRate}%\n`;
    csv += `Clearance Standing,${getClearanceInfo(metrics.clearanceRate).tier}\n`;
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
    
    myFilteredTickets.forEach(t => {
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
          <div className="performance-header-row-1">
            <div className="title-row">
              <h1 className="performance-title">My Performance</h1>
            </div>
          </div>
          <div className="performance-header-row-2">
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
        {/* Row 1: Title on left, Action buttons on far right (never wraps) */}
        <div className="performance-header-row-1">
          <div className="title-row">
            <h1 className="performance-title">My Performance</h1>
          </div>

          <div className="performance-header-actions">
            {/* Export CSV Button */}
            <button className="export-pdf-btn" onClick={exportToCSV}>
              <FaDownload />
              Export CSV
            </button>

            {/* Notification Bell */}
            <button
              type="button"
              className="notification-bell"
              onClick={() => setShowNotifications(true)}
              title="Notifications"
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={showNotifications}
            >
              <FaBell className="bell-icon" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Subtitle description on left, Date filter buttons on right */}
        <div className="performance-header-row-2">
          <p className="performance-subtitle">
            Track your personal request handling productivity, turnaround time, and institutional compliance standards
          </p>

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
        {/* 1. Monthly Clearance Rate Card */}
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
              aria-label="Monthly Clearance Rate. Click or hover to view clearance standards."
              title="Click or hover to view clearance standards"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggleTierPopover(e);
                }
              }}
            >
              <span className="metric-micro-label">CLEARANCE RATE</span>
              <FaInfoCircle className="tier-info-icon" aria-hidden="true" />
            </div>

            {(() => {
              const tierInfo = getClearanceInfo(metrics.clearanceRate);
              return (
                <span 
                  className={`score-grade-badge ${tierInfo.className} score-grade-badge--interactive`}
                  onClick={handleToggleTierPopover}
                  onMouseEnter={handleMouseEnterTier}
                  onMouseLeave={handleMouseLeaveTier}
                  tabIndex={0}
                  role="button"
                  aria-expanded={showTierPopover || isHoveringTier}
                  aria-haspopup="dialog"
                  aria-label={`Current Standing: ${tierInfo.tier}. Click or hover to view clearance standards.`}
                  title="Click or hover to view clearance standards"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggleTierPopover(e);
                    }
                  }}
                >
                  <span className="grade-badge-dot" aria-hidden="true" />
                  {tierInfo.tier}
                </span>
              );
            })()}
          </div>

          {/* Clearance Standards Hover/Click Popover */}
          {(showTierPopover || isHoveringTier) && (
            <div 
              className="graded-tiers-popover"
              role="dialog"
              aria-label="Institutional Clearance Standards"
              onMouseEnter={handleMouseEnterTier}
              onMouseLeave={handleMouseLeaveTier}
            >
              <div className="tiers-popover-header">
                <div className="tiers-popover-title-row">
                  <span className="tiers-popover-icon-box">
                    <FaTrophy />
                  </span>
                  <div>
                    <h4 className="tiers-popover-title">Clearance Standards</h4>
                    <span className="tiers-popover-subtitle">Superadmin evaluation benchmarks</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="tiers-popover-close-btn"
                  onClick={() => {
                    setShowTierPopover(false);
                    setIsHoveringTier(false);
                  }}
                  aria-label="Close clearance standards guide"
                >
                  <FaTimes />
                </button>
              </div>

              <p className="tiers-popover-intro">
                Your Clearance Rate measures the proportion of assigned requests successfully resolved within the evaluation cycle:
              </p>

              <div className="tiers-popover-list">
                {CLEARANCE_TIERS.map(tierItem => {
                  const isCurrent = getClearanceInfo(metrics.clearanceRate).tier === tierItem.tier;
                  return (
                    <div 
                      key={tierItem.tier} 
                      className={`tier-popover-item ${isCurrent ? 'tier-current' : ''}`}
                    >
                      <div className="tier-item-top">
                        <div className="tier-item-badge-wrap">
                          <span className={`score-grade-badge ${tierItem.badgeClass}`}>
                            <span className="grade-badge-dot" aria-hidden="true" />
                            {tierItem.tier}
                          </span>
                          <span className="tier-range-pill">{tierItem.range}</span>
                        </div>
                        <div className="tier-item-label-wrap">
                          <span className="tier-item-name">{tierItem.label}</span>
                          {isCurrent && (
                            <span className="tier-current-tag">Current Standing</span>
                          )}
                        </div>
                      </div>
                      <p className="tier-item-desc">{tierItem.summary}</p>
                    </div>
                  );
                })}
              </div>

              <div className="tiers-popover-footer">
                <FaInfoCircle className="tiers-footer-icon" />
                <span>Target institutional standard is <strong>Good Standing (≥80%)</strong>. Clearance below 60% triggers formal warning reviews.</span>
              </div>
            </div>
          )}
          <div className="gauge-body">
            <div className="gauge-ring-wrap">
              <svg viewBox="0 0 100 100" className="gauge-svg" aria-label={`Clearance Rate: ${metrics.clearanceRate} percent`}>
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
                  strokeDasharray={`${(metrics.clearanceRate / 100) * 263.89} 263.89`}
                  style={{
                    stroke: metrics.clearanceRate >= 80 
                      ? 'var(--green-700)' 
                      : metrics.clearanceRate >= 60 
                      ? 'var(--color-warning)' 
                      : 'var(--color-danger)'
                  }}
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-number">{metrics.clearanceRate}%</span>
                <span className="gauge-unit">Clearance</span>
              </div>
            </div>
            <div className="gauge-text-side">
              <span className="gauge-status-title">Monthly Clearance</span>
              <p className="gauge-status-sub">
                {metrics.resolvedCount} of {metrics.totalHandled} assigned requests resolved in this period.
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

        {/* 4. Average Turnaround Time */}
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
