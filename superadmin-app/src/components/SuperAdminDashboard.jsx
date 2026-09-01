import React, { useState, useEffect, useRef } from 'react';
import {
  FaInbox,
  FaClock,
  FaBan,
  FaUsers,
  FaCalendarAlt,
  FaCheckCircle,
  FaUserPlus,
  FaUserTie,
  FaEdit,
  FaChartLine,
  FaBuilding,
  FaArrowRight,
  FaHistory
} from 'react-icons/fa';
import { collection, getDocs } from 'firebase/firestore';
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
    archivedCount: 0
  });

  const [departmentData, setDepartmentData] = useState([
    { label: 'FIN', value: 0, max: 100, percentage: 0, name: 'Finance Office' },
    { label: 'REG', value: 0, max: 100, percentage: 0, name: "Registrar's Office" },
    { label: 'LIB', value: 0, max: 100, percentage: 0, name: 'Library' },
    { label: 'GUI', value: 0, max: 100, percentage: 0, name: 'Guidance & Counseling' }
  ]);

  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [toast, setToast] = useState(null);

  // Keep all fetched requests in a ref so filters can be applied without refetching
  const allRequestsRef = useRef([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

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
    const maxCount = Math.max(financeCount, registrarCount, libraryCount, guidanceCount, 1);

    setFilteredTotal(totalFiltered);
    setDepartmentData([
      {
        label: 'FIN',
        value: financeCount,
        max: maxCount,
        percentage: totalFiltered > 0 ? Math.round((financeCount / totalFiltered) * 100) : 0,
        name: 'Finance Office'
      },
      {
        label: 'REG',
        value: registrarCount,
        max: maxCount,
        percentage: totalFiltered > 0 ? Math.round((registrarCount / totalFiltered) * 100) : 0,
        name: "Registrar's Office"
      },
      {
        label: 'LIB',
        value: libraryCount,
        max: maxCount,
        percentage: totalFiltered > 0 ? Math.round((libraryCount / totalFiltered) * 100) : 0,
        name: 'Library'
      },
      {
        label: 'GUI',
        value: guidanceCount,
        max: maxCount,
        percentage: totalFiltered > 0 ? Math.round((guidanceCount / totalFiltered) * 100) : 0,
        name: 'Guidance & Counseling'
      }
    ]);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load all requests
      const requestsSnapshot = await getDocs(collection(db, 'requests'));
      const allRequests = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      allRequestsRef.current = allRequests;

      // Status breakdown
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

      // Total requests
      const totalRequests = allRequests.length;

      // Calculate cancelled rate
      const cancelledRate = totalRequests > 0
        ? ((cancelledCount / totalRequests) * 100).toFixed(1) + '%'
        : '0%';

      // Calculate average resolution time
      const resolvedRequests = allRequests.filter(req => req.status === 'Resolved' && req.resolvedAt && req.createdAt);
      let avgResolutionTime = '0d 0h';

      if (resolvedRequests.length > 0) {
        const totalResolutionTime = resolvedRequests.reduce((sum, req) => {
          const created = req.createdAt?.toDate?.() || new Date(req.createdAt);
          const resolved = req.resolvedAt?.toDate?.() || new Date(req.resolvedAt);
          return sum + (resolved - created);
        }, 0);

        const avgMs = totalResolutionTime / resolvedRequests.length;
        const days = Math.floor(avgMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((avgMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        avgResolutionTime = `${days}d ${hours}h`;
      }

      // Count students
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const activeStudents = studentsSnapshot.docs.filter(doc => doc.data().isActive !== false).length;
      const totalStudents = studentsSnapshot.docs.length;

      // Count staff
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const activeStaff = staffSnapshot.docs.filter(doc => doc.data().isActive !== false).length;
      const totalStaff = staffSnapshot.docs.length;

      const activeUsers = activeStudents + activeStaff;

      // Count archived if accessible
      let archivedCount = 0;
      try {
        const archSnap = await getDocs(collection(db, 'archivedAccounts'));
        archivedCount = archSnap.docs.length;
      } catch (err) {
        // Fallback gracefully if not collection exists
      }

      setStats({
        totalRequests,
        avgResolution: avgResolutionTime,
        cancelledRate,
        activeUsers,
        pendingCount,
        inProcessCount,
        resolvedCount,
        cancelledCount,
        activeStudents,
        totalStudents,
        activeStaff,
        totalStaff,
        archivedCount
      });

      // Recent requests (top 5 latest)
      const sortedRecent = [...allRequests].sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tB - tA;
      }).slice(0, 5);

      setRecentRequests(sortedRecent);

      computeDepartmentData(allRequests, appliedFilter);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      return <span className="dash-status-badge status-resolved">Resolved</span>;
    }
    if (s === 'in process' || s === 'in-process') {
      return <span className="dash-status-badge status-in-process">In Process</span>;
    }
    if (s === 'cancelled' || s === 'rejected') {
      return <span className="dash-status-badge status-cancelled">{status || 'Cancelled'}</span>;
    }
    return <span className="dash-status-badge status-pending">Pending</span>;
  };

  const isFilterActive = Boolean(appliedFilter.from || appliedFilter.to);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate percentages for workflow pulse strip
  const totalVolume = stats.totalRequests || 1;
  const pendingPct = Math.round((stats.pendingCount / totalVolume) * 100);
  const inProcessPct = Math.round((stats.inProcessCount / totalVolume) * 100);
  const resolvedPct = Math.round((stats.resolvedCount / totalVolume) * 100);
  const cancelledPct = Math.max(0, 100 - pendingPct - inProcessPct - resolvedPct);

  return (
    <div className="superadmin-page superadmin-dashboard-container">
      {/* Executive Header Banner */}
      <div className="page-header dashboard-executive-header">
        <div className="dashboard-welcome-col">
          <h1 className="dashboard-title">Executive Dashboard</h1>
          <p className="page-subtitle">
            <strong>{todayFormatted}</strong>
          </p>
        </div>

        <div className="dashboard-header-right">
          <div className="system-health-chip" title="Firebase Firestore & all office channels active">
            <span className="health-dot" aria-hidden="true" />
            <span>All 4 Offices Operational</span>
          </div>
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
                <div className="stat-icon-container slate">
                  <FaClock className="stat-icon" aria-hidden="true" />
                </div>
                <span className="stat-label">NEEDS ATTENTION</span>
              </div>
              <div className="stat-value">{stats.pendingCount.toLocaleString()}</div>
              <div className="stat-subtext">Pending office initial review</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaCheckCircle className="stat-icon" aria-hidden="true" />
                </div>
                <span className="stat-label">RESOLUTION</span>
              </div>
              <div className="stat-value">{stats.avgResolution}</div>
              <div className="stat-subtext">Avg. turnaround time per request</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaUsers className="stat-icon" aria-hidden="true" />
                </div>
                <span className="stat-label">ACTIVE ACCOUNTS</span>
              </div>
              <div className="stat-value">{stats.activeUsers.toLocaleString()}</div>
              <div className="stat-subtext">
                {stats.activeStudents} Students • {stats.activeStaff} Staff
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
                  <span className="x-axis-label">0</span>
                  <span className="x-axis-label">{Math.round(departmentData[0].max * 0.25)}</span>
                  <span className="x-axis-label">{Math.round(departmentData[0].max * 0.5)}</span>
                  <span className="x-axis-label">{Math.round(departmentData[0].max * 0.75)}</span>
                  <span className="x-axis-label">{departmentData[0].max}</span>
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
                <span className="portal-badge">Super Admin</span>
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
                    <div className="recent-cell">Request ID</div>
                    <div className="recent-cell">Requester</div>
                    <div className="recent-cell">Target Office</div>
                    <div className="recent-cell">Subject</div>
                    <div className="recent-cell">Submitted</div>
                    <div className="recent-cell">Status</div>
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
                      <div className="recent-cell">
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
