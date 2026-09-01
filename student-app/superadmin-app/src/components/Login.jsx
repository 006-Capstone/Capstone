import React, { useState } from 'react';
import { FaShieldAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Basic validation
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
      // Query for superadmin by username
      const superadminQuery = query(
        collection(db, 'superadmin'),
        where('username', '==', username.trim())
      );
      
      const querySnapshot = await getDocs(superadminQuery);
      
      if (querySnapshot.empty) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      const superadminDoc = querySnapshot.docs[0];
      const superadminData = superadminDoc.data();

      // Check if superadmin is active
      if (!superadminData.isActive) {
        setError('Your account has been suspended.');
        setLoading(false);
        return;
      }

      // Authenticate with Firebase using email and password
      await signInWithEmailAndPassword(auth, superadminData.email, password);

      // Store superadmin info in localStorage
      localStorage.setItem('superadminAuth', 'true');
      localStorage.setItem('superadminData', JSON.stringify({
        username: superadminData.username,
        email: superadminData.email,
        uid: superadminData.uid
      }));
      
      console.log('✅ Superadmin logged in');
      onLogin();
      
    } catch (error) {
      console.error('❌ Login error:', error);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError('Invalid password. Please try again.');
      } else if (error.code === 'auth/user-not-found') {
        setError('Superadmin account not found.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
      
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="superadmin-login">
        <div className="login-left green-solid">
          {/* Green background - no image for now */}
        </div>
        
        <div className="login-right">
          <div className="login-form-container">
            <div className="login-header">
              <h1 className="login-title">Welcome Back</h1>
              <p className="login-subtitle">Please enter your credentials to access your account.</p>
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
              
              <div className="form-group">
                <label className="form-label">Username/ Student ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder=""
                  required
                />
              </div>
              
              <div className="form-group">
                <div className="password-label-row">
                  <label className="form-label">Password</label>
                  <a href="#forgot-password" className="forgot-password" onClick={(e) => { e.preventDefault(); alert('Please contact IT support to reset your password.'); }}>Forgot Password?</a>
                </div>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=""
                    required
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
              
              <div className="remember-section">
                <input
                  type="checkbox"
                  id="remember"
                  className="remember-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="remember" className="remember-label">
                  Remember this device
                </label>
              </div>
              
              <button type="submit" className="sign-in-button" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              
              <div className="secure-badge">
                <FaShieldAlt className="secure-icon" />
                <p className="secure-text">Secure-bit Connection Verified</p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
