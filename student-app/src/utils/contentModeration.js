// AI-Powered Content Moderation using Backend Serverless Route
import { moderateContent } from '../services/contentModeration';

export { moderateContent };

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
 * AI-powered content validation using serverless moderation route
 * @param {string} subject - Selected subject
 * @param {string} description - Description text
 * @param {string} officeName - Selected office name (optional)
 * @returns {Promise<object>} - { isValid: boolean, errors: array, warnings: array, language: string }
 */
export const validateContent = async (subject, description, officeName = '') => {
  const errors = [];
  const warnings = [];
  let language = 'unknown';
  
  // Quick length check first
  const lengthCheck = checkDescriptionLength(description);
  if (!lengthCheck.isValid) {
    return {
      isValid: false,
      errors: [lengthCheck.message],
      warnings: [],
      language: 'unknown'
    };
  }

  // Check for Form 137 requests (BLOCKED for students)
  const form137Pattern = /\b(form\s*137|f\.?\s*137|137\s*form)\b/gi;
  const combinedText = `${subject} ${description}`.toLowerCase();
  
  if (form137Pattern.test(combinedText)) {
    return {
      isValid: false,
      errors: ['Form 137 requests are not allowed. Form 137 is only released to transferring students upon completion of clearance. Please contact the Registrar Office directly if you are transferring.'],
      warnings: [],
      language: 'english'
    };
  }

  try {
    const aiAnalysis = await moderateContent(subject, description);

    // Process AI analysis results
    if (aiAnalysis) {
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
        errors.push('Your description appears to contain spam or gibberish. Please provide a clear, meaningful explanation.');
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
    console.error("Moderation error:", error);
    
    // Fallback: Allow submission with basic validation only
    console.warn('[Fallback] AI validation failed, using basic validation only');
    
    return {
      isValid: true,
      errors: [],
      warnings: [
        'AI content moderation is temporarily unavailable. Your request will be reviewed manually by staff.',
        'Please ensure your description is relevant to the selected subject.'
      ],
      language: 'unknown'
    };
  }
};
