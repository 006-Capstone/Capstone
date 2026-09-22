import React from 'react';
import ToastItem from './ToastItem';

function ToastContainer({ toasts, onRemove }) {
  if (!toasts || toasts.length === 0) return null;

  // Display the active modal notification (queue mode: handles one modal at a time cleanly)
  const activeToast = toasts[toasts.length - 1];

  return (
    <ToastItem key={activeToast.id} toast={activeToast} onRemove={onRemove} />
  );
}

export default ToastContainer;
