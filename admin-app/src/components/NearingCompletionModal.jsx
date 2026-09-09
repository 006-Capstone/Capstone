import React, { useState, useMemo, useEffect } from 'react';
import { 
  FaTimes, 
  FaSearch, 
  FaClock, 
  FaExclamationTriangle, 
  FaCalendarAlt, 
  FaUserCircle, 
  FaArrowRight, 
  FaCheckCircle, 
  FaHourglassHalf
} from 'react-icons/fa';
import { parseTicketETC, groupRequestsByUrgency } from '../utils/etcHelper';
import '../styles/NearingCompletionModal.css';

/**
 * NearingCompletionModal
 * A high-visibility modal popup summarizing all active requests that are
 * approaching or have passed their Estimated Time of Completion (ETC).
 *
 * @param {boolean} isOpen Whether modal is visible.
 * @param {Function} onClose Callback to close the modal.
 * @param {Array} tickets All office tickets from useOfficeTickets.
 * @param {string} department Current office name (e.g. 'Registrar').
 * @param {Function} onViewRequest Navigates directly to ticket details for immediate processing.
 * @param {Function} onGoToQueue Navigates to tickets table / queue.
 */
const NearingCompletionModal = ({ 
  isOpen, 
  onClose, 
  tickets = [], 
  department = '', 
  onViewRequest,
  onGoToQueue
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'overdue' | 'today' | 'tomorrow'
  const [dontShowAgainSession, setDontShowAgainSession] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dontShowAgainSession]);

  // Handle closing with session persistence if selected
  const handleDismiss = () => {
    if (dontShowAgainSession) {
      try {
        sessionStorage.setItem('dismissed_nearing_etc_popup', 'true');
      } catch (e) {
        // Safe fallback if sessionStorage is restricted
      }
    }
    onClose();
  };

  // Filter and enrich active tickets that are overdue, due today, or due tomorrow (excluding due in 2+ days)
  const activeEtcTickets = useMemo(() => {
    if (!Array.isArray(tickets)) return [];

    const list = [];
    for (const ticket of tickets) {
      const status = (ticket.status || '').trim().toLowerCase();
      // Skip resolved, cancelled, or rejected tickets
      if (status === 'resolved' || status === 'cancelled' || status === 'rejected') {
        continue;
      }

      const etcInfo = parseTicketETC(ticket);
      if (!etcInfo) continue;

      // Only include overdue, today, and tomorrow (due in 2+ days removed)
      if (etcInfo.isOverdue || etcInfo.isToday || etcInfo.isTomorrow) {
        list.push({
          ...ticket,
          etcInfo
        });
      }
    }

    // Sort by urgency: most overdue first, then today, then tomorrow
    list.sort((a, b) => a.etcInfo.diffDays - b.etcInfo.diffDays);
    return list;
  }, [tickets]);

  // Overall counts for summary cards
  const summaryCounts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let tomorrow = 0;

    for (const item of activeEtcTickets) {
      if (item.etcInfo.isOverdue) overdue++;
      else if (item.etcInfo.isToday) today++;
      else if (item.etcInfo.isTomorrow) tomorrow++;
    }

    return {
      total: activeEtcTickets.length,
      overdue,
      today,
      tomorrow
    };
  }, [activeEtcTickets]);

  // Apply search query and active tab filter
  const displayedTickets = useMemo(() => {
    let list = activeEtcTickets;

    // Filter by urgency tab
    if (activeFilter === 'overdue') {
      list = list.filter(item => item.etcInfo.isOverdue);
    } else if (activeFilter === 'today') {
      list = list.filter(item => item.etcInfo.isToday);
    } else if (activeFilter === 'tomorrow') {
      list = list.filter(item => item.etcInfo.isTomorrow);
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(item => {
        const idMatch = String(item.id || item.requestId || '').toLowerCase().includes(q);
        const titleMatch = (item.title || item.subject || '').toLowerCase().includes(q);
        const studentMatch = (item.student || item.studentName || '').toLowerCase().includes(q);
        const studentIdMatch = String(item.studentId || '').toLowerCase().includes(q);
        const staffMatch = (item.assignedTo || '').toLowerCase().includes(q);
        return idMatch || titleMatch || studentMatch || studentIdMatch || staffMatch;
      });
    }

    return list;
  }, [activeEtcTickets, activeFilter, searchQuery]);

  // Group requests in strict top-to-bottom priority order:
  // 1. Overdue
  // 2. Due Today
  // 3. Due Tomorrow
  const groupedSections = useMemo(() => {
    const allGroups = groupRequestsByUrgency(displayedTickets);

    if (activeFilter === 'all') {
      return allGroups.filter(g => g.items.length > 0 && g.key !== 'upcoming');
    }

    return allGroups.filter(g => g.key === activeFilter && g.key !== 'upcoming');
  }, [displayedTickets, activeFilter]);

  if (!isOpen) return null;

  const handleProcessTicket = (ticket) => {
    handleDismiss();
    if (onViewRequest) {
      onViewRequest(ticket);
    }
  };

  const handleViewAllQueue = () => {
    handleDismiss();
    if (onGoToQueue) {
      onGoToQueue();
    }
  };

  return (
    <div className="nearing-modal-overlay" onClick={handleDismiss} role="presentation">
      <div 
        className="nearing-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="nearing-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="nearing-modal-header">
          <div className="nearing-header-title-wrap">
            <div className={`nearing-header-icon ${summaryCounts.overdue > 0 ? 'alert-critical' : 'alert-warning'}`}>
              {summaryCounts.overdue > 0 ? <FaExclamationTriangle /> : <FaClock />}
            </div>
            <div>
              <h2 id="nearing-modal-title" className="nearing-modal-title">
                Requests Nearing Estimated Completion
              </h2>
              <p className="nearing-modal-subtitle">
                Summary of active requests requiring prompt processing for <strong>{department || 'Office'}</strong>
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="nearing-modal-close" 
            onClick={handleDismiss} 
            aria-label="Close summary modal"
          >
            <FaTimes />
          </button>
        </div>

        {/* Summary Counter Badges in Top-to-Bottom Order */}
        <div className="nearing-summary-cards">
          <button
            type="button"
            className={`nearing-summary-card card-all ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <span className="summary-card-label">Total</span>
            <span className="summary-card-count">{summaryCounts.total}</span>
          </button>

          <button
            type="button"
            className={`nearing-summary-card card-overdue ${activeFilter === 'overdue' ? 'active' : ''} ${summaryCounts.overdue > 0 ? 'has-items' : ''}`}
            onClick={() => setActiveFilter('overdue')}
          >
            <span className="summary-card-label">Overdue</span>
            <span className="summary-card-count">{summaryCounts.overdue}</span>
          </button>

          <button
            type="button"
            className={`nearing-summary-card card-today ${activeFilter === 'today' ? 'active' : ''} ${summaryCounts.today > 0 ? 'has-items' : ''}`}
            onClick={() => setActiveFilter('today')}
          >
            <span className="summary-card-label">Due Today</span>
            <span className="summary-card-count">{summaryCounts.today}</span>
          </button>

          <button
            type="button"
            className={`nearing-summary-card card-tomorrow ${activeFilter === 'tomorrow' ? 'active' : ''} ${summaryCounts.tomorrow > 0 ? 'has-items' : ''}`}
            onClick={() => setActiveFilter('tomorrow')}
          >
            <span className="summary-card-label">Due Tomorrow</span>
            <span className="summary-card-count">{summaryCounts.tomorrow}</span>
          </button>
        </div>

        {/* Search Control */}
        <div className="nearing-controls-row">
          <div className="nearing-search-wrap">
            <FaSearch className="nearing-search-icon" />
            <input
              type="text"
              className="nearing-search-input"
              placeholder="Search by student, request ID, subject, or staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="nearing-search-clear" 
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <FaTimes />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Grouped Sections in Top-to-Bottom Order */}
        <div className="nearing-modal-body">
          {groupedSections.length === 0 ? (
            <div className="nearing-empty-state">
              <div className="nearing-empty-icon">
                <FaCheckCircle />
              </div>
              <h3 className="nearing-empty-title">
                {activeEtcTickets.length === 0 
                  ? "All caught up! No requests nearing completion." 
                  : "No requests match your filter."}
              </h3>
              <p className="nearing-empty-subtitle">
                {activeEtcTickets.length === 0
                  ? `There are currently no active requests with nearing estimated completion dates in the ${department} office.`
                  : "Try resetting your search query or selecting another tab above."}
              </p>
              {searchQuery && (
                <button 
                  type="button" 
                  className="nearing-btn-reset" 
                  onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                >
                  Reset Search
                </button>
              )}
            </div>
          ) : (
            <div className="nearing-groups-container">
              {groupedSections.map((group) => (
                <div key={group.key} className={`nearing-group-card group-${group.key}`}>
                  <div className="nearing-group-header">
                    <div className="group-header-left">
                      <span className={`group-header-icon icon-${group.key}`}>
                        {group.key === 'overdue' && <FaExclamationTriangle />}
                        {group.key === 'today' && <FaHourglassHalf />}
                        {group.key === 'tomorrow' && <FaClock />}
                        {group.key === 'upcoming' && <FaCalendarAlt />}
                      </span>
                      <div className="group-header-text">
                        <div className="group-title-row">
                          <h3 className="group-title">{group.title}</h3>
                          <span className={`group-count-badge badge-${group.key}`}>
                            {group.items.length} {group.items.length === 1 ? 'Request' : 'Requests'}
                          </span>
                        </div>
                        <span className="group-subtitle">{group.subtitle}</span>
                      </div>
                    </div>
                  </div>

                  <div className="nearing-table-container">
                    <table className="nearing-table">
                      <thead>
                        <tr>
                          <th>REQUEST INFO</th>
                          <th>STUDENT</th>
                          <th>ASSIGNED STAFF</th>
                          <th>STATUS</th>
                          <th>ESTIMATED COMPLETION</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((ticket) => {
                          const { etcInfo } = ticket;
                          return (
                            <tr 
                              key={ticket.firestoreId || ticket.id} 
                              className={`nearing-row ${etcInfo.isOverdue ? 'row-overdue' : etcInfo.isToday ? 'row-today' : ''}`}
                            >
                              {/* Request Info */}
                              <td>
                                <div className="nearing-ticket-info">
                                  <span className="nearing-ticket-title" title={ticket.title || ticket.subject}>
                                    {ticket.title || ticket.subject}
                                  </span>
                                  <span className="nearing-ticket-id">#{ticket.id || ticket.requestId}</span>
                                </div>
                              </td>

                              {/* Student */}
                              <td>
                                <div className="nearing-student-info">
                                  <span className="nearing-student-name">
                                    {ticket.student || ticket.studentName || 'Student'}
                                  </span>
                                  <span className="nearing-student-id">
                                    {ticket.isGuest ? (
                                      <span className="nearing-guest-badge">Guest</span>
                                    ) : ticket.studentId ? (
                                      `ID: ${ticket.studentId}`
                                    ) : (
                                      'ID: N/A'
                                    )}
                                  </span>
                                </div>
                              </td>

                              {/* Assigned Staff */}
                              <td>
                                {ticket.assignedTo ? (
                                  <div className="nearing-assigned-pill">
                                    <FaUserCircle className="staff-icon" />
                                    <span>{ticket.assignedTo}</span>
                                  </div>
                                ) : (
                                  <span className="nearing-unassigned-pill">Unassigned</span>
                                )}
                              </td>

                              {/* Status */}
                              <td>
                                <span className={`nearing-status-badge status-${(ticket.status || 'in-process').toLowerCase().replace(/\s+/g, '-')}`}>
                                  <span className="status-dot" aria-hidden="true" />
                                  {ticket.status === 'In Process' ? 'In Progress' : ticket.status || 'In Progress'}
                                </span>
                              </td>

                              {/* Estimated Completion & Countdown */}
                              <td>
                                <div className="nearing-etc-cell">
                                  <div className="nearing-etc-date">
                                    <FaCalendarAlt className="calendar-icon" />
                                    <span>{etcInfo.formattedDate}</span>
                                  </div>
                                  <span className={`nearing-urgency-badge urgency-${etcInfo.urgencyStatus}`}>
                                    {etcInfo.isOverdue && <FaExclamationTriangle className="urgency-icon" />}
                                    {etcInfo.isToday && <FaHourglassHalf className="urgency-icon" />}
                                    {etcInfo.isTomorrow && <FaClock className="urgency-icon" />}
                                    {etcInfo.urgencyLabel}
                                  </span>
                                </div>
                              </td>

                              {/* Action */}
                              <td>
                                <button
                                  type="button"
                                  className="nearing-action-btn"
                                  onClick={() => handleProcessTicket(ticket)}
                                  title="Open ticket to process or update"
                                >
                                  <span>Process</span>
                                  <FaArrowRight className="action-arrow" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="nearing-modal-footer">
          <label className="nearing-session-checkbox-label">
            <input
              type="checkbox"
              className="nearing-session-checkbox"
              checked={dontShowAgainSession}
              onChange={(e) => setDontShowAgainSession(e.target.checked)}
            />
            <span>Don't show pop-up automatically for the rest of this session</span>
          </label>

          <div className="nearing-footer-actions">
            {onGoToQueue && (
              <button 
                type="button" 
                className="nearing-footer-btn secondary"
                onClick={handleViewAllQueue}
              >
                Go to Requests Table
              </button>
            )}
            <button 
              type="button" 
              className="nearing-footer-btn primary"
              onClick={handleDismiss}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NearingCompletionModal;
