import express from 'express';
import Mission from '../models/Mission.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// GET /api/missions - list missions
router.get('/', authRequired, async (req, res, next) => {
  try {
    const perms = req.auth?.permissions || [];
    let missions;
    if (perms.includes('view:fileTransfers') || perms.includes('view:documents')) {
      missions = await Mission.find().sort({ createdAt: -1 });
    } else {
      missions = await Mission.find({ createdBy: req.auth.user._id }).sort({ createdAt: -1 });
    }
    res.json(missions);
  } catch (err) { next(err); }
});

// GET /api/missions/:id
router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const m = await Mission.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Mission not found' });
    const perms = req.auth?.permissions || [];
    if (perms.includes('view:fileTransfers') || String(m.createdBy) === String(req.auth.user._id)) return res.json(m);
    return res.status(403).json({ message: 'Forbidden' });
  } catch (err) { next(err); }
});

// POST /api/missions
router.post('/', authRequired, async (req, res, next) => {
  try {
    const payload = req.body || {};
    const m = new Mission({
      reference: payload.reference,
      assignTo: payload.assignTo,
      participants: payload.participants,
      date: payload.date ? new Date(payload.date) : (payload.letterDate ? new Date(payload.letterDate) : undefined),
      location: payload.location,
      letterNo: payload.letterNo,
      letterDate: payload.letterDate ? new Date(payload.letterDate) : undefined,
      participationDate: payload.participationDate ? new Date(payload.participationDate) : undefined,
      participationLocation: payload.participationLocation || undefined,
      sourceDoc: payload.sourceDoc,
      referenceDoc: payload.referenceDoc,
      content: payload.content || payload.participants || '',
      others: payload.others,
      stage: payload.stage || 'S1',
      telegram: payload.telegram || '',
      statusKey: payload.statusKey || 'pending',
      statusText: payload.statusText || 'រង់ចាំ',
      sourceRecordId: payload.sourceRecordId || null,
      createdFrom: payload.createdFrom || 'missions',
      createdBy: req.auth.user._id
    });
    await m.save();
    res.status(201).json(m);
  } catch (err) { next(err); }
});

// PUT /api/missions/:id
router.put('/:id', authRequired, async (req, res, next) => {
  try {
    const m = await Mission.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Mission not found' });
    const perms = req.auth?.permissions || [];
    const isAdmin = perms.includes('edit:documents') || perms.includes('edit:fileTransfers');
    const isOwner = m.createdBy && String(m.createdBy) === String(req.auth.user._id);
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' });
    // Apply provided fields, parsing dates when present
    const body = req.body || {};
    Object.assign(m, body);
    if (body.date) m.date = body.date ? new Date(body.date) : m.date;
    if (body.letterDate) m.letterDate = body.letterDate ? new Date(body.letterDate) : m.letterDate;
    if (body.participationDate) m.participationDate = body.participationDate ? new Date(body.participationDate) : m.participationDate;
    if (body.participationLocation) m.participationLocation = body.participationLocation;
    await m.save();
    res.json(m);
  } catch (err) { next(err); }
});

// DELETE /api/missions/:id
router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const m = await Mission.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Mission not found' });
    const perms = req.auth?.permissions || [];
    const isAdmin = perms.includes('edit:documents') || perms.includes('edit:fileTransfers');
    const isOwner = m.createdBy && String(m.createdBy) === String(req.auth.user._id);
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' });
    await m.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
