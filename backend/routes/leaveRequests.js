import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import Employee from '../models/Employee.js';
import { authRequired, requireAnyPermission } from '../middleware/auth.js';
import { scrapeCheckinmeLeaves } from '../services/checkinmeService.js';

const router = express.Router();

// Helper to generate the "លិខិតអនុញ្ញាត" HTML template
const generateLeaveRequestHtml = (request, esc, fmtDate) => {
  return `<!doctype html>
<html lang="km">
<head>
  <meta charset="utf-8" />
  <title>លិខិតអនុញ្ញាត_${request.staffId}</title>
  <style>
    @page { size: A4; margin: 0; }
    body { 
      margin: 0; 
      padding: 0; 
      width: 205mm; 
      height: 295mm;
      font-family: "Khmer OS Siemreap", "Khmer OS", Arial, sans-serif; 
      font-size: 12pt; 
      line-height: 1.6;
    }
    .container { 
      padding: 0; 
      position: relative; 
      width: 205mm; 
      height: 295mm; 
      overflow: hidden; 
      background-color: white;
    }
    .background-overlay {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      z-index: 0;
      pointer-events: none;
    }
    .background-overlay img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .content-layer {
      position: relative;
      z-index: 1;
      padding: 40mm 20mm 20mm 25mm; /* Shift down to avoid header */
    }
    .ref-row {
      display: flex;
      justify-content: space-between;
      margin-top: 10mm;
      margin-bottom: 10mm;
    }
    .ref-num { font-size: 12pt; padding-left: 10mm; }
    .date-traditional { text-align: right; font-size: 11pt; line-height: 1.5; }
    
    .main-title-container {
      text-align: center;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .main-title { 
      font-family: "Khmer OS Muol Light", "Khmer OS Muol", serif; 
      font-size: 15pt; 
      margin-bottom: 2px;
    }
    .title-separator {
      width: 150px;
      height: auto;
    }
    .form-content { margin-top: 10px; margin-left: 20px; }
    .form-row { display: flex; margin-bottom: 15px; }
    .form-label { width: 220px; font-weight: normal; }
    .form-separator { width: 30px; text-align: center; }
    .form-value { flex: 1; font-weight: bold; }
    
    .signature-block { margin-top: 50px; text-align: right; padding-right: 50px; }
    .signer-title { font-family: "Khmer OS Muol Light", "Khmer OS Muol", serif; font-size: 14pt; }
    
    .cc-section { margin-top: 10px; font-size: 10pt; line-height: 1.4; }
    .cc-title { text-decoration: underline; font-weight: bold; margin-bottom: 5px; }
    .cc-item { padding-left: 10px; }
    
    .bottom-footer-note { 
      position: absolute; 
      bottom: 25mm; 
      right: 20mm; 
      font-size: 10pt; 
      font-style: italic; 
    }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="background-overlay">
      <img src="/Uploads/miss.png" alt="background" />
    </div>
    <div class="content-layer">
      <!-- We skip the very top header because it is in miss.png -->
      <div class="ref-row">
        <div class="ref-num">.........../វប</div>
        <div class="date-traditional">
          ថ្ងៃ............ ........រោច ខែ............ ឆ្នាំ............ ............ ព.ស.២៥៦...<br/>
          រាជធានីភ្នំពេញ, ថ្ងៃទី.......... ខែ.......... ឆ្នាំ២០២...
        </div>
      </div>

      <div class="main-title-container">
        <div class="main-title">លិខិតអនុញ្ញាត</div>
        <img src="/3.JPG" class="title-separator" alt="separator" />
      </div>

      <div class="form-content">
        <div class="form-row">
          <div class="form-label">បានអនុញ្ញាតឲ្យ</div>
          <div class="form-separator">:</div>
          <div class="form-value">${esc(request.name)}</div>
        </div>
        <div class="form-row">
          <div class="form-label">មន្ត្រី</div>
          <div class="form-separator">:</div>
          <div class="form-value">ក្របខណ្ឌ</div>
        </div>
        <div class="form-row">
          <div class="form-label">មុខងារជា</div>
          <div class="form-separator">:</div>
          <div class="form-value">${esc(request.position || 'មន្ត្រី')}</div>
        </div>
        <div class="form-row">
          <div class="form-label">បម្រើការនៅ</div>
          <div class="form-separator">:</div>
          <div class="form-value">${esc(request.department || 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត')}</div>
        </div>
        <div class="form-row">
          <div class="form-label">ឈប់សម្រាកការងារចំនួន</div>
          <div class="form-separator">:</div>
          <div class="form-value">
            ${request.amount < 10 ? '០' + request.amount : request.amount} ថ្ងៃ 
            ចាប់ពីថ្ងៃទី ${fmtDate(request.startDate)} ដល់ថ្ងៃទី ${fmtDate(request.endDate)}
          </div>
        </div>
        <div class="form-row">
          <div class="form-label">មូលហេតុ</div>
          <div class="form-separator">:</div>
          <div class="form-value">${esc(request.reason || 'ផ្ទាល់ខ្លួន')}</div>
        </div>
      </div>

      <div class="signature-block">
        <div class="signer-title">នាយកមន្ទីរពេទ្យ</div>
      </div>

      <div class="cc-section">
        <div class="cc-title">ចម្លងជូន:</div>
        <div class="cc-item">- ការិយាល័យបច្ចេកទេស</div>
        <div class="cc-item">- ការិយាល័យគណនេយ្យ</div>
        <div class="cc-item">- ផ្នែកពាក់ព័ន្ធ</div>
        <div class="cc-item">( ដើម្បីជ្រាបជាព័ត៌មាន )</div>
        <div class="cc-item">- សាមីខ្លួន ( អនុវត្ត )</div>
        <div class="cc-item">- ឯកសារ-កាលប្បវត្តិ</div>
      </div>

      <div class="bottom-footer-note">ឆ្នាំ២០២... មិនមានសុំច្បាប់ឈប់សម្រាក។</div>
    </div>
  </div>
</body>
</html>`;
};

// Auth + basic permission guard (reuse attendance/HR view perms)
router.use(authRequired);

// PDF version - Allow owner or admin
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.auth.user;
    const request = await LeaveRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Leave request not found' });

    const norm = (s) => String(s || '').trim().replace(/^0+/, '');
    const isOwner = norm(request.staffId) === norm(requester.staffId);
    const isAdmin = (req.auth.permissions || []).some(p => ['view:hr', 'view:leaveRequests', 'manage:users'].includes(p));

    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('km-KH') : '';
    const html = generateLeaveRequestHtml(request, esc, fmtDate);

    const { htmlToPdfBuffer } = await import('../utils/pdfUtils.js').catch(() => ({}));
    if (!htmlToPdfBuffer) return res.status(500).json({ message: 'PDF engine not available' });

    const buffer = await htmlToPdfBuffer(html, { format: 'A4', printBackground: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Leave_${request.staffId}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Direct Print version (HTML with auto-print script) - Allow owner or admin
router.get('/:id/print', async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.auth.user;
    const request = await LeaveRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Leave request not found' });

    const norm = (s) => String(s || '').trim().replace(/^0+/, '');
    const isOwner = norm(request.staffId) === norm(requester.staffId);
    const isAdmin = (req.auth.permissions || []).some(p => ['view:hr', 'view:leaveRequests', 'manage:users'].includes(p));

    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('km-KH') : '';

    let html = generateLeaveRequestHtml(request, esc, fmtDate);
    html = html.replace('</body>', '<script>window.onload = () => { window.print(); };</script></body>');

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Global guard for other leave management routes (Admin only)
router.use(async (req, res, next) => {
  const perms = req.auth?.permissions || [];
  const isAdmin = perms.includes('Admin') || perms.includes('Administrator') || req.auth?.user?.email === 'admin@hospital.com' || req.auth?.user?.email === 'admin@hospital07.com';
  const hasValidPerm = ['view:leaveRequests', 'view:attendance', 'view:hr', 'view:report.unpaidLeave'].some(p => perms.includes(p));
  const hasDept = !!req.auth?.user?.department;
  
  if (isAdmin || hasValidPerm || hasDept) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
});

// GET /api/leave-requests
// Supports:
//   - from=YYYY-MM-DD & to=YYYY-MM-DD: filter by date/startDate/endDate range
//   - month=YYYY-MM: filter primarily by `months` field month/year (with
//     fallback to date/startDate/endDate for legacy rows)
router.get('/', async (req, res, next) => {
  try {
    const { from, to, month, status } = req.query;
    const filter = {};

    const perms = req.auth?.permissions || [];
    const isAdmin = perms.includes('Admin') || perms.includes('Administrator') || req.auth?.user?.email === 'admin@hospital.com';
    const hasViewPerm = ['view:leaveRequests', 'view:attendance', 'view:hr', 'view:report.unpaidLeave'].some(p => perms.includes(p));
    const hasDept = !!req.auth?.user?.department;

    if (!isAdmin && hasDept) {
      filter.department = req.auth.user.department;
    }

    if (month) {
      let fromDate = null;
      let toDate = null;

      const [yStr, mStr] = String(month).split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (y && m >= 1 && m <= 12) {
        fromDate = new Date(y, m - 1, 1);
        const endOfMonth = new Date(y, m, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        toDate = endOfMonth;
      }

      if (fromDate || toDate) {
        const orFilters = [];

        // Primary filter: Months field falls within the selected month
        const monthsFilter = {};
        if (fromDate) monthsFilter.$gte = fromDate;
        if (toDate) monthsFilter.$lte = toDate;
        orFilters.push({ months: monthsFilter });

        // Ranged leave requests: treat as overlapping interval
        // [startDate, endDate] overlapping with [fromDate, toDate]
        const rangeCond = {};
        if (fromDate) {
          rangeCond.endDate = { $gte: fromDate };
        }
        if (toDate) {
          rangeCond.startDate = Object.prototype.hasOwnProperty.call(rangeCond, 'startDate')
            ? { ...rangeCond.startDate, $lte: toDate }
            : { $lte: toDate };
        }
        if (Object.keys(rangeCond).length) {
          orFilters.push({
            startDate: { $exists: true },
            endDate: { $exists: true },
            ...rangeCond,
          });
        }

        // Legacy single-date requests (no explicit range):
        // filter by the main date field as before
        const singleDateFilter = {};
        if (fromDate) singleDateFilter.$gte = fromDate;
        if (toDate) singleDateFilter.$lte = toDate;
        if (Object.keys(singleDateFilter).length) {
          orFilters.push({
            startDate: { $exists: false },
            endDate: { $exists: false },
            date: singleDateFilter,
          });
        }

        if (orFilters.length === 1) {
          Object.assign(filter, orFilters[0]);
        } else if (orFilters.length > 1) {
          filter.$or = orFilters;
        }
      }
    } else if (from || to) {
      let fromDate = null;
      let toDate = null;

      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) fromDate = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          toDate = d;
        }
      } else if (fromDate) {
        // If 'to' is missing, default to the same day as 'from'
        const d = new Date(fromDate);
        d.setHours(23, 59, 59, 999);
        toDate = d;
      }

      if (fromDate || toDate) {
        const orFilters = [];

        // Overlap logic: 
        // A request [startDate, endDate] overlaps with [fromDate, toDate] if:
        // (startDate <= toDate OR toDate is null) AND (endDate >= fromDate OR fromDate is null)

        // 1. Ranged requests
        const rangeCond = {
          startDate: { $exists: true },
          endDate: { $exists: true }
        };
        if (toDate) rangeCond.startDate = { $lte: toDate };
        if (fromDate) rangeCond.endDate = { $gte: fromDate };
        orFilters.push(rangeCond);

        // 2. Legacy single-date requests
        const singleDateCond = {
          startDate: { $exists: false },
          endDate: { $exists: false }
        };
        const dateRange = {};
        if (fromDate) dateRange.$gte = fromDate;
        if (toDate) dateRange.$lte = toDate;
        if (Object.keys(dateRange).length > 0) {
          singleDateCond.date = dateRange;
        }
        orFilters.push(singleDateCond);

        // 3. Months-based requests (if any fall in this wide range)
        // (Note: usually month is preferred, but this wide filter handles fallback)

        filter.$or = orFilters;
      }
    }

    if (status && status !== 'all') {
      filter.status = { $regex: new RegExp(`^${status}$`, 'i') };
    }

    const rows = await LeaveRequest.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/leave-requests/:id
// Update basic fields (status, amount, type, reason, comment, note, dates, etc.)
router.patch(
  '/:id',
  requireAnyPermission(['approve:hr', 'edit:hr']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const allowed = [
        'status',
        'amount',
        'type',
        'reason',
        'comment',
        'note',
        'date',
        'months',
        'startDate',
        'endDate',
        'requestedAt',
        'approvedAt',
        'manager',
        'department',
        'name',
        'staffId',
      ];
      const update = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          update[key] = req.body[key];
        }
      }

      if (update.date) {
        const d = new Date(update.date);
        if (!Number.isNaN(d.getTime())) update.date = d;
        else delete update.date;
      }
      if (update.months) {
        const d = new Date(update.months);
        if (!Number.isNaN(d.getTime())) update.months = d;
        else delete update.months;
      }
      if (update.startDate) {
        const d = new Date(update.startDate);
        if (!Number.isNaN(d.getTime())) update.startDate = d;
        else delete update.startDate;
      }
      if (update.endDate) {
        const d = new Date(update.endDate);
        if (!Number.isNaN(d.getTime())) update.endDate = d;
        else delete update.endDate;
      }
      if (update.requestedAt) {
        const d = new Date(update.requestedAt);
        if (!Number.isNaN(d.getTime())) update.requestedAt = d;
        else delete update.requestedAt;
      }
      if (update.approvedAt) {
        const d = new Date(update.approvedAt);
        if (!Number.isNaN(d.getTime())) update.approvedAt = d;
        else delete update.approvedAt;
      }

      // Keep legacy date in sync with startDate when provided
      if (!update.date && update.startDate) {
        update.date = update.startDate;
      }

      // If approving and no approvedAt provided, set now
      if (update.status === 'approved' && !update.approvedAt) {
        update.approvedAt = new Date();
      }

      const doc = await LeaveRequest.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true }
      ).lean();
      if (!doc) return res.status(404).json({ message: 'Leave request not found' });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/leave-requests/:id
router.delete(
  '/:id',
  requireAnyPermission(['approve:hr', 'edit:hr']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const doc = await LeaveRequest.findByIdAndDelete(id).lean();
      if (!doc) return res.status(404).json({ message: 'Leave request not found' });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/leave-requests/range-delete/clear
router.delete(
  '/range/clear',
  requireAnyPermission(['approve:hr', 'edit:hr']),
  async (req, res, next) => {
    try {
      const { from, to } = req.query;
      if (!from && !to) {
        return res.status(400).json({ message: 'From or To date required' });
      }

      const filter = {};
      let fromDate = null;
      let toDate = null;

      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) fromDate = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          toDate = d;
        }
      }

      if (fromDate || toDate) {
        const orFilters = [];

        // 1. Ranged requests overlapping with [fromDate, toDate]
        const rangeCond = {
          startDate: { $exists: true },
          endDate: { $exists: true }
        };
        if (toDate) rangeCond.startDate = { $lte: toDate };
        if (fromDate) rangeCond.endDate = { $gte: fromDate };
        orFilters.push(rangeCond);

        // 2. Legacy single-date requests
        const singleDateCond = {
          startDate: { $exists: false },
          endDate: { $exists: false }
        };
        const dateRange = {};
        if (fromDate) dateRange.$gte = fromDate;
        if (toDate) dateRange.$lte = toDate;
        if (Object.keys(dateRange).length > 0) {
          singleDateCond.date = dateRange;
        }
        orFilters.push(singleDateCond);

        filter.$or = orFilters;
      }

      const result = await LeaveRequest.deleteMany(filter);
      res.json({ ok: true, deletedCount: result.deletedCount });
    } catch (err) {
      next(err);
    }
  }
);
/**
 * Helper to parse date strings (e.g., "01 Apr 2026", "01 Apr 2026 - 03 Apr 2026")
 */
const parseDateRangeOrSingle = (v) => {
  if (!v) return { start: null, end: null };
  let s = String(v).trim();
  const pipeIdx = s.indexOf('|');
  if (pipeIdx !== -1) s = s.slice(0, pipeIdx).trim();
  s = s.replace(/\s+/g, ' ');

  if (s.includes('-')) {
    const yearMatch = s.match(/(\d{4})\b/);
    const year = yearMatch ? yearMatch[1] : null;
    const parts = s.split('-');
    if (parts.length >= 2) {
      let left = parts[0].trim();
      let right = parts.slice(1).join('-').trim();
      if (year) {
        if (!/(\d{4})\b/.test(left)) left = `${left} ${year}`;
        if (!/(\d{4})\b/.test(right)) right = `${right} ${year}`;
      }
      const start = new Date(left);
      const end = new Date(right);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) return { start, end };
    }
  }
  const d = new Date(s);
  return !isNaN(d.getTime()) ? { start: d, end: d } : { start: null, end: null };
};

/**
 * Shared helper to process and save leave items to database
 */
async function processSyncItems(items) {
  console.log(`[Sync] Starting to process ${items.length} items...`);
  const results = { imported: 0, matched: 0, unmatched: [], errors: [] };
  const ops = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rawName = String(item.name || '').trim();
    if (!rawName) continue;

    if (i % 20 === 0) console.log(`[Sync] Processing item ${i}/${items.length}...`);

    let staffId = item.staffId;
    if (staffId) {
      results.matched++;
      console.log(`[Sync] Direct Match (via Scraper ID): "${rawName}" -> StaffID: ${staffId}`);
    } else {
      // Normalize name: collapse multiple spaces and trim
      const cleanName = rawName.replace(/\s+/g, ' ').trim();

      // Create a flexible regex that allows one or more spaces between words
      // e.g., "DAM SREYTOUCH" -> /^DAM\s+SREYTOUCH$/i
      const flexiblePattern = cleanName
        .split(' ')
        .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escaping regex chars
        .join('\\s+');
      const nameRegex = new RegExp(`^${flexiblePattern}$`, 'i');

      const emp = await Employee.findOne({
        $or: [
          { name: { $regex: nameRegex } },
          { khmerName: { $regex: nameRegex } },
          { nameLatin: { $regex: nameRegex } },
          { fullName: { $regex: nameRegex } }
        ]
      }).select('staffId no name khmerName').lean();

      if (emp) {
        staffId = emp.staffId || emp.no;
        results.matched++;
        console.log(`[Sync] Name Match: "${cleanName}" -> StaffID: ${staffId} (${emp.name || emp.khmerName})`);
      } else {
        console.warn(`[Sync] UNMATCHED name: "${cleanName}" (original: "${rawName}")`);
      }
    }

    if (!staffId) {
      results.unmatched.push(rawName);
      results.errors.push({ name: rawName, error: 'Could not find Staff ID for name' });
      continue;
    }

    let startDate = null, endDate = null;

    // 1. Try scraper-provided fields
    if (item.startDate) {
      const d1 = new Date(item.startDate);
      if (!isNaN(d1.getTime())) startDate = d1;
    }
    if (item.endDate) {
      const d2 = new Date(item.endDate);
      if (!isNaN(d2.getTime())) endDate = d2;
    }

    // 2. Fallback to generic parsing if scraper failed or fields missing
    if (!startDate) {
      const { start, end } = parseDateRangeOrSingle(item.date || item.dateRange || item.rawDate || '');
      startDate = start; endDate = end;
    }

    if (!startDate) {
      results.errors.push({ name: rawName, error: `Invalid date: ${item.date || item.dateRange}` });
      continue;
    }

    let amount = item.amount;
    if (typeof amount === 'string') {
      const m = amount.match(/(\d+(?:\.\d+)?)/);
      if (m) amount = Number(m[1]);
    }
    const amountVal = Number(amount) || 1;

    // If we only have a start date or the range is 1 day, but amount is > 1
    // Calculate proper endDate based on amount
    if (!endDate || endDate.getTime() === startDate.getTime()) {
      if (amountVal >= 1) {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + Math.floor(amountVal) - 1);
      } else {
        endDate = startDate;
      }
    }
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const doc = {
      staffId,
      checkinmeId: item.checkinmeId || null,
      name: rawName,
      manager: item.manager || '',
      department: item.department || '',
      date: startDate,
      startDate,
      endDate: endDate || startDate,
      amount: amountVal,
      type: item.type || item.leaveType || '',
      reason: item.reason || '',
      status: item.status || 'approved',
      comment: item.comment || '',
      requestedAt: new Date(),
    };

    // Use a robust filter to prevent overwriting multiple requests on the same day
    // Robust filter: match by ID or (staffId + date + type)
    const syncFilter = {
      $or: [
        { staffId: doc.staffId, startDate: doc.startDate, type: doc.type }
      ]
    };
    if (doc.checkinmeId) {
      syncFilter.$or.unshift({ checkinmeId: doc.checkinmeId });
    }

    ops.push({
      updateOne: {
        filter: syncFilter,
        update: { $set: doc },
        upsert: true
      }
    });
  }

  if (ops.length > 0) {
    const bulkRes = await LeaveRequest.bulkWrite(ops, { ordered: false });
    results.imported = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0) + (bulkRes.matchedCount || 0);
  }

  return results;
}

// POST /api/leave-requests/auto-sync-checkinme
router.post('/auto-sync-checkinme', async (req, res, next) => {
  try {
    const { from, to } = req.body || {};
    // Call service to scrape data from Checkinme backend
    const items = await scrapeCheckinmeLeaves({ fromDate: from, toDate: to });

    if (!items || items.length === 0) {
      return res.json({ ok: true, message: 'No records found on Checkinme', results: { imported: 0 } });
    }

    const results = await processSyncItems(items);
    res.json({ ok: true, results });
  } catch (err) {
    next(err);
  }
});

// POST /api/leave-requests/bulk-sync
// Payload: { items: [ { name, dateRange, amount, reason, ... } ] }
router.post('/bulk-sync', async (req, res, next) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }
    const results = await processSyncItems(items);
    res.json({ ok: true, results });
  } catch (err) {
    next(err);
  }
});

// PDF version
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const request = await LeaveRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Leave request not found' });

    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('km-KH') : '';
    const html = generateLeaveRequestHtml(request, esc, fmtDate);

    // Import this here to avoid circular dependencies or if not globally available
    const { htmlToPdfBuffer } = await import('../utils/pdfUtils.js').catch(() => ({}));
    if (!htmlToPdfBuffer) return res.status(500).json({ message: 'PDF engine not available' });

    const buffer = await htmlToPdfBuffer(html, { format: 'A4', printBackground: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Leave_${request.staffId}.pdf"`);
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Direct Print version (HTML with auto-print script)
router.get('/:id/print', async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query; // Check token from query if window.open used
    // Simple verification if token needed, but the router already has authRequired middleware

    const request = await LeaveRequest.findById(id);
    if (!request) return res.status(404).json({ message: 'Leave request not found' });

    const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('km-KH') : '';

    let html = generateLeaveRequestHtml(request, esc, fmtDate);
    html = html.replace('</body>', '<script>window.onload = () => { window.print(); };</script></body>');

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
