import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  FaCalendarAlt,
  FaBuilding,
  FaUserTie,
  FaSearch,
  FaBrain,
  FaChartLine,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaTimes,
  FaPrint,
  FaShieldAlt,
  FaHistory,
  FaRedo,
  FaArrowRight,
  FaExchangeAlt,
  FaClock,
  FaCheckDouble,
  FaDollarSign,
  FaGraduationCap,
  FaBook,
  FaUserFriends,
  FaChevronDown,
  FaCheck,
  FaDownload
} from 'react-icons/fa';
import { calculateStaffMonthlyBehavior } from '../utils/performanceAnalytics';
import { analyzeMonthlyStaffBehaviorWithAI } from '../utils/groqService';
import { OverviewCardsSkeleton, DataTableSkeleton } from './common/Skeleton';
import ReassignTicketsModal from './ReassignTicketsModal';
import '../styles/PerformanceMonitor.css';

const PerformanceMonitor = ({ initialDept = 'all', initialSearchQuery = '' }) => {
  const [selectedDept, setSelectedDept] = useState(initialDept || 'all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  
  const [loading, setLoading] = useState(true);

  // Sync when parent provides new initialDept or searchQuery
  useEffect(() => {
    if (initialDept) {
      setSelectedDept(initialDept);
    }
  }, [initialDept]);

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);
  const [allRequests, setAllRequests] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [allFeedbacks, setAllFeedbacks] = useState([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const monthDropdownRef = useRef(null);
  const autoOpenedTargetRef = useRef('');
  
  // Selected staff diagnostic modal state
  const [activeStaffDiagnostic, setActiveStaffDiagnostic] = useState(null);
  const [analyzingStaffId, setAnalyzingStaffId] = useState(null);
  const [aiCache, setAiCache] = useState({});

  // Reassign Tickets Modal state
  const [reassignModalState, setReassignModalState] = useState({
    isOpen: false,
    staffMember: null
  });

  // Available staff list with active ticket counts for reassignment target selection
  const allStaffForReassign = useMemo(() => {
    return allStaff.map(s => {
      const staffName = (s.name || '').trim().toLowerCase();
      const activeCount = allRequests.filter(r => {
        const assigned = (r.assignedTo || r.claimedBy || '').trim().toLowerCase();
        const status = (r.status || '').trim().toLowerCase();
        return assigned === staffName && !['resolved', 'completed', 'cancelled', 'rejected'].includes(status);
      }).length;

      return {
        id: s.id || s.firestoreId,
        firestoreId: s.firestoreId || s.id,
        name: s.name,
        department: s.department || s.office || '',
        office: s.office || s.department || '',
        activeTickets: activeCount
      };
    });
  }, [allStaff, allRequests]);

  const handleOpenReassignModal = useCallback((profileOrDiagnostic) => {
    if (!profileOrDiagnostic) return;
    const staffObj = profileOrDiagnostic.staff || profileOrDiagnostic;
    const staffName = (staffObj.name || '').trim().toLowerCase();
    const activeCount = allRequests.filter(r => {
      const assigned = (r.assignedTo || r.claimedBy || '').trim().toLowerCase();
      const status = (r.status || '').trim().toLowerCase();
      return assigned === staffName && !['resolved', 'completed', 'cancelled', 'rejected'].includes(status);
    }).length;

    setReassignModalState({
      isOpen: true,
      staffMember: {
        id: staffObj.id || staffObj.firestoreId,
        firestoreId: staffObj.firestoreId || staffObj.id,
        name: staffObj.name,
        department: staffObj.department || staffObj.office || '',
        office: staffObj.office || staffObj.department || '',
        activeTickets: activeCount
      }
    });
  }, [allRequests]);

  // Dynamic month options incorporating both rolling calendar and actual request dates
  const monthOptions = useMemo(() => {
    const map = new Map();
    const now = new Date();

    // 1. Seed past 6 months
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      map.set(key, {
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        date: d,
        key,
        count: 0
      });
    }

    // 2. Scan allRequests for existing activity and count tickets per month
    allRequests.forEach(r => {
      const cDate = r.createdAt?.toDate ? r.createdAt.toDate() : (r.createdAt ? new Date(r.createdAt) : null);
      if (cDate && !isNaN(cDate.getTime())) {
        const d = new Date(cDate.getFullYear(), cDate.getMonth(), 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!map.has(key)) {
          map.set(key, {
            label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            date: d,
            key,
            count: 0
          });
        }
        map.get(key).count += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allRequests]);

  // Auto-select latest month that actually contains requests if current month has zero
  useEffect(() => {
    if (!monthOptions.length) return;
    if (!selectedMonthKey) {
      const bestMonth = monthOptions.find(m => m.count > 0) || monthOptions[0];
      setSelectedMonthKey(bestMonth.key);
    }
  }, [monthOptions, selectedMonthKey]);

  // Active selected Date object
  const currentMonthDate = useMemo(() => {
    const matched = monthOptions.find(o => o.key === selectedMonthKey);
    return matched ? matched.date : new Date();
  }, [selectedMonthKey, monthOptions]);

  const selectedMonthOption = useMemo(() => {
    return monthOptions.find(o => o.key === selectedMonthKey) || monthOptions[0] || null;
  }, [selectedMonthKey, monthOptions]);

  // Close month dropdown on outside click or escape
  useEffect(() => {
    if (!monthDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target)) {
        setMonthDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMonthDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [monthDropdownOpen]);

  // Initial Fetch of raw collections
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [requestsSnap, staffSnap, feedbackSnap] = await Promise.allSettled([
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'staff')),
        getDocs(collection(db, 'feedback'))
      ]);

      const requests = requestsSnap.status === 'fulfilled'
        ? requestsSnap.value.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        : [];
      const staffList = staffSnap.status === 'fulfilled'
        ? staffSnap.value.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        : [];
      const feedbacks = feedbackSnap.status === 'fulfilled'
        ? feedbackSnap.value.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        : [];

      setAllRequests(requests);
      setAllStaff(staffList);
      setAllFeedbacks(feedbacks);
    } catch (err) {
      console.error('[PerformanceMonitor] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute 4-week monthly metrics for all staff
  const staffMonthlyProfiles = useMemo(() => {
    if (!allStaff.length) return [];

    return allStaff.map(staff => {
      const baseMetrics = calculateStaffMonthlyBehavior(staff, allRequests, currentMonthDate, allFeedbacks);
      const cachedAi = aiCache[staff.id];
      if (cachedAi) {
        return {
          ...baseMetrics,
          ...cachedAi
        };
      }
      return baseMetrics;
    }).filter(Boolean);
  }, [allStaff, allRequests, currentMonthDate, allFeedbacks, aiCache]);

  // Filtered by department and search
  const filteredProfiles = useMemo(() => {
    return staffMonthlyProfiles.filter(profile => {
      const dept = (profile.staff.department || '').toLowerCase();
      if (selectedDept !== 'all' && dept !== selectedDept.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatches = profile.staff.name.toLowerCase().includes(query);
        const deptMatches = dept.includes(query);
        if (!nameMatches && !deptMatches) return false;
      }
      return true;
    });
  }, [staffMonthlyProfiles, selectedDept, searchQuery]);

  // Primary departments in Academia De San Jose
  const DEPARTMENTS = useMemo(() => [
    { id: 'Finance', label: 'Finance Office', icon: FaDollarSign, short: 'Finance' },
    { id: 'Registrar', label: 'Registrar Office', icon: FaGraduationCap, short: 'Registrar' },
    { id: 'Library', label: 'Library Office', icon: FaBook, short: 'Library' },
    { id: 'Guidance', label: 'Guidance Office', icon: FaUserFriends, short: 'Guidance' }
  ], []);

  // Department counts for quick tabs
  const departmentCounts = useMemo(() => {
    const counts = { all: staffMonthlyProfiles.length };
    DEPARTMENTS.forEach(d => {
      counts[d.id] = staffMonthlyProfiles.filter(p => {
        const pDept = (p.staff.department || '').toLowerCase();
        return pDept === d.id.toLowerCase() || pDept.includes(d.short.toLowerCase());
      }).length;
    });
    return counts;
  }, [staffMonthlyProfiles, DEPARTMENTS]);

  // Group filtered profiles into department sections
  const departmentSections = useMemo(() => {
    const list = [];

    DEPARTMENTS.forEach(dept => {
      if (selectedDept !== 'all' && selectedDept.toLowerCase() !== dept.id.toLowerCase()) {
        return;
      }

      const staffInDept = filteredProfiles.filter(p => {
        const pDept = (p.staff.department || '').toLowerCase();
        return pDept === dept.id.toLowerCase() || pDept.includes(dept.short.toLowerCase());
      });

      const totalAssigned = staffInDept.reduce((sum, s) => sum + s.totals.totalAssigned, 0);
      const totalResolved = staffInDept.reduce((sum, s) => sum + s.totals.totalResolved, 0);
      const avgClearance = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 100;
      const warningCount = staffInDept.filter(s => s.warningEvaluation.status !== 'good').length;

      list.push({
        ...dept,
        staffList: staffInDept,
        totalAssigned,
        totalResolved,
        avgClearance,
        warningCount
      });
    });

    // Handle any staff belonging to non-standard department names
    const otherStaff = filteredProfiles.filter(p => {
      const pDept = (p.staff.department || '').toLowerCase();
      return !DEPARTMENTS.some(d => pDept === d.id.toLowerCase() || pDept.includes(d.short.toLowerCase()));
    });

    if (otherStaff.length > 0 && (selectedDept === 'all' || selectedDept.toLowerCase() === 'other')) {
      list.push({
        id: 'Other',
        label: 'General / Other Staff',
        icon: FaBuilding,
        short: 'Other',
        staffList: otherStaff,
        totalAssigned: otherStaff.reduce((sum, s) => sum + s.totals.totalAssigned, 0),
        totalResolved: otherStaff.reduce((sum, s) => sum + s.totals.totalResolved, 0),
        avgClearance: 100,
        warningCount: otherStaff.filter(s => s.warningEvaluation.status !== 'good').length
      });
    }

    return list;
  }, [filteredProfiles, selectedDept, DEPARTMENTS]);

  // Aggregate monthly overview numbers
  const summaryStats = useMemo(() => {
    const totalStaffCount = staffMonthlyProfiles.length;
    let goodCount = 0;
    let warning1Count = 0; // 1st Warning: NTE
    let warning2Count = 0; // 2nd Warning: Verbal Reprimand
    let warning3Count = 0; // 3rd Warning: Notice of Suspension
    let warning4Count = 0; // 4th Warning: Notice for Termination
    let totalAssignedMonth = 0;
    let totalResolvedMonth = 0;

    staffMonthlyProfiles.forEach(p => {
      const status = p.warningEvaluation.status;
      if (status === 'good') goodCount++;
      else if (status === 'warning_1_nte' || status === 'advisory') warning1Count++;
      else if (status === 'warning_2_verbal' || status === 'formal_review') warning2Count++;
      else if (status === 'warning_3_suspension' || status === 'nte_justified') warning3Count++;
      else if (status === 'warning_4_termination') warning4Count++;

      totalAssignedMonth += p.totals.totalAssigned;
      totalResolvedMonth += p.totals.totalResolved;
    });

    const monthClearanceRate = totalAssignedMonth > 0
      ? Math.round((totalResolvedMonth / totalAssignedMonth) * 100)
      : 100;

    return {
      totalStaffCount,
      goodCount,
      warning1Count,
      warning2Count,
      warning3Count,
      warning4Count,
      totalAssignedMonth,
      totalResolvedMonth,
      monthClearanceRate
    };
  }, [staffMonthlyProfiles]);

  // Open staff diagnostic and trigger deep AI analysis if not already cached
  const handleInspectStaff = async (profile) => {
    setActiveStaffDiagnostic(profile);
    const staffId = profile.staff.id;

    if (!profile.isAIEnhanced && !aiCache[staffId]) {
      try {
        setAnalyzingStaffId(staffId);
        const enhanced = await analyzeMonthlyStaffBehaviorWithAI(profile);
        if (enhanced) {
          setAiCache(prev => ({
            ...prev,
            [staffId]: enhanced
          }));
          setActiveStaffDiagnostic(enhanced);
        }
      } catch (err) {
        console.warn('AI analysis failed:', err);
      } finally {
        setAnalyzingStaffId(null);
      }
    }
  };

  const handlePrintDiagnostic = () => {
    window.print();
  };

  // Export comprehensive monthly performance, warnings, and 4-week trajectory data to CSV
  const exportPerformanceToCSV = useCallback(() => {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const monthName = selectedMonthOption ? selectedMonthOption.label : 'Current Month';
    const deptFilterName = selectedDept === 'all' ? 'All Departments' : selectedDept;

    let csvContent = '';

    // Report Header & Audit Metadata
    csvContent += 'ACADEMIA DE SAN JOSE - STAFF PERFORMANCE & BEHAVIORAL MONITOR REPORT\n';
    csvContent += `Generated: "${currentDate}"\n`;
    csvContent += `Observation Period: "${monthName} (4-Week Monthly Evaluation Window)"\n`;
    csvContent += `Department Scope: "${deptFilterName}"\n`;
    if (searchQuery.trim()) {
      csvContent += `Search Filter: "${searchQuery.trim()}"\n`;
    }
    csvContent += '\n';

    // 1. Executive Summary
    csvContent += '1. EXECUTIVE PERFORMANCE SUMMARY\n';
    csvContent += 'Metric,Value\n';
    csvContent += `Observation Period,"${monthName}"\n`;
    csvContent += `Monitored Staff Count,${summaryStats.totalStaffCount}\n`;
    csvContent += `Total Assigned Tickets in Cycle,${summaryStats.totalAssignedMonth}\n`;
    csvContent += `Total Resolved Tickets in Cycle,${summaryStats.totalResolvedMonth}\n`;
    csvContent += `Overall Monthly Clearance Rate,${summaryStats.monthClearanceRate}%\n`;
    csvContent += `Good Standing (Healthy Throughput),${summaryStats.goodCount}\n`;
    csvContent += `1st Warning: Notice to Explain (NTE),${summaryStats.warning1Count}\n`;
    csvContent += `2nd Warning: Verbal Reprimand,${summaryStats.warning2Count}\n`;
    csvContent += `3rd Warning: Notice of Suspension,${summaryStats.warning3Count}\n`;
    csvContent += `4th Warning: Notice for Termination,${summaryStats.warning4Count}\n`;
    csvContent += '\n';

    // 2. Department Health Breakdown
    csvContent += '2. DEPARTMENT HEALTH & WORKLOAD BREAKDOWN\n';
    csvContent += 'Department,Staff Count,Assigned Tickets,Resolved Tickets,Clearance Rate %,Staff with Warnings\n';
    departmentSections.forEach(dept => {
      csvContent += `"${dept.label}",${dept.staffList.length},${dept.totalAssigned},${dept.totalResolved},${dept.avgClearance}%,${dept.warningCount}\n`;
    });
    csvContent += '\n';

    // 3. Staff Evaluation & Warning Audit
    csvContent += '3. INDIVIDUAL STAFF PERFORMANCE & WARNING AUDIT\n';
    csvContent += 'Staff Name,Email,Department,Role,Assigned,Resolved,Clearance Rate %,Avg Resolution Time,Initial Rollover,Rollover to Next Month,Behavioral Archetype,Warning Level,NTE Required,Evaluation Reason\n';
    filteredProfiles.forEach(p => {
      const s = p.staff || {};
      const t = p.totals || {};
      const arch = p.archetype || {};
      const w = p.warningEvaluation || {};
      const avgResText = (t.avgMonthlyResolutionHours || 0) > 0 ? `${t.avgMonthlyResolutionHours} hrs` : 'N/A';
      const cleanReason = (w.reason || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
      const cleanName = (s.name || s.fullName || 'N/A').replace(/"/g, '""');
      const cleanEmail = (s.email || 'N/A').replace(/"/g, '""');
      const cleanDept = (s.department || s.office || 'N/A').replace(/"/g, '""');
      const cleanRole = (s.role || 'Staff').replace(/"/g, '""');
      const cleanArch = (arch.title || p.trajectory?.archetype || 'Steady Pacer').replace(/"/g, '""');
      const cleanWarning = (w.label || w.shortLabel || 'Good Standing').replace(/"/g, '""');
      const initialRollover = p.weeks?.[0]?.rollover || 0;
      const netRollover = t.netRolloverNextMonth || 0;

      csvContent += `"${cleanName}","${cleanEmail}","${cleanDept}","${cleanRole}",${t.totalAssigned || 0},${t.totalResolved || 0},${t.overallClearanceRate || 0}%,"${avgResText}",${initialRollover},${netRollover},"${cleanArch}","${cleanWarning}","${w.nteRecommended ? 'YES' : 'NO'}","${cleanReason}"\n`;
    });
    csvContent += '\n';

    // 4. 4-Week Weekly Performance Breakdown
    csvContent += '4. WEEKLY 4-WEEK PERFORMANCE TRAJECTORY (W1 TO W4)\n';
    csvContent += 'Staff Name,Department,Week,Days Window,Assigned,Resolved,Rollover In,Total Workload,Unresolved Left,Clearance Rate %,Avg Resolution (hrs),Pickup Latency (hrs),Student Rating\n';
    filteredProfiles.forEach(p => {
      const s = p.staff || {};
      const cleanName = (s.name || s.fullName || 'N/A').replace(/"/g, '""');
      const cleanDept = (s.department || s.office || 'N/A').replace(/"/g, '""');
      if (p.weeks && p.weeks.length > 0) {
        p.weeks.forEach(wk => {
          const ratingText = wk.avgSatisfaction !== null && wk.avgSatisfaction !== undefined ? `${wk.avgSatisfaction} Stars` : 'No rating';
          csvContent += `"${cleanName}","${cleanDept}","Week ${wk.weekNum}","${wk.label}",${wk.assigned},${wk.resolved},${wk.rollover},${wk.totalWorkload},${wk.unresolvedAtEnd},${wk.clearanceRate}%,${wk.avgResolutionHours},${wk.avgPickupLatencyHours},"${ratingText}"\n`;
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const safeMonth = (selectedMonthOption ? selectedMonthOption.label : 'monthly').toLowerCase().replace(/\s+/g, '_');
    const filename = `performance_report_${safeMonth}_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [
    selectedMonthOption,
    selectedDept,
    searchQuery,
    summaryStats,
    departmentSections,
    filteredProfiles
  ]);

  // Synchronize department when passed from Overview & Reports
  useEffect(() => {
    if (initialDept) {
      setSelectedDept(initialDept);
    }
  }, [initialDept]);

  // Synchronize search query when passed from Overview & Reports
  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
      autoOpenedTargetRef.current = '';
    }
  }, [initialSearchQuery]);

  // Auto-open diagnostic modal if directed from Overview & Reports staff card
  useEffect(() => {
    if (!initialSearchQuery || loading || !staffMonthlyProfiles.length) return;
    if (autoOpenedTargetRef.current === initialSearchQuery) return;

    const query = initialSearchQuery.trim().toLowerCase();
    const matchedProfile = staffMonthlyProfiles.find(p => 
      p.staff.name.toLowerCase() === query || 
      p.staff.name.toLowerCase().includes(query) ||
      p.staff.id.toLowerCase() === query
    );

    if (matchedProfile) {
      autoOpenedTargetRef.current = initialSearchQuery;
      handleInspectStaff(matchedProfile);
    }
  }, [initialSearchQuery, staffMonthlyProfiles, loading]);

  if (loading) {
    return (
      <div className="performance-monitor-container">
        <OverviewCardsSkeleton count={6} className="pm-skeleton-cards" />
        <div style={{ marginTop: '24px' }}>
          <DataTableSkeleton rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="performance-monitor-container">
      {/* Top Header & Period Control */}
      <div className="pm-header-bar">
        <div>
          <h2 className="pm-title">Monthly Staff Performance & Behavioral Monitor</h2>
          <p className="pm-subtitle">
            Observes 4-week performance trajectories to identify behavioral rhythms, volume shocks vs. chronic backlogs, and predict next-month capacity.
          </p>
        </div>

        <div className="pm-controls-cluster">
          {/* Custom Theme Month Picker Dropdown */}
          <div className="pm-month-picker-wrap" ref={monthDropdownRef}>
            <button
              type="button"
              className={`pm-month-picker-trigger ${monthDropdownOpen ? 'active' : ''}`}
              onClick={() => setMonthDropdownOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={monthDropdownOpen}
              title="Select observation month"
            >
              <FaCalendarAlt className="pm-month-picker-icon" aria-hidden="true" />
              <span className="pm-month-picker-label">
                {selectedMonthOption ? selectedMonthOption.label : 'Select Month'}
              </span>
              {selectedMonthOption && (
                <span className="pm-month-picker-badge">
                  {selectedMonthOption.count} {selectedMonthOption.count === 1 ? 'ticket' : 'tickets'}
                </span>
              )}
              <FaChevronDown className={`pm-month-picker-chevron ${monthDropdownOpen ? 'open' : ''}`} aria-hidden="true" />
            </button>

            {monthDropdownOpen && (
              <div className="pm-month-picker-menu" role="menu">
                <div className="pm-month-picker-menu-header">
                  <span className="pm-menu-header-title">Observation Month</span>
                  <span className="pm-menu-header-hint">4-week evaluation cycle</span>
                </div>
                <div className="pm-month-picker-menu-list">
                  {monthOptions.map(opt => {
                    const isSelected = opt.key === selectedMonthKey;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        className={`pm-month-option-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedMonthKey(opt.key);
                          setMonthDropdownOpen(false);
                        }}
                        role="menuitem"
                      >
                        <div className="pm-option-info">
                          <span className="pm-option-month-name">{opt.label}</span>
                          <span className={`pm-option-count-pill ${opt.count > 0 ? 'has-data' : 'zero'}`}>
                            {opt.count} {opt.count === 1 ? 'ticket' : 'tickets'}
                          </span>
                        </div>
                        {isSelected && <FaCheck className="pm-option-check" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="pm-export-btn"
            onClick={exportPerformanceToCSV}
            title="Export monthly performance and behavior report to CSV"
            aria-label="Export Performance Report as CSV"
          >
            <FaDownload className="pm-export-icon" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="pm-refresh-btn"
            onClick={loadData}
            title="Refresh latest ticket data"
            aria-label="Refresh latest ticket data"
          >
            <FaRedo className="pm-refresh-icon" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Statistics Banner */}
      <div className="pm-stats-grid six-cols">
        <div className="pm-stat-card primary">
          <div className="pm-stat-label">Active Staff</div>
          <div className="pm-stat-value">{summaryStats.totalStaffCount}</div>
          <div className="pm-stat-desc">
            {summaryStats.totalAssignedMonth} assigned tickets
          </div>
        </div>

        <div className="pm-stat-card good">
          <div className="pm-stat-label">Good Standing</div>
          <div className="pm-stat-value">{summaryStats.goodCount}</div>
          <div className="pm-stat-desc">Healthy throughput & recovery</div>
        </div>

        <div className="pm-stat-card warning-1">
          <div className="pm-stat-label">1st Warning</div>
          <div className="pm-stat-value">{summaryStats.warning1Count}</div>
          <div className="pm-stat-desc">Notice to Explain (NTE)</div>
        </div>

        <div className="pm-stat-card warning-2">
          <div className="pm-stat-label">2nd Warning</div>
          <div className="pm-stat-value">{summaryStats.warning2Count}</div>
          <div className="pm-stat-desc">Verbal Reprimand</div>
        </div>

        <div className="pm-stat-card warning-3">
          <div className="pm-stat-label">3rd Warning</div>
          <div className="pm-stat-value">{summaryStats.warning3Count}</div>
          <div className="pm-stat-desc">Notice of Suspension</div>
        </div>

        <div className="pm-stat-card warning-4">
          <div className="pm-stat-label">4th Warning</div>
          <div className="pm-stat-value">{summaryStats.warning4Count}</div>
          <div className="pm-stat-desc">Notice for Termination</div>
        </div>
      </div>

      {/* Search Bar on Left & Department Filter Tabs on Right */}
      <div className="pm-filter-toolbar">
        <div className="pm-search-input-wrap">
          <FaSearch className="pm-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="pm-search-input"
            placeholder="Search staff by name or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search staff"
          />
        </div>

        <div className="pm-dept-tabs-bar">
          <button
            type="button"
            className={`pm-dept-tab ${selectedDept === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedDept('all')}
          >
            <FaBuilding className="pm-tab-icon" />
            <span>All Departments</span>
            <span className="pm-tab-count">{departmentCounts.all || 0}</span>
          </button>
          {DEPARTMENTS.map(d => (
            <button
              key={d.id}
              type="button"
              className={`pm-dept-tab ${selectedDept.toLowerCase() === d.id.toLowerCase() ? 'active' : ''}`}
              onClick={() => setSelectedDept(d.id)}
            >
              <d.icon className="pm-tab-icon" />
              <span>{d.short}</span>
              <span className="pm-tab-count">{departmentCounts[d.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {searchQuery && (
        <div className="pm-search-feedback">
          Found <strong>{filteredProfiles.length}</strong> staff profile{filteredProfiles.length === 1 ? '' : 's'} matching "{searchQuery}"
        </div>
      )}

      {/* Department-Grouped Staff Sections */}
      {filteredProfiles.length === 0 ? (
        <div className="pm-empty-state">
          <FaUserTie className="pm-empty-icon" />
          <h3>No staff records found</h3>
          <p>No staff matched the selected department or search filter for this month.</p>
        </div>
      ) : (
        <div className="pm-dept-sections-wrap">
          {departmentSections.map(dept => {
            const hasStaff = dept.staffList.length > 0;
            if (!hasStaff && selectedDept === 'all') return null;

            return (
              <div key={dept.id} className="pm-dept-block">
                {/* Department Block Header */}
                <div className="pm-dept-block-header">
                  <div className="pm-dept-block-title-group">
                    <div className="pm-dept-block-icon-wrap">
                      <dept.icon />
                    </div>
                    <div>
                      <h3 className="pm-dept-block-title">{dept.label}</h3>
                      <div className="pm-dept-block-meta">
                        <span className="pm-meta-pill ticket-count">
                          {dept.totalAssigned} Assigned &bull; {dept.totalResolved} Resolved ({dept.avgClearance}%)
                        </span>
                        {dept.warningCount > 0 ? (
                          <span className="pm-meta-pill warning-alert">
                            <FaExclamationTriangle /> {dept.warningCount} under Warning Review
                          </span>
                        ) : (
                          <span className="pm-meta-pill good-alert">
                            <FaCheckCircle /> All in Good Standing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-4 Staff Grid inside this Department */}
                {!hasStaff ? (
                  <div className="pm-dept-no-staff">
                    No active staff registered under {dept.label}.
                  </div>
                ) : (
                  <div className={`pm-staff-roster-grid count-${Math.min(4, Math.max(2, dept.staffList.length))}`}>
                    {dept.staffList.map(profile => {
                      const statusKey = profile.warningEvaluation.status;
                      return (
                        <div key={profile.staff.id} className={`pm-staff-card status-${statusKey}`}>
                          {/* Staff Card Header */}
                          <div className="pm-card-top">
                            <div className="pm-staff-ident">
                              <div className="pm-avatar-circle">
                                {profile.staff.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="pm-staff-name">{profile.staff.name}</h4>
                                <div className="pm-staff-meta">
                                  <span className="pm-dept-chip">{profile.staff.department}</span>
                                  <span className="pm-role-chip">{profile.staff.role}</span>
                                </div>
                              </div>
                            </div>

                            <div className={`pm-status-badge ${statusKey}`}>
                              {statusKey === 'good' && <FaCheckCircle />}
                              {statusKey === 'warning_1_nte' && <FaInfoCircle />}
                              {statusKey === 'warning_2_verbal' && <FaExclamationTriangle />}
                              {statusKey === 'warning_3_suspension' && <FaShieldAlt />}
                              {statusKey === 'warning_4_termination' && <FaTimes />}
                              <span>{profile.warningEvaluation.shortLabel || profile.warningEvaluation.statusLabel}</span>
                            </div>
                          </div>

                          {/* Archetype Tag */}
                          <div className="pm-archetype-row">
                            <span className={`pm-archetype-pill ${profile.archetype.tag}`}>
                              <FaBrain className="pm-pill-icon" />
                              {profile.archetype.title}
                            </span>
                            <span className="pm-archetype-desc">{profile.archetype.description}</span>
                          </div>

                          {/* Monthly Volume Stats Row */}
                          <div className="pm-metrics-summary-strip">
                            <div className="pm-metric-box">
                              <span className="pm-box-label">Assigned</span>
                              <span className="pm-box-value">{profile.totals.totalAssigned}</span>
                            </div>
                            <div className="pm-metric-box">
                              <span className="pm-box-label">Resolved</span>
                              <span className="pm-box-value">{profile.totals.totalResolved}</span>
                            </div>
                            <div className="pm-metric-box">
                              <span className="pm-box-label">Clearance</span>
                              <span className="pm-box-value">{profile.totals.overallClearanceRate}%</span>
                            </div>
                            <div className="pm-metric-box">
                              <span className="pm-box-label">Rollover</span>
                              <span className={`pm-box-value ${profile.totals.netRolloverNextMonth > 5 ? 'alert' : ''}`}>
                                {profile.totals.netRolloverNextMonth}
                              </span>
                            </div>
                          </div>

                          {/* 4-Week Progress Timeline */}
                          <div className="pm-weekly-timeline-wrap">
                            <div className="pm-timeline-header">
                              <span>4-Week Behavioral Progression</span>
                              <span className="pm-timeline-caption">Intake vs. Clearance Rate</span>
                            </div>
                            <div className="pm-timeline-stepper">
                              {profile.weeklyBreakdown.map((week) => {
                                let barColorClass = 'good';
                                if (week.clearanceRate < 50) barColorClass = 'critical';
                                else if (week.clearanceRate < 75) barColorClass = 'warning';

                                return (
                                  <div key={week.weekNum} className="pm-week-step">
                                    <div className="pm-step-label">W{week.weekNum}</div>
                                    <div className={`pm-step-bar ${barColorClass}`} title={`${week.label}: ${week.resolved}/${week.assigned} resolved (${week.clearanceRate}%)`}>
                                      <div className="pm-bar-fill" style={{ width: `${Math.min(100, week.clearanceRate)}%` }}></div>
                                    </div>
                                    <div className="pm-step-subtext">
                                      {week.clearanceRate}%
                                    </div>
                                    <div className="pm-step-counts">
                                      {week.resolved}/{week.assigned}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Next Month Forecast Sneak Peek */}
                          <div className="pm-forecast-snippet">
                            <FaChartLine className="pm-forecast-icon" />
                            <span className="pm-forecast-text">
                              <strong>Next-Month Forecast:</strong> {profile.nextMonthPrediction.predictedBottleneck}
                            </span>
                          </div>

                          {/* Card Action Buttons */}
                          <div className="pm-card-actions">
                            <button
                              type="button"
                              className="pm-reassign-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReassignModal(profile);
                              }}
                              title={`Reassign requests from ${profile.staff.name}`}
                            >
                              <FaExchangeAlt />
                              <span>Reassign</span>
                            </button>
                            <button
                              type="button"
                              className="pm-inspect-btn"
                              onClick={() => handleInspectStaff(profile)}
                            >
                              <span>View AI Diagnostic</span>
                              <FaArrowRight />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Deep-Dive AI Staff Diagnostic Modal */}
      {activeStaffDiagnostic && (
        <div className="pm-modal-overlay" onClick={() => setActiveStaffDiagnostic(null)}>
          <div
            className="pm-modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diagnostic-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Formal Institutional Print Letterhead (Rendered on multi-page print) */}
            <div className="pm-print-letterhead" aria-hidden="true">
              <div className="pm-print-school-meta">
                <span className="pm-print-school-name">ACADEMIA DE SAN JOSE</span>
                <span className="pm-print-system-tag">Superadmin Command Center &bull; Staff Behavioral & Performance Diagnostic</span>
              </div>
              <div className="pm-print-doc-meta">
                <div className="pm-print-meta-item">
                  <span className="pm-print-meta-k">Evaluation Subject:</span>
                  <span className="pm-print-meta-v">{activeStaffDiagnostic.staff.name} ({activeStaffDiagnostic.staff.department} Office)</span>
                </div>
                <div className="pm-print-meta-item">
                  <span className="pm-print-meta-k">Observation Cycle:</span>
                  <span className="pm-print-meta-v">{activeStaffDiagnostic.month.name}</span>
                </div>
                <div className="pm-print-meta-item">
                  <span className="pm-print-meta-k">Standing Status:</span>
                  <span className="pm-print-meta-v">{activeStaffDiagnostic.warningEvaluation.statusLabel}</span>
                </div>
                <div className="pm-print-meta-item">
                  <span className="pm-print-meta-k">Document Generated:</span>
                  <span className="pm-print-meta-v">{new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            {/* Modal Header */}
            <div className="pm-modal-header">
              <div className="pm-modal-title-area">
                <div className="pm-modal-avatar">
                  {activeStaffDiagnostic.staff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 id="diagnostic-modal-title" className="pm-modal-name">
                    {activeStaffDiagnostic.staff.name}
                  </h3>
                  <div className="pm-modal-subtitle">
                    {activeStaffDiagnostic.staff.department} Office &bull; {activeStaffDiagnostic.month.name}
                  </div>
                </div>
              </div>

              <div className="pm-modal-actions-top">
                <div className={`pm-status-badge ${activeStaffDiagnostic.warningEvaluation.status}`}>
                  <span>{activeStaffDiagnostic.warningEvaluation.statusLabel}</span>
                </div>
                <button
                  type="button"
                  className="pm-modal-close"
                  onClick={() => setActiveStaffDiagnostic(null)}
                  aria-label="Close diagnostic"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="pm-modal-body">
              {analyzingStaffId === activeStaffDiagnostic.staff.id && (
                <div className="pm-ai-loading-banner">
                  <FaBrain className="pm-spin-icon" />
                  <span>Synthesizing multi-week behavioral model with institutional AI...</span>
                </div>
              )}

              {/* Archetype & Behavioral Profile */}
              <div className="pm-diagnostic-section highlight">
                <div className="pm-section-label">
                  <FaBrain />
                  <span>Observed Monthly Behavior & Pacing Archetype</span>
                </div>
                <div className="pm-archetype-banner">
                  <h4 className="pm-archetype-headline">{activeStaffDiagnostic.archetype.title}</h4>
                  <p className="pm-archetype-body">{activeStaffDiagnostic.archetype.description}</p>
                </div>
                <div className="pm-ai-diagnosis-box">
                  <strong>4-Week Pattern Diagnosis:</strong>
                  <p>{activeStaffDiagnostic.aiPatternDiagnosis}</p>
                </div>
              </div>

              {/* 4-Week Detailed Metrics Matrix */}
              <div className="pm-diagnostic-section">
                <div className="pm-section-label">
                  <FaHistory />
                  <span>4-Week Chronological Metrics Matrix</span>
                </div>
                <div className="pm-matrix-table-wrap">
                  <table className="pm-matrix-table">
                    <thead>
                      <tr>
                        <th>Interval</th>
                        <th>Assigned</th>
                        <th>Resolved</th>
                        <th>Rollovers Carried In</th>
                        <th>Clearance %</th>
                        <th>Avg Resolution</th>
                        <th>Pickup Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeStaffDiagnostic.weeklyBreakdown.map(w => (
                        <tr key={w.weekNum}>
                          <td className="pm-matrix-week">{w.label}</td>
                          <td>{w.assigned}</td>
                          <td>{w.resolved}</td>
                          <td>{w.rollover}</td>
                          <td>
                            <span className={`pm-matrix-clearance ${w.clearanceRate >= 75 ? 'good' : w.clearanceRate >= 50 ? 'warning' : 'critical'}`}>
                              {w.clearanceRate}%
                            </span>
                          </td>
                          <td>{w.avgResolutionHours > 0 ? `${w.avgResolutionHours} hrs` : 'N/A'}</td>
                          <td>{w.avgPickupLatencyHours > 0 ? `${w.avgPickupLatencyHours} hrs` : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Volume Spike vs. Chronic Neglect Evaluation */}
              <div className="pm-diagnostic-section">
                <div className="pm-section-label">
                  <FaCheckDouble />
                  <span>Temporary Volume Shock vs. Chronic Issue Evaluation</span>
                </div>
                <div className="pm-eval-text-card">
                  <p>{activeStaffDiagnostic.aiSpikeVsChronic}</p>
                </div>
              </div>

              {/* Next-Month Predictive Forecast */}
              <div className="pm-diagnostic-section prediction">
                <div className="pm-section-label">
                  <FaChartLine />
                  <span>AI Next-Month Predictive Forecast</span>
                </div>
                <div className="pm-prediction-grid">
                  <div className="pm-pred-box">
                    <span className="pm-pred-label">Sustainable Weekly Capacity</span>
                    <span className="pm-pred-value">~{activeStaffDiagnostic.nextMonthPrediction.safeWeeklyCapacity} tickets/wk</span>
                    <span className="pm-pred-desc">Threshold before resolution velocity slows</span>
                  </div>
                  <div className="pm-pred-box">
                    <span className="pm-pred-label">Projected Next-Month Risk</span>
                    <span className={`pm-pred-value risk-${activeStaffDiagnostic.nextMonthPrediction.projectedRisk?.toLowerCase()}`}>
                      {activeStaffDiagnostic.nextMonthPrediction.projectedRisk}
                    </span>
                    <span className="pm-pred-desc">Risk of SLA breaches or unmanaged rollover debt</span>
                  </div>
                </div>
                <div className="pm-pred-forecast-note">
                  <strong>Anticipated Trajectory:</strong> {activeStaffDiagnostic.nextMonthPrediction.predictedBottleneck}
                </div>
              </div>

              {/* Option B Warning Justification */}
              <div className="pm-diagnostic-section warning-eval">
                <div className="pm-section-label">
                  <FaShieldAlt />
                  <span>Option B: Monthly Administrative Standing Determination</span>
                </div>
                <div className="pm-standing-box">
                  <div className="pm-standing-header">
                    <span className={`pm-standing-badge ${activeStaffDiagnostic.warningEvaluation.status}`}>
                      {activeStaffDiagnostic.warningEvaluation.statusLabel}
                    </span>
                    <span className="pm-standing-date">Evaluated for entire period of {activeStaffDiagnostic.month.name}</span>
                  </div>
                  <p className="pm-standing-reason">
                    <strong>Evidence & Pattern Basis:</strong> {activeStaffDiagnostic.warningEvaluation.reasoning}
                  </p>
                </div>
              </div>

              {/* Formal Print Sign-off & Acknowledgment Section (Rendered on multi-page print) */}
              <div className="pm-print-signoff" aria-hidden="true">
                <div className="pm-print-signoff-grid">
                  <div className="pm-print-sign-box">
                    <div className="pm-print-sign-line" />
                    <span className="pm-print-sign-title">Super Administrator / Evaluator</span>
                    <span className="pm-print-sign-caption">Signature over Printed Name &bull; Date</span>
                  </div>
                  <div className="pm-print-sign-box">
                    <div className="pm-print-sign-line" />
                    <span className="pm-print-sign-title">{activeStaffDiagnostic.staff.name}</span>
                    <span className="pm-print-sign-caption">Staff Member Acknowledgment &bull; Date</span>
                  </div>
                </div>
                <p className="pm-print-confidential-notice">
                  CONFIDENTIAL &bull; Institutional Records of Academia De San Jose &bull; Generated from Firebase Realtime Audit Trajectory
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pm-modal-footer">
              <div className="pm-modal-footer-left">
                <button
                  type="button"
                  className="pm-btn-secondary"
                  onClick={handlePrintDiagnostic}
                >
                  <FaPrint />
                  <span>Print Diagnostic Summary</span>
                </button>
              </div>
              <div className="pm-modal-footer-right">
                <button
                  type="button"
                  className="pm-btn-reassign"
                  onClick={() => handleOpenReassignModal(activeStaffDiagnostic)}
                  title="Reassign active requests from this staff member"
                >
                  <FaExchangeAlt />
                  <span>Reassign Requests</span>
                </button>
                <button
                  type="button"
                  className="pm-btn-primary"
                  onClick={() => setActiveStaffDiagnostic(null)}
                >
                  Close Diagnostic
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Tickets Modal */}
      {reassignModalState.isOpen && (
        <ReassignTicketsModal
          isOpen={reassignModalState.isOpen}
          onClose={() => setReassignModalState({ isOpen: false, staffMember: null })}
          staffMember={reassignModalState.staffMember}
          allStaff={allStaffForReassign}
          onReassignSuccess={loadData}
        />
      )}
    </div>
  );
};

export default PerformanceMonitor;
