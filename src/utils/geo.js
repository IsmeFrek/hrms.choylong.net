const CACHE_KEY = 'geo:last_v1';
const FENCE_KEY = 'geo:fence_v1';
const MY_POLICY_CACHE_KEY = 'geo:policy_my_v1';

function readMyPolicyCache() {
  try {
    const raw = sessionStorage.getItem(MY_POLICY_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.at !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function writeMyPolicyCache(payload) {
  try {
    sessionStorage.setItem(MY_POLICY_CACHE_KEY, JSON.stringify({ at: Date.now(), payload }));
  } catch {
    // ignore
  }
}

export async function fetchMyGeoFencePolicy({ token, maxAgeMs = 5 * 60 * 1000, force = false } = {}) {
  if (!token) return null;

  const cached = readMyPolicyCache();
  if (!force && cached && (Date.now() - cached.at) <= maxAgeMs) {
    return cached.payload || null;
  }

  const r = await fetch('/api/geo-fence/my', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET /api/geo-fence/my -> ${r.status}`);
  const data = await r.json().catch(() => null);
  writeMyPolicyCache(data);
  return data;
}

export function readCachedGeo() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    if (typeof data.at !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function cacheGeo(data) {
  try {
    if (!data || typeof data !== 'object') return;
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
    if (typeof data.at !== 'number') return;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function isGeoSupported() {
  try {
    return !!navigator.geolocation;
  } catch {
    return false;
  }
}

export function isGeoSecureContext() {
  try {
    return window.isSecureContext !== false;
  } catch {
    return true;
  }
}

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lng2 - lng1);
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function readGeoFence() {
  try {
    const raw = localStorage.getItem(FENCE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      enabled: !!data.enabled,
      centerLat: typeof data.centerLat === 'number' ? data.centerLat : null,
      centerLng: typeof data.centerLng === 'number' ? data.centerLng : null,
      radiusM: Number.isFinite(data.radiusM) ? Number(data.radiusM) : 200,
      maxAccuracyM: Number.isFinite(data.maxAccuracyM) ? Number(data.maxAccuracyM) : 250,
    };
  } catch {
    return null;
  }
}

export function writeGeoFence(next) {
  try {
    const data = {
      enabled: !!next?.enabled,
      centerLat: typeof next?.centerLat === 'number' ? next.centerLat : null,
      centerLng: typeof next?.centerLng === 'number' ? next.centerLng : null,
      radiusM: Number.isFinite(next?.radiusM) ? Number(next.radiusM) : 200,
      maxAccuracyM: Number.isFinite(next?.maxAccuracyM) ? Number(next.maxAccuracyM) : 250,
    };
    localStorage.setItem(FENCE_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

export function getDefaultGeoFence() {
  return { enabled: true, centerLat: null, centerLng: null, radiusM: 200, maxAccuracyM: 250 };
}

export function checkGeoFence(currentGeo, fence) {
  const f = fence || readGeoFence() || getDefaultGeoFence();
  if (!f?.enabled) return { allowed: true, reason: 'disabled', fence: f };

  if (typeof f.centerLat !== 'number' || typeof f.centerLng !== 'number') {
    return { allowed: false, reason: 'not_configured', fence: f };
  }

  const lat = currentGeo?.lat;
  const lng = currentGeo?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { allowed: false, reason: 'no_location', fence: f };
  }

  const acc = currentGeo?.accuracy;
  if (Number.isFinite(f.maxAccuracyM) && Number.isFinite(acc) && acc > f.maxAccuracyM) {
    return {
      allowed: false,
      reason: 'accuracy_too_low',
      accuracy: acc,
      maxAccuracyM: f.maxAccuracyM,
      fence: f,
    };
  }

  const d = distanceMeters(lat, lng, f.centerLat, f.centerLng);
  const radiusM = Number.isFinite(f.radiusM) ? f.radiusM : 200;
  return {
    allowed: d <= radiusM,
    reason: d <= radiusM ? 'inside' : 'outside',
    distanceM: d,
    radiusM,
    fence: f,
  };
}

export async function getCurrentGeo(options = {}) {
  const enableHighAccuracy = options.enableHighAccuracy !== false;
  const timeout = Number.isFinite(options.timeout) ? options.timeout : 8000;
  const maximumAge = Number.isFinite(options.maximumAge) ? options.maximumAge : 20000;

  if (!isGeoSupported()) {
    return { ok: false, status: 'unsupported', message: 'Browser មិនគាំទ្រ Location (GPS)' };
  }
  if (!isGeoSecureContext()) {
    return { ok: false, status: 'blocked', message: 'Location ត្រូវការ HTTPS (secure)' };
  }

  return await new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = pos?.coords || {};
          const out = {
            ok: true,
            status: 'ok',
            lat: Number(c.latitude),
            lng: Number(c.longitude),
            accuracy: Number.isFinite(c.accuracy) ? Number(c.accuracy) : null,
            altitude: Number.isFinite(c.altitude) ? Number(c.altitude) : null,
            heading: Number.isFinite(c.heading) ? Number(c.heading) : null,
            speed: Number.isFinite(c.speed) ? Number(c.speed) : null,
            at: Date.now(),
          };
          if (!Number.isFinite(out.lat) || !Number.isFinite(out.lng)) {
            resolve({ ok: false, status: 'error', message: 'មិនអាចទាញ Latitude/Longitude បាន' });
            return;
          }
          cacheGeo(out);
          resolve(out);
        },
        (err) => {
          const code = err?.code;
          if (code === 1) {
            resolve({ ok: false, status: 'denied', message: 'សូម Allow Location Permission' });
          } else if (code === 2) {
            resolve({ ok: false, status: 'unavailable', message: 'មិនអាចរកទីតាំងបាន (GPS/Network)' });
          } else if (code === 3) {
            resolve({ ok: false, status: 'timeout', message: 'ទាញទីតាំងមិនទាន់ទេ (Timeout)' });
          } else {
            resolve({ ok: false, status: 'error', message: err?.message || 'ទាញទីតាំងមិនបាន' });
          }
        },
        { enableHighAccuracy, timeout, maximumAge },
      );
    } catch {
      resolve({ ok: false, status: 'error', message: 'ទាញទីតាំងមិនបាន' });
    }
  });
}
