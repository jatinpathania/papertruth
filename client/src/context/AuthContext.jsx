import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    let active = true;
    api
      .me()
      .then(({ user: me }) => active && setUser(me))
      .catch(() => tokenStore.clear())
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorised = () => setUser(null);
    window.addEventListener('papertruth:unauthorised', onUnauthorised);
    return () => window.removeEventListener('papertruth:unauthorised', onUnauthorised);
  }, []);

  const login = useCallback(async (credentials) => {
    const { token, user: me } = await api.login(credentials);
    tokenStore.set(token);
    setUser(me);
    return me;
  }, []);

  // Registration is two steps now: this one only sends the code. The account
  // does not exist until verifyRegistration succeeds.
  const register = useCallback((details) => api.register(details), []);

  const verifyRegistration = useCallback(async (details) => {
    const { token, user: me } = await api.verifyRegistration(details);
    tokenStore.set(token);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, verifyRegistration, logout, isAdmin: user?.role === 'ADMIN' }),
    [user, loading, login, register, verifyRegistration, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

export function RequireAuth({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-block">
        <span className="spinner" /> Restoring your session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && user.role !== 'ADMIN') {
    return (
      <div className="page">
        <div className="notice danger">
          <strong>Admins only.</strong> This page is restricted to the exam cell.
        </div>
      </div>
    );
  }
  return children;
}
