import React from 'react';
import ToastItem from './ToastItem';

function ToastContainer({ toasts, onRemove, position = 'top-right' }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className={`unified-toast-container ${position}`}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

export default ToastContainer;
