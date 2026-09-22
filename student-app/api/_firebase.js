const admin = require('firebase-admin');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Compatibility wrapper so admin.apps, admin.credential.cert, admin.firestore, admin.auth exist
if (!admin.apps) {
  Object.defineProperty(admin, 'apps', {
    get: () => getApps()
  });
}
if (!admin.credential) {
  admin.credential = { cert };
} else if (!admin.credential.cert) {
  admin.credential.cert = cert;
}
if (!admin.initializeApp) {
  admin.initializeApp = initializeApp;
}
if (!admin.firestore) {
  admin.firestore = (app) => (app ? getFirestore(app) : getFirestore());
  admin.firestore.FieldValue = FieldValue;
}
if (!admin.auth) {
  admin.auth = (app) => (app ? getAuth(app) : getAuth());
}

/**
 * Initialize Firebase Admin ensuring apps are checked and credentials formatted
 */
function initFirebaseAdmin() {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.trim();
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'academia-de-san-jose';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!admin.apps.length) {
    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey,
        }),
      });
    } else {
      admin.initializeApp({
        projectId: projectId,
      });
    }
  }

  const app = admin.apps[0];
  const db = getFirestore(app);
  const auth = getAuth(app);

  return { app, auth, db, FieldValue };
}

/**
 * Persist verification code to Firestore collections ('password_resets' and 'verification_codes')
 */
async function saveVerificationCode({ email, studentId, studentName, code, expiryMinutes = 10 }) {
  const { db, FieldValue: fv } = initFirebaseAdmin();
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
  const { db } = initFirebaseAdmin();
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
  const { db } = initFirebaseAdmin();
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

module.exports = {
  admin,
  initFirebaseAdmin,
  saveVerificationCode,
  findVerificationCode,
  deleteVerificationCode,
  getAdminApp: () => initFirebaseAdmin().app,
  getAdminAuth: () => initFirebaseAdmin().auth,
  getAdminDb: () => initFirebaseAdmin().db,
  getFieldValue: () => initFirebaseAdmin().FieldValue,
  getAuth: () => initFirebaseAdmin().auth,
  getFirestore: () => initFirebaseAdmin().db
};
module.exports.default = module.exports;
