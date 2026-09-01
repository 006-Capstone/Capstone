import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaUndo, FaCheck, FaFileAlt, FaDownload, FaUserCircle, FaEnvelope, FaCheckCircle, FaTimes } from 'react-icons/fa';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyStudentStatusChange, notifyStudentComment, notifyStaffReassignment } from '../utils/notificationHelper';
import Notifications from './Notifications';
import LoadingSpinner from './LoadingSpinner';
import '../styles/TicketDetails.css';

const TicketDetails = ({ ticketData, department, onNavigate }) => {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [reassignOffice, setReassignOffice] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('Normal');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignNote, setReassignNote] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fileInputRef = useRef(null);

  // Presentation-layer only: mirrors the student Status Timeline structure.
  // These local state arrays drive the timeline sub-nodes for full workflow
  // transparency. No backend routing or database schemas are read or written.
  const [scheduleAdjustments] = useState([
    {
      id: 'adj-1',
      fromDate: 'Aug 28, 2026',
      toDate: 'Sep 3, 2026',
      reason: 'Additional verification of submitted requirements delayed the processing timeline.',
      adjustedAt: 'Sep 1, 2026'
    }
  ]);

  const [reassignments] = useState([
    {
      id: 're-1',
      previousOffice: 'Library Office',
      newOffice: 'Finance Office',
      reason: 'The request involves verifying outstanding book balances at the Library Office.',
      reassignedAt: 'Sep 2, 2026',
      handledBy: 'Finance Department Staff'
    }
  ]);

  const [returnTransfers] = useState([
    {
      id: 'rt-1',
      fromOffice: 'Finance Office',
      toOffice: 'Library Office',
      note: 'Outstanding book balances have been verified and settled. Returning the request to the Library Office for final resolution.',
      returnedAt: 'Sep 5, 2026'
    }
  ]);

  useEffect(() => {
    if (ticketData) {
      loadTicketDetails();
    }
    
    // Listen for unread notifications
    const staffData = JSON.parse(localStorage.getItem('staffData'));
    if (staffData?.uid) {
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
    }
  }, [ticketData]);

  const loadTicketDetails = async () => {
    try {
      setLoading(true);
      
      const docRef = doc(db, 'requests', ticketData.firestoreId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTicket({
          ...data,
          firestoreId: docSnap.id
        });
        setReassignOffice(data.office || '');
        setUrgencyLevel(data.urgencyLevel || 'Normal');
        console.log('✅ Loaded ticket details:', {
          requestId: data.requestId,
          office: data.office,
          assignedTo: data.assignedTo,
          claimedBy: data.claimedBy,
          status: data.status,
          officeHistory: data.officeHistory
        });
      } else {
        console.error('❌ Ticket not found');
        alert('Ticket not found');
      }
    } catch (error) {
      console.error('❌ Error loading ticket:', error);
      alert('Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
    
    if (validFiles.length < files.length) {
      alert('Some files exceed 5MB and were not added');
    }
    
    setReplyFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index) => {
    setReplyFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() && replyFiles.length === 0) {
      alert('Please add a message or attach files');
      return;
    }

    try {
      setSending(true);
      
      // Convert files to base64
      const attachments = [];
      for (let file of replyFiles) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        attachments.push({
          name: file.name,
          data: base64,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        });
      }

      const staffData = JSON.parse(localStorage.getItem('staffData'));
      
      // Add follow-up to Firestore
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, {
        followUps: arrayUnion({
          message: replyMessage.trim(),
          attachments: attachments,
          sentBy: 'staff',
          sentByName: staffData.name,
          sentAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      // Notify student about the reply
      await notifyStudentComment(
        ticket.studentUid,
        ticket.requestId,
        ticket.subject,
        staffData.name
      );

      alert('Reply sent successfully!');
      setReplyMessage('');
      setReplyFiles([]);
      loadTicketDetails();
      
    } catch (error) {
      console.error('❌ Error sending reply:', error);
      alert('Failed to send reply: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleReturnTicket = async () => {
    const reason = prompt('Please provide a reason for returning this ticket:');
    if (!reason) return;

    try {
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, {
        status: 'Returned',
        returnedAt: serverTimestamp(),
        returnedReason: reason,
        updatedAt: serverTimestamp()
      });
      
      alert('Ticket returned successfully');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('❌ Error returning ticket:', error);
      alert('Failed to return ticket');
    }
  };

  const handleResolveTicket = async () => {
    if (!window.confirm('Are you sure you want to resolve this ticket?')) {
      return;
    }

    try {
      const oldStatus = ticket.status;
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, {
        status: 'Resolved',
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Notify student about status change
      await notifyStudentStatusChange(
        ticket.studentUid,
        ticket.requestId,
        ticket.subject,
        oldStatus,
        'Resolved'
      );
      
      alert('Ticket resolved successfully');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('❌ Error resolving ticket:', error);
      alert('Failed to resolve ticket');
    }
  };

  const generateRequestId = (officeName) => {
    // Generate format: FIN-123-654-789
    const officePrefix = officeName.substring(0, 3).toUpperCase();
    const randomNum1 = Math.floor(100 + Math.random() * 900); // 3 digits
    const randomNum2 = Math.floor(100 + Math.random() * 900); // 3 digits
    const randomNum3 = Math.floor(100 + Math.random() * 900); // 3 digits
    return `${officePrefix}-${randomNum1}-${randomNum2}-${randomNum3}`;
  };

  const handleUrgencyChange = async (newUrgency) => {
    setUrgencyLevel(newUrgency);
    
    // Save urgency level change to database
    try {
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, {
        urgencyLevel: newUrgency,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating urgency level:', error);
    }
  };

  const handleReassign = async () => {
    if (reassignOffice === ticket.office) {
      alert('Ticket is already assigned to this office');
      return;
    }

    // Show modal to get reassignment note
    setShowReassignModal(true);
  };

  const confirmReassign = async () => {
    if (!reassignNote.trim()) {
      alert('Please provide a reason for reassigning this ticket');
      return;
    }

    if (reassignNote.trim().length < 10) {
      alert('Please provide a more detailed reason (at least 10 characters)');
      return;
    }

    try {
      setShowReassignModal(false);
      
      // Generate new request ID based on new office
      const newRequestId = generateRequestId(reassignOffice);
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      
      // Create or update office history to track who handled it in each office
      const currentOfficeHistory = ticket.officeHistory || {};
      
      // Save current handler before reassigning (use claimedBy if available, otherwise assignedTo)
      const currentHandler = ticket.claimedBy || ticket.assignedTo || staffData.name;
      if (currentHandler) {
        currentOfficeHistory[ticket.office] = {
          handledBy: currentHandler,
          handledAt: new Date().toISOString()
        };
      }
      
      console.log('📋 Office History:', currentOfficeHistory);
      console.log('🔍 Checking for previous handler in', reassignOffice);
      
      // Check if the ticket was previously in the target office
      const previousHandler = currentOfficeHistory[reassignOffice];
      console.log('👤 Previous Handler:', previousHandler);
      
      const updateData = {
        office: reassignOffice,
        requestId: newRequestId, // Update request ID to match new office
        officeId: reassignOffice.toLowerCase(),
        reassignedFrom: ticket.office, // Track original office
        reassignedBy: staffData.name, // Track who reassigned it
        reassignedAt: serverTimestamp(),
        reassignmentNote: reassignNote.trim(), // Store the reason
        previousRequestId: ticket.requestId, // Keep old request ID for reference
        previousOffice: ticket.office, // Track for history
        officeHistory: currentOfficeHistory, // Save office history
        urgencyLevel: urgencyLevel, // Use selected urgency level
        updatedAt: serverTimestamp()
      };
      
      // If ticket was previously in this office, auto-assign to previous handler
      if (previousHandler && previousHandler.handledBy) {
        console.log('✅ Auto-assigning to previous handler:', previousHandler.handledBy);
        updateData.assignedTo = previousHandler.handledBy;
        updateData.claimedBy = previousHandler.handledBy;
        updateData.claimedAt = new Date().toISOString();
        updateData.status = 'In Process'; // Auto-set to In Process since it's claimed
        updateData.assignedToStaff = previousHandler.handledBy; // Add this field too
        
        // Add follow-ups for reassignment and auto-assignment
        updateData.followUps = arrayUnion(
          {
            message: `Ticket reassigned from ${ticket.office} to ${reassignOffice} by ${staffData.name}\n\nReason: ${reassignNote.trim()}`,
            sentBy: 'system',
            sentByName: 'System',
            sentAt: new Date().toISOString()
          },
          {
            message: `Ticket automatically assigned to ${previousHandler.handledBy} (previously handled this ticket in ${reassignOffice})`,
            sentBy: 'system',
            sentByName: 'System',
            sentAt: new Date().toISOString()
          }
        );
      } else {
        console.log('❌ No previous handler found. Setting to Pending.');
        // New office - clear assignments
        updateData.assignedTo = null;
        updateData.claimedBy = null;
        updateData.claimedAt = null;
        updateData.assignedToStaff = null;
        updateData.status = 'Pending'; // Reset to pending for new office
        
        // Add follow-up for reassignment only
        updateData.followUps = arrayUnion({
          message: `Ticket reassigned from ${ticket.office} to ${reassignOffice} by ${staffData.name}\n\nReason: ${reassignNote.trim()}`,
          sentBy: 'system',
          sentByName: 'System',
          sentAt: new Date().toISOString()
        });
      }
      
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, updateData);
      
      // Notify student about the reassignment
      await notifyStudentStatusChange(
        ticket.studentUid,
        ticket.requestId,
        ticket.subject,
        ticket.status,
        updateData.status
      );
      
      // Notify staff in the target office about the rerouted ticket
      await notifyStaffReassignment(
        reassignOffice,
        newRequestId,
        ticket.subject,
        ticket.office,
        staffData.name
      );
      
      setReassignNote(''); // Clear the note
      
      if (previousHandler && previousHandler.handledBy) {
        alert(`Ticket reassigned successfully!\nNew Request ID: ${newRequestId}\nAuto-assigned to ${previousHandler.handledBy} in ${reassignOffice}.`);
      } else {
        alert(`Ticket reassigned successfully!\nNew Request ID: ${newRequestId}\nThe ticket will appear in ${reassignOffice}'s dashboard for claiming.`);
      }
      
      onNavigate('my-tickets');
    } catch (error) {
      console.error('❌ Error reassigning ticket:', error);
      alert('Failed to reassign ticket: ' + error.message);
    }
  };

  const cancelReassign = () => {
    setShowReassignModal(false);
    setReassignNote('');
  };

  const downloadAttachment = (attachment) => {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    link.click();
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const maskEmail = (email) => {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (username.length <= 3) return email;
    return `${username.substring(0, 2)}.*****${username.substring(username.length - 2)}@${domain}`;
  };

  const handleBackToTickets = () => {
    onNavigate('my-tickets');
  };

  if (loading || !ticket) {
    return <LoadingSpinner message="Loading ticket details..." fullScreen={true} />;
  }

  return (
    <div className="ticket-details-container">
      <div className="breadcrumb">
        <span className="breadcrumb-item clickable" onClick={handleBackToTickets}>
          All Ticket
        </span>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-item">Ticket Details</span>
      </div>

      <div className="page-header">
        <h1 className="page-title">Ticket Details</h1>
        <div className="notification-bell" onClick={() => setShowNotifications(true)}>
          <FaBell className="bell-icon" />
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </div>
      </div>

      <div className="ticket-details-content">
        <div className="main-ticket-section">
          <div className="ticket-card">
            <div className="ticket-card-header">
              <div className="ticket-title-section">
                <h2>{ticket.subject?.toUpperCase()}</h2>
                <p className="ticket-number-display">#{ticket.requestId}</p>
              </div>
              <span className="ticket-status-badge">{ticket.status}</span>
            </div>
            
            <div className="ticket-action-buttons">
              {ticket.status !== 'Resolved' && ticket.status !== 'Cancelled' && (
                <>
                  <button className="return-btn" onClick={handleReturnTicket}>
                    <FaUndo />
                    Return Ticket
                  </button>
                  <button className="resolve-btn" onClick={handleResolveTicket}>
                    <FaCheck />
                    Resolve Ticket
                  </button>
                </>
              )}
            </div>
            
            <p className="submitted-time">Submitted {getTimeAgo(ticket.createdAt)}</p>
          </div>

          <div className="submission-section">
            <div className="section-header-row">
              <h3 className="section-title">Original Submission</h3>
              <span className="created-date">Created on {formatDate(ticket.createdAt)}</span>
            </div>
            
            {/* Show reassignment note if ticket was reassigned */}
            {ticket.reassignedFrom && ticket.reassignmentNote && (
              <div className="reassignment-notice">
                <div className="reassignment-notice-header">
                  <FaCheckCircle className="reassignment-icon" />
                  <div>
                    <strong>Rerouted from {ticket.reassignedFrom}</strong>
                    <span className="reassignment-date"> on {formatDate(ticket.reassignedAt)}</span>
                  </div>
                </div>
                <div className="reassignment-note-content">
                  <p className="reassignment-note-label">Note from {ticket.reassignedFrom}:</p>
                  <p className="reassignment-note-text">"{ticket.reassignmentNote}"</p>
                  {ticket.previousRequestId && (
                    <p className="reassignment-previous-id">Previous Request ID: #{ticket.previousRequestId}</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="submission-message">
              "{ticket.description}"
            </div>
            
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="attachments">
                {ticket.attachments.map((file, index) => (
                  <div key={index} className="attachment-file" onClick={() => downloadAttachment(file)}>
                    <FaFileAlt className="file-icon" />
                    <span className="file-name">{file.name}</span>
                    <FaDownload className="download-icon" />
                  </div>
                ))}
              </div>
            )}

            {/* Display follow-ups (exclude system reassignment messages since we show them in the notice box) */}
            {ticket.followUps && ticket.followUps
              .filter(followUp => {
                // Filter out system messages about reassignment since we display them in the notice box
                if (followUp.sentBy === 'system') {
                  return !(
                    followUp.message.includes('Ticket reassigned from') ||
                    followUp.message.includes('Ticket automatically assigned to')
                  );
                }
                return true;
              })
              .map((followUp, index) => (
              <div key={index} className={`followup-message ${followUp.sentBy === 'staff' ? 'staff-message' : 'student-message'}`}>
                <div className="followup-header">
                  <FaUserCircle className="followup-avatar" />
                  <div>
                    <span className="followup-sender">{followUp.sentBy === 'staff' ? followUp.sentByName : ticket.studentName}</span>
                    <span className="followup-date">{formatDate(followUp.sentAt)}</span>
                  </div>
                </div>
                <p className="followup-text">{followUp.message}</p>
                {followUp.attachments && followUp.attachments.length > 0 && (
                  <div className="attachments">
                    {followUp.attachments.map((file, idx) => (
                      <div key={idx} className="attachment-file" onClick={() => downloadAttachment(file)}>
                        <FaFileAlt className="file-icon" />
                        <span className="file-name">{file.name}</span>
                        <FaDownload className="download-icon" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {ticket.status !== 'Resolved' && ticket.status !== 'Cancelled' && (
              <div className="reply-section">
                <div className="reply-form-card">
                  <div className="reply-header">
                    <FaUserCircle className="reply-avatar" />
                    <span className="reply-label">Add a follow-up comment</span>
                  </div>
                  
                  <textarea 
                    className="reply-textarea"
                    placeholder="Type your message here..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    disabled={sending}
                  />
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  
                  {replyFiles.length > 0 && (
                    <div className="uploaded-files-list">
                      {replyFiles.map((file, index) => (
                        <div key={index} className="uploaded-file-item">
                          <span className="file-name">{file.name}</span>
                          <button onClick={() => handleRemoveFile(index)} className="remove-file-btn">
                            <FaTimes />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="reply-actions">
                    <button 
                      className="request-info-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                    >
                      Attach Files
                    </button>
                    <button 
                      className="send-message-btn"
                      onClick={handleSendReply}
                      disabled={sending}
                    >
                      {sending ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="status-timeline-card">
            <h3 className="timeline-title">Status Timeline</h3>
            
            <div className="timeline-item">
              <div className="timeline-icon complete">
                <FaCheckCircle />
              </div>
              <div className="timeline-info">
                <p className="timeline-status">SUBMITTED</p>
                <p className="timeline-date">{formatDate(ticket.createdAt)}</p>
                <p className="timeline-description">Initial Student Request</p>
              </div>
            </div>
            
            <div className="timeline-item">
              <div className={`timeline-icon ${ticket.claimedBy ? 'complete' : 'incomplete'}`}>
                {ticket.claimedBy ? <FaCheckCircle /> : <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'white' }}></div>}
              </div>
              <div className="timeline-info">
                <p className="timeline-status">PROCESSING</p>
                {ticket.claimedAt && <p className="timeline-date">{formatDate(ticket.claimedAt)}</p>}
                {ticket.claimedBy && <p className="timeline-description">Accepted and processed by {ticket.claimedBy}</p>}
                {ticket.resolvedBy && (
                  <p className="timeline-description" style={{ marginTop: '4px' }}>Rerouted ticket accepted by {ticket.resolvedBy} - {ticket.office}</p>
                )}
              </div>
            </div>

            {scheduleAdjustments.map((adj) => (
              <div key={adj.id} className="timeline-item">
                <div className="timeline-icon complete">
                  <FaCheckCircle />
                </div>
                <div className="timeline-info">
                  <p className="timeline-status">DATE ADJUSTED</p>
                  <p className="timeline-date">{adj.adjustedAt}</p>
                  <p className="timeline-description">{adj.fromDate} <span className="timeline-change-arrow">&rarr;</span> {adj.toDate}</p>
                  <p className="timeline-description" style={{ marginTop: '4px' }}>Staff rationale: "{adj.reason}"</p>
                </div>
              </div>
            ))}

            {reassignments.map((re) => (
              <div key={re.id} className="timeline-item">
                <div className="timeline-icon complete">
                  <FaCheckCircle />
                </div>
                <div className="timeline-info">
                  <p className="timeline-status">REASSIGNED</p>
                  <p className="timeline-date">{re.reassignedAt}</p>
                  <p className="timeline-description">{re.previousOffice} <span className="timeline-change-arrow">&rarr;</span> {re.newOffice}</p>
                  {re.handledBy && <p className="timeline-description" style={{ marginTop: '4px' }}>Accepted by {re.handledBy}</p>}
                  <p className="timeline-description" style={{ marginTop: '4px' }}>"{re.reason}"</p>
                </div>
              </div>
            ))}

            {returnTransfers.map((rt) => (
              <div key={rt.id} className="timeline-item">
                <div className="timeline-icon complete">
                  <FaCheckCircle />
                </div>
                <div className="timeline-info">
                  <p className="timeline-status">REASSIGNED</p>
                  <p className="timeline-date">{rt.returnedAt}</p>
                  <p className="timeline-description">{rt.fromOffice} <span className="timeline-change-arrow">&rarr;</span> {rt.toOffice}</p>
                  <p className="timeline-description" style={{ marginTop: '4px' }}>Staff note: "{rt.note}"</p>
                </div>
              </div>
            ))}
            
            <div className="timeline-item">
              <div className={`timeline-icon ${ticket.status === 'Resolved' ? 'complete' : 'incomplete'}`}>
                {ticket.status === 'Resolved' ? <FaCheckCircle /> : <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'white' }}></div>}
              </div>
              <div className="timeline-info">
                <p className="timeline-status">RESOLVED</p>
                {ticket.resolvedAt && <p className="timeline-date">{formatDate(ticket.resolvedAt)}</p>}
                {ticket.status === 'Resolved' && (
                  <p className="timeline-description">
                    {ticket.resolvedBy ? `Resolved by ${ticket.resolvedBy}` : 'Request completed'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="management-card">
            <h3 className="management-title">Management Control</h3>
            
            <div className="management-field">
              <p className="field-label">URGENCY LEVEL</p>
              <select 
                className="field-select"
                value={urgencyLevel}
                onChange={(e) => handleUrgencyChange(e.target.value)}
              >
                <option value="Normal">Normal - Process within 2-3 days</option>
                <option value="Medium">Medium - Process within 1-2 days</option>
                <option value="High">High - Process within the day</option>
              </select>
            </div>
            
            <div className="management-field">
              <p className="field-label">REASSIGN TO</p>
              <select 
                className="field-select"
                value={reassignOffice}
                onChange={(e) => setReassignOffice(e.target.value)}
              >
                <option value="Finance">Finance Office</option>
                <option value="Registrar">Registrar's Office</option>
                <option value="Library">Library</option>
                <option value="Guidance">Guidance Office</option>
              </select>
              {reassignOffice !== ticket.office && (
                <button className="reassign-btn" onClick={handleReassign}>
                  Reassign Ticket
                </button>
              )}
            </div>
          </div>

          <div className="student-info-card">
            <div className="student-avatar">
              {ticket.studentProfilePicture ? (
                <img src={ticket.studentProfilePicture} alt="Student" className="student-avatar-img" />
              ) : (
                <FaUserCircle className="student-avatar-icon" />
              )}
            </div>
            <h4 className="student-name">{ticket.studentName}</h4>
            <p className="student-school">Junior High School</p>
            
            <div className="student-details">
              <div className="student-detail-row">{ticket.studentId || 'N/A'}</div>
              <div className="student-detail-row">{ticket.studentGradeLevel || 'Grade N/A'} - {ticket.studentSection || 'Section N/A'}</div>
              <div className="student-detail-row">{maskEmail(ticket.studentEmail)}</div>
            </div>
            
            <button className="contact-student-btn" onClick={() => window.location.href = `mailto:${ticket.studentEmail}`}>
              <FaEnvelope />
              CONTACT STUDENT
            </button>
          </div>
        </div>
      </div>

      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="reassign-modal-overlay">
          <div className="reassign-modal">
            <h3 className="reassign-modal-title">Reassign Ticket to {reassignOffice}</h3>
            <p className="reassign-modal-subtitle">Please provide a reason for reassigning this ticket</p>
            
            <textarea
              className="reassign-note-textarea"
              placeholder="Example: This request is related to tuition payment and should be handled by the Finance Office..."
              value={reassignNote}
              onChange={(e) => setReassignNote(e.target.value)}
              rows={5}
              maxLength={500}
            />
            
            <div className="reassign-note-counter">
              {reassignNote.length}/500 characters
              {reassignNote.length < 10 && reassignNote.length > 0 && (
                <span className="note-warning"> (minimum 10 characters)</span>
              )}
            </div>
            
            <div className="reassign-modal-actions">
              <button className="reassign-cancel-btn" onClick={cancelReassign}>
                Cancel
              </button>
              <button 
                className="reassign-confirm-btn" 
                onClick={confirmReassign}
                disabled={reassignNote.trim().length < 10}
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
      
      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </div>
  );
};

export default TicketDetails;
