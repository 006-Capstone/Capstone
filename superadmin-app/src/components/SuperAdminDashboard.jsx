import React, { useState, useEffect, useRef } from 'react';
import {
  FaInbox,
  FaClock,
  FaBan,
  FaUsers,
  FaCalendarAlt,
  FaCheckCircle,
  FaExclamationCircle,
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
import LoadingSpinner from './LoadingSpinner';
import NotificationBell from './NotificationBell';
import DateRangeFilterDropdown from './DateRangeFilterDropdown';
import Toast from './Toast';
import '../styles/SuperAdminDashboard.css';

const EMPTY_FILTER = { from: '', to: '' };

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
    { label: 'FIN', value: 0, max: 50, percentage: 0, name: 'Finance Office' },
    { label: 'REG', value: 0, max: 50, percentage: 0, name: "Registrar's Office" },
    { label: 'LIB', value: 0, max: 50, percentage: 0, name: 'Library' },
    { label: 'GUI', value: 0, max: 50, percentage: 0, name: 'Guidance & Counseling' }
  ]);

  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [toast, setToast] = useState(null);

  // Keep all fetched requests in a ref so filters can be applied without refetching
  const allRequestsRef = useRef([]);

  const getRequestDate = (req) => {
    if (!req.createdAt) return null;
    const date = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt);
    return date instanceof Date && !isNaN(date.getTime()) ? date : null;
  };

  const filterRequestsByDate = (requests, filter) => {
    if (!filter.from && !filter.to) return requests;

    return requests.filter(req => {
      const created = getRequestDate(req);
      if (!created) return false;

      const from = filter.from ? new Date(`${filter.from}T00:00:00`) : null;
      const to = filter.to ? new Date(`${filter.to}T23:59:59.999`) : null;

      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  };

  const computeDepartmentData = (requests, filter) => {
    const filteredRequests = filterRequestsByDate(requests, filter);

    const financeCount = filteredRequests.filter(req => req.office === 'Finance').length;
    const registrarCount = filteredRequests.filter(req => req.office === 'Registrar').length;
    const libraryCount = filteredRequests.filter(req => req.office === 'Library').length;
    const guidanceCount = filteredRequests.filter(req => req.office === 'Guidance').length;

    const totalFiltered = filteredRequests.length;
    const maxCount = Math.max(50, financeCount, registrarCount, libraryCount, guidanceCount);

    setFilteredTotal(totalFiltered);
    setDepartmentData([
      {
        label: 'FIN',
        value: financeCount,
        max: maxCount,
        percentage: maxCount > 0 ? Math.round((financeCount / maxCount) * 100) : 0,
        name: 'Finance Office'
      },
      {
        label: 'REG',
        value: registrarCount,
        max: maxCount,
        percentage: maxCount > 0 ? Math.round((registrarCount / maxCount) * 100) : 0,
        name: "Registrar's Office"
      },
      {
        label: 'LIB',
        value: libraryCount,
        max: maxCount,
        percentage: maxCount > 0 ? Math.round((libraryCount / maxCount) * 100) : 0,
        name: 'Library'
      },
      {
        label: 'GUI',
        value: guidanceCount,
        max: maxCount,
        percentage: maxCount > 0 ? Math.round((guidanceCount / maxCount) * 100) : 0,
        name: 'Guidance & Counseling'
      }
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
        allRequestsRef.current = allRequests;

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
        computeDepartmentData(allRequests, appliedFilter);
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

  const applyDateFilter = () => {
    if (dateFilter.from && dateFilter.to && dateFilter.from > dateFilter.to) {
      setToast({ type: 'error', message: 'The "From" date cannot be later than the "To" date.' });
      return false;
    }
    setAppliedFilter(dateFilter);
    computeDepartmentData(allRequestsRef.current, dateFilter);
    return true;
  };

  const clearDateFilter = () => {
    setDateFilter(EMPTY_FILTER);
    setAppliedFilter(EMPTY_FILTER);
    computeDepartmentData(allRequestsRef.current, EMPTY_FILTER);
  };

  const formatFilterDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
    if (s === 'in process' || s === 'in-process') {
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

  const isFilterActive = Boolean(appliedFilter.from || appliedFilter.to);

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
        <div className="dashboard-welcome-col">
          <h1 className="dashboard-title">Dashboard</h1>
        </div>

        <div className="dashboard-header-right">
          <NotificationBell />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading dashboard data..." fullScreen={true} />
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
            {/* Left: Department Distribution Chart */}
            <div className="chart-section">
              <div className="chart-header">
                <div>
                  <h2 className="chart-title">Requests Received Per Department</h2>
                  <p className="chart-subtitle">Volume distribution across institutional offices</p>
                </div>
                <DateRangeFilterDropdown
                  filter={dateFilter}
                  onFilterChange={setDateFilter}
                  isActive={isFilterActive}
                  onApply={applyDateFilter}
                  onClear={clearDateFilter}
                  appliedFilter={appliedFilter}
                  idPrefix="dashboard"
                />
              </div>

              {isFilterActive && (
                <div className="filter-summary">
                  <FaCalendarAlt className="filter-summary-icon" aria-hidden="true" />
                  <span>
                    Showing <strong>{filteredTotal.toLocaleString()}</strong> request{filteredTotal === 1 ? '' : 's'}
                    {appliedFilter.from && <> from <strong>{formatFilterDate(appliedFilter.from)}</strong></>}
                    {appliedFilter.from && appliedFilter.to && <> to </>}
                    {appliedFilter.to && <><strong>{formatFilterDate(appliedFilter.to)}</strong></>}
                  </span>
                </div>
              )}

              <div className="chart-content">
                {departmentData.map((dept, index) => (
                  <div key={index} className="department-bar" title={`${dept.name}: ${dept.value} requests (${dept.percentage}%)`}>
                    <div className="department-info">
                      <div className="dept-name-wrap">
                        <span className="dept-tag">{dept.label}</span>
                        <span className="dept-fullname">{dept.name}</span>
                      </div>
                      <div className="dept-meta">
                        <span className="dept-count"><strong>{dept.value}</strong> requests</span>
                        <span className="dept-pct-pill">{dept.percentage}%</span>
                      </div>
                    </div>
                    <div className="bar-container">
                      <div
                        className="bar-fill"
                        style={{ width: `${(dept.value / dept.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="x-axis">
                  {((departmentData[0]?.max || 50) === 50
                    ? [0, 10, 20, 30, 40, 50]
                    : [
                        0,
                        Math.round((departmentData[0]?.max || 50) * 0.25),
                        Math.round((departmentData[0]?.max || 50) * 0.5),
                        Math.round((departmentData[0]?.max || 50) * 0.75),
                        departmentData[0]?.max || 50
                      ]
                  ).map((tick, idx) => (
                    <span key={idx} className="x-axis-label">{tick}</span>
                  ))}
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
                    <div key={req.id} className="recent-table-row">
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
