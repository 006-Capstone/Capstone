import React, { useState, useRef, useEffect } from 'react';
import { FaFileUpload, FaUserCircle, FaFileAlt, FaTimes, FaSignInAlt, FaArrowLeft, FaArrowRight, FaInfoCircle, FaIdCard, FaPlus } from 'react-icons/fa';
import { MdHome, MdTrackChanges, MdCheckCircle, MdWarning, MdError, MdPostAdd } from 'react-icons/md';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { notifyStaffNewRequest } from '../utils/notificationHelper';
import { validateContent } from '../utils/contentModeration';
import GuestSubmitted from './GuestSubmitted';
import GuestRequestStatus from './GuestRequestStatus';
import { useNotification } from '../context/NotificationContext';
import { resolveOriginalHandler, getOriginalOffice } from '../utils/ticketHistoryHelper';
import '../styles/GuestLogin.css';

// Smart image compression to stay under Firestore 1 MB document limit
const MAX_IMAGE_DIMENSION = 1280;
const MAX_BASE64_LENGTH = 900 * 1024 * 1.37; // ~0.9 MiB raw -> base64 ceiling

const isAllowedFileType = (file) => {
  if (!file) return false;
  const allowedMime = ['application/pdf', 'image/png', 'image/jpeg'];
  if (allowedMime.includes(file.type)) return true;
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
};

const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the image file.'));
  reader.onload = (evt) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Invalid image format.'));
    img.onload = () => {
      try {
        const encode = (maxDim) => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);

          let quality = 0.82;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          while (dataUrl.length > MAX_BASE64_LENGTH && quality > 0.35) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          return dataUrl;
        };

        let result = encode(MAX_IMAGE_DIMENSION);
        for (const dim of [1024, 800, 600]) {
          if (result.length <= MAX_BASE64_LENGTH) break;
          result = encode(dim);
        }
        
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

const guestOffices = [
  {
    id: 'finance',
    name: 'Accounting',
    description: 'Manages tuition payments, student balances, billing concerns, and other school-related financial transactions.',
    subjects: ['Balance Verification', 'Payment Plan', 'Refund Request', 'Billing Inquiry']
  },
  {
    id: 'library',
    name: 'Library',
    description: 'Manages book borrowing/returning, library accounts, and student concerns related to library services and resources.',
    subjects: ['Book Request', 'Lost Book Report', 'Library Card Issue', 'Resource Access']
  },
  {
    id: 'registrar',
    name: 'Registrar',
    description: 'Handles student records such as enrollment, grades, certificates, transcripts, and other official academic documents.',
    subjects: ['Document Request', 'Grade Inquiry', 'Enrollment Issue', 'Transcript Request']
  },
  {
    id: 'guidance',
    name: 'Guidance',
    description: 'Handles student behavior concerns, violations, and disciplinary cases to maintain order and safety in school.',
    subjects: ['Counseling Request', 'Disciplinary Appeal', 'Behavior Report', 'Support Services']
  }
];

const random3 = () => Math.floor(100 + Math.random() * 900);

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatShortDate = (date) =>
  date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();

const formatLongDate = (date) =>
  date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try { return value.toDate(); } catch { return null; }
  }
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const toShort = (value) => {
  const date = toDate(value);
  return date ? formatShortDate(date) : '';
};

const toLong = (value) => {
  const date = toDate(value);
  return date ? formatLongDate(date) : '';
};

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const GuestLogin = () => {
  const { toast, confirm } = useNotification();
  const [view, setView] = useState('options'); // 'options' | 'check' | 'new' | 'status' | 'submitted'
  const [requestId, setRequestId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('finance');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [authFiles, setAuthFiles] = useState([]);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [isAuthDragging, setIsAuthDragging] = useState(false);
  const [isAttachmentDragging, setIsAttachmentDragging] = useState(false);
  const [showProofGuide, setShowProofGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [submissionData, setSubmissionData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackNotFound, setTrackNotFound] = useState(false);
  const [trackError, setTrackError] = useState('');
  
  // AI Validation states
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  
  const authInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  // AI validation effect with debounce
  useEffect(() => {
    if (!description.trim() || !subject) {
      setValidationResult(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    
    // Debounce validation by 1200ms to avoid excessive AI calls
    const timeoutId = setTimeout(async () => {
      try {
        const selectedOfficeData = guestOffices.find(o => o.id === selectedOffice);
        const officeName = selectedOfficeData?.name || '';
        const result = await validateContent(subject, description, officeName);
        setValidationResult(result);
      } catch (error) {
        console.error('Validation error:', error);
        setValidationResult({
          isValid: false,
          errors: ['AI validation service is currently unavailable. Please try again in a moment.'],
          warnings: [],
          language: 'unknown'
        });
      } finally {
        setIsValidating(false);
      }
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [description, subject, selectedOffice]);

  const handleExitGuestMode = async () => {
    const ok = await confirm({
      title: 'Exit Guest Mode',
      message: 'Exit Guest Mode and return to Student Login?',
      confirmText: 'Login',
      variant: 'primary'
    });
    if (ok) {
      localStorage.removeItem('studentLoggedIn');
      localStorage.removeItem('studentIsGuest');
      window.location.reload();
    }
  };

  const selectOffice = (officeId) => {
    setSelectedOffice(officeId);
    setSubject('');
  };

  const handleOfficeKeyDown = (e, officeId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectOffice(officeId);
    }
  };

  const openAuthPicker = () => authInputRef.current?.click();
  const openAttachmentPicker = () => attachmentInputRef.current?.click();

  const handleAuthChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const invalidTypeFiles = selectedFiles.filter((f) => !isAllowedFileType(f));
    if (invalidTypeFiles.length > 0) {
      toast.warning('Only PDF, PNG, and JPG files are allowed');
      e.target.value = '';
      return;
    }

    const currentTotalSize = [...authFiles, ...attachmentFiles].reduce((acc, f) => acc + (f.size || 0), 0);
    const newFilesSize = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    if (currentTotalSize + newFilesSize > 10 * 1024 * 1024) {
      toast.warning('Combined upload size exceeds 10MB limit');
      e.target.value = '';
      return;
    }

    setAuthFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = '';
  };

  const handleAttachmentChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const invalidTypeFiles = selectedFiles.filter((f) => !isAllowedFileType(f));
    if (invalidTypeFiles.length > 0) {
      toast.warning('Only PDF, PNG, and JPG files are allowed');
      e.target.value = '';
      return;
    }

    const currentTotalSize = [...authFiles, ...attachmentFiles].reduce((acc, f) => acc + (f.size || 0), 0);
    const newFilesSize = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    if (currentTotalSize + newFilesSize > 10 * 1024 * 1024) {
      toast.warning('Combined upload size exceeds 10MB limit');
      e.target.value = '';
      return;
    }

    setAttachmentFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = '';
  };

  const handleRemoveAuthFile = (indexToRemove, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAuthFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (authInputRef.current) authInputRef.current.value = '';
  };

  const handleRemoveAttachmentFile = (indexToRemove, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAttachmentFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const buildStatusData = (docData, enteredCode) => {
    const status = docData.status || 'Pending';
    const originalOffice = getOriginalOffice(docData);
    const officeName = originalOffice || docData.office || 'Office';
    const isInProcess = status === 'In Process';
    const isResolved = status === 'Resolved';
    const processingActive = isInProcess || isResolved || status === 'Returned' || status === 'For Follow Up';
    const handler = docData.claimedBy || docData.assignedTo || docData.assignedToStaff;

    let statusClass = 'is-pending';
    if (isInProcess) statusClass = 'is-in-process';
    else if (isResolved) statusClass = 'is-resolved';
    else if (status === 'Cancelled') statusClass = 'is-cancelled';
    else if (status === 'Returned' || status === 'For Follow Up') statusClass = 'is-follow-up';

    let estimatedCompletion = 'To be determined';
    const isClaimed = Boolean(handler && status !== 'Pending');

    if (isClaimed) {
      if (docData.etc) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(docData.etc)) {
          const [y, m, d] = docData.etc.split('-').map(Number);
          estimatedCompletion = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } else {
          estimatedCompletion = docData.etc;
        }
      } else if (docData.estimatedCompletion) {
        const d = docData.estimatedCompletion?.toDate ? docData.estimatedCompletion.toDate() : new Date(docData.estimatedCompletion);
        if (!isNaN(d.getTime())) {
          estimatedCompletion = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      } else if (docData.targetCompletionDate) {
        const d = docData.targetCompletionDate?.toDate ? docData.targetCompletionDate.toDate() : new Date(docData.targetCompletionDate);
        if (!isNaN(d.getTime())) {
          estimatedCompletion = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
    }

    let initialHandler = docData.firstClaimedBy || docData.reassignedFromStaff || '';

    // Detect if a takeover occurred
    let takerName = '';
    if (docData.followUps && Array.isArray(docData.followUps)) {
      for (const f of docData.followUps) {
        if (!f || !f.message || typeof f.message !== 'string') continue;
        const msg = f.message.toLowerCase();
        if (msg.includes('claimed and taken over') || msg.includes('taken over by') || f.type === 'takeover') {
          const match = f.message.match(/(?:claimed and taken over by|taken over by)\s+([^.\r\n]+)/i);
          if (match && match[1]) {
            takerName = match[1].trim();
            break;
          } else if (f.sentByName) {
            takerName = f.sentByName.trim();
            break;
          }
        }
      }
    }
    if (!takerName && docData.reassignedToStaff && docData.claimedBy && docData.reassignedToStaff.toLowerCase() === docData.claimedBy.toLowerCase() && docData.pendingTakeover === false) {
      takerName = docData.claimedBy.trim();
    }

    if (initialHandler && takerName && initialHandler.toLowerCase() === takerName.toLowerCase()) {
      initialHandler = '';
    }

    if (!initialHandler && docData.followUps && Array.isArray(docData.followUps)) {
      for (const f of docData.followUps) {
        if (!f || !f.message || typeof f.message !== 'string') continue;
        const match = f.message.match(/(?:reassigned|rerouted) from\s+(.+?)\s+to\s+(.+?)\s+by/i);
        if (match && match[1]) {
          const candidate = match[1].trim();
          if (!takerName || candidate.toLowerCase() !== takerName.toLowerCase()) {
            initialHandler = candidate;
            break;
          }
        }
      }
    }

    if (!initialHandler && docData.reassignedFrom && docData.officeHistory) {
      const candidate = docData.officeHistory[docData.reassignedFrom]?.handledBy || '';
      if (candidate && (!takerName || candidate.toLowerCase() !== takerName.toLowerCase())) {
        initialHandler = candidate;
      }
    }

    if (!initialHandler && !takerName) {
      initialHandler = handler;
    }

    const timeline = [
      {
        status: 'SUBMITTED',
        date: toLong(docData.createdAt),
        description: 'Initial Student Request',
        completed: true,
        active: false
      },
      {
        status: 'PROCESSING',
        completed: processingActive,
        active: isInProcess,
        date: toLong(docData.claimedAt || docData.updatedAt),
        description: processingActive
          ? (initialHandler ? `Being Processed by ${initialHandler}` : 'Being processed by staff')
          : 'Waiting for staff to process'
      }
    ];

    if (docData.followUps && Array.isArray(docData.followUps)) {
      docData.followUps.forEach((f) => {
        if (!f || !f.message || typeof f.message !== 'string') return;
        const msgLower = f.message.toLowerCase();
        if (
          f.type === 'staff_reassignment' ||
          f.reassignType === 'same_office_staff' ||
          msgLower.includes('workload rebalanced') ||
          (msgLower.includes('reassigned from') && (msgLower.includes('super administrator') || docData.workloadRebalanced))
        ) {
          const match = f.message.match(/(?:reassigned from)\s+(.+?)\s+to\s+(.+?)\s+by\s+([^\r\n.]+)/i);
          const fromStaff = f.fromStaff || (match ? match[1].trim() : '') || docData.reassignedFromStaff || 'Staff Member';
          const toStaff = f.toStaff || (match ? match[2].trim() : '') || docData.reassignedToStaff || 'Staff Member';
          const byAdmin = f.by || (match ? match[3].trim() : '') || docData.reassignedBy || 'Super Administrator';
          timeline.push({
            status: 'REASSIGNED',
            completed: true,
            active: false,
            date: toLong(f.sentAt),
            description: `${fromStaff} → ${toStaff} (Reassigned by ${byAdmin})`
          });
        }
      });
    }

    if (docData.reassignedFrom) {
      timeline.push({
        status: 'REROUTED',
        completed: true,
        active: false,
        date: toLong(docData.reassignedAt || docData.updatedAt),
        description: `Transferred from ${docData.reassignedFrom} to ${docData.office}`
      });
    }

    if (docData.followUps && Array.isArray(docData.followUps)) {
      docData.followUps.forEach((f) => {
        if (!f || !f.message || typeof f.message !== 'string') return;
        if (f.message.toLowerCase().includes('claimed and taken over') || f.type === 'takeover') {
          const match = f.message.match(/(?:claimed and taken over by|taken over by)\s+([^.\r\n]+)/i);
          const staffName = (match ? match[1].trim() : '') || f.sentByName || handler || 'Staff Member';
          timeline.push({
            status: 'CLAIMED / TAKEN OVER',
            completed: true,
            active: false,
            date: toLong(f.sentAt),
            description: `Claimed and taken over by ${staffName}`
          });
        }
      });
    }

    if (status === 'Returned' || status === 'For Follow Up') {
      timeline.push({
        status: 'RETURNED/FOR FOLLOW UP',
        completed: true,
        active: true,
        date: toLong(docData.returnedAt || docData.updatedAt),
        description: docData.returnedReason || 'Additional documents required'
      });
    }

    timeline.push({
      status: 'RESOLVED',
      completed: isResolved,
      active: isResolved,
      date: isResolved ? toLong(docData.resolvedAt || docData.updatedAt) : '',
      description: isResolved ? 'Request completed' : ''
    });

    return {
      requestNumber: `#${docData.requestId || ''}`,
      rawRequestId: docData.requestId || '',
      officeName,
      subject: docData.subject || 'Student Inquiry',
      description: docData.description || '',
      studentName: docData.studentName || 'Guest Student',
      parentGuardianName: docData.parentGuardianName || '',
      resolutionNote: docData.resolutionNote || '',
      resolvedBy: docData.resolvedBy || '',
      resolvedAt: docData.resolvedAt || null,
      grade: docData.grade || '',
      section: docData.section || '',
      handler: handler || '',
      status,
      statusClass,
      dateCreated: toShort(docData.createdAt),
      fullDateCreated: toLong(docData.createdAt),
      estimatedCompletion,
      timeline,
      followUps: docData.followUps || [],
      attachments: docData.attachments || [],
      office: docData.office || officeName,
      officeHistory: docData.officeHistory || {},
      reassignedFrom: docData.reassignedFrom || '',
      reassignedAt: docData.reassignedAt || null,
      previousOffice: docData.previousOffice || '',
      reassignedBy: docData.reassignedBy || '',
      firstClaimedBy: docData.firstClaimedBy || ''
    };
  };

  const trackRequest = async (reqId) => {
    setTrackingLoading(true);
    setTrackNotFound(false);
    setTrackError('');
    setView('status');
    try {
      const cleanId = String(reqId || '').replace(/[#\s]/g, '').toUpperCase();
      if (!cleanId) {
        setStatusData(null);
        setTrackNotFound(true);
        return;
      }
      let snapshot = await getDocs(query(collection(db, 'requests'), where('requestId', '==', cleanId), limit(1)));
      if (snapshot.empty) {
        snapshot = await getDocs(query(collection(db, 'requests'), where('previousRequestId', '==', cleanId), limit(1)));
      }
      if (snapshot.empty) {
        setStatusData(null);
        setTrackNotFound(true);
      } else {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        const resolvedOriginal = await resolveOriginalHandler(db, docSnap.id, data);
        if (resolvedOriginal) {
          data.firstClaimedBy = resolvedOriginal;
          data.reassignedFromStaff = resolvedOriginal;
        }
        setStatusData(buildStatusData(data));
      }
    } catch (error) {
      console.error('Error tracking request:', error);
      setStatusData(null);
      setTrackError('We could not check the request status right now. Please try again.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleBrowseConfirm = () => {
    if (requestId.trim()) {
      trackRequest(requestId);
    }
  };

  const openStatus = () => {
    if (statusData) {
      setView('status');
      return;
    }
    if (submissionData) {
      trackRequest(submissionData.rawRequestId || submissionData.requestNumber);
      return;
    }
    if (requestId.trim()) {
      trackRequest(requestId);
      return;
    }
    setView('check');
  };

  const goHome = () => setView('options');

  const handleSubmitRequest = async () => {
    if (!canSubmit || submitting) return;

    try {
      setSubmitting(true);
      const office = guestOffices.find((o) => o.id === selectedOffice);
      const officeName = office ? office.name : 'Accounting';
      let prefix = officeName.substring(0, 3).toUpperCase();
      if (prefix === 'FIN' || officeName.toLowerCase().includes('accounting')) {
        prefix = 'ACC';
      }
      const generatedRequestId = `${prefix}-${random3()}-${random3()}-${random3()}`;

      // Encode attachments with smart compression for images
      const attachments = [];
      const now = Date.now();
      
      for (const file of authFiles) {
        let fileData;
        
        // Compress images, keep other files as-is
        const isAuthImage = file.type?.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name);
        if (isAuthImage) {
          console.log('🖼️ Compressing auth image:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          fileData = await compressImage(file);
          console.log(`✅ Compressed to ${(fileData.length / 1024).toFixed(0)} KB`);
        } else {
          fileData = await fileToBase64(file);
        }
        
        attachments.push({
          name: file.name || 'auth-file',
          data: fileData || '',
          size: file.size || 0,
          type: file.type || (isAuthImage ? 'image/jpeg' : 'application/pdf'),
          isAuthProof: true,
          uploadedAt: now
        });
      }
      
      for (const file of attachmentFiles) {
        let fileData;
        
        // Compress images, keep other files as-is
        const isAttImage = file.type?.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name);
        if (isAttImage) {
          console.log('🖼️ Compressing attachment image:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
          fileData = await compressImage(file);
          console.log(`✅ Compressed to ${(fileData.length / 1024).toFixed(0)} KB`);
        } else {
          fileData = await fileToBase64(file);
        }
        
        attachments.push({
          name: file.name || 'attachment',
          data: fileData || '',
          size: file.size || 0,
          type: file.type || (isAttImage ? 'image/jpeg' : 'application/pdf'),
          uploadedAt: now
        });
      }

      const fullParentGuardianName = `${parentFirstName.trim()} ${parentLastName.trim()}`.trim();
      const newRequestDoc = {
        requestId: generatedRequestId,
        studentName: `${firstName.trim()} ${lastName.trim()}`,
        parentGuardianName: fullParentGuardianName,
        parentFirstName: parentFirstName.trim(),
        parentLastName: parentLastName.trim(),
        studentUid: `guest_${Date.now()}`,
        grade: grade.trim(),
        section: section.trim(),
        isGuest: true,
        subject: subject.trim(),
        description: description.trim(),
        office: officeName,
        officeId: selectedOffice,
        originalOffice: officeName,
        originalOfficeId: selectedOffice,
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        attachments: attachments,
        followUps: []
      };

      console.log('[Debug] Request data before save:', JSON.stringify(newRequestDoc, null, 2));
      await addDoc(collection(db, 'requests'), newRequestDoc);

      // Notify office staff in background
      await notifyStaffNewRequest(
        officeName,
        generatedRequestId,
        subject.trim(),
        `${firstName.trim()} ${lastName.trim()} (Guest)`
      );

      const created = new Date();
      const submissionInfo = {
        requestNumber: `#${generatedRequestId}`,
        rawRequestId: generatedRequestId,
        officeName,
        subject: subject.trim(),
        description: description.trim(),
        studentName: `${firstName.trim()} ${lastName.trim()}`,
        parentGuardianName: fullParentGuardianName,
        dateCreated: formatShortDate(created),
        estimatedCompletion: 'To be determined'
      };

      setSubmissionData(submissionInfo);
      setView('submitted');
    } catch (error) {
      console.error('[Error] Error submitting guest request:', error);
      toast.error('Failed to submit request: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetGuestForm = () => {
    setFirstName('');
    setLastName('');
    setParentFirstName('');
    setParentLastName('');
    setGrade('');
    setSection('');
    setSelectedOffice('finance');
    setSubject('');
    setDescription('');
    setAttachmentFiles([]);
    setAuthFiles([]);
    setIsAuthDragging(false);
    setIsAttachmentDragging(false);
    setShowProofGuide(false);
    setView('options');
  };

  const canBrowse = requestId.trim() !== '';
  const canSubmit =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    parentFirstName.trim() !== '' &&
    parentLastName.trim() !== '' &&
    grade.trim() !== '' &&
    section.trim() !== '' &&
    !!selectedOffice &&
    subject.trim() !== '' &&
    description.trim() !== '' &&
    authFiles.length > 0 &&
    !isValidating &&
    validationResult &&
    validationResult.isValid &&
    validationResult.errors.length === 0;

  return (
    <div className="guest-login-container">
      {/* Top Header */}
      <header className="guest-header">
        <div className="guest-header-content">
          <img 
            src="/logo.jpg" 
            alt="Academia De San Jose" 
            className="guest-logo" 
            onError={(e) => { 
              if (!e.currentTarget.src.includes('school-logo.jpg')) {
                e.currentTarget.src = '/school-logo.jpg';
              }
            }} 
          />
          <h1 className="guest-school-name">Academia De San Jose</h1>
        </div>
        <div className="guest-header-right">
          <div className="guest-account-badge">
            <span>Guest Portal</span>
            <FaUserCircle className="guest-icon" />
          </div>
          <button 
            type="button" 
            className="guest-exit-btn" 
            onClick={handleExitGuestMode}
            title="Exit guest mode and return to student login"
          >
            <FaSignInAlt className="guest-login-icon" /> Login
          </button>
        </div>
      </header>

      <main className="guest-content">
        {view !== 'options' && (
          <nav className="guest-top-nav" aria-label="Guest navigation">
            <button type="button" className="guest-nav-link" onClick={goHome}>
              <FaArrowLeft style={{ fontSize: '13px' }} /> Back to Options
            </button>
            <div className="guest-nav-right-links">
              <button
                type="button"
                className={`guest-nav-link ${view === 'check' || view === 'status' ? 'active' : ''}`}
                onClick={() => setView('check')}
              >
                <MdTrackChanges /> Check Request Status
              </button>
              <button
                type="button"
                className={`guest-nav-link ${view === 'new' || view === 'submitted' ? 'active' : ''}`}
                onClick={() => setView('new')}
              >
                <MdPostAdd /> Submit New Request
              </button>
            </div>
          </nav>
        )}

        {view === 'status' ? (
          <GuestRequestStatus
            data={statusData}
            loading={trackingLoading}
            notFound={trackNotFound}
            error={trackError}
            onHome={goHome}
          />
        ) : view === 'submitted' ? (
          <GuestSubmitted 
            data={submissionData} 
            onHome={resetGuestForm} 
            onTrack={() => trackRequest(submissionData.rawRequestId)}
          />
        ) : view === 'check' ? (
          <section className="guest-section">
            <h2 className="section-title-guest">Check Request Status</h2>
            <p className="section-subtitle-guest">Track the live progress of an existing request using your Request ID.</p>

            <div className="form-group-guest">
              <label className="form-label-guest" htmlFor="guestRequestId">Enter Request ID <span className="required-star">*</span></label>
              <input
                id="guestRequestId"
                type="text"
                className="form-input-guest"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                placeholder="e.g. #ACC-100-010-001 or ACC-100-010-001"
              />
            </div>

            <div className="form-actions-guest">
              <button 
                type="button" 
                className="cancel-btn-guest" 
                onClick={() => setRequestId('')}
              >
                Clear
              </button>
              <button
                type="button"
                className="confirm-btn-guest"
                onClick={handleBrowseConfirm}
                disabled={!canBrowse || trackingLoading}
              >
                {trackingLoading ? 'Checking...' : 'Check Status'}
              </button>
            </div>
          </section>
        ) : view === 'new' ? (
          <section className="guest-section">
            <h2 className="section-title-guest">Submit New Request</h2>
            <p className="section-subtitle-guest">Submit an inquiry or document request directly to any school department.</p>

              <div className="form-section-guest">
                <h3 className="guest-subheading">1. Student Information</h3>
                <div className="field-grid">
                  <div className="form-group-guest full-width">
                    <label className="form-label-guest">
                      Student Name <span className="required-star">*</span>
                    </label>
                    <div className="student-name-grid">
                      <input
                        id="guestFirstName"
                        type="text"
                        className="form-input-guest"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter Student First Name"
                        aria-label="Student First Name"
                      />
                      <input
                        id="guestLastName"
                        type="text"
                        className="form-input-guest"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter Student Last Name"
                        aria-label="Student Last Name"
                      />
                    </div>
                  </div>
                  <div className="form-group-guest full-width">
                    <label className="form-label-guest">
                      Grade and Section <span className="required-star">*</span>
                    </label>
                    <div className="grade-section-grid">
                      <select
                        id="guestGrade"
                        className="form-select-guest"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        required
                        aria-label="Grade Level"
                      >
                        <option value="" disabled hidden style={{ display: 'none' }}>Select grade level</option>
                        <option value="Grade 7">Grade 7</option>
                        <option value="Grade 8">Grade 8</option>
                        <option value="Grade 9">Grade 9</option>
                        <option value="Grade 10">Grade 10</option>
                        <option value="Grade 11">Grade 11</option>
                        <option value="Grade 12">Grade 12</option>
                      </select>
                      <select
                        id="guestSection"
                        className="form-select-guest"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        required
                        aria-label="Section"
                      >
                        <option value="" disabled hidden style={{ display: 'none' }}>Select section</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group-guest full-width">
                    <label className="form-label-guest">
                      Parent or Guardian Name <span className="required-star">*</span>
                    </label>
                    <div className="parent-name-grid">
                      <input
                        id="guestParentFirstName"
                        type="text"
                        className="form-input-guest"
                        value={parentFirstName}
                        onChange={(e) => setParentFirstName(e.target.value)}
                        placeholder="Enter First Name"
                        aria-label="Parent or Guardian First Name"
                      />
                      <input
                        id="guestParentLastName"
                        type="text"
                        className="form-input-guest"
                        value={parentLastName}
                        onChange={(e) => setParentLastName(e.target.value)}
                        placeholder="Enter Last name"
                        aria-label="Parent or Guardian Last Name"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section-guest">
                <h3 className="guest-subheading">2. Select Target Office</h3>
                <div className="office-grid" role="radiogroup" aria-label="Select Office">
                  {guestOffices.map((office) => (
                    <div
                      key={office.id}
                      role="radio"
                      aria-checked={selectedOffice === office.id}
                      tabIndex={selectedOffice === office.id ? 0 : -1}
                      className={`office-card-guest ${selectedOffice === office.id ? 'selected' : ''}`}
                      onClick={() => selectOffice(office.id)}
                      onKeyDown={(e) => handleOfficeKeyDown(e, office.id)}
                    >
                      <div className="office-radio">
                        {selectedOffice === office.id && <div className="radio-dot"></div>}
                      </div>
                      <div className="office-info">
                        <div className="office-header-row">
                          <h4 className="office-name">{office.name}</h4>
                        </div>
                        <p className="office-description">{office.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-section-guest">
                <h3 className="guest-subheading">3. Request Details</h3>

                <div className="form-group-guest">
                  <label className="form-label-guest" htmlFor="guestSubject">Subject <span className="required-star">*</span></label>
                  <select
                    id="guestSubject"
                    className="form-select-guest"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={!selectedOffice}
                  >
                    <option value="" disabled hidden style={{ display: 'none' }}>
                      {selectedOffice ? 'Select a subject...' : 'Please select an office first'}
                    </option>
                    {selectedOffice && guestOffices.find(o => o.id === selectedOffice)?.subjects.map((subj, index) => (
                      <option key={index} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-guest">
                  <label className="form-label-guest" htmlFor="guestDescription">
                    Detailed Description <span className="required-star">*</span>
                    {isValidating && <span className="validation-checking"> (Checking...)</span>}
                    {!isValidating && validationResult && validationResult.isValid && validationResult.errors.length === 0 && (
                      <span className="validation-success">
                        <MdCheckCircle /> Valid
                      </span>
                    )}
                  </label>
                  <textarea
                    id="guestDescription"
                    className={`form-textarea-guest ${
                      validationResult && validationResult.errors.length > 0 ? 'has-error' : 
                      validationResult && validationResult.warnings.length > 0 ? 'has-warning' : ''
                    }`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide a detailed explanation of your request or inquiry..."
                    rows="5"
                  />
                  {/* Validation Feedback */}
                  {validationResult && validationResult.errors.length > 0 && (
                    <div className="validation-errors">
                      {validationResult.errors.map((error, idx) => (
                        <div key={idx} className="validation-message error-message">
                          <MdError /> {error}
                        </div>
                      ))}
                    </div>
                  )}
                  {validationResult && validationResult.warnings.length > 0 && (
                    <div className="validation-warnings">
                      {validationResult.warnings.map((warning, idx) => (
                        <div key={idx} className="validation-message warning-message">
                          <MdWarning /> {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section-guest">
                <h3 className="guest-subheading">4. Attachments</h3>

                <div className="form-group-guest">
                  <div className="auth-proof-header-row">
                    <label className="form-label-guest" htmlFor="authProofUpload">
                      Authorization / Identification Proof <span className="required-star">*</span>
                    </label>
                    <button
                      type="button"
                      className="auth-proof-guide-pill"
                      onClick={() => setShowProofGuide((prev) => !prev)}
                      aria-expanded={showProofGuide}
                    >
                      <FaInfoCircle className="pill-icon" />
                      <span>{showProofGuide ? 'Hide Requirements' : 'What should I upload?'}</span>
                    </button>
                  </div>

                  {showProofGuide && (
                    <div className="auth-proof-guide-card" role="region" aria-label="Required Identification Guidelines">
                      <div className="guide-card-header">
                        <div className="guide-card-title-group">
                          <span className="guide-card-icon"><FaIdCard /></span>
                          <h4 className="guide-card-title">Required ID &amp; Authorization Proof Guidelines</h4>
                        </div>
                        <button
                          type="button"
                          className="guide-card-close-btn"
                          onClick={() => setShowProofGuide(false)}
                          aria-label="Close guide"
                        >
                          <FaTimes />
                        </button>
                      </div>
                      <p className="guide-card-intro">
                        To protect student privacy and ensure verified processing, please upload clear photos or scanned copies (front &amp; back) according to your category:
                      </p>

                      <div className="guide-category-list">
                        <div className="guide-category-item">
                          <div className="guide-category-badge badge-minor">
                            <span>1. Minor Student (Under 18)</span>
                          </div>
                          <p className="guide-category-subtitle">Parent or Legal Guardian must attach:</p>
                          <ul className="guide-doc-list">
                            <li><strong>Student's School ID</strong> (or Certificate of Enrollment / Registration / Form 138 if ID not yet issued)</li>
                            <li><strong>Parent / Guardian's Valid Government-issued ID</strong> (e.g., PhilSys National ID, Driver's License, Passport, UMID, Postal ID, PRC, Voter's ID)</li>
                          </ul>
                        </div>

                        <div className="guide-category-item">
                          <div className="guide-category-badge badge-legal-age">
                            <span>2. Student of Legal Age (18 and above)</span>
                          </div>
                          <p className="guide-category-subtitle">Required documents by submitter:</p>
                          <ul className="guide-doc-list">
                            <li><strong>If represented by Parent or Relative:</strong> Letter of Authorization signed by the student + Student's School/Gov ID + Representative's Valid Government ID</li>
                            <li><strong>If student is requesting directly:</strong> Student's Valid School ID or Government-issued ID</li>
                          </ul>
                        </div>

                        <div className="guide-category-item">
                          <div className="guide-category-badge badge-teacher">
                            <span>3. Teacher / School Staff / Faculty</span>
                          </div>
                          <ul className="guide-doc-list">
                            <li><strong>Valid School Faculty / Employee ID</strong> (or Certificate of Employment)</li>
                          </ul>
                        </div>

                        <div className="guide-category-item">
                          <div className="guide-category-badge badge-alumni">
                            <span>4. Alumni / Former Student</span>
                          </div>
                          <ul className="guide-doc-list">
                            <li><strong>Alumni ID or previous School ID</strong>, or any <strong>Valid Government-issued ID</strong></li>
                            <li><em>Helpful addition:</em> Graduation batch year or copy of Diploma / Transcript of Records (TOR) for prompt verification</li>
                          </ul>
                        </div>

                        <div className="guide-category-item guide-special-cases">
                          <div className="guide-category-badge badge-special">
                            <span>💡 Additional Proof Alternatives &amp; Tips</span>
                          </div>
                          <ul className="guide-doc-list">
                            <li><strong>Lost School ID:</strong> Attach a Certificate of Registration (COR), School Admission Slip, or an Affidavit of Loss.</li>
                            <li><strong>Legal Guardian (non-parent):</strong> Attach a Barangay Certificate of Guardianship or Special Power of Attorney (SPA).</li>
                            <li><strong>Multiple Files Supported:</strong> You can upload multiple files (photos/PDFs) up to 10MB combined total. Attach both front &amp; back of IDs or authorization letters directly.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className={`upload-box-auth ${authFiles.length > 0 ? 'has-file' : ''} ${isAuthDragging ? 'is-drag-over' : ''}`}
                    id="authProofUpload"
                    role="button"
                    tabIndex={0}
                    onClick={openAuthPicker}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAuthDragging(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAuthDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAuthDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAuthDragging(false);
                      if (e.dataTransfer?.files) {
                        handleAuthChange({ target: { files: e.dataTransfer.files } });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openAuthPicker();
                      }
                    }}
                  >
                    {authFiles.length === 0 && <span className="required-badge">Required</span>}
                    {authFiles.length > 0 ? (
                      <div className="guest-attached-files-container">
                        <div className="guest-files-summary">
                          <span>Attached Documents ({authFiles.length})</span>
                          <span>{formatFileSize(authFiles.reduce((s, f) => s + (f.size || 0), 0))}</span>
                        </div>
                        <div className="guest-attached-files-list">
                          {authFiles.map((file, idx) => (
                            <div key={`${file.name}-${idx}`} className="guest-attached-file">
                              <FaFileAlt className="guest-file-icon" />
                              <div className="guest-file-meta">
                                <span className="guest-file-name">{file.name}</span>
                                <span className="guest-file-size">{formatFileSize(file.size)}</span>
                              </div>
                              <button
                                type="button"
                                className="guest-file-remove"
                                aria-label={`Remove ${file.name}`}
                                onClick={(e) => handleRemoveAuthFile(idx, e)}
                              >
                                <FaTimes />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="guest-add-more-hint">
                          <FaPlus className="add-more-icon" />
                          <span>Click to add more authorization files</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FaFileUpload className="upload-icon-large upload-icon-green" />
                        <p className="upload-text-main">Click to upload student ID or authorization document</p>
                        <p className="upload-text-sub">PDF, PNG, or JPG (Max 10MB combined total, multiple files allowed)</p>
                      </>
                    )}
                    <input
                      ref={authInputRef}
                      type="file"
                      multiple
                      className="file-input-hidden"
                      onChange={handleAuthChange}
                      accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                      aria-label="Upload authorization proof (required)"
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                </div>

                <div className="form-group-guest">
                  <label className="form-label-guest" htmlFor="optionalUpload">
                    Additional Supporting File <span className="optional-guest">(Optional)</span>
                  </label>
                  <div
                    className={`upload-box-dashed ${attachmentFiles.length > 0 ? 'has-file' : ''} ${isAttachmentDragging ? 'is-drag-over' : ''}`}
                    id="optionalUpload"
                    role="button"
                    tabIndex={0}
                    onClick={openAttachmentPicker}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAttachmentDragging(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAttachmentDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAttachmentDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsAttachmentDragging(false);
                      if (e.dataTransfer?.files) {
                        handleAttachmentChange({ target: { files: e.dataTransfer.files } });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openAttachmentPicker();
                      }
                    }}
                  >
                    {attachmentFiles.length > 0 ? (
                      <div className="guest-attached-files-container">
                        <div className="guest-files-summary">
                          <span>Attached Supporting Documents ({attachmentFiles.length})</span>
                          <span>{formatFileSize(attachmentFiles.reduce((s, f) => s + (f.size || 0), 0))}</span>
                        </div>
                        <div className="guest-attached-files-list">
                          {attachmentFiles.map((file, idx) => (
                            <div key={`${file.name}-${idx}`} className="guest-attached-file">
                              <FaFileAlt className="guest-file-icon" />
                              <div className="guest-file-meta">
                                <span className="guest-file-name">{file.name}</span>
                                <span className="guest-file-size">{formatFileSize(file.size)}</span>
                              </div>
                              <button
                                type="button"
                                className="guest-file-remove"
                                aria-label={`Remove ${file.name}`}
                                onClick={(e) => handleRemoveAttachmentFile(idx, e)}
                              >
                                <FaTimes />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="guest-add-more-hint">
                          <FaPlus className="add-more-icon" />
                          <span>Click to add more supporting files</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FaFileUpload className="upload-icon-large" />
                        <p className="upload-text-main">Click to attach supporting receipt or document</p>
                        <p className="upload-text-sub">PDF, PNG, or JPG (Max 10MB combined total, multiple files allowed)</p>
                      </>
                    )}
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      className="file-input-hidden"
                      onChange={handleAttachmentChange}
                      accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
                      aria-label="Attach an optional file"
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions-guest">
                <button 
                  type="button" 
                  className="cancel-btn-guest" 
                  onClick={resetGuestForm}
                >
                  Reset
                </button>
                <button 
                  type="button" 
                  className="submit-btn-guest" 
                  onClick={handleSubmitRequest} 
                  disabled={!canSubmit || submitting}
                >
                  {submitting && <span className="btn-spinner" />}
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </section>
        ) : (
          <div className="guest-options-container">
            <div className="guest-options-hero">
              <span className="guest-options-badge">Guest Portal</span>
              <h2 className="guest-options-title">How can we assist you today?</h2>
              <p className="guest-options-subtitle">
                Please select an option below to check the status of your existing ticket or submit a new inquiry to school offices.
              </p>
            </div>

            <div className="guest-options-grid">
              <div 
                className="guest-option-card"
                onClick={() => setView('check')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setView('check');
                  }
                }}
              >
                <div className="guest-option-icon-wrapper track-icon-bg">
                  <MdTrackChanges className="guest-option-icon" />
                </div>
                <div className="guest-option-content">
                  <h3 className="guest-option-name">Check Request Status</h3>
                  <p className="guest-option-desc">
                    Already submitted a request? Enter your Request ID to track live updates, responsible offices, and staff actions.
                  </p>
                </div>
                <div className="guest-option-action">
                  <span>Track Status</span>
                  <FaArrowRight className="guest-option-arrow" />
                </div>
              </div>

              <div 
                className="guest-option-card"
                onClick={() => setView('new')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setView('new');
                  }
                }}
              >
                <div className="guest-option-icon-wrapper submit-icon-bg">
                  <MdPostAdd className="guest-option-icon" />
                </div>
                <div className="guest-option-content">
                  <h3 className="guest-option-name">Submit New Request</h3>
                  <p className="guest-option-desc">
                    Send a new request or inquiry directly to Accounting, Library, Registrar, or Guidance Office.
                  </p>
                </div>
                <div className="guest-option-action">
                  <span>Create Request</span>
                  <FaArrowRight className="guest-option-arrow" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GuestLogin;