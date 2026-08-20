import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaUndo, FaCheck, FaFileAlt, FaDownload, FaUserCircle, FaEnvelope, FaCheckCircle, FaTimes } from 'react-icons/fa';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyStudentStatusChange, notifyStudentComment, notifyStaffReassignment } from '../utils/notificationHelper';
import Notifications from './Notifications';
import LoadingSpinner from './LoadingSpinner';
import '../styles/TicketDetails.css';

const TicketDetails = ({ ticketData, department, onNavigate, onViewRequest }) => {
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
  
  // Estimated Completion Date editing state
  const [showEstimatedCompletionModal, setShowEstimatedCompletionModal] = useState(false);
  const [completionOption, setCompletionOption] = useState('1-3');
  const [customCompletionDate, setCustomCompletionDate] = useState('');

  useEffect(() => {
    if (ticketData) {
      loadTicketDetails();
    } else {
      // If no ticketData provided, navigate back to dashboard
      console.warn('No ticket data provided to TicketDetails');
      setLoading(false);
      onNavigate('dashboard');
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
        console.log('[Success] Loaded ticket details:', {
          requestId: data.requestId,
          office: data.office,
          assignedTo: data.assignedTo,
          claimedBy: data.claimedBy,
          status: data.status,
          officeHistory: data.officeHistory
        });
      } else {
        console.error('[Error] Ticket not found');
        alert('Request not found');
      }
    } catch (error) {
      console.error('[Error] Error loading ticket:', error);
      alert('Failed to load request details');
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
      console.error('[Error] Error sending reply:', error);
      alert('Failed to send reply: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateEstimatedCompletion = async () => {
    if (!ticket) return;

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
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      const docRef = doc(db, 'requests', ticket.firestoreId);
      
      await updateDoc(docRef, {
        estimatedCompletion: completionDate,
        estimatedCompletionSetAt: new Date(),
        estimatedCompletionSetBy: staffData.name,
        updatedAt: serverTimestamp()
      });

      console.log('[Success] Estimated Completion Date updated by', staffData.name, 'to:', completionDate);
      alert('Estimated Completion Date updated successfully!');
      
      // Close modal and reload ticket details
      setShowEstimatedCompletionModal(false);
      setCompletionOption('1-3');
      setCustomCompletionDate('');
      loadTicketDetails();
      
    } catch (error) {
      console.error('[Error] Error updating Estimated Completion Date:', error);
      alert('Failed to update Estimated Completion Date: ' + error.message);
    }
  };

  const handleReturnTicket = async () => {
    const reason = prompt('Please provide a reason for returning this request:');
    if (!reason) return;

    try {
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, {
        status: 'Returned',
        returnedAt: serverTimestamp(),
        returnedReason: reason,
        updatedAt: serverTimestamp()
      });
      
      alert('Request returned successfully');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('[Error] Error returning ticket:', error);
      alert('Failed to return request');
    }
  };

  const handleResolveTicket = async () => {
    if (!window.confirm('Are you sure you want to resolve this request?')) {
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
      
      alert('Request resolved successfully');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('[Error] Error resolving ticket:', error);
      alert('Failed to resolve request');
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
      alert('Request is already assigned to this office');
      return;
    }

    // Show modal to get reassignment note
    setShowReassignModal(true);
  };

  const confirmReassign = async () => {
    if (!reassignNote.trim()) {
      alert('Please provide a reason for reassigning this request');
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
      
      console.log('[Data] Office History:', currentOfficeHistory);
      console.log('[Search] Checking for previous handler in', reassignOffice);
      
      // Check if the ticket was previously in the target office
      const previousHandler = currentOfficeHistory[reassignOffice];
      console.log('[User] Previous Handler:', previousHandler);
      
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
        console.log('[Success] Auto-assigning to previous handler:', previousHandler.handledBy);
        updateData.assignedTo = previousHandler.handledBy;
        updateData.claimedBy = previousHandler.handledBy;
        updateData.claimedAt = new Date().toISOString();
        updateData.status = 'In Process'; // Auto-set to In Process since it's claimed
        updateData.assignedToStaff = previousHandler.handledBy; // Add this field too
        
        // Add follow-ups for reassignment and auto-assignment
        updateData.followUps = arrayUnion(
          {
            message: `Request reassigned from ${ticket.office} to ${reassignOffice} by ${staffData.name}\n\nReason: ${reassignNote.trim()}`,
            sentBy: 'system',
            sentByName: 'System',
            sentAt: new Date().toISOString()
          },
          {
            message: `Request automatically assigned to ${previousHandler.handledBy} (previously handled this request in ${reassignOffice})`,
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
          message: `Request reassigned from ${ticket.office} to ${reassignOffice} by ${staffData.name}\n\nReason: ${reassignNote.trim()}`,
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
        alert(`Request reassigned successfully!\nNew Request ID: ${newRequestId}\nAuto-assigned to ${previousHandler.handledBy} in ${reassignOffice}.`);
      } else {
        alert(`Request reassigned successfully!\nNew Request ID: ${newRequestId}\nThe request will appear in ${reassignOffice}'s dashboard for claiming.`);
      }
      
      onNavigate('my-tickets');
    } catch (error) {
      console.error('[Error] Error reassigning ticket:', error);
      alert('Failed to reassign request: ' + error.message);
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

  // Once a ticket is resolved or cancelled, management actions no longer apply —
  // lock the Management Control card so nothing there can be changed.
  const isTicketClosed = ticket?.status === 'Resolved' || ticket?.status === 'Cancelled';

  // Without a selected ticket there is nothing to load — show a navigable
  // fallback instead of blocking the whole app behind the full-screen spinner.
  if (!ticketData) {
    return (
      <div className="ticket-details-container">
        <div className="ticket-details-empty">
          <p className="ticket-details-empty-title">No request selected</p>
          <p className="ticket-details-empty-text">Go back to your request list to open a request.</p>
          <button className="ticket-details-back-btn" onClick={() => onNavigate('my-tickets')}>
            Back to My Requests
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Loading request details..." fullScreen={true} />;
  }

  // Ticket data was requested but the document doesn't exist (or couldn't load)
  if (!ticket) {
    return (
      <div className="ticket-details-container">
        <div className="ticket-details-empty">
          <p className="ticket-details-empty-title">Request not found</p>
          <p className="ticket-details-empty-text">This request may have been removed, or you no longer have access to it.</p>
          <button className="ticket-details-back-btn" onClick={() => onNavigate('my-tickets')}>
            Back to My Requests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-details-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Request Details</h1>
          <p className="page-subtitle">Review the student's request, timeline, and reply to keep it moving</p>
        </div>
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
                    Return Request
                  </button>
                  <button className="resolve-btn" onClick={handleResolveTicket}>
                    <FaCheck />
                    Resolve Request
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
                    followUp.message.includes('reassigned from') ||
                    followUp.message.includes('automatically assigned to')
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
                <div className="reply-header">
                  <FaUserCircle className="reply-avatar" />
                  <span className="reply-label">Reply to student</span>
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
                    disabled={sending || (!replyMessage.trim() && replyFiles.length === 0)}
                    title={!replyMessage.trim() && replyFiles.length === 0 ? 'Type a message or attach a file to enable sending' : undefined}
                  >
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
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
              </div>
            </div>
            
            <div className="timeline-item">
              <div className={`timeline-icon ${ticket.status === 'Resolved' ? 'complete' : 'incomplete'}`}>
                {ticket.status === 'Resolved' ? <FaCheckCircle /> : <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'white' }}></div>}
              </div>
              <div className="timeline-info">
                <p className="timeline-status">RESOLVED/REJECTED</p>
                {ticket.resolvedAt && <p className="timeline-date">{formatDate(ticket.resolvedAt)}</p>}
              </div>
            </div>
          </div>

          <div className={`management-card ${isTicketClosed ? 'management-card--locked' : ''}`}>
            <h3 className="management-title">Management Control</h3>
            {isTicketClosed && (
              <p className="management-lock-note">
                This request is {ticket.status === 'Resolved' ? 'resolved' : 'cancelled'} — management actions are locked.
              </p>
            )}
            
            <div className="management-field">
              <p className="field-label">URGENCY LEVEL</p>
              <select 
                className="field-select"
                value={urgencyLevel}
                onChange={(e) => handleUrgencyChange(e.target.value)}
                disabled={isTicketClosed}
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
                disabled={isTicketClosed}
              >
                <option value="Finance">Finance Office</option>
                <option value="Registrar">Registrar's Office</option>
                <option value="Library">Library</option>
                <option value="Guidance">Guidance Office</option>
              </select>
              {!isTicketClosed && reassignOffice !== ticket.office && (
                <button className="reassign-btn" onClick={handleReassign}>
                  Reassign Request
                </button>
              )}
            </div>

            {/* Estimated Completion Date */}
            {ticket.status === 'In Process' && (
              <div className="management-field">
                <p className="field-label">ESTIMATED COMPLETION DATE</p>
                <div className="estimated-completion-display">
                  {ticket.estimatedCompletion ? (
                    <>
                      <p className="field-value completion-date">
                        {formatDate(ticket.estimatedCompletion)}
                      </p>
                      {ticket.estimatedCompletionSetBy && (
                        <p className="completion-metadata">
                          Set by {ticket.estimatedCompletionSetBy} on {formatDate(ticket.estimatedCompletionSetAt)}
                        </p>
                      )}
                      {!isTicketClosed && (
                        <button className="edit-completion-btn" onClick={() => setShowEstimatedCompletionModal(true)}>
                          Edit Completion Date
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="field-value completion-not-set">Not set</p>
                      {!isTicketClosed && (
                        <button className="edit-completion-btn" onClick={() => setShowEstimatedCompletionModal(true)}>
                          Set Completion Date
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
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
            
            <button className="contact-student-btn">
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
            <h3 className="reassign-modal-title">Reassign Request to {reassignOffice}</h3>
            <p className="reassign-modal-subtitle">Please provide a reason for reassigning this request</p>
            
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

      {/* Estimated Completion Date Edit Modal */}
      {showEstimatedCompletionModal && (
        <div className="reassign-modal-overlay" onClick={() => setShowEstimatedCompletionModal(false)}>
          <div className="reassign-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="reassign-modal-title">Edit Estimated Completion Date</h3>
            <p className="reassign-modal-subtitle">
              Update the expected completion date for request #{ticket.requestId}
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
            
            <div className="reassign-modal-actions">
              <button className="reassign-cancel-btn" onClick={() => setShowEstimatedCompletionModal(false)}>
                Cancel
              </button>
              <button 
                className="reassign-confirm-btn" 
                onClick={handleUpdateEstimatedCompletion}
              >
                Update Completion Date
              </button>
            </div>
          </div>
        </div>
      )}
      
      <Notifications isOpen={showNotifications} onClose={() => setShowNotifications(false)} onViewRequest={onViewRequest} />
    </div>
  );
};

export default TicketDetails;
