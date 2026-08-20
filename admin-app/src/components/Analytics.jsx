import React, { useState, useEffect, useMemo } from 'react';
import {
  FaBell, FaDownload, FaBalanceScale, FaChartBar, FaClock, FaUserCircle, FaCalendarAlt
} from 'react-icons/fa';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import Notifications from './Notifications';
import LoadingSpinner from './LoadingSpinner';
import DateRangeFilterDropdown from './DateRangeFilterDropdown';
import { useOfficeTickets } from '../hooks/useOfficeTickets';
import '../styles/Analytics.css';

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const EMPTY_FILTER = { from: '', to: '' };

const STATUS_META = [
  { key: 'pending', label: 'Pending', color: '#6366f1' },
  { key: 'inProcess', label: 'In Process', color: '#f59e0b' },
  { key: 'resolved', label: 'Resolved', color: '#10b981' },
  { key: 'cancelled', label: 'Cancelled', color: '#ef4444' }
];

const SUBJECT_COLORS = ['#5B7CE6', '#66bb6a', '#FFB74D', '#EF5350', '#AB47BC', '#26C6DA', '#FFA726', '#8d6e63'];

/* ---------------------------------------------------------------------------
   Date helpers (shared normalization so Dashboard and Analytics agree)
--------------------------------------------------------------------------- */
const getTicketDate = (value) => {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return date instanceof Date && !isNaN(date.getTime()) ? date : null;
};

const filterTicketsByDate = (requests, filter) => {
  if (!filter.from && !filter.to) return requests;

  return requests.filter(req => {
    const created = getTicketDate(req.createdAt);
    if (!created) return false;

    const from = filter.from ? new Date(`${filter.from}T00:00:00`) : null;
    const to = filter.to ? new Date(`${filter.to}T23:59:59.999`) : null;

    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });
};

const formatFilterDate = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* Pick a "nice" step (1, 2, 5, 10, 20, …) so gridlines land on clean values */
const getNiceTickStep = (max) => {
  if (max <= 0) return 1;
  const rough = max / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  let step;
  if (norm >= 5) step = 10;
  else if (norm >= 2) step = 5;
  else if (norm >= 1) step = 2;
  else step = 1;
  return Math.max(1, Math.round(step * magnitude));
};

/* Donut geometry — angles start at the top (-90°) and sweep clockwise */
const polar = (cx, cy, radius, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
};

const DONUT_OUTER = 84;
const DONUT_INNER = 56;

const donutSegmentPath = (startAngle, endAngle) => {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const startOuter = polar(100, 100, DONUT_OUTER, startAngle);
  const endOuter = polar(100, 100, DONUT_OUTER, endAngle);
  const endInner = polar(100, 100, DONUT_INNER, endAngle);
  const startInner = polar(100, 100, DONUT_INNER, startAngle);
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${DONUT_OUTER} ${DONUT_OUTER} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${DONUT_INNER} ${DONUT_INNER} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    'Z'
  ].join(' ');
};

const Analytics = ({ department, onViewRequest }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);

  // The shared live data source — the exact same tickets the Dashboard shows.
  // Any claim / resolve / cancel updates this instantly on both pages.
  const { tickets, loading: ticketsLoading } = useOfficeTickets(department);

  // Staff members of this office (names + activity attribution)
  useEffect(() => {
    let active = true;
    setStaffLoading(true);

    // Safety net: if the fetch stalls, stop loading so the page can't get
    // stuck behind the full-screen spinner.
    const timer = setTimeout(() => {
      if (active) setStaffLoading(false);
    }, 12000);

    const loadStaff = async () => {
      try {
        const q = query(
          collection(db, 'staff'),
          where('office', '==', department)
        );
        const snapshot = await getDocs(q);
        if (active) {
          setStaffMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      } catch (error) {
        console.error('[Error] Error loading staff:', error);
      } finally {
        clearTimeout(timer);
        if (active) setStaffLoading(false);
      }
    };

    loadStaff();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [department]);

  // Unread notification count
  useEffect(() => {
    const staffData = JSON.parse(localStorage.getItem('staffData'));
    if (!staffData?.uid) return undefined;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', staffData.uid),
      where('recipientType', '==', 'staff')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setUnreadCount(querySnapshot.docs.filter(doc => !doc.data().isRead).length);
    });

    return () => unsubscribe();
  }, []);

  // Reset the date filter when the department changes
  useEffect(() => {
    setDateFilter(EMPTY_FILTER);
    setAppliedFilter(EMPTY_FILTER);
  }, [department]);

  const applyDateFilter = () => {
    // Validate range: From cannot be after To
    if (dateFilter.from && dateFilter.to && dateFilter.from > dateFilter.to) {
      alert('The "From" date cannot be later than the "To" date.');
      return false;
    }
    setAppliedFilter(dateFilter);
    return true;
  };

  const clearDateFilter = () => {
    setDateFilter(EMPTY_FILTER);
    setAppliedFilter(EMPTY_FILTER);
  };

  const isFilterActive = Boolean(appliedFilter.from || appliedFilter.to);

  const filteredTickets = useMemo(
    () => filterTicketsByDate(tickets, appliedFilter),
    [tickets, appliedFilter]
  );

  /* -----------------------------------------------------------------------
     All analytics derive from the same shared ticket list — no duplicated
     fetching, so the Dashboard and Analytics can never disagree.
  ------------------------------------------------------------------------ */
  const analytics = useMemo(() => {
    const list = filteredTickets;
    const total = list.length;
    const pending = list.filter(t => t.status === 'Pending').length;
    const inProcess = list.filter(t => t.status === 'In Process').length;
    const resolved = list.filter(t => t.status === 'Resolved').length;
    const cancelled = list.filter(t => t.status === 'Cancelled').length;

    // Average resolution time across resolved tickets
    const resolvedTickets = list.filter(t => t.status === 'Resolved' && t.resolvedAt && t.createdAt);
    let avgResolutionTime = 'N/A';
    if (resolvedTickets.length > 0) {
      const totalTimeMs = resolvedTickets.reduce((sum, ticket) => {
        const created = getTicketDate(ticket.createdAt);
        const resolvedAt = getTicketDate(ticket.resolvedAt);
        return sum + ((resolvedAt && created) ? (resolvedAt - created) : 0);
      }, 0);
      const avgTimeMs = totalTimeMs / resolvedTickets.length;
      const hours = Math.floor(avgTimeMs / (1000 * 60 * 60));
      const mins = Math.floor((avgTimeMs % (1000 * 60 * 60)) / (1000 * 60));
      avgResolutionTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    const cancelledRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    // Monthly submission counts
    const monthCounts = {};
    MONTH_KEYS.forEach(m => { monthCounts[m] = 0; });
    list.forEach(ticket => {
      const date = getTicketDate(ticket.createdAt);
      if (date) monthCounts[MONTH_KEYS[date.getMonth()]]++;
    });
    const submissionData = MONTH_KEYS.map(month => ({ month, value: monthCounts[month] }));

    // Subject distribution
    const subjectCounts = {};
    list.forEach(ticket => {
      const subject = ticket.subject || 'Other';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    const subjectDistribution = Object.keys(subjectCounts)
      .map(subject => ({
        subject,
        count: subjectCounts[subject],
        percentage: total > 0 ? Math.round((subjectCounts[subject] / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      pending,
      inProcess,
      resolved,
      cancelled,
      avgResolutionTime,
      cancelledRate,
      submissionData,
      subjectDistribution
    };
  }, [filteredTickets]);

  // Staff activity attribution (resolved vs. handled per staff member)
  const staffActivity = useMemo(() => {
    return staffMembers
      .map(staff => {
        const handled = filteredTickets.filter(t =>
          t.assignedTo === staff.name || t.claimedBy === staff.name
        );
        const resolved = handled.filter(t => t.status === 'Resolved').length;
        return {
          name: staff.name,
          resolved,
          handled: handled.length,
          percentage: handled.length > 0 ? Math.round((resolved / handled.length) * 100) : 0
        };
      })
      .sort((a, b) => b.resolved - a.resolved);
  }, [staffMembers, filteredTickets]);

  const recentTickets = filteredTickets.slice(0, 6);

  /* Volume chart ticks */
  const chartMax = Math.max(1, ...analytics.submissionData.map(d => d.value));
  const tickStep = getNiceTickStep(chartMax);
  const topTick = Math.ceil(chartMax / tickStep) * tickStep;
  const yTicksDesc = [];
  for (let v = topTick; v >= 0; v -= tickStep) yTicksDesc.push(v);

  /* Donut segments */
  const donutTotal = STATUS_META.reduce((sum, meta) => sum + analytics[meta.key], 0);
  const donutSegments = [];
  // polar() already offsets by -90° internally, so 0° = 12 o'clock (top)
  let angle = 0;
  STATUS_META.forEach(meta => {
    const value = analytics[meta.key];
    if (value === 0) return;
    const sweep = donutTotal > 0 ? (value / donutTotal) * 360 : 0;
    if (sweep >= 359.9) {
      // Full ring — split into two half arcs so the path stays valid
      donutSegments.push({ ...meta, value, path: donutSegmentPath(angle, angle + 180) });
      donutSegments.push({ ...meta, value, path: donutSegmentPath(angle + 180, angle + 360) });
    } else {
      donutSegments.push({ ...meta, value, path: donutSegmentPath(angle, angle + sweep) });
    }
    angle += sweep;
  });

  /* Frequent requests chart bounds */
  const topSubjects = analytics.subjectDistribution.slice(0, 8);
  const maxSubjectCount = Math.max(1, ...topSubjects.map(s => s.count));

  const formatTicketDate = (ticket) => {
    const date = getTicketDate(ticket.createdAt);
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const exportToCSV = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csv = 'Request ID,Subject,Student,Student ID,Status,Assigned To,Created At\n';
    filteredTickets.forEach(t => {
      const created = getTicketDate(t.createdAt);
      csv += [
        esc(t.id), esc(t.subject), esc(t.studentName), esc(t.studentId),
        esc(t.status), esc(t.assignedTo), esc(created ? created.toISOString() : '')
      ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${String(department).toLowerCase().replace(/\s+/g, '-')}-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (ticketsLoading || staffLoading) {
    return <LoadingSpinner message="Loading analytics..." fullScreen={true} />;
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div className="analytics-header-left">
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">
Understand your office's performance at a glance
          </p>
        </div>
        <div className="analytics-header-actions">
          <button className="export-pdf-btn" onClick={exportToCSV}>
            <FaDownload />
            Export CSV
          </button>
          <DateRangeFilterDropdown
            filter={dateFilter}
            onFilterChange={setDateFilter}
            isActive={isFilterActive}
            onApply={applyDateFilter}
            onClear={clearDateFilter}
            appliedFilter={appliedFilter}
            idPrefix="analytics"
          />
          <div className="notification-bell" onClick={() => setShowNotifications(true)}>
            <FaBell className="bell-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
        </div>
      </div>

      {isFilterActive && (
        <div className="analytics-filter-summary">
          <FaCalendarAlt className="analytics-filter-summary-icon" aria-hidden="true" />
          <span>
            Showing <strong>{filteredTickets.length}</strong> request{filteredTickets.length === 1 ? '' : 's'}
            {appliedFilter.from && <> from <strong>{formatFilterDate(appliedFilter.from)}</strong></>}
            {appliedFilter.from && appliedFilter.to && <> to </>}
            {appliedFilter.to && <><strong>{formatFilterDate(appliedFilter.to)}</strong></>}
          </span>
        </div>
      )}

      {/* Summary cards — same live data as the Dashboard */}
      <div className="analytics-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-container">
            <FaBalanceScale className="stat-icon" />
          </div>
          <div className="stat-content">
            <p className="stat-label">OVERALL</p>
            <p className="stat-sublabel">Total Requests</p>
            <h2 className="stat-value">{analytics.total}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-container">
            <FaClock className="stat-icon" />
          </div>
          <div className="stat-content">
            <p className="stat-label">ACTIVITY</p>
            <p className="stat-sublabel">Avg Resolution Time</p>
            <h2 className="stat-value">{analytics.avgResolutionTime}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-container">
            <FaChartBar className="stat-icon" />
          </div>
          <div className="stat-content">
            <p className="stat-label">RATE</p>
            <p className="stat-sublabel">Cancelled Rate</p>
            <h2 className="stat-value">{analytics.cancelledRate}%</h2>
          </div>
        </div>
      </div>

      <div className="an-charts-grid">
        {/* Request Volume by Month */}
        <div className="an-chart-card an-chart-card--volume">
          <div className="an-chart-header">
            <div>
              <h3 className="an-chart-title">Request Volume by Month</h3>
              <p className="an-chart-subtitle">Requests submitted each month</p>
            </div>
          </div>

          <div className="an-volume-chart">
            <div className="an-volume-y-axis" aria-hidden="true">
              {yTicksDesc.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>

            <div className="an-volume-plot">
              <div className="an-volume-gridlines" aria-hidden="true">
                {yTicksDesc.map((tick, i) => (
                  <div
                    key={i}
                    className={`an-volume-gridline${tick === 0 ? ' an-volume-gridline--zero' : ''}`}
                    style={{ bottom: `${(tick / topTick) * 100}%` }}
                  />
                ))}
              </div>

              <div className="an-volume-bars">
                {analytics.submissionData.map((data, index) => {
                  const monthNum = index + 1;
                  let isInRange = false;
                  if (isFilterActive) {
                    const fromMonth = appliedFilter.from ? parseInt(appliedFilter.from.split('-')[1], 10) : 1;
                    const toMonth = appliedFilter.to ? parseInt(appliedFilter.to.split('-')[1], 10) : 12;
                    if (fromMonth <= toMonth) {
                      isInRange = monthNum >= fromMonth && monthNum <= toMonth;
                    } else {
                      // Range wraps around the year boundary (e.g. Nov → Feb)
                      isInRange = monthNum >= fromMonth || monthNum <= toMonth;
                    }
                  }

                  return (
                    <div
                      key={index}
                      className="an-volume-group"
                      role="img"
                      aria-label={`${data.month}: ${data.value} ${data.value === 1 ? 'request' : 'requests'}`}
                    >
                      <div className="an-volume-track">
                        <div
                          className={`an-volume-bar${data.value > 0 ? '' : ' an-volume-bar--empty'}${isInRange ? ' an-volume-bar--in-range' : ''}`}
                          data-tip={data.value > 0
                            ? `${data.month}: ${data.value} request${data.value === 1 ? '' : 's'}`
                            : `${data.month}: No requests yet`}
                          style={{
                            height: `${(data.value / topTick) * 100}%`,
                            animationDelay: `${index * 0.05}s`
                          }}
                        ></div>
                      </div>
                      <span className="an-volume-label">{data.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Status Breakdown donut */}
        <div className="an-chart-card">
          <div className="an-chart-header">
            <div>
              <h3 className="an-chart-title">Status Breakdown</h3>
              <p className="an-chart-subtitle">Requests by current status</p>
            </div>
          </div>

          {donutTotal === 0 ? (
            <div className="an-empty">No request data yet</div>
          ) : (
            <div className="an-donut-layout">
              <div className="an-donut-wrap">
                <svg viewBox="0 0 200 200" className="an-donut" role="img" aria-label="Requests by status">
                  {donutSegments.map((segment, index) => (
                    <path
                      key={index}
                      d={segment.path}
                      fill={segment.color}
                      className="an-donut-segment"
                      style={{ animationDelay: `${index * 0.08}s` }}
                    >
                      <title>
                        {segment.label}: {segment.value} request{segment.value === 1 ? '' : 's'} (
                        {donutTotal > 0 ? Math.round((segment.value / donutTotal) * 100) : 0}%)
                      </title>
                    </path>
                  ))}
                </svg>
                <div className="an-donut-center">
                  <strong>{donutTotal}</strong>
                  <span>requests</span>
                </div>
              </div>

              <div className="an-donut-legend">
                {STATUS_META.map(meta => {
                  const value = analytics[meta.key];
                  return (
                    <div key={meta.key} className="an-donut-item">
                      <span className="an-donut-swatch" style={{ backgroundColor: meta.color }} aria-hidden="true"></span>
                      <span className="an-donut-label">{meta.label}</span>
                      <span className="an-donut-count">
                        {value}
                        <em>{donutTotal > 0 ? Math.round((value / donutTotal) * 100) : 0}%</em>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Frequent Request Subjects */}
        <div className="an-chart-card an-chart-card--frequent">
          <div className="an-chart-header">
            <div>
              <h3 className="an-chart-title">Frequent Request Subjects</h3>
              <p className="an-chart-subtitle">Most requested subjects</p>
            </div>
          </div>

          {topSubjects.length === 0 ? (
            <div className="an-empty">No request data yet</div>
          ) : (
            <div className="an-freq-list">
              {topSubjects.map((item, index) => (
                <div key={index} className="an-freq-row">
                  <div className="an-freq-meta">
                    <span
                      className="an-freq-dot"
                      style={{ backgroundColor: SUBJECT_COLORS[index % SUBJECT_COLORS.length] }}
                      aria-hidden="true"
                    ></span>
                    <span className="an-freq-name" title={item.subject}>{item.subject}</span>
                    <span className="an-freq-count">{item.count}</span>
                  </div>
                  <div className="an-freq-track">
                    <div
                      className="an-freq-fill"
                      style={{
                        width: `${(item.count / maxSubjectCount) * 100}%`,
                        backgroundColor: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
                        animationDelay: `${index * 0.06}s`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff Activity */}
        <div className="an-chart-card">
          <div className="an-chart-header">
            <div>
              <h3 className="an-chart-title">Staff Activity</h3>
              <p className="an-chart-subtitle">Resolved requests per staff member</p>
            </div>
          </div>

          {staffActivity.length === 0 ? (
            <div className="an-empty">No staff in this office yet</div>
          ) : (
            <div className="an-staff-list">
              {staffActivity.map((staff, index) => (
                <div key={index} className="an-staff-row">
                  <div className="an-staff-info">
                    <FaUserCircle className="an-staff-avatar" />
                    <div className="an-staff-details">
                      <span className="an-staff-name">{staff.name}</span>
                      <span className="an-staff-count">
                        {staff.resolved} of {staff.handled} handled
                      </span>
                    </div>
                    <span className="an-staff-pct">{staff.percentage}%</span>
                  </div>
                  <div className="an-progress-bg">
                    <div
                      className="an-progress-fill"
                      style={{ width: `${staff.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Requests */}
      <div className="an-recent">
        <div className="an-chart-header an-recent-header">
          <div>
            <h3 className="an-chart-title">Recent Requests</h3>
            <p className="an-chart-subtitle">The latest requests in {department}'s office</p>
          </div>
        </div>

        {recentTickets.length === 0 ? (
          <div className="an-empty">No requests yet</div>
        ) : (
          <div className="an-recent-table-wrap">
            <table className="an-recent-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.map(ticket => (
                  <tr key={ticket.firestoreId}>
                    <td>
                      <div className="an-recent-title">{ticket.title}</div>
                      <span className="an-recent-id">#{ticket.id}</span>
                    </td>
                    <td>
                      <div className="an-recent-student">{ticket.student}</div>
                      <span className="an-recent-id">ID: {ticket.studentId}</span>
                    </td>
                    <td>
                      <span className={`an-status-badge an-status-badge--${String(ticket.status || '').toLowerCase().replace(' ', '')}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>{ticket.assignedTo || <span className="an-recent-unassigned">Unassigned</span>}</td>
                    <td>{formatTicketDate(ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />
    </div>
  );
};

export default Analytics;
