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
    const { uid } = req.body || {};

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: 'Missing user UID'
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

    // Delete user from Firebase Authentication
    try {
      await auth.deleteUser(uid);
      console.log('[Success] User deleted from Firebase Auth:', uid);
    } catch (authError) {
      // If user was already deleted from Auth, treat as success so cleanup can continue
      if (authError.code === 'auth/user-not-found') {
        console.warn('[Warning] User already not found in Firebase Auth:', uid);
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
    console.error('[Error] Error deleting user from Firebase Auth:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete user from Firebase Auth'
    });
  }
};
