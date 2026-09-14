import React, { useState, useEffect } from 'react';
import { FaTimes, FaExchangeAlt, FaUser, FaTicketAlt, FaCheckCircle } from 'react-icons/fa';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/ReassignTicketsModal.css';

const ReassignTicketsModal = ({ isOpen, onClose, staffMember, allStaff }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [targetStaff, setTargetStaff] = useState('');
  const [loading, setLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (isOpen && staffMember) {
      loadStaffTickets();
    }
  }, [isOpen, staffMember]);

  const loadStaffTickets = async () => {
    try {
      setLoading(true);
      const ticketsRef = collection(db, 'tickets');
      const ticketsSnap = await getDocs(ticketsRef);
      
      const staffTickets = ticketsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ticket => {
          const assigned = ticket.assignedTo || ticket.claimedBy || '';
          const staffUid = ticket.assignedToStaff || '';
          const memberName = staffMember.name.toLowerCase();
          const memberUid = staffMember.id;
          
          return (
            ticket.status !== 'Resolved' &&
            ticket.status !== 'Cancelled' &&
            ((assigned && assigned.toLowerCase() === memberName) ||
             (memberUid && staffUid === memberUid))
          );
        })
        .sort((a, b) => {
          // Sort by priority: overdue first, then by created date
          const aOverdue = isTicketOverdue(a);
          const bOverdue = isTicketOverdue(b);
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });

      setTickets(staffTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      alert('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const isTicketOverdue = (ticket) => {
    if (!ticket.createdAt || ticket.status === 'Resolved' || ticket.status === 'Cancelled') {
      return false;
    }

    const SLA_THRESHOLDS = {
      'High': 24,
      'Medium': 72,
      'Low': 120
    };

    const createdTime = ticket.createdAt.toMillis();
    const now = Date.now();
    const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);
    const threshold = SLA_THRESHOLDS[ticket.urgency] || 72;

    return hoursElapsed > threshold;
  };

  const handleTicketToggle = (ticketId) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTickets.length === tickets.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(tickets.map(t => t.id));
    }
  };

  const handleReassign = async () => {
    if (!targetStaff || selectedTickets.length === 0) {
      alert('Please select target staff and at least one ticket');
      return;
    }

    const targetStaffMember = allStaff.find(s => s.id === targetStaff);
    if (!targetStaffMember) {
      alert('Invalid target staff selected');
      return;
    }

    try {
      setReassigning(true);

      // Update each selected ticket
      for (const ticketId of selectedTickets) {
        const ticketRef = doc(db, 'tickets', ticketId);
        await updateDoc(ticketRef, {
          assignedTo: targetStaffMember.name,
          assignedToStaff: targetStaffMember.id,
          claimedBy: targetStaffMember.name,
          reassignedAt: serverTimestamp(),
          reassignedFrom: staffMember.name,
          reassignedBy: 'superadmin',
          reassignReason: 'workload_rebalancing'
        });

        // Create notification for target staff
        await addDoc(collection(db, 'notifications'), {
          userId: targetStaffMember.id,
          userType: 'staff',
          type: 'ticket_reassigned',
          title: '📋 New Ticket Assigned',
          message: `A ticket has been reassigned to you from ${staffMember.name} for workload rebalancing.`,
          timestamp: serverTimestamp(),
          read: false,
          priority: 'medium',
          metadata: {
            ticketId: ticketId,
            fromStaff: staffMember.name,
            reason: 'workload_rebalancing'
          }
        });
      }

      // Create notification for original staff
      await addDoc(collection(db, 'notifications'), {
        userId: staffMember.id,
        userType: 'staff',
        type: 'tickets_reassigned',
        title: '📋 Tickets Reassigned',
        message: `${selectedTickets.length} ticket(s) have been reassigned to ${targetStaffMember.name} to help balance your workload.`,
        timestamp: serverTimestamp(),
        read: false,
        priority: 'low',
        metadata: {
          ticketCount: selectedTickets.length,
          toStaff: targetStaffMember.name,
          reason: 'workload_rebalancing'
        }
      });

      // Log the reassignment
      await addDoc(collection(db, 'performance_logs'), {
        action: 'tickets_reassigned',
        fromStaffId: staffMember.id,
        fromStaffName: staffMember.name,
        toStaffId: targetStaffMember.id,
        toStaffName: targetStaffMember.name,
        ticketCount: selectedTickets.length,
        ticketIds: selectedTickets,
        timestamp: serverTimestamp(),
        reason: 'workload_rebalancing'
      });

      alert(`✅ Successfully reassigned ${selectedTickets.length} ticket(s) to ${targetStaffMember.name}`);
      onClose();
    } catch (error) {
      console.error('Error reassigning tickets:', error);
      alert('❌ Failed to reassign tickets. Please try again.');
    } finally {
      setReassigning(false);
    }
  };

  if (!isOpen || !staffMember) return null;

  // Get available staff from same department
  const availableStaff = allStaff.filter(s => 
    s.id !== staffMember.id && 
    s.department === staffMember.department &&
    s.activeTickets < staffMember.activeTickets // Only show less loaded staff
  );

  const selectedTargetStaff = allStaff.find(s => s.id === targetStaff);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content reassign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <FaExchangeAlt className="modal-icon" />
            <div>
              <h2>Reassign Tickets</h2>
              <p className="modal-subtitle">Rebalance workload for {staffMember.name}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          {/* Staff Comparison */}
          <div className="staff-comparison">
            <div className="comparison-card from-staff">
              <div className="comparison-header">
                <FaUser />
                <span>From: {staffMember.name}</span>
              </div>
              <div className="comparison-stats">
                <div className="stat-item">
                  <span className="stat-label">Active Tickets:</span>
                  <span className="stat-value">{staffMember.activeTickets}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Overdue:</span>
                  <span className="stat-value danger">{staffMember.overdueTickets}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Risk Score:</span>
                  <span className={`stat-value ${staffMember.riskScore >= 70 ? 'danger' : 'warning'}`}>
                    {staffMember.riskScore}%
                  </span>
                </div>
              </div>
            </div>

            <div className="comparison-arrow">
              <FaExchangeAlt />
            </div>

            <div className="comparison-card to-staff">
              <div className="comparison-header">
                <FaUser />
                <span>To: {selectedTargetStaff ? selectedTargetStaff.name : 'Select Staff'}</span>
              </div>
              {selectedTargetStaff && (
                <div className="comparison-stats">
                  <div className="stat-item">
                    <span className="stat-label">Active Tickets:</span>
                    <span className="stat-value">{selectedTargetStaff.activeTickets}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">After Reassign:</span>
                    <span className="stat-value success">
                      {selectedTargetStaff.activeTickets + selectedTickets.length}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Risk Score:</span>
                    <span className={`stat-value ${selectedTargetStaff.riskScore >= 70 ? 'danger' : selectedTargetStaff.riskScore >= 40 ? 'warning' : 'success'}`}>
                      {selectedTargetStaff.riskScore}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Target Staff Selection */}
          <div className="target-staff-section">
            <label className="section-label">Select Target Staff:</label>
            {availableStaff.length > 0 ? (
              <select 
                className="staff-select"
                value={targetStaff}
                onChange={(e) => setTargetStaff(e.target.value)}
              >
                <option value="">-- Select Staff Member --</option>
                {availableStaff.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.activeTickets} active tickets)
                  </option>
                ))}
              </select>
            ) : (
              <div className="no-staff-available">
                No available staff members in {staffMember.department} department with lower workload.
              </div>
            )}
          </div>

          {/* Ticket Selection */}
          <div className="ticket-selection-section">
            <div className="section-header">
              <label className="section-label">
                Select Tickets to Reassign ({selectedTickets.length} selected):
              </label>
              {tickets.length > 0 && (
                <button className="select-all-btn" onClick={handleSelectAll}>
                  {selectedTickets.length === tickets.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="loading-state">Loading tickets...</div>
            ) : tickets.length > 0 ? (
              <div className="tickets-list">
                {tickets.map(ticket => {
                  const overdue = isTicketOverdue(ticket);
                  return (
                    <label key={ticket.id} className="ticket-item">
                      <input
                        type="checkbox"
                        checked={selectedTickets.includes(ticket.id)}
                        onChange={() => handleTicketToggle(ticket.id)}
                      />
                      <div className="ticket-info">
                        <div className="ticket-header">
                          <span className="ticket-id">#{ticket.ticketId || ticket.id.slice(0, 6)}</span>
                          <span className={`urgency-badge ${ticket.urgency?.toLowerCase()}`}>
                            {ticket.urgency}
                          </span>
                          {overdue && <span className="overdue-badge">OVERDUE</span>}
                        </div>
                        <div className="ticket-subject">{ticket.subject}</div>
                        <div className="ticket-meta">
                          <span>{ticket.category}</span>
                          <span>•</span>
                          <span>{ticket.status}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="no-tickets-state">
                No reassignable tickets found for this staff member.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={reassigning}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleReassign}
            disabled={reassigning || !targetStaff || selectedTickets.length === 0 || availableStaff.length === 0}
          >
            {reassigning ? 'Reassigning...' : `Reassign ${selectedTickets.length} Ticket(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReassignTicketsModal;
