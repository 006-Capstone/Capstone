import React, { useState, useEffect, useRef } from 'react';
import { 
  FaCheckCircle, 
  FaExclamationCircle, 
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
  error: FaExclamationCircle,
  warning: FaExclamationTriangle,
  info: FaInfoCircle
};

function ToastItem({ toast, onRemove }) {
  const { id, type = 'info', title, message, duration = 4500 } = toast;
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(duration);
  const timerStartRef = useRef(Date.now());
  const timerTimeoutRef = useRef(null);

  const IconComponent = DEFAULT_ICONS[type] || FaInfoCircle;
  const displayTitle = title !== undefined && title !== null ? title : DEFAULT_TITLES[type];

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(id);
    }, 240);
  };

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
      role="alert"
      aria-live="assertive"
      className={`unified-toast-item toast-${type} ${isExiting ? 'exiting' : ''} ${isPaused ? 'toast-item-paused' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="toast-icon-wrapper">
        <IconComponent />
      </div>

      <div className="toast-content-wrapper">
        {displayTitle && <div className="toast-title">{displayTitle}</div>}
        {message && <div className="toast-message">{message}</div>}
      </div>

      <button
        type="button"
        className="toast-close-btn"
        onClick={handleClose}
        aria-label="Close notification"
      >
        <FaTimes />
      </button>

      {duration > 0 && (
        <div className="toast-progress-bar-container">
          <div
            className="toast-progress-bar"
            style={{
              animationDuration: `${duration}ms`
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ToastItem;
