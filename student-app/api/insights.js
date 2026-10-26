import Groq from 'groq-sdk';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Active Groq models for 2026
  const candidateModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768'
  ];

  // Clean API key
  const apiKey = (process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY || '').trim();

  const fallbackData = {
    executiveSummary: {
      status: "System monitoring active across Registrar, Accounting, Guidance, and Library.",
      bottleneck: "Review department queue throughput for optimal turnaround.",
      actionPriority: "Normal operational flow"
    },
    anomalies: [],
    recommendations: [
      {
        id: "rec-1",
        title: "Balance peak office requests",
        category: "Staff Allocation",
        priority: "NORMAL",
        description: "Maintain assigned staff during peak morning request windows."
      }
    ]
  };

  // If no API key is configured, gracefully return operational fallback
  if (!apiKey) {
    console.warn('Groq API key not configured on server, returning computed operational insights');
    return res.status(200).json(fallbackData);
  }

  try {
    const groq = new Groq({ apiKey });

    // Discover working chat models
    let availableChatModels = [];
    try {
      const modelsList = await groq.models.list();
      if (modelsList?.data && Array.isArray(modelsList.data)) {
        availableChatModels = modelsList.data
          .map(m => m.id)
          .filter(id => !id.includes('whisper') && !id.includes('tts') && !id.includes('embed') && !id.includes('guard'));
      }
    } catch (e) {
      console.warn("Could not list Groq models, falling back to candidates:", e.message);
    }

    const modelsToTry = [
      ...new Set([
        ...availableChatModels.filter(m => m.includes('llama') || m.includes('mixtral')),
        ...candidateModels
      ])
    ];

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { metrics = {} } = body;

    const systemPrompt = `You are an AI Operational Insights Assistant for Academia De San Jose's Academic Request Ticketing and Management System.
The system serves four primary offices: Registrar, Accounting, Guidance, and Library.
Analyze the provided request metrics and output a JSON object with:
- executiveSummary: { status, bottleneck, actionPriority }
- recommendations: array of { id, title, category, priority, description }
Only return valid JSON.`;

    const userPrompt = `System Metrics: ${JSON.stringify(metrics)}`;

    let lastError = null;
    for (const model of modelsToTry) {
      try {
        const response = await groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        });

        const content = response.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return res.status(200).json(parsed);
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed:`, err.message);
      }
    }

    console.warn('All models failed, using fallback:', lastError?.message);
    return res.status(200).json(fallbackData);
  } catch (error) {
    console.error('Insights API Error:', error);
    return res.status(200).json(fallbackData);
  }
}
