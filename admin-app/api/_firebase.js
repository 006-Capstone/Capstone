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
      const projectId = process.env.FIREBASE_PROJECT_ID || 'academia-de-san-jose';
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;

      let serviceAccount = null;
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (e) {
          console.warn('[Warning] Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
        }
      } else if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
        } catch (e) {
          console.warn('[Warning] Could not parse FIREBASE_ADMIN_CREDENTIALS JSON:', e.message);
        }
      }

      if (serviceAccount && serviceAccount.private_key) {
        if (typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        adminApp = initializeApp({
          credential: cert(serviceAccount)
        });
      } else if (projectId && clientEmail && privateKey) {
        if (typeof privateKey === 'string') {
          privateKey = privateKey.trim();
          if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
              (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
            privateKey = privateKey.slice(1, -1);
          }
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
        adminApp = initializeApp({ projectId });
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

/**
 * Persist verification code to Firestore collections ('password_resets' and 'verification_codes')
 */
async function saveVerificationCode({ email, studentId, studentName, code, expiryMinutes = 10 }) {
  const { db, FieldValue: fv } = await initFirebaseAdmin();
  if (!db) {
    throw new Error('Database service is not available');
  }

  const normEmail = (email || '').toLowerCase().trim();
  const normId = (studentId || '').toString().trim();
  const normCode = (code || '').toString().trim();
  // Ensure expiration allows at least 5-10 minutes
  const minutes = Math.max(Number(expiryMinutes) || 10, 10);
  const expiryTime = Date.now() + (minutes * 60 * 1000);

  const docData = {
    code: normCode,
    email: normEmail,
    studentId: normId,
    studentName: studentName || '',
    expiry: expiryTime,
    expiresAt: expiryTime,
    expiryMinutes: minutes,
    createdAt: fv ? fv.serverTimestamp() : new Date().toISOString(),
    createdTimestamp: Date.now()
  };

  // Primary key by normalized email
  if (normEmail) {
    await db.collection('password_resets').doc(normEmail).set(docData);
    await db.collection('verification_codes').doc(normEmail).set(docData);
  }

  // Secondary key by studentId/username if provided and distinct
  if (normId && normId !== normEmail) {
    await db.collection('password_resets').doc(normId).set(docData);
    await db.collection('verification_codes').doc(normId).set(docData);
  }

  console.log(`[Success] Reset code stored in Firestore for ${normEmail || normId}`);
  return docData;
}

/**
 * Find verification code from persistent Firestore collections
 */
async function findVerificationCode({ email, studentId, username }) {
  const { db } = await initFirebaseAdmin();
  if (!db) {
    throw new Error('Database service is not available');
  }

  const normEmail = (email || '').toLowerCase().trim();
  const normId = (studentId || username || '').toString().trim();
  const collections = ['password_resets', 'verification_codes', 'passwordResetCodes'];

  for (const collName of collections) {
    try {
      // 1. Check doc by email ID
      if (normEmail) {
        const snap = await db.collection(collName).doc(normEmail).get();
        if (snap.exists) {
          return { data: snap.data(), ref: snap.ref, collection: collName };
        }
      }

      // 2. Check doc by studentId/username ID
      if (normId) {
        const snap = await db.collection(collName).doc(normId).get();
        if (snap.exists) {
          return { data: snap.data(), ref: snap.ref, collection: collName };
        }
      }

      // 3. Query by email field
      if (normEmail) {
        const qSnap = await db.collection(collName).where('email', '==', normEmail).limit(1).get();
        if (!qSnap.empty) {
          const doc = qSnap.docs[0];
          return { data: doc.data(), ref: doc.ref, collection: collName };
        }
      }

      // 4. Query by studentId field
      if (normId) {
        const qSnap = await db.collection(collName).where('studentId', '==', normId).limit(1).get();
        if (!qSnap.empty) {
          const doc = qSnap.docs[0];
          return { data: doc.data(), ref: doc.ref, collection: collName };
        }
      }
    } catch (collErr) {
      console.warn(`[Warning] Error checking collection ${collName}:`, collErr.message);
    }
  }

  return null;
}

/**
 * Delete verification code after successful password reset
 */
async function deleteVerificationCode({ email, studentId, username }) {
  const { db } = await initFirebaseAdmin();
  if (!db) return;

  const normEmail = (email || '').toLowerCase().trim();
  const normId = (studentId || username || '').toString().trim();
  const collections = ['password_resets', 'verification_codes', 'passwordResetCodes'];

  for (const collName of collections) {
    try {
      if (normEmail) {
        await db.collection(collName).doc(normEmail).delete().catch(() => {});
      }
      if (normId) {
        await db.collection(collName).doc(normId).delete().catch(() => {});
      }
    } catch (e) {}
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
  saveVerificationCode,
  findVerificationCode,
  deleteVerificationCode,
  getAdminApp,
  getAdminAuth,
  getAdminDb,
  getFieldValue,
  getAuth: getAdminAuth,
  getFirestore: getAdminDb
};
module.exports.default = module.exports;
