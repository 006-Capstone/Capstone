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
  FaClipboardCheck,
  FaChevronDown,
  FaArrowRight,
  FaBolt,
  FaBuilding
} from 'react-icons/fa';
import {
  calculateStaffRiskScore,
  calculate30DayPerformance,
  determineWarningStage,
  analyzeDepartmentHealth,
  calculateTicketRisk,
  generateWorkloadRecommendations,
  calculatePerformanceTrends,
  forecastCapacity,
  calculateStaffEfficiencyScore
} from '../utils/performanceAnalytics';
import {
  generateExecutiveSummary,
  detectAnomalies,
  generateSmartRecommendations
} from '../utils/groqService';
import { createNTE, downloadNTE, hasPendingNTE } from '../utils/nteGenerator';
import { OverviewCardsSkeleton, AnalyticsChartSkeleton, DataTableSkeleton } from './common/Skeleton';
import NudgeModal from './NudgeModal';
import ReassignTicketsModal from './ReassignTicketsModal';
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
  const [expandedRecSteps, setExpandedRecSteps] = useState({});
  const [expandedTaskSteps, setExpandedTaskSteps] = useState({});
  const [expandedDeptStaff, setExpandedDeptStaff] = useState({});

  const toggleDeptStaff = (office) => {
    setExpandedDeptStaff(prev => ({
      ...prev,
      [office]: !prev[office]
    }));
  };

  const toggleRecSteps = (index) => {
    setExpandedRecSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleTaskSteps = (taskId) => {
    setExpandedTaskSteps(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const findMatchingTask = (rec) => {
    if (!rec || !rec.title) return null;
    return performanceTasks.find(t => 
      t.title?.trim().toLowerCase() === rec.title?.trim().toLowerCase()
    );
  };

  const scrollToTask = (taskId) => {
    const el = document.getElementById(`task-card-${taskId}`) || document.getElementById('performance-tasks-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('task-card-highlight');
      setTimeout(() => {
        el.classList.remove('task-card-highlight');
      }, 2500);
    }
  };

  const detectItemDepartment = (item) => {
    if (!item) return null;
    const directDept = item.department || item.office;
    if (directDept && ['finance', 'guidance', 'library', 'registrar'].includes(directDept.toLowerCase())) {
      return directDept.charAt(0).toUpperCase() + directDept.slice(1).toLowerCase();
    }

    const text = `${item.title || ''} ${item.description || ''} ${item.reason || ''}`.toLowerCase();

    const deptKeywords = {
      Registrar: ['registrar', 'transcript', 'tor', 'certificate of enrollment', 'coe', 'form 137', 'form 138', 'diploma', 'academic record', 'graduation', 'curriculum', 'enrollment clearance', 'grade', 'student records', 'credentials', 'honorable dismissal', 'completion form', 'document request', 'records', 'dorothy', 'gerolaga', 'backlog', 'overdue tickets', 'turnaround time', 'sla breach'],
      Finance: ['finance', 'tuition', 'balance', 'fee', 'payment', 'receipt', 'assessment', 'cashier', 'accounting', 'promissory', 'billing', 'financial', 'ledger', 'refund', 'statement of account', 'soa'],
      Library: ['library', 'book', 'librarian', 'borrow', 'circulation', 'catalog', 'overdue book', 'book clearance', 'accession', 'library card', 'ban s'],
      Guidance: ['guidance', 'counseling', 'counselor', 'good moral', 'conduct', 'moral certificate', 'behavior', 'student affairs']
    };

    for (const [dept, keywords] of Object.entries(deptKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return dept;
      }
    }

    // If still null, check if any staff in affectedStaff is from a department
    if (Array.isArray(item.affectedStaff) && item.affectedStaff.length > 0) {
      for (const sName of item.affectedStaff) {
        const sLower = (sName || '').toLowerCase().trim();
        const matched = allStaffData.find(s => (s.name || '').toLowerCase().trim() === sLower);
        if (matched && matched.department) {
          const deptClean = matched.department.charAt(0).toUpperCase() + matched.department.slice(1).toLowerCase();
          return deptClean;
        }
      }
    }

    return 'Registrar'; // default to primary school service department
  };

  const getCleanedStaffList = (staffList, itemContext = null, staffDataSource = null) => {
    if (!Array.isArray(staffList)) return [];
    const activeStaff = (staffDataSource && staffDataSource.length > 0) ? staffDataSource : allStaffData;
    const invalidPattern = /^(all departments?|it support.*|helpdesk.*|technical support.*|staff.*|n\/a|none|unknown|various)$/i;
    const validDepts = ['finance', 'guidance', 'library', 'registrar'];

    const targetDept = itemContext ? detectItemDepartment(itemContext) : null;
    const cleaned = [];

    staffList.forEach(raw => {
      if (!raw || typeof raw !== 'string') return;
      const s = raw.trim();
      if (!s || invalidPattern.test(s)) return;

      const sLower = s.toLowerCase().replace(/\s+(office|department)$/i, '').trim();

      // Check if it's a department name (e.g. "Registrar", "Finance")
      if (validDepts.includes(sLower)) {
        const formattedDept = sLower.charAt(0).toUpperCase() + sLower.slice(1);
        if (!targetDept || targetDept.toLowerCase() === sLower) {
          if (!cleaned.includes(formattedDept)) cleaned.push(formattedDept);
        }
        return;
      }

      // Check against real registered staff
      const matchedStaff = activeStaff.find(staff => {
        const staffName = (staff.name || '').trim().toLowerCase();
        return staffName === sLower ||
               (staffName.length > 3 && (sLower.includes(staffName) || staffName.includes(sLower)));
      });

      // Discard if not a registered staff member (prevents AI hallucinated names)
      if (!matchedStaff) {
        console.warn(`[Anti-Hallucination] Discarded non-registered staff name: "${s}"`);
        return;
      }

      const staffDept = (matchedStaff.department || matchedStaff.office || '').toLowerCase().replace(/\s+(office|department)$/i, '').trim();

      // Cross-department check:
      // Staff MUST belong to the task/recommendation department!
      // (e.g. Jefelah P. Amistoso from Finance cannot be attached to a Registrar task)
      if (targetDept && staffDept && staffDept !== targetDept.toLowerCase()) {
        console.warn(`[Anti-Hallucination] Discarded cross-department staff ${matchedStaff.name} (${staffDept}) from ${targetDept} item`);
        return;
      }

      if (!cleaned.includes(matchedStaff.name)) {
        cleaned.push(matchedStaff.name);
      }
    });

    // If all staff were discarded (due to hallucination or cross-department mismatch),
    // and we know the target department, show the target department badge instead!
    if (cleaned.length === 0 && targetDept) {
      cleaned.push(targetDept);
    }

    return cleaned;
  };

  const cleanTitleText = (title, itemContext = null, staffDataSource = null) => {
    if (!title || typeof title !== 'string') return title;
    const activeStaff = (staffDataSource && staffDataSource.length > 0) ? staffDataSource : allStaffData;
    const targetDept = itemContext ? detectItemDepartment(itemContext) : null;

    let cleaned = title;
    cleaned = cleaned.replace(/it support|helpdesk|technical support|it desk/gi, 'Office');
    cleaned = cleaned.replace(/keyword routing( triage)?/gi, 'request processing');

    if (targetDept && activeStaff.length > 0) {
      activeStaff.forEach(staff => {
        const staffDept = (staff.department || staff.office || '').toLowerCase().replace(/\s+(office|department)$/i, '').trim();
        if (staffDept && staffDept !== targetDept.toLowerCase()) {
          const nameRegex = new RegExp(`\\b${staff.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
          if (nameRegex.test(cleaned)) {
            cleaned = cleaned.replace(nameRegex, `${targetDept} Operations`);
          }
        }
      });
    }

    return cleaned;
  };

  const cleanDescriptionText = (text, itemContext = null, staffDataSource = null) => {
    if (!text || typeof text !== 'string') return text;
    const activeStaff = (staffDataSource && staffDataSource.length > 0) ? staffDataSource : allStaffData;
    const targetDept = itemContext ? detectItemDepartment(itemContext) : null;

    let cleaned = text;
    cleaned = cleaned.replace(/it support|helpdesk|technical support|it department|it team/gi, 'office operations');
    cleaned = cleaned.replace(/keyword routing( triage)?/gi, 'request processing');
    cleaned = cleaned.replace(/tier 1|tier 2/gi, 'staff');

    if (targetDept && activeStaff.length > 0) {
      activeStaff.forEach(staff => {
        const staffDept = (staff.department || staff.office || '').toLowerCase().replace(/\s+(office|department)$/i, '').trim();
        if (staffDept && staffDept !== targetDept.toLowerCase()) {
          const nameRegex = new RegExp(`\\b${staff.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
          if (nameRegex.test(cleaned)) {
            cleaned = cleaned.replace(nameRegex, `${targetDept} staff`);
          }
        }
      });
    }

    return cleaned;
  };

  const renderTargetChip = (targetName, idx) => {
    const cleanName = (targetName || '').trim();
    const lower = cleanName.toLowerCase().replace(/\s+(office|department)$/i, '').trim();
    const isDept = ['finance', 'guidance', 'library', 'registrar'].includes(lower);

    if (isDept) {
      const formattedDept = lower.charAt(0).toUpperCase() + lower.slice(1);
      return (
        <span key={idx} className="dept-tag-pill compact">
          <FaBuilding className="dept-tag-icon" />
          <span className="dept-tag-name">{formattedDept}</span>
        </span>
      );
    }

    return (
      <span key={idx} className="staff-tag-pill compact">
        <span className="staff-tag-avatar">{cleanName.charAt(0).toUpperCase()}</span>
        <span className="staff-tag-name">{cleanName}</span>
      </span>
    );
  };

  const parseExecutiveBullets = (summaryText) => {
    if (!summaryText) return [];
    const lines = summaryText
      .split(/\n+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return [];

    const sanitizeLine = (text) => {
      let t = text;
      t = t.replace(/it support|helpdesk|technical support|it team|it department/gi, 'office operations');
      t = t.replace(/keyword routing( triage)?/gi, 'request processing');
      if (/registrar/i.test(t) && /jefelah/i.test(t)) {
        t = t.replace(/\bjefelah(\s+p\.?)?(\s+amistoso)?\b/gi, 'Registrar staff');
      }
      return t;
    };

    const items = [];
    lines.forEach(line => {
      const cleanLine = sanitizeLine(line.replace(/^[-•*]\s*/, '').trim());
      if (/^status[:\-]/i.test(cleanLine)) {
        items.push({ type: 'status', label: 'Status', text: cleanLine.replace(/^status[:\-]\s*/i, '').trim() });
      } else if (/^(bottleneck|risk|warning|watch)[:\-]/i.test(cleanLine)) {
        items.push({ type: 'bottleneck', label: 'Bottleneck', text: cleanLine.replace(/^(bottleneck|risk|warning|watch)[:\-]\s*/i, '').trim() });
      } else if (/^(action|recommendation|priority|next step)[:\-]/i.test(cleanLine)) {
        items.push({ type: 'action', label: 'Action Priority', text: cleanLine.replace(/^(action|recommendation|priority|next step)[:\-]\s*/i, '').trim() });
      } else if (cleanLine) {
        items.push({ type: 'general', label: 'Insight', text: cleanLine });
      }
    });

    return items;
  };

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
      
      // Analyze each department comprehensively
      const offices = ['Finance', 'Guidance', 'Library', 'Registrar'];
      const deptData = [];
      
      for (const office of offices) {
        const officeRequests = allRequests.filter(r => (r.office || '').toLowerCase() === office.toLowerCase());
        const officeStaff = allStaff.filter(s => {
          const staffOff = (s.office || s.department || s.officeId || '').toLowerCase().replace(/\s+(office|department)$/i, '').trim();
          const targetOff = office.toLowerCase().replace(/\s+(office|department)$/i, '').trim();
          return staffOff === targetOff;
        });
        
        const health = analyzeDepartmentHealth(officeRequests, officeStaff);
        
        // Calculate each staff member's efficiency score
        const staffWithEfficiency = officeStaff.map(staff => {
          const efficiency = calculateStaffEfficiencyScore(staff, allRequests);
          return {
            ...staff,
            efficiency
          };
        });

        // Sort staff by efficiency score descending
        staffWithEfficiency.sort((a, b) => b.efficiency.score - a.efficiency.score);

        // Average efficiency of the department
        const avgEfficiencyScore = staffWithEfficiency.length > 0
          ? Math.round(staffWithEfficiency.reduce((acc, s) => acc + s.efficiency.score, 0) / staffWithEfficiency.length)
          : (health.status === 'healthy' ? 95 : health.status === 'moderate' ? 80 : 65);

        // Calculate average turnaround time for resolved requests
        let turnAroundTotalMs = 0;
        let turnAroundCount = 0;
        const resolvedRequests = officeRequests.filter(r => r.status === 'Resolved');
        resolvedRequests.forEach(r => {
          const created = r.createdAt?.toDate ? r.createdAt.toDate() : (r.createdAt ? new Date(r.createdAt) : null);
          const resolved = r.resolvedAt?.toDate ? r.resolvedAt.toDate() : (r.resolvedAt ? new Date(r.resolvedAt) : null);
          if (created && resolved) {
            const diff = resolved.getTime() - created.getTime();
            if (diff > 0) {
              turnAroundTotalMs += diff;
              turnAroundCount++;
            }
          }
        });
        let avgTurnaround = 'N/A';
        if (turnAroundCount > 0) {
          const hours = Math.round(turnAroundTotalMs / (turnAroundCount * 1000 * 60 * 60) * 10) / 10;
          if (hours >= 48) {
            avgTurnaround = `${Math.round((hours / 24) * 10) / 10}d`;
          } else {
            avgTurnaround = `${hours}h`;
          }
        }

        // Capacity utilization based on active tickets vs standard capacity (12 active tickets per staff)
        const maxCapacity = officeStaff.length * 12;
        const capacityUtilization = maxCapacity > 0
          ? Math.min(100, Math.round((health.activeTickets / maxCapacity) * 100))
          : 0;

        deptData.push({
          office,
          ...health,
          staffCount: officeStaff.length,
          totalTickets: officeRequests.length,
          resolvedTickets: resolvedRequests.length,
          avgTurnaround,
          capacityUtilization,
          avgEfficiencyScore,
          staffList: staffWithEfficiency
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
      loadPerformanceTasks(enrichedStaffData);
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceTasks = async (staffDataSource = null) => {
    try {
      const activeStaff = (staffDataSource && staffDataSource.length > 0) ? staffDataSource : allStaffData;
      const tasksSnapshot = await getDocs(
        query(collection(db, 'performance_tasks'), orderBy('createdAt', 'desc'))
      );
      const tasks = tasksSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const cleanedStaff = getCleanedStaffList(data.affectedStaff, data, activeStaff);
        const cleanedTitle = cleanTitleText(data.title, data, activeStaff);
        const cleanedDesc = cleanDescriptionText(data.description, data, activeStaff);

        // If stored task had hallucinated staff or cross-department references, persist the cleaned version
        if (
          Array.isArray(data.affectedStaff) &&
          (JSON.stringify(cleanedStaff) !== JSON.stringify(data.affectedStaff) || 
           cleanedDesc !== data.description ||
           cleanedTitle !== data.title)
        ) {
          updateDoc(doc(db, 'performance_tasks', docSnap.id), {
            title: cleanedTitle,
            affectedStaff: cleanedStaff,
            description: cleanedDesc,
            updatedAt: serverTimestamp()
          }).catch(err => {
            console.warn('[Anti-Hallucination] Could not update stored task in DB:', err);
          });
        }

        return {
          id: docSnap.id,
          ...data,
          title: cleanedTitle,
          affectedStaff: cleanedStaff,
          description: cleanedDesc
        };
      });
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

  const sendStaffEfficiencyWarning = async (staff, score) => {
    try {
      const staffName = staff.name || staff.fullName || 'Staff Member';
      const staffId = staff.uid || staff.id;
      
      if (!staffId) {
        toast.error('Unable to send warning: staff ID missing.');
        return;
      }

      await addDoc(collection(db, 'notifications'), {
        recipientId: staffId,
        recipientType: 'staff',
        userId: staffId,
        userType: 'staff',
        type: 'efficiency_score_warning',
        title: `🚨 Performance Alert: Efficiency Score Dropped to ${score}%`,
        message: `Superadmin Department Health Monitor Alert: Your Efficiency Score has dropped to ${score}%, falling below the required standard of 60%. Please process overdue requests immediately to restore department health.`,
        priority: 'high',
        isRead: false,
        read: false,
        score: score,
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        metadata: {
          sentBy: 'superadmin',
          source: 'department_health_monitor',
          staffName,
          score,
          office: staff.office || staff.department
        }
      });

      await addDoc(collection(db, 'performance_logs'), {
        action: 'efficiency_warning_sent',
        staffId,
        staffName,
        score,
        timestamp: serverTimestamp()
      });

      toast.success(`Efficiency warning sent to ${staffName}!`);
    } catch (err) {
      console.error('Error sending efficiency warning:', err);
      toast.error('Failed to send warning: ' + err.message);
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
        allStaffNames: allStaffData.map(s => `${s.name} (${s.department || s.office})`),
        allStaffDetails: allStaffData.map(s => ({
          name: s.name,
          department: s.department || s.office
        })),
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
      const existing = findMatchingTask(recommendation);
      if (existing) {
        toast.info('This recommendation is already tracked in Performance Improvement Tasks.');
        scrollToTask(existing.id);
        return;
      }

      const steps = recommendation.steps?.join('\n• ') || 'No specific steps provided';
      const confirmed = await confirm({
        title: 'Apply Recommendation',
        message: `Apply this recommendation?\n\n${cleanTitleText(recommendation.title, recommendation)}\n\nImplementation Steps:\n• ${steps}\n\nThis will create a task record in Performance Improvement Tasks for follow-up.`,
        confirmText: 'Apply Recommendation',
        variant: 'success'
      });
      
      if (confirmed) {
        try {
          const recDept = detectItemDepartment(recommendation) || 'Registrar';
          const cleanedStaff = getCleanedStaffList(recommendation.affectedStaff, recommendation);
          const cleanedTitle = cleanTitleText(recommendation.title, recommendation);
          const cleanedDesc = cleanDescriptionText(recommendation.description, recommendation);

          const docRef = await addDoc(collection(db, 'performance_tasks'), {
            type: recommendation.type,
            department: recDept,
            title: cleanedTitle,
            description: cleanedDesc,
            affectedStaff: cleanedStaff,
            steps: recommendation.steps || [],
            expectedImpact: recommendation.expectedImpact || '',
            priority: recommendation.priority || 'medium',
            status: 'pending',
            createdAt: serverTimestamp(),
            createdBy: 'superadmin'
          });
          loadPerformanceTasks();
          toast.success('Recommendation converted into an active improvement task.');
          setTimeout(() => {
            scrollToTask(docRef.id);
          }, 350);
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
        variant: 'success'
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
      <div className="performance-monitor">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <OverviewCardsSkeleton count={4} />
          <AnalyticsChartSkeleton height={340} />
          <DataTableSkeleton columns={6} rows={5} hasPagination={false} />
        </div>
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

          const isStaffExpanded = Boolean(expandedDeptStaff[dept.office]);

          return (
            <div key={dept.office} className={`dept-card dept-${dept.status} ${isStaffExpanded ? 'expanded' : ''}`}>
              {/* Card Header: Avatar Icon, Name, Staff Count & Status Badges */}
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

                <div className="dept-header-badges">
                  <div className="dept-efficiency-score-pill" title={`Average Staff Efficiency Score for ${dept.office}: ${dept.avgEfficiencyScore}%`}>
                    <span className="eff-pill-label">Efficiency</span>
                    <span className="eff-pill-score">{dept.avgEfficiencyScore}%</span>
                  </div>
                  <div className={`dept-health-pill ${dept.status}`}>
                    <span className="health-pill-dot" />
                    <span>{dept.status.replace('-', ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Resolution Health Bar, On-Time Rate & Capacity Load */}
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
                <div className="dept-capacity-row">
                  <span className="capacity-label">Workload Load:</span>
                  <span className={`capacity-val ${dept.capacityUtilization > 85 ? 'heavy' : dept.capacityUtilization > 50 ? 'moderate' : 'optimal'}`}>
                    {dept.capacityUtilization}% capacity ({dept.capacityUtilization > 85 ? 'High Load' : dept.capacityUtilization > 50 ? 'Moderate' : 'Optimal'})
                  </span>
                </div>
              </div>

              {/* Comprehensive 6-Metric Grid */}
              <div className="dept-metrics-grid comprehensive">
                <div className="dept-metric-cell">
                  <span className="metric-val">{dept.totalTickets ?? (dept.activeTickets + (dept.resolvedTickets || 0))}</span>
                  <span className="metric-lbl">Total Volume</span>
                </div>
                <div className="dept-metric-cell">
                  <span className="metric-val">{dept.activeTickets}</span>
                  <span className="metric-lbl">Active</span>
                </div>
                <div className="dept-metric-cell success-cell">
                  <span className="metric-val">{dept.resolvedTickets ?? 0}</span>
                  <span className="metric-lbl">Resolved</span>
                </div>
                <div className={`dept-metric-cell ${dept.atRiskTickets > 0 ? 'warning-cell' : ''}`}>
                  <span className="metric-val">{dept.atRiskTickets}</span>
                  <span className="metric-lbl">At Risk</span>
                </div>
                <div className={`dept-metric-cell ${dept.overdueTickets > 0 ? 'critical-cell' : ''}`}>
                  <span className="metric-val">{dept.overdueTickets}</span>
                  <span className="metric-lbl">Overdue</span>
                </div>
                <div className="dept-metric-cell info-cell">
                  <span className="metric-val">{dept.avgTurnaround || 'N/A'}</span>
                  <span className="metric-lbl">Avg Turnaround</span>
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

              {/* Staff Efficiency Score Accordion Toggle & Drawer */}
              <div className="dept-staff-section">
                <button
                  type="button"
                  className={`dept-staff-toggle-btn ${isStaffExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleDeptStaff(dept.office)}
                  aria-expanded={isStaffExpanded}
                  title="Click arrow to view the Efficiency Score of each staff in this department"
                >
                  <div className="staff-toggle-left">
                    <FaChartLine className="staff-toggle-icon" />
                    <span className="staff-toggle-title">Staff Efficiency Breakdown</span>
                    <span className="staff-toggle-pill">{dept.staffList?.length || 0} Staff</span>
                  </div>
                  <div className="staff-toggle-right">
                    <span className="staff-toggle-action-text">{isStaffExpanded ? 'Hide Staff' : 'View Scores'}</span>
                    <FaChevronDown className={`staff-toggle-arrow ${isStaffExpanded ? 'rotate-open' : ''}`} />
                  </div>
                </button>

                {/* Collapsible Staff Efficiency Score List */}
                {isStaffExpanded && (
                  <div className="dept-staff-drawer">
                    {dept.staffList && dept.staffList.length > 0 ? (
                      <div className="dept-staff-list">
                        {dept.staffList.map((staff, sIdx) => {
                          const eff = staff.efficiency || {};
                          const initials = (staff.name || staff.fullName || 'Staff')
                            .split(' ')
                            .filter(Boolean)
                            .map(n => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();
                          return (
                            <div key={staff.id || staff.uid || sIdx} className={`dept-staff-card ${eff.score <= 60 ? 'score-dropped-warning' : ''}`}>
                              <div className="staff-card-main-row">
                                <div className="staff-info-col">
                                  <div className={`staff-avatar-initials tier-${eff.tier || 'good'}`}>
                                    {initials}
                                  </div>
                                  <div className="staff-meta-col">
                                    <span className="staff-full-name">{staff.name || staff.fullName}</span>
                                    <span className="staff-sub-text">{staff.email || staff.role || 'Staff Member'}</span>
                                    {eff.score <= 60 && (
                                      <span className="staff-drop-alert-tag">
                                        <FaExclamationTriangle /> Dropped to {eff.score}% (Critical)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="staff-score-col">
                                  <div className={`staff-efficiency-pill tier-${eff.tier || 'good'}`}>
                                    <span className="eff-score-number">{eff.score ?? 100}%</span>
                                    <span className="eff-tier-badge">{eff.tierLabel || 'Good Standing'}</span>
                                  </div>
                                  {eff.score <= 60 && (
                                    <button
                                      type="button"
                                      className="btn-send-eff-warning"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sendStaffEfficiencyWarning(staff, eff.score);
                                      }}
                                      title={`Send efficiency score warning alert to ${staff.name || staff.fullName}`}
                                    >
                                      <FaExclamationTriangle />
                                      <span>Send Warning</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Visual Efficiency Progress Track */}
                              <div className="staff-eff-track">
                                <div 
                                  className={`staff-eff-fill tier-${eff.tier || 'good'}`} 
                                  style={{ width: `${Math.max(5, eff.score ?? 100)}%` }} 
                                />
                              </div>

                              {/* Staff Micro Metrics */}
                              <div className="staff-micro-stats">
                                <div className="micro-stat-item">
                                  <span className="micro-stat-val">{eff.activeCount ?? 0}</span>
                                  <span className="micro-stat-lbl">Active</span>
                                </div>
                                <div className={`micro-stat-item ${eff.overdueCount > 0 ? 'overdue-alert' : ''}`}>
                                  <span className="micro-stat-val">{eff.overdueCount ?? 0}</span>
                                  <span className="micro-stat-lbl">Overdue</span>
                                </div>
                                <div className="micro-stat-item">
                                  <span className="micro-stat-val">{eff.resolvedCount ?? 0}</span>
                                  <span className="micro-stat-lbl">Resolved</span>
                                </div>
                                <div className="micro-stat-item">
                                  <span className="micro-stat-val">{eff.onTimeRate ?? 100}%</span>
                                  <span className="micro-stat-lbl">On-Time</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="dept-staff-empty">
                        <FaUsers className="empty-staff-icon" />
                        <p>No staff members currently assigned to {dept.office} Office.</p>
                      </div>
                    )}
                  </div>
                )}
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
          <div className="section-actions ai-header-actions">
            {performanceTasks.length > 0 && (
              <button 
                type="button"
                className="btn-jump-tasks"
                onClick={() => {
                  const el = document.getElementById('performance-tasks-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                title="Jump to Performance Improvement Tasks"
              >
                <FaClipboardList className="btn-icon" />
                <span>{performanceTasks.length} {performanceTasks.length === 1 ? 'Action Task' : 'Action Tasks'}</span>
                <FaArrowRight className="jump-arrow" />
              </button>
            )}
            {aiInsights.executiveSummary && (
              <button 
                className="btn-ai-refresh" 
                onClick={refreshAIInsights}
                disabled={aiInsights.loading}
              >
                <FaBrain className="btn-icon" />
                <span>{aiInsights.loading ? 'Analyzing...' : 'Refresh AI Analysis'}</span>
              </button>
            )}
          </div>
        </div>

        {aiInsights.error && (
          <div className="ai-error">
            <FaExclamationTriangle />
            <span>{aiInsights.error}</span>
          </div>
        )}

        {aiInsights.loading && (
          <div style={{ padding: '20px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border-soft)' }}>
            <OverviewCardsSkeleton count={3} />
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
                  <h4>Executive Briefing</h4>
                </div>
                <span className="summary-meta-pill">Key Operational Diagnosis</span>
              </div>
              
              {(() => {
                const bullets = parseExecutiveBullets(aiInsights.executiveSummary);
                if (bullets.length > 0) {
                  return (
                    <div className="summary-bullets-grid">
                      {bullets.map((b, idx) => (
                        <div key={idx} className={`summary-bullet-item bullet-${b.type}`}>
                          <span className={`bullet-icon-wrapper bullet-${b.type}`}>
                            {b.type === 'status' && <FaCheckCircle />}
                            {b.type === 'bottleneck' && <FaExclamationTriangle />}
                            {b.type === 'action' && <FaBolt />}
                            {b.type === 'general' && <FaArrowRight />}
                          </span>
                          <div className="bullet-body">
                            <span className="bullet-label">{b.label}</span>
                            <p className="bullet-text">{b.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                return <p className="summary-text">{aiInsights.executiveSummary}</p>;
              })()}
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
                      <h5>{cleanTitleText(anomaly.title, anomaly)}</h5>
                      <p className="anomaly-description">{cleanDescriptionText(anomaly.description, anomaly)}</p>
                      <div className="anomaly-footer compact-footer">
                        <div className="anomaly-chip area-chip">
                          <FaBuilding className="chip-icon" />
                          <span className="chip-label">Affected:</span>
                          <span className="chip-val">
                            {(() => {
                              const raw = (anomaly.affectedArea || '').trim();
                              const dept = detectItemDepartment(anomaly) || 'Registrar';
                              const matchedStaff = allStaffData.find(s => s.name?.toLowerCase() === raw.toLowerCase());
                              if (matchedStaff) {
                                const sDept = (matchedStaff.department || '').toLowerCase();
                                if (sDept !== dept.toLowerCase()) return dept;
                                return matchedStaff.name;
                              }
                              const isDept = ['Finance', 'Guidance', 'Library', 'Registrar'].find(d => d.toLowerCase() === raw.toLowerCase());
                              return isDept || dept;
                            })()}
                          </span>
                        </div>
                        <div className="anomaly-chip action-chip">
                          <FaArrowRight className="chip-icon" />
                          <span className="chip-label">Action:</span>
                          <span className="chip-val">{cleanDescriptionText(anomaly.recommendation, anomaly)}</span>
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
                  {aiInsights.smartRecommendations.map((rec, index) => {
                    const isExpanded = !!expandedRecSteps[index];
                    const matchingTask = findMatchingTask(rec);
                    return (
                      <div key={index} className={`smart-rec-card priority-${rec.priority} ${matchingTask ? 'has-active-task' : ''}`}>
                        <div className="smart-rec-header">
                          <div className="smart-rec-header-badges">
                            <span className={`priority-badge ${rec.priority}`}>
                              <span className="priority-dot"></span>
                              {(rec.priority || 'NORMAL').toUpperCase()} PRIORITY
                            </span>
                            <span className="rec-type">{rec.type?.replace(/_/g, ' ')}</span>
                          </div>
                          {matchingTask && (
                            <span className={`rec-task-status-pill status-${matchingTask.status}`}>
                              {matchingTask.status === 'completed' && <FaCheckCircle className="status-pill-icon" />}
                              {matchingTask.status === 'in_progress' && <FaClock className="status-pill-icon" />}
                              {matchingTask.status === 'pending' && <FaClipboardList className="status-pill-icon" />}
                              <span>
                                {matchingTask.status === 'completed' ? 'Task Completed' : 
                                 matchingTask.status === 'in_progress' ? 'Task In Progress' : 'Task Active'}
                              </span>
                            </span>
                          )}
                        </div>
                        <h5>{cleanTitleText(rec.title, rec)}</h5>
                        <p className="smart-rec-description">{cleanDescriptionText(rec.description, rec)}</p>
                        
                        {/* Compact Metadata Row */}
                        {(() => {
                          const validStaff = getCleanedStaffList(rec.affectedStaff, rec);
                          if (validStaff.length === 0 && !rec.expectedImpact) return null;
                          const hasDeptOnly = validStaff.some(s => ['Finance', 'Guidance', 'Library', 'Registrar'].includes(s));
                          return (
                            <div className="rec-compact-meta-row">
                              {validStaff.length > 0 && (
                                <div className="rec-staff-inline">
                                  <span className="meta-inline-label">
                                    {hasDeptOnly ? (
                                      <><FaBuilding className="meta-icon" /> Target:</>
                                    ) : (
                                      <><FaUsers className="meta-icon" /> Staff:</>
                                    )}
                                  </span>
                                  <div className="staff-tags-container compact">
                                    {validStaff.map((staffName, idx) => renderTargetChip(staffName, idx))}
                                  </div>
                                </div>
                              )}
                              
                              {rec.expectedImpact && (
                                <span className="rec-impact-pill">
                                  <FaChartLine className="impact-pill-icon" />
                                  <span className="impact-pill-text">{rec.expectedImpact}</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        
                        {/* Collapsible Steps Dropdown */}
                        {rec.steps && rec.steps.length > 0 && isExpanded && (
                          <div className="rec-steps-box collapsible-open">
                            <div className="rec-meta-label">
                              <FaClipboardCheck className="meta-icon" /> Implementation Steps
                            </div>
                            <ol className="rec-steps-list">
                              {rec.steps.map((step, i) => (
                                <li key={i} className="rec-step-item">
                                  <span className="step-num">{i + 1}</span>
                                  <span className="step-text">{cleanDescriptionText(step, rec)}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        
                        <div className="rec-card-footer">
                          {rec.steps && rec.steps.length > 0 && (
                            <button 
                              type="button" 
                              className="rec-toggle-steps-btn" 
                              onClick={() => toggleRecSteps(index)}
                              aria-expanded={isExpanded}
                            >
                              <span>{isExpanded ? 'Hide Steps' : 'View Steps'}</span>
                              <FaChevronDown className={`toggle-chevron ${isExpanded ? 'rotated' : ''}`} />
                            </button>
                          )}
                          {matchingTask ? (
                            <button 
                              type="button"
                              className="rec-view-task-btn"
                              onClick={() => scrollToTask(matchingTask.id)}
                              title="Scroll to tracked task"
                            >
                              <FaClipboardList className="btn-icon" />
                              <span>View Tracked Task</span>
                              <FaArrowRight className="arrow-icon" />
                            </button>
                          ) : (
                            <button 
                              className="rec-apply-btn"
                              onClick={() => handleApplyRecommendation(rec)}
                            >
                              Apply Recommendation
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

      {/* Connected Action Board: Performance Improvement Tasks */}
      <div id="performance-tasks-section" className="performance-tasks-section">
        <div className="section-header performance-tasks-header">
          <div className="tasks-header-left">
            <h3>
              <span className="tasks-header-icon-wrapper">
                <FaClipboardList />
              </span>
              Performance Improvement Tasks
            </h3>
            <p className="tasks-subtitle">Operational action tracking connected directly to AI Strategic Recommendations</p>
          </div>
          <div className="tasks-header-right">
            <span className="task-count-pill">
              <FaClipboardCheck className="count-icon" />
              {performanceTasks.length} {performanceTasks.length === 1 ? 'Tracked Action' : 'Tracked Actions'}
            </span>
          </div>
        </div>

        {performanceTasks.length === 0 ? (
          <div className="tasks-empty-state">
            <div className="tasks-empty-icon-wrapper">
              <FaClipboardList />
            </div>
            <h5>No Active Improvement Tasks</h5>
            <p>
              Click <strong>"Apply Recommendation"</strong> on any AI Strategic Recommendation above to convert it into a tracked operational task.
            </p>
          </div>
        ) : (
          <div className="tasks-grid">
            {performanceTasks.map(task => {
              const isCompleted = task.status === 'completed';
              const isInProgress = task.status === 'in_progress';
              const priorityClass = task.priority || 'medium';
              const isExpanded = !!expandedTaskSteps[task.id];

              return (
                <div 
                  key={task.id} 
                  id={`task-card-${task.id}`}
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
                    <h4 className="task-title">{cleanTitleText(task.title, task)}</h4>
                    <p className="task-description">{cleanDescriptionText(task.description, task)}</p>
                    
                    {/* Compact Inline Metadata Row (Staff + Impact) */}
                    {(() => {
                      const validStaff = getCleanedStaffList(task.affectedStaff, task);
                      if (validStaff.length === 0 && !task.expectedImpact) return null;
                      const hasDeptOnly = validStaff.some(s => ['Finance', 'Guidance', 'Library', 'Registrar'].includes(s));
                      return (
                        <div className="task-compact-meta-row">
                          {validStaff.length > 0 && (
                            <div className="task-staff-inline">
                              <span className="task-meta-inline-label">
                                {hasDeptOnly ? (
                                  <><FaBuilding className="meta-icon" /> Target:</>
                                ) : (
                                  <><FaUsers className="meta-icon" /> Staff:</>
                                )}
                              </span>
                              <div className="staff-tags-container compact">
                                {validStaff.map((staffName, idx) => renderTargetChip(staffName, idx))}
                              </div>
                            </div>
                          )}
                          
                          {task.expectedImpact && (
                            <span className="task-impact-pill">
                              <FaChartLine className="impact-pill-icon" />
                              <span className="impact-pill-text">{task.expectedImpact}</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Collapsible Steps Checklist */}
                    {task.steps && task.steps.length > 0 && isExpanded && (
                      <div className="task-steps-box collapsible-open">
                        <div className="task-meta-label">
                          <FaClipboardCheck className="meta-icon" /> Implementation Steps
                        </div>
                        <ol className="task-steps-timeline">
                          {task.steps.map((step, i) => (
                            <li key={i} className="task-step-item">
                              <span className="step-number">{i + 1}</span>
                              <span className="step-text">{cleanDescriptionText(step, task)}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>

                  <div className="task-card-footer">
                    <div className="task-footer-left">
                      {task.steps && task.steps.length > 0 && (
                        <button 
                          type="button" 
                          className="task-toggle-steps-btn" 
                          onClick={() => toggleTaskSteps(task.id)}
                          aria-expanded={isExpanded}
                        >
                          <FaClipboardList className="toggle-icon" />
                          <span>{isExpanded ? 'Hide Steps' : `View Steps (${task.steps.length})`}</span>
                          <FaChevronDown className={`toggle-chevron ${isExpanded ? 'rotated' : ''}`} />
                        </button>
                      )}
                      <div className="task-date-info">
                        <FaClock className="date-icon" />
                        <span>
                          Created {task.createdAt?.toDate ? task.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                        </span>
                      </div>
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
        )}
      </div>

      {/* Workload Rebalancing Suggestions (Heuristic fallback when AI recommendations are not active) */}
      {recommendations.length > 0 && (!aiInsights.smartRecommendations || aiInsights.smartRecommendations.length === 0) && (
        <>
          <div className="section-header">
            <h3>
              <FaExchangeAlt /> Workload Rebalancing Suggestions
            </h3>
            <p>Suggested rule-based reassignments to balance queue distribution</p>
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
