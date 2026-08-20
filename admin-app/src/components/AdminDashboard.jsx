import { useState, useEffect, useMemo, useRef } from 'react';
import { FaBell, FaInbox, FaTicketAlt, FaClipboard, FaCheckCircle, FaUserCircle } from 'react-icons/fa';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Notifications from './Notifications';
import { notifyStudentStatusChange } from '../utils/notificationHelper';
import { useOfficeTickets } from '../hooks/useOfficeTickets';
import LoadingSpinner from './LoadingSpinner';
import '../styles/AdminDashboard.css';

const AdminDashboard = ({ department, onNavigate, onViewRequest }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [timeFilter, setTimeFilter] = useState('month');
  const { tickets, loading } = useOfficeTickets(department);
  const [staffData, setStaffData] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ticketsSectionRef = useRef(null);
  
  // Estimated Completion Date Modal state
  const [showEstimatedCompletionModal, setShowEstimatedCompletionModal] = useState(false);
  const [selectedTicketForCompletion, setSelectedTicketForCompletion] = useState(null);
  const [completionOption, setCompletionOption] = useState('1-3'); // '1-3', '4-7', 'custom'
  const [customCompletionDate, setCustomCompletionDate] = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    // Get staff data from localStorage
    const storedStaffData = localStorage.getItem('staffData');
    if (storedStaffData) {
      setStaffData(JSON.parse(storedStaffData));
    }
  }, []);

  // Dashboard summary cards — derived straight from the shared live tickets
  const stats = useMemo(() => ({
    total: tickets.length,
    // Cancelled tickets have no assignee but are NOT awaiting assignment
    unassigned: tickets.filter(t => !t.assignedTo && t.status !== 'Cancelled').length,
    claimed: tickets.filter(t => t.status === 'In Process').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length
  }), [tickets]);

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

    return filtered;
  }, [activeTab, tickets]);

  // Stat cards double as quick filters: clicking one switches the ticket
  // table to the matching tab (All / New Tickets / In Progress / Resolved)
  // and scrolls it into view. Clicking the already-active card resets to All.
  const handleStatCardClick = (tab) => {
    setActiveTab((prev) => (prev === tab ? 'all' : tab));
    ticketsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleClaimTicket = async (ticket) => {
    if (!staffData) {
      alert('Staff data not found. Please login again.');
      return;
    }

    // Show Estimated Completion Date modal before claiming
    setSelectedTicketForCompletion(ticket);
    setShowEstimatedCompletionModal(true);
  };

  const handleSetEstimatedCompletion = async () => {
    if (!selectedTicketForCompletion) return;

    let completionDate;
    
    if (completionOption === 'custom') {
      if (!customCompletionDate) {
        alert('Please select a custom date');
        return;
      }
      completionDate = new Date(customCompletionDate);
    } else if (completionOption === '1-3') {
      completionDate = new Date();
      completionDate.setDate(completionDate.getDate() + 3);
    } else if (completionOption === '4-7') {
      completionDate = new Date();
      completionDate.setDate(completionDate.getDate() + 7);
    }

    try {
      setClaiming(true);
      
      // Update ticket in Firestore with Estimated Completion Date
      const ticketRef = doc(db, 'requests', selectedTicketForCompletion.firestoreId);
      await updateDoc(ticketRef, {
        assignedTo: staffData.name,
        assignedToStaff: staffData.name,
        status: 'In Process',
        claimedAt: new Date(),
        claimedBy: staffData.name,
        estimatedCompletion: completionDate,
        estimatedCompletionSetAt: new Date(),
        estimatedCompletionSetBy: staffData.name
      });

      console.log('[Success] Ticket claimed by', staffData.name, 'with Estimated Completion Date:', completionDate);

      // Create notification for the student about status change
      if (selectedTicketForCompletion.studentUid) {
        await notifyStudentStatusChange(
          selectedTicketForCompletion.studentUid,
          selectedTicketForCompletion.id,
          selectedTicketForCompletion.title,
          selectedTicketForCompletion.status || 'Pending',
          'In Process'
        );
        console.log('[Success] Notification sent to student');
      } else {
        console.warn('[Warning] Student UID not found in ticket, notification not sent');
      }

      // Wait a moment for Firestore real-time listener to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      alert(`Request ${selectedTicketForCompletion.id} has been assigned to you!`);
      
      // Close modal and reset state
      setShowEstimatedCompletionModal(false);
      setSelectedTicketForCompletion(null);
      setCompletionOption('1-3');
      setCustomCompletionDate('');
      setClaiming(false);
    } catch (error) {
      console.error('[Error] Error claiming ticket:', error);
      alert('Failed to claim request: ' + error.message);
      setClaiming(false);
    }
  };

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{department}'s Office</h1>
          <p className="dashboard-subtitle">Monitor and manage all student requests in your office</p>
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

      <div className="stats-cards">
        <button
          type="button"
          className={`stat-card ${activeTab === 'all' ? 'active' : ''}`}
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
          className={`stat-card ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => handleStatCardClick('new')}
          aria-pressed={activeTab === 'new'}
          aria-label="Show new requests awaiting assignment in the dashboard table"
        >
          <span className="stat-header">
            <span className="stat-icon-container">
              <FaTicketAlt className="stat-icon" />
            </span>
            <span className="stat-label">Open</span>
          </span>
          <span className="stat-value">{stats.unassigned}</span>
          <span className="stat-subtext">Awaiting Assignment</span>
        </button>

        <button
          type="button"
          className={`stat-card ${activeTab === 'progress' ? 'active' : ''}`}
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
          className={`stat-card ${activeTab === 'resolved' ? 'active' : ''}`}
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

      <div className="tickets-section" ref={ticketsSectionRef}>
        <div className="tickets-tabs">
          <div className={`tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            All
          </div>
          <div className={`tab ${activeTab === 'new' ? 'active' : ''}`} onClick={() => setActiveTab('new')}>
            New Requests
          </div>
          <div className={`tab ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
            In Progress
          </div>
          <div className={`tab ${activeTab === 'resolved' ? 'active' : ''}`} onClick={() => setActiveTab('resolved')}>
            Resolved
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading requests..." fullScreen={false} />
        ) : filteredTickets.length === 0 ? (
          <div className="empty-state">No requests found.</div>
        ) : (
          <>
            <table className="tickets-table">
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
                        {ticket.status === 'Pending' && 'New Request'}
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
                      ) : ticket.assignedTo ? (
                        <button
                          className="action-btn"
                          onClick={() => onNavigate('ticket-details', ticket)}
                        >
                          View Request
                        </button>
                      ) : (
                        <button
                          className="action-btn claim"
                          onClick={() => handleClaimTicket(ticket)}
                        >
                          Claim Request
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

      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />

      {/* Estimated Completion Date Modal */}
      {showEstimatedCompletionModal && (
        <div className="modal-overlay" onClick={() => setShowEstimatedCompletionModal(false)}>
          <div className="modal-content estimated-completion-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Set Estimated Completion Date</h2>
            <p className="modal-description">
              Request: <strong>{selectedTicketForCompletion?.title || selectedTicketForCompletion?.id}</strong>
            </p>
            
            <div className="completion-options">
              <label className="completion-option">
                <input
                  type="radio"
                  name="completion"
                  value="1-3"
                  checked={completionOption === '1-3'}
                  onChange={(e) => setCompletionOption(e.target.value)}
                />
                <span>1 to 3 days</span>
              </label>
              
              <label className="completion-option">
                <input
                  type="radio"
                  name="completion"
                  value="4-7"
                  checked={completionOption === '4-7'}
                  onChange={(e) => setCompletionOption(e.target.value)}
                />
                <span>4 to 7 days</span>
              </label>
              
              <label className="completion-option">
                <input
                  type="radio"
                  name="completion"
                  value="custom"
                  checked={completionOption === 'custom'}
                  onChange={(e) => setCompletionOption(e.target.value)}
                />
                <span>Custom date</span>
              </label>
            </div>

            {completionOption === 'custom' && (
              <div className="custom-date-input">
                <label>Select completion date:</label>
                <input
                  type="date"
                  value={customCompletionDate}
                  onChange={(e) => setCustomCompletionDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            <div className="modal-actions">
              <button 
                className="cancel-btn" 
                onClick={() => setShowEstimatedCompletionModal(false)}
                disabled={claiming}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn" 
                onClick={handleSetEstimatedCompletion}
                disabled={claiming}
              >
                {claiming ? 'Claiming...' : 'Claim & Set Completion Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
