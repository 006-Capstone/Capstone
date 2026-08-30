import React, { useState } from 'react';
import { FaCalendarAlt, FaCheck, FaTimes, FaUserCheck } from 'react-icons/fa';
import '../styles/ClaimETCModal.css';

// Default estimate: two days from today (mirrors the old static "2 days").
const isoDateFromOffset = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ClaimETCModal = ({ ticket, onConfirm, onSkip, onCancel }) => {
  const [date, setDate] = useState(isoDateFromOffset(2));

  return (
    <div className="etc-modal-overlay">
      <div className="etc-modal" role="dialog" aria-modal="true" aria-labelledby="etc-modal-title">
        <button className="etc-modal-close" onClick={onCancel} aria-label="Close">
          <FaTimes />
        </button>

        <div className="etc-modal-icon">
          <FaCalendarAlt />
        </div>

        <h2 id="etc-modal-title" className="etc-modal-title">Set Completion Date</h2>
        <p className="etc-modal-subtitle">
          Claiming <strong>#{ticket.id}</strong> — {ticket.title}
        </p>

        <div className="etc-modal-body">
          <label className="etc-field-label" htmlFor="etc-date">
            ESTIMATED TIME OF COMPLETION
          </label>
          <input
            id="etc-date"
            type="date"
            className="etc-date-input"
            value={date}
            min={isoDateFromOffset(0)}
            onChange={(e) => setDate(e.target.value)}
          />

          <div className="etc-notice">
            <FaUserCheck className="etc-notice-icon" />
            <span>Confirming this date will automatically notify the student.</span>
          </div>
        </div>

        <div className="etc-modal-actions">
          <button
            type="button"
            className="etc-btn-primary"
            onClick={() => onConfirm(date)}
            disabled={!date}
          >
            <FaCheck /> Confirm & Claim Request
          </button>
          <button type="button" className="etc-btn-secondary" onClick={onSkip}>
            Skip — Claim Without a Date
          </button>
          <button type="button" className="etc-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimETCModal;