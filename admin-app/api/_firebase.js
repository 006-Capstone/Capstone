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

let adminApp = null;
let adminDb = null;
let adminAuth = null;
let fv = FieldValue;

/**
 * Initialize Firebase Admin ensuring apps are checked and credentials formatted
 */
function initFirebaseAdmin() {
  if (adminApp && adminDb) {
    return { app: adminApp, auth: adminAuth, db: adminDb, FieldValue: fv };
  }

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

  // Only initialize Firebase Admin if service account credentials are provided
  if (!clientEmail || !privateKey) {
    return { app: null, auth: null, db: null, FieldValue: fv };
  }

  try {
    if (!admin.apps.length) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey,
        }),
      });
    } else {
      adminApp = admin.apps[0];
    }

    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    fv = FieldValue;

    return { app: adminApp, auth: adminAuth, db: adminDb, FieldValue: fv };
  } catch (err) {
    console.warn('[Warning] Firebase Admin init failed:', err.message);
    return { app: null, auth: null, db: null, FieldValue: fv, error: err };
  }
}

let clientDbInstance = null;

/**
 * Client Firestore fallback with anonymous authentication
 * Used when service account credentials are not provided or throw errors on Vercel
 */
async function getClientFirestore() {
  if (clientDbInstance) return clientDbInstance;
  try {
    const { initializeApp: initClientApp, getApps: getClientApps } = await import('firebase/app');
    const { getAuth: getClientAuth, signInAnonymously } = await import('firebase/auth');
    const { getFirestore: getClientFs } = await import('firebase/firestore');

    const firebaseConfig = {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBeoTH1ZiOaifIf214ZSFsD0vOT6C_FoL4",
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "academia-de-san-jose.firebaseapp.com",
      projectId: process.env.FIREBASE_PROJECT_ID || "academia-de-san-jose",
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "academia-de-san-jose.firebasestorage.app",
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "774087940662",
      appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:774087940662:web:a5bd8ffb9e481b0508d697"
    };

    const cApp = getClientApps().length > 0 ? getClientApps()[0] : initClientApp(firebaseConfig);
    const cAuth = getClientAuth(cApp);
    try {
      if (!cAuth.currentUser) {
        await signInAnonymously(cAuth);
      }
    } catch (authErr) {
      console.warn('[Warning] Client anonymous auth warning:', authErr.message);
    }
    clientDbInstance = getClientFs(cApp);
    return clientDbInstance;
  } catch (err) {
    console.error('[Error] Client Firestore init failed:', err.message);
    return null;
  }
}

/**
 * Persist verification code to Firestore collections ('password_resets' and 'verification_codes')
 * Guaranteed persistence: tries Firebase Admin, then falls back to authenticated Client Firestore.
 */
async function saveVerificationCode({ email, studentId, studentName, code, expiryMinutes = 10 }) {
  const normEmail = (email || '').toLowerCase().trim();
  const normId = (studentId || '').toString().trim();
  const normCode = (code || '').toString().trim();
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
    createdAt: new Date().toISOString(),
    createdTimestamp: Date.now()
  };

  let saved = false;

  // 1. Try Firebase Admin first (if configured with service account)
  try {
    const { db, FieldValue: adminFv } = initFirebaseAdmin();
    if (db) {
      const adminData = {
        ...docData,
        createdAt: adminFv ? adminFv.serverTimestamp() : docData.createdAt
      };
      if (normEmail) {
        await db.collection('password_resets').doc(normEmail).set(adminData);
        await db.collection('verification_codes').doc(normEmail).set(adminData);
      }
      if (normId && normId !== normEmail) {
        await db.collection('password_resets').doc(normId).set(adminData);
        await db.collection('verification_codes').doc(normId).set(adminData);
      }
      saved = true;
      console.log(`[Success] Reset code stored in Firestore (Admin) for ${normEmail || normId}`);
    }
  } catch (adminErr) {
    console.warn('[Warning] Firebase Admin save failed, falling back to Client Firestore:', adminErr.message);
  }

  // 2. Fallback to Client Firestore with anonymous auth
  if (!saved) {
    try {
      const cDb = await getClientFirestore();
      if (cDb) {
        const { doc, setDoc } = await import('firebase/firestore');
        if (normEmail) {
          await setDoc(doc(cDb, 'password_resets', normEmail), docData);
          await setDoc(doc(cDb, 'verification_codes', normEmail), docData);
        }
        if (normId && normId !== normEmail) {
          await setDoc(doc(cDb, 'password_resets', normId), docData);
          await setDoc(doc(cDb, 'verification_codes', normId), docData);
        }
        saved = true;
        console.log(`[Success] Reset code stored in Firestore (Client) for ${normEmail || normId}`);
      }
    } catch (clientErr) {
      console.error('[Error] Client Firestore save failed:', clientErr.message);
    }
  }

  if (!saved) {
    throw new Error('Database service is not available. Please verify Firestore connection.');
  }

  return docData;
}

/**
 * Find verification code from persistent Firestore collections
 */
async function findVerificationCode({ email, studentId, username }) {
  const normEmail = (email || '').toLowerCase().trim();
  const normId = (studentId || username || '').toString().trim();
  const collections = ['password_resets', 'verification_codes', 'passwordResetCodes'];

  // 1. Try Firebase Admin first
  try {
    const { db } = initFirebaseAdmin();
    if (db) {
      for (const collName of collections) {
        if (normEmail) {
          const snap = await db.collection(collName).doc(normEmail).get();
          if (snap.exists) return { data: snap.data(), ref: snap.ref, collection: collName };
        }
        if (normId) {
          const snap = await db.collection(collName).doc(normId).get();
          if (snap.exists) return { data: snap.data(), ref: snap.ref, collection: collName };
        }
        if (normEmail) {
          const qSnap = await db.collection(collName).where('email', '==', normEmail).limit(1).get();
          if (!qSnap.empty) return { data: qSnap.docs[0].data(), ref: qSnap.docs[0].ref, collection: collName };
        }
        if (normId) {
          const qSnap = await db.collection(collName).where('studentId', '==', normId).limit(1).get();
          if (!qSnap.empty) return { data: qSnap.docs[0].data(), ref: qSnap.docs[0].ref, collection: collName };
        }
      }
    }
  } catch (adminErr) {
    console.warn('[Warning] Firebase Admin lookup failed, checking Client Firestore:', adminErr.message);
  }

  // 2. Fallback to Client Firestore
  try {
    const cDb = await getClientFirestore();
    if (cDb) {
      const { doc, getDoc, collection, query, where, getDocs, limit } = await import('firebase/firestore');
      for (const collName of collections) {
        if (normEmail) {
          const snap = await getDoc(doc(cDb, collName, normEmail));
          if (snap.exists()) return { data: snap.data(), ref: snap.ref, collection: collName };
        }
        if (normId) {
          const snap = await getDoc(doc(cDb, collName, normId));
          if (snap.exists()) return { data: snap.data(), ref: snap.ref, collection: collName };
        }
        if (normEmail) {
          const qSnap = await getDocs(query(collection(cDb, collName), where('email', '==', normEmail), limit(1)));
          if (!qSnap.empty) return { data: qSnap.docs[0].data(), ref: qSnap.docs[0].ref, collection: collName };
        }
        if (normId) {
          const qSnap = await getDocs(query(collection(cDb, collName), where('studentId', '==', normId), limit(1)));
          if (!qSnap.empty) return { data: qSnap.docs[0].data(), ref: qSnap.docs[0].ref, collection: collName };
        }
      }
    }
  } catch (clientErr) {
    console.error('[Error] Client Firestore lookup failed:', clientErr.message);
  }

  return null;
}

/**
 * Delete verification code after successful password reset
 */
async function deleteVerificationCode({ email, studentId, username }) {
  const normEmail = (email || '').toLowerCase().trim();
  const normId = (studentId || username || '').toString().trim();
  const collections = ['password_resets', 'verification_codes', 'passwordResetCodes'];

  try {
    const { db } = initFirebaseAdmin();
    if (db) {
      for (const collName of collections) {
        if (normEmail) await db.collection(collName).doc(normEmail).delete().catch(() => {});
        if (normId) await db.collection(collName).doc(normId).delete().catch(() => {});
      }
    }
  } catch (e) {}

  try {
    const cDb = await getClientFirestore();
    if (cDb) {
      const { doc, deleteDoc } = await import('firebase/firestore');
      for (const collName of collections) {
        if (normEmail) await deleteDoc(doc(cDb, collName, normEmail)).catch(() => {});
        if (normId) await deleteDoc(doc(cDb, collName, normId)).catch(() => {});
      }
    }
  } catch (e) {}
}

module.exports = {
  admin,
  initFirebaseAdmin,
  getClientFirestore,
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
