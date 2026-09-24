import React, { useEffect, useState } from 'react';
import { 
  FaTimes, 
  FaExclamationTriangle, 
  FaChartLine, 
  FaClock, 
  FaArrowRight, 
  FaCheckCircle,
  FaShieldAlt
} from 'react-icons/fa';
import '../styles/EfficiencyWarningModal.css';

/**
 * EfficiencyWarningModal
 * High-visibility warning modal triggered whenever a staff member's
 * Performance Efficiency Score drops to 60% or lower.
 * Directly connected to the Superadmin Department Health Monitor.
 */
const EfficiencyWarningModal = ({ 
  isOpen, 
  onClose, 
  metrics = {}, 
  department = '', 
  onNavigate 
}) => {
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

  if (!isOpen) return null;

  const score = metrics.score ?? 50;
  const overdueCount = metrics.overdueCount ?? 0;
  const activeCount = metrics.activeCount ?? 0;
  const onTimeRate = metrics.onTimeRate ?? 70;
  const tierLabel = metrics.tierLabel || (score < 60 ? 'Critical Attention' : 'Needs Focus');

  const handleDismiss = () => {
    if (dontShowAgainSession) {
      try {
        sessionStorage.setItem('dismissed_efficiency_warning_popup', 'true');
      } catch (e) {
        // Safe fallback
      }
    }
    onClose();
  };

  const handleGoToTickets = () => {
    handleDismiss();
    if (onNavigate) {
      onNavigate('my-tickets');
    }
  };

  const handleGoToPerformance = () => {
    handleDismiss();
    if (onNavigate) {
      onNavigate('my-performance');
    }
  };

  return (
    <div className="eff-modal-overlay" onClick={handleDismiss}>
      <div 
        className="eff-modal-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eff-modal-title"
      >
        {/* Modal Header */}
        <div className="eff-modal-header">
          <div className="eff-header-left">
            <div className="eff-icon-badge">
              <FaExclamationTriangle />
            </div>
            <div className="eff-header-text">
              <span className="eff-superadmin-tag">
                <FaShieldAlt className="tag-icon" /> Superadmin Department Health Monitor
              </span>
              <h2 id="eff-modal-title" className="eff-modal-title">
                Performance Efficiency Alert
              </h2>
              <p className="eff-modal-subtitle">
                Your department efficiency score has dropped to <strong>{score}%</strong> (Threshold: &gt;60%)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="eff-close-btn" 
            onClick={handleDismiss}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>

        {/* Modal Body */}
        <div className="eff-modal-body">
          {/* Main Score Callout Box */}
          <div className="eff-score-callout">
            <div className="eff-score-circle-group">
              <div className="eff-score-number">{score}%</div>
              <span className="eff-score-sublabel">Efficiency Score</span>
            </div>

            <div className="eff-score-meta">
              <div className="eff-tier-status-pill">
                <span className="tier-status-dot" />
                <span>{tierLabel}</span>
              </div>
              <p className="eff-threshold-warning-text">
                Department operational standards require an Efficiency Score above <strong>60%</strong>. Your current rating indicates service bottleneck risk that is visible to Superadmin oversight.
              </p>
              
              {/* Progress bar with 60% threshold marker */}
              <div className="eff-progress-wrapper">
                <div className="eff-progress-track">
                  <div 
                    className="eff-progress-fill" 
                    style={{ width: `${Math.max(5, Math.min(100, score))}%` }} 
                  />
                  <div className="eff-threshold-marker" style={{ left: '60%' }}>
                    <span className="threshold-line" />
                    <span className="threshold-tooltip">60% Standard</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Factor Cards */}
          <div className="eff-factors-grid">
            <div className={`eff-factor-card ${overdueCount > 0 ? 'critical' : ''}`}>
              <div className="factor-val">{overdueCount}</div>
              <div className="factor-lbl">Overdue Requests</div>
              <span className="factor-note">
                {overdueCount > 0 ? 'Major factor reducing score' : 'Zero overdue requests'}
              </span>
            </div>

            <div className={`eff-factor-card ${onTimeRate < 80 ? 'warning' : ''}`}>
              <div className="factor-val">{onTimeRate}%</div>
              <div className="factor-lbl">On-Time SLA Rate</div>
              <span className="factor-note">Target: ≥90% compliance</span>
            </div>

            <div className="eff-factor-card">
              <div className="factor-val">{activeCount}</div>
              <div className="factor-lbl">Active In-Progress</div>
              <span className="factor-note">Currently assigned to you</span>
            </div>
          </div>

          {/* Action Required Recommendations */}
          <div className="eff-actions-box">
            <h4 className="eff-actions-title">
              <FaClock className="actions-icon" /> Immediate Action Required:
            </h4>
            <ul className="eff-actions-list">
              <li>
                <strong>Prioritize Overdue Requests:</strong> Process and resolve pending requests that have passed their Estimated Completion Date.
              </li>
              <li>
                <strong>Update Estimated Completion (ETC):</strong> If legitimate delays occur, coordinate and update dates promptly.
              </li>
              <li>
                <strong>Workload Rebalancing:</strong> If current ticket volume exceeds manageable capacity, request ticket reassignment from your supervisor or Superadmin.
              </li>
            </ul>
          </div>

          {/* Don't show again checkbox for current session */}
          <div className="eff-session-checkbox">
            <label>
              <input 
                type="checkbox" 
                checked={dontShowAgainSession} 
                onChange={(e) => setDontShowAgainSession(e.target.checked)} 
              />
              <span>Don't show this popup again for the rest of today's session (dashboard warning banner will remain active)</span>
            </label>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="eff-modal-footer">
          <button 
            type="button" 
            className="eff-btn-dismiss" 
            onClick={handleDismiss}
          >
            Acknowledge & Close
          </button>
          <button 
            type="button" 
            className="eff-btn-performance" 
            onClick={handleGoToPerformance}
          >
            <FaChartLine className="btn-icon" />
            <span>View My Performance</span>
          </button>
          <button 
            type="button" 
            className="eff-btn-primary" 
            onClick={handleGoToTickets}
          >
            <span>Review Overdue Requests</span>
            <FaArrowRight className="btn-icon" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EfficiencyWarningModal;
