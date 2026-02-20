import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth') || 'null'); } catch { return null; }
  });

  useEffect(() => {
    if (auth) localStorage.setItem('auth', JSON.stringify(auth));
    else localStorage.removeItem('auth');
  }, [auth]);

  // Keep auth.user/permissions in sync with backend (important after admin approval)
  useEffect(() => {
    let cancelled = false;
    const token = auth?.token;
    if (!token) return;

    const refreshMe = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;
        if (res.status === 401) {
          setAuth(null);
          try { localStorage.removeItem('token'); } catch {}
          return;
        }
        const data = await res.json().catch(() => null);
        if (data?.user) {
          setAuth((prev) => (prev?.token ? { ...prev, user: data.user } : prev));
        }
      } catch {
        // ignore refresh errors (offline, backend restarting)
      }
    };

    // Initial refresh + refresh when user returns to the tab.
    refreshMe();
    const onFocus = () => refreshMe();
    const onVisibility = () => {
      try {
        if (document.visibilityState === 'visible') refreshMe();
      } catch {
        // ignore
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    // Periodic refresh (kept low-frequency).
    const timer = setInterval(refreshMe, 60 * 1000);

    return () => {
      cancelled = true;
      try { window.removeEventListener('focus', onFocus); } catch {}
      try { document.removeEventListener('visibilitychange', onVisibility); } catch {}
      try { clearInterval(timer); } catch {}
    };
  }, [auth?.token]);

  const login = (token, user) => {
    setAuth({ token, user });
    try { localStorage.setItem('token', token); } catch {}
  };
  const logout = () => {
    setAuth(null);
    try { localStorage.removeItem('token'); } catch {}
  };

  const value = useMemo(() => ({
    isAuthenticated: !!auth?.token,
    token: auth?.token || null,
    user: auth?.user || null,
    login,
    logout,
  }), [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
