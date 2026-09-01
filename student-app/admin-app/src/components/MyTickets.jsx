import { useState, useEffect } from 'react';
import { FaBell, FaSearch, FaTicketAlt, FaEllipsisH, FaCheckCircle, FaChevronRight } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import Notifications from './Notifications';
import LoadingSpinner from './LoadingSpinner';
import '../styles/MyTickets.css';

const MyTickets = ({ department, onNavigate }) => {
  const [timeFilter, setTimeFilter] = useState('week');
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
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
      
      console.log('✅ Loaded', ticketsData.length, 'tickets for', staffName);
    } catch (error) {
      console.error('❌ Error loading my tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];
    
    // Filter by status
    if (statusFilter !== 'All Status') {
      filtered = filtered.filter(t => {
        if (statusFilter === 'New Tickets') return t.status === 'Pending';
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

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('All Status');
  };

  const handleTicketClick = (ticket) => {
    onNavigate('ticket-details', ticket);
  };

  return (
    <div className="my-tickets-container">
      <div className="breadcrumb">
        <span className="breadcrumb-item">Tickets</span>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item">
          Ticket Details
        </span>
      </div>

      <div className="page-header">
        <h1 className="page-title">My Tickets</h1>
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
        <div className="summary-card new">
          <div className="summary-content">
            <h3>New Tickets</h3>
            <div className="summary-count">{stats.new}</div>
          </div>
          <div className="summary-icon-container">
            <FaTicketAlt className="summary-icon" />
          </div>
        </div>

        <div className="summary-card progress">
          <div className="summary-content">
            <h3>In Process</h3>
            <div className="summary-count">{stats.inProgress}</div>
          </div>
          <div className="summary-icon-container">
            <FaEllipsisH className="summary-icon" />
          </div>
        </div>

        <div className="summary-card resolved">
          <div className="summary-content">
            <h3>Resolved</h3>
            <div className="summary-count">{stats.resolved}</div>
          </div>
          <div className="summary-icon-container">
            <FaCheckCircle className="summary-icon" />
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by Ticket Info"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select 
          className="filter-dropdown"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All Status</option>
          <option>New Tickets</option>
          <option>In Progress</option>
          <option>Resolved</option>
          <option>Rejected</option>
        </select>
        <button className="reset-filter-btn" onClick={handleResetFilters}>Reset Filters</button>
      </div>

      <div className="tickets-list-section">
        {loading ? (
          <LoadingSpinner message="Loading your tickets..." fullScreen={false} />
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">
            {tickets.length === 0 
              ? 'You have no claimed tickets yet.' 
              : 'No tickets match your search.'}
          </div>
        ) : (
          <>
            <table className="tickets-list-table">
              <thead>
                <tr>
                  <th className="checkbox-cell"></th>
                  <th>STUDENT DETAILS</th>
                  <th>TICKET INFO</th>
                  <th>ASSIGNED TO</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket, index) => (
                  <tr key={ticket.firestoreId || index} onClick={() => handleTicketClick(ticket)} style={{ cursor: 'pointer' }}>
                    <td className="checkbox-cell">
                      <input type="checkbox" className="ticket-checkbox" onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td>
                      <div className="student-cell">
                        {ticket.student}
                        <span className="student-id-text">ID: {ticket.studentId}</span>
                      </div>
                    </td>
                    <td>
                      <div className="ticket-info-text">
                        {ticket.title}
                        <span className="ticket-number">#{ticket.id}</span>
                      </div>
                    </td>
                    <td>
                      <span className="assigned-name">{ticket.assignedTo}</span>
                    </td>
                    <td>
                      <span className={`status-text ${ticket.status.toLowerCase().replace(' ', '')}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td>
                      <FaChevronRight className="arrow-icon" />
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

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </div>
  );
};

export default MyTickets;
