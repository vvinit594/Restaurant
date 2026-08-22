import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  adminLogin as apiLogin,
  adminLogout as apiLogout,
  getAdminSession,
  ROLES,
} from '../../services/adminAuth';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getAdminSession();
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
      isAuthenticated: Boolean(session?.token),
      isSuperAdmin: session?.user?.role === ROLES.SUPER_ADMIN,
      bootstrapping,
      login,
      logout,
    }),
    [session, bootstrapping, login, logout]
  );

  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
