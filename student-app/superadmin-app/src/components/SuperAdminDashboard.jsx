import React, { useState, useEffect } from 'react';
import { FaInbox, FaClock, FaBan, FaUsers, FaCalendarAlt, FaBell } from 'react-icons/fa';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import '../styles/SuperAdminDashboard.css';

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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load all requests
      const requestsSnapshot = await getDocs(collection(db, 'requests'));
      const allRequests = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

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

      // Count requests per department
      const financeCount = allRequests.filter(req => req.office === 'Finance').length;
      const registrarCount = allRequests.filter(req => req.office === 'Registrar').length;
      const libraryCount = allRequests.filter(req => req.office === 'Library').length;
      const guidanceCount = allRequests.filter(req => req.office === 'Guidance').length;

      // Find max value for scaling
      const maxCount = Math.max(financeCount, registrarCount, libraryCount, guidanceCount, 100);

      setStats({
        totalRequests,
        avgResolution: avgResolutionTime,
        cancelledRate,
        activeUsers
      });

      setDepartmentData([
        { label: 'FIN', value: financeCount, max: maxCount, name: 'Finance' },
        { label: 'REG', value: registrarCount, max: maxCount, name: 'Registrar' },
        { label: 'LIB', value: libraryCount, max: maxCount, name: 'Library' },
        { label: 'GUI', value: guidanceCount, max: maxCount, name: 'Guidance' }
      ]);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="superadmin-dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <div className="dashboard-notification">
          <FaBell className="notification-icon" />
        </div>
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
            </div>
            
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
    </div>
  );
};

export default SuperAdminDashboard;
