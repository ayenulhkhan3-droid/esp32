import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureCarApiAuth } from '../services/api';
import * as auth from '../services/auth';

type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  session: auth.Session | null;
  notice: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [session, setSession] = useState<auth.Session | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const signedInRef = useRef(false);

  const applySession = useCallback((next: auth.Session | null) => {
    signedInRef.current = next !== null;
    setSession(next);
    setStatus(next ? 'signedIn' : 'signedOut');
  }, []);

  useEffect(() => {
    configureCarApiAuth(
      () => auth.getFreshIdToken(),
      () => {
        if (!signedInRef.current) return;
        signedInRef.current = false;
        void auth.clearStoredSession();
        setNotice('Your session has expired or was revoked. Please log in again.');
        applySession(null);
      },
    );
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    auth
      .restoreSession()
      .then((result) => {
        if (cancelled) return;
        applySession(result.status === 'none' ? null : result.session);
      })
      .catch(() => {
        if (!cancelled) applySession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (username: string, password: string) => {
      const next = await auth.login(username, password);
      setNotice(null);
      applySession(next);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    applySession(null);
    await auth.logout();
  }, [applySession]);

  const value = useMemo(() => ({ status, session, notice, login, logout }), [status, session, notice, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
