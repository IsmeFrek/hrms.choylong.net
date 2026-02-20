import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, LogIn, LogOut, UserPlus } from 'lucide-react';

import hospitalLogo from '../assets/3.JPG';
import { useAuth } from '../context/AuthContext';
import {
  checkGeoFence,
  fetchMyGeoFencePolicy,
  getCurrentGeo,
  getDefaultGeoFence,
  readGeoFence,
  writeGeoFence,
} from '../utils/geo';

export default function MobileAttendanceData() {
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [geo, setGeo] = useState(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [fence, setFence] = useState(() => readGeoFence() || getDefaultGeoFence());
  const [showFence, setShowFence] = useState(false);
  const [fenceSource, setFenceSource] = useState('local'); // 'local' | 'server'
  const [policyInfo, setPolicyInfo] = useState(null);

  const refreshGeo = async () => {
    setGeoMsg('កំពុងទាញទីតាំង...');
    const res = await getCurrentGeo({ timeout: 8000, maximumAge: 20000 });
    if (res?.ok) {
      setGeo(res);
      setGeoMsg('');
      return;
    }
    setGeo(null);
    setGeoMsg(res?.message || 'ទាញទីតាំងមិនបាន');
  };

  useEffect(() => {
    refreshGeo().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          setFence({
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
        // ignore (offline / no permission / backend down)
      }
    };
    loadPolicy();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canFaceEnroll = Array.isArray(user?.permissions)
    ? user.permissions.includes('face:enroll')
    : false;

  const groups = useMemo(
    () => [
      {
        key: 'g1',
        title: 'វេនទី១',
        items: [
          {
            key: 'in1',
            label: 'ស្កេនចូលទី១',
            mode: 'checkIn',
            slot: '1',
            icon: LogIn,
            iconClass: 'bg-emerald-600 text-white',
          },
          {
            key: 'out1',
            label: 'ស្កេនចេញទី១',
            mode: 'checkOut',
            slot: '1',
            icon: LogOut,
            iconClass: 'bg-orange-500 text-white',
          },
        ],
      },
      {
        key: 'g2',
        title: 'វេនទី២',
        items: [
          {
            key: 'in2',
            label: 'ស្កេនចូលទី២',
            mode: 'checkIn',
            slot: '2',
            icon: LogIn,
            iconClass: 'bg-emerald-600 text-white',
          },
          {
            key: 'out2',
            label: 'ស្កេនចេញទី២',
            mode: 'checkOut',
            slot: '2',
            icon: LogOut,
            iconClass: 'bg-orange-500 text-white',
          },
        ],
      },
    ],
    [],
  );

  const goScan = (mode, slot) => {
    const check = checkGeoFence(geo, fence);
    if (!check.allowed) {
      if (check.reason === 'not_configured') {
        setShowFence(true);
        alert('សូមកំណត់ទីតាំងកណ្ដាល (Center) និងចំងាយ (Radius) ជាមុនសិន');
        return;
      }
      if (check.reason === 'no_location') {
        alert('សូមបើក Location (GPS) ហើយ Allow permission');
        return;
      }
      if (check.reason === 'accuracy_too_low') {
        alert('GPS មិនសូវច្បាស់ (Accuracy ខ្ពស់ពេក)។ សូមទៅកន្លែងបើកចំហ ឬចុច “ទាញទីតាំងឡើងវិញ”');
        return;
      }
      alert('មិនអនុញ្ញាតស្កេន: នៅក្រៅចំងាយទីតាំងដែលបានកំណត់');
      return;
    }
    navigate(
      `/mobileApp/scan?mode=${encodeURIComponent(mode)}&slot=${encodeURIComponent(slot)}`,
    );
  };

  const fenceCheck = useMemo(() => checkGeoFence(geo, fence), [geo, fence]);

  return (
    <div className="bg-slate-100" style={{ minHeight: '100dvh' }}>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-3 py-3">
          <button
            type="button"
            onClick={() => navigate('/mobileApp')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 active:scale-[0.99]"
            aria-label="ត្រឡប់"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <img
              src={hospitalLogo}
              alt="Hospital"
              className="h-9 w-9 rounded-xl bg-white object-contain ring-1 ring-slate-200"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                ទិន្នន័យវត្តមាន
              </div>
              <div className="truncate text-xs text-slate-500">
                ជ្រើសរើសប្រភេទស្កេន
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[520px] px-3 pb-6 pt-4">
    <section className="mb-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-700">ទីតាំងស្កេន (Geo-fence)</div>
          <div className="mt-0.5 text-[11px] text-slate-600">
            {geoMsg
              ? geoMsg
              : geo
                ? `GPS ✅ (${geo.lat?.toFixed?.(6)}, ${geo.lng?.toFixed?.(6)}${geo.accuracy ? ` ±${Math.round(geo.accuracy)}m` : ''})`
                : 'មិនទាន់មានទីតាំង'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshGeo()}
            className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700"
          >
            ទាញទីតាំងឡើងវិញ
          </button>
          <button
            type="button"
            onClick={() => setShowFence((v) => !v)}
            className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white"
          >
            {fenceSource === 'server' ? 'មើល' : 'កំណត់'}
          </button>
        </div>
      </div>

      <div className="mt-2 text-[11px] font-semibold">
        {!fence?.enabled ? (
          <span className="text-slate-600">បិទ Geo-fence (អាចស្កេនគ្រប់ទីកន្លែង)</span>
        ) : fenceCheck.allowed ? (
          <span className="text-emerald-700">អនុញ្ញាត ✅ (នៅក្នុងចំងាយ)</span>
        ) : (
          <span className="text-rose-700">មិនអនុញ្ញាត ❌ (ក្រៅចំងាយ/មិនទាន់កំណត់)</span>
        )}
        {fence?.enabled && typeof fenceCheck?.distanceM === 'number' ? (
          <span className="text-slate-600"> — ចម្ងាយ {Math.round(fenceCheck.distanceM)}m / {Math.round(fenceCheck.radiusM || 0)}m</span>
        ) : null}
      </div>

      {showFence ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {fenceSource === 'server' ? (
            <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-800">
              កំណត់ដោយ Admin ({policyInfo?.policy?.name || 'policy'}) — មិនអាចកែពីទូរស័ព្ទបានទេ
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={!!fence.enabled}
                onChange={(e) => {
                  const next = { ...fence, enabled: e.target.checked };
                  setFence(next);
                  if (fenceSource !== 'server') writeGeoFence(next);
                }}
                disabled={fenceSource === 'server'}
              />
              បើក Geo-fence
            </label>
            <button
              type="button"
              onClick={() => {
                if (!geo?.ok) {
                  alert('សូមទាញទីតាំងជាមុនសិន');
                  return;
                }
                const next = { ...fence, centerLat: geo.lat, centerLng: geo.lng };
                setFence(next);
                if (fenceSource !== 'server') writeGeoFence(next);
              }}
              className="rounded-xl bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200"
              disabled={fenceSource === 'server'}
            >
              យកទីតាំងបច្ចុប្បន្នជា Center
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-600">Center Latitude</div>
              <input
                value={fence.centerLat ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  const next = { ...fence, centerLat: Number.isFinite(v) ? v : null };
                  setFence(next);
                  if (fenceSource !== 'server') writeGeoFence(next);
                }}
                placeholder="11.55..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                disabled={fenceSource === 'server'}
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-600">Center Longitude</div>
              <input
                value={fence.centerLng ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value);
                  const next = { ...fence, centerLng: Number.isFinite(v) ? v : null };
                  setFence(next);
                  if (fenceSource !== 'server') writeGeoFence(next);
                }}
                placeholder="104.90..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                disabled={fenceSource === 'server'}
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-600">ចំងាយអនុញ្ញាត (Radius meters)</div>
              <input
                type="number"
                value={fence.radiusM ?? 200}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = { ...fence, radiusM: Number.isFinite(v) ? v : 200 };
                  setFence(next);
                  if (fenceSource !== 'server') writeGeoFence(next);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                disabled={fenceSource === 'server'}
              />
              <div className="mt-1 text-[11px] text-slate-500">ឧ: 50m, 100m, 200m</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-600">Accuracy អតិបរមា (meters)</div>
              <input
                type="number"
                value={fence.maxAccuracyM ?? 250}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = { ...fence, maxAccuracyM: Number.isFinite(v) ? v : 250 };
                  setFence(next);
                  if (fenceSource !== 'server') writeGeoFence(next);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                disabled={fenceSource === 'server'}
              />
              <div className="mt-1 text-[11px] text-slate-500">បើ Accuracy {'>'} តម្លៃនេះ នឹងមិនអនុញ្ញាត</div>
            </div>
          </div>
        </div>
      ) : null}
    </section>

        <section className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70">
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="px-3 pb-2 pt-1 text-xs font-semibold text-slate-600">
                  {g.title}
                </div>
                <div className="space-y-2">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => goScan(it.mode, it.slot)}
                        disabled={fence?.enabled && !fenceCheck.allowed}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:bg-slate-50 active:scale-[0.995]"
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-xl ${it.iconClass}`}
                        >
                          <Icon size={22} />
                        </span>
                        <span className="flex-1 text-[16px] font-medium text-slate-900">
                          {it.label}
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <ChevronRight size={20} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {canFaceEnroll ? (
          <section className="mt-4 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/70">
            <button
              type="button"
              onClick={() => navigate('/mobileApp/face-enroll')}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:bg-slate-50 active:scale-[0.995]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-white">
                <UserPlus size={22} />
              </span>
              <span className="flex-1 text-[16px] font-medium text-slate-900">ចុះឈ្មោះមុខ (Enroll)</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <ChevronRight size={20} />
              </span>
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
