import React, { useState, useEffect, useRef } from 'react';
import { FaClock, FaExclamationTriangle } from 'react-icons/fa';
import '../styles/IdleTimeout.css';

const IDLE_TIMEOUT = 1 * 60 * 1000; // 1 minute (60 seconds)
const WARNING_DURATION = 5 * 1000; // 5 seconds

const IdleTimeout = ({ onLogout, isGuest }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(5); // 5 seconds countdown
  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  useEffect(() => {
    // Don't apply idle timeout to guest users
    if (isGuest) {
      console.log('[IdleTimeout] Guest user - idle timeout disabled');
      return;
    }

    console.log('[IdleTimeout] Idle timeout system initialized');

    const handleLogout = () => {
      console.log('[IdleTimeout] Logging out due to inactivity');
      // Clear all timers
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      setShowWarning(false);
      onLogout();
    };

    const startWarningCountdown = () => {
      console.log('[IdleTimeout] Showing idle warning modal');
      setShowWarning(true);
      setCountdown(5); // 5 seconds countdown

      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Set timer to auto-logout after WARNING_DURATION
      warningTimerRef.current = setTimeout(() => {
        handleLogout();
      }, WARNING_DURATION);
    };

    const resetIdleTimer = () => {
      // Clear existing timers
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      // Hide warning if showing
      setShowWarning(false);
      setCountdown(5); // Reset to 5 seconds

      // Set new idle timer
      idleTimerRef.current = setTimeout(() => {
        console.log('[IdleTimeout] Idle timeout reached - showing warning');
        startWarningCountdown();
      }, IDLE_TIMEOUT);
    };

    // Activity event listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      if (!showWarning) {
        resetIdleTimer();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the initial timer
    resetIdleTimer();

    // Cleanup function
    return () => {
      console.log('[IdleTimeout] Cleaning up idle timeout');
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isGuest, onLogout]); // Only depend on isGuest and onLogout

  const handleStayLoggedIn = () => {
    console.log('[IdleTimeout] User clicked "Stay Logged In"');
    
    // Clear timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Hide warning
    setShowWarning(false);
    setCountdown(5); // Reset to 5 seconds

    // Restart idle timer
    idleTimerRef.current = setTimeout(() => {
      console.log('[IdleTimeout] Idle timeout reached - showing warning');
      setShowWarning(true);
      setCountdown(5); // 5 seconds countdown

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      warningTimerRef.current = setTimeout(() => {
        onLogout();
      }, WARNING_DURATION);
    }, IDLE_TIMEOUT);
  };

  const handleLogoutNow = () => {
    console.log('[IdleTimeout] User clicked "Log Out Now"');
    
    // Clear all timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setShowWarning(false);
    onLogout();
  };

  // Don't render anything for guest users
  if (isGuest || !showWarning) {
    return null;
  }

  return (
    <div className="idle-timeout-overlay">
      <div className="idle-timeout-modal" role="dialog" aria-modal="true" aria-labelledby="idle-timeout-title">
        <div className="idle-timeout-icon">
          <FaExclamationTriangle />
        </div>
        
        <h2 id="idle-timeout-title" className="idle-timeout-title">
          Are you still there?
        </h2>
        
        <p className="idle-timeout-message">
          You've been inactive for a while. For your security, you will be automatically logged out in:
        </p>
        
        <div className="idle-timeout-countdown">
          <FaClock className="countdown-icon" />
          <span className="countdown-number">{countdown}</span>
          <span className="countdown-label">seconds</span>
        </div>
        
        <div className="idle-timeout-actions">
          <button 
            className="idle-timeout-btn idle-timeout-btn-primary"
            onClick={handleStayLoggedIn}
            autoFocus
          >
            Stay Logged In
          </button>
          <button 
            className="idle-timeout-btn idle-timeout-btn-secondary"
            onClick={handleLogoutNow}
          >
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdleTimeout;
