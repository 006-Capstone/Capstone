import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaUsers,
  FaClock,
  FaChartLine,
  FaBell,
  FaExchangeAlt,
  FaBrain,
  FaLightbulb,
  FaSearch, 
  FaFileAlt,
  FaDollarSign,
  FaBook,
  FaClipboardList,
  FaUserFriends,
  FaTrashAlt,
  FaChevronRight,
  FaCheck,
  FaGraduationCap,
  FaCogs,
  FaClipboardCheck
} from 'react-icons/fa';
import {
  calculateStaffRiskScore,
  calculate30DayPerformance,
  determineWarningStage,
  analyzeDepartmentHealth,
  calculateTicketRisk,
  generateWorkloadRecommendations,
  calculatePerformanceTrends,
  forecastCapacity
} from '../utils/performanceAnalytics';
import {
  generateExecutiveSummary,
  detectAnomalies,
  generateSmartRecommendations
} from '../utils/groqService';
import { createNTE, downloadNTE, hasPendingNTE } from '../utils/nteGenerator';
import LoadingSpinner from './LoadingSpinner';
import NudgeModal from './NudgeModal';
import ReassignTicketsModal from './ReassignTicketsModal';
import PerformanceTrendCharts from './PerformanceTrendCharts';
import { useNotification } from '../context/NotificationContext';
import '../styles/PerformanceMonitor.css';

const PerformanceMonitor = () => {
  const { toast, alertModal, confirm } = useNotification();
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState(null);
  const [departmentData, setDepartmentData] = useState([]);
  const [staffBottlenecks, setStaffBottlenecks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [performanceTasks, setPerformanceTasks] = useState([]);
  
  // Modal states
  const [nudgeModalOpen, setNudgeModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [allStaffData, setAllStaffData] = useState([]);

  // AI Insights states
  const [aiInsights, setAiInsights] = useState({
    executiveSummary: null,
    anomalies: [],
    smartRecommendations: [],
    loading: false,
    error: null
  });

  useEffect(() => {
    loadPerformanceData();
    
    // Refresh every 5 minutes
    const interval = setInterval(() => {
      loadPerformanceData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Load all requests and staff
      const requestsSnapshot = await getDocs(collection(db, 'requests'));
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      
      const allRequests = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const allStaff = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Calculate system-wide health
      const activeRequests = allRequests.filter(r => 
        r.status !== 'Resolved' && r.status !== 'Cancelled'
      );
      
      const atRiskRequests = activeRequests.filter(r => {
        const { atRisk } = calculateTicketRisk(r);
        return atRisk;
      });
      
      const onTrackPercentage = activeRequests.length > 0
        ? Math.round(((activeRequests.length - atRiskRequests.length) / activeRequests.length) * 100)
        : 100;
      
      setSystemHealth({
        totalActive: activeRequests.length,
        atRisk: atRiskRequests.length,
        onTrackPercentage,
        status: onTrackPercentage >= 85 ? 'good' : onTrackPercentage >= 70 ? 'moderate' : 'critical'
      });
      
      // Analyze each department
      const offices = ['Finance', 'Guidance', 'Library', 'Registrar'];
      const deptData = [];
      
      for (const office of offices) {
        const officeRequests = allRequests.filter(r => r.office === office);
        const officeStaff = allStaff.filter(s => s.office === office);
        
        const health = analyzeDepartmentHealth(officeRequests, officeStaff);
        
        deptData.push({
          office,
          ...health,
          staffCount: officeStaff.length
        });
      }
      
      setDepartmentData(deptData);
      
      // Analyze staff bottlenecks
      const staffAnalysis = [];
      
      for (const staff of allStaff) {
        const staffRequests = allRequests.filter(r => {
          const assigned = (r.assignedTo || r.claimedBy || '').toLowerCase();
          return assigned === staff.name.toLowerCase();
        });
        
        const activeTickets = staffRequests.filter(r => 
          r.status !== 'Resolved' && r.status !== 'Cancelled'
        ).length;
        
        const overdueTickets = staffRequests.filter(r => {
          const { isOverdue } = calculateTicketRisk(r);
          return isOverdue && r.status !== 'Resolved';
        }).length;
        
        const performance = calculate30DayPerformance(staffRequests);
        const riskScore = calculateStaffRiskScore({
          tickets: staffRequests,
          activeTickets,
          overdueTickets,
          avgResolutionTime: 36 // Placeholder
        });
        
        const warningStage = determineWarningStage({
          overdueRate: performance.overdueRate,
          consecutivePoorDays: riskScore > 50 ? 30 : 0 // Simplified
        });
        
        if (riskScore > 40 || warningStage.stage > 0) {
          staffAnalysis.push({
            ...staff,
            activeTickets,
            overdueTickets,
            riskScore,
            performance,
            warningStage
          });
        }
      }
      
      // Sort by risk score (highest first)
      staffAnalysis.sort((a, b) => b.riskScore - a.riskScore);
      setStaffBottlenecks(staffAnalysis);
      
      // Generate recommendations
      const staffWorkloads = allStaff.map(s => ({
        ...s,
        activeTickets: allRequests.filter(r => {
          const assigned = (r.assignedTo || r.claimedBy || '').toLowerCase();
          return assigned === s.name.toLowerCase() && r.status !== 'Resolved' && r.status !== 'Cancelled';
        }).length
      }));
      
      const recs = generateWorkloadRecommendations(staffWorkloads);
      setRecommendations(recs);
      
      // Store all staff data with their workload info for modals
      const enrichedStaffData = allStaff.map(s => {
        const staffRequests = allRequests.filter(r => {
          const assigned = (r.assignedTo || r.claimedBy || '').toLowerCase();
          return assigned === s.name.toLowerCase();
        });
        
        const activeTickets = staffRequests.filter(r => 
          r.status !== 'Resolved' && r.status !== 'Cancelled'
        ).length;
        
        const overdueTickets = staffRequests.filter(r => {
          const { isOverdue } = calculateTicketRisk(r);
          return isOverdue && r.status !== 'Resolved';
        }).length;
        
        const riskScore = calculateStaffRiskScore({
          tickets: staffRequests,
          activeTickets,
          overdueTickets,
          avgResolutionTime: 36
        });
        
        return {
          ...s,
          activeTickets,
          overdueTickets,
          riskScore,
          department: s.office || s.department || 'Unknown'
        };
      });
      
      setAllStaffData(enrichedStaffData);
      setLastUpdated(new Date());
      
      // Load performance tasks
      loadPerformanceTasks();
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceTasks = async () => {
    try {
      const tasksSnapshot = await getDocs(
        query(collection(db, 'performance_tasks'), orderBy('createdAt', 'desc'))
      );
      const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPerformanceTasks(tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await updateDoc(doc(db, 'performance_tasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setPerformanceTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    const confirmed = await confirm({
      title: 'Dismiss Task',
      message: 'Are you sure you want to dismiss this improvement task?',
      confirmText: 'Dismiss',
      variant: 'danger'
    });

    if (!confirmed) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'performance_tasks', taskId));
      setPerformanceTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to dismiss task.');
    }
  };

  const getTaskTypeIcon = (type) => {
    switch (type) {
      case 'training':
        return <FaGraduationCap className="task-badge-icon" />;
      case 'process_improvement':
        return <FaCogs className="task-badge-icon" />;
      case 'hire':
        return <FaUsers className="task-badge-icon" />;
      default:
        return <FaClipboardList className="task-badge-icon" />;
    }
  };

  const getTaskTypeLabel = (type) => {
    switch (type) {
      case 'training':
        return 'Staff Training';
      case 'process_improvement':
        return 'Process Improvement';
      case 'hire':
        return 'Capacity & Staffing';
      default:
        return type ? type.replace(/_/g, ' ') : 'Operational Task';
    }
  };

  const handleSendNudge = (staff) => {
    setSelectedStaff(staff);
    setNudgeModalOpen(true);
  };

  const handleReassignTickets = (staff) => {
    setSelectedStaff(staff);
    setReassignModalOpen(true);
  };

  const handleModalClose = () => {
    setNudgeModalOpen(false);
    setReassignModalOpen(false);
    setSelectedStaff(null);
    // Reload data to reflect changes
    loadPerformanceData();
  };

  const loadAIInsights = async () => {
    setAiInsights(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Prepare data for AI analysis
      const performanceData = {
        systemHealth,
        totalStaff: allStaffData.length,
        totalActiveTickets: systemHealth?.totalActive || 0,
        totalOverdueTickets: departmentData.reduce((sum, dept) => sum + (dept.overdueTickets || 0), 0),
        departmentHealth: departmentData,
        topBottlenecks: staffBottlenecks.slice(0, 5),
        trends: staffBottlenecks.length > 0 ? calculatePerformanceTrends(staffBottlenecks[0].tickets || []) : null
      };

      // Generate executive summary
      const summary = await generateExecutiveSummary(performanceData);

      // Detect anomalies
      const anomalyData = {
        currentMetrics: {
          activeTickets: systemHealth?.totalActive || 0,
          overdueRate: systemHealth?.totalActive > 0 
            ? Math.round((performanceData.totalOverdueTickets / systemHealth.totalActive) * 100)
            : 0,
          avgResolutionTime: 36 // Placeholder
        },
        historicalAverage: {
          activeTickets: systemHealth?.totalActive || 0,
          overdueRate: 15,
          avgResolutionTime: 40
        },
        trends: performanceData.trends || {
          weekOverWeekChange: 0,
          monthOverMonthChange: 0,
          weekTrend: 'stable'
        },
        departmentData: departmentData.map(dept => ({
          office: dept.office,
          activeTickets: dept.activeTickets,
          overdueTickets: dept.overdueTickets,
          overdueRate: dept.activeTickets > 0 
            ? Math.round((dept.overdueTickets / dept.activeTickets) * 100)
            : 0
        })),
        staffData: staffBottlenecks.slice(0, 5).map(staff => ({
          name: staff.name,
          department: staff.department || staff.office,
          activeTickets: staff.activeTickets,
          overdueTickets: staff.overdueTickets,
          riskScore: staff.riskScore
        }))
      };

      const anomaliesResult = await detectAnomalies(anomalyData);

      // Generate smart recommendations
      const workloadData = {
        overloadedStaff: staffBottlenecks.filter(s => s.riskScore > 50).slice(0, 3),
        underloadedStaff: allStaffData.filter(s => s.activeTickets < 8 && s.riskScore < 30).slice(0, 3),
        departmentCapacity: departmentData.reduce((acc, dept) => {
          acc[dept.office] = {
            currentActive: dept.activeTickets,
            maxCapacity: dept.staffCount * 12,
            utilization: dept.staffCount > 0 
              ? Math.round((dept.activeTickets / (dept.staffCount * 12)) * 100)
              : 0
          };
          return acc;
        }, {}),
        upcomingDeadlines: [],
        historicalPatterns: {}
      };

      const smartRecs = await generateSmartRecommendations(workloadData);

      setAiInsights({
        executiveSummary: summary,
        anomalies: anomaliesResult.anomalies || [],
        smartRecommendations: smartRecs || [],
        loading: false,
        error: null,
        overallRisk: anomaliesResult.overallRisk || 'low'
      });
    } catch (error) {
      console.error('Error loading AI insights:', error);
      setAiInsights(prev => ({
        ...prev,
        loading: false,
        error: 'Unable to load AI insights. Please try again later.'
      }));
    }
  };

  const refreshAIInsights = () => {
    loadAIInsights();
  };

  const handleApplyRecommendation = async (recommendation) => {
    if (!recommendation || !recommendation.type) {
      toast.warning('This recommendation cannot be applied automatically.');
      return;
    }

    // Handle reassign recommendations
    if (recommendation.type === 'reassign') {
      // Try to find the staff member
      let fromStaff = null;
      
      // Try from affectedStaff array
      if (recommendation.affectedStaff && recommendation.affectedStaff.length > 0) {
        fromStaff = allStaffData.find(s => 
          recommendation.affectedStaff.some(name => 
            s.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(s.name.toLowerCase())
          )
        );
      }
      
      // Try from title/description text
      if (!fromStaff) {
        const searchText = `${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase();
        fromStaff = allStaffData.find(s => searchText.includes(s.name.toLowerCase()));
      }
      
      // Fallback to highest risk staff
      if (!fromStaff && staffBottlenecks.length > 0) {
        fromStaff = staffBottlenecks[0];
      }
      
      if (fromStaff) {
        setSelectedStaff(fromStaff);
        setReassignModalOpen(true);
      } else {
        toast.warning('Could not identify staff member. Please reassign tickets manually from the Staff Bottlenecks section.');
      }
      return;
    }
    
    // Handle training/process improvement recommendations
    if (recommendation.type === 'training' || recommendation.type === 'process_improvement') {
      const steps = recommendation.steps?.join('\n• ') || 'No specific steps provided';
      const confirmed = await confirm({
        title: 'Apply Recommendation',
        message: `Apply this recommendation?\n\n${recommendation.title}\n\nImplementation Steps:\n• ${steps}\n\nThis will create a task record for follow-up.`,
        confirmText: 'Apply Recommendation',
        variant: 'info'
      });
      
      if (confirmed) {
        try {
          await addDoc(collection(db, 'performance_tasks'), {
            type: recommendation.type,
            title: recommendation.title,
            description: recommendation.description,
            affectedStaff: recommendation.affectedStaff,
            steps: recommendation.steps,
            expectedImpact: recommendation.expectedImpact,
            priority: recommendation.priority,
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: 'superadmin'
          });
          loadPerformanceTasks();
          toast.success('Recommendation has been recorded as a task for follow-up.');
        } catch (error) {
          console.error('Error creating task:', error);
          toast.error('Failed to create task record.');
        }
      }
      return;
    }
    
    // Handle hire recommendations
    if (recommendation.type === 'hire') {
      const department = recommendation.affectedStaff?.[0] || 
                        recommendation.description?.match(/\b(finance|guidance|library|registrar)\b/i)?.[1] || 
                        'Unknown';
      
      const confirmed = await confirm({
        title: 'Staffing Request',
        message: `This recommendation suggests hiring additional staff.\n\n${recommendation.title}\n\n${recommendation.expectedImpact || ''}\n\nWould you like to create a staffing request?`,
        confirmText: 'Create Request',
        variant: 'info'
      });
      
      if (confirmed) {
        try {
          await addDoc(collection(db, 'staffing_requests'), {
            department: department,
            reason: recommendation.description,
            expectedImpact: recommendation.expectedImpact,
            priority: recommendation.priority,
            status: 'pending_review',
            requestedAt: serverTimestamp(),
            requestedBy: 'superadmin_performance_system'
          });
          toast.success('Staffing request has been created and submitted for review.');
        } catch (error) {
          console.error('Error creating staffing request:', error);
          toast.error('Failed to create staffing request.');
        }
      }
      return;
    }
    
    // Unknown type
    toast.warning('This recommendation type is not yet supported for automatic application.');
  };

  const handleGenerateNTE = async (staff) => {
    // Only allow NTE generation for Stage 3 and 4
    if (!staff.warningStage || staff.warningStage.stage < 3) {
      toast.warning('Notice to Explain (NTE) is only generated for staff at Stage 3 (Serious Warning) or Stage 4 (Critical).');
      return;
    }

    // Check if already has pending NTE
    const hasPending = await hasPendingNTE(staff.uid);
    if (hasPending) {
      toast.warning(`${staff.name} already has a pending Notice to Explain. Please review existing NTE before generating a new one.`);
      return;
    }

    const confirmed = await confirm({
      title: 'Generate Notice to Explain',
      message: `Generate Notice to Explain (NTE) for ${staff.name}?\n\n` +
        `Warning Stage: Stage ${staff.warningStage.stage} - ${staff.warningStage.stageName}\n` +
        `Risk Score: ${staff.riskScore}%\n` +
        `Active Tickets: ${staff.activeTickets}\n` +
        `Overdue Tickets: ${staff.overdueTickets}\n\n` +
        `This will create a formal NTE document that requires a response within 5 working days.`,
      confirmText: 'Generate NTE',
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      // Generate NTE
      const nte = await createNTE(staff);
      
      // Download the NTE document
      downloadNTE(nte);
      
      alertModal({
        title: 'Notice to Explain Generated',
        message: `Notice to Explain generated successfully!\n\n` +
          `Document ID: ${nte.id}\n` +
          `Staff: ${staff.name}\n` +
          `Response Deadline: ${new Date(nte.responseDeadline).toLocaleDateString()}\n\n` +
          `The NTE document has been downloaded. Please provide it to the staff member.`,
        variant: 'success'
      });

      // Reload performance data to reflect changes
      loadPerformanceData();
    } catch (error) {
      console.error('Error generating NTE:', error);
      toast.error('Failed to generate Notice to Explain. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="performance-monitor-loading">
        <LoadingSpinner />
        <p>Analyzing system performance...</p>
      </div>
    );
  }

  return (
    <div className="performance-monitor">
      {/* System Health Overview */}
      <div className="system-health-banner">
        <div className="health-status">
          <div className={`status-indicator status-${systemHealth?.status}`}>
            {systemHealth?.status === 'good' ? <FaCheckCircle /> : <FaExclamationTriangle />}
          </div>
          <div className="health-info">
            <h2>System Health: {systemHealth?.status?.toUpperCase()}</h2>
            <p className="health-subtitle">
              {systemHealth?.totalActive} tickets active | {systemHealth?.onTrackPercentage}% on-track | {systemHealth?.atRisk} at-risk
            </p>
          </div>
        </div>
        <div className="health-banner-actions">
          <div className="last-updated">
            <FaClock />
            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Department Health Cards */}
      <div className="section-header">
        <h3>Department Health Monitor</h3>
        <p>Real-time operational status across all offices</p>
      </div>
      
      <div className="department-grid">
        {departmentData.map(dept => {
          const deptKey = (dept.office || '').toLowerCase();
          const getOfficeIcon = () => {
            switch (deptKey) {
              case 'finance': return <FaDollarSign />;
              case 'library': return <FaBook />;
              case 'registrar': return <FaClipboardList />;
              case 'guidance': return <FaUserFriends />;
              default: return <FaUsers />;
            }
          };

          const insightText = dept.overdueTickets > 0
            ? `${dept.overdueTickets} ticket${dept.overdueTickets > 1 ? 's' : ''} past resolution deadline`
            : dept.atRiskTickets > 0
              ? `${dept.atRiskTickets} ticket${dept.atRiskTickets > 1 ? 's' : ''} nearing deadline (<24h)`
              : dept.activeTickets === 0
                ? 'Queue clear • Zero backlog'
                : 'Optimal pace • 100% on-time resolution';

          return (
            <div key={dept.office} className={`dept-card dept-${dept.status}`}>
              {/* Card Header: Avatar Icon, Name, Staff Count & Status Pill */}
              <div className="dept-card-header">
                <div className="dept-title-group">
                  <div className={`dept-avatar-icon ${deptKey}`}>
                    {getOfficeIcon()}
                  </div>
                  <div className="dept-title-meta">
                    <h4 className="dept-name">{dept.office}</h4>
                    <span className="dept-staff-count">
                      <FaUsers className="mini-icon" /> {dept.staffCount} staff member{dept.staffCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className={`dept-health-pill ${dept.status}`}>
                  <span className="health-pill-dot" />
                  <span>{dept.status.replace('-', ' ')}</span>
                </div>
              </div>

              {/* Resolution Health Bar & On-Time Rate */}
              <div className="dept-sla-section">
                <div className="sla-labels-row">
                  <span className="sla-title">On-Time Resolution Rate</span>
                  <span className={`sla-percentage ${dept.status}`}>{dept.onTimePercentage}%</span>
                </div>
                <div className="sla-progress-track">
                  <div 
                    className={`sla-progress-bar ${dept.status}`} 
                    style={{ width: `${Math.max(5, dept.onTimePercentage)}%` }} 
                  />
                </div>
              </div>

              {/* 3 Key Metrics Grid */}
              <div className="dept-metrics-grid">
                <div className="dept-metric-cell">
                  <span className="metric-val">{dept.activeTickets}</span>
                  <span className="metric-lbl">Active</span>
                </div>
                <div className={`dept-metric-cell ${dept.atRiskTickets > 0 ? 'warning-cell' : ''}`}>
                  <span className="metric-val">{dept.atRiskTickets}</span>
                  <span className="metric-lbl">At Risk</span>
                </div>
                <div className={`dept-metric-cell ${dept.overdueTickets > 0 ? 'critical-cell' : ''}`}>
                  <span className="metric-val">{dept.overdueTickets}</span>
                  <span className="metric-lbl">Overdue</span>
                </div>
              </div>

              {/* Contextual Operational Footer */}
              <div className={`dept-card-footer ${dept.status}`}>
                {dept.status === 'healthy' ? (
                  <FaCheckCircle className="footer-status-icon healthy" />
                ) : (
                  <FaExclamationTriangle className="footer-status-icon alert" />
                )}
                <span className="footer-insight-text">{insightText}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Bottleneck Radar */}
      {staffBottlenecks.length > 0 && (
        <>
          <div className="section-header">
            <h3>
              <FaExclamationTriangle /> Staff Bottleneck Radar
            </h3>
            <p>{staffBottlenecks.length} staff member{staffBottlenecks.length !== 1 ? 's' : ''} requiring attention</p>
          </div>
          
          <div className="bottleneck-list">
            {staffBottlenecks.map(staff => (
              <div key={staff.id} className={`bottleneck-card risk-level-${staff.riskScore >= 75 ? 'critical' : staff.riskScore >= 50 ? 'high' : 'moderate'}`}>
                <div className="bottleneck-header">
                  <div className="staff-info">
                    <h4>{staff.name}</h4>
                    <span className="staff-office">{staff.office}</span>
                  </div>
                  <div className="risk-indicator">
                    <div className="risk-score">{staff.riskScore}%</div>
                    <div className="risk-label">Risk Score</div>
                  </div>
                </div>
                
                <div className="bottleneck-metrics">
                  <div className="metric-item">
                    <FaChartLine />
                    <span>{staff.activeTickets} active tickets</span>
                  </div>
                  <div className="metric-item">
                    <FaExclamationTriangle />
                    <span>{staff.overdueTickets} overdue</span>
                  </div>
                  <div className="metric-item">
                    <FaBell />
                    <span>30-day: {staff.performance.onTimeRate}% on-time</span>
                  </div>
                </div>
                
                <div className={`warning-stage stage-${staff.warningStage.stage}`}>
                  <strong>Stage {staff.warningStage.stage}: {staff.warningStage.stageName}</strong>
                  <p>{staff.warningStage.description}</p>
                </div>
                
                <div className="bottleneck-actions">
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleSendNudge(staff)}
                  >
                    <FaBell /> Send Nudge
                  </button>
                  <button 
                    className="action-btn primary"
                    onClick={() => handleReassignTickets(staff)}
                  >
                    <FaExchangeAlt /> Reassign Tickets
                  </button>
                  {staff.warningStage && staff.warningStage.stage >= 3 && (
                    <button 
                      className="action-btn danger"
                      onClick={() => handleGenerateNTE(staff)}
                      title="Generate Notice to Explain"
                    >
                      <FaFileAlt /> Generate NTE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* AI-Powered Insights Section */}
      <div className="ai-insights-section">
        <div className="ai-insights-header">
          <div className="ai-header-left">
            <h3>
              <span className="ai-header-icon-wrapper">
                <FaBrain />
              </span>
              AI-Powered Insights
            </h3>
          </div>
          {aiInsights.executiveSummary && (
            <div className="section-actions">
              <button 
                className="btn-ai-refresh" 
                onClick={refreshAIInsights}
                disabled={aiInsights.loading}
              >
                <FaBrain className="btn-icon" />
                <span>{aiInsights.loading ? 'Analyzing...' : 'Refresh AI Analysis'}</span>
              </button>
            </div>
          )}
        </div>

        {aiInsights.error && (
          <div className="ai-error">
            <FaExclamationTriangle />
            <span>{aiInsights.error}</span>
          </div>
        )}

        {aiInsights.loading && (
          <div className="ai-loading">
            <LoadingSpinner />
            <p>AI is analyzing performance patterns and evaluating system health...</p>
          </div>
        )}

        {!aiInsights.loading && !aiInsights.error && !aiInsights.executiveSummary && (
          <div className="ai-empty-prompt">
            <div className="ai-empty-icon-wrapper">
              <FaBrain className="ai-empty-brain-icon" />
            </div>
            <h4>Evaluate System Performance with AI</h4>
            <p>
              Detect operational bottlenecks, identify resolution anomalies, and generate automated improvement recommendations.
            </p>
            <button 
              className="btn-ai-generate-main"
              onClick={refreshAIInsights}
              disabled={aiInsights.loading}
            >
              <FaBrain className="btn-icon" />
              <span>Generate AI Analysis</span>
            </button>
          </div>
        )}

        {!aiInsights.loading && !aiInsights.error && aiInsights.executiveSummary && (
          <>
            {/* Executive Summary */}
            <div className="ai-executive-summary">
              <div className="summary-header">
                <div className="summary-title-group">
                  <span className="summary-icon-wrapper">
                    <FaLightbulb />
                  </span>
                  <h4>Executive Summary</h4>
                </div>
                <span className="summary-meta-pill">Real-Time Operational Diagnosis</span>
              </div>
              <p className="summary-text">{aiInsights.executiveSummary}</p>
            </div>

            {/* Anomalies Detected */}
            {aiInsights.anomalies && aiInsights.anomalies.length > 0 && (
              <div className="ai-anomalies">
                <div className="anomalies-header">
                  <div className="anomalies-title-group">
                    <span className="anomalies-icon-wrapper">
                      <FaSearch />
                    </span>
                    <h4>Anomalies Detected</h4>
                    <span className="anomalies-count-pill">
                      {aiInsights.anomalies.length} {aiInsights.anomalies.length === 1 ? 'Pattern' : 'Patterns'}
                    </span>
                  </div>
                  <span className={`risk-badge risk-${aiInsights.overallRisk || 'medium'}`}>
                    <span className="risk-dot"></span>
                    {(aiInsights.overallRisk || 'medium').toUpperCase()} RISK
                  </span>
                </div>
                <div className="anomalies-list">
                  {aiInsights.anomalies.map((anomaly, index) => (
                    <div key={index} className={`anomaly-card severity-${anomaly.severity}`}>
                      <div className="anomaly-header">
                        <span className={`severity-badge ${anomaly.severity}`}>
                          <span className="severity-dot"></span>
                          {anomaly.severity?.toUpperCase()}
                        </span>
                        <span className="anomaly-type">{anomaly.type?.replace(/_/g, ' ')}</span>
                      </div>
                      <h5>{anomaly.title}</h5>
                      <p className="anomaly-description">{anomaly.description}</p>
                      <div className="anomaly-footer">
                        <div className="anomaly-meta-item">
                          <span className="meta-label">Affected Area:</span>
                          <span className="meta-value area-value">{anomaly.affectedArea}</span>
                        </div>
                        <div className="anomaly-meta-item">
                          <span className="meta-label">Recommended Action:</span>
                          <span className="meta-value action-value">{anomaly.recommendation}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Smart AI Recommendations */}
            {aiInsights.smartRecommendations && aiInsights.smartRecommendations.length > 0 && (
              <div className="ai-smart-recommendations">
                <div className="smart-recs-header">
                  <div className="recs-title-group">
                    <span className="recs-icon-wrapper">
                      <FaChartLine />
                    </span>
                    <h4>AI Strategic Recommendations</h4>
                  </div>
                  <span className="recs-count-pill">
                    {aiInsights.smartRecommendations.length} {aiInsights.smartRecommendations.length === 1 ? 'Action' : 'Actions'}
                  </span>
                </div>
                <div className="smart-recs-list">
                  {aiInsights.smartRecommendations.map((rec, index) => (
                    <div key={index} className={`smart-rec-card priority-${rec.priority}`}>
                      <div className="smart-rec-header">
                        <span className={`priority-badge ${rec.priority}`}>
                          <span className="priority-dot"></span>
                          {(rec.priority || 'NORMAL').toUpperCase()} PRIORITY
                        </span>
                        <span className="rec-type">{rec.type?.replace(/_/g, ' ')}</span>
                      </div>
                      <h5>{rec.title}</h5>
                      <p className="smart-rec-description">{rec.description}</p>
                      
                      {rec.affectedStaff && rec.affectedStaff.length > 0 && (
                        <div className="rec-meta-box affected-staff-box">
                          <div className="rec-meta-label">
                            <FaUsers className="meta-icon" /> Assigned / Affected Staff
                          </div>
                          <div className="staff-tags-container">
                            {rec.affectedStaff.map((staff, idx) => (
                              <span key={idx} className="staff-tag-pill">
                                <span className="staff-tag-avatar">{staff.charAt(0).toUpperCase()}</span>
                                <span className="staff-tag-name">{staff}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {rec.expectedImpact && (
                        <div className="rec-meta-box impact-box">
                          <div className="rec-meta-label">
                            <FaLightbulb className="meta-icon impact-icon" /> Expected Operational Impact
                          </div>
                          <p className="rec-impact-text">{rec.expectedImpact}</p>
                        </div>
                      )}
                      
                      {rec.steps && rec.steps.length > 0 && (
                        <div className="rec-steps-box">
                          <div className="rec-meta-label">
                            <FaClipboardCheck className="meta-icon" /> Implementation Steps
                          </div>
                          <ol className="rec-steps-list">
                            {rec.steps.map((step, i) => (
                              <li key={i} className="rec-step-item">
                                <span className="step-num">{i + 1}</span>
                                <span className="step-text">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      <div className="rec-card-footer">
                        <button 
                          className="rec-apply-btn"
                          onClick={() => handleApplyRecommendation(rec)}
                        >
                          Apply Recommendation
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiInsights.anomalies.length === 0 && aiInsights.smartRecommendations.length === 0 && (
              <div className="ai-no-issues">
                <FaCheckCircle />
                <p>No anomalies detected. System performance is within normal parameters.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Smart Recommendations */}
      {recommendations.length > 0 && (
        <>
          <div className="section-header">
            <h3>
              <FaChartLine /> AI Recommendations
            </h3>
            <p>Suggested actions to optimize workload</p>
          </div>
          
          <div className="recommendations-list">
            {recommendations.map((rec, index) => (
              <div key={index} className="recommendation-card">
                <div className="rec-icon">
                  <FaExchangeAlt />
                </div>
                <div className="rec-content">
                  <h4>Workload Rebalancing Recommended</h4>
                  <p>{rec.reason}</p>
                  <div className="rec-action">
                    <strong>Suggestion:</strong> Reassign {rec.ticketCount} tickets from {rec.from} to {rec.to}
                  </div>
                </div>
                <button className="rec-apply-btn">Apply</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Performance Trend Charts */}
      <PerformanceTrendCharts />

      {/* Performance Tasks */}
      {performanceTasks.length > 0 && (
        <div className="performance-tasks-section">
          <div className="section-header performance-tasks-header">
            <div className="tasks-header-left">
              <h3>
                <span className="tasks-header-icon-wrapper">
                  <FaClipboardList />
                </span>
                Performance Improvement Tasks
              </h3>
            </div>
            <div className="tasks-header-right">
              <span className="task-count-pill">
                {performanceTasks.length} {performanceTasks.length === 1 ? 'Action' : 'Actions'}
              </span>
            </div>
          </div>

          <div className="tasks-grid">
            {performanceTasks.map(task => {
                  const isCompleted = task.status === 'completed';
                  const isInProgress = task.status === 'in_progress';
                  const priorityClass = task.priority || 'medium';

                  return (
                    <div 
                      key={task.id} 
                      className={`task-card priority-${priorityClass} task-status-${task.status}`}
                    >
                      <div className="task-card-header">
                        <div className="task-card-badges">
                          <span className={`task-type-badge ${task.type}`}>
                            {getTaskTypeIcon(task.type)}
                            <span>{getTaskTypeLabel(task.type)}</span>
                          </span>
                          <span className={`task-priority-badge priority-${priorityClass}`}>
                            <span className="priority-dot"></span>
                            {(task.priority || 'Normal').toUpperCase()}
                          </span>
                        </div>
                        <div className="task-card-controls">
                          <span className={`task-status-badge ${task.status}`}>
                            {isCompleted && <FaCheckCircle className="status-badge-icon" />}
                            {isInProgress && <FaClock className="status-badge-icon" />}
                            {task.status?.replace(/_/g, ' ')}
                          </span>
                          <button 
                            className="task-delete-btn"
                            onClick={() => handleDeleteTask(task.id)}
                            title="Dismiss task"
                            aria-label="Dismiss task"
                          >
                            <FaTrashAlt />
                          </button>
                        </div>
                      </div>

                      <div className="task-card-body">
                        <h4 className="task-title">{task.title}</h4>
                        <p className="task-description">{task.description}</p>
                        
                        {task.affectedStaff && task.affectedStaff.length > 0 && (
                          <div className="task-meta-box affected-staff-box">
                            <div className="meta-box-label">
                              <FaUserFriends className="meta-icon" />
                              <span>Assigned / Affected Staff</span>
                            </div>
                            <div className="staff-tags-container">
                              {task.affectedStaff.map((staffName, idx) => (
                                <span key={idx} className="staff-tag-pill">
                                  <span className="staff-tag-avatar">{staffName.charAt(0).toUpperCase()}</span>
                                  <span className="staff-tag-name">{staffName}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {task.steps && task.steps.length > 0 && (
                          <div className="task-steps-box">
                            <div className="meta-box-label">
                              <FaClipboardCheck className="meta-icon" />
                              <span>Implementation Steps</span>
                            </div>
                            <ol className="task-steps-timeline">
                              {task.steps.map((step, i) => (
                                <li key={i} className="task-step-item">
                                  <span className="step-number">{i + 1}</span>
                                  <span className="step-text">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        
                        {task.expectedImpact && (
                          <div className="task-meta-box impact-box">
                            <div className="meta-box-label">
                              <FaLightbulb className="meta-icon impact-icon" />
                              <span>Expected Operational Impact</span>
                            </div>
                            <p className="impact-text">{task.expectedImpact}</p>
                          </div>
                        )}
                      </div>

                      <div className="task-card-footer">
                        <div className="task-date-info">
                          <FaClock className="date-icon" />
                          <span>
                            Created {task.createdAt?.toDate ? task.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                          </span>
                        </div>
                        <div className="task-footer-actions">
                          {task.status === 'pending' && (
                            <button 
                              className="btn-task-action start-btn"
                              onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                            >
                              <span>Start Task</span>
                              <FaChevronRight className="btn-icon" />
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button 
                              className="btn-task-action complete-btn"
                              onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                            >
                              <FaCheck className="btn-icon" />
                              <span>Mark Completed</span>
                            </button>
                          )}
                          {task.status === 'completed' && (
                            <button 
                              className="btn-task-action reopen-btn"
                              onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                            >
                              <span>Reopen</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
      )}

      {/* Modals */}
      <NudgeModal
        isOpen={nudgeModalOpen}
        onClose={handleModalClose}
        staffMember={selectedStaff}
      />
      
      <ReassignTicketsModal
        isOpen={reassignModalOpen}
        onClose={handleModalClose}
        staffMember={selectedStaff}
        allStaff={allStaffData}
      />
    </div>
  );
};

export default PerformanceMonitor;
