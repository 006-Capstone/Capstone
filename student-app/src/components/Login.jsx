import React, { useState, useEffect } from 'react';
import { FaQrcode, FaUserCircle, FaShieldAlt, FaEye, FaEyeSlash, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { decryptCredentials } from '../utils/qrEncryption';
import '../styles/Login.css';

const Login = ({ onLogin, onGuestLogin, onForgotPassword }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState(null);
  const [scanningStatus, setScanningStatus] = useState('initializing'); // 'initializing', 'ready', 'scanning', 'success', 'error'

  // Load remembered student ID on mount
  useEffect(() => {
    const rememberedId = localStorage.getItem('rememberedStudentId');
    if (rememberedId) {
      setStudentId(rememberedId);
      setRememberDevice(true);
    }
  }, []);

  const handleStudentIdChange = (e) => {
    const value = e.target.value;
    // Only allow digits and max 4 characters
    if (/^\d{0,4}$/.test(value)) {
      setStudentId(value);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate student ID is exactly 4 digits
      if (!studentId || studentId.length !== 4) {
        setError('Student ID must be exactly 4 digits');
        setLoading(false);
        return;
      }

      if (!password) {
        setError('Please enter your password');
        setLoading(false);
        return;
      }

      // Find student by Student ID in Firestore (check both 'id' and 'studentId' fields)
      const studentsRef = collection(db, 'students');
      let q = query(studentsRef, where('id', '==', studentId));
      let querySnapshot = await getDocs(q);

      // If not found by 'id', try 'studentId' field
      if (querySnapshot.empty) {
        q = query(studentsRef, where('studentId', '==', studentId));
        querySnapshot = await getDocs(q);
      }

      // If still not found, try with full format XX-XXXX-XXXXXX across common academic years
      if (querySnapshot.empty) {
        const fullIdPattern = studentId.padStart(4, '0');
        const yearPrefixes = ['05-2324-', '05-2425-', '05-2526-', '05-2627-'];
        for (const prefix of yearPrefixes) {
          q = query(studentsRef, where('studentId', '==', `${prefix}${fullIdPattern}`));
          querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) break;
        }
      }

      if (querySnapshot.empty) {
        setError('Invalid Student ID or password');
        setLoading(false);
        return;
      }

      // Get student data
      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      const firestoreDocId = studentDoc.id; // Save the Firestore document ID
      
      console.log('[Data] Raw student data from Firestore:', studentData);
      console.log('📌 Firestore document ID:', firestoreDocId);

      // Check if account is active
      if (studentData.isActive === false) {
        setError('Your account has been suspended. Please contact administration.');
        setLoading(false);
        return;
      }

      // Sign in with Firebase Authentication using email and password
      await signInWithEmailAndPassword(auth, studentData.email, password);

      // Save or remove remembered student ID based on checkbox
      if (rememberDevice) {
        localStorage.setItem('rememberedStudentId', studentId);
      } else {
        localStorage.removeItem('rememberedStudentId');
      }

      // Prepare student data for localStorage - handle both new and legacy formats
      const formattedStudentData = {
        firestoreDocId: firestoreDocId, // Store the actual Firestore document ID
        uid: studentData.uid || auth.currentUser.uid,
        studentId: studentData.studentId || studentData.id || studentId,
        id: studentData.id || studentId, // Keep legacy 'id' field for compatibility
        firstName: studentData.firstName || studentData.name?.split(' ')[0] || '',
        lastName: studentData.lastName || studentData.name?.split(' ').slice(1).join(' ') || '',
        middleName: studentData.middleName || '',
        suffix: studentData.suffix || '',
        email: studentData.email,
        name: studentData.name || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim(),
        gradeLevel: studentData.gradeLevel || '',
        section: studentData.section || '',
        phoneNumber: studentData.phoneNumber || '',
        profilePicture: studentData.profilePicture || '',
        twoFactorEnabled: studentData.twoFactorEnabled || false,
        mustChangePassword: studentData.mustChangePassword || false // Flag for forced password change
      };
      
      console.log('[Success] Formatted student data for localStorage:', formattedStudentData);
      
      // Save student data to localStorage with all fields
      localStorage.setItem('studentData', JSON.stringify(formattedStudentData));

      // Login successful
      onLogin();
      setLoading(false);

    } catch (error) {
      console.error('Login error:', error);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        setError('Invalid Student ID or password');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/invalid-credential') {
        setError('Invalid Student ID or password');
      } else {
        setError('Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    // Cleanup QR scanner on unmount
    return () => {
      if (qrScanner) {
        try {
          const state = qrScanner.getState();
          if (state === 2) { // Only stop if scanning
            qrScanner.stop().catch(err => console.log('Cleanup stop warning:', err));
          }
        } catch (err) {
          console.log('Cleanup error:', err);
        }
      }
    };
  }, [qrScanner]);

  const handleQRLogin = async () => {
    setShowQRScanner(true);
    setError('');
    setScanningStatus('initializing');
    
    // Wait for DOM to be ready
    setTimeout(() => {
      initializeQRScanner();
    }, 200);
  };

  const initializeQRScanner = async () => {
    try {
      console.log('[Config] Initializing QR scanner...');
      
      const scanner = new Html5Qrcode("qr-reader");
      setQrScanner(scanner);
      
      console.log('[Camera] Starting camera...');
      
      await scanner.start(
        { facingMode: "environment" }, // Use back camera
        {
          fps: 20, // Increased from 10 to 20 for faster detection
          qrbox: 250, // Simplified to just a number
          aspectRatio: 1.0,
          disableFlip: false,
          // Only focus on QR codes
          formatsToSupport: [0] // QR_CODE only
        },
        onScanSuccess,
        onScanError
      );
      
      setScanningStatus('ready');
      console.log('[Success] Camera started successfully - Ready to scan');
      
    } catch (error) {
      console.error('[Error] Error initializing QR scanner:', error);
      setScanningStatus('error');
      setError('Failed to start camera. Please ensure camera permissions are granted.');
    }
  };

  const scanFileWithScales = async (file) => {
    // Dedicated instance on helper element to avoid interfering with camera DOM
    const helperContainerId = "qr-reader-file-helper";
    const scanner = new Html5Qrcode(helperContainerId);

    try {
      // 1. Direct file scan attempt
      try {
        const directResult = await scanner.scanFile(file, false);
        if (directResult) return directResult;
      } catch (directErr) {
        console.log('[Upload] Direct scan could not detect code, trying multi-scale resamples...', directErr);
      }

      // 2. Multi-scale canvas fallbacks (fixes subpixel module rounding in ZXing for images like 300x300)
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
      });

      const candidateSizes = [500, 400, 600, 750, 350];
      for (const size of candidateSizes) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.imageSmoothingEnabled = false; // Nearest-neighbor scaling preserves crisp pixel boundaries
          ctx.drawImage(img, 0, 0, size, size);

          const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
          if (blob) {
            const scaledFile = new File([blob], 'qr-scaled.png', { type: 'image/png' });
            const result = await scanner.scanFile(scaledFile, false);
            if (result) {
              console.log(`[Upload] QR Code detected successfully at scale ${size}px`);
              return result;
            }
          }
        } catch (scaleErr) {
          // Continue to next size
        }
      }

      throw new Error('Could not detect QR code in the image. Please ensure the image is clear and not cropped.');
    } finally {
      try {
        scanner.clear();
      } catch (clearErr) {
        // ignore
      }
    }
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    console.log('[Success] QR Code scanned, raw data:', decodedText);
    console.log('[Stats] Decoded result:', decodedResult);
    setScanningStatus('success');
    
    // Stop scanner safely if running
    if (qrScanner) {
      try {
        const state = qrScanner.getState();
        if (state === 2) {
          await qrScanner.stop();
          console.log('Scanner stopped successfully');
        }
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
    
    // Small delay to show success message
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setShowQRScanner(false);
    setLoading(true);
    setError('');

    try {
      // Check if this looks like encrypted data (should be long string)
      if (decodedText.length < 20) {
        console.error('[Error] Scanned data too short to be encrypted:', decodedText);
        setScanningStatus('error');
        setError('Invalid QR code. Please scan a valid student login QR code.');
        setLoading(false);
        return;
      }
      
      // Decrypt the QR code data
      console.log('[Decryption] Decrypting QR code data (length:', decodedText.length, ')...');
      const credentials = decryptCredentials(decodedText);
      
      if (!credentials) {
        console.error('[Error] Invalid or corrupted QR code - decryption failed');
        setScanningStatus('error');
        setError('Invalid QR code. This QR code cannot be read or is from a different application.');
        setLoading(false);
        return;
      }
      
      const { studentId, password } = credentials;
      console.log('[Success] QR code decrypted successfully');
      console.log('[ID] Student ID from QR:', studentId, '(length:', studentId.length, ')');
      console.log('[Key] Password length:', password.length);

      // Validate student ID format - must be exactly 4 digits
      if (!/^\d{4}$/.test(studentId)) {
        console.error('[Error] Invalid student ID format in QR:', studentId, '- expected 4 digits');
        setScanningStatus('error');
        setError(`Invalid QR code data format. Expected 4-digit ID, got: ${studentId}`);
        setLoading(false);
        return;
      }

      // Find student by Student ID
      console.log('[Search] Searching for student with ID:', studentId);
      const studentsRef = collection(db, 'students');
      let q = query(studentsRef, where('id', '==', studentId));
      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('Not found by id field, trying studentId field...');
        q = query(studentsRef, where('studentId', '==', studentId));
        querySnapshot = await getDocs(q);
      }

      // If still not found, try with full format XX-XXXX-XXXXXX across common academic years
      if (querySnapshot.empty) {
        const fullIdPattern = studentId.padStart(4, '0');
        const yearPrefixes = ['05-2324-', '05-2425-', '05-2526-', '05-2627-'];
        for (const prefix of yearPrefixes) {
          q = query(studentsRef, where('studentId', '==', `${prefix}${fullIdPattern}`));
          querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) break;
        }
      }

      if (querySnapshot.empty) {
        console.error('[Error] Student not found in database with ID:', studentId);
        setScanningStatus('error');
        setError(`Student not found. Please contact the administrator. (ID: ${studentId})`);
        setLoading(false);
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      const firestoreDocId = studentDoc.id;
      console.log('[Success] Student found:', studentData);

      if (studentData.isActive === false) {
        console.error('[Error] Account suspended');
        setScanningStatus('error');
        setError('Your account has been suspended. Please contact the administrator.');
        setLoading(false);
        return;
      }

      // Attempt automatic login with decrypted password
      console.log('[Encryption] Attempting automatic login with email:', studentData.email);
      await signInWithEmailAndPassword(auth, studentData.email, password);

      // Save remembered student ID if checkbox was selected
      if (rememberDevice) {
        localStorage.setItem('rememberedStudentId', studentId);
      }

      // Prepare student data for localStorage
      const formattedStudentData = {
        firestoreDocId: firestoreDocId,
        uid: studentData.uid || auth.currentUser.uid,
        studentId: studentData.studentId || studentData.id || studentId,
        id: studentData.id || studentId,
        firstName: studentData.firstName || studentData.name?.split(' ')[0] || '',
        lastName: studentData.lastName || studentData.name?.split(' ').slice(1).join(' ') || '',
        middleName: studentData.middleName || '',
        suffix: studentData.suffix || '',
        email: studentData.email,
        name: studentData.name || `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim(),
        gradeLevel: studentData.gradeLevel || '',
        section: studentData.section || '',
        phoneNumber: studentData.phoneNumber || '',
        profilePicture: studentData.profilePicture || '',
        twoFactorEnabled: studentData.twoFactorEnabled || false,
        mustChangePassword: studentData.mustChangePassword || false // Flag for forced password change
      };
      
      console.log('[Success] Login successful via QR code!');
      localStorage.setItem('studentData', JSON.stringify(formattedStudentData));

      // Login successful
      onLogin();
      setLoading(false);

    } catch (error) {
      console.error('[Error] QR Login error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      setScanningStatus('error');
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('QR code password is incorrect or outdated. Please generate a new QR code from your profile settings.');
      } else if (error.message && error.message.includes('decrypt')) {
        setError('Invalid QR code. This QR code is not compatible with this application.');
      } else {
        setError(`Failed to process QR code: ${error.message}. Please try manual login or generate a new QR code.`);
      }
      setLoading(false);
    }
  };

  const onScanError = (errorMessage) => {
    // The scanner continuously tries to read, so errors are normal
    // Only log critical errors
    if (errorMessage.includes('NotAllowedError')) {
      console.error('🚫 Camera access denied:', errorMessage);
      setScanningStatus('error');
      setError('Camera access denied. Please allow camera permissions and try again.');
    } else if (errorMessage.includes('NotFoundError')) {
      console.error('📷 No camera found:', errorMessage);
      setScanningStatus('error');
      setError('No camera found on this device.');
    }
    // Ignore "NotFoundException" - it just means no QR code detected yet
  };

  const handleCloseQRScanner = async () => {
    if (qrScanner) {
      try {
        // Get the scanner state before stopping
        const state = qrScanner.getState();
        console.log('Scanner state before closing:', state);
        
        // Only stop if scanner is actually running
        if (state === 2) { // 2 = SCANNING state
          await qrScanner.stop().catch(err => console.log('Scanner stop warning:', err));
        }
      } catch (err) {
        console.log('Scanner close error:', err);
      }
      try {
        qrScanner.clear();
      } catch (clearErr) {
        // ignore
      }
      setQrScanner(null);
    }
    setShowQRScanner(false);
    setScanningStatus('initializing');
    setLoading(false);
  };

  const handleUploadQRCode = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const inputElement = event.target;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      inputElement.value = '';
      return;
    }

    try {
      setLoading(true);
      setScanningStatus('initializing');
      setError('');
      console.log('[Upload] Processing uploaded QR code image...', file.name, 'Size:', file.size);

      // Stop active camera stream if running to prevent resource locks
      if (qrScanner) {
        try {
          const state = qrScanner.getState();
          if (state === 2) {
            await qrScanner.stop();
            console.log('[Camera] Scanner stopped for file upload');
          }
        } catch (stopErr) {
          console.log('[Camera] Stop camera error:', stopErr);
        }
      }

      // Scan the uploaded image with multi-scale fallback
      const decodedText = await scanFileWithScales(file);
      console.log('[Success] QR Code decoded from image, length:', decodedText.length);
      setScanningStatus('success');

      // Process the scanned QR code (same as camera scan)
      await onScanSuccess(decodedText, null);

    } catch (error) {
      console.error('[Error] Error scanning uploaded QR code:', error);
      setScanningStatus('error');
      if (error.message && (error.message.includes('No MultiFormat Readers') || error.message.includes('not detect'))) {
        setError('Could not detect QR code in the image. Please ensure the image is clear and not cropped, or try using the camera scanner.');
      } else {
        setError(error.message || 'Failed to read QR code from image. Please try again.');
      }
      setLoading(false);
    } finally {
      if (inputElement) {
        inputElement.value = '';
      }
    }
  };

  const handleGuestLogin = () => {
    onGuestLogin();
  };

  return (
    <div className={`login-container-student ${showQRScanner ? 'modal-open' : ''}`}>
      <div
        className="login-bg-photo"
        style={{ backgroundImage: "url('/school-cover.jpg')" }}
        aria-hidden="true"
      ></div>
      <div className="login-split-view">
        <div className="login-left-section">
          <img
            src="/logo.jpg"
            alt="Academia De San Jose school logo"
            className="login-school-logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        <div className="login-right-section">
          <div className="login-form-card">
            <h1 className="login-welcome-title">Welcome Back</h1>
            <p className="login-subtitle">Please enter your credentials to access your account.</p>

            <form onSubmit={handleSubmit} className="login-form-student">
              {error && (
                <div className="error-message-student">
                  {error}
                </div>
              )}

              <div className="form-group-student">
                <label className="form-label-student" htmlFor="studentId">Student ID</label>
                <input
                  type="text"
                  id="studentId"
                  name="studentId"
                  className="form-input-student"
                  value={studentId}
                  onChange={handleStudentIdChange}
                  placeholder="Enter your 4-digit student ID"
                  maxLength="4"
                  pattern="\d{4}"
                  autoComplete="username"
                />
              </div>

              <div className="form-group-student">
                <div className="label-row">
                  <label className="form-label-student" htmlFor="password">Password</label>
                  <button 
                    type="button"
                    className="forgot-password-link" 
                    onClick={onForgotPassword}
                  >
                    Forget Password?
                  </button>
                </div>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    className="form-input-student"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="remember-device-row">
                <input
                  type="checkbox"
                  id="rememberDevice"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="remember-checkbox"
                />
                <label htmlFor="rememberDevice" className="remember-label">
                  Remember this device
                </label>
              </div>

              <button type="submit" className="sign-in-btn-student" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="divider-student">
                <span>or</span>
              </div>

              <button type="button" className="alt-login-btn" onClick={handleQRLogin}>
                <FaQrcode />
                Login with QR code
              </button>

              <button type="button" className="alt-login-btn" onClick={handleGuestLogin}>
                <FaUserCircle />
                Continue as Guest
              </button>

              <p className="contact-admissions">
                New student? <a href="#" className="contact-link">Contact Admissions</a>
              </p>

              <div className="secure-badge">
                <FaShieldAlt className="shield-icon" />
                <span>Secure-bit Connection Verified</span>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="qr-scanner-modal">
          <div className="qr-scanner-content">
            <div className="qr-scanner-header">
              <h2>Scan Your QR Code</h2>
              <button className="close-scanner-btn" onClick={handleCloseQRScanner}>
                <FaTimes />
              </button>
            </div>
            
            {/* Scanning Status Indicator */}
            <div className={`scanning-status ${scanningStatus}`}>
              {scanningStatus === 'initializing' && (
                <div className="status-message initializing">
                  <div className="spinner"></div>
                  <p>Initializing camera...</p>
                </div>
              )}
              {scanningStatus === 'ready' && (
                <div className="status-message ready">
                  <div className="pulse-indicator"></div>
                  <p>🔍 Scanning... Position QR code in frame</p>
                </div>
              )}
              {scanningStatus === 'success' && (
                <div className="status-message success">
                  <FaCheckCircle className="status-icon" />
                  <p>✓ QR Code detected successfully!</p>
                </div>
              )}
              {scanningStatus === 'error' && (
                <div className="status-message error">
                  <p>⚠ {error || 'Error scanning QR code'}</p>
                </div>
              )}
            </div>
            
            <p className="qr-scanner-instructions">
              <strong>How to scan:</strong><br />
              1. Allow camera access when prompted<br />
              2. You will see a live camera view below<br />
              3. Position your QR code inside the green square<br />
              4. Hold steady - automatic login will happen instantly
            </p>
            <div id="qr-reader" className="qr-reader-container"></div>
            <div id="qr-reader-file-helper" style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}></div>
            
            {/* Upload QR Code Option */}
            <div className="qr-upload-section">
              <div className="divider-qr">
                <span>or</span>
              </div>
              <label htmlFor="qr-file-upload" className="qr-upload-btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm5 11h-4v4H9v-4H5V9h4V5h2v4h4v2z"/>
                </svg>
                Upload QR Code Image
              </label>
              <input
                id="qr-file-upload"
                type="file"
                accept="image/*"
                onChange={handleUploadQRCode}
                style={{ display: 'none' }}
              />
            </div>
            
            <div className="qr-scanner-footer">
              <p>Don't have a QR code? Download it from your profile settings after logging in manually.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
