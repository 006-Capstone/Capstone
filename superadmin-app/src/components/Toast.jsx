import React from 'react';
import { FaCheck, FaBan } from 'react-icons/fa';

const Toast = ({ type = 'success', message, onClose, autoDismiss = 4000 }) => {
  React.useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, autoDismiss);
    return () => window.clearTimeout(timer);
  }, [message, onClose, autoDismiss]);

  if (!message) return null;

  return (
    <div className={`toast ${type === 'error' ? 'toast--error' : 'toast--success'}`} role="status">
      {type === 'error'
        ? <FaBan className="toast-icon" aria-hidden="true" />
        : <FaCheck className="toast-icon" aria-hidden="true" />}
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss notification">
        &times;
      </button>
    </div>
  );
};

export default Toast;
