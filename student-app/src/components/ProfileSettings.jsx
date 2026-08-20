import React, { useState, useEffect, useRef, useMemo } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { FaCamera, FaEye, FaEyeSlash, FaQrcode, FaDownload, FaSignOutAlt } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import QRCode from 'qrcode';
import { encryptCredentials } from '../utils/qrEncryption';
import LoadingSpinner from './LoadingSpinner';
import '../styles/ProfileSettings.css';

// Only the fields the user can actually edit count toward "changed"
// (read-only fields like grade level, section, email, school ID and the
// derived M.I. don't).
const EDITABLE_KEYS = ['lastName', 'firstName', 'middleName', 'suffix', 'phoneNumber', 'twoFactorEnabled'];

function ProfileSettings({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    middleInitial: '',
    suffix: '',
    gradeLevel: '',
    section: '',
    schoolId: '',
    email: '',
    phoneNumber: '',
    profilePicture: '',
    twoFactorEnabled: false,
    lastPasswordUpdate: null,
    qrCodeData: '' // Store encrypted QR data
  });

  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState('');
  // Snapshot of the values loaded from Firestore — used to detect unsaved changes
  const [originalProfileData, setOriginalProfileData] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [showQRPasswordPrompt, setShowQRPasswordPrompt] = useState(false);
  const [qrPassword, setQrPassword] = useState('');
  const [showQRPassword, setShowQRPassword] = useState(false);
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
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    // Generate QR code image from stored encrypted data
    if (profileData.qrCodeData) {
      generateQRCodeImage(profileData.qrCodeData);
    }
  }, [profileData.qrCodeData]);

  const generateQRCodeImage = async (encryptedData) => {
    try {
      // Generate QR code image from encrypted data
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
      console.log('[Success] QR code image generated from stored data');
    } catch (error) {
      console.error('[Error] Error generating QR code image:', error);
    }
  };

  const generateQRCode = async (studentId, password) => {
    try {
      console.log('[QRCode] Generating encrypted QR code for student ID:', studentId);
      
      // Ensure it's exactly 4 digits
      if (!/^\d{4}$/.test(studentId)) {
        console.error('[Error] Invalid student ID format for QR:', studentId);
        return;
      }
      
      if (!password) {
        console.error('[Error] Password required for QR generation');
        return;
      }
      
      // Encrypt the credentials
      const encryptedData = encryptCredentials(studentId, password);
      
      // Generate QR code image with encrypted data
      const qrDataURL = await QRCode.toDataURL(encryptedData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#105E06',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H' // High error correction for encrypted data
      });
      setQrCodeDataURL(qrDataURL);
      
      // Save encrypted data to Firestore so QR persists
      const studentData = JSON.parse(localStorage.getItem('studentData'));
      if (studentData.firestoreDocId) {
        const docRef = doc(db, 'students', studentData.firestoreDocId);
        await updateDoc(docRef, {
          qrCodeData: encryptedData,
          qrCodeGeneratedAt: new Date().toISOString()
        });
        
        // Update local state
        setProfileData(prev => ({
          ...prev,
          qrCodeData: encryptedData
        }));
        
        console.log('[Success] QR code saved to Firestore');
      }
      
      console.log('[Success] QR code generated successfully with encrypted credentials');
    } catch (error) {
      console.error('[Error] Error generating QR code:', error);
      alert('Failed to generate QR code. Please try again.');
    }
  };

  const handleGenerateQRCode = () => {
    setShowQRPasswordPrompt(true);
    setQrPassword('');
  };

  const handleQRPasswordSubmit = async () => {
    if (!qrPassword) {
      alert('Please enter your password');
      return;
    }

    // Validate school ID before proceeding
    if (!profileData.schoolId || !/^\d{4}$/.test(profileData.schoolId)) {
      console.error('[Error] Invalid school ID:', profileData.schoolId);
      alert(`Invalid student ID format: "${profileData.schoolId}". Expected 4 digits. Please contact support.`);
      return;
    }

    try {
      // Verify password by attempting to reauthenticate
      const credential = EmailAuthProvider.credential(profileData.email, qrPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Password is correct, generate QR code
      console.log('[Ticket] Generating QR for student ID:', profileData.schoolId);
      await generateQRCode(profileData.schoolId, qrPassword);
      setShowQRPasswordPrompt(false);
      setQrPassword('');
      
      const message = profileData.qrCodeData 
        ? 'QR code regenerated successfully! Your old QR code will no longer work.'
        : 'QR code generated successfully! You can now download it.';
      alert(message);
    } catch (error) {
      console.error('Password verification failed:', error);
      alert('Incorrect password. Please try again.');
    }
  };

  const handleDownloadQRCode = () => {
    if (!qrCodeDataURL) return;
    
    const link = document.createElement('a');
    link.href = qrCodeDataURL;
    link.download = `student-qr-${profileData.schoolId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadProfileData = async () => {
    try {
      const studentData = JSON.parse(localStorage.getItem('studentData'));
      if (!studentData) {
        alert('Please log in again');
        return;
      }

      console.log('[Data] Loading profile for student:', studentData);

      // Try to get the document using the Firestore document ID if available
      let docSnap = null;
      
      if (studentData.firestoreDocId) {
        // Use the stored document ID
        const docRef = doc(db, 'students', studentData.firestoreDocId);
        docSnap = await getDoc(docRef);
        console.log('[Success] Found using firestoreDocId:', studentData.firestoreDocId);
      }
      
      // If not found or no firestoreDocId, try using uid as document ID
      if (!docSnap || !docSnap.exists()) {
        if (studentData.uid) {
          const docRef = doc(db, 'students', studentData.uid);
          docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            console.log('[Success] Found using uid as document ID:', studentData.uid);
          }
        }
      }
      
      // If still not found, we need to query by uid field
      if (!docSnap || !docSnap.exists()) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const studentsRef = collection(db, 'students');
        
        // Try querying by uid field
        if (studentData.uid) {
          const q = query(studentsRef, where('uid', '==', studentData.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            docSnap = querySnapshot.docs[0];
            // Save the Firestore document ID for future use
            studentData.firestoreDocId = docSnap.id;
            localStorage.setItem('studentData', JSON.stringify(studentData));
            console.log('[Success] Found by querying uid field, docId:', docSnap.id);
          }
        }
        
        // Try querying by id field (4 digits)
        if ((!docSnap || !docSnap.exists()) && studentData.id) {
          const q = query(studentsRef, where('id', '==', studentData.id));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            docSnap = querySnapshot.docs[0];
            studentData.firestoreDocId = docSnap.id;
            localStorage.setItem('studentData', JSON.stringify(studentData));
            console.log('[Success] Found by querying id field, docId:', docSnap.id);
          }
        }
      }

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        console.log('[File] Student document data:', data);
        
        // Extract 4-digit ID from various formats
        let fourDigitId = '';
        const rawId = data.studentId || data.id || '';
        
        if (rawId.includes('-')) {
          // Format: "05-2324-XXXX" -> extract "XXXX"
          const parts = rawId.split('-');
          fourDigitId = parts[parts.length - 1];
        } else if (rawId.length === 4 && /^\d{4}$/.test(rawId)) {
          // Already 4 digits
          fourDigitId = rawId;
        } else {
          // Try to extract last 4 digits
          fourDigitId = rawId.slice(-4);
        }
        
        console.log('[ID] Extracted 4-digit ID:', fourDigitId, 'from raw ID:', rawId);
        
        const loadedProfile = {
          lastName: data.lastName || '',
          firstName: data.firstName || '',
          middleName: data.middleName || '',
          middleInitial: data.middleInitial || (data.middleName ? data.middleName.charAt(0).toUpperCase() : ''),
          suffix: data.suffix || '',
          gradeLevel: data.gradeLevel || '',
          section: data.section || '',
          schoolId: fourDigitId,
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
          profilePicture: data.profilePicture || '',
          twoFactorEnabled: data.twoFactorEnabled || false,
          lastPasswordUpdate: data.lastPasswordUpdate || null,
          qrCodeData: data.qrCodeData || '' // Load existing QR data
        };
        setProfileData(loadedProfile);
        setOriginalProfileData(loadedProfile);
        setProfilePicturePreview(data.profilePicture || '');
      } else {
        console.error('[Error] Student document not found');
        alert('Profile data not found. Please contact support.');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      alert('Failed to load profile data: ' + error.message);
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

    // Auto-generate middle initial
    if (name === 'middleName' && value) {
      setProfileData(prev => ({
        ...prev,
        middleInitial: value.charAt(0).toUpperCase()
      }));
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setProfilePicture(file);
      setProfilePicturePreview(URL.createObjectURL(file));
    }
  };

  const handleToggle2FA = () => {
    setProfileData(prev => ({
      ...prev,
      twoFactorEnabled: !prev.twoFactorEnabled
    }));
  };

  const hasChanges = useMemo(() => {
    if (!originalProfileData) return false;
    if (profilePicture) return true;
    return EDITABLE_KEYS.some(key => profileData[key] !== originalProfileData[key]);
  }, [profileData, originalProfileData, profilePicture]);

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const studentData = JSON.parse(localStorage.getItem('studentData'));
      
      if (!studentData.firestoreDocId) {
        alert('Session error. Please log in again.');
        setSaving(false);
        return;
      }
      
      let profilePictureURL = profileData.profilePicture;

      // Upload profile picture if changed
      if (profilePicture) {
        const storageRef = ref(storage, `profile-pictures/${studentData.uid || studentData.firestoreDocId}`);
        await uploadBytes(storageRef, profilePicture);
        profilePictureURL = await getDownloadURL(storageRef);
      }

      // Update Firestore using the correct document ID
      const docRef = doc(db, 'students', studentData.firestoreDocId);
      await updateDoc(docRef, {
        lastName: profileData.lastName,
        firstName: profileData.firstName,
        middleName: profileData.middleName,
        middleInitial: profileData.middleInitial,
        suffix: profileData.suffix,
        gradeLevel: profileData.gradeLevel,
        section: profileData.section,
        phoneNumber: profileData.phoneNumber,
        profilePicture: profilePictureURL,
        twoFactorEnabled: profileData.twoFactorEnabled,
        updatedAt: new Date().toISOString()
      });

      // Update localStorage
      const updatedStudentData = {
        ...studentData,
        ...profileData,
        profilePicture: profilePictureURL
      };
      localStorage.setItem('studentData', JSON.stringify(updatedStudentData));

      alert('Profile updated successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await signOut(auth);
        // Clear all student-related localStorage
        localStorage.removeItem('studentData');
        localStorage.removeItem('studentLoggedIn');
        localStorage.removeItem('studentIsGuest');
        // Reload to trigger login screen
        window.location.href = '/';
      } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
      }
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);
      const user = auth.currentUser;
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, passwordForm.newPassword);

      // Update last password change date in Firestore
      const studentData = JSON.parse(localStorage.getItem('studentData'));
      const docRef = doc(db, 'students', studentData.firestoreDocId);
      await updateDoc(docRef, {
        lastPasswordUpdate: new Date().toISOString(),
        qrCodeData: '' // Clear old QR code data
      });

      alert('Password changed successfully!\n\n⚠ IMPORTANT: Your old QR code will no longer work. Please regenerate your QR code with the new password.');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Clear QR code display
      setQrCodeDataURL('');
      setProfileData(prev => ({
        ...prev,
        qrCodeData: ''
      }));
      
      loadProfileData();
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        alert('Current password is incorrect');
      } else {
        alert('Failed to change password: ' + error.message);
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
    return `Last updated ${monthsAgo} months ago. We recommend updating regularly.`;
  };

  // Mask an email for privacy: keep the first character of the local part
  // and the full domain, e.g. "m•••@gmail.com"
  const maskEmail = (email) => {
    if (!email || !email.includes('@')) return email;
    const [localPart, ...rest] = email.split('@');
    if (!localPart) return email;
    const first = localPart.charAt(0);
    const maskedLocal = first + '•'.repeat(Math.max(localPart.length - 1, 0));
    return `${maskedLocal}@${rest.join('@')}`;
  };

  if (loading) {
    return <LoadingSpinner message="Loading profile..." fullScreen={true} />;
  }

  return (
    <div className="profile-settings-overlay" onClick={onClose}>
      <div className="profile-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-settings-header">
          <h2>Settings</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <MdClose />
          </button>
        </div>

        <div className="profile-settings-content">
          {/* Profile Information Section */}
          <div className="settings-section">
            <h3>Profile Information</h3>
            
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
                  <label className="upload-btn">
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
                <div className="form-row">
                  <div className="form-group">
                    <label>LAST NAME <span className="required">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      value={profileData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>GRADE LEVEL <span className="required">*</span></label>
                    <input
                      type="text"
                      name="gradeLevel"
                      value={profileData.gradeLevel}
                      onChange={handleInputChange}
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
                        className="readonly-field masked-field email-masked"
                        aria-label="Email address"
                      />
                      <button
                        type="button"
                        className="eye-icon-btn"
                        onClick={() => setShowEmail(prev => !prev)}
                        aria-label={showEmail ? 'Hide email address' : 'Show email address'}
                        aria-pressed={showEmail}
                      >
                        {showEmail ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>FIRST NAME <span className="required">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      value={profileData.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>SECTION <span className="required">*</span></label>
                    <input
                      type="text"
                      name="section"
                      value={profileData.section}
                      onChange={handleInputChange}
                      readOnly
                      className="readonly-field"
                    />
                  </div>

                  <div className="form-group">
                    <label>PHONE NUMBER <span className="required">*</span></label>
                    <div className="input-with-icon">
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={profileData.phoneNumber}
                        onChange={handleInputChange}
                        className="masked-field"
                      />
                      <FaEyeSlash className="eye-icon" />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>MIDDLE NAME</label>
                    <input
                      type="text"
                      name="middleName"
                      value={profileData.middleName}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>SCHOOL ID <span className="required">*</span></label>
                    <input
                      type="text"
                      value={profileData.schoolId}
                      readOnly
                      className="readonly-field"
                    />
                  </div>
                </div>

                <div className="form-row small-fields">
                  <div className="form-group small">
                    <label>M.I</label>
                    <input
                      type="text"
                      name="middleInitial"
                      value={profileData.middleInitial}
                      readOnly
                      maxLength="1"
                      className="readonly-field"
                    />
                  </div>

                  <div className="form-group small">
                    <label>SUFFIX</label>
                    <input
                      type="text"
                      name="suffix"
                      value={profileData.suffix}
                      onChange={handleInputChange}
                      placeholder="Jr, Sr, III"
                    />
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

            <div className="security-item">
              <div className="security-info">
                <h4>Two-Factor Authentication (2FA)</h4>
                <p>Secure your account by adding an additional security layer via SMS</p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={profileData.twoFactorEnabled}
                  onChange={handleToggle2FA}
                />
                <span className="settings-toggle-slider"></span>
              </label>
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
                  <img ref={qrCodeRef} src={qrCodeDataURL} alt="Student QR Code" className="qr-code-image" />
                ) : (
                  <div className="qr-code-placeholder">
                    <FaQrcode className="qr-placeholder-icon" />
                    <p>No QR code generated yet</p>
                  </div>
                )}
                {qrCodeDataURL && <p className="qr-code-id">Student ID: {profileData.schoolId}</p>}
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
                    <p style={{ color: '#ef5350', marginTop: '10px', fontWeight: 600 }}>
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
              className="logout-btn-settings"
              onClick={handleLogout}
              aria-label="Log out of your account"
            >
              <FaSignOutAlt aria-hidden="true" />
              Log Out
            </button>
            <button 
              className="update-btn" 
              onClick={handleUpdateProfile}
              disabled={saving || !hasChanges}
              title={!hasChanges ? 'Make a change to enable saving' : undefined}
            >
              {saving ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </div>

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="password-modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="password-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Change Password</h3>
              
              <div className="form-group">
                <label>Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
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

              <div className="form-group">
                <label>New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
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

              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
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

              <div className="password-modal-actions">
                <button className="cancel-btn" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
                <button 
                  className="confirm-btn" 
                  onClick={handleChangePassword}
                  disabled={saving}
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
                  ? 'Enter your password to regenerate your QR code. Your old QR code will stop working.'
                  : 'Enter your password to generate an encrypted QR code'
                }
              </p>
              
              <div className="form-group">
                <label>Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showQRPassword ? 'text' : 'password'}
                    value={qrPassword}
                    onChange={(e) => setQrPassword(e.target.value)}
                    placeholder="Enter your password"
                    onKeyPress={(e) => e.key === 'Enter' && handleQRPasswordSubmit()}
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
