import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { authRequired, requireRole, requirePermission, requireAnyPermission, toUserDTO } from '../middleware/auth.js';

const router = Router();

// list users with optional search
router.get('/', authRequired, requireAnyPermission(['send:feedback','send:telegram', 'view:users', 'manage:users']), async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const users = await User.find().populate('roles');
  const filtered = users.filter((u) => {
    if (!q) return true;
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.roles || []).some((r) => (r.name || '').toLowerCase().includes(q))
    );
  });
  res.json(filtered.map(toUserDTO));
});

// Public: list admin users (minimal fields) for dropdown fallback
router.get('/admins', authRequired, async (req, res) => {
  try {
    // find Admin role
    const adminRole = await Role.findOne({ name: 'Admin' });
    if (!adminRole) return res.json([]);
    // find active users with Admin role
    const admins = await User.find({ roles: adminRole._id, active: true }).select('fullName email');
    const out = admins.map(a => ({ id: a._id, fullName: a.fullName, email: a.email }));
    return res.json(out);
  } catch (e) {
    console.error('Failed to fetch admin users', e);
    return res.status(500).json({ message: 'Failed to fetch admin users' });
  }
});

// create user
router.post('/', authRequired, requireRole('Admin'), async (req, res) => {
  try {
    const { fullName, email, phone, password, roleIds = [], active = true, department, telegramId } = req.body || {};
    if (!fullName || !( (email && String(email).trim()) || (phone && String(phone).trim()) ) || !password) {
      return res.status(400).json({ message: 'Full name, (email or phone) and password are required' });
    }

    let normEmail = null;
    if (email) {
      normEmail = String(email).trim().toLowerCase();
      const exists = await User.findOne({ emailCanonical: normEmail });
      if (exists) return res.status(409).json({ message: 'Email already exists' });
    }

    // Resolve roles by ObjectId or by name (if UI accidentally sends names)
    const ids = roleIds.filter((id) => mongoose.isValidObjectId(id));
    const names = roleIds.filter((id) => !mongoose.isValidObjectId(id));
    const roles = await Role.find({
      $or: [
        ...(ids.length ? [{ _id: { $in: ids } }] : []),
        ...(names.length ? [{ name: { $in: names } }] : []),
      ],
    });

    const user = new User({
      fullName,
      email: normEmail,
      phone: phone ? String(phone).trim() : undefined,
      telegramId: telegramId ? String(telegramId).trim() : undefined,
      active: !!active,
      department: department ? String(department).trim() : undefined,
      roles: roles.map((r) => r._id),
    });
    await user.setPassword(password);
    await user.save();
    await user.populate('roles');

    return res.status(201).json(toUserDTO(user));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('Create user failed:', err);
    return res.status(500).json({ message: 'Failed to create user' });
  }
});

// Grant a permission to a user by their fullName (admin only)
// POST /api/users/grant-by-name { fullName, permission }
router.post('/grant-by-name', authRequired, requireRole('Admin'), async (req, res) => {
  try {
    const { fullName, permission } = req.body || {};
    if (!fullName || !permission) return res.status(400).json({ message: 'fullName and permission required' });
    const user = await User.findOne({ fullName });
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Find or create a role named after the permission owner (personal role)
    let role = await Role.findOne({ name: `personal:${user._id.toString()}` });
    if (!role) {
      role = await Role.create({ name: `personal:${user._id.toString()}`, permissions: [permission] });
    } else if (!role.permissions.includes(permission)) {
      role.permissions.push(permission);
      await role.save();
    }
    // ensure user has that role
    if (!user.roles.map(r => r.toString()).includes(role._id.toString())) {
      user.roles = user.roles.concat([role._id]);
      await user.save();
    }
    await user.populate('roles');
    return res.json({ ok: true, user: {
      id: user._id,
      fullName: user.fullName,
      permissions: Array.from(new Set((user.roles || []).flatMap(r => r.permissions || [])))
    }});
  } catch (e) {
    console.error('grant-by-name failed', e);
    return res.status(500).json({ message: 'Failed' });
  }
});

// update user
router.put('/:id', authRequired, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
  const { fullName, email, phone, password, roleIds, active, department, telegramId } = req.body || {};
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (fullName !== undefined) user.fullName = fullName;

    if (email !== undefined) {
      const normEmail = String(email).trim().toLowerCase();
      const conflict = await User.findOne({ emailCanonical: normEmail, _id: { $ne: id } });
      if (conflict) return res.status(409).json({ message: 'Email already exists' });
      user.email = normEmail; // will also set emailCanonical via pre('validate')
    }

    if (phone !== undefined) {
      user.phone = phone ? String(phone).trim() : undefined;
    }

    if (telegramId !== undefined) {
      user.telegramId = telegramId ? String(telegramId).trim() : undefined;
    }

    if (typeof active === 'boolean') user.active = active;

    if (department !== undefined) {
      user.department = department ? String(department).trim() : undefined;
    }

    if (Array.isArray(roleIds)) {
      const ids = roleIds.filter((v) => mongoose.isValidObjectId(v));
      const names = roleIds.filter((v) => !mongoose.isValidObjectId(v));
      const roles = await Role.find({
        $or: [
          ...(ids.length ? [{ _id: { $in: ids } }] : []),
          ...(names.length ? [{ name: { $in: names } }] : []),
        ],
      });
      user.roles = roles.map((r) => r._id);
    }

    if (password) await user.setPassword(password);

    await user.save();
    await user.populate('roles');

    return res.json(toUserDTO(user));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('Update user failed:', err);
    return res.status(500).json({ message: 'Failed to update user' });
  }
});

// delete user
router.delete('/:id', authRequired, requireRole('Admin'), async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await user.deleteOne();
  res.status(204).end();
});

// Get current user's profile
router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('roles');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(toUserDTO(user));
  } catch (err) {
    console.error('Get profile failed:', err);
    return res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Update current user's profile (limited fields)
router.put('/me', authRequired, async (req, res) => {
  try {
    const { fullName, email, phone, telegramChatId, telegramChatId2 } = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Allow updating basic info
    if (fullName !== undefined) user.fullName = fullName;
    
    if (email !== undefined && email.trim()) {
      const normEmail = String(email).trim().toLowerCase();
      const conflict = await User.findOne({ 
        emailCanonical: normEmail, 
        _id: { $ne: req.user.id } 
      });
      if (conflict) return res.status(409).json({ message: 'Email already exists' });
      user.email = normEmail;
    }

    if (phone !== undefined) {
      user.phone = phone ? String(phone).trim() : undefined;
    }

    // Allow updating Telegram Chat IDs
    if (telegramChatId !== undefined) {
      user.telegramChatId = telegramChatId ? String(telegramChatId).trim() : undefined;
    }

    if (telegramChatId2 !== undefined) {
      user.telegramChatId2 = telegramChatId2 ? String(telegramChatId2).trim() : undefined;
    }

    await user.save();
    await user.populate('roles');

    return res.json(toUserDTO(user));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    console.error('Update profile failed:', err);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
});

export default router;

// Lightweight search for assignment (for approvers)
// GET /api/users/search?q=... -> [{ _id, fullName, email }]
router.get('/search', authRequired, requirePermission('approve:hr'), async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const users = await User.find({ active: true }).limit(100);
  const filtered = users.filter(u =>
    (u.fullName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
  );
  res.json(filtered.map(u => ({ _id: u._id, fullName: u.fullName, email: u.email })));
});
