import React, { useState, useEffect } from 'react';
import {
  FaTimes,
  FaUser,
  FaEnvelope,
  FaIdCard,
  FaGraduationCap,
  FaBuilding,
  FaCalendarAlt,
  FaCheckCircle,
  FaCopy,
  FaCheck,
  FaPaperclip,
  FaInfoCircle
} from 'react-icons/fa';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from './LoadingSpinner';
import '../styles/RequestDetailsModal.css';

const RequestDetailsModal = ({
  isOpen,
  onClose,
  notification = null,
  requestId = null,
  request = null,
  onNavigate = null
}) => {
  const [requestData, setRequestData] = useState(request || null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Load request data when modal opens
  useEffect(() => {
    if (!isOpen) {
      setRequestData(null);
      setStatusMessage(null);
      return;
    }

    if (request) {
      setRequestData(request);
      return;
    }

    const targetReqId = requestId || notification?.metadata?.requestId;
    const targetDocId = notification?.metadata?.documentId || notification?.documentId;

    if (!targetReqId && !targetDocId) {
      // Fallback: use notification metadata directly
      if (notification?.metadata) {
        setRequestData({
          requestId: notification.metadata.requestId || 'REQ-GUEST',
          name: notification.metadata.studentName || notification.title,
          studentName: notification.metadata.studentName,
          email: notification.metadata.studentEmail,
          studentEmail: notification.metadata.studentEmail,
          studentId: notification.metadata.studentId,
          grade: notification.metadata.grade,
          section: notification.metadata.section,
          office: notification.metadata.office || 'Superadmin',
          subject: notification.metadata.subject || notification.title,
          description: notification.message || 'No description provided.',
          status: 'Pending',
          createdAt: notification.createdAt,
          isFromNotification: true
        });
      }
      return;
    }

    const fetchRequest = async () => {
      setLoading(true);
      try {
        let foundDoc = null;

        // Try 1: By document ID if available
        if (targetDocId) {
          const docSnap = await getDoc(doc(db, 'requests', targetDocId));
          if (docSnap.exists()) {
            foundDoc = { id: docSnap.id, ...docSnap.data() };
          }
        }

        // Try 2: By requestId field (e.g. 'REQ-2026-XXXX')
        if (!foundDoc && targetReqId) {
          const q = query(collection(db, 'requests'), where('requestId', '==', targetReqId));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const first = querySnap.docs[0];
            foundDoc = { id: first.id, ...first.data() };
          }
        }

        // Try 3: Direct document lookup with targetReqId
        if (!foundDoc && targetReqId) {
          const docSnap = await getDoc(doc(db, 'requests', targetReqId));
          if (docSnap.exists()) {
            foundDoc = { id: docSnap.id, ...docSnap.data() };
          }
        }

        if (foundDoc) {
          setRequestData(foundDoc);
        } else if (notification?.metadata) {
          // Construct fallback data from notification metadata
          setRequestData({
            requestId: targetReqId || 'REQ-REF',
            name: notification.metadata.studentName,
            studentName: notification.metadata.studentName,
            email: notification.metadata.studentEmail,
            studentEmail: notification.metadata.studentEmail,
            studentId: notification.metadata.studentId,
            grade: notification.metadata.grade,
            section: notification.metadata.section,
            office: notification.metadata.office || 'Superadmin',
            subject: notification.metadata.subject || notification.title,
            description: notification.message,
            status: 'Pending',
            createdAt: notification.createdAt,
            isFallback: true
          });
        }
      } catch (err) {
        console.error('[RequestDetailsModal] Error fetching request:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [isOpen, request, requestId, notification]);

  if (!isOpen) return null;

  // Copy email to clipboard helper
  const handleCopyEmail = (email) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  // Navigate to User Management
  const handleGoToUserManagement = () => {
    if (onNavigate) {
      onNavigate('user-management');
    } else {
      window.dispatchEvent(new CustomEvent('superadmin:navigate', { detail: 'user-management' }));
    }
    onClose();
  };

  // Single action to resolve Account / Login Assistance requests
  const handleMarkAsResolved = async () => {
    try {
      setUpdatingStatus(true);
      const targetDocId = requestData?.id || notification?.metadata?.documentId;

      if (targetDocId) {
        await updateDoc(doc(db, 'requests', targetDocId), {
          status: 'Resolved',
          resolvedAt: serverTimestamp(),
          resolvedBy: 'Super Admin',
          updatedAt: serverTimestamp()
        });
      } else if (requestData?.requestId) {
        const q = query(collection(db, 'requests'), where('requestId', '==', requestData.requestId));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          await updateDoc(querySnap.docs[0].ref, {
            status: 'Resolved',
            resolvedAt: serverTimestamp(),
            resolvedBy: 'Super Admin',
            updatedAt: serverTimestamp()
          });
        }
      }

      if (notification?.id) {
        try {
          await updateDoc(doc(db, 'notifications', notification.id), {
            isRead: true,
            readAt: serverTimestamp()
          });
        } catch (e) {
          // non-critical
        }
      }

      setRequestData(prev => ({ ...prev, status: 'Resolved' }));
      setStatusMessage('Request status updated to Resolved.');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('[RequestDetailsModal] Error resolving request:', err);
      setStatusMessage('Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Format date helper
  const formatDate = (date) => {
    if (!date) return 'Recently';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(dateObj.getTime())) return 'Recently';
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentStatus = (requestData?.status || 'Pending').toLowerCase().replace(/[\s_]+/g, '-');
  const isPending = (requestData?.status || 'Pending').toLowerCase() === 'pending';
  const isResolved = (requestData?.status || '').toLowerCase() === 'resolved';
  const requesterName = requestData?.studentName || requestData?.name || 'Student / Guest Requester';
  const requesterEmail = requestData?.studentEmail || requestData?.email;
  const isLoginAssistance = 
    requestData?.category?.toLowerCase().includes('login') ||
    requestData?.category?.toLowerCase().includes('admissions') ||
    requestData?.subject?.toLowerCase().includes('login') ||
    requestData?.subject?.toLowerCase().includes('account') ||
    requestData?.subject?.toLowerCase().includes('admissions') ||
    notification?.title?.toLowerCase().includes('login') ||
    notification?.title?.toLowerCase().includes('account') ||
    notification?.title?.toLowerCase().includes('admissions') ||
    Boolean(requestData?.isNewStudentInquiry);

  return (
    <div className="req-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="req-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="req-modal-header">
          <div className="req-modal-title-group">
            <span className="req-modal-badge-id">
              {requestData?.requestId || 'REQUEST DETAILS'}
            </span>
            <span className={`req-modal-status-badge status-${currentStatus}`}>
              <span className="status-dot" />
              {requestData?.status || 'Pending'}
            </span>
            {requestData?.isGuest && (
              <span className="req-modal-guest-pill">Guest Inquiry</span>
            )}
          </div>
          <button
            type="button"
            className="req-modal-close-btn"
            onClick={onClose}
            aria-label="Close request details modal"
          >
            <FaTimes />
          </button>
        </div>

        {/* Modal Body */}
        <div className="req-modal-body">
          {loading ? (
            <div className="req-modal-loading">
              <LoadingSpinner message="Fetching request details..." fullScreen={false} />
            </div>
          ) : (
            <>
              {/* Contextual Notice Banner for Login/Account Inquiries */}
              {isLoginAssistance && (
                <div className="req-modal-notice-banner">
                  <div className="notice-banner-icon">
                    <FaInfoCircle />
                  </div>
                  <div className="notice-banner-text">
                    <strong>Account & Login Assistance Request</strong>
                    <p>
                      Submitted by a student who is unable to access their account. You can verify their credentials in User Management and resolve the request.
                    </p>
                  </div>
                  <div className="notice-banner-actions">
                    {isPending && (
                      <button
                        type="button"
                        className="btn-resolve-assistance"
                        onClick={handleMarkAsResolved}
                        disabled={updatingStatus}
                        title="Mark this assistance request as resolved"
                      >
                        <FaCheckCircle className="btn-mini-icon" />
                        <span>{updatingStatus ? 'Resolving...' : 'Mark as Resolved'}</span>
                      </button>
                    )}
                    {isResolved && (
                      <span className="assistance-resolved-chip">
                        <FaCheckCircle className="btn-mini-icon" /> Resolved
                      </span>
                    )}
                  </div>
                </div>
              )}

              {statusMessage && (
                <div className="req-modal-alert-success">
                  <FaCheckCircle />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Requester Profile Information */}
              <div className="req-modal-section">
                <h4 className="req-modal-section-title">
                  <FaUser className="section-title-icon" />
                  <span>Requester Information</span>
                </h4>
                <div className="req-requester-card">
                  <div className="requester-avatar">
                    {requesterName.charAt(0).toUpperCase()}
                  </div>
                  <div className="requester-details-grid">
                    <div className="requester-detail-item">
                      <span className="detail-label">Full Name</span>
                      <span className="detail-value font-semibold">{requesterName}</span>
                    </div>

                    <div className="requester-detail-item">
                      <span className="detail-label">Student ID</span>
                      <span className="detail-value">
                        <FaIdCard className="detail-inline-icon" />
                        {requestData?.studentId || 'Not Provided / Guest'}
                      </span>
                    </div>

                    <div className="requester-detail-item">
                      <span className="detail-label">Email Address</span>
                      <div className="detail-value email-value">
                        <FaEnvelope className="detail-inline-icon" />
                        <span>{requesterEmail || 'None provided'}</span>
                        {requesterEmail && (
                          <button
                            type="button"
                            className="btn-copy-email"
                            onClick={() => handleCopyEmail(requesterEmail)}
                            title="Copy email to clipboard"
                            aria-label="Copy email address"
                          >
                            {copiedEmail ? <FaCheck className="copied-icon" /> : <FaCopy />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="requester-detail-item">
                      <span className="detail-label">Academic Info</span>
                      <span className="detail-value">
                        <FaGraduationCap className="detail-inline-icon" />
                        {requestData?.grade ? `${requestData.grade}${requestData.section ? ` - ${requestData.section}` : ''}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Request Subject & Description */}
              <div className="req-modal-section">
                <h4 className="req-modal-section-title">
                  <FaBuilding className="section-title-icon" />
                  <span>Request Inquiry Details</span>
                </h4>
                <div className="req-inquiry-box">
                  <div className="inquiry-meta-row">
                    <div className="inquiry-meta-pill">
                      <span className="meta-lbl">Target Office:</span>
                      <span className="meta-val font-semibold">{requestData?.office || 'General Administration'}</span>
                    </div>
                    {requestData?.category && (
                      <div className="inquiry-meta-pill">
                        <span className="meta-lbl">Category:</span>
                        <span className="meta-val">{requestData.category}</span>
                      </div>
                    )}
                    <div className="inquiry-meta-pill">
                      <FaCalendarAlt className="meta-icon" />
                      <span>{formatDate(requestData?.createdAt)}</span>
                    </div>
                  </div>

                  <h3 className="inquiry-subject">{requestData?.subject || 'No Subject Specified'}</h3>

                  <div className="inquiry-description-panel">
                    <p className="inquiry-text">
                      {requestData?.description || 'No detailed message was included in this submission.'}
                    </p>
                  </div>

                  {/* Inquiry Source if guest */}
                  {requestData?.inquirySource && (
                    <div className="inquiry-source-note">
                      <span className="source-label">Origin:</span>
                      <span>{requestData.inquirySource}</span>
                    </div>
                  )}

                  {/* Attachments if any */}
                  {requestData?.attachments && requestData.attachments.length > 0 && (
                    <div className="inquiry-attachments">
                      <span className="attachments-title">
                        <FaPaperclip /> Attachments ({requestData.attachments.length}):
                      </span>
                      <div className="attachments-list">
                        {requestData.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url || att}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="attachment-chip"
                          >
                            {att.name || `Attachment ${idx + 1}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="req-modal-footer">
          <div className="modal-footer-left">
            {requesterEmail && (
              <a
                href={`mailto:${requesterEmail}?subject=Re: [${requestData?.requestId || 'Inquiry'}] ${encodeURIComponent(requestData?.subject || 'Support Assistance')}`}
                className="btn-email-requester"
              >
                <FaEnvelope />
                <span>Send Email to Requester</span>
              </a>
            )}
          </div>
          <div className="modal-footer-right">
            {isLoginAssistance && (
              <button
                type="button"
                className="btn-primary-action"
                onClick={handleGoToUserManagement}
              >
                <FaUser />
                <span>Open in User Management</span>
              </button>
            )}
            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsModal;
