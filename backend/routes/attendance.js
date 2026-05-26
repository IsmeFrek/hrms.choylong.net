import express from 'express';
import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import MonthlySummary from '../models/MonthlySummary.js';
import AttendanceDayData from '../models/AttendanceDayData.js';
import WorkSchedule from '../models/WorkSchedule.js';
import WorkScheduleEmployee from '../models/WorkScheduleEmployee.js';
import HR from '../models/HR.js';
import Employee from '../models/Employee.js';
import AttendanceDailyReport from '../models/AttendanceDailyReport.js';
import AttendanceSummary from '../models/AttendanceSummary.js';
import LeaveRequest from '../models/LeaveRequest.js';
import { scrapeCheckinmeAttendances, scrapeCheckinmeDailyReport } from '../services/checkinmeService.js';
import { authRequired, requireAnyPermission } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import GeoFencePolicy from '../models/GeoFencePolicy.js';

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lng2 - lng1);
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const router = express.Router();

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


function isLateCheck(checkin, scheduledStart) {
  if (!checkin || !scheduledStart || scheduledStart === '—') return false;
  const tCheckin = timeToDecimal(checkin);
  // Extract only the start part if it's a range
  const startPart = scheduledStart.split('-')[0].trim();
  const tStart = timeToDecimal(startPart);
  if (tCheckin === 0 || tStart === 0) return false;
  // Late if checkin is more than 5 minutes past start
  return tCheckin > (tStart + 15/60); // Late if > 15 mins buffer
}

function isEarlyCheck(checkout, scheduledEnd) {
  if (!checkout || !scheduledEnd || scheduledEnd === '—') return false;
  const tCheckout = timeToDecimal(checkout);
  const endPart = scheduledEnd.split('-').pop().trim();
  const tEnd = timeToDecimal(endPart);
  if (tCheckout === 0 || tEnd === 0) return false;
  
  // Handling overnight is tricky, but let's assume if checkout is AM and end is PM, it's definitely early leave
  // Special: if it's the same day and checkout < tEnd
  const tStartPart = timeToDecimal(scheduledEnd.split('-')[0].trim());
  if (tStartPart < tEnd) {
    // Standard same day shift
    return tCheckout < (tEnd - 2/60); // 2 mins buffer
  }
  return false;
}

function calculateDuration(in1, out1, in2, out2, scheduledRange) {
  let total = 0;
  const tIn1 = timeToDecimal(in1);
  const tOut1 = timeToDecimal(out1);
  const tIn2 = timeToDecimal(in2);
  const tOut2 = timeToDecimal(out2);

  if (tIn1 > 0 && tOut1 > 0) {
    if (tOut1 >= tIn1) {
      total += (tOut1 - tIn1);
    } else {
      // Overnight
      total += (24 - tIn1) + tOut1;
    }
  }
  if (tIn2 > 0 && tOut2 > 0) {
    if (tOut2 >= tIn2) {
      total += (tOut2 - tIn2);
    } else {
      total += (24 - tIn2) + tOut2;
    }
  }
  return parseFloat(total.toFixed(2));
}


/**
 * Shared helper to consolidate raw attendance logs (from scraper or manual paste)
 * with the official HR database and local Leave Requests.
 */
async function consolidateAndSaveDailyReport(date, records, isManual = false) {
  const parts = date.split('-');
  const start = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const end = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999));

  // 1. Fetch HR for Matching
  const hrListFull = await HR.find({
    status: { $ne: 'Resigned' },
    resignationDate: { $eq: null }
  }).lean();
  
  const hrMapBySid = new Map();
  const hrMapByName = new Map();
  const normalize = (val) => String(val || '').toUpperCase().replace(/\s+/g, '').replace(/\./g, '').trim();

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

  // 2. Clear existing records for this day (Replace mode)
  await AttendanceDailyReport.deleteMany({ date: { $gte: start, $lte: end } });

  // 3. Initialize Report Map
  const finalOpsMap = new Map(); // staffIdKey -> record

  if (!isManual) {
    // AUTO MODE: Initialize with ALL HR staff as 'absent'
    hrListFull.forEach(h => {
      let category = h.officerType || h.employeeCategory || '';
      const cLower = String(category).toLowerCase();
      if (cLower.includes('ក្របខណ្ឌ') || cLower.includes('ក្របខ័ណ្ឌ') || cLower.includes('មន្ត្រីរាជការ') || cLower.includes('មន្រ្តីរាជការ') || cLower.includes('civil')) category = 'មន្ត្រីរាជការ';
      else if (cLower.includes('កិច្ចសន្យារដ្ឋ') || cLower.includes('state')) category = 'កិច្ចសន្យារដ្ឋ';
      else if (cLower.includes('មន្ទីរពេទ្យ') || cLower.includes('hospital')) category = 'កិច្ចសន្យាមន្ទីរពេទ្យ';
      else if (cLower.includes('កម្មករ') || cLower.includes('worker')) category = 'កម្មករកិច្ចសន្យា';

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
  }

  // 4. Process Scan/Paste Records (CONSOLIDATION)
  const scanRecords = Array.isArray(records) ? records : [];
  scanRecords.forEach(r => {
    // Deep clean the Staff ID (handle hidden Unicode characters common in Checkinme)
    const rawSid = String(r.staffId || r.staffCode || '').replace(/[^\x20-\x7E]/g, '').replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!rawSid && !r.name) return;
    const normSid = normalize(rawSid);

    // Soft Match to HR
    let hr = hrMapBySid.get(normSid);
    if (!hr) {
      const namesToTry = [r.name, r.staffName, ...(r.nameVariants || [])].filter(Boolean);
      for (const v of namesToTry) {
        const normV = normalize(v);
        if (hrMapByName.has(normV)) {
          hr = hrMapByName.get(normV);
          break;
        }
      }
    }

    const key = hr ? normalize(hr.staffId) : (normSid || normalize(r.name));
    
    // In AUTO MODE, if no match found in initialized HR list, skip it
    if (!isManual && !finalOpsMap.has(key)) return;

    const existing = finalOpsMap.get(key);
    const currentCheckin = (r.checkin1 || r.checkIn) || '';
    const currentCheckout = (r.checkout1 || r.checkOut) || '';
    const hasTimes = !!(currentCheckin || currentCheckout || r.checkin2 || r.checkout2);

    // If we already have a record with times, don't overwrite it with one that has NO times
    if (existing && (existing.checkin1 || existing.checkout1) && !hasTimes) {
      // However, we might want to merge other fields like leaveType or note
      if (r.leaveType) existing.leaveType = r.leaveType;
      if (r.note) existing.note = existing.note ? `${existing.note}; ${r.note}` : r.note;
      return;
    }

    const doc = {
      hrId: hr ? hr._id : (existing?.hrId || null),
      staffId: hr ? String(hr.staffId).toUpperCase() : String(rawSid || 'NEW-' + Date.now()).toUpperCase(),
      date: start,
      staffName: hr ? (hr.khmerName || hr.name || r.name) : (r.name || r.staffName || ''),
      department: hr ? (hr.Department_Kh || hr.department || r.department) : (r.department || ''),
      employeeCategory: r.employeeCategory || (hr ? (hr.officerType || hr.employeeCategory) : ''),
      no: hr ? (hr.no || 9999) : 9999,
      status: hasTimes ? 'present' : String(r.status || (isManual ? 'present' : 'absent')).toLowerCase(),
      checkin1: currentCheckin,
      checkout1: currentCheckout,
      checkin2: (r.checkin2 || r.checkIn2) || '',
      checkout2: (r.checkout2 || r.checkOut2) || '',
      workHours: calculateDuration(currentCheckin, currentCheckout, (r.checkin2 || r.checkIn2) || '', (r.checkout2 || r.checkOut2) || '', r.scheduledTime),
      note: r.note || '',
      isLate: r.isLate === true || isLateCheck(currentCheckin, r.scheduledTime),
      leftEarly: r.leftEarly === true || isEarlyCheck(currentCheckout, r.scheduledTime),
      plech: !!r.plech,
      leaveType: r.leaveType || '',
      leaveReason: r.leaveReason || ''
    };

    // If status is specifically 'leave', ensure the fields are at least empty strings
    if (doc.status === 'leave') {
      doc.leaveType = doc.leaveType || '—';
      doc.leaveReason = doc.leaveReason || '—';
    }

      if (finalOpsMap.has(key)) {
        const existing = finalOpsMap.get(key);
        const existingHasTimes = !!(existing.checkin1 || existing.checkout1 || existing.checkin2 || existing.checkout2);
        
        // Override logic with Status Priority (present > leave > holiday > absent > pending)
        const getPrio = (s) => {
          const p = String(s || '').toLowerCase();
          if (p === 'present') return 4;
          if (p === 'leave') return 3;
          if (p === 'holiday') return 2;
          if (p === 'absent') return 1;
          return 0;
        };

        const docPrio = getPrio(doc.status);
        const existingPrio = getPrio(existing.status);

        if (isManual || hasTimes || docPrio > existingPrio || !existingHasTimes) {
          if (hasTimes) existing.status = 'present';
          else if (isManual && (doc.status === 'leave' || doc.status !== 'absent')) {
            existing.status = doc.status;
          } else if (docPrio > existingPrio) {
            existing.status = doc.status;
          }

        existing.checkin1 = doc.checkin1 || existing.checkin1;
        existing.checkout1 = doc.checkout1 || existing.checkout1;
        existing.checkin2 = doc.checkin2 || existing.checkin2;
        existing.checkout2 = doc.checkout2 || existing.checkout2;
        existing.workHours = doc.workHours || existing.workHours;
        existing.note = doc.note || existing.note;
        existing.isLate = doc.isLate || existing.isLate;
        existing.leftEarly = doc.leftEarly || existing.leftEarly;
        
        // Update leave fields ONLY if the incoming record is a leave or has non-empty values
        if (doc.status === 'leave' || (doc.leaveType && doc.leaveType !== '—') || (doc.leaveReason && doc.leaveReason !== '—')) {
          existing.leaveType = doc.leaveType || existing.leaveType;
          existing.leaveReason = doc.leaveReason || existing.leaveReason;
        }
      }
    } else {
      finalOpsMap.set(key, doc);
    }
  });

  // 5. Overlay Leaves (Only for matched HR)
  const localLeaves = await LeaveRequest.find({
    status: 'approved', // Fix: match model enum (lowercase)
    startDate: { $lte: end },
    endDate: { $gte: start }
  }).lean();

  // Build maps for both staffId and hrId to ensure we match correctly
  const leaveByStaffId = new Map(localLeaves.map(l => [String(l.staffId), l]));
  // If LeaveRequest doesn't have hrId, we'll just rely on staffId mapping

  for (const item of finalOpsMap.values()) {
    // Try to find a leave by staffId (most reliable) or by hrId
    const l = leaveByStaffId.get(String(item.staffId)) || (item.hrId ? leaveByStaffId.get(String(item.hrId)) : null);
    
    if (l) {
      item.status = 'leave';
      item.leaveType = l.type || '—';
      item.leaveReason = l.reason || '—';
    }
  }

  // 6. Bulk Write
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

router.delete('/daily-report-delete', authRequired, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date is required' });
    
    const parts = date.split('-');
    const start = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const end = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999));
    
    const result = await AttendanceDailyReport.deleteMany({
      date: { $gte: start, $lte: end }
    });
    
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Daily Report Routes (Must be early to avoid conflict with /:id) ─────────
router.get('/daily-report-list', authRequired, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date is required' });
    
    // Parse YYYY-MM-DD safely into UTC start/end
    const parts = date.split('-');
    const start = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const end = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999));
    
    const records = await AttendanceDailyReport.find({
      date: { $gte: start, $lte: end }
    }).sort({ staffId: 1 }).lean();

    // Use hrId from records if available, otherwise resolve from staffId
    const recordsWithHr = records.filter(r => r.hrId);
    const hrIdsFromRecords = recordsWithHr.map(r => r.hrId);
    
    const allStaffIds = records.filter(r => !r.hrId).map(r => String(r.staffId || '').trim().toUpperCase()).filter(Boolean);
    const hrListFromIds = await HR.find({ staffId: { $in: allStaffIds } }).select('_id staffId no').lean();
    
    const hrMap = new Map();
    hrListFromIds.forEach(h => {
      if (h.staffId) hrMap.set(String(h.staffId).trim().toUpperCase(), h);
    });
    
    const allHrIds = [...new Set([...hrIdsFromRecords, ...hrListFromIds.map(h => h._id)])];
    
    const schedules = await WorkSchedule.find({ 
      employeeId: { $in: allHrIds }, 
      date: { $gte: start, $lte: end } 
    }).lean();
    const scheduleMap = new Map(schedules.map(s => [String(s.employeeId), s]));
 
    const enriched = records.map(r => {
      let hrId = r.hrId;
      let no = r.no;
      
      if (!hrId) {
        const sidOriginal = String(r.staffId || '').trim();
        const sidUpper = sidOriginal.toUpperCase();
        const sidClean = sidUpper.replace(/^([a-zA-Z]+)0+/, '$1');
        const hr = hrMap.get(sidUpper) || hrMap.get(sidClean);
        hrId = hr?._id;
        no = no || hr?.no;
      }
      
      const sch = hrId ? scheduleMap.get(String(hrId)) : null;
      
      // Auto-correct status: If Absent on a Day Off, it's a Holiday
      let status = r.status || 'absent';
      if (status === 'absent' && sch && sch.shiftTitle === 'Day Off') {
        status = 'holiday';
      }

      // Always calculate work hours from scans if both times are present to ensure accuracy
      const workHours = calculateDuration(r.checkin1, r.checkout1, r.checkin2, r.checkout2, r.scheduledTime);

      return {
        ...r,
        status,
        workHours,
        no: no || 9999,
        scheduledTime: (sch && sch.shiftTitle === 'Day Off') 
          ? 'Day Off' 
          : (sch && sch.shiftStart && sch.shiftStart.trim() && sch.shiftStart !== '-') 
            ? `${sch.shiftStart} - ${sch.shiftEnd}` 
            : 'មិនមានម៉ោង'
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/sync-daily-report', authRequired, async (req, res) => {
  try {
    const { date, branchId, categoryTypeId } = req.body;
    let records = [];
    
    const catMap = {
      '12': 'មន្ត្រីរាជការ',
      '13': 'កិច្ចសន្យារដ្ឋ',
      '14': 'កិច្ចសន្យាមន្ទីរពេទ្យ',
      '15': 'កម្មករកិច្ចសន្យា'
    };

    const failedCats = [];
    // Support "all" categories by looping over the known category IDs
    if (categoryTypeId === 'all') {
      const cats = ['12', '13', '14', '15'];
      for (const cat of cats) {
        try {
          const res = await scrapeCheckinmeDailyReport({ date, branchId, categoryTypeId: cat });
          if (Array.isArray(res)) {
             res.forEach(r => r.employeeCategory = catMap[cat]);
             records = records.concat(res);
          }
        } catch (err) {
          console.error(`[Sync] Failed to scrape category ${catMap[cat] || cat}:`, err.message);
          failedCats.push(catMap[cat] || cat);
        }
      }
    } else {
      try {
        records = await scrapeCheckinmeDailyReport({ date, branchId, categoryTypeId });
        if (Array.isArray(records)) {
           records.forEach(r => r.employeeCategory = catMap[categoryTypeId] || '');
        }
      } catch (err) {
        return res.status(500).json({ ok: false, message: `Failed to scrape category: ${err.message}` });
      }
    }
    
    if (!records || records.length === 0) {
      return res.json({ ok: false, message: 'No data found from Checkinme' });
    }

    const syncedTotal = await consolidateAndSaveDailyReport(date, records);

    res.json({ 
      ok: true, 
      synced: syncedTotal, 
      date,
      failedCategories: failedCats.length > 0 ? failedCats : null
    });
  } catch (err) {
    console.error('Sync Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ─── Manual Paste Bulk Save ──────────────────────────────────────────────────
router.post('/bulk-save-manual', authRequired, async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Date and records array are required' });
    }

    const savedCount = await consolidateAndSaveDailyReport(date, records, true);
    res.json({ ok: true, synced: savedCount, date });
  } catch (err) {
    console.error('Manual Save Error:', err);
    res.status(500).json({ message: err.message });
  }
});



router.get('/daily-report-preview', authRequired, async (req, res, next) => {
  try {
    const { date, branchId = '', categoryTypeId = '' } = req.query;
    if (!date) return res.status(400).json({ ok: false, message: 'date (YYYY-MM-DD) is required' });
    
    let records = [];
    
    const catMap = {
      '12': 'មន្ត្រីរាជការ',
      '13': 'កិច្ចសន្យារដ្ឋ',
      '14': 'កិច្ចសន្យាមន្ទីរពេទ្យ',
      '15': 'កម្មករកិច្ចសន្យា'
    };

    if (categoryTypeId === 'all') {
      const cats = ['12', '13', '14', '15'];
      for (const cat of cats) {
        const res = await scrapeCheckinmeDailyReport({ date, branchId, categoryTypeId: cat });
        if (Array.isArray(res)) {
          // Attach category group name
          res.forEach(r => r.employeeCategory = catMap[cat]);
          records = records.concat(res);
        }
      }
    } else {
      records = await scrapeCheckinmeDailyReport({ date, branchId, categoryTypeId });
      if (Array.isArray(records)) {
        records.forEach(r => r.employeeCategory = catMap[categoryTypeId] || '');
      }
    }
    
    const allStaffIds = records.map(r => r.staffId).filter(Boolean);
    const hrList = await HR.find({ staffId: { $in: allStaffIds } }).lean();
    const hrMap = new Map(hrList.map(h => [String(h.staffId), h]));

    // Query Work Scedules for these employees on this date
    // (daily-report-preview 'date' is YYYY-MM-DD)
    const parts = date.split('-');
    const reportDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const startOfDay = new Date(reportDate.setUTCHours(0, 0, 0, 0));
    const endOfDay = new Date(reportDate.setUTCHours(23, 59, 59, 999));

    const hrIds = hrList.map(h => h._id);
    const schedules = await WorkSchedule.find({
      employeeId: { $in: hrIds },
      date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();
    const scheduleMap = new Map(schedules.map(s => [String(s.employeeId), s]));

    const enriched = records.map(rec => {
      const hr = hrMap.get(String(rec.staffId || ''));
      const sch = hr ? scheduleMap.get(String(hr._id)) : null;
      return {
        ...rec,
        staffName: hr?.khmerName || hr?.name || rec.name || '',
        department: hr?.Department_Kh || '',
        checkin1: rec.checkin1 || rec.checkIn,
        checkout1: rec.checkout1 || rec.checkOut,
        scheduledTime: sch ? `${sch.shiftStart} - ${sch.shiftEnd}` : '—'
      };
    });
    res.json({ ok: true, date, count: enriched.length, records: enriched });
  } catch (err) {
    next(err);
  }
});

// ─── Fast Sync Checkinme (Zero lookup, direct save) ──────────────────────────
router.post('/fast-sync-checkinme', authRequired, async (req, res) => {
  try {
    const { date, categoryTypeId, branchId } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    let records = [];
    
    // Aggregation Logic: If 'all' or empty, loop through the 4 core categories
    // categories: 12 (ក្របខណ្ឌ), 13 (កិច្ចសន្យារដ្ឋ), 14 (កិច្ចសន្យាមន្ទីរពេទ្យ), 15 (កម្មករកិច្ចសន្យា)
    const catLabels = { 
      '12': 'ក្របខណ្ឌ', 
      '13': 'កិច្ចសន្យារដ្ឋ', 
      '14': 'កិច្ចសន្យាមន្ទីរពេទ្យ', 
      '15': 'កម្មករកិច្ចសន្យា' 
    };

    const targetCategories = (!categoryTypeId || categoryTypeId === 'all') 
      ? ['12', '13', '14', '15'] 
      : [categoryTypeId];

    const categoryStats = [];
    console.log(`[FastSync] Starting aggregation for ${targetCategories.length} categories on ${date}`);

    for (const catId of targetCategories) {
      try {
        const batch = await scrapeCheckinmeDailyReport({ 
          date, 
          categoryTypeId: catId, 
          branchId: (!branchId || branchId === 'all') ? '' : branchId,
          fast: true 
        });
        
        const label = catLabels[catId] || catId;
        if (batch && batch.length > 0) {
          batch.forEach(r => {
            r.employeeCategory = label;
          });
          records = [...records, ...batch];
          categoryStats.push(`${label}: ${batch.length} នាក់`);
        } else {
          categoryStats.push(`${label}: 0 នាក់`);
        }
        // Add a small 500ms delay to be gentle on Checkinme
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        const label = catLabels[catId] || catId;
        console.warn(`[FastSync] Scraping category ${catId} failed, skipping...`, err.message);
        categoryStats.push(`${label}: បរាជ័យ (${err.message})`);
      }
    }

    if (!records || records.length === 0) {
      return res.json({ ok: false, message: 'រកមិនឃើញទិន្នន័យពី Checkinme ទេ៖ ' + categoryStats.join(', ') });
    }

    const syncedCount = await consolidateAndSaveDailyReport(date, records, false);

    res.json({ 
      ok: true, 
      synced: syncedCount, 
      date,
      details: categoryStats.join(' | ')
    });
  } catch (err) {
    console.error('Fast Sync Error:', err);
    res.status(500).json({ message: err.message });
  }
});

const parseYMD = (v) => {
  const m = String(v || '').trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const d = new Date(Date.UTC(y, mo - 1, da));
  if (isNaN(d.getTime())) return null;
  return { y, mo, da, d };
};

const parseHM = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  // Try AM/PM regex
  const ampm = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
  if (ampm) {
    let hh = parseInt(ampm[1], 10);
    const mm = parseInt(ampm[2], 10);
    const mer = ampm[3].toUpperCase();
    if (mer === 'PM' && hh < 12) hh += 12;
    if (mer === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
  }
  // Try HH:mm regex
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  // Fallback to Date
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
  return null;
};


// Helper to parse Checkinme date/time strings like "2026-04-03 07:47 AM - Late"
const parseCheckinmeTime = (s) => {
  if (!s || s === '--' || s === '...') return { date: null, time: null, status: null, iso: null };
  const parts = String(s).split(' - ');
  const dateTimeStr = parts[0].trim(); // "2026-04-03 07:47 AM"
  const status = parts[1] ? parts[1].trim() : null;

  const m = dateTimeStr.match(/^(\d{4}-\d{2}-\d{1,2})\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)$/);
  if (!m) return { date: null, time: null, status, iso: null };

  const datePart = m[1];
  const timePart = m[2];
  const dt = new Date(`${datePart} ${timePart}`);
  return { date: datePart, time: timePart, status, iso: !isNaN(dt.getTime()) ? dt.toISOString() : null };
};

const toNumOr0 = (v) => {
  if (v === null || typeof v === 'undefined' || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const toNumOrUndef = (v) => {
  if (v === null || typeof v === 'undefined' || v === '') return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

// Map verbose leave request types to short codes for summary comments.
// Examples (as provided by HR):
//   "ច្បាប់​ឈប់​ប្រចាំ​ឆ្នាំ"                -> "ច្បាប់_ប្រចាំ​ឆ្នាំ"
//   "ច្បាប់​ឈប់​រយៈពេល​ខ្លី"              -> "ច្បាប់_រយៈពេល​ខ្លី"
//   "មាតុភាព"                             -> "មាតុភាព"
//   "ច្បាប់​ឈប់​សម្រាក​ព្យាបាល​ជំងឺ"      -> "ច្បាប់_ព្យាបាល​ជំងឺ"
//   "ច្បាប់​ឈប់​សម្រាក​ដោយ​មាន​កិច្ចការ​ផ្ទាល់​ខ្លួន" -> "ច្បាប់_មាន​កិច្ចការ​ផ្ទាល់​ខ្លួន"
const toLeaveTypeCode = (rawType) => {
  const t = (rawType || '').toString().trim();
  if (!t) return '';

  // Annual leave
  if (t.includes('ប្រចាំ​ឆ្នាំ') || t.includes('ប្រចាំឆ្នាំ')) {
    return 'ច្បាប់_ប្រចាំ​ឆ្នាំ';
  }

  // Short-term leave
  if (t.includes('រយៈពេល​ខ្លី') || t.includes('រយៈពេលខ្លី')) {
    return 'ច្បាប់_រយៈពេល​ខ្លី';
  }

  // Maternity
  if (t.includes('មាតុភាព')) {
    return 'មាតុភាព';
  }

  // Sick leave
  if (t.includes('ព្យាបាល​ជំងឺ') || t.includes('ព្យាបាល ជំងឺ') || t.includes('ព្យាបាលជំងឺ')) {
    return 'ច្បាប់_ព្យាបាល​ជំងឺ';
  }

  // Personal affairs leave
  if (
    t.includes('កិច្ចការ​ផ្ទាល់​ខ្លួន') ||
    t.includes('កិច្ចការ ផ្ទាល់ខ្លួន') ||
    t.includes('កិច្ចការផ្ទាល់ខ្លួន')
  ) {
    return 'ច្បាប់_មាន​កិច្ចការ​ផ្ទាល់​ខ្លួន';
  }

  // Default: keep original as-is
  return t;
};

// Create attendance record
router.post('/', async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload || !payload.staffId || !payload.date) return res.status(400).json({ message: 'staffId and date required' });

    const staffId = String(payload.staffId).trim();
    const date = new Date(payload.date);
    if (!staffId || isNaN(date.getTime())) return res.status(400).json({ message: 'invalid staffId/date' });

    const existing = await Attendance.findOne({ staffId, date });
    if (existing) return res.status(409).json({ message: 'Attendance already recorded for this staff and date' });

    const recData = { ...payload, staffId, date };

    if (payload.checkInShort) {
      recData.inTime = payload.checkInShort;
      recData.checkIn = payload.checkIn || payload.checkInShort;
    } else if (payload.checkIn) {
      recData.inTime = payload.checkIn;
      recData.checkIn = payload.checkIn;
    }
    if (payload.checkOutShort) {
      recData.outTime = payload.checkOutShort;
      recData.checkOut = payload.checkOut || payload.checkOutShort;
    } else if (payload.checkOut) {
      recData.outTime = payload.checkOut;
      recData.checkOut = payload.checkOut;
    }

    if (payload.checkIn2Short) {
      recData.inTime2 = payload.checkIn2Short;
      recData.checkIn2 = payload.checkIn2 || payload.checkIn2Short;
    } else if (payload.checkIn2) {
      recData.inTime2 = payload.checkIn2;
      recData.checkIn2 = payload.checkIn2;
    }
    if (payload.checkOut2Short) {
      recData.outTime2 = payload.checkOut2Short;
      recData.checkOut2 = payload.checkOut2 || payload.checkOut2Short;
    } else if (payload.checkOut2) {
      recData.outTime2 = payload.checkOut2;
      recData.checkOut2 = payload.checkOut2;
    }

    // optional schedule-based compute
    try {
      if (payload.scheduledStart && payload.checkIn) {
        const schMin = parseHM(payload.scheduledStart);
        const chkMin = parseHM(payload.checkIn);
        const grace = Number(payload.scheduledGraceMinutes ?? 15);
        if (schMin !== null && chkMin !== null && chkMin > schMin + grace) {
          recData.isLate = true;
          recData.lateMinutes = Math.max(0, chkMin - schMin);
        }
      }
      if (payload.scheduledEnd && payload.checkOut) {
        const schMin = parseHM(payload.scheduledEnd);
        const chkMin = parseHM(payload.checkOut);
        const endGrace = Number(payload.scheduledEndGraceMinutes || 0);
        if (schMin !== null && chkMin !== null && chkMin < schMin - endGrace) {
          recData.leftEarly = true;
          recData.earlyMinutes = Math.max(0, (schMin - endGrace) - chkMin);
        }
      }
    } catch {
      // ignore
    }

    const rec = new Attendance(recData);
    await rec.save();
    res.json(rec);
  } catch (err) {
    next(err);
  }
});

// --- Scan from Telegram Mini App ---
router.post('/scan-mini-app', authRequired, async (req, res, next) => {
  try {
    const { type } = req.body; // 'in1', 'out1', 'in2', 'out2'
    if (!['in1', 'out1', 'in2', 'out2'].includes(type)) {
      return res.status(400).json({ message: 'Invalid scan type' });
    }

    const authUser = req.auth?.user;
    const User = mongoose.model('User');
    
    // Try to find user by ID or by Phone
    let userInDb = null;
    if (authUser?._id) {
      userInDb = await User.findById(authUser._id).lean();
    }
    if (!userInDb && authUser?.phone) {
      userInDb = await User.findOne({ phone: authUser.phone }).lean();
    }
    
    if (userInDb) {
      console.log(`SCAN_MINI_APP: Found user in DB. ID: ${userInDb._id}, StaffID: ${userInDb.staffId}`);
    } else {
      console.warn('SCAN_MINI_APP: User NOT found in DB');
    }
    
    // Get staffId from DB record or fallback to what we have
    let staffId = userInDb?.staffId || authUser?.staffId || authUser?.username || authUser?.phone || '';
    staffId = String(staffId).trim();

    console.log('SCAN_MINI_APP: Resolved Final Staff ID ->', staffId);

    if (!staffId) {
      console.error('SCAN_MINI_APP: No identifier found for this user');
      return res.status(400).json({ message: 'No identifier found for user' });
    }

    // 1. Resolve HR (Search by staffId case-insensitive)
    let hr = await HR.findOne({ staffId: { $regex: new RegExp(`^${staffId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).lean();
    
    if (!hr) {
      // If not found by staffId, try searching by phone (stripping non-digits)
      const cleanPhone = staffId.replace(/\D/g, '');
      if (cleanPhone.length >= 8) {
        // Try matching the last 8 or 9 digits to handle +855 or 0 prefix variations
        const phoneSuffix8 = cleanPhone.slice(-8);
        const phoneSuffix9 = cleanPhone.slice(-9);
        
        hr = await HR.findOne({ 
          $or: [
            { phone: new RegExp(phoneSuffix8 + '$') },
            { phone: new RegExp(phoneSuffix9 + '$') }
          ]
        }).lean();
      }
    }
    if (!hr) {
      console.error(`SCAN_MINI_APP: Staff record not found for ID/Phone: "${staffId}"`);
      return res.status(404).json({ message: 'Staff record not found in HR' });
    }
    console.log(`SCAN_MINI_APP: Found HR record for ${hr.staffId}`);

    const today = new Date().toISOString().slice(0, 10);
    const dateObj = new Date(today);
    const now = new Date().toISOString();

    // --- Geo-fence Validation ---
    const { lat, lng, accuracy } = req.body || {};
    const policies = await GeoFencePolicy.find({ enabled: true }).sort({ priority: -1 }).lean();
    
    // Find matching policy (Staff ID, Department, or Global)
    const activePolicy = policies.find(p => {
      if (p.match?.staffId && p.match.staffId !== hr.staffId) return false;
      if (p.match?.department && p.match.department !== hr.Department_Kh) return false;
      // ... add more matching if needed
      return true;
    });

    if (activePolicy && activePolicy.fence?.centerLat && activePolicy.fence?.centerLng) {
      if (!lat || !lng) {
        return res.status(400).json({ message: 'សូម Allow GPS/Location ជាមុនសិនទើបអាចស្កេនបាន' });
      }
      
      const dist = distanceMeters(lat, lng, activePolicy.fence.centerLat, activePolicy.fence.centerLng);
      const radius = activePolicy.fence.radiusM || 200;
      const maxAcc = activePolicy.fence.maxAccuracyM || 250;

      console.log(`SCAN_MINI_APP: Geo check for ${hr.staffId}. Distance: ${dist.toFixed(1)}m, Accuracy: ${accuracy}m, Radius: ${radius}m`);

      if (dist > radius) {
        return res.status(403).json({ 
          message: `លោកអ្នកនៅក្រៅទីតាំងអនុញ្ញាត (${dist.toFixed(0)}m > ${radius}m)។ សូមទៅក្បែរមន្ទីរពេទ្យរួចសាកម្ដងទៀត។`,
          distance: dist
        });
      }

      if (accuracy && accuracy > maxAcc) {
        return res.status(400).json({ 
          message: `GPS មិនសូវច្បាស់ (Accuracy: ${accuracy}m)។ សូមចេញទៅក្រៅអគារ ឬកន្លែងវាលបន្តិច ដើម្បីឱ្យ GPS ច្បាស់។`
        });
      }
    }
    // --- End Geo-fence Validation ---

    // 2. Update/Create raw Attendance
    let attendance = await Attendance.findOne({ staffId: hr.staffId, date: dateObj });
    if (!attendance) {
      attendance = new Attendance({ 
        staffId: hr.staffId, 
        staffName: hr.khmerName || hr.name,
        departmentKh: hr.departmentKh,
        date: dateObj, 
        status: 'present', 
        notes: 'mini-app' 
      });
    } else {
      // Ensure name and dept are up to date even if record existed
      attendance.staffName = hr.khmerName || hr.name;
      attendance.departmentKh = hr.departmentKh;
    }

    const fieldMap = {
      in1: 'checkIn',
      out1: 'checkOut',
      in2: 'checkIn2',
      out2: 'checkOut2'
    };
    attendance[fieldMap[type]] = now;
    if (type === 'in1') attendance.inTime = now;
    if (type === 'out1') attendance.outTime = now;
    if (type === 'in2') attendance.inTime2 = now;
    if (type === 'out2') attendance.outTime2 = now;

    await attendance.save();

    // 3. Update/Consolidate Daily Report (optional but recommended for instant sync)
    // We can just trigger a re-consolidation for this staff on this day
    await consolidateAndSaveDailyReport(today, [{
      staffId: hr.staffId,
      [fieldMap[type]]: now,
      note: 'mini-app'
    }]);

    res.json({ ok: true, type, time: now, hr });
  } catch (err) {
    next(err);
  }
});

// Get list with optional filters: staffId, from, to, isLate, leftEarly, search
router.get('/', async (req, res, next) => {
  try {
    const { staffId, from, to, date, isLate, leftEarly, search } = req.query;
    const q = {};
    
    // Support filtering by a single day or range
    if (date) {
      const d = parseYMD(date);
      if (!d) return res.status(400).json({ message: 'invalid date (expected YYYY-MM-DD)' });
      const start = new Date(Date.UTC(d.y, d.mo - 1, d.da));
      const end = new Date(Date.UTC(d.y, d.mo - 1, d.da + 1));
      q.date = { $gte: start, $lt: end };
    } else if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to) {
        // Ensure to date covers the whole day
        const d = parseYMD(to);
        if (d) {
          q.date.$lte = new Date(Date.UTC(d.y, d.mo - 1, d.da, 23, 59, 59, 999));
        } else {
          q.date.$lte = new Date(to);
        }
      }
    }

    if (staffId) q.staffId = String(staffId).trim();
    
    // Improved Status Filtering: Check both boolean flag AND text fallback in notes
    if (isLate === 'true' || isLate === 'yes') {
      q.$or = [
        { isLate: true },
        { notes: { $regex: /late/i } },
        { service: { $regex: /late/i } }
      ];
    }
    if (leftEarly === 'true' || leftEarly === 'yes') {
      const earlyQ = [
        { leftEarly: true },
        { notes: { $regex: /early|left/i } },
        { service: { $regex: /early|left/i } }
      ];
      if (q.$or) {
        // If already have late filter, we must intersect or handle carefully. 
        // But usually only one status is filtered at a time.
        q.$and = [{ $or: q.$or }, { $or: earlyQ }];
        delete q.$or;
      } else {
        q.$or = earlyQ;
      }
    }

    // Search by name/ID (requires intermediate HR lookup)
    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const hrs = await HR.find({
        $or: [
          { staffId: { $regex: regex } },
          { name: { $regex: regex } },
          { nameLatin: { $regex: regex } },
          { khmerName: { $regex: regex } },
          { fullName: { $regex: regex } }
        ]
      }).select('staffId').lean();
      const sids = hrs.map(h => h.staffId).filter(Boolean);
      
      if (q.staffId) {
        // If specific staffId filter already exists, intersect with search results
        if (!sids.includes(q.staffId)) {
          // If the searched name doesn't match the specific ID filter, return empty
          return res.json([]);
        }
      } else {
        q.staffId = { $in: sids };
      }
    }

    // Load attendance rows and enrich with HR name fields (Khmer + Latin)
    const items = await Attendance.find(q).sort({ date: -1 }).lean();

    // Build staffId -> HR record map to attach names
    const staffIds = Array.from(new Set((items || []).map(r => r && r.staffId).filter(Boolean)));
    let hrByStaffId = new Map();
    if (staffIds.length) {
      try {
        const hrs = await HR.find({ staffId: { $in: staffIds } }).lean();
        for (const h of (hrs || [])) {
          if (!h || !h.staffId) continue;
          hrByStaffId.set(String(h.staffId), h);
        }
      } catch (e) {
        // If HR lookup fails, continue with bare attendance data
        hrByStaffId = new Map();
      }
    }

    const enriched = (items || []).map(r => {
      if (!r || !r.staffId) return r;
      const h = hrByStaffId.get(String(r.staffId)) || {};
      const latinName = h.nameLatin || h.nameEn || h.englishName || h.name || '';
      const fullName = h.khmerName || h.name || '';
      return { ...r, fullName, latinName };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// Daily report convenience endpoint
router.get('/daily', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date required (YYYY-MM-DD)' });
    const d = parseYMD(date);
    if (!d) return res.status(400).json({ message: 'invalid date (expected YYYY-MM-DD)' });
    const start = new Date(Date.UTC(d.y, d.mo - 1, d.da, 0, 0, 0));
    start.setHours(start.getHours() - 12);
    const end = new Date(Date.UTC(d.y, d.mo - 1, d.da, 23, 59, 59, 999));
    end.setHours(end.getHours() + 12);
    const items = await Attendance.find({ date: { $gte: start, $lte: end } }).lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// Save remarks for daily report
router.post('/save-remarks', authRequired, async (req, res) => {
  try {
    const { date, staffId, remarks } = req.body;
    if (!date || !staffId) return res.status(400).json({ message: 'Date and staffId are required' });
    
    // Parse date (expecting YYYY-MM-DD)
    const m = String(date).trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
    if (!m) return res.status(400).json({ message: 'Invalid date format' });
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    const start = new Date(Date.UTC(y, mo - 1, da));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    
    const record = await mongoose.model('AttendanceDailyReport').findOne({ 
      staffId, 
      date: { $gte: start, $lt: end } 
    });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    
    record.remarks = remarks;
    await record.save();
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get monthly data
router.get('/monthly-data', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ message: 'year and month required' });
    const y = Number(year);
    const mo = Number(month);
    
    const startDate = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));

    // Fetch ONLY official daily reports
    const dailyReports = await AttendanceDailyReport.find({
      date: { $gte: startDate, $lte: endDate }
    }, {
      staffId: 1, staffName: 1, date: 1, status: 1, checkIn: 1, checkOut: 1,
      isLate: 1, leftEarly: 1, plech: 1, leaveType: 1, leaveTyp: 1, leaveReason: 1,
      workHours: 1, checkin1: 1, checkout1: 1, checkin2: 1, checkout2: 1
    }).sort({ date: 1 }).lean();

    const staffIds = Array.from(new Set(dailyReports.map(r => r.staffId).filter(Boolean)));
    const hrRecords = await mongoose.model('HR').find({ staffId: { $in: staffIds } }, { staffId: 1, joinDate: 1, resignationDate: 1 }).lean();
    const hrMap = new Map();
    hrRecords.forEach(hr => hrMap.set(String(hr.staffId).trim().toUpperCase(), hr));

    const map = {};
    
    // Populate map with data aggregated from AttendanceDailyReport (Official Daily Logs)
    dailyReports.forEach((rec) => {
      const sid = String(rec.staffId || '').trim().toUpperCase();
      if (!sid) return;

      const hr = hrMap.get(sid);
      if (hr) {
        const recDate = new Date(rec.date);
        const recStart = new Date(Date.UTC(recDate.getFullYear(), recDate.getMonth(), recDate.getDate())).getTime();
        
        if (hr.joinDate) {
          const jd = new Date(hr.joinDate);
          const jdStart = new Date(Date.UTC(jd.getFullYear(), jd.getMonth(), jd.getDate())).getTime();
          if (recStart < jdStart) return;
        }
        
        if (hr.resignationDate) {
          const rd = new Date(hr.resignationDate);
          const rdStart = new Date(Date.UTC(rd.getFullYear(), rd.getMonth(), rd.getDate())).getTime();
          if (recStart > rdStart) return;
        }
      }

      if (!map[sid]) {
        map[sid] = {
          staffId: sid,
          name: rec.staffName || '',
          khmerName: rec.staffName || '',
          dailyData: [],
          dayWorkCount: 0,
          attendanceCount: 0,
          workTime: 0,
          absentCount: 0,
          leaveCount: 0,
          checkinLateCount: 0,
          checkinLateMinutes: 0,
          checkoutEarlyCount: 0,
          checkoutEarlyMinutes: 0,
          plech: 0,
          leaveType: '',
          other: '',
          totalLeaveComment: '',
          year: y,
          month: mo,
          A: 0
        };
      }
      
      const tgt = map[sid];
      const status = (rec.status || '').toLowerCase();

      // Aggregate counts
      if (rec.isLate) tgt.checkinLateCount += 1;
      if (rec.leftEarly) tgt.checkoutEarlyCount += 1;
      if (status === 'absent') { tgt.absentCount += 1; tgt.A = (tgt.A || 0) + 1; }
      if (status === 'leave') tgt.leaveCount += 1;
      if (rec.plech) tgt.plech += 1;

      // Day work count logic: exclude weekends/rest/holidays
      if (status !== 'rest' && status !== 'dayoff' && status !== 'holiday') {
        tgt.dayWorkCount += 1;
      }

      // Map leave types
      const lt = (rec.leaveType || rec.leaveTyp || '').toString().trim();
      if (lt && lt !== '—') {
        if (!tgt.leaveType.includes(lt)) {
          tgt.leaveType = tgt.leaveType ? `${tgt.leaveType}, ${lt}` : lt;
        }
      }
      
      const lr = (rec.leaveReason || '').toString().trim();
      if (lr && lr !== '—') {
        if (!tgt.other.includes(lr)) {
          tgt.other = tgt.other ? `${tgt.other}, ${lr}` : lr;
        }
      }
      
      if (rec.workHours) tgt.workTime += Math.round(Number(rec.workHours) * 60);
      
      const cin = rec.checkin1 || rec.checkIn || '';
      const cout = rec.checkout1 || rec.checkOut || '';
      if (cin || cout) tgt.attendanceCount += 1;

      tgt.dailyData.push({
        _id: rec._id,
        date: rec.date.toISOString().slice(0, 10),
        checkIn: cin,
        checkOut: cout,
        status: rec.status || '',
        isLate: !!rec.isLate,
        leftEarly: !!rec.leftEarly,
        leaveType: lt,
        leaveReason: lr
      });
    });

    res.json(Object.values(map));
  } catch (err) {
    next(err);
  }
});

router.post('/monthly-data', async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ message: 'payload required' });
    const records = Array.isArray(payload) ? payload : [payload];

    const attendanceOps = [];
    const monthlyOps = [];
    const dailyReportOps = [];

    for (const rec of records) {
      if (!rec || !rec.staffId) continue;
      const staffId = String(rec.staffId).replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
      if (!staffId) continue;
      const year = Number(rec.year);
      const month = Number(rec.month);
      if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
      const name = rec.name || rec.staffName || '';

      const dailyData = Array.isArray(rec.dailyData) ? rec.dailyData : [];
      const normalizedDaily = [];

      for (const d of dailyData) {
        let dateObj = null;
        if (d?.date) dateObj = new Date(d.date);
        else if (d?.day) dateObj = new Date(year, month - 1, Number(d.day));
        if (!dateObj || isNaN(dateObj.getTime())) continue;
        const dateOnly = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
        const day = dateOnly.getDate();
        const checkIn = d?.checkIn || '';
        const checkOut = d?.checkOut || '';
        const status = d?.status || ((checkIn || checkOut) ? 'present' : '');

        normalizedDaily.push({ day, date: dateOnly.toISOString().slice(0, 10), checkIn, checkOut, status });
        attendanceOps.push({
          updateOne: {
            filter: { staffId, date: dateOnly },
            update: {
              $set: {
                staffId,
                staffName: name,
                date: dateOnly,
                checkIn,
                checkOut,
                status: status || ((checkIn || checkOut) ? 'present' : 'absent')
              }
            },
            upsert: true
          }
        });

        dailyReportOps.push({
          updateOne: {
            filter: { staffId, date: dateOnly },
            update: {
              $set: {
                staffId,
                staffName: name,
                date: dateOnly,
                checkIn,
                checkOut,
                checkin1: checkIn,
                checkout1: checkOut,
                status: status || ((checkIn || checkOut) ? 'present' : 'absent'),
                updatedAt: new Date()
              }
            },
            upsert: true
          }
        });
      }

      monthlyOps.push({
        updateOne: {
          filter: { staffId, year, month },
          update: {
            $set: {
              staffId,
              name,
              year,
              month,
              leaveType: typeof rec.leaveType === 'string' ? rec.leaveType : String(rec.leaveType || ''),
              other: typeof rec.other === 'string' ? rec.other : String(rec.other || ''),
              totalLeaveComment: typeof rec.totalLeaveComment === 'string' ? rec.totalLeaveComment : String(rec.totalLeaveComment || ''),
              dailyData: normalizedDaily,
              workTime: typeof rec.workTime === 'string' ? rec.workTime : String(rec.workTime || ''),
              dayWorkCount: toNumOr0(rec.dayWorkCount),
              attendanceCount: toNumOr0(rec.attendanceCount),
              clock: toNumOr0(rec.clock),
              clockCount: toNumOr0(rec.clockCount),
              checkinLateMinutes: toNumOr0(rec.checkinLateMinutes),
              checkinLateCount: toNumOr0(rec.checkinLateCount),
              checkoutEarlyMinutes: toNumOr0(rec.checkoutEarlyMinutes),
              checkoutEarlyCount: toNumOr0(rec.checkoutEarlyCount),
              checkoutOvertimeMinutes: toNumOr0(rec.checkoutOvertimeMinutes),
              checkoutOvertimeCount: toNumOr0(rec.checkoutOvertimeCount),
              absentCount: toNumOr0(rec.absentCount),
              leaveCount: toNumOr0(rec.leaveCount),
              A: toNumOr0(rec.A),
              plech: toNumOr0(rec.plech),
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      });
    }

    let attendanceResult = null;
    let monthlyResult = null;
    let dailyReportResult = null;
    if (attendanceOps.length > 0) attendanceResult = await Attendance.bulkWrite(attendanceOps, { ordered: false });
    if (dailyReportOps.length > 0) dailyReportResult = await AttendanceDailyReport.bulkWrite(dailyReportOps, { ordered: false });
    if (monthlyOps.length > 0) monthlyResult = await MonthlySummary.bulkWrite(monthlyOps, { ordered: false });

    res.json({
      ok: true,
      attendanceUpserted: attendanceResult?.upsertedCount ?? 0,
      attendanceModified: attendanceResult?.modifiedCount ?? 0,
      dailyReportUpserted: dailyReportResult?.upsertedCount ?? 0,
      monthlyUpserted: monthlyResult?.upsertedCount ?? 0,
      monthlyModified: monthlyResult?.modifiedCount ?? 0
    });
  } catch (err) {
    next(err);
  }
});

// Get range-based attendance summaries
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to, year, month } = req.query;
    const filter = {};

    if (year && month) {
      // Filter by year/month if provided
      filter.year = Number(year);
      filter.month = Number(month);
    } else if (from && to) {
      const pf = parseYMD(from);
      const pt = parseYMD(to);
      if (pf && pt) {
        filter.fromDate = { $lte: pt.d };
        filter.toDate = { $gte: pf.d };
      }
    }

    const rows = await AttendanceSummary.find(filter).lean();
    
    // Find all unique staff IDs
    const allStaffIds = Array.from(new Set(rows.map(r => r.staffId).filter(Boolean)));
    const hrs = await HR.find({ staffId: { $in: allStaffIds } }, { staffId: 1, skill: 1, joinDate: 1, resignationDate: 1 }).lean();
    const hrMap = new Map(hrs.map(hr => [String(hr.staffId).trim().toUpperCase(), hr]));

    let fromDate, toDate;
    if (from && to) {
      const pf = parseYMD(from);
      const pt = parseYMD(to);
      if (pf && pt) {
        fromDate = pf.d;
        toDate = new Date(pt.d.getTime());
        toDate.setHours(23, 59, 59, 999);
      }
    } else if (year && month) {
      const y = Number(year);
      const m = Number(month);
      if (y && m) {
        fromDate = new Date(y, m - 2, 22); 
        toDate = new Date(y, m - 1, 21);   
        toDate.setHours(23, 59, 59, 999);
      }
    }

    if (fromDate && toDate && allStaffIds.length > 0) {
      // Fetch daily reports in the range to determine how many auto-generated absent days are invalid
      const invalidDailyReports = await mongoose.model('AttendanceDailyReport').find({
        date: { $gte: fromDate, $lte: toDate },
        staffId: { $in: allStaffIds }
      }).lean();

      const invalidCounts = {};
      invalidDailyReports.forEach(dr => {
         const sid = String(dr.staffId).trim().toUpperCase();
         const hr = hrMap.get(sid);
         if (!hr) return;
         
         const rawDate = new Date(dr.date);
         const drDate = new Date(Date.UTC(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate())).getTime();
         let isInvalid = false;
         
         if (hr.joinDate) {
           const jd = new Date(hr.joinDate);
           const jdStart = new Date(Date.UTC(jd.getFullYear(), jd.getMonth(), jd.getDate())).getTime();
           if (drDate < jdStart) isInvalid = true;
         }
         if (hr.resignationDate && !isInvalid) {
           const rd = new Date(hr.resignationDate);
           const rdStart = new Date(Date.UTC(rd.getFullYear(), rd.getMonth(), rd.getDate())).getTime();
           if (drDate > rdStart) isInvalid = true;
         }

         if (isInvalid) {
           if (!invalidCounts[sid]) invalidCounts[sid] = { dayWorkCount: 0, absentCount: 0, A: 0 };
           
           const status = (dr.status || '').toLowerCase();
           if (status !== 'rest' && status !== 'dayoff' && status !== 'holiday') {
             invalidCounts[sid].dayWorkCount += 1;
           }
           if (status === 'absent') {
             invalidCounts[sid].absentCount += 1;
             invalidCounts[sid].A += 1;
           }
         }
      });

      rows.forEach(r => {
        const sid = String(r.staffId).trim().toUpperCase();
        const hr = hrMap.get(sid);
        if (hr && !r.skill) r.skill = hr.skill || '';

        const toSubtract = invalidCounts[sid];
        if (toSubtract) {
          r.dayWorkCount = Math.max(0, (r.dayWorkCount || 0) - toSubtract.dayWorkCount);
          r.absentCount = Math.max(0, (r.absentCount || 0) - toSubtract.absentCount);
          r.A = Math.max(0, (r.A || 0) - toSubtract.A);
        }
      });
    } else {
      // Just enrich skill if no fromDate/toDate
      rows.forEach(r => {
        const sid = String(r.staffId).trim().toUpperCase();
        const hr = hrMap.get(sid);
        if (hr && !r.skill) r.skill = hr.skill || '';
      });
    }

    if (!rows || rows.length === 0) {
      return res.json(rows || []);
    }

    // Enrich with leave-requests Type information as totalLeaveComment.
    // For the requested range, gather all leave-requests per staff and
    // concatenate unique `type` values.

    // Support enrich totalLeaveComment for both from/to and year/month
    // fromDate and toDate are already calculated above

    if (fromDate && toDate) {
      const staffIds = Array.from(new Set(
        (rows || []).map((r) => (r.staffId || '').toString().trim()).filter(Boolean),
      ));

      if (staffIds.length > 0) {
        const orFilters = [];

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

        // Also support rows that only have a `months` marker (no explicit
        // start/end or date) by matching the months field to any month that
        // falls inside the requested range.
        const monthRange = {};
        if (fromDate) {
          // First day of the month containing `fromDate`
          const mFrom = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
          monthRange.$gte = mFrom;
        }
        if (toDate) {
          // Last day of the month containing `toDate` so that
          // any Months value inside that calendar month matches.
          const mTo = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
          monthRange.$lte = mTo;
        }
        if (Object.keys(monthRange).length) {
          orFilters.push({ months: monthRange });
        }

        const leaveFilter = { staffId: { $in: staffIds } };
        if (orFilters.length === 1) {
          Object.assign(leaveFilter, orFilters[0]);
        } else if (orFilters.length > 1) {
          leaveFilter.$or = orFilters;
        }

        const leaveRows = await LeaveRequest.find(leaveFilter, { staffId: 1, type: 1 }).lean();

        const byStaff = new Map();
        for (const lr of leaveRows || []) {
          const sid = (lr.staffId || '').toString().trim();
          if (!sid) continue;
          const rawType = (lr.type || '').toString().trim();
          if (!rawType) continue;
          const code = toLeaveTypeCode(rawType);
          if (!code) continue;
          if (!byStaff.has(sid)) byStaff.set(sid, new Set());
          byStaff.get(sid).add(code);
        }

        const enriched = rows.map((r) => {
          const sid = (r.staffId || '').toString().trim();
          const types = byStaff.get(sid);
          if (!types || !types.size) return r;
          return {
            ...r,
            totalLeaveComment: Array.from(types).join(', '),
          };
        });

        return res.json(enriched || []);
      }
    }

    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

// Save range-based attendance summaries imported from Excel
router.post('/summary', async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ message: 'payload required' });

    const records = Array.isArray(payload) ? payload : [payload];
    const ops = [];

    for (const rec of records) {
      if (!rec || !rec.staffId) continue;
      const staffId = String(rec.staffId).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (!staffId) continue;

      // Use year/month from payload (required)
      const year = rec.year;
      const month = rec.month;
      if (!year || !month) continue;
      const name = rec.name || rec.staffName || '';
      // Get skill from payload or fallback to HR
      let skill = rec.skill;
      if (!skill) {
        const hr = await HR.findOne({ staffId }).lean();
        skill = hr?.skill || '';
      }
      ops.push({
        updateOne: {
          filter: { staffId, year, month },
          update: {
            $set: {
              staffId,
              name,
              year,
              month,
              dayWorkCount: toNumOr0(rec.dayWorkCount),
              attendanceCount: toNumOr0(rec.attendanceCount),
              workTime: toNumOr0(rec.workTime),
              clock: toNumOr0(rec.clock),
              clockCount: toNumOr0(rec.clockCount),
              checkinLateMinutes: toNumOr0(rec.checkinLateMinutes),
              checkinLateCount: toNumOr0(rec.checkinLateCount),
              checkoutEarlyMinutes: toNumOr0(rec.checkoutEarlyMinutes),
              checkoutEarlyCount: toNumOr0(rec.checkoutEarlyCount),
              checkoutOvertimeMinutes: toNumOr0(rec.checkoutOvertimeMinutes),
              checkoutOvertimeCount: toNumOr0(rec.checkoutOvertimeCount),
              absentCount: toNumOr0(rec.absentCount),
              leaveCount: toNumOr0(rec.leaveCount),
              A: toNumOr0(rec.A),
              plech: toNumOr0(rec.plech ?? rec.Plech),
              skill: skill || '',
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      });
    }

    if (ops.length > 0) {
      await AttendanceSummary.bulkWrite(ops, { ordered: false });
    }

    res.json({ ok: true, count: ops.length });
  } catch (err) {
    next(err);
  }
});

// Delete monthly data for a staff (per-day attendance in month + monthly summary)
router.delete('/monthly-data', async (req, res, next) => {
  try {
    const { staffId, year, month } = req.query;
    if (!staffId || !year || !month) return res.status(400).json({ message: 'staffId, year and month required' });

    const y = Number(year);
    const mo = Number(month);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return res.status(400).json({ message: 'invalid year/month' });

    const startDate = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));

    const delRes = await Attendance.deleteMany({ staffId: String(staffId), date: { $gte: startDate, $lte: endDate } });
    await AttendanceDailyReport.deleteMany({ staffId: String(staffId), date: { $gte: startDate, $lte: endDate } });
    await MonthlySummary.deleteOne({ staffId: String(staffId), year: y, month: mo });

    res.json({ ok: true, deletedCount: delRes.deletedCount || 0 });
  } catch (err) {
    next(err);
  }
});

// Get day-data (returns per-staff row that includes dailyData for the requested date)
// Also supports range query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/day-data', async (req, res, next) => {
  try {
    const { date, startDate, endDate } = req.query;

    let start, end;
    if (startDate && endDate) {
      const s = startDate.split('-');
      const e = endDate.split('-');
      start = new Date(Date.UTC(s[0], s[1]-1, s[2], 0, 0, 0));
      end   = new Date(Date.UTC(e[0], e[1]-1, e[2], 23, 59, 59, 999));
    } else if (date) {
      const d = date.split('-');
      start = new Date(Date.UTC(d[0], d[1]-1, d[2], 0, 0, 0));
      end   = new Date(Date.UTC(d[0], d[1]-1, d[2], 23, 59, 59, 999));
    } else {
      return res.status(400).json({ message: 'date or startDate+endDate required' });
    }

    const dailyReports = await AttendanceDailyReport.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 }).lean();

    const map = {};
    dailyReports.forEach((rec) => {
      const sid = String(rec.staffId || '').trim().toUpperCase();
      if (!sid) return;

      if (!map[sid]) {
        map[sid] = {
          staffId: sid,
          name: rec.staffName || '',
          khmerName: rec.staffName || '',
          dailyData: [],
          checkinLateCount: 0,
          checkinLateMinutes: 0,
          checkoutEarlyCount: 0,
          checkoutEarlyMinutes: 0,
          workTime: 0,
          plech: 0,
          attendanceCount: 0,
          absentCount: 0,
          leaveCount: 0,
          leaveType: '',
          leaveReason: '',
          department: rec.department || '',
          employeeCategory: rec.employeeCategory || ''
        };
      }
      
      const tgt = map[sid];
      if (rec.isLate) tgt.checkinLateCount += 1;
      if (rec.leftEarly) tgt.checkoutEarlyCount += 1;
      if (rec.status === 'absent') tgt.absentCount += 1;
      if (rec.status === 'leave') tgt.leaveCount += 1;
      if (rec.plech) tgt.plech += 1;

      // User mapping request: leaveTyp, checkin1, checkout1
      const lt = (rec.leaveType || rec.leaveTyp || '').toString().trim();
      if (lt && lt !== '—') {
        if (!tgt.leaveType.includes(lt)) {
          tgt.leaveType = tgt.leaveType ? `${tgt.leaveType}, ${lt}` : lt;
        }
      }
      
      const lr = (rec.leaveReason || '').toString().trim();
      if (lr && lr !== '—') {
        if (!tgt.leaveReason.includes(lr)) {
          tgt.leaveReason = tgt.leaveReason ? `${tgt.leaveReason}, ${lr}` : lr;
        }
      }
      
      if (rec.workHours) tgt.workTime += Math.round(Number(rec.workHours) * 60);
      
      const cin = rec.checkin1 || rec.checkIn || '';
      const cout = rec.checkout1 || rec.checkOut || '';
      if (cin || cout) tgt.attendanceCount += 1;

      tgt.dailyData.push({
        _id: rec._id,
        date: rec.date.toISOString().slice(0, 10),
        checkIn: cin,
        checkOut: cout,
        status: rec.status || '',
        isLate: !!rec.isLate,
        leftEarly: !!rec.leftEarly,
        leaveType: lt,
        leaveReason: lr,
        remarks: rec.remarks || ''
      });
    });

    Object.values(map).forEach((tgt) => {
      if (tgt.dailyData.length > 0) {
        const last = tgt.dailyData[tgt.dailyData.length - 1];
        tgt.checkIn = last.checkIn;
        tgt.checkOut = last.checkOut;
        tgt.status = last.status;
        tgt.remarks = last.remarks || '';
      }
    });

    res.json(Object.values(map));
  } catch (err) {
    next(err);
  }
});

// Monthly CSV report for civil & contract staff (daily rows)
    router.get('/monthly-report', async (req, res, next) => {
      try {
        const { year, month } = req.query;
        if (!year || !month) return res.status(400).json({ message: 'year and month required' });
        const y = Number(year);
        const mo = Number(month);
        if (!Number.isFinite(y) || !Number.isFinite(mo)) return res.status(400).json({ message: 'invalid year/month' });

        const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));

        const hrs = await HR.find({ status: { $nin: ['Resigned', 'Deleted'] } }).lean();

        const catMap = {
          civil: ['មន្ត្រីរាជការ', 'Civil', 'civil'],
          contract: ['កិច្ចសន្យា', 'contract', 'កម្មករកិច្ចសន្យា', 'WORKER']
        };

        const selected = [];
        hrs.forEach(h => {
          const ot = (h.officerType || '').toString().toLowerCase();
          const text = [h.civilServantReason, h.reason, h.other, h.workOther, h.civilServantRole, h.position, h.officerType]
            .map(x => (x || '').toString().toLowerCase()).join(' ');
          const isCivil = catMap.civil.some(t => ot.includes(t.toLowerCase()) || text.includes(t.toLowerCase()));
          const isContract = catMap.contract.some(t => ot.includes(t.toLowerCase()) || text.includes(t.toLowerCase()));
          if (isCivil || isContract) selected.push(h);
        });

        const staffIds = selected.map(s => String(s.staffId).trim()).filter(Boolean);

        const raws = await Attendance.find({ staffId: { $in: staffIds }, date: { $gte: start, $lte: end } }).lean();
        const imported = await AttendanceDayData.find({ staffId: { $in: staffIds }, date: { $gte: start, $lte: end } }).lean();

        const map = {};
        selected.forEach(s => { map[String(s.staffId).trim()] = { staffId: String(s.staffId).trim(), name: s.name || s.khmerName || '', officerType: s.officerType || '', rows: {} }; });

        const setRec = (sid, dateStr, obj) => {
          if (!map[sid]) return;
          map[sid].rows[dateStr] = Object.assign({}, map[sid].rows[dateStr] || {}, obj);
        };

        raws.forEach(r => {
          const sid = String(r.staffId || '').trim();
          if (!sid) return;
          const dateStr = new Date(r.date).toISOString().slice(0, 10);
          setRec(sid, dateStr, {
            checkIn: r.checkIn || r.inTime || '',
            checkOut: r.checkOut || r.outTime || '',
            status: r.status || ''
          });
        });

        imported.forEach(r => {
          const sid = String(r.staffId || '').trim();
          if (!sid) return;
          const dateStr = new Date(r.date).toISOString().slice(0, 10);
          setRec(sid, dateStr, {
            checkIn: r.checkIn || '',
            checkOut: r.checkOut || '',
            status: r.status || '',
            dayWorkCount: r.dayWorkCount,
            attendanceCount: r.attendanceCount,
            workTime: r.workTime,
            clockMinutes: r.clockMinutes,
            clockCount: r.clockCount,
            checkinLateMinutes: r.checkinLateMinutes,
            checkoutEarlyMinutes: r.checkoutEarlyMinutes,
            Plech: r.Plech || ''
          });
        });

        const daysInMonth = new Date(y, mo, 0).getDate();
        const header = ['staffId', 'name', 'officerType', 'date', 'checkIn', 'checkOut', 'status', 'workTime', 'clockMinutes', 'clockCount', 'Plech'];

        let csv = header.join(',') + '\n';
        for (const sid of Object.keys(map)) {
          for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
            const dateStr = dt.toISOString().slice(0, 10);
            const rec = map[sid].rows[dateStr] || {};
            const row = [sid, map[sid].name, map[sid].officerType, dateStr, rec.checkIn || '', rec.checkOut || '', rec.status || '', rec.workTime || '', rec.clockMinutes || '', rec.clockCount || '', rec.Plech || ''];
            const esc = row.map(v => {
              if (v === null || typeof v === 'undefined') v = '';
              const s = String(v);
              if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
              return s;
            });
            csv += esc.join(',') + '\n';
          }
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="attendance_${y}_${String(mo).padStart(2, '0')}.csv"`);
        res.send(csv);
      } catch (err) {
        next(err);
      }
    });

// Import/save day data rows to attendancedaydata collection
router.post('/day-data', async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ message: 'payload required' });
    const records = Array.isArray(payload) ? payload : [payload];
    let upserted = 0;

    const scheduleCache = new Map();

    const getScheduleFor = async (staffId, dateOnly) => {
      const key = `${String(staffId)}|${dateOnly.toISOString().slice(0, 10)}`;
      if (scheduleCache.has(key)) return scheduleCache.get(key);
      let schedule = null;
      try {
        const emp = await WorkScheduleEmployee.findOne({ staffId: String(staffId) }).lean();
        if (emp?._id) {
          const start = new Date(dateOnly);
          const end = new Date(dateOnly);
          end.setHours(23, 59, 59, 999);
          schedule = await WorkSchedule.findOne({ employeeId: emp._id, date: { $gte: start, $lte: end } }).lean();
        }
      } catch {
        schedule = null;
      }
      scheduleCache.set(key, schedule);
      return schedule;
    };

    for (const rec of records) {
      try {
        if (!rec || !rec.staffId) continue;
        let dateObj = null;
        if (rec.date) dateObj = new Date(rec.date);
        else if (rec.day && rec.year && rec.month) dateObj = new Date(Number(rec.year), Number(rec.month) - 1, Number(rec.day));
        if (!dateObj || isNaN(dateObj.getTime())) continue;

        const dateOnly = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
        const staffId = String(rec.staffId).replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
        if (!staffId) continue;

        const filter = { staffId, date: dateOnly };
        const doc = {
          staffId,
          name: rec.name || rec.staffName || '',
          date: dateOnly,
          checkIn: rec.checkIn || rec.checkInShort || '',
          checkOut: rec.checkOut || rec.checkOutShort || '',
          status: rec.status || ((rec.checkIn || rec.checkOut) ? 'present' : 'absent'),
          dayWorkCount: toNumOr0(rec.dayWorkCount),
          attendanceCount: toNumOr0(rec.attendanceCount),
          workTime: toNumOr0(rec.workTime),
          clockMinutes: toNumOr0(rec.clockMinutes ?? rec.clock),
          clockCount: toNumOr0(rec.clockCount),
          checkinLateMinutes: toNumOr0(rec.checkinLateMinutes),
          checkinLateCount: toNumOr0(rec.checkinLateCount),
          checkoutEarlyMinutes: toNumOr0(rec.checkoutEarlyMinutes),
          checkoutEarlyCount: toNumOr0(rec.checkoutEarlyCount),
          checkoutOvertimeMinutes: toNumOr0(rec.checkoutOvertimeMinutes),
          checkoutOvertimeCount: toNumOr0(rec.checkoutOvertimeCount),
          absentCount: toNumOr0(rec.absentCount),
          leaveCount: toNumOr0(rec.leaveCount),
          forgotCount: toNumOr0(rec.forgotCount),
          A: (typeof rec.A === 'string') ? rec.A : (rec.A != null ? String(rec.A) : ''),
          Plech: (typeof rec.Plech === 'string') ? rec.Plech : (rec.Plech != null ? String(rec.Plech) : ''),
          updatedAt: new Date()
        };

        // Auto compute (keep computed values unless client explicitly provides numbers)
        try {
          const hasIn = !!String(doc.checkIn || '').trim();
          const hasOut = !!String(doc.checkOut || '').trim();
          const grace = Number.isFinite(Number(rec.graceMinutes)) ? Number(rec.graceMinutes) : 15;

          if (!String(doc.Plech || '').trim()) doc.Plech = (hasIn && !hasOut) ? '1' : '';

          const schedule = await getScheduleFor(staffId, dateOnly);
          const shiftTitleRaw = String(schedule?.shiftTitle || '').trim();
          const shiftTitle = shiftTitleRaw.toLowerCase();
          const isDayOff =
            shiftTitle === 'day off' ||
            shiftTitle.includes('dayoff') ||
            shiftTitle.includes('day off') ||
            shiftTitle.includes('off') ||
            shiftTitle.includes('rest') ||
            shiftTitle.includes('holiday') ||
            shiftTitleRaw.includes('សម្រាក') ||
            shiftTitleRaw.includes('ឈប់');
          const shiftStartMin = parseHM(schedule?.shiftStart);
          const shiftEndMin = parseHM(schedule?.shiftEnd);
          const checkInMin = parseHM(doc.checkIn);
          const checkOutMin = parseHM(doc.checkOut);

          const scheduledMinutes = (() => {
            if (isDayOff) return 0;
            if (shiftStartMin === null || shiftEndMin === null) return null;
            let diff = shiftEndMin - shiftStartMin;
            if (diff < 0) diff += 24 * 60;
            return Math.max(0, diff);
          })();

          const lateByTime = !isDayOff && shiftStartMin !== null && checkInMin !== null && checkInMin > (shiftStartMin + grace);
          const earlyByTime = !isDayOff && shiftEndMin !== null && checkOutMin !== null && checkOutMin < shiftEndMin;
          const overtimeByTime = !isDayOff && shiftEndMin !== null && checkOutMin !== null && checkOutMin > shiftEndMin;

          const computedLateMinutes = lateByTime ? Math.max(0, checkInMin - (shiftStartMin + grace)) : 0;
          const computedEarlyMinutes = earlyByTime ? Math.max(0, shiftEndMin - checkOutMin) : 0;
          const computedOvertimeMinutes = overtimeByTime ? Math.max(0, checkOutMin - shiftEndMin) : 0;

          if (typeof rec.dayWorkCount !== 'number') doc.dayWorkCount = isDayOff ? 0 : 1;
          if (typeof rec.attendanceCount !== 'number') doc.attendanceCount = (hasIn || hasOut) ? 1 : 0;

          // Work Time (Q-mn) should reflect scanned in/out duration, not scheduled shift duration.
          // (We compute it from checkIn/checkOut below.)

          if (!String(rec.status || '').trim() && isDayOff && !hasIn && !hasOut) doc.status = 'off';

          const st0 = String(doc.status || '').trim() || ((hasIn || hasOut) ? 'present' : 'absent');
          // If the arrival is physically punctual (not lateByTime), we reject the 'late' status string.
          const st = (st0 === 'late' && !lateByTime && !isDayOff) ? 'present' : st0;
          doc.status = st;

          doc.forgotCount = (typeof rec.forgotCount === 'number') ? rec.forgotCount : ((st === 'forgot' || (hasIn && !hasOut)) ? 1 : 0);
          doc.checkinLateCount = (typeof rec.checkinLateCount === 'number') ? rec.checkinLateCount : (lateByTime ? 1 : 0);
          doc.checkoutEarlyCount = (typeof rec.checkoutEarlyCount === 'number') ? rec.checkoutEarlyCount : (earlyByTime ? 1 : 0);
          doc.checkoutOvertimeCount = (typeof rec.checkoutOvertimeCount === 'number') ? rec.checkoutOvertimeCount : (overtimeByTime ? 1 : 0);


          if (typeof rec.absentCount !== 'number') doc.absentCount = (doc.status === 'off') ? 0 : (st === 'absent' ? 1 : 0);
          if (typeof rec.leaveCount !== 'number') doc.leaveCount = st === 'leave' ? 1 : 0;

          // FORCE synchronization of late/early minutes/counts based on times
          doc.checkinLateMinutes = computedLateMinutes;
          doc.checkoutEarlyMinutes = computedEarlyMinutes;
          doc.checkoutOvertimeMinutes = computedOvertimeMinutes;
          
          doc.checkinLateCount = lateByTime ? 1 : 0;
          doc.checkoutEarlyCount = earlyByTime ? 1 : 0;
          doc.checkoutOvertimeCount = overtimeByTime ? 1 : 0;

        } catch {
          // ignore
        }

        // compute clockMinutes/workTime from checkIn/checkOut if not provided
        try {
          if ((!doc.clockMinutes || doc.clockMinutes === 0) && (doc.checkIn || doc.checkOut)) {
            const inMin = parseHM(doc.checkIn);
            const outMin = parseHM(doc.checkOut);
            if (inMin !== null && outMin !== null) {
              let diff = outMin - inMin;
              if (diff < 0) diff += 24 * 60;
              if (diff < 0) diff = 0;
              doc.clockMinutes = diff;
              if (!doc.clockCount || doc.clockCount === 0) doc.clockCount = (doc.checkIn ? 1 : 0) + (doc.checkOut ? 1 : 0);
            }
          }
          if ((!doc.workTime || doc.workTime === 0) && (doc.checkIn || doc.checkOut)) {
            const inMin = parseHM(doc.checkIn);
            const outMin = parseHM(doc.checkOut);
            if (inMin !== null && outMin !== null) {
              let diff = outMin - inMin;
              if (diff < 0) diff += 24 * 60;
              if (diff < 0) diff = 0;
              doc.workTime = diff;
            }
          }
        } catch {
          // ignore
        }

        const saved = await AttendanceDayData.findOneAndUpdate(filter, { $set: doc }, { upsert: true, new: true });
        if (saved) upserted++;
      } catch (e) {
        console.error('Failed saving day row', e);
      }
    }

    res.json({ ok: true, upserted });
  } catch (err) {
    next(err);
  }
});

// Delete by selected date or date range
router.delete('/day-data', async (req, res, next) => {
  try {
    const { date, from, to } = req.query;

    let start = null;
    let end = null;
    if (from || to) {
      if (!from || !to) return res.status(400).json({ message: 'from and to required (YYYY-MM-DD)' });
      const f = parseYMD(from);
      const t = parseYMD(to);
      if (!f || !t) return res.status(400).json({ message: 'invalid from/to (expected YYYY-MM-DD)' });
      // Wider range to catch both UTC midnight and Local (+7) midnight (which is previous day 17:00 UTC)
      start = new Date(Date.UTC(f.y, f.mo - 1, f.da, 0, 0, 0));
      start.setHours(start.getHours() - 12); 
      end = new Date(Date.UTC(t.y, t.mo - 1, t.da, 23, 59, 59, 999));
      end.setHours(end.getHours() + 12);
      if (start > end) return res.status(400).json({ message: 'from must be <= to' });
    } else {
      if (!date) return res.status(400).json({ message: 'date required (YYYY-MM-DD) or from/to' });
      const d = parseYMD(date);
      if (!d) return res.status(400).json({ message: 'invalid date (expected YYYY-MM-DD)' });
      start = new Date(Date.UTC(d.y, d.mo - 1, d.da, 0, 0, 0));
      start.setHours(start.getHours() - 12);
      end = new Date(Date.UTC(d.y, d.mo - 1, d.da, 23, 59, 59, 999));
      end.setHours(end.getHours() + 12);
    }

    const [attRes, dayRes, dailyRepRes] = await Promise.all([
      Attendance.deleteMany({ date: { $gte: start, $lte: end } }),
      AttendanceDayData.deleteMany({ date: { $gte: start, $lte: end } }),
      AttendanceDailyReport.deleteMany({ date: { $gte: start, $lte: end } })
    ]);

    const msResults = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

    while (cur <= endMonth) {
      const y = cur.getUTCFullYear();
      const mo = cur.getUTCMonth() + 1;
      const monthStart = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
      const rangeStart = start > monthStart ? start : monthStart;
      const rangeEnd = end < monthEnd ? end : monthEnd;

      const d1 = rangeStart.getUTCDate();
      const d2 = rangeEnd.getUTCDate();
      const rangeStartISO = rangeStart.toISOString().slice(0, 10);
      const rangeEndISO = rangeEnd.toISOString().slice(0, 10);

      const msRes = await MonthlySummary.updateMany(
        { year: y, month: mo },
        {
          $pull: {
            dailyData: {
              $or: [
                { day: { $gte: d1, $lte: d2 } },
                { date: { $gte: rangeStart, $lte: rangeEnd } },
                { date: { $gte: rangeStartISO, $lte: rangeEndISO } }
              ]
            }
          }
        }
      );
      msResults.push(msRes);
      cur.setMonth(cur.getMonth() + 1);
    }

    const matched = msResults.reduce((sum, r) => sum + (r?.matchedCount ?? r?.n ?? 0), 0);
    const modified = msResults.reduce((sum, r) => sum + (r?.modifiedCount ?? r?.nModified ?? 0), 0);

    res.json({
      ok: true,
      start,
      end,
      attendanceDeleted: attRes?.deletedCount || 0,
      dayDataDeleted: dayRes?.deletedCount || 0,
      dailyReportDeleted: dailyRepRes?.deletedCount || 0,
      monthlySummariesMatched: matched,
      monthlySummariesModified: modified
    });
  } catch (err) {
    next(err);
  }
});

// Delete day-data for one staff on a given date (both raw Attendance and imported AttendanceDayData)
router.delete('/day-data/one', async (req, res, next) => {
  try {
    const { staffId, date } = req.query;
    if (!staffId) return res.status(400).json({ message: 'staffId required' });
    if (!date) return res.status(400).json({ message: 'date required (YYYY-MM-DD)' });
    const d = parseYMD(date);
    if (!d) return res.status(400).json({ message: 'invalid date (expected YYYY-MM-DD)' });
    const start = new Date(Date.UTC(d.y, d.mo - 1, d.da, 0, 0, 0));
    const end = new Date(Date.UTC(d.y, d.mo - 1, d.da, 23, 59, 59, 999));

    const y = d.y;
    const mo = d.mo;
    const da = d.da;

    const [attRes, dayRes, msRes, dailyRepRes] = await Promise.all([
      Attendance.deleteMany({ staffId: String(staffId), date: { $gte: start, $lte: end } }),
      AttendanceDayData.deleteMany({ staffId: String(staffId), date: { $gte: start, $lte: end } }),
      AttendanceDailyReport.deleteMany({ staffId: String(staffId), date: { $gte: start, $lte: end } }),
      MonthlySummary.updateMany(
        { staffId: String(staffId), year: y, month: mo },
        {
          $pull: {
            dailyData: {
              $or: [
                { day: da },
                { date: { $gte: start, $lte: end } },
                { date: String(date).trim() }
              ]
            }
          }
        }
      )
    ]);

    res.json({
      ok: true,
      attendanceDeleted: attRes?.deletedCount || 0,
      dayDataDeleted: dayRes?.deletedCount || 0,
      monthlySummariesMatched: msRes?.matchedCount ?? msRes?.n ?? 0,
      monthlySummariesModified: msRes?.modifiedCount ?? msRes?.nModified ?? 0
    });
  } catch (err) {
    next(err);
  }
});

// Debug
router.get('/debug/all-records', async (req, res, next) => {
  try {
    const count = await Attendance.countDocuments();
    const samples = await Attendance.find().limit(5).lean();
    const minDate = await Attendance.findOne().sort({ date: 1 }).lean();
    const maxDate = await Attendance.findOne().sort({ date: -1 }).lean();
    res.json({
      totalRecords: count,
      minDate: minDate?.date,
      maxDate: maxDate?.date,
      samples: samples.map((s) => ({ staffId: s.staffId, date: s.date, checkIn: s.checkIn }))
    });
  } catch (err) {
    next(err);
  }
});

// Get one attendance
router.get('/:id', async (req, res, next) => {
  try {
    const rec = await Attendance.findById(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Not found' });
    res.json(rec);
  } catch (err) {
    next(err);
  }
});

// Update attendance
router.put('/:id', async (req, res, next) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    if (updates.checkInShort) {
      updates.inTime = updates.checkInShort;
      updates.checkIn = updates.checkIn || updates.checkInShort;
    } else if (updates.checkIn) {
      updates.inTime = updates.checkIn;
      updates.checkIn = updates.checkIn;
    }
    if (updates.checkOutShort) {
      updates.outTime = updates.checkOutShort;
      updates.checkOut = updates.checkOut || updates.checkOutShort;
    } else if (updates.checkOut) {
      updates.outTime = updates.checkOut;
      updates.checkOut = updates.checkOut;
    }

    // Slot 2 fields
    if (updates.checkIn2Short) {
      updates.inTime2 = updates.checkIn2Short;
      updates.checkIn2 = updates.checkIn2 || updates.checkIn2Short;
    } else if (updates.checkIn2) {
      updates.inTime2 = updates.checkIn2;
      updates.checkIn2 = updates.checkIn2;
    }
    if (updates.checkOut2Short) {
      updates.outTime2 = updates.checkOut2Short;
      updates.checkOut2 = updates.checkOut2 || updates.checkOut2Short;
    } else if (updates.checkOut2) {
      updates.outTime2 = updates.checkOut2;
      updates.checkOut2 = updates.checkOut2;
    }

    const updated = await Attendance.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete attendance
router.delete('/:id', async (req, res, next) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/attendance/leave-sync
// Receives leave records scraped from Checkinme /admin/leaves
// Payload: { items: [ { name, date, amount, reason, file, type } ] }
router.post('/leave-sync', async (req, res, next) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }

    const results = { imported: 0, matched: 0, unmatched: [], errors: [] };
    const ops = [];

    for (const item of items) {
      const rawName = String(item.name || '').trim();
      if (!rawName) continue;

      // Parse date: could be "Fri 03 Apr 2026 | Full Day" or "2026-04-03"
      let dateStr = null;
      const rawDate = String(item.date || '').trim();
      // Try ISO date format first
      const isoMatch = rawDate.match(/(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) {
        dateStr = isoMatch[1];
      } else {
        // Try "Fri 03 Apr 2026" format
        const monthMap = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
        const dMatch = rawDate.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
        if (dMatch) {
          const day = dMatch[1].padStart(2, '0');
          const month = monthMap[dMatch[2]] || '01';
          dateStr = `${dMatch[3]}-${month}-${day}`;
        }
      }

      if (!dateStr) {
        results.errors.push({ name: rawName, error: `ពុំអាចបកស្រាយថ្ងៃបាន: "${rawDate}"` });
        continue;
      }

      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) {
        results.errors.push({ name: rawName, error: `ថ្ងៃមិនត្រឹមត្រូវ: "${rawDate}"` });
        continue;
      }

      // Resolve staffId by name
      let staffId = item.staffId || null;
      if (!staffId) {
        const hr = await HR.findOne({
          $or: [
            { name: new RegExp(`^${rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { khmerName: new RegExp(`^${rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { nameLatin: new RegExp(`^${rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            { fullName: new RegExp(`^${rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
          ]
        }).lean();

        if (hr) {
          staffId = hr.staffId || hr.no;
          results.matched++;
        }
      }

      if (!staffId) {
        results.unmatched.push(rawName);
        results.errors.push({ name: rawName, error: 'រកមិនឃើញបុគ្គលិក (Staff not found)' });
        continue;
      }

      const leaveAmount = parseFloat(String(item.amount || '1').replace(/[^0-9.]/g, '')) || 1;
      const leaveType = String(item.type || item.leaveType || 'ច្បាប់').trim();
      const leaveReason = String(item.reason || '').trim();

      const doc = {
        staffId: String(staffId).toUpperCase(),
        staffName: rawName,
        date: dateObj,
        status: 'leave',
        leaveCount: leaveAmount,
        leaveType,
        leaveReason,
        notes: `ច្បាប់: ${leaveType}${leaveReason ? ' | ' + leaveReason : ''}${leaveAmount !== 1 ? ' | ' + leaveAmount + ' ថ្ងៃ' : ''}`,
        updatedAt: new Date()
      };

      ops.push({
        updateOne: {
          filter: { staffId, date: dateObj },
          update: { $set: doc },
          upsert: true
        }
      });
    }

    if (ops.length > 0) {
      const bulkRes = await Attendance.bulkWrite(ops, { ordered: false });
      results.imported = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0) + (bulkRes.matchedCount || 0);
    }

    res.json({ ok: true, results });
  } catch (err) {
    next(err);
  }
});

/**
 * Cleans notes by removing common UI phrases captured during scraping
 */
function cleanNote(s) {
  if (!s) return '';
  let n = String(s);
  const toRemove = [
    /Delete\s*Are you sure,\s*you want to delete this record\?\s*Cancel\s*Delete/gi,
    /Are you sure,\s*you want to delete this record\?/gi,
    /Delete\s*Cancel/gi,
    /Confirm\s*delete/gi
  ];
  toRemove.forEach(regex => { n = n.replace(regex, ''); });
  return n.trim();
}

/**
 * Shared helper to process and save attendance items to database.
 * Optimized with bulk lookups for HR and WorkSchedules.
 */
async function processAttendanceSyncItems(items) {
  const results = { imported: 0, matched: 0, unmatched: [], errors: [] };
  if (!items || items.length === 0) return results;

  // 1. Identify all unique names/ids to pre-fetch HR records
  const rawNames = Array.from(new Set(items.map(it => String(it.name || '').replace(/\s+/g, ' ').trim()).filter(Boolean)));
  const rawSids = Array.from(new Set(items.map(it => String(it.staffId || '').trim()).filter(Boolean)));

  const hrs = await HR.find({
    $or: [
      { name: { $in: rawNames } },
      { khmerName: { $in: rawNames } },
      { nameLatin: { $in: rawNames } },
      { fullName: { $in: rawNames } },
      { staffId: { $in: rawSids } },
      { no: { $in: rawSids } }
    ]
  }).select('_id staffId no Department_Kh department name khmerName').lean();

  // Maps for quick lookup
  const hrBySid = new Map();
  const hrByName = new Map();
  const allHrIds = [];

  hrs.forEach(h => {
    allHrIds.push(h._id);
    if (h.staffId) hrBySid.set(String(h.staffId), h);
    if (h.no) hrBySid.set(String(h.no), h);
    if (h.name) hrByName.set(h.name.toLowerCase(), h);
    if (h.khmerName) hrByName.set(h.khmerName, h);
  });

  // 2. Identify all dates to pre-fetch WorkSchedules
  const itemDates = Array.from(new Set(items.map(it => {
    const c = parseCheckinmeTime(it.checkIn);
    const d = c.date || it.date || new Date().toISOString().slice(0, 10);
    return d;
  })));
  const dates = itemDates.map(d => parseYMD(d)?.d).filter(Boolean);

  const schedules = await WorkSchedule.find({
    employeeId: { $in: allHrIds },
    date: { $in: dates }
  }).lean();

  const schedMap = new Map(); // key: HR_ID:YYYY-MM-DD
  schedules.forEach(s => {
    const dStr = s.date.toISOString().slice(0, 10);
    schedMap.set(`${s.employeeId}:${dStr}`, s);
  });

  const ops = [];

  for (const item of items) {
    const rawName = String(item.name || '').trim();
    const rawSid = String(item.staffId || '').trim();
    
    // Lookup HR
    let hr = (rawSid ? hrBySid.get(rawSid) : null) || hrByName.get(rawName.toLowerCase()) || hrByName.get(rawName);
    
    if (!hr) {
      results.unmatched.push(rawName || rawSid);
      continue;
    }
    results.matched++;
    const staffId = hr.staffId || hr.no;

    // Determine times
    const cin = parseCheckinmeTime(item.checkIn);
    const cout = parseCheckinmeTime(item.checkOut);
    const cin2 = parseCheckinmeTime(item.checkIn2);
    const cout2 = parseCheckinmeTime(item.checkOut2);

    const dateStr = cin.date || cout.date || cin2.date || item.date || new Date().toISOString().slice(0, 10);
    const d = parseYMD(dateStr);
    if (!d) continue;

    const curDateStr = d.d.toISOString().slice(0, 10);
    const schedule = schedMap.get(`${hr._id}:${curDateStr}`);

    let isLate = false;
    let lateMinutes = 0;
    let leftEarly = false;
    let earlyMinutes = 0;

    // Use Checkinme's provided status as a fallback only if no schedule is found
    const cinStatus = (cin.status || '').toLowerCase();
    const coutStatus = (cout.status || '').toLowerCase();
    
    isLate = cinStatus.includes('late');
    leftEarly = coutStatus.includes('early') || coutStatus.includes('left');

    // Override with strict 15-minute grace period logic if schedule is found
    if (schedule && schedule.shiftStart && cin.time) {
      const schMin = parseHM(schedule.shiftStart);
      const chkMin = parseHM(cin.time);
      if (schMin !== null && chkMin !== null) {
        const grace = 15; // 15 min grace
        if (chkMin > schMin + grace) {
          isLate = true;
          lateMinutes = Math.max(0, chkMin - schMin);
        } else {
          isLate = false;
          lateMinutes = 0;
        }
      }
    }

    if (schedule && schedule.shiftEnd && cout.time) {
      const schEndMin = parseHM(schedule.shiftEnd);
      const chkOutMin = parseHM(cout.time);
      if (schEndMin !== null && chkOutMin !== null) {
        if (chkOutMin < schEndMin) {
          leftEarly = true;
          earlyMinutes = Math.max(0, schEndMin - chkOutMin);
        } else {
          leftEarly = false;
          earlyMinutes = 0;
        }
      }
    }

    const doc = {
      staffId: String(staffId).toUpperCase(),
      staffName: rawName,
      date: d.d,
      checkIn: cin.iso || item.checkIn || '',
      checkOut: cout.iso || item.checkOut || '',
      checkIn2: cin2.iso || item.checkIn2 || '',
      inTime: cin.time || '',
      outTime: cout.time || '',
      inTime2: cin2.time || '',
      status: (cin.status || cout.status || item.status || (item.checkIn || item.checkOut ? 'present' : 'absent')).toLowerCase(),
      isLate,
      lateMinutes,
      leftEarly,
      earlyMinutes,
      notes: cleanNote((item.service ? item.service + ' - ' : '') + (item.note || '')),
      service: '', 
      departmentKh: hr.Department_Kh || hr.department || '',
      updatedAt: new Date()
    };

    ops.push({
      updateOne: {
        filter: { staffId, date: d.d },
        update: { $set: doc },
        upsert: true
      }
    });
  }

  if (ops.length > 0) {
    const bulkRes = await Attendance.bulkWrite(ops, { ordered: false });
    results.imported = (bulkRes.upsertedCount || 0) + (bulkRes.matchedCount || 0) + (bulkRes.modifiedCount || 0);
  }

  return results;
}

// POST /api/attendance/auto-sync-checkinme
router.post('/auto-sync-checkinme', authRequired, requireAnyPermission(['view:attendance']), async (req, res, next) => {
  try {
    const { date } = req.body || {};
    // If no date provided, scraper might fetch today or a list
    const items = await scrapeCheckinmeAttendances({ date });
    
    if (!items || items.length === 0) {
      return res.json({ ok: true, message: 'No records found on Checkinme', results: { imported: 0 } });
    }

    const results = await processAttendanceSyncItems(items);
    res.json({ ok: true, results });
  } catch (err) {
    next(err);
  }
});


// POST /api/attendance/bulk-sync
router.post('/bulk-sync', authRequired, requireAnyPermission(['view:attendance']), async (req, res, next) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }
    const results = await processAttendanceSyncItems(items);
    res.json({ ok: true, results });
  } catch (err) {
    next(err);
  }
});


export default router;
