import React, { useState, useEffect, useRef } from 'react';
import { FaInbox, FaClock, FaBan, FaUsers, FaCalendarAlt } from 'react-icons/fa';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import NotificationBell from './NotificationBell';
import DateRangeFilterDropdown from './DateRangeFilterDropdown';
import Toast from './Toast';
import '../styles/SuperAdminDashboard.css';

const EMPTY_FILTER = { from: '', to: '' };

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({
    totalRequests: 0,
    avgResolution: '0d 0h',
    cancelledRate: '0%',
    activeUsers: 0
  });
  
  const [departmentData, setDepartmentData] = useState([
    { label: 'FIN', value: 0, max: 400, name: 'Finance' },
    { label: 'REG', value: 0, max: 400, name: 'Registrar' },
    { label: 'LIB', value: 0, max: 400, name: 'Library' },
    { label: 'GUI', value: 0, max: 400, name: 'Guidance' }
  ]);
  
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

    // Count requests per department within the filtered set
    const financeCount = filteredRequests.filter(req => req.office === 'Finance').length;
    const registrarCount = filteredRequests.filter(req => req.office === 'Registrar').length;
    const libraryCount = filteredRequests.filter(req => req.office === 'Library').length;
    const guidanceCount = filteredRequests.filter(req => req.office === 'Guidance').length;

    const maxCount = Math.max(financeCount, registrarCount, libraryCount, guidanceCount, 100);

    setFilteredTotal(filteredRequests.length);
    setDepartmentData([
      { label: 'FIN', value: financeCount, max: maxCount, name: 'Finance' },
      { label: 'REG', value: registrarCount, max: maxCount, name: 'Registrar' },
      { label: 'LIB', value: libraryCount, max: maxCount, name: 'Library' },
      { label: 'GUI', value: guidanceCount, max: maxCount, name: 'Guidance' }
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

      // Total requests
      const totalRequests = allRequests.length;

      // Calculate cancelled rate
      const cancelledCount = allRequests.filter(req => 
        req.status === 'Cancelled' || req.status === 'Rejected'
      ).length;
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

      // Count active users (students + staff)
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const activeStudents = studentsSnapshot.docs.filter(doc => doc.data().isActive !== false).length;
      
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const activeStaff = staffSnapshot.docs.filter(doc => doc.data().isActive !== false).length;
      
      const activeUsers = activeStudents + activeStaff;

      setStats({
        totalRequests,
        avgResolution: avgResolutionTime,
        cancelledRate,
        activeUsers
      });

      computeDepartmentData(allRequests, appliedFilter);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyDateFilter = () => {
    // Validate range: From cannot be after To
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

  const isFilterActive = Boolean(appliedFilter.from || appliedFilter.to);

  return (
    <div className="superadmin-page superadmin-dashboard-container">
      <div className="page-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="page-subtitle">Overview of the school request and ticketing system</p>
        </div>
        <NotificationBell />
      </div>

      {loading ? (
        <LoadingSpinner message="Loading dashboard data..." fullScreen={true} />
      ) : (
        <>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaInbox className="stat-icon" />
                </div>
                <span className="stat-label">TOTAL</span>
              </div>
              <div className="stat-value">{stats.totalRequests.toLocaleString()}</div>
              <div className="stat-subtext">All Request</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaClock className="stat-icon" />
                </div>
                <span className="stat-label">ACTIVITY</span>
              </div>
              <div className="stat-value">{stats.avgResolution}</div>
              <div className="stat-subtext">Avg. Resolution</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaBan className="stat-icon" />
                </div>
                <span className="stat-label">RATE</span>
              </div>
              <div className="stat-value">{stats.cancelledRate}</div>
              <div className="stat-subtext">Cancelled Rate</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon-container">
                  <FaUsers className="stat-icon" />
                </div>
                <span className="stat-label">TOTAL</span>
              </div>
              <div className="stat-value">{stats.activeUsers.toLocaleString()}</div>
              <div className="stat-subtext">Active Users</div>
            </div>
          </div>

          <div className="chart-section">
            <div className="chart-header">
              <h2 className="chart-title">Request Receive Per Department</h2>
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
                <div key={index} className="department-bar" title={`${dept.name}: ${dept.value} requests`}>
                  <div className="department-label">{dept.label}</div>
                  <div className="bar-container">
                    <div 
                      className="bar-fill" 
                      style={{ width: `${(dept.value / dept.max) * 100}%` }}
                    />
                  </div>
                  <div className="department-value">{dept.value}</div>
                </div>
              ))}
              
              <div className="x-axis">
                <span className="x-axis-label">0</span>
                <span className="x-axis-label">{Math.round(departmentData[0].max * 0.14)}</span>
                <span className="x-axis-label">{Math.round(departmentData[0].max * 0.28)}</span>
                <span className="x-axis-label">{Math.round(departmentData[0].max * 0.42)}</span>
                <span className="x-axis-label">{Math.round(departmentData[0].max * 0.57)}</span>
                <span className="x-axis-label">{Math.round(departmentData[0].max * 0.71)}</span>
                <span className="x-axis-label">{Math.round(departmentData[0].max * 0.85)}</span>
                <span className="x-axis-label">{departmentData[0].max}</span>
              </div>
            </div>
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
