import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get('redirect');
  const redirectTo = redirectParam || '/';

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  // Default admin credentials (seeded on backend)
  const demoCreds = { email: 'admin@hospital.com', password: 'admin123' };
  // Resolve API base: default to relative '/api' so Vite proxy works across LAN
  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';
  const [backendStatus, setBackendStatus] = useState(null); // 'online' | 'offline' | 'error' | null

  // Redirect away if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo, { replace: true });
  }, [isAuthenticated, navigate, redirectTo]);

  // NEW: ping backend health
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
  const r = await fetch(`${API_PREFIX}/health`, { method: 'GET' });
        if (!cancelled) setBackendStatus(r.ok ? 'online' : 'error');
      } catch {
        if (!cancelled) setBackendStatus('offline');
      }
    })();
    return () => { cancelled = true; };
  }, [API_PREFIX]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
  const res = await fetch(`${API_PREFIX}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password }),
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
      if (!res.ok) {
        // NEW: clearer 404 guidance
        if (res.status === 404 || (data?.message || '').toLowerCase().includes('route not found')) {
          throw new Error('Route not found: POST /api/auth/login. Ensure backend has app.use("/api/auth", authRoutes) and routes/auth.js defines POST /login. Also check VITE_API_BASE/proxy.');
        }
        throw new Error(data.message || text || 'Login failed');
      }
      // Expect { token, user }
      login(data.token, data.user);
      if (redirectParam) {
        navigate(redirectTo, { replace: true });
      } else {
        const perms = Array.isArray(data?.user?.permissions) ? data.user.permissions : [];
        const isAdminLike = perms.includes('manage:users') || perms.includes('manage:roles') || perms.includes('edit:hr');
        navigate(isAdminLike ? '/staff-register' : '/', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white border rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-1 text-center">HRMS Login</h1>
        <p className="text-sm text-gray-500 mb-4 text-center">Sign in to continue</p>

        {/* NEW: backend status hint */}
        {backendStatus && (
          <div className={`mb-3 text-xs rounded border p-2 ${backendStatus === 'online' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
            Backend: {backendStatus === 'online' ? 'Online' : 'Unavailable'}
            {API_BASE_RAW ? ` (${API_BASE_RAW})` : ' (/api via proxy)'}
          </div>
        )}

        {/* Default admin account info
        <div className="mb-4 text-xs text-gray-700 bg-gray-50 border rounded p-3">
          <div className="font-medium mb-1">Default Admin</div>
          <div>Email: <code className="bg-white px-1 rounded border">admin@hospital.com</code></div>
          <div>Password: <code className="bg-white px-1 rounded border">admin123</code></div>
          <button
            type="button"
            onClick={() => setForm(demoCreds)}
            className="mt-2 text-blue-600 underline"
          >
            Use these credentials
          </button>
        </div> */}

        {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Email or Phone</label>
            <input
              type="text"
              className="border rounded w-full px-3 py-2"
              value={form.identifier}
              onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
              placeholder="email@example.com or 070123456"
              autoComplete="username"
              required
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <div className="flex items-center gap-2">
              <input
                type={showPw ? 'text' : 'password'}
                className="border rounded w-full px-3 py-2"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
                required
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="px-2 py-2 text-xs border rounded"
                disabled={saving}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button
            className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
            disabled={saving || backendStatus === 'offline'}
          >
            {saving ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Chang password link */}
        <div className="mt-3 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-blue-600 hover:underline"
          >
            Chang password?
          </a>
        </div>
      </div>
    </div>
  );
}
