import React, { useEffect, useRef } from 'react';
import { 
  FaExclamationTriangle, 
  FaQuestionCircle, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaInfoCircle 
} from 'react-icons/fa';

const VARIANT_ICONS = {
  danger: FaTimesCircle,
  warning: FaExclamationTriangle,
  success: FaCheckCircle,
  primary: FaQuestionCircle,
  info: FaInfoCircle
};

function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isAlertOnly = false,
  onConfirm,
  onCancel
}) {
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    // Focus confirm button when modal opens
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const IconComponent = VARIANT_ICONS[variant] || FaQuestionCircle;

  return (
    <div 
      className="unified-confirm-overlay" 
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div 
        className="unified-confirm-card" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">
          <div className={`confirm-icon-box variant-${variant}`}>
            <IconComponent />
          </div>
          <div className="confirm-header-content">
            <h3 id="confirm-modal-title" className="confirm-title">{title}</h3>
            <p className="confirm-message">{message}</p>
          </div>
        </div>

        <div className="confirm-actions">
          {!isAlertOnly && (
            <button
              type="button"
              className="confirm-btn-cancel"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            ref={confirmButtonRef}
            className={`confirm-btn-action variant-${variant}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
