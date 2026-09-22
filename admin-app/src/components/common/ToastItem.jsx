import React, { useState, useEffect, useRef } from 'react';
import { 
  FaCheckCircle, 
  FaTimesCircle, 
  FaExclamationTriangle, 
  FaInfoCircle, 
  FaTimes 
} from 'react-icons/fa';

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

function ToastItem({ toast, onRemove }) {
  const { id, type = 'info', title, message, duration = 4500, confirmText = 'OK' } = toast;
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(duration);
  const timerStartRef = useRef(Date.now());
  const timerTimeoutRef = useRef(null);
  const confirmButtonRef = useRef(null);

  const IconComponent = DEFAULT_ICONS[type] || FaInfoCircle;
  const displayTitle = title !== undefined && title !== null ? title : DEFAULT_TITLES[type];

  const handleClose = () => {
    onRemove(id);
  };

  // Focus action button when modal opens & support Escape key
  useEffect(() => {
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [id, onRemove]);

  // Auto-dismiss countdown timer with pause on hover
  useEffect(() => {
    if (duration <= 0) return;

    const startTimer = (time) => {
      timerStartRef.current = Date.now();
      timerTimeoutRef.current = setTimeout(() => {
        handleClose();
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
  }, [isPaused, duration]);

  const handleMouseEnter = () => {
    if (duration <= 0) return;
    setIsPaused(true);
    if (timerTimeoutRef.current) {
      clearTimeout(timerTimeoutRef.current);
    }
    const elapsed = Date.now() - timerStartRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    if (duration <= 0) return;
    setIsPaused(false);
  };

  return (
    <div
      className="unified-notification-modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`notification-modal-title-${id}`}
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
            <h3 id={`notification-modal-title-${id}`} className="notification-modal-title">
              {displayTitle}
            </h3>
            <p className="notification-modal-message">
              {message}
            </p>
          </div>
          <button
            type="button"
            className="notification-modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>

        {duration > 0 && (
          <div className="notification-modal-progress-container">
            <div
              className={`notification-modal-progress-bar variant-${type}`}
              style={{ animationDuration: `${duration}ms` }}
            />
          </div>
        )}

        <div className="notification-modal-actions">
          <button
            type="button"
            ref={confirmButtonRef}
            className={`notification-modal-btn-action variant-${type}`}
            onClick={handleClose}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ToastItem;
