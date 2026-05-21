import express from 'express';
import FaceProfile from '../models/FaceProfile.js';
import HR from '../models/HR.js';
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

// For enroll duplicate-face checks: if distance is below this, we
// consider it the same person and do not allow a different staffId
// to reuse the same face.
const ENROLL_DUPLICATE_THRESHOLD = 0.52;

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

// GET /api/face/list
// List enrolled face profiles (for admin/enroll UI)
router.get('/list', authRequired, requirePermission('face:enroll'), async (req, res, next) => {
  try {
    const docs = await FaceProfile.find({}, {
      staffId: 1,
      fullName: 1,
      descriptors: 1,
      createdAt: 1,
      updatedAt: 1,
      snapshot: 1,
    })
      .sort({ updatedAt: -1 })
      .lean();

    const items = docs.map((d) => ({
      staffId: d.staffId,
      fullName: d.fullName || '',
      descriptorsCount: Array.isArray(d.descriptors) ? d.descriptors.length : 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      snapshot: d.snapshot || '',
    }));

    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});
router.post('/enroll', authRequired, requirePermission('face:enroll'), async (req, res, next) => {
  try {
    const { staffId: staffIdRaw, fullName, descriptor, consent, consentText, replace, snapshot } = req.body || {};
    const staffId = toStaffId(staffIdRaw);
    if (!staffId) return res.status(400).json({ message: 'staffId required' });
    if (!consent) return res.status(400).json({ message: 'consent required' });
    if (!isValidDescriptor(descriptor)) return res.status(400).json({ message: 'invalid descriptor (expected 128 floats)' });

    // Prevent the same face from being enrolled for multiple staffIds.
    // We compare the incoming descriptor with all other staff profiles
    // (excluding this staffId) and reject if too close.
    const otherProfiles = await FaceProfile.find(
      { staffId: { $ne: staffId }, 'consent.given': true },
      { staffId: 1, fullName: 1, descriptors: 1 }
    ).lean();

    let best = null;
    for (const p of otherProfiles) {
      const descs = Array.isArray(p.descriptors) ? p.descriptors : [];
      for (const d of descs) {
        if (!d || !Array.isArray(d.vector) || d.vector.length !== 128) continue;
        const dist = euclidean(descriptor, d.vector);
        if (!best || dist < best.distance) {
          best = { staffId: p.staffId, fullName: p.fullName || '', distance: dist };
        }
      }
    }

    if (best && best.distance <= ENROLL_DUPLICATE_THRESHOLD) {
      return res.status(409).json({
        ok: false,
        code: 'FACE_ALREADY_ENROLLED',
        message: `មុខនេះត្រូវបានចុះឈ្មោះរួចសម្រាប់ Staff ID ${best.staffId}`,
        existingStaffId: best.staffId,
        existingFullName: best.fullName,
        distance: best.distance,
        threshold: ENROLL_DUPLICATE_THRESHOLD,
      });
    }

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

    let snapshotTrimmed = '';
    if (typeof snapshot === 'string' && snapshot.trim()) {
      // Limit stored size to avoid extremely large payloads, but keep a valid
      // data URL structure so <img src="..."> does not become an invalid URL.
      const MAX_LEN = 200000;
      const s = snapshot.trim();

      // Typical format: data:image/jpeg;base64,AAAA...
      const commaIdx = s.indexOf(',');
      if (commaIdx === -1) {
        // No comma / not a standard data URL; just hard-trim the whole string.
        snapshotTrimmed = s.slice(0, MAX_LEN);
      } else {
        const header = s.slice(0, commaIdx + 1); // keep "data:...base64," part
        let b64 = s.slice(commaIdx + 1);

        if (b64.length > MAX_LEN) {
          b64 = b64.slice(0, MAX_LEN);
        }

        // Ensure base64 length is a multiple of 4 so the decoder does not fail.
        const rem = b64.length % 4;
        if (rem) {
          b64 = b64.slice(0, b64.length - rem);
        }

        snapshotTrimmed = header + b64;
      }

      update.$set.snapshot = snapshotTrimmed;
    }

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

    // Also sync snapshot to HR image field so that enrolled face photo
    // appears in HR profile (linked by staffId).
    if (snapshotTrimmed) {
      try {
        await HR.findOneAndUpdate(
          { staffId },
          { $set: { image: snapshotTrimmed } },
          { new: false }
        ).lean();
      } catch (e) {
        // Best-effort only; do not block face enroll if HR update fails
        // eslint-disable-next-line no-console
        console.warn('Failed to sync HR image from face enroll for', staffId, e?.message || e);
      }
    }

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

    // Slightly higher threshold than enroll duplicate-check to
    // reduce false negatives when matching for attendance.
    const thr = (typeof threshold === 'number' && Number.isFinite(threshold)) ? threshold : 0.6;

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
// Allow either explicit face:delete permission OR face:enroll
// so that the same admins who enroll can also delete.
router.delete('/staff/:staffId', authRequired, requireAnyPermission(['face:delete', 'face:enroll']), async (req, res, next) => {
  try {
    const staffId = toStaffId(req.params.staffId);
    if (!staffId) return res.status(400).json({ message: 'invalid staffId' });
    const r = await FaceProfile.deleteOne({ staffId });

    // Also clear HR profile image for this staff so that the
    // HR photo disappears from Face Enroll and other HR views.
    try {
      await HR.updateMany(
        { staffId },
        { $unset: { image: '' } },
      );
    } catch (err) {
      // Best-effort only; do not fail delete if HR update fails
      // eslint-disable-next-line no-console
      console.warn('Failed to clear HR image for', staffId, err?.message || err);
    }

    res.json({ ok: true, deleted: r.deletedCount || 0 });
  } catch (e) {
    next(e);
  }
});

export default router;
