import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FaBell, 
  FaSearch, 
  FaTicketAlt, 
  FaEllipsisH, 
  FaCheckCircle, 
  FaUserCircle, 
  FaFilter, 
  FaChevronDown, 
  FaCheck, 
  FaTimes 
} from 'react-icons/fa';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useOfficeTickets } from '../hooks/useOfficeTickets';
import Notifications from './Notifications';
import LoadingSpinner from './LoadingSpinner';
import '../styles/MyTickets.css';

const STATUS_OPTIONS = ['All Status', 'In Progress', 'Resolved', 'Rejected'];

const MyTickets = ({ department, onNavigate, onViewRequest }) => {
  const [timeFilter, setTimeFilter] = useState('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const filterWrapRef = useRef(null);
  const ticketsListRef = useRef(null);
  
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

  // Consume the office tickets hook (shared live data source across Dashboard & Analytics)
  const { tickets: officeTickets, loading } = useOfficeTickets(department);

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

  // Close the status filter dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!isFilterOpen) return undefined;

    const handleClickOutside = (e) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsFilterOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFilterOpen]);

  // Calculate summary counts
  const stats = useMemo(() => ({
    total: tickets.length,
    inProgress: tickets.filter(t => t.status === 'In Process').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length
  }), [tickets]);

  // Filter tickets by status and search query
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];

    // Filter by status
    if (statusFilter !== 'All Status') {
      filtered = filtered.filter(t => {
        if (statusFilter === 'In Progress') return t.status === 'In Process';
        if (statusFilter === 'Resolved') return t.status === 'Resolved';
        if (statusFilter === 'Rejected') return t.status === 'Rejected';
        return true;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(t => 
        (t.id && String(t.id).toLowerCase().includes(q)) ||
        (t.title && String(t.title).toLowerCase().includes(q)) ||
        (t.student && String(t.student).toLowerCase().includes(q)) ||
        (t.studentId && String(t.studentId).toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [tickets, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;

  // Reset to page 1 when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  // Keep currentPage valid if dataset size changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Slice tickets for the active page
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

  const handleSelectStatus = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    setIsFilterOpen(false);
  };

  const handleSummaryCardClick = (filter) => {
    if (filter === 'All Status') {
      setStatusFilter('All Status');
    } else {
      setStatusFilter((prev) => (prev === filter ? 'All Status' : filter));
    }
    setSearchQuery('');
    setCurrentPage(1);
    setIsFilterOpen(false);
    ticketsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleTicketClick = (ticket) => {
    onNavigate('ticket-details', ticket);
  };

  return (
    <div className="my-tickets-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Requests</h1>
          <p className="page-subtitle">Requests you've claimed and the ones you're handling</p>
        </div>
        <div className="header-right">
          <div className="time-filter">
            <button 
              type="button"
              className={`filter-btn ${timeFilter === 'week' ? 'active' : ''}`}
              onClick={() => setTimeFilter('week')}
            >
              Week
            </button>
            <button 
              type="button"
              className={`filter-btn ${timeFilter === 'month' ? 'active' : ''}`}
              onClick={() => setTimeFilter('month')}
            >
              Month
            </button>
          </div>
          <div className="notification-bell" onClick={() => setShowNotifications(true)} role="button" tabIndex={0}>
            <FaBell className="bell-icon" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </div>
        </div>
      </div>

      <div className="ticket-summary-cards">
        <button
          type="button"
          className={`summary-card total ${statusFilter === 'All Status' ? 'active' : ''}`}
          onClick={() => handleSummaryCardClick('All Status')}
          aria-pressed={statusFilter === 'All Status'}
          aria-label="Show all my requests in the request table"
        >
          <span className="summary-header">
            <span className="summary-icon-container">
              <FaTicketAlt className="summary-icon" />
            </span>
            <span className="summary-label">All</span>
          </span>
          <span className="summary-count">{stats.total}</span>
          <span className="summary-footer">
            <span className="summary-dot" aria-hidden="true" />
            <span className="summary-subtext">My Request</span>
          </span>
        </button>

        <button
          type="button"
          className={`summary-card progress ${statusFilter === 'In Progress' ? 'active' : ''}`}
          onClick={() => handleSummaryCardClick('In Progress')}
          aria-pressed={statusFilter === 'In Progress'}
          aria-label="Show In Process requests in the request table"
        >
          <span className="summary-header">
            <span className="summary-icon-container">
              <FaEllipsisH className="summary-icon" />
            </span>
            <span className="summary-label">In Process</span>
          </span>
          <span className="summary-count">{stats.inProgress}</span>
          <span className="summary-footer">
            <span className="summary-dot" aria-hidden="true" />
            <span className="summary-subtext">Being handled</span>
          </span>
        </button>

        <button
          type="button"
          className={`summary-card resolved ${statusFilter === 'Resolved' ? 'active' : ''}`}
          onClick={() => handleSummaryCardClick('Resolved')}
          aria-pressed={statusFilter === 'Resolved'}
          aria-label="Show Resolved requests in the request table"
        >
          <span className="summary-header">
            <span className="summary-icon-container">
              <FaCheckCircle className="summary-icon" />
            </span>
            <span className="summary-label">Resolved</span>
          </span>
          <span className="summary-count">{stats.resolved}</span>
          <span className="summary-footer">
            <span className="summary-dot" aria-hidden="true" />
            <span className="summary-subtext">Completed</span>
          </span>
        </button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by Request Info"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="status-filter-wrap" ref={filterWrapRef}>
          <button
            type="button"
            className={`filter-trigger ${statusFilter !== 'All Status' ? 'active' : ''}`}
            onClick={() => setIsFilterOpen(prev => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isFilterOpen}
            aria-label="Filter requests by status"
          >
            <FaFilter className="filter-icon" aria-hidden="true" />
            Status
            {statusFilter !== 'All Status' && <span className="filter-active-dot" aria-hidden="true" />}
            <FaChevronDown className={`filter-chevron ${isFilterOpen ? 'open' : ''}`} aria-hidden="true" />
          </button>

          {isFilterOpen && (
            <div className="filter-dropdown-panel" role="listbox" aria-label="Filter by status">
              <div className="filter-dropdown-title">Filter by status</div>
              {STATUS_OPTIONS.map(status => (
                <button
                  key={status}
                  type="button"
                  role="option"
                  aria-selected={statusFilter === status}
                  className={`status-option ${statusFilter === status ? 'selected' : ''}`}
                  onClick={() => handleSelectStatus(status)}
                >
                  <span className="status-option-check">
                    {statusFilter === status && <FaCheck aria-hidden="true" />}
                  </span>
                  {status}
                </button>
              ))}
              {statusFilter !== 'All Status' && (
                <div className="filter-dropdown-actions">
                  <button
                    type="button"
                    className="filter-clear-btn"
                    onClick={() => handleSelectStatus('All Status')}
                  >
                    <FaTimes aria-hidden="true" /> Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="tickets-list-section" ref={ticketsListRef}>
        {loading ? (
          <LoadingSpinner message="Loading your requests..." fullScreen={false} />
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">
            {tickets.length === 0 
              ? 'You have no claimed requests yet.' 
              : 'No requests match your filters.'}
          </div>
        ) : (
          <>
            <table className="tickets-list-table">
              <thead>
                <tr>
                  <th>REQUEST INFO</th>
                  <th>STUDENT DETAILS</th>
                  <th>STATUS</th>
                  <th>ASSIGNED TO</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTickets.map((ticket, index) => (
                  <tr key={ticket.firestoreId || index}>
                    <td>
                      <div className="ticket-info-text">
                        {ticket.title}
                        <span className="ticket-number">#{ticket.id}</span>
                      </div>
                    </td>
                    <td>
                      <div className="student-cell">
                        {ticket.student}
                        <span className="student-id-text">ID: {ticket.studentId}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${(ticket.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                        <span className="status-dot" aria-hidden="true"></span>
                        {ticket.status === 'Pending' && 'New Request'}
                        {ticket.status === 'In Process' && 'In Progress'}
                        {ticket.status === 'Resolved' && 'Resolved'}
                        {ticket.status === 'Cancelled' && 'Cancelled'}
                        {ticket.status === 'Rejected' && 'Rejected'}
                        {ticket.status !== 'Pending' && ticket.status !== 'In Process' && ticket.status !== 'Resolved' && ticket.status !== 'Cancelled' && ticket.status !== 'Rejected' && ticket.status}
                      </span>
                    </td>
                    <td>
                      {ticket.assignedTo ? (
                        <div className="assigned-to-cell">
                          <FaUserCircle className="user-icon" />
                          <span className="assigned-name">{ticket.assignedTo}</span>
                        </div>
                      ) : (
                        <span className="unassigned-text">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <button 
                        type="button"
                        className="view-ticket-btn"
                        onClick={() => handleTicketClick(ticket)}
                      >
                        View Request
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination-tickets">
                <button
                  type="button"
                  className="page-btn-tickets"
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
                      className={`page-btn-tickets ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="page-btn-tickets"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next Page"
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />
    </div>
  );
};

export default MyTickets;
