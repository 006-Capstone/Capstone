import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaTimes,
  FaCheck,
  FaClock
} from 'react-icons/fa';
import '../../styles/DropdownCalendar.css';

/**
 * Format Date object to local YYYY-MM-DD
 */
const toIsoString = (year, monthIndex, day) => {
  const yyyy = String(year);
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Parse YYYY-MM-DD to { year, month (0-11), day }
 */
const parseIsoString = (isoStr) => {
  if (!isoStr || typeof isoStr !== 'string') return null;
  const parts = isoStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
};

/**
 * Get today's local date as YYYY-MM-DD
 */
const getTodayIso = () => {
  const now = new Date();
  return toIsoString(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Get date with day offset from today as YYYY-MM-DD
 */
const getOffsetIso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toIsoString(d.getFullYear(), d.getMonth(), d.getDate());
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DEFAULT_PRESETS = [
  { label: 'Today', offset: 0 },
  { label: '+1 Day', offset: 1 },
  { label: '+2 Days', offset: 2 },
  { label: '+3 Days', offset: 3 },
  { label: '+5 Days', offset: 5 },
  { label: '+1 Wk', offset: 7 }
];

/**
 * DropdownCalendar
 * 
 * Reusable dropdown calendar picker for admin forms and modals.
 * Supports:
 * - Rich trigger button displaying formatted date and weekday badge
 * - Animated popover dropdown with outside-click and Escape key detection
 * - Month and Year navigation controls with fast dropdown jump
 * - Quick turnaround presets (Today, +1 Day, +2 Days, +3 Days, etc.)
 * - Highlighted today and active selection indicators
 * - Strict minDate / maxDate validation (disables past dates seamlessly)
 */
const DropdownCalendar = ({
  value = '',
  onChange,
  minDate = '',
  maxDate = '',
  disabled = false,
  placeholder = 'Select completion date',
  className = '',
  inputClassName = '',
  showPresets = true,
  presets = DEFAULT_PRESETS,
  id,
  title,
  placement = 'auto',
  ariaLabel = 'Date picker'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const todayIso = useMemo(() => getTodayIso(), []);
  const effectiveMinDate = minDate !== undefined ? minDate : todayIso;

  // Initial month/year view based on selected value or today
  const initialDate = useMemo(() => {
    return parseIsoString(value) || parseIsoString(todayIso);
  }, [value, todayIso]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);

  // Sync calendar view month/year whenever value or initialDate changes when opened
  useEffect(() => {
    if (value) {
      const parsed = parseIsoString(value);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handlePrevMonth = () => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleMonthSelect = (e) => {
    setViewMonth(Number(e.target.value));
  };

  const handleYearSelect = (e) => {
    setViewYear(Number(e.target.value));
  };

  const handleSelectDay = (dayIso) => {
    if (disabled) return;
    if (effectiveMinDate && dayIso < effectiveMinDate) return;
    if (maxDate && dayIso > maxDate) return;

    if (onChange) {
      onChange(dayIso);
    }
    setIsOpen(false);
  };

  const handlePresetClick = (offset) => {
    const iso = getOffsetIso(offset);
    handleSelectDay(iso);
  };

  // Build calendar matrix for current viewYear and viewMonth
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Leading padding days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const iso = toIsoString(prevYear, prevMonth, dayNum);

      days.push({
        dayNum,
        iso,
        isCurrentMonth: false,
        isDisabled: true
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIsoString(viewYear, viewMonth, d);
      const isPast = Boolean(effectiveMinDate && iso < effectiveMinDate);
      const isFuture = Boolean(maxDate && iso > maxDate);
      const isSelected = iso === value;
      const isToday = iso === todayIso;

      days.push({
        dayNum: d,
        iso,
        isCurrentMonth: true,
        isDisabled: isPast || isFuture,
        isSelected,
        isToday
      });
    }

    // Trailing padding days for next month to complete the grid
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const iso = toIsoString(nextYear, nextMonth, i);

      days.push({
        dayNum: i,
        iso,
        isCurrentMonth: false,
        isDisabled: true
      });
    }

    return days;
  }, [viewYear, viewMonth, effectiveMinDate, maxDate, value, todayIso]);

  // Year options for jump selector (current year - 1 to current year + 6)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear - 1; y <= currentYear + 6; y++) {
      years.push(y);
    }
    return years;
  }, []);

  // Format date for trigger button display
  const formattedDisplay = useMemo(() => {
    if (!value) return null;
    const parsed = parseIsoString(value);
    if (!parsed) return value;
    const dateObj = new Date(parsed.year, parsed.month, parsed.day);
    if (isNaN(dateObj.getTime())) return value;

    const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const day = parsed.day;
    const year = parsed.year;

    return {
      text: `${month} ${day}, ${year}`,
      weekday
    };
  }, [value]);

  return (
    <div 
      className={`dropdown-calendar-container ${className}`} 
      ref={containerRef}
      title={title}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        className={`dropdown-calendar-trigger ${inputClassName} ${isOpen ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className="dropdown-calendar-trigger-content">
          <FaCalendarAlt className="dropdown-calendar-icon" aria-hidden="true" />
          {formattedDisplay ? (
            <span className="dropdown-calendar-value-wrapper">
              <span className="dropdown-calendar-value-text">{formattedDisplay.text}</span>
              <span className="dropdown-calendar-weekday-tag">{formattedDisplay.weekday}</span>
            </span>
          ) : (
            <span className="dropdown-calendar-placeholder">{placeholder}</span>
          )}
        </span>
        <FaChevronDown 
          className={`dropdown-calendar-caret ${isOpen ? 'is-open' : ''}`} 
          aria-hidden="true" 
        />
      </button>

      {/* Popover Dropdown Calendar */}
      {isOpen && (
        <div 
          className={`dropdown-calendar-popover ${placement === 'right' ? 'align-right' : ''}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Presets Bar */}
          {showPresets && presets && presets.length > 0 && (
            <div className="dropdown-calendar-presets-bar">
              <span className="dropdown-calendar-presets-title">
                <FaClock className="presets-clock-icon" /> Quick Presets:
              </span>
              <div className="dropdown-calendar-presets-list">
                {presets.map((preset) => {
                  const presetIso = getOffsetIso(preset.offset);
                  const isPresetActive = value === presetIso;
                  const isPresetDisabled = Boolean(effectiveMinDate && presetIso < effectiveMinDate);

                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={`dropdown-calendar-preset-btn ${isPresetActive ? 'is-selected' : ''}`}
                      onClick={() => handlePresetClick(preset.offset)}
                      disabled={isPresetDisabled}
                      title={`Set date to ${presetIso}`}
                    >
                      {preset.label}
                      {isPresetActive && <FaCheck className="preset-check-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation Header */}
          <div className="dropdown-calendar-header">
            <button
              type="button"
              className="dropdown-calendar-nav-btn"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              title="Previous Month"
            >
              <FaChevronLeft />
            </button>

            <div className="dropdown-calendar-selectors">
              <select
                className="dropdown-calendar-select month-select"
                value={viewMonth}
                onChange={handleMonthSelect}
                aria-label="Select month"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                className="dropdown-calendar-select year-select"
                value={viewYear}
                onChange={handleYearSelect}
                aria-label="Select year"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="dropdown-calendar-nav-btn"
              onClick={handleNextMonth}
              aria-label="Next Month"
              title="Next Month"
            >
              <FaChevronRight />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="dropdown-calendar-weekdays">
            {WEEKDAY_NAMES.map((name) => (
              <span key={name} className="dropdown-calendar-weekday-cell">
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="dropdown-calendar-grid">
            {calendarDays.map((item, idx) => {
              if (!item.isCurrentMonth) {
                return (
                  <div 
                    key={`pad-${idx}`} 
                    className="dropdown-calendar-day-cell is-pad"
                    aria-hidden="true"
                  >
                    {item.dayNum}
                  </div>
                );
              }

              let cellClass = 'dropdown-calendar-day-cell is-current';
              if (item.isSelected) cellClass += ' is-selected';
              if (item.isToday) cellClass += ' is-today';
              if (item.isDisabled) cellClass += ' is-disabled';

              return (
                <button
                  key={item.iso}
                  type="button"
                  className={cellClass}
                  onClick={() => handleSelectDay(item.iso)}
                  disabled={item.isDisabled}
                  aria-label={`${item.iso}${item.isToday ? ' (Today)' : ''}${item.isSelected ? ' (Selected)' : ''}`}
                >
                  <span className="dropdown-calendar-day-num">{item.dayNum}</span>
                  {item.isToday && !item.isSelected && <span className="today-dot" />}
                </button>
              );
            })}
          </div>

          {/* Footer Bar */}
          <div className="dropdown-calendar-footer">
            <div className="dropdown-calendar-footer-info">
              {value ? (
                <>
                  <span className="footer-label">Target:</span>
                  <strong className="footer-date">{value}</strong>
                </>
              ) : (
                <span className="footer-hint">Click a date to select</span>
              )}
            </div>

            <div className="dropdown-calendar-footer-actions">
              <button
                type="button"
                className="dropdown-calendar-footer-btn today-btn"
                onClick={() => handlePresetClick(0)}
                disabled={Boolean(effectiveMinDate && todayIso < effectiveMinDate)}
              >
                Today
              </button>
              <button
                type="button"
                className="dropdown-calendar-footer-btn close-btn"
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

export default DropdownCalendar;
