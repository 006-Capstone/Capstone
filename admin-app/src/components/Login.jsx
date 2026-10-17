import React, { useState, useEffect, useRef } from 'react';
import { FaDollarSign, FaBook, FaUsers, FaClipboardList, FaShieldAlt, FaEye, FaEyeSlash, FaQrcode, FaTimes, FaCheckCircle, FaSpinner, FaExclamationCircle, FaFileUpload, FaInfoCircle, FaSyncAlt } from 'react-icons/fa';
import { signInWithEmailAndPassword, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
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
import '../styles/Login.css';

const Login = ({ onLogin, onForgotPassword }) => {
  const [selectedDepartment, setSelectedDepartment] = useState('accounting');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState(null);
  const qrScannerRef = useRef(null);
  const [scanningStatus, setScanningStatus] = useState('initializing');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  // Helper to check office equivalence (Accounting and Finance are one and the same across the system)
  const isMatchingOffice = (officeA, officeB) => {
    const a = String(officeA || '').trim().toLowerCase();
    const b = String(officeB || '').trim().toLowerCase();
    if (!a || !b) return false;
    if (a === b) return true;
    if ((a === 'accounting' || a === 'finance') && (b === 'accounting' || b === 'finance')) {
      return true;
    }
    return false;
  };

  const departments = [
    { id: 'accounting', name: 'Accounting', icon: FaDollarSign },
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
      const deptIds = (selectedDepartment === 'accounting' || selectedDepartment === 'finance')
        ? ['accounting', 'finance']
        : [selectedDepartment];
      const deptNames = (selectedDepartment === 'accounting' || selectedDepartment === 'finance')
        ? ['Accounting', 'Finance']
        : [departments.find(d => d.id === selectedDepartment)?.name].filter(Boolean);

      let querySnapshot = null;
      for (const dId of deptIds) {
        const q = query(
          collection(db, 'staff'),
          where('username', '==', username.trim()),
          where('officeId', '==', dId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          querySnapshot = snap;
          break;
        }
      }

      // Fallback: search by office name if officeId was not matched
      if (!querySnapshot || querySnapshot.empty) {
        for (const dName of deptNames) {
          const q = query(
            collection(db, 'staff'),
            where('username', '==', username.trim()),
            where('office', '==', dName)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            querySnapshot = snap;
            break;
          }
        }
      }
      
      if (!querySnapshot || querySnapshot.empty) {
        setError('Invalid username or office. Please check your credentials.');
        setLoading(false);
        return;
      }

      const staffDoc = querySnapshot.docs[0];
      const staffData = staffDoc.data();

      // Check if staff is active or if suspension duration has expired
      if (staffData.isActive === false) {
        const suspendedUntil = staffData.suspendedUntil?.toDate ? staffData.suspendedUntil.toDate() : (staffData.suspendedUntil ? new Date(staffData.suspendedUntil) : null);
        const now = new Date();

        if (suspendedUntil && !isNaN(suspendedUntil.getTime()) && now >= suspendedUntil) {
          try {
            await updateDoc(doc(db, 'staff', staffDoc.id), {
              isActive: true,
              autoReactivatedAt: serverTimestamp(),
              suspendedUntil: null,
              mustChangePassword: true,
              passwordChangeReason: 'reactivated'
            });
            staffData.isActive = true;
            staffData.mustChangePassword = true;
            staffData.passwordChangeReason = 'reactivated';
          } catch (autoErr) {
            console.warn('[Login] Failed to record staff auto-reactivation:', autoErr);
          }
        } else {
          let suspendMsg = 'Your account has been suspended. Please contact the administrator.';
          if (suspendedUntil && !isNaN(suspendedUntil.getTime())) {
            suspendMsg = `Your account is temporarily suspended until ${suspendedUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.`;
          }
          setError(suspendMsg);
          setLoading(false);
          return;
        }
      }

      // Authenticate with Firebase using email and password
      await signInWithEmailAndPassword(auth, staffData.email, password);

      const rawOffice = staffData.office;
      const normalizedOffice = (rawOffice?.toLowerCase() === 'finance') ? 'Accounting' : (rawOffice || 'Accounting');
      const normalizedOfficeId = (staffData.officeId === 'finance' || staffData.officeId === 'accounting') ? 'accounting' : (staffData.officeId || 'accounting');

      // Store staff info in localStorage
      const staffInfo = {
        name: staffData.name,
        fullName: staffData.name, // Save as fullName for compatibility
        firstName: staffData.firstName || '',
        lastName: staffData.lastName || '',
        email: staffData.email,
        username: staffData.username,
        office: normalizedOffice,
        officeId: normalizedOfficeId,
        position: staffData.position || '',
        staffId: staffData.staffId || '',
        phoneNumber: staffData.phoneNumber || '',
        profilePicture: staffData.profilePicture || '',
        uid: staffData.uid || auth.currentUser?.uid,
        mustChangePassword: staffData.mustChangePassword === true,
        passwordChangeReason: staffData.passwordChangeReason || '',
        restoredAt: staffData.restoredAt || null,
        reactivatedAt: staffData.reactivatedAt || null,
        autoReactivatedAt: staffData.autoReactivatedAt || null,
        suspendedAt: staffData.suspendedAt || null,
        passwordLastChanged: staffData.passwordLastChanged || null,
        createdAt: staffData.createdAt || null,
        firestoreDocId: staffDoc.id // Save the document ID
      };
      
      localStorage.setItem('staffData', JSON.stringify(staffInfo));
      
      console.log('[Success] Staff logged in:', staffData.name);
      onLogin(normalizedOffice);
      
    } catch (error) {
      console.error('[Error] Login error:', error);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Error: You have entered incorrect username or password.');
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
    
    setTimeout(() => {
      initializeQRScanner();
    }, 200);
  };

  const initializeQRScanner = async (targetDeviceId = null) => {
    try {
      console.log('[Config] Initializing QR scanner...');
      await stopScannerSafe();
      
      const scanner = new Html5Qrcode("qr-reader-admin", {
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
          // Generous scanning area so dense codes stay sharp and easy to align
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
          console.log('[Upload] QR Code detected with native BarcodeDetector');
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
              console.log(`[Upload] QR Code detected with ZXing Hybrid (scale: ${scale}, pad: ${pad})`);
              return result.getText();
            }
          } catch (_) {}

          // Try ZXing GlobalHistogramBinarizer
          try {
            const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(lumSource));
            const result = reader.decode(bitmap);
            if (result && result.getText()) {
              console.log(`[Upload] QR Code detected with ZXing GlobalHistogram (scale: ${scale}, pad: ${pad})`);
              return result.getText();
            }
          } catch (_) {}

          // Also attempt jsQR on the padded canvas
          try {
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth'
            });
            if (code && code.data) {
              console.log(`[Upload] QR Code detected with jsQR (scale: ${scale}, pad: ${pad})`);
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
    setScanningStatus('success');
    
    await stopScannerSafe();
    
    await new Promise(resolve => setTimeout(resolve, 600));
    
    setShowQRScanner(false);
    setLoading(true);
    setError('');

    try {
      if (!decodedText || decodedText.length < 20) {
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
      
      const { username, officeId, token, password, isTokenBased } = credentials;
      console.log('[Success] QR code decrypted successfully. Token-based:', isTokenBased);
      console.log('[User] Username from QR:', username);
      console.log('[Office] Office from QR:', officeId);

      // Find staff member by username in Firestore
      console.log('[Search] Searching for staff with username:', username);
      const staffQuery = query(
        collection(db, 'staff'),
        where('username', '==', username)
      );
      
      const querySnapshot = await getDocs(staffQuery);

      if (querySnapshot.empty) {
        console.error('[Error] Staff not found in database');
        setScanningStatus('error');
        setError(`Staff account '${username}' not found. Please contact the administrator.`);
        setLoading(false);
        return;
      }

      // Verify office matches (case-insensitive, treating accounting and finance as one and the same)
      let matchedDoc = null;
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const staffOfficeId = data.officeId || '';
        const staffOfficeName = data.office || '';
        if (
          isMatchingOffice(staffOfficeId, officeId) ||
          isMatchingOffice(staffOfficeName, officeId)
        ) {
          matchedDoc = docSnap;
          break;
        }
      }

      if (!matchedDoc) {
        console.error('[Error] Department mismatch for staff:', username, officeId);
        setScanningStatus('error');
        setError(`Staff account '${username}' found, but office '${officeId}' does not match database record.`);
        setLoading(false);
        return;
      }

      const staffDoc = matchedDoc;
      const staffData = staffDoc.data();
      console.log('[Success] Staff found:', staffData);

      // Normalize accounting and finance offices so all features stay consistent
      const rawOffice = staffData.office;
      const isAcctFin = (rawOffice?.toLowerCase() === 'finance' || rawOffice?.toLowerCase() === 'accounting' || officeId?.toLowerCase() === 'finance' || officeId?.toLowerCase() === 'accounting');
      const normalizedOffice = isAcctFin ? 'Accounting' : (rawOffice || 'Accounting');
      const normalizedOfficeId = isAcctFin ? 'accounting' : (staffData.officeId?.toLowerCase() || 'accounting');

      if (staffData.isActive === false) {
        const suspendedUntil = staffData.suspendedUntil?.toDate ? staffData.suspendedUntil.toDate() : (staffData.suspendedUntil ? new Date(staffData.suspendedUntil) : null);
        const now = new Date();

        if (suspendedUntil && !isNaN(suspendedUntil.getTime()) && now >= suspendedUntil) {
          try {
            await updateDoc(doc(db, 'staff', staffDoc.id), {
              isActive: true,
              autoReactivatedAt: serverTimestamp(),
              suspendedUntil: null
            });
            staffData.isActive = true;
          } catch (autoErr) {
            console.warn('[Login] Failed to record staff auto-reactivation in QR login:', autoErr);
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
      if (token && staffData.qrToken && staffData.qrToken !== token) {
        console.error('[Error] Staff QR token mismatch or revoked');
        setScanningStatus('error');
        setError('Invalid or revoked QR code. Please generate a new QR code in your profile settings.');
        setLoading(false);
        return;
      }

      // 2. Authenticate into Firebase Auth so Firestore security rules allow data access
      if (password) {
        console.log('[Auth] Authenticating staff via verified credentials from QR');
        try {
          await signInWithEmailAndPassword(auth, staffData.email, password);
        } catch (authErr) {
          console.warn('[Auth] Staff email/password sign-in failed from QR, using session fallback:', authErr.message);
          try {
            await signInAnonymously(auth);
          } catch (_) {}
        }
      } else if (isTokenBased && token) {
        console.log('[Auth] Authenticating staff via secure QR token');
        let customTokenSuccess = false;

        // Try Cloud Function
        try {
          const functions = getFunctions();
          const verifyQRLogin = httpsCallable(functions, 'verifyQRLogin');
          const res = await verifyQRLogin({
            type: 'staff',
            username: username,
            officeId: normalizedOfficeId,
            token: token
          });

          if (res?.data?.customToken) {
            await signInWithCustomToken(auth, res.data.customToken);
            customTokenSuccess = true;
            console.log('[Success] Staff authenticated via Firebase Custom Token');
          }
        } catch (fnErr) {
          console.warn('[Warning] Cloud Function verifyQRLogin not available, checking API fallback:', fnErr.message);
        }

        // Try API endpoint (/api/verify-qr-login on Vercel or localhost:5000)
        if (!customTokenSuccess) {
          const endpoints = ['/api/verify-qr-login', 'http://localhost:5000/api/verify-qr-login'];
          for (const ep of endpoints) {
            try {
              const apiRes = await fetch(ep, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'staff', username: username, officeId: normalizedOfficeId, token: token })
              });
              if (apiRes.ok) {
                const apiData = await apiRes.json();
                if (apiData.customToken) {
                  await signInWithCustomToken(auth, apiData.customToken);
                  customTokenSuccess = true;
                  console.log(`[Success] Staff authenticated via ${ep}`);
                  break;
                }
              }
            } catch (apiErr) {
              // try next
            }
          }
        }

        // If backend custom token issuer is not available, sign in anonymously for Firestore rules
        if (!customTokenSuccess && !auth.currentUser) {
          try {
            await signInAnonymously(auth);
            console.log('[Auth] Staff signed in anonymously to allow Firestore data access');
          } catch (anonErr) {
            console.warn('[Auth] Anonymous auth fallback failed:', anonErr.message);
          }
        }
      } else {
        throw new Error('QR code does not contain a valid login token or credentials');
      }

      // Store staff info in localStorage
      const staffInfo = {
        name: staffData.name,
        fullName: staffData.name,
        firstName: staffData.firstName || '',
        lastName: staffData.lastName || '',
        email: staffData.email,
        username: staffData.username,
        office: normalizedOffice,
        officeId: normalizedOfficeId,
        position: staffData.position || '',
        staffId: staffData.staffId || '',
        phoneNumber: staffData.phoneNumber || '',
        profilePicture: staffData.profilePicture || '',
        uid: staffData.uid || auth.currentUser?.uid || staffDoc.id,
        mustChangePassword: staffData.mustChangePassword === true,
        passwordChangeReason: staffData.passwordChangeReason || '',
        restoredAt: staffData.restoredAt || null,
        reactivatedAt: staffData.reactivatedAt || null,
        autoReactivatedAt: staffData.autoReactivatedAt || null,
        suspendedAt: staffData.suspendedAt || null,
        passwordLastChanged: staffData.passwordLastChanged || null,
        createdAt: staffData.createdAt || null,
        firestoreDocId: staffDoc.id
      };
      
      localStorage.setItem('staffData', JSON.stringify(staffInfo));
      
      console.log('[Success] Login successful via QR code!');
      setSelectedDepartment(normalizedOfficeId);
      onLogin(normalizedOffice);
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

      // Stop active camera stream if running
      await stopScannerSafe();

      const decodedText = await scanFileWithScales(file);
      console.log('[Success] QR Code decoded from image, length:', decodedText.length);
      setScanningStatus('success');

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
            
            <button type="submit" className="sign-in-button" disabled={loading} aria-busy={loading}>
              {loading && <span className="btn-spinner" aria-hidden="true" />}
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <div className="divider-admin">
              <span>or</span>
            </div>

            <button type="button" className="alt-login-btn-admin" onClick={handleQRLogin} disabled={loading}>
              <FaQrcode />
              Login with QR code
            </button>
            
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
        <div className="qr-scanner-modal" onClick={(e) => { if (e.target === e.currentTarget) handleCloseQRScanner(); }}>
          <div className="qr-scanner-card" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title-admin">
            <div className="qr-card-header">
              <div className="qr-header-text">
                <h2 id="qr-modal-title-admin" className="qr-card-title">Sign In with Staff QR Code</h2>
                <p className="qr-card-subtitle">Position your staff QR code in front of the camera.</p>
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
              <div id="qr-reader-admin" className="qr-camera-target"></div>
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
              <label htmlFor="qr-file-upload-admin" className="qr-upload-button">
                <FaFileUpload className="qr-upload-icon" />
                <span>Upload QR Image File</span>
              </label>
              <input
                id="qr-file-upload-admin"
                type="file"
                accept="image/*"
                onChange={handleUploadQRCode}
                style={{ display: 'none' }}
              />
            </div>

            <div className="qr-card-footer">
              <p>Having trouble? You can also sign in using your <strong>Username</strong> and <strong>Password</strong>.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
