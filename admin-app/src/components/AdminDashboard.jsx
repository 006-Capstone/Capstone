import { useState, useEffect, useMemo, useRef } from 'react';
import { FaBell, FaInbox, FaTicketAlt, FaClipboard, FaCheckCircle, FaUserCircle } from 'react-icons/fa';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Notifications from './Notifications';
import ClaimETCModal from './ClaimETCModal';
import { notifyStudentStatusChange, notifyStudentEtcChange } from '../utils/notificationHelper';
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
  // Ticket awaiting its Estimated Time of Completion in the claim modal.
  const [etcClaimTicket, setEtcClaimTicket] = useState(null);
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
      const parsedData = JSON.parse(storedStaffData);
      console.log('[AdminDashboard] Staff office:', parsedData.office);
      console.log('[AdminDashboard] Department prop:', department);
      setStaffData(parsedData);
    }
  }, [department]);

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

  const handleClaimTicket = async (ticket, etc = '') => {
    if (!staffData) {
      alert('Staff data not found. Please login again.');
      return;
    }

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

      // Notify the student about the new estimated completion date when one
      // was set during claiming.
      if (etc && ticket.studentUid) {
        await notifyStudentEtcChange(ticket.studentUid, ticket.id, ticket.title, etc);
      }

      alert(`Request ${ticket.id} has been assigned to you!`);
    } catch (error) {
      console.error('[Error] Error claiming ticket:', error);
      alert('Failed to claim request: ' + error.message);
      setClaiming(false);
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

  // Secondary action: skip the manual ETC override and claim normally.
  const handleEtcSkip = () => {
    if (!etcClaimTicket) return;
    const ticket = etcClaimTicket;
    setEtcClaimTicket(null);
    handleClaimTicket(ticket);
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
                          onClick={() => handleClaimRequest(ticket)}
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

      {etcClaimTicket && (
        <ClaimETCModal
          ticket={etcClaimTicket}
          onConfirm={handleEtcConfirm}
          onSkip={handleEtcSkip}
          onCancel={handleEtcCancel}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
