import React, { useEffect, useRef } from 'react';
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
  confirmText = 'OK' 
}) => {
  const confirmButtonRef = useRef(null);

  const IconComponent = DEFAULT_ICONS[type] || FaInfoCircle;
  const displayTitle = title !== undefined && title !== null ? title : DEFAULT_TITLES[type];

  // Auto-focus confirmation button for keyboard accessibility
  useEffect(() => {
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, []);

  if (!message) return null;

  return (
    <div 
      className="unified-notification-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="superadmin-notification-modal-title"
    >
      <div 
        className={`unified-notification-modal-card modal-variant-${type}`}
        onClick={(e) => e.stopPropagation()}
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
