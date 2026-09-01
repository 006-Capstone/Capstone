import React, { useState, useEffect, useRef } from 'react';
import { 
  FaBell, 
  FaUndo, 
  FaCheck, 
  FaFileAlt, 
  FaDownload, 
  FaUserCircle, 
  FaEnvelope, 
  FaTimes, 
  FaPencilAlt, 
  FaInfoCircle,
  FaPaperclip
} from 'react-icons/fa';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  notifyStudentStatusChange, 
  notifyStudentComment, 
  notifyStudentEtcChange,
  notifyStaffReassignment 
} from '../utils/notificationHelper';
import Notifications from './Notifications';
import LoadingSpinner from './LoadingSpinner';
import '../styles/TicketDetails.css';

const isISODate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');

const formatEtcLabel = (value) => {
  if (!value) return '';
  if (!isISODate(value)) return value;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const MONTHS = [
  { value: '01', label: '01 - January' },
  { value: '02', label: '02 - February' },
  { value: '03', label: '03 - March' },
  { value: '04', label: '04 - April' },
  { value: '05', label: '05 - May' },
  { value: '06', label: '06 - June' },
  { value: '07', label: '07 - July' },
  { value: '08', label: '08 - August' },
  { value: '09', label: '09 - September' },
  { value: '10', label: '10 - October' },
  { value: '11', label: '11 - November' },
  { value: '12', label: '12 - December' }
];

const getDaysInSelectedMonth = (year, month) => {
  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || (new Date().getMonth() + 1);
  return new Date(y, m, 0).getDate();
};

const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear + 1, currentYear + 2];
};

const getFormattedPreviewDate = (year, month, day) => {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

const TicketDetails = ({ ticketData, department, onNavigate, onViewRequest }) => {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [reassignOffice, setReassignOffice] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('Normal');
  const [etc, setEtc] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignNote, setReassignNote] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fileInputRef = useRef(null);
  
  // Action Modals
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  // Month / Day / Year ETC editing state
  const [showEstimatedCompletionModal, setShowEstimatedCompletionModal] = useState(false);
  const [etcMonth, setEtcMonth] = useState('08');
  const [etcDay, setEtcDay] = useState('31');
  const [etcYear, setEtcYear] = useState('2026');
  const [completionReason, setCompletionReason] = useState('');
  const [updatingEtc, setUpdatingEtc] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (ticketData) {
      loadTicketDetails();
    } else {
      setLoading(false);
      onNavigate('dashboard');
    }
    
    // Notifications listener
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
        setEtc(data.etc || '');
      } else {
        showToast('Request not found', 'error');
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
      showToast('Failed to load request details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.size <= 5 * 1024 * 1024);
    
    if (validFiles.length < files.length) {
      showToast('Some files exceed 5MB limit and were skipped', 'error');
    }
    
    setReplyFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index) => {
    setReplyFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() && replyFiles.length === 0) {
      showToast('Please enter a message or attach files', 'error');
      return;
    }

    try {
      setSending(true);
      
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

      const staffData = JSON.parse(localStorage.getItem('staffData')) || { name: 'Staff Member' };
      
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, {
        followUps: arrayUnion({
          message: replyMessage.trim(),
          attachments: attachments,
          sentBy: 'staff',
          sentByName: staffData.name,
          staffOffice: department || ticket.office,
          sentAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      if (ticket.studentUid) {
        await notifyStudentComment(
          ticket.studentUid,
          ticket.requestId,
          ticket.subject,
          staffData.name
        );
      }

      showToast('Message sent to student successfully!', 'success');
      setReplyMessage('');
      setReplyFiles([]);
      loadTicketDetails();
      
    } catch (error) {
      console.error('Error sending reply:', error);
      showToast('Failed to send reply: ' + error.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const openEstimatedCompletionModal = () => {
    let targetDate = new Date();
    if (ticket?.etc && isISODate(ticket.etc)) {
      const [y, m, d] = ticket.etc.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else if (ticket?.estimatedCompletion) {
      const d = ticket.estimatedCompletion.toDate ? ticket.estimatedCompletion.toDate() : new Date(ticket.estimatedCompletion);
      if (!isNaN(d.getTime())) targetDate = d;
    } else {
      targetDate.setDate(targetDate.getDate() + 3);
    }

    setEtcMonth(String(targetDate.getMonth() + 1).padStart(2, '0'));
    setEtcDay(String(targetDate.getDate()).padStart(2, '0'));
    setEtcYear(String(targetDate.getFullYear()));
    setCompletionReason(ticket?.estimatedCompletionReason || '');
    setShowEstimatedCompletionModal(true);
  };

  const applyDaysPreset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setEtcMonth(String(d.getMonth() + 1).padStart(2, '0'));
    setEtcDay(String(d.getDate()).padStart(2, '0'));
    setEtcYear(String(d.getFullYear()));
  };

  const handleUpdateEstimatedCompletion = async () => {
    if (!ticket) return;

    const y = parseInt(etcYear, 10);
    const m = parseInt(etcMonth, 10);
    const d = parseInt(etcDay, 10);

    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      showToast('Please specify a valid Month, Day, and Year', 'error');
      return;
    }

    const completionDate = new Date(y, m - 1, d);
    if (isNaN(completionDate.getTime())) {
      showToast('Invalid date selected', 'error');
      return;
    }

    const formattedEtc = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const trimmedReason = completionReason.trim();

    if (!trimmedReason) {
      showToast('Please provide a reason for the student', 'error');
      return;
    }

    try {
      setUpdatingEtc(true);
      const staffData = JSON.parse(localStorage.getItem('staffData')) || { name: 'Staff Member' };
      const docRef = doc(db, 'requests', ticket.firestoreId);
      
      const updateData = {
        etc: formattedEtc,
        estimatedCompletion: completionDate,
        estimatedCompletionSetAt: new Date(),
        estimatedCompletionSetBy: staffData.name,
        estimatedCompletionReason: trimmedReason,
        updatedAt: serverTimestamp(),
        followUps: arrayUnion({
          message: `Estimated completion date set to ${m}/${d}/${y} (${formatEtcLabel(formattedEtc)}) by ${staffData.name}.\nReason: ${trimmedReason}`,
          sentBy: 'system',
          sentByName: 'System',
          sentAt: new Date().toISOString()
        })
      };
      
      await updateDoc(docRef, updateData);

      if (ticket.studentUid) {
        await notifyStudentEtcChange(
          ticket.studentUid,
          ticket.requestId,
          ticket.subject,
          formattedEtc,
          trimmedReason
        );
      }

      showToast('Estimated Completion Date updated successfully!', 'success');
      setShowEstimatedCompletionModal(false);
      loadTicketDetails();
    } catch (error) {
      console.error('Error updating Estimated Completion Date:', error);
      showToast('Failed to update date: ' + error.message, 'error');
    } finally {
      setUpdatingEtc(false);
    }
  };

  const confirmReturnTicket = async () => {
    if (!returnReason.trim()) {
      showToast('Please provide a reason for returning this request', 'error');
      return;
    }

    try {
      setReturning(true);
      const staffData = JSON.parse(localStorage.getItem('staffData')) || { name: 'Staff Member' };
      const docRef = doc(db, 'requests', ticket.firestoreId);
      
      await updateDoc(docRef, {
        status: 'Returned',
        returnedAt: serverTimestamp(),
        returnedBy: staffData.name,
        returnedReason: returnReason.trim(),
        followUps: arrayUnion({
          message: `Request returned by ${staffData.name}.\nReason: ${returnReason.trim()}`,
          sentBy: 'system',
          sentByName: 'System',
          sentAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });
      
      if (ticket.studentUid) {
        await notifyStudentStatusChange(
          ticket.studentUid,
          ticket.requestId,
          ticket.subject,
          ticket.status,
          'Returned'
        );
      }
      
      showToast('Request returned successfully', 'success');
      setShowReturnModal(false);
      setReturnReason('');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('Error returning ticket:', error);
      showToast('Failed to return request: ' + error.message, 'error');
    } finally {
      setReturning(false);
    }
  };

  // Check if the current office is the original department where the request originated
  const isOriginalDepartment = () => {
    if (!ticket) return false;
    // If ticket was never rerouted, the current office is the original department
    if (!ticket.reassignedFrom && !ticket.officeHistory) {
      return true;
    }

    if (ticket.originalOffice) {
      return (ticket.office || '').toLowerCase() === ticket.originalOffice.toLowerCase();
    }

    // Check officeHistory for the earliest recorded office
    if (ticket.officeHistory && Object.keys(ticket.officeHistory).length > 0) {
      const historyEntries = Object.entries(ticket.officeHistory);
      historyEntries.sort((a, b) => {
        const timeA = a[1]?.handledAt ? new Date(a[1].handledAt).getTime() : 0;
        const timeB = b[1]?.handledAt ? new Date(b[1].handledAt).getTime() : 0;
        return timeA - timeB;
      });
      const originalOfficeName = historyEntries[0][0];
      return (ticket.office || '').toLowerCase() === originalOfficeName.toLowerCase();
    }

    // If reassignedFrom is present, current office must match the origin
    if (ticket.reassignedFrom) {
      return (ticket.office || '').toLowerCase() === (ticket.reassignedFrom || '').toLowerCase();
    }

    return true;
  };

  const confirmResolveTicket = async () => {
    try {
      setResolving(true);
      const oldStatus = ticket.status;
      const staffData = JSON.parse(localStorage.getItem('staffData')) || { name: 'Staff Member' };
      const docRef = doc(db, 'requests', ticket.firestoreId);
      
      const updateData = {
        status: 'Resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: staffData.name,
        updatedAt: serverTimestamp()
      };

      if (resolveNote.trim()) {
        updateData.resolutionNote = resolveNote.trim();
        updateData.followUps = arrayUnion({
          message: `Request marked as Resolved by ${staffData.name}.\nResolution Note: ${resolveNote.trim()}`,
          sentBy: 'staff',
          sentByName: staffData.name,
          staffOffice: department || ticket.office,
          sentAt: new Date().toISOString()
        });
      }
      
      await updateDoc(docRef, updateData);
      
      if (ticket.studentUid) {
        await notifyStudentStatusChange(
          ticket.studentUid,
          ticket.requestId,
          ticket.subject,
          oldStatus,
          'Resolved'
        );
      }
      
      showToast('Request resolved successfully!', 'success');
      setShowResolveModal(false);
      setResolveNote('');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('Error resolving ticket:', error);
      showToast('Failed to resolve request: ' + error.message, 'error');
    } finally {
      setResolving(false);
    }
  };

  const confirmRejectTicket = async () => {
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejecting this request', 'error');
      return;
    }

    try {
      setRejecting(true);
      const oldStatus = ticket.status;
      const staffData = JSON.parse(localStorage.getItem('staffData')) || { name: 'Staff Member' };
      const docRef = doc(db, 'requests', ticket.firestoreId);
      
      const updateData = {
        status: 'Rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: staffData.name,
        rejectedReason: rejectReason.trim(),
        updatedAt: serverTimestamp(),
        followUps: arrayUnion({
          message: `Request rejected by ${staffData.name}.\nReason: ${rejectReason.trim()}`,
          sentBy: 'staff',
          sentByName: staffData.name,
          staffOffice: department || ticket.office,
          sentAt: new Date().toISOString()
        })
      };
      
      await updateDoc(docRef, updateData);
      
      if (ticket.studentUid) {
        await notifyStudentStatusChange(
          ticket.studentUid,
          ticket.requestId,
          ticket.subject,
          oldStatus,
          'Rejected'
        );
      }
      
      showToast('Request rejected successfully', 'success');
      setShowRejectModal(false);
      setRejectReason('');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('Error rejecting request:', error);
      showToast('Failed to reject request: ' + error.message, 'error');
    } finally {
      setRejecting(false);
    }
  };

  const generateRequestId = (officeName) => {
    const officePrefix = officeName.substring(0, 3).toUpperCase();
    const randomNum1 = Math.floor(100 + Math.random() * 900);
    const randomNum2 = Math.floor(100 + Math.random() * 900);
    const randomNum3 = Math.floor(100 + Math.random() * 900);
    return `${officePrefix}-${randomNum1}-${randomNum2}-${randomNum3}`;
  };

  const handleUrgencyChange = async (newUrgency) => {
    setUrgencyLevel(newUrgency);
    try {
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, {
        urgencyLevel: newUrgency,
        updatedAt: serverTimestamp()
      });
      showToast(`Urgency level updated to ${newUrgency}`, 'info');
    } catch (error) {
      console.error('Error updating urgency level:', error);
      showToast('Failed to update urgency level', 'error');
    }
  };

  const handleReassign = () => {
    if (reassignOffice === ticket.office) {
      showToast('Request is already assigned to this office', 'info');
      return;
    }
    setShowReassignModal(true);
  };

  const confirmReassign = async () => {
    if (!reassignNote.trim() || reassignNote.trim().length < 10) {
      showToast('Please provide a detailed reason (at least 10 characters)', 'error');
      return;
    }

    try {
      setShowReassignModal(false);
      const newRequestId = generateRequestId(reassignOffice);
      const staffData = JSON.parse(localStorage.getItem('staffData')) || { name: 'Staff Member' };
      const currentOfficeHistory = ticket.officeHistory || {};
      const currentHandler = ticket.claimedBy || ticket.assignedTo || staffData.name;
      
      if (currentHandler) {
        currentOfficeHistory[ticket.office] = {
          handledBy: currentHandler,
          handledAt: new Date().toISOString()
        };
      }
      
      const previousHandler = currentOfficeHistory[reassignOffice];
      const updateData = {
        office: reassignOffice,
        requestId: newRequestId,
        officeId: reassignOffice.toLowerCase(),
        reassignedFrom: ticket.office,
        reassignedBy: staffData.name,
        reassignedAt: serverTimestamp(),
        reassignmentNote: reassignNote.trim(),
        previousRequestId: ticket.requestId,
        previousOffice: ticket.office,
        officeHistory: currentOfficeHistory,
        urgencyLevel: urgencyLevel,
        updatedAt: serverTimestamp()
      };
      
      if (previousHandler && previousHandler.handledBy) {
        updateData.assignedTo = previousHandler.handledBy;
        updateData.claimedBy = previousHandler.handledBy;
        updateData.claimedAt = new Date().toISOString();
        updateData.status = 'In Process';
        updateData.assignedToStaff = previousHandler.handledBy;
        
        updateData.followUps = arrayUnion(
          {
            message: `Request reassigned from ${ticket.office} to ${reassignOffice} by ${staffData.name}\nReason: ${reassignNote.trim()}`,
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
        updateData.assignedTo = null;
        updateData.claimedBy = null;
        updateData.claimedAt = null;
        updateData.assignedToStaff = null;
        updateData.status = 'Pending';
        
        updateData.followUps = arrayUnion({
          message: `Request reassigned from ${ticket.office} to ${reassignOffice} by ${staffData.name}\nReason: ${reassignNote.trim()}`,
          sentBy: 'system',
          sentByName: 'System',
          sentAt: new Date().toISOString()
        });
      }
      
      const docRef = doc(db, 'requests', ticket.firestoreId);
      await updateDoc(docRef, updateData);
      
      if (ticket.studentUid) {
        await notifyStudentStatusChange(
          ticket.studentUid,
          ticket.requestId,
          ticket.subject,
          ticket.status,
          updateData.status
        );
      }
      
      await notifyStaffReassignment(
        reassignOffice,
        newRequestId,
        ticket.subject,
        ticket.office,
        staffData.name
      );
      
      setReassignNote('');
      showToast(`Request reassigned to ${reassignOffice}!`, 'success');
      onNavigate('my-tickets');
    } catch (error) {
      console.error('Error reassigning ticket:', error);
      showToast('Failed to reassign request: ' + error.message, 'error');
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  };

  const maskEmail = (email) => {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (!domain) return email;
    if (username.length <= 3) return email;
    return `${username.substring(0, 2)}.*****${username.substring(username.length - 2)}@${domain}`;
  };

  // Precise Status Badges
  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved') {
      return (
        <span className="figma-status-badge badge-resolved">
          <span className="status-dot"></span> Resolved
        </span>
      );
    }
    if (s === 'returned' || s === 'rejected' || s === 'cancelled') {
      return (
        <span className="figma-status-badge badge-rejected">
          <span className="status-dot"></span> {status}
        </span>
      );
    }
    if (s === 'in process' || s === 'in progress' || s === 'processing') {
      return (
        <span className="figma-status-badge badge-in-process">
          <span className="status-dot"></span> In Process
        </span>
      );
    }
    return (
      <span className="figma-status-badge badge-new-ticket">
        <span className="status-dot"></span> New Ticket
      </span>
    );
  };

  const isTicketClosed = ticket?.status === 'Resolved' || ticket?.status === 'Cancelled' || ticket?.status === 'Returned';

  if (!ticketData) {
    return (
      <div className="ticket-details-container">
        <div className="ticket-details-empty">
          <p className="ticket-details-empty-title">No request selected</p>
          <p className="ticket-details-empty-text">Go back to your request list to open a request.</p>
          <button className="ticket-details-back-btn" onClick={() => onNavigate('my-tickets')}>
            Back to My Tickets
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Loading request details..." fullScreen={true} />;
  }

  if (!ticket) {
    return (
      <div className="ticket-details-container">
        <div className="ticket-details-empty">
          <p className="ticket-details-empty-title">Request not found</p>
          <p className="ticket-details-empty-text">This request may have been removed, or you no longer have access to it.</p>
          <button className="ticket-details-back-btn" onClick={() => onNavigate('my-tickets')}>
            Back to My Tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-details-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`figma-toast toast-${toast.type}`}>
          {toast.type === 'success' && <FaCheck className="toast-icon" />}
          {toast.type === 'error' && <FaTimes className="toast-icon" />}
          {toast.type === 'info' && <FaInfoCircle className="toast-icon" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Breadcrumb Navigation & Notification Bell */}
      <div className="figma-breadcrumbs-row">
        <nav className="figma-breadcrumbs" aria-label="Breadcrumb">
          <span className="crumb-link" onClick={() => onNavigate('my-tickets')}>All Ticket</span>
          <span className="crumb-slash">/</span>
          <span className="crumb-active">Ticket Details</span>
        </nav>
        
        <button 
          type="button"
          className="figma-bell-wrap" 
          onClick={() => setShowNotifications(true)} 
          title="View notifications"
          aria-label="View notifications"
        >
          <FaBell className="figma-bell-icon" />
          {unreadCount > 0 && <span className="figma-bell-badge" />}
        </button>
      </div>

      {/* Page Title */}
      <div className="figma-header-title-row">
        <h1 className="figma-page-title">Ticket Details</h1>
      </div>

      {/* 2-Column Responsive Grid */}
      <div className="ticket-details-grid">
        
        {/* Left Column (Main Subject & Conversation) */}
        <div className="figma-left-column">
          
          {/* Top Hero / Summary Card */}
          <div className="figma-card ticket-summary-card">
            <div className="summary-top-row">
              <div className="summary-title-group">
                <h2 className="ticket-subject-heading">{ticket.subject?.toUpperCase() || 'REQUEST INQUIRY'}</h2>
                <span className="ticket-id-display">#{ticket.requestId}</span>
              </div>
              <div className="status-badge-wrap">
                {getStatusBadge(ticket.status)}
              </div>
            </div>

            <div className="summary-bottom-row">
              <span className="submitted-time-text">Submitted {getTimeAgo(ticket.createdAt)}</span>

              {!isTicketClosed && (
                <div className="summary-actions-wrap">
                  <button type="button" className="btn-figma-reject" onClick={() => setShowRejectModal(true)}>
                    <FaTimes className="btn-icon" />
                    <span>Reject Request</span>
                  </button>
                  {isOriginalDepartment() && (
                    <button type="button" className="btn-figma-resolve" onClick={() => setShowResolveModal(true)}>
                      <FaCheck className="btn-icon" />
                      <span>Resolve Request</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Original Submission & Chat Card */}
          <div className="figma-card original-submission-card">
            <div className="submission-card-header">
              <h3 className="submission-section-title">Original Message from Student</h3>
              <span className="submission-date-label">Created on {formatDate(ticket.createdAt)}</span>
            </div>

            {/* Student Inquiry Message Box (ABOVE - Highlighted) */}
            <div className="student-quote-container highlighted-student-inquiry">
              <div className="student-quote-header">
                <div className="student-author-tag">
                  <FaUserCircle className="student-author-icon" />
                  <span className="student-author-title">{ticket.studentName || 'Student'}’s Inquiry</span>
                </div>
                <span className="student-inquiry-badge">Primary Message</span>
              </div>

              <p className="student-quote-text">
                “{ticket.description || 'Good day! I would like to kindly ask about the book distribution in the school library. May I know when and how can I receive the books? Thank you!'}”
              </p>
              
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div className="submission-attachments-row">
                  {ticket.attachments.map((file, idx) => (
                    <div 
                      key={idx} 
                      className="attachment-chip" 
                      onClick={() => downloadAttachment(file)}
                      title={`Download ${file.name}`}
                    >
                      <FaFileAlt className="att-chip-icon" />
                      <span className="att-chip-name">{file.name}</span>
                      <FaDownload className="att-chip-dl" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rerouted Alert if ticket was transferred (BELOW) */}
            {ticket.reassignedFrom && (
              <div className="reroute-inline-banner" style={{ marginTop: '16px', marginBottom: '0' }}>
                <div className="reroute-banner-top">
                  <span className="reroute-tag">Rerouted from {ticket.reassignedFrom}</span>
                  {ticket.reassignedAt && <span className="reroute-date">{formatDate(ticket.reassignedAt)}</span>}
                </div>
                {ticket.previousRequestId && (
                  <span className="reroute-prev-ref">Previous ID: #{ticket.previousRequestId}</span>
                )}
                {ticket.reassignmentNote && (
                  <div className="reroute-note">
                    <span className="reroute-note-label">Note from {ticket.reassignedFrom}:</span>
                    <div className="reroute-note-body">{ticket.reassignmentNote}</div>
                  </div>
                )}
              </div>
            )}

            {/* Threaded Follow-up Messages */}
            {ticket.followUps && ticket.followUps
              .filter(f => f.sentBy !== 'system' || (!f.message?.includes('reassigned from') && !f.message?.includes('automatically assigned to')))
              .length > 0 && (
              <div className="conversation-thread-list">
                {ticket.followUps
                  .filter(f => f.sentBy !== 'system' || (!f.message?.includes('reassigned from') && !f.message?.includes('automatically assigned to')))
                  .map((followUp, i) => {
                    const isStaff = followUp.sentBy === 'staff';
                    return (
                      <div key={i} className={`thread-bubble ${isStaff ? 'staff-thread-bubble' : 'student-thread-bubble'}`}>
                        <div className="thread-bubble-header">
                          <div className="thread-bubble-author">
                            {isStaff ? (
                              <div className="thread-staff-badge">{getInitials(followUp.sentByName)}</div>
                            ) : (
                              <FaUserCircle className="thread-student-avatar" />
                            )}
                            <span className="thread-author-name">
                              {isStaff ? `${ticket.office || department} (${followUp.sentByName})` : (ticket.studentName || 'Student')}
                            </span>
                          </div>
                          <span className="thread-time">{formatDate(followUp.sentAt)}</span>
                        </div>
                        <p className="thread-body-text">{followUp.message}</p>
                        {followUp.attachments && followUp.attachments.length > 0 && (
                          <div className="submission-attachments-row">
                            {followUp.attachments.map((file, fIdx) => (
                              <div key={fIdx} className="attachment-chip" onClick={() => downloadAttachment(file)}>
                                <FaFileAlt className="att-chip-icon" />
                                <span className="att-chip-name">{file.name}</span>
                                <FaDownload className="att-chip-dl" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Dashed Separator */}
            {!isTicketClosed && <div className="card-dashed-divider" />}

            {/* Reply to Student Composer */}
            {!isTicketClosed && (
              <div className="reply-composer-section">
                <div className="reply-composer-header">
                  <FaUserCircle className="reply-composer-avatar" />
                  <span className="reply-composer-title">Reply to student</span>
                </div>

                <div className="reply-textarea-wrapper">
                  <textarea
                    className="reply-native-textarea"
                    placeholder="Type your message here...."
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
                    <div className="composer-staged-row">
                      {replyFiles.map((file, index) => (
                        <div key={index} className="staged-file-badge">
                          <FaFileAlt className="staged-icon" />
                          <span className="staged-text">{file.name}</span>
                          <button 
                            type="button" 
                            className="staged-close-btn" 
                            onClick={() => handleRemoveFile(index)}
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="reply-composer-actions">
                  <button 
                    type="button" 
                    className="btn-attach-action"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Attach files to message"
                  >
                    <FaPaperclip className="attach-action-icon" />
                    <span>Attach Files</span>
                  </button>

                  <button 
                    type="button" 
                    className="btn-primary-action"
                    onClick={handleSendReply}
                    disabled={sending || (!replyMessage.trim() && replyFiles.length === 0)}
                  >
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Sidebar Cards) */}
        <div className="figma-right-column">

          {/* Status Timeline Card */}
          <div className="figma-card timeline-card">
            <h3 className="figma-sidebar-title">Status Timeline</h3>

            <div className="figma-timeline-stepper">
              
              {/* Milestone 1: SUBMITTED */}
              <div className="timeline-step step-complete">
                <div className="step-circle complete">
                  <FaCheck />
                </div>
                <div className="step-content">
                  <h4 className="step-status-name">SUBMITTED</h4>
                  <p className="step-date-label">{formatDate(ticket.createdAt)}</p>
                  <p className="step-sub-desc">Initial Student Request</p>
                </div>
              </div>

              {/* Milestone 2: PROCESSING */}
              <div className={`timeline-step ${ticket.claimedBy ? 'step-complete' : 'step-pending'}`}>
                <div className={`step-circle ${ticket.claimedBy ? 'complete' : 'pending'}`}>
                  {ticket.claimedBy ? <FaCheck /> : null}
                </div>
                <div className="step-content">
                  <h4 className="step-status-name">PROCESSING</h4>
                  {ticket.claimedAt && <p className="step-date-label">{formatDate(ticket.claimedAt)}</p>}
                  {ticket.claimedBy && <p className="step-sub-desc">Accepted and processed by {ticket.claimedBy}</p>}
                  
                  {ticket.etc ? (
                    <button
                      type="button"
                      className="figma-etc-pill"
                      onClick={openEstimatedCompletionModal}
                      title="Edit estimated completion date"
                    >
                      <span>Estimated time of completion: {formatEtcLabel(ticket.etc)}</span>
                      <FaPencilAlt className="etc-edit-pencil" />
                    </button>
                  ) : !isTicketClosed ? (
                    <button
                      type="button"
                      className="figma-etc-pill btn-set-etc"
                      onClick={openEstimatedCompletionModal}
                      title="Set estimated completion date"
                    >
                      <span>+ Set Estimated Completion Date</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Milestone Sub-Node: Date Adjusted */}
              {ticket.estimatedCompletionSetAt && (
                <div className="timeline-step step-sub-node step-complete">
                  <div className="step-circle sub-complete">
                    <FaCheck />
                  </div>
                  <div className="step-content">
                    <h4 className="step-status-name sub-highlight">DATE ADJUSTED</h4>
                    <p className="step-date-label">{formatDate(ticket.estimatedCompletionSetAt)}</p>
                    <p className="step-sub-desc">
                      Estimated completion updated to {formatDate(ticket.estimatedCompletion)}
                      {ticket.estimatedCompletionSetBy && ` by ${ticket.estimatedCompletionSetBy}`}
                    </p>
                    {ticket.estimatedCompletionReason && (
                      <p className="step-sub-desc italic">"{ticket.estimatedCompletionReason}"</p>
                    )}
                  </div>
                </div>
              )}

              {/* Milestone Sub-Node: Office Reassignment Trail */}
              {(() => {
                const events = [];
                
                // 1. Check if followUps has logged reassignment messages
                if (ticket.followUps && Array.isArray(ticket.followUps)) {
                  ticket.followUps.forEach((f) => {
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
                            date: f.sentAt
                          });
                        }
                      }
                    }
                  });
                }

                // 2. If no events parsed from followUps, build from ticket reroute metadata
                if (events.length === 0 && ticket.reassignedFrom) {
                  const currentOffice = ticket.office || 'Office';
                  const fromOffice = ticket.reassignedFrom;
                  const history = ticket.officeHistory || {};

                  // Check if there was an earlier origin before fromOffice
                  const originOffice = (ticket.previousOffice && ticket.previousOffice !== fromOffice && ticket.previousOffice !== currentOffice)
                    ? ticket.previousOffice
                    : null;

                  if (originOffice) {
                    events.push({
                      from: originOffice,
                      to: fromOffice,
                      by: (history[originOffice] && history[originOffice].handledBy) || '',
                      date: (history[originOffice] && history[originOffice].handledAt) || ticket.createdAt
                    });
                  }

                  // Main reassignment leg (From -> To)
                  if (fromOffice.toLowerCase() !== currentOffice.toLowerCase()) {
                    events.push({
                      from: fromOffice,
                      to: currentOffice,
                      by: ticket.reassignedBy || (history[fromOffice] && history[fromOffice].handledBy) || '',
                      reason: ticket.reassignmentNote || '',
                      date: ticket.reassignedAt || (history[fromOffice] && history[fromOffice].handledAt)
                    });
                  } else {
                    const otherOffice = Object.keys(history).find(k => k.toLowerCase() !== currentOffice.toLowerCase()) || 'Other Office';
                    events.push({
                      from: otherOffice,
                      to: currentOffice,
                      by: ticket.reassignedBy || (history[otherOffice] && history[otherOffice].handledBy) || '',
                      reason: ticket.reassignmentNote || '',
                      date: ticket.reassignedAt || (history[otherOffice] && history[otherOffice].handledAt)
                    });
                  }
                }

                const filteredEvents = events.filter(e => e.from && e.to && e.from.trim().toLowerCase() !== e.to.trim().toLowerCase());
                if (filteredEvents.length === 0) return null;

                return filteredEvents.map((event, idx) => {
                  const isReturn = idx > 0 && event.to === filteredEvents[0].from;
                  return (
                    <div key={`reassign-${idx}`} className="timeline-step step-sub-node step-complete">
                      <div className="step-circle sub-complete">
                        <FaCheck />
                      </div>
                      <div className="step-content">
                        <h4 className="step-status-name sub-highlight">{isReturn ? 'RETURNED' : 'REASSIGNED'}</h4>
                        {event.date && <p className="step-date-label">{formatDate(event.date)}</p>}
                        <p className="step-sub-desc">
                          {event.from} → {event.to}
                          {event.by ? ` by ${event.by}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
              {/* Milestone: RETURNED/FOR FOLLOW UP */}
              {(ticket.status === 'Returned' || ticket.status === 'For Follow Up') && (
                <div className="timeline-step step-complete">
                  <div className="step-circle complete">
                    <FaCheck />
                  </div>
                  <div className="step-content">
                    <h4 className="step-status-name">RETURNED/FOR FOLLOW UP</h4>
                    {ticket.returnedAt && (
                      <p className="step-date-label">{formatDate(ticket.returnedAt)}</p>
                    )}
                    <p className="step-sub-desc">Action required: {ticket.returnedReason || 'See details'}</p>
                  </div>
                </div>
              )}

              {/* Milestone 3: RESOLVED */}
              <div className={`timeline-step ${ticket.status === 'Resolved' ? 'step-complete' : 'step-dashed'}`}>
                <div className={`step-circle ${ticket.status === 'Resolved' ? 'complete' : 'dashed'}`}>
                  {ticket.status === 'Resolved' && <FaCheck />}
                </div>
                <div className="step-content">
                  <h4 className="step-status-name">RESOLVED</h4>
                  {ticket.resolvedAt && (
                    <p className="step-date-label">{formatDate(ticket.resolvedAt)}</p>
                  )}
                  {ticket.status === 'Resolved' ? (
                    <p className="step-sub-desc">Resolved {ticket.resolvedBy ? `by ${ticket.resolvedBy}` : ''}</p>
                  ) : null}
                </div>
              </div>

            </div>
          </div>

          {/* Management Control Card */}
          <div className={`figma-card management-card ${isTicketClosed ? 'card-locked' : ''}`}>
            <h3 className="figma-sidebar-title">Management Control</h3>

            {isTicketClosed && (
              <p className="mgmt-lock-message">
                This request is {ticket.status === 'Resolved' ? 'resolved' : 'closed'} — management controls are locked.
              </p>
            )}

            <div className="mgmt-form-item">
              <label className="mgmt-input-label">URGENCY LEVEL</label>
              <select
                className="figma-select-input"
                value={urgencyLevel}
                onChange={(e) => handleUrgencyChange(e.target.value)}
                disabled={isTicketClosed}
              >
                <option value="Normal">Normal - Process within 2-3 days</option>
                <option value="Medium">Medium - Process within 1-2 days</option>
                <option value="High">High - Process within the day</option>
              </select>
            </div>

            <div className="mgmt-form-item">
              <label className="mgmt-input-label">REASSIGN TO</label>
              <select
                className="figma-select-input"
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
                <button type="button" className="btn-figma-reassign-action" onClick={handleReassign}>
                  Reassign Request
                </button>
              )}
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="figma-card student-profile-card">
            <div className="student-profile-avatar-circle">
              {ticket.studentProfilePicture ? (
                <img src={ticket.studentProfilePicture} alt="Student" className="student-profile-photo" />
              ) : (
                <FaUserCircle className="student-profile-icon" />
              )}
            </div>

            <h4 className="student-name-heading">{ticket.studentName || 'Ricky Liam'}</h4>
            <p className="student-level-tag">JUNIOR HIGH SCHOOL</p>

            <div className="student-details-list">
              <div className="student-detail-item">{ticket.studentId || '05-2324-12345'}</div>
              <div className="student-detail-item">
                {ticket.studentGradeLevel || 'Grade 10'} - {ticket.studentSection || 'St. Valerius'}
              </div>
              <div className="student-detail-item">{maskEmail(ticket.studentEmail) || 'rl.*****am@gmail.com'}</div>
            </div>

            {ticket.studentEmail ? (
              <a 
                href={`mailto:${ticket.studentEmail}?subject=Regarding Request %23${ticket.requestId}: ${encodeURIComponent(ticket.subject || '')}`}
                className="btn-figma-contact"
              >
                <FaEnvelope className="contact-envelope-icon" />
                <span>CONTACT STUDENT</span>
              </a>
            ) : (
              <button type="button" className="btn-figma-contact" disabled>
                <FaEnvelope className="contact-envelope-icon" />
                <span>CONTACT STUDENT</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* Modal: Resolve Ticket */}
      {showResolveModal && (
        <div className="figma-modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="figma-modal-window" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-heading green-heading">Resolve Request</h3>
            <p className="modal-explainer">
              Mark request <strong>#{ticket.requestId}</strong> as resolved.
            </p>

            <div className="modal-field-group">
              <label className="modal-label">Resolution Note (Optional):</label>
              <textarea
                className="modal-input-area"
                placeholder="Example: Documents processed and ready for pickup..."
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                rows={4}
              />
            </div>

            <div className="modal-btn-row">
              <button 
                type="button"
                className="btn-modal-back" 
                onClick={() => setShowResolveModal(false)}
                disabled={resolving}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-modal-submit btn-submit-green" 
                onClick={confirmResolveTicket}
                disabled={resolving}
              >
                {resolving ? 'Resolving...' : 'Confirm Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Request */}
      {showRejectModal && (
        <div className="figma-modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="figma-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3 className="modal-heading danger-heading">Reject Request</h3>
              <button 
                type="button" 
                className="modal-close-icon-btn" 
                onClick={() => setShowRejectModal(false)}
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
            <p className="modal-explainer">
              Reject request <strong>#{ticket.requestId}</strong>. The student will receive a notification with this rejection reason.
            </p>

            <div className="modal-field-group">
              <label className="modal-label">
                Reason for Rejection <span className="required-marker">(Required):</span>
              </label>
              <textarea
                className="modal-input-area"
                placeholder="Specify the reason why this request cannot be fulfilled..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                maxLength={400}
                required
              />
              <div className="modal-char-counter">
                {rejectReason.trim().length === 0 && (
                  <span className="reason-required-text">Reason is required &bull; </span>
                )}
                {rejectReason.length}/400 characters
              </div>
            </div>

            <div className="modal-btn-row">
              <button 
                type="button" 
                className="btn-modal-back" 
                onClick={() => setShowRejectModal(false)}
                disabled={rejecting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-modal-submit btn-submit-danger" 
                onClick={confirmRejectTicket}
                disabled={rejecting || !rejectReason.trim()}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Return Ticket */}
      {showReturnModal && (
        <div className="figma-modal-overlay" onClick={() => setShowReturnModal(false)}>
          <div className="figma-modal-window" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-heading slate-heading">Return Request</h3>
            <p className="modal-explainer">
              Return request <strong>#{ticket.requestId}</strong> to the student for corrections.
            </p>

            <div className="modal-field-group">
              <label className="modal-label">Reason for Return (Required):</label>
              <textarea
                className="modal-input-area"
                placeholder="Specify what corrections or documents are needed..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
              />
            </div>

            <div className="modal-btn-row">
              <button 
                type="button"
                className="btn-modal-back" 
                onClick={() => setShowReturnModal(false)}
                disabled={returning}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-modal-submit btn-submit-slate" 
                onClick={confirmReturnTicket}
                disabled={returning || !returnReason.trim()}
              >
                {returning ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reassign Office */}
      {showReassignModal && (
        <div className="figma-modal-overlay" onClick={cancelReassign}>
          <div className="figma-modal-window" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-heading green-heading">Reassign to {reassignOffice}</h3>
            <p className="modal-explainer">
              Please provide a reason for reassigning request #{ticket.requestId}
            </p>
            
            <div className="modal-field-group">
              <textarea
                className="modal-input-area"
                placeholder="Example: This inquiry belongs to the Finance Office..."
                value={reassignNote}
                onChange={(e) => setReassignNote(e.target.value)}
                rows={5}
                maxLength={500}
              />
              <div className="modal-char-counter">
                {reassignNote.length}/500 characters
                {reassignNote.length < 10 && reassignNote.length > 0 && (
                  <span className="warning-text"> (minimum 10 characters)</span>
                )}
              </div>
            </div>
            
            <div className="modal-btn-row">
              <button type="button" className="btn-modal-back" onClick={cancelReassign}>
                Cancel
              </button>
              <button 
                type="button"
                className="btn-modal-submit btn-submit-green" 
                onClick={confirmReassign}
                disabled={reassignNote.trim().length < 10}
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Estimated Completion Date (Month / Day / Year) */}
      {showEstimatedCompletionModal && (
        <div className="figma-modal-overlay" onClick={() => setShowEstimatedCompletionModal(false)}>
          <div className="figma-modal-window modal-etc-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3 className="modal-heading green-heading">Edit Estimated Completion Date</h3>
              <button 
                type="button" 
                className="modal-close-icon-btn" 
                onClick={() => setShowEstimatedCompletionModal(false)}
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
            
            <p className="modal-explainer">
              Set or adjust the target completion date for request <strong>#{ticket.requestId}</strong>.
            </p>

            {/* Quick Presets */}
            <div className="etc-presets-section">
              <span className="etc-presets-label">QUICK PRESETS</span>
              <div className="etc-presets-grid">
                <button
                  type="button"
                  className="etc-preset-btn"
                  onClick={() => applyDaysPreset(3)}
                >
                  +3 Days (Normal)
                </button>
                <button
                  type="button"
                  className="etc-preset-btn"
                  onClick={() => applyDaysPreset(5)}
                >
                  +5 Days
                </button>
                <button
                  type="button"
                  className="etc-preset-btn"
                  onClick={() => applyDaysPreset(7)}
                >
                  +7 Days (1 Week)
                </button>
                <button
                  type="button"
                  className="etc-preset-btn"
                  onClick={() => applyDaysPreset(14)}
                >
                  +14 Days (2 Weeks)
                </button>
              </div>
            </div>

            {/* Target Date: Month / Day / Year Selectors */}
            <div className="etc-mdy-container">
              <label className="modal-label">Target Date (Month / Day / Year):</label>
              <div className="etc-mdy-inputs-row">
                
                {/* Month */}
                <div className="etc-mdy-field field-month">
                  <span className="mdy-field-tag">MONTH</span>
                  <select
                    className="etc-select-box"
                    value={etcMonth}
                    onChange={(e) => setEtcMonth(e.target.value)}
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Day */}
                <div className="etc-mdy-field field-day">
                  <span className="mdy-field-tag">DAY</span>
                  <select
                    className="etc-select-box"
                    value={etcDay}
                    onChange={(e) => setEtcDay(e.target.value)}
                  >
                    {Array.from({ length: getDaysInSelectedMonth(etcYear, etcMonth) }, (_, i) => {
                      const dayNum = String(i + 1).padStart(2, '0');
                      return <option key={dayNum} value={dayNum}>{dayNum}</option>;
                    })}
                  </select>
                </div>

                {/* Year */}
                <div className="etc-mdy-field field-year">
                  <span className="mdy-field-tag">YEAR</span>
                  <select
                    className="etc-select-box"
                    value={etcYear}
                    onChange={(e) => setEtcYear(e.target.value)}
                  >
                    {getYearOptions().map(yr => (
                      <option key={yr} value={String(yr)}>{yr}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Formatted Date Banner */}
              <div className="etc-date-preview-banner">
                <span className="preview-label">Selected Date:</span>
                <strong className="preview-value">
                  {etcMonth}/{etcDay}/{etcYear} &bull; {getFormattedPreviewDate(etcYear, etcMonth, etcDay)}
                </strong>
              </div>
            </div>

            {/* Reason Text Area */}
            <div className="modal-field-group reason-field-group">
              <div className="reason-label-row">
                <label className="modal-label">
                  Reason for student <span className="required-marker">(Required):</span>
                </label>
                <span className="reason-hint">Visible to student in update notice</span>
              </div>
              <textarea
                className="modal-input-area reason-textarea"
                placeholder="Specify why this target date was scheduled or adjusted (e.g., Awaiting clearance from Registrar, peak period queue)..."
                value={completionReason}
                onChange={(e) => setCompletionReason(e.target.value)}
                rows={3}
                maxLength={300}
                required
              />
              <div className="modal-char-counter">
                {completionReason.trim().length === 0 && (
                  <span className="reason-required-text">Reason is required &bull; </span>
                )}
                {completionReason.length}/300 characters
              </div>
            </div>
            
            <div className="modal-btn-row">
              <button 
                type="button"
                className="btn-modal-back" 
                onClick={() => setShowEstimatedCompletionModal(false)}
                disabled={updatingEtc}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn-modal-submit btn-submit-green" 
                onClick={handleUpdateEstimatedCompletion}
                disabled={updatingEtc || !completionReason.trim()}
              >
                {updatingEtc ? 'Saving...' : 'Save Target Date'}
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
