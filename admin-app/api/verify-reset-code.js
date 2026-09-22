const { findVerificationCode, deleteVerificationCode } = require('./_firebase.js');

module.exports = async function handler(req, res) {
  // Explicitly set JSON headers and enable CORS
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, studentId, username, code } = req.body || {};

    if ((!email && !studentId && !username) || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email or ID and verification code are required'
      });
    }

    const normCode = String(code).trim();
    const result = await findVerificationCode({ email, studentId, username });

    if (!result || !result.data) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found for this email'
      });
    }

    const storedData = result.data;
    const expiry = storedData.expiry || storedData.expiresAt || 0;

    // Check if code expired
    if (Date.now() > expiry) {
      await deleteVerificationCode({ email, studentId, username });
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    // Check if code matches
    if (String(storedData.code).trim() !== normCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    console.log(`[Success] Code verified for ${email || studentId || username}`);

    return res.status(200).json({
      success: true,
      message: 'Verification code is valid'
    });

  } catch (error) {
    console.error('[Error] Failed to verify code:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify code'
    });
  }
};
module.exports.default = module.exports;
