import { useState, useEffect } from 'react';
import { FaBell, FaInbox, FaTicketAlt, FaClipboard, FaCheckCircle, FaUserCircle } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import Notifications from './Notifications';
import { notifyStudentStatusChange } from '../utils/notificationHelper';
import LoadingSpinner from './LoadingSpinner';
import '../styles/AdminDashboard.css';

const AdminDashboard = ({ department }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [timeFilter, setTimeFilter] = useState('month');
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    unassigned: 0,
    claimed: 0,
    resolved: 0
  });
  const [staffData, setStaffData] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Get staff data from localStorage
    const storedStaffData = localStorage.getItem('staffData');
    if (storedStaffData) {
      const parsedData = JSON.parse(storedStaffData);
      setStaffData(parsedData);
      
      // Temporarily disabled notification listener to fix ticket loading
      // TODO: Re-enable after fixing index issue
      /*
      if (parsedData.uid) {
        const q = query(
          collection(db, 'notifications'),
          where('recipientId', '==', parsedData.uid),
          where('recipientType', '==', 'staff')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const unread = querySnapshot.docs.filter(doc => !doc.data().isRead).length;
          setUnreadCount(unread);
        });

        return () => unsubscribe();
      }
      */
    }
    loadTickets();
  }, [department]);

  useEffect(() => {
    filterTickets();
  }, [activeTab, tickets, searchQuery]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      
      // Query tickets for this office
      const requestsRef = collection(db, 'requests');
      const q = query(
        requestsRef,
        where('office', '==', department)
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
          assignedTo: data.assignedTo || null,
          assignedToStaff: data.assignedToStaff || null,
          createdAtTimestamp: data.createdAt?.toDate().getTime() || 0,
          ...data
        };
      });
      
      // Sort by date (newest first)
      ticketsData.sort((a, b) => b.createdAtTimestamp - a.createdAtTimestamp);
      
      setTickets(ticketsData);
      
      // Calculate stats
      const newStats = {
        total: ticketsData.length,
        unassigned: ticketsData.filter(t => !t.assignedTo).length,
        claimed: ticketsData.filter(t => t.status === 'In Process').length,
        resolved: ticketsData.filter(t => t.status === 'Resolved').length
      };
      setStats(newStats);
      
      console.log('✅ Loaded', ticketsData.length, 'tickets for', department);
    } catch (error) {
      console.error('❌ Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];
    
    // Filter by tab
    if (activeTab === 'new') {
      filtered = filtered.filter(t => t.status === 'Pending' || !t.assignedTo);
    } else if (activeTab === 'progress') {
      filtered = filtered.filter(t => t.status === 'In Process');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(t => t.status === 'Resolved');
    }
    
    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.student.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.assignedTo && t.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    setFilteredTickets(filtered);
  };

  const handleClaimTicket = async (ticket) => {
    if (!staffData) {
      alert('Staff data not found. Please login again.');
      return;
    }

    try {
      // Update ticket in Firestore
      const ticketRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(ticketRef, {
        assignedTo: staffData.name,
        assignedToStaff: staffData.name,
        status: 'In Process',
        claimedAt: new Date(),
        claimedBy: staffData.name
      });

      console.log('✅ Ticket claimed by', staffData.name);
      
      // Create notification for the student about status change
      if (ticket.studentUid) {
        await notifyStudentStatusChange(
          ticket.studentUid,
          ticket.id,
          ticket.title,
          ticket.status || 'Pending',
          'In Process'
        );
        console.log('✅ Notification sent to student');
      } else {
        console.warn('⚠️ Student UID not found in ticket, notification not sent');
      }
      
      // Reload tickets
      await loadTickets();
      
      alert(`Ticket ${ticket.id} has been assigned to you!`);
    } catch (error) {
      console.error('❌ Error claiming ticket:', error);
      alert('Failed to claim ticket: ' + error.message);
    }
  };

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">{department}'s Office</h1>
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

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaInbox className="stat-icon" />
            </div>
            <span className="stat-label">TOTAL</span>
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-subtext">All Tickets</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaTicketAlt className="stat-icon" />
            </div>
            <span className="stat-label">UNASSIGNED</span>
          </div>
          <div className="stat-value">{stats.unassigned}</div>
          <div className="stat-subtext">Pending Tickets</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaClipboard className="stat-icon" />
            </div>
            <span className="stat-label">CLAIMED</span>
          </div>
          <div className="stat-value">{stats.claimed}</div>
          <div className="stat-subtext">In Progress</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon-container">
              <FaCheckCircle className="stat-icon" />
            </div>
            <span className="stat-label">COMPLETE</span>
          </div>
          <div className="stat-value">{stats.resolved}</div>
          <div className="stat-subtext">Resolved</div>
        </div>
      </div>

      <div className="tickets-section">
        <div className="tickets-tabs">
          <div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            All
          </div>
          <div className={`tab ${activeTab === 'new' ? 'active' : ''}`} onClick={() => setActiveTab('new')}>
            New Tickets
          </div>
          <div className={`tab ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
            In Progress
          </div>
          <div className={`tab ${activeTab === 'resolved' ? 'active' : ''}`} onClick={() => setActiveTab('resolved')}>
            Resolved
          </div>
        </div>

        <div className="search-bar">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search by Ticket Info or Staff Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <LoadingSpinner message="Loading tickets..." fullScreen={false} />
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">No tickets found.</div>
        ) : (
          <>
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>TICKET INFO</th>
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
                      <div className="ticket-info-cell">
                        {ticket.title}
                        <span className="ticket-id">#{ticket.id}</span>
                      </div>
                    </td>
                    <td>
                      <div className="student-info">
                        {ticket.student}
                        <span className="student-id">ID: {ticket.studentId}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${ticket.status.toLowerCase().replace(' ', '')}`}>
                        {ticket.status === 'Pending' && 'New Ticket'}
                        {ticket.status === 'In Process' && 'In Progress'}
                        {ticket.status === 'Resolved' && 'Resolved'}
                        {ticket.status === 'Cancelled' && 'Cancelled'}
                      </span>
                    </td>
                    <td>
                      {ticket.status === 'Cancelled' ? (
                        <span className="cancelled-text">Cancelled by Student</span>
                      ) : ticket.assignedTo ? (
                        <div className="assigned-to">
                          <FaUserCircle className="assigned-icon" />
                          <span>{ticket.assignedTo}</span>
                        </div>
                      ) : (
                        <span className="unassigned-text">Unassigned</span>
                      )}
                    </td>
                    <td>
                      {ticket.status === 'Cancelled' ? (
                        <button className="action-btn disabled" disabled>
                          Cancelled
                        </button>
                      ) :                       ticket.assignedTo ? (
                        <button className="action-btn" onClick={() => onNavigate('ticket-details', ticket)}>View Ticket</button>
                      ) : (
                        <button 
                          className="action-btn claim"
                          onClick={() => handleClaimTicket(ticket)}
                        >
                          Claim Ticket
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <button className="page-btn">&lt;</button>
              <button className="page-btn active">1</button>
              <button className="page-btn">&gt;</button>
            </div>
          </>
        )}
      </div>

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </div>
  );
};

export default AdminDashboard;
