/**
 * AI-Powered Performance Analytics & Multi-Week Behavioral Engine
 * Synchronized with Superadmin Performance & Behavioral Monitor
 * Evaluates 4-week trends, monthly trajectory, and consistent performance streaks.
 */

/**
 * Safely parses any date/timestamp into a native JavaScript Date
 */
export const parseDateSafe = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Filter tickets belonging to a specific staff member
 */
export const filterStaffTickets = (allRequests = [], staff = {}) => {
  const staffNameLower = (staff.name || staff.fullName || '').trim().toLowerCase();
  const staffUid = staff.uid || staff.id || '';
  const cleanStaffName = staffNameLower.replace(/\b[a-z]\.\s*/g, '').trim();

  return allRequests.filter(r => {
    const assigned = (r.assignedTo || '').trim().toLowerCase();
    const claimed = (r.claimedBy || '').trim().toLowerCase();
    const assignedStaff = (r.assignedToStaff || '').trim().toLowerCase();
    const cleanAssigned = assigned.replace(/\b[a-z]\.\s*/g, '').trim();
    const cleanClaimed = claimed.replace(/\b[a-z]\.\s*/g, '').trim();

    const matchesName = Boolean(staffNameLower && (
      assigned === staffNameLower ||
      claimed === staffNameLower ||
      assignedStaff === staffNameLower ||
      (cleanAssigned && cleanStaffName && (cleanAssigned === cleanStaffName || cleanStaffName.includes(cleanAssigned) || cleanAssigned.includes(cleanStaffName))) ||
      (cleanClaimed && cleanStaffName && (cleanClaimed === cleanStaffName || cleanStaffName.includes(cleanClaimed) || cleanClaimed.includes(cleanStaffName))) ||
      (assigned && (staffNameLower.includes(assigned) || assigned.includes(staffNameLower))) ||
      (claimed && (staffNameLower.includes(claimed) || claimed.includes(staffNameLower)))
    ));

    const matchesUid = Boolean(staffUid && (
      r.assignedToStaff === staffUid ||
      r.claimedByUid === staffUid ||
      r.staffId === staffUid
    ));

    return matchesName || matchesUid;
  });
};

/**
 * Calculate staff performance across 4 weekly windows within a selected month.
 * Understands weekly behavioral trajectory, distinguishes temporary spikes from chronic neglect,
 * and produces Option B warning evaluations.
 *
 * @param {object} staff - Staff member object
 * @param {array} allRequests - All tickets in the system/department
 * @param {Date} selectedMonthDate - Date object representing the month (defaults to current month)
 * @param {array} allFeedbacks - Optional student feedbacks array
 * @returns {object} - 4-week monthly breakdown and behavioral trajectory
 */
export const calculateStaffMonthlyBehavior = (
  staff,
  allRequests = [],
  selectedMonthDate = new Date(),
  allFeedbacks = []
) => {
  if (!staff) return null;

  const targetDate = selectedMonthDate instanceof Date ? selectedMonthDate : new Date(selectedMonthDate);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
  const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Match requests belonging to this staff member
  const staffRequests = filterStaffTickets(allRequests, staff);

  // Define 4 chronological weekly intervals
  const weekDefinitions = [
    { weekNum: 1, startDay: 1, endDay: 7, label: 'Week 1 (Days 1–7)' },
    { weekNum: 2, startDay: 8, endDay: 14, label: 'Week 2 (Days 8–14)' },
    { weekNum: 3, startDay: 15, endDay: 21, label: 'Week 3 (Days 15–21)' },
    { weekNum: 4, startDay: 22, endDay: totalDaysInMonth, label: `Week 4 (Days 22–${totalDaysInMonth})` }
  ];

  let cumulativeRollover = 0;

  const weeklyBreakdown = weekDefinitions.map(def => {
    const wStart = new Date(year, month, def.startDay, 0, 0, 0, 0);
    const wEnd = new Date(year, month, def.endDay, 23, 59, 59, 999);

    // Tickets assigned/created in this weekly window
    const assignedInWeek = staffRequests.filter(r => {
      const cDate = parseDateSafe(r.createdAt);
      return cDate && cDate >= wStart && cDate <= wEnd;
    });

    // Tickets resolved in this weekly window
    const resolvedInWeek = staffRequests.filter(r => {
      if ((r.status || '').toLowerCase() !== 'resolved') return false;
      const rDate = parseDateSafe(r.resolvedAt) || parseDateSafe(r.updatedAt);
      return rDate && rDate >= wStart && rDate <= wEnd;
    });

    // Rollover tickets: tickets created before this week that were NOT resolved before this week started
    const rolloverFromPrior = staffRequests.filter(r => {
      const cDate = parseDateSafe(r.createdAt);
      if (!cDate || cDate >= wStart) return false;
      if (r.status === 'Cancelled' || r.status === 'Rejected') return false;
      if ((r.status || '').toLowerCase() === 'resolved') {
        const rDate = parseDateSafe(r.resolvedAt) || parseDateSafe(r.updatedAt);
        return rDate && rDate >= wStart; // resolved during or after this week
      }
      return true; // Still open
    }).length;

    // Turnaround speed for tickets resolved this week (in hours)
    let totalResolutionHours = 0;
    let resolvedWithDuration = 0;
    resolvedInWeek.forEach(r => {
      const cDate = parseDateSafe(r.createdAt);
      const rDate = parseDateSafe(r.resolvedAt) || parseDateSafe(r.updatedAt);
      if (cDate && rDate) {
        const diffMs = rDate.getTime() - cDate.getTime();
        if (diffMs > 0) {
          totalResolutionHours += diffMs / (1000 * 60 * 60);
          resolvedWithDuration++;
        }
      }
    });
    const avgResolutionHours = resolvedWithDuration > 0
      ? Math.round((totalResolutionHours / resolvedWithDuration) * 10) / 10
      : 0;

    // Pickup Latency: time from creation until set to In Process or Resolved (in hours)
    let totalPickupHours = 0;
    let pickupCount = 0;
    assignedInWeek.forEach(r => {
      const cDate = parseDateSafe(r.createdAt);
      const pDate = parseDateSafe(r.inProgressAt) || parseDateSafe(r.claimedAt) || parseDateSafe(r.updatedAt);
      if (cDate && pDate) {
        const diffMs = pDate.getTime() - cDate.getTime();
        if (diffMs > 0) {
          totalPickupHours += diffMs / (1000 * 60 * 60);
          pickupCount++;
        }
      }
    });
    const avgPickupLatencyHours = pickupCount > 0
      ? Math.round((totalPickupHours / pickupCount) * 10) / 10
      : (avgResolutionHours > 0 ? Math.round(avgResolutionHours * 0.3 * 10) / 10 : 0);

    // Clearance rate: percentage of available work cleared
    const totalWorkloadForWeek = assignedInWeek.length + rolloverFromPrior;
    const clearanceRate = totalWorkloadForWeek > 0
      ? Math.round((resolvedInWeek.length / totalWorkloadForWeek) * 100)
      : 100;

    // Tickets remaining unresolved at end of this week
    const unresolvedAtEnd = Math.max(0, totalWorkloadForWeek - resolvedInWeek.length);
    cumulativeRollover = unresolvedAtEnd;

    // Student satisfaction for tickets resolved this week
    const weeklyFeedbacks = allFeedbacks.filter(f => {
      const fDate = parseDateSafe(f.createdAt);
      return fDate && fDate >= wStart && fDate <= wEnd;
    });
    const avgSatisfaction = weeklyFeedbacks.length > 0
      ? Math.round((weeklyFeedbacks.reduce((sum, f) => sum + (f.overallRating || 0), 0) / weeklyFeedbacks.length) * 10) / 10
      : null;

    // Week is evaluated as good if clearance >= 75% or 0 pending rollover
    const isGoodWeek = (totalWorkloadForWeek === 0) || (clearanceRate >= 75 && unresolvedAtEnd <= 2);

    return {
      weekNum: def.weekNum,
      label: def.label,
      startDay: def.startDay,
      endDay: def.endDay,
      assigned: assignedInWeek.length,
      resolved: resolvedInWeek.length,
      rollover: rolloverFromPrior,
      totalWorkload: totalWorkloadForWeek,
      unresolvedAtEnd,
      clearanceRate,
      avgResolutionHours,
      avgPickupLatencyHours,
      avgSatisfaction,
      isGoodWeek
    };
  });

  // Monthly totals
  const totalAssigned = weeklyBreakdown.reduce((sum, w) => sum + w.assigned, 0);
  const totalResolved = weeklyBreakdown.reduce((sum, w) => sum + w.resolved, 0);
  const avgMonthlyResolutionHours = weeklyBreakdown.filter(w => w.avgResolutionHours > 0).length > 0
    ? Math.round((weeklyBreakdown.reduce((sum, w) => sum + w.avgResolutionHours, 0) / Math.max(1, weeklyBreakdown.filter(w => w.avgResolutionHours > 0).length)) * 10) / 10
    : 0;
  const overallClearanceRate = (totalAssigned + (weeklyBreakdown[0]?.rollover || 0)) > 0
    ? Math.round((totalResolved / (totalAssigned + (weeklyBreakdown[0]?.rollover || 0))) * 100)
    : 100;
  const netRolloverNextMonth = weeklyBreakdown[3]?.unresolvedAtEnd || 0;

  // Trajectory Analysis: Multi-week pattern detection
  const avgWeeklyIntake = totalAssigned / 4;
  const volumeSpikes = weeklyBreakdown.map(w => ({
    weekNum: w.weekNum,
    isSpike: avgWeeklyIntake > 3 && w.assigned >= avgWeeklyIntake * 1.75
  }));
  const hasVolumeSpikes = volumeSpikes.some(v => v.isSpike);

  // Clearance rate trend across weeks (W1 -> W2 -> W3 -> W4)
  const clearanceTrend = weeklyBreakdown.map(w => w.clearanceRate);
  const isDecliningClearance = (clearanceTrend[0] > clearanceTrend[1] && clearanceTrend[1] > clearanceTrend[2]) ||
                              (clearanceTrend[1] > clearanceTrend[2] && clearanceTrend[2] > clearanceTrend[3]);
  const isEndRush = clearanceTrend[3] > clearanceTrend[2] && clearanceTrend[3] > clearanceTrend[1] && weeklyBreakdown[3].resolved >= totalResolved * 0.4;
  const isFrontLoader = (weeklyBreakdown[0].resolved + weeklyBreakdown[1].resolved) >= totalResolved * 0.7 && totalResolved > 5;
  const isChronicRollover = weeklyBreakdown[1].rollover > 0 && weeklyBreakdown[2].rollover > weeklyBreakdown[1].rollover && weeklyBreakdown[3].rollover >= weeklyBreakdown[2].rollover;

  // Determine Monthly Behavior Archetype
  let archetype = 'Steady Pacer';
  let archetypeTag = 'steady';
  let archetypeDescription = 'Maintains balanced resolution and queue clearance consistently across all 4 weeks.';

  if (isEndRush && !hasVolumeSpikes) {
    archetype = 'End-of-Month Backlogger';
    archetypeTag = 'backlogger';
    archetypeDescription = 'Accumulates backlog during Weeks 1–3 and clears tickets in a concentrated sprint during Week 4.';
  } else if (isFrontLoader && clearanceTrend[3] < 50) {
    archetype = 'Front-Loader / Late Fatigue';
    archetypeTag = 'fatigue';
    archetypeDescription = 'High throughput in early weeks, but slows down significantly in Weeks 3–4 with rising rollovers.';
  } else if (hasVolumeSpikes && overallClearanceRate >= 70) {
    archetype = 'High-Volume Shock Absorber';
    archetypeTag = 'resilient';
    archetypeDescription = 'Absorbed significant volume surges while maintaining solid clearance through subsequent recovery.';
  } else if (isChronicRollover && overallClearanceRate < 50) {
    archetype = 'Chronic Bottleneck';
    archetypeTag = 'bottleneck';
    archetypeDescription = 'Backlog compounded week-after-week across the month without volume justification.';
  } else if (overallClearanceRate >= 90) {
    archetype = 'High-Efficiency Pacer';
    archetypeTag = 'efficient';
    archetypeDescription = 'Consistently clears tickets with high velocity and minimal rollovers throughout the month.';
  }

  // Warning Determination (Identical to Superadmin baseline)
  let warningStatus = 'good';
  let warningLabel = 'Good Standing';
  let warningShortLabel = 'Good Standing';
  let warningColor = '#16a34a';
  let warningReason = 'Performance and clearance remained within healthy operational parameters throughout the month.';

  if (totalAssigned > 0 || netRolloverNextMonth > 0) {
    if (isChronicRollover && overallClearanceRate < 20 && !hasVolumeSpikes && netRolloverNextMonth >= 15) {
      warningStatus = 'warning_4_termination';
      warningLabel = '4th Warning: Notice for Termination';
      warningShortLabel = '4th Warning: Termination';
      warningColor = '#991b1b';
      warningReason = `Critical operational breakdown: Persistent inaction across all 4 weeks with minimal resolution (${overallClearanceRate}% clearance) and severe unaddressed rollover debt (${netRolloverNextMonth} tickets carried over).`;
    } else if (isChronicRollover && overallClearanceRate < 40 && !hasVolumeSpikes && netRolloverNextMonth >= 10) {
      warningStatus = 'warning_3_suspension';
      warningLabel = '3rd Warning: Notice of Suspension';
      warningShortLabel = '3rd Warning: Suspension';
      warningColor = '#dc2626';
      warningReason = `Severe chronic backlog failure: Tickets compounded week-over-week without recovery, ending with ${netRolloverNextMonth} unresolved rollovers and low overall clearance (${overallClearanceRate}%).`;
    } else if (isChronicRollover || (overallClearanceRate < 60 && !hasVolumeSpikes && netRolloverNextMonth >= 6)) {
      warningStatus = 'warning_2_verbal';
      warningLabel = '2nd Warning: Verbal Reprimand';
      warningShortLabel = '2nd Warning: Verbal Reprimand';
      warningColor = '#ea580c';
      warningReason = `Persistent multi-week backlog accumulation: Clearance dropped across consecutive weeks, leaving ${netRolloverNextMonth} unresolved rollovers carried into next month under standard workload.`;
    } else if (isDecliningClearance || (weeklyBreakdown[3].avgPickupLatencyHours > 24 && !hasVolumeSpikes) || (overallClearanceRate < 75 && netRolloverNextMonth > 3)) {
      warningStatus = 'warning_1_nte';
      warningLabel = '1st Warning: Notice to Explain (NTE)';
      warningShortLabel = '1st Warning: NTE';
      warningColor = '#d97706';
      warningReason = `Emerging deceleration observed in latter half of month (Weeks 3–4): Resolution velocity slowed with notable queue latency, warranting an initial explanation of delays.`;
    }
  }

  // Next-Month Predictive Forecast
  const safeWeeklyCapacity = Math.max(5, Math.round(totalResolved / 4) + (overallClearanceRate >= 80 ? 4 : -2));
  let predictedBottleneck = 'Normal operations expected. Queue clearance is projected to remain stable.';
  let projectedRisk = 'Low';

  if (netRolloverNextMonth >= 10) {
    projectedRisk = 'High';
    predictedBottleneck = `Will carry over ${netRolloverNextMonth} unresolved tickets into Week 1 of next month, creating immediate SLA pressure unless rebalanced.`;
  } else if (netRolloverNextMonth >= 5) {
    projectedRisk = 'Moderate';
    predictedBottleneck = `Moderate rollover of ${netRolloverNextMonth} tickets into next month requires prioritization in Week 1 to prevent backlog compounding.`;
  }

  return {
    staff: {
      id: staff.id || staff.uid,
      name: staff.name || staff.fullName || 'Staff Member',
      department: staff.office || staff.department || staff.officeId || 'General',
      email: staff.email || '',
      role: staff.role || 'staff'
    },
    month: {
      year,
      monthIndex: month,
      name: targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalDays: totalDaysInMonth
    },
    weeklyBreakdown,
    totals: {
      totalAssigned,
      totalResolved,
      overallClearanceRate,
      avgMonthlyResolutionHours,
      netRolloverNextMonth
    },
    trajectory: {
      hasVolumeSpikes,
      volumeSpikes,
      isDecliningClearance,
      isEndRush,
      isFrontLoader,
      isChronicRollover
    },
    archetype: {
      title: archetype,
      tag: archetypeTag,
      description: archetypeDescription
    },
    warningEvaluation: {
      status: warningStatus,
      statusLabel: warningLabel,
      shortLabel: warningShortLabel,
      color: warningColor,
      reasoning: warningReason
    },
    nextMonthPrediction: {
      safeWeeklyCapacity,
      projectedRisk,
      predictedBottleneck
    }
  };
};

/**
 * Calculates whether a staff member has a consistent streak of good performance
 * for 4 weeks (or a full month).
 * Synchronized with Superadmin Performance Monitor data and AI metrics.
 *
 * @param {object} staff - Staff member data
 * @param {array} allRequests - All tickets for the office/department
 * @param {Date} referenceDate - Current evaluation date
 * @param {array} allFeedbacks - Optional feedbacks
 * @returns {object} - Streak evaluation and commendation metadata
 */
export const calculateStaff4WeekStreak = (
  staff,
  allRequests = [],
  referenceDate = new Date(),
  allFeedbacks = []
) => {
  if (!staff) return { hasGoodStreak: false, streakWeeks: 0 };

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  // 1. Calculate calendar month 4-week behavior
  const monthlyBehavior = calculateStaffMonthlyBehavior(staff, allRequests, now, allFeedbacks);
  if (!monthlyBehavior) return { hasGoodStreak: false, streakWeeks: 0 };

  const staffRequests = filterStaffTickets(allRequests, staff);

  // Count active overdue tickets right now
  const activeTickets = staffRequests.filter(r => {
    const s = (r.status || '').toLowerCase();
    return s !== 'resolved' && s !== 'cancelled' && s !== 'rejected';
  });

  const overdueTickets = activeTickets.filter(r => {
    const deadline = r.etc ? new Date(r.etc) : null;
    if (deadline && !isNaN(deadline.getTime())) {
      deadline.setHours(23, 59, 59, 999);
      return deadline < now;
    }
    const created = parseDateSafe(r.createdAt);
    if (created) {
      return (now.getTime() - created.getTime()) > (72 * 60 * 60 * 1000);
    }
    return false;
  });

  const overdueCount = overdueTickets.length;

  // 2. Rolling 4-week window calculation (last 28 days)
  // Ensures streak detection works accurately at any day of the month
  const rollingWeeks = [];
  for (let i = 3; i >= 0; i--) {
    const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekNum = 4 - i;

    const assigned = staffRequests.filter(r => {
      const c = parseDateSafe(r.createdAt);
      return c && c >= start && c <= end;
    });

    const resolved = staffRequests.filter(r => {
      if ((r.status || '').toLowerCase() !== 'resolved') return false;
      const res = parseDateSafe(r.resolvedAt) || parseDateSafe(r.updatedAt);
      return res && res >= start && res <= end;
    });

    const totalWorkload = assigned.length;
    const clearanceRate = totalWorkload > 0
      ? Math.round((resolved.length / totalWorkload) * 100)
      : (resolved.length > 0 ? 100 : 100);

    const isGood = clearanceRate >= 75 || (totalWorkload === 0 && overdueCount === 0);

    rollingWeeks.push({
      weekNum,
      label: `Week ${weekNum} (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      assigned: assigned.length,
      resolved: resolved.length,
      clearanceRate,
      isGood
    });
  }

  // 3. Evaluate streak from monthly breakdown and rolling breakdown
  const calendarWeeks = monthlyBehavior.weeklyBreakdown || [];
  const calendarGoodWeeksCount = calendarWeeks.filter(w => w.isGoodWeek || w.clearanceRate >= 75).length;
  const rollingGoodWeeksCount = rollingWeeks.filter(w => w.isGood).length;

  // Effective streak weeks (max of calendar vs rolling, up to 4)
  const streakWeeks = Math.min(4, Math.max(calendarGoodWeeksCount, rollingGoodWeeksCount));

  // Eligibility criteria for "Keep up the good work!" 4-week streak:
  // - Warning evaluation is 'good' (no NTE, verbal reprimand, suspension, termination)
  // - Zero overdue tickets currently in queue
  // - Overall clearance rate is healthy (>= 75%)
  // - At least 4 consecutive/consistent weeks meeting target standards
  const isHealthyStanding = monthlyBehavior.warningEvaluation?.status === 'good';
  const hasZeroOverdue = overdueCount === 0;
  const hasHighClearance = (monthlyBehavior.totals?.overallClearanceRate ?? 100) >= 75;

  const hasGoodStreak = Boolean(
    isHealthyStanding &&
    hasZeroOverdue &&
    hasHighClearance &&
    streakWeeks >= 4
  );

  const score = monthlyBehavior.totals?.overallClearanceRate ?? 100;
  const totalResolved = monthlyBehavior.totals?.totalResolved ?? 0;
  const totalAssigned = monthlyBehavior.totals?.totalAssigned ?? 0;

  // Personalized commendation connected to Superadmin AI analytics
  const commendationMessage = hasGoodStreak
    ? `Keep up the good work! You have maintained an exceptional 4-week performance streak across ${monthlyBehavior.month?.name || 'this month'} with a ${score}% clearance score. Superadmin Performance & Behavioral Analytics confirms your steady throughput, prompt response times, and zero overdue tickets.`
    : `Consistently handling requests: ${totalResolved} completed with ${score}% clearance score.`;

  return {
    hasGoodStreak,
    streakWeeks,
    score,
    overdueCount,
    totalAssigned,
    totalResolved,
    monthlyBehavior,
    rollingWeeks,
    weeklyBreakdown: calendarWeeks.length === 4 ? calendarWeeks : rollingWeeks,
    archetype: monthlyBehavior.archetype,
    nextMonthPrediction: monthlyBehavior.nextMonthPrediction,
    commendationMessage,
    warningEvaluation: monthlyBehavior.warningEvaluation
  };
};
