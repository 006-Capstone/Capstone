import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  FaCalendarAlt,
  FaBuilding,
  FaUserTie,
  FaSearch,
  FaBrain,
  FaChartLine,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaTimes,
  FaPrint,
  FaShieldAlt,
  FaHistory,
  FaRedo,
  FaArrowRight,
  FaClock,
  FaCheckDouble
} from 'react-icons/fa';
import { calculateStaffMonthlyBehavior } from '../utils/performanceAnalytics';
import { analyzeMonthlyStaffBehaviorWithAI } from '../utils/groqService';
import { OverviewCardsSkeleton, DataTableSkeleton } from './common/Skeleton';
import '../styles/PerformanceMonitor.css';

const MONTH_OPTIONS_COUNT = 6;

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < MONTH_OPTIONS_COUNT; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      date: d,
      key: `${d.getFullYear()}-${d.getMonth()}`
    });
  }
  return options;
};

const PerformanceMonitor = () => {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(monthOptions[0]?.key || '');
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [allRequests, setAllRequests] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [allFeedbacks, setAllFeedbacks] = useState([]);
  
  // Selected staff diagnostic modal state
  const [activeStaffDiagnostic, setActiveStaffDiagnostic] = useState(null);
  const [analyzingStaffId, setAnalyzingStaffId] = useState(null);
  const [aiCache, setAiCache] = useState({});

  // Get active selected Date object
  const currentMonthDate = useMemo(() => {
    const matched = monthOptions.find(o => o.key === selectedMonthKey);
    return matched ? matched.date : new Date();
  }, [selectedMonthKey, monthOptions]);

  // Initial Fetch of raw collections
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [requestsSnap, staffSnap, feedbackSnap] = await Promise.all([
        getDocs(collection(db, 'requests')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'staff'))),
        getDocs(collection(db, 'feedback'))
      ]);

      const requests = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const feedbacks = feedbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setAllRequests(requests);
      setAllStaff(staffList);
      setAllFeedbacks(feedbacks);
    } catch (err) {
      console.error('[PerformanceMonitor] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute 4-week monthly metrics for all staff
  const staffMonthlyProfiles = useMemo(() => {
    if (!allStaff.length) return [];

    return allStaff.map(staff => {
      const baseMetrics = calculateStaffMonthlyBehavior(staff, allRequests, currentMonthDate, allFeedbacks);
      const cachedAi = aiCache[staff.id];
      if (cachedAi) {
        return {
          ...baseMetrics,
          ...cachedAi
        };
      }
      return baseMetrics;
    }).filter(Boolean);
  }, [allStaff, allRequests, currentMonthDate, allFeedbacks, aiCache]);

  // Filtered by department and search
  const filteredProfiles = useMemo(() => {
    return staffMonthlyProfiles.filter(profile => {
      const dept = (profile.staff.department || '').toLowerCase();
      if (selectedDept !== 'all' && dept !== selectedDept.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatches = profile.staff.name.toLowerCase().includes(query);
        const deptMatches = dept.includes(query);
        if (!nameMatches && !deptMatches) return false;
      }
      return true;
    });
  }, [staffMonthlyProfiles, selectedDept, searchQuery]);

  // Aggregate monthly overview numbers
  const summaryStats = useMemo(() => {
    const totalStaffCount = staffMonthlyProfiles.length;
    let goodCount = 0;
    let warning1Count = 0; // 1st Warning: NTE
    let warning2Count = 0; // 2nd Warning: Verbal Reprimand
    let warning3Count = 0; // 3rd Warning: Notice of Suspension
    let warning4Count = 0; // 4th Warning: Notice for Termination
    let totalAssignedMonth = 0;
    let totalResolvedMonth = 0;

    staffMonthlyProfiles.forEach(p => {
      const status = p.warningEvaluation.status;
      if (status === 'good') goodCount++;
      else if (status === 'warning_1_nte' || status === 'advisory') warning1Count++;
      else if (status === 'warning_2_verbal' || status === 'formal_review') warning2Count++;
      else if (status === 'warning_3_suspension' || status === 'nte_justified') warning3Count++;
      else if (status === 'warning_4_termination') warning4Count++;

      totalAssignedMonth += p.totals.totalAssigned;
      totalResolvedMonth += p.totals.totalResolved;
    });

    const monthClearanceRate = totalAssignedMonth > 0
      ? Math.round((totalResolvedMonth / totalAssignedMonth) * 100)
      : 100;

    return {
      totalStaffCount,
      goodCount,
      warning1Count,
      warning2Count,
      warning3Count,
      warning4Count,
      totalAssignedMonth,
      totalResolvedMonth,
      monthClearanceRate
    };
  }, [staffMonthlyProfiles]);

  // Open staff diagnostic and trigger deep AI analysis if not already cached
  const handleInspectStaff = async (profile) => {
    setActiveStaffDiagnostic(profile);
    const staffId = profile.staff.id;

    if (!profile.isAIEnhanced && !aiCache[staffId]) {
      try {
        setAnalyzingStaffId(staffId);
        const enhanced = await analyzeMonthlyStaffBehaviorWithAI(profile);
        if (enhanced) {
          setAiCache(prev => ({
            ...prev,
            [staffId]: enhanced
          }));
          setActiveStaffDiagnostic(enhanced);
        }
      } catch (err) {
        console.warn('AI analysis failed:', err);
      } finally {
        setAnalyzingStaffId(null);
      }
    }
  };

  const handlePrintDiagnostic = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="performance-monitor-container">
        <OverviewCardsSkeleton />
        <div style={{ marginTop: '24px' }}>
          <DataTableSkeleton rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="performance-monitor-container">
      {/* Top Header & Period Control */}
      <div className="pm-header-bar">
        <div>
          <h2 className="pm-title">Monthly Staff Performance & Behavioral Monitor</h2>
          <p className="pm-subtitle">
            Observes 4-week performance trajectories to identify behavioral rhythms, volume shocks vs. chronic backlogs, and predict next-month capacity.
          </p>
        </div>

        <div className="pm-controls-cluster">
          <div className="pm-control-item">
            <FaCalendarAlt className="pm-control-icon" />
            <select
              className="pm-select"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              aria-label="Select Observation Month"
            >
              {monthOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="pm-control-item">
            <FaBuilding className="pm-control-icon" />
            <select
              className="pm-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              aria-label="Filter Department"
            >
              <option value="all">All Departments</option>
              <option value="Finance">Finance</option>
              <option value="Registrar">Registrar</option>
              <option value="Library">Library</option>
              <option value="Guidance">Guidance</option>
            </select>
          </div>

          <button
            type="button"
            className="pm-refresh-btn"
            onClick={loadData}
            title="Refresh latest ticket data"
          >
            <FaRedo />
          </button>
        </div>
      </div>

      {/* Monthly Summary Statistics Banner */}
      <div className="pm-stats-grid six-cols">
        <div className="pm-stat-card primary">
          <div className="pm-stat-label">Active Staff</div>
          <div className="pm-stat-value">{summaryStats.totalStaffCount}</div>
          <div className="pm-stat-desc">
            {summaryStats.totalAssignedMonth} assigned tickets
          </div>
        </div>

        <div className="pm-stat-card good">
          <div className="pm-stat-label">Good Standing</div>
          <div className="pm-stat-value">{summaryStats.goodCount}</div>
          <div className="pm-stat-desc">Healthy throughput & recovery</div>
        </div>

        <div className="pm-stat-card warning-1">
          <div className="pm-stat-label">1st Warning</div>
          <div className="pm-stat-value">{summaryStats.warning1Count}</div>
          <div className="pm-stat-desc">Notice to Explain (NTE)</div>
        </div>

        <div className="pm-stat-card warning-2">
          <div className="pm-stat-label">2nd Warning</div>
          <div className="pm-stat-value">{summaryStats.warning2Count}</div>
          <div className="pm-stat-desc">Verbal Reprimand</div>
        </div>

        <div className="pm-stat-card warning-3">
          <div className="pm-stat-label">3rd Warning</div>
          <div className="pm-stat-value">{summaryStats.warning3Count}</div>
          <div className="pm-stat-desc">Notice of Suspension</div>
        </div>

        <div className="pm-stat-card warning-4">
          <div className="pm-stat-label">4th Warning</div>
          <div className="pm-stat-value">{summaryStats.warning4Count}</div>
          <div className="pm-stat-desc">Notice for Termination</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="pm-search-bar-row">
        <div className="pm-search-input-wrap">
          <FaSearch className="pm-search-icon" />
          <input
            type="text"
            className="pm-search-input"
            placeholder="Search staff by name or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="pm-results-count">
          Showing <strong>{filteredProfiles.length}</strong> staff profile{filteredProfiles.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Staff Roster Cards */}
      {filteredProfiles.length === 0 ? (
        <div className="pm-empty-state">
          <FaUserTie className="pm-empty-icon" />
          <h3>No staff records found</h3>
          <p>No staff matched the selected department or search filter for this month.</p>
        </div>
      ) : (
        <div className="pm-staff-roster-grid">
          {filteredProfiles.map(profile => {
            const statusKey = profile.warningEvaluation.status;
            return (
              <div key={profile.staff.id} className={`pm-staff-card status-${statusKey}`}>
                {/* Staff Card Header */}
                <div className="pm-card-top">
                  <div className="pm-staff-ident">
                    <div className="pm-avatar-circle">
                      {profile.staff.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="pm-staff-name">{profile.staff.name}</h4>
                      <div className="pm-staff-meta">
                        <span className="pm-dept-chip">{profile.staff.department}</span>
                        <span className="pm-role-chip">{profile.staff.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`pm-status-badge ${statusKey}`}>
                    {statusKey === 'good' && <FaCheckCircle />}
                    {statusKey === 'warning_1_nte' && <FaInfoCircle />}
                    {statusKey === 'warning_2_verbal' && <FaExclamationTriangle />}
                    {statusKey === 'warning_3_suspension' && <FaShieldAlt />}
                    {statusKey === 'warning_4_termination' && <FaTimes />}
                    <span>{profile.warningEvaluation.shortLabel || profile.warningEvaluation.statusLabel}</span>
                  </div>
                </div>

                {/* Archetype Tag */}
                <div className="pm-archetype-row">
                  <span className={`pm-archetype-pill ${profile.archetype.tag}`}>
                    <FaBrain className="pm-pill-icon" />
                    {profile.archetype.title}
                  </span>
                  <span className="pm-archetype-desc">{profile.archetype.description}</span>
                </div>

                {/* Monthly Volume Stats Row */}
                <div className="pm-metrics-summary-strip">
                  <div className="pm-metric-box">
                    <span className="pm-box-label">Assigned</span>
                    <span className="pm-box-value">{profile.totals.totalAssigned}</span>
                  </div>
                  <div className="pm-metric-box">
                    <span className="pm-box-label">Resolved</span>
                    <span className="pm-box-value">{profile.totals.totalResolved}</span>
                  </div>
                  <div className="pm-metric-box">
                    <span className="pm-box-label">Clearance</span>
                    <span className="pm-box-value">{profile.totals.overallClearanceRate}%</span>
                  </div>
                  <div className="pm-metric-box">
                    <span className="pm-box-label">Rollover to Next Mo.</span>
                    <span className={`pm-box-value ${profile.totals.netRolloverNextMonth > 5 ? 'alert' : ''}`}>
                      {profile.totals.netRolloverNextMonth}
                    </span>
                  </div>
                </div>

                {/* 4-Week Progress Timeline */}
                <div className="pm-weekly-timeline-wrap">
                  <div className="pm-timeline-header">
                    <span>4-Week Behavioral Progression</span>
                    <span className="pm-timeline-caption">Intake vs. Clearance Rate</span>
                  </div>
                  <div className="pm-timeline-stepper">
                    {profile.weeklyBreakdown.map((week, idx) => {
                      let barColorClass = 'good';
                      if (week.clearanceRate < 50) barColorClass = 'critical';
                      else if (week.clearanceRate < 75) barColorClass = 'warning';

                      return (
                        <div key={week.weekNum} className="pm-week-step">
                          <div className="pm-step-label">W{week.weekNum}</div>
                          <div className={`pm-step-bar ${barColorClass}`} title={`${week.label}: ${week.resolved}/${week.assigned} resolved (${week.clearanceRate}%)`}>
                            <div className="pm-bar-fill" style={{ width: `${Math.min(100, week.clearanceRate)}%` }}></div>
                          </div>
                          <div className="pm-step-subtext">
                            {week.clearanceRate}%
                          </div>
                          <div className="pm-step-counts">
                            {week.resolved}/{week.assigned}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Next Month Forecast Sneak Peek */}
                <div className="pm-forecast-snippet">
                  <FaChartLine className="pm-forecast-icon" />
                  <span className="pm-forecast-text">
                    <strong>Next-Month Forecast:</strong> {profile.nextMonthPrediction.predictedBottleneck}
                  </span>
                </div>

                {/* Card Action Button */}
                <div className="pm-card-actions">
                  <button
                    type="button"
                    className="pm-inspect-btn"
                    onClick={() => handleInspectStaff(profile)}
                  >
                    <span>View AI Monthly Diagnostic</span>
                    <FaArrowRight />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deep-Dive AI Staff Diagnostic Modal */}
      {activeStaffDiagnostic && (
        <div className="pm-modal-overlay" onClick={() => setActiveStaffDiagnostic(null)}>
          <div
            className="pm-modal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="diagnostic-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="pm-modal-header">
              <div className="pm-modal-title-area">
                <div className="pm-modal-avatar">
                  {activeStaffDiagnostic.staff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 id="diagnostic-modal-title" className="pm-modal-name">
                    {activeStaffDiagnostic.staff.name}
                  </h3>
                  <div className="pm-modal-subtitle">
                    {activeStaffDiagnostic.staff.department} Office &bull; {activeStaffDiagnostic.month.name}
                  </div>
                </div>
              </div>

              <div className="pm-modal-actions-top">
                <div className={`pm-status-badge ${activeStaffDiagnostic.warningEvaluation.status}`}>
                  <span>{activeStaffDiagnostic.warningEvaluation.statusLabel}</span>
                </div>
                <button
                  type="button"
                  className="pm-modal-close"
                  onClick={() => setActiveStaffDiagnostic(null)}
                  aria-label="Close diagnostic"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="pm-modal-body">
              {analyzingStaffId === activeStaffDiagnostic.staff.id && (
                <div className="pm-ai-loading-banner">
                  <FaBrain className="pm-spin-icon" />
                  <span>Synthesizing multi-week behavioral model with institutional AI...</span>
                </div>
              )}

              {/* Archetype & Behavioral Profile */}
              <div className="pm-diagnostic-section highlight">
                <div className="pm-section-label">
                  <FaBrain />
                  <span>Observed Monthly Behavior & Pacing Archetype</span>
                </div>
                <div className="pm-archetype-banner">
                  <h4 className="pm-archetype-headline">{activeStaffDiagnostic.archetype.title}</h4>
                  <p className="pm-archetype-body">{activeStaffDiagnostic.archetype.description}</p>
                </div>
                <div className="pm-ai-diagnosis-box">
                  <strong>4-Week Pattern Diagnosis:</strong>
                  <p>{activeStaffDiagnostic.aiPatternDiagnosis}</p>
                </div>
              </div>

              {/* 4-Week Detailed Metrics Matrix */}
              <div className="pm-diagnostic-section">
                <div className="pm-section-label">
                  <FaHistory />
                  <span>4-Week Chronological Metrics Matrix</span>
                </div>
                <div className="pm-matrix-table-wrap">
                  <table className="pm-matrix-table">
                    <thead>
                      <tr>
                        <th>Interval</th>
                        <th>Assigned</th>
                        <th>Resolved</th>
                        <th>Rollovers Carried In</th>
                        <th>Clearance %</th>
                        <th>Avg Resolution</th>
                        <th>Pickup Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeStaffDiagnostic.weeklyBreakdown.map(w => (
                        <tr key={w.weekNum}>
                          <td className="pm-matrix-week">{w.label}</td>
                          <td>{w.assigned}</td>
                          <td>{w.resolved}</td>
                          <td>{w.rollover}</td>
                          <td>
                            <span className={`pm-matrix-clearance ${w.clearanceRate >= 75 ? 'good' : w.clearanceRate >= 50 ? 'warning' : 'critical'}`}>
                              {w.clearanceRate}%
                            </span>
                          </td>
                          <td>{w.avgResolutionHours > 0 ? `${w.avgResolutionHours} hrs` : 'N/A'}</td>
                          <td>{w.avgPickupLatencyHours > 0 ? `${w.avgPickupLatencyHours} hrs` : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Volume Spike vs. Chronic Neglect Evaluation */}
              <div className="pm-diagnostic-section">
                <div className="pm-section-label">
                  <FaCheckDouble />
                  <span>Temporary Volume Shock vs. Chronic Issue Evaluation</span>
                </div>
                <div className="pm-eval-text-card">
                  <p>{activeStaffDiagnostic.aiSpikeVsChronic}</p>
                </div>
              </div>

              {/* Next-Month Predictive Forecast */}
              <div className="pm-diagnostic-section prediction">
                <div className="pm-section-label">
                  <FaChartLine />
                  <span>AI Next-Month Predictive Forecast</span>
                </div>
                <div className="pm-prediction-grid">
                  <div className="pm-pred-box">
                    <span className="pm-pred-label">Sustainable Weekly Capacity</span>
                    <span className="pm-pred-value">~{activeStaffDiagnostic.nextMonthPrediction.safeWeeklyCapacity} tickets/wk</span>
                    <span className="pm-pred-desc">Threshold before resolution velocity slows</span>
                  </div>
                  <div className="pm-pred-box">
                    <span className="pm-pred-label">Projected Next-Month Risk</span>
                    <span className={`pm-pred-value risk-${activeStaffDiagnostic.nextMonthPrediction.projectedRisk?.toLowerCase()}`}>
                      {activeStaffDiagnostic.nextMonthPrediction.projectedRisk}
                    </span>
                    <span className="pm-pred-desc">Risk of SLA breaches or unmanaged rollover debt</span>
                  </div>
                </div>
                <div className="pm-pred-forecast-note">
                  <strong>Anticipated Trajectory:</strong> {activeStaffDiagnostic.nextMonthPrediction.predictedBottleneck}
                </div>
              </div>

              {/* Option B Warning Justification */}
              <div className="pm-diagnostic-section warning-eval">
                <div className="pm-section-label">
                  <FaShieldAlt />
                  <span>Option B: Monthly Administrative Standing Determination</span>
                </div>
                <div className="pm-standing-box">
                  <div className="pm-standing-header">
                    <span className={`pm-standing-badge ${activeStaffDiagnostic.warningEvaluation.status}`}>
                      {activeStaffDiagnostic.warningEvaluation.statusLabel}
                    </span>
                    <span className="pm-standing-date">Evaluated for entire period of {activeStaffDiagnostic.month.name}</span>
                  </div>
                  <p className="pm-standing-reason">
                    <strong>Evidence & Pattern Basis:</strong> {activeStaffDiagnostic.warningEvaluation.reasoning}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pm-modal-footer">
              <button
                type="button"
                className="pm-btn-secondary"
                onClick={handlePrintDiagnostic}
              >
                <FaPrint />
                <span>Print / Export Summary</span>
              </button>
              <button
                type="button"
                className="pm-btn-primary"
                onClick={() => setActiveStaffDiagnostic(null)}
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;
