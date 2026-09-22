const { initFirebaseAdmin, findVerificationCode, deleteVerificationCode } = require('./_firebase.js');

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
    const { email, studentId, username, newPassword, verificationCode } = req.body || {};

    if ((!email && !studentId && !username) || !newPassword || !verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Email or ID, new password, and verification code are required'
      });
    }

    const adminInit = await initFirebaseAdmin();
    const { app, auth, db, FieldValue } = adminInit;
    if (!app || !auth) {
      const detail = adminInit.error ? adminInit.error.message : 'Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY';
      return res.status(500).json({
        success: false,
        error: `Firebase Admin authentication is not configured on the server (${detail}). Please ensure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are added to your Vercel Project Settings > Environment Variables.`
      });
    }

    const normCode = String(verificationCode).trim();
    const result = await findVerificationCode({ email, studentId, username });

    if (!result || !result.data) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code'
      });
    }

    const storedData = result.data;
    const expiry = storedData.expiry || storedData.expiresAt || 0;

    if (Date.now() > expiry) {
      await deleteVerificationCode({ email, studentId, username });
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    if (String(storedData.code).trim() !== normCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    const targetEmail = (email || storedData.email || '').toLowerCase().trim();
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        error: 'No valid target email found for this account'
      });
    }

    // Get user by email in Firebase Auth
    const userRecord = await auth.getUserByEmail(targetEmail);

    // Update password using Firebase Admin SDK
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });

    // Clear QR code data from Firestore (students collection) if student
    if (db) {
      try {
        const studentsRef = db.collection('students');
        const studentQuery = await studentsRef.where('uid', '==', userRecord.uid).get();
        
        if (!studentQuery.empty) {
          const studentDoc = studentQuery.docs[0];
          await studentDoc.ref.update({
            qrCodeData: '',
            qrCodeGeneratedAt: null,
            lastPasswordUpdate: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
          });
          console.log(`[Success] Cleared QR code data for student UID: ${userRecord.uid}`);
        }
      } catch (qrError) {
        console.error('[Warning] Failed to clear QR code data:', qrError);
      }

      // Also update lastPasswordUpdate in staff collection if applicable
      try {
        const staffRef = db.collection('staff');
        const staffQuery = await staffRef.where('email', '==', targetEmail).get();
        if (!staffQuery.empty) {
          await staffQuery.docs[0].ref.update({
            lastPasswordUpdate: FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString()
          });
        }
      } catch (staffErr) {
        console.error('[Warning] Failed to update staff document:', staffErr);
      }
    }

    // Delete verification code from Firestore
    await deleteVerificationCode({ email: targetEmail, studentId, username });
    console.log(`[Success] Password reset for ${targetEmail}`);

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
      error: error.message || 'Failed to reset password'
    });
  }
};
module.exports.default = module.exports;
