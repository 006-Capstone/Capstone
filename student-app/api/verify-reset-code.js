// Import the shared verification codes store
import { verificationCodes } from './send-reset-code.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and code are required'
      });
    }

    const storedData = verificationCodes.get(email);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found for this email'
      });
    }

    // Check if code expired
    if (Date.now() > storedData.expiry) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    // Check if code matches
    if (storedData.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    console.log(`[Success] Code verified for ${email}`);

    // Don't delete the code yet - will delete after password reset
    return res.status(200).json({
      success: true,
      message: 'Verification code is valid'
    });

  } catch (error) {
    console.error('[Error] Failed to verify code:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify code'
    });
  }
}
