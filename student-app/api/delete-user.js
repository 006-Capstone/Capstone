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
      return res.status(500).json({
        success: false,
        error: `Firebase Admin authentication is not configured on the server (${detail}). Please ensure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are added to your Vercel Project Settings > Environment Variables.`
      });
    }

    // If UID is not provided, look up user by email
    if (!uid && email) {
      try {
        const userRecord = await auth.getUserByEmail(email.trim().toLowerCase());
        uid = userRecord.uid;
      } catch (lookupErr) {
        if (lookupErr.code === 'auth/user-not-found') {
          return res.status(200).json({
            success: true,
            warning: 'User already deleted or not found in Firebase Auth'
          });
        }
        throw lookupErr;
      }
    }

    await auth.deleteUser(uid);

    return res.status(200).json({
      success: true,
      message: `User ${uid} successfully deleted from Firebase Auth`
    });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(200).json({
        success: true,
        warning: 'User already deleted or not found in Firebase Auth'
      });
    }
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user'
    });
  }
};
