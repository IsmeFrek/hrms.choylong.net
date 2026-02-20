import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Save, Square } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { ensureFaceModelsLoaded, getFaceApi } from '../utils/faceApi';

export default function MobileFaceEnrollPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [supportText, setSupportText] = useState('ត្រៀមចុះឈ្មោះមុខ...');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  const [staffId, setStaffId] = useState('');
  const [fullName, setFullName] = useState('');

  const [modelsReady, setModelsReady] = useState(false);
  const [descriptor, setDescriptor] = useState(null);
  const [replace, setReplace] = useState(false);

  const consentText = useMemo(
    () =>
      'ខ្ញុំយល់ព្រមឲ្យប្រព័ន្ធរក្សាទុក face template/embedding របស់ខ្ញុំ សម្រាប់ផ្ទៀងផ្ទាត់វត្តមាន ហើយខ្ញុំអាចស្នើលុបបាននៅពេលក្រោយ។',
    [],
  );
  const [consent, setConsent] = useState(false);

  const [result, setResult] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!token) return;
      try {
        const r = await fetch('/api/self/hr/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const hr = await r.json().catch(() => null);
        if (cancelled) return;
        const sid = (hr?.staffId || '').toString().trim();
        const nm = (hr?.khmerName || hr?.name || '').toString().trim();
        if (sid) setStaffId((p) => (p ? p : sid));
        if (nm) setFullName((p) => (p ? p : nm));
      } catch {
        // ignore
      }
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    try {
      const httpsOk = window.isSecureContext ? 'HTTPS ✅' : 'HTTP ❌';
      const camOk = navigator.mediaDevices?.getUserMedia ? 'Camera API ✅' : 'Camera API ❌';
      setSupportText(`${httpsOk} • ${camOk} — ចុច “បើកកាមេរ៉ា”`);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {
        // ignore
      }
    };
  }, []);

  const stopCamera = () => {
    setScanning(false);
    setSupportText('បានបិទកាមេរ៉ា');
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    streamRef.current = null;
    try {
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {
      // ignore
    }
  };

  const startCamera = async () => {
    if (scanning) return;
    setResult('');
    setDescriptor(null);

    try {
      if (window.isSecureContext === false) {
        setSupportText('មិនអាចបើកកាមេរ៉ា: ត្រូវការ HTTPS (secure)');
        return;
      }
    } catch {
      // ignore
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setSupportText('Browser មិនគាំទ្រ camera API');
      return;
    }

    setSupportText('កំពុងបើកកាមេរ៉ា...');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (e) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setSupportText('មិនអនុញ្ញាត Camera. សូម Allow camera permissions');
      } else if (name === 'NotFoundError') {
        setSupportText('រកមិនឃើញកាមេរ៉ា (NotFound)');
      } else {
        setSupportText(`បើកកាមេរ៉ាមិនបាន: ${name || 'Error'}`);
      }
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        // ignore
      }
    }

    setScanning(true);
    setSupportText('Camera រួចរាល់ ✅');
  };

  const prepareModels = async () => {
    if (modelsReady) return;
    setBusy(true);
    setResult('');
    try {
      await ensureFaceModelsLoaded();
      setModelsReady(true);
    } catch (e) {
      setResult(e?.message || 'ទាញ face models មិនបាន');
    } finally {
      setBusy(false);
    }
  };

  const captureDescriptor = async () => {
    if (busy) return;
    setBusy(true);
    setResult('');
    setDescriptor(null);

    try {
      await prepareModels();
      const faceapi = getFaceApi();
      if (!faceapi) throw new Error('face-api not available');
      if (!videoRef.current) throw new Error('camera not ready');

      setSupportText('កំពុងរកមុខ...');
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) throw new Error('រកមុខមិនឃើញ (សូមពន្លឺល្អ និងមុខត្រង់)');

      const arr = Array.from(detection.descriptor, (x) => Number(x));
      if (arr.length !== 128) throw new Error('descriptor មិនត្រឹមត្រូវ');

      setDescriptor(arr);
      setSupportText('បានចាប់មុខរួច ✅');
      setResult('បានចាប់ Face Template ✅');
    } catch (e) {
      setSupportText('ចាប់មុខមិនបាន');
      setResult(e?.message || 'ចាប់មុខមិនបាន');
    } finally {
      setBusy(false);
    }
  };

  const enroll = async () => {
    if (busy) return;
    setBusy(true);
    setResult('');

    try {
      const id = (staffId || '').trim();
      if (!id) throw new Error('សូមបញ្ចូល Staff ID');
      if (!token) throw new Error('សូម Login ជាមុន');
      if (!consent) throw new Error('សូមយល់ព្រម (consent) ជាមុន');
      if (!descriptor) throw new Error('សូមចាប់មុខ (capture) ជាមុន');

      const r = await fetch('/api/face/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          staffId: id,
          fullName: (fullName || '').trim(),
          descriptor,
          consent: true,
          consentText,
          replace,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 403) {
          throw new Error('មិនមានសិទ្ធិចុះឈ្មោះមុខ (403) — ត្រូវការ permission: face:enroll');
        }
        throw new Error(data?.message || `Enroll failed: ${r.status}`);
      }

      setSupportText('ចុះឈ្មោះមុខរួច ✅');
      setResult(
        `Enroll ✅\nStaff: ${data.staffId || id}\nName: ${data.fullName || ''}\nDescriptors: ${data.descriptorsCount ?? ''}`,
      );
    } catch (e) {
      setSupportText('ចុះឈ្មោះមុខមិនបាន');
      setResult(e?.message || 'ចុះឈ្មោះមុខមិនបាន');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-100" style={{ minHeight: '100dvh' }}>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-3 py-3">
          <button
            type="button"
            onClick={() => navigate('/mobileApp/attendance')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 active:scale-[0.99]"
            aria-label="ត្រឡប់"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">ចុះឈ្មោះមុខ (Enroll)</div>
            <div className="truncate text-xs text-slate-500">{supportText}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-3 pb-6 pt-4">
        <section className="overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-slate-200/70">
          <div className="relative">
            <video ref={videoRef} playsInline muted autoPlay className="h-[38vh] w-full object-cover sm:h-[44vh]" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[60%] w-[75%] rounded-2xl border-2 border-sky-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 bg-white p-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startCamera}
              disabled={scanning || busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Camera size={18} />
              បើកកាមេរ៉ា
            </button>
            <button
              type="button"
              onClick={stopCamera}
              disabled={!scanning || busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Square size={18} />
              បិទកាមេរ៉ា
            </button>
            <button
              type="button"
              onClick={captureDescriptor}
              disabled={!scanning || busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"
            >
              <Save size={18} />
              {busy ? 'កំពុងចាប់មុខ...' : 'ចាប់មុខ (Capture)'}
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Staff ID</label>
              <input
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="12345"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              {!!token && !staffId ? (
                <div className="mt-1 text-[11px] text-slate-500">បានចូលជា: {user?.fullName || user?.name || user?.email || user?.phone || 'User'}</div>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">ឈ្មោះ (optional)</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="គោត្តនាម និង នាម"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold">យល់ព្រម</span>: {consentText}
              </span>
            </label>

            <label className="mt-2 flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              <span>Replace templates ចាស់ (បើមិនធីក = បន្ថែមថ្មី)</span>
            </label>
          </div>

          <button
            type="button"
            onClick={enroll}
            disabled={busy || !descriptor}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={18} />
            {busy ? 'កំពុងចុះឈ្មោះ...' : 'ចុះឈ្មោះមុខ (Enroll)'}
          </button>

          {!descriptor ? (
            <div className="mt-2 text-xs font-semibold text-amber-700">សូមចាប់មុខ (capture) មុនសិន</div>
          ) : (
            <div className="mt-2 text-xs font-semibold text-emerald-700">មាន Face Template ✅</div>
          )}

          {result ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{result}</pre>
          ) : null}
        </section>
      </main>
    </div>
  );
}
