import React, { useState, useRef } from 'react';
import { FaFileUpload, FaUserCircle, FaFileAlt, FaTimes } from 'react-icons/fa';
import { MdExitToApp, MdHome } from 'react-icons/md';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import GuestSubmitted from './GuestSubmitted';
import GuestRequestStatus from './GuestRequestStatus';
import '../styles/GuestLogin.css';

const guestOffices = [
  {
    id: 'finance',
    name: 'Finance',
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

const officeNameFromCode = (code) => {
  const prefix = String(code || '').replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
  const match = guestOffices.find((o) => o.name.substring(0, 3).toUpperCase() === prefix);
  return match ? match.name : 'School Office';
};

const GuestLogin = ({ onLogin }) => {
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
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [authFile, setAuthFile] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [submissionData, setSubmissionData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackNotFound, setTrackNotFound] = useState(false);
  const [trackError, setTrackError] = useState('');
  const authInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('studentLoggedIn');
      localStorage.removeItem('studentIsGuest');
      window.location.href = '/';
    }
  };

  const selectOffice = (officeId) => {
    setSelectedOffice(officeId);
    setSubject(''); // Reset subject when office changes
  };

  const handleOfficeKeyDown = (e, officeId) => {
    // Enter/Space activate like a click; arrow keys move within the group
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectOffice(officeId);
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && e.target === e.currentTarget) {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling;
      if (next) next.focus();
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && e.target === e.currentTarget) {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling;
      if (prev) prev.focus();
    }
  };

  const openAuthPicker = () => authInputRef.current?.click();
  const openAttachmentPicker = () => attachmentInputRef.current?.click();

  const handleAuthChange = (e) => {
    setAuthFile(e.target.files[0] || null);
    e.target.value = '';
  };

  const handleAttachmentChange = (e) => {
    setAttachmentFile(e.target.files[0] || null);
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

  const buildSubmissionData = () => {
    const office = guestOffices.find((o) => o.id === selectedOffice);
    const officeName = office ? office.name : 'School Office';
    const prefix = officeName.substring(0, 3).toUpperCase();
    const created = new Date();
    return {
      requestNumber: `#${prefix}-${random3()}-${random3()}-${random3()}`,
      officeCode: `${prefix}-${random3()}`,
      officeName,
      subject: subject.trim(),
      description: description.trim(),
      dateCreated: formatShortDate(created),
      estimatedCompletion: formatShortDate(addDays(created, 2))
    };
  };

  const buildStatusData = (docData, enteredCode) => {
    const status = docData.status || 'Pending';
    const officeName = docData.office || officeNameFromCode(enteredCode);
    const isInProcess = status === 'In Process';
    const isResolved = status === 'Resolved';
    const processingActive = isInProcess || isResolved || status === 'Returned' || status === 'For Follow Up';
    const handler = docData.claimedBy || docData.assignedTo || docData.assignedToStaff;

    let statusClass = 'is-pending';
    if (isInProcess) statusClass = 'is-in-process';
    else if (isResolved) statusClass = 'is-resolved';
    else if (status === 'Cancelled') statusClass = 'is-cancelled';
    else if (status === 'Returned' || status === 'For Follow Up') statusClass = 'is-follow-up';

    const estimatedCompletion = docData.etc
      ? docData.etc
      : (isResolved ? toShort(docData.resolvedAt) : 'To be set');

    return {
      requestNumber: `#${docData.requestId || ''}`,
      officeCode: String(enteredCode || '').replace(/[#\s]/g, ''),
      officeName,
      status,
      statusClass,
      dateCreated: toShort(docData.createdAt),
      estimatedCompletion,
      timeline: [
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
            : 'Awaiting assignment'
        },
        {
          status: 'RESOLVED',
          completed: isResolved,
          active: isResolved,
          date: toLong(docData.resolvedAt),
          description: isResolved ? 'Request completed' : ''
        }
      ]
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
    if (requestId.trim() && officeCode.trim()) {
      trackRequest(requestId, officeCode);
    }
  };

  const openStatus = () => {
    if (statusData) {
      setTrackNotFound(false);
      setTrackError('');
      setView('status');
      return;
    }
    if (submissionData) {
      trackRequest(submissionData.requestNumber, submissionData.officeCode);
      return;
    }
    if (requestId.trim() && officeCode.trim()) {
      trackRequest(requestId, officeCode);
      return;
    }
    setStatusData(null);
    setTrackNotFound(false);
    setTrackError('');
    setView('status');
  };

  const goHome = () => setView('home');

  const handleSubmitRequest = () => {
    if (!canSubmit) return;
    setSubmissionData(buildSubmissionData());
    setView('submitted');
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

  const canBrowse = requestId.trim() !== '' && officeCode.trim() !== '';
  const canSubmit =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    grade.trim() !== '' &&
    section.trim() !== '' &&
    !!selectedOffice &&
    subject.trim() !== '' &&
    description.trim() !== '' &&
    authFile !== null;

  return (
    <div className="guest-login-container">
      <div className="guest-header">
        <div className="guest-header-content">
          <img src="/school-logo.jpg" alt="Academia De San Jose" className="guest-logo" onError={(e) => e.target.style.display = 'none'} />
          <h1 className="guest-school-name">Academia De San Jose</h1>
        </div>
        <div className="guest-header-right">
          <div className="guest-account-badge">
            <span>Guest Account</span>
            <FaUserCircle className="guest-icon" />
          </div>
        </div>
      </div>

      <div className="guest-content">
        {view !== 'home' && (
          <nav className="guest-top-nav" aria-label="Guest navigation">
            <button type="button" className="guest-nav-link" onClick={goHome}>
              <MdHome /> Guest Log In
            </button>
            <button
              type="button"
              className={`guest-nav-link ${view === 'status' ? 'active' : ''}`}
              onClick={openStatus}
            >
              Track Request Status
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
          <GuestSubmitted data={submissionData} onHome={resetGuestForm} />
        ) : (
          <>
            <section className="guest-section">
              <h2 className="section-title-guest">Check Request Status</h2>
              <p className="section-subtitle-guest">Track an existing request.</p>

              <div className="form-group-guest">
                <label className="form-label-guest" htmlFor="guestOfficeCode">Enter Office Code</label>
                <input
                  id="guestOfficeCode"
                  type="text"
                  className="form-input-guest"
                  value={officeCode}
                  onChange={(e) => setOfficeCode(e.target.value)}
                  placeholder="LIB-001"
                />
              </div>

              <div className="form-group-guest">
                <label className="form-label-guest" htmlFor="guestRequestId">Enter Request ID</label>
                <input
                  id="guestRequestId"
                  type="text"
                  className="form-input-guest"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  placeholder="#LIB-100-010-001"
                />
              </div>

              <div className="form-actions-guest">
                <button className="cancel-btn-guest" onClick={() => window.location.reload()}>
                  Cancel
                </button>
                <button
                  className="confirm-btn-guest"
                  onClick={handleBrowseConfirm}
                  disabled={!canBrowse || trackingLoading}
                >
                  {trackingLoading ? 'Checking...' : 'Confirm'}
                </button>
              </div>
            </section>

            <section className="guest-section">
              <h2 className="section-title-guest">Submit New Request</h2>

              <div className="form-section-guest">
                <h3 className="guest-subheading">Personal Information</h3>
                <div className="field-grid">
                  <div className="form-group-guest">
                    <label className="form-label-guest" htmlFor="guestFirstName">First Name</label>
                    <input
                      id="guestFirstName"
                      type="text"
                      className="form-input-guest"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="form-group-guest">
                    <label className="form-label-guest" htmlFor="guestLastName">Last Name</label>
                    <input
                      id="guestLastName"
                      type="text"
                      className="form-input-guest"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                    />
                  </div>
                  <div className="form-group-guest">
                    <label className="form-label-guest" htmlFor="guestGrade">Grade</label>
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
                    <label className="form-label-guest" htmlFor="guestSection">Section</label>
                    <input
                      id="guestSection"
                      type="text"
                      className="form-input-guest"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. Section A"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section-guest">
                <h3 className="guest-subheading">Select Office</h3>
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
                        <h4 className="office-name">{office.name}</h4>
                        <p className="office-description">{office.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-section-guest">
                <h3 className="guest-subheading">Request Details</h3>

                <div className="form-group-guest">
                  <label className="form-label-guest" htmlFor="guestSubject">Subject</label>
                  <select
                    id="guestSubject"
                    className="form-select-guest"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={!selectedOffice}
                  >
                    <option value="">
                      {selectedOffice ? 'Select a subject' : 'Please select an office first'}
                    </option>
                    {selectedOffice && guestOffices.find(o => o.id === selectedOffice)?.subjects.map((subj, index) => (
                      <option key={index} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-guest">
                  <label className="form-label-guest" htmlFor="guestDescription">Detailed Description</label>
                  <textarea
                    id="guestDescription"
                    className="form-textarea-guest"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please provide as much detail as possible..."
                    rows="5"
                  />
                </div>
              </div>

              <div className="form-section-guest">
                <h3 className="guest-subheading">Attachments</h3>

                <div className="form-group-guest">
                  <label className="form-label-guest" htmlFor="authProofUpload">Attach Authorization Proof</label>
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
                    <span className="required-badge">Required</span>
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
                        <p className="upload-text-main">Click to upload or drag and drop</p>
                        <p className="upload-text-sub">Attach documents (Max 5MB)</p>
                      </>
                    )}
                    <p className="upload-file-status">{authFile ? 'Click to replace file' : ''}</p>
                    <input
                      ref={authInputRef}
                      type="file"
                      className="file-input-hidden"
                      onChange={handleAuthChange}
                      accept=".pdf,.doc,.docx,.jpg,.png"
                      aria-label="Upload authorization proof (required)"
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                </div>

                <div className="form-group-guest">
                  <label className="form-label-guest" htmlFor="optionalUpload">Attach File <span className="optional-guest">(Optional)</span></label>
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
                        <p className="upload-text-main">Click to upload or drag and drop</p>
                        <p className="upload-text-sub">Attach documents (Max 5MB)</p>
                      </>
                    )}
                    <p className="upload-file-status">{attachmentFile ? 'Click to replace file' : ''}</p>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="file-input-hidden"
                      onChange={handleAttachmentChange}
                      accept=".pdf,.doc,.docx,.jpg,.png"
                      aria-label="Attach an optional file"
                      style={{ pointerEvents: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions-guest">
                <button className="cancel-btn-guest" onClick={() => window.location.reload()}>
                  Cancel
                </button>
                <button className="submit-btn-guest" onClick={handleSubmitRequest} disabled={!canSubmit}>
                  Submit Request
                </button>
              </div>
            </section>
          </>
        )}
      </div>
      
      {loading && <LoadingSpinner message="Submitting your request..." fullScreen={true} />}
    </div>
  );
};

export default GuestLogin;