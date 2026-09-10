import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaBell, 
  FaSearch, 
  FaTimes,
  FaClock,
  FaInbox
} from 'react-icons/fa';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useOfficeTickets } from '../hooks/useOfficeTickets';
import Notifications from './Notifications';
import NearingCompletionModal from './NearingCompletionModal';
import { getNearingRequests, getNearingSummary } from '../utils/etcHelper';
import LoadingSpinner from './LoadingSpinner';
import '../styles/MyTickets.css';

const MyTickets = ({ department, onNavigate, onViewRequest }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const [staffData, setStaffData] = useState(() => {
    try {
      const stored = localStorage.getItem('staffData');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNearingModal, setShowNearingModal] = useState(false);

  // Consume the office tickets hook (shared live data source across Dashboard & Analytics)
  const { tickets: officeTickets, loading } = useOfficeTickets(department);

  // Requests nearing estimated completion date
  const nearingRequests = useMemo(() => {
    return getNearingRequests(officeTickets, 3);
  }, [officeTickets]);

  const nearingSummary = useMemo(() => {
    return getNearingSummary(nearingRequests);
  }, [nearingRequests]);

  // Filter for tickets claimed by or assigned to this staff member
  const tickets = useMemo(() => {
    if (!staffData?.name && !staffData?.uid) {
      return [];
    }
    const staffName = (staffData.name || '').trim().toLowerCase();
    const staffUid = staffData.uid;

    return officeTickets.filter(t => {
      const assigned = (t.assignedTo || '').trim().toLowerCase();
      const claimed = (t.claimedBy || '').trim().toLowerCase();
      return (
        (assigned && assigned === staffName) ||
        (claimed && claimed === staffName) ||
        (staffUid && t.assignedToStaff === staffUid)
      );
    });
  }, [officeTickets, staffData]);

  // Real-time unread notifications
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

  // Status counts for tab badges
  const inProgressCount = useMemo(() => {
    return tickets.filter(t => t.status === 'In Process').length;
  }, [tickets]);

  const resolvedCount = useMemo(() => {
    return tickets.filter(t => t.status === 'Resolved').length;
  }, [tickets]);

  const rejectedCount = useMemo(() => {
    return tickets.filter(t => t.status === 'Rejected').length;
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

  // Filter tickets by active tab and search query
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];

    // Filter by tab
    if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => t.status === 'In Process');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(t => t.status === 'Resolved');
    } else if (activeTab === 'rejected') {
      filtered = filtered.filter(t => t.status === 'Rejected');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        (t.id && String(t.id).toLowerCase().includes(q)) ||
        (t.title && String(t.title).toLowerCase().includes(q)) ||
        (t.subject && String(t.subject).toLowerCase().includes(q)) ||
        (t.student && String(t.student).toLowerCase().includes(q)) ||
        (t.studentName && String(t.studentName).toLowerCase().includes(q)) ||
        (t.studentId && String(t.studentId).toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [tickets, activeTab, searchQuery]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Keep currentPage valid if dataset size changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;

  // Slice tickets for the active page
  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTickets, startIndex, itemsPerPage]);

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

  const handleTicketClick = (ticket) => {
    onNavigate('ticket-details', ticket);
  };

  return (
    <div className="my-tickets-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">My Requests</h1>
          <p className="page-subtitle">Requests you've claimed and the ones you're handling</p>
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

          <div 
            className="notification-bell" 
            onClick={() => setShowNotifications(true)} 
            role="button" 
            tabIndex={0}
            aria-label="View notifications"
          >
            <FaBell className="bell-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
        </div>
      </div>

      {/* Main Table Card Section */}
      <div className="tickets-section">
        {/* Toolbar: Status Tabs & Search */}
        <div className="tickets-toolbar">
          <div className="toolbar-left-group">
            <div className="tickets-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'all'}
                className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span>All Requests</span>
                <span className="tab-count">{tickets.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'in_progress'}
                className={`tab ${activeTab === 'in_progress' ? 'active' : ''}`}
                onClick={() => setActiveTab('in_progress')}
              >
                <span>In Progress</span>
                <span className="tab-count">{inProgressCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'resolved'}
                className={`tab ${activeTab === 'resolved' ? 'active' : ''}`}
                onClick={() => setActiveTab('resolved')}
              >
                <span>Resolved</span>
                <span className="tab-count">{resolvedCount}</span>
              </button>
              {rejectedCount > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'rejected'}
                  className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
                  onClick={() => setActiveTab('rejected')}
                >
                  <span>Rejected</span>
                  <span className="tab-count">{rejectedCount}</span>
                </button>
              )}
            </div>
          </div>

          <div className="toolbar-right-group">
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
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="table-loading-state">
            <LoadingSpinner size="medium" message="Loading your requests..." fullScreen={false} />
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
                : tickets.length === 0
                ? "You haven't claimed any requests yet. Claim new requests from the Office Dashboard."
                : activeTab === 'in_progress'
                ? 'You have no requests currently in progress.'
                : activeTab === 'resolved'
                ? 'You have not marked any requests as resolved yet.'
                : 'No requests match the selected view.'}
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
                View All Claimed Requests
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
                              <button
                                type="button"
                                className="ticket-title-link"
                                onClick={() => handleTicketClick(ticket)}
                                title={ticket.title || ticket.subject || 'View Request Details'}
                              >
                                {ticket.title || ticket.subject || 'Untitled Request'}
                              </button>
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
                        <td className="td-actions">
                          <div className="table-actions-cell">
                            <button
                              type="button"
                              className="action-btn view-btn"
                              onClick={() => handleTicketClick(ticket)}
                              title="View Request Details"
                            >
                              View Request
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Centered Pagination */}
            <div className="table-footer">
              <div className="table-count-info">
                Showing <span className="count-bold">{startIndex + 1}</span>–<span className="count-bold">{Math.min(startIndex + itemsPerPage, filteredTickets.length)}</span> of{' '}
                <span className="count-bold">{filteredTickets.length}</span> requests
                {searchQuery && (
                  <span className="search-query-label"> (filtered by "{searchQuery}")</span>
                )}
              </div>

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
            </div>
          </>
        )}
      </div>

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />

      {/* Modal: Summary of Requests Nearing Estimated Completion */}
      <NearingCompletionModal
        isOpen={showNearingModal}
        onClose={() => setShowNearingModal(false)}
        tickets={officeTickets}
        department={department}
        onViewRequest={onViewRequest}
      />
    </div>
  );
};

export default MyTickets;
