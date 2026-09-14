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
    underloaded.forEach(lightStaff => {
      const ticketsToReassign = Math.floor((heavyStaff.activeTickets - 12) / 2);
      
      if (ticketsToReassign > 0) {
        recommendations.push({
          type: 'reassignment',
          priority: 'high',
          from: heavyStaff.name,
          to: lightStaff.name,
          ticketCount: ticketsToReassign,
          reason: `${heavyStaff.name} is overloaded with ${heavyStaff.activeTickets} tickets. ${lightStaff.name} has capacity with only ${lightStaff.activeTickets} tickets.`
        });
      }
    });
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
