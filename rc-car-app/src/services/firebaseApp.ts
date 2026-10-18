import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, Persistence, getAuth, initializeAuth } from 'firebase/auth';
import { Database, getDatabase } from 'firebase/database';
import { FIREBASE_CONFIG, isFirebaseConfigured } from '../config/firebase';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let database: Database | null = null;

function rnPersistence(): Persistence | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@firebase/auth/dist/rn/index.js') as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
    };
    return mod.getReactNativePersistence?.(AsyncStorage) ?? null;
  } catch {
    return null;
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Paste Web config + Realtime Database URL into src/config/firebase.ts',
    );
  }
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  const persistence = rnPersistence();
  try {
    auth = persistence
      ? initializeAuth(firebaseApp, { persistence })
      : initializeAuth(firebaseApp);
  } catch {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export function getFirebaseDatabase(): Database {
  if (!database) {
    database = getDatabase(getFirebaseApp());
  }
  return database;
}
