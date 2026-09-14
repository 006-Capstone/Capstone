import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  FaChartLine, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaClock,
  FaTrophy,
  FaInfoCircle
} from 'react-icons/fa';
import LoadingSpinner from './LoadingSpinner';
import '../styles/MyPerformance.css';

const MyPerformance = ({ userData }) => {
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (userData && userData.uid) {
      loadPerformanceData();
    }
  }, [userData]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      // Load tickets assigned to this staff member
      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('assignedTo', '==', userData.uid)
      );
      const ticketsSnapshot = await getDocs(ticketsQuery);
      const ticketsList = [];
      ticketsSnapshot.forEach(doc => {
        ticketsList.push({ id: doc.id, ...doc.data() });
      });

      setTickets(ticketsList);

      // Calculate performance metrics
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      const activeTickets = ticketsList.filter(t => 
        t.status !== 'resolved' && t.status !== 'closed'
      );

      const overdueTickets = activeTickets.filter(t => {
        if (!t.eta) return false;
        const eta = t.eta.toDate ? t.eta.toDate() : new Date(t.eta);
        return eta < now;
      });

      const recentTickets = ticketsList.filter(t => {
        const createdDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
        return createdDate >= thirtyDaysAgo;
      });

      const resolvedRecent = recentTickets.filter(t => 
        t.status === 'resolved' || t.status === 'closed'
      );

      const onTimeCount = resolvedRecent.filter(t => {
        if (!t.resolvedAt || !t.eta) return false;
        const resolvedDate = t.resolvedAt.toDate ? t.resolvedAt.toDate() : new Date(t.resolvedAt);
        const eta = t.eta.toDate ? t.eta.toDate() : new Date(t.eta);
        return resolvedDate <= eta;
      }).length;

      const onTimeRate = resolvedRecent.length > 0 
        ? Math.round((onTimeCount / resolvedRecent.length) * 100) 
        : 0;

      // Calculate average response time
      const ticketsWithResponse = ticketsList.filter(t => t.firstResponseAt);
      const avgResponseTime = ticketsWithResponse.length > 0
        ? ticketsWithResponse.reduce((sum, t) => {
            const created = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
            const responded = t.firstResponseAt.toDate ? t.firstResponseAt.toDate() : new Date(t.firstResponseAt);
            return sum + (responded - created);
          }, 0) / ticketsWithResponse.length
        : 0;

      const avgResponseHours = Math.round(avgResponseTime / (1000 * 60 * 60));

      // Calculate risk score
      const activeCount = activeTickets.length;
      const overdueCount = overdueTickets.length;
      const riskScore = Math.min(100, Math.round(
        (activeCount * 10) + (overdueCount * 25) + ((100 - onTimeRate) * 0.5)
      ));

      // Determine warning stage
      let warningStage = { stage: 0, stageName: 'Good Standing', color: 'green' };
      if (riskScore >= 80) {
        warningStage = { stage: 4, stageName: 'Critical', color: 'red' };
      } else if (riskScore >= 60) {
        warningStage = { stage: 3, stageName: 'Serious Warning', color: 'orange' };
      } else if (riskScore >= 40) {
        warningStage = { stage: 2, stageName: 'Warning', color: 'yellow' };
      } else if (riskScore >= 20) {
        warningStage = { stage: 1, stageName: 'Advisory', color: 'blue' };
      }

      setPerformanceData({
        activeTickets: activeCount,
        overdueTickets: overdueCount,
        resolvedLast30Days: resolvedRecent.length,
        onTimeRate,
        avgResponseHours,
        riskScore,
        warningStage,
        totalTickets: ticketsList.length
      });

      // Load trend data (last 7 entries)
      const trendQuery = query(
        collection(db, 'performance_snapshots'),
        where('staffMetrics', 'array-contains', userData.uid),
        orderBy('timestamp', 'desc'),
        limit(7)
      );

      try {
        const trendSnapshot = await getDocs(trendQuery);
        const trends = [];
        trendSnapshot.forEach(doc => {
          const data = doc.data();
          // Find this staff member's data in the snapshot
          const staffData = data.staffMetrics?.find(s => s.uid === userData.uid);
          if (staffData) {
            trends.push({
              date: data.date,
              riskScore: staffData.riskScore,
              activeTickets: staffData.activeTickets,
              overdueTickets: staffData.overdueTickets
            });
          }
        });
        setTrendData(trends.reverse());
      } catch (error) {
        console.log('No trend data available yet:', error);
        setTrendData([]);
      }

    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="my-performance-loading">
        <LoadingSpinner />
        <p>Loading your performance data...</p>
      </div>
    );
  }

  if (!performanceData) {
    return (
      <div className="my-performance-error">
        <FaExclamationTriangle />
        <p>Unable to load performance data</p>
      </div>
    );
  }

  return (
    <div className="my-performance">
      <div className="performance-header">
        <div className="header-content">
          <h2>My Performance Dashboard</h2>
          <p>Track your ticket handling performance and productivity metrics</p>
        </div>
        <div className={`performance-badge badge-${performanceData.warningStage.color}`}>
          <span className="badge-stage">Stage {performanceData.warningStage.stage}</span>
          <span className="badge-name">{performanceData.warningStage.stageName}</span>
        </div>
      </div>

      {/* Performance Score Card */}
      <div className="performance-score-card">
        <div className="score-display">
          <div className={`score-circle risk-${performanceData.riskScore >= 75 ? 'high' : performanceData.riskScore >= 50 ? 'medium' : 'low'}`}>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle 
                cx="50" 
                cy="50" 
                r="45" 
                fill="none" 
                strokeWidth="10"
                strokeDasharray={`${(100 - performanceData.riskScore) * 2.827} 282.7`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="score-value">
              <span className="score-number">{performanceData.riskScore}</span>
              <span className="score-label">Risk Score</span>
            </div>
          </div>
        </div>
        <div className="score-info">
          <h3>Performance Status</h3>
          <p className="score-description">
            {performanceData.riskScore < 20 && "Excellent work! You're maintaining strong performance standards."}
            {performanceData.riskScore >= 20 && performanceData.riskScore < 40 && "Good performance. Keep up the consistent work."}
            {performanceData.riskScore >= 40 && performanceData.riskScore < 60 && "Your workload needs attention. Consider reviewing priorities."}
            {performanceData.riskScore >= 60 && performanceData.riskScore < 80 && "Warning: Your performance metrics need immediate improvement."}
            {performanceData.riskScore >= 80 && "Critical: Urgent action required to improve performance."}
          </p>
          <div className="score-tips">
            <FaInfoCircle />
            <span>Lower risk scores indicate better performance</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon active">
            <FaClock />
          </div>
          <div className="metric-content">
            <div className="metric-value">{performanceData.activeTickets}</div>
            <div className="metric-label">Active Tickets</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon overdue">
            <FaExclamationTriangle />
          </div>
          <div className="metric-content">
            <div className="metric-value">{performanceData.overdueTickets}</div>
            <div className="metric-label">Overdue Tickets</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon resolved">
            <FaCheckCircle />
          </div>
          <div className="metric-content">
            <div className="metric-value">{performanceData.resolvedLast30Days}</div>
            <div className="metric-label">Resolved (30 days)</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon trophy">
            <FaTrophy />
          </div>
          <div className="metric-content">
            <div className="metric-value">{performanceData.onTimeRate}%</div>
            <div className="metric-label">On-Time Rate</div>
          </div>
        </div>
      </div>

      {/* Performance Details */}
      <div className="performance-details">
        <h3>
          <FaChartLine /> Detailed Metrics
        </h3>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Total Tickets Handled:</span>
            <span className="detail-value">{performanceData.totalTickets}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Average Response Time:</span>
            <span className="detail-value">{performanceData.avgResponseHours}h</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Current Load:</span>
            <span className="detail-value">{performanceData.activeTickets} tickets</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Performance Trend:</span>
            <span className="detail-value">
              {trendData.length > 1 && trendData[trendData.length - 1].riskScore < trendData[0].riskScore 
                ? '📈 Improving' 
                : trendData.length > 1 && trendData[trendData.length - 1].riskScore > trendData[0].riskScore
                ? '📉 Declining'
                : '➡️ Stable'}
            </span>
          </div>
        </div>
      </div>

      {/* Mini Trend Chart */}
      {trendData.length > 0 && (
        <div className="mini-trend-chart">
          <h3>
            <FaChartLine /> 7-Day Risk Score Trend
          </h3>
          <div className="trend-visualization">
            <svg viewBox="0 0 300 100" className="trend-svg">
              <line x1="0" y1="100" x2="300" y2="100" stroke="#e5e7eb" strokeWidth="1" />
              <line x1="0" y1="50" x2="300" y2="50" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2,2" />
              
              <polyline
                fill="none"
                stroke="#1e3a8a"
                strokeWidth="2"
                points={trendData.map((point, index) => {
                  const x = (index / (trendData.length - 1)) * 300;
                  const y = 100 - point.riskScore;
                  return `${x},${y}`;
                }).join(' ')}
              />
              
              {trendData.map((point, index) => {
                const x = (index / (trendData.length - 1)) * 300;
                const y = 100 - point.riskScore;
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="3"
                    fill="#1e3a8a"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="performance-footer">
        <FaInfoCircle />
        <p>
          Your performance is monitored daily to help you stay on track. 
          If you need assistance or have concerns about your workload, please contact your supervisor.
        </p>
      </div>
    </div>
  );
};

export default MyPerformance;
