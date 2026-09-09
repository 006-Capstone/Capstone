import React, { useState } from 'react';
import { FaEnvelope, FaKey, FaLock, FaTimes, FaCheckCircle, FaArrowLeft } from 'react-icons/fa';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import '../styles/ForgotPassword.css';

const ForgotPassword = ({ onClose }) => {
  const [step, setStep] = useState(1); // 1: Student ID, 2: Verify Code, 3: New Password
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState(''); // Hidden from user, fetched automatically
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentData, setStudentData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(60); // 1 minute = 60 seconds
  const [timerActive, setTimerActive] = useState(false);

  // Countdown timer for verification code expiration
  React.useEffect(() => {
    let interval = null;
    if (timerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((time) => time - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      setError('Verification code has expired. Please request a new one.');
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!studentId || studentId.length !== 4) {
        setError('Please enter a valid 4-digit Student ID');
        setLoading(false);
        return;
      }

      // Find student in Firestore by Student ID
      const studentsRef = collection(db, 'students');
      const q1 = query(studentsRef, where('id', '==', studentId));
      const q2 = query(studentsRef, where('studentId', '==', studentId));
      
      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);

      let student = null;
      if (!snapshot1.empty) {
        student = { firestoreId: snapshot1.docs[0].id, ...snapshot1.docs[0].data() };
      } else if (!snapshot2.empty) {
        student = { firestoreId: snapshot2.docs[0].id, ...snapshot2.docs[0].data() };
      }

      if (!student) {
        setError('Student ID not found in our records');
        setLoading(false);
        return;
      }

      // Store student data and email (hidden from user)
      setStudentData(student);
      setEmail(student.email);

      // Send verification code to student's registered email
      const API_URL = process.env.NODE_ENV === 'production' 
        ? '' // Vercel will handle /api routes automatically
        : (process.env.REACT_APP_EMAIL_API || 'http://localhost:3000');
      const response = await fetch(`${API_URL}/api/send-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: student.email,
          studentName: student.name || `${student.firstName} ${student.lastName}`,
          studentId: studentId,
          expiryMinutes: 1 // 1 minute expiry
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      // Mask email for privacy (show first 2 chars and domain)
      const maskedEmail = student.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      
      setSuccess(`Verification code sent to ${maskedEmail}`);
      setTimeout(() => {
        setSuccess('');
        setStep(2); // Move to verification step
      }, 2000);
      setTimeRemaining(60); // Reset to 1 minute
      setTimerActive(true);
      setLoading(false);

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Failed to send verification code');
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!verificationCode || verificationCode.length !== 6) {
        setError('Please enter the 6-digit verification code');
        setLoading(false);
        return;
      }

      // Verify code with backend
      const API_URL = process.env.NODE_ENV === 'production' 
        ? '' // Vercel will handle /api routes automatically
        : (process.env.REACT_APP_EMAIL_API || 'http://localhost:3000');
      const response = await fetch(`${API_URL}/api/verify-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          code: verificationCode
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setSuccess('Code verified! Now set your new password.');
      setTimeout(() => {
        setSuccess('');
        setStep(3); // Move to password reset step
      }, 1500);
      setLoading(false);

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Verification failed');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!newPassword || newPassword.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      // Update password using backend API with Firebase Admin SDK
      const API_URL = process.env.NODE_ENV === 'production' 
        ? '' // Vercel will handle /api routes automatically
        : (process.env.REACT_APP_EMAIL_API || 'http://localhost:3000');
      const response = await fetch(`${API_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          newPassword: newPassword,
          verificationCode: verificationCode
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setTimerActive(false);
      setSuccess('Password reset successful! You can now login with your new password.');
      
      setTimeout(() => {
        onClose();
      }, 2500);

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    setVerificationCode(''); // Clear previous code

    try {
      const API_URL = process.env.NODE_ENV === 'production' 
        ? '' // Vercel will handle /api routes automatically
        : (process.env.REACT_APP_EMAIL_API || 'http://localhost:3000');
      const response = await fetch(`${API_URL}/api/send-reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          studentName: studentData.name || `${studentData.firstName} ${studentData.lastName}`,
          studentId: studentId,
          expiryMinutes: 1
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to resend code');
      }

      const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      setSuccess(`New code sent to ${maskedEmail}`);
      setTimeRemaining(60);
      setTimerActive(true);

    } catch (error) {
      setError(error.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToStudentId = () => {
    setStep(1);
    setTimerActive(false);
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleBackToCode = () => {
    setStep(2);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  return (
    <div className="forgot-password-overlay">
      <div className="forgot-password-modal">
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>

        <div className="modal-header">
          <div className="header-icon">
            <FaKey />
          </div>
          <h2>Reset Password</h2>
          <p>Follow the steps to reset your account password</p>
        </div>

        {/* Step Indicator */}
        <div className="steps-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Send Code</div>
          </div>
          <div className="step-line"></div>
          <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Verify Code</div>
          </div>
          <div className="step-line"></div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">New Password</div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <FaCheckCircle /> {success}
          </div>
        )}

        {/* Step 1: Enter Student ID & Send Code */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="reset-form">
            <p className="form-instruction">
              Enter your <strong>4-digit Student ID</strong>. We'll send a verification code to your registered email address.
            </p>
            
            <div className="form-group">
              <label>Student ID</label>
              <div className="input-with-icon">
                <FaEnvelope className="input-icon" />
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,4}$/.test(value)) {
                      setStudentId(value);
                      setError('');
                    }
                  }}
                  placeholder="Enter your 4-digit Student ID"
                  maxLength={4}
                  required
                  autoFocus
                />
              </div>
              <small>Code will expire in 1 minute</small>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </form>
        )}

        {/* Step 2: Enter Verification Code */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="reset-form">
            <p className="form-instruction">
              Check your email for the 6-digit verification code and enter it below.
            </p>

            {/* Timer Display */}
            {timerActive && (
              <div className={`timer-display ${timeRemaining <= 10 ? 'timer-warning' : ''}`}>
                <FaKey className="timer-icon" />
                <span>Code expires in: <strong>{timeRemaining}s</strong></span>
              </div>
            )}
            
            <div className="form-group">
              <label>Verification Code</label>
              <input
                type="text"
                className="code-input"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d{0,6}$/.test(value)) {
                    setVerificationCode(value);
                    setError('');
                  }
                }}
                placeholder="Enter 6-digit code"
                maxLength={6}
                inputMode="numeric"
                required
                autoFocus
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button type="button" className="link-btn" onClick={handleResendCode} disabled={loading}>
              Didn't receive code? Resend
            </button>

            <button type="button" className="link-btn" onClick={handleBackToStudentId}>
              <FaArrowLeft /> Back to Student ID
            </button>
          </form>
        )}

        {/* Step 3: Enter New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="reset-form">
            <p className="form-instruction">
              Your code is verified! Now create a strong new password for your account.
            </p>

            <div className="form-group">
              <label>New Password</label>
              <div className="input-with-icon">
                <FaLock className="input-icon" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter new password"
                  minLength={6}
                  required
                  autoFocus
                />
              </div>
              <small>Minimum 6 characters</small>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="input-with-icon">
                <FaLock className="input-icon" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <button type="button" className="link-btn" onClick={handleBackToCode}>
              <FaArrowLeft /> Back to Verification
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
