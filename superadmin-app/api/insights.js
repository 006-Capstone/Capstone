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

  const apiKey = (process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'Groq API key not configured on server' });
  }

  const groq = new Groq({ apiKey });
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { metrics, type, messages: customMessages } = body;

  // Ordered fallback models
  const candidateModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

  let lastError = null;

  for (const model of candidateModels) {
    try {
      const messages = customMessages || [
        {
          role: 'system',
          content: 'You are an analytics assistant for an academic ticketing dashboard. Respond with valid JSON analyzing operational trends, bottlenecks, and recommendations.'
        },
        {
          role: 'user',
          content: `Analyze the following operational metrics for type "${type}": ${JSON.stringify(metrics)}`
        }
      ];

      const requestPayload = {
        model,
        messages
      };

      const isJsonRequest = !customMessages || JSON.stringify(customMessages).toLowerCase().includes('json');
      if (isJsonRequest) {
        requestPayload.response_format = { type: 'json_object' };
      }

      const completion = await groq.chat.completions.create(requestPayload);
      const rawContent = completion.choices[0]?.message?.content || '{}';

      if (!customMessages) {
        const data = JSON.parse(rawContent || '{}');
        return res.status(200).json(data);
      } else {
        try {
          const parsed = JSON.parse(rawContent);
          return res.status(200).json({ content: rawContent, ...parsed });
        } catch {
          return res.status(200).json({ content: rawContent });
        }
      }
    } catch (err) {
      console.warn(`Groq model ${model} failed:`, err?.message || err);
      lastError = err;
      continue;
    }
  }

  return res.status(500).json({
    error: lastError?.message || 'Failed to generate insights from all models'
  });
}
