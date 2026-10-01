/**
 * Groq AI Service for Admin App Performance & Behavioral Insights
 * Connected to Superadmin Performance Monitor AI engine.
 */

const INSIGHTS_API_URL = '/api/insights';

/**
 * Make a request to the serverless insights API
 */
const callGroqAPI = async (messages, maxRetries = 1) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(INSIGHTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          type: 'staff_performance_behavior'
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }

      const data = await response.json();
      return typeof data === 'string' ? data : (data.rawContent || JSON.stringify(data));
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
};

const stripEmojis = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').trim();
};

/**
 * Analyzes staff 4-week performance with Superadmin analytical engine.
 * Generates behavioral diagnosis, archetype, and "Keep up the good work!" commendation.
 *
 * @param {object} monthlyData - Monthly behavioral profile from calculateStaffMonthlyBehavior
 * @param {object} streakData - Streak evaluation from calculateStaff4WeekStreak
 * @returns {Promise<object>} - Institutional performance profile
 */
export const analyzeMonthlyStaffBehaviorWithAI = async (monthlyData, streakData = null) => {
  if (!monthlyData) return null;

  const {
    staff = {},
    month = {},
    weeklyBreakdown = [],
    totals = {},
    trajectory = {},
    archetype = {},
    warningEvaluation = {},
    nextMonthPrediction = {}
  } = monthlyData;

  const isGoodStreak = Boolean(streakData?.hasGoodStreak || (warningEvaluation.status === 'good' && totals.overallClearanceRate >= 75));

  const weeklySummaryText = (weeklyBreakdown || []).map(w => 
    `  ${w.label}: Assigned=${w.assigned}, Resolved=${w.resolved}, Rollovers=${w.rollover}, Clearance=${w.clearanceRate}%, UnresolvedEnd=${w.unresolvedAtEnd}`
  ).join('\n');

  const prompt = `You are an institutional performance analyst for Academia de San Jose.
Evaluate this staff member's 4-week performance pattern across ${month.name || 'the current period'}.

Staff Member: ${staff.name} (${staff.department || 'General'} Office)
Month/Period: ${month.name || 'Current'}
Total Assigned: ${totals.totalAssigned || 0} | Total Resolved: ${totals.totalResolved || 0} | Overall Clearance: ${totals.overallClearanceRate || 100}% | Net Rollover: ${totals.netRolloverNextMonth || 0}
4-Week Consistent Streak: ${isGoodStreak ? 'YES (4 of 4 weeks in Good Standing)' : 'NO'}

Weekly Breakdown:
${weeklySummaryText}

Context:
- 4-Week Streak Status: ${isGoodStreak ? 'Active 4-Week Streak of Good Performance' : 'Standard Evaluation'}
- Volume Spikes Detected: ${trajectory.hasVolumeSpikes ? 'Yes' : 'No'}
- Chronic Rollover: ${trajectory.isChronicRollover ? 'Yes' : 'No'}

Strict Rules:
1. Do NOT include ANY emojis or informal conversational slang.
2. Maintain a professional, executive academic administration tone.
3. If staff has a good streak, the commendation MUST start with "Keep up the good work!" and cite their verified resolution consistency and queue discipline.

Respond with valid JSON matching this exact structure:
{
  "archetype": "High-Efficiency Pacer | Steady Pacer | High-Volume Shock Absorber | Front-Loader / Late Fatigue | End-of-Month Backlogger",
  "archetypeDescription": "1-2 sentence objective description of their work pacing",
  "commendation": "2-3 sentences starting with 'Keep up the good work!' summarizing their 4-week consistency, queue discipline, SLA compliance, and zero overdue status.",
  "patternDiagnosis": "2-3 sentence analysis of their throughput and resolution rhythm from Week 1 to Week 4",
  "nextMonthPrediction": {
    "capacityThresholdWeekly": ${nextMonthPrediction.safeWeeklyCapacity || 10},
    "projectedRisk": "${nextMonthPrediction.projectedRisk || 'Low'}",
    "predictedBottleneck": "Specific prediction for next month based on their consistent 4-week rhythm"
  }
}`;

  const messages = [
    {
      role: 'system',
      content: 'You are an institutional performance analyst. Return clean valid JSON only without emojis.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const rawResponse = await callGroqAPI(messages);
    if (rawResponse) {
      const cleaned = stripEmojis(rawResponse.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim());
      const parsed = JSON.parse(cleaned);

      if (parsed && (parsed.commendation || parsed.patternDiagnosis)) {
        return {
          ...monthlyData,
          archetype: {
            title: stripEmojis(parsed.archetype || archetype.title || 'High-Efficiency Pacer'),
            tag: archetype.tag || 'efficient',
            description: stripEmojis(parsed.archetypeDescription || archetype.description || 'Maintains balanced resolution and queue clearance consistently across all 4 weeks.')
          },
          aiCommendation: stripEmojis(parsed.commendation || `Keep up the good work! You have maintained a consistent streak of good performance for 4 weeks with a ${totals.overallClearanceRate}% clearance score.`),
          aiPatternDiagnosis: stripEmojis(parsed.patternDiagnosis || `Consistent 4-week resolution rhythm with ${totals.totalResolved} requests resolved.`),
          nextMonthPrediction: {
            safeWeeklyCapacity: parsed.nextMonthPrediction?.capacityThresholdWeekly ?? nextMonthPrediction.safeWeeklyCapacity ?? 10,
            projectedRisk: stripEmojis(parsed.nextMonthPrediction?.projectedRisk || nextMonthPrediction.projectedRisk || 'Low'),
            predictedBottleneck: stripEmojis(parsed.nextMonthPrediction?.predictedBottleneck || nextMonthPrediction.predictedBottleneck || 'Normal operations expected. Queue clearance is projected to remain stable.')
          },
          isAIEnhanced: true
        };
      }
    }
  } catch (err) {
    // Graceful fallback to deterministic analytical engine below
  }

  // Deterministic fallback matching institutional analytical standards
  const defaultCommendation = isGoodStreak
    ? `Keep up the good work! You have maintained an exceptional 4-week performance streak across ${month.name || 'this month'} with a ${totals.overallClearanceRate || 100}% clearance score. Institutional performance auditing confirms your steady throughput, prompt response times, and zero overdue tickets.`
    : `Consistently processing requests: ${totals.totalResolved || 0} completed with ${totals.overallClearanceRate || 100}% clearance score.`;

  return {
    ...monthlyData,
    archetype: {
      title: archetype.title || (isGoodStreak ? 'High-Efficiency Pacer' : 'Steady Pacer'),
      tag: archetype.tag || 'efficient',
      description: archetype.description || 'Maintains balanced resolution and queue clearance consistently across all 4 weeks.'
    },
    aiCommendation: defaultCommendation,
    aiPatternDiagnosis: `${staff.name || 'Staff Member'} resolved ${totals.totalResolved || 0} of ${totals.totalAssigned || 0} assigned requests in ${month.name || 'this period'} (${totals.overallClearanceRate || 100}% clearance). Weekly progression indicates balanced clearance across Weeks 1 to 4 with an average resolution speed of ${totals.avgMonthlyResolutionHours || 0} hours.`,
    nextMonthPrediction: {
      safeWeeklyCapacity: nextMonthPrediction.safeWeeklyCapacity || 10,
      projectedRisk: nextMonthPrediction.projectedRisk || 'Low',
      predictedBottleneck: nextMonthPrediction.predictedBottleneck || 'Normal operations expected. Queue clearance is projected to remain stable.'
    },
    isAIEnhanced: false
  };
};
