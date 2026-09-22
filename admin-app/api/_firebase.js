let adminApp = null;
let adminAuth = null;
let adminDb = null;
let FieldValue = null;

/**
 * Lazily and dynamically initialize Firebase Admin SDK using dynamic import()
 * to prevent Vercel CommonJS bundling and runtime ERR_REQUIRE_ESM crashes.
 */
async function initFirebaseAdmin() {
  if (adminApp && adminDb) {
    return { app: adminApp, auth: adminAuth, db: adminDb, FieldValue };
  }

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const { getFirestore, FieldValue: fv } = await import('firebase-admin/firestore');
    FieldValue = fv;

    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (projectId && clientEmail && privateKey) {
        if (typeof privateKey === 'string') {
          privateKey = privateKey.replace(/\\n/g, '\n');
        }
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey
          })
        });
      } else {
        adminApp = initializeApp();
      }
    }

    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);

    return { app: adminApp, auth: adminAuth, db: adminDb, FieldValue };
  } catch (err) {
    console.error('[Error] Firebase Admin dynamic initialization failed:', err);
    return { app: null, auth: null, db: null, FieldValue: null, error: err };
  }
}

async function getAdminApp() {
  const { app } = await initFirebaseAdmin();
  return app;
}

async function getAdminAuth() {
  const { auth } = await initFirebaseAdmin();
  return auth;
}

async function getAdminDb() {
  const { db } = await initFirebaseAdmin();
  return db;
}

async function getFieldValue() {
  const { FieldValue: fv } = await initFirebaseAdmin();
  return fv;
}

module.exports = {
  initFirebaseAdmin,
  getAdminApp,
  getAdminAuth,
  getAdminDb,
  getFieldValue,
  getAuth: getAdminAuth,
  getFirestore: getAdminDb
};
module.exports.default = module.exports;
