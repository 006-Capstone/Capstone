import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY || process.env.REACT_APP_GROQ_KEY || process.env.VITE_GROQ_API_KEY;
const MODEL_NAME = 'llama-3.1-8b-instant';

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

  if (!apiKey) {
    console.error("GROQ_API_KEY not configured on server");
    return res.status(200).json({
      approved: true,
      reason: "Fallback: AI service temporarily bypass"
    });
  }

  try {
    const groq = new Groq({ apiKey });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { subject, description } = body;

    console.log("Calling Groq completion with model:", MODEL_NAME);

    try {
      const completion = await groq.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          {
            role: 'system',
            content: 'You are an AI content moderator for a school ticketing portal. Check if the description is appropriate, polite, and relevant to the ticket subject. Respond ONLY with valid JSON: {"approved": true, "reason": "Appropriate"}'
          },
          {
            role: 'user',
            content: `Subject: ${subject}\nDescription: ${description}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return res.status(200).json(parsed);
    } catch (groqErr) {
      console.error("Groq API Call Error Details:", {
        status: groqErr.status,
        message: groqErr.message,
        errorBody: groqErr.error
      });
      // Fallback gracefully so student ticket submission doesn't get blocked
      return res.status(200).json({
        approved: true,
        reason: "Fallback: AI service temporarily bypass"
      });
    }
  } catch (error) {
    console.error("Groq moderation server error:", error);
    return res.status(200).json({
      approved: true,
      reason: "Fallback: AI service temporarily bypass"
    });
  }
}
