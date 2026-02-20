import express from 'express';
import Attendance from '../models/Attendance.js';
import MonthlySummary from '../models/MonthlySummary.js';
import AttendanceDayData from '../models/AttendanceDayData.js';
import WorkSchedule from '../models/WorkSchedule.js';
import WorkScheduleEmployee from '../models/WorkScheduleEmployee.js';
import HR from '../models/hr.js';

const router = express.Router();

const parseYMD = (v) => {
  const m = String(v || '').trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const d = new Date(y, mo - 1, da);
  if (isNaN(d.getTime())) return null;
  return { y, mo, da, d };
};

const parseHM = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
  return null;
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
        const grace = Number(payload.scheduledGraceMinutes || 0);
        if (schMin !== null && chkMin !== null && chkMin > schMin + grace) {
          recData.isLate = true;
          recData.lateMinutes = Math.max(0, chkMin - (schMin + grace));
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

// Get list with optional filters: staffId, from, to
router.get('/', async (req, res, next) => {
  try {
    const { staffId, from, to, date } = req.query;
    const q = {};
    if (staffId) q.staffId = String(staffId).trim();
    // Support filtering by a single day: ?date=YYYY-MM-DD
    // Stored dates are created from YYYY-MM-DD strings (UTC midnight), so query using UTC day range.
    if (date) {
      const d = parseYMD(date);
      if (!d) return res.status(400).json({ message: 'invalid date (expected YYYY-MM-DD)' });
      const start = new Date(Date.UTC(d.y, d.mo - 1, d.da));
      const end = new Date(Date.UTC(d.y, d.mo - 1, d.da + 1));
      q.date = { $gte: start, $lt: end };
    } else {
      if (from || to) q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to) q.date.$lte = new Date(to);
    }
    const items = await Attendance.find(q).sort({ date: -1 });
    res.json(items);
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
    const start = new Date(d.y, d.mo - 1, d.da);
    const end = new Date(d.y, d.mo - 1, d.da, 23, 59, 59, 999);
    const items = await Attendance.find({ date: { $gte: start, $lte: end } }).lean();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// Get monthly data
router.get('/monthly-data', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ message: 'year and month required' });
    const y = Number(year);
    const mo = Number(month);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return res.status(400).json({ message: 'invalid year/month' });

    const startDate = new Date(y, mo - 1, 1);
    const endDate = new Date(y, mo, 0, 23, 59, 59, 999);

    const summaries = await MonthlySummary.find({ year: y, month: mo }).lean();
    const raw = await Attendance.find({ date: { $gte: startDate, $lte: endDate } }).lean();

    const attMap = {};
    raw.forEach((r) => {
      const sid = r.staffId;
      if (!sid) return;
      if (!attMap[sid]) attMap[sid] = [];
      attMap[sid].push({
        _id: r._id,
        day: new Date(r.date).getDate(),
        date: r.date,
        checkIn: r.checkIn || r.inTime || '',
        checkOut: r.checkOut || r.outTime || '',
        status: r.status || ''
      });
    });

    const rows = summaries.map((s) => {
      const sid = s.staffId;
      const dailyFromRaw = (attMap[sid] || []).sort((a, b) => a.day - b.day);
      const dailyData = dailyFromRaw.length > 0 ? dailyFromRaw : (s.dailyData || []);

      return {
        staffId: s.staffId,
        name: s.name || '',
        leaveType: s.leaveType || '',
        other: s.other || '',
        totalLeaveComment: s.totalLeaveComment || '',
        dailyData,
        dayWorkCount: s.dayWorkCount || 0,
        attendanceCount: s.attendanceCount || 0,
        workTime: s.workTime || '',
        clock: s.clock || 0,
        clockCount: s.clockCount || 0,
        checkinLateMinutes: s.checkinLateMinutes || 0,
        checkinLateCount: s.checkinLateCount || 0,
        checkoutEarlyMinutes: s.checkoutEarlyMinutes || 0,
        checkoutEarlyCount: s.checkoutEarlyCount || 0,
        checkoutOvertimeMinutes: s.checkoutOvertimeMinutes || 0,
        checkoutOvertimeCount: s.checkoutOvertimeCount || 0,
        absentCount: s.absentCount || 0,
        leaveCount: s.leaveCount || 0,
        A: s.A || 0,
        plech: s.plech || 0,
        month: s.month,
        year: s.year
      };
    });

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Import/save month summaries (and also upsert Attendance raw rows)
router.post('/monthly-data', async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ message: 'payload required' });
    const records = Array.isArray(payload) ? payload : [payload];

    const attendanceOps = [];
    const monthlyOps = [];

    for (const rec of records) {
      if (!rec || !rec.staffId) continue;
      const staffId = String(rec.staffId).trim();
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
        const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
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
    if (attendanceOps.length > 0) attendanceResult = await Attendance.bulkWrite(attendanceOps, { ordered: false });
    if (monthlyOps.length > 0) monthlyResult = await MonthlySummary.bulkWrite(monthlyOps, { ordered: false });

    res.json({
      ok: true,
      attendanceUpserted: attendanceResult?.upsertedCount ?? 0,
      attendanceModified: attendanceResult?.modifiedCount ?? 0,
      monthlyUpserted: monthlyResult?.upsertedCount ?? 0,
      monthlyModified: monthlyResult?.modifiedCount ?? 0
    });
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

    const startDate = new Date(y, mo - 1, 1);
    const endDate = new Date(y, mo, 0, 23, 59, 59, 999);

    const delRes = await Attendance.deleteMany({ staffId: String(staffId), date: { $gte: startDate, $lte: endDate } });
    await MonthlySummary.deleteOne({ staffId: String(staffId), year: y, month: mo });

    res.json({ ok: true, deletedCount: delRes.deletedCount || 0 });
  } catch (err) {
    next(err);
  }
});

// Get day-data (returns per-staff row that includes dailyData for the requested date)
router.get('/day-data', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date required (YYYY-MM-DD)' });
    const d = parseYMD(date);
    if (!d) return res.status(400).json({ message: 'invalid date' });
    const start = new Date(d.y, d.mo - 1, d.da);
    const end = new Date(d.y, d.mo - 1, d.da, 23, 59, 59, 999);

    const raws = await Attendance.find({ date: { $gte: start, $lte: end } }).lean();
    const imported = await AttendanceDayData.find({ date: { $gte: start, $lte: end } }).lean();

    const map = {};
    raws.forEach((rec) => {
      const sid = String(rec.staffId || '').trim();
      if (!sid) return;
      if (!map[sid]) map[sid] = { staffId: sid, name: rec.staffName || '', dailyData: [] };
      map[sid].dailyData.push({
        _id: rec._id,
        date: new Date(rec.date).toISOString().slice(0, 10),
        checkIn: rec.checkIn || rec.inTime || '',
        checkOut: rec.checkOut || rec.outTime || '',
        status: rec.status || ''
      });
    });

    imported.forEach((rec) => {
      const sid = String(rec.staffId || '').trim();
      if (!sid) return;
      if (!map[sid]) map[sid] = { staffId: sid, name: rec.name || '', dailyData: [] };
      map[sid].dailyData.push({
        _id: rec._id,
        date: new Date(rec.date).toISOString().slice(0, 10),
        checkIn: rec.checkIn || '',
        checkOut: rec.checkOut || '',
        status: rec.status || ''
      });

      const tgt = map[sid];
      if (typeof rec.dayWorkCount === 'number') tgt.dayWorkCount = rec.dayWorkCount;
      if (typeof rec.attendanceCount === 'number') tgt.attendanceCount = rec.attendanceCount;
      if (typeof rec.workTime === 'number') tgt.workTime = rec.workTime;
      if (typeof rec.clockMinutes === 'number') tgt.clockMinutes = rec.clockMinutes;
      if (typeof rec.clockCount === 'number') tgt.clockCount = rec.clockCount;
      if (typeof rec.checkinLateMinutes === 'number') tgt.checkinLateMinutes = rec.checkinLateMinutes;
      if (typeof rec.checkinLateCount === 'number') tgt.checkinLateCount = rec.checkinLateCount;
      if (typeof rec.checkoutEarlyMinutes === 'number') tgt.checkoutEarlyMinutes = rec.checkoutEarlyMinutes;
      if (typeof rec.checkoutEarlyCount === 'number') tgt.checkoutEarlyCount = rec.checkoutEarlyCount;
      if (typeof rec.checkoutOvertimeMinutes === 'number') tgt.checkoutOvertimeMinutes = rec.checkoutOvertimeMinutes;
      if (typeof rec.checkoutOvertimeCount === 'number') tgt.checkoutOvertimeCount = rec.checkoutOvertimeCount;
      if (typeof rec.absentCount === 'number') tgt.absentCount = rec.absentCount;
      if (typeof rec.leaveCount === 'number') tgt.leaveCount = rec.leaveCount;
      if (typeof rec.forgotCount === 'number') tgt.forgotCount = rec.forgotCount;
      if (typeof rec.A === 'string') tgt.A = rec.A;
      if (typeof rec.Plech === 'string') tgt.Plech = rec.Plech;
    });

    // Auto-derive Plech when missing: check-in exists but no check-out.
    Object.values(map).forEach((tgt) => {
      const existing = String(tgt?.Plech || '').trim();
      if (existing) return;
      const last = Array.isArray(tgt?.dailyData) && tgt.dailyData.length ? tgt.dailyData[tgt.dailyData.length - 1] : null;
      const hasIn = !!String(last?.checkIn || '').trim();
      const hasOut = !!String(last?.checkOut || '').trim();
      if (hasIn && !hasOut) tgt.Plech = '1';
    });

    // Auto-derive Work Time (Q-mn) + Clock (Q-mn) from scanned checkIn/checkOut when summary is missing.
    Object.values(map).forEach((tgt) => {
      if (typeof tgt?.workTime === 'number' || typeof tgt?.clockMinutes === 'number') return;
      const last = Array.isArray(tgt?.dailyData) && tgt.dailyData.length ? tgt.dailyData[tgt.dailyData.length - 1] : null;
      const inMin = parseHM(last?.checkIn);
      const outMin = parseHM(last?.checkOut);
      if (inMin === null || outMin === null) {
        tgt.workTime = 0;
        tgt.clockMinutes = 0;
        return;
      }
      let diff = outMin - inMin;
      if (diff < 0) diff += 24 * 60;
      if (diff < 0) diff = 0;
      tgt.workTime = diff;
      tgt.clockMinutes = diff;
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

        const start = new Date(y, mo - 1, 1);
        const end = new Date(y, mo, 0, 23, 59, 59, 999);

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
            const dt = new Date(y, mo - 1, d);
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

        const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const staffId = String(rec.staffId).trim();
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

          const st = String(doc.status || '').trim() || ((hasIn || hasOut) ? 'present' : 'absent');
          doc.forgotCount = (typeof rec.forgotCount === 'number') ? rec.forgotCount : ((st === 'forgot' || (hasIn && !hasOut)) ? 1 : 0);
          doc.checkinLateCount = (typeof rec.checkinLateCount === 'number') ? rec.checkinLateCount : ((st === 'late' || lateByTime) ? 1 : 0);
          doc.checkoutEarlyCount = (typeof rec.checkoutEarlyCount === 'number') ? rec.checkoutEarlyCount : ((st === 'early' || earlyByTime) ? 1 : 0);
          doc.checkoutOvertimeCount = (typeof rec.checkoutOvertimeCount === 'number') ? rec.checkoutOvertimeCount : (computedOvertimeMinutes > 0 ? 1 : 0);

          if (typeof rec.absentCount !== 'number') doc.absentCount = (doc.status === 'off') ? 0 : (st === 'absent' ? 1 : 0);
          if (typeof rec.leaveCount !== 'number') doc.leaveCount = st === 'leave' ? 1 : 0;

          if (!Number.isFinite(toNumOrUndef(rec.checkinLateMinutes))) doc.checkinLateMinutes = computedLateMinutes;
          if (!Number.isFinite(toNumOrUndef(rec.checkoutEarlyMinutes))) doc.checkoutEarlyMinutes = computedEarlyMinutes;
          if (!Number.isFinite(toNumOrUndef(rec.checkoutOvertimeMinutes))) doc.checkoutOvertimeMinutes = computedOvertimeMinutes;
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
      start = new Date(f.y, f.mo - 1, f.da);
      end = new Date(t.y, t.mo - 1, t.da, 23, 59, 59, 999);
      if (start > end) return res.status(400).json({ message: 'from must be <= to' });
    } else {
      if (!date) return res.status(400).json({ message: 'date required (YYYY-MM-DD) or from/to' });
      const d = parseYMD(date);
      if (!d) return res.status(400).json({ message: 'invalid date (expected YYYY-MM-DD)' });
      start = new Date(d.y, d.mo - 1, d.da);
      end = new Date(d.y, d.mo - 1, d.da, 23, 59, 59, 999);
    }

    const [attRes, dayRes] = await Promise.all([
      Attendance.deleteMany({ date: { $gte: start, $lte: end } }),
      AttendanceDayData.deleteMany({ date: { $gte: start, $lte: end } })
    ]);

    const msResults = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cur <= endMonth) {
      const y = cur.getFullYear();
      const mo = cur.getMonth() + 1;
      const monthStart = new Date(y, mo - 1, 1);
      const monthEnd = new Date(y, mo, 0, 23, 59, 59, 999);
      const rangeStart = start > monthStart ? start : monthStart;
      const rangeEnd = end < monthEnd ? end : monthEnd;

      const d1 = rangeStart.getDate();
      const d2 = rangeEnd.getDate();
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
    const start = new Date(d.y, d.mo - 1, d.da);
    const end = new Date(d.y, d.mo - 1, d.da, 23, 59, 59, 999);

    const y = d.y;
    const mo = d.mo;
    const da = d.da;

    const [attRes, dayRes, msRes] = await Promise.all([
      Attendance.deleteMany({ staffId: String(staffId), date: { $gte: start, $lte: end } }),
      AttendanceDayData.deleteMany({ staffId: String(staffId), date: { $gte: start, $lte: end } }),
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

export default router;
