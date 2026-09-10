import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FaFilter,
  FaCalendarAlt,
  FaCalendarDay,
  FaCalendarWeek,
  FaTimes,
  FaChevronDown,
  FaCheck
} from 'react-icons/fa';
import '../styles/DateRangeFilter.css';

/**
 * Format a Date object to YYYY-MM-DD in local time (prevents UTC timezone shift).
 */
const toLocalIsoDate = (d) => {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateShort = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = String(isoStr).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return isoStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDateFull = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = String(isoStr).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return isoStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Comprehensive Date Filter Dropdown with tabs for:
 * - Days (Today, Yesterday, Last 7/14/30 Days, Specific Single Day)
 * - Weeks (This Week, Last Week, Last 2/4 Weeks)
 * - Months (This Month, Last Month, Last 3/6 Months, Specific Month & Year)
 * - Custom Date Range (From -> To pickers)
 */
const DateRangeFilterDropdown = ({
  filter,
  onFilterChange,
  isActive,
  onApply,
  onClear,
  idPrefix = 'date-filter',
  appliedFilter = { from: '', to: '' }
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('days'); // 'days' | 'weeks' | 'months' | 'custom'
  const wrapRef = useRef(null);

  // State for single-day picker inside "Days" tab
  const [singleDay, setSingleDay] = useState(() => filter?.from === filter?.to ? filter?.from || '' : '');

  // State for specific month picker inside "Months" tab
  const now = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Generate presets based on the current date
  const presets = useMemo(() => {
    const todayStr = toLocalIsoDate(now);

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = toLocalIsoDate(yesterday);

    // Last 3 days
    const past3 = new Date(now);
    past3.setDate(now.getDate() - 2);

    // Last 7 days
    const past7 = new Date(now);
    past7.setDate(now.getDate() - 6);

    // Last 14 days
    const past14 = new Date(now);
    past14.setDate(now.getDate() - 13);

    // Last 30 days
    const past30 = new Date(now);
    past30.setDate(now.getDate() - 29);

    // This Week (Monday to Sunday)
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Last Week (Monday to Sunday)
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    // Last 2 Weeks
    const last2Weeks = new Date(now);
    last2Weeks.setDate(now.getDate() - 13);

    // Last 4 Weeks
    const last4Weeks = new Date(now);
    last4Weeks.setDate(now.getDate() - 27);

    // This Month
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Last Month
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Last 3 Months
    const start3Months = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    // Last 6 Months
    const start6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // This Year
    const startThisYear = new Date(now.getFullYear(), 0, 1);
    const endThisYear = new Date(now.getFullYear(), 11, 31);

    return {
      days: [
        { id: 'today', label: 'Today', from: todayStr, to: todayStr, desc: formatDateFull(todayStr) },
        { id: 'yesterday', label: 'Yesterday', from: yesterdayStr, to: yesterdayStr, desc: formatDateFull(yesterdayStr) },
        { id: 'last3days', label: 'Last 3 Days', from: toLocalIsoDate(past3), to: todayStr, desc: `${formatDateShort(toLocalIsoDate(past3))} – ${formatDateShort(todayStr)}` },
        { id: 'last7days', label: 'Last 7 Days', from: toLocalIsoDate(past7), to: todayStr, desc: `${formatDateShort(toLocalIsoDate(past7))} – ${formatDateShort(todayStr)}` },
        { id: 'last14days', label: 'Last 14 Days', from: toLocalIsoDate(past14), to: todayStr, desc: `${formatDateShort(toLocalIsoDate(past14))} – ${formatDateShort(todayStr)}` },
        { id: 'last30days', label: 'Last 30 Days', from: toLocalIsoDate(past30), to: todayStr, desc: `${formatDateShort(toLocalIsoDate(past30))} – ${formatDateShort(todayStr)}` }
      ],
      weeks: [
        { id: 'thisWeek', label: 'This Week', from: toLocalIsoDate(monday), to: toLocalIsoDate(sunday), desc: `${formatDateShort(toLocalIsoDate(monday))} – ${formatDateShort(toLocalIsoDate(sunday))}` },
        { id: 'lastWeek', label: 'Last Week', from: toLocalIsoDate(lastMonday), to: toLocalIsoDate(lastSunday), desc: `${formatDateShort(toLocalIsoDate(lastMonday))} – ${formatDateShort(toLocalIsoDate(lastSunday))}` },
        { id: 'last2Weeks', label: 'Last 2 Weeks', from: toLocalIsoDate(last2Weeks), to: todayStr, desc: `${formatDateShort(toLocalIsoDate(last2Weeks))} – ${formatDateShort(todayStr)}` },
        { id: 'last4Weeks', label: 'Last 4 Weeks', from: toLocalIsoDate(last4Weeks), to: todayStr, desc: `${formatDateShort(toLocalIsoDate(last4Weeks))} – ${formatDateShort(todayStr)}` }
      ],
      months: [
        { id: 'thisMonth', label: 'This Month', from: toLocalIsoDate(startThisMonth), to: toLocalIsoDate(endThisMonth), desc: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` },
        { id: 'lastMonth', label: 'Last Month', from: toLocalIsoDate(startLastMonth), to: toLocalIsoDate(endLastMonth), desc: `${MONTH_NAMES[startLastMonth.getMonth()]} ${startLastMonth.getFullYear()}` },
        { id: 'last3Months', label: 'Last 3 Months', from: toLocalIsoDate(start3Months), to: toLocalIsoDate(endThisMonth), desc: `${MONTH_NAMES[start3Months.getMonth()]} – ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` },
        { id: 'last6Months', label: 'Last 6 Months', from: toLocalIsoDate(start6Months), to: toLocalIsoDate(endThisMonth), desc: `Past 6 months` },
        { id: 'thisYear', label: 'This Year', from: toLocalIsoDate(startThisYear), to: toLocalIsoDate(endThisYear), desc: `Year ${now.getFullYear()}` }
      ]
    };
  }, [now]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Determine active preset match
  const activePresetId = useMemo(() => {
    if (!appliedFilter?.from && !appliedFilter?.to) return null;
    if (appliedFilter?.preset) return appliedFilter.preset;
    
    // Check if the applied range matches one of our known presets
    const allPresets = [...presets.days, ...presets.weeks, ...presets.months];
    const match = allPresets.find(p => p.from === appliedFilter.from && p.to === appliedFilter.to);
    return match ? match.id : 'custom';
  }, [appliedFilter, presets]);

  // Compute trigger button label
  const triggerLabel = useMemo(() => {
    if (!isActive) return 'By Date';
    if (appliedFilter?.label) return `By Date: ${appliedFilter.label}`;
    
    const allPresets = [...presets.days, ...presets.weeks, ...presets.months];
    const match = allPresets.find(p => p.from === appliedFilter.from && p.to === appliedFilter.to);
    if (match) return `By Date: ${match.label}`;

    if (appliedFilter.from && appliedFilter.to) {
      if (appliedFilter.from === appliedFilter.to) {
        return `By Date: ${formatDateShort(appliedFilter.from)}`;
      }
      return `By Date: ${formatDateShort(appliedFilter.from)} – ${formatDateShort(appliedFilter.to)}`;
    }
    if (appliedFilter.from) return `By Date: From ${formatDateShort(appliedFilter.from)}`;
    if (appliedFilter.to) return `By Date: To ${formatDateShort(appliedFilter.to)}`;
    return 'By Date';
  }, [isActive, appliedFilter, presets]);

  // Handle preset selection: immediately applies and closes dropdown
  const handleSelectPreset = (preset) => {
    const next = {
      from: preset.from,
      to: preset.to,
      preset: preset.id,
      label: preset.label
    };
    onFilterChange(next);
    if (onApply) {
      onApply(next);
    }
    setIsOpen(false);
  };

  // Handle single day apply
  const handleApplySingleDay = () => {
    if (!singleDay) return;
    const next = {
      from: singleDay,
      to: singleDay,
      preset: 'single-day',
      label: formatDateFull(singleDay)
    };
    onFilterChange(next);
    if (onApply) {
      onApply(next);
    }
    setIsOpen(false);
  };

  // Handle specific month & year apply
  const handleApplySpecificMonth = () => {
    const start = new Date(selectedYear, selectedMonth, 1);
    const end = new Date(selectedYear, selectedMonth + 1, 0);
    const fromStr = toLocalIsoDate(start);
    const toStr = toLocalIsoDate(end);
    const label = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    const next = {
      from: fromStr,
      to: toStr,
      preset: `month-${selectedYear}-${selectedMonth}`,
      label
    };
    onFilterChange(next);
    if (onApply) {
      onApply(next);
    }
    setIsOpen(false);
  };

  // Custom date range validation and apply
  const hasCustomInput = Boolean(filter.from || filter.to);
  const hasCustomChanges =
    (filter.from || '') !== (appliedFilter.from || '') ||
    (filter.to || '') !== (appliedFilter.to || '');
  const canApplyCustom = hasCustomInput && hasCustomChanges;

  const handleApplyCustom = () => {
    if (!filter.from && !filter.to) return;
    if (filter.from && filter.to && filter.from > filter.to) {
      alert('The "From" date cannot be later than the "To" date.');
      return;
    }
    let label = '';
    if (filter.from && filter.to) {
      label = filter.from === filter.to
        ? formatDateShort(filter.from)
        : `${formatDateShort(filter.from)} – ${formatDateShort(filter.to)}`;
    } else if (filter.from) {
      label = `From ${formatDateShort(filter.from)}`;
    } else {
      label = `To ${formatDateShort(filter.to)}`;
    }
    const next = {
      from: filter.from,
      to: filter.to,
      preset: 'custom',
      label
    };
    onFilterChange(next);
    if (onApply) {
      onApply(next);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setIsOpen(false);
  };

  // List of selectable years (current year down to 3 years ago)
  const selectableYears = useMemo(() => {
    const currentYear = now.getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, [now]);

  return (
    <div className="daterange-filter-wrap" ref={wrapRef}>
      <div className="daterange-trigger-group">
        <button
          type="button"
          className={`daterange-trigger ${isActive ? 'active' : ''}`}
          onClick={() => setIsOpen(prev => !prev)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          title={isActive ? `Active filter: ${triggerLabel}` : 'Filter by date (Days, Weeks, Months, Custom)'}
        >
          <FaFilter className="daterange-icon" aria-hidden="true" />
          <span className="daterange-trigger-text">{triggerLabel}</span>
          {isActive && <span className="daterange-active-dot" aria-hidden="true" />}
          <FaChevronDown className={`daterange-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true" />
        </button>

        {isActive && (
          <button
            type="button"
            className="daterange-trigger-quick-clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            title="Clear date filter"
            aria-label="Clear date filter"
          >
            <FaTimes aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="daterange-panel" role="dialog" aria-label="Filter by date">
          {/* Header */}
          <div className="daterange-panel-header">
            <div>
              <div className="daterange-title">Filter by Date</div>
              <div className="daterange-subtitle">Choose by days, weeks, months, or custom range</div>
            </div>
            <button
              type="button"
              className="daterange-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close date filter panel"
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>

          {/* Navigation Tabs (Days, Weeks, Months, Custom) */}
          <div className="daterange-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'days'}
              className={`daterange-tab-btn ${activeTab === 'days' ? 'active' : ''}`}
              onClick={() => setActiveTab('days')}
            >
              <FaCalendarDay className="tab-icon" aria-hidden="true" />
              Days
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'weeks'}
              className={`daterange-tab-btn ${activeTab === 'weeks' ? 'active' : ''}`}
              onClick={() => setActiveTab('weeks')}
            >
              <FaCalendarWeek className="tab-icon" aria-hidden="true" />
              Weeks
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'months'}
              className={`daterange-tab-btn ${activeTab === 'months' ? 'active' : ''}`}
              onClick={() => setActiveTab('months')}
            >
              <FaCalendarAlt className="tab-icon" aria-hidden="true" />
              Months
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'custom'}
              className={`daterange-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
              onClick={() => setActiveTab('custom')}
            >
              Custom
            </button>
          </div>

          {/* Tab Content: DAYS */}
          {activeTab === 'days' && (
            <div className="daterange-tab-content">
              <div className="daterange-section-label">Quick Day Presets</div>
              <div className="daterange-presets-grid">
                {presets.days.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`daterange-preset-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <div className="preset-btn-info">
                        <span className="preset-btn-label">{preset.label}</span>
                        <span className="preset-btn-desc">{preset.desc}</span>
                      </div>
                      {isSelected && <FaCheck className="preset-check-icon" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              {/* Single Specific Day Picker */}
              <div className="daterange-subform">
                <div className="daterange-subform-title">Or Pick a Specific Day</div>
                <div className="daterange-single-day-row">
                  <input
                    type="date"
                    id={`${idPrefix}-single-day`}
                    value={singleDay}
                    onChange={(e) => setSingleDay(e.target.value)}
                    className="daterange-date-input"
                    aria-label="Pick single day"
                  />
                  <button
                    type="button"
                    className="daterange-subform-apply-btn"
                    onClick={handleApplySingleDay}
                    disabled={!singleDay}
                  >
                    Apply Day
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: WEEKS */}
          {activeTab === 'weeks' && (
            <div className="daterange-tab-content">
              <div className="daterange-section-label">Filter by Week Period</div>
              <div className="daterange-presets-grid">
                {presets.weeks.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`daterange-preset-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <div className="preset-btn-info">
                        <span className="preset-btn-label">{preset.label}</span>
                        <span className="preset-btn-desc">{preset.desc}</span>
                      </div>
                      {isSelected && <FaCheck className="preset-check-icon" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab Content: MONTHS */}
          {activeTab === 'months' && (
            <div className="daterange-tab-content">
              <div className="daterange-section-label">Quick Month Presets</div>
              <div className="daterange-presets-grid">
                {presets.months.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`daterange-preset-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <div className="preset-btn-info">
                        <span className="preset-btn-label">{preset.label}</span>
                        <span className="preset-btn-desc">{preset.desc}</span>
                      </div>
                      {isSelected && <FaCheck className="preset-check-icon" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>

              {/* Select Specific Month & Year */}
              <div className="daterange-subform">
                <div className="daterange-subform-title">Or Select Specific Month & Year</div>
                <div className="daterange-month-year-row">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="daterange-select"
                    aria-label="Select Month"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="daterange-select"
                    aria-label="Select Year"
                  >
                    {selectableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="daterange-subform-apply-btn"
                    onClick={handleApplySpecificMonth}
                  >
                    Apply Month
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content: CUSTOM DATE RANGE */}
          {activeTab === 'custom' && (
            <div className="daterange-tab-content">
              <div className="daterange-section-label">Custom Date Range</div>
              <div className="daterange-custom-fields">
                <div className="daterange-field">
                  <label htmlFor={`${idPrefix}-from-date`}>From Date</label>
                  <input
                    id={`${idPrefix}-from-date`}
                    type="date"
                    value={filter.from || ''}
                    max={filter.to || undefined}
                    onChange={(e) => onFilterChange({ ...filter, from: e.target.value, preset: 'custom' })}
                    className="daterange-date-input"
                  />
                </div>
                <div className="daterange-field">
                  <label htmlFor={`${idPrefix}-to-date`}>To Date</label>
                  <input
                    id={`${idPrefix}-to-date`}
                    type="date"
                    value={filter.to || ''}
                    min={filter.from || undefined}
                    onChange={(e) => onFilterChange({ ...filter, to: e.target.value, preset: 'custom' })}
                    className="daterange-date-input"
                  />
                </div>
              </div>

              <div className="daterange-custom-apply-wrap">
                <button
                  type="button"
                  className="daterange-apply-btn"
                  onClick={handleApplyCustom}
                  disabled={!canApplyCustom}
                  title={!hasCustomInput ? 'Pick a date range to enable Apply' : undefined}
                >
                  <FaCalendarAlt aria-hidden="true" /> Apply Custom Range
                </button>
              </div>
            </div>
          )}

          {/* Panel Footer */}
          <div className="daterange-panel-footer">
            <div className="daterange-footer-status">
              {isActive ? (
                <span>
                  Active: <strong>{appliedFilter.label || `${appliedFilter.from} – ${appliedFilter.to}`}</strong>
                </span>
              ) : (
                <span className="daterange-footer-muted">No date filter applied</span>
              )}
            </div>
            <div className="daterange-footer-actions">
              {isActive && (
                <button
                  type="button"
                  className="daterange-clear-btn"
                  onClick={handleClear}
                >
                  <FaTimes aria-hidden="true" /> Clear Filter
                </button>
              )}
              <button
                type="button"
                className="daterange-cancel-btn"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilterDropdown;
