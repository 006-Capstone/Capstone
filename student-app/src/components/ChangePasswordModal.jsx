import React, { useState } from 'react';
import { FaLock, FaEye, FaEyeSlash, FaShieldAlt, FaKey, FaSignOutAlt, FaExclamationTriangle } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import '../styles/ChangePasswordModal.css';

const ChangePasswordModal = ({ studentData, onPasswordChanged, onLogout }) => {
  const { alertModal } = useNotification();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [requiresRecentLogin, setRequiresRecentLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[ChangePasswordModal] Error signing out:', err);
    }
    localStorage.removeItem('studentLoggedIn');
    localStorage.removeItem('studentIsGuest');
    localStorage.removeItem('studentData');
    localStorage.removeItem('selectedRequest');
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRequiresRecentLogin(false);

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both the new password and confirm password fields');
      return;
    }

    if (currentPassword && newPassword === currentPassword) {
      setError('Your new password cannot be the same as your current temporary password.');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setRequiresRecentLogin(true);
        setError('Your login session has expired. Please log in again to change your password.');
        setLoading(false);
        return;
      }

      // If user supplied current password, reauthenticate first to ensure session is 100% fresh
      if (currentPassword) {
        try {
          const credential = EmailAuthProvider.credential(user.email || studentData?.email, currentPassword);
          await reauthenticateWithCredential(user, credential);
        } catch (reauthErr) {
          console.error('[ChangePasswordModal] Reauth error:', reauthErr);
          if (reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential') {
            setError('Current temporary password is incorrect. Please double-check the password you logged in with.');
            setLoading(false);
            return;
          }
          throw reauthErr;
        }
      }

      // Update password in Firebase Authentication directly
      await updatePassword(user, newPassword);

      // Update mustChangePassword flag in Firestore
      if (studentData?.firestoreDocId) {
        const studentRef = doc(db, 'students', studentData.firestoreDocId);
        await updateDoc(studentRef, {
          mustChangePassword: false,
          passwordLastChanged: new Date().toISOString()
        });
      }

      // Update localStorage
      const updatedStudentData = {
        ...studentData,
        mustChangePassword: false
      };
      localStorage.setItem('studentData', JSON.stringify(updatedStudentData));

      if (alertModal) {
        await alertModal({
          title: 'Password Changed',
          message: 'Password changed successfully! You can now access your portal.',
          variant: 'success'
        });
      }
      onPasswordChanged();

    } catch (error) {
      console.error('[ChangePasswordModal] Error changing password:', error);
      
      if (error.code === 'auth/requires-recent-login') {
        setRequiresRecentLogin(true);
        setError('Your security session has expired. Please enter your Current Temporary Password above to verify, or sign out and log back in.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/invalid-credential') {
        setRequiresRecentLogin(true);
        setError('Your login session is invalid. Please sign out and log in again.');
      } else {
        setError('Failed to change password: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-modal-overlay">
      <div className="change-password-modal">
        <div className="change-password-modal-content">
          <div className="modal-icon-container">
            <FaShieldAlt className="modal-icon" />
          </div>
          
          <h2 className="modal-title">Change Your Password</h2>
          <p className="modal-subtitle">
            For security reasons, you must change your temporary password before accessing your student portal.
          </p>

          <form onSubmit={handleSubmit} className="change-password-form">
            {error && (
              <div className="error-message-modal">
                <div className="error-text-row">
                  <FaExclamationTriangle className="error-icon" />
                  <span>{error}</span>
                </div>
                {requiresRecentLogin && (
                  <button 
                    type="button" 
                    className="reauth-action-btn"
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt /> Log In Again Now
                  </button>
                )}
              </div>
            )}

            <div className="form-group-modal">
              <label className="form-label-modal">
                Current Temporary Password <span className="label-hint">(optional if freshly logged in)</span>
              </label>
              <div className="password-input-wrapper-modal">
                <FaKey className="input-icon" />
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  className="form-input-modal"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter the password you logged in with"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn-modal"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={loading}
                  aria-label="Toggle password visibility"
                >
                  {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="form-group-modal">
              <label className="form-label-modal">New Password</label>
              <div className="password-input-wrapper-modal">
                <FaLock className="input-icon" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  className="form-input-modal"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn-modal"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={loading}
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="form-group-modal">
              <label className="form-label-modal">Confirm New Password</label>
              <div className="password-input-wrapper-modal">
                <FaLock className="input-icon" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="form-input-modal"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new secure password"
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn-modal"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="password-requirements">
              <p className="requirements-title">Password Requirements:</p>
              <ul className="requirements-list">
                <li className={newPassword.length >= 8 ? 'valid' : ''}>
                  At least 8 characters long
                </li>
                <li className={/[A-Z]/.test(newPassword) ? 'valid' : ''}>
                  Contains uppercase letter (A-Z)
                </li>
                <li className={/[a-z]/.test(newPassword) ? 'valid' : ''}>
                  Contains lowercase letter (a-z)
                </li>
                <li className={/[0-9]/.test(newPassword) ? 'valid' : ''}>
                  Contains number (0-9)
                </li>
              </ul>
            </div>

            <button 
              type="submit" 
              className="submit-btn-modal" 
              disabled={loading}
            >
              {loading ? 'Updating Password...' : 'Change Password'}
            </button>
          </form>

          <div className="modal-bottom-area">
            <p className="modal-note">
              <FaLock /> One-time mandatory security check.
            </p>
            <button 
              type="button" 
              className="modal-logout-link"
              onClick={handleLogout}
              disabled={loading}
            >
              <FaSignOutAlt className="logout-icon" />
              <span>Sign Out & Return to Login</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
