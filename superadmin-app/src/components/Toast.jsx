import React, { useState, useEffect, useRef } from 'react';
import { 
  FaCheckCircle, 
  FaTimesCircle, 
  FaExclamationTriangle, 
  FaInfoCircle, 
  FaTimes 
} from 'react-icons/fa';
import '../styles/notification-modal-system.css';

const DEFAULT_TITLES = {
  success: 'Success',
  error: 'Action Failed',
  warning: 'Warning',
  info: 'Information'
};

const DEFAULT_ICONS = {
  success: FaCheckCircle,
  error: FaTimesCircle,
  warning: FaExclamationTriangle,
  info: FaInfoCircle
};

const Toast = ({ 
  type = 'success', 
  message, 
  title, 
  onClose, 
  autoDismiss = 4000, 
  confirmText = 'OK',
  closeOnOverlayClick = true
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(autoDismiss);
  const timerStartRef = useRef(Date.now());
  const timerTimeoutRef = useRef(null);
  const confirmButtonRef = useRef(null);

  const IconComponent = DEFAULT_ICONS[type] || FaInfoCircle;
  const displayTitle = title !== undefined && title !== null ? title : DEFAULT_TITLES[type];

  // Auto-focus confirmation button & support Escape key (if overlay click/escape dismissal allowed)
  useEffect(() => {
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnOverlayClick && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, closeOnOverlayClick]);

  // Auto-dismiss countdown with hover pause
  useEffect(() => {
    if (!message || autoDismiss <= 0) return undefined;

    const startTimer = (time) => {
      timerStartRef.current = Date.now();
      timerTimeoutRef.current = setTimeout(() => {
        if (onClose) onClose();
      }, time);
    };

    if (!isPaused) {
      startTimer(remainingTimeRef.current);
    }

    return () => {
      if (timerTimeoutRef.current) {
        clearTimeout(timerTimeoutRef.current);
      }
    };
  }, [message, isPaused, autoDismiss, onClose]);

  const handleMouseEnter = () => {
    if (autoDismiss <= 0) return;
    setIsPaused(true);
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
    }
    const elapsed = Date.now() - timerStartRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    if (autoDismiss <= 0) return;
    setIsPaused(false);
  };

  if (!message) return null;

  return (
    <div 
      className="unified-notification-modal-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="superadmin-notification-modal-title"
    >
      <div 
        className={`unified-notification-modal-card modal-variant-${type} ${isPaused ? 'modal-timer-paused' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="notification-modal-header">
          <div className={`notification-modal-icon-box variant-${type}`}>
            <IconComponent />
          </div>
          <div className="notification-modal-header-content">
            <h3 id="superadmin-notification-modal-title" className="notification-modal-title">
              {displayTitle}
            </h3>
            <p className="notification-modal-message">
              {message}
            </p>
          </div>
          <button
            type="button"
            className="notification-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>

        {autoDismiss > 0 && (
          <div className="notification-modal-progress-container">
            <div
              className={`notification-modal-progress-bar variant-${type}`}
              style={{ animationDuration: `${autoDismiss}ms` }}
            />
          </div>
        )}

        <div className="notification-modal-actions">
          <button
            type="button"
            ref={confirmButtonRef}
            className={`notification-modal-btn-action variant-${type}`}
            onClick={onClose}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
