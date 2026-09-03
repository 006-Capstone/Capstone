/**
 * etcHelper.js
 * Utilities for parsing, filtering, and summarizing requests nearing
 * their Estimated Time of Completion (ETC).
 */

/**
 * Normalizes a Date to midnight (00:00:00.000) for clean day-diff calculations.
 */
export const normalizeDateToMidnight = (d) => {
  const normalized = new Date(d);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Parses the Estimated Completion Date from a ticket object.
 * Handles both `ticket.etc` ('YYYY-MM-DD' string) and `ticket.estimatedCompletion`
 * (Firestore Timestamp, Date object, or date string).
 *
 * @param {object} ticket
 * @returns {object|null} Detailed parsed info or null if no valid date found.
 */
export const parseTicketETC = (ticket) => {
  if (!ticket) return null;

  let targetDate = null;

  if (ticket.etc) {
    if (typeof ticket.etc === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ticket.etc)) {
      const [y, m, d] = ticket.etc.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else {
      const d = new Date(ticket.etc);
      if (!isNaN(d.getTime())) targetDate = d;
    }
  } else if (ticket.estimatedCompletion) {
    if (typeof ticket.estimatedCompletion?.toDate === 'function') {
      targetDate = ticket.estimatedCompletion.toDate();
    } else {
      const d = new Date(ticket.estimatedCompletion);
      if (!isNaN(d.getTime())) targetDate = d;
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) {
    return null;
  }

  const today = normalizeDateToMidnight(new Date());
  const target = normalizeDateToMidnight(targetDate);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let urgencyStatus = 'upcoming';
  let urgencyLabel = `Due in ${diffDays} days`;

  if (diffDays < 0) {
    urgencyStatus = 'overdue';
    const overdueDays = Math.abs(diffDays);
    urgencyLabel = overdueDays === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueDays} days`;
  } else if (diffDays === 0) {
    urgencyStatus = 'today';
    urgencyLabel = 'Due Today';
  } else if (diffDays === 1) {
    urgencyStatus = 'tomorrow';
    urgencyLabel = 'Due Tomorrow';
  } else if (diffDays <= 3) {
    urgencyStatus = 'soon';
    urgencyLabel = `Due in ${diffDays} days`;
  }

  const formattedDate = targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return {
    targetDate,
    diffDays,
    isOverdue: diffDays < 0,
    isToday: diffDays === 0,
    isTomorrow: diffDays === 1,
    isDueSoon: diffDays > 1 && diffDays <= 3,
    isNearing: diffDays <= 3,
    urgencyStatus,
    urgencyLabel,
    formattedDate
  };
};

/**
 * Filters tickets that are active (needed to process) and nearing their completion date.
 *
 * @param {Array} tickets List of all office tickets.
 * @param {number} thresholdDays Max days into the future to consider "nearing" (default 3).
 * @returns {Array} List of tickets with attached `etcInfo`, sorted by urgency.
 */
export const getNearingRequests = (tickets, thresholdDays = 3) => {
  if (!Array.isArray(tickets)) return [];

  const nearing = [];

  for (const ticket of tickets) {
    // Exclude resolved, cancelled, or rejected requests
    const status = (ticket.status || '').trim().toLowerCase();
    if (status === 'resolved' || status === 'cancelled' || status === 'rejected') {
      continue;
    }

    const etcInfo = parseTicketETC(ticket);
    if (!etcInfo) continue;

    // Any overdue request (diffDays < 0) or request within thresholdDays is included
    if (etcInfo.diffDays <= thresholdDays) {
      nearing.push({
        ...ticket,
        etcInfo
      });
    }
  }

  // Sort by urgency:
  // 1. Overdue (smallest/most negative diffDays first)
  // 2. Due today (diffDays === 0)
  // 3. Due tomorrow and soon (ascending diffDays)
  nearing.sort((a, b) => {
    return a.etcInfo.diffDays - b.etcInfo.diffDays;
  });

  return nearing;
};

/**
 * Computes summary counts from nearing requests list.
 *
 * @param {Array} nearingRequests Output of getNearingRequests.
 * @returns {object} Summary counts.
 */
export const getNearingSummary = (nearingRequests = []) => {
  let overdue = 0;
  let today = 0;
  let tomorrow = 0;
  let soon = 0;

  for (const req of nearingRequests) {
    if (req.etcInfo.isOverdue) overdue++;
    else if (req.etcInfo.isToday) today++;
    else if (req.etcInfo.isTomorrow) tomorrow++;
    else if (req.etcInfo.isDueSoon) soon++;
  }

  return {
    total: nearingRequests.length,
    overdue,
    today,
    tomorrow,
    soon,
    upcoming: tomorrow + soon
  };
};

/**
 * Groups nearing requests into top-to-bottom urgency tiers:
 * 1. Overdue
 * 2. Due Today
 * 3. Due Tomorrow
 * 4. Due in 2+ Days / Upcoming
 *
 * @param {Array} tickets List of tickets with attached etcInfo.
 * @returns {Array} List of group objects in strict top-to-bottom priority.
 */
export const groupRequestsByUrgency = (tickets = []) => {
  const overdue = [];
  const today = [];
  const tomorrow = [];
  const upcoming = [];

  for (const ticket of tickets) {
    if (ticket.etcInfo?.isOverdue) {
      overdue.push(ticket);
    } else if (ticket.etcInfo?.isToday) {
      today.push(ticket);
    } else if (ticket.etcInfo?.isTomorrow) {
      tomorrow.push(ticket);
    } else {
      upcoming.push(ticket);
    }
  }

  // 1. Overdue: most overdue first (lowest diffDays: -5 before -1)
  overdue.sort((a, b) => (a.etcInfo?.diffDays ?? 0) - (b.etcInfo?.diffDays ?? 0));
  // 2. Due Today: newest created first
  today.sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
  // 3. Due Tomorrow: newest created first
  tomorrow.sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
  // 4. Due in X Days: ascending days away (2 days before 3 days, etc.)
  upcoming.sort((a, b) => (a.etcInfo?.diffDays ?? 0) - (b.etcInfo?.diffDays ?? 0));

  return [
    {
      key: 'overdue',
      title: 'Overdue Requests',
      subtitle: 'Target completion date has passed — Requires immediate action',
      urgencyLevel: 'critical',
      items: overdue
    },
    {
      key: 'today',
      title: 'Due Today',
      subtitle: 'Target completion date is today — Complete by end of day',
      urgencyLevel: 'urgent',
      items: today
    },
    {
      key: 'tomorrow',
      title: 'Due Tomorrow',
      subtitle: 'Target completion date is tomorrow — Prepare and process next',
      urgencyLevel: 'warning',
      items: tomorrow
    },
    {
      key: 'upcoming',
      title: 'Due in 2+ Days (Upcoming)',
      subtitle: 'Approaching completion window — In progress queue',
      urgencyLevel: 'upcoming',
      items: upcoming
    }
  ];
};

