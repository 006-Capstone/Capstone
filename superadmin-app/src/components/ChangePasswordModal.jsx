import React, { useState } from 'react';
import { FaLock, FaTimes, FaShieldAlt, FaEnvelope } from 'react-icons/fa';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/ChangePasswordModal.css';

const ChangePasswordModal = ({ user, onClose, onPasswordChanged }) => {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendResetEmail = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const auth = getAuth();
      
      // Send password reset email
      await sendPasswordResetEmail(auth, user.email);

      // Record password reset dispatch in Firestore so it's captured in audit history
      try {
        const isStudent = user.userType === 'student' || user.accountType === 'student' || user.studentId || (!user.office && user.id && user.id.length <= 6);
        const targetCollection = isStudent ? 'students' : 'staff';
        const docId = user.firestoreId || user.id;
        const adminEmail = auth?.currentUser?.email || 'Super Admin';

        if (docId) {
          await updateDoc(doc(db, targetCollection, docId), {
            passwordResetAt: serverTimestamp(),
            lastPasswordResetAt: serverTimestamp(),
            passwordResetBy: adminEmail
          });
        }

        // Also add an audit log to activityLogs collection
        try {
          await addDoc(collection(db, 'activityLogs'), {
            userId: user.uid || user.firestoreId || docId,
            userEmail: user.email,
            action: 'Password reset email dispatched',
            category: 'security',
            details: `Password reset recovery link generated and dispatched to ${user.email} by ${adminEmail}`,
            status: 'Dispatched',
            timestamp: serverTimestamp()
          });
        } catch (actErr) {
          console.warn('[ActivityLog] Could not write to activityLogs collection:', actErr);
        }
      } catch (docErr) {
        console.warn('Could not record passwordResetAt on user document:', docErr);
      }
      
      setSuccess(`Password reset email sent to ${user.email}. The user can click the link in the email to set a new password.`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      
      if (error.code === 'auth/user-not-found') {
        setError('User not found in Firebase Authentication');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError('Failed to send reset email: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="change-password-modal">
        <button
          type="button"
          className="modal-close-btn-x"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        <div className="modal-icon-container">
          <FaShieldAlt className="modal-icon" />
        </div>
        
        <h2 className="modal-title">Reset Password</h2>
        <p className="modal-subtitle">
          Send a password reset email to <strong>{user.name || user.email}</strong>
        </p>

        <div className="change-password-form">
          {error && (
            <div className="error-message-modal">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message-modal">
              {success}
            </div>
          )}

          <div className="reset-info-box">
            <FaEnvelope className="reset-icon" />
            <div>
              <p className="reset-email"><strong>{user.email}</strong></p>
              <p className="reset-description">
                A password reset link will be sent to this email address. 
                The user can click the link to create a new password.
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={success ? onPasswordChanged : handleSendResetEmail}
            className="submit-btn-modal" 
            disabled={loading}
          >
            {loading ? 'Sending Email...' : success ? 'Close' : 'Send Password Reset Email'}
          </button>
        </div>

        <p className="modal-note">
          <FaLock /> The reset link will expire in 1 hour for security.
        </p>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
