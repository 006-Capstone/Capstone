import React, { useState, useEffect, useRef } from 'react';
import { 
  FaDownload, 
  FaCalendarAlt, 
  FaChevronDown, 
  FaInbox, 
  FaClock, 
  FaBan, 
  FaUsers,
  FaDollarSign,
  FaBook,
  FaClipboardList,
  FaUserFriends,
  FaCheckCircle,
  FaStar,
  FaChevronRight
} from 'react-icons/fa';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import NotificationBell from './NotificationBell';
import DateRangeFilterDropdown from './DateRangeFilterDropdown';
import Toast from './Toast';
import '../styles/Analytics.css';

const EMPTY_FILTER = { from: '', to: '' };

// Pick a "nice" step (1, 2, 5, 10, 20, …) so the gridlines land on clean
// values (0, 5, 10, …) regardless of the data range
const getNiceTickStep = (max) => {
  if (max <= 0) return 1;
  const rough = max / 6; // aim for ~6 gridlines
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  let step;
  if (norm >= 5) step = 10;
  else if (norm >= 2) step = 5;
  else if (norm >= 1) step = 2;
  else step = 1;
  return Math.max(1, Math.round(step * magnitude));
};

const SATISFACTION_OFFICES = [
  { id: 'all', name: 'All Offices' },
  { id: 'finance', name: 'Finance' },
  { id: 'library', name: 'Library' },
  { id: 'registrar', name: 'Registrar' },
  { id: 'guidance', name: 'Guidance' }
];

// Quarter filter configuration for Request Volume Trends — months remain in the bar graph
const QUARTER_FILTER_CONFIG = {
  all: {
    id: 'all',
    label: 'ALL',
    name: 'All Quarters',
    months: [
      { name: 'JAN', index: 0 },
      { name: 'FEB', index: 1 },
      { name: 'MAR', index: 2 },
      { name: 'APR', index: 3 },
      { name: 'MAY', index: 4 },
      { name: 'JUN', index: 5 },
      { name: 'JUL', index: 6 },
      { name: 'AUG', index: 7 },
      { name: 'SEP', index: 8 },
      { name: 'OCT', index: 9 },
      { name: 'NOV', index: 10 },
      { name: 'DEC', index: 11 }
    ]
  },
  q1: {
    id: 'q1',
    label: 'Q1',
    name: 'Q1 (Jan–Mar)',
    months: [
      { name: 'JAN', index: 0 },
      { name: 'FEB', index: 1 },
      { name: 'MAR', index: 2 }
    ]
  },
  q2: {
    id: 'q2',
    label: 'Q2',
    name: 'Q2 (Apr–Jun)',
    months: [
      { name: 'APR', index: 3 },
      { name: 'MAY', index: 4 },
      { name: 'JUN', index: 5 }
    ]
  },
  q3: {
    id: 'q3',
    label: 'Q3',
    name: 'Q3 (Jul–Sep)',
    months: [
      { name: 'JUL', index: 6 },
      { name: 'AUG', index: 7 },
      { name: 'SEP', index: 8 }
    ]
  },
  q4: {
    id: 'q4',
    label: 'Q4',
    name: 'Q4 (Oct–Dec)',
    months: [
      { name: 'OCT', index: 9 },
      { name: 'NOV', index: 10 },
      { name: 'DEC', index: 11 }
    ]
  }
};

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [totalRequests, setTotalRequests] = useState(0);
  const [avgResolution, setAvgResolution] = useState('0hrs');
  const [cancelledRate, setCancelledRate] = useState('0%');
  const [activeUsers, setActiveUsers] = useState(0);
  const [ticketData, setTicketData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [satisfactionData, setSatisfactionData] = useState({ fiveStars: 0, fourStars: 0, percentage: 0, total: 0 });
  const [satisfactionOffice, setSatisfactionOffice] = useState('all');
  const [officeFilterOpen, setOfficeFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [expandedDepts, setExpandedDepts] = useState({
    finance: false,
    library: false,
    registrar: false,
    guidance: false
  });
  const [toast, setToast] = useState(null);

  const toggleDepartmentExpand = (deptId) => {
    setExpandedDepts(prev => ({
      ...prev,
      [deptId]: !prev[deptId]
    }));
  };

  // Keep fetched data in refs so filters can be applied without refetching
  const requestsRef = useRef([]);
  const feedbacksRef = useRef([]);
  const staffRef = useRef([]);
  const officeFilterRef = useRef(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Close the office filter dropdown when clicking/tapping outside or pressing Escape
  useEffect(() => {
    if (!officeFilterOpen) return undefined;

    const handleClickOutside = (e) => {
      if (officeFilterRef.current && !officeFilterRef.current.contains(e.target)) {
        setOfficeFilterOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOfficeFilterOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [officeFilterOpen]);

  const getRequestDate = (value) => {
    if (!value) return null;
    const date = value?.toDate ? value.toDate() : new Date(value);
    return date instanceof Date && !isNaN(date.getTime()) ? date : null;
  };

  const filterRequestsByDate = (requests, filter) => {
    if (!filter.from && !filter.to) return requests;

    return requests.filter(req => {
      const created = getRequestDate(req.createdAt);
      if (!created) return false;

      const from = filter.from ? new Date(`${filter.from}T00:00:00`) : null;
      const to = filter.to ? new Date(`${filter.to}T23:59:59.999`) : null;

      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  };

  // Feedback docs reference their office via officeId (lowercase id) or office (display name)
  const filterFeedbacksByOffice = (feedbacks, officeId) => {
    if (!officeId || officeId === 'all') return feedbacks;

    const officeNames = {
      finance: 'Finance',
      library: 'Library',
      registrar: 'Registrar',
      guidance: 'Guidance'
    };
    const displayName = officeNames[officeId];

    return feedbacks.filter(f => {
      const id = String(f.officeId || '').toLowerCase();
      const name = String(f.office || '').toLowerCase();
      // Match by id (finance) OR by display name (Finance / Finance Office)
      return id === officeId || name.includes(displayName.toLowerCase());
    });
  };

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      let requests = [];
      let feedbacks = [];
      let staffList = [];

      // 1. Fetch requests
      try {
        const requestsCollection = collection(db, 'requests');
        const requestsSnapshot = await getDocs(requestsCollection);
        requests = requestsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        requestsRef.current = requests;
      } catch (err) {
        console.error('[Analytics] Error fetching requests:', err);
      }

      // 2. Fetch active users (students + staff)
      try {
        const [studentsSnapshot, staffSnapshot] = await Promise.allSettled([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'staff'))
        ]);
        const studentsCount = studentsSnapshot.status === 'fulfilled' ? studentsSnapshot.value.size : 0;
        if (staffSnapshot.status === 'fulfilled') {
          staffList = staffSnapshot.value.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          staffRef.current = staffList;
        }
        const staffCount = staffList.length;
        setActiveUsers(studentsCount + staffCount);
      } catch (err) {
        console.error('[Analytics] Error fetching users:', err);
      }

      // 3. Fetch feedback for satisfaction ratings
      try {
        const feedbackSnapshot = await getDocs(collection(db, 'feedback'));
        feedbacks = feedbackSnapshot.docs.map(doc => doc.data());
        feedbacksRef.current = feedbacks;
      } catch (err) {
        console.error('[Analytics] Error fetching feedback:', err);
      }

      // Compute everything (respects any previously applied date filter)
      computeAnalytics(requests, feedbacks, appliedFilter, satisfactionOffice, selectedQuarter, staffList);

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const computeAnalytics = (requests, feedbacks, filter, officeId = satisfactionOffice, quarterId = selectedQuarter) => {
    // Apply date filter to requests
    const filteredRequests = filterRequestsByDate(requests, filter);

    // Total requests (filtered)
    setTotalRequests(filteredRequests.length);

    // Calculate cancelled rate (filtered)
    const cancelledCount = filteredRequests.filter(r => r.status === 'Cancelled').length;
    const cancelledPercentage = filteredRequests.length > 0 ? Math.round((cancelledCount / filteredRequests.length) * 100) : 0;
    setCancelledRate(`${cancelledPercentage}%`);

    // Calculate average resolution time (for resolved tickets within the range)
    const resolvedRequests = filteredRequests.filter(r => r.status === 'Resolved' && r.resolvedAt && r.createdAt);
    if (resolvedRequests.length > 0) {
      const totalResolutionTime = resolvedRequests.reduce((sum, req) => {
        const created = req.createdAt?.toDate?.() || new Date(req.createdAt);
        const resolved = req.resolvedAt?.toDate?.() || new Date(req.resolvedAt);
        const diff = resolved - created;
        return sum + diff;
      }, 0);
      const avgTime = totalResolutionTime / resolvedRequests.length;
      setAvgResolution(formatDuration(avgTime));
    } else {
      setAvgResolution('0hrs');
    }

    // Request volume trends (Monthly within selected quarter or all months)
    const monthlyData = calculateMonthlyTrends(filteredRequests, quarterId);
    setTicketData(monthlyData);

    // Department efficiency (filtered)
    const deptData = calculateDepartmentEfficiency(filteredRequests);
    setDepartmentData(deptData);

    // Satisfaction ratings (filtered by date AND selected office)
    const filteredFeedbacks = filterRequestsByDate(feedbacks, filter);
    const officeFeedbacks = filterFeedbacksByOffice(filteredFeedbacks, officeId);
    
    // Count ratings properly using overallRating (which is the calculated average)
    const fiveStarsCount = officeFeedbacks.filter(f => {
      const rating = f.overallRating || f.rating || 0;
      return Math.round(rating) === 5;
    }).length;
    
    const fourStarsCount = officeFeedbacks.filter(f => {
      const rating = f.overallRating || f.rating || 0;
      return Math.round(rating) === 4;
    }).length;
    
    const totalFeedback = officeFeedbacks.length;
    
    // Calculate overall satisfaction percentage (average rating out of 5)
    let satisfactionPercentage = 0;
    if (totalFeedback > 0) {
      const totalRating = officeFeedbacks.reduce((sum, f) => {
        const rating = f.overallRating || f.rating || 0;
        return sum + rating;
      }, 0);
      const avgRating = totalRating / totalFeedback;
      satisfactionPercentage = Math.round((avgRating / 5) * 100);
    }

    setSatisfactionData({
      fiveStars: fiveStarsCount,
      fourStars: fourStarsCount,
      percentage: satisfactionPercentage,
      total: totalFeedback
    });
  };

  const applyOfficeFilter = (officeId) => {
    setSatisfactionOffice(officeId);
    setOfficeFilterOpen(false);
    // Recompute satisfaction with the selected office, keeping the date filter
    computeAnalytics(requestsRef.current, feedbacksRef.current, appliedFilter, officeId);
  };

  const applyQuarterFilter = (quarterId) => {
    setSelectedQuarter(quarterId);
    // Recompute the monthly volume chart with the chosen quarter, keeping any date/office filters
    computeAnalytics(requestsRef.current, feedbacksRef.current, appliedFilter, satisfactionOffice, quarterId);
  };

  const selectedOfficeName = SATISFACTION_OFFICES.find(o => o.id === satisfactionOffice)?.name || 'All Offices';

  const applyDateFilter = () => {
    if (dateFilter.from && dateFilter.to && dateFilter.from > dateFilter.to) {
      setToast({ type: 'error', message: 'The "From" date cannot be later than the "To" date.' });
      return false;
    }
    setAppliedFilter(dateFilter);
    computeAnalytics(requestsRef.current, feedbacksRef.current, dateFilter);
    return true;
  };

  const clearDateFilter = () => {
    setDateFilter(EMPTY_FILTER);
    setAppliedFilter(EMPTY_FILTER);
    computeAnalytics(requestsRef.current, feedbacksRef.current, EMPTY_FILTER);
  };

  const formatFilterDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isFilterActive = Boolean(appliedFilter.from || appliedFilter.to);

  const formatDuration = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return remainingHours > 0 ? `${days}days ${remainingHours}hrs` : `${days}days`;
    }
    return `${hours}hrs`;
  };

  const calculateMonthlyTrends = (requests, quarterId = 'all') => {
    const config = QUARTER_FILTER_CONFIG[quarterId] || QUARTER_FILTER_CONFIG.all;
    const monthlyCount = {};

    // Initialize all months of the selected quarter (or all 12 months for 'all')
    config.months.forEach(month => {
      monthlyCount[month.name] = 0;
    });

    // Count requests by month
    requests.forEach(req => {
      const created = getRequestDate(req.createdAt);
      if (!created) return;
      const monthIndex = created.getMonth(); // 0-11
      const month = config.months.find(m => m.index === monthIndex);
      if (month) monthlyCount[month.name]++;
    });

    return config.months.map(month => ({
      month: month.name,
      count: monthlyCount[month.name]
    }));
  };

  const calculateDepartmentEfficiency = (requests) => {
    const departments = [
      { id: 'finance', name: 'Finance', label: 'Finance Office', icon: 'finance' },
      { id: 'library', name: 'Library', label: 'Library', icon: 'library' },
      { id: 'registrar', name: 'Registrar', label: "Registrar's Office", icon: 'registrar' },
      { id: 'guidance', name: 'Guidance', label: 'Guidance & Counseling', icon: 'guidance' }
    ];

    const totalAllRequests = requests.length;

    return departments.map(d => {
      const deptRequests = requests.filter(r => r.office === d.name);
      const totalTickets = deptRequests.length;
      
      const pendingCount = deptRequests.filter(r => r.status === 'Pending').length;
      const inProcessCount = deptRequests.filter(r => r.status === 'In Process').length;
      const resolvedList = deptRequests.filter(r => r.status === 'Resolved');
      const resolvedCount = resolvedList.length;
      const cancelledCount = deptRequests.filter(r => r.status === 'Cancelled').length;

      // Completion rate
      const completionRate = totalTickets > 0 ? Math.round((resolvedCount / totalTickets) * 100) : 0;
      const volumeShare = totalAllRequests > 0 ? Math.round((totalTickets / totalAllRequests) * 100) : 0;

      // Resolution turnaround time
      const resolvedWithTimestamps = resolvedList.filter(r => r.resolvedAt && r.createdAt);
      let avgResolution = 'N/A';
      let avgHours = 0;
      if (resolvedWithTimestamps.length > 0) {
        const totalTime = resolvedWithTimestamps.reduce((sum, req) => {
          const created = req.createdAt?.toDate?.() || new Date(req.createdAt);
          const resolved = req.resolvedAt?.toDate?.() || new Date(req.resolvedAt);
          return sum + (resolved - created);
        }, 0);
        const avgMs = totalTime / resolvedWithTimestamps.length;
        avgHours = avgMs / (1000 * 60 * 60);
        avgResolution = formatDuration(avgMs);
      }

      // Turnaround benchmark tag
      let speedBadge = { label: 'No data', type: 'neutral' };
      if (resolvedWithTimestamps.length > 0) {
        if (avgHours <= 2) {
          speedBadge = { label: 'Fast Turnover', type: 'fast' };
        } else if (avgHours <= 12) {
          speedBadge = { label: 'Standard Pace', type: 'standard' };
        } else {
          speedBadge = { label: 'In-Depth Cases', type: 'extended' };
        }
      }

      // Active staff in this office and their individual workloads
      const officeStaffList = (staffRef.current || []).filter(s => {
        const officeId = String(s.officeId || '').toLowerCase();
        const officeName = String(s.office || '').toLowerCase();
        return officeId === d.id || officeName.includes(d.id);
      });

      const staffWorkload = officeStaffList.map(member => {
        const memberName = member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Staff';
        const memberUid = member.uid || member.id;
        
        // Find tickets handled by this staff member (assignedTo, claimedBy, or assignedToStaff)
        const handledTickets = deptRequests.filter(req => {
          const assigned = req.assignedTo || req.claimedBy || '';
          const staffUid = req.assignedToStaff || '';
          return (
            (assigned && assigned.toLowerCase() === memberName.toLowerCase()) ||
            (memberUid && staffUid === memberUid)
          );
        });

        const memberPending = handledTickets.filter(r => r.status === 'Pending').length;
        const memberInProcess = handledTickets.filter(r => r.status === 'In Process').length;
        const memberResolvedList = handledTickets.filter(r => r.status === 'Resolved');
        const memberResolved = memberResolvedList.length;
        const memberCancelled = handledTickets.filter(r => r.status === 'Cancelled').length;
        const memberTotal = handledTickets.length;
        const memberCompletionRate = memberTotal > 0 ? Math.round((memberResolved / memberTotal) * 100) : 0;

        // Staff average resolution time
        const memberTimestamps = memberResolvedList.filter(r => r.resolvedAt && r.createdAt);
        let memberAvgResolution = 'N/A';
        if (memberTimestamps.length > 0) {
          const totalMs = memberTimestamps.reduce((sum, req) => {
            const created = req.createdAt?.toDate?.() || new Date(req.createdAt);
            const resolved = req.resolvedAt?.toDate?.() || new Date(req.resolvedAt);
            return sum + (resolved - created);
          }, 0);
          memberAvgResolution = formatDuration(totalMs / memberTimestamps.length);
        }

        return {
          id: member.id || memberName,
          name: memberName,
          email: member.email || '',
          role: member.role || 'Staff',
          total: memberTotal,
          pending: memberPending,
          inProcess: memberInProcess,
          resolved: memberResolved,
          cancelled: memberCancelled,
          completionRate: memberCompletionRate,
          avgResolution: memberAvgResolution
        };
      }).sort((a, b) => b.total - a.total); // Sort by highest workload first

      // Unassigned requests within this department
      const unassignedTickets = deptRequests.filter(req => !req.assignedTo && !req.claimedBy && !req.assignedToStaff);
      const unassignedCount = unassignedTickets.length;

      // Satisfaction from feedbacks
      const deptFeedbacks = feedbacksRef.current.filter(f => {
        const officeId = String(f.officeId || '').toLowerCase();
        const officeName = String(f.office || f.officeName || '').toLowerCase();
        return officeId === d.id || officeName.includes(d.id);
      });

      let satisfactionRating = 'N/A';
      let satisfactionScore = 0;
      const feedbackCount = deptFeedbacks.length;
      if (feedbackCount > 0) {
        const avgRating = deptFeedbacks.reduce((sum, f) => sum + (f.overallRating || f.rating || 0), 0) / feedbackCount;
        satisfactionScore = avgRating;
        satisfactionRating = `${avgRating.toFixed(1)} ★`;
      }

      return {
        id: d.id,
        department: d.label,
        officeName: d.name,
        tickets: totalTickets,
        pendingCount,
        inProcessCount,
        resolvedCount,
        cancelledCount,
        unassignedCount,
        completionRate,
        volumeShare,
        resolution: avgResolution,
        speedBadge,
        staffCount: officeStaffList.length,
        staffWorkload,
        satisfaction: satisfactionRating,
        satisfactionScore,
        feedbackCount
      };
    });
  };

  const exportToCSV = () => {
    const currentDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build comprehensive CSV with all analytics data
    let csvContent = '';

    // Header
    csvContent += 'ACADEMIA DE SAN JOSE - ANALYTICS REPORT\n';
    csvContent += `Generated: ${currentDate}\n`;
    
    if (isFilterActive) {
      csvContent += `Date Range: ${appliedFilter.from ? formatFilterDate(appliedFilter.from) : 'All'} to ${appliedFilter.to ? formatFilterDate(appliedFilter.to) : 'All'}\n`;
    }
    csvContent += '\n';

    // Summary Statistics
    csvContent += 'SUMMARY STATISTICS\n';
    csvContent += 'Metric,Value\n';
    csvContent += `Total Requests,${totalRequests}\n`;
    csvContent += `Average Resolution Time,${avgResolution}\n`;
    csvContent += `Cancelled Rate,${cancelledRate}\n`;
    csvContent += `Active Users,${activeUsers}\n`;
    csvContent += '\n';

    // Student Satisfaction
    csvContent += 'STUDENT SATISFACTION\n';
    csvContent += `Office Filter: ${selectedOfficeName}\n`;
    csvContent += 'Metric,Value\n';
    csvContent += `Overall Satisfaction,${satisfactionData.percentage}%\n`;
    csvContent += `Total Feedback,${satisfactionData.total}\n`;
    csvContent += `5 Stars,${satisfactionData.fiveStars}\n`;
    csvContent += `4 Stars,${satisfactionData.fourStars}\n`;
    csvContent += '\n';

    // Request Volume Trends
    const quarterLabel = QUARTER_FILTER_CONFIG[selectedQuarter]?.name || 'All Quarters';
    csvContent += `REQUEST VOLUME TRENDS - ${quarterLabel}\n`;
    csvContent += 'Month,Requests\n';
    ticketData.forEach(data => {
      csvContent += `${data.month},${data.count}\n`;
    });
    csvContent += '\n';

    // Department Efficiency
    csvContent += 'DEPARTMENT EFFICIENCY\n';
    csvContent += 'Department,Requests,Share %,Active Staff,Pending,In Process,Resolved,Completion Rate %,Average Resolution Time,Speed Category,Satisfaction Rating,Reviews Count\n';
    departmentData.forEach(dept => {
      csvContent += `"${dept.department}",${dept.tickets},${dept.volumeShare}%,${dept.staffCount},${dept.pendingCount},${dept.inProcessCount},${dept.resolvedCount},${dept.completionRate}%,"${dept.resolution}","${dept.speedBadge.label}","${dept.satisfaction}",${dept.feedbackCount}\n`;
    });
    csvContent += '\n';

    // Individual Staff Workload by Department
    csvContent += 'INDIVIDUAL STAFF WORKLOAD BY DEPARTMENT\n';
    csvContent += 'Department,Staff Name,Role,Total Handled,In Process,Resolved,Completion Rate %,Average Resolution Time\n';
    departmentData.forEach(dept => {
      if (dept.staffWorkload && dept.staffWorkload.length > 0) {
        dept.staffWorkload.forEach(staff => {
          csvContent += `"${dept.department}","${staff.name}","${staff.role}",${staff.total},${staff.inProcess},${staff.resolved},${staff.completionRate}%,"${staff.avgResolution}"\n`;
        });
      } else {
        csvContent += `"${dept.department}","No staff assigned","N/A",0,0,0,0%,"N/A"\n`;
      }
    });

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`📊 Analytics report exported: ${filename}`);
  };

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." fullScreen={true} />;
  }

  // Ticket Volume Trends — ticks from 0 up to a clean top value (0 at the bottom)
  const chartMax = Math.max(...ticketData.map(d => d.count), 1);
  const tickStep = getNiceTickStep(chartMax);
  const topTick = Math.ceil(chartMax / tickStep) * tickStep;
  const yTicks = [];
  for (let v = 0; v <= topTick; v += tickStep) yTicks.push(v);
  const yTicksDesc = [...yTicks].reverse(); // biggest on top, 0 on the baseline

  return (
    <div className="superadmin-page analytics-container">
      <div className="page-header">
        <div className="page-header-title-group">
          <h1 className="analytics-title">Analytics</h1>
          <p className="page-subtitle">Track request volume, satisfaction, and department performance</p>
        </div>
        <div className="page-header-right">
          <div className="analytics-actions">
            <DateRangeFilterDropdown
              filter={dateFilter}
              onFilterChange={setDateFilter}
              isActive={isFilterActive}
              onApply={applyDateFilter}
              onClear={clearDateFilter}
              appliedFilter={appliedFilter}
              idPrefix="analytics"
            />
            <button className="btn-primary export-button" onClick={exportToCSV}>
              <FaDownload className="export-icon" aria-hidden="true" />
              Export CSV
            </button>
          </div>
          <NotificationBell />
        </div>
      </div>

      {isFilterActive && (
        <div className="filter-summary">
          <FaCalendarAlt className="filter-summary-icon" aria-hidden="true" />
          <span>
            Showing <strong>{totalRequests.toLocaleString()}</strong> request{totalRequests === 1 ? '' : 's'}
            {appliedFilter.from && <> from <strong>{formatFilterDate(appliedFilter.from)}</strong></>}
            {appliedFilter.from && appliedFilter.to && <> to </>}
            {appliedFilter.to && <><strong>{formatFilterDate(appliedFilter.to)}</strong></>}
          </span>
        </div>
      )}

      <div className="analytics-content">
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-title-group">
              <h2 className="chart-card-title">Request Volume Trends</h2>
              <span className="chart-card-subtitle">
                {selectedQuarter === 'all'
                  ? 'Monthly distribution of incoming ticket volume across the year'
                  : `Monthly volume for ${QUARTER_FILTER_CONFIG[selectedQuarter]?.name || 'selected quarter'}`}
              </span>
            </div>
            <div className="quarter-filter" role="group" aria-label="Filter by quarter">
              {Object.entries(QUARTER_FILTER_CONFIG).map(([id, config]) => (
                <button
                  key={id}
                  type="button"
                  className={`quarter-btn ${selectedQuarter === id ? 'active' : ''}`}
                  onClick={() => applyQuarterFilter(id)}
                  aria-pressed={selectedQuarter === id}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="volume-chart">
            {/* Y-axis with numeric labels aligned to the gridlines */}
            <div className="volume-y-axis" aria-hidden="true">
              {yTicksDesc.map((label, i) => (
                <span key={i} className="volume-y-label">{label}</span>
              ))}
            </div>

            <div className="volume-plot">
              {/* Horizontal gridlines at each tick (0, 5, 10, …); the 0 baseline is emphasized */}
              <div className="volume-gridlines" aria-hidden="true">
                {yTicksDesc.map((tick, i) => (
                  <div key={i} className={`volume-gridline${tick === 0 ? ' volume-gridline--zero' : ''}`} />
                ))}
              </div>

              <div className={`volume-bars ${selectedQuarter === 'all' ? 'volume-bars--all-months' : 'volume-bars--quarter-months'}`}>
                {ticketData.map((data, index) => (
                  <div key={data.month || index} className="volume-bar-group">
                    <div
                      className="volume-bar-track"
                      data-tip={data.count > 0
                        ? `${data.month} — ${data.count.toLocaleString()} request${data.count === 1 ? '' : 's'}`
                        : `${data.month} — No requests yet`}
                    >
                      <div
                        className={`volume-bar ${data.count > 0 ? 'volume-bar--active' : 'volume-bar--placeholder'}`}
                        style={data.count > 0
                          ? { height: `${(data.count / topTick) * 100}%`, animationDelay: `${index * 0.04}s` }
                          : undefined}
                      >
                        {data.count > 0 && ticketData.length <= 6 && (
                          <span className="volume-bar-count-badge">{data.count}</span>
                        )}
                      </div>
                    </div>
                    <span className="volume-month-label">{data.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="satisfaction-card">
          <div className="satisfaction-header">
            <h2 className="satisfaction-title">Student Satisfaction</h2>
            <div className="office-filter-wrap" ref={officeFilterRef}>
              <button
                type="button"
                className={`satisfaction-filter ${satisfactionOffice !== 'all' ? 'active' : ''}`}
                onClick={() => setOfficeFilterOpen(prev => !prev)}
                aria-haspopup="true"
                aria-expanded={officeFilterOpen}
              >
                <span>{satisfactionOffice === 'all' ? 'Filter by' : selectedOfficeName}</span>
                <FaChevronDown aria-hidden="true" />
              </button>

              {officeFilterOpen && (
                <div className="office-filter-menu">
                  {SATISFACTION_OFFICES.map(office => (
                    <button
                      key={office.id}
                      type="button"
                      className={`office-filter-option ${satisfactionOffice === office.id ? 'selected' : ''}`}
                      onClick={() => applyOfficeFilter(office.id)}
                    >
                      {office.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="satisfaction-content">
            <div className="satisfaction-percentage">{satisfactionData.percentage}%</div>
            <div className="satisfaction-label">Overall Satisfaction</div>
            {satisfactionData.total > 0 && (
              <div className="satisfaction-total">{satisfactionData.total} total feedback{satisfactionData.total !== 1 ? 's' : ''}</div>
            )}
            
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

      <div className="analytics-stats">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaInbox className="stat-icon" aria-hidden="true" />
            </div>
            <span className="stat-label">TOTAL VOLUME</span>
          </div>
          <div className="stat-value">{totalRequests.toLocaleString()}</div>
          <div className="stat-subtext">Cumulative institutional requests</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaClock className="stat-icon" aria-hidden="true" />
            </div>
            <span className="stat-label">AVG. RESOLUTION</span>
          </div>
          <div className="stat-value">{avgResolution}</div>
          <div className="stat-subtext">Turnaround on resolved tickets</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container amber">
              <FaBan className="stat-icon" aria-hidden="true" />
            </div>
            <span className="stat-label">CANCELLATION RATE</span>
          </div>
          <div className="stat-value">{cancelledRate}</div>
          <div className="stat-subtext">Withdrawn or rejected requests</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaUsers className="stat-icon" aria-hidden="true" />
            </div>
            <span className="stat-label">ACTIVE ACCOUNTS</span>
          </div>
          <div className="stat-value">{activeUsers.toLocaleString()}</div>
          <div className="stat-subtext">Registered students & staff</div>
        </div>
      </div>

      <div className="efficiency-table">
        <div className="efficiency-header">
          <div className="efficiency-title-group">
            <h2 className="efficiency-title">Department Efficiency & Workload</h2>
          </div>
          <div className="efficiency-header-legend">
            <div className="efficiency-legend-item">
              <span className="legend-dot resolved" aria-hidden="true" />
              <span>Resolved</span>
            </div>
            <div className="efficiency-legend-item">
              <span className="legend-dot in-process" aria-hidden="true" />
              <span>In Process</span>
            </div>
            <div className="efficiency-legend-item">
              <span className="legend-dot pending" aria-hidden="true" />
              <span>Pending</span>
            </div>
          </div>
        </div>
        
        <div className="table-wrapper">
          <table className="efficiency-matrix-table">
            <thead>
              <tr>
                <th style={{ minWidth: '200px' }}>DEPARTMENT</th>
                <th style={{ minWidth: '220px' }}>WORKLOAD & STATUS</th>
                <th style={{ minWidth: '170px' }}>RESOLUTION SPEED</th>
                <th style={{ minWidth: '160px' }}>COMPLETION RATE</th>
                <th style={{ minWidth: '150px' }}>SATISFACTION</th>
              </tr>
            </thead>
            <tbody>
              {departmentData.map((dept) => {
                const total = dept.tickets;
                const pendingPct = total > 0 ? Math.round((dept.pendingCount / total) * 100) : 0;
                const inProcessPct = total > 0 ? Math.round((dept.inProcessCount / total) * 100) : 0;
                const resolvedPct = total > 0 ? Math.round((dept.resolvedCount / total) * 100) : 0;
                const cancelledPct = total > 0 ? Math.round((dept.cancelledCount / total) * 100) : 0;
                const isExpanded = Boolean(expandedDepts[dept.id]);

                const getOfficeIcon = (id) => {
                  switch (id) {
                    case 'finance': return <FaDollarSign />;
                    case 'library': return <FaBook />;
                    case 'registrar': return <FaClipboardList />;
                    case 'guidance': return <FaUserFriends />;
                    default: return <FaUsers />;
                  }
                };

                return (
                  <React.Fragment key={dept.id}>
                    <tr className={`dept-row ${isExpanded ? 'expanded' : ''}`}>
                      {/* 1. Department Identity */}
                      <td>
                        <div className="dept-identity-cell">
                          <button
                            type="button"
                            className={`dept-expand-btn ${isExpanded ? 'active' : ''}`}
                            onClick={() => toggleDepartmentExpand(dept.id)}
                            title={isExpanded ? 'Collapse staff workload' : 'View staff workload'}
                            aria-label={`Toggle staff workload for ${dept.department}`}
                          >
                            <FaChevronRight className="expand-chevron-icon" />
                          </button>
                          <div className={`dept-avatar-badge ${dept.id}`}>
                            {getOfficeIcon(dept.id)}
                          </div>
                          <div className="dept-name-block">
                            <span className="dept-primary-name">{dept.department}</span>
                            <span className="dept-staff-subtext">
                              {dept.staffCount} staff member{dept.staffCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Workload & Progress Breakdown */}
                      <td>
                        <div className="dept-workload-cell">
                          <div className="workload-stats-row">
                            <span className="workload-total-badge">
                              <strong>{dept.tickets}</strong> requests
                            </span>
                            <span className="workload-share-subtext">
                              {dept.volumeShare}% of total
                            </span>
                          </div>

                          {/* Segmented Pipeline Bar */}
                          <div 
                            className="dept-mini-pipeline"
                            title={`Pending: ${dept.pendingCount} | In Process: ${dept.inProcessCount} | Resolved: ${dept.resolvedCount} | Cancelled: ${dept.cancelledCount}`}
                          >
                            {dept.tickets === 0 ? (
                              <div className="mini-segment empty" style={{ width: '100%' }} />
                            ) : (
                              <>
                                <div className="mini-segment pending" style={{ width: `${pendingPct}%` }} />
                                <div className="mini-segment in-process" style={{ width: `${inProcessPct}%` }} />
                                <div className="mini-segment resolved" style={{ width: `${resolvedPct}%` }} />
                                <div className="mini-segment cancelled" style={{ width: `${cancelledPct}%` }} />
                              </>
                            )}
                          </div>

                          <div className="dept-mini-legend">
                            <span className="legend-chip pending">{dept.pendingCount} pend</span>
                            <span className="legend-chip in-process">{dept.inProcessCount} active</span>
                            <span className="legend-chip resolved">{dept.resolvedCount} done</span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Resolution Turnaround */}
                      <td>
                        <div className="dept-resolution-cell">
                          <span className="resolution-time-value">{dept.resolution}</span>
                          <span className={`speed-badge ${dept.speedBadge.type}`}>
                            {dept.speedBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* 4. Completion Rate */}
                      <td>
                        <div className="dept-completion-cell">
                          <div className="completion-rate-row">
                            <span className="completion-percent">{dept.completionRate}%</span>
                            <span className="completion-ratio">
                              {dept.resolvedCount}/{dept.tickets}
                            </span>
                          </div>
                          <div className="completion-track">
                            <div 
                              className="completion-fill"
                              style={{ width: `${dept.completionRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 5. Satisfaction */}
                      <td>
                        <div className="dept-satisfaction-cell">
                          {dept.feedbackCount > 0 ? (
                            <>
                              <div className="satisfaction-rating-main">
                                <FaStar className="star-inline-icon" />
                                <span className="rating-number">{dept.satisfactionScore.toFixed(1)}</span>
                                <span className="rating-max">/5.0</span>
                              </div>
                              <span className="feedback-count-label">
                                {dept.feedbackCount} review{dept.feedbackCount !== 1 ? 's' : ''}
                              </span>
                            </>
                          ) : (
                            <span className="no-feedback-label">No reviews yet</span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Staff Workload Sub-row */}
                    {isExpanded && (
                      <tr className="dept-staff-expansion-row">
                        <td colSpan={5} className="staff-expansion-cell">
                          <div className="staff-breakdown-container">
                            <div className="staff-breakdown-header">
                              <span className="staff-breakdown-title">
                                <FaUsers style={{ marginRight: '6px' }} />
                                Staff Caseload & Performance — {dept.department}
                              </span>
                              {dept.unassignedCount > 0 && (
                                <span className="unassigned-pill">
                                  {dept.unassignedCount} unassigned ticket{dept.unassignedCount !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>

                            {dept.staffWorkload && dept.staffWorkload.length > 0 ? (
                              <div className="staff-workload-grid">
                                {dept.staffWorkload.map(staff => {
                                  const staffShare = dept.tickets > 0 ? Math.round((staff.total / dept.tickets) * 100) : 0;
                                  return (
                                    <div key={staff.id} className="staff-workload-card">
                                      <div className="staff-card-top">
                                        <div className="staff-info-block">
                                          <span className="staff-name-label">{staff.name}</span>
                                          <span className="staff-role-badge">{staff.role}</span>
                                        </div>
                                        <div className="staff-volume-badge">
                                          <strong>{staff.total}</strong> tickets ({staffShare}%)
                                        </div>
                                      </div>

                                      {/* Mini status counts */}
                                      <div className="staff-stats-pills">
                                        <span className="staff-pill in-process">
                                          <span className="pill-dot yellow" />
                                          {staff.inProcess} active
                                        </span>
                                        <span className="staff-pill resolved">
                                          <span className="pill-dot green" />
                                          {staff.resolved} resolved
                                        </span>
                                        {staff.pending > 0 && (
                                          <span className="staff-pill pending">
                                            <span className="pill-dot violet" />
                                            {staff.pending} pending
                                          </span>
                                        )}
                                      </div>

                                      {/* Staff completion progress */}
                                      <div className="staff-completion-row">
                                        <div className="staff-completion-label">
                                          <span>Completion: {staff.completionRate}%</span>
                                          <span className="staff-avg-speed">Avg: {staff.avgResolution}</span>
                                        </div>
                                        <div className="staff-track">
                                          <div 
                                            className="staff-fill"
                                            style={{ width: `${staff.completionRate}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="no-staff-state">
                                No active staff accounts registered under this department yet.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

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

export default Analytics;
