import React, { useState, useEffect, useRef } from 'react';
import { FaFileUpload, FaUserCircle } from 'react-icons/fa';
import { MdClose, MdCheckCircle, MdWarning, MdError } from 'react-icons/md';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { validateContent } from '../utils/contentModeration';
import { notifyStaffNewRequest } from '../utils/notificationHelper';
import LoadingSpinner from './LoadingSpinner';
import GuestRequestSuccess from './GuestRequestSuccess';
import GuestRequestTracking from './GuestRequestTracking';
import '../styles/GuestLogin.css';

// Smart image compression to stay under Firestore 1 MB document limit
const MAX_IMAGE_DIMENSION = 1280;
const MAX_BASE64_LENGTH = 900 * 1024 * 1.37; // ~0.9 MiB raw -> base64 ceiling

const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read the image file.'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('That file is not a valid image.'));
    img.onload = () => {
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

      // Shrink the image progressively until it fits the 1 MiB doc limit
      let result = encode(MAX_IMAGE_DIMENSION);
      for (const dim of [1024, 800, 600]) {
        if (result.length <= MAX_BASE64_LENGTH) break;
        result = encode(dim);
      }
      resolve(result);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const GuestLogin = ({ onLogin }) => {
  const [requestId, setRequestId] = useState('');
  const [officeCode, setOfficeCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [authFile, setAuthFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError] = useState('');
  const [offices, setOffices] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedRequestData, setSubmittedRequestData] = useState(null);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingRequestData, setTrackingRequestData] = useState(null);
  const fileInputRef = useRef(null);
  const authFileInputRef = useRef(null);
  
  // Validation states
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('studentLoggedIn');
      localStorage.removeItem('studentIsGuest');
      window.location.href = '/';
    }
  };

  // Default offices as fallback
  const defaultOffices = [
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
      description: 'Handles student behavior concerns, incidents, and disciplinary cases to maintain order and safety in school.',
      subjects: ['Counseling Request', 'Disciplinary Appeal', 'Behavior Report', 'Support Services']
    }
  ];

  // Load office configuration from Firebase
  useEffect(() => {
    loadOfficeConfig();
  }, []);

  const loadOfficeConfig = async () => {
    try {
      setLoadingConfig(true);
      const docRef = doc(db, 'config', 'requestForm');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const fetchedOffices = docSnap.data().offices || defaultOffices;
        console.log('[GuestLogin] Loaded offices from Firestore:', fetchedOffices);
        setOffices(fetchedOffices);
      } else {
        console.log('[GuestLogin] No config found, using default offices');
        setOffices(defaultOffices);
      }
    } catch (error) {
      console.error('[GuestLogin] Error loading office config:', error);
      setOffices(defaultOffices);
    } finally {
      setLoadingConfig(false);
    }
  };

  const generateRequestId = (officeName) => {
    // Generate format: FIN-123-654-789
    const officePrefix = officeName.substring(0, 3).toUpperCase();
    const randomNum1 = Math.floor(100 + Math.random() * 900);
    const randomNum2 = Math.floor(100 + Math.random() * 900);
    const randomNum3 = Math.floor(100 + Math.random() * 900);
    return `${officePrefix}-${randomNum1}-${randomNum2}-${randomNum3}`;
  };

  const handleCheckStatus = async () => {
    if (!requestId.trim() || !officeCode.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Query Firestore for the request
      const requestsRef = collection(db, 'requests');
      const q = query(
        requestsRef,
        where('requestId', '==', requestId.trim()),
        where('isGuest', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Request not found. Please check your Request ID Number and try again.');
      } else {
        const requestDoc = querySnapshot.docs[0];
        const requestData = requestDoc.data();
        
        // Verify office code matches
        const officePrefix = requestData.office.substring(0, 3).toUpperCase();
        if (!officeCode.trim().toUpperCase().startsWith(officePrefix)) {
          setError('Office Code does not match the request. Please verify and try again.');
        } else {
          // Show tracking page
          setTrackingRequestData(requestData);
          setShowTracking(true);
        }
      }
    } catch (error) {
      console.error('[CheckStatus] Error:', error);
      setError('Failed to check request status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Debounced AI validation effect
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
        const selectedOfficeData = offices.find(o => o.id === selectedOffice);
        const officeName = selectedOfficeData?.name || '';
        const result = await validateContent(subject, description, officeName);
        setValidationResult(result);
      } catch (error) {
        console.error('Validation error:', error);
        setValidationResult({
          isValid: true,
          errors: [],
          warnings: ['Validation temporarily unavailable. Your request will be reviewed.'],
          language: 'unknown'
        });
      } finally {
        setIsValidating(false);
      }
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [description, subject, selectedOffice, offices]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    
    // Filter files by size (max 10MB for images, 5MB for documents)
    const validFiles = [];
    const invalidFiles = [];
    
    files.forEach(file => {
      const maxSize = file.type.startsWith('image/') ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size <= maxSize) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`These files are too large: ${invalidFiles.join(', ')}. Images must be under 10MB, documents under 5MB.`);
      setTimeout(() => setError(''), 5000);
    }

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const uploadFilesToStorage = async (includeAuth = true) => {
    const uploadedFileUrls = [];
    const filesToProcess = includeAuth && authFile ? [authFile, ...uploadedFiles] : uploadedFiles;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];

      try {
        let fileData;
        
        // Compress images, keep other files as-is
        if (file.type.startsWith('image/')) {
          console.log(`🖼️ Compressing image ${i + 1}/${filesToProcess.length}:`, file.name);
          fileData = await compressImage(file);
          console.log(`✅ Compressed to ${(fileData.length / 1024).toFixed(0)} KB`);
        } else {
          // Convert non-image files to base64
          fileData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        uploadedFileUrls.push({
          name: file.name,
          data: fileData,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          isAuthProof: includeAuth && file === authFile
        });
        
        console.log(`✅ Processed file ${i + 1}/${filesToProcess.length}:`, file.name);
      } catch (uploadError) {
        console.error(`❌ Error processing file ${file.name}:`, uploadError);
        throw new Error(`Failed to process ${file.name}: ${uploadError.message}`);
      }
    }

    return uploadedFileUrls;
  };

  const handleSubmitRequest = async () => {
    setError('');

    // Validation
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    if (!lastName.trim()) {
      setError('Please enter your last name');
      return;
    }

    if (!grade) {
      setError('Please select your grade');
      return;
    }

    if (!section) {
      setError('Please select your section');
      return;
    }

    if (!selectedOffice) {
      setError('Please select an office');
      return;
    }

    if (!subject.trim()) {
      setError('Please select a subject');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a detailed description');
      return;
    }

    if (!authFile) {
      setError('Please upload authorization proof (e.g., authorization letter, valid ID)');
      return;
    }

    // Content validation check
    if (validationResult && !validationResult.isValid) {
      setError('Please fix the validation errors before submitting');
      return;
    }

    setLoading(true);

    try {
      const selectedOfficeData = offices.find(o => o.id === selectedOffice);
      
      // Generate unique request ID
      const requestId = generateRequestId(selectedOfficeData.name);

      // Convert files to base64
      console.log(`📤 Processing files...`);
      const attachments = await uploadFilesToStorage(true);

      // Prepare request data
      const requestData = {
        requestId: requestId,
        studentName: `${firstName.trim()} ${lastName.trim()}`,
        studentGradeLevel: `Grade ${grade}`,
        studentSection: `Section ${section}`,
        office: selectedOfficeData.name, // e.g., "Finance"
        officeId: selectedOffice, // e.g., "finance"
        subject: subject.trim(),
        description: description.trim(),
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        attachments: attachments,
        isGuest: true,
        guestInfo: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gradeLevel: grade,
          section: section
        }
      };

      // Save to Firebase
      console.log('[DEBUG] Saving guest request with office:', selectedOfficeData.name, '(officeId:', selectedOffice, ')');
      console.log('[DEBUG] Full request data:', JSON.stringify({
        ...requestData,
        attachments: `[${attachments.length} files]`,
        createdAt: '[serverTimestamp]',
        updatedAt: '[serverTimestamp]'
      }, null, 2));
      
      const docRef = await addDoc(collection(db, 'requests'), requestData);
      console.log('[Success] Guest request created with Firestore ID:', docRef.id);
      console.log('[Success] Request ID for tracking:', requestId);
      console.log('[Success] To find this request, admin should query where office ==', selectedOfficeData.name);

      // Notify all staff in the target office about the new request
      await notifyStaffNewRequest(
        selectedOfficeData.name,
        requestId,
        subject.trim(),
        `${firstName.trim()} ${lastName.trim()}`
      );

      // Wait a moment for Firestore
      await new Promise(resolve => setTimeout(resolve, 500));

      // Prepare success data
      const createdDate = new Date();

      const successData = {
        requestId: requestId,
        officeCode: `${selectedOfficeData.name.substring(0, 3).toUpperCase()}-001`,
        office: selectedOfficeData.name,
        subject: subject.trim(),
        description: description.trim(),
        studentName: `${firstName.trim()} ${lastName.trim()}`,
        studentGradeLevel: `Grade ${grade}`,
        studentSection: `Section ${section}`,
        status: 'Pending',
        createdAt: createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase(),
        estimatedCompletion: null // Will be set by admin when they claim the request
      };

      setSubmittedRequestData(successData);
      setShowSuccess(true);

    } catch (error) {
      console.error('[Error] Error submitting guest request:', error);
      setError('Failed to submit request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Form validation
  const isFormValid = Boolean(
    firstName.trim() &&
    lastName.trim() &&
    grade &&
    section &&
    selectedOffice &&
    subject &&
    description.trim() &&
    authFile &&
    !isValidating &&
    validationResult &&
    validationResult.isValid &&
    validationResult.errors.length === 0
  );

  const canCheckStatus = requestId.trim() !== '' && officeCode.trim() !== '';

  const handleBackToLogin = () => {
    setShowSuccess(false);
    setSubmittedRequestData(null);
    // Don't reset the form - keep it for "Submit Another Request"
  };

  const handleSubmitAnother = () => {
    setShowSuccess(false);
    setSubmittedRequestData(null);
    // Reset form
    setFirstName('');
    setLastName('');
    setGrade('');
    setSection('');
    setSelectedOffice('');
    setSubject('');
    setDescription('');
    setUploadedFiles([]);
    setAuthFile(null);
    setValidationResult(null);
    if (authFileInputRef.current) {
      authFileInputRef.current.value = '';
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loadingConfig) {
    return <LoadingSpinner message="Loading form..." fullScreen={true} />;
  }

  if (showSuccess && submittedRequestData) {
    return (
      <GuestRequestSuccess
        requestData={submittedRequestData}
        onBackToLogin={handleBackToLogin}
        onSubmitAnother={handleSubmitAnother}
        onTrackStatus={() => {
          // Convert the success data to tracking format and show tracking page
          const trackingData = {
            requestId: submittedRequestData.requestId,
            office: submittedRequestData.office,
            subject: submittedRequestData.subject,
            description: submittedRequestData.description,
            studentName: submittedRequestData.studentName,
            status: 'Pending',
            createdAt: submittedRequestData.createdAt,
            isGuest: true,
            // Note: estimatedCompletion will be set by admin when they claim the request
            estimatedCompletion: null
          };
          
          setShowSuccess(false);
          setTrackingRequestData(trackingData);
          setShowTracking(true);
        }}
      />
    );
  }

  if (showTracking && trackingRequestData) {
    return (
      <GuestRequestTracking
        requestData={trackingRequestData}
        onBackToLogin={() => {
          setShowTracking(false);
          setTrackingRequestData(null);
          setRequestId('');
          setOfficeCode('');
        }}
      />
    );
  }

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

      <div className="guest-content-grid">
        {/* Check Request Status Section */}
        <div className="guest-panel">
          <h2 className="panel-title">Check Request Status</h2>
          <p className="panel-subtitle">Track an existing request</p>

          <div className="form-group-guest">
            <label className="form-label-guest">Enter Office Code</label>
            <input
              type="text"
              className="form-input-guest"
              value={officeCode}
              onChange={(e) => setOfficeCode(e.target.value)}
              placeholder="e.g., FIN-001"
            />
          </div>

          <div className="form-group-guest">
            <label className="form-label-guest">Enter Request ID Number</label>
            <input
              type="text"
              className="form-input-guest"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="e.g., FIN-123-456-789"
            />
          </div>

          <div className="form-actions-guest">
            <button className="cancel-btn-guest" onClick={() => { setRequestId(''); setOfficeCode(''); }}>
              Cancel
            </button>
            <button className="confirm-btn-guest" onClick={handleCheckStatus} disabled={!canCheckStatus}>
              Confirm
            </button>
          </div>
        </div>

        {/* Submit New Request Section */}
        <div className="guest-panel">
          <h2 className="panel-title">Submit New Request</h2>
          
          {error && (
            <div className="error-message-guest">
              {error}
            </div>
          )}

          <div className="form-section">
            <h3 className="section-subtitle">Personal Information</h3>
            
            <div className="name-grid">
              <div className="form-group-guest">
                <label className="form-label-guest">First Name <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  className="form-input-guest"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  required
                />
              </div>

              <div className="form-group-guest">
                <label className="form-label-guest">Last Name <span className="required-asterisk">*</span></label>
                <input
                  type="text"
                  className="form-input-guest"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  required
                />
              </div>
            </div>

            <div className="grade-grid">
              <div className="form-group-guest">
                <label className="form-label-guest">Grade <span className="required-asterisk">*</span></label>
                <select
                  className="form-select-guest"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  required
                >
                  <option value="">Select Grade</option>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                </select>
              </div>

              <div className="form-group-guest">
                <label className="form-label-guest">Section <span className="required-asterisk">*</span></label>
                <select
                  className="form-select-guest"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                >
                  <option value="">Select Section</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-subtitle">Select Office</h3>
            <div className="office-grid-new">
              {offices.map((office) => (
                <div
                  key={office.id}
                  className={`office-card-new ${selectedOffice === office.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedOffice(office.id);
                    setSubject('');
                  }}
                >
                  <h4 className="office-card-title">{office.name}</h4>
                  <p className="office-card-desc">{office.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-subtitle">Request Details</h3>
            
            <div className="form-group-guest">
              <label className="form-label-guest">Subject <span className="required-asterisk">*</span></label>
              <select
                className="form-select-guest"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!selectedOffice}
                required
              >
                <option value="">
                  {selectedOffice ? 'Select a subject' : 'Please select an office first'}
                </option>
                {selectedOffice && offices.find(o => o.id === selectedOffice)?.subjects.map((subj, index) => (
                  <option key={index} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group-guest">
              <label className="form-label-guest">
                Detailed Description <span className="required-asterisk">*</span>
                {isValidating && <span className="validation-status-guest validating"> (Checking...)</span>}
                {validationResult && validationResult.isValid && validationResult.errors.length === 0 && (
                  <span className="validation-status-guest valid">
                    <MdCheckCircle /> Valid
                  </span>
                )}
              </label>
              <textarea
                className={`form-textarea-guest ${
                  validationResult && !validationResult.isValid ? 'has-error' :
                  validationResult && validationResult.warnings.length > 0 ? 'has-warning' : ''
                }`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide as much detail as possible..."
                rows="4"
              />
              
              {/* Validation feedback */}
              {validationResult && (
                <div className="validation-feedback-guest">
                  {/* Errors */}
                  {validationResult.errors.length > 0 && (
                    <div className="validation-errors-guest">
                      {validationResult.errors.map((err, index) => (
                        <div key={index} className="validation-message-guest error">
                          <MdError className="icon" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Warnings */}
                  {validationResult.warnings.length > 0 && (
                    <div className="validation-warnings-guest">
                      {validationResult.warnings.map((warn, index) => (
                        <div key={index} className="validation-message-guest warning">
                          <MdWarning className="icon" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-subtitle">Attachments</h3>
            
            <div className="form-group-guest">
              <label className="form-label-guest">Attach Authorization Proof <span className="required-asterisk">*</span></label>
              <input
                ref={authFileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => setAuthFile(e.target.files[0])}
                accept="image/*,.pdf,.doc,.docx"
                required
              />
              <div className="upload-box-new" onClick={() => authFileInputRef.current?.click()}>
                <FaFileUpload className="upload-icon-new" />
                <p className="upload-text-new">
                  {authFile ? authFile.name : 'Click to upload or drag and drop'}
                </p>
                <p className="upload-subtext-new">Authorization letter, valid ID, etc. (Max 10MB for images, 5MB for documents)</p>
              </div>
            </div>

            <div className="form-group-guest">
              <label className="form-label-guest">Attach Additional Files <span className="optional-text">(Optional)</span></label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <div className="upload-box-new" onClick={() => fileInputRef.current?.click()}>
                <FaFileUpload className="upload-icon-new" />
                <p className="upload-text-new">Click to upload or drag and drop</p>
                <p className="upload-subtext-new">Supporting documents (Max 10MB for images, 5MB for documents)</p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="uploaded-files-list-guest">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="uploaded-file-item-guest">
                      <div className="file-info-guest">
                        <span className="file-name-guest">{file.name}</span>
                        <span className="file-size-guest">{formatFileSize(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="remove-file-btn-guest"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                      >
                        <MdClose />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-actions-guest">
            <button 
              className="cancel-btn-guest" 
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel? All entered data will be lost.')) {
                  window.location.reload();
                }
              }}
            >
              Cancel
            </button>
            <button 
              className="submit-btn-guest" 
              onClick={handleSubmitRequest} 
              disabled={loading || !isFormValid}
              title={!isFormValid ? 'Complete all required fields to submit' : undefined}
            >
              {loading && <span className="btn-spinner"></span>}
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
      
      {loading && <LoadingSpinner message="Submitting your request..." fullScreen={true} />}
    </div>
  );
};

export default GuestLogin;
