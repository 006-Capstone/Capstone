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
    const { email, newPassword, verificationCode } = req.body || {};

    if (!email || !newPassword || !verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Email, new password, and verification code are required'
      });
    }

    const { app, auth, db, FieldValue } = await initFirebaseAdmin();
    let storedData = null;

    // Check Firestore first for verification code
    if (app && db) {
      try {
        const docSnap = await db.collection('passwordResetCodes').doc(email).get();
        if (docSnap.exists) {
          storedData = docSnap.data();
        }
      } catch (firestoreError) {
        console.warn('[Warning] Could not read reset code from Firestore:', firestoreError.message);
      }
    }

    // Fallback to in-memory map
    if (!storedData) {
      storedData = verificationCodes.get(email);
    }

    if (!storedData || storedData.code !== verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code'
      });
    }

    if (Date.now() > storedData.expiry) {
      verificationCodes.delete(email);
      if (app && db) {
        try {
          await db.collection('passwordResetCodes').doc(email).delete();
        } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    if (!app || !auth) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin authentication is not configured on the server'
      });
    }

    // Get user by email
    const userRecord = await auth.getUserByEmail(email);

    // Update password using Firebase Admin SDK
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });

    // Clear QR code data from Firestore (students collection)
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

      // Delete the verification code after successful password reset
      try {
        await db.collection('passwordResetCodes').doc(email).delete();
      } catch (e) {}
    }

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
      error: error.message || 'Failed to reset password'
    });
  }
};
module.exports.default = module.exports;
