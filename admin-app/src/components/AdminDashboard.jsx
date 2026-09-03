import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FaBell,
  FaInbox,
  FaTicketAlt,
  FaClipboard,
  FaCheckCircle,
  FaUserCircle,
  FaClock,
  FaExclamationTriangle,
  FaSearch,
  FaTimes,
  FaEye
} from 'react-icons/fa';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import Notifications from './Notifications';
import ClaimETCModal from './ClaimETCModal';
import NearingCompletionModal from './NearingCompletionModal';
import { getNearingRequests, getNearingSummary } from '../utils/etcHelper';
import { notifyStudentStatusChange, notifyStudentEtcChange } from '../utils/notificationHelper';
import { useOfficeTickets } from '../hooks/useOfficeTickets';
import LoadingSpinner from './LoadingSpinner';
import '../styles/AdminDashboard.css';

const AdminDashboard = ({ department, onNavigate, onViewRequest }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [timeFilter, setTimeFilter] = useState('month');
  const [searchQuery, setSearchQuery] = useState('');
  const { tickets, loading } = useOfficeTickets(department);
  const [staffData, setStaffData] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [claimingTicketId, setClaimingTicketId] = useState(null);
  const itemsPerPage = 5;
  // Ticket awaiting its Estimated Time of Completion in the claim modal.
  const [etcClaimTicket, setEtcClaimTicket] = useState(null);
  const ticketsSectionRef = useRef(null);
  
  // Nearing Estimated Completion Date Modal & Alert states
  const [showNearingModal, setShowNearingModal] = useState(false);
  const hasAutoOpenedModal = useRef(false);

  useEffect(() => {
    // Get staff data from localStorage
    const storedStaffData = localStorage.getItem('staffData');
    if (storedStaffData) {
      const parsedData = JSON.parse(storedStaffData);
      console.log('[AdminDashboard] Staff office:', parsedData.office);
      console.log('[AdminDashboard] Department prop:', department);
      setStaffData(parsedData);
    }
  }, [department]);

  // Real-time unread notifications listener
  useEffect(() => {
    if (!staffData?.uid) return undefined;

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', staffData.uid),
      where('recipientType', '==', 'staff')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const unread = querySnapshot.docs.filter(doc => !doc.data().isRead).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [staffData]);

  // Reset pagination when switching tabs or typing search
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Dashboard summary cards — derived straight from the shared live tickets
  const stats = useMemo(() => ({
    total: tickets.length,
    // Cancelled tickets have no assignee but are NOT awaiting assignment
    unassigned: tickets.filter(t => !t.assignedTo && t.status !== 'Cancelled').length,
    claimed: tickets.filter(t => t.status === 'In Process').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length
  }), [tickets]);

  // Tab counters for tab badges
  const tabCounts = useMemo(() => {
    return {
      all: tickets.length,
      newReq: tickets.filter(t => t.status !== 'Cancelled' && (t.status === 'Pending' || !t.assignedTo)).length,
      progress: tickets.filter(t => t.status === 'In Process').length,
      resolved: tickets.filter(t => t.status === 'Resolved').length
    };
  }, [tickets]);

  // Date formatting helpers for table display
  const formatTicketDate = (ticket) => {
    const val = ticket.createdAt;
    if (!val) return null;
    const date = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTicketEtc = (ticket) => {
    const val = ticket.etc || ticket.estimatedCompletion;
    if (!val) return null;
    if (typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return val;
    }
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return null;
  };

  // Compute requests nearing or past estimated completion date
  const nearingRequests = useMemo(() => {
    return getNearingRequests(tickets, 3);
  }, [tickets]);

  const nearingSummary = useMemo(() => {
    return getNearingSummary(nearingRequests);
  }, [nearingRequests]);

  // Auto-trigger modal popup on dashboard load if active requests are nearing/overdue
  useEffect(() => {
    if (loading || hasAutoOpenedModal.current) return;

    if (nearingRequests.length > 0) {
      try {
        const isDismissed = sessionStorage.getItem('dismissed_nearing_etc_popup') === 'true';
        if (!isDismissed) {
          setShowNearingModal(true);
          hasAutoOpenedModal.current = true;
        }
      } catch (e) {
        setShowNearingModal(true);
        hasAutoOpenedModal.current = true;
      }
    }
  }, [loading, nearingRequests]);

  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];

    // Filter by tab
    if (activeTab === 'new') {
      // Cancelled tickets aren't "new" — they only match because they have
      // no assignee, so exclude them explicitly.
      filtered = filtered.filter(t => t.status !== 'Cancelled' && (t.status === 'Pending' || !t.assignedTo));
    } else if (activeTab === 'progress') {
      filtered = filtered.filter(t => t.status === 'In Process');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(t => t.status === 'Resolved');
    }

    // Filter by search query (matches ID, title/subject, student name, student ID, assignee)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const id = String(t.id || t.requestId || '').toLowerCase();
        const title = String(t.title || t.subject || '').toLowerCase();
        const student = String(t.student || t.studentName || '').toLowerCase();
        const studentId = String(t.studentId || '').toLowerCase();
        const assigned = String(t.assignedTo || '').toLowerCase();
        return (
          id.includes(q) ||
          title.includes(q) ||
          student.includes(q) ||
          studentId.includes(q) ||
          assigned.includes(q)
        );
      });
    }

    return filtered;
  }, [activeTab, tickets, searchQuery]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTickets, currentPage, itemsPerPage]);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  // Stat cards double as quick filters: clicking one switches the ticket
  // table to the matching tab (All / New Tickets / In Progress / Resolved)
  // and scrolls it into view. Clicking the already-active card resets to All.
  const handleStatCardClick = (tab) => {
    setActiveTab((prev) => (prev === tab ? 'all' : tab));
    setSearchQuery('');
    setCurrentPage(1);
    ticketsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleClaimTicket = async (ticket, etc = '') => {
    if (!staffData) {
      alert('Staff data not found. Please login again.');
      return;
    }

    setClaimingTicketId(ticket.firestoreId);

    // Standard claim state transition (the interact onSuccess step). The
    // optional `etc` (confirmed date) rides along on the same update so the
    // Management Control panel and the student are in sync immediately.
    const updateData = {
      assignedTo: staffData.name,
      assignedToStaff: staffData.name,
      status: 'In Process',
      claimedAt: new Date(),
      claimedBy: staffData.name
    };

    if (etc) {
      updateData.etc = etc;
      updateData.etcUpdatedBy = staffData.name;
      updateData.etcUpdatedAt = serverTimestamp();
    }

    try {
      // Update ticket in Firestore (the shared live listener refreshes the UI)
      const ticketRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(ticketRef, updateData);

      console.log('✅ Ticket claimed by', staffData.name, etc ? `with ETC ${etc}` : 'without ETC');

      // Create notification for the student about status change
      if (ticket.studentUid) {
        await notifyStudentStatusChange(
          ticket.studentUid,
          ticket.id || ticket.requestId,
          ticket.title || ticket.subject,
          ticket.status || 'Pending',
          'In Process'
        );
        console.log('[Success] Notification sent to student');
      } else {
        console.warn('[Warning] Student UID not found in ticket, notification not sent');
      }

      // Notify the student about the new estimated completion date when one
      // was set during claiming.
      if (etc && ticket.studentUid) {
        await notifyStudentEtcChange(ticket.studentUid, ticket.id || ticket.requestId, ticket.title || ticket.subject, etc);
      }

      alert(`Request ${ticket.id || ticket.requestId} has been assigned to you!`);
    } catch (error) {
      console.error('[Error] Error claiming ticket:', error);
      alert('Failed to claim request: ' + error.message);
    } finally {
      setClaimingTicketId(null);
    }
  };

  // Intercept the claim click: open the ETC modal instead of transitioning
  // the ticket immediately. The claim only proceeds once this modal concludes.
  const handleClaimRequest = (ticket) => {
    setEtcClaimTicket(ticket);
  };

  // Primary action: save the confirmed date, close the modal, then claim.
  const handleEtcConfirm = async (date) => {
    if (!etcClaimTicket) return;
    const ticket = etcClaimTicket;
    setEtcClaimTicket(null);
    await handleClaimTicket(ticket, date);
  };

  // Cancel: close the modal without claiming — the ticket stays unclaimed.
  const handleEtcCancel = () => {
    setEtcClaimTicket(null);
  };

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{department}'s Office</h1>
          <p className="dashboard-subtitle">Monitor and manage all student requests in your office</p>
        </div>
        <div className="header-right">
          {nearingRequests.length > 0 && (
            <button
              type="button"
              className={`nearing-trigger-btn ${nearingSummary.overdue > 0 ? 'critical' : 'warning'}`}
              onClick={() => setShowNearingModal(true)}
              title={`${nearingRequests.length} request(s) nearing or past estimated completion`}
              aria-label={`${nearingRequests.length} request(s) nearing or past estimated completion`}
            >
              <FaClock className="trigger-icon" />
              <span className="trigger-text">
                {nearingSummary.overdue > 0 ? `${nearingSummary.overdue} Overdue` : `${nearingRequests.length} Nearing ETC`}
              </span>
              <span className="trigger-badge">{nearingRequests.length}</span>
            </button>
          )}

          <div className="time-filter">
            <button
              className={`filter-btn ${timeFilter === 'week' ? 'active' : ''}`}
              onClick={() => setTimeFilter('week')}
            >
              Week
            </button>
            <button
              className={`filter-btn ${timeFilter === 'month' ? 'active' : ''}`}
              onClick={() => setTimeFilter('month')}
            >
              Month
            </button>
          </div>
          <div className="notification-bell" onClick={() => setShowNotifications(true)}>
            <FaBell className="bell-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <button
          type="button"
          className={`stat-card stat-total ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('all')}
          aria-pressed={activeTab === 'all'}
          aria-label="Show all requests in the dashboard table"
        >
          <span className="stat-header">
            <span className="stat-icon-container">
              <FaInbox className="stat-icon" />
            </span>
            <span className="stat-label">Total</span>
          </span>
          <span className="stat-value">{stats.total}</span>
          <span className="stat-subtext">All Requests</span>
        </button>

        <button
          type="button"
          className={`stat-card stat-pending ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('new')}
          aria-pressed={activeTab === 'new'}
          aria-label="Show pending requests awaiting assignment in the dashboard table"
        >
          <span className="stat-header">
            <span className="stat-icon-container">
              <FaTicketAlt className="stat-icon" />
            </span>
            <span className="stat-label">Pending</span>
          </span>
          <span className="stat-value">{stats.unassigned}</span>
          <span className="stat-subtext">Awaiting Assignment</span>
        </button>

        <button
          type="button"
          className={`stat-card stat-inprogress ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('progress')}
          aria-pressed={activeTab === 'progress'}
          aria-label="Show in progress requests in the dashboard table"
        >
          <span className="stat-header">
            <span className="stat-icon-container">
              <FaClipboard className="stat-icon" />
            </span>
            <span className="stat-label">In Progress</span>
          </span>
          <span className="stat-value">{stats.claimed}</span>
          <span className="stat-subtext">Being Handled</span>
        </button>

        <button
          type="button"
          className={`stat-card stat-resolved ${activeTab === 'resolved' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('resolved')}
          aria-pressed={activeTab === 'resolved'}
          aria-label="Show resolved requests in the dashboard table"
        >
          <span className="stat-header">
            <span className="stat-icon-container">
              <FaCheckCircle className="stat-icon" />
            </span>
            <span className="stat-label">Resolved</span>
          </span>
          <span className="stat-value">{stats.resolved}</span>
          <span className="stat-subtext">Completed</span>
        </button>
      </div>

      {/* Nearing Estimated Completion Date Alert Banner */}
      {nearingRequests.length > 0 && (
        <div className={`nearing-alert-banner ${nearingSummary.overdue > 0 ? 'banner-critical' : 'banner-warning'}`}>
          <div className="banner-left">
            <div className="banner-icon-box">
              {nearingSummary.overdue > 0 ? <FaExclamationTriangle /> : <FaClock />}
            </div>
            <div className="banner-info">
              <h3 className="banner-heading">
                {nearingSummary.overdue > 0
                  ? `Attention Required: ${nearingSummary.overdue} request(s) overdue • ${nearingRequests.length} nearing completion`
                  : `Reminder: ${nearingRequests.length} request(s) nearing estimated completion date`}
              </h3>
              <p className="banner-subtext">
                {nearingSummary.overdue > 0 && <strong>{nearingSummary.overdue} overdue • </strong>}
                {nearingSummary.today > 0 && <strong>{nearingSummary.today} due today • </strong>}
                {nearingSummary.upcoming > 0 && `${nearingSummary.upcoming} due soon • `}
                Review all requests needed to process before deadlines lapse.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="banner-review-btn"
            onClick={() => setShowNearingModal(true)}
          >
            Review Summary Modal
          </button>
        </div>
      )}

      <div className="tickets-section" ref={ticketsSectionRef}>
        <div className="tickets-toolbar">
          <div className="tickets-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>All</span>
              <span className="tab-badge">{tabCounts.all}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'new'}
              className={`tab ${activeTab === 'new' ? 'active' : ''}`}
              onClick={() => setActiveTab('new')}
            >
              <span>New Requests</span>
              {tabCounts.newReq > 0 && <span className="tab-badge new-badge">{tabCounts.newReq}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'progress'}
              className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              <span>In Progress</span>
              {tabCounts.progress > 0 && <span className="tab-badge inprogress-badge">{tabCounts.progress}</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'resolved'}
              className={`tab ${activeTab === 'resolved' ? 'active' : ''}`}
              onClick={() => setActiveTab('resolved')}
            >
              <span>Resolved</span>
              {tabCounts.resolved > 0 && <span className="tab-badge resolved-badge">{tabCounts.resolved}</span>}
            </button>
          </div>

          <div className="table-search-box">
            <FaSearch className="table-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="table-search-input"
              placeholder="Search by ID, student, or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search requests in table"
            />
            {searchQuery && (
              <button
                type="button"
                className="table-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                title="Clear search"
              >
                <FaTimes aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading requests..." fullScreen={false} />
        ) : filteredTickets.length === 0 ? (
          <div className="tickets-empty-state">
            <div className="empty-icon-wrap">
              <FaInbox className="empty-icon" />
            </div>
            <h3 className="empty-title">
              {searchQuery ? 'No matching requests found' : 'No requests in this view'}
            </h3>
            <p className="empty-desc">
              {searchQuery
                ? `No requests match "${searchQuery}". Check the request number, subject, or student name.`
                : activeTab === 'all'
                ? 'Your office currently has no requests recorded.'
                : `There are currently no ${
                    activeTab === 'new'
                      ? 'new requests awaiting assignment'
                      : activeTab === 'progress'
                      ? 'requests currently being handled'
                      : 'completed/resolved requests'
                  }.`}
            </p>
            {searchQuery ? (
              <button
                type="button"
                className="empty-action-btn"
                onClick={() => setSearchQuery('')}
              >
                Clear Search Filter
              </button>
            ) : activeTab !== 'all' ? (
              <button
                type="button"
                className="empty-action-btn"
                onClick={() => setActiveTab('all')}
              >
                View All Requests
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th className="th-request">REQUEST INFO</th>
                    <th className="th-student">STUDENT DETAILS</th>
                    <th className="th-status">STATUS</th>
                    <th className="th-assigned">ASSIGNED TO</th>
                    <th className="th-actions">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTickets.map((ticket, index) => {
                    const ticketIdDisplay = ticket.id
                      ? String(ticket.id).startsWith('#')
                        ? ticket.id
                        : `#${ticket.id}`
                      : '#N/A';
                    const formattedDate = formatTicketDate(ticket);
                    const formattedEtc = formatTicketEtc(ticket);
                    const isGuest = Boolean(ticket.isGuest);
                    const studentName = ticket.student || ticket.studentName || (isGuest ? 'Guest User' : 'Student');

                    return (
                      <tr key={ticket.firestoreId || ticket.id || index} className="ticket-row">
                        <td className="td-request">
                          <div className="ticket-info-cell">
                            <button
                              type="button"
                              className="ticket-title-link"
                              onClick={() => onNavigate('ticket-details', ticket)}
                              title={ticket.title || ticket.subject || 'View Request Details'}
                            >
                              {ticket.title || ticket.subject || 'Untitled Request'}
                            </button>
                            <div className="ticket-meta-row">
                              <span className="ticket-id">{ticketIdDisplay}</span>
                              {formattedDate && (
                                <span className="ticket-meta-date" title={`Submitted on ${formattedDate}`}>
                                  • {formattedDate}
                                </span>
                              )}
                              {formattedEtc && (
                                <span className="ticket-meta-etc" title={`Estimated turnaround: ${formattedEtc}`}>
                                  <FaClock className="meta-clock-icon" aria-hidden="true" /> {formattedEtc}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="td-student">
                          <div className="student-info">
                            <span className="student-name">{studentName}</span>
                            <div className="student-id-wrap">
                              {isGuest ? (
                                <span className="guest-badge-pill">Guest</span>
                              ) : ticket.studentId ? (
                                <span className="student-id">ID: {ticket.studentId}</span>
                              ) : (
                                <span className="student-id muted">ID: N/A</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="td-status">
                          <span className={`status-badge status-${(ticket.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                            <span className="status-dot" aria-hidden="true" />
                            {ticket.status === 'Pending' && 'New Request'}
                            {ticket.status === 'In Process' && 'In Progress'}
                            {ticket.status === 'Resolved' && 'Resolved'}
                            {ticket.status === 'Cancelled' && 'Cancelled'}
                            {ticket.status === 'Rejected' && 'Rejected'}
                            {ticket.status === 'Returned' && 'Returned'}
                            {!['Pending', 'In Process', 'Resolved', 'Cancelled', 'Rejected', 'Returned'].includes(ticket.status) && (ticket.status || 'Pending')}
                          </span>
                        </td>
                        <td className="td-assigned">
                          {ticket.assignedTo ? (
                            <div className="assigned-to">
                              <FaUserCircle className="assigned-icon" />
                              <span className="assigned-name">{ticket.assignedTo}</span>
                            </div>
                          ) : (
                            <span className="unassigned-pill">Unassigned</span>
                          )}
                        </td>
                        <td className="td-actions">
                          <div className="table-actions-cell">
                            {ticket.status === 'Cancelled' ? (
                              <button
                                type="button"
                                className="action-btn view-btn"
                                onClick={() => onNavigate('ticket-details', ticket)}
                                title="View details of cancelled request"
                              >
                                View Request
                              </button>
                            ) : ticket.assignedTo ? (
                              <button
                                type="button"
                                className="action-btn view-btn"
                                onClick={() => onNavigate('ticket-details', ticket)}
                                title="View Request Details"
                              >
                                View Request
                              </button>
                            ) : (
                              <div className="action-button-group">
                                <button
                                  type="button"
                                  className="action-btn claim-btn"
                                  onClick={() => handleClaimRequest(ticket)}
                                  disabled={claimingTicketId === ticket.firestoreId}
                                  title="Claim request and set turnaround time"
                                >
                                  {claimingTicketId === ticket.firestoreId ? 'Claiming...' : 'Claim Request'}
                                </button>
                                <button
                                  type="button"
                                  className="action-btn icon-view-btn"
                                  onClick={() => onNavigate('ticket-details', ticket)}
                                  title="Preview Request Details"
                                  aria-label="Preview Request Details"
                                >
                                  <FaEye aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    type="button"
                    className="page-btn nav-btn"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous Page"
                  >
                    &lt;
                  </button>
                  {getPageNumbers().map((page, idx) =>
                    page === '...' ? (
                      <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        className={`page-btn ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                        aria-current={currentPage === page ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="page-btn nav-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Next Page"
                  >
                    &gt;
                  </button>
                </div>
              )}

              <div className="table-count-info">
                Showing{' '}
                <span className="count-bold">
                  {filteredTickets.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                </span>
                –
                <span className="count-bold">
                  {Math.min(currentPage * itemsPerPage, filteredTickets.length)}
                </span>{' '}
                of <span className="count-bold">{filteredTickets.length}</span> request{filteredTickets.length === 1 ? '' : 's'}
                {searchQuery && <span className="search-query-label"> (filtered)</span>}
              </div>
            </div>
          </>
        )}
      </div>

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />

      {etcClaimTicket && (
        <ClaimETCModal
          ticket={etcClaimTicket}
          onConfirm={handleEtcConfirm}
          onCancel={handleEtcCancel}
        />
      )}

      {/* Modal: Summary of Requests Nearing Estimated Completion */}
      <NearingCompletionModal
        isOpen={showNearingModal}
        onClose={() => setShowNearingModal(false)}
        tickets={tickets}
        department={department}
        onViewRequest={onViewRequest}
        onGoToQueue={() => {
          setActiveTab('progress');
          ticketsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />
    </div>
  );
};

export default AdminDashboard;
