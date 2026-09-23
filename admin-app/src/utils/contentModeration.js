// AI-Powered Content Moderation for Admin Notes using Groq
import Groq from 'groq-sdk';

const apiKey = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_GROQ_API_KEY || import.meta.env.REACT_APP_GROQ_API_KEY)) ||
  (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_GROQ_API_KEY || process.env.GROQ_API_KEY));

// Initialize Groq AI client when apiKey is present
let groq = null;
if (apiKey) {
  try {
    groq = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true // Required for client-side usage
    });
  } catch (initErr) {
    console.warn('Groq client initialization warning:', initErr);
  }
}

const getGroqClient = () => {
  if (groq) return groq;
  const currentKey = 
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_GROQ_API_KEY || import.meta.env.REACT_APP_GROQ_API_KEY)) ||
    (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_GROQ_API_KEY || process.env.GROQ_API_KEY));

  if (!currentKey) {
    throw new Error('Groq API key is missing or not configured');
  }

  groq = new Groq({
    apiKey: currentKey,
    dangerouslyAllowBrowser: true
  });
  return groq;
};

/**
 * Validate reassignment note for inappropriate language
 * @param {string} note - Reassignment note text
 * @returns {Promise<object>} - { isValid: boolean, message: string }
 */
export const validateReassignmentNote = async (note) => {
  // Basic checks first
  if (!note || note.trim().length === 0) {
    return { isValid: false, message: 'Reassignment note is required' };
  }

  if (note.trim().length < 10) {
    return { isValid: false, message: 'Please provide a detailed reason (at least 10 characters)' };
  }

  try {
    const prompt = `You are a STRICT content moderator for a school administrative system. Analyze the following reassignment note written by a staff member and check ONLY for inappropriate language.

Reassignment Note: "${note}"

**VALIDATION RULES:**

1. **PROFANITY CHECK (STRICT)**:
   - Detect bad words, curse words, or foul language in English, Tagalog, and Bisaya
   - Examples: fuck, shit, damn, hell, ass, puta, gago, tangina, putangina, yawa, buang, piste, etc.
   - Detect offensive, aggressive, or disrespectful language
   - Detect insults or derogatory terms
   - Professional/technical terms are acceptable

2. **TONE CHECK**:
   - Flag aggressive, rude, condescending, or unprofessional language
   - Flag sarcasm or mocking tone
   - Note: Direct/blunt language is acceptable as long as it's professional

3. **ACCEPTABLE LANGUAGE**:
   - Professional, formal, or neutral language is OK
   - Technical jargon or office-specific terms are OK
   - Being direct or factual is OK

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "hasProfanity": boolean,
  "reason": "string (explain what was inappropriate, or empty if clean)",
  "tone": "professional" | "unprofessional" | "aggressive" | "neutral"
}`;

    const client = getGroqClient();
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama3-8b-8192', // Fast and reliable model for simple moderation
      temperature: 0.1,
      max_tokens: 512
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '';
    
    // Parse AI response
    let aiAnalysis;
    try {
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      if (!cleanText.endsWith('}')) {
        throw new Error('Incomplete AI response received');
      }
      
      aiAnalysis = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Response:', responseText);
      throw new Error('AI validation failed to parse response');
    }

    // Check results
    if (aiAnalysis.hasProfanity) {
      return {
        isValid: false,
        message: aiAnalysis.reason || 'Inappropriate language detected in reassignment note. Please use professional communication.'
      };
    }

    if (aiAnalysis.tone === 'unprofessional' || aiAnalysis.tone === 'aggressive') {
      return {
        isValid: false,
        message: 'Please maintain a professional and respectful tone in reassignment notes.'
      };
    }

    return {
      isValid: true,
      message: ''
    };

  } catch (error) {
    console.error("Moderation error:", error);
    
    // Fallback: Allow submission with warning
    console.warn('[Fallback] AI validation failed, allowing submission');
    
    return {
      isValid: true,
      message: ''
    };
  }
};
