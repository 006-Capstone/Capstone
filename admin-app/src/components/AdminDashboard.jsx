import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FaBell,
  FaInbox,
  FaTicketAlt,
  FaUserCircle,
  FaClock,
  FaExclamationTriangle,
  FaSearch,
  FaTimes
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
  const [activeTab, setActiveTab] = useState('new');
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

  // Helper to extract timestamp from ticket
  const getTicketTimestamp = (ticket) => {
    if (ticket.createdAtTimestamp && ticket.createdAtTimestamp > 0) {
      return ticket.createdAtTimestamp;
    }
    const val = ticket.createdAt || ticket.date;
    if (!val) return 0;
    if (val?.toDate) return val.toDate().getTime();
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Compute tickets created today (since 00:00:00 today)
  const todayTicketsCount = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return tickets.filter(t => {
      const ts = getTicketTimestamp(t);
      return ts >= startOfToday;
    }).length;
  }, [tickets]);

  // Helper to extract claim timestamp from ticket
  const getTicketClaimedTimestamp = (ticket) => {
    const val = ticket.claimedAt || (ticket.status === 'In Process' ? (ticket.updatedAt || ticket.createdAt) : null);
    if (!val) return 0;
    if (val?.toDate) return val.toDate().getTime();
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Anti-Hoarding Rule:
  // If staff has 10 or more requests still in In Progress, limit accepting requests to 5 per day.
  const HOARDING_IN_PROGRESS_THRESHOLD = 10;
  const HOARDING_DAILY_LIMIT = 5;

  // Compute logged-in staff's own ticket metrics (In Progress and Resolved)
  const myStats = useMemo(() => {
    if (!staffData?.name) return { inProgress: 0, resolved: 0 };
    const staffName = (staffData.name || '').trim().toLowerCase();
    const staffUid = staffData.uid;

    const isMine = (t) => {
      const assigned = (t.assignedTo || '').trim().toLowerCase();
      const claimed = (t.claimedBy || '').trim().toLowerCase();
      const resolved = (t.resolvedBy || '').trim().toLowerCase();
      return (
        (assigned && assigned === staffName) ||
        (claimed && claimed === staffName) ||
        (resolved && resolved === staffName) ||
        (staffUid && t.assignedToStaff === staffUid)
      );
    };

    const inProgress = tickets.filter(t => isMine(t) && t.status === 'In Process').length;
    const resolved = tickets.filter(t => isMine(t) && t.status === 'Resolved').length;

    return { inProgress, resolved };
  }, [tickets, staffData]);

  // Requests currently in progress for this staff (used by anti-hoarding rule)
  const myInProgressCount = myStats.inProgress;

  // Compute requests accepted/claimed today by currently logged-in staff
  const myAcceptedTodayCount = useMemo(() => {
    if (!staffData?.name) return 0;
    const name = staffData.name.toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return tickets.filter(t => {
      const assigned = String(t.assignedTo || t.claimedBy || '').toLowerCase();
      if (assigned !== name) return false;
      const claimedTs = getTicketClaimedTimestamp(t);
      return claimedTs >= startOfToday;
    }).length;
  }, [tickets, staffData]);

  const isUnderHoardingRestriction = myInProgressCount >= HOARDING_IN_PROGRESS_THRESHOLD;
  const isAtClaimLimit = isUnderHoardingRestriction && myAcceptedTodayCount >= HOARDING_DAILY_LIMIT;

  // Reset pagination when switching tabs or typing search
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Dashboard summary cards — derived straight from office tickets
  const stats = useMemo(() => {
    const total = tickets.length;
    const unassigned = tickets.filter(t => !t.assignedTo && t.status !== 'Cancelled').length;
    const claimed = tickets.filter(t => t.status === 'In Process').length;
    const resolved = tickets.filter(t => t.status === 'Resolved').length;
    const active = unassigned + claimed;

    return {
      total,
      unassigned,
      claimed,
      resolved,
      active
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

    // Filter by search query (matches ID, title/subject, student name, student ID, assignee, urgency)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const id = String(t.id || t.requestId || '').toLowerCase();
        const title = String(t.title || t.subject || '').toLowerCase();
        const student = String(t.student || t.studentName || '').toLowerCase();
        const studentId = String(t.studentId || '').toLowerCase();
        const assigned = String(t.assignedTo || '').toLowerCase();
        const urgency = String(t.urgencyLevel || '').toLowerCase();
        return (
          id.includes(q) ||
          title.includes(q) ||
          student.includes(q) ||
          studentId.includes(q) ||
          assigned.includes(q) ||
          urgency.includes(q)
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


  const handleClaimTicket = async (ticket, etc = '') => {
    if (!staffData) {
      alert('Staff data not found. Please login again.');
      return;
    }

    if (isAtClaimLimit) {
      alert(
        `Anti-Hoarding Policy:\nYou currently have ${myInProgressCount} requests in In Progress (threshold: ${HOARDING_IN_PROGRESS_THRESHOLD}) and have already accepted ${myAcceptedTodayCount} requests today (limit: ${HOARDING_DAILY_LIMIT} per day).\n\nPlease complete and resolve your current in-progress requests before accepting more.`
      );
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

  // Intercept the claim click: check anti-hoarding rule, then open ETC modal
  const handleClaimRequest = (ticket) => {
    if (isAtClaimLimit) {
      alert(
        `Anti-Hoarding Policy:\n\nYou currently have ${myInProgressCount} requests in In Progress (threshold: ${HOARDING_IN_PROGRESS_THRESHOLD}) and have already accepted ${myAcceptedTodayCount} requests today (daily limit: ${HOARDING_DAILY_LIMIT} per day).\n\nTo ensure fair distribution and prevent backlogs, please finish and resolve your active in-progress requests before accepting new ones today.`
      );
      return;
    }
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
        <div className="dashboard-title-group">
          <h1 className="dashboard-title">{department}'s Office</h1>
          <p className="dashboard-subtitle">
            Monitor and manage student requests
          </p>
        </div>
        <div className="header-right">
          <div className="notification-bell" onClick={() => setShowNotifications(true)} title="Notifications">
            <FaBell className="bell-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card stat-total">
          <div className="stat-total-top">
            <span className="stat-header">
              <span className="stat-icon-container">
                <FaInbox className="stat-icon" />
              </span>
              <span className="stat-label">Total Requests</span>
            </span>
            <span className="stat-total-badge">Office Overview</span>
          </div>

          <div className="stat-total-middle">
            <div className="stat-number-wrapper">
              <span className="stat-value">{stats.total}</span>
              {todayTicketsCount > 0 && (
                <span className="stat-today-badge" title={`${todayTicketsCount} new request(s) received today`}>
                  +{todayTicketsCount} today
                </span>
              )}
            </div>
            <span className="stat-subtext">All Requests Recorded</span>
          </div>

          <div className="stat-total-footer">
            <div className="anti-hoard-strip">
              <span className="anti-hoard-policy" title="Anti-Hoarding Rule: Staff with 10+ requests in progress are limited to accepting 5 requests per day">
                <span className="policy-dot" />
                Anti-Hoarding Rule: 10+ in progress → max 5 claims/day
              </span>
              {staffData?.name && (
                <span
                  className={`staff-load-badge ${isAtClaimLimit ? 'limit-reached' : isUnderHoardingRestriction ? 'warning' : ''}`}
                  title={
                    isUnderHoardingRestriction
                      ? `Anti-hoarding restricted: ${myInProgressCount} in progress (≥${HOARDING_IN_PROGRESS_THRESHOLD}). Today's accepted requests: ${myAcceptedTodayCount}/${HOARDING_DAILY_LIMIT}`
                      : `My In Progress: ${myInProgressCount} (Daily limit applies when reaching ${HOARDING_IN_PROGRESS_THRESHOLD})`
                  }
                >
                  {isUnderHoardingRestriction ? (
                    <>Accepted Today: <strong>{myAcceptedTodayCount}/{HOARDING_DAILY_LIMIT}</strong></>
                  ) : (
                    <>In Progress: <strong>{myInProgressCount}</strong></>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Rectangular Pending on top, 4 Square cards below in 2x2 grid */}
        <div className="stats-right-section">
          {/* Pending Card (Stays rectangular) */}
          <div className="stat-card stat-pending">
            <div className="stat-card-left">
              <span className="stat-icon-container">
                <FaTicketAlt className="stat-icon" />
              </span>
              <div className="stat-card-text">
                <div className="stat-label-group">
                  <span className="stat-label">Pending</span>
                  <span className="scope-tag office">Office</span>
                </div>
                <span className="stat-subtext">Awaiting Assignment</span>
              </div>
            </div>
            <span className="stat-value">{stats.unassigned}</span>
          </div>

          {/* 4 Square Cards Grid (2x2) */}
          <div className="stats-squares-grid">
            {/* Office In Progress */}
            <div className="stat-card stat-card-square stat-inprogress">
              <div className="stat-card-text">
                <div className="stat-label-group">
                  <span className="stat-label">In Progress</span>
                  <span className="scope-tag office">Office</span>
                </div>
                <span className="stat-subtext">Office Overall</span>
              </div>
              <span className="stat-value">{stats.claimed}</span>
            </div>

            {/* Office Resolved */}
            <div className="stat-card stat-card-square stat-resolved">
              <div className="stat-card-text">
                <div className="stat-label-group">
                  <span className="stat-label">Resolved</span>
                  <span className="scope-tag office">Office</span>
                </div>
                <span className="stat-subtext">Office Overall</span>
              </div>
              <span className="stat-value">{stats.resolved}</span>
            </div>

            {/* Staff's My In Progress */}
            <div className="stat-card stat-card-square stat-my-inprogress">
              <div className="stat-card-text">
                <div className="stat-label-group">
                  <span className="stat-label">My In Progress</span>
                  <span className="scope-tag personal">My Workload</span>
                </div>
                <span className="stat-subtext">Assigned to You</span>
              </div>
              <span className="stat-value">{myStats.inProgress}</span>
            </div>

            {/* Staff's My Resolved */}
            <div className="stat-card stat-card-square stat-my-resolved">
              <div className="stat-card-text">
                <div className="stat-label-group">
                  <span className="stat-label">My Resolved</span>
                  <span className="scope-tag personal">My Workload</span>
                </div>
                <span className="stat-subtext">Completed by You</span>
              </div>
              <span className="stat-value">{myStats.resolved}</span>
            </div>
          </div>
        </div>
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
          <div className="toolbar-left-group">
            <div className="tickets-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'new'}
                className={`tab ${activeTab === 'new' ? 'active' : ''}`}
                onClick={() => setActiveTab('new')}
              >
                <span>New Requests</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'progress'}
                className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
                onClick={() => setActiveTab('progress')}
              >
                <span>In Progress</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'all'}
                className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span>All</span>
              </button>
            </div>
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
          <div className="table-loading-state">
            <LoadingSpinner size="medium" message="Loading office requests..." />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="table-empty-state">
            <div className="empty-state-icon-box">
              <FaInbox className="empty-inbox-icon" />
            </div>
            <h3 className="empty-state-heading">No requests found</h3>
            <p className="empty-state-text">
              {searchQuery
                ? `No requests match "${searchQuery}".`
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
                            <div className="ticket-title-wrap">
                              {ticket.assignedTo || ticket.status === 'Cancelled' ? (
                                <button
                                  type="button"
                                  className="ticket-title-link"
                                  onClick={() => onNavigate('ticket-details', ticket)}
                                  title={ticket.title || ticket.subject || 'View Request Details'}
                                >
                                  {ticket.title || ticket.subject || 'Untitled Request'}
                                </button>
                              ) : (
                                <span
                                  className="ticket-title-text"
                                  title="Claim this request to view details"
                                >
                                  {ticket.title || ticket.subject || 'Untitled Request'}
                                </span>
                              )}
                            </div>
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
                            <span className="student-name" title={studentName}>{studentName}</span>
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
                            <div className="assigned-to" title={ticket.assignedTo}>
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
                              <button
                                type="button"
                                className={`action-btn claim-btn ${isAtClaimLimit ? 'claim-btn-limited' : ''}`}
                                onClick={() => handleClaimRequest(ticket)}
                                disabled={claimingTicketId === ticket.firestoreId}
                                title={
                                  isAtClaimLimit
                                    ? `Anti-hoarding limit reached: You currently have ${myInProgressCount} requests in In Progress and reached the daily limit of ${HOARDING_DAILY_LIMIT} accepted requests. Complete in-progress requests before accepting more.`
                                    : isUnderHoardingRestriction
                                    ? `Anti-hoarding restricted (${myInProgressCount} in progress): Accepted ${myAcceptedTodayCount}/${HOARDING_DAILY_LIMIT} today`
                                    : 'Claim request and set turnaround time'
                                }
                              >
                                {claimingTicketId === ticket.firestoreId ? 'Claiming...' : isAtClaimLimit ? 'Daily Limit Reached' : 'Claim Request'}
                              </button>
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
