export const norm = (str) => String(str || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();

export const pad2 = (n) => String(n).padStart(2, '0');

export const ymdLocal = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const parseHMToMinutes = (s) => {
  if (!s && s !== 0) return null;
  if (typeof s === 'number' && isFinite(s)) return null;
  const str = String(s || '').trim();
  if (!str) return null;
  let m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = str.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
  if (m) {
    let h = Number(m[1]);
    const isPM = m[3].toUpperCase() === 'PM';
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h * 60 + Number(m[2]);
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
  return null;
};

export const checkIsOff = (status, hasAny, sch, dayISO, isWeekend, isHoliday) => {
  const isDayOffBySchedule = sch && (
    (sch.shiftTitle || '').toLowerCase() === 'day off' ||
    (sch.shiftTitle || '').includes('សម្រាក') ||
    (sch.shiftTitle || '').toLowerCase() === 'dayoff'
  );
  const hasScheduleTime = sch && sch.shiftStart && sch.shiftEnd;

  let isOffByStatus = (status === 'rest' || status === 'dayoff' || status === 'off' || status === 'holiday' || isWeekend || isHoliday);

  if (isOffByStatus && hasScheduleTime && !isDayOffBySchedule) {
    isOffByStatus = false;
  }

  if (status === 'leave') return { isOff: !hasAny, effectiveStatus: 'leave', isDayOffBySchedule, hasScheduleTime, isOffByStatus };

  if (isDayOffBySchedule) return { isOff: !hasAny, effectiveStatus: (hasAny ? 'present' : 'rest'), isDayOffBySchedule, hasScheduleTime, isOffByStatus };

  if (isOffByStatus) return { isOff: !hasAny, effectiveStatus: (isHoliday ? 'holiday' : 'rest'), isDayOffBySchedule, hasScheduleTime, isOffByStatus };

  const effectiveStatus = hasAny ? 'present' : 'absent';
  return { isOff: !hasAny, effectiveStatus, isDayOffBySchedule, hasScheduleTime, isOffByStatus };
};

export async function calculateAttendanceData(api, dateFromDate, dateToDate, hrList, departmentsList) {
  const fromObj = new Date(dateFromDate);
  const toObj = new Date(dateToDate);
  
  if (isNaN(fromObj.getTime()) || isNaN(toObj.getTime())) {
    throw new Error('Invalid date parameters');
  }

  let curMonth = new Date(fromObj.getFullYear(), fromObj.getMonth(), 1);
  const endMonth = new Date(toObj.getFullYear(), toObj.getMonth(), 1);
  const months = [];
  while (curMonth <= endMonth) {
    months.push({ year: curMonth.getFullYear(), month: curMonth.getMonth() + 1 });
    curMonth.setMonth(curMonth.getMonth() + 1);
  }

  // default shifts
  const defaultShiftMap = new Map();
  // Instead of hrList, defaultShiftMap should be derived from schedRes after the API call, exactly like AttendancesumDayPage.jsx

  const monthPromises = months.map(({ year, month }) =>
    api.get('/attendance/monthly-data', { params: { year, month } }).catch(() => ({ data: [] }))
  );

  const [schedRes, leaveRes, holidayRes, dayDataRes, ...monthResults] = await Promise.all([
    api.get('/work-schedules', { params: { startDate: dateFromDate, endDate: dateToDate } }).catch(() => ({ data: [] })),
    api.get('/leave-requests', { params: { from: dateFromDate, to: dateToDate } }).catch(() => ({ data: [] })),
    api.get('/holidays').catch(() => ({ data: [] })),
    api.get('/attendance/day-data', { params: { startDate: dateFromDate, endDate: dateToDate } }).catch(() => ({ data: [] })),
    ...monthPromises
  ]);

  const sMap = new Map();
  const schedList = Array.isArray(schedRes.data) ? schedRes.data : [];
  schedList.forEach(s => {
    if (!s.employeeId || !s.date) return;
    const sid = norm(s.employeeId.staffId || s.employeeId.no);
    const dateKey = ymdLocal(s.date);
    if (sid && dateKey) {
      sMap.set(`${sid}_${dateKey}`, {
        shiftTitle: s.shiftTitle,
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        scheduledGraceMinutes: s.scheduledGraceMinutes || 15
      });
    }
  });

  schedList.forEach(s => {
    const sid = norm(s.employeeId?.staffId || s.staffId);
    if (!sid || defaultShiftMap.has(sid)) return;

    const isDayOff = (s.shiftTitle || '').toLowerCase() === 'day off' || (s.shiftTitle || '').includes('សម្រាក');
    if (!isDayOff && s.shiftStart && s.shiftEnd) {
      defaultShiftMap.set(sid, {
        shiftStart: s.shiftStart,
        shiftEnd: s.shiftEnd,
        grace: s.scheduledGraceMinutes || 15
      });
    }
  });

  const lMap = new Map();
  const leaveList = Array.isArray(leaveRes.data) ? leaveRes.data : [];
  leaveList.forEach(l => {
    if (!l.staffId || !l.startDate || !l.endDate) return;
    const s = (l.status || '').toLowerCase();
    if (s !== 'approved' && s !== 'pending') return;
    const sid = norm(l.staffId);
    const ls = new Date(l.startDate);
    const le = new Date(l.endDate);
    if (isNaN(ls.getTime()) || isNaN(le.getTime())) return;
    for (let d = new Date(ls); d <= le; d.setDate(d.getDate() + 1)) {
      lMap.set(`${sid}_${ymdLocal(d)}`, l.type || l.leaveType || 'Leave');
    }
  });

  const hMap = new Map();
  const holidayList = Array.isArray(holidayRes.data) ? holidayRes.data : [];
  holidayList.forEach(h => {
    if (h.date) {
      hMap.set(ymdLocal(h.date), h.name || 'Holiday');
    }
  });

  const monthlyRows = monthResults.flatMap((r) => (Array.isArray(r.data) ? r.data : []));

  const staffBaseInfo = new Map();
  hrList.forEach(hr => {
    const sid = norm(hr.staffId);
    if (!sid) return;
    const joined = hr.joinDate ? new Date(hr.joinDate) : null;
    const removed = hr.dateRemoved || hr.resignationDate || hr.resignDate || hr.dateLeft ? new Date(hr.dateRemoved || hr.resignationDate || hr.resignDate || hr.dateLeft) : null;
    if (joined && !isNaN(joined.getTime()) && joined > toObj) return;
    if (removed && !isNaN(removed.getTime()) && removed < fromObj) return;

    staffBaseInfo.set(sid, {
      name: hr.khmerName || hr.name || '',
      khmerName: hr.khmerName || '',
      department: (hr.Department_Kh || hr.department || '').trim(),
      year: fromObj.getFullYear(),
      month: fromObj.getMonth() + 1,
      joinDateObj: joined && !isNaN(joined.getTime()) ? joined : null,
      resignDateObj: removed && !isNaN(removed.getTime()) ? removed : null
    });
  });

  monthlyRows.forEach(rec => {
    const sid = norm(rec.staffId);
    if (!sid) return;
    if (!staffBaseInfo.has(sid)) {
      staffBaseInfo.set(sid, {
        name: rec.name || rec.khmerName || '',
        khmerName: rec.khmerName || '',
        year: rec.year,
        month: rec.month
      });
    }
  });

  const staffDailyMap = new Map();
  monthlyRows.forEach(rec => {
    const sid = norm(rec.staffId);
    if (!sid) return;
    if (!staffDailyMap.has(sid)) staffDailyMap.set(sid, new Map());
    const dMap = staffDailyMap.get(sid);
    (rec.dailyData || []).forEach(d => {
      let key = '';
      if (d.date) key = ymdLocal(d.date);
      else if (d.day && rec.year && rec.month) key = `${rec.year}-${pad2(rec.month)}-${pad2(d.day)}`;
      if (key && key >= dateFromDate && key <= dateToDate) {
        dMap.set(key, { ...d, date: key });
      }
    });
  });

  try {
    const res = await api.get('/attendance/day-data', { params: { startDate: dateFromDate, endDate: dateToDate } });
    const allDayData = Array.isArray(res.data) ? res.data : [];
    allDayData.forEach(staffRow => {
      const sid = norm(staffRow.staffId || staffRow.no);
      if (!sid) return;
      if (!staffDailyMap.has(sid)) staffDailyMap.set(sid, new Map());
      const dMap = staffDailyMap.get(sid);
      (staffRow.dailyData || []).forEach(d => {
        const key = ymdLocal(d.date);
        if (key && key >= dateFromDate && key <= dateToDate) {
          const existing = dMap.get(key) || {};
          dMap.set(key, { ...existing, ...d, date: key });
        }
      });
    });
  } catch (err) {
    console.error('Failed to load day-data range', err);
  }

  const datesInRange = [];
  let curDay = new Date(fromObj.getFullYear(), fromObj.getMonth(), fromObj.getDate());
  const endDay = new Date(toObj.getFullYear(), toObj.getMonth(), toObj.getDate());
  while (curDay <= endDay) {
    const iso = ymdLocal(curDay);
    const day = curDay.getDay();
    datesInRange.push({ iso, isWeekend: (day === 0 || day === 6) });
    curDay.setDate(curDay.getDate() + 1);
  }

  const byStaff = new Map();
  for (const sid of staffBaseInfo.keys()) {
    const base = staffBaseInfo.get(sid);
    const dMap = staffDailyMap.get(sid) || new Map();

    const rec = {
      ...base,
      staffId: sid,
      dailyData: [],
      dayWorkCount: 0,
      attendanceCount: 0,
      workTime: 0,
      clock: 0,
      clockCount: 0,
      absentCount: 0,
      leaveCount: 0,
      checkinLateMinutes: 0,
      checkinLateCount: 0,
      checkoutEarlyMinutes: 0,
      checkoutEarlyCount: 0,
      checkoutOvertimeMinutes: 0,
      checkoutOvertimeCount: 0,
      Plech: 0,
      A: 0
    };

    const joinStr = base.joinDateObj ? ymdLocal(base.joinDateObj) : null;
    const resignStr = base.resignDateObj ? ymdLocal(base.resignDateObj) : null;

    const finalDaily = [];
    for (const { iso: dayISO, isWeekend } of datesInRange) {
      const entry = dMap.get(dayISO) || { date: dayISO };
      let ci = entry.checkIn || entry.inTime || entry.checkin1 || '';
      let co = entry.checkOut || entry.outTime || entry.checkout1 || '';
      if (ci && !co && String(ci).includes('-')) {
        const parts = String(ci).split('-');
        if (parts.length >= 2) {
          ci = parts[0].trim();
          co = parts[1].trim();
        }
      }
      const hasAny = !!ci || !!co;
      const schKey = `${sid}_${dayISO}`;
      const sch = sMap.get(schKey);
      const leaveType = lMap.get(schKey);
      let status = String(entry.status || '').trim().toLowerCase();
      if (leaveType) status = 'leave';

      if (joinStr && dayISO < joinStr) {
        finalDaily.push({ date: dayISO, status: 'not_joined' });
        continue;
      }
      if (resignStr && dayISO > resignStr) {
        finalDaily.push({ date: dayISO, status: 'removed' });
        continue;
      }

      const { effectiveStatus, hasScheduleTime, isDayOffBySchedule, isOffByStatus } = checkIsOff(status, hasAny, sch, dayISO, isWeekend, hMap.has(dayISO));

      finalDaily.push({ ...entry, date: dayISO, checkIn: ci, checkOut: co, status: effectiveStatus });

      if (effectiveStatus === 'absent') { rec.absentCount++; rec.A++; }
      else if (effectiveStatus === 'leave') { rec.leaveCount++; }
      else if (hasAny) { rec.attendanceCount++; }

      if (ci && !co) rec.Plech++;

      const isExpected = !(isDayOffBySchedule || isOffByStatus);
      if (isExpected) rec.dayWorkCount++;

      const inMin = parseHMToMinutes(ci);
      const outMin = parseHMToMinutes(co);
      if (inMin !== null && outMin !== null) {
        let diff = outMin - inMin;
        if (diff < 0) {
          diff += 24 * 60;
        } else if (diff < 4 * 60) {
          diff += 24 * 60;
        }
        if (diff > 0) {
          rec.workTime += diff;
          rec.clock += diff;
          rec.clockCount += (ci ? 1 : 0) + (co ? 1 : 0);
        }
      }

      let refStart = null, refEnd = null, refGrace = 15;
      if (hasScheduleTime && !isDayOffBySchedule) {
        refStart = sch.shiftStart; refEnd = sch.shiftEnd; refGrace = sch.scheduledGraceMinutes || 15;
      } else if (isDayOffBySchedule && hasAny) {
        const def = defaultShiftMap.get(sid);
        if (def) { refStart = def.shiftStart; refEnd = def.shiftEnd; refGrace = def.grace; }
      }

      if (refStart && refEnd && hasAny) {
        const shiftStartMin = parseHMToMinutes(refStart);
        const shiftEndMin = parseHMToMinutes(refEnd);
        if (inMin !== null && shiftStartMin !== null) {
          const diffIn = inMin - shiftStartMin;
          if (diffIn > Number(refGrace)) {
            rec.checkinLateCount++;
            rec.checkinLateMinutes += diffIn;
          }
        }
        if (outMin !== null && shiftEndMin !== null) {
          const earlyDiff = shiftEndMin - outMin;
          if (earlyDiff > 0) {
            rec.checkoutEarlyCount++;
            rec.checkoutEarlyMinutes += earlyDiff;
          }
          const otDiff = outMin - shiftEndMin;
          if (otDiff > 0) {
            rec.checkoutOvertimeCount++;
            rec.checkoutOvertimeMinutes += otDiff;
          }
        }
      }
    }
    rec.dailyData = finalDaily;
    byStaff.set(sid, rec);
  }

  return Array.from(byStaff.values());
}
