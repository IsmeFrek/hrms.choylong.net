/* eslint-env node */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { trackUser } from '../services/activeUsersTracker.js';

const JWT_SECRET = (typeof globalThis !== 'undefined' && globalThis['process'] && globalThis['process'].env && globalThis['process'].env.JWT_SECRET) || 'dev-change-this-secret';

export const authRequired = async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const queryToken = req.query.token;
    const token = h.startsWith('Bearer ') ? h.slice(7) : queryToken;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.sub).populate('roles');
    if (!user || !user.active) return res.status(401).json({ message: 'Unauthorized' });
    // aggregate permissions from roles
    const perms = new Set();
    (user.roles || []).forEach((r) => (r.permissions || []).forEach((p) => perms.add(p)));
    req.auth = { decoded, user, permissions: Array.from(perms) };
    // Track activity
    const page = req.headers['x-page-path'] || '';
    try { trackUser(user._id, user.fullName, page); } catch (e) { /* ignore */ }
    next();
  } catch (err) {
    console.error('authRequired failed', err);
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

export const requireRole = (roleName) => (req, res, next) => {
  const roles = (req.auth?.user?.roles || []).map((r) => r.name);
  const email = req.auth?.user?.email || '';
  const cleanEmail = String(email).trim().toLowerCase();
  // Accept 'Admin' or 'Administrator' or the super-admin emails
  const isAdmin = roles.includes('Admin') || roles.includes('Administrator') || cleanEmail === 'admin@hospital.com' || cleanEmail.includes('admin@hospital07.com');
  if (roleName === 'Admin' && isAdmin) return next();
  if (!roles.includes(roleName)) return res.status(403).json({ message: 'Forbidden' });
  next();
};

// NEW: guard by permission
export const requirePermission = (perm) => (req, res, next) => {
  const perms = req.auth?.permissions || [];
  const roles = (req.auth?.user?.roles || []).map((r) => r.name);
  const email = req.auth?.user?.email || '';
  const cleanEmail = String(email).trim().toLowerCase();
  const isAdmin = roles.includes('Admin') || roles.includes('Administrator') || cleanEmail === 'admin@hospital.com' || cleanEmail.includes('admin@hospital07.com');

  if (isAdmin || perms.includes(perm)) {
    return next();
  }
  try {
    console.warn('Permission denied:', { required: perm, user: email || req.auth?.user?._id, permissions: perms });
  } catch (E) { /* ignore logging errors */ }
  return res.status(403).json({ message: 'Forbidden' });
};

// require any of the provided permissions (OR semantics)
export const requireAnyPermission = (permsList = []) => (req, res, next) => {
  const perms = req.auth?.permissions || [];
  const matched = (permsList || []).some(p => perms.includes(p));
  
  if (matched) return next();

  try {
    console.warn('[AUTH] Permission denied (Any):', {
      requiredAny: permsList,
      user: req.auth?.user?.email || req.auth?.user?._id,
      userHas: perms
    });
  } catch (E) { /* ignore */ }
  
  return res.status(403).json({ message: 'Forbidden' });
};

// helper to sign token
export const signToken = (user) => {
  const perms = new Set();
  (user.roles || []).forEach((r) => (r.permissions || []).forEach((p) => perms.add(p)));
  return jwt.sign(
    { sub: user._id.toString(), roles: (user.roles || []).map((r) => r.name), perms: Array.from(perms), department: user.department || null },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// shape user to DTO
export const toUserDTO = (u) => {
  const perms = new Set();
  (u.roles || []).forEach((r) => (r.permissions || []).forEach((p) => perms.add(p)));
  return {
    id: u._id.toString(),
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    staffId: u.staffId || null,
    telegramId: u.telegramId || null,
    telegramChatId: u.telegramChatId || null,
    telegramChatId2: u.telegramChatId2 || null,
    active: u.active,
    department: u.department || null, // include department assignment
    roles: (u.roles || []).map((r) => ({ id: r._id?.toString?.() || r.id, name: r.name })),
    permissions: Array.from(perms), // new: aggregate permissions
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};
