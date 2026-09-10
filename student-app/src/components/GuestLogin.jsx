import React, { useState, useRef, useEffect } from 'react';
import { FaFileUpload, FaUserCircle, FaFileAlt, FaTimes, FaSignOutAlt } from 'react-icons/fa';
import { MdHome, MdTrackChanges, MdCheckCircle, MdWarning, MdError } from 'react-icons/md';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { notifyStaffNewRequest } from '../utils/notificationHelper';
import { validateContent } from '../utils/contentModeration';
import GuestSubmitted from './GuestSubmitted';
import GuestRequestStatus from './GuestRequestStatus';
import LoadingSpinner from './LoadingSpinner';
import '../styles/GuestLogin.css';

// Smart image compression to stay under Firestore 1 MB document limit
const MAX_IMAGE_DIMENSION = 1280;
const MAX_BASE64_LENGTH = 900 * 1024 * 1.37; // ~0.9 MiB raw -> base64 ceiling

const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the image file.'));
  reader.onload = (evt) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Invalid image format.'));
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
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
        
        resolve(dataUrl);
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
    name: 'Finance',
    code: 'FIN-001',
    description: 'Manages tuition payments, student balances, billing concerns, and other school-related financial transactions.',
    subjects: ['Balance Verification', 'Payment Plan', 'Refund Request', 'Billing Inquiry']
  },
  {
    id: 'library',
    name: 'Library',
    code: 'LIB-001',
    description: 'Manages book borrowing/returning, library accounts, and student concerns related to library services and resources.',
    subjects: ['Book Request', 'Lost Book Report', 'Library Card Issue', 'Resource Access']
  },
  {
    id: 'registrar',
    name: 'Registrar',
    code: 'REG-001',
    description: 'Handles student records such as enrollment, grades, certificates, transcripts, and other official academic documents.',
    subjects: ['Document Request', 'Grade Inquiry', 'Enrollment Issue', 'Transcript Request']
  },
  {
    id: 'guidance',
    name: 'Guidance',
    code: 'GUI-001',
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
  const [view, setView] = useState('home'); // 'home' | 'status' | 'submitted'
  const [requestId, setRequestId] = useState('');
  const [officeCode, setOfficeCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('finance');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [authFile, setAuthFile] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
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

  const handleExitGuestMode = () => {
    if (window.confirm('Exit Guest Mode and return to Student Login?')) {
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
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      alert('Authorization file exceeds 5MB limit');
      e.target.value = '';
      return;
    }
    setAuthFile(file || null);
    e.target.value = '';
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      alert('Attachment file exceeds 5MB limit');
      e.target.value = '';
      return;
    }
    setAttachmentFile(file || null);
    e.target.value = '';
  };

  const handleRemoveAuthFile = (e) => {
    e.stopPropagation();
    setAuthFile(null);
    if (authInputRef.current) authInputRef.current.value = '';
  };

  const handleRemoveAttachmentFile = (e) => {
    e.stopPropagation();
    setAttachmentFile(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const buildStatusData = (docData, enteredCode) => {
    const status = docData.status || 'Pending';
    const officeName = docData.office || 'Office';
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
    if (docData.etc) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(docData.etc)) {
        const [y, m, d] = docData.etc.split('-').map(Number);
        estimatedCompletion = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } else {
        estimatedCompletion = docData.etc;
      }
    } else if (docData.createdAt) {
      const createdDate = toDate(docData.createdAt);
      if (createdDate) {
        const est = new Date(createdDate);
        est.setDate(est.getDate() + 2);
        estimatedCompletion = formatShortDate(est);
      }
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
          ? (handler ? `Being Processed by ${handler}` : 'Being processed by staff')
          : 'Waiting for staff to process'
      }
    ];

    if (docData.reassignedFrom) {
      timeline.push({
        status: 'REASSIGNED',
        completed: true,
        active: false,
        date: toLong(docData.reassignedAt || docData.updatedAt),
        description: `Transferred from ${docData.reassignedFrom} to ${docData.office}`
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
      officeCode: docData.officeCode || String(enteredCode || '').replace(/[#\s]/g, '') || `${docData.office?.substring(0, 3).toUpperCase()}-001`,
      officeName,
      subject: docData.subject || 'Student Inquiry',
      description: docData.description || '',
      studentName: docData.studentName || 'Guest Student',
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
      attachments: docData.attachments || []
    };
  };

  const trackRequest = async (reqId, code) => {
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
      const q = query(collection(db, 'requests'), where('requestId', '==', cleanId), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setStatusData(null);
        setTrackNotFound(true);
      } else {
        setStatusData(buildStatusData(snapshot.docs[0].data(), code));
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
      trackRequest(requestId, officeCode);
    }
  };

  const openStatus = () => {
    if (statusData) {
      setView('status');
      return;
    }
    if (submissionData) {
      trackRequest(submissionData.requestNumber, submissionData.officeCode);
      return;
    }
    if (requestId.trim()) {
      trackRequest(requestId, officeCode);
      return;
    }
    setView('status');
  };

  const goHome = () => setView('home');

  const handleSubmitRequest = async () => {
    if (!canSubmit || submitting) return;

    try {
      setSubmitting(true);
      const office = guestOffices.find((o) => o.id === selectedOffice);
      const officeName = office ? office.name : 'Finance';
      const officeCodeVal = office ? office.code : 'FIN-001';
      const prefix = officeName.substring(0, 3).toUpperCase();
      const generatedRequestId = `${prefix}-${random3()}-${random3()}-${random3()}`;

      // Encode attachments with smart compression for images
      const attachments = [];
      const now = Date.now();
      
      if (authFile) {
        let fileData;
        
        // Compress images, keep other files as-is
        if (authFile.type.startsWith('image/')) {
          console.log('🖼️ Compressing auth image:', authFile.name, `(${(authFile.size / 1024 / 1024).toFixed(2)} MB)`);
          fileData = await compressImage(authFile);
          console.log(`✅ Compressed to ${(fileData.length / 1024).toFixed(0)} KB`);
        } else {
          fileData = await fileToBase64(authFile);
        }
        
        attachments.push({
          name: authFile.name || 'auth-file',
          data: fileData || '',
          size: authFile.size || 0,
          type: authFile.type || 'application/octet-stream',
          isAuthProof: true,
          uploadedAt: now
        });
      }
      
      if (attachmentFile) {
        let fileData;
        
        // Compress images, keep other files as-is
        if (attachmentFile.type.startsWith('image/')) {
          console.log('🖼️ Compressing attachment image:', attachmentFile.name, `(${(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)`);
          fileData = await compressImage(attachmentFile);
          console.log(`✅ Compressed to ${(fileData.length / 1024).toFixed(0)} KB`);
        } else {
          fileData = await fileToBase64(attachmentFile);
        }
        
        attachments.push({
          name: attachmentFile.name || 'attachment',
          data: fileData || '',
          size: attachmentFile.size || 0,
          type: attachmentFile.type || 'application/octet-stream',
          uploadedAt: now
        });
      }

      const newRequestDoc = {
        requestId: generatedRequestId,
        studentName: `${firstName.trim()} ${lastName.trim()}`,
        studentUid: `guest_${Date.now()}`,
        grade: grade.trim(),
        section: section.trim(),
        isGuest: true,
        subject: subject.trim(),
        description: description.trim(),
        office: officeName,
        officeCode: officeCodeVal,
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
        officeCode: officeCodeVal,
        officeName,
        subject: subject.trim(),
        description: description.trim(),
        dateCreated: formatShortDate(created),
        estimatedCompletion: formatShortDate(addDays(created, 2))
      };

      setSubmissionData(submissionInfo);
      setView('submitted');
    } catch (error) {
      console.error('[Error] Error submitting guest request:', error);
      alert('Failed to submit request: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetGuestForm = () => {
    setFirstName('');
    setLastName('');
    setGrade('');
    setSection('');
    setSelectedOffice('finance');
    setSubject('');
    setDescription('');
    setAttachmentFile(null);
    setAuthFile(null);
    setView('home');
  };

  const canBrowse = requestId.trim() !== '';
  const canSubmit =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    grade.trim() !== '' &&
    section.trim() !== '' &&
    !!selectedOffice &&
    subject.trim() !== '' &&
    description.trim() !== '' &&
    authFile !== null &&
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
            <FaSignOutAlt /> Back to Login
          </button>
        </div>
      </header>

      <main className="guest-content">
        {view !== 'home' && (
          <nav className="guest-top-nav" aria-label="Guest navigation">
            <button type="button" className="guest-nav-link" onClick={goHome}>
              <MdHome /> Guest Home
            </button>
            <button
              type="button"
              className={`guest-nav-link ${view === 'status' ? 'active' : ''}`}
              onClick={openStatus}
            >
              <MdTrackChanges /> Track Request Status
            </button>
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
            onTrack={() => trackRequest(submissionData.rawRequestId, submissionData.officeCode)}
          />
        ) : (
          <>
            {/* Section 1: Track existing request */}
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
                  placeholder="e.g. #FIN-100-010-001 or FIN-100-010-001"
                />
              </div>

              <div className="form-group-guest">
                <label className="form-label-guest" htmlFor="guestOfficeCode">Office Code <span className="optional-guest">(Optional)</span></label>
                <select
                  id="guestOfficeCode"
                  className="form-select-guest"
                  value={officeCode}
                  onChange={(e) => setOfficeCode(e.target.value)}
                >
                  <option value="">Select office code (optional)</option>
                  {guestOffices.map((office) => (
                    <option key={office.id} value={office.code}>
                      {office.code} - {office.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-actions-guest">
                <button 
                  type="button" 
                  className="cancel-btn-guest" 
                  onClick={() => { setRequestId(''); setOfficeCode(''); }}
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

            {/* Section 2: Submit New Guest Request */}
            <section className="guest-section">
              <h2 className="section-title-guest">Submit New Request</h2>
              <p className="section-subtitle-guest">Submit an inquiry or document request directly to any school department.</p>

              <div className="form-section-guest">
                <h3 className="guest-subheading">1. Personal Information</h3>
                <div className="field-grid">
                  <div className="form-group-guest">
                    <label className="form-label-guest" htmlFor="guestFirstName">First Name <span className="required-star">*</span></label>
                    <input
                      id="guestFirstName"
                      type="text"
                      className="form-input-guest"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="form-group-guest">
                    <label className="form-label-guest" htmlFor="guestLastName">Last Name <span className="required-star">*</span></label>
                    <input
                      id="guestLastName"
                      type="text"
                      className="form-input-guest"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter last name"
                    />
                  </div>
                  <div className="form-group-guest">
                    <label className="form-label-guest" htmlFor="guestGrade">Grade Level <span className="required-star">*</span></label>
                    <input
                      id="guestGrade"
                      type="text"
                      className="form-input-guest"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g. Grade 11"
                    />
                  </div>
                  <div className="form-group-guest">
                    <label className="form-label-guest" htmlFor="guestSection">Section <span className="required-star">*</span></label>
                    <input
                      id="guestSection"
                      type="text"
                      className="form-input-guest"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. St. Augustine"
                    />
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
                          <span className="office-code-badge">{office.code}</span>
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
                    <option value="">
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
                  <label className="form-label-guest" htmlFor="authProofUpload">
                    Authorization / Identification Proof <span className="required-badge">Required</span>
                  </label>
                  <div
                    className={`upload-box-auth ${authFile ? 'has-file' : ''}`}
                    id="authProofUpload"
                    role="button"
                    tabIndex={0}
                    onClick={openAuthPicker}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openAuthPicker();
                      }
                    }}
                  >
                    {authFile ? (
                      <div className="guest-attached-file">
                        <FaFileAlt className="guest-file-icon" />
                        <div className="guest-file-meta">
                          <span className="guest-file-name">{authFile.name}</span>
                          <span className="guest-file-size">{formatFileSize(authFile.size)}</span>
                        </div>
                        <button
                          type="button"
                          className="guest-file-remove"
                          aria-label="Remove authorization proof"
                          onClick={handleRemoveAuthFile}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FaFileUpload className="upload-icon-large upload-icon-green" />
                        <p className="upload-text-main">Click to upload student ID or authorization document</p>
                        <p className="upload-text-sub">PDF, PNG, JPG, or DOC (Max 5MB)</p>
                      </>
                    )}
                    <input
                      ref={authInputRef}
                      type="file"
                      className="file-input-hidden"
                      onChange={handleAuthChange}
                      accept=".pdf,.doc,.docx,.jpg,.png,.jpeg"
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
                    className={`upload-box-dashed ${attachmentFile ? 'has-file' : ''}`}
                    id="optionalUpload"
                    role="button"
                    tabIndex={0}
                    onClick={openAttachmentPicker}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openAttachmentPicker();
                      }
                    }}
                  >
                    {attachmentFile ? (
                      <div className="guest-attached-file">
                        <FaFileAlt className="guest-file-icon" />
                        <div className="guest-file-meta">
                          <span className="guest-file-name">{attachmentFile.name}</span>
                          <span className="guest-file-size">{formatFileSize(attachmentFile.size)}</span>
                        </div>
                        <button
                          type="button"
                          className="guest-file-remove"
                          aria-label="Remove attached file"
                          onClick={handleRemoveAttachmentFile}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FaFileUpload className="upload-icon-large" />
                        <p className="upload-text-main">Click to attach supporting receipt or document</p>
                        <p className="upload-text-sub">PDF, PNG, JPG, or DOC (Max 5MB)</p>
                      </>
                    )}
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="file-input-hidden"
                      onChange={handleAttachmentChange}
                      accept=".pdf,.doc,.docx,.jpg,.png,.jpeg"
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
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
      
      {submitting && <LoadingSpinner message="Submitting your request to school offices..." fullScreen={true} />}
    </div>
  );
};

export default GuestLogin;