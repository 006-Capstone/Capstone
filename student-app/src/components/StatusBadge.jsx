import React from 'react';

/**
 * Maps request statuses to their Figma-design badge styles.
 */
const STATUS_CLASS_MAP = {
  pending: 'status-pending',
  'in process': 'status-in-process',
  'in progress': 'status-in-process',
  resolved: 'status-resolved',
  cancelled: 'status-cancelled',
  returned: 'status-returned',
  'for follow up': 'status-for-follow-up'
};

/**
 * Reusable request-status badge.
 * @param {{ status?: string, className?: string }} props
 */
function StatusBadge({ status, className = '' }) {
  const key = String(status || 'Pending').toLowerCase().trim();
  const statusModifier = STATUS_CLASS_MAP[key] || 'status-pending';
  return (
    <span className={`status-badge ${statusModifier} ${className}`.trim()}>
      <span className="status-dot" aria-hidden="true"></span>
      {status || 'Pending'}
    </span>
  );
}

export default StatusBadge;
