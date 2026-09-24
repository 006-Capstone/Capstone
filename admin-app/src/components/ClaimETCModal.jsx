import React, { useState, useMemo } from 'react';
import { FaCalendarAlt, FaCheck, FaTimes, FaUserCheck } from 'react-icons/fa';
import DropdownCalendar from './common/DropdownCalendar';
import '../styles/ClaimETCModal.css';

// Default estimate: two days from today
const isoDateFromOffset = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Presets for Set Completion Date modal
const SET_COMPLETION_DATE_PRESETS = [
  { label: 'Today', offset: 0 },
  { label: '+2 Days', offset: 2 },
  { label: '+4 Days', offset: 4 },
  { label: '+6 Days', offset: 6 }
];

const formatReadableDate = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    const [y, m, d] = dateVal.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return dateVal;
  }
  const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  return String(dateVal);
};

const ClaimETCModal = ({ ticket, onConfirm, onCancel }) => {
  const [date, setDate] = useState(isoDateFromOffset(2));
  
  // Check if ticket is rerouted (original office already set the target completion date)
  const targetDate = ticket?.internalTargetDate || ticket?.etc;
  const isReroutedTicket = Boolean(ticket && ticket.previousOffice && targetDate);
  const formattedTargetDate = formatReadableDate(targetDate);

  const targetDaysCount = useMemo(() => {
    if (ticket?.targetDays) return ticket.targetDays;
    if (targetDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let targetObj = null;
      if (typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(targetDate)) {
        const [y, m, d] = targetDate.substring(0, 10).split('-').map(Number);
        targetObj = new Date(y, m - 1, d);
      } else if (targetDate?.toDate) {
        targetObj = targetDate.toDate();
      } else {
        const p = new Date(targetDate);
        if (!isNaN(p.getTime())) targetObj = p;
      }
      if (targetObj) {
        targetObj.setHours(0, 0, 0, 0);
        const diff = Math.round((targetObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff);
      }
    }
    return null;
  }, [ticket, targetDate]);

  return (
    <div className="etc-modal-overlay" onClick={onCancel}>
      <div 
        className="etc-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="etc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="etc-modal-close" onClick={onCancel} aria-label="Close">
          <FaTimes />
        </button>

        <div className="etc-modal-icon">
          {isReroutedTicket ? <FaUserCheck /> : <FaCalendarAlt />}
        </div>

        <h2 id="etc-modal-title" className="etc-modal-title">
          {isReroutedTicket ? 'Claim Rerouted Request' : 'Set Completion Date'}
        </h2>
        <p className="etc-modal-subtitle">
          Claiming <strong>#{ticket.id}</strong> — {ticket.title}
        </p>

        <div className="etc-modal-body">
          {isReroutedTicket ? (
            <>
              {/* Highlight card displaying the original department's Target Completion Date */}
              <div className="etc-rerouted-card">
                <div className="etc-rerouted-card-header">
                  <span className="etc-rerouted-card-label">TARGET COMPLETION DATE</span>
                  <span className="etc-rerouted-dept-badge">{ticket.previousOffice} Office</span>
                </div>

                <div className="etc-rerouted-date-display">
                  <FaCalendarAlt className="etc-rerouted-calendar-icon" />
                  <span className="etc-rerouted-date-text">
                    {formattedTargetDate}
                    {targetDaysCount ? ` (${targetDaysCount} ${targetDaysCount === 1 ? 'day' : 'days'})` : ''}
                  </span>
                </div>

                {ticket.internalTargetSetBy && (
                  <div className="etc-rerouted-meta">
                    Set by <strong>{ticket.internalTargetSetBy}</strong>
                  </div>
                )}
              </div>

              <div className="etc-notice">
                <FaUserCheck className="etc-notice-icon" />
                <span>
                  This request was rerouted from <strong>{ticket.previousOffice}</strong> with this completion deadline. You can claim it directly to proceed.
                </span>
              </div>
            </>
          ) : (
            <>
              <label className="etc-field-label" htmlFor="etc-date">
                ESTIMATED TIME OF COMPLETION
              </label>
              <DropdownCalendar
                id="etc-date"
                value={date}
                onChange={setDate}
                minDate={isoDateFromOffset(0)}
                presets={SET_COMPLETION_DATE_PRESETS}
                placeholder="Select estimated completion date"
                ariaLabel="Estimated Time of Completion"
              />

              <div className="etc-notice">
                <FaUserCheck className="etc-notice-icon" />
                <span>Setting this date notifies the student about the estimated turnaround time.</span>
              </div>
            </>
          )}
        </div>

        <div className="etc-modal-actions">
          <button type="button" className="etc-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="etc-btn-primary"
            onClick={() => onConfirm(isReroutedTicket ? null : date)}
            disabled={!isReroutedTicket && !date}
          >
            <FaCheck /> Confirm & Claim Request
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimETCModal;