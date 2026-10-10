const { initFirebaseAdmin } = require('./_firebase.js');

module.exports = async function handler(req, res) {
  // Explicitly return JSON headers and enable CORS
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }

    let { uid, email } = body;
    console.log('[API delete-user] Request received:', { uid, email });

    if (!uid && !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing user UID or email'
      });
    }

    const adminInit = await initFirebaseAdmin();
    const { auth } = adminInit;

    if (!auth) {
      const detail = adminInit.error ? adminInit.error.message : 'Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY';
      console.error('[API delete-user] Firebase Admin not configured:', detail);
      return res.status(500).json({
        success: false,
        error: `Firebase Admin authentication is not configured on the server (${detail}). Please ensure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are added to your Vercel Project Settings > Environment Variables.`
      });
    }

    // If UID is not provided, look up user by email
    if (!uid && email) {
      try {
        const userRecord = await auth.getUserByEmail(email.trim());
        uid = userRecord.uid;
        console.log(`[API delete-user] Found UID ${uid} for email ${email}`);
      } catch (findErr) {
        if (findErr.code === 'auth/user-not-found') {
          console.warn(`[API delete-user] User with email ${email} already not in Firebase Auth`);
          return res.json({
            success: true,
            message: 'User was already not in Firebase Auth'
          });
        }
        throw findErr;
      }
    }

    // Delete user from Firebase Authentication
    try {
      await auth.deleteUser(uid);
      console.log('[API delete-user] [Success] User deleted from Firebase Auth by UID:', uid);
    } catch (authError) {
      // If UID failed but we have an email, try one more time by email
      if (authError.code === 'auth/user-not-found' && email) {
        try {
          const userRecord = await auth.getUserByEmail(email.trim());
          await auth.deleteUser(userRecord.uid);
          console.log('[API delete-user] [Success] User deleted from Firebase Auth by email:', email);
          return res.json({
            success: true,
            message: 'User deleted from Firebase Auth by email'
          });
        } catch (e2) {
          if (e2.code === 'auth/user-not-found') {
            return res.json({
              success: true,
              message: 'User was already not in Firebase Auth'
            });
          }
        }
      }

      if (authError.code === 'auth/user-not-found') {
        console.warn('[API delete-user] User already not found in Firebase Auth:', uid);
        return res.json({
          success: true,
          message: 'User was already not in Firebase Auth'
        });
      }
      throw authError;
    }

    return res.json({
      success: true,
      message: 'User deleted from Firebase Authentication'
    });
  } catch (error) {
    console.error('[API delete-user] [Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user from Firebase Auth'
    });
  }
};
