import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { FaCamera, FaEye, FaEyeSlash, FaQrcode, FaDownload, FaInfoCircle, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import QRCode from 'qrcode';
import { encryptCredentials, encryptQRData, generateSecureToken } from '../utils/qrEncryption';
import { useNotification } from '../context/NotificationContext';
import { SettingsModalSkeleton, SettingsContentSkeleton } from './common/Skeleton';
import '../styles/ProfileSettings.css';

const EDITABLE_KEYS = ['lastName', 'firstName', 'middleName', 'suffix', 'username'];

function ProfileSettings({ onClose }) {
  const { toast, alertModal } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    middleInitial: '',
    suffix: '',
    position: '',
    office: '',
    officeId: '',
    username: '',
    staffId: '',
    email: '',
    phoneNumber: '',
    profilePicture: '',
    twoFactorEnabled: false,
    lastPasswordUpdate: null,
    qrCodeData: ''
  });

  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState('');
  const [originalProfileData, setOriginalProfileData] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [showQRPasswordPrompt, setShowQRPasswordPrompt] = useState(false);
  const [qrPassword, setQrPassword] = useState('');
  const [showQRPassword, setShowQRPassword] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const qrCodeRef = useRef(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(''); // 'available' | 'taken' | 'invalid' | 'current' | ''
  const [usernameMessage, setUsernameMessage] = useState('');

  const checkUsernameAvailability = async (candidateUsername) => {
    const trimmed = (candidateUsername || '').trim();
    const currentUsername = (originalProfileData?.username || '').trim();

    if (!trimmed) {
      setUsernameStatus('invalid');
      setUsernameMessage('Username cannot be empty');
      setUsernameChecking(false);
      return;
    }

    if (trimmed.toLowerCase() === currentUsername.toLowerCase()) {
      setUsernameStatus('current');
      setUsernameMessage('');
      setUsernameChecking(false);
      return;
    }

    if (trimmed.length < 3) {
      setUsernameStatus('invalid');
      setUsernameMessage('Must be at least 3 characters');
      setUsernameChecking(false);
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameMessage('Only letters, numbers, underscores, and dots allowed');
      setUsernameChecking(false);
      return;
    }

    setUsernameChecking(true);
    try {
      const staffData = JSON.parse(localStorage.getItem('staffData') || '{}');
      const staffQuery = query(collection(db, 'staff'), where('username', '==', trimmed));
      const staffSnap = await getDocs(staffQuery);

      let isTaken = false;
      staffSnap.forEach((docSnap) => {
        if (
          docSnap.id !== staffData.firestoreDocId &&
          docSnap.id !== staffData.id &&
          docSnap.data().uid !== staffData.uid
        ) {
          isTaken = true;
        }
      });

      if (!isTaken) {
        const userQuery = query(collection(db, 'users'), where('username', '==', trimmed));
        const userSnap = await getDocs(userQuery);
        userSnap.forEach((docSnap) => {
          if (docSnap.id !== staffData.firestoreDocId && docSnap.id !== staffData.uid) {
            isTaken = true;
          }
        });
      }

      if (isTaken) {
        setUsernameStatus('taken');
        setUsernameMessage('Username is already taken');
      } else {
        setUsernameStatus('available');
        setUsernameMessage('Username is available');
      }
    } catch (err) {
      console.error('Error checking username availability:', err);
    } finally {
      setUsernameChecking(false);
    }
  };

  useEffect(() => {
    if (!originalProfileData) return;
    const currentUsername = (originalProfileData.username || '').trim().toLowerCase();
    const candidateUsername = (profileData.username || '').trim().toLowerCase();

    if (!candidateUsername) {
      setUsernameStatus('invalid');
      setUsernameMessage('Username cannot be empty');
      setUsernameChecking(false);
      return;
    }

    if (candidateUsername === currentUsername) {
      setUsernameStatus('current');
      setUsernameMessage('');
      setUsernameChecking(false);
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(profileData.username);
    }, 400);

    return () => clearTimeout(timer);
  }, [profileData.username, originalProfileData]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setLoading(false);
    }, 12000);
    loadProfileData();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (profileData.qrCodeData) {
      generateQRCodeImage(profileData.qrCodeData);
    }
  }, [profileData.qrCodeData]);

  const generateQRCodeImage = async (encryptedData) => {
    try {
      const qrDataURL = await QRCode.toDataURL(encryptedData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#105E06',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      });
      setQrCodeDataURL(qrDataURL);
    } catch (error) {
      console.error('Error generating QR code image:', error);
    }
  };

  const generateQRCode = async (username, officeId, password) => {
    try {
      if (!username || !officeId) {
        toast.error('Missing username or office. Please contact support.');
        return;
      }
      if (!password) {
        toast.warning('Password is required for QR generation');
        return;
      }

      const staffData = JSON.parse(localStorage.getItem('staffData') || '{}');
      if (staffData?.email) {
        try {
          await signInWithEmailAndPassword(auth, staffData.email, password);
        } catch (pwErr) {
          console.error('[Error] Invalid staff password for QR generation:', pwErr);
          toast.error('Incorrect password. Please verify your current password.');
          return;
        }
      }

      // 1. Generate unique random cryptographic token (NO passwords in QR!)
      const token = generateSecureToken();

      // 2. Encrypt token-based QR data
      const encryptedData = encryptQRData(username, officeId, token);

      const qrDataURL = await QRCode.toDataURL(encryptedData, {
        width: 400,
        margin: 4,
        color: {
          dark: '#105E06',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeDataURL(qrDataURL);

      if (staffData?.firestoreDocId) {
        const docRef = doc(db, 'staff', staffData.firestoreDocId);
        await updateDoc(docRef, {
          qrToken: token,
          qrCodeData: encryptedData,
          qrCodeGeneratedAt: new Date().toISOString()
        });
        setProfileData(prev => ({
          ...prev,
          qrToken: token,
          qrCodeData: encryptedData
        }));
      }

      console.log('✅ Permanent staff QR code generated without storing raw password');
      toast.success('Permanent staff QR code generated successfully!');
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code. Please try again.');
    }
  };

  const handleGenerateQRCode = () => {
    setShowQRPasswordPrompt(true);
    setQrPassword('');
  };

  const handleQRPasswordSubmit = async () => {
    if (!qrPassword) {
      toast.warning('Please enter your password');
      return;
    }

    if (!profileData.username || !profileData.officeId) {
      toast.error('Missing username or office. Please contact support.');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(profileData.email, qrPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await generateQRCode(profileData.username, profileData.officeId, qrPassword);
      setShowQRPasswordPrompt(false);
      setQrPassword('');

      const message = profileData.qrCodeData
        ? 'QR code regenerated successfully! Your old QR code is now invalidated.'
        : 'QR code generated successfully! You can now download it.';
      toast.success(message);
    } catch (error) {
      console.error('Password verification failed:', error);
      toast.error('Incorrect password. Please try again.');
    }
  };

  const handleDownloadQRCode = () => {
    if (!qrCodeDataURL) return;
    const link = document.createElement('a');
    link.href = qrCodeDataURL;
    link.download = `staff-qr-${profileData.username || profileData.staffId || 'login'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadProfileData = async () => {
    try {
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      if (!staffData) {
        toast.warning('Please log in again');
        return;
      }

      let docSnap = null;
      if (staffData.firestoreDocId) {
        const docRef = doc(db, 'staff', staffData.firestoreDocId);
        docSnap = await getDoc(docRef);
      }
      
      if (!docSnap || !docSnap.exists()) {
        if (staffData.uid) {
          const docRef = doc(db, 'staff', staffData.uid);
          docSnap = await getDoc(docRef);
        }
      }
      
      if (!docSnap || !docSnap.exists()) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const staffRef = collection(db, 'staff');
        if (staffData.uid) {
          const q = query(staffRef, where('uid', '==', staffData.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            docSnap = querySnapshot.docs[0];
            staffData.firestoreDocId = docSnap.id;
            localStorage.setItem('staffData', JSON.stringify(staffData));
          }
        }
      }

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        let firstName = data.firstName || '';
        let lastName = data.lastName || '';
        
        if (data.name && !firstName && !lastName) {
          const nameParts = data.name.trim().split(' ');
          if (nameParts.length >= 2) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          } else if (nameParts.length === 1) {
            firstName = nameParts[0];
          }
        }
        
        if (data.fullName && !firstName && !lastName) {
          const nameParts = data.fullName.trim().split(' ');
          if (nameParts.length >= 2) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          } else if (nameParts.length === 1) {
            firstName = nameParts[0];
          }
        }
        
        const loadedProfile = {
          lastName: lastName,
          firstName: firstName,
          middleName: data.middleName || '',
          middleInitial: data.middleInitial || (data.middleName ? data.middleName.charAt(0).toUpperCase() : ''),
          suffix: data.suffix || '',
          position: data.position || '',
          office: (data.office?.toLowerCase() === 'finance') ? 'Accounting' : (data.office || ''),
          officeId: (data.officeId?.toLowerCase() === 'finance') ? 'accounting' : (data.officeId || ''),
          username: data.username || '',
          staffId: data.staffId || '',
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
          profilePicture: data.profilePicture || '',
          twoFactorEnabled: data.twoFactorEnabled || false,
          lastPasswordUpdate: data.lastPasswordUpdate || null,
          qrCodeData: data.qrCodeData || ''
        };
        setProfileData(loadedProfile);
        setOriginalProfileData(loadedProfile);
        setProfilePicturePreview(data.profilePicture || '');
      } else {
        toast.error('Profile data not found. Please contact admin.');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'middleName') {
      const trimmed = value ? value.trim().replace(/\./g, '') : '';
      setProfileData(prev => ({
        ...prev,
        middleInitial: trimmed ? trimmed.charAt(0).toUpperCase() : ''
      }));
    }
  };

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/\s+/g, '');
    setProfileData(prev => ({
      ...prev,
      username: val
    }));
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('File size must be less than 5MB');
        return;
      }
      setProfilePicture(file);
      setProfilePicturePreview(URL.createObjectURL(file));
    }
  };

  const hasChanges = useMemo(() => {
    if (!originalProfileData) return false;
    if (profilePicture) return true;
    return EDITABLE_KEYS.some(key => profileData[key] !== originalProfileData[key]);
  }, [profileData, originalProfileData, profilePicture]);

  const isFormValid = useMemo(() => {
    const cleanUsername = (profileData.username || '').trim();
    const cleanFirstName = (profileData.firstName || '').trim();
    const cleanLastName = (profileData.lastName || '').trim();

    if (!cleanUsername || cleanUsername.length < 3) return false;
    if (!cleanFirstName || !cleanLastName) return false;
    if (usernameChecking) return false;
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return false;

    return true;
  }, [profileData.username, profileData.firstName, profileData.lastName, usernameChecking, usernameStatus]);

  const handleUpdateProfile = async () => {
    try {
      if (usernameChecking) {
        toast.warning('Please wait while checking username availability');
        return;
      }

      const cleanUsername = (profileData.username || '').trim();
      const cleanFirstName = (profileData.firstName || '').trim();
      const cleanLastName = (profileData.lastName || '').trim();
      const originalUsername = (originalProfileData?.username || '').trim();
      const isUsernameChanged = cleanUsername.toLowerCase() !== originalUsername.toLowerCase();

      if (!cleanUsername) {
        toast.error('Username cannot be empty. Please enter your username.');
        setUsernameStatus('invalid');
        setUsernameMessage('Username cannot be empty');
        return;
      }

      if (cleanUsername.length < 3) {
        toast.error('Username must be at least 3 characters long.');
        setUsernameStatus('invalid');
        setUsernameMessage('Must be at least 3 characters');
        return;
      }

      if (!cleanFirstName) {
        toast.error('First Name cannot be empty.');
        return;
      }

      if (!cleanLastName) {
        toast.error('Last Name cannot be empty.');
        return;
      }

      if (isUsernameChanged) {
        if (usernameStatus === 'taken') {
          toast.error('The selected username is already taken. Please choose another.');
          return;
        }
        if (usernameStatus === 'invalid') {
          toast.error(usernameMessage || 'Please provide a valid username.');
          return;
        }

        // Final verification check against database
        const staffQuery = query(collection(db, 'staff'), where('username', '==', cleanUsername));
        const staffSnap = await getDocs(staffQuery);
        const staffDataCheck = JSON.parse(localStorage.getItem('staffData') || '{}');
        const alreadyExists = staffSnap.docs.some(docSnap =>
          docSnap.id !== staffDataCheck.firestoreDocId &&
          docSnap.id !== staffDataCheck.id &&
          docSnap.data().uid !== staffDataCheck.uid
        );
        if (alreadyExists) {
          toast.error('Username already exists. Please choose a different username.');
          setUsernameStatus('taken');
          setUsernameMessage('Username is already taken');
          return;
        }
      }

      setSaving(true);
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      
      if (!staffData?.firestoreDocId) {
        toast.error('Session error. Please log in again.');
        setSaving(false);
        return;
      }
      
      let profilePictureURL = profileData.profilePicture;

      if (profilePicture) {
        const storageRef = ref(storage, `staff-profile-pictures/${staffData.uid || staffData.firestoreDocId}`);
        await uploadBytes(storageRef, profilePicture);
        profilePictureURL = await getDownloadURL(storageRef);
      }

      const rawMi = (profileData.middleName || profileData.middleInitial || '').trim().replace(/\./g, '');
      const formattedMi = rawMi ? `${rawMi.charAt(0).toUpperCase()}.` : '';
      const fullNameValue = [
        (profileData.firstName || '').trim(),
        formattedMi,
        (profileData.lastName || '').trim(),
        (profileData.suffix || '').trim()
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

      const normalizedOffice = (profileData.office?.toLowerCase() === 'finance' || staffData.office?.toLowerCase() === 'finance') ? 'Accounting' : (profileData.office || staffData.office);
      const normalizedOfficeId = (profileData.officeId?.toLowerCase() === 'finance' || staffData.officeId?.toLowerCase() === 'finance') ? 'accounting' : (profileData.officeId || staffData.officeId);

      const updateData = {
        lastName: (profileData.lastName || '').trim(),
        firstName: (profileData.firstName || '').trim(),
        middleName: (profileData.middleName || '').trim(),
        middleInitial: rawMi ? rawMi.charAt(0).toUpperCase() : '',
        suffix: (profileData.suffix || '').trim(),
        username: cleanUsername,
        office: normalizedOffice,
        officeId: normalizedOfficeId,
        name: fullNameValue,
        fullName: fullNameValue,
        profilePicture: profilePictureURL,
        updatedAt: new Date().toISOString()
      };

      if (isUsernameChanged) {
        updateData.qrCodeData = '';
      }

      const docRef = doc(db, 'staff', staffData.firestoreDocId);
      await updateDoc(docRef, updateData);

      const updatedStaffData = {
        ...staffData,
        ...profileData,
        username: cleanUsername,
        office: normalizedOffice,
        officeId: normalizedOfficeId,
        middleName: (profileData.middleName || '').trim(),
        middleInitial: rawMi ? rawMi.charAt(0).toUpperCase() : '',
        profilePicture: profilePictureURL,
        name: fullNameValue,
        fullName: fullNameValue
      };

      if (isUsernameChanged) {
        updatedStaffData.qrCodeData = '';
        setQrCodeDataURL('');
      }
      
      localStorage.setItem('staffData', JSON.stringify(updatedStaffData));

      if (isUsernameChanged) {
        toast.success(`Profile and username updated! Your new login username is @${cleanUsername}. Please generate a new QR code if you use QR login.`);
      } else {
        toast.success('Profile updated successfully!');
      }

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const validatePassword = (password) => {
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter (A-Z)';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter (a-z)';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number (0-9)';
    }
    return null;
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) {
      toast.warning('Please enter your current password');
      return;
    }

    const passwordError = validatePassword(passwordForm.newPassword);
    if (passwordError) {
      toast.warning(passwordError);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.warning('New passwords do not match');
      return;
    }

    try {
      setSaving(true);
      const user = auth.currentUser;
      
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, passwordForm.newPassword);

      const staffData = JSON.parse(localStorage.getItem('staffData'));
      const docRef = doc(db, 'staff', staffData.firestoreDocId);
      const nowIso = new Date().toISOString();
      await updateDoc(docRef, {
        lastPasswordUpdate: nowIso,
        passwordChangedAt: nowIso,
        passwordLastChanged: nowIso,
        qrCodeData: ''
      });

      // Record in activityLogs for Super Admin audit trail
      try {
        await addDoc(collection(db, 'activityLogs'), {
          userId: user.uid,
          userEmail: user.email,
          action: 'Account password changed & verified',
          category: 'security',
          details: 'Staff member successfully changed password credentials in Profile Settings',
          status: 'Secured',
          timestamp: new Date()
        });
      } catch (actErr) {
        console.warn('[ActivityLog] Could not write to activityLogs:', actErr);
      }

      alertModal({
        title: 'Security Notice: New QR Required',
        message: 'Your password was changed successfully.\n\nIMPORTANT: Your old QR code will no longer work. Please regenerate and download a new QR code with your new password.',
        variant: 'warning'
      });
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

      setQrCodeDataURL('');
      setProfileData(prev => ({
        ...prev,
        qrCodeData: ''
      }));

      loadProfileData();
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect');
      } else {
        toast.error('Failed to change password: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const getPasswordUpdateMessage = () => {
    if (!profileData.lastPasswordUpdate) {
      return 'Never updated. We recommend updating regularly.';
    }
    const lastUpdate = new Date(profileData.lastPasswordUpdate);
    const monthsAgo = Math.floor((new Date() - lastUpdate) / (1000 * 60 * 60 * 24 * 30));
    if (monthsAgo === 0) return 'Updated recently (less than a month ago).';
    return `Last updated ${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago. We recommend updating regularly.`;
  };

  const maskEmail = (email) => {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const maskedName = name.length > 2 ? `${name.slice(0, 2)}••••••` : `${name}•••`;
    return `${maskedName}@${parts[1]}`;
  };

  return (
    <div className="profile-settings-overlay" onClick={onClose}>
      <div className="profile-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close settings">
            <MdClose />
          </button>
        </div>

        <div className="profile-settings-content">
          {loading ? (
            <SettingsContentSkeleton />
          ) : (
            <>
              {/* Profile Information Section */}
              <div className="settings-section">
                <h3>Profile Information</h3>

                {/* Username Notice Banner */}
                <div className="profile-notice-banner">
                  <FaInfoCircle className="notice-banner-icon" />
                  <div className="notice-banner-text">
                    <strong>Username Requirement:</strong> Your username is your login credential and must be unique across all staff accounts. Changing it will update your login credentials and invalidate any previously generated QR codes.
                  </div>
                </div>
            
                <div className="profile-info-grid">
                  <div className="profile-picture-section">
                    <div className="profile-picture-container">
                      {profilePicturePreview ? (
                        <img src={profilePicturePreview} alt="Profile" className="profile-picture" />
                      ) : (
                        <div className="profile-picture-placeholder">
                          <span>{profileData.firstName?.charAt(0)}{profileData.lastName?.charAt(0)}</span>
                        </div>
                      )}
                      <label className="upload-btn" title="Upload new photo">
                        <FaCamera />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePictureChange}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="profile-fields">
                    <div className="form-row name-row">
                      <div className="form-group">
                        <label>FIRST NAME <span className="required">*</span></label>
                        <input
                          type="text"
                          name="firstName"
                          value={profileData.firstName}
                          onChange={handleInputChange}
                          required
                          placeholder="First Name"
                          className={!(profileData.firstName || '').trim() ? 'is-invalid' : ''}
                        />
                      </div>

                      <div className="form-group">
                        <label>MIDDLE NAME</label>
                        <input
                          type="text"
                          name="middleName"
                          value={profileData.middleName}
                          onChange={handleInputChange}
                          placeholder="Middle Name"
                        />
                      </div>

                      <div className="form-group">
                        <label>LAST NAME <span className="required">*</span></label>
                        <input
                          type="text"
                          name="lastName"
                          value={profileData.lastName}
                          onChange={handleInputChange}
                          required
                          placeholder="Last Name"
                          className={!(profileData.lastName || '').trim() ? 'is-invalid' : ''}
                        />
                      </div>

                      <div className="form-group suffix-group">
                        <label>SUFFIX</label>
                        <input
                          type="text"
                          name="suffix"
                          value={profileData.suffix}
                          onChange={handleInputChange}
                          placeholder="Jr, Sr, III"
                          maxLength="10"
                        />
                      </div>
                    </div>

                    <div className="form-row account-row">
                      <div className="form-group username-form-group">
                        <label>
                          USERNAME <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          name="username"
                          value={profileData.username}
                          onChange={handleUsernameChange}
                          placeholder="Enter username"
                          autoComplete="off"
                          className={`username-input ${
                            usernameStatus === 'available'
                              ? 'is-valid'
                              : usernameStatus === 'taken' || usernameStatus === 'invalid'
                              ? 'is-invalid'
                              : ''
                          }`}
                          required
                        />
                        <div className="username-status-indicator">
                          {usernameChecking && (
                            <span className="status-badge checking">
                              <span className="status-spinner" /> Checking availability...
                            </span>
                          )}
                          {!usernameChecking && usernameStatus === 'available' && (
                            <span className="status-badge available">
                              <FaCheckCircle /> Username is available
                            </span>
                          )}
                          {!usernameChecking && (usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                            <span className="status-badge taken">
                              <FaExclamationCircle /> {usernameMessage}
                            </span>
                          )}
                          {!usernameChecking && usernameStatus === 'current' && (
                            <span className="status-badge current">
                              Current username
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="form-group">
                        <label>OFFICE <span className="required">*</span></label>
                        <input
                          type="text"
                          name="office"
                          value={profileData.office}
                          readOnly
                          className="readonly-field"
                        />
                      </div>

                      <div className="form-group">
                        <label>EMAIL ADDRESS <span className="required">*</span></label>
                        <div className="input-with-icon">
                          <input
                            type="text"
                            value={showEmail ? profileData.email : maskEmail(profileData.email)}
                            readOnly
                            className={`readonly-field ${!showEmail ? 'masked-field email-masked' : ''}`}
                          />
                          <button 
                            type="button" 
                            className="eye-icon-btn"
                            onClick={() => setShowEmail(!showEmail)}
                            title={showEmail ? 'Hide email' : 'Show email'}
                          >
                            {showEmail ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

          {/* Account Security Section */}
          <div className="settings-section">
            <h3>Account Security</h3>
            
            <div className="security-item">
              <div className="security-info">
                <h4>Password</h4>
                <p>{getPasswordUpdateMessage()}</p>
              </div>
              <button className="change-password-btn" onClick={() => setShowPasswordModal(true)}>
                Change Password
              </button>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="settings-section">
            <h3>Quick Login QR Code</h3>
            <p className="section-description">
              {profileData.qrCodeData
                ? 'Your secure QR code for instant login. This QR code is unique and persistent.'
                : 'Generate a secure QR code for instant login. This QR code contains encrypted credentials and can only be read by this website.'
              }
            </p>

            <div className="qr-code-container">
              <div className="qr-code-display">
                {qrCodeDataURL ? (
                  <div className="qr-code-box">
                    <img ref={qrCodeRef} src={qrCodeDataURL} alt="Staff QR Code" className="qr-code-image" />
                    <p className="qr-code-id">Username: {profileData.username}</p>
                  </div>
                ) : (
                  <div className="qr-code-placeholder">
                    <FaQrcode className="qr-placeholder-icon" />
                    <p>No QR code generated yet</p>
                  </div>
                )}
              </div>
              <div className="qr-code-info">
                <div className="info-item">
                  <FaQrcode className="info-icon" />
                  <div>
                    <h4>How to use:</h4>
                    {!profileData.qrCodeData ? (
                      <>
                        <p>1. Click "Generate QR Code" and enter your password</p>
                        <p>2. Download and save it on your phone</p>
                        <p>3. On login page, click "Login with QR code"</p>
                        <p>4. Scan your QR code for instant automatic login</p>
                      </>
                    ) : (
                      <>
                        <p>1. Download your QR code (it's saved securely)</p>
                        <p>2. On login page, click "Login with QR code"</p>
                        <p>3. Scan your QR code for instant automatic login</p>
                        <p>4. This QR code will work until you regenerate it</p>
                      </>
                    )}
                    <p className="qr-warning-text">
                      ⚠ Keep your QR code secure - it contains your login credentials!
                    </p>
                    {!qrCodeDataURL && (
                      <button className="generate-qr-btn" onClick={handleGenerateQRCode}>
                        <FaQrcode />
                        Generate QR Code
                      </button>
                    )}
                  </div>
                </div>
                {qrCodeDataURL && (
                  <div className="qr-action-buttons">
                    <button className="download-qr-btn" onClick={handleDownloadQRCode}>
                      <FaDownload />
                      Download QR Code
                    </button>
                    <button className="regenerate-qr-btn" onClick={handleGenerateQRCode}>
                      <FaQrcode />
                      {profileData.qrCodeData ? 'Regenerate QR Code' : 'Generate QR Code'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="settings-actions">
            <button
              type="button"
              className="cancel-btn-settings"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="update-btn"
              onClick={handleUpdateProfile}
              disabled={saving || !hasChanges || !isFormValid}
              title={
                !hasChanges
                  ? 'Make a change to enable saving'
                  : !(profileData.username || '').trim()
                  ? 'Username is required and cannot be empty'
                  : (profileData.username || '').trim().length < 3
                  ? 'Username must be at least 3 characters'
                  : !(profileData.firstName || '').trim()
                  ? 'First Name is required and cannot be empty'
                  : !(profileData.lastName || '').trim()
                  ? 'Last Name is required and cannot be empty'
                  : usernameChecking
                  ? 'Checking username availability...'
                  : usernameStatus === 'taken'
                  ? 'Username is already taken'
                  : usernameStatus === 'invalid'
                  ? (usernameMessage || 'Invalid username')
                  : undefined
              }
            >
              {saving ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
            </>
          )}
        </div>

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="password-modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="password-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Change Password</h3>
              
              <div className="form-group-modal">
                <label>Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  >
                    {showPasswords.current ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="form-group-modal">
                <label>New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  >
                    {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="form-group-modal">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  >
                    {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="password-requirements">
                <p className="requirements-title">Password Requirements:</p>
                <ul className="requirements-list">
                  <li className={passwordForm.newPassword?.length >= 8 ? 'valid' : ''}>
                    At least 8 characters long
                  </li>
                  <li className={/[A-Z]/.test(passwordForm.newPassword || '') ? 'valid' : ''}>
                    Contains uppercase letter (A-Z)
                  </li>
                  <li className={/[a-z]/.test(passwordForm.newPassword || '') ? 'valid' : ''}>
                    Contains lowercase letter (a-z)
                  </li>
                  <li className={/[0-9]/.test(passwordForm.newPassword || '') ? 'valid' : ''}>
                    Contains number (0-9)
                  </li>
                </ul>
              </div>

              <div className="password-modal-actions">
                <button className="cancel-btn" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button 
                  className="confirm-btn" 
                  onClick={handleChangePassword}
                  disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword}
                >
                  {saving ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Password Prompt Modal */}
        {showQRPasswordPrompt && (
          <div className="password-modal-overlay" onClick={() => setShowQRPasswordPrompt(false)}>
            <div className="password-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{profileData.qrCodeData ? 'Regenerate QR Code' : 'Generate QR Code'}</h3>
              <p className="modal-description">
                {profileData.qrCodeData
                  ? 'Enter your password to regenerate your QR code. Your old QR code will no longer work.'
                  : 'Enter your password to generate an encrypted QR code'
                }
              </p>

              <div className="form-group-modal">
                <label>Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showQRPassword ? 'text' : 'password'}
                    value={qrPassword}
                    onChange={(e) => setQrPassword(e.target.value)}
                    placeholder="Enter your password"
                    onKeyDown={(e) => e.key === 'Enter' && handleQRPasswordSubmit()}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowQRPassword(!showQRPassword)}
                  >
                    {showQRPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <div className="password-modal-actions">
                <button className="cancel-btn" onClick={() => setShowQRPasswordPrompt(false)}>
                  Cancel
                </button>
                <button 
                  className="confirm-btn" 
                  onClick={handleQRPasswordSubmit}
                  disabled={!qrPassword}
                >
                  {profileData.qrCodeData ? 'Regenerate QR Code' : 'Generate QR Code'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileSettings;
