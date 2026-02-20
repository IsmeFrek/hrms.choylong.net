import express from 'express';
import FaceProfile from '../models/FaceProfile.js';
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js';

const router = express.Router();

// Security model:
// - All endpoints require authenticated users (JWT)
// - Enroll/Delete require explicit permissions
// - Match requires face:match OR view:attendance (so normal staff can use it if they already can view attendance)

const toStaffId = (v) => String(v || '').trim();

const isValidDescriptor = (arr) => {
  if (!Array.isArray(arr)) return false;
  if (arr.length !== 128) return false;
  for (const n of arr) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return false;
  }
  return true;
};

const euclidean = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

// GET /api/face/status
router.get('/status', authRequired, requireAnyPermission(['face:match','face:enroll','face:delete','view:attendance']), async (req, res, next) => {
  try {
    const count = await FaceProfile.countDocuments();
    res.json({
      ok: true,
      auth: true,
      count,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/face/enroll
// body: { staffId, fullName?, descriptor: number[128], consent: true, consentText?, replace?: boolean }
router.post('/enroll', authRequired, requirePermission('face:enroll'), async (req, res, next) => {
  try {
    const { staffId: staffIdRaw, fullName, descriptor, consent, consentText, replace } = req.body || {};
    const staffId = toStaffId(staffIdRaw);
    if (!staffId) return res.status(400).json({ message: 'staffId required' });
    if (!consent) return res.status(400).json({ message: 'consent required' });
    if (!isValidDescriptor(descriptor)) return res.status(400).json({ message: 'invalid descriptor (expected 128 floats)' });

    const update = {
      $set: {
        staffId,
        fullName: String(fullName || '').trim(),
        updatedAt: new Date(),
        'consent.given': true,
        'consent.at': new Date(),
        'consent.version': 1,
        'consent.text': String(consentText || '').slice(0, 2000),
      },
    };

    if (replace) {
      update.$set.descriptors = [{ vector: descriptor, createdAt: new Date() }];
    } else {
      update.$push = { descriptors: { vector: descriptor, createdAt: new Date() } };
    }

    const doc = await FaceProfile.findOneAndUpdate(
      { staffId },
      update,
      { upsert: true, new: true }
    ).lean();

    res.json({
      ok: true,
      staffId: doc.staffId,
      fullName: doc.fullName,
      descriptorsCount: Array.isArray(doc.descriptors) ? doc.descriptors.length : 0,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/face/match
// body: { descriptor: number[128], threshold?: number }
router.post('/match', authRequired, requireAnyPermission(['face:match','view:attendance']), async (req, res, next) => {
  try {
    const { descriptor, threshold } = req.body || {};
    if (!isValidDescriptor(descriptor)) return res.status(400).json({ message: 'invalid descriptor (expected 128 floats)' });

    const thr = (typeof threshold === 'number' && Number.isFinite(threshold)) ? threshold : 0.52;

    const profiles = await FaceProfile.find({ 'consent.given': true }, { staffId: 1, fullName: 1, descriptors: 1 }).lean();

    let best = null;
    for (const p of profiles) {
      const descs = Array.isArray(p.descriptors) ? p.descriptors : [];
      for (const d of descs) {
        if (!d || !Array.isArray(d.vector) || d.vector.length !== 128) continue;
        const dist = euclidean(descriptor, d.vector);
        if (!best || dist < best.distance) {
          best = { staffId: p.staffId, fullName: p.fullName || '', distance: dist };
        }
      }
    }

    if (!best) return res.json({ ok: true, matched: false, message: 'no profiles enrolled' });

    const matched = best.distance <= thr;
    res.json({ ok: true, matched, threshold: thr, ...best });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/face/staff/:staffId  (privacy delete)
router.delete('/staff/:staffId', authRequired, requirePermission('face:delete'), async (req, res, next) => {
  try {
    const staffId = toStaffId(req.params.staffId);
    if (!staffId) return res.status(400).json({ message: 'invalid staffId' });
    const r = await FaceProfile.deleteOne({ staffId });
    res.json({ ok: true, deleted: r.deletedCount || 0 });
  } catch (e) {
    next(e);
  }
});

export default router;
