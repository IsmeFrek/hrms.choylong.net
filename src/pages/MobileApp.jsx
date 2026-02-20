import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutGrid,
  ScanLine,
  UserCircle2,
  UserPlus,
} from 'lucide-react';

import hospitalLogo from '../assets/3.JPG';
import { useAuth } from '../context/AuthContext';

export default function MobileApp() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null); // 'online' | 'offline' | 'error' | null

  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const actions = useMemo(
    () => [
      {
        key: 'service',
        label: 'ទិន្នន័យវត្តមាន',
        icon: ScanLine,
        iconClass: 'bg-orange-500 text-white',
      },
      {
        key: 'faceEnroll',
        label: 'ចុះឈ្មោះមុខ (Enroll)',
        icon: UserPlus,
        iconClass: 'bg-sky-600 text-white',
      },
      {
        key: 'request',
        label: 'ស្នើសុំច្បាប់',
        icon: ClipboardList,
        iconClass: 'bg-blue-600 text-white',
      },
      {
        key: 'work',
        label: 'ព័ត៌មាន',
        icon: LayoutGrid,
        iconClass: 'bg-emerald-600 text-white',
      },
      {
        key: 'calendar',
        label: 'ប្រតិទិនការងារ',
        icon: CalendarDays,
        iconClass: 'bg-indigo-600 text-white',
      },
    ],
    [],
  );

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
    return () => {
      cancelled = true;
    };
  }, [API_PREFIX]);

  useEffect(() => {
    if (isAuthenticated) {
      setShowLogin(false);
      setStatus('បានចូលប្រើប្រាស់រួច ✅');
    }
  }, [isAuthenticated]);

  const onLogin = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus('');
    try {
      const identifier = (username || '').trim();
      if (!identifier || !password) {
        throw new Error('សូមបញ្ចូល ឈ្មោះអ្នកប្រើ និង ពាក្យសម្ងាត់');
      }

      const res = await fetch(`${API_PREFIX}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        const msg = data?.message || text || 'ចូលប្រើប្រាស់មិនបាន';
        throw new Error(msg);
      }

      if (!data?.token || !data?.user) {
        throw new Error('Server ផ្ញើទិន្នន័យ Login មិនត្រឹមត្រូវ');
      }

      login(data.token, data.user);
      setShowLogin(false);
      setPassword('');
      setStatus('ចូលបានជោគជ័យ ✅');
    } catch (err) {
      const message =
        err?.message ||
        (backendStatus === 'offline'
          ? 'មិនអាចភ្ជាប់ទៅ Server បានទេ'
          : 'ចូលប្រើប្រាស់មិនបាន');
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  const onAction = (key) => {
    if (key === 'service') {
      navigate('/mobileApp/attendance');
      return;
    }
    if (key === 'faceEnroll') {
      if (!isAuthenticated) {
        setShowLogin(true);
        setStatus('សូមចូលប្រើប្រាស់សិន ដើម្បីចុះឈ្មោះមុខ');
        return;
      }
      navigate('/mobileApp/face-enroll');
      return;
    }
    const picked = actions.find((a) => a.key === key);
    setStatus(`ជ្រើសរើស: ${picked?.label || key} (កំពុងអភិវឌ្ឍ…)`);
  };

  return (
    <div className="bg-slate-100" style={{ minHeight: '100dvh' }}>
      <main className="px-3 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-[520px]">
          <header className="mb-3">
            <div className="flex items-center justify-center rounded-2xl bg-white px-4 py-6 shadow-sm ring-1 ring-slate-200/70">
              <img
                src={hospitalLogo}
                alt="Logo"
                className="h-20 w-auto max-w-full object-contain"
              />
            </div>
          </header>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                <img
                  src={hospitalLogo}
                  alt="Hospital"
                  className="h-10 w-10 rounded-lg object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត
                </div>
                <div className="truncate text-xs text-slate-500">
                  Khmer-Soviet Friendship Hospital
                </div>
                {isAuthenticated && (
                  <div className="mt-0.5 truncate text-[11px] text-slate-500">
                    បានចូលជា: <span className="font-semibold text-slate-700">{user?.fullName || user?.name || user?.email || user?.phone || 'User'}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowLogin((v) => !v);
                  setStatus('');
                }}
                className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm active:translate-y-[1px] disabled:opacity-60"
                disabled={saving}
              >
                {showLogin ? 'បិទ' : 'ចូលប្រើប្រាស់'}
              </button>
            </div>

            {showLogin ? (
              <form
                onSubmit={onLogin}
                className="border-t border-slate-100 bg-slate-50 px-4 py-4"
              >
                <div className="space-y-2">
                  {backendStatus && (
                    <div
                      className={`rounded-xl border px-3 py-2 text-[12px] ${
                        backendStatus === 'online'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      Server: {backendStatus === 'online' ? 'Online' : 'Unavailable'}
                      {API_BASE_RAW ? ` (${API_BASE_RAW})` : ' (/api via proxy)'}
                    </div>
                  )}
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ឈ្មោះអ្នកប្រើ"
                    autoComplete="username"
                    aria-label="ឈ្មោះអ្នកប្រើ"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    disabled={saving}
                  />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ពាក្យសម្ងាត់"
                    type="password"
                    autoComplete="current-password"
                    aria-label="ពាក្យសម្ងាត់"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    disabled={saving}
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-b from-orange-500 to-orange-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm active:translate-y-[1px] disabled:opacity-60"
                    disabled={saving || !username || !password || backendStatus === 'offline'}
                  >
                    {saving ? 'កំពុងចូល...' : 'ចូលប្រើប្រាស់'}
                  </button>
                </div>
              </form>
            ) : null}

            {status ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-2 text-xs text-slate-600">
                <div className="min-w-0 truncate">{status}</div>
                <button
                  type="button"
                  onClick={() => setStatus('')}
                  className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  aria-label="បិទសារ"
                >
                  បិទ
                </button>
              </div>
            ) : null}
          </section>

          <section className="mt-4 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70">
            <div className="space-y-2">
              {actions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => onAction(a.key)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:bg-slate-50 active:scale-[0.995]"
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${a.iconClass}`}
                    >
                      <Icon size={22} />
                    </span>
                    <span className="flex-1 text-[16px] font-medium text-slate-900">
                      {a.label}
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <ChevronRight size={20} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-4 text-center text-xs text-slate-500">
            ចូលតាម URL: <span className="font-semibold">/mobileApp</span>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-[520px] px-4 pb-[env(safe-area-inset-bottom)] pt-2">
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => setStatus('Home (កំពុងអភិវឌ្ឍ…)')}
              className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-indigo-600"
            >
              <Home size={20} />
              <span className="text-[11px] font-medium">Home</span>
            </button>
            <button
              type="button"
              onClick={() => setStatus('Benefit (កំពុងអភិវឌ្ឍ…)')}
              className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
            >
              <LayoutGrid size={20} />
              <span className="text-[11px] font-medium">Benefit</span>
            </button>
            <button
              type="button"
              onClick={() => setStatus('Notify (កំពុងអភិវឌ្ឍ…)')}
              className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
            >
              <Bell size={20} />
              <span className="text-[11px] font-medium">Notify</span>
            </button>
            <button
              type="button"
              onClick={() => setStatus('Profile (កំពុងអភិវឌ្ឍ…)')}
              className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-slate-500"
            >
              <UserCircle2 size={20} />
              <span className="text-[11px] font-medium">Profile</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
