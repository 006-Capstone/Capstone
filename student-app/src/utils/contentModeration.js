// AI-Powered Content Moderation using Groq
import Groq from 'groq-sdk';

// Initialize Groq AI
const groq = new Groq({
  apiKey: process.env.REACT_APP_GROQ_API_KEY || '',
  dangerouslyAllowBrowser: true // Required for client-side usage
});

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
 * AI-powered content validation using Groq
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

  try {
    // Create a comprehensive prompt for the AI
    const officeContext = officeName ? `\nOffice: "${officeName}"` : '';
    const prompt = `You are an INTELLIGENT content moderator for a school ticketing system. Analyze the following student request and provide a JSON response.
${officeContext}
Subject: "${subject}"
Description: "${description}"

IMPORTANT CONTEXT:
- The system allows custom subjects to be added by administrators
- You must be INTELLIGENT and FLEXIBLE when validating custom subjects
- DO NOT rely only on predefined examples - UNDERSTAND what the subject is asking for based on its name and the office context
- For ANY subject, analyze the subject name itself to understand what it's asking for, then check if the description relates to that

CORE VALIDATION RULES:

1. PROFANITY CHECK (STRICT):
   - Detect bad words in English, Tagalog, and Bisaya
   - Examples: fuck, shit, puta, gago, tangina, yawa, buang, etc.
   - Detect offensive or aggressive language
   - Medical/academic terms are acceptable

2. RELEVANCE CHECK (INTELLIGENT & FLEXIBLE):
   
   **PRIMARY RULE**: The description must relate to what the SUBJECT NAME suggests.
   
   How to validate ANY subject (including custom ones):
   - Read the subject name carefully
   - Infer what topic it's about from the words used
   - Check if the description discusses that topic
   - Consider the office context to understand the domain
   
   **FOR MULTILINGUAL CONTENT**: 
   - If text is in Tagalog or Bisaya, be MORE LENIENT
   - Focus on keywords and overall topic match
   - Only mark as irrelevant if CLEARLY discussing a completely different topic
   
   **SMART KEYWORD MATCHING**:
   - For subjects with "Request", "Inquiry", "Application", "Appeal" - check if description asks for or discusses that type of request
   - For subjects with financial terms (Payment, Balance, Refund, Fee, Tuition) - look for money/payment-related discussion
   - For subjects with document terms (Form, Certificate, Transcript, Record) - look for document/paperwork discussion
   - For subjects with service terms (Counseling, Support, Assistance) - look for help/service requests
   
   **EXAMPLES OF INTELLIGENT VALIDATION**:
   
   ✓ VALID Custom Subject Examples:
   - Subject: "Scholarship Application" + Desc: "I want to apply for financial aid" = RELEVANT (financial assistance)
   - Subject: "Lost ID Card" + Desc: "I lost my school ID yesterday" = RELEVANT (matches subject)
   - Subject: "Uniform Complaint" + Desc: "My uniform size is wrong" = RELEVANT (uniform issue)
   - Subject: "Internet Access Problem" + Desc: "Cannot connect to school wifi" = RELEVANT (internet issue)
   - Subject: "Health Certificate" + Desc: "Need medical clearance form" = RELEVANT (health document)
   
   ✗ INVALID - Clear Mismatches:
   - Subject: "Scholarship Application" + Desc: "I lost my library book" = NOT RELEVANT (different topics)
   - Subject: "Lost ID Card" + Desc: "I need to pay my tuition" = NOT RELEVANT (payment vs ID)
   - Subject: "Uniform Complaint" + Desc: "Request for transcript" = NOT RELEVANT (uniform vs documents)

3. SPECIAL VALIDATION RULES (Keep these):
   
   **REFUND vs RECEIPT**:
   - "Refund Request" = asking for money back, return payment
   - "Receipt Request" = asking for proof of payment, official receipt
   - If description asks for money back but subject is "Receipt Request" = NOT RELEVANT
   
   **DOCUMENT TYPES**:
   - Form 137, Form 138, TOR, transcript, diploma, certificate = valid for document/certificate/transcript requests
   - Accept if description mentions any official school documents
   
   **FINANCIAL TERMS**:
   - For Finance office or payment-related subjects: accept terms like balance, tuition, payment, bayad, kwarta, refund
   
   **COMMON SUBJECTS** (if they appear, use strict checking):
   - Balance Verification → financial balance inquiry
   - Document Request → school records/forms
   - Grade Inquiry → academic grades/scores  
   - Book Request → library materials
   - Counseling → guidance services

4. LANGUAGE DETECTION:
   - English: "the", "is", "my", "please"
   - Tagalog: "ang", "po", "ko", "gusto", "kailangan"  
   - Bisaya: "og", "ug", "palihug", "nako"

5. SPAM DETECTION:
   - Gibberish, random characters, nonsensical text
   - Examples: "asdfasdf", "12345", repeated characters

6. TONE ANALYSIS:
   - Check if respectful and appropriate for school communication
   - Flag aggressive, rude, or demanding language

**KEY PRINCIPLE**: Be SMART, not RIGID. Understand what the subject is asking for, then check if the description discusses that topic. Accept valid requests even if they use custom or non-standard subjects.

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "hasProfanity": boolean,
  "profanityReason": "string (only if true)",
  "isRelevant": boolean,
  "relevanceReason": "string (explain if false)",
  "language": "english" | "tagalog" | "bisaya" | "mixed" | "unknown",
  "isSpam": boolean,
  "tone": "appropriate" | "inappropriate" | "aggressive" | "neutral"
}`;

    // Call Groq AI (using GPT-OSS 20B - current supported model)
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'openai/gpt-oss-20b', // Currently supported Groq model (as of 2026)
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 800 // Increased to ensure complete JSON response
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '';
    
    // Parse AI response
    let aiAnalysis;
    try {
      // Remove markdown code blocks if present
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Check if response is complete JSON (should end with })
      if (!cleanText.endsWith('}')) {
        console.warn('Incomplete AI response detected, using fallback validation');
        return {
          isValid: true,
          errors: [],
          warnings: ['AI validation temporarily unavailable. Your request will be manually reviewed.'],
          language: 'unknown'
        };
      }
      
      aiAnalysis = JSON.parse(cleanText);
    } catch (parseError) {
      console.warn('Failed to parse AI response (may be incomplete):', responseText.substring(0, 100));
      // Fallback to basic validation
      return {
        isValid: true,
        errors: [],
        warnings: ['AI validation temporarily unavailable. Your request will be manually reviewed.'],
        language: 'unknown'
      };
    }

    // Process AI analysis results
    if (aiAnalysis.hasProfanity) {
      errors.push(aiAnalysis.profanityReason || 'Inappropriate language detected. Please use respectful communication.');
    }

    if (!aiAnalysis.isRelevant) {
      errors.push(aiAnalysis.relevanceReason || 'Your description does not match the selected subject. Please ensure your description is relevant to the subject you chose.');
    }

    if (aiAnalysis.isSpam) {
      errors.push('Your description appears to contain spam or gibberish. Please provide a clear, meaningful explanation.');
    }

    if (aiAnalysis.tone === 'inappropriate' || aiAnalysis.tone === 'aggressive') {
      warnings.push('Please maintain a respectful and professional tone in your request.');
    }

    language = aiAnalysis.language || 'unknown';

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      language: language
    };

  } catch (error) {
    console.error('AI validation error:', error);
    
    // Fallback: return basic validation if AI fails
    return {
      isValid: true,
      errors: [],
      warnings: ['AI validation temporarily unavailable. Your request will be manually reviewed.'],
      language: 'unknown'
    };
  }
};
