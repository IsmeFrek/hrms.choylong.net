import express from 'express';
import ReportSetting from '../models/ReportSetting.js';
import { authRequired, requirePermission } from '../middleware/auth.js';
import { recordLog } from '../services/auditService.js';
import { scheduleAttendanceSync, scheduleLeaveSync, scheduleGoogleSheetsSync } from '../services/cronService.js';

const router = express.Router();

// GET /api/report-settings/group/ui-settings
router.get('/group/ui-settings', async (req, res, next) => {
  try {
    const docs = await ReportSetting.find({ groupName: 'ui_settings' }).lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    return res.json({ ok: true, settings });
  } catch (err) { next(err); }
});

// POST /api/report-settings/group/ui-settings
router.post('/group/ui-settings', authRequired, async (req, res, next) => {
  try {
    const { settings } = req.body || {};
    if (!settings) return res.status(400).json({ ok: false, message: 'Missing settings object' });
    
    // Improved Admin Check
    const roles = (req.auth.user.roles || []).map(r => r.name);
    const isAdmin = roles.includes('Admin') || roles.includes('Administrator') || req.auth.user.email === 'admin@hospital.com';
    
    if (!isAdmin) {
      console.warn('UI Settings Update Denied: User is not admin', { email: req.auth.user.email, roles });
      return res.status(403).json({ ok: false, message: 'Only admins can change UI settings' });
    }

    const updates = [];
    for (const key in settings) {
      updates.push(
        ReportSetting.findOneAndUpdate(
          { key, groupName: 'ui_settings' },
          { $set: { value: settings[key] } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      );
    }
    
    await Promise.all(updates);

    // Record Audit Log
    const footerText = settings.footer_text || '';
    const truncatedText = footerText.length > 60 ? footerText.substring(0, 60) + '...' : footerText;

    try {
      await recordLog({
        userId: req.auth.user._id,
        userName: req.auth.user.fullName || req.auth.user.username || req.auth.user.email || 'Administrator',
        action: 'UPDATE',
        resource: 'SystemSettings',
        details: `កែសម្រួល Footer ទៅជា: "${truncatedText}"`,
        metadata: { settings }
      });
    } catch (auditErr) {
      console.error('Audit Log recording failed:', auditErr);
    }

    return res.json({ ok: true });
  } catch (err) { 
    console.error('Failed to save UI settings:', err);
    next(err); 
  }
});

// GET /api/report-settings/group/attendance-sync
router.get('/group/attendance-sync', async (req, res, next) => {
  try {
    const docs = await ReportSetting.find({ groupName: 'attendance_sync' }).lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    // Default values if not set
    if (!settings.sync_time) settings.sync_time = '09:35';
    if (typeof settings.auto_sync_enabled === 'undefined') settings.auto_sync_enabled = true;

    return res.json({ ok: true, settings });
  } catch (err) { next(err); }
});

// POST /api/report-settings/group/attendance-sync
router.post('/group/attendance-sync', authRequired, async (req, res, next) => {
  try {
    const { settings } = req.body || {};
    if (!settings) return res.status(400).json({ ok: false, message: 'Missing settings object' });
    
    const updates = [];
    for (const key in settings) {
      updates.push(
        ReportSetting.findOneAndUpdate(
          { key, groupName: 'attendance_sync' },
          { $set: { value: settings[key] } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      );
    }
    await Promise.all(updates);

    // Re-schedule the cron job
    scheduleAttendanceSync();

    // Record Audit Log
    try {
      await recordLog({
        userId: req.auth.user._id,
        userName: req.auth.user.fullName || req.auth.user.username || 'Administrator',
        action: 'UPDATE',
        resource: 'AttendanceSyncSettings',
        details: `Updated attendance sync settings: ${JSON.stringify(settings)}`,
        metadata: { settings }
      });
    } catch (e) { console.error('Audit Log failed', e); }

    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/report-settings/group/leave-sync
router.get('/group/leave-sync', async (req, res, next) => {
  try {
    const docs = await ReportSetting.find({ groupName: 'leave_sync' }).lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    // Default values if not set
    if (!settings.sync_times) settings.sync_times = [settings.sync_time || '09:40'];
    if (typeof settings.auto_sync_enabled === 'undefined') settings.auto_sync_enabled = true;

    return res.json({ ok: true, settings });
  } catch (err) { next(err); }
});

// POST /api/report-settings/group/leave-sync
router.post('/group/leave-sync', authRequired, async (req, res, next) => {
  try {
    const { settings } = req.body || {};
    if (!settings) return res.status(400).json({ ok: false, message: 'Missing settings object' });
    
    const updates = [];
    for (const key in settings) {
      updates.push(
        ReportSetting.findOneAndUpdate(
          { key, groupName: 'leave_sync' },
          { $set: { value: settings[key] } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      );
    }
    await Promise.all(updates);

    // Re-schedule the cron job
    scheduleLeaveSync();

    // Record Audit Log
    try {
      await recordLog({
        userId: req.auth.user._id,
        userName: req.auth.user.fullName || req.auth.user.username || 'Administrator',
        action: 'UPDATE',
        resource: 'LeaveSyncSettings',
        details: `Updated leave sync settings: ${JSON.stringify(settings)}`,
        metadata: { settings }
      });
    } catch (e) { console.error('Audit Log failed', e); }

    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/report-settings/employee-skill-groups
router.get('/employee-skill-groups', async (req, res, next) => {
  try {
    const groupName = (req.query.groupName || 'global');
    const doc = await ReportSetting.findOne({ key: 'employee_skill_groups', groupName }).lean();
    return res.json({ ok: true, prefs: doc && doc.value ? doc.value : { groups: [] } });
  } catch (err) { next(err); }
});

// POST /api/report-settings/employee-skill-groups
router.post('/employee-skill-groups', async (req, res, next) => {
  try {
    const body = req.body || {};
    const groupName = (body.groupName || 'global');
    const prefs = { groups: Array.isArray(body.groups) ? body.groups : [] };
    const updated = await ReportSetting.findOneAndUpdate(
      { key: 'employee_skill_groups', groupName },
      { $set: { value: prefs } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ ok: true, prefs: updated ? updated.value : prefs });
  } catch (err) { next(err); }
});

// GET /api/report-settings/hr-skill-groups?groupName=... - returns { prefs: { groups, tableOrder } }
router.get('/hr-skill-groups', async (req, res, next) => {
  try {
    const groupName = (req.query.groupName || 'global');
    const doc = await ReportSetting.findOne({ key: 'hrskill_prefs', groupName }).lean();
    return res.json({ ok: true, prefs: doc && doc.value ? doc.value : { groups: [], tableOrder: [] } });
  } catch (err) { next(err); }
});

// POST /api/report-settings/hr-skill-groups - body { groups, tableOrder, groupName? }
router.post('/hr-skill-groups', async (req, res, next) => {
  try {
    const body = req.body || {};
    const groupName = (body.groupName || 'global');
    const prefs = { groups: Array.isArray(body.groups) ? body.groups : [], tableOrder: Array.isArray(body.tableOrder) ? body.tableOrder : [] };
    const updated = await ReportSetting.findOneAndUpdate(
      { key: 'hrskill_prefs', groupName },
      { $set: { value: prefs } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ ok: true, prefs: updated ? updated.value : prefs });
  } catch (err) { next(err); }
});

// GET /api/report-settings/hr-visible-fields?groupName=... - returns { fields: string[] }
router.get('/hr-visible-fields', authRequired, requirePermission('view:hr'), async (req, res, next) => {
  try {
    const groupName = (req.query.groupName || 'global');
    const doc = await ReportSetting.findOne({ key: 'hr_visible_fields', groupName }).lean();
    const value = doc && doc.value ? doc.value : null;
    const fields = Array.isArray(value?.fields) ? value.fields : (Array.isArray(value) ? value : []);
    return res.json({ ok: true, fields });
  } catch (err) { next(err); }
});

// POST /api/report-settings/hr-visible-fields - body { fields: string[], groupName? }
router.post('/hr-visible-fields', authRequired, requirePermission('edit:hr'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const groupName = (body.groupName || 'global');
    const fields = Array.isArray(body.fields) ? body.fields.map((v) => String(v)) : [];
    const updated = await ReportSetting.findOneAndUpdate(
      { key: 'hr_visible_fields', groupName },
      { $set: { value: { fields } } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const out = Array.isArray(updated?.value?.fields) ? updated.value.fields : fields;
    return res.json({ ok: true, fields: out });
  } catch (err) { next(err); }
});

// GET /api/report-settings/:groupName - returns { hotline }
router.get('/:groupName', async (req, res, next) => {
  try {
    const groupName = decodeURIComponent(req.params.groupName || '');
    if (!groupName) return res.status(400).json({ message: 'Missing groupName' });
    const doc = await ReportSetting.findOne({ key: 'hotline', groupName }).lean();
    return res.json({ ok: true, hotline: doc ? (doc.value || '') : '' });
  } catch (err) { next(err); }
});

// POST /api/report-settings/:groupName - body { hotline }
router.post('/:groupName', async (req, res, next) => {
  try {
    const groupName = decodeURIComponent(req.params.groupName || '');
    if (!groupName) return res.status(400).json({ message: 'Missing groupName' });
    const hotline = (req.body && req.body.hotline) ? String(req.body.hotline).trim() : '';
    const updated = await ReportSetting.findOneAndUpdate(
      { key: 'hotline', groupName },
      { $set: { value: hotline } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ ok: true, hotline: updated ? updated.value : hotline });
  } catch (err) { next(err); }
});

// GET /api/report-settings/group/attendance-day-sync
router.get('/group/attendance-day-sync', async (req, res, next) => {
  try {
    const docs = await ReportSetting.find({ groupName: 'attendance_day_sync' }).lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    
    // Default values if not set
    if (!settings.sync_times) settings.sync_times = ['09:35'];
    if (typeof settings.auto_sync_enabled === 'undefined') settings.auto_sync_enabled = true;
    
    if (!settings.google_sheets_sync_times) settings.google_sheets_sync_times = ['10:00'];
    if (typeof settings.google_sheets_sync_enabled === 'undefined') settings.google_sheets_sync_enabled = false;

    return res.json({ ok: true, settings });
  } catch (err) { next(err); }
});

// POST /api/report-settings/group/attendance-day-sync
router.post('/group/attendance-day-sync', authRequired, async (req, res, next) => {
  try {
    const { settings } = req.body || {};
    if (!settings) return res.status(400).json({ ok: false, message: 'Missing settings object' });
    
    const updates = [];
    for (const key in settings) {
      updates.push(
        ReportSetting.findOneAndUpdate(
          { key, groupName: 'attendance_day_sync' },
          { $set: { value: settings[key] } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      );
    }
    await Promise.all(updates);

    // Re-schedule the cron jobs
    scheduleGoogleSheetsSync();

    return res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
