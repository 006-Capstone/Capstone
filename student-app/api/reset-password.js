const admin = require('firebase-admin');
import { verificationCodes } from './send-reset-code.js';

// Initialize Firebase Admin
if (!admin.apps || admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } catch (error) {
    console.error('[Error] Firebase Admin initialization failed:', error);
  }
}

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
    const { email, newPassword, verificationCode } = req.body;

    if (!email || !newPassword || !verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Email, new password, and verification code are required'
      });
    }

    // Verify the code one more time
    const storedData = verificationCodes.get(email);

    if (!storedData || storedData.code !== verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code'
      });
    }

    if (Date.now() > storedData.expiry) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Update password using Firebase Admin SDK
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword
    });

    // Delete the verification code after successful password reset
    verificationCodes.delete(email);

    console.log(`[Success] Password reset for ${email}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('[Error] Failed to reset password:', error);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
}
