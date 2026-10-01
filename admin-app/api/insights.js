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
      status: "System monitoring active with operational data updated.",
      bottleneck: "Review department breakdown for active queues.",
      actionPriority: "Primary operational action needed"
    },
    anomalies: [],
    recommendations: []
  };

  // If no API key is configured, gracefully return operational fallback
  if (!apiKey) {
    console.warn('Groq API key not configured on server, returning computed operational insights');
    return res.status(200).json(fallbackData);
  }

  const groq = new Groq({ apiKey });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

  const systemPrompt = `You are an AI analytics engine for Academia De San Jose ticketing system.
You must respond with valid JSON matching requested parameters.`;

  const messages = body.messages || [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: JSON.stringify(body || {})
    }
  ];

  const isJsonRequest = !body.messages || JSON.stringify(messages).toLowerCase().includes('json');

  let completion = null;

  try {
    for (const model of candidateModels) {
      try {
        const payload = {
          model,
          messages
        };

        if (isJsonRequest) {
          payload.response_format = { type: 'json_object' };
        }

        completion = await groq.chat.completions.create(payload);
        if (completion) break;
      } catch (err) {
        console.warn(`Model ${model} failed:`, err?.message);
        if (
          err?.status === 404 ||
          err?.status === 400 ||
          err?.status === 429 ||
          err?.code === 'model_not_found' ||
          err?.code === 'model_decommissioned' ||
          err?.error?.code === 'model_decommissioned' ||
          (err?.message && (err.message.includes('decommissioned') || err.message.includes('model')))
        ) {
          continue;
        }
        throw err;
      }
    }
  } catch (error) {
    console.warn('Error during Groq completion fallback:', error?.message);
  }

  if (!completion) {
    return res.status(200).json(fallbackData);
  }

  try {
    const rawContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent);
    parsed.rawContent = rawContent;
    return res.status(200).json(parsed);
  } catch (parseError) {
    const rawContent = completion.choices[0]?.message?.content || '';
    return res.status(200).json({
      ...fallbackData,
      rawContent
    });
  }
}
