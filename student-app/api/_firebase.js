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

let clientDbInstance = null;

/**
 * Client Firestore fallback with anonymous authentication
 * Used to guarantee verification code persistence without service account keys
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
 * Guaranteed persistence: writes to Client Firestore (always available) and Admin Firestore if configured.
 */
async function saveVerificationCode({ email, studentId, studentName, code, expiryMinutes = 2 }) {
  const normEmail = (email || '').toLowerCase().trim();
  const normId = (studentId || '').toString().trim();
  const normCode = (code || '').toString().trim();
  const minutes = Math.max(Number(expiryMinutes) || 2, 1);
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

  // 1. Write via Client Firestore (100% reliable across serverless instances)
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
    console.warn('[Warning] Client Firestore save error:', clientErr.message);
  }

  // 2. Also write via Firebase Admin if configured
  try {
    const { db, FieldValue: adminFv } = await initFirebaseAdmin();
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
    console.warn('[Warning] Firebase Admin save error:', adminErr.message);
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

  // 1. Check Client Firestore first
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
    console.warn('[Warning] Client Firestore lookup error:', clientErr.message);
  }

  // 2. Fallback to Firebase Admin
  try {
    const { db } = await initFirebaseAdmin();
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
    console.warn('[Warning] Firebase Admin lookup error:', adminErr.message);
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
    const cDb = await getClientFirestore();
    if (cDb) {
      const { doc, deleteDoc } = await import('firebase/firestore');
      for (const collName of collections) {
        if (normEmail) await deleteDoc(doc(cDb, collName, normEmail)).catch(() => {});
        if (normId) await deleteDoc(doc(cDb, collName, normId)).catch(() => {});
      }
    }
  } catch (e) {}

  try {
    const { db } = await initFirebaseAdmin();
    if (db) {
      for (const collName of collections) {
        if (normEmail) await db.collection(collName).doc(normEmail).delete().catch(() => {});
        if (normId) await db.collection(collName).doc(normId).delete().catch(() => {});
      }
    }
  } catch (e) {}
}

module.exports = {
  initFirebaseAdmin,
  getClientFirestore,
  saveVerificationCode,
  findVerificationCode,
  deleteVerificationCode,
  getAdminApp: async () => (await initFirebaseAdmin()).app,
  getAdminAuth: async () => (await initFirebaseAdmin()).auth,
  getAdminDb: async () => (await initFirebaseAdmin()).db,
  getFieldValue: async () => (await initFirebaseAdmin()).FieldValue,
  getAuth: async () => (await initFirebaseAdmin()).auth,
  getFirestore: async () => (await initFirebaseAdmin()).db
};
module.exports.default = module.exports;
