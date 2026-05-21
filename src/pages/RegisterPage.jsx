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

  const [form, setForm] = useState({ fullName: '', phone: '', staffId: '', password: '', confirmPassword: '' });
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
      if (!form.staffId.trim() && !form.phone.trim()) throw new Error('សូមបញ្ចូល Staff ID ឬ លេខទូរស័ព្ទ យ៉ាងហោចណាស់មួយ');
      if (!form.password) throw new Error('សូមបញ្ចូលលេខសម្ងាត់');
      if (form.password.length < 6) throw new Error('លេខសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ 6 តួអក្សរ');
      if (form.password !== form.confirmPassword) throw new Error('Confirm password មិនត្រឹមត្រូវ');

      const res = await fetch(`${API_PREFIX}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: (form.phone.trim() || form.staffId.trim()), // Use phone as fullName since field was removed
          phone: form.phone.trim(),
          staffId: form.staffId.trim(),
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[550px]">
        
        {/* Left Side: Premium Gradient & Branding */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-teal-500 p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-white opacity-5 rounded-full -translate-x-20 -translate-y-20"></div>
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-white opacity-5 rounded-full translate-x-20 translate-y-20"></div>
          
          <div>
            <h1 className="text-xl font-bold font-muol mb-2 leading-relaxed">ប្រព័ន្ធគ្រប់គ្រងធនធានមនុស្ស និង លំហូឯកសារ</h1>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold tracking-wider font-muol">HRMS & DFS</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">v4.0</span>
            </div>
            <p className="text-xs text-blue-100 font-sans mb-4 leading-relaxed">
              (Human Resources Management System & Document Flow System)
            </p>
            <p className="text-blue-100 font-khmer text-sm leading-relaxed">
              មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត<br />
              Khmer-Soviet Friendship Hospital
            </p>
          </div>

          {/* Animated Person Area / Image */}
          <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
            <img 
              src="/login_bg.png" 
              alt="Login Background" 
              className="max-w-full max-h-[220px] object-contain animate-float"
              onError={(e) => {
                e.target.style.display = 'none';
                const fallback = e.target.nextSibling;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            {/* Fallback if image not found */}
            <div className="hidden w-28 h-28 bg-white/15 rounded-full items-center justify-center border border-white/20 shadow-lg animate-float">
              <div className="w-12 h-12 text-white/90 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <div className="flex items-center gap-2 text-sm text-blue-100 font-khmer">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span>ប្រព័ន្ធកំពុងដំណើរការធម្មតា</span>
            </div>
            <p className="text-xs text-blue-200 mt-2 font-khmer">© ២០២៦ រក្សាសិទ្ធិគ្រប់យ៉ាង</p>
          </div>
        </div>

        {/* Right Side: Register Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center bg-white">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 font-khmer mb-1">បង្កើតគណនី</h2>
            <p className="text-sm text-gray-500 font-khmer">បង្កើតគណនីថ្មីដើម្បីប្រើប្រាស់ប្រព័ន្ធ</p>
          </div>

          {isAuthenticated && (
            <div className="mb-4 text-sm bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg p-3 font-khmer">
              អ្នកបានចូលប្រើរួចហើយ។ បើចង់បង្កើតគណនីថ្មី សូម Logout ជាមុន។
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(redirectTo, { replace: true })}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  បន្ត
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 font-khmer">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" style={{ opacity: isAuthenticated ? 0.6 : 1 }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-khmer">Staff ID</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-khmer text-sm"
                value={form.staffId}
                onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                placeholder="បញ្ចូល Staff ID"
                disabled={saving || isAuthenticated}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-khmer">លេខទូរស័ព្ទ</label>
              <input
                type="tel"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-khmer text-sm"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="បញ្ចូលលេខទូរស័ព្ទ"
                autoComplete="username"
                disabled={saving || isAuthenticated}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-khmer">លេខសម្ងាត់</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-khmer text-sm"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="បញ្ចូលលេខសម្ងាត់"
                  autoComplete="new-password"
                  required
                  disabled={saving || isAuthenticated}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-2.5 text-xs font-medium text-blue-600 hover:text-blue-700 font-khmer"
                  disabled={saving || isAuthenticated}
                >
                  {showPw ? 'លាក់' : 'បង្ហាញ'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-khmer">បញ្ជាក់លេខសម្ងាត់</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-khmer text-sm"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="បញ្ចូលលេខសម្ងាត់ម្តងទៀត"
                autoComplete="new-password"
                required
                disabled={saving || isAuthenticated}
              />
            </div>

            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-khmer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              disabled={saving || isAuthenticated}
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  កំពុងបង្កើត...
                </>
              ) : 'បង្កើតគណនី'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <a href={loginPath} className="text-sm font-medium text-blue-600 hover:text-blue-700 font-khmer">
              មានគណនីរួចហើយ? ចូលប្រើ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
