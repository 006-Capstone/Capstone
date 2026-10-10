let adminApp = null;
let adminDb = null;
let adminAuth = null;
let adminFieldValue = null;

/**
 * Dynamically import Firebase Admin SDK to avoid top-level require('firebase-admin')
 * which crashes with ERR_REQUIRE_ESM on Vercel serverless functions.
 */
async function initFirebaseAdmin() {
  if (adminApp && adminAuth) {
    return { app: adminApp, auth: adminAuth, db: adminDb, FieldValue: adminFieldValue };
  }

  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let projectId = process.env.FIREBASE_PROJECT_ID || 'academia-de-san-jose';

  // Support full service account JSON in environment variables if provided
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawServiceAccount) {
    try {
      let parsed = null;
      try {
        parsed = JSON.parse(rawServiceAccount);
      } catch (e) {
        parsed = JSON.parse(Buffer.from(rawServiceAccount, 'base64').toString('utf8'));
      }
      if (parsed) {
        if (parsed.private_key) privateKey = parsed.private_key;
        if (parsed.client_email) clientEmail = parsed.client_email;
        if (parsed.project_id) projectId = parsed.project_id;
      }
    } catch (e) {
      console.warn('[Warning] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
    }
  }

  // Also check if local serviceAccountKey.json exists (for local testing)
  if (!clientEmail || !privateKey) {
    try {
      const fs = require('fs');
      const path = require('path');
      const localKeyPaths = [
        path.join(__dirname, 'serviceAccountKey.json'),
        path.join(__dirname, '..', 'serviceAccountKey.json'),
        path.join(__dirname, '..', '..', 'email-backend', 'serviceAccountKey.json')
      ];
      for (const p of localKeyPaths) {
        if (fs.existsSync(p)) {
          const sa = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (sa.private_key && sa.client_email) {
            privateKey = sa.private_key;
            clientEmail = sa.client_email;
            projectId = sa.project_id || projectId;
            break;
          }
        }
      }
    } catch (_) {}
  }

  if (privateKey) {
    privateKey = privateKey.trim();
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    // Handle base64 encoded private key if provided
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
        if (decoded.includes('BEGIN PRIVATE KEY')) {
          privateKey = decoded;
        }
      } catch (e) {}
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!clientEmail || !privateKey) {
    const missing = [];
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
    const msg = `Missing required environment variable(s) in Vercel: ${missing.join(', ')}`;
    console.warn(`[Warning] Firebase Admin cannot initialize: ${msg}`);
    return { app: null, auth: null, db: null, FieldValue: null, error: new Error(msg) };
  }

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue: fv } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');
    adminFieldValue = fv;

    const apps = getApps();
    if (!apps.length) {
      adminApp = initializeApp({
        credential: cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey,
        }),
      });
    } else {
      adminApp = apps[0];
    }

    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);

    return { app: adminApp, auth: adminAuth, db: adminDb, FieldValue: adminFieldValue };
  } catch (err) {
    console.error('[Error] Firebase Admin dynamic init failed:', err.message);
    return { app: null, auth: null, db: null, FieldValue: null, error: err };
  }
}

module.exports = {
  initFirebaseAdmin
};
