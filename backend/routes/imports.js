import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import XLSX from 'xlsx';

const router = express.Router();

// Multer storage (store uploads in public/Uploads/tmp)
const uploadDir = path.join(process.cwd(), 'public', 'Uploads', 'tmp');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname}`.replace(/\s+/g, '-');
    cb(null, name);
  }
});
const upload = multer({ storage });

// POST /api/imports/attendance?date=YYYY-MM-DD
// Accepts an Excel (.xlsx/.xls) or CSV file in field 'file'
router.post('/api/imports/attendance', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  const providedDate = req.query.date; // optional
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // prefer object parsing, but allow reparsing if the header detection failed
    let rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // If parsing produced no rows or headers look like combined header+value (e.g. "Staff ID E001"),
    // attempt a stronger reparse using header:1 to recover headers and rows.
    const looksLikeCombinedHeader = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      // check if any key contains digits or time-like patterns which usually indicate a header+value merge
      return Object.keys(arr[0] || {}).some(k => /\d|\d{1,2}:\d{2}/.test(String(k)));
    };

    if (!rows || rows.length === 0 || looksLikeCombinedHeader(rows)) {
      try {
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (raw && raw.length) {
          // find header row index by looking for common header keywords
          let headerIdx = raw.findIndex(r => Array.isArray(r) && r.some(c => /Staff ID|staff id|លេខកាត|card|Card/i.test(String(c||''))));
          if (headerIdx === -1) headerIdx = 0;

          // detect whether there are 2 header rows (improved heuristic)
          let headerRowsCount = 1;
          const nextRow = raw[headerIdx + 1];
          if (Array.isArray(nextRow)) {
            const nonEmpty = nextRow.filter(c => String(c||'').trim() !== '').length;
            if (nonEmpty >= 3) {
              const headerLikeCount = nextRow.filter(c => {
                const s = String(c||'').trim();
                if (!s) return false;
                if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(s)) return false; // time-like
                if (/^[\d\-\/\.]+$/.test(s)) return false; // pure numbers/dates
                return /[A-Za-z\u1780-\u17FF]/.test(s);
              }).length;
              if (headerLikeCount >= Math.ceil(nonEmpty * 0.75)) headerRowsCount = 2;
            }
          }

          const maxCols = Math.max(...raw.slice(headerIdx, headerIdx + headerRowsCount).map(r => (Array.isArray(r) ? r.length : 0)));
          const headers = [];
          for (let c = 0; c < maxCols; c++) {
            const parts = [];
            for (let r = 0; r < headerRowsCount; r++) {
              const v = raw[headerIdx + r] && raw[headerIdx + r][c] ? String(raw[headerIdx + r][c]).trim() : '';
              if (v) parts.push(v);
            }
            headers.push(parts.join(' ').trim() || `col${c}`);
          }

          let dataRows = raw.slice(headerIdx + headerRowsCount);

          // If headers themselves contain embedded values (e.g. "Staff ID E001")
          // treat that as the first data row and split header names out.
          const headerContainsValue = headers.some(h => /\d|\d{1,2}:\d{2}/.test(String(h)));
          if (headerContainsValue) {
            // split headers into label + value when possible
            const splitLabels = [];
            const firstRowValues = [];
            let foundAny = false;
            for (let i = 0; i < headers.length; i++) {
              const h = String(headers[i] || '');
              // prefer known header prefixes (longest match)
              const candidates = ['staff id','staff','card','name','check in','check out','checkin','checkout','status','note','notes','លេខកាត','ចូល','ចេញ'];
              candidates.sort((a,b) => b.length - a.length);
              const lower = h.toLowerCase();
              let matched = null;
              for (const c of candidates) { if (lower.startsWith(c)) { matched = c; break; } }
              if (matched) {
                const label = h.substring(0, matched.length).trim();
                const value = h.substring(matched.length).trim();
                splitLabels.push(label || matched);
                firstRowValues.push(value);
                if (value) foundAny = true;
              } else {
                // fallback: split by last space
                const m = h.match(/^(.*\S)\s+(\S.*)$/);
                if (m) {
                  splitLabels.push(m[1].trim());
                  firstRowValues.push(m[2]);
                  foundAny = true;
                } else {
                  splitLabels.push(h);
                  firstRowValues.push('');
                }
              }
            }
            if (foundAny) {
              // use splitLabels as headers and prepend firstRowValues as the first data row
              headers.splice(0, headers.length, ...splitLabels);
              dataRows = [firstRowValues, ...dataRows];
            }
          }

          const objs = dataRows.map(r => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = r && r[i] !== undefined ? r[i] : ''; });
            return obj;
          }).filter(o => Object.keys(o).length > 0);

          if (objs.length > 0) {
            rows = objs;
          }
        }
      } catch (e) {
        // if reparsing fails, keep original rows (empty) and proceed to report errors later
        console.warn('Reparse of sheet failed', e && e.message);
      }
    }

  const results = { imported: 0, skipped: 0, errors: [] };
  // detailed per-row report used for dry-run or debugging
  results.details = [];

    const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Normalize a string for matching: trim, lowercase, collapse spaces, remove punctuation
  const normalize = (s) => {
      if (!s && s !== 0) return '';
      let t = String(s).trim();
      // NFD + remove combining marks (handles many latin accents)
      try { t = t.normalize && t.normalize('NFD').replace(/\p{M}/gu, ''); } catch (e) {}
      t = t.replace(/[\u200B-\u200D\uFEFF]/g, ''); // invisible
      t = t.replace(/[\p{P}\p{S}]/gu, ' '); // punctuation & symbols -> space
      t = t.replace(/\s+/g, ' ');
      return t.toLowerCase();
  };

    const getCell = (r, keys) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).toString().trim() !== '') return String(r[k]).toString().trim();
      }
      return '';
    };

    // helper to parse Excel serial date numbers produced by some exports
    const parseExcelDate = (v) => {
      if (typeof v === 'number') {
        // xlsx exposes parse_date_code on SSF
        try {
          const d = XLSX.SSF.parse_date_code(v);
          if (d && d.y) return new Date(d.y, d.m - 1, d.d);
        } catch (e) {
          // fallback
          return new Date(Math.round((v - 25569) * 86400 * 1000));
        }
      }
      // try ISO or common dd/mm/yyyy
      if (typeof v === 'string') {
        const s = v.trim();
        // dd/mm/yyyy or dd-mm-yyyy
        const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m1) {
          const day = Number(m1[1]), month = Number(m1[2]) - 1, year = Number(m1[3]);
          return new Date(year < 100 ? 2000 + year : year, month, day);
        }
        const iso = new Date(s);
        if (!isNaN(iso.getTime())) return iso;
      }
      return null;
    };

    // helper: given a date object and a time string like '08:05' or '08:05:00',
    // return an ISO timestamp string combining the date and time. If parsing fails, return original string.
    const timeToIso = (dateObj, t) => {
      if (!t && t !== 0) return '';
      if (typeof t === 'number') {
        // Excel may encode time as fraction of day (e.g., 0.5 = 12:00)
        try {
          const seconds = Math.round(24 * 3600 * t);
          const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
          d.setSeconds(seconds);
          return d.toISOString();
        } catch (e) { return String(t); }
      }
      const s = String(t).trim();
      // If already ISO-like
      const maybe = new Date(s);
      if (!isNaN(maybe.getTime())) return maybe.toISOString();
      // Try HH:mm or HH:mm:ss
      const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (m) {
        const hh = Number(m[1]); const mm = Number(m[2]); const ss = Number(m[3] || 0);
        const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hh, mm, ss);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      // try dd/mm/yyyy hh:mm patterns
      const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ ,T]+(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (dm) {
        const dParsed = parseExcelDate(dm[1] + '/' + dm[2] + '/' + dm[3]);
        if (dParsed) {
          const timePart = dm[4];
          const m2 = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
          if (m2) {
            const d2 = new Date(dParsed.getFullYear(), dParsed.getMonth(), dParsed.getDate(), Number(m2[1]), Number(m2[2]), Number(m2[3]||0));
            if (!isNaN(d2.getTime())) return d2.toISOString();
          }
        }
      }
      return s;
    };

    const ops = [];
    const rowMeta = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Common header guesses: Staff ID, Name, Check in - Check out, Count, Work Time, Absent, Leave
  const staffIdRaw = getCell(row, ['Staff ID', 'StaffID', 'Staff', 'staffId', 'staff id', 'employee id', 'EmployeeID', 'លេខកាត', 'លេខបុគ្គលិក', 'card', 'Card']);
    let staffId = staffIdRaw;
  const name = getCell(row, ['Name', 'name', 'Full Name', 'fullName', 'គោត្តនាម និងនាម', 'នាម', 'ឈ្មោះ', 'Employee Name']);

      // Try to get the main checkin/checkout and secondary ones
  const checkin1 = getCell(row, ['Checkin', 'Check In', 'Checkin ', 'Check in', 'Checkin-1', 'Checkin 1', 'ចូល', 'ចូល ១', 'Time In']);
  const checkout1 = getCell(row, ['Checkout', 'Check Out', 'Checkout ', 'Check out', 'Checkout-1', 'Checkout 1', 'ចេញ', 'ចេញ ១']);
  const status1 = getCell(row, ['Status', 'Status1', 'Status 1', 'Status ', 'ស្ថានភាព', 'ស្ថានភាពចូល', 'ស្ថានភាពចេញ']);
  const checkin2 = getCell(row, ['Checkin-2', 'Checkin 2', 'Checkin2', 'Checkin_2', 'ចូល២', 'ចូល ២']);
  const checkout2 = getCell(row, ['Checkout-2', 'Checkout 2', 'Checkout2', 'Checkout_2', 'ចេញ២', 'ចេញ ២']);
  const status2 = getCell(row, ['Status2', 'Status 2', 'ស្ថានភាព២', 'ស្ថានភាព ២']);
  const noteCol = getCell(row, ['Note', 'Notes', 'note', 'កំណត់សម្គាល់', 'សំគាល់']);

      // If no staffId provided, try to lookup by name
      if (!staffId && name) {
        try {
          // first try exact match on name or khmerName
          let emp = await Employee.findOne({
            $or: [
              { name: new RegExp(`^${escapeReg(name)}$`, 'i') },
              { khmerName: new RegExp(`^${escapeReg(name)}$`, 'i') }
            ]
          }).lean();
          if (!emp) {
            // try fuzzy: normalize tokens and query a small shortlist of candidates
            const nName = normalize(name);
            const tokens = nName.split(/\s+/).filter(Boolean).map(t => escapeReg(t));
            if (tokens.length > 0) {
              const firstToken = tokens[0];
              // find a shortlist of employees containing the first token (either english or khmer name)
              const candidates = await Employee.find({
                $or: [ { name: new RegExp(firstToken, 'i') }, { khmerName: new RegExp(firstToken, 'i') } ]
              }).limit(200).lean();

              // small helper: levenshtein distance -> similarity
              const levenshtein = (a, b) => {
                if (!a) return b ? b.length : 0;
                if (!b) return a.length;
                const m = a.length, n = b.length;
                const d = Array.from({length: m+1}, (_,i)=>Array(n+1).fill(0));
                for (let i=0;i<=m;i++) d[i][0]=i;
                for (let j=0;j<=n;j++) d[0][j]=j;
                for (let i=1;i<=m;i++){
                  for (let j=1;j<=n;j++){
                    const cost = a[i-1] === b[j-1] ? 0 : 1;
                    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+cost);
                  }
                }
                return d[m][n];
              };
              const similarity = (a,b) => {
                if (!a && !b) return 1;
                const aa = String(a||''); const bb = String(b||'');
                const dist = levenshtein(aa, bb);
                const maxL = Math.max(aa.length, bb.length) || 1;
                return 1 - (dist / maxL);
              };

              let best = null; let bestScore = 0;
              for (const c of candidates) {
                const cn = normalize(c.name || '');
                const ck = normalize(c.khmerName || '');
                const s1 = cn ? similarity(cn, nName) : 0;
                const s2 = ck ? similarity(ck, nName) : 0;
                const s = Math.max(s1, s2);
                if (s > bestScore) { bestScore = s; best = c; }
              }
              // accept match if similarity >= 0.55 (heuristic)
              if (!emp && best && bestScore >= 0.55) emp = best;
            }
          }
          if (emp && emp.staffId) staffId = emp.staffId;
        } catch (e) {
          // lookup error — continue without staffId
          console.warn('Employee lookup failed for', name, e.message);
        }
      }

      // If still no staffId, try other heuristic columns that might contain card or id
      if (!staffId) {
        const altId = getCell(row, ['Card', 'card', 'No', 'NO', 'លេខ', 'លេខកាត', 'Card No', 'CardNumber', 'card number', 'card_number']);
        if (altId) {
          // try find employee by cardNumber or officerId or nid
          try {
            const e = await Employee.findOne({ $or: [ { cardNumber: altId }, { officerId: altId }, { nid: altId }, { staffId: altId } ] }).lean();
            if (e && e.staffId) staffId = e.staffId;
            else staffId = altId;
          } catch (e) {
            staffId = altId;
          }
        }
      }

      if (!staffId) {
        // if dryRun, include suggestion if a best fuzzy candidate exists
        results.skipped++;
        const msg = `Missing staffId and no matching employee for name: ${name}`;
        results.errors.push({ row: i + 2, message: msg, rowData: row });
        results.details.push({ row: i + 2, status: 'missing_staff', message: msg, rowData: row });
        continue;
      }

  // Determine date: prefer providedDate, then try column 'Date' (including Excel serial), otherwise today
  let dateVal = providedDate || row['Date'] || row['date'] || row['Day'] || row['ថ្ងៃ'] || '';
  let dateObj = null;
  const parsed = parseExcelDate(dateVal);
  if (parsed) dateObj = parsed;
  else dateObj = providedDate ? new Date(providedDate) : (row['Date'] ? new Date(row['Date']) : new Date());
  if (isNaN(dateObj.getTime())) dateObj = new Date();

  // Choose primary times: prefer first pair, otherwise use second
  let inTime = checkin1 || checkin2 || '';
  let outTime = checkout1 || checkout2 || '';

  // also prepare ISO checkIn/checkOut fields combining date and time when possible
  const checkInIso = inTime ? timeToIso(dateObj, inTime) : '';
  const checkOutIso = outTime ? timeToIso(dateObj, outTime) : '';
  const checkIn2Iso = checkin2 ? timeToIso(dateObj, checkin2) : '';
  const checkOut2Iso = checkout2 ? timeToIso(dateObj, checkout2) : '';

      // Determine status: map Good->present, Late->late, Early->present (but mark leftEarly)
      let status = 'present';
      let isLate = false;
      let leftEarly = false;
      const checkStatus = (s) => (s || '').toString().toLowerCase();
      const s1 = checkStatus(status1);
      const s2 = checkStatus(status2);
      if (s1.includes('late') || s2.includes('late')) { status = 'late'; isLate = true; }
      if (s1.includes('absent') || s2.includes('absent')) { status = 'absent'; }
      if (s1.includes('leave') || s2.includes('leave')) { status = 'leave'; }
      if (s1.includes('early') || s2.includes('early')) { leftEarly = true; }

      // Build attendance doc (persist status1/status2 separately for clarity)
      const doc = {
        staffId,
        date: dateObj,
        status,
        // keep legacy string fields
        inTime: inTime || '',
        outTime: outTime || '',
        // also provide fields the frontend expects (ISO timestamps)
        checkIn: checkInIso || '',
        checkOut: checkOutIso || '',
        checkIn2: checkIn2Iso || '',
        checkOut2: checkOut2Iso || '',
        isLate,
        leftEarly,
        status1: status1 || '',
        status2: status2 || '',
        notes: [name || '', noteCol || ''].filter(Boolean).join(' | ')
      };

      // if dry-run, collect the doc preview and skip DB write
      if (dryRun) {
        results.details.push({ row: i + 2, status: 'ok', doc });
        results.imported = results.imported + 1;
        continue;
      }

      // prepare bulk op
      ops.push({
        updateOne: {
          filter: { staffId: doc.staffId, date: doc.date },
          update: { $set: doc },
          upsert: true
        }
      });
      // keep mapping to report any per-row errors later if needed
      rowMeta.push({ rowIndex: i + 2, staffId: doc.staffId });
    }
    // If dryRun requested, skip actual DB write and return details
    if (dryRun) {
      // don't perform writes
      return res.json({ ok: true, results });
    }

    // Execute bulk write in batches to avoid extremely large single operations
    try {
      const BATCH = 1000;
      let processed = 0;
      for (let i = 0; i < ops.length; i += BATCH) {
        const batch = ops.slice(i, i + BATCH);
        const r = await Attendance.bulkWrite(batch, { ordered: false });
        // r may contain upsertedCount or nUpserted depending on driver
        processed += batch.length;
      }
      results.imported = processed;
    } catch (err) {
      // Bulk write may throw with partial results; try to extract info
      if (err && err.result && typeof err.result.nInserted === 'number') {
        results.imported = err.result.nInserted || 0;
      }
      results.errors.push({ message: err.message });
    }

    // Remove uploaded file
    try { fs.unlinkSync(filePath); } catch (e) {}

    return res.json({ ok: true, results });
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (e) {}
    console.error('Import error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
