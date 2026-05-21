import express from 'express';
import GeoFencePolicy from '../models/GeoFencePolicy.js';
import HR from '../models/HR.js';
import { authRequired, requireAnyPermission, requirePermission } from '../middleware/auth.js';

import axios from 'axios';

const router = express.Router();

// Resolve Google Maps short link to coordinates
router.get('/resolve-link', authRequired, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    console.log('Resolving Map Link:', url);
    
    // Follow redirects to get the long URL
    const response = await axios.get(url, {
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const finalUrl = response.request.res.responseUrl || response.config.url;
    console.log('Final URL:', finalUrl);

    // Regular expression to find coordinates in Google Maps URL
    // Format: ...@11.5369,104.9126,17z... or ...q=11.5369,104.9126...
    const coordsMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || 
                       finalUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);

    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      return res.json({ lat, lng });
    }

    res.status(404).json({ error: 'Could not find coordinates in this link' });
  } catch (err) {
    console.error('Map Resolve Error:', err.message);
    res.status(500).json({ error: 'Failed to resolve map link' });
  }
});

function toRad(v) {
  return (v * Math.PI) / 180;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
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

function normalizeMatchStr(v) {
  return String(v || '').trim();
}

async function findHrForAuthUser(user) {
  // Mirrors backend/routes/selfservice.js logic.
  let staffId = user?.username ? String(user.username).trim().toLowerCase() : '';
  if (!staffId && user?.phone) staffId = String(user.phone).trim().replace(/\s|-/g, '').toLowerCase();
  const email = user?.email ? String(user.email).trim().toLowerCase() : '';

  const candidates = new Set();
  const add = (v) => {
    if (!v) return;
    const s = String(v).trim();
    if (!s) return;
    candidates.add(s);
    candidates.add(s.toLowerCase());
    candidates.add(s.replace(/\s|-/g, ''));
    candidates.add(s.replace(/\s|-/g, '').toLowerCase());
    if (s.startsWith('+')) candidates.add(s.slice(1));
    if (s.startsWith('+')) candidates.add(s.slice(1).toLowerCase());
  };

  add(staffId);
  add(user?.phone);

  const digits = String(user?.phone || staffId || '').replace(/\D/g, '');
  if (digits && digits.length === 8) add('0' + digits);
  if (digits && digits.startsWith('855') && digits.length >= 10) add('0' + digits.slice(3));

  const list = Array.from(candidates);
  const or = [
    { staffId: { $in: list } },
    { phone: { $in: list } },
  ];

  if (email) {
    const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    or.push({ email: new RegExp(`^${escRe(email)}$`, 'i') });
  }

  if (digits && digits.length >= 6) {
    const tolerant = digits.split('').join('[\\s-]*');
    const re = new RegExp(tolerant);
    or.push({ phone: re });
    or.push({ staffId: re });
  }

  return await HR.findOne({ $or: or }).lean();
}

function policySpecificity(p) {
  const m = p?.match || {};
  const fields = ['staffId', 'department', 'skill', 'position', 'officerType', 'role'];
  return fields.reduce((acc, k) => (normalizeMatchStr(m[k]) ? acc + 1 : acc), 0);
}

function matchesPolicy({ policy, hr, userRoleNames }) {
  const m = policy?.match || {};
  const wantStaffId = normalizeMatchStr(m.staffId);
  const wantDept = normalizeMatchStr(m.department);
  const wantSkill = normalizeMatchStr(m.skill);
  const wantPos = normalizeMatchStr(m.position);
  const wantOfficerType = normalizeMatchStr(m.officerType);
  const wantRole = normalizeMatchStr(m.role);

  if (wantStaffId && String(hr?.staffId || '').trim() !== wantStaffId) return false;
  if (wantDept && String(hr?.Department_Kh || '').trim() !== wantDept) return false;
  if (wantSkill && String(hr?.skill || '').trim() !== wantSkill) return false;
  if (wantPos && String(hr?.position || '').trim() !== wantPos) return false;
  if (wantOfficerType && String(hr?.officerType || '').trim() !== wantOfficerType) return false;
  if (wantRole && !userRoleNames.includes(wantRole)) return false;

  return true;
}

async function resolvePolicyFor({ hr, userRoleNames }) {
  const all = await GeoFencePolicy.find({ enabled: true }).sort({ priority: -1, updatedAt: -1 }).lean();
  const matched = all.filter((p) => matchesPolicy({ policy: p, hr, userRoleNames }));
  if (matched.length === 0) return null;

  matched.sort((a, b) => {
    const pa = Number(a?.priority || 0);
    const pb = Number(b?.priority || 0);
    if (pb !== pa) return pb - pa;
    const sa = policySpecificity(a);
    const sb = policySpecificity(b);
    if (sb !== sa) return sb - sa;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  return matched[0];
}

// GET /api/geo-fence/my -> returns the policy/fence for current user
router.get('/my', authRequired, async (req, res) => {
  try {
    const user = req.auth?.user;
    const hr = await findHrForAuthUser(user);
    if (!hr) {
      return res.json({ ok: true, policy: null, fence: null, reason: 'hr_not_found' });
    }

    const userRoleNames = (user?.roles || []).map((r) => r?.name || r).filter(Boolean);
    const policy = await resolvePolicyFor({ hr, userRoleNames });

    return res.json({
      ok: true,
      policy: policy ? {
        id: policy._id?.toString?.() || policy._id,
        name: policy.name || '',
        enabled: !!policy.enabled,
        priority: Number(policy.priority || 0),
        match: policy.match || {},
        fence: policy.fence || null,
        note: policy.note || '',
      } : null,
      fence: policy?.fence || null,
      hr: {
        staffId: hr.staffId || '',
        department: hr.Department_Kh || '',
        skill: hr.skill || '',
        position: hr.position || '',
        officerType: hr.officerType || '',
      },
    });
  } catch (e) {
    console.error('geo-fence /my failed', e);
    return res.status(500).json({ ok: false, message: 'Failed to load geo-fence policy' });
  }
});

// Admin list
router.get('/policies', authRequired, requirePermission('view:settings'), async (req, res) => {
  const items = await GeoFencePolicy.find({}).sort({ priority: -1, updatedAt: -1 }).lean();
  res.json({ ok: true, items });
});

// Admin create
router.post('/policies', authRequired, requirePermission('manage:users'), async (req, res) => {
  const body = req.body || {};
  const doc = await GeoFencePolicy.create({
    name: String(body.name || '').trim(),
    enabled: body.enabled !== false,
    priority: Number(body.priority || 0),
    match: {
      staffId: normalizeMatchStr(body.match?.staffId),
      department: normalizeMatchStr(body.match?.department),
      skill: normalizeMatchStr(body.match?.skill),
      position: normalizeMatchStr(body.match?.position),
      officerType: normalizeMatchStr(body.match?.officerType),
      role: normalizeMatchStr(body.match?.role),
    },
    fence: {
      centerLat: typeof body.fence?.centerLat === 'number' ? body.fence.centerLat : null,
      centerLng: typeof body.fence?.centerLng === 'number' ? body.fence.centerLng : null,
      radiusM: Number.isFinite(body.fence?.radiusM) ? Number(body.fence.radiusM) : 200,
      maxAccuracyM: Number.isFinite(body.fence?.maxAccuracyM) ? Number(body.fence.maxAccuracyM) : 250,
    },
    note: String(body.note || '').trim(),
    updatedBy: req.auth?.user?._id,
  });
  res.status(201).json({ ok: true, item: doc });
});

// Admin update
router.put('/policies/:id', authRequired, requirePermission('manage:users'), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const updated = await GeoFencePolicy.findByIdAndUpdate(
    id,
    {
      $set: {
        name: String(body.name || '').trim(),
        enabled: body.enabled !== false,
        priority: Number(body.priority || 0),
        match: {
          staffId: normalizeMatchStr(body.match?.staffId),
          department: normalizeMatchStr(body.match?.department),
          skill: normalizeMatchStr(body.match?.skill),
          position: normalizeMatchStr(body.match?.position),
          officerType: normalizeMatchStr(body.match?.officerType),
          role: normalizeMatchStr(body.match?.role),
        },
        fence: {
          centerLat: typeof body.fence?.centerLat === 'number' ? body.fence.centerLat : null,
          centerLng: typeof body.fence?.centerLng === 'number' ? body.fence.centerLng : null,
          radiusM: Number.isFinite(body.fence?.radiusM) ? Number(body.fence.radiusM) : 200,
          maxAccuracyM: Number.isFinite(body.fence?.maxAccuracyM) ? Number(body.fence.maxAccuracyM) : 250,
        },
        note: String(body.note || '').trim(),
        updatedBy: req.auth?.user?._id,
      },
    },
    { new: true }
  ).lean();

  if (!updated) return res.status(404).json({ ok: false, message: 'Not found' });
  res.json({ ok: true, item: updated });
});

// Admin delete
router.delete('/policies/:id', authRequired, requirePermission('manage:users'), async (req, res) => {
  const { id } = req.params;
  const deleted = await GeoFencePolicy.findByIdAndDelete(id).lean();
  if (!deleted) return res.status(404).json({ ok: false, message: 'Not found' });
  res.json({ ok: true });
});

// Helper endpoint: validate a location against user's policy (debug)
router.post('/check', authRequired, async (req, res) => {
  try {
    const user = req.auth?.user;
    const hr = await findHrForAuthUser(user);
    if (!hr) return res.status(404).json({ ok: false, message: 'HR not found' });

    const userRoleNames = (user?.roles || []).map((r) => r?.name || r).filter(Boolean);
    const policy = await resolvePolicyFor({ hr, userRoleNames });
    if (!policy?.fence || typeof policy.fence.centerLat !== 'number' || typeof policy.fence.centerLng !== 'number') {
      return res.json({ ok: true, allowed: true, reason: 'no_policy_or_no_center', policy: policy || null });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const accuracy = Number(req.body?.accuracy);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, message: 'lat/lng required' });
    }

    const dist = distanceMeters(lat, lng, policy.fence.centerLat, policy.fence.centerLng);
    const radiusM = Number.isFinite(policy.fence.radiusM) ? Number(policy.fence.radiusM) : 200;
    const maxAccuracyM = Number.isFinite(policy.fence.maxAccuracyM) ? Number(policy.fence.maxAccuracyM) : 250;

    if (Number.isFinite(accuracy) && accuracy > maxAccuracyM) {
      return res.json({ ok: true, allowed: false, reason: 'accuracy_too_low', distanceM: dist, radiusM, accuracy, maxAccuracyM });
    }

    return res.json({ ok: true, allowed: dist <= radiusM, reason: dist <= radiusM ? 'inside' : 'outside', distanceM: dist, radiusM });
  } catch (e) {
    console.error('geo-fence /check failed', e);
    return res.status(500).json({ ok: false, message: 'Failed to check geo-fence' });
  }
});

export default router;
