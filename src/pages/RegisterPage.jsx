import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get('redirect');
  const redirectTo = redirectParam || '/employee-register';
  const loginPath = location?.pathname === '/staff-signup' ? '/staff-login' : '/login';

  const [form, setForm] = useState({ fullName: '', phone: '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const handleLogout = () => {
    logout();
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.fullName.trim()) throw new Error('សូមបញ្ចូលឈ្មោះ');
      if (!form.phone.trim()) throw new Error('សូមបញ្ចូលលេខទូរស័ព្ទ');
      if (!form.password) throw new Error('សូមបញ្ចូលលេខសម្ងាត់');
      if (form.password.length < 6) throw new Error('លេខសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ 6 តួអក្សរ');
      if (form.password !== form.confirmPassword) throw new Error('Confirm password មិនត្រឹមត្រូវ');

      const res = await fetch(`${API_PREFIX}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      });

      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

      if (!res.ok) {
        throw new Error(data.message || text || 'Register failed');
      }

      login(data.token, data.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Register failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white border rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-1 text-center">Create Account</h1>
        <p className="text-sm text-gray-500 mb-4 text-center">បង្កើតគណនីដើម្បីបន្ត</p>

        {isAuthenticated && (
          <div className="mb-3 text-sm bg-yellow-50 border border-yellow-200 text-yellow-900 rounded p-3">
            អ្នកបានចូលប្រើរួចហើយ។ បើចង់បង្កើតគណនីថ្មី សូម Logout ជាមុន។
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => navigate(redirectTo, { replace: true })}
                className="flex-1 border rounded py-2 text-sm hover:bg-gray-50"
              >
                បន្ត
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-3" style={{ opacity: isAuthenticated ? 0.6 : 1 }}>
          <div>
            <label className="block text-sm mb-1">ឈ្មោះ</label>
            <input
              type="text"
              className="border rounded w-full px-3 py-2"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="ឈ្មោះពេញ"
              required
              disabled={saving || isAuthenticated}
            />
          </div>

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
              disabled={saving || isAuthenticated}
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
                autoComplete="new-password"
                required
                disabled={saving || isAuthenticated}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="px-2 py-2 text-xs border rounded"
                disabled={saving || isAuthenticated}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Confirm Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="border rounded w-full px-3 py-2"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              autoComplete="new-password"
              required
              disabled={saving || isAuthenticated}
            />
          </div>

          <button className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60" disabled={saving || isAuthenticated}>
            {saving ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t text-center text-sm">
          <a href={loginPath} className="text-blue-600 hover:underline">មានគណនីរួចហើយ? ចូលប្រើ</a>
        </div>
      </div>
    </div>
  );
}
