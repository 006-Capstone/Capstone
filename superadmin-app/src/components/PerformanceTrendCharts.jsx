import React, { useState, useEffect } from 'react';
import { FaChartLine, FaCalendarAlt } from 'react-icons/fa';
import { getPerformanceHistory } from '../utils/performanceSnapshot';
import '../styles/PerformanceTrendCharts.css';

const PerformanceTrendCharts = () => {
  const [trendData, setTrendData] = useState([]);
  const [timeRange, setTimeRange] = useState('7days'); // 7days or 30days
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrendData();
  }, [timeRange]);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const days = timeRange === '7days' ? 7 : 30;
      const history = await getPerformanceHistory(days);
      setTrendData(history);
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="trend-charts-loading">
        <p>Loading trend data...</p>
      </div>
    );
  }

  if (trendData.length === 0) {
    return (
      <div className="trend-charts-empty">
        <FaChartLine className="empty-icon" />
        <p>No historical data available yet.</p>
        <p className="empty-subtitle">Trend charts will appear once performance snapshots are collected.</p>
      </div>
    );
  }

  // Prepare data for charts
  const labels = trendData.map(d => {
    const date = new Date(d.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const activeTicketsData = trendData.map(d => d.systemMetrics?.totalActiveTickets || 0);
  const overdueTicketsData = trendData.map(d => d.systemMetrics?.totalOverdueTickets || 0);
  const onTrackPercentageData = trendData.map(d => d.systemMetrics?.onTrackPercentage || 0);
  const staffAtRiskData = trendData.map(d => d.staffAtRisk || 0);

  // Calculate max values for scaling
  const maxActive = Math.max(...activeTicketsData, 10);
  const maxOverdue = Math.max(...overdueTicketsData, 5);
  const maxStaffAtRisk = Math.max(...staffAtRiskData, 2);

  return (
    <div className="performance-trend-charts">
      <div className="trend-header">
        <div className="trend-title">
          <FaChartLine />
          <h3>Performance Trends</h3>
        </div>
        <div className="time-range-selector">
          <button
            className={timeRange === '7days' ? 'active' : ''}
            onClick={() => setTimeRange('7days')}
          >
            7 Days
          </button>
          <button
            className={timeRange === '30days' ? 'active' : ''}
            onClick={() => setTimeRange('30days')}
          >
            30 Days
          </button>
        </div>
      </div>

      <div className="charts-grid">
        {/* Active Tickets Trend */}
        <div className="chart-card">
          <h4>Active Tickets</h4>
          <div className="chart-container">
            <div className="chart-y-axis">
              <span>{maxActive}</span>
              <span>{Math.round(maxActive / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 400 150" className="line-chart">
                {/* Grid lines */}
                <line x1="0" y1="0" x2="400" y2="0" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="75" x2="400" y2="75" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#e5e7eb" strokeWidth="1" />
                
                {/* Line chart */}
                <polyline
                  fill="none"
                  stroke="#1e3a8a"
                  strokeWidth="2"
                  points={activeTicketsData.map((value, index) => {
                    const x = (index / (activeTicketsData.length - 1)) * 400;
                    const y = 150 - (value / maxActive) * 150;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                
                {/* Data points */}
                {activeTicketsData.map((value, index) => {
                  const x = (index / (activeTicketsData.length - 1)) * 400;
                  const y = 150 - (value / maxActive) * 150;
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#1e3a8a"
                    />
                  );
                })}
              </svg>
              <div className="chart-x-axis">
                {labels.map((label, index) => {
                  // Show every nth label to avoid crowding
                  const showEvery = labels.length > 15 ? 5 : labels.length > 7 ? 2 : 1;
                  if (index % showEvery === 0 || index === labels.length - 1) {
                    return <span key={index}>{label}</span>;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
          <div className="chart-summary">
            <span className="summary-label">Current:</span>
            <span className="summary-value">{activeTicketsData[activeTicketsData.length - 1]}</span>
            <span className="summary-label">Avg:</span>
            <span className="summary-value">
              {Math.round(activeTicketsData.reduce((a, b) => a + b, 0) / activeTicketsData.length)}
            </span>
          </div>
        </div>

        {/* Overdue Tickets Trend */}
        <div className="chart-card">
          <h4>Overdue Tickets</h4>
          <div className="chart-container">
            <div className="chart-y-axis">
              <span>{maxOverdue}</span>
              <span>{Math.round(maxOverdue / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 400 150" className="line-chart">
                <line x1="0" y1="0" x2="400" y2="0" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="75" x2="400" y2="75" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#e5e7eb" strokeWidth="1" />
                
                <polyline
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  points={overdueTicketsData.map((value, index) => {
                    const x = (index / (overdueTicketsData.length - 1)) * 400;
                    const y = 150 - (value / maxOverdue) * 150;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                
                {overdueTicketsData.map((value, index) => {
                  const x = (index / (overdueTicketsData.length - 1)) * 400;
                  const y = 150 - (value / maxOverdue) * 150;
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#dc2626"
                    />
                  );
                })}
              </svg>
              <div className="chart-x-axis">
                {labels.map((label, index) => {
                  const showEvery = labels.length > 15 ? 5 : labels.length > 7 ? 2 : 1;
                  if (index % showEvery === 0 || index === labels.length - 1) {
                    return <span key={index}>{label}</span>;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
          <div className="chart-summary">
            <span className="summary-label">Current:</span>
            <span className="summary-value">{overdueTicketsData[overdueTicketsData.length - 1]}</span>
            <span className="summary-label">Avg:</span>
            <span className="summary-value">
              {Math.round(overdueTicketsData.reduce((a, b) => a + b, 0) / overdueTicketsData.length)}
            </span>
          </div>
        </div>

        {/* On-Track Percentage Trend */}
        <div className="chart-card">
          <h4>On-Track Percentage</h4>
          <div className="chart-container">
            <div className="chart-y-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 400 150" className="line-chart">
                <line x1="0" y1="0" x2="400" y2="0" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="75" x2="400" y2="75" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#e5e7eb" strokeWidth="1" />
                
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2"
                  points={onTrackPercentageData.map((value, index) => {
                    const x = (index / (onTrackPercentageData.length - 1)) * 400;
                    const y = 150 - (value / 100) * 150;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                
                {onTrackPercentageData.map((value, index) => {
                  const x = (index / (onTrackPercentageData.length - 1)) * 400;
                  const y = 150 - (value / 100) * 150;
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#059669"
                    />
                  );
                })}
              </svg>
              <div className="chart-x-axis">
                {labels.map((label, index) => {
                  const showEvery = labels.length > 15 ? 5 : labels.length > 7 ? 2 : 1;
                  if (index % showEvery === 0 || index === labels.length - 1) {
                    return <span key={index}>{label}</span>;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
          <div className="chart-summary">
            <span className="summary-label">Current:</span>
            <span className="summary-value">{onTrackPercentageData[onTrackPercentageData.length - 1]}%</span>
            <span className="summary-label">Avg:</span>
            <span className="summary-value">
              {Math.round(onTrackPercentageData.reduce((a, b) => a + b, 0) / onTrackPercentageData.length)}%
            </span>
          </div>
        </div>

        {/* Staff at Risk Trend */}
        <div className="chart-card">
          <h4>Staff at Risk</h4>
          <div className="chart-container">
            <div className="chart-y-axis">
              <span>{maxStaffAtRisk}</span>
              <span>{Math.round(maxStaffAtRisk / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-area">
              <svg viewBox="0 0 400 150" className="line-chart">
                <line x1="0" y1="0" x2="400" y2="0" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="75" x2="400" y2="75" stroke="#e5e7eb" strokeWidth="1" />
                <line x1="0" y1="150" x2="400" y2="150" stroke="#e5e7eb" strokeWidth="1" />
                
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  points={staffAtRiskData.map((value, index) => {
                    const x = (index / (staffAtRiskData.length - 1)) * 400;
                    const y = 150 - (value / maxStaffAtRisk) * 150;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                
                {staffAtRiskData.map((value, index) => {
                  const x = (index / (staffAtRiskData.length - 1)) * 400;
                  const y = 150 - (value / maxStaffAtRisk) * 150;
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#f59e0b"
                    />
                  );
                })}
              </svg>
              <div className="chart-x-axis">
                {labels.map((label, index) => {
                  const showEvery = labels.length > 15 ? 5 : labels.length > 7 ? 2 : 1;
                  if (index % showEvery === 0 || index === labels.length - 1) {
                    return <span key={index}>{label}</span>;
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
          <div className="chart-summary">
            <span className="summary-label">Current:</span>
            <span className="summary-value">{staffAtRiskData[staffAtRiskData.length - 1]}</span>
            <span className="summary-label">Avg:</span>
            <span className="summary-value">
              {Math.round(staffAtRiskData.reduce((a, b) => a + b, 0) / staffAtRiskData.length)}
            </span>
          </div>
        </div>
      </div>

      <div className="trend-footer">
        <FaCalendarAlt />
        <span>Historical data collected from daily performance snapshots</span>
      </div>
    </div>
  );
};

export default PerformanceTrendCharts;
