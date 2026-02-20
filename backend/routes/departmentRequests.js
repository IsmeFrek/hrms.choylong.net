import express from 'express';
import DepartmentRequest from '../models/DepartmentRequest.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();
router.use(authRequired);

// List my drafts (or all if admin)
router.get('/', requirePermission('view:documents'), async (req, res) => {
  const userId = req.auth?.user?._id;
  const isAdmin = (req.auth?.user?.roles || []).some(r => (r?.name || r) === 'Admin');
  const query = isAdmin ? {} : { createdBy: userId };
  const list = await DepartmentRequest.find(query).sort({ createdAt: -1 });
  res.json(list);
});

// Create
router.post('/', requirePermission('edit:documents'), async (req, res) => {
  const userId = req.auth?.user?._id;
  const body = req.body || {};
  const doc = await DepartmentRequest.create({ ...body, createdBy: userId });
  res.status(201).json(doc);
});

// Update
router.put('/:id', requirePermission('edit:documents'), async (req, res) => {
  const userId = req.auth?.user?._id;
  const isAdmin = (req.auth?.user?.roles || []).some(r => (r?.name || r) === 'Admin');
  const doc = await DepartmentRequest.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  if (!isAdmin && String(doc.createdBy) !== String(userId)) return res.status(403).json({ message: 'Forbidden' });
  Object.assign(doc, req.body || {});
  await doc.save();
  res.json(doc);
});

// Delete
router.delete('/:id', requirePermission('edit:documents'), async (req, res) => {
  const userId = req.auth?.user?._id;
  const isAdmin = (req.auth?.user?.roles || []).some(r => (r?.name || r) === 'Admin');
  const doc = await DepartmentRequest.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  if (!isAdmin && String(doc.createdBy) !== String(userId)) return res.status(403).json({ message: 'Forbidden' });
  await doc.deleteOne();
  res.json({ ok: true });
});

export default router;
