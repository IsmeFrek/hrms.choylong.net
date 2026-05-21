import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import usePermission from '../hooks/usePermission';
import StaffOnboardingPage from './StaffOnboardingPage';

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString();
  } catch {
    return String(d);
  }
}

function Field({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-b-0">
      <div className="text-sm text-gray-600 whitespace-nowrap">{label}</div>
      <div className="text-sm text-gray-900 text-right break-words">{value || '—'}</div>
    </div>
  );
}

export default function MyHrPage() {
  const { user } = useAuth();
  const perms = usePermission();
  const pdfRef = useRef(null);
  const registerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);

  const [showEmployeeRegister, setShowEmployeeRegister] = useState(false);

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestOk, setRequestOk] = useState('');
  const [pdfSaving, setPdfSaving] = useState(false);
  const [requestForm, setRequestForm] = useState({
    khmerName: '',
    name: '',
    phone: '',
    email: '',
    birthPlace: '',
    currentPlace: '',
    reason: '',
  });

  const isAdmin = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.some((r) => (r?.name || r) === 'Admin');
  }, [user?.roles]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/self/hr/me');
        if (!mounted) return;
        setProfile(res.data);

        // Prefill request form from current profile (do NOT mutate displayed profile on submit)
        setRequestForm((prev) => ({
          ...prev,
          khmerName: res.data?.khmerName || '',
          name: res.data?.name || '',
          phone: res.data?.phone || '',
          email: res.data?.email || '',
          birthPlace: res.data?.birthPlace || '',
          currentPlace: res.data?.currentPlace || '',
        }));
      } catch (e) {
        if (!mounted) return;
        const msg = e?.response?.data?.message || e?.message || 'Failed to load HR profile';
        setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const canRequestEdit = useMemo(() => {
    if (isAdmin) return false;
    // If they can view My HR, they should be able to request a change; backend enforces ownership.
    return Boolean(perms?.canViewMyHr || perms?.canViewSelfService);
  }, [isAdmin, perms?.canViewMyHr, perms?.canViewSelfService]);

  const exportPdfClient = async () => {
    const el = pdfRef.current;
    if (!el) throw new Error('Nothing to export');
    const mod = await import('html2pdf.js');
    const html2pdf = mod.default || mod;
    const filename = `MY_HR_${profile?.staffId || 'profile'}.pdf`;
    const opt = {
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().set(opt).from(el).save();
  };

  const readBlobAsText = (blob) => new Promise((resolve) => {
    try {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => resolve('');
      r.readAsText(blob);
    } catch {
      resolve('');
    }
  });

  const extractBlobErrorMessage = async (err) => {
    try {
      const data = err?.response?.data;
      if (data && typeof data === 'object' && !(data instanceof Blob)) {
        return data.message || data.error || err?.message || '';
      }
      if (data instanceof Blob) {
        const txt = await readBlobAsText(data);
        try {
          const j = txt ? JSON.parse(txt) : null;
          return j?.message || j?.error || txt || err?.message || '';
        } catch {
          return txt || err?.message || '';
        }
      }
      return err?.message || '';
    } catch {
      return err?.message || '';
    }
  };

  const downloadPdf = async () => {
    setRequestError('');
    setRequestOk('');
    setPdfSaving(true);
    try {
      const res = await api.get('/self/hr/me/pdf', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'] || '';
      const m = String(cd).match(/filename="?([^";]+)"?/i);
      const fallback = `MY_HR_${profile?.staffId || 'profile'}.pdf`;
      a.download = (m && m[1]) ? m[1] : fallback;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // Server-side PDF generation can fail (e.g., Puppeteer/Chromium missing). Fallback to client PDF.
      const msg = await extractBlobErrorMessage(e);
      try {
        await exportPdfClient();
      } catch {
        setRequestError(msg || 'ទាញ PDF មិនបាន');
      }
    } finally {
      setPdfSaving(false);
    }
  };

  const computeChangedFields = useMemo(() => {
    const p = profile || {};
    const f = requestForm || {};
    const changed = {};
    const keys = ['khmerName', 'name', 'phone', 'email', 'birthPlace', 'currentPlace'];
    for (const k of keys) {
      const pv = (p[k] ?? '') + '';
      const fv = (f[k] ?? '') + '';
      if (pv.trim() !== fv.trim()) changed[k] = fv.trim();
    }
    return changed;
  }, [profile, requestForm]);

  const submitChangeRequest = async (e) => {
    e.preventDefault();
    setRequestOk('');
    setRequestError('');

    if (!profile?.id) {
      setRequestError('មិនអាចស្នើកែប្រែបានទេ (ខ្វះ HR id)');
      return;
    }

    const changed = computeChangedFields;
    if (!changed || Object.keys(changed).length === 0) {
      setRequestError('មិនមានការផ្លាស់ប្ដូរ');
      return;
    }

    setRequestSaving(true);
    try {
      await api.post(`/self/hr/${profile.id}/self-edit`, {
        fields: changed,
        reason: (requestForm?.reason || '').trim() || 'My HR self-edit request',
      });
      setRequestOk('បានផ្ញើសំណើរួចរាល់ — សូមរង់ចាំ Admin អនុម័ត');
      setIsRequestOpen(false);
      setRequestForm((prev) => ({ ...prev, reason: '' }));
    } catch (e2) {
      const msg = e2?.response?.data?.message || e2?.message || 'បរាជ័យក្នុងការផ្ញើសំណើ';
      setRequestError(msg);
    } finally {
      setRequestSaving(false);
    }
  };

  const imageUrl = useMemo(() => {
    const img = profile?.image;
    if (!img) return '';
    if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) return img;
    // HR images are often stored as relative paths under /uploads or similar; allow browser to resolve
    return img;
  }, [profile?.image]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white border rounded-lg p-6 text-gray-700">កំពុងទាញយកទិន្នន័យ...</div>
      </div>
    );
  }

  if (error) {
    const isForbidden = /forbidden/i.test(String(error || ''));
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white border rounded-lg p-6">
          <div className="text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm">{error}</div>
          <div className="mt-3 text-sm text-gray-700">គណនីដែលកំពុងចូលប្រើ: {user?.phone || user?.email || user?.fullName || '—'}</div>
          {isAdmin && (
            <div className="mt-3 text-sm text-gray-700">
              គណនីនេះជា Admin ដូច្នេះអាចមិនមាន HR Profile ផ្ទាល់ខ្លួនទេ។ សូម Logout រួច Login ជា Staff (លេខទូរស័ព្ទ/StaffId ដែលបានអនុម័ត) ដើម្បីមើល “ព័ត៌មានខ្លួនឯង”។
            </div>
          )}
          {isForbidden && !isAdmin && (
            <div className="mt-3 text-sm text-gray-700">
              សិទ្ធិមិនគ្រប់គ្រាន់សម្រាប់ទំព័រ “ព័ត៌មានខ្លួនឯង”។ សូមឲ្យ Admin ដាក់ Permission `view:my-hr` (ឬ `view:selfservice`) ទៅលើ Role របស់អ្នក។
            </div>
          )}
          <div className="mt-4 text-sm text-gray-600">បើ HR Record មិនទាន់មាន សូមបំពេញ “ទម្រង់ចុះឈ្មោះ (Tabs)” ខាងក្រោម ដើម្បីផ្ញើជាសំណើរង់ចាំ Admin អនុម័ត។</div>
          </div>

          <div className="mt-4 bg-white border rounded-lg p-4" ref={registerRef}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-semibold text-gray-900">ទម្រង់ចុះឈ្មោះ (Tabs)</div>
            </div>
            <StaffOnboardingPage
              embedded
              allowApproved
              onSubmitted={() => {
                setRequestOk('បានផ្ញើព័ត៌មានរួចហើយ — សូមរង់ចាំ Admin អនុម័ត');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-xl font-semibold text-gray-900">ទម្រង់ចុះឈ្មោះ (Tabs)</div>
          </div>
          <StaffOnboardingPage
            embedded
            allowApproved
            initialData={profile}
            onSubmitted={() => {
              setRequestOk('បានផ្ញើព័ត៌មានរួចហើយ — សូមរង់ចាំ Admin អនុម័ត');
            }}
          />
        </div>
      </div>

      {isRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="font-semibold text-gray-900">ស្នើកែប្រែទិន្នន័យ (រង់ចាំអនុម័ត)</div>
              <button
                onClick={() => { if (!requestSaving) setIsRequestOpen(false); }}
                className="px-2 py-1 rounded border text-sm"
              >បិទ</button>
            </div>

            <form onSubmit={submitChangeRequest} className="p-5">
              <div className="text-sm text-gray-600 mb-4">
                * កែប្រែបានតែជាសំណើ (pending) ហើយ Admin នឹងអនុម័តទើបប្តូរទិន្នន័យពិត។
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">ឈ្មោះ (ខ្មែរ)</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={requestForm.khmerName}
                    onChange={(e) => setRequestForm((p) => ({ ...p, khmerName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">ឈ្មោះ (ឡាតាំង)</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={requestForm.name}
                    onChange={(e) => setRequestForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">ទូរស័ព្ទ</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={requestForm.phone}
                    onChange={(e) => setRequestForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">អ៊ីមែល</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={requestForm.email}
                    onChange={(e) => setRequestForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">ទីកន្លែងកំណើត</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={requestForm.birthPlace}
                    onChange={(e) => setRequestForm((p) => ({ ...p, birthPlace: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">អាសយដ្ឋានបច្ចុប្បន្ន</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={requestForm.currentPlace}
                    onChange={(e) => setRequestForm((p) => ({ ...p, currentPlace: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-gray-700 mb-1">មូលហេតុ (Optional)</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-20"
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="ឧ: ប្ដូរលេខទូរស័ព្ទថ្មី..."
                />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  ផ្លាស់ប្ដូរ: {Object.keys(computeChangedFields || {}).length}
                </div>
                <button
                  type="submit"
                  disabled={requestSaving}
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60"
                >{requestSaving ? 'កំពុងផ្ញើ...' : 'ផ្ញើសំណើរង់ចាំអនុម័ត'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
