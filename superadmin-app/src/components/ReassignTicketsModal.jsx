import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaTimes, 
  FaExchangeAlt, 
  FaUser, 
  FaTicketAlt, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaSearch,
  FaClock,
  FaBuilding,
  FaArrowRight,
  FaCheck,
  FaUserFriends
} from 'react-icons/fa';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useNotification } from '../context/NotificationContext';
import '../styles/ReassignTicketsModal.css';

const ReassignTicketsModal = ({ isOpen, onClose, staffMember, allStaff, onReassignSuccess }) => {
  const { toast, alertModal } = useNotification();
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [targetStaff, setTargetStaff] = useState('');
  const [loading, setLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && staffMember) {
      setSelectedTickets([]);
      setTargetStaff('');
      setSearchTerm('');
      loadStaffTickets();
    }
  }, [isOpen, staffMember]);

  const loadStaffTickets = async () => {
    try {
      setLoading(true);
      // Query requests collection (primary for student requests in this app)
      let requestsSnap = await getDocs(collection(db, 'requests'));
      if (requestsSnap.empty) {
        requestsSnap = await getDocs(collection(db, 'tickets'));
      }
      
      const memberName = (staffMember?.name || '').trim().toLowerCase();
      const memberId = staffMember?.id || staffMember?.firestoreId || '';
      const memberUid = staffMember?.uid || '';

      const closedStatuses = ['resolved', 'cancelled', 'completed', 'rejected'];

      const staffTickets = requestsSnap.docs
        .map(docSnap => {
          const data = docSnap.data();
          return {
            ...data,
            firestoreId: docSnap.id,
            id: docSnap.id
          };
        })
        .filter(ticket => {
          const status = (ticket.status || '').trim().toLowerCase();
          if (closedStatuses.includes(status)) return false;

          const assigned = (ticket.assignedTo || '').trim().toLowerCase();
          const claimed = (ticket.claimedBy || '').trim().toLowerCase();
          const assignedStaff = (ticket.assignedToStaff || '').trim().toLowerCase();
          const staffUid = ticket.assignedToStaff || ticket.assignedStaffId || ticket.claimedByUid || '';

          const isAssigned = (memberName && (assigned === memberName || claimed === memberName || assignedStaff === memberName)) ||
            (memberId && (staffUid === memberId || ticket.assignedToStaff === memberId)) ||
            (memberUid && (staffUid === memberUid || ticket.claimedByUid === memberUid));

          return isAssigned;
        })
        .sort((a, b) => {
          const aOverdue = isTicketOverdue(a);
          const bOverdue = isTicketOverdue(b);
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;

          const getTime = (t) => {
            if (typeof t?.createdAt?.toMillis === 'function') return t.createdAt.toMillis();
            if (t?.createdAt?.seconds) return t.createdAt.seconds * 1000;
            if (t?.createdAt) return new Date(t.createdAt).getTime();
            return 0;
          };

          return getTime(b) - getTime(a);
        });

      setTickets(staffTickets);
    } catch (error) {
      console.error('[ReassignTicketsModal] Error loading tickets:', error);
      if (toast?.error) toast.error('Failed to load tickets for reassignment');
    } finally {
      setLoading(false);
    }
  };

  const isTicketOverdue = (ticket) => {
    if (!ticket.createdAt) return false;
    const status = (ticket.status || '').toLowerCase();
    if (['resolved', 'completed', 'cancelled', 'rejected'].includes(status)) {
      return false;
    }

    const SLA_THRESHOLDS = {
      'urgent': 24,
      'high': 24,
      'medium': 72,
      'normal': 72,
      'low': 120
    };

    let createdTime = 0;
    if (typeof ticket.createdAt?.toMillis === 'function') {
      createdTime = ticket.createdAt.toMillis();
    } else if (ticket.createdAt?.seconds) {
      createdTime = ticket.createdAt.seconds * 1000;
    } else if (ticket.createdAt) {
      createdTime = new Date(ticket.createdAt).getTime();
    }

    if (!createdTime || isNaN(createdTime)) return false;

    const hoursElapsed = (Date.now() - createdTime) / (1000 * 60 * 60);
    const urgencyKey = (ticket.urgency || ticket.priority || 'medium').toLowerCase();
    const threshold = SLA_THRESHOLDS[urgencyKey] || 72;

    return hoursElapsed > threshold;
  };

  const formatRequestAge = (createdAt) => {
    if (!createdAt) return 'Recent';
    let date;
    if (typeof createdAt?.toDate === 'function') date = createdAt.toDate();
    else if (createdAt?.seconds) date = new Date(createdAt.seconds * 1000);
    else date = new Date(createdAt);

    if (isNaN(date.getTime())) return 'Recent';
    const hours = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleTicketToggle = (ticketId) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTickets.length === filteredTickets.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(filteredTickets.map(t => t.id));
    }
  };

  const handleSelectOverdueOnly = () => {
    const overdueIds = tickets.filter(isTicketOverdue).map(t => t.id);
    setSelectedTickets(overdueIds);
  };

  // Filter tickets by search term
  const filteredTickets = useMemo(() => {
    if (!searchTerm.trim()) return tickets;
    const term = searchTerm.toLowerCase();
    return tickets.filter(ticket => {
      const id = (ticket.requestId || ticket.ticketId || ticket.id || '').toLowerCase();
      const subject = (ticket.subject || ticket.requestType || ticket.documentType || '').toLowerCase();
      const student = (ticket.studentName || ticket.userName || '').toLowerCase();
      const dept = (ticket.office || ticket.department || '').toLowerCase();
      return id.includes(term) || subject.includes(term) || student.includes(term) || dept.includes(term);
    });
  }, [tickets, searchTerm]);

  const overdueCount = useMemo(() => {
    return tickets.filter(isTicketOverdue).length;
  }, [tickets]);

  const handleReassign = async () => {
    if (!targetStaff || selectedTickets.length === 0) {
      if (toast?.warning) toast.warning('Please select a target colleague and at least one request');
      return;
    }

    const targetStaffMember = allStaff.find(s => (s.id === targetStaff || s.firestoreId === targetStaff || s.uid === targetStaff));
    if (!targetStaffMember) {
      if (toast?.error) toast.error('Invalid target colleague selected');
      return;
    }

    const targetUid = targetStaffMember.uid || targetStaffMember.id || targetStaffMember.firestoreId;
    const targetName = targetStaffMember.name;
    const fromUid = staffMember.uid || staffMember.id || staffMember.firestoreId;
    const fromName = staffMember.name;

    try {
      setReassigning(true);

      // Update each selected ticket/request
      for (const ticketId of selectedTickets) {
        const ticketDoc = tickets.find(t => t.id === ticketId || t.firestoreId === ticketId);
        const actualDocId = ticketDoc?.firestoreId || ticketDoc?.id || ticketId;
        const displayRequestId = ticketDoc?.requestId || ticketDoc?.ticketId || actualDocId;

        const updatePayload = {
          assignedTo: targetName,
          claimedBy: targetName,
          assignedToStaff: targetName,
          claimedByUid: targetUid,
          assignedStaffId: targetUid,
          reassignedToStaff: targetName,
          reassignedFromStaff: fromName,
          reassignedBy: 'Super Administrator',
          reassignedAt: serverTimestamp(),
          reassignReason: 'workload_rebalancing',
          workloadRebalanced: true,
          status: 'In Process',
          updatedAt: serverTimestamp(),
          followUps: arrayUnion({
            message: `Workload rebalanced: Request reassigned from ${fromName} to ${targetName} by Super Administrator.`,
            sentBy: 'system',
            sentByName: 'Super Administrator',
            sentAt: new Date().toISOString()
          })
        };

        try {
          await updateDoc(doc(db, 'requests', actualDocId), updatePayload);
        } catch (errReq) {
          console.warn('[ReassignTicketsModal] updateDoc requests failed, trying tickets:', errReq);
          try {
            await updateDoc(doc(db, 'tickets', actualDocId), updatePayload);
          } catch (errTick) {
            console.error('[ReassignTicketsModal] Failed to update ticket document:', errTick);
          }
        }

        // Create notification for target staff matching admin-app Notifications.jsx schema
        try {
          await addDoc(collection(db, 'notifications'), {
            recipientId: targetUid,
            recipientType: 'staff',
            userId: targetUid,
            userType: 'staff',
            recipientRole: 'staff',
            type: 'ticket_rerouted',
            title: '📋 Request Reassigned to You',
            message: `Request #${displayRequestId} has been reassigned to you from ${fromName} for workload rebalancing.`,
            isRead: false,
            read: false,
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            priority: 'medium',
            metadata: {
              requestId: displayRequestId,
              firestoreId: actualDocId,
              fromStaff: fromName,
              toStaff: targetName,
              reason: 'workload_rebalancing'
            }
          });
        } catch (notifErr) {
          console.warn('[ReassignTicketsModal] Target staff notification warning:', notifErr);
        }
      }

      // Create notification for original staff matching admin-app Notifications.jsx schema
      try {
        await addDoc(collection(db, 'notifications'), {
          recipientId: fromUid,
          recipientType: 'staff',
          userId: fromUid,
          userType: 'staff',
          recipientRole: 'staff',
          type: 'ticket_rerouted',
          title: '📋 Requests Reassigned',
          message: `${selectedTickets.length} request(s) have been reassigned to ${targetName} to help balance your workload.`,
          isRead: false,
          read: false,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp(),
          priority: 'low',
          metadata: {
            ticketCount: selectedTickets.length,
            toStaff: targetName,
            fromStaff: fromName,
            reason: 'workload_rebalancing'
          }
        });
      } catch (notifErr2) {
        console.warn('[ReassignTicketsModal] Original staff notification warning:', notifErr2);
      }

      // Log the reassignment for audit history
      try {
        await addDoc(collection(db, 'performance_logs'), {
          action: 'tickets_reassigned',
          fromStaffId: fromUid,
          fromStaffName: fromName,
          toStaffId: targetUid,
          toStaffName: targetName,
          ticketCount: selectedTickets.length,
          ticketIds: selectedTickets,
          timestamp: serverTimestamp(),
          reason: 'workload_rebalancing',
          performedBy: 'Super Administrator'
        });
      } catch (logErr) {
        console.warn('[ReassignTicketsModal] Audit log warning:', logErr);
      }

      if (alertModal) {
        await alertModal({
          title: 'Requests Reassigned',
          message: `Successfully transferred ${selectedTickets.length} request(s) from ${staffMember.name} to ${targetStaffMember.name}.`,
          variant: 'success'
        });
      } else if (toast?.success) {
        toast.success(`Successfully reassigned ${selectedTickets.length} request(s) to ${targetStaffMember.name}!`);
      }

      if (typeof onReassignSuccess === 'function') {
        onReassignSuccess();
      }

      onClose();
    } catch (error) {
      console.error('[ReassignTicketsModal] Error reassigning tickets:', error);
      if (toast?.error) toast.error('Failed to reassign requests. Please try again.');
    } finally {
      setReassigning(false);
    }
  };

  if (!isOpen || !staffMember) return null;

  const staffDept = (staffMember.department || staffMember.office || '').trim().toLowerCase();

  // Get available colleagues strictly from the same department/office
  const availableStaff = (allStaff || []).filter(s => {
    const sId = s.id || s.firestoreId;
    const mId = staffMember.id || staffMember.firestoreId;
    if (sId && mId && sId === mId) return false;
    if ((s.name || '').trim().toLowerCase() === (staffMember.name || '').trim().toLowerCase()) return false;

    const sDept = (s.department || s.office || '').trim().toLowerCase();
    return sDept && staffDept && sDept === staffDept;
  });

  const selectedTargetStaff = (allStaff || []).find(s => (s.id === targetStaff || s.firestoreId === targetStaff));
  const targetCurrentActive = selectedTargetStaff?.activeTickets ?? 0;
  const targetProjected = targetCurrentActive + selectedTickets.length;
  const sourceProjected = Math.max(0, tickets.length - selectedTickets.length);

  return (
    <div className="rtm-modal-overlay" onClick={onClose}>
      <div className="rtm-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="rtm-modal-header">
          <div className="rtm-header-left">
            <div className="rtm-header-icon-wrap">
              <FaExchangeAlt />
            </div>
            <div className="rtm-header-text">
              <div className="rtm-header-title-row">
                <h2>Reassign Active Requests</h2>
                <span className="rtm-dept-badge">
                  <FaBuilding className="rtm-badge-icon" />
                  {staffMember.department || staffMember.office || 'Department'}
                </span>
              </div>
              <p className="rtm-header-subtitle">
                Emergency coverage and workload rebalancing for <strong>{staffMember.name}</strong>
              </p>
            </div>
          </div>
          <button className="rtm-modal-close" onClick={onClose} aria-label="Close modal">
            <FaTimes />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="rtm-modal-body">
          {/* Workload Simulation Strip */}
          <div className="rtm-flow-panel">
            {/* Source Card */}
            <div className="rtm-flow-card source">
              <div className="rtm-card-header">
                <div className="rtm-card-avatar source">
                  {getInitials(staffMember.name)}
                </div>
                <div className="rtm-card-user">
                  <span className="rtm-card-role-label">Reassigning From</span>
                  <h4 className="rtm-card-name">{staffMember.name}</h4>
                </div>
              </div>
              <div className="rtm-flow-metrics">
                <div className="rtm-flow-metric-item">
                  <span className="rtm-metric-label">Current Active</span>
                  <span className="rtm-metric-val">{tickets.length}</span>
                </div>
                <div className="rtm-flow-metric-item">
                  <span className="rtm-metric-label">Projected Left</span>
                  <span className={`rtm-metric-val ${selectedTickets.length > 0 ? 'highlight-change' : ''}`}>
                    {sourceProjected}
                  </span>
                </div>
                {overdueCount > 0 && (
                  <div className="rtm-flow-metric-item danger">
                    <span className="rtm-metric-label">Overdue</span>
                    <span className="rtm-metric-val text-danger">{overdueCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Transfer Vector */}
            <div className="rtm-flow-connector">
              <div className="rtm-connector-circle">
                <FaArrowRight className="rtm-connector-icon" />
              </div>
              <span className="rtm-connector-badge">
                {selectedTickets.length > 0 ? `${selectedTickets.length} Moving` : 'Select Requests'}
              </span>
            </div>

            {/* Target Card */}
            <div className={`rtm-flow-card target ${selectedTargetStaff ? 'selected' : 'unselected'}`}>
              {selectedTargetStaff ? (
                <>
                  <div className="rtm-card-header">
                    <div className="rtm-card-avatar target">
                      {getInitials(selectedTargetStaff.name)}
                    </div>
                    <div className="rtm-card-user">
                      <span className="rtm-card-role-label">Receiving Colleague</span>
                      <h4 className="rtm-card-name">{selectedTargetStaff.name}</h4>
                    </div>
                  </div>
                  <div className="rtm-flow-metrics">
                    <div className="rtm-flow-metric-item">
                      <span className="rtm-metric-label">Current Active</span>
                      <span className="rtm-metric-val">{targetCurrentActive}</span>
                    </div>
                    <div className="rtm-flow-metric-item">
                      <span className="rtm-metric-label">Projected Total</span>
                      <span className="rtm-metric-val highlight-target">
                        {targetProjected}
                        {selectedTickets.length > 0 && (
                          <span className="rtm-increment-chip">+{selectedTickets.length}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rtm-target-placeholder">
                  <FaUserFriends className="rtm-placeholder-icon" />
                  <p className="rtm-placeholder-title">No Colleague Selected</p>
                  <p className="rtm-placeholder-hint">Choose a department peer below to preview workload</p>
                </div>
              )}
            </div>
          </div>

          {/* Colleague Selector */}
          <div className="rtm-section rtm-target-select-section">
            <label className="rtm-section-label">
              <span>1. Choose Colleague in Same Office</span>
              <span className="rtm-label-subtext">Must belong to {staffMember.department || staffMember.office}</span>
            </label>
            {availableStaff.length > 0 ? (
              <div className="rtm-select-wrapper">
                <select 
                  className="rtm-custom-select"
                  value={targetStaff}
                  onChange={(e) => setTargetStaff(e.target.value)}
                >
                  <option value="">-- Select a colleague to receive requests --</option>
                  {availableStaff.map(staff => {
                    const sid = staff.id || staff.firestoreId;
                    const activeCount = staff.activeTickets ?? 0;
                    return (
                      <option key={sid} value={sid}>
                        {staff.name} &bull; {activeCount} active request{activeCount === 1 ? '' : 's'}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div className="rtm-warning-notice">
                <FaExclamationTriangle className="rtm-warning-icon" />
                <div>
                  <strong>No eligible colleagues in {staffMember.department || staffMember.office}</strong>
                  <p>System policy enforces that requests can only be transferred between staff members of the same department.</p>
                </div>
              </div>
            )}
          </div>

          {/* Request Selection Section */}
          <div className="rtm-section rtm-requests-section">
            <div className="rtm-requests-toolbar">
              <div className="rtm-toolbar-header">
                <label className="rtm-section-label">
                  <span>2. Select Requests to Transfer</span>
                  <span className="rtm-label-count">
                    ({selectedTickets.length} of {tickets.length} selected)
                  </span>
                </label>
                <div className="rtm-quick-actions">
                  {tickets.length > 0 && (
                    <>
                      <button 
                        type="button" 
                        className={`rtm-action-pill ${selectedTickets.length === filteredTickets.length && filteredTickets.length > 0 ? 'active' : ''}`}
                        onClick={handleSelectAll}
                      >
                        {selectedTickets.length === filteredTickets.length && filteredTickets.length > 0 ? 'Deselect All' : `Select All (${filteredTickets.length})`}
                      </button>
                      {overdueCount > 0 && (
                        <button 
                          type="button" 
                          className="rtm-action-pill danger"
                          onClick={handleSelectOverdueOnly}
                          title="Select all overdue requests immediately"
                        >
                          <FaClock className="rtm-pill-icon" />
                          Overdue Only ({overdueCount})
                        </button>
                      )}
                      {selectedTickets.length > 0 && (
                        <button 
                          type="button" 
                          className="rtm-action-pill clear"
                          onClick={() => setSelectedTickets([])}
                        >
                          Clear
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Search filter if there are multiple tickets */}
              {tickets.length > 2 && (
                <div className="rtm-search-bar">
                  <FaSearch className="rtm-search-icon" />
                  <input
                    type="text"
                    className="rtm-search-input"
                    placeholder="Search by Request ID, Student name, or Document type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      type="button" 
                      className="rtm-search-clear" 
                      onClick={() => setSearchTerm('')}
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="rtm-state-box loading">
                <div className="rtm-spinner"></div>
                <p>Loading active requests from database...</p>
              </div>
            ) : filteredTickets.length > 0 ? (
              <div className="rtm-requests-list">
                {filteredTickets.map(ticket => {
                  const isSelected = selectedTickets.includes(ticket.id);
                  const overdue = isTicketOverdue(ticket);
                  const displayId = ticket.requestId || ticket.ticketId || ticket.id.slice(0, 8);
                  const displayTitle = ticket.subject || ticket.requestType || ticket.documentType || 'General Request';
                  const displayUrgency = ticket.urgency || ticket.priority || 'Normal';
                  const urgencyKey = displayUrgency.toLowerCase();
                  const ageString = formatRequestAge(ticket.createdAt);

                  return (
                    <div 
                      key={ticket.id} 
                      className={`rtm-request-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleTicketToggle(ticket.id)}
                    >
                      <div className="rtm-card-checkbox-wrap">
                        <div className={`rtm-custom-checkbox ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <FaCheck className="rtm-check-icon" />}
                        </div>
                      </div>

                      <div className="rtm-request-content">
                        <div className="rtm-request-top-row">
                          <span className="rtm-request-id">#{displayId}</span>
                          <span className={`rtm-urgency-badge ${urgencyKey}`}>
                            {displayUrgency}
                          </span>
                          {overdue && (
                            <span className="rtm-overdue-pill">
                              <FaClock className="rtm-pill-icon" />
                              OVERDUE
                            </span>
                          )}
                          <span className="rtm-timestamp-badge">{ageString}</span>
                        </div>

                        <h5 className="rtm-request-title">{displayTitle}</h5>

                        <div className="rtm-request-bottom-meta">
                          {ticket.studentName && (
                            <span className="rtm-meta-tag student">
                              <FaUser className="rtm-tag-icon" />
                              {ticket.studentName}
                            </span>
                          )}
                          <span className="rtm-meta-tag office">
                            {ticket.office || ticket.department || 'Office Request'}
                          </span>
                          <span className="rtm-meta-tag status">
                            {ticket.status || 'In Progress'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : tickets.length > 0 && searchTerm ? (
              <div className="rtm-state-box empty">
                <FaSearch className="rtm-empty-icon" />
                <p className="rtm-empty-title">No matching requests</p>
                <p className="rtm-empty-desc">No requests match "{searchTerm}". Try a different keyword or clear search.</p>
                <button type="button" className="rtm-reset-search-btn" onClick={() => setSearchTerm('')}>
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="rtm-state-box empty">
                <FaCheckCircle className="rtm-empty-icon success" />
                <p className="rtm-empty-title">Queue is Clear</p>
                <p className="rtm-empty-desc">There are no active or pending requests assigned to {staffMember.name}.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="rtm-modal-footer">
          <div className="rtm-footer-left">
            <span className="rtm-selection-summary">
              <strong>{selectedTickets.length}</strong> request{selectedTickets.length === 1 ? '' : 's'} selected
              {selectedTargetStaff && ` &rarr; ${selectedTargetStaff.name}`}
            </span>
          </div>

          <div className="rtm-footer-right">
            <button 
              type="button" 
              className="rtm-btn-cancel" 
              onClick={onClose} 
              disabled={reassigning}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="rtm-btn-submit" 
              onClick={handleReassign}
              disabled={reassigning || !targetStaff || selectedTickets.length === 0 || availableStaff.length === 0}
            >
              <FaExchangeAlt className={reassigning ? 'rtm-spin-icon' : ''} />
              <span>
                {reassigning 
                  ? 'Reassigning Requests...' 
                  : selectedTickets.length > 0 
                    ? `Confirm Reassignment (${selectedTickets.length})` 
                    : 'Select Requests to Reassign'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReassignTicketsModal;
