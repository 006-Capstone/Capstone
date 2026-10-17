import React, { useState, useEffect, useRef } from 'react';
import { FaQrcode, FaUserCircle, FaShieldAlt, FaEye, FaEyeSlash, FaTimes, FaCheckCircle, FaSpinner, FaExclamationCircle, FaFileUpload, FaInfoCircle, FaSyncAlt, FaQuestionCircle } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import jsQR from 'jsqr';
import {
  QRCodeReader,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer
} from '@zxing/library';
import { decryptCredentials } from '../utils/qrEncryption';
import ContactAdmissionsModal from './ContactAdmissionsModal';
import StudentFAQModal from './StudentFAQModal';
import '../styles/Login.css';

const Login = ({ onLogin, onGuestLogin, onForgotPassword }) => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showContactAdmissions, setShowContactAdmissions] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [qrScanner, setQrScanner] = useState(null);
  const qrScannerRef = useRef(null);
  const [scanningStatus, setScanningStatus] = useState('initializing'); // 'initializing', 'ready', 'scanning', 'success', 'error'
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

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
        setError('Error: Invalid student ID or password.');
        setLoading(false);
        return;
      }

      // Get student data
      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();
      const firestoreDocId = studentDoc.id; // Save the Firestore document ID
      
      console.log('[Data] Raw student data from Firestore:', studentData);
      console.log('📌 Firestore document ID:', firestoreDocId);

      // Check if account is active or if suspension duration has expired
      if (studentData.isActive === false) {
        const suspendedUntil = studentData.suspendedUntil?.toDate ? studentData.suspendedUntil.toDate() : (studentData.suspendedUntil ? new Date(studentData.suspendedUntil) : null);
        const now = new Date();

        if (suspendedUntil && !isNaN(suspendedUntil.getTime()) && now >= suspendedUntil) {
          // Suspension period has elapsed: auto-reactivate account in Firestore
          try {
            await updateDoc(doc(db, 'students', firestoreDocId), {
              isActive: true,
              autoReactivatedAt: serverTimestamp(),
              suspendedUntil: null,
              mustChangePassword: true,
              passwordChangeReason: 'reactivated'
            });
            studentData.isActive = true;
            studentData.mustChangePassword = true;
            studentData.passwordChangeReason = 'reactivated';
          } catch (autoErr) {
            console.warn('[Login] Failed to record auto-reactivation:', autoErr);
          }
        } else {
          let suspendMsg = 'Your account has been suspended. Please contact administration.';
          if (suspendedUntil && !isNaN(suspendedUntil.getTime())) {
            suspendMsg = `Your account is temporarily suspended until ${suspendedUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.`;
          }
          setError(suspendMsg);
          setLoading(false);
          return;
        }
      }

      // Sign in with Firebase Authentication using email and password
      await signInWithEmailAndPassword(auth, studentData.email, password);
      localStorage.removeItem('rememberedStudentId');

      const rawMi = (studentData.middleName || studentData.middleInitial || '').trim().replace(/\./g, '');
      const formattedMi = rawMi ? `${rawMi.charAt(0).toUpperCase()}.` : '';
      const fallbackName = [
        (studentData.firstName || '').trim(),
        formattedMi,
        (studentData.lastName || '').trim(),
        (studentData.suffix || '').trim()
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

      // Prepare student data for localStorage - handle both new and legacy formats
      const formattedStudentData = {
        firestoreDocId: firestoreDocId, // Store the actual Firestore document ID
        uid: studentData.uid || auth.currentUser.uid,
        studentId: studentData.studentId || studentData.id || studentId,
        id: studentData.id || studentId, // Keep legacy 'id' field for compatibility
        firstName: studentData.firstName || studentData.name?.split(' ')[0] || '',
        lastName: studentData.lastName || studentData.name?.split(' ').slice(1).join(' ') || '',
        middleName: studentData.middleName || '',
        middleInitial: rawMi ? rawMi.charAt(0).toUpperCase() : '',
        suffix: studentData.suffix || '',
        email: studentData.email,
        name: studentData.name || fallbackName,
        gradeLevel: studentData.gradeLevel || '',
        section: studentData.section || '',
        phoneNumber: studentData.phoneNumber || '',
        profilePicture: studentData.profilePicture || '',
        twoFactorEnabled: studentData.twoFactorEnabled || false,
        mustChangePassword: studentData.mustChangePassword || false, // Flag for forced password change
        passwordChangeReason: studentData.passwordChangeReason || '',
        restoredAt: studentData.restoredAt || null,
        reactivatedAt: studentData.reactivatedAt || null,
        autoReactivatedAt: studentData.autoReactivatedAt || null,
        suspendedAt: studentData.suspendedAt || null,
        passwordLastChanged: studentData.passwordLastChanged || null,
        createdAt: studentData.createdAt || null
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
        setError('Error: Invalid student ID or password.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/invalid-credential') {
        setError('Error: Invalid student ID or password.');
      } else {
        setError('Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const stopScannerSafe = async () => {
    const s = qrScannerRef.current;
    if (s) {
      try {
        await s.stop();
      } catch (_) {}
      try {
        s.clear();
      } catch (_) {}
      qrScannerRef.current = null;
      setQrScanner(null);
    }
    // Also stop any running media stream tracks directly
    try {
      const video = document.querySelector('#qr-reader video, #qr-reader-admin video');
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    } catch (_) {}
  };

  useEffect(() => {
    return () => {
      stopScannerSafe();
    };
  }, []);

  const handleQRLogin = async () => {
    setShowQRScanner(true);
    setError('');
    setScanningStatus('initializing');
    
    // Wait for DOM to be ready
    setTimeout(() => {
      initializeQRScanner();
    }, 200);
  };

  const initializeQRScanner = async (targetDeviceId = null) => {
    try {
      console.log('[Config] Initializing QR scanner...');
      await stopScannerSafe();
      
      const scanner = new Html5Qrcode("qr-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      qrScannerRef.current = scanner;
      setQrScanner(scanner);
      
      console.log('[Camera] Starting camera...');
      
      let cameraConfig = { facingMode: "environment" };
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices);
          if (targetDeviceId) {
            cameraConfig = { deviceId: { exact: targetDeviceId } };
            const idx = devices.findIndex(d => d.id === targetDeviceId);
            if (idx !== -1) setCurrentCameraIndex(idx);
          } else {
            const backIndex = devices.findIndex(d => {
              const label = (d.label || '').toLowerCase();
              return label.includes('back') || label.includes('rear') || label.includes('environment');
            });
            if (backIndex !== -1) {
              cameraConfig = { deviceId: { exact: devices[backIndex].id } };
              setCurrentCameraIndex(backIndex);
            } else {
              cameraConfig = { deviceId: { exact: devices[0].id } };
              setCurrentCameraIndex(0);
            }
          }
        }
      } catch (camErr) {
        console.warn('[Camera] Device enumeration fallback:', camErr);
        cameraConfig = targetDeviceId ? { deviceId: { exact: targetDeviceId } } : { facingMode: "user" };
      }

      const scanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          // Generous scanning area so dense student codes remain sharp and easy to scan
          const edgeSize = Math.max(220, Math.min(290, Math.floor(minEdge * 0.85)));
          return { width: edgeSize, height: edgeSize };
        },
        aspectRatio: 1.0,
        disableFlip: false
      };

      await scanner.start(
        cameraConfig,
        scanConfig,
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

  const handleSwitchCamera = async () => {
    if (availableCameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    const nextDevice = availableCameras[nextIndex];
    setScanningStatus('initializing');
    await initializeQRScanner(nextDevice.id);
  };

  const scanFileWithScales = async (file) => {
    // 1. Try native BarcodeDetector if available (instant & handles all densities)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const imgBitmap = await createImageBitmap(file);
        const barcodes = await barcodeDetector.detect(imgBitmap);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          console.log('[Upload] Student QR Code detected with native BarcodeDetector');
          return barcodes[0].rawValue;
        }
      } catch (nativeErr) {
        console.warn('[Upload] Native BarcodeDetector fallback:', nativeErr);
      }
    }

    // 2. Load image into HTML Image element
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load image file.'));
      image.src = URL.createObjectURL(file);
    });

    // 3. Multi-scale with quiet-zone padding using ZXing QRCodeReader
    // Adding 30-50px white margin is critical for QR codes downloaded with small margins
    const zxingScales = [2, 1, 3];
    const paddings = [40, 20, 60];

    for (const scale of zxingScales) {
      for (const pad of paddings) {
        try {
          const sw = Math.round(img.width * scale);
          const sh = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = sw + pad * 2;
          canvas.height = sh + pad * 2;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) continue;

          // Clean white quiet zone
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, pad, pad, sw, sh);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const w = canvas.width;
          const h = canvas.height;

          // Grayscale luminance array for ZXing
          const lum = new Uint8ClampedArray(w * h);
          const data = imgData.data;
          for (let i = 0; i < lum.length; i++) {
            const idx = i * 4;
            lum[i] = (data[idx] + 2 * data[idx + 1] + data[idx + 2]) / 4;
          }

          const lumSource = new RGBLuminanceSource(lum, w, h);
          const reader = new QRCodeReader();

          // Try ZXing HybridBinarizer
          try {
            const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
            const result = reader.decode(bitmap);
            if (result && result.getText()) {
              console.log(`[Upload] Student QR Code detected with ZXing Hybrid (scale: ${scale}, pad: ${pad})`);
              return result.getText();
            }
          } catch (_) {}

          // Try ZXing GlobalHistogramBinarizer
          try {
            const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(lumSource));
            const result = reader.decode(bitmap);
            if (result && result.getText()) {
              console.log(`[Upload] Student QR Code detected with ZXing GlobalHistogram (scale: ${scale}, pad: ${pad})`);
              return result.getText();
            }
          } catch (_) {}

          // Also attempt jsQR on the padded canvas
          try {
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth'
            });
            if (code && code.data) {
              console.log(`[Upload] Student QR Code detected with jsQR (scale: ${scale}, pad: ${pad})`);
              return code.data;
            }
          } catch (_) {}
        } catch (passErr) {
          // continue
        }
      }
    }

    // 4. Fallback: Html5Qrcode scanFile
    try {
      const helperContainerId = "qr-reader-file-helper";
      const helperScanner = new Html5Qrcode(helperContainerId);
      const fallbackResult = await helperScanner.scanFile(file, false);
      try { helperScanner.clear(); } catch (_) {}
      if (fallbackResult) return fallbackResult;
    } catch (fallbackErr) {
      console.log('[Upload] Fallback Html5Qrcode could not detect:', fallbackErr);
    }

    throw new Error('Could not detect QR code in the image. Please ensure the image is clear and not cropped.');
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    console.log('[Success] QR Code scanned, raw data:', decodedText);
    console.log('[Stats] Decoded result:', decodedResult);
    setScanningStatus('success');
    
    // Stop scanner safely
    await stopScannerSafe();
    
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
      
      const { studentId, token, password, isTokenBased } = credentials;
      console.log('[Success] QR code decrypted successfully. Token-based:', isTokenBased);
      console.log('[ID] Student ID from QR:', studentId);

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
        const suspendedUntil = studentData.suspendedUntil?.toDate ? studentData.suspendedUntil.toDate() : (studentData.suspendedUntil ? new Date(studentData.suspendedUntil) : null);
        const now = new Date();

        if (suspendedUntil && !isNaN(suspendedUntil.getTime()) && now >= suspendedUntil) {
          try {
            await updateDoc(doc(db, 'students', firestoreDocId), {
              isActive: true,
              autoReactivatedAt: serverTimestamp(),
              suspendedUntil: null
            });
            studentData.isActive = true;
          } catch (autoErr) {
            console.warn('[Login] Failed to record auto-reactivation in QR login:', autoErr);
          }
        } else {
          console.error('[Error] Account suspended');
          setScanningStatus('error');
          let suspendMsg = 'Your account has been suspended. Please contact the administrator.';
          if (suspendedUntil && !isNaN(suspendedUntil.getTime())) {
            suspendMsg = `Your account is temporarily suspended until ${suspendedUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.`;
          }
          setError(suspendMsg);
          setLoading(false);
          return;
        }
      }

      // 1. Verify token revocation if token is present
      if (token && studentData.qrToken && studentData.qrToken !== token) {
        console.error('[Error] QR token mismatch or revoked');
        setScanningStatus('error');
        setError('Invalid or revoked QR code. Please generate a new QR code in your profile settings.');
        setLoading(false);
        return;
      }

      // 2. Authenticate into Firebase Auth to ensure Firestore security rules allow data access
      if (password) {
        console.log('[Auth] Authenticating student via verified credentials from QR');
        try {
          await signInWithEmailAndPassword(auth, studentData.email, password);
        } catch (authErr) {
          console.warn('[Auth] Email/password sign-in failed from QR, using session fallback:', authErr.message);
          try {
            await signInAnonymously(auth);
          } catch (_) {}
        }
      } else if (isTokenBased && token) {
        console.log('[Auth] Authenticating via secure QR token');
        let customTokenAuthSuccess = false;

        // Try Cloud Function
        try {
          const functions = getFunctions();
          const verifyQRLogin = httpsCallable(functions, 'verifyQRLogin');
          const res = await verifyQRLogin({
            type: 'student',
            id: studentId,
            token: token
          });

          if (res?.data?.customToken) {
            await signInWithCustomToken(auth, res.data.customToken);
            customTokenAuthSuccess = true;
            console.log('[Success] Authenticated with Firebase Custom Token');
          }
        } catch (fnErr) {
          console.warn('[Warning] Cloud Function verifyQRLogin not available, trying API:', fnErr.message);
        }

        // Try API endpoint (/api/verify-qr-login on Vercel or localhost:5000 fallback)
        if (!customTokenAuthSuccess) {
          const endpoints = ['/api/verify-qr-login', 'http://localhost:5000/api/verify-qr-login'];
          for (const ep of endpoints) {
            try {
              const apiRes = await fetch(ep, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'student', id: studentId, token: token })
              });
              if (apiRes.ok) {
                const apiData = await apiRes.json();
                if (apiData.customToken) {
                  await signInWithCustomToken(auth, apiData.customToken);
                  customTokenAuthSuccess = true;
                  console.log(`[Success] Authenticated via ${ep}`);
                  break;
                }
              }
            } catch (apiErr) {
              // fallback to next endpoint
            }
          }
        }

        // If backend custom token issuer is not available in local environment,
        // sign in anonymously so that Firebase Auth has an active session for Firestore rules
        if (!customTokenAuthSuccess && !auth.currentUser) {
          try {
            await signInAnonymously(auth);
            console.log('[Auth] Signed in anonymously to allow Firestore data access');
          } catch (anonErr) {
            console.warn('[Auth] Anonymous auth fallback failed:', anonErr.message);
          }
        }
      } else {
        throw new Error('QR code does not contain a valid login token or credentials');
      }

      localStorage.removeItem('rememberedStudentId');

      const rawMi = (studentData.middleName || studentData.middleInitial || '').trim().replace(/\./g, '');
      const formattedMi = rawMi ? `${rawMi.charAt(0).toUpperCase()}.` : '';
      const fallbackName = [
        (studentData.firstName || '').trim(),
        formattedMi,
        (studentData.lastName || '').trim(),
        (studentData.suffix || '').trim()
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

      // Prepare student data for localStorage
      const formattedStudentData = {
        firestoreDocId: firestoreDocId,
        uid: studentData.uid || auth.currentUser?.uid || firestoreDocId,
        studentId: studentData.studentId || studentData.id || studentId,
        id: studentData.id || studentId,
        firstName: studentData.firstName || studentData.name?.split(' ')[0] || '',
        lastName: studentData.lastName || studentData.name?.split(' ').slice(1).join(' ') || '',
        middleName: studentData.middleName || '',
        middleInitial: rawMi ? rawMi.charAt(0).toUpperCase() : '',
        suffix: studentData.suffix || '',
        email: studentData.email,
        name: studentData.name || fallbackName,
        gradeLevel: studentData.gradeLevel || '',
        section: studentData.section || '',
        phoneNumber: studentData.phoneNumber || '',
        profilePicture: studentData.profilePicture || '',
        twoFactorEnabled: studentData.twoFactorEnabled || false,
        mustChangePassword: studentData.mustChangePassword || false, // Flag for forced password change
        passwordChangeReason: studentData.passwordChangeReason || '',
        restoredAt: studentData.restoredAt || null,
        reactivatedAt: studentData.reactivatedAt || null,
        autoReactivatedAt: studentData.autoReactivatedAt || null,
        suspendedAt: studentData.suspendedAt || null,
        passwordLastChanged: studentData.passwordLastChanged || null,
        createdAt: studentData.createdAt || null
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
    await stopScannerSafe();
    setShowQRScanner(false);
    setScanningStatus('initializing');
    setLoading(false);
    setAvailableCameras([]);
    setCurrentCameraIndex(0);
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
      await stopScannerSafe();

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
                  placeholder="Enter the last 4-digit of your Student ID"
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
                    Forgot Password?
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
                New student?{' '}
                <button 
                  type="button" 
                  className="contact-link" 
                  onClick={() => setShowContactAdmissions(true)}
                >
                  Contact Admissions
                </button>
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
        <div className="qr-scanner-modal" onClick={(e) => { if (e.target === e.currentTarget) handleCloseQRScanner(); }}>
          <div className="qr-scanner-card" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
            <div className="qr-card-header">
              <div className="qr-header-text">
                <h2 id="qr-modal-title" className="qr-card-title">Sign In with QR Code</h2>
                <p className="qr-card-subtitle">Position your student QR code in front of the camera.</p>
              </div>
              <button
                type="button"
                className="qr-card-close-btn"
                onClick={handleCloseQRScanner}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>

            {error && (
              <div className="qr-status-banner error">
                <FaExclamationCircle className="qr-banner-icon" />
                <span>{error}</span>
              </div>
            )}

            {scanningStatus === 'success' && (
              <div className="qr-status-banner success">
                <FaCheckCircle className="qr-banner-icon" />
                <span>QR Code verified. Signing in...</span>
              </div>
            )}

            <div className="qr-camera-viewport">
              {scanningStatus === 'initializing' && (
                <div className="qr-camera-loading">
                  <FaSpinner className="qr-spinner-icon" />
                  <span>Opening camera...</span>
                </div>
              )}
              {scanningStatus === 'ready' && (
                <div className="qr-scanner-overlay" aria-hidden="true">
                  <div className="qr-scanner-guide">
                    <span className="qr-corner qr-corner-tl"></span>
                    <span className="qr-corner qr-corner-tr"></span>
                    <span className="qr-corner qr-corner-bl"></span>
                    <span className="qr-corner qr-corner-br"></span>
                    <div className="qr-scanner-laser"></div>
                  </div>
                </div>
              )}
              <div id="qr-reader" className="qr-camera-target"></div>
            </div>
            <div id="qr-reader-file-helper" style={{ position: 'absolute', width: '800px', height: '800px', opacity: 0, pointerEvents: 'none', zIndex: -100 }}></div>

            <div className="qr-card-actions">
              {availableCameras.length > 1 && (
                <button
                  type="button"
                  className="qr-switch-camera-btn"
                  onClick={handleSwitchCamera}
                  title="Switch between front and rear cameras"
                >
                  <FaSyncAlt className="qr-switch-icon" />
                  <span>Switch Camera</span>
                </button>
              )}
              <label htmlFor="qr-file-upload" className="qr-upload-button">
                <FaFileUpload className="qr-upload-icon" />
                <span>Upload QR Image File</span>
              </label>
              <input
                id="qr-file-upload"
                type="file"
                accept="image/*"
                onChange={handleUploadQRCode}
                style={{ display: 'none' }}
              />
            </div>

            <div className="qr-card-footer">
              <p>Having trouble? You can also sign in using your <strong>Student ID</strong> and <strong>Password</strong>.</p>
            </div>
          </div>
        </div>
      )}

      {/* Contact Admissions Modal */}
      <ContactAdmissionsModal
        isOpen={showContactAdmissions}
        onClose={() => setShowContactAdmissions(false)}
      />

      {/* Floating FAQ Quick Button */}
      <button 
        type="button"
        className="floating-faq-btn"
        onClick={() => setShowFAQModal(true)}
        aria-label="Frequently Asked Questions"
        title="Need help? Click to view Frequently Asked Questions"
      >
        <FaQuestionCircle className="floating-faq-icon" />
        <span>Help & FAQ</span>
      </button>

      {/* Student FAQ Modal */}
      <StudentFAQModal
        isOpen={showFAQModal}
        onClose={() => setShowFAQModal(false)}
        onOpenContactAdmissions={() => {
          setShowFAQModal(false);
          setShowContactAdmissions(true);
        }}
      />
    </div>
  );
};

export default Login;
