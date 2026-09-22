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
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';
import { createNotification } from '../utils/notificationHelper';
import '../styles/ContactAdmissionsModal.css';

const GRADE_LEVELS = [
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12'
];

const ContactAdmissionsModal = ({ isOpen, onClose }) => {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState(GRADE_LEVELS[0]);
  const [section, setSection] = useState('');
  const [message, setMessage] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

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
    setGrade(GRADE_LEVELS[0]);
    setSection('');
    setMessage('');
    setSubmittedData(null);
    setErrorMessage('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Validations
    if (!lastName.trim()) {
      setErrorMessage('Please enter your last name.');
      return;
    }
    if (!firstName.trim()) {
      setErrorMessage('Please enter your first name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!message.trim()) {
      setErrorMessage('Please describe the issue you are experiencing.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure the user has an active Firebase auth session to satisfy Firestore security rules (request.auth != null)
      let currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        try {
          const userCred = await signInAnonymously(auth);
          currentUid = userCred?.user?.uid;
        } catch (authErr) {
          console.warn('[Admissions] Anonymous auth warning:', authErr);
        }
      }

      // Generate a unique Admissions inquiry reference ID
      const generatedRequestId = `ADM-${Math.floor(100000 + Math.random() * 900000)}`;
      const cleanStudentId = studentId.trim();
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      const newInquiryDoc = {
        requestId: generatedRequestId,
        studentId: cleanStudentId || 'N/A',
        studentUid: currentUid || `guest_${Date.now()}`,
        studentName: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        studentEmail: email.trim(),
        email: email.trim(),
        grade: grade,
        gradeLevel: grade,
        section: section.trim() || 'N/A',
        subject: '[Admissions] Account / Login Assistance Request',
        description: message.trim(),
        // office is set to 'Registrar' to satisfy Firestore database security rules schema,
        // while targetRole, department, and category strictly isolate it for Superadmin
        office: 'Registrar',
        officeCode: 'REG-001',
        department: 'Registrar',
        targetRole: 'superadmin',
        assignedToOffice: 'Superadmin',
        isAdmissionsInquiry: true,
        category: 'Admissions / Login Support',
        status: 'Pending',
        isGuest: true,
        isNewStudentInquiry: true,
        inquirySource: 'Login Page — Contact Admissions',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        attachments: [],
        followUps: []
      };

      // 1. Save directly into Firestore 'requests' collection
      await addDoc(collection(db, 'requests'), newInquiryDoc);

      // 2. Dispatch real-time background notification to Superadmin only (non-blocking)
      try {
        const studentIdLabel = cleanStudentId ? ` [ID: ${cleanStudentId}]` : '';
        await createNotification(
          'superadmin',
          'superadmin',
          'new_request',
          'New Account / Login Assistance Request',
          `${fullName}${studentIdLabel} (${grade}${section.trim() ? ' - ' + section.trim() : ''}) submitted an account / login assistance request.`,
          {
            requestId: generatedRequestId,
            studentId: cleanStudentId || 'N/A',
            studentName: fullName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            studentEmail: email.trim(),
            office: 'Superadmin',
            targetRole: 'superadmin',
            grade: grade,
            section: section.trim() || 'N/A',
            subject: 'Account / Login Assistance Request'
          }
        );
      } catch (notifErr) {
        console.warn('[Warning] Notification dispatch warning:', notifErr);
      }

      setSubmittedData({
        requestId: generatedRequestId,
        studentId: cleanStudentId || 'N/A',
        fullName: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        grade: grade,
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
                    <span>Student ID</span>
                  </label>
                  <input
                    id="adm-studentid"
                    type="text"
                    className="admissions-input"
                    placeholder="e.g. 1001"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="admissions-field-group">
                  <label className="admissions-label" htmlFor="adm-email">
                    <FaEnvelope className="field-icon" />
                    <span>Email Address *</span>
                  </label>
                  <input
                    id="adm-email"
                    type="email"
                    className="admissions-input"
                    placeholder="e.g. maria.santos@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Row 3: Grade Level & Section */}
              <div className="admissions-form-grid">
                <div className="admissions-field-group">
                  <label className="admissions-label" htmlFor="adm-grade">
                    <FaGraduationCap className="field-icon" />
                    <span>Grade Level *</span>
                  </label>
                  <select
                    id="adm-grade"
                    className="admissions-select"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    disabled={isSubmitting}
                  >
                    {GRADE_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div className="admissions-field-group">
                  <label className="admissions-label" htmlFor="adm-section">
                    <FaLayerGroup className="field-icon" />
                    <span>Section</span>
                  </label>
                  <input
                    id="adm-section"
                    type="text"
                    className="admissions-input"
                    placeholder="e.g. St. Francis or Incoming"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>


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
                      <span>Sending Inquiry...</span>
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
