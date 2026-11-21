import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, onUnauthorized } from '../lib/api.js';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user (GET /api/auth/me; the session itself is an httpOnly cookie).
 *   useAuth() -> { user /* undefined = still checking · null = signed out *\/, login(email, password), register(data), logout(), refresh(), promptAuth(options), prompt, closePrompt(result) }
 * promptAuth({ mode:'login'|'register', role:'client'|'lawyer', message }) opens the sign-in dialog (rendered once by <AuthModal /> in App.jsx)
 * and resolves with the signed-in user, or null if the person closes it. Pages call it when a signed-out visitor takes an action that needs an
 * account, so they never lose what they were doing:
 *   const user = await promptAuth({ mode: 'register', role: 'client', message: 'Create a free account to continue.' });
 *   if (!user) return;
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [prompt, setPrompt] = useState(null);
  const promptRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/auth/me')
      .then((res) => { if (!cancelled) setUser(res.user ?? null); })
      .catch(() => { if (!cancelled) setUser(null); });
    onUnauthorized(() => setUser(null)); // the session expired or was revoked
    return () => { cancelled = true; onUnauthorized(null); };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.user);
    return res.user;
  }, []);
  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data);
    setUser(res.user);
    return res.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);
  const refresh = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.user ?? null);
    return res.user ?? null;
  }, []);

  const promptAuth = useCallback((options = {}) => new Promise((resolve) => {
    promptRef.current?.resolve(null); // a dialog was already open: the earlier caller gets "closed"
    const next = { mode: 'login', role: 'client', message: '', ...options, resolve };
    promptRef.current = next;
    setPrompt(next);
  }), []);
  const closePrompt = useCallback((result = null) => {
    const current = promptRef.current;
    promptRef.current = null;
    setPrompt(null);
    current?.resolve(result);
  }, []);

  const value = useMemo(
    () => ({ user, login, register, logout, refresh, promptAuth, prompt, closePrompt }),
    [user, login, register, logout, refresh, promptAuth, prompt, closePrompt],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
