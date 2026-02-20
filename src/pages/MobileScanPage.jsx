import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Flashlight,
  Save,
  Square,
  UserPlus,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { ensureFaceModelsLoaded, getFaceApi } from '../utils/faceApi';
import { checkGeoFence, fetchMyGeoFencePolicy, getCurrentGeo, getDefaultGeoFence, readCachedGeo, readGeoFence } from '../utils/geo';

const pad2 = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const nowHM = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};


async function fetchServerClock() {
  const r = await fetch('/api/health');
  if (!r.ok) throw new Error(`GET /api/health -> ${r.status}`);
  const data = await r.json().catch(() => null);
  const date = (data?.serverDate || '').toString().trim();
  const time = (data?.serverTime || '').toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  return { date, time };
}

function defaultTimeFor(mode, slot) {
  const s = String(slot || '').trim();
  const m = String(mode || '').trim().toLowerCase();
  const isOut = m === 'checkout';
  // Slot 1: 08:00 / 12:00, Slot 2: 13:00 / 17:00
  if (s === '1') return isOut ? '12:00' : '08:00';
  if (s === '2') return isOut ? '17:00' : '13:00';
  return '';
}

function escapeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseScanValue(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;

  const asJson = escapeJsonParse(v);
  if (asJson && typeof asJson === 'object') {
    const staffId = (asJson.staffId || asJson.staffID || asJson.id || '')
      .toString()
      .trim();
    const fullName = (asJson.fullName || asJson.name || '').toString().trim();
    if (staffId) return { staffId, fullName, raw: v };
  }

  if (v.includes('staffId=') || v.includes('staffID=') || v.includes('id=')) {
    try {
      const u = new URL(
        v.includes('://') ? v : `https://local.invalid/?${v.replace(/^\?/, '')}`,
      );
      const sp = u.searchParams;
      const staffId = (sp.get('staffId') || sp.get('staffID') || sp.get('id') || '').trim();
      const fullName = (sp.get('fullName') || sp.get('name') || '').trim();
      if (staffId) return { staffId, fullName, raw: v };
    } catch {
      // ignore
    }
  }

  const m = v.match(/^(?:STAFF|STAFFID|ID)\s*[:=]\s*(.+)$/i);
  if (m) return { staffId: m[1].trim(), fullName: '', raw: v };

  return { staffId: v, fullName: '', raw: v };
}

async function getExistingRecord(staffId, dateIso, token) {
  const url = `/api/attendance?staffId=${encodeURIComponent(staffId)}&date=${encodeURIComponent(dateIso)}`;
  const r = await fetch(url, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

function safeNotesMerge(existingNotes, newMeta) {
  const base = (() => {
    if (!existingNotes) return {};
    if (typeof existingNotes === 'object') return existingNotes;
    try {
      return JSON.parse(existingNotes);
    } catch {
      return { notes: String(existingNotes) };
    }
  })();

  const merged = { ...base };
  const events = Array.isArray(base.scanEvents) ? base.scanEvents.slice(0) : [];
  events.push({ at: new Date().toISOString(), ...newMeta });
  merged.scanEvents = events.slice(-20);
  if (newMeta.fullName && !merged.fullName) merged.fullName = newMeta.fullName;
  return JSON.stringify(merged);
}

export default function MobileScanPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { token, user } = useAuth();

  const canFaceEnroll = Array.isArray(user?.permissions)
    ? user.permissions.includes('face:enroll')
    : false;

  const modeParamRaw = sp.get('mode') || 'checkIn';
  const modeLower = String(modeParamRaw).toLowerCase();
  const mode = modeLower === 'checkout' ? 'checkOut' : 'checkIn';
  const slot = sp.get('slot') || '1';

  const title = useMemo(() => {
    const modeText = mode === 'checkOut' ? 'ចេញ' : 'ចូល';
    return `ស្កេន${modeText}ទី${slot}`;
  }, [mode, slot]);

  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const intervalRef = useRef(null);
  const lastRef = useRef({ value: '', at: 0 });
  const staffIdRef = useRef('');
  const fullNameRef = useRef('');

  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [supportText, setSupportText] = useState('កំពុងត្រៀម scanner...');

  const [staffId, setStaffId] = useState('');
  const [fullName, setFullName] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [dateIso, setDateIso] = useState(todayISO());
  const [hm, setHm] = useState(nowHM());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');

  const [faceReady, setFaceReady] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceError, setFaceError] = useState('');
  const [faceVerified, setFaceVerified] = useState(null);

  const [geoState, setGeoState] = useState(() => {
    const cached = readCachedGeo();
    return cached
      ? { status: 'ok', ...cached, cached: true, message: '' }
      : { status: 'idle', message: '' };
  });

  const [geoFence, setGeoFence] = useState(() => readGeoFence() || getDefaultGeoFence());
  const [fenceSource, setFenceSource] = useState('local'); // 'local' | 'server'
  const [policyInfo, setPolicyInfo] = useState(null);
  const fenceSourceRef = useRef('local');

  const refreshGeo = async () => {
    setGeoState((prev) => ({ ...prev, status: 'loading', message: '' }));
    const res = await getCurrentGeo({ timeout: 8000, maximumAge: 20000 });
    if (res?.ok) {
      setGeoState({ status: 'ok', ...res, cached: false, message: '' });
      return;
    }
    setGeoState((prev) => ({
      ...prev,
      status: res?.status || 'error',
      message: res?.message || 'ទាញទីតាំងមិនបាន',
    }));
  };

  useEffect(() => {
    try {
      const httpsOk = window.isSecureContext ? 'HTTPS ✅' : 'HTTP ❌';
      const camOk = navigator.mediaDevices?.getUserMedia ? 'Camera API ✅' : 'Camera API ❌';
      const barOk = typeof window.BarcodeDetector !== 'undefined' ? 'Barcode ✅' : 'Barcode ✅ (ZXing)';
      setSupportText(`${httpsOk} • ${camOk} • ${barOk} — ចុច “បើកកាមេរ៉ាស្កេន”`);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Auto-fetch location to make scanning easier.
    refreshGeo().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fenceSourceRef.current = fenceSource;
  }, [fenceSource]);

  useEffect(() => {
    let cancelled = false;
    const loadPolicy = async () => {
      if (!token) return;
      try {
        const data = await fetchMyGeoFencePolicy({ token });
        if (cancelled) return;
        setPolicyInfo(data || null);
        const sf = data?.fence;
        if (sf && (typeof sf.centerLat === 'number' || typeof sf.centerLng === 'number')) {
          setFenceSource('server');
          setGeoFence({
            enabled: true,
            centerLat: typeof sf.centerLat === 'number' ? sf.centerLat : null,
            centerLng: typeof sf.centerLng === 'number' ? sf.centerLng : null,
            radiusM: Number.isFinite(sf.radiusM) ? Number(sf.radiusM) : 200,
            maxAccuracyM: Number.isFinite(sf.maxAccuracyM) ? Number(sf.maxAccuracyM) : 250,
          });
        } else {
          setFenceSource('local');
        }
      } catch {
        // ignore (offline / backend down)
      }
    };
    loadPolicy();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    try {
      const onStorage = (e) => {
        if (e?.key === 'geo:fence_v1') {
          if (fenceSourceRef.current === 'server') return;
          setGeoFence(readGeoFence() || getDefaultGeoFence());
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    } catch {
      return undefined;
    }
  }, []);

  const fenceCheck = useMemo(() => {
    const cur = geoState?.status === 'ok' ? geoState : null;
    return checkGeoFence(cur, geoFence);
  }, [geoState, geoFence]);

  useEffect(() => {
    setDateIso(todayISO());
    const t = defaultTimeFor(modeParamRaw, slot);
    setHm(t || nowHM());
  }, [modeParamRaw, slot]);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const clock = await fetchServerClock();
        if (cancelled || !clock) return;
        setDateIso(clock.date);
        setHm(clock.time);
      } catch {
        // ignore
      }
    };
    sync();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    staffIdRef.current = staffId;
    setFaceVerified(null);
  }, [staffId]);

  useEffect(() => {
    fullNameRef.current = fullName;
  }, [fullName]);

  useEffect(() => {
    setFaceVerified(null);
  }, [dateIso, mode, slot]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!token) {
        setProfileLoaded(true);
        return;
      }

      try {
        const r = await fetch('/api/self/hr/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (!r.ok) {
          setProfileLoaded(true);
          return;
        }

        const hr = await r.json().catch(() => null);
        if (cancelled) return;

        const sid = (hr?.staffId || '').toString().trim();
        const nm = (hr?.khmerName || hr?.name || '').toString().trim();

        if (sid) setStaffId((prev) => (prev ? prev : sid));
        if (nm) setFullName((prev) => (prev ? prev : nm));

        setProfileLoaded(true);
      } catch {
        if (!cancelled) setProfileLoaded(true);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    return () => {
      try {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } catch {}
      try {
        streamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  const stopCamera = () => {
    setScanning(false);
    setTorchOn(false);
    setTorchSupported(false);
    setSupportText('បានបិទកាមេរ៉ា');
    try {
      if (intervalRef.current) clearInterval(intervalRef.current);
    } catch {}
    intervalRef.current = null;
    try {
      zxingControlsRef.current?.stop?.();
    } catch {}
    zxingControlsRef.current = null;
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    trackRef.current = null;
  };

  const ensureFaceModels = async () => {
    if (faceReady) return;
    await ensureFaceModelsLoaded();
    setFaceReady(true);
  };

  const startFaceCamera = async () => {
    if (scanning) return;
    setResult('');
    setSupportText('កំពុងបើកកាមេរ៉ាមុខ...');

    if (geoFence?.enabled && !fenceCheck.allowed) {
      if (fenceCheck.reason === 'not_configured') {
        setSupportText('មិនអនុញ្ញាត: សូមកំណត់ Geo-fence (Center/Radius) ជាមុនសិន');
        return;
      }
      if (fenceCheck.reason === 'no_location') {
        setSupportText('មិនអនុញ្ញាត: សូម Allow Location (GPS)');
        return;
      }
      if (fenceCheck.reason === 'accuracy_too_low') {
        setSupportText('មិនអនុញ្ញាត: GPS មិនសូវច្បាស់ (Accuracy ខ្ពស់ពេក)');
        return;
      }
      setSupportText('មិនអនុញ្ញាត: នៅក្រៅចំងាយ Geo-fence');
      return;
    }

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
    const track = stream.getVideoTracks()[0] || null;
    trackRef.current = track;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        // ignore
      }
    }

    try {
      const caps = track?.getCapabilities?.();
      setTorchSupported(!!caps?.torch);
    } catch {
      setTorchSupported(false);
    }

    setScanning(true);
    setSupportText('Camera មុខរួចរាល់ ✅ ចុច “ផ្ទៀងផ្ទាត់មុខ”');
  };

  const verifyFace = async () => {
    if (faceBusy) return;
    setFaceBusy(true);
    setFaceError('');
    setResult('');

    try {
      const id = (staffId || '').trim();
      if (!id) throw new Error('សូមបញ្ចូល Staff ID');
      if (!token) throw new Error('សូម Login ជាមុន');

      await ensureFaceModels();
      const faceapi = getFaceApi();
      if (!faceapi) throw new Error('face-api not available');

      if (!videoRef.current) throw new Error('camera not ready');
      setSupportText('កំពុងស្វែងរកមុខ...');

      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) throw new Error('រកមុខមិនឃើញ (សូមពន្លឺល្អ និងមុខត្រង់)');

      const descriptor = Array.from(detection.descriptor, (x) => Number(x));
      setSupportText('កំពុងផ្ទៀងផ្ទាត់...');

      const r = await fetch('/api/face/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ descriptor }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 403) {
          throw new Error('មិនមានសិទ្ធិផ្ទៀងផ្ទាត់មុខ (403) — សូមឲ្យ Admin បន្ថែម permission: view:attendance ឬ face:match');
        }
        throw new Error(data?.message || `Match failed: ${r.status}`);
      }

      if (!data?.matched) {
        setFaceVerified(null);
        setSupportText('មិន match ❌ សូមសាកម្ដងទៀត');
        setResult(
          `មិន match ❌\nBestDistance: ${data.distance?.toFixed?.(4) ?? data.distance ?? ''}\nThreshold: ${data.threshold}`,
        );
        return;
      }

      const matchedStaff = String(data.staffId || '').trim();
      if (matchedStaff && matchedStaff !== id) {
        setFaceVerified(null);
        setSupportText('Match មិនត្រូវ Staff ID ❌');
        setResult(`Match staff: ${matchedStaff}\nតែ Staff ID បច្ចុប្បន្ន: ${id}`);
        return;
      }

      const verified = {
        staffId: id,
        fullName: String(data.fullName || '').trim(),
        distance: data.distance,
        threshold: data.threshold,
        at: Date.now(),
      };
      setFaceVerified(verified);
      setSupportText('ផ្ទៀងផ្ទាត់មុខបានជោគជ័យ ✅');
      setResult(
        `Face Match ✅\nStaff: ${id}\nName: ${verified.fullName || ''}\nDistance: ${Number(verified.distance).toFixed(4)}\nThreshold: ${verified.threshold}`,
      );
    } catch (e) {
      setFaceVerified(null);
      setFaceError(e?.message || 'ផ្ទៀងផ្ទាត់មុខមិនបាន');
      setSupportText('ផ្ទៀងផ្ទាត់មុខមិនបាន');
    } finally {
      setFaceBusy(false);
    }
  };

  const startCamera = async () => {
    if (scanning) return;
    setResult('');
    setSupportText('កំពុងបើកកាមេរ៉ា...');

    // Most mobile browsers require a Secure Context (HTTPS) for camera.
    // On LAN IP over http://, getUserMedia may be unavailable.
    try {
      if (window.isSecureContext === false) {
        setSupportText(
          'មិនអាចបើកកាមេរ៉ា: ត្រូវការ HTTPS (secure). សូមបើកតាម https:// ឬកំណត់ Chrome "Insecure origins treated as secure"',
        );
        return;
      }
    } catch {
      // ignore
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setSupportText(
        'Browser មិនគាំទ្រ camera API (ឬកំពុងបើកតាម HTTP). សូមប្រើ Chrome និងបើកតាម HTTPS',
      );
      return;
    }

    const applyScannedValue = (value) => {
      if (!value) return;
      const now = Date.now();
      if (value === lastRef.current.value && now - lastRef.current.at < 1500) return;
      lastRef.current = { value, at: now };

      const parsed = parseScanValue(value);
      if (!parsed?.staffId) return;

      const scannedId = String(parsed.staffId || '').trim();
      if (scannedId) {
        const currentId = String(staffIdRef.current || '').trim();
        if (currentId && currentId !== scannedId) {
          const ok = window.confirm(
            `Staff ID បច្ចុប្បន្ន: ${currentId}\nបានស្កេនបាន: ${scannedId}\nចង់ប្ដូរទៅ Staff ID ស្កេនទេ?`,
          );
          if (ok) setStaffId(scannedId);
        } else if (!currentId) {
          setStaffId(scannedId);
        }
      }

      if (parsed.fullName && !String(fullNameRef.current || '').trim()) {
        setFullName(parsed.fullName);
      }
      try {
        if (navigator.vibrate) navigator.vibrate(40);
      } catch {}
      setResult(`បានស្កេនរួច ✅\nStaff ID: ${parsed.staffId}`);
    };

    // Preferred path: native BarcodeDetector (fast when available)
    if (typeof window.BarcodeDetector !== 'undefined') {
      detectorRef.current = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e'],
      });

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (e) {
        const name = e?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setSupportText('មិនអនុញ្ញាត Camera. សូម Allow camera permissions ឬបើកតាម HTTPS');
        } else if (name === 'NotFoundError') {
          setSupportText('រកមិនឃើញកាមេរ៉ា (NotFound). សូមពិនិត្យ Camera/Permission');
        } else {
          setSupportText(`បើកកាមេរ៉ាមិនបាន: ${name || 'Error'}`);
        }
        return;
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0] || null;
      trackRef.current = track;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // ignore
        }
      }

      try {
        const caps = track?.getCapabilities?.();
        setTorchSupported(!!caps?.torch);
      } catch {
        setTorchSupported(false);
      }

      setScanning(true);
      setSupportText('Camera រួចរាល់ ✅ សូមស្កេន...');

      intervalRef.current = setInterval(async () => {
        try {
          const v = videoRef.current;
          if (!v || v.readyState < 2) return;
          const detector = detectorRef.current;
          if (!detector) return;

          const hits = await detector.detect(v);
          const hit = hits && hits[0];
          const value = hit?.rawValue || '';
          applyScannedValue(value);
        } catch {
          // ignore
        }
      }, 250);

      return;
    }

    // Fallback: ZXing (supports iOS Safari / browsers without BarcodeDetector)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      setSupportText('Camera រួចរាល់ ✅ (ZXing) សូមស្កេន...');

      // ZXing will request camera and attach stream to the provided <video>
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, err) => {
          if (result?.getText) applyScannedValue(result.getText());
        },
      );
      zxingControlsRef.current = controls;

      // Capture track for torch toggle (if available)
      try {
        const stream = videoRef.current?.srcObject;
        if (stream) {
          streamRef.current = stream;
          const track = stream.getVideoTracks?.()[0] || null;
          trackRef.current = track;
          const caps = track?.getCapabilities?.();
          setTorchSupported(!!caps?.torch);
        }
      } catch {
        setTorchSupported(false);
      }

      setScanning(true);
    } catch (e) {
      const name = e?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setSupportText('មិនអនុញ្ញាត Camera. សូម Allow camera permissions ឬបើកតាម HTTPS');
      } else if (name === 'NotFoundError') {
        setSupportText('រកមិនឃើញកាមេរ៉ា (NotFound). សូមពិនិត្យ Camera/Permission');
      } else {
        setSupportText('Browser មិនអាចស្កេន Barcode បាន (សូមបញ្ចូល Staff ID ដោយដៃ)');
      }
    }
  };

  const toggleTorch = async () => {
    if (!torchSupported) return;
    const track = trackRef.current;
    if (!track?.applyConstraints) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      // ignore
    }
  };

  const saveAttendance = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (geoFence?.enabled && !fenceCheck.allowed) {
        if (fenceCheck.reason === 'not_configured') {
          throw new Error('សូមកំណត់ Geo-fence (Center/Radius) ជាមុនសិន');
        }
        if (fenceCheck.reason === 'no_location') {
          throw new Error('សូមបើក Location (GPS) ហើយ Allow permission');
        }
        if (fenceCheck.reason === 'accuracy_too_low') {
          throw new Error('GPS មិនសូវច្បាស់ (Accuracy ខ្ពស់ពេក)');
        }
        throw new Error('មិនអនុញ្ញាតស្កេន: នៅក្រៅចំងាយ Geo-fence');
      }

      const id = (staffId || '').trim();
      if (!id) throw new Error('សូមបញ្ចូល Staff ID');

      const v = faceVerified;
      const faceOk =
        v &&
        String(v.staffId || '').trim() === id &&
        typeof v.at === 'number' &&
        Date.now() - v.at <= 2 * 60 * 1000;
      if (!faceOk) {
        throw new Error('សូមផ្ទៀងផ្ទាត់មុខជាមុន (Face verification)');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
        throw new Error('កាលបរិច្ឆេទមិនត្រឹមត្រូវ (YYYY-MM-DD)');
      }
      if (!/^\d{2}:\d{2}$/.test(hm)) {
        throw new Error('ម៉ោងមិនត្រឹមត្រូវ (HH:MM)');
      }

      const meta = {
        fullName: (fullName || '').trim(),
        scanMode: mode,
        scanSlot: slot,
        scanSource: 'mobile_app_scan',
        faceVerifiedAt: new Date(faceVerified.at).toISOString(),
        faceDistance: faceVerified.distance,
        faceThreshold: faceVerified.threshold,
        userAgent: navigator.userAgent,
        geo: geoState?.status === 'ok' && typeof geoState.lat === 'number' && typeof geoState.lng === 'number'
          ? {
              lat: geoState.lat,
              lng: geoState.lng,
              accuracy: geoState.accuracy ?? null,
              at: typeof geoState.at === 'number' ? new Date(geoState.at).toISOString() : null,
              cached: !!geoState.cached,
            }
          : null,
        geoStatus: geoState?.status || 'unknown',
        geoMessage: geoState?.message || '',
      };

      const slotStr = String(slot || '').trim();
      const isSlot2 = slotStr === '2';
      const field = (() => {
        if (mode === 'checkIn') return isSlot2 ? 'checkIn2' : 'checkIn';
        return isSlot2 ? 'checkOut2' : 'checkOut';
      })();
      const legacyField = (() => {
        if (mode === 'checkIn') return isSlot2 ? 'inTime2' : 'inTime';
        return isSlot2 ? 'outTime2' : 'outTime';
      })();

      const existing = await getExistingRecord(id, dateIso, token);
      const existingRec = existing[0];

      if (existingRec && (existingRec._id || existingRec.id)) {
        const recId = existingRec._id || existingRec.id;
        const updates = {};
        updates[field] = hm;
        updates.notes = safeNotesMerge(existingRec.notes, meta);

        const cur = (existingRec?.[field] || existingRec?.[legacyField] || '').toString();
        if (cur && cur !== hm) {
          const ok = window.confirm(
            `មានម៉ោង${mode === 'checkIn' ? 'ចូល' : 'ចេញ'}រួចហើយ (${cur}). ចង់ប្តូរទៅ ${hm} ទេ?`,
          );
          if (!ok) {
            setResult('បានបោះបង់ (មិនបានផ្លាស់ប្តូរ)');
            return;
          }
        }

        const r = await fetch(`/api/attendance/${encodeURIComponent(recId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(updates),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.message || `Update failed: ${r.status}`);
        setResult(`បានអាប់ដេតរួច ✅\nID: ${recId}\nStaff: ${id}\nDate: ${dateIso}\n${mode}: ${hm}`);
        return;
      }

      const payload = {
        staffId: id,
        date: dateIso,
        notes: safeNotesMerge(null, meta),
      };
      payload[field] = hm;

      const r = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `Create failed: ${r.status}`);
      const newId = data._id || data.id || '';
      setResult(`បានរក្សាទុករួច ✅\nID: ${newId}\nStaff: ${id}\nDate: ${dateIso}\n${mode}: ${hm}`);
    } catch (err) {
      setResult(err?.message || 'រក្សាទុកមិនបាន');
    } finally {
      setSaving(false);
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
            <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
            <div className="truncate text-xs text-slate-500">{supportText}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-3 pb-6 pt-4">
        <section className="overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-slate-200/70">
          <div className="relative">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-[38vh] w-full object-cover sm:h-[44vh]"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[60%] w-[75%] rounded-2xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 bg-white p-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startCamera}
              disabled={scanning}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Camera size={18} />
              បើកកាមេរ៉ាស្កេន
            </button>
            <button
              type="button"
              onClick={startFaceCamera}
              disabled={scanning}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Camera size={18} />
              បើកកាមេរ៉ាមុខ
            </button>
            <button
              type="button"
              onClick={stopCamera}
              disabled={!scanning}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Square size={18} />
              បិទកាមេរ៉ា
            </button>
            <button
              type="button"
              onClick={verifyFace}
              disabled={!scanning || faceBusy}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save size={18} />
              {faceBusy ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'ផ្ទៀងផ្ទាត់មុខ'}
            </button>
            <button
              type="button"
              onClick={toggleTorch}
              disabled={!scanning || !torchSupported}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60 sm:col-span-2"
            >
              <Flashlight size={18} />
              ពន្លឺ (Torch){torchOn ? ' — បើក' : ''}
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
              {!!token && !profileLoaded ? (
                <div className="mt-1 text-[11px] text-slate-500">កំពុងទាញយក Staff ID...</div>
              ) : null}
              {!!token && profileLoaded && staffId ? (
                <div className="mt-1 text-[11px] text-slate-500">បានបំពេញពីគណនី (អាចកែដោយដៃបាន)</div>
              ) : null}
              {!!token && profileLoaded && !staffId ? (
                <div className="mt-1 text-[11px] text-amber-700">
                  មិនអាចរក Staff ID ស្វ័យប្រវត្តិបាន—សូមបញ្ចូលដោយដៃ
                </div>
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
              {!!token && !fullName ? (
                <div className="mt-1 text-[11px] text-slate-500">
                  បានចូលជា {user?.fullName || user?.name || user?.phone || user?.email || 'User'}
                </div>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">កាលបរិច្ឆេទ (YYYY-MM-DD)</label>
              <input
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">ម៉ោង (HH:MM)</label>
              <input
                value={hm}
                onChange={(e) => setHm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-700">ទីតាំង (GPS)</div>
          <button
            type="button"
            onClick={() => refreshGeo()}
            className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
          >
            ទាញទីតាំងឡើងវិញ
          </button>
        </div>
        <div className="mt-1 text-[11px] text-slate-600">
          {geoState?.status === 'loading'
            ? 'កំពុងទាញទីតាំង...'
            : geoState?.status === 'ok'
              ? `បានយកទីតាំង ✅ (${geoState.lat?.toFixed?.(6)}, ${geoState.lng?.toFixed?.(6)}${geoState.accuracy ? ` ±${Math.round(geoState.accuracy)}m` : ''})`
              : geoState?.message
                ? geoState.message
                : 'មិនទាន់ទាញទីតាំង'}
        </div>
        {geoFence?.enabled ? (
          <div className="mt-2 text-[11px] font-semibold">
            {fenceCheck.allowed ? (
              <span className="text-emerald-700">Geo-fence: អនុញ្ញាត ✅</span>
            ) : (
              <span className="text-rose-700">Geo-fence: មិនអនុញ្ញាត ❌</span>
            )}
            {fenceSource === 'server' ? (
              <span className="text-slate-600"> — Admin: {policyInfo?.policy?.name || 'policy'}</span>
            ) : null}
            {typeof fenceCheck?.distanceM === 'number' ? (
              <span className="text-slate-600"> — ចម្ងាយ {Math.round(fenceCheck.distanceM)}m / {Math.round(fenceCheck.radiusM || 0)}m</span>
            ) : null}
          </div>
        ) : null}
      </div>
          </div>

          <button
            type="button"
            onClick={saveAttendance}
            disabled={saving || !faceVerified || (geoFence?.enabled && !fenceCheck.allowed)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកវត្តមាន'}
          </button>

          {!faceVerified ? (
            <div className="mt-2 text-xs font-semibold text-amber-700">
              រក្សាទុកបានលុះត្រាតែផ្ទៀងផ្ទាត់មុខសិន
            </div>
          ) : (
            <div className="mt-2 text-xs font-semibold text-emerald-700">
              Face Verified ✅ (អស់សុពលភាពក្នុង 2 នាទី)
            </div>
          )}

          {faceError ? (
            <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">
              <div>{faceError}</div>
              {!faceVerified && canFaceEnroll ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/mobileApp/face-enroll')}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    <UserPlus size={16} />
                    ចុះឈ្មោះមុខ (Enroll)
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              {result}
            </pre>
          ) : null}
        </section>
      </main>
    </div>
  );
}
