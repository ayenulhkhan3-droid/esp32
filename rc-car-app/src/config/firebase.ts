/**
 * Firebase Android + Realtime Database (no PHP, no Google Sign-In).
 * Package: online.digicopy.drivelink
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAGD2ROd_4BPxEb0enGPg6qMrH-n62m1WE',
  authDomain: 'esp32-ee54b.firebaseapp.com',
  projectId: 'esp32-ee54b',
  storageBucket: 'esp32-ee54b.firebasestorage.app',
  messagingSenderId: '365173564249',
  appId: '1:365173564249:android:68df376217b6233186e248',
  databaseURL: 'https://esp32-ee54b-default-rtdb.firebaseio.com',
} as const;

export const ALLOWED_EMAILS = ['ayenulhkhan3@gmail.com'] as const;

export const CAR_RTDB_PATH = 'cars/car001';

export function isFirebaseConfigured(): boolean {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.projectId &&
      FIREBASE_CONFIG.appId &&
      FIREBASE_CONFIG.databaseURL,
  );
}
