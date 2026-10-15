import React, { useState } from 'react';
import { 
  FaUniversity, 
  FaTimes, 
  FaPaperPlane, 
  FaCheckCircle, 
  FaCopy, 
  FaCheck, 
  FaUser, 
  FaIdCard,
  FaEnvelope, 
  FaGraduationCap, 
  FaLayerGroup,
  FaShieldAlt
} from 'react-icons/fa';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';
import { createNotification } from '../utils/notificationHelper';
import '../styles/ContactAdmissionsModal.css';

const ContactAdmissionsModal = ({ isOpen, onClose }) => {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Live account verification states
  const [idStatus, setIdStatus] = useState('idle'); // 'idle' | 'checking' | 'valid' | 'invalid'
  const [idMessage, setIdMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState('idle'); // 'idle' | 'valid' | 'invalid'
  const [emailMessage, setEmailMessage] = useState('');
  const [verifiedAccount, setVerifiedAccount] = useState(null);

  if (!isOpen) return null;

  const handleCopyId = () => {
    if (submittedData?.requestId) {
      navigator.clipboard.writeText(submittedData.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleResetAndClose = () => {
    setLastName('');
    setFirstName('');
    setStudentId('');
    setEmail('');
    setMessage('');
    setSubmittedData(null);
    setErrorMessage('');
    setIdStatus('idle');
    setIdMessage('');
    setEmailStatus('idle');
    setEmailMessage('');
    setVerifiedAccount(null);
    onClose();
  };

  // Helper to ensure an active auth session before Firestore queries
  const ensureAuthSession = async () => {
    let currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      try {
        const userCred = await signInAnonymously(auth);
        currentUid = userCred?.user?.uid;
      } catch (authErr) {
        console.warn('[Admissions] Anonymous auth warning:', authErr);
      }
    }
    return currentUid;
  };

  // Look up student by Student ID in 'students' collection
  const findStudentAccount = async (targetId) => {
    const cleanId = (targetId || '').trim();
    if (!cleanId) return null;

    await ensureAuthSession();

    const studentsRef = collection(db, 'students');
    const q1 = query(studentsRef, where('id', '==', cleanId));
    const q2 = query(studentsRef, where('studentId', '==', cleanId));

    const [snap1, snap2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    let docSnap = !snap1.empty ? snap1.docs[0] : (!snap2.empty ? snap2.docs[0] : null);

    // If not found and input is numeric digits, check academic year prefixes
    if (!docSnap && /^\d{1,6}$/.test(cleanId)) {
      const padded = cleanId.padStart(4, '0');
      const yearPrefixes = ['05-2324-', '05-2425-', '05-2526-', '05-2627-'];
      for (const prefix of yearPrefixes) {
        const qPrefix = query(studentsRef, where('studentId', '==', `${prefix}${padded}`));
        const snapPrefix = await getDocs(qPrefix);
        if (!snapPrefix.empty) {
          docSnap = snapPrefix.docs[0];
          break;
        }
      }
    }

    if (!docSnap) return null;
    return { firestoreId: docSnap.id, ...docSnap.data() };
  };

  // Look up student by Email in 'students' collection (for helpful diagnostics)
  const findStudentByEmail = async (targetEmail) => {
    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    if (!cleanEmail) return null;

    await ensureAuthSession();

    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { firestoreId: snap.docs[0].id, ...snap.docs[0].data() };
    }
    return null;
  };

  // Live on-blur validation for Student ID
  const validateStudentId = async (enteredId) => {
    const cleanId = (enteredId || '').trim();
    if (!cleanId) {
      setIdStatus('idle');
      setIdMessage('');
      setVerifiedAccount(null);
      return null;
    }

    if (cleanId.length < 3) {
      setIdStatus('invalid');
      setIdMessage('Student ID must be at least 3 digits');
      setVerifiedAccount(null);
      return null;
    }

    setIdStatus('checking');
    setIdMessage('Checking student records...');

    try {
      const student = await findStudentAccount(cleanId);
      if (!student) {
        setIdStatus('invalid');
        setIdMessage('Student ID not found in school directory');
        setVerifiedAccount(null);
        return null;
      }

      const isArchived = student.isArchived === true;
      const isSuspended = student.isActive === false;
      const statusNote = isArchived ? ' (Archived)' : isSuspended ? ' (Suspended)' : '';
      const displayName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Verified Student';
      setIdStatus('valid');
      setIdMessage(`✓ Account verified: ${displayName}${statusNote}`);
      setVerifiedAccount(student);

      // Helpful autofill for enrolled student convenience
      if (!firstName.trim() && student.firstName) setFirstName(student.firstName);
      if (!lastName.trim() && student.lastName) setLastName(student.lastName);

      // If email is already entered, validate against student record
      if (email.trim()) {
        if (email.trim().toLowerCase() === (student.email || '').trim().toLowerCase()) {
          setEmailStatus('valid');
          setEmailMessage('✓ Email matches student record');
        } else {
          setEmailStatus('invalid');
          setEmailMessage('Email does not match this Student ID record');
        }
      }

      return student;
    } catch (err) {
      console.warn('[Admissions] ID lookup error:', err);
      setIdStatus('idle');
      setIdMessage('');
      return null;
    }
  };

  // Live on-blur validation for Email Address
  const handleEmailBlur = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailStatus('idle');
      setEmailMessage('');
      return;
    }

    if (verifiedAccount) {
      const registeredEmail = (verifiedAccount.email || '').trim().toLowerCase();
      if (cleanEmail === registeredEmail) {
        setEmailStatus('valid');
        setEmailMessage('✓ Email matches student record');
      } else {
        setEmailStatus('invalid');
        setEmailMessage('Email does not match this Student ID record');
      }
    } else {
      setEmailStatus('idle');
      setEmailMessage('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanId = studentId.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    // 1. Mandatory field checks
    if (!cleanId) {
      setErrorMessage('Please enter your Student ID. An existing student account is required to send an inquiry.');
      return;
    }
    if (!cleanLastName) {
      setErrorMessage('Please enter your last name.');
      return;
    }
    if (!cleanFirstName) {
      setErrorMessage('Please enter your first name.');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!message.trim()) {
      setErrorMessage('Please describe the issue you are experiencing.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Authoritative database validation against 'students' collection
      let account = verifiedAccount;
      if (!account || (account.id !== cleanId && account.studentId !== cleanId)) {
        account = await findStudentAccount(cleanId);
      }

      if (!account) {
        const accountByEmail = await findStudentByEmail(cleanEmail);
        if (accountByEmail) {
          setErrorMessage(`A student account was found for email "${cleanEmail}", but the Student ID "${cleanId}" does not match our records. Please verify your Student ID.`);
        } else {
          setErrorMessage(`No student account was found in the system for Student ID "${cleanId}". Only registered students with an existing account can submit an admissions inquiry.`);
        }
        setIsSubmitting(false);
        return;
      }

      // Check email matching
      const registeredEmail = (account.email || '').trim().toLowerCase();
      if (registeredEmail && cleanEmail !== registeredEmail) {
        setErrorMessage(`The email address entered does not match the registered email on file for Student ID "${cleanId}". Please enter your registered school email address.`);
        setIsSubmitting(false);
        return;
      }

      // 3. Ensure active Firebase auth session for Firestore rules
      const currentUid = await ensureAuthSession();

      // Automatically pull enrolled Grade Level & Section from verified account
      const studentGrade = account.gradeLevel || account.grade || 'N/A';
      const studentSection = account.section || 'N/A';
      const accountStatus = account.isArchived ? 'Archived' : (account.isActive !== false ? 'Active' : 'Suspended');

      // Generate reference ID and compile payload
      const generatedRequestId = `ADM-${Math.floor(100000 + Math.random() * 900000)}`;
      const verifiedStudentId = account.id || account.studentId || cleanId;
      const verifiedDocId = account.firestoreId;
      const fullName = `${cleanFirstName} ${cleanLastName}`;

      const newInquiryDoc = {
        requestId: generatedRequestId,
        originalRequestId: generatedRequestId,
        studentId: verifiedStudentId,
        studentFirestoreId: verifiedDocId || null,
        studentUid: account.uid || currentUid || `guest_${Date.now()}`,
        studentName: fullName,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        studentEmail: cleanEmail,
        email: cleanEmail,
        grade: studentGrade,
        gradeLevel: studentGrade,
        section: studentSection,
        subject: '[Admissions] Account / Login Assistance Request',
        description: message.trim(),
        office: 'Registrar',
        department: 'Registrar',
        originalOffice: 'Registrar',
        originalOfficeId: 'registrar',
        targetRole: 'superadmin',
        assignedToOffice: 'Superadmin',
        isAdmissionsInquiry: true,
        category: 'Admissions / Login Support',
        status: 'Pending',
        isGuest: true,
        isNewStudentInquiry: true,
        isVerifiedStudent: true,
        studentAccountStatus: accountStatus,
        inquirySource: 'Login Page — Contact Admissions',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        attachments: [],
        followUps: []
      };

      // Save directly into Firestore 'requests' collection
      await addDoc(collection(db, 'requests'), newInquiryDoc);

      // Dispatch real-time background notification to Superadmin
      try {
        const gradeSectionLabel = studentGrade !== 'N/A' ? ` (${studentGrade}${studentSection !== 'N/A' ? ' - ' + studentSection : ''})` : '';
        const statusNote = account.isArchived ? ' [Archived Account]' : (account.isActive === false ? ' [Suspended Account]' : '');
        await createNotification(
          'superadmin',
          'superadmin',
          'new_request',
          'New Account / Login Assistance Request',
          `${fullName} [ID: ${verifiedStudentId}]${statusNote}${gradeSectionLabel} submitted an account assistance request.`,
          {
            requestId: generatedRequestId,
            studentId: verifiedStudentId,
            studentName: fullName,
            firstName: cleanFirstName,
            lastName: cleanLastName,
            studentEmail: cleanEmail,
            office: 'Superadmin',
            targetRole: 'superadmin',
            grade: studentGrade,
            section: studentSection,
            subject: 'Account / Login Assistance Request'
          }
        );
      } catch (notifErr) {
        console.warn('[Warning] Notification dispatch warning:', notifErr);
      }

      setSubmittedData({
        requestId: generatedRequestId,
        studentId: verifiedStudentId,
        fullName: fullName,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        email: cleanEmail,
        grade: studentGrade,
        section: studentSection,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
    } catch (err) {
      console.error('[Error] Submitting admissions inquiry:', err);
      setErrorMessage(err?.message || 'Failed to send your inquiry. Please try again or check your internet connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admissions-modal-overlay" onClick={handleResetAndClose}>
      <div 
        className="admissions-modal-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admissions-modal-title"
      >
        {/* Close Button */}
        <button 
          type="button" 
          className="admissions-modal-close" 
          onClick={handleResetAndClose}
          aria-label="Close modal"
        >
          <FaTimes />
        </button>

        {submittedData ? (
          /* =================================================================
             SUCCESS CONFIRMATION VIEW
             ================================================================= */
          <div className="admissions-success-view">
            <div className="admissions-success-icon-wrap">
              <FaCheckCircle className="admissions-success-icon" />
            </div>

            <h2 className="admissions-success-title">Inquiry Submitted!</h2>
            <p className="admissions-success-desc">
              Thank you, <strong>{submittedData.fullName}</strong>. Your inquiry has been routed to 
              the <strong>Admissions Office</strong> and <strong>Institutional Administration (Superadmin)</strong>.
            </p>

            <div className="admissions-ref-box">
              <span className="admissions-ref-label">Reference Number</span>
              <div className="admissions-ref-value-wrap">
                <span className="admissions-ref-code">#{submittedData.requestId}</span>
                <button 
                  type="button" 
                  className="admissions-copy-btn" 
                  onClick={handleCopyId}
                  title="Copy Reference ID"
                >
                  {copied ? <FaCheck className="copied-icon" /> : <FaCopy />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <span className="admissions-ref-note">
                Please save this reference ID. Our admissions officers will review your details and reach out to <strong>{submittedData.email}</strong>.
              </span>
            </div>

            <button 
              type="button" 
              className="admissions-done-btn"
              onClick={handleResetAndClose}
            >
              Back to Login
            </button>
          </div>
        ) : (
          /* =================================================================
             INQUIRY SUBMISSION FORM VIEW
             ================================================================= */
          <div className="admissions-form-view">
            <div className="admissions-modal-header">
              <div className="admissions-header-icon-wrap">
                <FaUniversity className="admissions-header-icon" />
              </div>
              <div>
                <h2 id="admissions-modal-title" className="admissions-modal-title">
                  Contact Admissions
                </h2>
                <p className="admissions-modal-subtitle">
                  Having trouble logging in or accessing your account? Submit your details below to receive assistance directly from Admissions and Administration.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="admissions-error-banner" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="admissions-form">
              {/* Row 1: Last Name & First Name */}
              <div className="admissions-form-grid">
                <div className="admissions-field-group">
                  <label className="admissions-label" htmlFor="adm-lastname">
                    <FaUser className="field-icon" />
                    <span>Last Name *</span>
                  </label>
                  <input
                    id="adm-lastname"
                    type="text"
                    className="admissions-input"
                    placeholder="e.g. Santos"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="admissions-field-group">
                  <label className="admissions-label" htmlFor="adm-firstname">
                    <FaUser className="field-icon" />
                    <span>First Name *</span>
                  </label>
                  <input
                    id="adm-firstname"
                    type="text"
                    className="admissions-input"
                    placeholder="e.g. Maria"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Row 2: Student ID & Email Address */}
              <div className="admissions-form-grid">
                <div className="admissions-field-group">
                  <label className="admissions-label" htmlFor="adm-studentid">
                    <FaIdCard className="field-icon" />
                    <span>Student ID *</span>
                  </label>
                  <input
                    id="adm-studentid"
                    type="text"
                    className={`admissions-input ${idStatus === 'valid' ? 'input-valid' : idStatus === 'invalid' ? 'input-invalid' : ''}`}
                    placeholder="e.g. 1001"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      if (idStatus !== 'idle') {
                        setIdStatus('idle');
                        setIdMessage('');
                      }
                      if (emailStatus !== 'idle') {
                        setEmailStatus('idle');
                        setEmailMessage('');
                      }
                      setVerifiedAccount(null);
                    }}
                    onBlur={(e) => validateStudentId(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  {idMessage && (
                    <small className={`admissions-field-note ${idStatus}`}>
                      {idMessage}
                    </small>
                  )}
                </div>

                <div className="admissions-field-group">
                  <label className="admissions-label" htmlFor="adm-email">
                    <FaEnvelope className="field-icon" />
                    <span>Email Address *</span>
                  </label>
                  <input
                    id="adm-email"
                    type="email"
                    className={`admissions-input ${emailStatus === 'valid' ? 'input-valid' : emailStatus === 'invalid' ? 'input-invalid' : ''}`}
                    placeholder="e.g. maria.santos@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailStatus !== 'idle') {
                        setEmailStatus('idle');
                        setEmailMessage('');
                      }
                    }}
                    onBlur={handleEmailBlur}
                    required
                    disabled={isSubmitting}
                  />
                  {emailMessage && (
                    <small className={`admissions-field-note ${emailStatus}`}>
                      {emailMessage}
                    </small>
                  )}
                </div>
              </div>

              {/* Verified Academic Profile Confirmation Badge (Option 2) */}
              {verifiedAccount && (
                <div className="admissions-verified-badge">
                  <div className="verified-badge-header">
                    <FaCheckCircle className="verified-check-icon" />
                    <span className="verified-title">Enrolled Academic Profile Verified</span>
                  </div>
                  <div className="verified-details-row">
                    <span className="verified-pill">
                      <FaGraduationCap />
                      <span>{verifiedAccount.gradeLevel || verifiedAccount.grade || 'Grade Level on File'}</span>
                    </span>
                    <span className="verified-pill">
                      <FaLayerGroup />
                      <span>{verifiedAccount.section || 'Assigned Section'}</span>
                    </span>
                  </div>
                </div>
              )}


              {/* Row 4: Detailed Message */}
              <div className="admissions-field-group full-width">
                <label className="admissions-label" htmlFor="adm-message">
                  <span>Detailed Inquiry / Message *</span>
                  <span className="char-count">{message.length} chars</span>
                </label>
                <textarea
                  id="adm-message"
                  className="admissions-textarea"
                  rows={4}
                  placeholder="Please describe the issue you are experiencing with logging in or accessing your student account..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Privacy / Security Notice */}
              <div className="admissions-notice-box">
                <FaShieldAlt className="notice-shield" />
                <span>
                  Your inquiry is securely recorded and delivered in real time to the Admissions Office and Superadmin console.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="admissions-actions">
                <button
                  type="button"
                  className="admissions-cancel-btn"
                  onClick={handleResetAndClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admissions-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="admissions-spinner" />
                      <span>Verifying & Sending...</span>
                    </>
                  ) : (
                    <>
                      <FaPaperPlane className="submit-plane-icon" />
                      <span>Submit to Admissions</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactAdmissionsModal;
