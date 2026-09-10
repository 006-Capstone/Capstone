import { useState, useRef, useEffect } from 'react';
import { FaFileUpload, FaShieldAlt } from 'react-icons/fa';
import { 
  MdClose, 
  MdCheckCircle, 
  MdWarning, 
  MdError,
  MdAccountBalance,
  MdMenuBook,
  MdSchool,
  MdPsychology,
  MdHelpOutline,
  MdAttachFile
} from 'react-icons/md';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { validateContent } from '../utils/contentModeration';
import { notifyStaffNewRequest } from '../utils/notificationHelper';
import LoadingSpinner from './LoadingSpinner';
import Breadcrumb from './Breadcrumb';
import '../styles/NewRequest.css';

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

function NewRequest({ onNavigate }) {
  const [selectedOffice, setSelectedOffice] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [error, setError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [offices, setOffices] = useState([]);
  const fileInputRef = useRef(null);
  
  // Validation states
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

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
      description: 'Handles student behavior concerns, violations, and disciplinary cases to maintain order and safety in school.',
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
        setOffices(docSnap.data().offices || defaultOffices);
      } else {
        setOffices(defaultOffices);
      }
    } catch (error) {
      console.error('Error loading office config:', error);
      setOffices(defaultOffices);
    } finally {
      setLoadingConfig(false);
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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    
    // Filter files by size (max 10MB for images before compression, 5MB for documents)
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

  // Debounced AI validation effect
  useEffect(() => {
    if (!description.trim() || !subject) {
      setValidationResult(null);
      setIsValidating(false); // keep the UI flag in sync so the Submit gate can't stay locked
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
  }, [description, subject, selectedOffice, offices]);

  const uploadFilesToStorage = async () => {
    const uploadedFileUrls = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];

      try {
        let fileData;
        
        // Compress images, keep other files as-is
        if (file.type.startsWith('image/')) {
          console.log(`🖼️ Compressing image ${i + 1}/${uploadedFiles.length}:`, file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
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
          uploadedAt: new Date().toISOString()
        });
        
        console.log(`✅ Processed file ${i + 1}/${uploadedFiles.length}:`, file.name);
      } catch (uploadError) {
        console.error(`❌ Error processing file ${file.name}:`, uploadError);
        throw new Error(`Failed to process ${file.name}: ${uploadError.message}`);
      }
    }

    return uploadedFileUrls;
  };

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!selectedOffice) {
      setError('Please select an office');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a detailed description');
      return;
    }

    // Content validation check
    if (validationResult && !validationResult.isValid) {
      setError('Please fix the validation errors before submitting');
      return;
    }

    setLoading(true);

    try {
      // Get student data from localStorage
      const studentData = localStorage.getItem('studentData');
      if (!studentData) {
        throw new Error('Student data not found. Please login again.');
      }

      const student = JSON.parse(studentData);
      const selectedOfficeData = offices.find(o => o.id === selectedOffice);
      
      // CHECK DAILY LIMIT: 2 tickets per department per day
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Query for this student's requests and filter in memory to avoid requiring a composite index
      const studentRequestsQuery = query(
        collection(db, 'requests'),
        where('studentUid', '==', student.uid)
      );
      
      const studentRequestsSnapshot = await getDocs(studentRequestsQuery);
      const todayCount = studentRequestsSnapshot.docs.filter((doc) => {
        const d = doc.data();
        if (d.office !== selectedOfficeData.name) return false;
        const createdDate = d.createdAt?.toDate ? d.createdAt.toDate() : (d.createdAt ? new Date(d.createdAt) : null);
        return createdDate && createdDate >= today;
      }).length;
      
      console.log(`[Limit Check] Student has ${todayCount} request(s) to ${selectedOfficeData.name} today`);
      
      if (todayCount >= 2) {
        setError(`You have reached the daily limit of 2 requests to ${selectedOfficeData.name}. Please try again tomorrow or contact the office directly if urgent.`);
        setLoading(false);
        return;
      }
      
      // Generate unique request ID
      const requestId = generateRequestId(selectedOfficeData.name);

      // Convert files to base64 if any
      let attachments = [];
      if (uploadedFiles.length > 0) {
        console.log(`📤 Processing ${uploadedFiles.length} file(s)...`);
        attachments = await uploadFilesToStorage();
      }

      // Prepare request data
      const requestData = {
        requestId: requestId,
        studentId: student.studentId || student.id,
        studentUid: student.uid,
        studentName: student.name || `${student.firstName} ${student.lastName}`.trim(),
        studentEmail: student.email,
        studentGradeLevel: student.gradeLevel || 'N/A',
        studentSection: student.section || 'N/A',
        office: selectedOfficeData.name,
        officeId: selectedOffice,
        subject: subject.trim(),
        description: description.trim(),
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        attachments: attachments,
        isGuest: false
      };

      // Save to Firebase
      const docRef = await addDoc(collection(db, 'requests'), requestData);
      console.log('[Success] Request created with ID:', docRef.id);

      // Notify all staff in the target office about the new request
      await notifyStaffNewRequest(
        selectedOfficeData.name,
        requestId,
        subject.trim(),
        student.name || `${student.firstName} ${student.lastName}`.trim()
      );

      // Wait a moment for Firestore real-time listeners to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Show success message
      alert(`Request submitted successfully! Your request ID is: ${requestId}${attachments.length > 0 ? `\n${attachments.length} file(s) attached` : ''}`);

      // Reset form
      setSelectedOffice('');
      setSubject('');
      setDescription('');
      setUploadedFiles([]);

      // Navigate back to request history
      if (onNavigate) {
        onNavigate('request');
      }

    } catch (error) {
      console.error('[Error] Error submitting request:', error);
      setError('Failed to submit request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Frontend-only gating for the Submit button: it stays disabled until every
  // required field is filled in AND the AI content check has passed. Attaching
  // files stays optional, and the button re-enables automatically as the
  // required inputs (and validation) become complete.
  const isFormValid = Boolean(
    selectedOffice &&
    subject &&
    description.trim() &&
    !isValidating &&
    validationResult &&
    validationResult.isValid &&
    validationResult.errors.length === 0
  );

  if (loadingConfig) {
    return <LoadingSpinner message="Loading form..." fullScreen={true} />;
  }

  const getOfficeIcon = (id) => {
    switch (id?.toLowerCase()) {
      case 'finance':
        return <MdAccountBalance className="office-icon" />;
      case 'library':
        return <MdMenuBook className="office-icon" />;
      case 'registrar':
        return <MdSchool className="office-icon" />;
      case 'guidance':
        return <MdPsychology className="office-icon" />;
      default:
        return <MdAccountBalance className="office-icon" />;
    }
  };

  return (
    <div className="new-request-page">
      <Breadcrumb
        items={[
          { label: 'Request History', onClick: () => onNavigate('request') },
          { label: 'New Request', current: true }
        ]}
      />

      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Submit New Request</h1>
          <p className="page-subtitle">Select an office and provide details for your academic request</p>
        </div>
      </div>

      <div className="new-request-content">
        <div className="new-request-main">
          <form className="request-form-container" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            {error && (
              <div className="error-message">
                <MdError className="error-icon" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Office Selection */}
            <section className="form-section-card">
              <div className="section-header">
                <span className="step-badge">1</span>
                <div className="section-header-text">
                  <div className="section-title-row">
                    <h3 className="section-title">Select Office</h3>
                    <span className="section-desc-inline">— Choose the school department that handles your request</span>
                  </div>
                </div>
              </div>

              <div className="office-grid">
                {offices.map((office) => {
                  const isSelected = selectedOffice === office.id;
                  return (
                    <div
                      key={office.id}
                      className={`office-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedOffice(office.id);
                        setSubject(''); // Reset subject when office changes
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedOffice(office.id);
                          setSubject('');
                        }
                      }}
                    >
                      <div className="office-card-header">
                        <div className="office-icon-wrap">
                          {getOfficeIcon(office.id)}
                        </div>
                        <div className="radio-button">
                          {isSelected && <div className="radio-inner"></div>}
                        </div>
                      </div>
                      <div className="office-info">
                        <h4>{office.name}</h4>
                        <p>{office.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Section 2: Request Details */}
            <section className="form-section-card">
              <div className="section-header">
                <span className="step-badge">2</span>
                <div className="section-header-text">
                  <div className="section-title-row">
                    <h3 className="section-title">Request Details</h3>
                    <span className="section-desc-inline">— Specify the subject and detailed explanation of your request</span>
                  </div>
                </div>
              </div>

              <div className="input-field-group">
                <label htmlFor="subject">
                  Subject <span className="required-star">*</span>
                </label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!selectedOffice}
                  className="subject-select"
                >
                  <option value="">
                    {selectedOffice ? 'Select a subject from the list' : 'Please select an office first'}
                  </option>
                  {selectedOffice && offices.find(o => o.id === selectedOffice)?.subjects.map((subj, index) => (
                    <option key={index} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-field-group">
                <div className="label-row">
                  <label htmlFor="description">
                    Detailed Description <span className="required-star">*</span>
                  </label>
                  {isValidating && (
                    <span className="validation-status validating">Checking...</span>
                  )}
                  {validationResult && validationResult.isValid && validationResult.errors.length === 0 && (
                    <span className="validation-status valid">
                      <MdCheckCircle /> Content verified
                    </span>
                  )}
                </div>
                <textarea
                  id="description"
                  placeholder="Provide complete details (e.g., student ID, purpose of request, relevant dates, or specific document names) to help staff process your ticket quickly..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className={
                    validationResult && !validationResult.isValid ? 'has-error' :
                    validationResult && validationResult.warnings.length > 0 ? 'has-warning' : ''
                  }
                />
                
                {/* Validation feedback */}
                {validationResult && (
                  <div className="validation-feedback">
                    {validationResult.errors.length > 0 && (
                      <div className="validation-errors">
                        {validationResult.errors.map((err, index) => (
                          <div key={index} className="validation-message error">
                            <MdError className="icon" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {validationResult.warnings.length > 0 && (
                      <div className="validation-warnings">
                        {validationResult.warnings.map((warn, index) => (
                          <div key={index} className="validation-message warning">
                            <MdWarning className="icon" />
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Section 3: Supporting Documents */}
            <section className="form-section-card">
              <div className="section-header">
                <span className="step-badge">3</span>
                <div className="section-header-text">
                  <div className="section-title-row">
                    <h3 className="section-title">Supporting Documents <span className="optional-tag">(Optional)</span></h3>
                    <span className="section-desc-inline">— Attach files such as receipts, valid IDs, clearance forms, or screenshots</span>
                  </div>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              
              <div 
                className="upload-area" 
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="upload-icon-circle">
                  <FaFileUpload className="upload-icon" />
                </div>
                <p className="upload-text">Click to choose files or drag and drop</p>
                <p className="upload-limit">Images up to 10MB (auto-compressed), documents (PDF, DOC) up to 5MB</p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="uploaded-files-list">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="uploaded-file-item">
                      <div className="file-item-left">
                        <MdAttachFile className="file-type-icon" />
                        <div className="file-info">
                          <span className="file-name">{file.name}</span>
                          <span className="file-size">{formatFileSize(file.size)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="remove-file-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        aria-label={`Remove file ${file.name}`}
                      >
                        <MdClose />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Form Actions */}
            <div className="form-actions-bar">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => onNavigate('request')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn-request"
                disabled={loading || !isFormValid}
                title={!isFormValid ? 'Complete all required fields to submit' : undefined}
              >
                {loading && <span className="btn-spinner"></span>}
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Column (Right - 340px) */}
        <aside className="new-request-sidebar" aria-label="Guidelines and office info">
          {/* Submission Guidelines Card */}
          <div className="req-sidebar-card guidelines-card">
            <h4 className="guidelines-title">
              <FaShieldAlt className="title-icon" /> Submission Guidelines
            </h4>
            <ul className="guidelines-list">
              <li>
                <strong>Daily Ticket Allowance</strong>
                <span>Up to 2 requests per department daily to ensure timely turnaround.</span>
              </li>
              <li>
                <strong>Official Processing</strong>
                <span>Tickets are reviewed by staff during school hours (Mon–Fri 7AM–7PM).</span>
              </li>
              <li>
                <strong>Clear Documentation</strong>
                <span>Include valid student ID, dates, and receipts to prevent delays.</span>
              </li>
            </ul>
          </div>

          {/* Quick FAQ Link Card */}
          <div className="req-sidebar-card faq-promo-card">
            <div className="faq-promo-header">
              <MdHelpOutline className="faq-promo-icon" />
              <div>
                <h4>Have questions first?</h4>
                <p>Check the FAQs for guides on ticket statuses, processing times, and policies.</p>
              </div>
            </div>
            <button
              type="button"
              className="faq-promo-btn"
              onClick={() => onNavigate('faq')}
            >
              Browse FAQs
            </button>
          </div>
        </aside>
      </div>

      {loading && <LoadingSpinner message="Submitting your request..." fullScreen={true} />}
    </div>
  );
}

export default NewRequest;
