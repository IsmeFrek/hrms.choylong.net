import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

// Use a different default port to avoid clashing with the main backend (which uses 5000)
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-this-secret';

// In-memory roles and users (seed admin)
const roles = [
  { id: 'r_admin', name: 'Admin' },
  { id: 'r_user', name: 'User' },
];
const users = [
  {
    id: 'u_admin',
    fullName: 'Administrator',
    email: 'admin@hospital.com',
    active: true,
    roles: [roles[0]],
    passwordHash: bcrypt.hashSync('admin123', 10),
  },
];

// Helpers
const safeUser = (u) => {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
};
const findRoleById = (id) => roles.find((r) => r.id === id);
const findUserById = (id) => users.find((u) => u.id === id);
const findUserByEmail = (email) =>
  users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
const nextId = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

const signToken = (user) =>
  jwt.sign(
    { sub: user.id, roles: (user.roles || []).map((r) => r.name) },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

const authMiddleware = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = findUserById(decoded.sub);
    if (!user || !user.active) return res.status(401).json({ message: 'Unauthorized' });
    req.auth = { decoded, user: safeUser(user) };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
const requireRole = (role) => (req, res, next) => {
  const r = req.auth?.decoded?.roles || [];
  if (!r.includes(role)) return res.status(403).json({ message: 'Forbidden' });
  next();
};

// Routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = findUserByEmail(email);
  if (!user || !user.active) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = signToken(user);
  res.json({ token, user: safeUser(user) });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.auth.user });
});

app.get('/api/roles', authMiddleware, (_req, res) => {
  res.json(roles);
});

app.get('/api/users', authMiddleware, requireRole('Admin'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const list = users
    .map(safeUser)
    .filter((u) => {
      if (!q) return true;
      return (
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.roles || []).some((r) => (r.name || '').toLowerCase().includes(q))
      );
    });
  res.json(list);
});

app.post('/api/users', authMiddleware, requireRole('Admin'), (req, res) => {
  const { fullName, email, password, roleIds = [], active = true } = req.body || {};
  if (!fullName || !email || !password) return res.status(400).json({ message: 'Full name, email and password are required' });
  if (findUserByEmail(email)) return res.status(409).json({ message: 'Email already exists' });
  const newUser = {
    id: nextId('u'),
    fullName,
    email,
    active: !!active,
    roles: roleIds.map(findRoleById).filter(Boolean),
    passwordHash: bcrypt.hashSync(password, 10),
  };
  users.push(newUser);
  res.status(201).json(safeUser(newUser));
});

app.put('/api/users/:id', authMiddleware, requireRole('Admin'), (req, res) => {
  const { id } = req.params;
  const u = findUserById(id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  const { fullName, email, password, roleIds, active } = req.body || {};
  if (fullName !== undefined) u.fullName = fullName;
  if (email !== undefined) u.email = email;
  if (typeof active === 'boolean') u.active = active;
  if (Array.isArray(roleIds)) u.roles = roleIds.map(findRoleById).filter(Boolean);
  if (password) u.passwordHash = bcrypt.hashSync(password, 10);
  res.json(safeUser(u));
});

app.delete('/api/users/:id', authMiddleware, requireRole('Admin'), (req, res) => {
  const { id } = req.params;
  const idx = users.findIndex((x) => x.id === id);
  if (idx < 0) return res.status(404).json({ message: 'User not found' });
  users.splice(idx, 1);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Seed admin -> email: admin@hospital.com, password: admin123`);
});
