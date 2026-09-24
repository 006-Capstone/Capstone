import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaTimes,
  FaCheck
} from 'react-icons/fa';
import '../../styles/DropdownCalendar.css';

/**
 * Format Date parts to local YYYY-MM-DD
 */
const toIsoString = (year, monthIndex, day) => {
  const yyyy = String(year);
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Parse YYYY-MM-DD safely into local year, monthIndex (0-11), day
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
 * Polished, lightweight, modern dropdown calendar component.
 * Features:
 * - High-aesthetic trigger matching form select inputs
 * - Formatted date display with weekday (e.g., "Sep 26, 2026 (Sat)")
 * - Clean calendar popover with smart width fitting
 * - One-click quick presets strip
 * - High-contrast selection, today indicator, and disabled past dates
 * - Keyboard (Esc) and outside-click auto-close
 */
const DropdownCalendar = ({
  value = '',
  onChange,
  minDate = '',
  maxDate = '',
  disabled = false,
  placeholder = 'Select date...',
  className = '',
  inputClassName = '',
  showPresets = true,
  presets = DEFAULT_PRESETS,
  allowClear = false,
  footerActions = 'default', // 'default' | 'cancel'
  id,
  title,
  placement = 'auto',
  ariaLabel = 'Date picker'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const todayIso = useMemo(() => getTodayIso(), []);
  const effectiveMinDate = minDate !== undefined ? minDate : todayIso;

  // View year and month in the calendar matrix
  const parsedValue = useMemo(() => parseIsoString(value), [value]);
  const parsedToday = useMemo(() => parseIsoString(todayIso), [todayIso]);

  const [viewYear, setViewYear] = useState(() => (parsedValue || parsedToday).year);
  const [viewMonth, setViewMonth] = useState(() => (parsedValue || parsedToday).month);

  // Sync calendar view month/year when value changes or when opening
  useEffect(() => {
    if (value) {
      const parsed = parseIsoString(value);
      if (parsed) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    }
  }, [value, isOpen]);

  // Click outside and ESC key handlers
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

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
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

  const handlePresetClick = (e, offset) => {
    e.stopPropagation();
    const iso = getOffsetIso(offset);
    handleSelectDay(iso);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (onChange) {
      onChange('');
    }
  };

  // Build 35-42 cell calendar grid for viewYear and viewMonth
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

    // Trailing padding days for next month to complete the row
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

  // Format readable trigger text
  const displayLabel = useMemo(() => {
    if (!value) return null;
    const parsed = parseIsoString(value);
    if (!parsed) return value;
    const dateObj = new Date(parsed.year, parsed.month, parsed.day);
    if (isNaN(dateObj.getTime())) return value;

    const shortMonth = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    return `${shortMonth} ${parsed.day}, ${parsed.year} (${weekday})`;
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
        <div className="cal-trigger-left">
          <FaCalendarAlt className="cal-trigger-icon" aria-hidden="true" />
          {displayLabel ? (
            <span className="cal-trigger-text">{displayLabel}</span>
          ) : (
            <span className="cal-trigger-placeholder">{placeholder}</span>
          )}
        </div>

        <div className="cal-trigger-right">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              className="cal-trigger-clear-btn"
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e)}
              title="Clear date"
              aria-label="Clear date"
            >
              <FaTimes />
            </span>
          )}
          <FaChevronDown
            className={`cal-trigger-chevron ${isOpen ? 'is-open' : ''}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Popover Dropdown Window */}
      {isOpen && (
        <div
          className={`dropdown-calendar-popover ${placement === 'right' ? 'align-right' : ''}`}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Presets Strip */}
          {showPresets && presets && presets.length > 0 && (
            <div className="cal-presets-strip">
              {presets.map((preset) => {
                const presetIso = getOffsetIso(preset.offset);
                const isPresetActive = value === presetIso;
                const isPresetDisabled = Boolean(effectiveMinDate && presetIso < effectiveMinDate);

                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={`cal-preset-pill ${isPresetActive ? 'is-active' : ''}`}
                    onClick={(e) => handlePresetClick(e, preset.offset)}
                    disabled={isPresetDisabled}
                    title={`Set to ${presetIso}`}
                  >
                    {preset.label}
                    {isPresetActive && <FaCheck className="preset-check-icon" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Month & Year Navigation Header */}
          <div className="cal-nav-header">
            <button
              type="button"
              className="cal-nav-btn"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
              title="Previous Month"
            >
              <FaChevronLeft />
            </button>

            <span className="cal-nav-title">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              className="cal-nav-btn"
              onClick={handleNextMonth}
              aria-label="Next Month"
              title="Next Month"
            >
              <FaChevronRight />
            </button>
          </div>

          {/* Weekday Row */}
          <div className="cal-weekdays-row">
            {WEEKDAY_NAMES.map((name) => (
              <span key={name} className="cal-weekday-cell">
                {name}
              </span>
            ))}
          </div>

          {/* Days Matrix Grid */}
          <div className="cal-days-grid">
            {calendarDays.map((item, idx) => {
              if (!item.isCurrentMonth) {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="cal-day-cell is-pad"
                    aria-hidden="true"
                  >
                    {item.dayNum}
                  </div>
                );
              }

              let cellClass = 'cal-day-cell is-current';
              if (item.isSelected) cellClass += ' is-selected';
              else if (item.isToday) cellClass += ' is-today';
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
                  <span className="cal-day-num">{item.dayNum}</span>
                </button>
              );
            })}
          </div>

          {/* Compact Footer */}
          <div className="cal-footer">
            <div className="cal-footer-text">
              {value ? (
                <span>Selected: <strong>{value}</strong></span>
              ) : (
                <span className="cal-footer-hint">Pick a date above</span>
              )}
            </div>

            <div className="cal-footer-buttons">
              {footerActions === 'cancel' ? (
                <button
                  type="button"
                  className="cal-footer-btn cal-cancel-btn"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="cal-footer-btn cal-today-btn"
                    onClick={(e) => handlePresetClick(e, 0)}
                    disabled={Boolean(effectiveMinDate && todayIso < effectiveMinDate)}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="cal-footer-btn cal-close-btn"
                    onClick={() => setIsOpen(false)}
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownCalendar;
