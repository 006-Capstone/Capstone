/**
 * AI-Powered Performance Analytics & Risk Scoring System
 * Calculates real-time staff performance metrics and predicts potential bottlenecks
 */

/**
 * Define SLA (Service Level Agreement) thresholds by urgency
 * Hours until a ticket is considered overdue
 */
const SLA_THRESHOLDS = {
  Urgent: 24,      // 24 hours
  High: 48,        // 48 hours  
  Standard: 72,    // 72 hours (3 days)
  Low: 168         // 168 hours (7 days)
};

/**
 * Calculate if a ticket is overdue based on its creation time and urgency
 * @param {object} ticket - Ticket data with createdAt and urgency
 * @returns {object} - { isOverdue: boolean, hoursOverdue: number }
 */
export const calculateTicketOverdue = (ticket) => {
  if (!ticket.createdAt) {
    return { isOverdue: false, hoursOverdue: 0 };
  }

  const createdAt = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
  const now = new Date();
  const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
  
  const urgency = ticket.urgency || 'Standard';
  const slaThreshold = SLA_THRESHOLDS[urgency] || SLA_THRESHOLDS.Standard;
  
  const hoursOverdue = hoursElapsed - slaThreshold;
  const isOverdue = hoursOverdue > 0;
  
  return { isOverdue, hoursOverdue: Math.max(0, hoursOverdue) };
};

/**
 * Calculate if a ticket is at risk of becoming overdue in next 24-48 hours
 * @param {object} ticket - Ticket data
 * @returns {object} - { atRisk: boolean, hoursUntilOverdue: number, riskLevel: string }
 */
export const calculateTicketRisk = (ticket) => {
  if (!ticket.createdAt || ticket.status === 'Resolved' || ticket.status === 'Cancelled') {
    return { atRisk: false, hoursUntilOverdue: 0, riskLevel: 'none' };
  }

  const createdAt = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt);
  const now = new Date();
  const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);
  
  const urgency = ticket.urgency || 'Standard';
  const slaThreshold = SLA_THRESHOLDS[urgency] || SLA_THRESHOLDS.Standard;
  
  const hoursUntilOverdue = slaThreshold - hoursElapsed;
  
  let riskLevel = 'none';
  let atRisk = false;
  
  if (hoursUntilOverdue <= 0) {
    riskLevel = 'overdue';
    atRisk = true;
  } else if (hoursUntilOverdue <= 24) {
    riskLevel = 'critical'; // Less than 24 hours left
    atRisk = true;
  } else if (hoursUntilOverdue <= 48) {
    riskLevel = 'high'; // Less than 48 hours left
    atRisk = true;
  } else if (hoursUntilOverdue <= 72) {
    riskLevel = 'moderate'; // Less than 72 hours left
    atRisk = false;
  }
  
  return { atRisk, hoursUntilOverdue: Math.max(0, hoursUntilOverdue), riskLevel };
};

/**
 * Calculate staff member's risk score (0-100%)
 * Higher score = higher risk of performance issues
 * @param {object} staffData - Staff member's ticket data
 * @returns {number} - Risk score 0-100
 */
export const calculateStaffRiskScore = (staffData) => {
  const { tickets = [], activeTickets = 0, overdueTickets = 0, avgResolutionTime = 0 } = staffData;
  
  if (tickets.length === 0) return 0;
  
  // Factor 1: Overdue Rate (40% weight)
  const overdueRate = activeTickets > 0 ? (overdueTickets / activeTickets) * 100 : 0;
  const overdueScore = Math.min(overdueRate * 0.4, 40);
  
  // Factor 2: Workload (30% weight)
  const workloadThreshold = 15; // Optimal max tickets per staff
  const workloadScore = activeTickets > workloadThreshold 
    ? Math.min(((activeTickets - workloadThreshold) / workloadThreshold) * 30, 30)
    : 0;
  
  // Factor 3: Tickets at Risk (20% weight)
  const atRiskTickets = tickets.filter(t => {
    const { atRisk } = calculateTicketRisk(t);
    return atRisk;
  }).length;
  const riskRate = activeTickets > 0 ? (atRiskTickets / activeTickets) * 100 : 0;
  const riskScore = Math.min(riskRate * 0.2, 20);
  
  // Factor 4: Resolution Speed (10% weight)
  // If avg resolution time > 48 hours, add penalty
  const speedScore = avgResolutionTime > 48 ? Math.min((avgResolutionTime - 48) / 48 * 10, 10) : 0;
  
  const totalRiskScore = overdueScore + workloadScore + riskScore + speedScore;
  
  return Math.min(Math.round(totalRiskScore), 100);
};

/**
 * Calculate 30-day rolling window performance
 * @param {array} tickets - All tickets assigned to staff
 * @returns {object} - Performance metrics
 */
export const calculate30DayPerformance = (tickets) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentTickets = tickets.filter(t => {
    const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return createdAt >= thirtyDaysAgo;
  });
  
  if (recentTickets.length === 0) {
    return { overdueRate: 0, onTimeRate: 100, totalTickets: 0 };
  }
  
  const overdueCount = recentTickets.filter(t => {
    const { isOverdue } = calculateTicketOverdue(t);
    return isOverdue && t.status !== 'Resolved';
  }).length;
  
  const overdueRate = (overdueCount / recentTickets.length) * 100;
  const onTimeRate = 100 - overdueRate;
  
  return {
    overdueRate: Math.round(overdueRate),
    onTimeRate: Math.round(onTimeRate),
    totalTickets: recentTickets.length
  };
};

/**
 * Calculate staff member's overall Efficiency Score (0-100)
 * Evaluates SLA compliance, queue health, workload balance, and resolution volume.
 * @param {object} staff - Staff member object
 * @param {array} allRequests - All tickets in the system
 * @returns {object} - Efficiency score, tier, and breakdown metrics
 */
export const calculateStaffEfficiencyScore = (staff, allRequests = []) => {
  if (!staff) {
    return {
      score: 100,
      tier: 'excellent',
      tierLabel: 'Excellent',
      tierColor: '#059669',
      activeCount: 0,
      overdueCount: 0,
      resolvedCount: 0,
      totalCount: 0,
      onTimeRate: 100
    };
  }

  const staffNameLower = (staff.name || staff.fullName || '').trim().toLowerCase();
  const staffUid = staff.uid || staff.id || '';

  const staffRequests = allRequests.filter(r => {
    const assigned = (r.assignedTo || '').trim().toLowerCase();
    const claimed = (r.claimedBy || '').trim().toLowerCase();
    const assignedStaff = (r.assignedToStaff || '').trim().toLowerCase();
    const matchesName = Boolean(staffNameLower && (assigned === staffNameLower || claimed === staffNameLower || assignedStaff === staffNameLower));
    const matchesUid = Boolean(staffUid && (r.assignedToStaff === staffUid || r.claimedByUid === staffUid));
    return matchesName || matchesUid;
  });

  const activeTickets = staffRequests.filter(r => r.status !== 'Resolved' && r.status !== 'Cancelled');
  const activeCount = activeTickets.length;

  const resolvedTickets = staffRequests.filter(r => r.status === 'Resolved');
  const resolvedCount = resolvedTickets.length;

  const overdueTickets = activeTickets.filter(r => {
    const { isOverdue } = calculateTicketOverdue(r);
    return isOverdue;
  });
  const overdueCount = overdueTickets.length;

  // On-time rate calculation
  let onTimeCount = 0;
  resolvedTickets.forEach(t => {
    const { isOverdue } = calculateTicketOverdue(t);
    if (!isOverdue) onTimeCount++;
  });

  const onTimeRate = resolvedCount > 0 
    ? Math.round((onTimeCount / resolvedCount) * 100) 
    : (overdueCount === 0 ? 100 : 70);

  // 1. SLA On-Time compliance: up to 50 pts
  const slaScore = Math.round((onTimeRate / 100) * 50);

  // 2. Queue & Overdue Health: up to 30 pts
  let queueScore = 30;
  if (activeCount > 0 && overdueCount > 0) {
    const overdueRatio = overdueCount / activeCount;
    const penalty = Math.min(30, Math.round(overdueRatio * 20) + (overdueCount * 4));
    queueScore = Math.max(0, 30 - penalty);
  } else if (activeCount === 0 && overdueCount === 0) {
    queueScore = 30;
  }

  // 3. Workload Balance: up to 20 pts (optimal <= 15 tickets)
  let workloadScore = 20;
  if (activeCount > 15) {
    workloadScore = Math.max(5, 20 - Math.min(15, (activeCount - 15) * 2));
  }

  // 4. Resolution Productivity Bonus: up to 10 pts
  const volumeBonus = Math.min(10, resolvedCount * 2);

  const score = Math.max(0, Math.min(100, slaScore + queueScore + workloadScore + volumeBonus));

  // Graded Tier categorization
  let tier = 'good';
  let tierLabel = 'Good Standing';
  let tierColor = '#16a34a';

  if (score >= 90) {
    tier = 'excellent';
    tierLabel = 'Excellent';
    tierColor = '#059669';
  } else if (score >= 75) {
    tier = 'good';
    tierLabel = 'Good Standing';
    tierColor = '#16a34a';
  } else if (score >= 60) {
    tier = 'advisory';
    tierLabel = 'Needs Focus';
    tierColor = '#d97706';
  } else {
    tier = 'critical';
    tierLabel = 'Critical Attention';
    tierColor = '#dc2626';
  }

  return {
    score,
    tier,
    tierLabel,
    tierColor,
    activeCount,
    overdueCount,
    resolvedCount,
    totalCount: staffRequests.length,
    onTimeRate
  };
};

/**
 * Determine warning stage based on performance metrics
 * @param {object} performanceData - Staff performance data
 * @returns {object} - { stage: number, stageName: string, description: string }
 */
export const determineWarningStage = (performanceData) => {
  const { overdueRate, consecutivePoorDays = 0 } = performanceData;
  
  // Stage 0: Good Standing
  if (overdueRate < 15) {
    return {
      stage: 0,
      stageName: 'Good Standing',
      description: 'Performance within acceptable range',
      color: 'green'
    };
  }
  
  // Stage 1: Gentle System Nudge (3+ overdue in a week)
  if (overdueRate >= 15 && overdueRate < 25 && consecutivePoorDays < 30) {
    return {
      stage: 1,
      stageName: 'System Nudge',
      description: 'Gentle reminder to clear pending tasks',
      color: 'yellow'
    };
  }
  
  // Stage 2: Verbal Reprimand Warning (>25% overdue for 30 days)
  if (overdueRate >= 25 && consecutivePoorDays >= 30 && consecutivePoorDays < 60) {
    return {
      stage: 2,
      stageName: 'Verbal Warning',
      description: 'Informal check-in recommended',
      color: 'orange'
    };
  }
  
  // Stage 3: Notice to Explain (>25% overdue for 60 days)
  if (overdueRate >= 25 && consecutivePoorDays >= 60 && consecutivePoorDays < 90) {
    return {
      stage: 3,
      stageName: 'Notice to Explain (NTE)',
      description: 'Formal written notice required',
      color: 'red'
    };
  }
  
  // Stage 4: Escalation to HR (>25% overdue for 90+ days)
  if (overdueRate >= 25 && consecutivePoorDays >= 90) {
    return {
      stage: 4,
      stageName: 'HR Escalation',
      description: 'Formal disciplinary review required',
      color: 'darkred'
    };
  }
  
  return {
    stage: 0,
    stageName: 'Good Standing',
    description: 'Performance within acceptable range',
    color: 'green'
  };
};

/**
 * Analyze department health based on all staff performance
 * @param {array} departmentTickets - All tickets in the department
 * @param {array} staffMembers - All staff in the department
 * @returns {object} - Department health metrics
 */
export const analyzeDepartmentHealth = (departmentTickets, staffMembers) => {
  if (departmentTickets.length === 0) {
    return {
      status: 'healthy',
      color: 'green',
      activeTickets: 0,
      overdueTickets: 0,
      atRiskTickets: 0,
      onTimePercentage: 100
    };
  }
  
  const activeTickets = departmentTickets.filter(t => 
    t.status !== 'Resolved' && t.status !== 'Cancelled'
  ).length;
  
  const overdueTickets = departmentTickets.filter(t => {
    const { isOverdue } = calculateTicketOverdue(t);
    return isOverdue && t.status !== 'Resolved';
  }).length;
  
  const atRiskTickets = departmentTickets.filter(t => {
    const { atRisk } = calculateTicketRisk(t);
    return atRisk;
  }).length;
  
  const onTimePercentage = activeTickets > 0 
    ? Math.round(((activeTickets - overdueTickets) / activeTickets) * 100)
    : 100;
  
  let status = 'healthy';
  let color = 'green';
  
  if (onTimePercentage < 50) {
    status = 'critical';
    color = 'red';
  } else if (onTimePercentage < 75) {
    status = 'at-risk';
    color = 'orange';
  } else if (onTimePercentage < 90) {
    status = 'moderate';
    color = 'yellow';
  }
  
  return {
    status,
    color,
    activeTickets,
    overdueTickets,
    atRiskTickets,
    onTimePercentage
  };
};

/**
 * Generate smart workload recommendations
 * @param {array} staffWorkloads - Array of staff with their workloads
 * @returns {array} - Array of recommendation objects
 */
export const generateWorkloadRecommendations = (staffWorkloads) => {
  const recommendations = [];
  
  // Find overloaded and underloaded staff
  const overloaded = staffWorkloads.filter(s => s.activeTickets > 15);
  const underloaded = staffWorkloads.filter(s => s.activeTickets < 8);
  
  overloaded.forEach(heavyStaff => {
    const heavyDept = (heavyStaff.department || heavyStaff.office || '').toLowerCase().replace(/\s+(office|department)$/i, '').trim();

    // STRICT: Only reassign to colleagues in the EXACT same department
    const sameDeptLightStaff = underloaded.filter(lightStaff => {
      const lightDept = (lightStaff.department || lightStaff.office || '').toLowerCase().replace(/\s+(office|department)$/i, '').trim();
      return heavyDept && lightDept && heavyDept === lightDept;
    });

    if (sameDeptLightStaff.length > 0) {
      sameDeptLightStaff.forEach(lightStaff => {
        const ticketsToReassign = Math.floor((heavyStaff.activeTickets - 12) / 2);
        
        if (ticketsToReassign > 0) {
          recommendations.push({
            type: 'reassignment',
            priority: 'high',
            from: heavyStaff.name,
            to: lightStaff.name,
            ticketCount: ticketsToReassign,
            reason: `${heavyStaff.name} is overloaded with ${heavyStaff.activeTickets} tickets. ${lightStaff.name} has capacity with only ${lightStaff.activeTickets} tickets in the same department.`
          });
        }
      });
    } else {
      // Sole or overloaded department staff without peers in that department
      // DO NOT pair with someone from another office (e.g. Finance staff cannot take Registrar tickets)
      const deptName = heavyStaff.department || heavyStaff.office || 'Office';
      recommendations.push({
        type: 'hire',
        priority: 'high',
        department: deptName,
        affectedStaff: [deptName],
        title: `Staffing Support for ${deptName}`,
        reason: `${heavyStaff.name} is handling ${heavyStaff.activeTickets} tickets as the primary staff member in ${deptName}. Departmental rules prohibit cross-department ticket transfer.`
      });
    }
  });
  
  return recommendations;
};

/**
 * Calculate 7-day vs 30-day performance comparison for trend analysis
 * @param {array} tickets - All tickets assigned to staff
 * @returns {object} - Trend data with week-over-week and month-over-month changes
 */
export const calculatePerformanceTrends = (tickets) => {
  const now = new Date();
  
  // 7-day window
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // 14-day window (for comparison)
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  // 30-day window
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // 60-day window (for comparison)
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  // Last 7 days
  const last7DaysTickets = tickets.filter(t => {
    const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return createdAt >= sevenDaysAgo;
  });
  
  // Previous 7 days (8-14 days ago)
  const previous7DaysTickets = tickets.filter(t => {
    const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return createdAt >= fourteenDaysAgo && createdAt < sevenDaysAgo;
  });
  
  // Last 30 days
  const last30DaysTickets = tickets.filter(t => {
    const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return createdAt >= thirtyDaysAgo;
  });
  
  // Previous 30 days (31-60 days ago)
  const previous30DaysTickets = tickets.filter(t => {
    const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
  });
  
  // Calculate overdue rates
  const last7DaysOverdue = last7DaysTickets.filter(t => {
    const { isOverdue } = calculateTicketOverdue(t);
    return isOverdue && t.status !== 'Resolved';
  }).length;
  
  const previous7DaysOverdue = previous7DaysTickets.filter(t => {
    const { isOverdue } = calculateTicketOverdue(t);
    return isOverdue && t.status !== 'Resolved';
  }).length;
  
  const last30DaysOverdue = last30DaysTickets.filter(t => {
    const { isOverdue } = calculateTicketOverdue(t);
    return isOverdue && t.status !== 'Resolved';
  }).length;
  
  const previous30DaysOverdue = previous30DaysTickets.filter(t => {
    const { isOverdue } = calculateTicketOverdue(t);
    return isOverdue && t.status !== 'Resolved';
  }).length;
  
  // Calculate rates
  const last7DaysOverdueRate = last7DaysTickets.length > 0 
    ? (last7DaysOverdue / last7DaysTickets.length) * 100 
    : 0;
  
  const previous7DaysOverdueRate = previous7DaysTickets.length > 0 
    ? (previous7DaysOverdue / previous7DaysTickets.length) * 100 
    : 0;
  
  const last30DaysOverdueRate = last30DaysTickets.length > 0 
    ? (last30DaysOverdue / last30DaysTickets.length) * 100 
    : 0;
  
  const previous30DaysOverdueRate = previous30DaysTickets.length > 0 
    ? (previous30DaysOverdue / previous30DaysTickets.length) * 100 
    : 0;
  
  // Calculate changes
  const weekOverWeekChange = last7DaysOverdueRate - previous7DaysOverdueRate;
  const monthOverMonthChange = last30DaysOverdueRate - previous30DaysOverdueRate;
  
  // Determine trend direction
  const weekTrend = weekOverWeekChange > 5 ? 'worsening' : weekOverWeekChange < -5 ? 'improving' : 'stable';
  const monthTrend = monthOverMonthChange > 5 ? 'worsening' : monthOverMonthChange < -5 ? 'improving' : 'stable';
  
  return {
    last7Days: {
      totalTickets: last7DaysTickets.length,
      overdueTickets: last7DaysOverdue,
      overdueRate: Math.round(last7DaysOverdueRate),
      resolved: last7DaysTickets.filter(t => t.status === 'Resolved').length
    },
    previous7Days: {
      totalTickets: previous7DaysTickets.length,
      overdueTickets: previous7DaysOverdue,
      overdueRate: Math.round(previous7DaysOverdueRate)
    },
    last30Days: {
      totalTickets: last30DaysTickets.length,
      overdueTickets: last30DaysOverdue,
      overdueRate: Math.round(last30DaysOverdueRate),
      resolved: last30DaysTickets.filter(t => t.status === 'Resolved').length
    },
    previous30Days: {
      totalTickets: previous30DaysTickets.length,
      overdueTickets: previous30DaysOverdue,
      overdueRate: Math.round(previous30DaysOverdueRate)
    },
    weekOverWeekChange: Math.round(weekOverWeekChange),
    monthOverMonthChange: Math.round(monthOverMonthChange),
    weekTrend,
    monthTrend
  };
};

/**
 * Forecast capacity and workload for next 7 days based on historical patterns
 * @param {array} allTickets - All system tickets
 * @param {array} staffMembers - All staff members
 * @returns {object} - Capacity forecast with predictions
 */
export const forecastCapacity = (allTickets, staffMembers) => {
  const now = new Date();
  
  // Analyze ticket creation patterns over last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentTickets = allTickets.filter(t => {
    const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
    return createdAt >= thirtyDaysAgo;
  });
  
  // Calculate daily average ticket creation
  const avgDailyTickets = recentTickets.length / 30;
  
  // Predict tickets for next 7 days
  const predicted7DayTickets = Math.round(avgDailyTickets * 7);
  
  // Calculate current staff capacity
  const totalStaff = staffMembers.length;
  const optimalTicketsPerStaff = 12; // Sweet spot
  const maxCapacity = totalStaff * optimalTicketsPerStaff;
  
  // Current active workload
  const currentActiveTickets = allTickets.filter(t => 
    t.status !== 'Resolved' && t.status !== 'Cancelled'
  ).length;
  
  // Calculate resolution rate (how many tickets get resolved per day)
  const resolved30Days = recentTickets.filter(t => t.status === 'Resolved').length;
  const avgDailyResolutions = resolved30Days / 30;
  const predicted7DayResolutions = Math.round(avgDailyResolutions * 7);
  
  // Net change prediction
  const predictedNetChange = predicted7DayTickets - predicted7DayResolutions;
  const predicted7DayWorkload = currentActiveTickets + predictedNetChange;
  
  // Calculate capacity utilization
  const currentUtilization = (currentActiveTickets / maxCapacity) * 100;
  const predictedUtilization = (predicted7DayWorkload / maxCapacity) * 100;
  
  // Determine capacity status
  let capacityStatus = 'healthy';
  let capacityColor = 'green';
  let warning = null;
  
  if (predictedUtilization > 90) {
    capacityStatus = 'critical';
    capacityColor = 'red';
    warning = 'System will be overloaded. Immediate action required.';
  } else if (predictedUtilization > 75) {
    capacityStatus = 'strained';
    capacityColor = 'orange';
    warning = 'Capacity approaching limit. Consider workload rebalancing.';
  } else if (predictedUtilization > 60) {
    capacityStatus = 'moderate';
    capacityColor = 'yellow';
    warning = 'Workload increasing. Monitor closely.';
  }
  
  // Identify bottleneck risk by department
  const departmentForecasts = {};
  const offices = ['Finance', 'Guidance', 'Library', 'Registrar'];
  
  offices.forEach(office => {
    const deptTickets = recentTickets.filter(t => t.office === office);
    const deptAvgDaily = deptTickets.length / 30;
    const deptPredicted7Day = Math.round(deptAvgDaily * 7);
    
    const deptStaff = staffMembers.filter(s => s.office === office);
    const deptCapacity = deptStaff.length * optimalTicketsPerStaff;
    
    const deptCurrentActive = allTickets.filter(t => 
      t.office === office && t.status !== 'Resolved' && t.status !== 'Cancelled'
    ).length;
    
    const deptResolved = deptTickets.filter(t => t.status === 'Resolved').length;
    const deptAvgResolutions = deptResolved / 30;
    const deptPredicted7DayResolutions = Math.round(deptAvgResolutions * 7);
    
    const deptPredictedWorkload = deptCurrentActive + (deptPredicted7Day - deptPredicted7DayResolutions);
    const deptPredictedUtilization = deptCapacity > 0 ? (deptPredictedWorkload / deptCapacity) * 100 : 0;
    
    departmentForecasts[office] = {
      currentActive: deptCurrentActive,
      predicted7DayIncoming: deptPredicted7Day,
      predicted7DayResolved: deptPredicted7DayResolutions,
      predictedWorkload: deptPredictedWorkload,
      capacity: deptCapacity,
      utilization: Math.round(deptPredictedUtilization),
      status: deptPredictedUtilization > 90 ? 'critical' : 
              deptPredictedUtilization > 75 ? 'strained' : 
              deptPredictedUtilization > 60 ? 'moderate' : 'healthy'
    };
  });
  
  return {
    currentWorkload: currentActiveTickets,
    predictedIncoming7Days: predicted7DayTickets,
    predictedResolved7Days: predicted7DayResolutions,
    predictedNetChange,
    predicted7DayWorkload,
    maxCapacity,
    currentUtilization: Math.round(currentUtilization),
    predictedUtilization: Math.round(predictedUtilization),
    capacityStatus,
    capacityColor,
    warning,
    avgDailyTickets: Math.round(avgDailyTickets * 10) / 10,
    avgDailyResolutions: Math.round(avgDailyResolutions * 10) / 10,
    departmentForecasts
  };
};

/**
 * Helper to safely extract a JS Date from Firestore Timestamp or string/number
 */
const parseDateSafe = (val) => {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Calculate staff performance across 4 weekly windows within a selected month.
 * Understands weekly behavioral trajectory, distinguishes temporary spikes from chronic neglect,
 * and produces Option B warning evaluations.
 *
 * @param {object} staff - Staff member object
 * @param {array} allRequests - All tickets in the system
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
  const staffNameLower = (staff.name || staff.fullName || '').trim().toLowerCase();
  const staffUid = staff.uid || staff.id || '';
  const cleanStaffName = staffNameLower.replace(/\b[a-z]\.\s*/g, '').trim();

  const staffRequests = allRequests.filter(r => {
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
      if (r.status !== 'Resolved') return false;
      const rDate = parseDateSafe(r.resolvedAt) || parseDateSafe(r.updatedAt);
      return rDate && rDate >= wStart && rDate <= wEnd;
    });

    // Rollover tickets: tickets created before this week that were NOT resolved before this week started
    const rolloverFromPrior = staffRequests.filter(r => {
      const cDate = parseDateSafe(r.createdAt);
      if (!cDate || cDate >= wStart) return false;
      if (r.status === 'Cancelled') return false;
      if (r.status === 'Resolved') {
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

    // Pickup Latency: time from creation until set to In Progress or Resolved (in hours)
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
      avgSatisfaction
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

  // Option B Warning Determination (Ground-truth baseline)
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

