import React, { useState, useEffect } from 'react';
import { FaDollarSign, FaBook, FaUsers, FaClipboardList, FaShieldAlt, FaEye, FaEyeSlash, FaQrcode, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Html5Qrcode } from 'html5-qrcode';
import { decryptCredentials } from '../utils/qrEncryption';
import '../styles/Login.css';

const Login = ({ onLogin, onForgotPassword }) => {
  const [selectedDepartment, setSelectedDepartment] = useState('finance');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState(null);
  const [scanningStatus, setScanningStatus] = useState('initializing');

  const departments = [
    { id: 'finance', name: 'Finance', icon: FaDollarSign },
    { id: 'library', name: 'Library', icon: FaBook },
    { id: 'guidance', name: 'Guidance', icon: FaUsers },
    { id: 'registrar', name: 'Registrar', icon: FaClipboardList }
  ];

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Validation
    if (!username.trim()) {
      setError('Please enter your username');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }
    
    try {
      // First, find the staff member by username and office
      const staffQuery = query(
        collection(db, 'staff'),
        where('username', '==', username.trim()),
        where('officeId', '==', selectedDepartment)
      );
      
      const querySnapshot = await getDocs(staffQuery);
      
      if (querySnapshot.empty) {
        setError('Invalid username or office. Please check your credentials.');
        setLoading(false);
        return;
      }

      const staffDoc = querySnapshot.docs[0];
      const staffData = staffDoc.data();

      // Check if staff is active
      if (!staffData.isActive) {
        setError('Your account has been suspended. Please contact the administrator.');
        setLoading(false);
        return;
      }

      // Authenticate with Firebase using email and password
      await signInWithEmailAndPassword(auth, staffData.email, password);

      // Store staff info in localStorage
      const staffInfo = {
        name: staffData.name,
        fullName: staffData.name, // Save as fullName for compatibility
        firstName: staffData.firstName || '',
        lastName: staffData.lastName || '',
        email: staffData.email,
        username: staffData.username,
        office: staffData.office,
        officeId: staffData.officeId,
        position: staffData.position || '',
        staffId: staffData.staffId || '',
        phoneNumber: staffData.phoneNumber || '',
        profilePicture: staffData.profilePicture || '',
        uid: staffData.uid,
        firestoreDocId: staffDoc.id // Save the document ID
      };
      
      localStorage.setItem('staffData', JSON.stringify(staffInfo));
      
      console.log('[Success] Staff logged in:', staffData.name);
      onLogin(staffData.office);
      
    } catch (error) {
      console.error('[Error] Login error:', error);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Invalid password. Please try again.');
      } else if (error.code === 'auth/user-not-found') {
        setError('Staff account not found.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
      
      setLoading(false);
    }
  };

  // Cleanup QR scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScanner) {
        try {
          const state = qrScanner.getState();
          if (state === 2) {
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
    
    setTimeout(() => {
      initializeQRScanner();
    }, 200);
  };

  const initializeQRScanner = async () => {
    try {
      console.log('[Config] Initializing QR scanner...');
      
      const scanner = new Html5Qrcode("qr-reader-admin");
      setQrScanner(scanner);
      
      console.log('[Camera] Starting camera...');
      
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 20,
          qrbox: 250,
          aspectRatio: 1.0,
          disableFlip: false,
          formatsToSupport: [0]
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

  const onScanSuccess = async (decodedText, decodedResult) => {
    console.log('[Success] QR Code scanned, raw data:', decodedText);
    setScanningStatus('success');
    
    if (qrScanner) {
      try {
        await qrScanner.stop();
        console.log('Scanner stopped successfully');
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setShowQRScanner(false);
    setLoading(true);
    setError('');

    try {
      if (decodedText.length < 20) {
        console.error('[Error] Scanned data too short to be encrypted:', decodedText);
        setScanningStatus('error');
        setError('Invalid QR code. Please scan a valid admin login QR code.');
        setLoading(false);
        return;
      }
      
      console.log('[Decryption] Decrypting QR code data...');
      const credentials = decryptCredentials(decodedText);
      
      if (!credentials) {
        console.error('[Error] Invalid or corrupted QR code - decryption failed');
        setScanningStatus('error');
        setError('Invalid QR code. This QR code cannot be read or is from a different application.');
        setLoading(false);
        return;
      }
      
      const { username, password, office } = credentials;
      console.log('[Success] QR code decrypted successfully');
      console.log('[User] Username from QR:', username);
      console.log('[Office] Office from QR:', office);

      // Find staff member by username and office
      console.log('[Search] Searching for staff with username:', username, 'and office:', office);
      const staffQuery = query(
        collection(db, 'staff'),
        where('username', '==', username),
        where('officeId', '==', office)
      );
      
      const querySnapshot = await getDocs(staffQuery);

      if (querySnapshot.empty) {
        console.error('[Error] Staff not found in database');
        setScanningStatus('error');
        setError('Staff account not found. Please contact the administrator.');
        setLoading(false);
        return;
      }

      const staffDoc = querySnapshot.docs[0];
      const staffData = staffDoc.data();
      console.log('[Success] Staff found:', staffData);

      if (!staffData.isActive) {
        console.error('[Error] Account suspended');
        setScanningStatus('error');
        setError('Your account has been suspended. Please contact the administrator.');
        setLoading(false);
        return;
      }

      // Authenticate with Firebase
      console.log('[Encryption] Attempting automatic login with email:', staffData.email);
      await signInWithEmailAndPassword(auth, staffData.email, password);

      // Store staff info in localStorage
      const staffInfo = {
        name: staffData.name,
        fullName: staffData.name,
        firstName: staffData.firstName || '',
        lastName: staffData.lastName || '',
        email: staffData.email,
        username: staffData.username,
        office: staffData.office,
        officeId: staffData.officeId,
        position: staffData.position || '',
        staffId: staffData.staffId || '',
        phoneNumber: staffData.phoneNumber || '',
        profilePicture: staffData.profilePicture || '',
        uid: staffData.uid,
        firestoreDocId: staffDoc.id
      };
      
      localStorage.setItem('staffData', JSON.stringify(staffInfo));
      
      console.log('[Success] Login successful via QR code!');
      onLogin(staffData.office);
      setLoading(false);

    } catch (error) {
      console.error('[Error] QR Login error:', error);
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
    if (errorMessage.includes('NotAllowedError')) {
      console.error('🚫 Camera access denied:', errorMessage);
      setScanningStatus('error');
      setError('Camera access denied. Please allow camera permissions and try again.');
    } else if (errorMessage.includes('NotFoundError')) {
      console.error('📷 No camera found:', errorMessage);
      setScanningStatus('error');
      setError('No camera found on this device.');
    }
  };

  const handleCloseQRScanner = () => {
    if (qrScanner) {
      try {
        const state = qrScanner.getState();
        console.log('Scanner state before closing:', state);
        
        if (state === 2) {
          qrScanner.stop()
            .then(() => console.log('Scanner stopped successfully'))
            .catch(err => console.log('Scanner stop warning:', err));
        } else {
          console.log('Scanner not running, skipping stop');
        }
      } catch (err) {
        console.log('Scanner close error:', err);
      }
      setQrScanner(null);
    }
    setShowQRScanner(false);
    setScanningStatus('initializing');
  };

  const handleUploadQRCode = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    try {
      setLoading(true);
      setScanningStatus('initializing');
      console.log('[Upload] Processing uploaded QR code image...');
      console.log('[File] File name:', file.name, 'Size:', file.size, 'Type:', file.type);

      const scanner = new Html5Qrcode("qr-reader-admin");
      const decodedText = await scanner.scanFile(file, true);
      
      console.log('[Success] QR Code decoded from image');
      console.log('[Note] Decoded length:', decodedText.length, 'characters');
      setScanningStatus('success');
      
      await onScanSuccess(decodedText, null);
      event.target.value = '';
      
    } catch (error) {
      console.error('[Error] Error scanning uploaded QR code:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      setScanningStatus('error');
      
      if (error.message && error.message.includes('No MultiFormat Readers')) {
        setError('Could not detect QR code in the image. Please try:\n1. Using the camera scanner instead\n2. Ensuring the image is clear and not cropped\n3. Regenerating the QR code');
      } else {
        setError('Failed to read QR code from image. Please try using the camera scanner or regenerate your QR code.');
      }
      setLoading(false);
    }
  };

  return (
    <div className={`login-page ${showQRScanner ? 'modal-open' : ''}`}>
      <div
        className="login-bg-photo"
        style={{ backgroundImage: "url('/school-cover.jpg')" }}
        aria-hidden="true"
      ></div>
      <div className="login-card">
        <div className="login-left">
          <img
            src="/school-logo.jpg"
            alt="Academia De San Jose school logo"
            className="school-logo-large"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        
        <div className="login-right">
          <div className="login-form-container">
          <div className="login-header">
            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">Please enter your credentials to continue.</p>
          </div>
          
          <form onSubmit={handleSignIn}>
            {error && (
              <div className="error-message" style={{
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                color: '#c33',
                padding: '12px 18px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}
            
            <div className="department-section">
              <label className="section-label">Administrative Department</label>
              <div className="department-grid">
                {departments.map((dept) => {
                  const Icon = dept.icon;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      className={`department-button ${selectedDepartment === dept.id ? 'selected' : ''}`}
                      onClick={() => setSelectedDepartment(dept.id)}
                      disabled={loading}
                    >
                      <Icon className="department-icon" />
                      <span>{dept.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <div className="password-label-row">
                <label className="form-label" htmlFor="password">Password</label>
                <a href="#" className="forgot-password" onClick={(e) => { e.preventDefault(); onForgotPassword(); }}>Forgot Password?</a>
              </div>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
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
            
            <div className="remember-section">
              <input
                type="checkbox"
                id="remember"
                className="remember-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor="remember" className="remember-label">
                Remember this session for 8 hours
              </label>
            </div>
            
            <button type="submit" className="sign-in-button" disabled={loading} aria-busy={loading}>
              {loading && <span className="btn-spinner" aria-hidden="true" />}
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <div className="divider-student">
              <span>or</span>
            </div>

            <button type="button" className="alt-login-btn" onClick={handleQRLogin} disabled={loading}>
              <FaQrcode />
              Login with QR code
            </button>
            
            <div className="support-section">
              <p className="support-text">
                Need Assistance? <a href="#" className="support-link">Contact IT Support</a>
              </p>
            </div>
            
            <div className="secure-badge">
              <FaShieldAlt className="secure-icon" />
              <p className="secure-text">Encrypted Secure Connection</p>
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
              <h2>Scan Your Admin QR Code</h2>
              <button className="close-scanner-btn" onClick={handleCloseQRScanner}>
                <FaTimes />
              </button>
            </div>
            
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
                  <p>⚠ Error scanning QR code</p>
                </div>
              )}
            </div>
            
            <p className="qr-scanner-instructions">
              <strong>How to scan:</strong><br />
              1. Allow camera access when prompted<br />
              2. Position your QR code inside the green square<br />
              3. Hold steady - automatic login will happen instantly
            </p>
            <div id="qr-reader-admin" className="qr-reader-container"></div>
            
            <div className="qr-upload-section">
              <div className="divider-qr">
                <span>or</span>
              </div>
              <label htmlFor="qr-file-upload-admin" className="qr-upload-btn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm5 11h-4v4H9v-4H5V9h4V5h2v4h4v2z"/>
                </svg>
                Upload QR Code Image
              </label>
              <input
                id="qr-file-upload-admin"
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
