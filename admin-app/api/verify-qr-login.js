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
    const { type, username, officeId, token } = req.body || {};

    if (!type || !token || !username) {
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

    if (type === 'staff') {
      const staffUsername = String(username).trim();
      const querySnapshot = await db.collection('staff').where('username', '==', staffUsername).get();

      if (querySnapshot.empty) {
        return res.status(404).json({ success: false, error: 'Staff account not found' });
      }

      const isMatchingOffice = (offA, offB) => {
        const a = String(offA || '').trim().toLowerCase();
        const b = String(offB || '').trim().toLowerCase();
        if (!a || !b) return false;
        if (a === b) return true;
        if ((a === 'accounting' || a === 'finance') && (b === 'accounting' || b === 'finance')) {
          return true;
        }
        return false;
      };

      let matchedDoc = null;
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const staffOfficeId = (data.officeId || '').toLowerCase();
        const staffOfficeName = (data.office || '').toLowerCase();
        if (!officeId || isMatchingOffice(staffOfficeId, officeId) || isMatchingOffice(staffOfficeName, officeId)) {
          matchedDoc = docSnap;
          break;
        }
      }

      if (!matchedDoc) {
        return res.status(400).json({ success: false, error: 'Staff office mismatch' });
      }

      const staffDoc = matchedDoc;
      const staffData = staffDoc.data();

      if (staffData.isActive === false) {
        return res.status(403).json({ success: false, error: 'Staff account is deactivated' });
      }

      if (!staffData.qrToken || staffData.qrToken !== token) {
        return res.status(401).json({ success: false, error: 'Invalid or revoked QR code token' });
      }

      let customToken = null;
      try {
        customToken = await auth.createCustomToken(staffData.uid);
      } catch (authErr) {
        console.warn('[verify-qr-login] createCustomToken error:', authErr.message);
        return res.status(500).json({ success: false, error: 'Failed to issue auth token: ' + authErr.message });
      }

      return res.json({
        success: true,
        customToken,
        userData: {
          ...staffData,
          firestoreDocId: staffDoc.id
        }
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid login type' });
  } catch (error) {
    console.error('[verify-qr-login error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};
