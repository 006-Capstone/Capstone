/**
 * Groq AI Service for Performance Analytics
 * Provides AI-powered insights, anomaly detection, and smart recommendations
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;
const MODEL = 'openai/gpt-oss-120B'; // Current GPT-OSS model - January 2025

/**
 * Make a request to Groq API with error handling and retry logic
 * @param {array} messages - Chat messages for the API
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<string>} - AI response text
 */
const callGroqAPI = async (messages, maxRetries = 2) => {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured');
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error(`Groq API attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

/**
 * Generate an executive summary of system performance
 * @param {object} performanceData - System performance metrics
 * @returns {Promise<string>} - AI-generated summary
 */
export const generateExecutiveSummary = async (performanceData) => {
  const {
    systemHealth,
    totalStaff,
    totalActiveTickets,
    totalOverdueTickets,
    departmentHealth,
    topBottlenecks,
    trends
  } = performanceData;

  const prompt = `You are an AI performance analyst for Academia de San Jose's ticket management system. Generate a concise executive summary (3-4 sentences) of the current system performance.

Current System Status:
- Overall Health: ${systemHealth.status} (${systemHealth.onTrackPercentage}% on-track)
- Active Tickets: ${totalActiveTickets}
- Overdue Tickets: ${totalOverdueTickets}
- Total Staff: ${totalStaff}

Department Performance:
${departmentHealth.map(dept => 
  `- ${dept.office}: ${dept.status} (${dept.onTimePercentage}% on-time, ${dept.overdueTickets} overdue)`
).join('\n')}

Staff at Risk:
${topBottlenecks.map(staff => 
  `- ${staff.name}: ${staff.riskScore}% risk score, ${staff.overdueTickets} overdue tickets`
).join('\n')}

Performance Trends:
- Week-over-week overdue change: ${trends?.weekOverWeekChange > 0 ? '+' : ''}${trends?.weekOverWeekChange}%
- Month-over-month change: ${trends?.monthOverMonthChange > 0 ? '+' : ''}${trends?.monthOverMonthChange}%

Provide a professional summary highlighting the most critical points and overall system health. Keep it concise and actionable.`;

  const messages = [
    {
      role: 'system',
      content: 'You are a performance analytics AI that provides clear, concise, and actionable insights for academic administrators. Focus on critical issues and practical recommendations.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    return await callGroqAPI(messages);
  } catch (error) {
    console.error('Error generating executive summary:', error);
    return 'Unable to generate AI summary at this time. Please check system metrics manually.';
  }
};

/**
 * Detect anomalies in performance patterns
 * @param {object} analyticsData - Historical and current performance data
 * @returns {Promise<object>} - Detected anomalies with severity and description
 */
export const detectAnomalies = async (analyticsData) => {
  const {
    currentMetrics,
    historicalAverage,
    trends,
    departmentData,
    staffData
  } = analyticsData;

  const prompt = `You are an AI anomaly detection system for a ticket management platform. Analyze the following data and identify any unusual patterns or anomalies.

Current Metrics (Last 7 days):
- Active Tickets: ${currentMetrics.activeTickets}
- Overdue Rate: ${currentMetrics.overdueRate}%
- Avg Resolution Time: ${currentMetrics.avgResolutionTime} hours

Historical Average (30-day baseline):
- Active Tickets: ${historicalAverage.activeTickets}
- Overdue Rate: ${historicalAverage.overdueRate}%
- Avg Resolution Time: ${historicalAverage.avgResolutionTime} hours

Trends:
- Week-over-week change: ${trends.weekOverWeekChange}%
- Month-over-month change: ${trends.monthOverMonthChange}%
- Trend direction: ${trends.weekTrend}

Department-Specific Issues:
${departmentData.map(dept => 
  `- ${dept.office}: ${dept.activeTickets} active, ${dept.overdueTickets} overdue (${dept.overdueRate}% overdue rate)`
).join('\n')}

Staff Performance Outliers:
${staffData.map(staff => 
  `- ${staff.name} (${staff.department}): Risk Score ${staff.riskScore}%, ${staff.overdueTickets}/${staff.activeTickets} overdue`
).join('\n')}

Identify:
1. Any statistical anomalies (significant deviations from historical average)
2. Emerging patterns that could become problems
3. Unusual department-specific issues
4. Staff performance outliers requiring attention

Format your response as a JSON object:
{
  "anomalies": [
    {
      "type": "ticket_surge|performance_drop|department_overload|staff_burnout",
      "severity": "low|medium|high|critical",
      "title": "Brief title",
      "description": "Clear description of the anomaly",
      "affectedArea": "Department name or staff name",
      "recommendation": "Immediate action to take"
    }
  ],
  "overallRisk": "low|medium|high|critical"
}

Only include actual anomalies. If everything is normal, return an empty anomalies array.`;

  const messages = [
    {
      role: 'system',
      content: 'You are an AI anomaly detection system. Analyze data patterns and identify unusual deviations that require attention. Respond ONLY with valid JSON.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const response = await callGroqAPI(messages);
    
    // Extract and clean JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonString = jsonMatch[0];
        // Fix common JSON issues
        jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
        jsonString = jsonString.replace(/\}\s*\{/g, '},{');
        
        const data = JSON.parse(jsonString);
        return {
          anomalies: data.anomalies || [],
          overallRisk: data.overallRisk || 'low'
        };
      } catch (parseError) {
        console.error('JSON parse error in anomaly detection:', parseError);
      }
    }
    
    return { anomalies: [], overallRisk: 'low' };
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    return { 
      anomalies: [], 
      overallRisk: 'unknown',
      error: 'Unable to analyze anomalies at this time'
    };
  }
};

/**
 * Generate smart workload recommendations using AI
 * @param {object} workloadData - Current workload distribution data
 * @returns {Promise<array>} - AI-generated recommendations
 */
export const generateSmartRecommendations = async (workloadData) => {
  const {
    overloadedStaff,
    underloadedStaff,
    departmentCapacity,
    upcomingDeadlines,
    historicalPatterns
  } = workloadData;

  const prompt = `You are an AI workload optimization assistant for a school's ticket management system. Analyze the current workload distribution and provide actionable recommendations.

Overloaded Staff (High Risk):
${overloadedStaff.map(staff => 
  `- ${staff.name} (${staff.department}): ${staff.activeTickets} active tickets, ${staff.overdueTickets} overdue, ${staff.riskScore}% risk score`
).join('\n')}

Available Staff (Lower Workload):
${underloadedStaff.map(staff => 
  `- ${staff.name} (${staff.department}): ${staff.activeTickets} active tickets, ${staff.riskScore}% risk score`
).join('\n')}

Department Capacity:
${Object.entries(departmentCapacity).map(([dept, data]) => 
  `- ${dept}: ${data.utilization}% capacity (${data.currentActive}/${data.maxCapacity} tickets)`
).join('\n')}

Provide 3-5 specific, actionable recommendations to optimize workload. For each recommendation, specify:
1. Priority (high/medium/low)
2. Action type (reassign/hire/training/process_improvement)
3. Specific staff members or departments involved
4. Expected impact
5. Implementation steps

Format as JSON:
{
  "recommendations": [
    {
      "priority": "high|medium|low",
      "type": "reassign|hire|training|process_improvement",
      "title": "Brief actionable title",
      "description": "Detailed explanation",
      "affectedStaff": ["Staff names"],
      "expectedImpact": "Quantified benefit",
      "steps": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}`;

  const messages = [
    {
      role: 'system',
      content: 'You are an AI workload optimization expert. Provide practical, data-driven recommendations for improving staff efficiency and preventing burnout. Respond ONLY with valid JSON.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const response = await callGroqAPI(messages);
    
    // Clean up the response before parsing
    let cleanedResponse = response
      .replace(/[\u2010-\u2015]/g, '-')  // Unicode hyphens
      .replace(/[\u2018\u2019]/g, "'")   // Smart single quotes
      .replace(/[\u201C\u201D]/g, '"')   // Smart double quotes
      .replace(/[\u2026]/g, '...')       // Ellipsis
      .replace(/[\u00A0]/g, ' ');        // Non-breaking space
    
    // Try to extract and parse JSON
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*"recommendations"[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('⚠️ Could not find recommendations in AI response');
      return [];
    }
    
    // Manual parsing as fallback for malformed JSON
    try {
      // First attempt: standard JSON.parse with aggressive cleanup
      let jsonString = jsonMatch[0] + '}'; // Close the object
      
      // Remove ALL line breaks and extra whitespace
      jsonString = jsonString
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Fix common JSON errors
      jsonString = jsonString
        .replace(/,\s*}/g, '}')      // trailing comma before }
        .replace(/,\s*]/g, ']')      // trailing comma before ]
        .replace(/}\s*{/g, '},{')    // missing comma between objects
        .replace(/]\s*\[/g, '],[');  // missing comma between arrays
      
      const data = JSON.parse(jsonString);
      
      if (data.recommendations && Array.isArray(data.recommendations)) {
        console.log(`✅ Parsed ${data.recommendations.length} AI recommendations`);
        return data.recommendations;
      }
    } catch (parseError) {
      console.warn('Standard JSON parse failed, using manual extraction:', parseError.message);
      
      // Fallback: Manually extract recommendation objects
      const recs = [];
      const recMatches = cleanedResponse.matchAll(/\{\s*"priority"\s*:\s*"(high|medium|low)"[\s\S]*?\},?\s*(?=\{|])/gi);
      
      for (const match of recMatches) {
        try {
          let recString = match[0].trim();
          if (recString.endsWith(',')) recString = recString.slice(0, -1);
          if (!recString.endsWith('}')) recString += '}';
          
          // Clean up the string
          recString = recString
            .replace(/\n/g, ' ')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
          
          const rec = JSON.parse(recString);
          recs.push(rec);
        } catch (e) {
          console.warn('Failed to parse individual recommendation:', e);
        }
      }
      
      if (recs.length > 0) {
        console.log(`✅ Manually extracted ${recs.length} recommendations`);
        return recs;
      }
    }
    
    console.warn('⚠️ No valid recommendations found');
    return [];
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return [];
  }
};

/**
 * Generate natural language insights for a specific staff member
 * @param {object} staffData - Individual staff performance data
 * @returns {Promise<string>} - AI-generated insight
 */
export const generateStaffInsight = async (staffData) => {
  const {
    name,
    department,
    activeTickets,
    overdueTickets,
    riskScore,
    performance,
    trends,
    warningStage
  } = staffData;

  const prompt = `Analyze the performance of ${name} from the ${department} department and provide a brief insight (2-3 sentences).

Current Status:
- Active Tickets: ${activeTickets}
- Overdue Tickets: ${overdueTickets}
- Risk Score: ${riskScore}%
- 30-day Performance: ${performance.onTimeRate}% on-time rate
- Warning Stage: ${warningStage.stageName}
- Trend: ${trends.weekTrend}

Provide a professional, empathetic assessment focusing on whether they need support, are performing well, or show concerning patterns.`;

  const messages = [
    {
      role: 'system',
      content: 'You are an empathetic HR analytics assistant. Provide constructive, supportive insights about staff performance.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    return await callGroqAPI(messages);
  } catch (error) {
    console.error('Error generating staff insight:', error);
    return 'Unable to generate insights at this time.';
  }
};

export default {
  generateExecutiveSummary,
  detectAnomalies,
  generateSmartRecommendations,
  generateStaffInsight
};
