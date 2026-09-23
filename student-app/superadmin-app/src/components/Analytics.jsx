import React, { useState, useEffect } from 'react';
import { FaBell, FaDownload, FaFilter, FaChevronDown, FaInbox, FaClock, FaBan, FaUsers } from 'react-icons/fa';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import '../styles/Analytics.css';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [totalRequests, setTotalRequests] = useState(0);
  const [avgResolution, setAvgResolution] = useState('0hrs');
  const [cancelledRate, setCancelledRate] = useState('0%');
  const [activeUsers, setActiveUsers] = useState(0);
  const [ticketData, setTicketData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [satisfactionData, setSatisfactionData] = useState({ fiveStars: 0, fourStars: 0, percentage: 0 });

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch all requests
      const requestsRef = collection(db, 'requests');
      const requestsSnapshot = await getDocs(requestsRef);
      const requests = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Total requests
      setTotalRequests(requests.length);

      // Calculate cancelled rate
      const cancelledCount = requests.filter(r => r.status === 'Cancelled').length;
      const cancelledPercentage = requests.length > 0 ? Math.round((cancelledCount / requests.length) * 100) : 0;
      setCancelledRate(`${cancelledPercentage}%`);

      // Calculate average resolution time (for resolved tickets)
      const resolvedRequests = requests.filter(r => r.status === 'Resolved' && r.resolvedAt && r.createdAt);
      if (resolvedRequests.length > 0) {
        const totalResolutionTime = resolvedRequests.reduce((sum, req) => {
          const created = req.createdAt?.toDate?.() || new Date(req.createdAt);
          const resolved = req.resolvedAt?.toDate?.() || new Date(req.resolvedAt);
          const diff = resolved - created;
          return sum + diff;
        }, 0);
        const avgTime = totalResolutionTime / resolvedRequests.length;
        setAvgResolution(formatDuration(avgTime));
      }

      // Fetch active users (students + staff)
      const studentsRef = collection(db, 'students');
      const staffRef = collection(db, 'staff');
      const [studentsSnapshot, staffSnapshot] = await Promise.all([
        getDocs(studentsRef),
        getDocs(staffRef)
      ]);
      setActiveUsers(studentsSnapshot.size + staffSnapshot.size);

      // Calculate ticket volume trends by month
      const monthlyData = calculateMonthlyTrends(requests);
      setTicketData(monthlyData);

      // Calculate department efficiency
      const deptData = calculateDepartmentEfficiency(requests);
      setDepartmentData(deptData);

      // Fetch feedback for satisfaction ratings
      const feedbackRef = collection(db, 'feedback');
      const feedbackSnapshot = await getDocs(feedbackRef);
      const feedbacks = feedbackSnapshot.docs.map(doc => doc.data());
      
      const fiveStarsCount = feedbacks.filter(f => f.rating === 5).length;
      const fourStarsCount = feedbacks.filter(f => f.rating === 4).length;
      const totalFeedback = feedbacks.length;
      const satisfactionPercentage = totalFeedback > 0 
        ? Math.round((fiveStarsCount / totalFeedback) * 100) 
        : 0;
      
      setSatisfactionData({
        fiveStars: fiveStarsCount,
        fourStars: fourStarsCount,
        percentage: satisfactionPercentage
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return remainingHours > 0 ? `${days}days ${remainingHours}hrs` : `${days}days`;
    }
    return `${hours}hrs`;
  };

  const calculateMonthlyTrends = (requests) => {
    const months = ['JUNE', 'JULY', 'AUG', 'SEP', 'OCT', 'NOV'];
    const monthIndexMap = { 5: 'JUNE', 6: 'JULY', 7: 'AUG', 8: 'SEP', 9: 'OCT', 10: 'NOV' };
    const monthlyCount = {};

    // Initialize all months
    months.forEach(month => {
      monthlyCount[month] = { secondSem: 0, firstSem: 0 };
    });

    // Count requests by month
    requests.forEach(req => {
      const createdAt = req.createdAt?.toDate?.() || new Date(req.createdAt);
      const monthIndex = createdAt.getMonth(); // 0-11
      const monthName = monthIndexMap[monthIndex];
      
      if (monthName && monthlyCount[monthName]) {
        // Determine semester based on month (June-Oct = 2nd sem, Nov onwards = 1st sem)
        if (monthIndex >= 5 && monthIndex <= 9) {
          monthlyCount[monthName].secondSem++;
        } else {
          monthlyCount[monthName].firstSem++;
        }
      }
    });

    return months.map(month => ({
      month,
      secondSem: monthlyCount[month].secondSem,
      firstSem: monthlyCount[month].firstSem
    }));
  };

  const calculateDepartmentEfficiency = (requests) => {
    const departments = ['Finance', 'Library', 'Registrar', 'Guidance'];
    const deptStats = {};

    departments.forEach(dept => {
      const deptRequests = requests.filter(r => r.office === dept);
      const resolvedRequests = deptRequests.filter(r => r.status === 'Resolved' && r.resolvedAt && r.createdAt);
      
      let avgResolution = 'N/A';
      if (resolvedRequests.length > 0) {
        const totalTime = resolvedRequests.reduce((sum, req) => {
          const created = req.createdAt?.toDate?.() || new Date(req.createdAt);
          const resolved = req.resolvedAt?.toDate?.() || new Date(req.resolvedAt);
          return sum + (resolved - created);
        }, 0);
        avgResolution = formatDuration(totalTime / resolvedRequests.length);
      }

      deptStats[dept] = {
        department: dept === 'Guidance' ? 'Guidance Office' : dept === 'Registrar' ? 'Registrar Office' : dept === 'Finance' ? 'Finance Office' : dept,
        tickets: deptRequests.length,
        resolution: avgResolution,
        satisfaction: 'N/A' // Placeholder, could be calculated from feedback
      };
    });

    return departments.map(dept => deptStats[dept]);
  };

  const exportToCSV = () => {
    // Prepare CSV data
    let csvContent = 'Department,Tickets,Resolution Time,Satisfaction\n';
    departmentData.forEach(dept => {
      csvContent += `${dept.department},${dept.tickets},${dept.resolution},${dept.satisfaction}\n`;
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." fullScreen={true} />;
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1 className="analytics-title">Analytics</h1>
        <div className="analytics-actions">
          <button className="export-button" onClick={exportToCSV}>
            <FaDownload className="export-icon" />
            Export CSV
          </button>
          <button className="filter-by-button" onClick={fetchAnalyticsData}>
            Filter by
            <FaFilter className="filter-icon" />
          </button>
          <div className="form-notification">
            <FaBell className="notification-icon" />
          </div>
        </div>
      </div>

      <div className="analytics-stats">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaInbox className="stat-icon" />
            </div>
            <span className="stat-label">TOTAL</span>
          </div>
          <div className="stat-value">{totalRequests.toLocaleString()}</div>
          <div className="stat-subtext">All Request</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaClock className="stat-icon" />
            </div>
            <span className="stat-label">ACTIVITY</span>
          </div>
          <div className="stat-value">{avgResolution}</div>
          <div className="stat-subtext">Avg. Resolution</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaBan className="stat-icon" />
            </div>
            <span className="stat-label">RATE</span>
          </div>
          <div className="stat-value">{cancelledRate}</div>
          <div className="stat-subtext">Cancelled Rate</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaUsers className="stat-icon" />
            </div>
            <span className="stat-label">TOTAL</span>
          </div>
          <div className="stat-value">{activeUsers.toLocaleString()}</div>
          <div className="stat-subtext">Active Users</div>
        </div>
      </div>

      <div className="analytics-content">
        <div className="chart-card">
          <div className="chart-card-header">
            <h2 className="chart-card-title">Ticket Volume Trends</h2>
            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-dot second-sem"></span>
                <span>2ND SEM</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot first-sem"></span>
                <span>1ST SEM</span>
              </div>
            </div>
          </div>
          
          <div className="bar-chart">
            {ticketData.map((data, index) => {
              const maxValue = Math.max(...ticketData.map(d => Math.max(d.secondSem, d.firstSem)), 1);
              return (
                <div key={index} className="bar-group">
                  <div className="bars-container">
                    <div 
                      className="bar second-sem" 
                      style={{ height: `${(data.secondSem / maxValue) * 100}%` }}
                    ></div>
                    {data.firstSem > 0 && (
                      <div 
                        className="bar first-sem" 
                        style={{ height: `${(data.firstSem / maxValue) * 100}%` }}
                      ></div>
                    )}
                  </div>
                  <div className="month-label">{data.month}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="satisfaction-card">
          <div className="satisfaction-header">
            <h2 className="satisfaction-title">Student Satisfaction</h2>
            <div className="satisfaction-filter">
              <span>Filter by</span>
              <FaChevronDown />
            </div>
          </div>
          
          <div className="satisfaction-content">
            <div className="satisfaction-percentage">{satisfactionData.percentage}%</div>
            <div className="satisfaction-label">5 Stars</div>
            
            <div className="stars-breakdown">
              <div className="star-row">
                <div className="star-info">
                  <span className="star-dot"></span>
                  <span className="star-label">5 Stars</span>
                </div>
                <span className="star-count">{satisfactionData.fiveStars}</span>
              </div>
              <div className="star-row">
                <div className="star-info">
                  <span className="star-dot"></span>
                  <span className="star-label">4 Stars</span>
                </div>
                <span className="star-count">{satisfactionData.fourStars}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="efficiency-table">
        <div className="efficiency-header">
          <h2 className="efficiency-title">Department Efficiency</h2>
          <span className="view-report">View detailed report</span>
        </div>
        
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>DEPARTMENT</th>
                <th>TICKETS</th>
                <th>RESOLUTION</th>
                <th>SATISFACTION</th>
              </tr>
            </thead>
            <tbody>
              {departmentData.map((dept, index) => (
                <tr key={index}>
                  <td>{dept.department}</td>
                  <td>{dept.tickets}</td>
                  <td>{dept.resolution}</td>
                  <td>{dept.satisfaction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
