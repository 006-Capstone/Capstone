import { useState, useEffect, useRef } from 'react';
import { FaBell, FaSearch, FaTicketAlt, FaEllipsisH, FaCheckCircle, FaUserCircle, FaFilter, FaChevronDown, FaCheck, FaTimes } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import Notifications from './Notifications';
import LoadingSpinner from './LoadingSpinner';
import '../styles/MyTickets.css';

const STATUS_OPTIONS = ['All Status', 'New Requests', 'In Progress', 'Resolved', 'Rejected'];

const MyTickets = ({ department, onNavigate, onViewRequest }) => {
  const [timeFilter, setTimeFilter] = useState('week');
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterWrapRef = useRef(null);
  const ticketsListRef = useRef(null);
  const [staffData, setStaffData] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState({
    new: 0,
    inProgress: 0,
    resolved: 0
  });

  useEffect(() => {
    // Get staff data from localStorage
    const storedStaffData = localStorage.getItem('staffData');
    if (storedStaffData) {
      const data = JSON.parse(storedStaffData);
      setStaffData(data);
      loadMyTickets(data.name);
      
      // Listen for unread notifications in real-time
      if (data.uid) {
        const q = query(
          collection(db, 'notifications'),
          where('recipientId', '==', data.uid),
          where('recipientType', '==', 'staff')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const unread = querySnapshot.docs.filter(doc => !doc.data().isRead).length;
          setUnreadCount(unread);
        });

        return () => unsubscribe();
      }
    }
  }, []);

  useEffect(() => {
    filterTickets();
  }, [searchQuery, statusFilter, tickets]);

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

  const loadMyTickets = async (staffName) => {
    try {
      setLoading(true);
      
      // Query tickets assigned to this staff member
      const requestsRef = collection(db, 'requests');
      const q = query(
        requestsRef,
        where('assignedTo', '==', staffName)
      );
      
      const querySnapshot = await getDocs(q);
      const ticketsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          firestoreId: doc.id,
          id: data.requestId,
          title: data.subject,
          student: data.studentName,
          studentId: data.studentId,
          status: data.status,
          assignedTo: data.assignedTo,
          createdAtTimestamp: data.createdAt?.toDate().getTime() || 0,
          ...data
        };
      });
      
      // Sort by date (newest first)
      ticketsData.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
      
      setTickets(ticketsData);
      
      // Calculate stats
      const newStats = {
        new: ticketsData.filter(t => t.status === 'Pending').length,
        inProgress: ticketsData.filter(t => t.status === 'In Process').length,
        resolved: ticketsData.filter(t => t.status === 'Resolved').length
      };
      setStats(newStats);
      
      console.log('[Success] Loaded', ticketsData.length, 'tickets for', staffName);
    } catch (error) {
      console.error('[Error] Error loading my tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];
    
    // Filter by status
    if (statusFilter !== 'All Status') {
      filtered = filtered.filter(t => {
        if (statusFilter === 'New Requests') return t.status === 'Pending';
        if (statusFilter === 'In Progress') return t.status === 'In Process';
        if (statusFilter === 'Resolved') return t.status === 'Resolved';
        if (statusFilter === 'Rejected') return t.status === 'Rejected';
        return true;
      });
    }
    
    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.student.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredTickets(filtered);
  };

  const handleSelectStatus = (status) => {
    setStatusFilter(status);
    setIsFilterOpen(false);
  };

  // Summary cards double as quick filters: clicking one applies its status
  // filter to the table below, clears any stale search, and scrolls the
  // filtered table into view. Clicking the already-active card resets to
  // All Status.
  const handleSummaryCardClick = (filter) => {
    setStatusFilter((prev) => (prev === filter ? 'All Status' : filter));
    // Clear any stale search only when applying a different filter —
    // toggling the active card back to All Status keeps the search.
    if (statusFilter !== filter) {
      setSearchQuery('');
    }
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

      <div className="ticket-summary-cards">
        <button
          type="button"
          className={`summary-card new ${statusFilter === 'New Requests' ? 'active' : ''}`}
          onClick={() => handleSummaryCardClick('New Requests')}
          aria-pressed={statusFilter === 'New Requests'}
          aria-label="Show New Requests in the request table"
        >
          <span className="summary-header">
            <span className="summary-icon-container">
              <FaTicketAlt className="summary-icon" />
            </span>
            <span className="summary-label">New Requests</span>
          </span>
          <span className="summary-count">{stats.new}</span>
          <span className="summary-footer">
            <span className="summary-dot" aria-hidden="true" />
            <span className="summary-subtext">Awaiting action</span>
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
                {filteredTickets.map((ticket, index) => (
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
                      <span className={`status-badge status-${ticket.status.toLowerCase().replace(' ', '')}`}>
                        {ticket.status === 'Pending' && 'New Request'}
                        {ticket.status === 'In Process' && 'In Progress'}
                        {ticket.status === 'Resolved' && 'Resolved'}
                        {ticket.status === 'Cancelled' && 'Cancelled'}
                        {ticket.status === 'Rejected' && 'Rejected'}
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

            <div className="pagination-tickets">
              <button className="page-btn-tickets">&lt;</button>
              <button className="page-btn-tickets active">1</button>
              <button className="page-btn-tickets">&gt;</button>
            </div>
          </>
        )}
      </div>

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />
    </div>
  );
};

export default MyTickets;
