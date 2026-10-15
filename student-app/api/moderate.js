import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY || process.env.REACT_APP_GROQ_API_KEY || process.env.REACT_APP_GROQ_KEY || process.env.VITE_GROQ_API_KEY;
const defaultCandidateModels = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768'
];

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
    const { subject, description, officeName } = body;

    // Dynamically discover active models on this specific Groq key
    let candidateModels = [...defaultCandidateModels];
    try {
      const modelsList = await groq.models.list();
      if (modelsList?.data && Array.isArray(modelsList.data)) {
        const availableChatModels = modelsList.data
          .map(m => m.id)
          .filter(id => !id.includes('whisper') && !id.includes('tts') && !id.includes('embed') && !id.includes('guard'));
        console.log('[Groq Moderation] Active chat models on this Groq key:', availableChatModels);
        if (availableChatModels.length > 0) {
          candidateModels = [...availableChatModels, ...defaultCandidateModels];
        }
      }
    } catch (listErr) {
      console.warn('[Groq Moderation] Could not auto-discover models:', listErr?.message || listErr);
    }

    const uniqueCandidates = [...new Set(candidateModels)];
    console.log('[Groq Moderation] Evaluating queue of models:', uniqueCandidates);

    const systemPrompt = `You are a strict, professional AI content moderation system for Academia De San Jose's official student ticketing portal.
Your task is to analyze ticket inquiries submitted by students, parents, or alumni, and ensure they meet school standards.

Departments and their general scope:
- Accounting: Tuition fees, payment plans, refunds, billing statements, student accounts, balance inquiries.
- Registrar: Official records, grades, enrollment, graduation certificate, TOR, diploma, transfer credentials. (NOTE: Form 137 requests are strictly forbidden).
- Library: Book borrowing, returns, lost books, library cards, archival resource access.
- Guidance: Good moral character certificate, counseling, disciplinary inquiries, behavior concerns.

Evaluation Criteria:
1. APPROVAL & RELEVANCE:
   - Does the description have a genuine, sensible connection to the selected department (${officeName || 'School Office'}) and subject (${subject})?
   - Reject if the description has nothing to do with the selected subject (e.g., subject is "Balance Verification" but description is "I want to buy food in the cafeteria" or "Can I borrow a basketball?").
   - Reject completely irrelevant, nonsensical, or off-topic inquiries.

2. SPAM & GIBBERISH:
   - Reject keyboard mashing, repeated characters, nonsensical words, or joke submissions (e.g., "asdfasdf", "test test test", "haha lol", "qwertyuiop").

3. PROFANITY & HARASSMENT:
   - Check English, Filipino/Tagalog, and Bisaya/Cebuano for profanity, insults, slurs, threats, aggressive demands, or abusive language.
   - Legitimate expressions of urgency (e.g., "I need this urgently before deadline") are acceptable.

4. FORM 137:
   - If the description requests "Form 137" or "SF10", set approved: false, isRelevant: false, and note that Form 137 cannot be requested directly by students.

Respond ONLY with a valid JSON object in this exact schema (no markdown, no extra commentary):
{
  "approved": boolean,
  "isRelevant": boolean,
  "relevanceReason": "string (clear explanation if not relevant, or empty string if relevant)",
  "isSpam": boolean,
  "hasProfanity": boolean,
  "profanityReason": "string (explanation if profanity found, or empty string)",
  "reason": "string (overall summary of reason if not approved, or 'Content is appropriate and relevant' if approved)",
  "language": "english" | "tagalog" | "bisaya" | "mixed" | "unknown",
  "tone": "appropriate" | "inappropriate" | "aggressive" | "neutral"
}`;

    let completion = null;
    let lastError = null;

    for (const model of uniqueCandidates) {
      try {
        console.log(`[Groq Moderation] Attempting analysis with model: ${model}`);
        completion = await groq.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Target Office: ${officeName || 'General Office'}\nSubject: ${subject}\nDescription: ${description}`
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        });

        if (completion?.choices?.[0]?.message?.content) {
          console.log(`[Groq Moderation] Successfully completed with model: ${model}`);
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Groq Moderation] Model ${model} failed (${err?.status || err?.code}):`, err?.message || err);

        // If model not found or decommissioned, continue to the next candidate model
        if (
          err?.status === 404 ||
          err?.status === 400 ||
          err?.code === 'model_not_found' ||
          err?.code === 'model_decommissioned' ||
          err?.error?.code === 'model_decommissioned' ||
          (err?.message && (err.message.includes('not exist') || err.message.includes('decommissioned') || err.message.includes('access to it')))
        ) {
          continue;
        }
        break;
      }
    }

    if (completion?.choices?.[0]?.message?.content) {
      const rawText = completion.choices[0].message.content.trim();
      const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return res.status(200).json(parsed);
    }

    console.error("Groq Moderation could not complete with any candidate model. Last error:", lastError?.message || lastError);
    return res.status(200).json({
      approved: true,
      isRelevant: true,
      isSpam: false,
      hasProfanity: false,
      reason: "Fallback: AI service temporarily bypass",
      fallback: true
    });
  } catch (error) {
    console.error("Groq moderation server error:", error);
    return res.status(200).json({
      approved: true,
      reason: "Fallback: AI service temporarily bypass"
    });
  }
}
