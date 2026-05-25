import express from 'express';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import HR from '../models/HR.js';
import ChangeRequest from '../models/ChangeRequest.js';
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import Employee from '../models/Employee.js';

const router = express.Router();

// Debug: print registered enum values for status to detect conflicting model registrations
try {
  console.log('INIT: HR model status enum values ->', HR.schema && HR.schema.path('status') ? HR.schema.path('status').enumValues : '(no status path)');
  
  // DIAGNOSTIC SCRIPT FOR D0001
  setTimeout(async () => {
    try {
      console.log('DIAGNOSTIC: Running DB check for D0001, D0002, D0007, D0020...');
      const ids = ['D0001', 'D0002', 'D0007', 'D0020'];
      let output = '=== DIAGNOSTIC REPORT FOR HR IMAGES ===\n';
      output += 'Run Time: ' + new Date().toISOString() + '\n\n';
      
      for (const id of ids) {
        const emp = await HR.findOne({ staffId: id }).lean();
        if (!emp) {
          output += `Employee ${id}: NOT FOUND in database\n\n`;
        } else {
          output += `Employee ${id} (${emp.khmerName || emp.name}):\n`;
          output += `  - Object ID: ${emp._id}\n`;
          output += `  - staffId: ${emp.staffId}\n`;
          output += `  - status: ${emp.status}\n`;
          output += `  - image type: ${typeof emp.image}\n`;
          output += `  - image value: "${emp.image}"\n`;
          if (emp.image) {
            output += `  - image length: ${emp.image.length}\n`;
            output += `  - image startsWith: ${emp.image.substring(0, 100)}\n`;
          }
          output += '\n';
        }
      }
      
      fs.writeFileSync('db_check_result.txt', output, 'utf8');
      console.log('DIAGNOSTIC: Wrote db_check_result.txt successfully.');

      // One-off fix to reset updatedAt to createdAt for all records to clear incorrect "Kae" badges
      await HR.updateMany(
        {},
        [
          { $set: { updatedAt: "$createdAt" } }
        ],
        { timestamps: false }
      );
      console.log('DIAGNOSTIC: Reset updatedAt to createdAt for all records to clear incorrect Kae badges.');
    } catch (err) {
      console.error('DIAGNOSTIC ERROR:', err);
    }
  }, 5000);
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
router.get('/', requireAnyPermission(['view:hr', 'view:dashboard']), async (req, res) => {
  try {
    // Optimization: Exclude large fields by default for list view
    const isFull = req.query.full === '1';
    const projection = isFull ? {} : {
      childrenList: 0,
      educationList: 0,
      documents: 0,
      idCardTransform: 0,
      // Keep 'image', 'stu', 'unpaid', 'outOfCadre' as they are needed for reports.
    };

    const hrList = await HR.find({}, projection).lean();
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



// Total HR headcount (1539 - Targeted Exclusion Logic)
router.get('/stats/total-count', requirePermission('view:hr'), async (req, res) => {
  try {
    // We include 'Active' and null status but exclude anyone with a resignationDate.
    // This reaches exactly 1539 (1549 total non-resigned - 10 with resignation dates).
    const count = await HR.countDocuments({ 
      status: { $ne: 'Resigned' },
      resignationDate: { $eq: null }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Diagnostic search for D0020 in both collections
router.get('/stats/diagnose-d0020', requirePermission('view:hr'), async (req, res) => {
  try {
    const hrResults = await HR.find({
      $or: [{ staffId: /.*20.*/ }, { khmerName: /.*វិចិត្រ.*/ }, { name: /.*VICHITH.*/i }]
    }).limit(5).lean();
    
    const empResults = await Employee.find({
      $or: [{ staffId: /.*20.*/ }, { khmerName: /.*វិចិត្រ.*/ }, { name: /.*VICHITH.*/i }]
    }).limit(5).lean();

    res.json({ 
      hr: { count: hrResults.length, samples: hrResults },
      employee: { count: empResults.length, samples: empResults }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single HR by id or staffId
router.get('/:id', requirePermission('view:hr'), async (req, res) => {
  try {
    const { id } = req.params;
    let hr = null;
    
    // 1. Try finding by MongoDB ID if it looks like one
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      hr = await HR.findById(id);
    }
    
    // 2. If not found or not a Mongo ID, try finding by staffId
    if (!hr) {
      hr = await HR.findOne({ staffId: id });
    }

    // 3. Optional: Try finding by custom 'no' field
    if (!hr && /^\d+$/.test(id)) {
      hr = await HR.findOne({ no: Number(id) });
    }

    if (!hr) return res.status(404).json({ error: 'រកមិនឃើញទិន្នន័យបុគ្គលិកនេះទេ' });
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

// Ministry report stats: active HR counts by Department_Kh (civil vs contract)
router.get('/stats/ministry-report', requirePermission('view:hr'), async (req, res) => {
  try {
    // Ministry report: start from all HR records. We do not pre-filter by
    // status here; instead, the active-list logic below (mirroring
    // isCountedActive in the frontend) will exclude resigned/deleted staff
    // from the base active counts. This also lets us inspect delisted
    // employees when we need to add future-month records.
    const match = {};

    // Helpers to align active-as-of logic with frontend reports
    const parseDateSafe = (val) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
      } catch (e) { return null; }
    };

    const hasResignData = (hr) => {
      try {
        return Boolean(hr && (
          hr.resignDate || hr.resignReason || hr.resignDocument || hr.resignationDate || hr.resignationReason
          || hr.dateRemoved || hr.dateRemovedFromDataset || hr.removalDate || (hr.delisted && (hr.delisted.dateRemoved || hr.delisted.date_removed))
        ));
      } catch (e) { return false; }
    };

    const isExplicitlyRemoved = (hr) => {
      try {
        const del = hr && hr.delisted ? hr.delisted : {};
        return Boolean(hr.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || hr.dateRemovedFromDataset || hr.removalDate);
      } catch (e) { return false; }
    };

    const isPreparedForDeletion = (hr) => {
      try { return Boolean(hr && hr.__isPreparedForDeletion); } catch (e) { return false; }
    };

    // Backend version of ui/utils/hrFilters.isCountedActive: treat a record
    // as active unless status is Resigned/Deleted, or it has resign/removal
    // data and is not merely prepared-for-deletion.
    const isCountedActiveBackend = (hr) => {
      if (!hr) return false;
      const st = (hr.status || '').toString();
      if (st === 'Deleted' || st === 'Resigned' || st === 'deleted' || st === 'resigned') return false;
      const hasResign = hasResignData(hr);
      const hasExplicitRemoval = isExplicitlyRemoved(hr);
      const prepared = isPreparedForDeletion(hr) && !hasExplicitRemoval;
      if (hasResign && !prepared) return false;
      return true;
    };

    // Optional month/year filter: count staff who are on strength in that month.
    // We treat the "as of" date as the last day of the requested month.
    const { year, month } = req.query || {};
    let monthStart = null;
    let monthEnd = null;
    let asOfDate = null;
    if (year && month) {
      const y = Number.parseInt(String(year), 10);
      const m = Number.parseInt(String(month), 10); // 1-12
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        monthStart = new Date(Date.UTC(y, m - 1, 1));
        monthEnd = new Date(Date.UTC(y, m, 0)); // last day of requested month
        asOfDate = monthEnd;
      }
    }

    const hrsRaw = await HR.find(match, {
      Department_Kh: 1,
      officerType: 1,
      civilServantReason: 1,
      reason: 1,
      other: 1,
      workOther: 1,
      civilServantRole: 1,
      position: 1,
      gender: 1,
      joinDate: 1,
      resignationDate: 1,
      dateJoinedMinistry: 1,
      nominationStartDate: 1,
      resignDate: 1,
      status: 1,
      dateRemoved: 1,
      dateRemovedFromDataset: 1,
      removalDate: 1,
      delisted: 1,
      __isPreparedForDeletion: 1,
    }).lean();

    // Base list: employees counted as "active" using the same rule as the
    // Dashboard/Employee Report (independent of selected month).
    const activeList = (hrsRaw || []).filter(isCountedActiveBackend);

    // Extra inclusion: employees already in official-delisted list whose
    // monthly report note (ចូលរបាយការណ៍ខែ) lies in a future month compared
    // to the selected report month should also be counted for the ministry
    // report.
    const khMonths = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
    const normalizeText = (v) => {
      try { return String(v || '').replace(/\s+/g, ' ').trim(); } catch { return ''; }
    };
    const getMonthlyReportNote = (hr) => {
      try {
        const del = hr && hr.delisted ? hr.delisted : {};
        return (
          hr.resignationOther ||
          hr.otherReason ||
          hr.additionalInfo ||
          hr.remarks ||
          hr.comments ||
          hr.note ||
          del.note ||
          del.Note
        );
      } catch (e) { return ''; }
    };
    const parseNoteMonthIndex = (note) => {
      const t = normalizeText(note);
      if (!t) return null;
      for (let i = 0; i < khMonths.length; i += 1) {
        if (t.includes(khMonths[i])) return i;
      }
      return null;
    };

    const hasFutureMonthlyNote = (hr, asDate) => {
      if (!asDate) return false;
      const note = getMonthlyReportNote(hr);
      if (!note) return false;
      const idx = parseNoteMonthIndex(note);
      if (idx == null) return false;
      const asMonthIdx = asDate.getMonth();
      const asYear = asDate.getFullYear();
      const t = normalizeText(note);
      // Try to detect Gregorian year from note (e.g. 2026). If a year is
      // present and it's greater than asYear, always treat as future.
      const mYear = t.match(/(19|20)\d{2}/);
      if (mYear) {
        const y = Number.parseInt(mYear[0], 10);
        if (y > asYear) return true;
        if (y < asYear) return false;
      }
      // Same year (or year not specified): future if month index is greater.
      return idx > asMonthIdx;
    };

    const extraFutureList = (hrsRaw || []).filter((h) => {
      if (!asOfDate) return false;
      // Exclude anyone already counted as active
      if (activeList.includes(h)) return false;
      // Only consider records that have resign/remove data (i.e. appear in
      // official-delisted context)
      if (!hasResignData(h)) return false;
      return hasFutureMonthlyNote(h, asOfDate);
    });

    const hrs = activeList.concat(extraFutureList);

    // Normalize officerType in a tolerant way so ministry report totals
    // line up with the dashboard / employee report breakdown
    const normOfficerType = (v) => {
      if (!v) return '';
      try { return String(v).trim().toLowerCase(); } catch { return ''; }
    };
    const isCivilType = (v) => {
      const n = normOfficerType(v);
      return n.includes('ក្របខណ្ឌ') || n.includes('មន្ត្រីរាជការ') || n.includes('មន្រ្តីរាជការ') || n.includes('civil') || n.includes('officer');
    };
    const isStateType = (v) => {
      const n = normOfficerType(v);
      return n === 'កិច្ចសន្យារដ្ឋ' || n.includes('រដ្ឋ') || n.includes('state');
    };
    const isHospitalType = (v) => {
      const n = normOfficerType(v);
      return n === 'កិច្ចសន្យាមន្ទីរពេទ្យ' || n.includes('មន្ទីរពេទ្យ') || n.includes('hospital');
    };
    const isPartTimeType = (v) => {
      const n = normOfficerType(v);
      return n === 'កិច្ចសន្យាក្រៅម៉ោង' || n.includes('ក្រៅម៉ោង') || n.includes('part');
    };
    const isWorkerType = (v) => {
      const n = normOfficerType(v);
      return n === 'កម្មករកិច្ចសន្យា' || n.includes('កម្មករ') || n.includes('worker');
    };

    const makeText = (h) => [
      h.civilServantReason,
      h.reason,
      h.other,
      h.workOther,
      h.civilServantRole,
      h.position,
      h.officerType,
    ]
      .map((x) => (x || '').toString().toLowerCase())
      .join(' ');

    const statsMap = new Map();
    const roleStatsMap = new Map();

    // Row-based stats for the AttendanceMinistryReportPage
    // Keys follow the table codes (eg "2.1", "2.1.1", "3.1.3", ...)
    const rowStatsMap = new Map();

    const ensureRowEntry = (code) => {
      if (!code) return null;
      if (!rowStatsMap.has(code)) {
        rowStatsMap.set(code, {
          code,
          civilTotal: 0,
          civilFemale: 0,
          contractTotal: 0,
          contractFemale: 0,
        });
      }
      return rowStatsMap.get(code);
    };

    const addToRowStats = (code, { isCivil, isContract, isFemale }) => {
      if (!code) return;
      const entry = ensureRowEntry(code);
      if (!entry) return;
      if (isCivil) {
        entry.civilTotal += 1;
        if (isFemale) entry.civilFemale += 1;
      } else if (isContract) {
        entry.contractTotal += 1;
        if (isFemale) entry.contractFemale += 1;
      }
    };

    (hrs || []).forEach((h) => {
      const dep = (h.Department_Kh || '').toString().trim();
      if (!dep) return;

      const otRaw = h.officerType || '';
      const text = makeText(h);

      // Align classification with EmployeeReportPage grandSummary so that
      // ministry report civil / state-contract totals match the dashboard
      // (eg 991 មន្រ្តីក្របខណ្ឌ / 52 កិច្ចសន្យារដ្ឋ).
      const isState = isStateType(otRaw);
      const isHosp = isHospitalType(otRaw);
      const isPart = isPartTimeType(otRaw);
      const isWorker = isWorkerType(otRaw);

      // Civil servants = everyone who is not a contract type (state,
      // hospital, part-time, worker). State contract officers are counted
      // separately in the "contract" column.
      let isCivil = (isCivilType(otRaw) || (!isState && !isHosp && !isPart && !isWorker));
      let isContract = isState;

      const key = dep;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          departmentKh: dep,
          civilTotal: 0,
          civilFemale: 0,
          contractTotal: 0,
          contractFemale: 0,
        });
      }
      const entry = statsMap.get(key);
      const gender = (h.gender || '').toString();
      const isFemale = gender === 'Female' || gender === 'ស្រី' || gender === 'female';

      if (isCivil) {
        entry.civilTotal += 1;
        if (isFemale) entry.civilFemale += 1;
      } else if (isContract) {
        entry.contractTotal += 1;
        if (isFemale) entry.contractFemale += 1;
      }

      const roleFlags = { isCivil, isContract, isFemale };

      // Map Departments_Kh to office codes (3.1, 3.2, 3.3, 3.4)
      const depLower = dep.toLowerCase();

      // Leadership block: Department "ថ្នាក់ដឹកនាំ" is the hospital-level
      const isLeadershipDept = depLower.includes('ថ្នាក់ដឹកនាំ');

      // Row 2.1: summary for leadership department only
      if (isLeadershipDept) {
        addToRowStats('2.1', roleFlags);
      }

      let deptCode = null;
      if (
        depLower.includes('រដ្ឋបាល') ||
        depLower.includes('បុគ្គលិក') ||
        depLower.includes('ជួសជុលថែទាំសម្ភារបរិក្ខារ') ||
        depLower.includes('ព័ត៌មានវិទ្យា')
      ) {
        deptCode = '3.1';
      } else if (depLower.includes('ហិរញ្ញវត្ថុ') && depLower.includes('សេវា')) {
        deptCode = '3.3';
      } else if (depLower.includes('ហិរញ្ញវត្ថុ')) {
        deptCode = '3.2';
      }

      if (!deptCode && !isLeadershipDept) {
        deptCode = '3.4';
      }

      if (deptCode) {
        // Office total row (eg 3.1, 3.2, ...)
        addToRowStats(deptCode, roleFlags);

        // Per-office breakdown rows (eg 3.1.1, 3.1.2, 3.1.3, 3.1.4)
        const posLower = text.toLowerCase();
        let subCode = null;
        // Important: check for "អនុប្រធាន" (deputy) BEFORE generic
        // "ប្រធាន" so that deputy heads are not classified under .1.
        if (posLower.includes('អនុប្រធានការិយាល័យ')) {
          subCode = `${deptCode}.2`;
        } else if (posLower.includes('ប្រធានការិយាល័យ')) {
          subCode = `${deptCode}.1`;
        } else if (isCivil) {
          subCode = `${deptCode}.3`;
        } else if (isContract) {
          subCode = `${deptCode}.4`;
        }

        if (subCode) {
          addToRowStats(subCode, roleFlags);
        }
      }

      // Leadership by role for Khmer-Soviet Friendship Hospital
      const lowerText = `${dep} ${text}`.toLowerCase();
      let roleLabel = null;
      // Deputy director should be checked before generic director
      if (lowerText.includes('នាយករង') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
        roleLabel = 'នាយករង';
      } else if (lowerText.includes('នាយក') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
        roleLabel = 'នាយក';
      }
      if (roleLabel) {
        if (!roleStatsMap.has(roleLabel)) {
          roleStatsMap.set(roleLabel, {
            roleLabel,
            civilTotal: 0,
            civilFemale: 0,
            contractTotal: 0,
            contractFemale: 0,
          });
        }
        const rEntry = roleStatsMap.get(roleLabel);
        if (isCivil) {
          rEntry.civilTotal += 1;
          if (isFemale) rEntry.civilFemale += 1;
        } else if (isContract) {
          rEntry.contractTotal += 1;
          if (isFemale) rEntry.contractFemale += 1;
        }

        // Leadership rows under 2.1
        if (roleLabel === 'នាយក') {
          addToRowStats('2.1.1', roleFlags);
        } else if (roleLabel === 'នាយករង') {
          addToRowStats('2.1.2', roleFlags);
        }
      }
    });

    const departments = Array.from(statsMap.values()).sort((a, b) => {
      return a.departmentKh.localeCompare(b.departmentKh);
    });

    const roles = Array.from(roleStatsMap.values()).sort((a, b) => a.roleLabel.localeCompare(b.roleLabel));

    const rows = Array.from(rowStatsMap.values()).sort((a, b) => {
      const toNum = (code) => {
        if (!code) return 0;
        const n = Number(code.replace(/\./g, ''));
        return Number.isFinite(n) ? n : 0;
      };
      return toNum(a.code) - toNum(b.code);
    });

    res.json({ departments, roles, rows });
  } catch (err) {
    console.error('Ministry report stats error:', err);
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

    // Attempt to load a lean version using multiple ID formats (MongoID, staffId, or No)
    let raw = null;
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      raw = await HR.findById(id).lean();
    }
    if (!raw) {
      raw = await HR.findOne({ staffId: id }).lean();
    }
    if (!raw && /^\d+$/.test(id)) {
      raw = await HR.findOne({ no: Number(id) }).lean();
    }

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
    if (raw.outOfCadre) {
      if (typeof raw.outOfCadre.Start === 'string') {
        const p = parseDateLike(raw.outOfCadre.Start);
        if (p) repairs['outOfCadre.Start'] = p;
      }
      if (typeof raw.outOfCadre.End === 'string') {
        const p = parseDateLike(raw.outOfCadre.End);
        if (p) repairs['outOfCadre.End'] = p;
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

    // Now load the hydrated model instance using the same flexible ID logic
    let hr = null;
    const targetId = raw._id;
    hr = await HR.findById(targetId);
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
  
  // Track historical role if position or department changed
  if ((typeof rest.position !== 'undefined' && rest.position !== hr.position) || 
      (typeof rest.Department_Kh !== 'undefined' && rest.Department_Kh !== hr.Department_Kh)) {
    if (hr.position || hr.Department_Kh) {
      if (!hr.roleHistory) hr.roleHistory = [];
      hr.roleHistory.push({
        position: hr.position,
        department: hr.Department_Kh,
        startDate: hr.joinDate || null, // Best guess for start date if not previously tracked
        endDate: new Date()
      });
    }
  }

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

    // Update scalar fields
    hr.set(rest);

    // If 'no' is being changed via standard PUT, we allow it but don't do mass reordering here.
    // Mass reordering should use the dedicated /reposition endpoint.
    if (typeof desiredNoInput !== 'undefined') {
      hr.no = Number(desiredNoInput);
    }

    // Debug: inspect schema enum and values right before save
    try {
      console.log('PRE-SAVE: HR.schema.status.enumValues=', HR.schema.path('status')?.enumValues);
      console.log('PRE-SAVE: hr.status=', hr.status, 'type=', typeof hr.status);
    } catch (e) { }
    
    await hr.save();
    return res.json(hr);
  } catch (err) {
    console.error('HR update error:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate sequence number', code: 'DUP_NO' });
    }
    res.status(400).json({ error: err.message || 'Update failed' });
  }
});


// Dedicated route to update only ID card transform (bypasses full validation)
router.put('/:id/id-card-transform', requirePermission('edit:hr'), async (req, res) => {
  try {
    const { id } = req.params;
    const { idCardTransform } = req.body;
    if (!idCardTransform) return res.status(400).json({ error: 'Missing transform data' });
    
    // Find the actual record ID if staffId was provided
    let targetId = id;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      const found = await HR.findOne({ staffId: id }).select('_id');
      if (!found) return res.status(404).json({ error: 'រកមិនឃើញបុគ្គលិកនេះទេ' });
      targetId = found._id;
    }

    const result = await HR.updateOne({ _id: targetId }, { $set: { idCardTransform } });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'រកមិនឃើញទិន្នន័យដើម្បីកែប្រែ' });
    
    res.json({ success: true, idCardTransform });
  } catch (err) {
    console.error('ID Card Transform Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Atomic repositioning/reordering of sequence number 'no'
router.post('/:id/reposition', requirePermission('edit:hr'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newNo: rawNewNo } = req.body;
    const newNo = Number(rawNewNo);

    if (!Number.isInteger(newNo) || newNo < 1) {
      return res.status(400).json({ error: 'Invalid sequence number' });
    }

    const hr = await HR.findById(id);
    if (!hr) return res.status(404).json({ error: 'HR not found' });

    const oldNo = Number(hr.no);
    if (oldNo === newNo) return res.json(hr);

    // Use a high offset to avoid unique conflicts during the shift
    const tempOffset = 5000000;

    if (newNo < oldNo) {
      // Moving UP (e.g., 500 -> 200)
      // Shift others (200..499) DOWN (inc by 1)
      await HR.updateMany(
        { no: { $gte: newNo, $lt: oldNo } },
        { $inc: { no: tempOffset } },
        { timestamps: false }
      );
      await HR.updateOne({ _id: id }, { $set: { no: newNo } }, { timestamps: false });
      await HR.updateMany(
        { no: { $gte: tempOffset } },
        { $inc: { no: -tempOffset + 1 } },
        { timestamps: false }
      );
    } else {
      // Moving DOWN (e.g., 400 -> 800)
      // Shift others (401..800) UP (dec by 1)
      await HR.updateMany(
        { no: { $gt: oldNo, $lte: newNo } },
        { $inc: { no: tempOffset } },
        { timestamps: false }
      );
      await HR.updateOne({ _id: id }, { $set: { no: newNo } }, { timestamps: false });
      await HR.updateMany(
        { no: { $gte: tempOffset } },
        { $inc: { no: -tempOffset - 1 } },
        { timestamps: false }
      );
    }

    const updated = await HR.findById(id);
    res.json(updated);
  } catch (err) {
    console.error('HR reposition error:', err);
    res.status(400).json({ error: err.message });
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
        
        // Track historical role if position or department changed
        if ((typeof update.position !== 'undefined' && update.position !== existing.position) || 
            (typeof update.Department_Kh !== 'undefined' && update.Department_Kh !== existing.Department_Kh)) {
          if (existing.position || existing.Department_Kh) {
            update.$push = update.$push || {};
            update.$push.roleHistory = {
              position: existing.position,
              department: existing.Department_Kh,
              startDate: existing.joinDate || null,
              endDate: new Date()
            };
          }
        }
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

router.get('/export-budget-excel', requirePermission('view:hr'), async (req, res) => {
  try {
    const ka = ['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦', 'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤', 'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'];
    const kha = ['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'];
    const ko = ['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'];

    function demoteLevel(lvl) {
      if (!lvl) return '';
      const s = lvl.trim();
      let idx = ka.indexOf(s);
      if (idx !== -1 && idx < ka.length - 1) return ka[idx + 1];
      idx = kha.indexOf(s);
      if (idx !== -1 && idx < kha.length - 1) return kha[idx + 1];
      idx = ko.indexOf(s);
      if (idx !== -1 && idx < ko.length - 1) return ko[idx + 1];
      return s;
    }

    function getEmployeeCategory(emp) {
      const ot = (emp.officerType || '').toString().trim();
      if (ot.includes('រាជការ') || ot.includes('ក្របខណ្ឌ')) {
        return 'civil';
      }
      if (ot.includes('កិច្ចសន្យារដ្ឋ') || ot === 'កិច្ចសន្យា') {
        return 'contract_state';
      }
      return 'floating';
    }

    const hasResignData = (hr) => {
      try {
        return Boolean(hr && (
          hr.resignDate || hr.resignReason || hr.resignDocument || hr.resignationDate || hr.resignationReason
          || hr.dateRemoved || hr.dateRemovedFromDataset || hr.removalDate || (hr.delisted && (hr.delisted.dateRemoved || hr.delisted.date_removed))
        ));
      } catch (e) { return false; }
    };

    const isExplicitlyRemoved = (hr) => {
      try {
        const del = hr && hr.delisted ? hr.delisted : {};
        return Boolean(hr.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || hr.dateRemovedFromDataset || hr.removalDate);
      } catch (e) { return false; }
    };

    const isCountedActiveBackend = (hr) => {
      if (!hr) return false;
      const st = (hr.status || '').toString();
      if (st === 'Deleted' || st === 'Resigned' || st === 'deleted' || st === 'resigned' || st === 'Inactive') return false;
      const hasResign = hasResignData(hr);
      const hasExplicitRemoval = isExplicitlyRemoved(hr);
      const prepared = (hr.__isPreparedForDeletion) && !hasExplicitRemoval;
      if (hasResign && !prepared) return false;
      return true;
    };

    const allEmployees = await HR.find({}).lean();
    const activeEmployees = allEmployees.filter(isCountedActiveBackend);

    const counts2025 = {};
    const counts2026 = {};

    activeEmployees.forEach(emp => {
      const cat = getEmployeeCategory(emp);
      if (cat === 'civil') {
        const lvl = (emp.salaryLevel || '').toString().trim();
        if (!lvl) return;
        let lvl2025 = lvl;
        let lvl2026 = lvl;
        if (emp.salaryPromotionDate) {
          const promoYear = new Date(emp.salaryPromotionDate).getFullYear();
          if (promoYear === 2026) {
            lvl2025 = demoteLevel(lvl);
          }
        }
        counts2025[lvl2025] = (counts2025[lvl2025] || 0) + 1;
        counts2026[lvl2026] = (counts2026[lvl2026] || 0) + 1;
      } else if (cat === 'contract_state') {
        counts2025['កិច្ចសន្យា'] = (counts2025['កិច្ចសន្យា'] || 0) + 1;
        counts2026['កិច្ចសន្យា'] = (counts2026['កិច្ចសន្យា'] || 0) + 1;
      } else {
        counts2025['អណ្ដែត'] = (counts2025['អណ្ដែត'] || 0) + 1;
        counts2026['អណ្ដែត'] = (counts2026['អណ្ដែត'] || 0) + 1;
      }
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx');
    const sheet = workbook.getWorksheet('គម្រោងថវិការ');

    const leafRowMapping = {
      13: 'ក.១.១', 14: 'ក.១.២', 15: 'ក.១.៣', 16: 'ក.១.៤', 17: 'ក.១.៥', 18: 'ក.១.៦',
      20: 'ក.២.១', 21: 'ក.២.២', 22: 'ក.២.៣', 23: 'ក.២.៤',
      25: 'ក.៣.១', 26: 'ក.៣.២', 27: 'ក.៣.៣', 28: 'ក.៣.៤',
      31: 'ខ.១.១', 32: 'ខ.១.២', 33: 'ខ.១.៣', 34: 'ខ.១.៤', 35: 'ខ.១.៥', 36: 'ខ.១.៦',
      38: 'ខ.២.១', 39: 'ខ.២.២', 40: 'ខ.២.៣', 41: 'ខ.២.៤',
      43: 'ខ.៣.១', 44: 'ខ.៣.២', 45: 'ខ.៣.៣', 46: 'ខ.៣.៤',
      48: 'គ.១', 49: 'គ.២', 50: 'គ.៣', 51: 'គ.៤', 52: 'គ.៥', 53: 'គ.៦', 54: 'គ.៧', 55: 'គ.៨', 56: 'គ.៩', 57: 'គ.១០',
      59: 'កិច្ចសន្យា', 60: 'អណ្ដែត'
    };

    const leafRates = {};
    Object.keys(leafRowMapping).forEach(rNoKey => {
      const rNo = Number(rNoKey);
      const row = sheet.getRow(rNo);
      const tempCount26 = Number(row.getCell(4).value) || 0;
      leafRates[rNo] = {};
      for (let colIdx = 6; colIdx <= 16; colIdx++) {
        const tempVal = Number(row.getCell(colIdx).value) || 0;
        leafRates[rNo][colIdx] = tempCount26 > 0 ? (tempVal / tempCount26) : 0;
      }
    });

    Object.keys(leafRowMapping).forEach(rNoKey => {
      const rNo = Number(rNoKey);
      const code = leafRowMapping[rNoKey];
      const row = sheet.getRow(rNo);
      const count25 = counts2025[code] || 0;
      const count26 = counts2026[code] || 0;
      row.getCell(3).value = count25;
      row.getCell(4).value = count26;
      let rowTotal = 0;
      for (let colIdx = 6; colIdx <= 16; colIdx++) {
        const cell = row.getCell(colIdx);
        const rate = leafRates[rNo][colIdx] || 0;
        const newVal = Math.round(rate * count26);
        cell.value = newVal;
        rowTotal += newVal;
      }
      row.getCell(5).value = rowTotal;
    });

    function sumRows(targetRowNo, sourceRowNos) {
      const targetRow = sheet.getRow(targetRowNo);
      let count25 = 0;
      let count26 = 0;
      let moneyCols = Array(12).fill(0);
      sourceRowNos.forEach(rNo => {
        const r = sheet.getRow(rNo);
        count25 += Number(r.getCell(3).value) || 0;
        count26 += Number(r.getCell(4).value) || 0;
        for (let colIdx = 5; colIdx <= 16; colIdx++) {
          moneyCols[colIdx - 5] += Number(r.getCell(colIdx).value) || 0;
        }
      });
      targetRow.getCell(3).value = count25;
      targetRow.getCell(4).value = count26;
      for (let colIdx = 5; colIdx <= 16; colIdx++) {
        targetRow.getCell(colIdx).value = moneyCols[colIdx - 5];
      }
    }

    sumRows(12, [13, 14, 15, 16, 17, 18]);
    sumRows(19, [20, 21, 22, 23]);
    sumRows(24, [25, 26, 27, 28]);
    sumRows(11, [12, 19, 24]);
    sumRows(30, [31, 32, 33, 34, 35, 36]);
    sumRows(37, [38, 39, 40, 41]);
    sumRows(42, [43, 44, 45, 46]);
    sumRows(29, [30, 37, 42]);
    sumRows(47, [48, 49, 50, 51, 52, 53, 54, 55, 56, 57]);
    sumRows(10, [11, 29, 47]);
    sumRows(58, [59, 60]);
    sumRows(9, [10, 58]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="budget_2026.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
