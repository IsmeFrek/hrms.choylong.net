import { scrapeCheckinmeDailyReport } from './checkinmeService.js';
import AttendanceDailyReport from '../models/AttendanceDailyReport.js';
import HR from '../models/HR.js';
import LeaveRequest from '../models/LeaveRequest.js';
import WorkSchedule from '../models/WorkSchedule.js';

// Re-implementing the logic from attendance.js to avoid circular dependencies 
// or having to export internal functions from the route file.

function timeToDecimal(t) {
  if (!t || typeof t !== 'string') return 0;
  const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h + (m / 60);
}

function calculateDuration(in1, out1, in2, out2) {
  let total = 0;
  const tIn1 = timeToDecimal(in1);
  const tOut1 = timeToDecimal(out1);
  const tIn2 = timeToDecimal(in2);
  const tOut2 = timeToDecimal(out2);

  if (tIn1 > 0 && tOut1 > 0) {
    if (tOut1 >= tIn1) total += (tOut1 - tIn1);
    else total += (24 - tIn1) + tOut1;
  }
  if (tIn2 > 0 && tOut2 > 0) {
    if (tOut2 >= tIn2) total += (tOut2 - tIn2);
    else total += (24 - tIn2) + tOut2;
  }
  return parseFloat(total.toFixed(2));
}

async function consolidateAndSaveDailyReport(date, records) {
  const parts = date.split('-');
  const start = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const end = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999));

  const hrListFull = await HR.find({
    status: { $ne: 'Resigned' },
    resignationDate: { $eq: null }
  }).lean();
  
  const hrMapBySid = new Map();
  const hrMapByName = new Map();
  const normalize = (val) => String(val || '').toLowerCase().replace(/\s+/g, '').replace(/\./g, '').trim();

  hrListFull.forEach(h => {
    const sid = normalize(h.staffId);
    if (sid) {
      hrMapBySid.set(sid, h);
      const sidClean = sid.replace(/^([a-zA-Z]+)0+/, '$1');
      if (sidClean !== sid) hrMapBySid.set(sidClean, h);
    }
    if (h.checkinmeId) hrMapBySid.set(normalize(h.checkinmeId), h);
    if (h.khmerName) hrMapByName.set(normalize(h.khmerName), h);
    if (h.name) hrMapByName.set(normalize(h.name), h);
  });

  await AttendanceDailyReport.deleteMany({ date: { $gte: start, $lte: end } });

  const finalOpsMap = new Map();
  hrListFull.forEach(h => {
    let category = h.officerType || h.employeeCategory || '';
    const cLower = String(category).toLowerCase();
    if (cLower.includes('មន្ត្រីរាជការ') || cLower.includes('civil')) category = 'មន្ត្រីរាជការ';
    else if (cLower.includes('កិច្ចសន្យារដ្ឋ')) category = 'កិច្ចសន្យារដ្ឋ';
    else if (cLower.includes('មន្ទីរពេទ្យ')) category = 'កិច្ចសន្យាមន្ទីរពេទ្យ';
    else if (cLower.includes('កម្មករ')) category = 'កម្មករកិច្ចសន្យា';

    finalOpsMap.set(normalize(h.staffId), {
      hrId: h._id,
      staffId: h.staffId,
      date: start,
      staffName: h.khmerName || h.name || '',
      department: h.Department_Kh || h.department || '',
      employeeCategory: category,
      no: h.no || 9999,
      status: 'absent',
      checkin1: '', checkout1: '', checkin2: '', checkout2: '',
      workHours: 0,
      note: ''
    });
  });

  const scanRecords = Array.isArray(records) ? records : [];
  scanRecords.forEach(r => {
    const rawSid = String(r.staffId || r.staffCode || '').replace(/[^\x20-\x7E]/g, '').replace(/[^a-zA-Z0-9]/g, '').trim();
    const normSid = normalize(rawSid);

    let hr = hrMapBySid.get(normSid);
    if (!hr) {
      const namesToTry = [r.name, r.staffName].filter(Boolean);
      for (const v of namesToTry) {
        if (hrMapByName.has(normalize(v))) {
          hr = hrMapByName.get(normalize(v));
          break;
        }
      }
    }

    const key = hr ? normalize(hr.staffId) : (normSid || normalize(r.name));
    if (!finalOpsMap.has(key)) return;

    const existing = finalOpsMap.get(key);
    const ci = (r.checkin1 || r.checkIn) || '';
    const co = (r.checkout1 || r.checkOut) || '';
    const ci2 = (r.checkin2 || r.checkIn2) || '';
    const co2 = (r.checkout2 || r.checkOut2) || '';
    const hasTimes = !!(ci || co || ci2 || co2);

    if (hasTimes) {
      existing.status = 'present';
      existing.checkin1 = ci || existing.checkin1;
      existing.checkout1 = co || existing.checkout1;
      existing.checkin2 = ci2 || existing.checkin2;
      existing.checkout2 = co2 || existing.checkout2;
      existing.workHours = calculateDuration(existing.checkin1, existing.checkout1, existing.checkin2, existing.checkout2);
    } else if (r.status && r.status !== 'absent') {
      existing.status = String(r.status).toLowerCase();
    }
    
    if (r.note) existing.note = r.note;
    if (r.leaveType) existing.leaveType = r.leaveType;
    if (r.leaveReason) existing.leaveReason = r.leaveReason;
  });

  const localLeaves = await LeaveRequest.find({
    status: 'approved',
    startDate: { $lte: end },
    endDate: { $gte: start }
  }).lean();

  const leaveByStaffId = new Map(localLeaves.map(l => [String(l.staffId), l]));
  for (const item of finalOpsMap.values()) {
    const l = leaveByStaffId.get(String(item.staffId)) || (item.hrId ? leaveByStaffId.get(String(item.hrId)) : null);
    if (l) {
      item.status = 'leave';
      item.leaveType = l.type || '—';
      item.leaveReason = l.reason || '—';
    }
  }

  const bulkOps = Array.from(finalOpsMap.values()).map(data => ({
    updateOne: {
      filter: { staffId: data.staffId, date: start },
      update: { $set: data },
      upsert: true
    }
  }));

  if (bulkOps.length > 0) await AttendanceDailyReport.bulkWrite(bulkOps, { ordered: false });
  return finalOpsMap.size;
}

export async function autoSyncAttendance(targetDate = null) {
  const date = targetDate || new Date().toISOString().slice(0, 10);
  console.log(`[AutoSync] Starting attendance sync for ${date}...`);
  
  const catMap = {
    '12': 'មន្ត្រីរាជការ',
    '13': 'កិច្ចសន្យារដ្ឋ',
    '14': 'កិច្ចសន្យាមន្ទីរពេទ្យ',
    '15': 'កម្មករកិច្ចសន្យា'
  };

  let allRecords = [];
  const cats = ['12', '13', '14', '15'];
  
  for (const catId of cats) {
    try {
      console.log(`[AutoSync] Scraping category ${catMap[catId]}...`);
      const batch = await scrapeCheckinmeDailyReport({ date, categoryTypeId: catId, fast: true });
      if (Array.isArray(batch)) {
        batch.forEach(r => r.employeeCategory = catMap[catId]);
        allRecords = allRecords.concat(batch);
      }
      // Be gentle
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`[AutoSync] Failed category ${catId}:`, err.message);
    }
  }

  if (allRecords.length > 0) {
    const count = await consolidateAndSaveDailyReport(date, allRecords);
    console.log(`[AutoSync] Successfully synced ${count} records for ${date}`);
    return count;
  } else {
    console.log(`[AutoSync] No records found to sync for ${date}`);
    return 0;
  }
}
