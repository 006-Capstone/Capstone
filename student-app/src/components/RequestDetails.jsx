import React, { useState, useEffect, useRef } from 'react';
import { 
  MdDownload, 
  MdAttachFile, 
  MdCheckCircle, 
  MdClose, 
  MdBlock, 
  MdStar, 
  MdInsertDriveFile 
} from 'react-icons/md';
import { FaUserCircle } from 'react-icons/fa';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { notifyStaffFollowUp } from '../utils/notificationHelper';
import LoadingSpinner from './LoadingSpinner';
import Breadcrumb from './Breadcrumb';
import StatusBadge from './StatusBadge';
import '../styles/RequestDetails.css';

function RequestDetails({ requestData, onNavigate }) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [followUpFiles, setFollowUpFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (requestData) {
      loadRequestDetails();
    } else {
      console.warn('No request data provided to RequestDetails');
      setLoading(false);
      onNavigate('request');
    }
  }, [requestData]);

  const loadRequestDetails = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'requests', requestData.firestoreId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRequest({
          ...data,
          firestoreId: docSnap.id,
          date: data.createdAt?.toDate().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          }) || 'N/A',
          createdAtTimestamp: data.createdAt?.toDate().getTime() || 0
        });
      } else {
        alert('Request not found');
      }
    } catch (error) {
      console.error('[Error] Error loading request:', error);
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
    
    setFollowUpFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index) => {
    setFollowUpFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendFollowUp = async () => {
    if (!comment.trim()) {
      alert('Please add a comment');
      return;
    }

    const followUps = request.followUps || [];
    const studentFollowUps = followUps.filter(f => f.sentBy === 'student');
    if (studentFollowUps.length >= 3) {
      alert('Maximum 3 follow-up comments allowed');
      return;
    }

    try {
      setSending(true);
      const attachments = [];
      for (let file of followUpFiles) {
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

      const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
      
      const docRef = doc(db, 'requests', request.firestoreId);
      await updateDoc(docRef, {
        followUps: arrayUnion({
          message: comment.trim(),
          attachments: attachments,
          sentBy: 'student',
          sentByName: studentData.name || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student',
          sentAt: new Date().toISOString(),
          timestamp: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      if (request.assignedTo || request.claimedBy) {
        await notifyStaffFollowUp(
          request.assignedTo || request.claimedBy,
          request.requestId,
          request.subject,
          studentData.name || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim() || 'Student',
          request.office
        );
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      alert('Follow-up sent successfully!');
      setComment('');
      setFollowUpFiles([]);
      loadRequestDetails();
    } catch (error) {
      console.error('[Error] Error sending follow-up:', error);
      alert('Failed to send follow-up: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!window.confirm('Are you sure you want to cancel this request?')) {
      return;
    }

    try {
      const docRef = doc(db, 'requests', request.firestoreId);
      await updateDoc(docRef, {
        status: 'Cancelled',
        updatedAt: serverTimestamp()
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      alert('Request cancelled successfully');
      onNavigate('request');
    } catch (error) {
      console.error('[Error] Error cancelling request:', error);
      alert('Failed to cancel request');
    }
  };

  const canCancelRequest = () => {
    if (!request || !request.createdAt) return false;
    const createdDate = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
    const now = new Date();
    const daysSinceCreation = (now - createdDate) / (1000 * 60 * 60 * 24);
    return daysSinceCreation >= 3;
  };

  const getDaysUntilCancellable = () => {
    if (!request || !request.createdAt) return 0;
    const createdDate = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
    const now = new Date();
    const daysSinceCreation = (now - createdDate) / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.ceil(3 - daysSinceCreation);
    return daysRemaining > 0 ? daysRemaining : 0;
  };

  const downloadAttachment = (attachment) => {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    link.click();
  };

  const handleProvideFeedback = () => {
    onNavigate('feedback-for-request', request);
  };

  const getOfficeCode = (office) => {
    const codes = {
      'Finance': 'FIN-001',
      'Library': 'LIB-001',
      'Registrar': 'REG-001',
      'Guidance': 'GUI-001'
    };
    return codes[office] || 'N/A';
  };

  const getEstimatedCompletion = (createdDate, etc) => {
    if (etc) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(etc)) {
        const [y, m, d] = etc.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return etc;
    }
    if (!createdDate) return 'N/A';
    const date = new Date(createdDate);
    date.setDate(date.getDate() + 2);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderTimeline = () => {
    if (!request) return null;

    const status = request.status?.toLowerCase();
    
    let processingDate = 'Pending';
    let processingDescription = 'Waiting for staff to process';
    
    if (request.claimedAt && request.claimedBy) {
      if (request.claimedAt?.toDate) {
        processingDate = request.claimedAt.toDate().toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
      } else if (typeof request.claimedAt === 'string') {
        processingDate = request.claimedAt;
      }
      processingDescription = `Being Processed by ${request.claimedBy}`;
    } else if (status === 'in process' || status === 'resolved') {
      processingDate = 'In Progress';
      processingDescription = 'Being processed by staff';
    }
    
    const timelineItems = [
      {
        status: 'SUBMITTED',
        completed: true,
        date: request.date,
        description: 'Initial Student Request'
      },
      {
        status: 'PROCESSING',
        completed: status === 'in process' || status === 'resolved' || status === 'returned' || status === 'for follow up',
        active: status === 'in process',
        date: processingDate,
        description: processingDescription
      }
    ];

    if (request.estimatedCompletionSetAt) {
      const setDate = request.estimatedCompletionSetAt?.toDate
        ? request.estimatedCompletionSetAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : (typeof request.estimatedCompletionSetAt === 'string' ? request.estimatedCompletionSetAt : '');
      const completion = request.estimatedCompletion?.toDate
        ? request.estimatedCompletion.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : (request.estimatedCompletion || '');
      timelineItems.push({
        kind: 'sub',
        subType: 'date-adjusted',
        status: 'DATE ADJUSTED',
        completed: true,
        active: false,
        date: setDate,
        details: [
          completion ? `Estimated completion updated to ${completion}` : 'Estimated completion updated',
          request.estimatedCompletionSetBy ? `Updated by ${request.estimatedCompletionSetBy}` : ''
        ]
      });
    }

    const events = [];
    
    if (request.followUps && Array.isArray(request.followUps)) {
      request.followUps.forEach((f) => {
        if (f && f.message && typeof f.message === 'string' && f.message.toLowerCase().includes('reassigned from')) {
          const match = f.message.match(/reassigned from\s+(.+?)\s+to\s+(.+?)\s+by\s+([^\r\n]+)/i);
          if (match) {
            let reason = '';
            const reasonMatch = f.message.match(/Reason:\s*([\s\S]*)$/i);
            if (reasonMatch) reason = reasonMatch[1].trim();

            const fromOffice = match[1].trim();
            const toOffice = match[2].trim();
            const byStaff = match[3].trim();

            if (fromOffice && toOffice && fromOffice.toLowerCase() !== toOffice.toLowerCase()) {
              events.push({
                from: fromOffice,
                to: toOffice,
                by: byStaff,
                reason: reason,
                date: f.sentAt ? (f.sentAt.toDate ? f.sentAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : (typeof f.sentAt === 'string' ? new Date(f.sentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '')) : ''
              });
            }
          }
        }
      });
    }

    if (events.length === 0 && request.reassignedFrom) {
      const currentOffice = request.office || 'Office';
      const fromOffice = request.reassignedFrom;
      const history = request.officeHistory || {};

      const originOffice = (request.previousOffice && request.previousOffice !== fromOffice && request.previousOffice !== currentOffice)
        ? request.previousOffice
        : null;

      if (originOffice) {
        events.push({
          from: originOffice,
          to: fromOffice,
          by: (history[originOffice] && history[originOffice].handledBy) || '',
          date: history[originOffice]?.handledAt
            ? new Date(history[originOffice].handledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : (request.date || '')
        });
      }

      if (fromOffice.toLowerCase() !== currentOffice.toLowerCase()) {
        events.push({
          from: fromOffice,
          to: currentOffice,
          by: request.reassignedBy || (history[fromOffice] && history[fromOffice].handledBy) || '',
          date: request.reassignedAt?.toDate
            ? request.reassignedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : (history[fromOffice]?.handledAt ? new Date(history[fromOffice].handledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '')
        });
      } else {
        const otherOffice = Object.keys(history).find(k => k.toLowerCase() !== currentOffice.toLowerCase()) || 'Other Office';
        events.push({
          from: otherOffice,
          to: currentOffice,
          by: request.reassignedBy || (history[otherOffice] && history[otherOffice].handledBy) || '',
          date: request.reassignedAt?.toDate
            ? request.reassignedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : (history[otherOffice]?.handledAt ? new Date(history[otherOffice].handledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '')
        });
      }
    }

    const filteredEvents = events.filter(e => e.from && e.to && e.from.trim().toLowerCase() !== e.to.trim().toLowerCase());

    filteredEvents.forEach((event, idx) => {
      const isReturn = idx > 0 && event.to === filteredEvents[0].from;
      timelineItems.push({
        kind: 'sub',
        subType: isReturn ? 'returned-to-origin' : 'reassigned',
        status: isReturn ? 'RETURNED' : 'REASSIGNED',
        completed: true,
        active: false,
        date: event.date,
        details: [
          `${event.from} → ${event.to}`,
          event.by ? `Processed by ${event.by}` : ''
        ].filter(Boolean)
      });
    });

    if (status === 'returned' || status === 'for follow up') {
      timelineItems.push({
        status: 'RETURNED/FOR FOLLOW UP',
        completed: true,
        active: true,
        date: request.returnedAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        description: request.returnedReason || 'Additional documents required'
      });
    }

    timelineItems.push({
      status: 'RESOLVED',
      completed: status === 'resolved',
      active: status === 'resolved',
      date: status === 'resolved' ? (request.resolvedAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '') : '',
      description: status === 'resolved' ? 'Request completed' : ''
    });

    return timelineItems.map((item, index) => (
      <div key={index} className={`timeline-item ${item.kind === 'sub' ? `timeline-sub timeline-sub--${item.subType}` : ''} ${item.completed ? 'completed' : ''} ${item.active ? 'active' : ''}`}>
        <div className="timeline-icon">
          <MdCheckCircle />
        </div>
        <div className="timeline-content">
          <h4>{item.status}</h4>
          {item.date && <p className="timeline-date">{item.date}</p>}
          {item.details && item.details.length > 0 && (
            <div className="timeline-sub-details">
              {item.details[0] && <p className="timeline-change">{item.details[0]}</p>}
              {item.details[1] && <p className="timeline-handler">{item.details[1]}</p>}
            </div>
          )}
          {item.description && <p className="timeline-desc">{item.description}</p>}
        </div>
      </div>
    ));
  };

  if (loading || !request) {
    return <LoadingSpinner message="Loading request details..." fullScreen={true} />;
  }

  const studentFollowUpsCount = (request.followUps || []).filter(f => f.sentBy === 'student').length;

  return (
    <div className="request-details-page">
      <Breadcrumb
        items={[
          { label: 'Request History', onClick: () => onNavigate('request') },
          { label: 'Request Details', current: true },
          { label: 'New Request', onClick: () => onNavigate('new-request') }
        ]}
      />

      <div className="page-header">
        <h1>Request Details</h1>
      </div>

      <div className="details-container">
        <div className="main-content-area">
          <div className="request-card">
            <div className="request-header">
              <div className="request-title">
                <h2>{request.subject?.toUpperCase()}</h2>
                <p className="request-id">#{request.requestId}</p>
              </div>
              <div className="request-actions">
                {(request.claimedBy || request.assignedTo) && (
                  <div className="request-assigned">
                    <span className="assigned-office">{request.office || 'Office'} Department</span>
                    <span className="assigned-staff">
                      <FaUserCircle /> {request.claimedBy || request.assignedTo}
                    </span>
                  </div>
                )}
                <StatusBadge status={request.status} />
                {request.status?.toLowerCase() === 'pending' && (
                  <button 
                    type="button"
                    className="cancel-btn" 
                    onClick={handleCancelRequest}
                    disabled={!canCancelRequest()}
                    title={
                      canCancelRequest() 
                        ? 'Cancel this request' 
                        : `You can cancel this request in ${getDaysUntilCancellable()} day${getDaysUntilCancellable() === 1 ? '' : 's'}`
                    }
                  >
                    <MdBlock /> Cancel Request
                  </button>
                )}
              </div>
            </div>

            {/* Rerouted info if request was reassigned */}
            {request.reassignedFrom && (
              <div className="reroute-banner">
                <div className="reroute-banner-header">
                  <span className="reroute-title">Rerouted from {request.reassignedFrom}</span>
                  {request.reassignedAt && (
                    <span className="reroute-date">
                      {request.reassignedAt?.toDate ? request.reassignedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  )}
                </div>
                {request.previousRequestId && (
                  <p className="reroute-prev-id">Previous ID: #{request.previousRequestId}</p>
                )}
                {request.reassignmentNote && (
                  <div className="reroute-note">
                    <span className="reroute-note-label">Message from {request.reassignedFrom}:</span>
                    <p className="reroute-note-body">{request.reassignmentNote}</p>
                  </div>
                )}
              </div>
            )}

            <div className="original-submission">
              <div className="section-header">
                <h3>Original Submission</h3>
                <span className="created-date">Created on {request.date}</span>
              </div>
              <p className="submission-text">"{request.description}"</p>
              
              {request.attachments && request.attachments.length > 0 && (
                <div className="attachments">
                  {request.attachments.map((file, index) => (
                    <div key={index} className="attachment-card">
                      <MdInsertDriveFile className="attachment-file-icon" />
                      <span className="attachment-name" title={file.name}>{file.name}</span>
                      <button
                        type="button"
                        className="attachment-download-btn"
                        onClick={() => downloadAttachment(file)}
                        aria-label={`Download ${file.name}`}
                      >
                        <MdDownload /> Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Display staff responses */}
            {request.followUps && request.followUps.filter(f => f.sentBy === 'staff' && !f.message?.includes('automatically assigned to') && !f.message?.includes('Request marked as Resolved')).map((followUp, index) => (
              <div key={`staff-${index}`} className="staff-response">
                <div className="response-header">
                  <FaUserCircle className="staff-icon" />
                  <div>
                    <h4>{request.office} Department</h4>
                    <span className="staff-name">{followUp.sentByName}</span>
                  </div>
                  <span className="response-date">
                    {followUp.sentAt ? (
                      `${new Date(followUp.sentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | ${new Date(followUp.sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    ) : ''}
                  </span>
                </div>
                <p className="response-text">{followUp.message}</p>
                {followUp.attachments && followUp.attachments.length > 0 && (
                  <div className="attachments">
                    {followUp.attachments.map((file, idx) => (
                      <div key={idx} className="attachment-card">
                        <MdInsertDriveFile className="attachment-file-icon" />
                        <span className="attachment-name" title={file.name}>{file.name}</span>
                        <button
                          type="button"
                          className="attachment-download-btn"
                          onClick={() => downloadAttachment(file)}
                          aria-label={`Download ${file.name}`}
                        >
                          <MdDownload /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Display student follow-ups */}
            {request.followUps && request.followUps.filter(f => f.sentBy === 'student').map((followUp, index) => (
              <div key={`student-${index}`} className="student-followup">
                <div className="followup-header">
                  <FaUserCircle className="user-icon" />
                  <div>
                    <h4>Your Follow-up</h4>
                    <span className="followup-date">
                      {followUp.sentAt ? new Date(followUp.sentAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  </div>
                </div>
                <p className="followup-text">{followUp.message}</p>
                {followUp.attachments && followUp.attachments.length > 0 && (
                  <div className="attachments">
                    {followUp.attachments.map((file, idx) => (
                      <div key={idx} className="attachment-card">
                        <MdInsertDriveFile className="attachment-file-icon" />
                        <span className="attachment-name" title={file.name}>{file.name}</span>
                        <button
                          type="button"
                          className="attachment-download-btn"
                          onClick={() => downloadAttachment(file)}
                          aria-label={`Download ${file.name}`}
                        >
                          <MdDownload /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Green feedback banner — only shown for resolved requests (Figma) */}
          {request.status?.toLowerCase() === 'resolved' && !request.feedbackProvided && (
            <div className="feedback-banner">
              <div className="feedback-banner-icon" aria-hidden="true">
                <MdStar />
              </div>
              <div className="feedback-banner-copy">
                <h3>Tell Us How We Did!</h3>
                <p>
                  We'd love to hear about your experience
                  {request.office ? ` with the ${request.office} Department.` : ' with our team.'}
                </p>
              </div>
              <button type="button" className="feedback-banner-btn" onClick={handleProvideFeedback}>
                Provide Feedback
              </button>
            </div>
          )}

          {/* Thank you message when feedback already provided */}
          {request.status?.toLowerCase() === 'resolved' && request.feedbackProvided && (
            <div className="feedback-banner feedback-provided">
              <div className="feedback-banner-icon" aria-hidden="true">
                <MdCheckCircle />
              </div>
              <div className="feedback-banner-copy">
                <h3>Thank You for Your Feedback!</h3>
                <p>
                  We appreciate you taking the time to share your experience with us.
                </p>
              </div>
            </div>
          )}

          {/* Follow-up comment section */}
          {request.status?.toLowerCase() !== 'resolved' && request.status?.toLowerCase() !== 'cancelled' && (
            <div className="comment-section">
              <div className="comment-header">
                <FaUserCircle className="user-icon" />
                <div>
                  <h4>Add follow-up comment</h4>
                  <span className="comment-limit">
                    (Only up to 3 follow-up comments - {studentFollowUpsCount}/3 used)
                  </span>
                </div>
              </div>
              <textarea 
                placeholder="Type your message here..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={sending || studentFollowUpsCount >= 3}
              />
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              
              {followUpFiles.length > 0 && (
                <div className="uploaded-files-list">
                  {followUpFiles.map((file, index) => (
                    <div key={index} className="uploaded-file-item">
                      <span className="file-name">{file.name}</span>
                      <button
                        type="button"
                        className="remove-file-btn"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <MdClose />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="comment-footer">
                <button 
                  type="button"
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || studentFollowUpsCount >= 3}
                >
                  <MdAttachFile /> Attach documents (Max 5MB)
                </button>
                <button 
                  type="button"
                  className="send-btn"
                  onClick={handleSendFollowUp}
                  disabled={sending || !comment.trim() || studentFollowUpsCount >= 3}
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="sidebar-details">
          <div className="details-card">
            <h3>Request Details</h3>
            <div className="detail-row">
              <span className="label">REQUEST ID</span>
              <span className="value">#{request.requestId}</span>
            </div>
            <div className="detail-row">
              <span className="label">OFFICE CODE</span>
              <span className="value">{getOfficeCode(request.office)}</span>
            </div>
            <div className="detail-row">
              <span className="label">DATE OF CREATION</span>
              <span className="value">{request.date?.toUpperCase() || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">ESTIMATED COMPLETION</span>
              <span className="value">{getEstimatedCompletion(request.createdAt?.toDate ? request.createdAt.toDate() : request.createdAt, request.etc).toUpperCase()}</span>
            </div>
          </div>

          <div className="timeline-card">
            <h3>Status Timeline</h3>
            <div className="timeline">
              {renderTimeline()}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default RequestDetails;
