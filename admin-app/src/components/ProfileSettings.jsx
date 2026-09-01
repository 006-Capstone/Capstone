import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { FaCamera, FaEye, FaEyeSlash, FaQrcode, FaDownload } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import QRCode from 'qrcode';
import { encryptCredentials } from '../utils/qrEncryption';
import LoadingSpinner from './LoadingSpinner';
import '../styles/ProfileSettings.css';

// Only the fields the user can actually edit count toward "changed"
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
        alert('Missing username or office. Please contact support.');
        return;
      }
      if (!password) {
        alert('Password is required for QR generation');
        return;
      }

      const encryptedData = encryptCredentials(username, officeId, password);

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

      const staffData = JSON.parse(localStorage.getItem('staffData'));
      if (staffData?.firestoreDocId) {
        const docRef = doc(db, 'staff', staffData.firestoreDocId);
        await updateDoc(docRef, {
          qrCodeData: encryptedData,
          qrCodeGeneratedAt: new Date().toISOString()
        });
        setProfileData(prev => ({
          ...prev,
          qrCodeData: encryptedData
        }));
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
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

    if (!profileData.username || !profileData.officeId) {
      alert('Missing username or office. Please contact support.');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(profileData.email, qrPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      await generateQRCode(profileData.username, profileData.officeId, qrPassword);
      setShowQRPasswordPrompt(false);
      setQrPassword('');

      const message = profileData.qrCodeData
        ? '✓ QR code regenerated successfully! Your old QR code is now invalidated.'
        : '✓ QR code generated successfully! You can now download it.';
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
    link.download = `staff-qr-${profileData.username || profileData.staffId || 'login'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadProfileData = async () => {
    try {
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      if (!staffData) {
        alert('Please log in again');
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
          office: data.office || '',
          officeId: data.officeId || '',
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
        alert('Profile data not found. Please contact admin.');
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
      const staffData = JSON.parse(localStorage.getItem('staffData'));
      
      if (!staffData?.firestoreDocId) {
        alert('Session error. Please log in again.');
        setSaving(false);
        return;
      }
      
      let profilePictureURL = profileData.profilePicture;

      if (profilePicture) {
        const storageRef = ref(storage, `staff-profile-pictures/${staffData.uid || staffData.firestoreDocId}`);
        await uploadBytes(storageRef, profilePicture);
        profilePictureURL = await getDownloadURL(storageRef);
      }

      const updateData = {
        lastName: profileData.lastName,
        firstName: profileData.firstName,
        middleName: profileData.middleName,
        middleInitial: profileData.middleInitial,
        suffix: profileData.suffix,
        phoneNumber: profileData.phoneNumber,
        profilePicture: profilePictureURL,
        twoFactorEnabled: profileData.twoFactorEnabled,
        updatedAt: new Date().toISOString()
      };

      const fullNameValue = `${profileData.firstName} ${profileData.lastName}`.trim();
      updateData.name = fullNameValue;
      updateData.fullName = fullNameValue;

      const docRef = doc(db, 'staff', staffData.firestoreDocId);
      await updateDoc(docRef, updateData);

      const updatedStaffData = {
        ...staffData,
        ...profileData,
        profilePicture: profilePictureURL,
        name: fullNameValue,
        fullName: fullNameValue
      };
      
      localStorage.setItem('staffData', JSON.stringify(updatedStaffData));
      alert('✓ Profile updated successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
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
      
      const credential = EmailAuthProvider.credential(
        user.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, passwordForm.newPassword);

      const staffData = JSON.parse(localStorage.getItem('staffData'));
      const docRef = doc(db, 'staff', staffData.firestoreDocId);
      await updateDoc(docRef, {
        lastPasswordUpdate: new Date().toISOString(),
        qrCodeData: ''
      });

      alert('✓ Password changed successfully!\n\n⚠ IMPORTANT: Your old QR code will no longer work. Please regenerate your QR code with the new password.');
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

  if (loading) {
    return <LoadingSpinner message="Loading profile..." fullScreen={true} />;
  }

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
                    <label>POSITION <span className="required">*</span></label>
                    <input
                      type="text"
                      name="position"
                      value={profileData.position}
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
                    <label>PHONE NUMBER <span className="required">*</span></label>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={profileData.phoneNumber}
                      onChange={handleInputChange}
                      placeholder="e.g. 0912 345 6789"
                    />
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
                    <label>STAFF ID <span className="required">*</span></label>
                    <input
                      type="text"
                      value={profileData.staffId}
                      readOnly
                      className="readonly-field"
                    />
                  </div>

                  <div className="form-group">
                    <label>USERNAME <span className="required">*</span></label>
                    <input
                      type="text"
                      value={profileData.username}
                      readOnly
                      className="readonly-field"
                    />
                  </div>
                </div>

                <div className="form-row small-fields">
                  <div className="form-group small">
                    <label>M.I.</label>
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
                    placeholder="Enter new password (min. 6 chars)"
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
