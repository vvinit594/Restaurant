import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getRestaurantSession,
  restaurantLogin as apiLogin,
  restaurantLogout as apiLogout,
} from '../../services/restaurantAuth';

const RestaurantAuthContext = createContext(null);

export function RestaurantAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getRestaurantSession();
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
      permissions: session?.permissions || null,
      isAuthenticated: Boolean(session?.token),
      bootstrapping,
      login,
      logout,
    }),
    [session, bootstrapping, login, logout]
  );

  return (
    <RestaurantAuthContext.Provider value={value}>{children}</RestaurantAuthContext.Provider>
  );
}

export function useRestaurantAuth() {
  const ctx = useContext(RestaurantAuthContext);
  if (!ctx) throw new Error('useRestaurantAuth must be used within RestaurantAuthProvider');
  return ctx;
}
