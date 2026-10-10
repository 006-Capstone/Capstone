import React, { useEffect, useState } from 'react';
import { 
  FaTimes, 
  FaExclamationTriangle, 
  FaChartLine, 
  FaArrowRight, 
  FaCheckCircle,
  FaShieldAlt,
  FaAward,
  FaCheck,
  FaFileAlt
} from 'react-icons/fa';
import '../styles/EfficiencyWarningModal.css';

/**
 * PerformanceStandingModal (EfficiencyWarningModal)
 * Directly connected to the Superadmin Performance & Behavioral Monitor.
 * 
 * Supports two institutional observation modes:
 * 1. Warning Mode: Official Notice to Explain (NTE) advisory when 4-week clearance falls <= 60%.
 * 2. Motivate Mode: Formal institutional commendation ("Keep up the good work!") when staff
 *    maintains a verified 4-week consistent streak of good performance.
 */
const EfficiencyWarningModal = ({ 
  isOpen, 
  onClose, 
  metrics = {}, 
  department = '', 
  onNavigate,
  mode = null, // 'warning' | 'motivate' | null (auto-detect)
  streakData = null,
  monthlyBehavior = null
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

  // Determine mode: motivate if explicitly set or if streakData indicates a good streak
  const isMotivate = mode === 'motivate' || 
    (mode !== 'warning' && !metrics.isWarning && Boolean(metrics.hasGoodStreak || streakData?.hasGoodStreak));

  const score = isMotivate 
    ? (streakData?.score ?? metrics.score ?? 100)
    : (metrics.score ?? 50);

  const overdueCount = metrics.overdueCount ?? streakData?.overdueCount ?? 0;
  const activeCount = metrics.activeCount ?? 0;
  const onTimeRate = metrics.onTimeRate ?? 95;
  const resolvedCount = metrics.resolvedCount ?? streakData?.totalResolved ?? 0;

  // Warning classification
  const isNTEWarning = score < 50 || overdueCount >= 2;
  const warningStageTag = isNTEWarning 
    ? '1st Warning: Notice to Explain (NTE)' 
    : 'Monthly Standing: Under Formal Review';

  // Motivate classification
  const streakWeeks = streakData?.streakWeeks ?? 4;
  const motivateStageTag = `${streakWeeks}-Week Milestone: Exemplary Standing`;

  // 4-Week progression breakdown from Superadmin Monitor
  const weeklyBreakdown = streakData?.weeklyBreakdown || monthlyBehavior?.weeklyBreakdown || [
    { weekNum: 1, label: 'Week 1 (Days 1–7)', clearanceRate: 100, isGoodWeek: true, resolved: 0, assigned: 0 },
    { weekNum: 2, label: 'Week 2 (Days 8–14)', clearanceRate: 100, isGoodWeek: true, resolved: 0, assigned: 0 },
    { weekNum: 3, label: 'Week 3 (Days 15–21)', clearanceRate: Math.max(80, score), isGoodWeek: true, resolved: 0, assigned: 0 },
    { weekNum: 4, label: 'Week 4 (Days 22–End)', clearanceRate: score, isGoodWeek: true, resolved: 0, assigned: 0 }
  ];

  const handleDismiss = () => {
    if (dontShowAgainSession) {
      try {
        const storageKey = isMotivate 
          ? 'dismissed_efficiency_motivate_popup' 
          : 'dismissed_efficiency_warning_popup';
        sessionStorage.setItem(storageKey, 'true');
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
        className={`eff-modal-card ${isMotivate ? 'eff-modal--motivate' : 'eff-modal--warning'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eff-modal-title"
      >
        {/* Institutional Document Header */}
        <div className="eff-modal-header">
          <div className="eff-header-left">
            <div className="eff-icon-badge">
              {isMotivate ? <FaAward /> : <FaShieldAlt />}
            </div>
            <div className="eff-header-text">
              <div className="eff-superadmin-tag">
                <span>Academia De San Jose</span>
                <span className="eff-tag-divider">·</span>
                <span>Performance & Quality Assurance</span>
                <span className="eff-tag-divider">·</span>
                <span className="eff-status-chip">
                  {isMotivate ? motivateStageTag : warningStageTag}
                </span>
              </div>
              <h2 id="eff-modal-title" className="eff-modal-title">
                {isMotivate 
                  ? 'Institutional Performance Commendation' 
                  : 'Notice of Performance Standing Review'}
              </h2>
              <p className="eff-modal-subtitle">
                {isMotivate ? (
                  <>
                    Audit Cycle Report: Consistent compliance verified across 4 consecutive weeks. Clearance score maintained at <strong>{score}%</strong> (Institutional Standard: &ge;80%).
                  </>
                ) : (
                  <>
                    Audit Cycle Notice: Clearance rate dropped to <strong>{score}%</strong>, failing the mandatory institutional standard (&gt;60%). Administrative rectification required.
                  </>
                )}
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
          {/* 4-Tile High-Precision Metrics Grid */}
          <div className="eff-metrics-grid">
            <div className="eff-metric-tile">
              <span className="metric-tile-label">Clearance Score</span>
              <div className="metric-tile-value">{score}%</div>
              <span className="metric-tile-footnote">
                {isMotivate ? 'Target: ≥80% maintained' : 'Minimum: >60% required'}
              </span>
            </div>

            <div className="eff-metric-tile">
              <span className="metric-tile-label">SLA Compliance</span>
              <div className="metric-tile-value">{onTimeRate}%</div>
              <span className="metric-tile-footnote">
                Institutional SLA: &ge;90%
              </span>
            </div>

            <div className={`eff-metric-tile ${overdueCount > 0 ? 'tile-breach' : ''}`}>
              <span className="metric-tile-label">Overdue Backlog</span>
              <div className="metric-tile-value">{overdueCount}</div>
              <span className="metric-tile-footnote">
                {overdueCount > 0 ? 'Active SLA breaches' : 'Zero overdue requests'}
              </span>
            </div>

            <div className="eff-metric-tile">
              <span className="metric-tile-label">
                {isMotivate ? 'Resolved Volume' : 'Active In-Queue'}
              </span>
              <div className="metric-tile-value">
                {isMotivate ? resolvedCount : activeCount}
              </div>
              <span className="metric-tile-footnote">
                {isMotivate ? 'Requests cleared' : 'Currently in process'}
              </span>
            </div>
          </div>

          {/* 4-Week Progression Timeline / Warning Stage Framework */}
          {isMotivate ? (
            /* 4-Week Consistency Audit Record */
            <div className="eff-section-box">
              <div className="eff-section-box-header">
                <span className="eff-section-box-title">4-Week Operational Continuity Audit</span>
                <span className="eff-section-box-pill pill-success">
                  <FaCheck /> 4 of 4 Weeks Verified
                </span>
              </div>
              <div className="eff-timeline-row">
                {weeklyBreakdown.slice(0, 4).map((w, idx) => {
                  const rate = w.clearanceRate ?? 100;
                  return (
                    <div className="eff-timeline-step" key={w.weekNum || idx}>
                      <div className="timeline-step-badge">
                        <span className="timeline-step-num">W{idx + 1}</span>
                        <FaCheck className="timeline-check-icon" />
                      </div>
                      <div className="timeline-step-content">
                        <span className="timeline-step-label">Week {idx + 1}</span>
                        <span className="timeline-step-rate">{rate}% Cleared</span>
                        <span className="timeline-step-status">Standard Met</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Warning Framework Stages */
            <div className="eff-section-box">
              <div className="eff-section-box-header">
                <span className="eff-section-box-title">Institutional Progressive Warning Framework</span>
                <span className="eff-section-box-pill pill-warning">
                  Stage 1 Active Review
                </span>
              </div>
              <div className="eff-stages-row">
                <div className={`eff-stage-cell ${isNTEWarning ? 'cell-active' : ''}`}>
                  <span className="stage-index">Stage 1</span>
                  <span className="stage-name">Notice to Explain (NTE)</span>
                  <span className="stage-status-tag">Active Review</span>
                </div>
                <div className="eff-stage-cell">
                  <span className="stage-index">Stage 2</span>
                  <span className="stage-name">Written Reprimand</span>
                  <span className="stage-status-tag">Pending Escalation</span>
                </div>
                <div className="eff-stage-cell">
                  <span className="stage-index">Stage 3</span>
                  <span className="stage-name">Notice of Suspension</span>
                  <span className="stage-status-tag">Formal Proceeding</span>
                </div>
                <div className="eff-stage-cell">
                  <span className="stage-index">Stage 4</span>
                  <span className="stage-name">Separation Review</span>
                  <span className="stage-status-tag">Administrative Action</span>
                </div>
              </div>
            </div>
          )}

          {/* Institutional Statement & Action Directive */}
          <div className={`eff-statement-card ${isMotivate ? 'card-motivate' : 'card-warning'}`}>
            <div className="eff-statement-header">
              <span className="eff-statement-badge">
                <FaFileAlt /> {isMotivate ? 'Administrative Commendation Notice' : 'Formal Administrative Directive'}
              </span>
              <span className="eff-statement-dept">Office: {department || 'Administrative Staff'}</span>
            </div>

            <h3 className="eff-statement-headline">
              {isMotivate ? 'Keep up the good work!' : 'Mandatory Queue Rectification & Explanation Notice'}
            </h3>

            <p className="eff-statement-body">
              {isMotivate ? (
                <>
                  Official audit records from the Performance Monitoring System confirm consistent operational compliance across the past four consecutive weeks. Your disciplined queue resolution, prompt request turnaround, and zero backlog carryover directly contribute to high student service standards.
                </>
              ) : (
                <>
                  Your 4-week ticket clearance rate of <strong>{score}%</strong> does not meet the institutional minimum threshold of <strong>60%</strong>. Accumulated request delays and backlog roll-overs impair departmental operational health and require prompt administrative rectification.
                </>
              )}
            </p>

            <div className="eff-statement-checklist">
              <h4 className="checklist-heading">
                {isMotivate ? 'Audit Highlights & Performance Records:' : 'Required Corrective Protocol:'}
              </h4>
              <ul className="checklist-items">
                {isMotivate ? (
                  <>
                    <li>
                      <strong>Resolution Consistency:</strong> Daily and weekly ticket intakes processed steadily without end-of-month volume spikes or backlog accumulation.
                    </li>
                    <li>
                      <strong>Turnaround Adherence:</strong> Requests initiated and transitioned to resolution in accordance with designated office timeframes.
                    </li>
                    <li>
                      <strong>Queue Discipline:</strong> Zero unaddressed or overdue requests carried over into subsequent evaluation windows.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>Immediate Overdue Clearance:</strong> Process and resolve pending requests that have exceeded their estimated completion dates (ETC).
                    </li>
                    <li>
                      <strong>Prevent Backlog Rollover:</strong> Ensure assigned requests are addressed within the active evaluation cycle.
                    </li>
                    <li>
                      <strong>Review Performance Ledger:</strong> Inspect detailed resolution records in My Performance to reconcile workflow bottlenecks.
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Checkbox: Do not show again for current session */}
          <div className="eff-session-checkbox">
            <label>
              <input 
                type="checkbox" 
                checked={dontShowAgainSession} 
                onChange={(e) => setDontShowAgainSession(e.target.checked)} 
              />
              <span>Do not show this advisory again during the current session</span>
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
            Close Notice
          </button>
          <button 
            type="button" 
            className="eff-btn-ledger" 
            onClick={handleGoToPerformance}
          >
            <FaChartLine />
            <span>Open Performance Ledger</span>
          </button>
          <button 
            type="button" 
            className={isMotivate ? 'eff-btn-action action-motivate' : 'eff-btn-action action-warning'} 
            onClick={isMotivate ? handleDismiss : handleGoToTickets}
          >
            {isMotivate ? (
              <>
                <FaCheckCircle />
                <span>Acknowledge Commendation</span>
              </>
            ) : (
              <>
                <span>Review Active Queue</span>
                <FaArrowRight />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EfficiencyWarningModal;
