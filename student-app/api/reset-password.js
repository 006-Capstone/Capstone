import { getAdminApp, getAuth, getFirestore, FieldValue } from './_firebase.js';
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
    const { email, newPassword, verificationCode } = req.body;

    if (!email || !newPassword || !verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Email, new password, and verification code are required'
      });
    }

    const app = getAdminApp();
    let storedData = null;

    // Check Firestore first for verification code
    if (app) {
      try {
        const db = getFirestore(app);
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
      if (app) {
        try {
          const db = getFirestore(app);
          await db.collection('passwordResetCodes').doc(email).delete();
        } catch (e) {}
      }
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    if (!app) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin authentication is not configured on the server'
      });
    }

    const auth = getAuth(app);
    const db = getFirestore(app);

    // Get user by email
    const userRecord = await auth.getUserByEmail(email);

    // Update password using Firebase Admin SDK
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });

    // Clear QR code data from Firestore (students collection)
    try {
      const studentsRef = db.collection('students');
      const studentQuery = await studentsRef.where('uid', '==', userRecord.uid).get();
      
      if (!studentQuery.empty) {
        const studentDoc = studentQuery.docs[0];
        await studentDoc.ref.update({
          qrCodeData: '',
          qrCodeGeneratedAt: null,
          lastPasswordUpdate: FieldValue.serverTimestamp()
        });
        console.log(`[Success] Cleared QR code data for student UID: ${userRecord.uid}`);
      }
    } catch (qrError) {
      console.error('[Warning] Failed to clear QR code data:', qrError);
      // Don't fail the password reset if QR clearing fails
    }

    // Delete the verification code after successful password reset
    verificationCodes.delete(email);
    try {
      await db.collection('passwordResetCodes').doc(email).delete();
    } catch (e) {}

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
}
