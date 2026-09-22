import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ToastContainer from '../components/common/ToastContainer';
import ConfirmModal from '../components/common/ConfirmModal';
import '../styles/toast-modal-system.css';

const NotificationContext = createContext(null);

let toastIdCounter = 0;

export function NotificationProvider({ children, position = 'top-right' }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const resolveConfirmRef = useRef(null);

  // Remove toast by ID
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Clear all active toasts
  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Core add toast method
  const addToast = useCallback(({ type = 'info', title, message, duration = 4500 }) => {
    const id = ++toastIdCounter;
    const newToast = {
      id,
      type,
      title,
      message,
      duration,
      createdAt: Date.now()
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  // Helper parser for flexible arguments: (messageOrOptions, optionalTitle, optionalOptions)
  const parseToastArgs = useCallback((type, arg1, arg2, arg3) => {
    if (typeof arg1 === 'object' && arg1 !== null) {
      return addToast({ type, ...arg1 });
    }

    const message = typeof arg1 === 'string' ? arg1 : String(arg1 || '');
    const title = typeof arg2 === 'string' ? arg2 : undefined;
    const extraOptions = typeof arg2 === 'object' ? arg2 : (typeof arg3 === 'object' ? arg3 : {});

    return addToast({
      type,
      message,
      title,
      ...extraOptions
    });
  }, [addToast]);

  // Toast API object
  const toast = useCallback((options) => {
    if (typeof options === 'string') {
      return addToast({ message: options, type: 'info' });
    }
    return addToast(options);
  }, [addToast]);

  toast.show = addToast;
  toast.success = useCallback((msg, title, opt) => parseToastArgs('success', msg, title, opt), [parseToastArgs]);
  toast.error = useCallback((msg, title, opt) => parseToastArgs('error', msg, title, opt), [parseToastArgs]);
  toast.warning = useCallback((msg, title, opt) => parseToastArgs('warning', msg, title, opt), [parseToastArgs]);
  toast.info = useCallback((msg, title, opt) => parseToastArgs('info', msg, title, opt), [parseToastArgs]);
  toast.remove = removeToast;
  toast.clear = clearToasts;

  // Direct showToast helper matching legacy pattern `showToast(message, type, title, duration)`
  const showToast = useCallback((message, type = 'success', title, duration = 4500) => {
    return addToast({
      message,
      type,
      title,
      duration
    });
  }, [addToast]);

  // Styled promise-based Confirm Dialog
  const confirm = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'primary'
  } = {}) => {
    return new Promise((resolve) => {
      resolveConfirmRef.current = resolve;
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        variant,
        isAlertOnly: false
      });
    });
  }, []);

  // Styled promise-based Alert Modal
  const alertModal = useCallback(({
    title = 'Notice',
    message = '',
    confirmText = 'OK',
    variant = 'info'
  } = {}) => {
    return new Promise((resolve) => {
      resolveConfirmRef.current = resolve;
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText: '',
        variant,
        isAlertOnly: true
      });
    });
  }, []);

  const handleConfirmAction = useCallback(() => {
    if (resolveConfirmRef.current) {
      resolveConfirmRef.current(true);
      resolveConfirmRef.current = null;
    }
    setConfirmDialog(null);
  }, []);

  const handleCancelAction = useCallback(() => {
    if (resolveConfirmRef.current) {
      resolveConfirmRef.current(false);
      resolveConfirmRef.current = null;
    }
    setConfirmDialog(null);
  }, []);

  const contextValue = {
    toast,
    showToast,
    confirm,
    alertModal,
    removeToast,
    clearToasts
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} position={position} />
      {confirmDialog && (
        <ConfirmModal
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          variant={confirmDialog.variant}
          isAlertOnly={confirmDialog.isAlertOnly}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export function useToast() {
  return useNotification();
}

export default NotificationContext;
