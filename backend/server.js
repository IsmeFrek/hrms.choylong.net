import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRoute from './uploadRoute.js';
import fs from 'fs';
// Import routes early so they are defined before use
import departmentRoutes from './routes/departments.js';
import employeeRoutes from './routes/employees.js';
import documentRoutes from './routes/documents.js';
import fileRoutes from './routes/files.js';
import skillRoutes from './routes/skills.js';
import positionRoutes from './routes/positions.js';
import hrRoutes from './routes/hr.js';
import documentFlowRoutes from './routes/documentFlow.js';
import departmentRequestRoutes from './routes/departmentRequests.js';
import lettersRoutes from './routes/letters.js';
import attendanceRoutes from './routes/attendance.js';
import schedulesRoutes from './routes/schedules.js';
import scheduleOverridesRoutes from './routes/scheduleOverrides.js';
import shiftTemplatesRoutes from './routes/shiftTemplates.js';
import shiftGroupsRoutes from './routes/shiftGroups.js';
import holidaysRoutes from './routes/holidays.js';
import reportSettingsRoutes from './routes/reportSettings.js';
import departmentUnitRoutes from './routes/departmentUnit.js';
// Models (for seeding)
import Role from './models/Role.js';
import User from './models/User.js';
import { PERMISSIONS } from './permissions.js';
// Auth/admin routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import rolesRoutes from './routes/roles.js';
import approvalsRoutes from './routes/approvals.js'; // new
import selfServiceRoutes from './routes/selfservice.js';
import onboardingRoutes from './routes/onboarding.js';
import notificationRoutes from './routes/notifications.js';
import notifyStageRoutes from './routes/notifyStage.js';
import telegramRoutes from './routes/telegram.js';
import telegramLinkRoutes from './routes/telegramLink.js';
import signatureRoutes from './routes/signatures.js';
import workScheduleEmployeesRoutes from './routes/workScheduleEmployees.js';
import workSchedulesRoutes from './routes/workSchedules.js';
import importsRoutes from './routes/imports.js';
import fileTransfersRoutes from './routes/fileTransfers.js';
import missionsRoutes from './routes/missions.js';
import scannerRoutes from './routes/scanner.js';
import dashboardRoutes from './routes/dashboard.js';
import fileTransferStatsRoutes from './routes/fileTransferStats.js';
import faceRoutes from './routes/face.js';
import vendorRoutes from './routes/vendor.js';
import geoFenceRoutes from './routes/geoFence.js';

// Compute __dirname for ES modules and load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
let PORT = Number(process.env.PORT) || 5000;


// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ឬកំណត់ 10mb, 20mb តាមត្រូវការ
app.use(express.urlencoded({ extended: true }));

// Serve static files from public/Uploads (route uses /Uploads)
// If an uploads file is missing, return a small inline SVG placeholder instead of 404.
app.use('/Uploads', (req, res, next) => {
  try {
    const requested = decodeURIComponent(req.path || req.url || '');
    const filePath = path.join(__dirname, '../public/Uploads', requested.replace(/^\//, ''));
    if (fs.existsSync(filePath)) return next();
    // simple SVG placeholder with filename
    const name = path.basename(filePath);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial, Helvetica, sans-serif" font-size="20">Image not found</text>
        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="14">${name}</text>
      </svg>`;
    res.type('image/svg+xml');
    return res.send(svg);
  } catch (e) {
    return next();
  }
});

// Serve static files from public/Uploads (route uses /Uploads)
app.use('/Uploads', express.static(path.join(__dirname, '../public/Uploads')));

// Serve static files from public
app.use(express.static(path.join(__dirname, '../public')));

// Use upload route
app.use(uploadRoute);

// Import endpoints (file-based imports)
app.use(importsRoutes);

// Auth and admin routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/approvals', approvalsRoutes); // new
app.use('/api/self', selfServiceRoutes); // otp + self-edit
app.use('/api', onboardingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/notifications', notifyStageRoutes);
app.use('/api', telegramRoutes); // Telegram webhook
app.use('/api/telegram', telegramLinkRoutes); // Telegram linking

// Domain routes
app.use('/api/departments', departmentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', fileTransferStatsRoutes);
app.use('/api/document-flow', documentFlowRoutes);
app.use('/api/department-requests', departmentRequestRoutes);
app.use('/api/letters', lettersRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/schedule-overrides', scheduleOverridesRoutes);
app.use('/api/shift-templates', shiftTemplatesRoutes);
app.use('/api/shift-groups', shiftGroupsRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/report-settings', reportSettingsRoutes);
app.use('/api/work-schedule-employees', workScheduleEmployeesRoutes);
app.use('/api/work-schedules', workSchedulesRoutes);
app.use('/api/department-units', departmentUnitRoutes);
app.use('/api/geo-fence', geoFenceRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/vendor', vendorRoutes);
// Missions routes (persisted missions)
app.use('/api/missions', missionsRoutes);
// expose under legacy namespace as well
app.use('/kshf_hospital_app/missions', missionsRoutes);
// Also expose file transfer routes under /api for newer frontend calls
app.use('/api', fileTransfersRoutes);
// Expose legacy KSHF endpoint namespace for frontend compatibility
app.use('/kshf_hospital_app', fileTransfersRoutes);
// expose scanner helper endpoints under the legacy namespace
app.use('/kshf_hospital_app/scanner', scannerRoutes);

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully to kshf_hospital_app');

    // Seed default roles and admin user
    await seedDefaults();
  } catch (error) {
    console.error('MongoDB connection error (continuing without DB):', error);
    // Do not exit the process here so that lightweight endpoints (scanner, static files)
    // can still be used for local testing even when MongoDB is not available.
  }
};

// Seed roles and admin
async function seedDefaults() {
  // create roles if missing
  const adminRole = await Role.findOneAndUpdate(
    { name: 'Admin' },
    { $setOnInsert: { name: 'Admin', permissions: PERMISSIONS } }, // full perms
    { upsert: true, new: true }
  );
  const userBasePerms = ['view:employees', 'view:hr', 'print:hr', 'view:fileTransfers', 'send:feedback', 'send:telegram', 'view:attendance'];

  // Create User role if missing
  let userRole = await Role.findOne({ name: 'User' });
  if (!userRole) {
    userRole = await Role.create({ name: 'User', permissions: userBasePerms });
  } else {
    // Ensure baseline permissions exist even if the role was created earlier with empty perms
    await Role.updateOne(
      { _id: userRole._id },
      { $addToSet: { permissions: { $each: userBasePerms } } }
    );
    userRole = await Role.findById(userRole._id);
  }

  const adminEmail = 'admin@hospital.com';
  let admin = await User.findOne({ email: adminEmail.toLowerCase() }).populate('roles');
  if (!admin) {
    admin = new User({
      fullName: 'Administrator',
      email: adminEmail.toLowerCase(),
      active: true,
      roles: [adminRole._id],
    });
    await admin.setPassword('admin123');
    await admin.save();
    admin = await admin.populate('roles');
    console.log('Seeded admin user:', adminEmail, '(password: admin123)');
  }
}

// Connect to database
connectDB();

// (removed duplicate imports and mounts)

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'HRMS Backend API is running!' });
});

// NEW: health-check endpoint used by LoginPage.jsx
app.get('/api/health', (req, res) => {
  const d = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateLocal = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const timeLocal = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: d.toISOString(),
    serverDate: dateLocal,
    serverTime: timeLocal,
  });
});

// Simple face-login placeholder endpoint
// Accepts JSON: { image: 'data:image/png;base64,...' }
app.post('/api/face-login', (req, res, next) => {
  try {
    const { image } = req.body || {};
    if (!image) return res.status(400).json({ message: 'No image provided' });
    const m = /^data:(image\/\w+);base64,(.+)$/.exec(image);
    if (!m) return res.status(400).json({ message: 'Invalid image format' });
    const mime = m[1];
    const b64 = m[2];
    const ext = mime.split('/')[1] || 'png';
    const buf = Buffer.from(b64, 'base64');
    const dir = path.join(__dirname, '../public/Uploads/face_logins');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `face_${Date.now()}.${ext}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buf);
    // Placeholder: TODO -> run recognition and return matched user/token
    return res.json({ message: 'Image received', path: `/Uploads/face_logins/${filename}` });
  } catch (err) {
    return next(err);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  const code = err.status || err.statusCode || 500;
  const msg = err.message || 'Something went wrong!';
  console.error('Error middleware:', { code, msg, stack: err.stack });
  res.status(code).json({ message: msg });
});

// SPA fallback for client-side routing (serve index.html for non-API GET requests)
app.get('*', (req, res, next) => {
  // Let API, uploads, and asset requests fall through to their handlers
  const p = req.path || '';
  if (p.startsWith('/api') || p.startsWith('/kshf_hospital_app') || p.startsWith('/Uploads')) return next();
  // If the request appears to be for a static asset (has an extension), let static middleware handle it
  if (path.extname(p)) return next();
  // Only serve index.html for browsers that accept HTML
  const accept = (req.headers.accept || '');
  if (!accept.includes('text/html')) return next();
  return res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
    if (err) return next(err);
  });
});

// 404 handler (fallback for non-GET or non-HTML requests)
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

function startServer(p) {
  const server = app.listen(p, '0.0.0.0', () => {
    console.log(`Server is running on port ${p}`);
    console.log(`Backend API available at:`);
    console.log(`- Local: http://localhost:${p}`);
    console.log(`- Network: http://0.0.0.0:${p}`);

    // Write runtime port for frontend dev proxy auto-discovery
    try {
      fs.writeFileSync(path.join(__dirname, '.runtime-port'), String(p), 'utf8');
    } catch {
      // ignore
    }
  });
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      const next = p + 1;
      console.warn(`Port ${p} in use, trying ${next}...`);
      startServer(next);
    } else {
      throw err;
    }
  });
}

startServer(PORT);
