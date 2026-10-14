const { initFirebaseAdmin } = require('./_firebase.js');

module.exports = async function handler(req, res) {
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
    const { type, id, username, officeId, token } = req.body || {};

    if (!type || !token || (!id && !username)) {
      return res.status(400).json({ success: false, error: 'Missing required login parameters' });
    }

    const adminInit = await initFirebaseAdmin();
    const { auth, db } = adminInit;

    if (!auth || !db) {
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin authentication is not configured on the server. Please verify your credentials or generate a new QR code.'
      });
    }

    if (type === 'student') {
      const studentId = String(id).trim();
      let querySnapshot = await db.collection('students').where('id', '==', studentId).get();
      if (querySnapshot.empty) {
        querySnapshot = await db.collection('students').where('studentId', '==', studentId).get();
      }

      if (querySnapshot.empty) {
        return res.status(404).json({ success: false, error: 'Student account not found' });
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();

      if (studentData.isActive === false) {
        return res.status(403).json({ success: false, error: 'Student account is suspended' });
      }

      if (!studentData.qrToken || studentData.qrToken !== token) {
        return res.status(401).json({ success: false, error: 'Invalid or revoked QR code token' });
      }

      let customToken = null;
      try {
        customToken = await auth.createCustomToken(studentData.uid);
      } catch (authErr) {
        console.warn('[verify-qr-login] createCustomToken error:', authErr.message);
        return res.status(500).json({ success: false, error: 'Failed to issue auth token: ' + authErr.message });
      }

      return res.json({
        success: true,
        customToken,
        userData: {
          ...studentData,
          firestoreDocId: studentDoc.id
        }
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid login type' });
  } catch (error) {
    console.error('[verify-qr-login error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};
