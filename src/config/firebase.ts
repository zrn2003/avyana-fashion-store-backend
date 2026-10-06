import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { env } from './env';

let app: App | null = null;
let firebaseAuth: Auth | null = null;
let firestore: Firestore | null = null;

try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp({
    projectId: env.FIREBASE_PROJECT_ID || 'avyana-craft',
  });
  firebaseAuth = getAuth(app);
  firestore = getFirestore(app);
} catch (err) {
  console.warn('Firebase Admin initialization notice:', err);
}

export { app as firebaseAdminApp, firebaseAuth, firestore };
