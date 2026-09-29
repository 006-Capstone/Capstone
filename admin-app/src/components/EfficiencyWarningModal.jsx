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
 * PerformanceStandingModal (formerly EfficiencyWarningModal)
 * Directly connected to the Superadmin Performance & Behavioral Monitor.
 * Alerts staff when 4-week clearance/efficiency falls below 60% or when
 * progressive warning reviews (NTE, verbal reprimand, etc.) are triggered.
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
  
  // Connect to the institutional 4-tier warning evaluation
  const isNTEWarning = score < 50 || overdueCount >= 2;
  const standingTitle = isNTEWarning 
    ? '1st Warning: Notice to Explain (NTE) Advisory' 
    : 'Monthly Standing: Under Formal Review';

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
              <FaShieldAlt />
            </div>
            <div className="eff-header-text">
              <span className="eff-superadmin-tag">
                <FaShieldAlt className="tag-icon" /> Superadmin Performance & Behavioral Monitor
              </span>
              <h2 id="eff-modal-title" className="eff-modal-title">
                Staff Performance & Standing Advisory
              </h2>
              <p className="eff-modal-subtitle">
                Monthly Observation Notice: Clearance rate dropped to <strong>{score}%</strong> (Institutional Standard: &gt;60%)
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="eff-close-btn" 
            onClick={handleDismiss}
            aria-label="Close advisory"
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
              <span className="eff-score-sublabel">Clearance Score</span>
            </div>

            <div className="eff-score-meta">
              <div className="eff-tier-status-pill">
                <span className="tier-status-dot" />
                <span>{standingTitle}</span>
              </div>
              <p className="eff-threshold-warning-text">
                Academia De San Jose operational guidelines require maintaining a monthly clearance score above <strong>60%</strong>. Rolling 4-week ticket trajectories and backlog accumulations are monitored by the Superadmin Command Center.
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
                    <span className="threshold-tooltip">60% Benchmark</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Institutional 4-Tier Warning Progression Pipeline */}
          <div className="eff-tier-pipeline-box">
            <div className="eff-pipeline-header">
              <span className="eff-pipeline-title">Institutional Warning Framework</span>
              <span className="eff-pipeline-badge">Progressive Accountability</span>
            </div>
            <div className="eff-pipeline-steps">
              <div className={`eff-pipeline-step ${isNTEWarning ? 'active' : ''}`}>
                <span className="step-num">1st Warning</span>
                <span className="step-label">Notice to Explain (NTE)</span>
              </div>
              <div className="eff-pipeline-arrow">➔</div>
              <div className="eff-pipeline-step">
                <span className="step-num">2nd Warning</span>
                <span className="step-label">Verbal Reprimand</span>
              </div>
              <div className="eff-pipeline-arrow">➔</div>
              <div className="eff-pipeline-step">
                <span className="step-num">3rd Warning</span>
                <span className="step-label">Notice of Suspension</span>
              </div>
              <div className="eff-pipeline-arrow">➔</div>
              <div className="eff-pipeline-step">
                <span className="step-num">4th Warning</span>
                <span className="step-label">Notice for Termination</span>
              </div>
            </div>
          </div>

          {/* Breakdown Factor Cards */}
          <div className="eff-factors-grid">
            <div className={`eff-factor-card ${overdueCount > 0 ? 'critical' : ''}`}>
              <div className="factor-val">{overdueCount}</div>
              <div className="factor-lbl">Overdue Requests</div>
              <span className="factor-note">
                {overdueCount > 0 ? 'Direct breach impacting standing' : 'Zero overdue requests'}
              </span>
            </div>

            <div className={`eff-factor-card ${onTimeRate < 80 ? 'warning' : ''}`}>
              <div className="factor-val">{onTimeRate}%</div>
              <div className="factor-lbl">On-Time SLA Rate</div>
              <span className="factor-note">Target: ≥90% compliance</span>
            </div>

            <div className="eff-factor-card">
              <div className="factor-val">{activeCount}</div>
              <div className="factor-lbl">Active Assigned</div>
              <span className="factor-note">Open in your queue</span>
            </div>
          </div>

          {/* Action Required Recommendations */}
          <div className="eff-actions-box">
            <h4 className="eff-actions-title">
              <FaClock className="actions-icon" /> Required Action to Maintain Good Standing:
            </h4>
            <ul className="eff-actions-list">
              <li>
                <strong>Clear Overdue Queue:</strong> Process and resolve pending requests that have passed their target dates to restore clearance rate.
              </li>
              <li>
                <strong>Prevent Monthly Rollover:</strong> Ensure assigned requests are addressed within the current 4-week evaluation cycle.
              </li>
              <li>
                <strong>Review AI Diagnostic:</strong> Check your behavioral pacing, SLA trends, and next-month bottleneck forecast in <em>My Performance</em>.
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
              <span>Don't show this popup again for today's session (dashboard standing alert pill will remain active)</span>
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
