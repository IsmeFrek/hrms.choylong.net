import express from 'express';
import ReportSetting from '../models/ReportSetting.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

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

export default router;
