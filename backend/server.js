import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
// Trigger restart for new Daily Sync routes
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
import meetingRoomRoutes from './routes/meetingRooms.js';
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
import fileTransfersOutRoutes from './routes/fileTransfersOut.js';
import faceRoutes from './routes/face.js';
import vendorRoutes from './routes/vendor.js';
import geoFenceRoutes from './routes/geoFence.js';
import leaveRequestRoutes from './routes/leaveRequests.js';
import auditLogRoutes from './routes/auditLogs.js';
import mobileRoutes from './routes/mobile.js';
import evaluationGroupsRoutes from './routes/evaluationGroups.js';
import signaturePoliciesRoutes from './routes/signaturePolicies.js';
import { initCronJobs, sendReportToTelegram } from './services/cronService.js';
import { getActiveUsers } from './services/activeUsersTracker.js';
import { authRequired } from './middleware/auth.js';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Compute __dirname for ES modules and load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from both root .env and backend/.env
// Root .env often contains ngrok and high-level config
dotenv.config({ path: path.join(__dirname, '..', '.env') }); 
// Backend .env contains database and local port config
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
let PORT = Number(process.env.PORT) || 5000;


// CORS configuration: allow HRMS local origins + Checkinme domain for bookmarklet sync
const allowedOrigins = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^https?:\/\/172\.\d+\.\d+\.\d+(:\d+)?$/,
  /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  /^https?:\/\/hospital\.checkinme\.app$/,
  /^https?:\/\/.*\.checkinme\.app$/,
  /^https?:\/\/.*\.ngrok-free\.dev$/,
  /^https?:\/\/.*\.ngrok\.io$/,
  // Production domains
  /^https?:\/\/choylong\.net$/,
  /^https?:\/\/hrms\.choylong\.net$/,
  /^https?:\/\/www\.choylong\.net$/,
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins in development or if origin is missing
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const allowed = allowedOrigins.some(pattern => pattern.test(origin));
    if (allowed) return callback(null, true);
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' })); // ឬកំណត់ 10mb, 20mb តាមត្រូវការ
app.use(express.urlencoded({ extended: true }));

// --- DEVELOPMENT PROXY ---
// In development, proxy non-API requests to Vite (Port 5173)
if (process.env.NODE_ENV !== 'production') {
  // Create the proxy instance ONCE
  const devProxy = createProxyMiddleware({
    target: (process.env.VITE_HTTP === '1' ? 'http' : 'https') + '://127.0.0.1:5173',
    changeOrigin: true,
    secure: false, // allow self-signed certs in dev
    ws: true,
    logLevel: 'warn',
    onError: (err, req, res) => {
      console.error('Proxy connection error to Vite (HTTPS):', err.message);
      res.status(502).send(`
        <div style="padding: 20px; font-family: sans-serif; text-align: center;">
          <h2 style="color: #e11d48;">❌ មិនអាចភ្ជាប់ទៅកាន់ Frontend (HTTPS) បានទេ</h2>
          <p>សូមប្រាកដថាអ្នកបានរត់ <b>npm run dev</b> រួចហើយ។</p>
          <p style="color: #64748b; font-size: 13px;">Error: ${err.message}</p>
          <button onclick="window.location.reload()" style="padding: 10px 20px; cursor: pointer;">សាកល្បងម្ដងទៀត</button>
        </div>
      `);
    }
  });

  app.use('/', (req, res, next) => {
    const p = req.path || '';
    // Skip proxy for API, Uploads, and backend-specific routes
    if (
      p.startsWith('/api') || 
      p.startsWith('/Uploads') || 
      p.startsWith('/socket.io') || 
      p.startsWith('/kshf_hospital_app') ||
      (p.startsWith('/telegram') && req.headers.accept?.includes('application/json'))
    ) {
      return next();
    }
    // Use the single proxy instance
    return devProxy(req, res, next);
  });
}

// Legacy /Uploads/* → Cloudflare R2 (302 redirect)
// Old URLs like /Uploads/filename.pdf are transparently redirected to
// https://media.choylong.net/filename.pdf — no DB changes required.
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || 'https://media.choylong.net').replace(/\/$/, '');
app.use('/Uploads', (req, res) => {
  const filename = decodeURIComponent((req.path || req.url || '').replace(/^\//, ''));
  if (!filename) return res.status(404).send('Not found');
  return res.redirect(302, `${R2_PUBLIC_URL}/${filename}`);
});

// Serve static files from public (non-Uploads)
app.use(express.static(path.join(__dirname, '../public')));


// Use upload route
app.use(uploadRoute);

// Import endpoints (file-based imports)
app.use(importsRoutes);

// Public verification endpoint for QR code scans (Placed here to bypass any router-level auth)
app.get('/api/public-verify/hr/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    if (!staffId) return res.status(400).json({ error: 'Missing staff identifier' });
    
    // Import HR model inside to avoid early initialization issues if any
    const HR = mongoose.models.HR;
    const cleanId = staffId.trim();

    // SPECIAL CASE: Return all staff if 'all' is passed
    if (cleanId.toLowerCase() === 'all') {
      const allStaff = await HR.find({ status: { $ne: 'Resigned' } })
        .select('khmerName name position Department_Kh staffId image')
        .limit(100)
        .sort({ no: 1 });
      return res.json(allStaff);
    }
    
    // Exact match or contains match for staffId, officerId, etc.
    const query = {
      $or: [
        { staffId: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
        { officerId: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
        { checkinmeId: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
        // Fallback: search by 'no' if it's a number
        ...(cleanId.match(/^\d+$/) ? [{ no: parseInt(cleanId) }] : []),
        // Fallback: if input is D0002, also search for '2' in 'no'
        ...(cleanId.match(/\d+/) ? [{ no: parseInt(cleanId.match(/\d+/)[0]) }] : [])
      ]
    };

    if (cleanId.match(/^[0-9a-fA-F]{24}$/)) {
      query.$or.push({ _id: cleanId });
    }
    
    const staff = await HR.findOne(query).select('khmerName name position Department_Kh phone email image status officerType');
    
    if (!staff) {
      return res.status(404).json({ error: `រកមិនឃើញបុគ្គលិកដែលមានលេខសម្គាល់ ${cleanId} នេះទេ` });
    }
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple connectivity check
app.get('/api/check', (req, res) => {
  res.json({ status: "Backend is connected", timestamp: new Date() });
});

// Endpoint to list all files in Uploads (for predictive image verification)
app.get('/api/uploads-list', (req, res) => {
  const dir = path.join(__dirname, '../public/Uploads');
  fs.readdir(dir, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(files || []);
  });
});

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
app.use('/api/meeting-rooms', meetingRoomRoutes);
app.use('/api/work-schedule-employees', workScheduleEmployeesRoutes);
app.use('/api/work-schedules', workSchedulesRoutes);
app.use('/api/signature-policies', signaturePoliciesRoutes);
app.use('/api/department-units', departmentUnitRoutes);
app.use('/api/geo-fence', geoFenceRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/evaluation-groups', evaluationGroupsRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/mobile', mobileRoutes);
// Missions routes (persisted missions)
app.use('/api/missions', missionsRoutes);
// expose under legacy namespace as well
app.use('/kshf_hospital_app/missions', missionsRoutes);
// Also expose file transfer routes under /api for newer frontend calls
app.use('/api', fileTransfersRoutes);
// Expose legacy KSHF endpoint namespace for frontend compatibility
app.use('/kshf_hospital_app', fileTransfersRoutes);
// Frontend calls /api/kshf_hospital_app/... — support nested path
app.use('/api/kshf_hospital_app', fileTransfersRoutes);
app.use('/api/kshf_hospital_app', fileTransfersOutRoutes);
app.use('/api/kshf_hospital_app/missions', missionsRoutes);
// Outgoing file transfers
app.use('/api', fileTransfersOutRoutes);
app.use('/kshf_hospital_app', fileTransfersOutRoutes);
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
  try {
    // 1. Create or Update Admin Role
    let adminRole = await Role.findOne({ name: 'Admin' });
    if (!adminRole) {
      adminRole = await Role.create({ name: 'Admin', permissions: PERMISSIONS });
      console.log('[Seed] Created Admin role with', PERMISSIONS.length, 'permissions.');
    } else {
      // Always add any missing permissions from the master list
      const currentPerms = adminRole.permissions || [];
      const toAdd = PERMISSIONS.filter(p => !currentPerms.includes(p));
      if (toAdd.length > 0) {
        await Role.updateOne(
          { _id: adminRole._id },
          { 
            $addToSet: { permissions: { $each: toAdd } },
            $set: { updatedAt: new Date() }
          }
        );
        console.log('[Seed] Added', toAdd.length, 'new permissions to Admin role.');
      } else {
        // console.log('[Seed] Admin role is up to-date.');
      }
    }

    // 2. Create or Update User Role
    const userBasePerms = ['view:employees', 'view:hr', 'print:hr', 'view:fileTransfers', 'send:feedback', 'send:telegram', 'view:attendance'];
    let userRole = await Role.findOne({ name: 'User' });
    if (!userRole) {
      userRole = await Role.create({ name: 'User', permissions: userBasePerms });
      console.log('[Seed] Created User role.');
    } else {
      await Role.updateOne(
        { _id: userRole._id },
        { $addToSet: { permissions: { $each: userBasePerms } } }
      );
    }

    // 3. Create Default Admin User
    const adminEmail = 'admin@hospital.com';
    let admin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!admin) {
      admin = new User({
        fullName: 'Administrator',
        email: adminEmail.toLowerCase(),
        active: true,
        roles: [adminRole._id],
      });
      await admin.setPassword('admin123');
      await admin.save();
      console.log('[Seed] Seeded admin user:', adminEmail, '(password: admin123)');
    } else {
      // Ensure existing admin user has the Admin role linked
      if (!admin.roles || !admin.roles.includes(adminRole._id)) {
        await User.updateOne({ _id: admin._id }, { $addToSet: { roles: adminRole._id } });
        console.log('[Seed] Linked Admin role to existing user:', adminEmail);
      }
    }
    
    // 4. Create Test User "t"
    const testUsername = 't';
    let testUser = await User.findOne({ username: testUsername });
    if (!testUser) {
      testUser = new User({
        username: testUsername,
        fullName: 'Test User (t)',
        active: true,
        roles: [adminRole._id], // Link to Admin role
      });
      await testUser.setPassword('1');
      await testUser.save();
      console.log('[Seed] Seeded test user:', testUsername, '(password: 1)');
    } else {
      // Ensure test user has the Admin role linked
      if (!testUser.roles || !testUser.roles.includes(adminRole._id)) {
        await User.updateOne({ _id: testUser._id }, { $addToSet: { roles: adminRole._id } });
        console.log('[Seed] Linked Admin role to existing test user:', testUsername);
      }
    }

    // Handle the typo user "admint@hospital.com" if it exists, to give them admin role too
    const typoEmail = 'admint@hospital.com';
    let typoUser = await User.findOne({ email: typoEmail.toLowerCase() });
    if (typoUser && (!typoUser.roles || !typoUser.roles.includes(adminRole._id))) {
      await User.updateOne({ _id: typoUser._id }, { $addToSet: { roles: adminRole._id } });
      console.log('[Seed] Fixed typo user permissions (linked Admin role to admint@hospital.com)');
    }

  } catch (err) {
    console.error('[Seed] Error seeding defaults:', err);
  }
}

// Connect to database
connectDB();

// Temporary route to fix permissions for the user
app.get('/api/fix-perms', async (req, res) => {
  try {
    const User = mongoose.models.User;
    const Role = mongoose.models.Role;
    
    const adminRole = await Role.findOne({ name: 'Admin' });
    if (!adminRole) return res.status(404).json({ message: 'Admin role not found' });
    
    const user = await User.findOne({ email: 'admin@hospital07.com' });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await User.updateOne({ _id: user._id }, { $addToSet: { roles: adminRole._id } });
    
    res.json({ message: 'Permissions fixed! User admin@hospital07.com is now an Admin.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize Daily Cron Jobs
initCronJobs();

// Test endpoint for daily report (Trigger manually)
app.get('/api/test-daily-report', async (req, res) => {
  try {
    await sendReportToTelegram();
    res.json({ message: 'Daily report trigger initiated. Check Telegram.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// (removed duplicate imports and mounts)

// Test route moved to /api/status so it doesn't block the frontend on '/'
app.get('/api/status', (req, res) => {
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

app.get('/api/active-users', authRequired, (req, res) => {
  res.json({ users: getActiveUsers() });
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

// SPA fallback for Production
if (process.env.NODE_ENV === 'production') {
  // Serve built static assets from dist
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res, next) => {
    const p = req.path || '';
    if (p.startsWith('/api') || p.startsWith('/Uploads') || p.startsWith('/kshf_hospital_app')) return next();
    if (path.extname(p)) return next();
    const accept = (req.headers.accept || '');
    if (!accept.includes('text/html')) return next();
    
    const distPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distPath)) return res.sendFile(distPath);
    const pubPath = path.join(__dirname, '../public/index.html');
    if (fs.existsSync(pubPath)) return res.sendFile(pubPath);
    next();
  });
}

// 404 handler (fallback for non-GET or non-HTML requests)
app.use('*', (req, res, next) => {
  console.log('404 Not Found:', req.method, req.originalUrl || req.url);
  if (req.method === 'GET' && req.headers.accept?.includes('text/html')) return next();
  res.status(404).json({ message: 'Route not found' });
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR HANDLER]', err);
  res.status(err.status || 500).json({ 
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err.stack 
  });
});

function startServer(p) {
  const server = app.listen(p, () => {
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
