import { Router } from 'express';
import Role from '../models/Role.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { PERMISSIONS } from '../permissions.js';

const router = Router();

// List roles
router.get('/', authRequired, async (_req, res) => {
  const roles = await Role.find().sort({ name: 1 });
  res.json(roles.map(r => ({ id: r._id.toString(), name: r.name, permissions: r.permissions || [] })));
});

// NEW: list all available permissions for UI
router.get('/permissions', authRequired, (_req, res) => {
  res.json(PERMISSIONS);
});

// Create role
router.post('/', authRequired, requireRole('Admin'), async (req, res) => {
  const { name, permissions = [] } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const exists = await Role.findOne({ name });
  if (exists) return res.status(409).json({ message: 'Role already exists' });
  const safePerms = (permissions || []).filter(p => PERMISSIONS.includes(p));
  const role = await Role.create({ name, permissions: safePerms });
  res.status(201).json({ id: role._id.toString(), name: role.name, permissions: role.permissions || [] });
});

// Update role (name and/or permissions)
router.put('/:id', authRequired, requireRole('Admin'), async (req, res) => {
  const { id } = req.params;
  const { name, permissions } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = name;
  if (Array.isArray(permissions)) update.permissions = permissions.filter(p => PERMISSIONS.includes(p));
  const role = await Role.findByIdAndUpdate(id, update, { new: true });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  res.json({ id: role._id.toString(), name: role.name, permissions: role.permissions || [] });
});

// Delete role
router.delete('/:id', authRequired, requireRole('Admin'), async (req, res) => {
  const { id } = req.params;
  const role = await Role.findById(id);
  if (!role) return res.status(404).json({ message: 'Role not found' });
  await role.deleteOne();
  res.status(204).end();
});

export default router;

