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
    // Create a comprehensive prompt for the AI
    const officeContext = officeName ? `\nOffice: "${officeName}"` : '';
    const prompt = `You are a STRICT content moderator for a school ticketing system. Analyze the following student request and provide a JSON response.
${officeContext}
Subject: "${subject}"
Description: "${description}"

IMPORTANT: You must be PRECISE and STRICT when validating. Do not accept "close enough" matches.

**CORE VALIDATION RULES:**

1. **PROFANITY CHECK (STRICT)**:
   - Detect bad words in English, Tagalog, and Bisaya
   - Examples: fuck, shit, puta, gago, tangina, yawa, buang, etc.
   - Detect offensive or aggressive language
   - Medical/academic terms are acceptable

2. **RELEVANCE CHECK (STRICT & PRECISE)**:
   
   **PRIMARY RULE**: The description must PRECISELY match what the subject is asking for.
   
   **BE STRICT - NOT LENIENT**:
   - Don't accept "close enough" matches
   - The description must specifically discuss what the subject name indicates
   - If the subject says "Billing Inquiry" and the description asks about "balance" → NOT RELEVANT
   - If the subject says "Document Request" and the description asks about "payment" → NOT RELEVANT
   
   **SUBJECT-SPECIFIC VALIDATION**:
   
   Finance Office Subjects:
   - "Billing Inquiry" = Questions about bills, invoices, charges, billing statements ONLY
     ❌ NOT: balance checking, payments, refunds
   - "Balance Verification" = Check remaining balance, outstanding amount, how much is owed
   - "Payment Plan" = Request installment, payment arrangement, payment schedule
   - "Refund Request" = Request money back, return payment, reimbursement
   
   Registrar Office Subjects:
   - "Document Request" = Request school records, forms, certificates, transcripts, diplomas
   - "Grade Inquiry" = Questions about grades, scores, academic performance
   - "Enrollment Issue" = Problems with enrollment, registration, class scheduling
   - "Transcript Request" = Request official transcript, TOR, academic records
   
   Library Office Subjects:
   - "Book Request" = Request to borrow books, reserve materials
   - "Lost Book Report" = Report lost or damaged library materials
   - "Library Card Issue" = Problems with library card, access, account
   - "Resource Access" = Problems accessing library resources, databases
   
   Guidance Office Subjects:
   - "Counseling Request" = Request guidance counseling, mental health support
   - "Disciplinary Appeal" = Appeal disciplinary action, violation, sanctions
   - "Behavior Report" = Report student behavior issues
   - "Support Services" = Request academic or personal support
   
   **STRICT EXAMPLES**:
   
   ❌ INVALID - Precise Mismatches:
   - Subject: "Billing Inquiry" + Desc: "I want to check my balance" = NOT RELEVANT (billing vs balance)
   - Subject: "Billing Inquiry" + Desc: "How much do I owe?" = NOT RELEVANT (that's balance verification)
   - Subject: "Document Request" + Desc: "I need to pay my fees" = NOT RELEVANT (document vs payment)
   - Subject: "Payment Plan" + Desc: "Can I get a refund?" = NOT RELEVANT (payment plan vs refund)
   - Subject: "Grade Inquiry" + Desc: "I need my transcript" = NOT RELEVANT (grades vs transcript document)
   
   ✓ VALID - Precise Matches:
   - Subject: "Billing Inquiry" + Desc: "Why did I receive this bill?" = RELEVANT (asking about a bill)
   - Subject: "Billing Inquiry" + Desc: "What are these charges on my invoice?" = RELEVANT (asking about billing)
   - Subject: "Balance Verification" + Desc: "I want to check my balance" = RELEVANT (exact match)
   - Subject: "Balance Verification" + Desc: "How much do I still owe?" = RELEVANT (balance question)
   - Subject: "Document Request" + Desc: "I need Form 137" = BLOCKED (Form 137 not allowed)
   - Subject: "Document Request" + Desc: "I need my certificate" = RELEVANT (document request)
   - Subject: "Grade Inquiry" + Desc: "Why is my grade low?" = RELEVANT (grade question)

3. **SPECIAL VALIDATION RULES**:
   
   **FORM 137 - STRICTLY BLOCKED**:
   - Students CANNOT request Form 137 through this system
   - If description mentions "Form 137", "F.137", "137 form", or similar → BLOCK immediately
   - Return: isRelevant = false, relevanceReason = "Form 137 requests are not allowed. Form 137 is only released to transferring students upon completion of clearance."

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

    // Call Groq AI (using GPT-OSS 20B - fastest current model)
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'openai/gpt-oss-20b', // Current supported Groq model (1000 T/sec)
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 1024 // Increased to ensure complete JSON response
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '';
    
    // Parse AI response
    let aiAnalysis;
    try {
      // Remove markdown code blocks if present
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Check if response is complete JSON (should end with })
      if (!cleanText.endsWith('}')) {
        throw new Error('Incomplete AI response received');
      }
      
      aiAnalysis = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'Response:', responseText.substring(0, 100));
      throw new Error('AI validation failed to parse response');
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
    // Re-throw the error - no fallback, validation must work
    throw error;
  }
};
