import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User } from 'lucide-react';

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

          {/* Animated Person Area (Red Box Area) */}
          <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
            <img
              src="/login_bg.png"
              alt="Login Background"
              className="max-w-full max-h-[250px] object-contain animate-float"
              onError={(e) => {
                e.target.style.display = 'none';
                const fallback = e.target.nextSibling;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            {/* Fallback if image not found */}
            <div className="hidden w-32 h-32 bg-white/15 rounded-full items-center justify-center border border-white/20 shadow-lg animate-float">
              <User className="w-16 h-16 text-white/90" />
            </div>
          </div>

          <div className="mt-auto">
            <style>{`
              @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-8px); }
                100% { transform: translateY(0px); }
              }
              .animate-float {
                animation: float 3s ease-in-out infinite;
              }
            `}</style>

            {/* Creator Spot with Animation */}
            <div className="flex items-center gap-3 mb-6 bg-white/10 p-3 rounded-lg backdrop-blur-sm animate-float">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 border border-white/30">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-100 font-khmer">រចនា និងអភិវឌ្ឍន៍ដោយ៖</p>
                <p className="text-sm font-bold text-white font-khmer">ក្រុមការងារ...................</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-blue-100 font-khmer">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span>ប្រព័ន្ធកំពុងដំណើរការធម្មតា</span>
            </div>
            <p className="text-xs text-blue-200 mt-2 font-khmer">© ២០២៦ រក្សាសិទ្ធិគ្រប់យ៉ាង</p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center bg-white">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 font-khmer mb-1">សូមស្វាគមន៍!</h2>
            <p className="text-sm text-gray-500 font-khmer">សូមបំពេញព័ត៌មានខាងក្រោមដើម្បីចូលប្រព័ន្ធ</p>
          </div>

          {/* Backend status hint */}
          {backendStatus && backendStatus !== 'online' && (
            <div className="mb-4 text-xs rounded-lg border p-3 text-red-700 bg-red-50 border-red-200 font-khmer flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>ម៉ាស៊ីនមេ (Backend) មិនទាន់ដំណើរការទេ! សូមទាក់ទងអ្នកគ្រប់គ្រង។</span>
            </div>
          )}

          {error && (
            <div className="mb-4 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100 font-khmer">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-khmer">អ៊ីមែល ឬ លេខទូរស័ព្ទ</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-khmer text-sm"
                value={form.identifier}
                onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
                placeholder="បញ្ចូលអ៊ីមែល ឬលេខទូរស័ព្ទ"
                autoComplete="username"
                required
                disabled={saving}
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
                  autoComplete="current-password"
                  required
                  disabled={saving}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-2.5 text-xs font-medium text-blue-600 hover:text-blue-700 font-khmer"
                  disabled={saving}
                >
                  {showPw ? 'លាក់' : 'បង្ហាញ'}
                </button>
              </div>
            </div>

            <button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-khmer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              disabled={saving || backendStatus === 'offline'}
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  កំពុងចូល...
                </>
              ) : 'ចូលប្រព័ន្ធ'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3 text-center">
            <a
              href="/staff-login"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 font-khmer flex items-center justify-center gap-1"
            >
              Staff Login (សម្រាប់បុគ្គលិក) →
            </a>
            <a
              href="/forgot-password"
              className="text-xs text-gray-400 hover:text-gray-600 font-khmer hover:underline"
            >
              ភ្លេចលេខសម្ងាត់?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
