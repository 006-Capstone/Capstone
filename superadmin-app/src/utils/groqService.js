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

Institutional Context & Boundaries:
- The school ONLY has 4 administrative offices: Finance, Guidance, Library, Registrar.
- DO NOT invent "IT Support", "IT Helpdesk", "technical support", "portal glitch", or generic corporate IT terms.
- Real Staff: Registrar (Dorothy Gerolaga); Finance (Jefelah P. Amistoso, Dot g, b s); Library (Ban S).
- STRICT ISOLATION: Staff belong exclusively to their designated office. NEVER suggest Finance staff (e.g. Jefelah P. Amistoso) to handle Registrar requests or Dorothy's backlog.

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
  `- ${staff.name} (${staff.department || staff.office}): ${staff.riskScore}% risk score, ${staff.overdueTickets} overdue tickets`
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
      content: 'You are an executive operations AI. Provide ultra-concise, factual bullet summaries without any emojis, bullet characters, IT helpdesk hallucinations, or cross-department staff assignments.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const raw = await callGroqAPI(messages);
    let cleaned = stripEmojis(raw);
    // Sanitize any generic corporate IT hallucinations
    cleaned = cleaned.replace(/it support|helpdesk|technical support|it department|it team/gi, 'administrative office');
    cleaned = cleaned.replace(/keyword routing( triage)?/gi, 'request processing');
    // Sanitize cross-department staff hallucinations (e.g. Jefelah resolving Registrar)
    if (/registrar/i.test(cleaned) && /jefelah/i.test(cleaned)) {
      cleaned = cleaned.replace(/\bjefelah(\s+p\.?)?(\s+amistoso)?\b/gi, 'Registrar staff');
    }
    return cleaned;
  } catch (error) {
    console.error('Error generating executive summary:', error);
    return 'Status: System monitoring active with operational data updated.\nBottleneck: Review department breakdown for active queues.\nAction: Rebalance department ticket assignments as needed.';
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

  const validOffices = ['Finance', 'Guidance', 'Library', 'Registrar'];

  const prompt = `You are an AI anomaly detection system for Academia de San Jose's student services ticketing platform. Analyze the following data and identify AT MOST 2-3 significant operational anomalies.

Institutional Context & Boundaries:
- The school ONLY has 4 administrative offices: Finance, Guidance, Library, Registrar.
- DO NOT invent "IT Support", "IT Helpdesk", "technical support", "portal downtime", or generic corporate IT terms.
- Real Staff: Registrar: Dorothy Gerolaga. Finance: Jefelah P. Amistoso, Dot g, b s. Library: Ban S.
- STRICT ISOLATION: Staff can only handle work within their own office. NEVER suggest Finance staff (e.g. Jefelah P. Amistoso) for Registrar backlogs. Jefelah is in Finance only.

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
${staffData && staffData.length > 0
  ? staffData.map(staff => `- ${staff.name} (${staff.department}): Risk Score ${staff.riskScore}%, ${staff.overdueTickets}/${staff.activeTickets} overdue`).join('\n')
  : 'No staff outliers detected.'}

Strict Rules:
1. Return at most 2 or 3 genuine anomalies. If metrics are within normal ranges, return empty array [].
2. Keep text extremely brief and scannable:
   - title: concise title (max 5 words, no emojis)
   - description: exactly 1 crisp sentence (max 18 words, no emojis)
   - affectedArea: MUST BE strictly either one of the 4 offices (Finance, Guidance, Library, Registrar) or a specific staff member who belongs to that office (max 4 words).
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
      content: 'You are an AI anomaly detection system for a school. Respond with concise, scannable JSON without any emojis, IT helpdesk hallucinations, or cross-department staff assignments.'
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
        const rawAnomalies = Array.isArray(data.anomalies) ? data.anomalies : [];
        const hallucinatedPattern = /it support|helpdesk|keyword routing|triage software|tier 1|tier 2|technical support|portal downtime|server|database|network|admissions|human resources|\bhr\b/i;

        const cleanedAnomalies = rawAnomalies
          .filter(a => {
            if (!a || !a.title) return false;
            if (hallucinatedPattern.test(a.title) || hallucinatedPattern.test(a.description || '') || hallucinatedPattern.test(a.affectedArea || '')) {
              return false;
            }
            return true;
          })
          .map(a => {
            let affected = stripEmojis(a.affectedArea || '').trim();
            let desc = stripEmojis(a.description || '');
            let title = stripEmojis(a.title || '');

            // Validate affectedArea against valid offices
            const matchedOffice = validOffices.find(o => 
              o.toLowerCase() === affected.toLowerCase() || 
              `${o.toLowerCase()} office` === affected.toLowerCase()
            );

            if (matchedOffice) {
              affected = matchedOffice;
            } else {
              // Check if affected matches a real staff member
              const matchedStaff = (staffData || []).find(s => 
                s.name && s.name.toLowerCase() === affected.toLowerCase()
              );

              if (matchedStaff) {
                const staffDept = (matchedStaff.department || '').toLowerCase();
                // Check if staff member belongs to the context described in the anomaly
                if (/registrar|transcript|coe|graduation/i.test(`${title} ${desc}`) && staffDept !== 'registrar') {
                  // Cross-department mismatch (e.g. Jefelah in Registrar anomaly)
                  affected = 'Registrar';
                } else if (/finance|tuition|balance|payment/i.test(`${title} ${desc}`) && staffDept !== 'finance') {
                  affected = 'Finance';
                } else {
                  affected = matchedStaff.name;
                }
              } else {
                // Unknown/hallucinated area - detect office from title & description
                const combined = `${title} ${desc}`.toLowerCase();
                if (/registrar|transcript|tor|coe|clearance|graduation|diploma/i.test(combined)) affected = 'Registrar';
                else if (/finance|tuition|balance|payment|receipt/i.test(combined)) affected = 'Finance';
                else if (/library|book|borrow/i.test(combined)) affected = 'Library';
                else if (/guidance|counsel|moral/i.test(combined)) affected = 'Guidance';
                else affected = 'Registrar';
              }
            }

            // Sanitize cross-department staff mentions in description and title
            if (/registrar/i.test(`${affected} ${title} ${desc}`)) {
              desc = desc.replace(/\bjefelah(\s+p\.?)?(\s+amistoso)?\b/gi, 'Registrar staff');
              title = title.replace(/\bjefelah(\s+p\.?)?(\s+amistoso)?\b/gi, 'Registrar');
            }

            return {
              ...a,
              title: stripEmojis(title),
              description: stripEmojis(desc),
              affectedArea: affected,
              recommendation: stripEmojis(a.recommendation || '')
            };
          })
          .slice(0, 3);

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
    allStaffNames,
    allStaffDetails
  } = workloadData;

  const validDepartments = ['Finance', 'Guidance', 'Library', 'Registrar'];
  
  // Build departmental staff roster & lookup map
  const staffByDept = {
    Registrar: [],
    Finance: [],
    Library: [],
    Guidance: []
  };
  const realStaffMap = {}; // name.toLowerCase() -> department

  if (Array.isArray(allStaffDetails) && allStaffDetails.length > 0) {
    allStaffDetails.forEach(s => {
      if (!s || !s.name) return;
      const deptRaw = (s.department || s.office || '').replace(/\s+(office|department)$/i, '').trim();
      const formattedDept = deptRaw ? deptRaw.charAt(0).toUpperCase() + deptRaw.slice(1).toLowerCase() : '';
      if (staffByDept[formattedDept]) {
        staffByDept[formattedDept].push(s.name);
      }
      realStaffMap[s.name.trim().toLowerCase()] = formattedDept;
    });
  } else if (Array.isArray(allStaffNames)) {
    allStaffNames.forEach(raw => {
      if (!raw) return;
      const match = raw.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        const name = match[1].trim();
        const deptRaw = match[2].replace(/\s+(office|department)$/i, '').trim();
        const formattedDept = deptRaw ? deptRaw.charAt(0).toUpperCase() + deptRaw.slice(1).toLowerCase() : '';
        if (staffByDept[formattedDept]) {
          staffByDept[formattedDept].push(name);
        }
        realStaffMap[name.toLowerCase()] = formattedDept;
      }
    });
  }

  const prompt = `You are an AI operations analyst for Academia de San Jose (a school ticket management system).
Analyze the factual data below and provide AT MOST 2-3 genuine, high-impact recommendations.

Context & Institutional Boundaries:
- The school ONLY has 4 administrative offices: Finance, Guidance, Library, Registrar.
- Tickets are student academic/financial services: Transcripts, Certificates of Enrollment, Good Moral, Clearances, Tuition Balances, and Library Clearances.
- DO NOT invent "IT Support", "IT Helpdesk", "technical support", or generic corporate IT terms like "keyword routing triage". Such departments DO NOT exist in this school.

Departmental Staff Roster:
- Registrar: ${staffByDept.Registrar.length > 0 ? staffByDept.Registrar.join(', ') : 'Dorothy Gerolaga'}
- Finance: ${staffByDept.Finance.length > 0 ? staffByDept.Finance.join(', ') : 'None'}
- Library: ${staffByDept.Library.length > 0 ? staffByDept.Library.join(', ') : 'None'}
- Guidance: ${staffByDept.Guidance.length > 0 ? staffByDept.Guidance.join(', ') : 'None'}

Overloaded Staff (High Risk):
${overloadedStaff && overloadedStaff.length > 0
  ? overloadedStaff.map(s => `- ${s.name} (${s.department}): ${s.activeTickets} active tickets, ${s.overdueTickets} overdue, ${s.riskScore}% risk score`).join('\n')
  : 'None currently overloaded (all staff workloads are within normal capacity).'}

Available Staff:
${underloadedStaff && underloadedStaff.length > 0
  ? underloadedStaff.map(s => `- ${s.name} (${s.department}): ${s.activeTickets} active tickets, ${s.riskScore}% risk score`).join('\n')
  : 'All staff actively engaged.'}

Official Department Capacities:
${Object.entries(departmentCapacity || {}).map(([dept, data]) => 
  `- ${dept}: ${data.utilization}% capacity (${data.currentActive}/${data.maxCapacity} tickets)`
).join('\n')}

CRITICAL ANTI-HALLUCINATION & REASSIGNMENT RULES:
1. STRICT DEPARTMENT ISOLATION: Staff belong EXCLUSIVELY to their designated office.
   - Finance staff (e.g. Jefelah P. Amistoso, Dot g, b s) CAN NEVER handle Registrar, Library, or Guidance requests or backlogs!
   - Registrar staff (e.g. Dorothy Gerolaga) CAN NEVER handle Finance, Library, or Guidance requests!
   - Cross-department ticket reassignment or cross-department task assignment is STRICTLY FORBIDDEN!
2. If an office (such as Registrar) has only one staff member and they are overloaded, DO NOT attempt to reassign their tickets to another office. Recommend type "hire" (request new staff for that office) or type "process_improvement" (workflow checklist, batch processing) instead.
3. "affectedStaff": MUST ONLY contain staff who actually belong to the department of that recommendation. If a recommendation applies to the office as a whole, set "affectedStaff": ["<OfficeName>"] (e.g. ["Registrar"]).
4. NEVER hallucinate fake staff names, fake departments, or cross-department assignments.
5. Provide ONLY 2 or 3 high-impact recommendations (priority: "high" or "medium").
6. Keep text concise and scannable:
   - title: brief action title (max 5 words, no emojis)
   - description: exactly 1 crisp sentence explaining why (max 18 words, no emojis)
   - affectedStaff: array of 0-2 real staff names strictly from the department roster above, or office name
   - expectedImpact: brief quantified metric (max 6 words, e.g. "-25% overdue backlog", no emojis)
   - steps: exactly 2-3 short implementation steps (max 8 words each, no emojis)
7. Do NOT include ANY emojis or symbols anywhere.

Format as JSON:
{
  "recommendations": [
    {
      "priority": "high|medium",
      "type": "reassign|hire|training|process_improvement",
      "title": "Brief title",
      "description": "One sentence explanation.",
      "affectedStaff": ["Real Staff Name or Office"],
      "expectedImpact": "-25% overdue backlog",
      "steps": ["Step 1", "Step 2"]
    }
  ]
}`;

  const messages = [
    {
      role: 'system',
      content: 'You are an AI workload optimization expert for a school. Provide ultra-concise, practical recommendations grounded strictly in the 4 school departments without emojis, generic IT helpdesk hallucinations, or cross-department staff assignments. Respond ONLY with valid JSON.'
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
    
    const detectRecDept = (rec) => {
      if (!rec) return null;
      const text = `${rec.title || ''} ${rec.description || ''}`.toLowerCase();
      if (/registrar|transcript|tor|coe|enrollment|clearance|diploma|academic record|graduation|records/i.test(text)) return 'Registrar';
      if (/finance|tuition|balance|payment|receipt|cashier|assessment|fee|billing/i.test(text)) return 'Finance';
      if (/library|book|borrow|circulation/i.test(text)) return 'Library';
      if (/guidance|counseling|good moral|conduct/i.test(text)) return 'Guidance';
      return null;
    };

    const sanitizeRecs = (items) => {
      if (!Array.isArray(items)) return [];

      const hallucinatedPattern = /it support|helpdesk|keyword routing|triage software|tier 1|tier 2|technical support|portal downtime|server|database|network|admissions|human resources|\bhr\b/i;
      const invalidStaffPattern = /^(all departments?|it support.*|helpdesk.*|department.*|staff.*|n\/a|none|unknown)$/i;

      return items
        .filter(r => {
          if (!r || !r.title) return false;
          // Discard hallucinated IT/keyword routing recommendations
          if (hallucinatedPattern.test(r.title) || hallucinatedPattern.test(r.description || '')) {
            return false;
          }
          return true;
        })
        .slice(0, 3)
        .map(r => {
          let recDept = detectRecDept(r);
          const rawStaff = Array.isArray(r.affectedStaff) ? r.affectedStaff : [];

          // If department not detected from text, inspect staff
          if (!recDept) {
            for (const s of rawStaff) {
              const sClean = stripEmojis(s || '').trim().toLowerCase();
              if (realStaffMap[sClean]) {
                recDept = realStaffMap[sClean];
                break;
              }
            }
            if (!recDept) recDept = 'Registrar';
          }
          
          const cleanedStaff = [];
          rawStaff.forEach(s => {
            const clean = stripEmojis(s || '').trim();
            if (!clean || invalidStaffPattern.test(clean)) return;

            const cleanLower = clean.toLowerCase();

            // Check if it's an office name
            if (validDepartments.some(d => d.toLowerCase() === cleanLower || `${d.toLowerCase()} office` === cleanLower)) {
              const formattedDept = cleanLower.replace(/\s+(office|department)$/i, '').trim();
              const capDept = formattedDept.charAt(0).toUpperCase() + formattedDept.slice(1);
              if (recDept.toLowerCase() === capDept.toLowerCase()) {
                if (!cleanedStaff.includes(capDept)) cleanedStaff.push(capDept);
              }
              return;
            }

            // Check against real staff roster
            const staffDept = realStaffMap[cleanLower];
            if (!staffDept) {
              // Not a real registered staff member - discard hallucinated name!
              return;
            }

            // Cross-department check: staff MUST belong to the recommendation's department
            if (staffDept.toLowerCase() !== recDept.toLowerCase()) {
              console.warn(`[Anti-Hallucination] Discarded cross-department staff ${clean} (${staffDept}) from ${recDept} recommendation`);
              return;
            }

            if (!cleanedStaff.includes(clean)) {
              cleanedStaff.push(clean);
            }
          });

          // Fallback to department badge if all staff were hallucinated or cross-department
          if (cleanedStaff.length === 0 && recDept) {
            cleanedStaff.push(recDept);
          }

          // If recommendation type is reassign, but department only has 1 or fewer staff:
          let recType = r.type;
          let recTitle = stripEmojis(r.title || '');
          if (recType === 'reassign' && staffByDept[recDept] && staffByDept[recDept].length <= 1) {
            recType = 'process_improvement';
            recTitle = recTitle.replace(/reassign(ing)?/gi, 'Optimize');
          }

          // Clean title of any cross-department staff mentions and corporate IT terms
          recTitle = recTitle.replace(/it support|helpdesk|technical support|it desk/gi, 'Office');
          recTitle = recTitle.replace(/keyword routing( triage)?/gi, 'request processing');
          if (recDept) {
            Object.entries(realStaffMap).forEach(([staffLower, dept]) => {
              if (dept && dept.toLowerCase() !== recDept.toLowerCase()) {
                const staffRegex = new RegExp(`\\b${staffLower}\\b`, 'gi');
                recTitle = recTitle.replace(staffRegex, `${recDept} Operations`);
              }
            });
          }

          // Clean description of any cross-department staff mentions and corporate IT terms
          let sanitizedDescription = stripEmojis(r.description || '');
          sanitizedDescription = sanitizedDescription.replace(/it support|helpdesk|technical support|it department|it team/gi, 'administrative office');
          sanitizedDescription = sanitizedDescription.replace(/keyword routing( triage)?/gi, 'request processing');
          if (recDept) {
            Object.entries(realStaffMap).forEach(([staffLower, dept]) => {
              if (dept && dept.toLowerCase() !== recDept.toLowerCase()) {
                const staffRegex = new RegExp(`\\b${staffLower}\\b`, 'gi');
                sanitizedDescription = sanitizedDescription.replace(staffRegex, `${recDept} staff`);
              }
            });
          }

          // Clean steps of any cross-department staff mentions
          const sanitizedSteps = Array.isArray(r.steps) ? r.steps.map(step => {
            let stepClean = stripEmojis(step || '');
            stepClean = stepClean.replace(/it support|helpdesk|technical support/gi, 'office operations');
            stepClean = stepClean.replace(/keyword routing/gi, 'request sorting');
            if (recDept) {
              Object.entries(realStaffMap).forEach(([staffLower, dept]) => {
                if (dept && dept.toLowerCase() !== recDept.toLowerCase()) {
                  const staffRegex = new RegExp(`\\b${staffLower}\\b`, 'gi');
                  stepClean = stepClean.replace(staffRegex, `${recDept} staff`);
                }
              });
            }
            return stepClean;
          }) : [];

          return {
            ...r,
            type: recType,
            title: recTitle,
            description: sanitizedDescription,
            expectedImpact: stripEmojis(r.expectedImpact || ''),
            affectedStaff: cleanedStaff,
            steps: sanitizedSteps
          };
        });
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
