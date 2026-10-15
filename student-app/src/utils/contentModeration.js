// AI-Powered Content Moderation using Backend Serverless Route and Local Defensive Guardrails
import { moderateContent } from '../services/contentModeration.js';
import { checkProfanity } from './profanityFilter.js';

export { moderateContent };

/**
 * Detect keyboard mashing, repeated characters, and spam patterns
 * @param {string} text - Text to check
 * @returns {{ isGibberish: boolean, reason: string }}
 */
export const detectGibberishOrSpam = (text) => {
  if (!text || typeof text !== 'string') {
    return { isGibberish: false, reason: '' };
  }

  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean);

  // 1. Require at least 3 distinct space-separated words for a detailed description
  if (words.length < 3) {
    return {
      isGibberish: true,
      reason: 'Please provide a clear description in complete sentences (at least 3 words).'
    };
  }

  // 2. Character repetition: 4+ identical characters in a row (e.g. "aaaaa", "xxxxxx", "11111")
  // Allowing dots for ellipses (e.g. "...")
  const nonEllipsis = clean.replace(/\.{2,}/g, '');
  if (/(.)\1{3,}/i.test(nonEllipsis)) {
    return {
      isGibberish: true,
      reason: 'Description contains excessive repetitive characters. Please describe your concern clearly.'
    };
  }

  // 3. Repeated word patterns: same word repeated 3+ times in sequence (e.g. "test test test")
  if (/\b([a-zA-Z0-9]+)\b(?:\s+\1\b){2,}/i.test(clean)) {
    return {
      isGibberish: true,
      reason: 'Description contains repeated words. Please explain your concern in natural sentences.'
    };
  }

  // 4. Low vocabulary diversity: if 6+ words but fewer than 40% are unique
  if (words.length >= 6) {
    const unique = new Set(words.map((w) => w.toLowerCase()));
    if (unique.size / words.length < 0.4) {
      return {
        isGibberish: true,
        reason: 'Description is too repetitive. Please write a meaningful explanation of your request.'
      };
    }
  }

  // 5. Unnatural words without vowels (keyboard mashing like "asdfghjk", "zxcvbnm", "qwrtyp")
  const hasVowellessWord = words.some((w) => {
    // Only check alphabetical words of length 5 or greater
    return /^[a-zA-Z]{5,}$/.test(w) && !/[aeiouy]/i.test(w);
  });
  if (hasVowellessWord) {
    return {
      isGibberish: true,
      reason: 'Description contains unrecognizable words or random typing. Please use clear, valid words.'
    };
  }

  // 6. Substring repetition in a single word (e.g. "asdfasdfasdf", "123123123", "hahahahahaha")
  const hasSubstrRepeat = words.some((w) => /^([a-zA-Z0-9]{2,4})\1{2,}$/i.test(w));
  if (hasSubstrRepeat) {
    return {
      isGibberish: true,
      reason: 'Description contains repeated typing patterns. Please provide a clear explanation.'
    };
  }

  // 7. Overall vowel-to-letter ratio across alphabetical characters
  const lettersOnly = clean.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (lettersOnly.length >= 15) {
    const vowels = (lettersOnly.match(/[aeiouy]/g) || []).length;
    const ratio = vowels / lettersOnly.length;
    if (ratio < 0.15) {
      return {
        isGibberish: true,
        reason: 'Description appears to be random keystrokes. Please write a clear, readable inquiry.'
      };
    }
  }

  return { isGibberish: false, reason: '' };
};

/**
 * Check if description length is appropriate (basic check before AI)
 * @param {string} text - Text to check
 * @returns {object} - { isValid: boolean, message: string }
 */
export const checkDescriptionLength = (text) => {
  if (!text || text.trim().length === 0) {
    return { isValid: false, message: 'Description is required' };
  }

  if (text.trim().length < 20) {
    return { isValid: false, message: 'Description is too short. Please provide more details (at least 20 characters)' };
  }

  if (text.length > 1000) {
    return { isValid: false, message: 'Description is too long. Please keep it under 1000 characters' };
  }

  return { isValid: true, message: '' };
};

/**
 * AI-powered content validation using serverless moderation route with robust local guardrails
 * @param {string} subject - Selected subject
 * @param {string} description - Description text
 * @param {string} officeName - Selected office name (optional)
 * @returns {Promise<object>} - { isValid: boolean, errors: array, warnings: array, language: string }
 */
export const validateContent = async (subject, description, officeName = '') => {
  const errors = [];
  const warnings = [];
  let language = 'unknown';

  // 1. Quick length check first
  const lengthCheck = checkDescriptionLength(description);
  if (!lengthCheck.isValid) {
    return {
      isValid: false,
      errors: [lengthCheck.message],
      warnings: [],
      language: 'unknown'
    };
  }

  // 2. Gibberish and spam detection (rejects random mashing, single-word inputs, repeated keys)
  const gibberishCheck = detectGibberishOrSpam(description);
  if (gibberishCheck.isGibberish) {
    return {
      isValid: false,
      errors: [gibberishCheck.reason],
      warnings: [],
      language: 'unknown'
    };
  }

  // 3. Local Profanity Check (English & Filipino / Tagalog)
  const combinedText = `${subject || ''} ${description || ''}`;
  const profanityCheck = checkProfanity(combinedText);
  if (profanityCheck.hasProfanity) {
    return {
      isValid: false,
      errors: ['Inappropriate or offensive language detected. Please use respectful and professional communication.'],
      warnings: [],
      language: 'unknown'
    };
  }

  // 4. Check for Form 137 requests (BLOCKED for students)
  const form137Pattern = /\b(form\s*137|f\.?\s*137|137\s*form|sf\s*10|sf10)\b/gi;
  if (form137Pattern.test(combinedText)) {
    return {
      isValid: false,
      errors: ['Form 137 / SF10 requests are not permitted directly through this portal. Form 137 is only released to transferring institutions upon completion of official clearance.'],
      warnings: [],
      language: 'english'
    };
  }

  // 5. Remote AI Analysis (Groq LLaMA 3.1)
  try {
    const aiAnalysis = await moderateContent(subject, description, officeName);

    // Process AI analysis results
    if (aiAnalysis && typeof aiAnalysis === 'object') {
      if (aiAnalysis.fallback) {
        warnings.push('AI service is temporarily in offline fallback mode. Request has passed screening rules and will be reviewed by staff.');
      }

      if (aiAnalysis.approved === false) {
        errors.push(aiAnalysis.reason || 'Your description does not match the selected subject or contains inappropriate content.');
      }

      if (aiAnalysis.hasProfanity) {
        errors.push(aiAnalysis.profanityReason || 'Inappropriate language detected. Please use respectful communication.');
      }

      if (aiAnalysis.isRelevant === false && !errors.length) {
        errors.push(aiAnalysis.relevanceReason || 'Your description does not match the selected subject. Please ensure your description is relevant to the subject you chose.');
      }

      if (aiAnalysis.isSpam) {
        errors.push(aiAnalysis.spamReason || 'Your description appears to contain spam or nonsensical text. Please provide a clear explanation.');
      }

      if (aiAnalysis.tone === 'inappropriate' || aiAnalysis.tone === 'aggressive') {
        warnings.push('Please maintain a respectful and professional tone in your request.');
      }

      language = aiAnalysis.language || 'unknown';
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      language: language
    };

  } catch (error) {
    console.warn('[contentModeration] AI moderation endpoint unavailable:', error?.message || error);

    // Because local checks (length, min 3 words, no keyboard mash, no spam repetitions, no profanity, no Form 137)
    // already verified the text, we can safely allow submission with an informational note
    return {
      isValid: true,
      errors: [],
      warnings: [
        'AI server is temporarily offline. Your request has passed local screening and will be reviewed manually by school staff.'
      ],
      language: 'unknown'
    };
  }
};
