import express from 'express';
import HR from '../models/HR.js';
import ChangeRequest from '../models/ChangeRequest.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Debug: print registered enum values for status to detect conflicting model registrations
try {
  console.log('INIT: HR model status enum values ->', HR.schema && HR.schema.path('status') ? HR.schema.path('status').enumValues : '(no status path)');
} catch (e) {
  console.warn('INIT: failed to read HR schema status enum', e && e.message);
}

// NOTE: Request logging is noisy in dev; enable by setting DEBUG_HR_ROUTE=1 in env.
router.use((req, res, next) => {
  try {
    if (process.env.DEBUG_HR_ROUTE === '1') {
      console.log(`HR ROUTE -> ${req.method} ${req.path} body=${JSON.stringify(req.body)}`);
    }
  } catch (e) {
    if (process.env.DEBUG_HR_ROUTE === '1') console.log(`HR ROUTE -> ${req.method} ${req.path} (body unstringifiable)`);
  }
  next();
});

// Public sample endpoint for development: returns a small HR array without auth
router.get('/public-sample', async (req, res) => {
  try {
    const sample = [
      {
        _id: 'sample-1',
        staffId: 'HR-SAMPLE-001',
        khmerName: 'ស៊ិន សារ៉េន',
        name: 'Sin Saren',
        Department_Kh: 'ផ្នែកពេទ្យ',
        position: 'គ្រូពេទ្យ',
        skill: 'Internal Medicine',
        phone: '012345678',
        email: 'saren@example.com',
        dob: '1985-03-10'
      }
    ];
    res.json(sample);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth required for all HR routes
router.use(authRequired);

// Get all HR
router.get('/', requirePermission('view:hr'), async (req, res) => {
  try {
    // Return lean objects and add a computed flag `__isPreparedForDeletion`
    const hrList = await HR.find().lean();
    const today = new Date(); today.setHours(0,0,0,0);

    const RETIREMENT_AGE = (() => {
      const n = Number.parseInt(String(process.env.CIVIL_RETIRE_AGE || '60'), 10);
      return Number.isFinite(n) && n > 0 ? n : 60;
    })();

    const isCivilServant = (officerType) => {
      if (!officerType) return false;
      const raw = String(officerType);
      const lower = raw.toLowerCase();
      // Khmer commonly contains "រាជការ"; keep english fallback too.
      return raw.includes('រាជការ') || /civil/.test(lower);
    };

    const parseDob = (v) => {
      if (!v) return null;
      try {
        const d = (v instanceof Date) ? v : new Date(v);
        if (Number.isNaN(d.getTime())) return null;
        const dt = new Date(d);
        dt.setHours(0, 0, 0, 0);
        return dt;
      } catch {
        return null;
      }
    };

    const computeRetirementDate = (dob) => {
      if (!dob) return null;
      try {
        const r = new Date(dob);
        r.setFullYear(r.getFullYear() + RETIREMENT_AGE);
        r.setHours(0, 0, 0, 0);
        return r;
      } catch {
        return null;
      }
    };

    const shouldAutoRetire = (h) => {
      if (!h) return false;
      if (!isCivilServant(h.officerType)) return false;
      if (h.isRetiredThenContract || h.isPartTime) return false;
      const s = String(h.status || '').toLowerCase();
      if (s === 'resigned' || s === 'deleted') return false;
      const dob = parseDob(h.dob);
      const retireDate = computeRetirementDate(dob);
      if (!retireDate) return false;
      return today.getTime() >= retireDate.getTime();
    };

    // Auto-retire logic: for civil servants who reached retirement age and are not marked
    // as "retired then contract" or "part-time contract", set status to Resigned.
    // This runs on list fetch so the dataset stays consistent without a cron.
    const autoRetireOps = [];
    const autoRetireById = new Map();
    for (const h of (hrList || [])) {
      if (!shouldAutoRetire(h)) continue;
      const dob = parseDob(h.dob);
      const retirementDate = computeRetirementDate(dob);
      if (!retirementDate) continue;

      const update = {
        status: 'Resigned',
        resignationDate: h.resignationDate ? h.resignationDate : retirementDate,
        resignationReason: h.resignationReason || 'ចូលនិវត្តន៍',
      };

      autoRetireById.set(String(h._id), update);
      autoRetireOps.push({
        updateOne: {
          filter: { _id: h._id, status: { $nin: ['Resigned', 'Deleted'] }, isRetiredThenContract: { $ne: true }, isPartTime: { $ne: true } },
          update: { $set: update },
        }
      });
    }

    if (autoRetireOps.length) {
      try {
        await HR.bulkWrite(autoRetireOps, { ordered: false });
      } catch (e) {
        console.warn('Auto-retire bulkWrite failed:', e?.message || e);
      }
    }

    const parseLike = (v) => {
      if (!v) return null;
      try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return null;
        d.setHours(0,0,0,0);
        return d;
      } catch (e) { return null; }
    };

    const enriched = (hrList || []).map(h => {
      try {
        const auto = autoRetireById.get(String(h._id));
        const base = auto ? { ...h, ...auto, __autoRetired: true } : h;
        const del = (h && h.delisted) ? h.delisted : {};
        const dateStr = del.dateDelisted || del.date || base.resignationDate || base.resignDate || base.dateLeft || base.leftDate || base.departureDate || null;
        const removedStr = base.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || base.dateRemovedFromDataset || base.removalDate || null;
        const parsedDel = parseLike(dateStr);
        const parsedRemoved = parseLike(removedStr);
        const isPrepared = (parsedDel && parsedDel.getTime() > today.getTime()) || (parsedRemoved && parsedRemoved.getTime() > today.getTime());
        return { ...base, __isPreparedForDeletion: !!isPrepared };
      } catch (e) { return { ...h, __isPreparedForDeletion: false }; }
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single HR by id
router.get('/:id', requirePermission('view:hr'), async (req, res) => {
  try {
    const hr = await HR.findById(req.params.id);
    if (!hr) return res.status(404).json({ error: 'HR not found' });
    res.json(hr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Gender stats (male/female/other)
router.get('/stats/gender', requirePermission('view:hr'), async (req, res) => {
  try {
    // Aggregate gender counts; normalize to lowercase and treat missing as 'other'
    const agg = await HR.aggregate([
      {
        $group: {
          _id: { $toLower: { $ifNull: ["$gender", "other"] } },
          count: { $sum: 1 }
        }
      }
    ]);
    const result = { male: 0, female: 0, other: 0 };
    agg.forEach((r) => {
      const k = (r._id || '').toString().toLowerCase();
      if (k === 'male') result.male = r.count;
      else if (k === 'female') result.female = r.count;
      else result.other += r.count;
    });
    res.json(result);
  } catch (err) {
    console.error('Gender stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create HR
router.post('/', requirePermission('edit:hr'), async (req, res) => {
  try {
    const body = req.body || {};
    // Auto-handle sequential 'no' without shifting others
    let desiredNo = Number(body.no);
    if (!Number.isInteger(desiredNo) || desiredNo <= 0) {
      // If not provided, append to the end (max + 1)
      const max = await HR.findOne({}, { no: 1 }).sort({ no: -1 }).lean();
      body.no = ((max && Number.isInteger(max.no)) ? max.no : 0) + 1;
    } else {
      // If provided, ensure it's free; if taken, return a conflict
      const taken = await HR.findOne({ no: desiredNo }).lean();
      if (taken) {
        return res.status(409).json({ error: `Sequence number ${desiredNo} already in use`, code: 'DUP_NO' });
      }
      body.no = desiredNo;
    }

    const hr = new HR(body);
    await hr.save();
    res.status(201).json(hr);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update HR
router.put('/:id', requirePermission('edit:hr'), async (req, res) => {
  try {
    const id = req.params.id;
    // Debug: log incoming body to see what value is being sent
    try { console.log('HR PUT incoming id=', id, 'body=', JSON.stringify(req.body)); } catch(e) { console.log('HR PUT incoming (could not stringify body)'); }
    // Ensure documents with legacy string dates don't break model instantiation.
    // Helper: parse dd/mm/yyyy[ HH:MM] or yyyy-mm-dd to Date (UTC midnight unless time provided)
    const parseDateLike = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      if (typeof val !== 'string') return null;
      const s = val.trim();
      // dd/mm/yyyy or dd/mm/yyyy HH:MM
      const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
      if (dm) {
        const d = Number(dm[1]); const m = Number(dm[2]); const y = Number(dm[3]);
        const hh = dm[4] ? Number(dm[4]) : 0; const mm = dm[5] ? Number(dm[5]) : 0;
        return new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
      }
      // yyyy-mm-dd or ISO
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        const dt = new Date(s);
        if (!isNaN(dt.getTime())) return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      }
      return null;
    };

    // Attempt to load a lean version and repair any string date fields that would break model init
    const raw = await HR.findById(id).lean();
    if (!raw) return res.status(404).json({ error: 'HR not found' });
    const repairs = {};
    if (typeof raw.updatedAt === 'string') {
      const p = parseDateLike(raw.updatedAt);
      if (p) repairs.updatedAt = p;
    }
    if (typeof raw.salaryPromotionDate === 'string') {
      const p = parseDateLike(raw.salaryPromotionDate);
      if (p) repairs.salaryPromotionDate = p;
    }
    // also check nested unpaid dates that might be strings
    if (raw.unpaid) {
      if (typeof raw.unpaid.Start === 'string') {
        const p = parseDateLike(raw.unpaid.Start);
        if (p) repairs['unpaid.Start'] = p;
      }
      if (typeof raw.unpaid.End === 'string') {
        const p = parseDateLike(raw.unpaid.End);
        if (p) repairs['unpaid.End'] = p;
      }
    }
    // apply repairs if any
    if (Object.keys(repairs).length) {
      const setObj = {};
      for (const k of Object.keys(repairs)) setObj[k] = repairs[k];
      await HR.updateOne({ _id: id }, { $set: setObj }).catch((e) => {
        console.warn('Failed to apply repairs to HR document', e && e.message);
      });
    }

    // Now load the hydrated model instance (should succeed after repairs)
    let hr = await HR.findById(id);
    if (!hr) return res.status(404).json({ error: 'HR not found' });

  // Preserve original number before applying body
  const originalNo = hr.no;
  const body = req.body || {};
  // Normalize incoming status values and map frontend field names
    try {
    if (typeof body.status !== 'undefined') {
      // normalize string statuses: trim and map common variants (including Khmer values)
      if (body.status == null) {
        // leave as-is
      } else if (typeof body.status === 'string') {
        const s = body.status.trim().toLowerCase();
        // English variants
        if (s === 'resign' || s === 'resigned') body.status = 'Resigned';
        else if (s === 'deleted' || s === 'delete') body.status = 'Deleted';
        else if (s === 'inactive') body.status = 'Inactive';
        else if (s === 'active') body.status = 'Active';
        // Khmer variants - map common Khmer words to canonical enums
        else if (s === 'ទំនេរ' || s === 'មិនសកម្ម') body.status = 'Inactive';
        else if (s === 'សកម្ម' || s === 'មក') body.status = 'Active';
        else if (s === 'ចាកចេញ' || s === 'បានចាកចេញ') body.status = 'Resigned';
        else body.status = body.status.trim();
      }
    }
    // Accept frontend `resignDate` or `resignationDate` and map to `resignationDate`
    if (typeof body.resignDate !== 'undefined' && typeof body.resignationDate === 'undefined') {
      body.resignationDate = body.resignDate;
      // don't delete here — we'll not send resignDate down explicitly
    }
    // Accept resignation reason/document from frontend variants
    if (typeof body.resignReason !== 'undefined' && typeof body.resignationReason === 'undefined') {
      body.resignationReason = body.resignReason;
    }
    if (typeof body.resignDocument !== 'undefined' && typeof body.resignationDocument === 'undefined') {
      body.resignationDocument = body.resignDocument;
    }
  } catch (e) {
    console.warn('Normalization error:', e && e.message);
  }
  // Apply all fields except 'no' first
  const { no: desiredNoInput, ...rest } = body;
  // Use Mongoose `set` so schema setters run on assignment and we can validate early
  hr.set(rest);

  // Run a pre-save validation early to produce clearer errors to client
  try {
    await hr.validate();
  } catch (validationErr) {
    // Build a readable errors object
    const details = {};
    if (validationErr && validationErr.errors) {
      for (const k of Object.keys(validationErr.errors)) {
        const e = validationErr.errors[k];
        details[k] = e.message || (e.properties && e.properties.message) || String(e);
      }
    } else {
      details._error = validationErr.message || String(validationErr);
    }
    console.warn('HR validation failed (early):', details);
    return res.status(400).json({ error: 'Validation failed', details });
  }

    // Debug: log enum and value when status is present to diagnose validation errors
    try {
      if (typeof rest.status !== 'undefined') {
        console.log('DEBUG HR status enum values:', hr.schema.path('status')?.enumValues || hr.schema.path('status'));
        console.log('DEBUG HR attempted status value:', rest.status, 'typeof', typeof rest.status);
      }
    } catch (e) {
      console.warn('DEBUG: failed to read HR schema status enum', e && e.message);
    }

    // If 'no' is being changed, allow setting to new number. If it's taken, swap their numbers.
    if (typeof desiredNoInput !== 'undefined') {
      const newNo = Number(desiredNoInput);
      if (Number.isInteger(newNo) && newNo > 0 && newNo !== originalNo) {
        const taken = await HR.findOne({ _id: { $ne: id }, no: newNo });
        if (taken) {
          // Swap numbers between current doc and the taken doc using a temporary placeholder
          const tempNo = -Math.floor(Date.now() + Math.random() * 1000);
          // Move the other doc to a temp safe number
          await HR.updateOne({ _id: taken._id }, { $set: { no: tempNo } });
          // Set current doc to requested number
          await HR.updateOne({ _id: id }, { $set: { no: newNo } });
          // Move the other doc to original number of current doc
          await HR.updateOne({ _id: taken._id }, { $set: { no: originalNo } });
          hr.no = newNo;
        } else {
          // Free slot: just set to new number (leave original gap)
          hr.no = newNo;
        }
      }
    }

    // Debug: inspect schema enum and values right before save
    try {
      console.log('PRE-SAVE: HR.schema.status.enumValues=', HR.schema.path('status')?.enumValues);
      console.log('PRE-SAVE: hr.status=', hr.status, 'type=', typeof hr.status);
      console.log('PRE-SAVE: rest.status=', rest.status, 'type=', typeof rest.status);
      const validators = HR.schema.path('status') && HR.schema.path('status').validators;
      console.log('PRE-SAVE: status validators=', validators && validators.map(v=>v.type));
    } catch (e) { console.warn('PRE-SAVE debug failed', e && e.message); }
    await hr.save(); // save with reordered 'no' and other fields
    return res.json(hr);
  } catch (err) {
    try {
      console.error('HR update error:', err);
      console.error('HR update debug: incoming body=', req.body);
      console.error('HR update debug: HR.schema.status.enumValues=', HR.schema.path('status')?.enumValues);
      // Guard against `hr` being undefined to avoid ReferenceError during debug logging
      if (typeof hr !== 'undefined' && hr) {
        console.error('HR update debug: hr (partial)=', { id: hr._id && hr._id.toString(), status: hr.status });
      } else {
        console.error('HR update debug: hr (partial)= <not available>');
      }
    } catch (E) {
      console.error('HR update debug logging failed', E && E.message);
    }
    // Surface duplicate key nicely if occurs
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate sequence number', code: 'DUP_NO' });
    }
    res.status(400).json({ error: err.message || 'Update failed' });
  }
});

// Delete HR
router.delete('/:id', requirePermission('edit:hr'), async (req, res) => {
  try {
    const hr = await HR.findByIdAndDelete(req.params.id);
    if (!hr) return res.status(404).json({ error: 'HR not found' });
    res.json({ message: 'HR deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Resequence 'no' to 1..N, removing duplicates/gaps safely
router.post('/resequence', requirePermission('edit:hr'), async (req, res) => {
  try {
    // Get docs sorted by current number, then by _id for stable tie-breaks
    const docs = await HR.find({}, { _id: 1, no: 1 }).sort({ no: 1, _id: 1 }).lean();
    if (!docs.length) return res.json({ updated: 0 });

    const maxDoc = await HR.findOne({}, { no: 1 }).sort({ no: -1 }).lean();
    const maxNo = (maxDoc && Number.isFinite(Number(maxDoc.no))) ? Number(maxDoc.no) : 0;
    const bigOffset = maxNo + docs.length + 10; // ensure outside existing range

    // Phase A: move all to temporary unique range to avoid unique collisions
    const phaseA = docs.map((d, idx) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { no: bigOffset + idx + 1 } } }
    }));
    await HR.bulkWrite(phaseA);

    // Phase B: assign final sequential numbers 1..N
    const phaseB = docs.map((d, idx) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { no: idx + 1 } } }
    }));
    await HR.bulkWrite(phaseB);

    return res.json({ updated: docs.length });
  } catch (err) {
    console.error('HR resequence error:', err);
    return res.status(400).json({ error: err.message });
  }
});

// Submit proposed changes for HR Report View (approval flow)
router.post('/:id/proposed-changes', requirePermission('print:hr'), async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const userId = req.auth?.user?._id || req.auth?.user?.id;
    const cr = await ChangeRequest.create({
      targetType: 'hr',
      targetId: id,
      payload,
      requestedBy: userId,
      status: 'pending',
    });
    res.status(201).json({ id: cr._id.toString(), status: cr.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Approve a pending change request
router.post('/:id/proposed-changes/:crId/approve', requirePermission('approve:hr'), async (req, res) => {
  try {
    const { id, crId } = req.params;
  const cr = await ChangeRequest.findOne({ _id: crId, targetType: 'hr', targetId: id, status: 'pending' });
    if (!cr) return res.status(404).json({ error: 'Change request not found' });

  // Apply a safe subset of payload fields to the HR document
  const p = cr.payload || {};
  const fields = p.fields || {};
  const notes = p.notes || {};

  // Whitelist mappable fields (avoid applying formatted Khmer DOB)
  // If 'no' is being changed, reposition and shift others accordingly
  const update = {};
  // Core identity/location
  if (typeof fields.khmerName === 'string') update.khmerName = fields.khmerName.trim();
  if (typeof fields.name === 'string') update.name = fields.name.trim();
  if (typeof fields.birthPlace === 'string') update.birthPlace = fields.birthPlace.trim();
  if (typeof fields.currentPlace === 'string') update.currentPlace = fields.currentPlace.trim();
  // Role/skill
  if (typeof fields.position === 'string') update.position = fields.position.trim();
  if (typeof fields.skill === 'string') update.skill = fields.skill.trim();
  // Contact
  if (typeof fields.phone === 'string') update.phone = fields.phone.trim();
  if (typeof fields.email === 'string') update.email = fields.email.trim();
  if (typeof fields.fatherPhone === 'string') update.fatherPhone = fields.fatherPhone.trim();
  if (typeof fields.motherPhone === 'string') update.motherPhone = fields.motherPhone.trim();
  // Government IDs
  if (typeof fields.civilServantId === 'string') update.civilServantId = fields.civilServantId.trim();
  if (typeof fields.officerId === 'string') update.officerId = fields.officerId.trim();
  if (typeof fields.cardNumber === 'string') update.cardNumber = fields.cardNumber.trim();
  if (typeof fields.nid === 'string') update.nid = fields.nid.trim();
  // Misc
  if (typeof fields.image === 'string') update.image = fields.image.trim();
  if (typeof fields.status === 'string' && ['Active','Inactive'].includes(fields.status.trim())) update.status = fields.status.trim();
  if (typeof fields.gender === 'string' && ['Male','Female'].includes(fields.gender.trim())) update.gender = fields.gender.trim();
  // Officer/Department (accept from fields or notes)
  if (typeof fields.officerType === 'string') update.officerType = fields.officerType.trim();
  if (typeof notes.officerType === 'string') update.officerType = notes.officerType.trim();
  if (typeof fields.Department_Kh === 'string') update.Department_Kh = fields.Department_Kh.trim();
  if (typeof notes.department === 'string') update.Department_Kh = notes.department.trim();

    if (Object.keys(update).length) {
      // capture previous values prior to update
      const existing = await HR.findById(id).lean();
      const prev = {};
      if (existing) {
        for (const k of Object.keys(update)) prev[k] = existing[k];
      }
      const updated = await HR.findByIdAndUpdate(id, update, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ error: 'HR not found' });
      cr.prev = prev;
    }

    // Mark request approved
    cr.status = 'approved';
    cr.reviewedBy = req.auth?.user?._id || req.auth?.user?.id;
    cr.reviewedAt = new Date();
  await cr.save();
    res.json({ message: 'Approved', id: cr._id.toString(), applied: Object.keys(update) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
