import { useState, useRef, useEffect } from 'react';
import { FaFileUpload } from 'react-icons/fa';
import { MdClose, MdCheckCircle, MdWarning, MdError } from 'react-icons/md';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
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

  return (
    <div className="new-request-page">
      <Breadcrumb
        items={[
          { label: 'Request History', onClick: () => onNavigate('request') },
          { label: 'New Request', current: true }
        ]}
      />

      <div className="page-header">
        <h1>Submit New Request</h1>
      </div>

      <div className="request-form">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-section">
          <h3>Select Office</h3>
          <div className="office-grid">
            {offices.map((office) => (
              <div
                key={office.id}
                className={`office-card ${selectedOffice === office.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedOffice(office.id);
                  setSubject(''); // Reset subject when office changes
                }}
              >
                <div className="radio-button">
                  {selectedOffice === office.id && <div className="radio-inner"></div>}
                </div>
                <div className="office-info">
                  <h4>{office.name}</h4>
                  <p>{office.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <label htmlFor="subject">Subject</label>
          <select
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!selectedOffice}
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

        <div className="form-section">
          <label htmlFor="description">
            Detailed Description
            {isValidating && <span className="validation-status validating"> (Checking...)</span>}
            {validationResult && validationResult.isValid && validationResult.errors.length === 0 && (
              <span className="validation-status valid">
                <MdCheckCircle /> Valid
              </span>
            )}
          </label>
          <textarea
            id="description"
            placeholder="Please provide as much detail as possible..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className={
              validationResult && !validationResult.isValid ? 'has-error' :
              validationResult && validationResult.warnings.length > 0 ? 'has-warning' : ''
            }
          />
          
          {/* Validation feedback */}
          {validationResult && (
            <div className="validation-feedback">
              {/* Errors */}
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
              
              {/* Warnings */}
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

        <div className="form-section">
          <label>Attach File <span className="optional">(Optional - Images up to 10MB, documents up to 5MB)</span></label>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          
          <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
            <FaFileUpload className="upload-icon" />
            <p className="upload-text">Click to upload or drag and drop</p>
            <p className="upload-limit">Images auto-compressed, documents up to 5MB</p>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="uploaded-files-list">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="uploaded-file-item">
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
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

        <div className="form-actions">
          <button
            className="submit-btn-request"
            onClick={handleSubmit}
            disabled={loading || !isFormValid}
            title={!isFormValid ? 'Complete all required fields to submit' : undefined}
          >
            {loading && <span className="btn-spinner"></span>}
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
      
      {loading && <LoadingSpinner message="Submitting your request..." fullScreen={true} />}
    </div>
  );
}

export default NewRequest;
