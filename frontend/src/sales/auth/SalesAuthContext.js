import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getSalesSession,
  salesLogin as apiLogin,
  salesLogout as apiLogout,
} from '../../services/salesAuth';

const SalesAuthContext = createContext(null);

export function SalesAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getSalesSession();
        if (alive) setSession(s);
      } finally {
        if (alive) setBootstrapping(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const s = await apiLogin(credentials);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      salesPerson: session?.salesPerson || null,
      isAuthenticated: Boolean(session?.token),
      isSalesPerson: session?.user?.role === 'SALES_PERSON',
      bootstrapping,
      login,
      logout,
    }),
    [session, bootstrapping, login, logout],
  );

  return <SalesAuthContext.Provider value={value}>{children}</SalesAuthContext.Provider>;
}

export function useSalesAuth() {
  const ctx = useContext(SalesAuthContext);
  if (!ctx) throw new Error('useSalesAuth must be used within SalesAuthProvider');
  return ctx;
}
