import React, { useState } from 'react';
import {
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaKey,
  FaTimes,
  FaCheckCircle,
  FaRegCircle,
  FaExclamationCircle
} from 'react-icons/fa';
import { auth, db } from '../firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useNotification } from '../context/NotificationContext';
import '../styles/SuperadminChangePasswordModal.css';

const SuperadminChangePasswordModal = ({ onClose }) => {
  const { alertModal } = useNotification();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Requirements checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);

  const validatePassword = () => {
    if (!hasMinLength) return 'Password must be at least 8 characters long.';
    if (!hasUpper) return 'Password must contain at least one uppercase letter (A-Z).';
    if (!hasLower) return 'Password must contain at least one lowercase letter (a-z).';
    if (!hasNumber) return 'Password must contain at least one number (0-9).';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both new password and confirm password fields.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Your new password cannot be the same as your current password.');
      return;
    }

    const validationMsg = validatePassword();
    if (validationMsg) {
      setError(validationMsg);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      const storedData = JSON.parse(localStorage.getItem('superadminData') || '{}');
      const email = user?.email || storedData.email;

      if (!user || !email) {
        setError('Your session has expired. Please sign out and log in again.');
        setLoading(false);
        return;
      }

      // 1. Re-authenticate with current password to ensure freshness and identity
      try {
        const credential = EmailAuthProvider.credential(email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      } catch (reauthErr) {
        console.error('[SuperadminChangePassword] Reauth error:', reauthErr);
        if (
          reauthErr.code === 'auth/wrong-password' ||
          reauthErr.code === 'auth/invalid-credential'
        ) {
          setError('The current password you entered is incorrect. Please try again.');
          setLoading(false);
          return;
        }
        throw reauthErr;
      }

      // 2. Update password in Firebase Auth
      await updatePassword(user, newPassword);

      // 3. Update superadmin Firestore document if found
      try {
        let docId = storedData.docId;
        if (!docId) {
          const q = query(collection(db, 'superadmin'), where('email', '==', email));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            docId = snapshot.docs[0].id;
          }
        }

        if (docId) {
          await updateDoc(doc(db, 'superadmin', docId), {
            passwordLastChanged: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        // Add activity audit log
        await addDoc(collection(db, 'activityLogs'), {
          userEmail: email,
          action: 'Superadmin password changed',
          category: 'security',
          details: `Superadmin account password was changed successfully by ${storedData.username || email}`,
          status: 'Success',
          timestamp: serverTimestamp()
        });
      } catch (docErr) {
        console.warn('[SuperadminChangePassword] Error updating Firestore doc / log:', docErr);
      }

      setLoading(false);

      if (alertModal) {
        await alertModal({
          title: 'Password Updated',
          message: 'Your superadmin password has been updated successfully. Please use your new password next time you sign in.',
          variant: 'success'
        });
      }

      onClose();
    } catch (err) {
      console.error('[SuperadminChangePassword] Error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security reasons, please sign out and sign in again before changing your password.');
      } else {
        setError(err.message || 'Failed to update password. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div
      className="superadmin-password-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="superadmin-password-modal-card" role="dialog" aria-modal="true" aria-labelledby="superadmin-pw-modal-title">
        <button
          type="button"
          className="superadmin-password-close-btn"
          onClick={onClose}
          disabled={loading}
          aria-label="Close modal"
        >
          <FaTimes />
        </button>

        <div className="superadmin-password-header">
          <div className="superadmin-password-icon-box">
            <FaShieldAlt />
          </div>
          <div className="superadmin-password-header-text">
            <h2 id="superadmin-pw-modal-title" className="superadmin-password-title">
              Change Password
            </h2>
            <p className="superadmin-password-subtitle">
              Securely update your superadmin root account credentials
            </p>
          </div>
        </div>

        <div className="superadmin-password-content">
          {error && (
            <div className="superadmin-password-error" role="alert">
              <FaExclamationCircle className="superadmin-password-error-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="superadmin-password-form">
            {/* Current Password */}
            <div className="superadmin-password-field">
              <label className="superadmin-password-label" htmlFor="sa-current-pw">
                Current Password
              </label>
              <div className="superadmin-password-input-wrap">
                <FaKey className="superadmin-password-icon" />
                <input
                  id="sa-current-pw"
                  type={showCurrentPassword ? 'text' : 'password'}
                  className="superadmin-password-input"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your current password"
                  disabled={loading}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="superadmin-password-eye-btn"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  tabIndex={-1}
                  disabled={loading}
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                >
                  {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="superadmin-password-field">
              <label className="superadmin-password-label" htmlFor="sa-new-pw">
                New Password
              </label>
              <div className="superadmin-password-input-wrap">
                <FaLock className="superadmin-password-icon" />
                <input
                  id="sa-new-pw"
                  type={showNewPassword ? 'text' : 'password'}
                  className="superadmin-password-input"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Create a strong new password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="superadmin-password-eye-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  disabled={loading}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="superadmin-password-field">
              <label className="superadmin-password-label" htmlFor="sa-confirm-pw">
                Confirm New Password
              </label>
              <div className="superadmin-password-input-wrap">
                <FaLock className="superadmin-password-icon" />
                <input
                  id="sa-confirm-pw"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="superadmin-password-input"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Repeat your new password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="superadmin-password-eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  disabled={loading}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Password Requirements Checklist */}
            <div className="superadmin-password-requirements">
              <div className="superadmin-req-header">Password Requirements</div>
              <ul className="superadmin-req-grid">
                <li className={`superadmin-req-item ${hasMinLength ? 'valid' : ''}`}>
                  {hasMinLength ? (
                    <FaCheckCircle className="superadmin-req-bullet icon-valid" />
                  ) : (
                    <FaRegCircle className="superadmin-req-bullet icon-pending" />
                  )}
                  <span>At least 8 characters</span>
                </li>
                <li className={`superadmin-req-item ${hasUpper ? 'valid' : ''}`}>
                  {hasUpper ? (
                    <FaCheckCircle className="superadmin-req-bullet icon-valid" />
                  ) : (
                    <FaRegCircle className="superadmin-req-bullet icon-pending" />
                  )}
                  <span>Uppercase letter (A-Z)</span>
                </li>
                <li className={`superadmin-req-item ${hasLower ? 'valid' : ''}`}>
                  {hasLower ? (
                    <FaCheckCircle className="superadmin-req-bullet icon-valid" />
                  ) : (
                    <FaRegCircle className="superadmin-req-bullet icon-pending" />
                  )}
                  <span>Lowercase letter (a-z)</span>
                </li>
                <li className={`superadmin-req-item ${hasNumber ? 'valid' : ''}`}>
                  {hasNumber ? (
                    <FaCheckCircle className="superadmin-req-bullet icon-valid" />
                  ) : (
                    <FaRegCircle className="superadmin-req-bullet icon-pending" />
                  )}
                  <span>At least one number (0-9)</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="superadmin-password-actions">
              <button
                type="button"
                className="superadmin-btn-cancel"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="superadmin-btn-submit"
                disabled={loading}
              >
                {loading && <span className="superadmin-btn-spinner" />}
                <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
              </button>
            </div>
          </form>

          <p className="superadmin-password-note">
            <FaShieldAlt className="superadmin-password-note-icon" />
            <span>Updates take effect immediately on all active sessions</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperadminChangePasswordModal;
