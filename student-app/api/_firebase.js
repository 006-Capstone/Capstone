import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    if (typeof privateKey === 'string') {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    try {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    } catch (err) {
      console.error('[Error] Firebase Admin initializeApp failed:', err);
      return null;
    }
  }

  try {
    return initializeApp();
  } catch (err) {
    console.warn('[Warning] Firebase Admin not initialized (missing environment variables):', err.message);
    return null;
  }
}

export { getAuth, getFirestore, FieldValue };
