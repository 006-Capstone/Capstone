import React, { useState } from 'react';
import { FaLock, FaEye, FaEyeSlash, FaShieldAlt } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import '../styles/ChangePasswordModal.css';

const ChangePasswordModal = ({ studentData, onPasswordChanged }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      
      // Check if new password is same as old password
      // Try to reauthenticate with the new password to see if it's the current password
      try {
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        await reauthenticateWithCredential(user, credential);
        
        // If reauthentication succeeds, it means new password = old password
        setError('You cannot reuse your previous password. Please choose a different password for security reasons.');
        setLoading(false);
        return;
      } catch (reauthError) {
        // If reauthentication fails, it means new password ≠ old password (good!)
        // Continue with password change
        if (reauthError.code !== 'auth/wrong-password' && reauthError.code !== 'auth/invalid-credential') {
          // If error is NOT wrong-password, something else went wrong
          throw reauthError;
        }
        // If it IS wrong-password, that's good - new password is different from old
      }

      // Update password in Firebase Authentication
      await updatePassword(user, newPassword);

      // Update mustChangePassword flag in Firestore
      const studentRef = doc(db, 'students', studentData.firestoreDocId);
      await updateDoc(studentRef, {
        mustChangePassword: false,
        passwordLastChanged: new Date().toISOString()
      });

      // Update localStorage
      const updatedStudentData = {
        ...studentData,
        mustChangePassword: false
      };
      localStorage.setItem('studentData', JSON.stringify(updatedStudentData));

      alert('✓ Password changed successfully! You can now access your portal.');
      onPasswordChanged();

    } catch (error) {
      console.error('Error changing password:', error);
      
      if (error.code === 'auth/requires-recent-login') {
        setError('For security reasons, please log in again to change your password.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('Failed to change password: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-modal-overlay">
      <div className="change-password-modal">
        <div className="modal-icon-container">
          <FaShieldAlt className="modal-icon" />
        </div>
        
        <h2 className="modal-title">Change Your Password</h2>
        <p className="modal-subtitle">
          For security reasons, you must change your temporary password before accessing your account.
        </p>

        <form onSubmit={handleSubmit} className="change-password-form">
          {error && (
            <div className="error-message-modal">
              {error}
            </div>
          )}

          <div className="form-group-modal">
            <label className="form-label-modal">New Password</label>
            <div className="password-input-wrapper-modal">
              <FaLock className="input-icon" />
              <input
                type={showNewPassword ? "text" : "password"}
                className="form-input-modal"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn-modal"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={loading}
              >
                {showNewPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="form-group-modal">
            <label className="form-label-modal">Confirm Password</label>
            <div className="password-input-wrapper-modal">
              <FaLock className="input-icon" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="form-input-modal"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn-modal"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
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
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>

        <p className="modal-note">
          <FaLock /> This is a one-time mandatory password change for your security.
        </p>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
