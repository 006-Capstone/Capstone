import React, { useState, useEffect, useRef } from 'react';
import { FaDownload, FaCalendarAlt, FaChevronDown, FaInbox, FaClock, FaBan, FaUsers } from 'react-icons/fa';
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

// Semester filter for the Ticket Volume Trends chart — each semester shows a
// different set of months (1ST SEM = Jun–Dec, 2ND SEM = Jan–Apr)
const SEMESTER_CONFIG = {
  firstSem: {
    label: '1ST SEM',
    months: [
      { name: 'JUNE', index: 5 },
      { name: 'JULY', index: 6 },
      { name: 'AUG', index: 7 },
      { name: 'SEP', index: 8 },
      { name: 'OCT', index: 9 },
      { name: 'NOV', index: 10 },
      { name: 'DEC', index: 11 }
    ]
  },
  secondSem: {
    label: '2ND SEM',
    months: [
      { name: 'JAN', index: 0 },
      { name: 'FEB', index: 1 },
      { name: 'MAR', index: 2 },
      { name: 'APR', index: 3 }
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
  const [selectedSemester, setSelectedSemester] = useState('firstSem');
  const [toast, setToast] = useState(null);

  // Keep fetched data in refs so filters can be applied without refetching
  const requestsRef = useRef([]);
  const feedbacksRef = useRef([]);
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

      // Fetch all requests
      const requestsCollection = collection(db, 'requests');
      const requestsSnapshot = await getDocs(requestsCollection);
      const requests = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      requestsRef.current = requests;

      // Fetch active users (students + staff)
      const studentsRef = collection(db, 'students');
      const staffRef = collection(db, 'staff');
      const [studentsSnapshot, staffSnapshot] = await Promise.all([
        getDocs(studentsRef),
        getDocs(staffRef)
      ]);
      const activeUsers = studentsSnapshot.size + staffSnapshot.size;
      setActiveUsers(activeUsers);

      // Fetch feedback for satisfaction ratings
      const feedbackRef = collection(db, 'feedback');
      const feedbackSnapshot = await getDocs(feedbackRef);
      const feedbacks = feedbackSnapshot.docs.map(doc => doc.data());
      feedbacksRef.current = feedbacks;

      // Compute everything (respects any previously applied date filter)
      computeAnalytics(requests, feedbacks, appliedFilter);

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const computeAnalytics = (requests, feedbacks, filter, officeId = satisfactionOffice, semesterId = selectedSemester) => {
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

    // Ticket volume trends (filtered by date AND selected semester)
    const monthlyData = calculateMonthlyTrends(filteredRequests, semesterId);
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

  const applySemesterFilter = (semesterId) => {
    setSelectedSemester(semesterId);
    // Recompute the volume chart with the chosen semester, keeping any date/office filters
    computeAnalytics(requestsRef.current, feedbacksRef.current, appliedFilter, satisfactionOffice, semesterId);
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

  const calculateMonthlyTrends = (requests, semesterId) => {
    const config = SEMESTER_CONFIG[semesterId];
    const monthlyCount = {};

    // Initialize all months of the selected semester
    config.months.forEach(month => {
      monthlyCount[month.name] = 0;
    });

    // Count requests by month
    requests.forEach(req => {
      const createdAt = req.createdAt?.toDate?.() || new Date(req.createdAt);
      const monthIndex = createdAt.getMonth(); // 0-11
      const month = config.months.find(m => m.index === monthIndex);
      if (month) monthlyCount[month.name]++;
    });

    return config.months.map(month => ({
      month: month.name,
      count: monthlyCount[month.name]
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

      // Calculate satisfaction from feedbacks
      const deptId = dept.toLowerCase();
      const deptFeedbacks = feedbacksRef.current.filter(f => {
        const officeId = String(f.officeId || '').toLowerCase();
        const officeName = String(f.office || f.officeName || '').toLowerCase();
        return officeId === deptId || officeName.includes(dept.toLowerCase());
      });
      
      let satisfactionRating = 'N/A';
      if (deptFeedbacks.length > 0) {
        const avgRating = deptFeedbacks.reduce((sum, f) => sum + (f.overallRating || f.rating || 0), 0) / deptFeedbacks.length;
        satisfactionRating = `${avgRating.toFixed(1)} ★`;
      }

      deptStats[dept] = {
        department: dept === 'Guidance' ? 'Guidance Office' : dept === 'Registrar' ? 'Registrar Office' : dept === 'Finance' ? 'Finance Office' : dept,
        tickets: deptRequests.length,
        resolution: avgResolution,
        satisfaction: satisfactionRating
      };
    });

    return departments.map(dept => deptStats[dept]);
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

    // Ticket Volume Trends
    csvContent += `REQUEST VOLUME TRENDS - ${SEMESTER_CONFIG[selectedSemester].label}\n`;
    csvContent += 'Month,Requests\n';
    ticketData.forEach(data => {
      csvContent += `${data.month},${data.count}\n`;
    });
    csvContent += '\n';

    // Department Efficiency
    csvContent += 'DEPARTMENT EFFICIENCY\n';
    csvContent += 'Department,Requests,Average Resolution Time,Satisfaction Rating\n';
    departmentData.forEach(dept => {
      csvContent += `"${dept.department}",${dept.tickets},"${dept.resolution}","${dept.satisfaction}"\n`;
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
        <div>
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
            <h2 className="chart-card-title">Request Volume Trends</h2>
            <div className="sem-filter" role="group" aria-label="Filter by semester">
              {Object.entries(SEMESTER_CONFIG).map(([id, config]) => (
                <button
                  key={id}
                  type="button"
                  className={`sem-btn ${selectedSemester === id ? 'active' : ''}`}
                  onClick={() => applySemesterFilter(id)}
                  aria-pressed={selectedSemester === id}
                >
                  <span className={`sem-swatch sem-swatch--${id}`} aria-hidden="true"></span>
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

              <div className="volume-bars">
                {ticketData.map((data, index) => (
                  <div key={index} className="volume-bar-group">
                    <div
                      className="volume-bar-track"
                      data-tip={data.count > 0
                        ? `${data.month} — ${data.count.toLocaleString()} request${data.count === 1 ? '' : 's'}`
                        : `${data.month} — No requests yet`}
                    >
                      <div
                        className={`volume-bar ${data.count > 0
                          ? (selectedSemester === 'firstSem' ? 'volume-bar--first-sem' : 'volume-bar--second-sem')
                          : 'volume-bar--placeholder'}`}
                        style={data.count > 0
                          ? { height: `${(data.count / topTick) * 100}%`, animationDelay: `${index * 0.07}s` }
                          : undefined}
                      ></div>
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
                <th>REQUESTS</th>
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
