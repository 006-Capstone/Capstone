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

const stripEmojis = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').trim();
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
    topBottlenecks
  } = performanceData;

  const prompt = `You are an AI performance analyst for Academia de San Jose's ticket management system. Generate exactly 3 concise bullet points summarizing system status.

Current System Status:
- Overall Health: ${systemHealth?.status || 'normal'} (${systemHealth?.onTrackPercentage || 0}% on-track)
- Active Tickets: ${totalActiveTickets || 0}
- Overdue Tickets: ${totalOverdueTickets || 0}
- Total Staff: ${totalStaff || 0}

Department Performance:
${(departmentHealth || []).map(dept => 
  `- ${dept.office}: ${dept.status} (${dept.onTimePercentage}% on-time, ${dept.overdueTickets} overdue)`
).join('\n')}

Staff at Risk:
${(topBottlenecks || []).map(staff => 
  `- ${staff.name}: ${staff.riskScore}% risk score, ${staff.overdueTickets} overdue tickets`
).join('\n')}

Strict Output Rules:
1. Provide exactly 3 lines formatted strictly as:
Status: [1 sentence on overall health and on-track rate, max 14 words]
Bottleneck: [1 sentence on the primary constrained department or staff risk, max 14 words]
Action: [1 sentence on the top operational priority recommendation, max 14 words]
2. Do NOT include any emojis, icons, or decorative symbols.
3. Keep wording direct, data-focused, and scannable.`;

  const messages = [
    {
      role: 'system',
      content: 'You are an executive operations AI. Provide ultra-concise, factual bullet summaries without any emojis, bullet characters, or conversational filler.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const raw = await callGroqAPI(messages);
    return stripEmojis(raw);
  } catch (error) {
    console.error('Error generating executive summary:', error);
    return 'Status: System monitoring active with operational data updated.\nBottleneck: Review department breakdown for active queues.\nAction: Rebalance ticket assignments as needed.';
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

  const prompt = `You are an AI anomaly detection system for a ticket management platform. Analyze the following data and identify AT MOST 2-3 significant operational anomalies.

Current Metrics (Last 7 days):
- Active Tickets: ${currentMetrics.activeTickets}
- Overdue Rate: ${currentMetrics.overdueRate}%
- Avg Resolution Time: ${currentMetrics.avgResolutionTime} hours

Historical Average (30-day baseline):
- Active Tickets: ${historicalAverage.activeTickets}
- Overdue Rate: ${historicalAverage.overdueRate}%
- Avg Resolution Time: ${historicalAverage.avgResolutionTime} hours

Department Issues:
${departmentData.map(dept => 
  `- ${dept.office}: ${dept.activeTickets} active, ${dept.overdueTickets} overdue (${dept.overdueRate}% overdue)`
).join('\n')}

Staff Outliers:
${staffData.map(staff => 
  `- ${staff.name} (${staff.department}): Risk Score ${staff.riskScore}%, ${staff.overdueTickets}/${staff.activeTickets} overdue`
).join('\n')}

Strict Rules:
1. Return at most 2 or 3 anomalies. Do NOT list normal variations.
2. Keep text extremely brief and scannable:
   - title: concise title (max 5 words, no emojis)
   - description: exactly 1 crisp sentence (max 18 words, no emojis)
   - affectedArea: short office or staff name (max 4 words)
   - recommendation: immediate action (max 8 words, no emojis)
3. Do NOT include ANY emojis or symbols.

Format your response as a JSON object:
{
  "anomalies": [
    {
      "type": "ticket_surge|performance_drop|department_overload|staff_burnout",
      "severity": "low|medium|high|critical",
      "title": "Brief title",
      "description": "One sentence description.",
      "affectedArea": "Office or Staff name",
      "recommendation": "Short immediate action"
    }
  ],
  "overallRisk": "low|medium|high|critical"
}`;

  const messages = [
    {
      role: 'system',
      content: 'You are an AI anomaly detection system. Respond with concise, scannable JSON without any emojis or decorative characters.'
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
        const rawAnomalies = Array.isArray(data.anomalies) ? data.anomalies.slice(0, 3) : [];
        const cleanedAnomalies = rawAnomalies.map(a => ({
          ...a,
          title: stripEmojis(a.title || ''),
          description: stripEmojis(a.description || ''),
          affectedArea: stripEmojis(a.affectedArea || ''),
          recommendation: stripEmojis(a.recommendation || '')
        }));

        return {
          anomalies: cleanedAnomalies,
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

  const prompt = `You are an AI workload optimization assistant for a school's ticket management system. Analyze the current workload and provide AT MOST 2-3 high-impact recommendations.

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

Strict Rules:
1. Provide ONLY 2 or 3 high-impact recommendations (high or medium priority).
2. Keep text concise, direct, and scannable:
   - title: brief action title (max 5 words, no emojis)
   - description: exactly 1 crisp sentence explaining why (max 18 words, no emojis)
   - affectedStaff: list of 1-2 staff names
   - expectedImpact: brief quantified metric (max 6 words, e.g. "-30% overdue queue", no emojis)
   - steps: exactly 2-3 short implementation steps (max 8 words each, no emojis)
3. Do NOT include ANY emojis or symbols anywhere.

Format as JSON:
{
  "recommendations": [
    {
      "priority": "high|medium",
      "type": "reassign|hire|training|process_improvement",
      "title": "Brief title",
      "description": "One sentence explanation.",
      "affectedStaff": ["Staff name"],
      "expectedImpact": "-30% overdue queue",
      "steps": ["Step 1", "Step 2"]
    }
  ]
}`;

  const messages = [
    {
      role: 'system',
      content: 'You are an AI workload optimization expert. Provide ultra-concise, practical recommendations without emojis or conversational fluff. Respond ONLY with valid JSON.'
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
    
    const sanitizeRecs = (items) => {
      if (!Array.isArray(items)) return [];
      return items.slice(0, 3).map(r => ({
        ...r,
        title: stripEmojis(r.title || ''),
        description: stripEmojis(r.description || ''),
        expectedImpact: stripEmojis(r.expectedImpact || ''),
        affectedStaff: Array.isArray(r.affectedStaff) ? r.affectedStaff.map(s => stripEmojis(s || '')) : [],
        steps: Array.isArray(r.steps) ? r.steps.map(s => stripEmojis(s || '')) : []
      }));
    };

    // Try to extract and parse JSON
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*"recommendations"[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('Could not find recommendations in AI response');
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
        return sanitizeRecs(data.recommendations);
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
        return sanitizeRecs(recs);
      }
    }
    
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
