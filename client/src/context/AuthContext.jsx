import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, ApiError, tokenStore, sessionFromToken } from '../api/client.js';

const AuthContext = createContext(null);

// A token that no longer parses, or has run out, is worth less than no token:
// it would send the app off to /me only to be told what it could have known
// here. Drop it now so the signed-out view is right the first time it paints.
function restoreSession() {
  const session = sessionFromToken();
  if (!session && tokenStore.get()) tokenStore.clear();
  return session;
}

export function AuthProvider({ children }) {
  // Start from what the stored token already says. Waiting for /me instead
  // meant the header painted "Login / Register" to someone who was signed in,
  // then swapped it out seconds later — on a cold serverless function that is
  // long enough to click the wrong thing.
  const [user, setUser] = useState(restoreSession);

  useEffect(() => {
    if (!tokenStore.get()) return;
    let active = true;
    api
      .me()
      .then(({ user: me }) => active && setUser(me))
      .catch((error) => {
        if (!active) return;
        // A rejected token is a dead session. Anything else — the server asleep,
        // the network down — is not, so the restored session stands rather than
        // signing someone out because a request happened to fail.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          tokenStore.clear();
          setUser(null);
        }
      });
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

  // The reset has already proved the person reads that inbox, so finishing it
  // signs them in rather than dropping them back on the sign-in form.
  const resetPassword = useCallback(async (details) => {
    const { token, user: me } = await api.resetPassword(details);
    tokenStore.set(token);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      verifyRegistration,
      resetPassword,
      logout,
      isAdmin: user?.role === 'ADMIN'
    }),
    [user, login, register, verifyRegistration, resetPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

export function RequireAuth({ children, adminOnly = false }) {
  const { user } = useAuth();
  const location = useLocation();

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
