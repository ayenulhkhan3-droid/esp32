import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { ALLOWED_EMAILS, isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth } from './firebaseApp';

export interface SessionUser {
  username: string;
  displayName: string | null;
}

export interface Session {
  token: string;
  expiresAt: number | null;
  user: SessionUser;
}

function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ALLOWED_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

function mapAuthError(code: string, fallback: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again later.';
    case 'auth/network-request-failed':
      return 'Cannot reach Firebase. Check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase Console.';
    default:
      return fallback;
  }
}

async function sessionFromUser(user: User): Promise<Session> {
  if (!isAllowedEmail(user.email)) {
    await signOut(getFirebaseAuth());
    throw new Error('This account is not allowed to control this car.');
  }
  const token = await user.getIdToken();
  const result = await user.getIdTokenResult();
  const expiresAt = result.expirationTime ? Date.parse(result.expirationTime) : null;
  return {
    token,
    expiresAt: Number.isNaN(expiresAt ?? NaN) ? null : expiresAt,
    user: {
      username: user.email ?? '',
      displayName: user.displayName,
    },
  };
}

export async function getFreshIdToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  const user = getFirebaseAuth().currentUser;
  if (!user || !isAllowedEmail(user.email)) return null;
  try {
    return await user.getIdToken(false);
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<Session> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured.');
  }
  try {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    return await sessionFromUser(cred.user);
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) : '';
    throw new Error(mapAuthError(code, 'Login failed. Please try again.'));
  }
}

export async function logout(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    await signOut(getFirebaseAuth());
  } catch {
    // Local sign-out still proceeds.
  }
}

export async function clearStoredSession(): Promise<void> {
  await logout();
}

export type RestoreResult =
  | { status: 'none' }
  | { status: 'valid'; session: Session }
  | { status: 'unverified'; session: Session; reason: string };

export function restoreSession(): Promise<RestoreResult> {
  if (!isFirebaseConfigured()) {
    return Promise.resolve({ status: 'none' });
  }
  const auth = getFirebaseAuth();
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        resolve({ status: 'none' });
        return;
      }
      try {
        resolve({ status: 'valid', session: await sessionFromUser(user) });
      } catch {
        resolve({ status: 'none' });
      }
    });
  });
}
