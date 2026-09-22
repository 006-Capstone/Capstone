const { initFirebaseAdmin } = require('./_firebase.js');
const { verificationCodes } = require('./_codes.js');

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
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and code are required'
      });
    }

    let storedData = null;

    // Check Firestore first (persisted across serverless containers)
    try {
      const { app, db } = await initFirebaseAdmin();
      if (app && db) {
        const docSnap = await db.collection('passwordResetCodes').doc(email).get();
        if (docSnap.exists) {
          storedData = docSnap.data();
        }
      }
    } catch (firestoreError) {
      console.warn('[Warning] Could not read reset code from Firestore:', firestoreError.message);
    }

    // Fallback to in-memory store
    if (!storedData) {
      storedData = verificationCodes.get(email);
    }

    if (!storedData) {
      return res.status(400).json({
        success: false,
        error: 'No verification code found for this email'
      });
    }

    // Check if code expired
    if (Date.now() > storedData.expiry) {
      verificationCodes.delete(email);
      try {
        const { app, db } = await initFirebaseAdmin();
        if (app && db) {
          await db.collection('passwordResetCodes').doc(email).delete();
        }
      } catch (e) {}
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
      error: error.message || 'Failed to verify code'
    });
  }
};
module.exports.default = module.exports;
