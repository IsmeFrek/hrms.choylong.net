import { Router } from 'express';
import HR from '../models/HR.js';
import User from '../models/User.js';
import OtpChallenge from '../models/OtpChallenge.js';
import ChangeRequest from '../models/ChangeRequest.js';
import { authRequired, requireAnyPermission, signToken, toUserDTO } from '../middleware/auth.js';
import { sendSms } from '../services/sms.js';
import { htmlToPdfBuffer } from '../services/renderPdf.js';

const router = Router();

function randomCode(n = 6) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// 1) Begin login: staff enters staffId and mobile (used as password)
router.post('/otp/start', async (req, res) => {
  const { staffId, mobile } = req.body || {};
  if (!staffId || !mobile) return res.status(400).json({ message: 'staffId and mobile are required' });

  const hr = await HR.findOne({ staffId: String(staffId).trim() });
  if (!hr) return res.status(404).json({ message: 'Staff not found' });

  // Verify mobile matches one of the known numbers
  const phones = [hr.phone, hr.unionPhone, hr.fatherPhone, hr.motherPhone].filter(Boolean).map(String);
  if (!phones.includes(String(mobile).trim())) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Create OTP challenge
  const code = randomCode(6);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await OtpChallenge.create({ staffId: hr.staffId, hrId: hr._id, code, expiresAt });

  // Try to send via SMS; fall back to console provider
  const smsRes = await sendSms(mobile, `Your OTP code is ${code}. It expires in 5 minutes.`);
  if (!smsRes.ok) {
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
  return res.json({ message: 'OTP sent' });
});

// 2) Verify OTP: if ok, sign JWT. Auto-create a User if missing.
router.post('/otp/verify', async (req, res) => {
  const { staffId, code } = req.body || {};
  if (!staffId || !code) return res.status(400).json({ message: 'staffId and code are required' });
  const chal = await OtpChallenge.findOne({ staffId: String(staffId).trim(), used: false }).sort({ createdAt: -1 });
  if (!chal) return res.status(400).json({ message: 'OTP not found' });
  if (chal.expiresAt < new Date()) return res.status(400).json({ message: 'OTP expired' });
  if (chal.attempts >= 5) return res.status(429).json({ message: 'Too many attempts' });
  if (chal.code !== String(code)) {
    chal.attempts += 1;
    await chal.save();
    return res.status(401).json({ message: 'Invalid code' });
  }

  chal.used = true; await chal.save();

  const hr = await HR.findById(chal.hrId);
  if (!hr) return res.status(404).json({ message: 'Staff not found' });

  // Ensure a linked User exists (username = staffId)
  let user = await User.findOne({ username: String(hr.staffId).toLowerCase() }).populate('roles');
  if (!user) {
    user = new User({
      username: String(hr.staffId).toLowerCase(),
      email: `${String(hr.staffId).toLowerCase()}@local`,
      fullName: hr.khmerName || hr.name || hr.staffId,
      active: true,
      roles: [], // will have limited permissions via fallback
    });
    await user.setPassword(code + '_' + Date.now()); // random
    await user.save();
    user = await user.populate('roles');
  }

  const token = signToken(user);
  return res.json({ token, user: toUserDTO(user), hrId: hr._id.toString() });
});

// 3) Self-edit: submit changes for approval
router.post('/hr/:id/self-edit', authRequired, async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  // Optional: simple CAPTCHA/OTP guard could be added here too
  const hr = await HR.findById(id);
  if (!hr) return res.status(404).json({ message: 'HR not found' });

  // Only the same staff (username==staffId) or admins with edit permission can create self-edit requests
  const requester = req.auth?.user;
  const requesterPerms = req.auth?.permissions || [];
  const isOwner = (requester?.username && String(requester.username).toLowerCase() === String(hr.staffId || '').toLowerCase());
  const isAdmin = requesterPerms.includes('edit:hr') || requesterPerms.includes('approve:hr');
  if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

  // Accept broad editable fields but sanitize strings; list known HR fields
  const f = payload.fields || payload; // support direct fields
  const safe = {};
  const stringFields = [
    'khmerName','name','gender','maritalStatus','bloodGroup','birthPlace','currentPlace','position','skill','civilServantId',
    'officerId','cardNumber','nid','status','image','phone','email','officerType','Department_Kh',
    'bankAccount','unionName','unionMemberId','unionRole','unionPhone','unionNote','fatherName',
    'fatherOccupation','fatherPhone','fatherNote','motherName','motherOccupation','motherPhone','motherNote',
    'workOther','degreeLevel','degree','educationLevel','mentorName','mentorDate','other','civilServantRole','salaryLevel',
    'lastSalaryIncrementDate','dateJoinedGov','grade','proposedBy','asOfDate','reason','reason1','reason2','reason3','reason4','reason5','reason6'
  ];
  stringFields.forEach(k => { if (typeof f[k] === 'string') safe[k] = f[k].trim(); });
  // Dates: pass through as-is; HR model will validate/normalize
  const dateFields = ['dob','joinDate','fatherDob','motherDob','unionJoinDate','medalReceivedDate','civilServantStartDate','nominationStartDate','dateJoinedMinistry','salaryPromotionDate'];
  dateFields.forEach(k => { if (f[k] != null && f[k] !== '') safe[k] = f[k]; });
  // Arrays: childrenList, educationList, documents (optional)
  if (Array.isArray(f.childrenList)) safe.childrenList = f.childrenList;
  if (Array.isArray(f.educationList)) safe.educationList = f.educationList;
  if (Array.isArray(f.documents)) safe.documents = f.documents;

  const cr = await ChangeRequest.create({
    targetType: 'hr',
    targetId: hr._id,
    payload: {
      titleText: 'Self-edit request',
      fields: safe,
      notes: { ...(payload.notes || {}), officerType: hr.officerType, department: hr.Department_Kh },
      attachments: [],
      meta: { staffNo: hr.no, staffId: hr.staffId }
    },
    reason: payload.reason || 'Self-service edit from mobile client',
    requestedBy: requester?._id || requester?.id || undefined,
    status: 'pending',
  });

  res.status(201).json({ id: cr._id.toString(), status: cr.status });
});

export default router;
// Below additional routes allow the authenticated staff to read their own HR info
router.get('/hr/me', authRequired, requireAnyPermission(['view:my-hr', 'view:selfservice', 'view:attendance']), async (req, res) => {
  try {
    const u = req.auth?.user;
    const perms = req.auth?.permissions || [];
    const isAdmin = (u?.roles || []).some((r) => (r?.name || r) === 'Admin');

    // Admins (or view:hr) can lookup an employee by identifier
    const identifier = req.query?.staffId || req.query?.identifier || '';
    if (identifier && (isAdmin || perms.includes('view:hr'))) {
      const idStr = String(identifier).trim();
      if (!idStr) return res.status(400).json({ message: 'Invalid identifier' });
      const digits = idStr.replace(/\D/g, '');
      const candidates = new Set();
      const add = (v) => {
        if (!v) return;
        const s = String(v).trim();
        if (!s) return;
        candidates.add(s);
        candidates.add(s.toLowerCase());
        candidates.add(s.replace(/\s|-/g, ''));
        candidates.add(s.replace(/\s|-/g, '').toLowerCase());
        if (s.startsWith('+')) candidates.add(s.slice(1));
        if (s.startsWith('+')) candidates.add(s.slice(1).toLowerCase());
      };

      add(idStr);
      if (digits) {
        // Cambodia international => local (e.g. 85512345678 -> 012345678)
        if (digits.startsWith('855') && digits.length >= 10) add('0' + digits.slice(3));
        // If local without leading zero (8 digits), add 0-prefix variant
        if (digits.length === 8) add('0' + digits);
      }

      const emailLike = idStr.includes('@') ? idStr.toLowerCase() : '';
      const list = Array.from(candidates);
      const or = [
        { staffId: { $in: list } },
        { phone: { $in: list } },
      ];
      if (emailLike) {
        const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        or.push({ email: new RegExp(`^${escRe(emailLike)}$`, 'i') });
      }
      if (digits && digits.length >= 6) {
        const tolerant = digits.split('').join('[\\s-]*');
        const re = new RegExp(tolerant);
        or.push({ phone: re });
        or.push({ staffId: re });
      }

      const hr = await HR.findOne({ $or: or });
      if (!hr) return res.status(404).json({ message: `HR not found (identifier=${idStr})` });

      const pick = ({
        _id,
        staffId,
        no,
        khmerName,
        name,
        gender,
        dob,
        maritalStatus,
        bloodGroup,
        phone,
        email,
        birthPlace,
        currentPlace,
        officerType,
        Department_Kh,
        position,
        skill,
        joinDate,
        civilServantRole,
        status,
        image,
      }) => ({
        id: _id?.toString?.() || _id,
        staffId,
        no,
        khmerName,
        name,
        gender,
        dob,
        maritalStatus,
        bloodGroup,
        phone,
        email,
        birthPlace,
        currentPlace,
        officerType,
        Department_Kh,
        position,
        skill,
        joinDate,
        civilServantRole,
        status,
        image,
      });

      return res.json(pick(hr));
    }

    // Support both OTP-created users (username=staffId) and normal staff accounts (phone-based)
    let staffId = u?.username ? String(u.username).trim().toLowerCase() : '';
    if (!staffId && u?.phone) {
      staffId = String(u.phone).trim().replace(/\s|-/g, '').toLowerCase();
    }
    const email = u?.email ? String(u.email).trim().toLowerCase() : '';
    if (!staffId && !u?.phone && !email) return res.status(400).json({ message: 'No staff identifier found for this user (username/phone/email)' });

    const candidates = new Set();
    const add = (v) => {
      if (!v) return;
      const s = String(v).trim();
      if (!s) return;
      candidates.add(s);
      candidates.add(s.toLowerCase());
      candidates.add(s.replace(/\s|-/g, ''));
      candidates.add(s.replace(/\s|-/g, '').toLowerCase());
      if (s.startsWith('+')) candidates.add(s.slice(1));
      if (s.startsWith('+')) candidates.add(s.slice(1).toLowerCase());
    };

    add(staffId);
    add(u?.phone);

    // If numeric phone without leading zero (8 digits), add 0-prefix variant
    const digits = String(u?.phone || staffId || '').replace(/\D/g, '');
    if (digits && digits.length === 8) add('0' + digits);

    // Cambodia international => local (e.g. +85512345678 -> 012345678)
    if (digits && digits.startsWith('855') && digits.length >= 10) add('0' + digits.slice(3));

    const list = Array.from(candidates);

    const or = [
      { staffId: { $in: list } },
      { phone: { $in: list } },
    ];

    // Fallback match by email (use exact match, case-insensitive)
    if (email) {
      const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      or.push({ email: new RegExp(`^${escRe(email)}$`, 'i') });
    }

    // Also match phones stored with spaces/dashes (e.g. "012 351 339")
    if (digits && digits.length >= 6) {
      const tolerant = digits.split('').join('[\\s-]*');
      const re = new RegExp(tolerant);
      or.push({ phone: re });
      or.push({ staffId: re });
    }

    const hr = await HR.findOne({ $or: or });
    if (!hr) return res.status(404).json({ message: `HR not found (staffId=${staffId || ''}${email ? `, email=${email}` : ''})` });
    // Limit fields to personal profile
    const pick = ({
      _id,
      staffId,
      no,
      khmerName,
      name,
      gender,
      dob,
      maritalStatus,
      bloodGroup,
      phone,
      email,
      birthPlace,
      currentPlace,
      officerType,
      Department_Kh,
      position,
      skill,
      joinDate,
      civilServantRole,
      status,
      image,
    }) => ({
      id: _id?.toString?.() || _id,
      staffId,
      no,
      khmerName,
      name,
      gender,
      dob,
      maritalStatus,
      bloodGroup,
      phone,
      email,
      birthPlace,
      currentPlace,
      officerType,
      Department_Kh,
      position,
      skill,
      joinDate,
      civilServantRole,
      status,
      image,
    });
    res.json(pick(hr));
  } catch (e) {
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

function sanitizeFilenamePart(input, { maxLen = 80 } = {}) {
  try {
    let s = input === undefined || input === null ? '' : String(input);
    s = s.replace(/[\r\n\t]+/g, ' ');
    // Windows reserved characters: \ / : * ? " < > |
    s = s.replace(/[\\/:*?"<>|]/g, ' ');
    s = s.replace(/[\x00-\x1F\x7F]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/[.\s]+$/g, '').trim();
    if (!s) return '';
    if (s.length > maxLen) s = s.slice(0, maxLen).trim();
    return s;
  } catch {
    return '';
  }
}

// Download own HR profile as PDF
router.get('/hr/me/pdf', authRequired, requireAnyPermission(['view:my-hr', 'view:selfservice']), async (req, res) => {
  try {
    const u = req.auth?.user;
    const perms = req.auth?.permissions || [];
    const isAdmin = (u?.roles || []).some((r) => (r?.name || r) === 'Admin');

    let hr;
    let staffIdLabelFromLookup = '';

    // Admins (or view:hr) can lookup an employee by identifier for PDF
    const identifier = req.query?.staffId || req.query?.identifier || '';
    if (identifier && (isAdmin || perms.includes('view:hr'))) {
      const idStr = String(identifier).trim();
      if (!idStr) return res.status(400).json({ message: 'Invalid identifier' });
      const digits = idStr.replace(/\D/g, '');
      const candidates = new Set();
      const add = (v) => {
        if (!v) return;
        const s = String(v).trim();
        if (!s) return;
        candidates.add(s);
        candidates.add(s.toLowerCase());
        candidates.add(s.replace(/\s|-/g, ''));
        candidates.add(s.replace(/\s|-/g, '').toLowerCase());
        if (s.startsWith('+')) candidates.add(s.slice(1));
        if (s.startsWith('+')) candidates.add(s.slice(1).toLowerCase());
      };

      add(idStr);
      if (digits) {
        if (digits.startsWith('855') && digits.length >= 10) add('0' + digits.slice(3));
        if (digits.length === 8) add('0' + digits);
      }

      const emailLike = idStr.includes('@') ? idStr.toLowerCase() : '';
      const list = Array.from(candidates);
      const or = [
        { staffId: { $in: list } },
        { phone: { $in: list } },
      ];
      if (emailLike) {
        const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        or.push({ email: new RegExp(`^${escRe(emailLike)}$`, 'i') });
      }
      if (digits && digits.length >= 6) {
        const tolerant = digits.split('').join('[\\s-]*');
        const re = new RegExp(tolerant);
        or.push({ phone: re });
        or.push({ staffId: re });
      }

      hr = await HR.findOne({ $or: or }).lean();
      if (!hr) return res.status(404).json({ message: `HR not found (identifier=${idStr})` });
      staffIdLabelFromLookup = hr.staffId || idStr || '';
    }

    if (!hr) {
      let staffId = u?.username ? String(u.username).trim().toLowerCase() : '';
      if (!staffId && u?.phone) {
        staffId = String(u.phone).trim().replace(/\s|-/g, '').toLowerCase();
      }
      const email = u?.email ? String(u.email).trim().toLowerCase() : '';
      if (!staffId && !u?.phone && !email) return res.status(400).json({ message: 'No staff identifier found for this user (username/phone/email)' });

      const candidates = new Set();
      const add = (v) => {
        if (!v) return;
        const s = String(v).trim();
        if (!s) return;
        candidates.add(s);
        candidates.add(s.toLowerCase());
        candidates.add(s.replace(/\s|-/g, ''));
        candidates.add(s.replace(/\s|-/g, '').toLowerCase());
        if (s.startsWith('+')) candidates.add(s.slice(1));
        if (s.startsWith('+')) candidates.add(s.slice(1).toLowerCase());
      };

      add(staffId);
      add(u?.phone);

      const digits = String(u?.phone || staffId || '').replace(/\D/g, '');
      if (digits && digits.length === 8) add('0' + digits);

      // Cambodia international => local (e.g. +85512345678 -> 012345678)
      if (digits && digits.startsWith('855') && digits.length >= 10) add('0' + digits.slice(3));

      const list = Array.from(candidates);
      const or = [
        { staffId: { $in: list } },
        { phone: { $in: list } },
      ];

      // Fallback match by email (use exact match, case-insensitive)
      if (email) {
        const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        or.push({ email: new RegExp(`^${escRe(email)}$`, 'i') });
      }
      if (digits && digits.length >= 6) {
        const tolerant = digits.split('').join('[\\s-]*');
        const re = new RegExp(tolerant);
        or.push({ phone: re });
        or.push({ staffId: re });
      }

      hr = await HR.findOne({ $or: or }).lean();
      if (!hr) return res.status(404).json({ message: `HR not found (staffId=${staffId || ''}${email ? `, email=${email}` : ''})` });
    }

    const staffIdLabel = staffIdLabelFromLookup || hr.staffId || '';
    const nameKh = hr.khmerName || '';
    const nameEn = hr.name || '';

    const esc = (v) => {
      const s = v === undefined || v === null ? '' : String(v);
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const fmtDate = (d) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        if (Number.isNaN(dt.getTime())) return String(d);
        return dt.toISOString().slice(0, 10);
      } catch {
        return String(d);
      }
    };

    const html = `<!doctype html>
<html lang="km">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My HR</title>
  <style>
    @page { size: A4; margin: 12mm 14mm; }
    body { font-family: "Khmer OS Siemreap", "Khmer OS", Arial, sans-serif; color: #111; font-size: 12px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
    .title { font-size: 16px; font-weight: 700; }
    .sub { margin-top: 4px; font-size: 12px; color:#333; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
    .box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; }
    .box h3 { margin:0 0 8px 0; font-size: 13px; }
    .row { display:flex; justify-content:space-between; gap: 10px; padding: 4px 0; border-bottom: 1px dashed #eee; }
    .row:last-child { border-bottom: none; }
    .label { color:#555; }
    .value { text-align:right; max-width: 65%; word-break: break-word; }
    .footer { margin-top: 14px; font-size: 10px; color:#666; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">ព័ត៌មានបុគ្គលិក (ខ្លួនឯង)</div>
      <div class="sub">អត្តលេខ: ${esc(staffIdLabel)} | ឈ្មោះ: ${esc(nameKh || nameEn || '—')}</div>
    </div>
    <div class="sub">ថ្ងៃទីបោះពុម្ព: ${esc(fmtDate(new Date()))}</div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>ព័ត៌មានផ្ទាល់ខ្លួន</h3>
      <div class="row"><div class="label">ឈ្មោះ (ខ្មែរ)</div><div class="value">${esc(hr.khmerName || '—')}</div></div>
      <div class="row"><div class="label">ឈ្មោះ (ឡាតាំង)</div><div class="value">${esc(hr.name || '—')}</div></div>
      <div class="row"><div class="label">ភេទ</div><div class="value">${esc(hr.gender || '—')}</div></div>
      <div class="row"><div class="label">ថ្ងៃខែឆ្នាំកំណើត</div><div class="value">${esc(fmtDate(hr.dob) || '—')}</div></div>
      <div class="row"><div class="label">ទីកន្លែងកំណើត</div><div class="value">${esc(hr.birthPlace || '—')}</div></div>
      <div class="row"><div class="label">អាសយដ្ឋានបច្ចុប្បន្ន</div><div class="value">${esc(hr.currentPlace || '—')}</div></div>
    </div>

    <div class="box">
      <h3>ការងារ</h3>
      <div class="row"><div class="label">ប្រភេទមន្ត្រី</div><div class="value">${esc(hr.officerType || '—')}</div></div>
      <div class="row"><div class="label">ផ្នែក</div><div class="value">${esc(hr.Department_Kh || '—')}</div></div>
      <div class="row"><div class="label">តួនាទី</div><div class="value">${esc(hr.position || '—')}</div></div>
      <div class="row"><div class="label">មុខជំនាញ</div><div class="value">${esc(hr.skill || '—')}</div></div>
      <div class="row"><div class="label">តួនាទីមន្ត្រី</div><div class="value">${esc(hr.civilServantRole || '—')}</div></div>
      <div class="row"><div class="label">ស្ថានភាព</div><div class="value">${esc(hr.status || '—')}</div></div>
    </div>

    <div class="box" style="grid-column: 1 / -1;">
      <h3>ទំនាក់ទំនង</h3>
      <div class="row"><div class="label">ទូរស័ព្ទ</div><div class="value">${esc(hr.phone || '—')}</div></div>
      <div class="row"><div class="label">អ៊ីមែល</div><div class="value">${esc(hr.email || '—')}</div></div>
    </div>
  </div>

  <div class="footer">* PDF នេះបង្កើតដោយប្រព័ន្ធ។ ប្រសិនបើមានកំហុស សូមស្នើកែប្រែ និងរង់ចាំអនុម័ត។</div>
</body>
</html>`;

    let buffer;
    try {
      buffer = await htmlToPdfBuffer(html, { format: 'A4', printBackground: true });
    } catch (e) {
      try {
        console.error('PDF generate failed (/api/self/hr/me/pdf):', e?.message || e);
      } catch {}
      return res.status(500).json({
        message: 'PDF generate failed',
        detail: e?.message || String(e),
        hint: 'If this is a server environment without Chromium, set PUPPETEER_EXECUTABLE_PATH or use the client-side PDF fallback.'
      });
    }

    const safeName = sanitizeFilenamePart(`${staffIdLabel || 'MY_HR'}_${nameKh || nameEn}`, { maxLen: 70 });
    const filename = `${safeName || 'MY_HR'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to export PDF' });
  }
});
