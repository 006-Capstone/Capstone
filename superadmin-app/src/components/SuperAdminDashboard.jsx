import React, { useState, useEffect } from 'react';
import {
  FaInbox,
  FaClock,
  FaBan,
  FaUsers,
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaChevronRight,
  FaStar,
  FaUserPlus,
  FaUserTie,
  FaEdit,
  FaChartLine,
  FaBuilding,
  FaArrowRight,
  FaHistory
} from 'react-icons/fa';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateTicketOverdue } from '../utils/performanceAnalytics';
import { OverviewCardsSkeleton, WorkflowPulseSkeleton, AnalyticsChartSkeleton, Skeleton } from './common/Skeleton';
import NotificationBell from './NotificationBell';
import RequestDetailsModal from './RequestDetailsModal';
import Toast from './Toast';
import '../styles/SuperAdminDashboard.css';

const SuperAdminDashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalRequests: 0,
    avgResolution: '0d 0h',
    cancelledRate: '0%',
    activeUsers: 0,
    pendingCount: 0,
    inProcessCount: 0,
    resolvedCount: 0,
    cancelledCount: 0,
    activeStudents: 0,
    totalStudents: 0,
    activeStaff: 0,
    totalStaff: 0,
    archivedCount: 0,
    satisfactionPercentage: 0,
    satisfactionRating: '0.0',
    satisfactionTotal: 0
  });

  const [departmentData, setDepartmentData] = useState([
    { label: 'FIN', value: 0, max: 1, percentage: 0, campusSharePct: 0, name: 'Finance Office', officeKey: 'Finance', resolvedCount: 0, activeCount: 0, overdueCount: 0, clearanceRate: 100, statusTier: 'neutral', statusLabel: 'No Activity' },
    { label: 'REG', value: 0, max: 1, percentage: 0, campusSharePct: 0, name: "Registrar's Office", officeKey: 'Registrar', resolvedCount: 0, activeCount: 0, overdueCount: 0, clearanceRate: 100, statusTier: 'neutral', statusLabel: 'No Activity' },
    { label: 'LIB', value: 0, max: 1, percentage: 0, campusSharePct: 0, name: 'Library', officeKey: 'Library', resolvedCount: 0, activeCount: 0, overdueCount: 0, clearanceRate: 100, statusTier: 'neutral', statusLabel: 'No Activity' },
    { label: 'GUI', value: 0, max: 1, percentage: 0, campusSharePct: 0, name: 'Guidance & Counseling', officeKey: 'Guidance', resolvedCount: 0, activeCount: 0, overdueCount: 0, clearanceRate: 100, statusTier: 'neutral', statusLabel: 'No Activity' }
  ]);

  const [recentRequests, setRecentRequests] = useState([]);
  const [selectedRecentRequest, setSelectedRecentRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const computeDepartmentData = (requests) => {
    const allReqs = requests || [];
    const financeRequests = allReqs.filter(req => req.office === 'Finance');
    const registrarRequests = allReqs.filter(req => req.office === 'Registrar');
    const libraryRequests = allReqs.filter(req => req.office === 'Library');
    const guidanceRequests = allReqs.filter(req => req.office === 'Guidance');

    const totalRequests = allReqs.length;
    const maxCount = Math.max(1, financeRequests.length, registrarRequests.length, libraryRequests.length, guidanceRequests.length);

    const buildDeptStats = (label, name, officeKey, deptReqs) => {
      const count = deptReqs.length;
      const resolved = deptReqs.filter(r => (r.status || '').toLowerCase() === 'resolved').length;
      const pending = deptReqs.filter(r => (r.status || '').toLowerCase() === 'pending').length;
      const inProcess = deptReqs.filter(r => ['in process', 'in-process'].includes((r.status || '').toLowerCase())).length;
      const active = pending + inProcess;
      const overdue = deptReqs.filter(r => {
        const status = (r.status || '').toLowerCase();
        if (status === 'resolved' || ['cancelled', 'rejected'].includes(status)) return false;
        const { isOverdue } = calculateTicketOverdue(r);
        return isOverdue;
      }).length;

      const clearanceRate = count > 0 ? Math.round((resolved / count) * 100) : 100;
      const campusSharePct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;

      let statusTier = 'good';
      let statusLabel = `${clearanceRate}% Clearance`;
      if (count === 0) {
        statusTier = 'neutral';
        statusLabel = 'No Activity';
      } else if (overdue > 0) {
        statusTier = 'critical';
        statusLabel = `${overdue} Overdue`;
      } else if (clearanceRate < 60) {
        statusTier = 'warning';
        statusLabel = `${clearanceRate}% Clearance`;
      } else if (clearanceRate < 80) {
        statusTier = 'advisory';
        statusLabel = `${clearanceRate}% Clearance`;
      }

      return {
        label,
        name,
        officeKey,
        value: count,
        max: maxCount,
        percentage: campusSharePct,
        campusSharePct,
        resolvedCount: resolved,
        activeCount: active,
        overdueCount: overdue,
        clearanceRate,
        statusTier,
        statusLabel
      };
    };

    setDepartmentData([
      buildDeptStats('FIN', 'Finance Office', 'Finance', financeRequests),
      buildDeptStats('REG', "Registrar's Office", 'Registrar', registrarRequests),
      buildDeptStats('LIB', 'Library', 'Library', libraryRequests),
      buildDeptStats('GUI', 'Guidance & Counseling', 'Guidance', guidanceRequests)
    ]);
  };

  // Real-time Firestore subscriptions for live dashboard metrics
  useEffect(() => {
    setLoading(true);

    let unsubRequests = () => {};
    let unsubStudents = () => {};
    let unsubStaff = () => {};
    let unsubArchived = () => {};
    let unsubFeedback = () => {};

    let requestsDone = false;
    let studentsDone = false;
    let staffDone = false;

    const checkDone = () => {
      if (requestsDone && studentsDone && staffDone) {
        setLoading(false);
      }
    };

    // Safety timeout so loading spinner never blocks the UI
    const timer = setTimeout(() => {
      setLoading(false);
    }, 6000);

    // 1. Live requests listener
    try {
      unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
        requestsDone = true;
        const allRequests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const totalRequests = allRequests.length;
        const pendingCount = allRequests.filter(req =>
          (req.status || '').toLowerCase() === 'pending'
        ).length;

        const inProcessCount = allRequests.filter(req =>
          (req.status || '').toLowerCase() === 'in process' || (req.status || '').toLowerCase() === 'in-process'
        ).length;

        const resolvedCount = allRequests.filter(req =>
          (req.status || '').toLowerCase() === 'resolved'
        ).length;

        const cancelledCount = allRequests.filter(req =>
          ['cancelled', 'rejected'].includes((req.status || '').toLowerCase())
        ).length;

        const cancelledRate = totalRequests > 0
          ? ((cancelledCount / totalRequests) * 100).toFixed(1) + '%'
          : '0%';

        const resolvedRequests = allRequests.filter(req =>
          (req.status || '').toLowerCase() === 'resolved' && req.resolvedAt && req.createdAt
        );
        let avgResolutionTime = '0d 0h';

        if (resolvedRequests.length > 0) {
          const totalResolutionTime = resolvedRequests.reduce((sum, req) => {
            const created = req.createdAt?.toDate?.() || new Date(req.createdAt);
            const resolved = req.resolvedAt?.toDate?.() || new Date(req.resolvedAt);
            return sum + Math.max(0, resolved - created);
          }, 0);

          const avgMs = totalResolutionTime / resolvedRequests.length;
          const days = Math.floor(avgMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((avgMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          avgResolutionTime = `${days}d ${hours}h`;
        }

        setStats(prev => ({
          ...prev,
          totalRequests,
          pendingCount,
          inProcessCount,
          resolvedCount,
          cancelledCount,
          cancelledRate,
          avgResolution: avgResolutionTime
        }));

        // Recent requests (top 5 latest)
        const sortedRecent = [...allRequests].sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        }).slice(0, 5);

        setRecentRequests(sortedRecent);
        computeDepartmentData(allRequests);
        checkDone();
      }, (error) => {
        console.error('[Dashboard] Error listening to requests:', error);
        requestsDone = true;
        checkDone();
      });
    } catch (err) {
      console.error('[Dashboard] Failed to attach requests listener:', err);
      requestsDone = true;
      checkDone();
    }

    // 2. Live students listener
    try {
      unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
        studentsDone = true;
        const totalStudents = snapshot.docs.length;
        const activeStudents = snapshot.docs.filter(doc => doc.data().isActive !== false).length;

        setStats(prev => ({
          ...prev,
          totalStudents,
          activeStudents,
          activeUsers: activeStudents + (prev.activeStaff || 0)
        }));
        checkDone();
      }, (error) => {
        console.error('[Dashboard] Error listening to students:', error);
        studentsDone = true;
        checkDone();
      });
    } catch (err) {
      console.error('[Dashboard] Failed to attach students listener:', err);
      studentsDone = true;
      checkDone();
    }

    // 3. Live staff listener
    try {
      unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
        staffDone = true;
        const totalStaff = snapshot.docs.length;
        const activeStaff = snapshot.docs.filter(doc => doc.data().isActive !== false).length;

        setStats(prev => ({
          ...prev,
          totalStaff,
          activeStaff,
          activeUsers: (prev.activeStudents || 0) + activeStaff
        }));
        checkDone();
      }, (error) => {
        console.error('[Dashboard] Error listening to staff:', error);
        staffDone = true;
        checkDone();
      });
    } catch (err) {
      console.error('[Dashboard] Failed to attach staff listener:', err);
      staffDone = true;
      checkDone();
    }

    // 4. Live archived count
    try {
      unsubArchived = onSnapshot(collection(db, 'archivedAccounts'), (snapshot) => {
        setStats(prev => ({
          ...prev,
          archivedCount: snapshot.docs.length
        }));
      }, (error) => {
        // collection might not exist yet
      });
    } catch (err) {}

    // 5. Live feedback listener for Student Satisfaction
    try {
      unsubFeedback = onSnapshot(collection(db, 'feedback'), (snapshot) => {
        const feedbacks = snapshot.docs.map(doc => doc.data());
        const totalFeedback = feedbacks.length;
        let satisfactionPercentage = 0;
        let avgRating = 0;

        if (totalFeedback > 0) {
          const totalRating = feedbacks.reduce((sum, f) => {
            const rating = f.overallRating || f.rating || 0;
            return sum + rating;
          }, 0);
          avgRating = totalRating / totalFeedback;
          satisfactionPercentage = Math.round((avgRating / 5) * 100);
        }

        setStats(prev => ({
          ...prev,
          satisfactionPercentage,
          satisfactionRating: avgRating > 0 ? avgRating.toFixed(1) : '0.0',
          satisfactionTotal: totalFeedback
        }));
      }, (error) => {
        console.error('[Dashboard] Error listening to feedback:', error);
      });
    } catch (err) {
      console.error('[Dashboard] Failed to attach feedback listener:', err);
    }

    return () => {
      clearTimeout(timer);
      unsubRequests();
      unsubStudents();
      unsubStaff();
      unsubArchived();
      unsubFeedback();
    };
  }, []);

  const formatRecentDate = (timestamp) => {
    if (!timestamp) return 'Recently';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderStatusBadge = (status) => {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'resolved') {
      return (
        <span className="dash-status-badge status-resolved">
          <span className="dash-status-dot" aria-hidden="true"></span>
          Resolved
        </span>
      );
    }
    if (s === 'in process' || s === 'in-process' || s === 'in_process' || s === 'in progress' || s === 'in-progress') {
      return (
        <span className="dash-status-badge status-in-process">
          <span className="dash-status-dot" aria-hidden="true"></span>
          In Process
        </span>
      );
    }
    if (s === 'cancelled' || s === 'rejected') {
      return (
        <span className="dash-status-badge status-cancelled">
          <span className="dash-status-dot" aria-hidden="true"></span>
          {status || 'Cancelled'}
        </span>
      );
    }
    return (
      <span className="dash-status-badge status-pending">
        <span className="dash-status-dot" aria-hidden="true"></span>
        Pending
      </span>
    );
  };

  // Calculate percentages for workflow pulse strip
  const totalVolume = stats.totalRequests || 1;
  const pendingPct = Math.round((stats.pendingCount / totalVolume) * 100);
  const inProcessPct = Math.round((stats.inProcessCount / totalVolume) * 100);
  const resolvedPct = Math.round((stats.resolvedCount / totalVolume) * 100);
  const cancelledPct = Math.max(0, 100 - pendingPct - inProcessPct - resolvedPct);

  return (
    <div className="superadmin-page superadmin-dashboard-container">
      {/* Header Banner */}
      <div className="page-header dashboard-executive-header">
        <div className="page-header-title-group">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="page-subtitle">Institutional overview of request volume, office workloads, and performance</p>
        </div>

        <div className="dashboard-header-right">
          <NotificationBell onNavigate={onNavigate} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <OverviewCardsSkeleton count={4} />
          <WorkflowPulseSkeleton />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <AnalyticsChartSkeleton height={380} />
            <div className="skeleton-chart-card" style={{ minHeight: '380px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton variant="text" width="160px" height="20px" />
                <Skeleton variant="text" width="140px" height="13px" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                <Skeleton variant="rounded" width="100%" height="56px" />
                <Skeleton variant="rounded" width="100%" height="56px" />
                <Skeleton variant="rounded" width="100%" height="56px" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top 4 Executive Stat Cards */}
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaInbox className="stat-icon" aria-hidden="true" />
                </div>
                <span className="stat-label">TOTAL VOLUME</span>
              </div>
              <div className="stat-value">{stats.totalRequests.toLocaleString()}</div>
              <div className="stat-subtext">All-time student & staff requests</div>
            </div>

            <div className="stat-card stat-card-pending">
              <div className="stat-header">
                <div className="stat-icon-container amber">
                  <FaExclamationCircle className="stat-icon" aria-hidden="true" />
                </div>
                <span className="stat-label">NEEDS ATTENTION</span>
              </div>
              <div className="stat-value">{stats.pendingCount.toLocaleString()}</div>
              <div className="stat-subtext">Pending office initial review</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaClock className="stat-icon" aria-hidden="true" />
                </div>
                <span className="stat-label">RESOLUTION</span>
              </div>
              <div className="stat-value">{stats.avgResolution}</div>
              <div className="stat-subtext">Avg. turnaround time per request</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container gold">
                  <FaStar className="stat-icon" aria-hidden="true" />
                </div>
                <span className="stat-label">STUDENT SATISFACTION</span>
              </div>
              <div className="stat-value">
                {stats.satisfactionPercentage}%
              </div>
              <div className="stat-subtext">
                {stats.satisfactionTotal > 0
                  ? `${stats.satisfactionRating}★ (${stats.satisfactionTotal} review${stats.satisfactionTotal !== 1 ? 's' : ''})`
                  : 'Overall institutional rating'}
              </div>
            </div>
          </div>

          {/* Operational Workflow Pulse Strip */}
          <div className="workflow-pulse-card">
            <div className="workflow-pulse-header">
              <div className="workflow-pulse-title-group">
                <h3 className="workflow-pulse-title">Request Workflow Pipeline</h3>
                <span className="workflow-pulse-subtitle">Live status distribution across the entire institution</span>
              </div>
              <div className="workflow-pulse-pills">
                <div className="pulse-pill pending">
                  <span className="pill-dot pending" />
                  <span className="pill-label">Pending</span>
                  <span className="pill-count">{stats.pendingCount}</span>
                </div>
                <div className="pulse-pill in-process">
                  <span className="pill-dot in-process" />
                  <span className="pill-label">In Process</span>
                  <span className="pill-count">{stats.inProcessCount}</span>
                </div>
                <div className="pulse-pill resolved">
                  <span className="pill-dot resolved" />
                  <span className="pill-label">Resolved</span>
                  <span className="pill-count">{stats.resolvedCount}</span>
                </div>
                <div className="pulse-pill cancelled">
                  <span className="pill-dot cancelled" />
                  <span className="pill-label">Cancelled</span>
                  <span className="pill-count">{stats.cancelledCount}</span>
                </div>
              </div>
            </div>

            {/* Segmented Pipeline Bar */}
            <div className="pipeline-progress-bar" title="Pipeline Status Breakdown">
              <div
                className="pipeline-segment pending"
                style={{ width: `${pendingPct}%` }}
                title={`Pending: ${stats.pendingCount} (${pendingPct}%)`}
              />
              <div
                className="pipeline-segment in-process"
                style={{ width: `${inProcessPct}%` }}
                title={`In Process: ${stats.inProcessCount} (${inProcessPct}%)`}
              />
              <div
                className="pipeline-segment resolved"
                style={{ width: `${resolvedPct}%` }}
                title={`Resolved: ${stats.resolvedCount} (${resolvedPct}%)`}
              />
              <div
                className="pipeline-segment cancelled"
                style={{ width: `${cancelledPct}%` }}
                title={`Cancelled: ${stats.cancelledCount} (${cancelledPct}%)`}
              />
            </div>
          </div>

          {/* Middle Row: Department Volume & Quick Admin Actions */}
          <div className="dashboard-two-column-grid">
            {/* Left: Department Distribution & Health Chart */}
            <div className="chart-section">
              <div className="chart-header">
                <div>
                  <h2 className="chart-title">Requests Received & Department Health</h2>
                  <p className="chart-subtitle">Workload share, live clearance & queue health · Click to inspect</p>
                </div>
              </div>

              <div className="chart-content">
                {departmentData.map((dept, index) => (
                  <div
                    key={index}
                    className="department-bar department-bar-interactive"
                    onClick={() => onNavigate?.('analytics', { tab: 'performance', dept: dept.officeKey })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNavigate?.('analytics', { tab: 'performance', dept: dept.officeKey });
                      }
                    }}
                    title={`Click to inspect ${dept.name} in Performance Monitor`}
                  >
                    <div className="department-info">
                      <div className="dept-name-wrap">
                        <span className="dept-tag">{dept.label}</span>
                        <div className="dept-title-column">
                          <span className="dept-fullname">{dept.name}</span>
                          <span className="dept-sub-breakdown">
                            {dept.resolvedCount} Resolved · {dept.activeCount} Active
                            {dept.overdueCount > 0 ? (
                              <span className="dept-overdue-tag">
                                <FaExclamationTriangle aria-hidden="true" /> {dept.overdueCount} Overdue
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                      <div className="dept-meta">
                        <div className="dept-count-group">
                          <span className="dept-count"><strong>{dept.value}</strong> requests</span>
                          <span className="dept-pct-pill" title={`${dept.campusSharePct}% of total campus requests`}>
                            {dept.campusSharePct}% share
                          </span>
                        </div>
                        <span className={`dept-health-pill ${dept.statusTier}`}>
                          {dept.statusLabel}
                        </span>
                        <FaChevronRight className="dept-nav-chevron" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="bar-container">
                      <div
                        className="bar-fill"
                        style={{ width: `${dept.max > 0 ? (dept.value / dept.max) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="x-axis">
                  <span className="x-axis-caption">
                    Relative volume scale (highest office = 100% bar width)
                  </span>
                  <span
                    className="x-axis-link-hint"
                    onClick={() => onNavigate?.('analytics', { tab: 'performance' })}
                  >
                    Open Performance Monitor &rarr;
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick Administration Actions & System Directory */}
            <div className="quick-actions-card">
              <div className="card-header-with-badge">
                <div>
                  <h3 className="card-title-super">Administrative Actions</h3>
                  <p className="card-subtitle-super">Quick task navigation</p>
                </div>
              </div>

              <div className="quick-actions-list">
                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => onNavigate?.('user-management')}
                >
                  <div className="quick-action-icon green">
                    <FaUserPlus aria-hidden="true" />
                  </div>
                  <div className="quick-action-text">
                    <span className="quick-action-title">Manage Students</span>
                    <span className="quick-action-desc">Add, suspend, or archive student accounts</span>
                  </div>
                  <FaArrowRight className="quick-action-arrow" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => onNavigate?.('user-management')}
                >
                  <div className="quick-action-icon green">
                    <FaUserTie aria-hidden="true" />
                  </div>
                  <div className="quick-action-text">
                    <span className="quick-action-title">Manage Staff</span>
                    <span className="quick-action-desc">Configure office staff & personnel</span>
                  </div>
                  <FaArrowRight className="quick-action-arrow" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => onNavigate?.('edit-request')}
                >
                  <div className="quick-action-icon green">
                    <FaEdit aria-hidden="true" />
                  </div>
                  <div className="quick-action-text">
                    <span className="quick-action-title">Edit Request Forms</span>
                    <span className="quick-action-desc">Update forms, fields, and office services</span>
                  </div>
                  <FaArrowRight className="quick-action-arrow" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="quick-action-btn"
                  onClick={() => onNavigate?.('analytics')}
                >
                  <div className="quick-action-icon green">
                    <FaChartLine aria-hidden="true" />
                  </div>
                  <div className="quick-action-text">
                    <span className="quick-action-title">Deep Analytics</span>
                    <span className="quick-action-desc">Satisfaction scores & turnaround statistics</span>
                  </div>
                  <FaArrowRight className="quick-action-arrow" aria-hidden="true" />
                </button>
              </div>

              {/* Office Connectivity Directory */}
              <div className="office-directory-box">
                <div className="office-dir-header">
                  <FaBuilding className="office-dir-icon" aria-hidden="true" />
                  <span>Institutional Offices Status</span>
                </div>
                <div className="office-dir-grid">
                  <div className="office-dir-item">
                    <span className="office-dir-dot online" />
                    <span>Finance</span>
                  </div>
                  <div className="office-dir-item">
                    <span className="office-dir-dot online" />
                    <span>Registrar</span>
                  </div>
                  <div className="office-dir-item">
                    <span className="office-dir-dot online" />
                    <span>Library</span>
                  </div>
                  <div className="office-dir-item">
                    <span className="office-dir-dot online" />
                    <span>Guidance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Recent Incoming Requests & Audit Feed */}
          <div className="recent-activity-card">
            <div className="recent-activity-header">
              <div className="recent-activity-title-group">
                <div className="recent-icon-wrap">
                  <FaHistory aria-hidden="true" />
                </div>
                <div>
                  <h2 className="recent-activity-title">Recent Incoming Requests</h2>
                  <p className="recent-activity-subtitle">Latest ticketing submissions received across all school offices</p>
                </div>
              </div>
              <button
                type="button"
                className="view-all-analytics-btn"
                onClick={() => onNavigate?.('analytics')}
              >
                <span>View Full Analytics</span>
                <FaArrowRight aria-hidden="true" />
              </button>
            </div>

            {recentRequests.length === 0 ? (
              <div className="empty-recent-state">
                <p>No recent requests logged in the system yet.</p>
              </div>
            ) : (
              <div className="recent-table-container">
                <div className="recent-requests-table">
                  <div className="recent-table-head">
                    <div className="recent-cell head-id">Request ID</div>
                    <div className="recent-cell head-name">Requester</div>
                    <div className="recent-cell head-office">Target Office</div>
                    <div className="recent-cell head-subject">Subject</div>
                    <div className="recent-cell head-date">Submitted</div>
                    <div className="recent-cell head-status">Status</div>
                  </div>
                  {recentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="recent-table-row clickable-row"
                      onClick={() => setSelectedRecentRequest(req)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedRecentRequest(req);
                        }
                      }}
                      title="Click to view full request details"
                    >
                      <div className="recent-cell req-id">
                        {req.requestId || req.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="recent-cell req-name">
                        <span className="requester-name">{req.studentName || req.name || 'Student'}</span>
                        {req.studentEmail && (
                          <span className="requester-email">{req.studentEmail}</span>
                        )}
                      </div>
                      <div className="recent-cell req-office">
                        <span className="office-badge-chip">{req.office || 'General'}</span>
                      </div>
                      <div className="recent-cell req-subject" title={req.subject || 'School Request'}>
                        {req.subject || 'School Request'}
                      </div>
                      <div className="recent-cell req-date">
                        {formatRecentDate(req.createdAt)}
                      </div>
                      <div className="recent-cell req-status">
                        {renderStatusBadge(req.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Request Details Modal for Recent Requests */}
      {selectedRecentRequest && (
        <RequestDetailsModal
          isOpen={!!selectedRecentRequest}
          onClose={() => setSelectedRecentRequest(null)}
          request={selectedRecentRequest}
          onNavigate={onNavigate}
        />
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default SuperAdminDashboard;
