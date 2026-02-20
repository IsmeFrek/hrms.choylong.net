import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StaffLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_PREFIX}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.phone.trim(), password: form.password }),
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
      if (!res.ok) throw new Error(data.message || text || 'Login failed');
      login(data.token, data.user);
      const perms = Array.isArray(data?.user?.permissions) ? data.user.permissions : [];
      const isPending = perms.length === 0;
      const roles = Array.isArray(data?.user?.roles) ? data.user.roles : [];
      const isAdmin = roles.some((r) => (r?.name || r) === 'Admin');
      const isStaffOnly = !isAdmin && roles.length === 1 && (roles[0]?.name || roles[0]) === 'User';
      const redirect = searchParams.get('redirect');
      if (isPending) {
        navigate('/employee-register', { replace: true });
      } else if (redirect) {
        navigate(redirect, { replace: true });
      } else if (isStaffOnly) {
        navigate('/my-hr', { replace: true });
      } else {
        navigate('/', { replace: true });
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
        <h1 className="text-xl font-semibold mb-1 text-center">Staff Login</h1>
        <p className="text-sm text-gray-500 mb-4 text-center">Sign in to continue</p>

        {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">លេខទូរស័ព្ទ</label>
            <input
              type="tel"
              className="border rounded w-full px-3 py-2"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="070123456"
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
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60" disabled={saving}>
            {saving ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t text-center text-sm">
          <a href="/staff-signup" className="text-blue-600 hover:underline">Create Account</a>
        </div>

      </div>
    </div>
  );
}
