import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import usePermission from '../hooks/usePermission';

export default function AttendancesumDayPage() {
  const { canViewAttendanceMonthlyData } = usePermission();

  const pad2 = (n) => String(n).padStart(2, '0');

  // Use LOCAL date (not UTC) to avoid off-by-one day when backend stores local-midnight dates.
  // Example: 2026-02-02 00:00 (+07) is stored as 2026-02-01T17:00:00.000Z.
  const ymdLocal = (v) => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const norm = (id) => {
    if (!id) return '';
    return String(id).replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toUpperCase();
  };

  // Local state and refs (ensure these are defined)
  const getInitialDate = (key, defaultVal) => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const { value, timestamp } = JSON.parse(stored);
        const now = new Date().getTime();
        // 10 minutes = 10 * 60 * 1000 = 600000 ms
        if (now - timestamp < 600000) {
          return value;
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
    return defaultVal;
  };

  const [dateFromDate, setDateFromDate] = useState(() => {
    return getInitialDate('attendanceMonthlyFromDate', ymdLocal(new Date()));
  });
  const [dateToDate, setDateToDate] = useState(() => {
    return getInitialDate('attendanceMonthlyToDate', ymdLocal(new Date()));
  });

  useEffect(() => {
    const timestamp = new Date().getTime();
    try {
      localStorage.setItem('attendanceMonthlyFromDate', JSON.stringify({ value: dateFromDate, timestamp }));
      localStorage.setItem('attendanceMonthlyToDate', JSON.stringify({ value: dateToDate, timestamp }));
    } catch { void 0; }
  }, [dateFromDate, dateToDate]);
  const from = new Date(dateFromDate);
  const to = new Date(dateToDate);
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date(dateFromDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [leaveData, setLeaveData] = useState([]);
  const [showLeave, setShowLeave] = useState(true);
  const [data, setData] = useState([]);
  const [schedulesMap, setSchedulesMap] = useState(new Map());
  const [holidayMap, setHolidayMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const [lastImportStats, setLastImportStats] = useState(null);

  const [searchText, setSearchText] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [hrDataMap, setHrDataMap] = useState(new Map());
  const [departmentsList, setDepartmentsList] = useState([]);
  const [hrLoading, setHrLoading] = useState(false);

  // Fetch HR data once on mount
  useEffect(() => {
    const fetchHr = async () => {
      setHrLoading(true);
      try {
        const hrRes = await api.get('/hr').catch(() => ({ data: [] }));
        const hrList = Array.isArray(hrRes.data) ? hrRes.data : [];
        const hrMap = new Map();
        const depts = new Set();
        hrList.forEach(hr => {
          const sid = norm(hr.staffId);
          if (sid) {
            const d = (hr.Department_Kh || hr.department || '').trim();
            hrMap.set(sid, d);
            if (d) depts.add(d);
          }
        });
        setHrDataMap(hrMap);
        setDepartmentsList(Array.from(depts).sort());
      } catch (e) {
        console.error('Failed to load HR data', e);
      } finally {
        setHrLoading(false);
      }
    };
    fetchHr();
  }, []);
  const [filterFlags, setFilterFlags] = useState({
    present: false,
    absent: false,
    leave: false,
    late: false,
    early: false,
    forgot: false,
    notWorking: false
  });

  const PAGE_SIZES = [10, 20, 50, 100, 200, 500];
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const parseHMToMinutes = (s) => {
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

  const formatHMTo12 = (input) => {
    if (!input) return '';
    const s = String(input).trim();

    // 1. Try to find EXISTING AM/PM format (common in noisy strings)
    // e.g. "2026-04-06 05:42 PM - Good Time: 03:30 PM" -> extracts "05:42 PM"
    const ampmMatch = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
    if (ampmMatch) {
      let hh = parseInt(ampmMatch[1], 10);
      const mm = ampmMatch[2];
      const ampm = ampmMatch[3].toUpperCase();
      return `${hh.toString().padStart(2, '0')}:${mm} ${ampm}`;
    }

    // 2. Try to find the FIRST HH:mm pattern that looks like a time
    // e.g. "2024-04-06 17:42" -> extracts "17:42"
    const hmMatch = s.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$|-)/);
    if (hmMatch) {
      let hh = parseInt(hmMatch[1], 10);
      const mm = hmMatch[2];
      const ampm = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      return `${hh.toString().padStart(2, '0')}:${mm} ${ampm}`;
    }

    // 3. Try ISO or Date string conversion
    if (s.includes('T') || s.includes('-') || s.includes('/')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        let h = hours % 12;
        if (h === 0) h = 12;
        const hh = h < 10 ? String(h).padStart(2, '0') : String(h);
        const mm = String(minutes).padStart(2, '0');
        return `${hh}:${mm} ${ampm}`;
      }
    }

    return s;
  };

  // Format work time as "Hh Mm" (e.g., 245h 26m)
  const formatWorkTime = (val) => {
    if (val === null || typeof val === 'undefined' || val === '') return '';
    let n = Number(val);
    if (isNaN(n)) return String(val);
    // If value is less than 24, treat as hours (legacy decimal hours)
    if (n < 24 && n !== 0 && String(val).indexOf('.') !== -1) {
      const h = Math.floor(n);
      const m = Math.round((n - h) * 60);
      return `${h}h ${m}m`;
    }
    // Otherwise treat as minutes
    const h = Math.floor(Math.abs(n) / 60);
    const m = Math.abs(n) % 60;
    return `${n < 0 ? '-' : ''}${h}h ${m}m`;
  };

  const getDayCellBackground = (dayData) => {
    if (!dayData) return 'white';

    const ci = (dayData.checkIn || '').toString().trim();
    const co = (dayData.checkOut || '').toString().trim();
    const status = (dayData.status || '').toString().toLowerCase();

    // Full times: no color
    if (ci && co) return 'white';

    // Leave: yellow
    if (status === 'leave') return '#b5aef3ff';

    // Rest/day-off: blue (supported if such statuses exist)
    if (status === 'rest' || status === 'dayoff' || status === 'off' || status === 'holiday') return '#ADD8E6';

    // Scan-in only: green
    if (ci && !co) return '#89f589ff';

    // Scan-out only: orange
    if (!ci && co) return '#f07a12ff';

    // Absent: red
    if (status === 'absent') return '#f88f98ff';

    return 'white';
  };

  // Load data on mount and when date range changes
  useEffect(() => {
    // Keep monthYear in sync with dateFromDate if it looks like a full month
    try {
      const d = new Date(dateFromDate);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      if (dateToDate === ymdLocal(endOfMonth) && d.getDate() === 1) {
        setMonthYear(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } catch (e) {
      // ignore
    }
    load();
  }, [dateFromDate, dateToDate]);

  const load = async () => {
    setLoading(true);
    try {
      const fromObj = new Date(dateFromDate);
      const toObj = new Date(dateToDate);
      if (isNaN(fromObj.getTime()) || isNaN(toObj.getTime())) {
        setData([]);
        return;
      }

      // Collect all months that intersect the selected range
      const months = [];
      const cur = new Date(fromObj.getFullYear(), fromObj.getMonth(), 1);
      const endM = new Date(toObj.getFullYear(), toObj.getMonth(), 1);
      while (cur <= endM) {
        months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
        cur.setMonth(cur.getMonth() + 1);
      }

      const monthResults = await Promise.all(
        months.map(({ year, month }) =>
          api.get('/attendance/monthly-data', { params: { year, month } }).catch(() => ({ data: [] }))
        )
      );

      // Fetch schedules for the date range
      let sMap = new Map();
      let schedRes = { data: [] };
      try {
        schedRes = await api.get('/work-schedules', {
          params: { startDate: fromObj.toISOString(), endDate: toObj.toISOString() }
        });
        const schedList = Array.isArray(schedRes.data) ? schedRes.data : [];
        schedList.forEach(s => {
          const sid = norm(s.employeeId?.staffId || s.staffId);
          if (sid && s.date) {
            const dateKey = ymdLocal(s.date);
            sMap.set(`${sid}_${dateKey}`, s);
          }
        });
      } catch (e) {
        console.error('Failed to load schedules', e);
      }
      setSchedulesMap(sMap);

      // Identify a "normal" shift for each staff member to use as a reference
      // for late/early checks when they work on a Day Off or Holiday.
      const defaultShiftMap = new Map();
      try {
        const schedList = Array.isArray(schedRes.data) ? schedRes.data : [];
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
      } catch (err) {
        console.error('Error creating defaultShiftMap:', err);
      }


      // Fetch leave requests for the date range
      let lMap = new Map();
      try {
        const leaveRes = await api.get('/leave-requests', {
          params: { from: fromObj.toISOString(), to: toObj.toISOString(), status: 'approved' }
        });
        const leaveList = Array.isArray(leaveRes.data) ? leaveRes.data : [];
        const tmpLeave = [];
        leaveList.forEach(l => {
          if (l.staffId && l.startDate && l.endDate) {
            const sDate = new Date(l.startDate);
            const eDate = new Date(l.endDate);
            let cur = new Date(sDate);
            while (cur <= eDate) {
              const dateKey = ymdLocal(cur);
              lMap.set(`${norm(l.staffId)}_${dateKey}`, l.type || 'Leave');
              tmpLeave.push({
                staffId: norm(l.staffId),
                name: l.name || l.khmerName || '',
                date: dateKey,
                type: l.type || 'Leave'
              });
              cur.setDate(cur.getDate() + 1);
            }
          } else if (l.staffId && l.date) {
            const dateKey = ymdLocal(l.date);
            lMap.set(`${norm(l.staffId)}_${dateKey}`, l.type || 'Leave');
            tmpLeave.push({
              staffId: norm(l.staffId),
              name: l.name || l.khmerName || '',
              date: dateKey,
              type: l.type || 'Leave'
            });
          }
        });
        setLeaveData(tmpLeave);
      } catch (e) {
        console.error('Failed to load leave requests', e);
      }

      // Fetch holidays for the date range
      let hMap = new Map();
      try {
        const holidayRes = await api.get('/holidays').catch(() => ({ data: [] }));
        const holidayList = Array.isArray(holidayRes.data) ? holidayRes.data : [];
        holidayList.forEach(h => {
          if (h.date) {
            const dateKey = ymdLocal(h.date);
            hMap.set(dateKey, h.name || 'Holiday');
          }
        });
      } catch (e) {
        console.error('Failed to load holidays', e);
      }
      setHolidayMap(hMap);

      const monthlyRows = monthResults.flatMap((r) => (Array.isArray(r.data) ? r.data : []));

      const fromKey = dateFromDate;
      const toKey = dateToDate;

      const checkIsOff = (status, hasAny, sch, dayISO, isWeekend, isHoliday) => {
        const isDayOffBySchedule = sch && (
          (sch.shiftTitle || '').toLowerCase() === 'day off' ||
          (sch.shiftTitle || '').includes('សម្រាក') ||
          (sch.shiftTitle || '').toLowerCase() === 'dayoff'
        );
        const hasScheduleTime = sch && sch.shiftStart && sch.shiftEnd;

        let isOffByStatus = (status === 'rest' || status === 'dayoff' || status === 'off' || status === 'holiday' || isWeekend || isHoliday);

        // If they have a working schedule, they are expected to work even on weekends/holidays
        if (isOffByStatus && hasScheduleTime && !isDayOffBySchedule) {
          isOffByStatus = false;
        }

        // Priority 1: Leave
        if (status === 'leave') return { isOff: !hasAny, effectiveStatus: 'leave', isDayOffBySchedule, hasScheduleTime, isOffByStatus };

        // Priority 2: Day Off by Schedule
        if (isDayOffBySchedule) return { isOff: !hasAny, effectiveStatus: (hasAny ? 'present' : 'rest'), isDayOffBySchedule, hasScheduleTime, isOffByStatus };

        // Priority 3: Weekend/Holiday
        if (isOffByStatus) return { isOff: !hasAny, effectiveStatus: (isHoliday ? 'holiday' : 'rest'), isDayOffBySchedule, hasScheduleTime, isOffByStatus };

        // Priority 4: Present or Absent
        const effectiveStatus = hasAny ? 'present' : 'absent';
        return { isOff: !hasAny, effectiveStatus, isDayOffBySchedule, hasScheduleTime, isOffByStatus };
      };

      // Robust date parsing helper
      const parseDateSafe = (v) => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };

      // 3. Populate staffBaseInfo from HR list (Primary Source)
      // Filter based on whether they were present/active during the selected range
      const staffBaseInfo = new Map();
      const hrRes = await api.get('/hr').catch(() => ({ data: [] }));
      const hrList = Array.isArray(hrRes.data) ? hrRes.data : [];

      hrList.forEach(hr => {
        const sid = norm(hr.staffId);
        if (!sid) return;

        // Date-based inclusion check
        const joined = parseDateSafe(hr.joinDate);
        const removed = parseDateSafe(hr.dateRemoved || hr.resignationDate || hr.resignDate || hr.dateLeft);

        // If they joined AFTER the selected range, skip
        if (joined && joined > toObj) return;
        // If they were removed BEFORE the selected range, skip
        if (removed && removed < fromObj) return;

        staffBaseInfo.set(sid, {
          name: hr.khmerName || hr.name || '',
          khmerName: hr.khmerName || '',
          department: (hr.Department_Kh || hr.department || '').trim(),
          year: fromObj.getFullYear(),
          month: fromObj.getMonth() + 1,
          joinDateObj: joined,
          resignDateObj: removed
        });
      });

      // Overlay from Monthly Summaries and Day Data
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
      {
        let curDay = new Date(fromObj.getFullYear(), fromObj.getMonth(), fromObj.getDate());
        const endDay = new Date(toObj.getFullYear(), toObj.getMonth(), toObj.getDate());
        while (curDay <= endDay) {
          const iso = ymdLocal(curDay);
          const day = curDay.getDay();
          datesInRange.push({ iso, isWeekend: (day === 0 || day === 6) });
          curDay.setDate(curDay.getDate() + 1);
        }
      }

      // 4. Final Aggregation and Calculation (Single Pass)
      const byStaff = new Map();
      for (const sid of staffBaseInfo.keys()) {
        const base = staffBaseInfo.get(sid);
        const dMap = staffDailyMap.get(sid) || new Map();

        const rec = {
          ...base,
          staffId: sid,
          department: base.department || hrDataMap.get(sid) || '',
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
          A: 0 // Reset A to ensure it's recalculated
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
          let sch = sMap.get(schKey);
          const leaveType = lMap.get(schKey);
          let status = String(entry.status || '').trim().toLowerCase();
          if (leaveType) status = 'leave';

          if ((joinStr && dayISO < joinStr) || (resignStr && dayISO > resignStr)) {
            sch = null;
          }

          let currentSch = sch;
          let isForcedDayOff = false;

          if (joinStr && dayISO < joinStr) {
            status = 'dayoff';
            currentSch = null;
            isForcedDayOff = true;
          }
          if (resignStr && dayISO > resignStr) {
            status = 'dayoff';
            currentSch = null;
            isForcedDayOff = true;
          }

          const { isOff, effectiveStatus, hasScheduleTime, isDayOffBySchedule, isOffByStatus } = checkIsOff(status, hasAny, currentSch, dayISO, isWeekend, hMap.has(dayISO));

          const finalEntry = { ...entry, date: dayISO, checkIn: ci, checkOut: co, status: effectiveStatus };
          finalDaily.push(finalEntry);

          // Totals calculation from source of truth (daily data)
          if (effectiveStatus === 'absent') {
            rec.absentCount++;
            rec.A++; // Also increment A for consistency
          } else if (effectiveStatus === 'leave') {
            rec.leaveCount++;
          } else if (hasAny) {
            rec.attendanceCount++;
          }

          if (ci && !co) rec.Plech++;

          // Day Work Count should only count days where work was EXPECTED (not a weekend, not a day off, not a holiday)
          // We use the isOffByStatus (which accounts for weekends/holidays unless overridden by a schedule)
          // and isDayOffBySchedule.
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

          // Late/Early Checks
          let refStart = null, refEnd = null, refGrace = 15;
          if (isForcedDayOff) {
            // Do not populate refStart/refEnd if it is outside employment dates
            refStart = null;
            refEnd = null;
          } else if (hasScheduleTime && !isDayOffBySchedule) {
            refStart = currentSch.shiftStart;
            refEnd = currentSch.shiftEnd;
            refGrace = currentSch.scheduledGraceMinutes || 15;
          } else if (!isOffByStatus) {
            const def = defaultShiftMap.get(sid);
            if (def) {
              refStart = def.shiftStart; refEnd = def.shiftEnd; refGrace = def.grace;
            }
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

      setData(Array.from(byStaff.values()));
    } catch (err) {
      console.error('Load failed:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Modal state for data-entry form
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('day'); // 'day' or 'summary'
  const [modalData, setModalData] = useState(null);

  const openDayModal = (rec, dayEntry) => {
    setModalType('day');
    setModalData({
      staffId: rec.staffId,
      name: rec.name || '',
      year: rec.year || new Date(dateFromDate).getFullYear(),
      month: rec.month || (new Date(dateFromDate).getMonth() + 1),
      day: dayEntry.day,
      _id: dayEntry._id,
      checkIn: formatHMTo12(dayEntry.checkIn),
      checkOut: formatHMTo12(dayEntry.checkOut)
    });
    setModalOpen(true);
  };

  const openSummaryModal = (rec) => {
    setModalType('summary');
    setModalData({
      staffId: rec.staffId,
      name: rec.name || '',
      year: rec.year || new Date(dateFromDate).getFullYear(),
      month: rec.month || (new Date(dateFromDate).getMonth() + 1),
      leaveType: rec.leaveType || '',
      other: rec.other || '',
      totalLeaveComment: rec.totalLeaveComment || '',
      dayWorkCount: rec.dayWorkCount || 0,
      attendanceCount: rec.attendanceCount || 0,
      workTime: rec.workTime || '',
      checkinLateCount: rec.checkinLateCount || 0,
      checkoutEarlyCount: rec.checkoutEarlyCount || 0,
      checkoutOvertimeCount: rec.checkoutOvertimeCount || 0,
      checkoutOvertimeMinutes: rec.checkoutOvertimeMinutes || 0,
      absentCount: rec.absentCount || 0,
      leaveCount: rec.leaveCount || 0,
      A: rec.A || '',
      plech: rec.plech ?? rec.Plech ?? ''
    });
    setModalOpen(true);
  };

  // Card modal state
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardHrData, setCardHrData] = useState(null);
  const [hideCardContent, setHideCardContent] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const openCardModal = async (rec) => {
    setSelectedRecord(rec);
    setCardModalOpen(true);
    setCardHrData(null);
    try {
      // Try to get auth token for the request
      const auth = JSON.parse(localStorage.getItem('auth') || 'null');
      const headers = auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};

      const res = await api.get('/hr', {
        params: { staffId: rec.staffId },
        headers
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        setCardHrData(res.data[0]);
      } else {
        const res2 = await api.get('/hr', {
          params: { search: rec.name || rec.khmerName },
          headers
        });
        if (Array.isArray(res2.data) && res2.data.length > 0) {
          setCardHrData(res2.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch HR data for card', err);
    }
  };

  const closeModal = () => { setModalOpen(false); setModalData(null); };

  const saveModal = async () => {
    try {
      if (modalType === 'day') {
        const d = modalData;
        if (d._id) {
          await api.put(`/attendance/${d._id}`, { checkIn: d.checkIn, checkOut: d.checkOut });
        } else {
          const dateObj = new Date(Number(d.year), Number(d.month) - 1, Number(d.day));
          await api.post('/attendance', { staffId: d.staffId, date: dateObj.toISOString(), checkIn: d.checkIn, checkOut: d.checkOut });
        }
      } else {
        const p = {
          staffId: modalData.staffId,
          name: modalData.name || '',
          year: Number(modalData.year),
          month: Number(modalData.month),
          leaveType: modalData.leaveType || '',
          other: modalData.other || '',
          totalLeaveComment: modalData.totalLeaveComment || '',
          dayWorkCount: Number(modalData.dayWorkCount) || 0,
          attendanceCount: Number(modalData.attendanceCount) || 0,
          workTime: Number(modalData.workTime) || 0,
          checkinLateCount: Number(modalData.checkinLateCount) || 0,
          checkoutEarlyCount: Number(modalData.checkoutEarlyCount) || 0,
          checkoutOvertimeCount: Number(modalData.checkoutOvertimeCount) || 0,
          checkoutOvertimeMinutes: Number(modalData.checkoutOvertimeMinutes) || 0,
          absentCount: Number(modalData.absentCount) || 0,
          leaveCount: Number(modalData.leaveCount) || 0,
          A: modalData.A || '',
          plech: modalData.plech ?? modalData.Plech ?? ''
        };
        await api.post('/attendance/monthly-data', [p]);
      }
      closeModal();
      await load();
    } catch (err) {
      console.error('Save failed', err);
      alert('Save failed: ' + err.message);
    }
  };

  const exportExcel = () => {
    try {

      const dates = [];
      let current = new Date(from);
      while (current <= to) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      const dateRangeLabel = `${from.toLocaleDateString('en-US')} to ${to.toLocaleDateString('en-US')}`;

      // Use actual data or sample data if empty
      const exportData = data.length > 0 ? data : [
        {
          staffId: 'EMP001',
          name: 'Sample Employee 1',
          dailyData: [
            { day: 1, checkIn: '08:00', checkOut: '17:00' },
            { day: 2, checkIn: '08:15', checkOut: '17:30' },
            { day: 3, checkIn: '08:00', checkOut: '17:00' }
          ],
          dayWorkCount: 3,
          attendanceCount: 3,
          workTime: '24',
          clock: '45',
          clockCount: 1,
          checkinLateMinutes: 15,
          checkinLateCount: 1,
          checkoutEarlyMinutes: 0,
          checkoutEarlyCount: 0,
          checkoutOvertimeMinutes: 30,
          checkoutOvertimeCount: 1,
          absentCount: 0,
          leaveCount: 0
        }
      ];

      // Build header (match screenshot fields)
      // Summary fields:
      // - Day Work: Count
      // - Attendance: Q-mn
      // - Work Time: Q-mn
      // - Clock: Q-mn
      // - Checkin Late: Count + Q-mn
      // - Checkout Early: Count + Q-mn
      // - Checkout Overtime: Count + Q-mn
      // - Absent, Leave, A, Plech
      const headerRow1 = [
        'Staff ID',
        'Name',
        'Department',
        ...dates.map(d => d.getDate()),
        'Day Work',
        'Attendance',
        'Work Time',
        'Clock',
        'Clock',
        'Checkin Late',
        'Checkin Late',
        'Checkout Early',
        'Checkout Early',
        'Checkout Overtime',
        'Checkout Overtime',
        'Absent',
        'Leave',
        'A',
        'Plech'
      ];
      const headerRow2 = [
        '',
        '',
        '',
        ...dates.map(() => 'Check in - Check out'),
        'Count',
        'Q-mn',
        'Q-mn',
        'Q-mn',
        'Count',
        'Q-mn',
        'Count',
        'Q-mn',
        'Count',
        'Q-mn',
        'Count',
        '',
        '',
        '',
        ''
      ];

      // Build data rows
      const rows = [
        [`Detail Report Payroll ${dateRangeLabel}`, ...Array(headerRow1.length - 1).fill('')],
        headerRow1,
        headerRow2,
        ...exportData.map(record => {
          const row = [record.staffId || '', record.name || '', record.department || ''];

          // Add daily data for all dates in range
          for (const dt of dates) {
            const dayNum = dt.getDate();
            const dtStr = ymdLocal(dt);
            const dayData = record.dailyData?.find(dd => {
              if (dd?.date) return ymdLocal(dd.date) === dtStr;
              return dd?.day === dayNum;
            });
            if (!dayData) {
              row.push('');
            } else if (dayData.checkIn && dayData.checkOut) {
              row.push(`${dayData.checkIn} - ${dayData.checkOut}`);
            } else {
              row.push(dayData.checkIn || dayData.checkOut || '');
            }
          }

          // Add summaries
          row.push(record.dayWorkCount || '');
          row.push(record.attendanceCount || '');
          row.push(record.workTime || '');
          row.push(record.clock || '');
          row.push(record.clockCount || '');
          row.push(record.checkinLateMinutes || '');
          row.push(record.checkinLateCount || '');
          row.push(record.checkoutEarlyMinutes || '');
          row.push(record.checkoutEarlyCount || '');
          row.push(record.checkoutOvertimeMinutes || '');
          row.push(record.checkoutOvertimeCount || '');
          row.push(record.absentCount || '');
          row.push(record.leaveCount || '');
          row.push(record.A || '');
          row.push(record.Plech || '');

          return row;
        })
      ];

      // Create sheet
      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Add borders and styling
      const borders = {
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } }
      };

      const baseFont = { name: 'Times New Roman', sz: 12 };
      const centerAlignment = { horizontal: 'center', vertical: 'center', wrapText: true };

      // Style all cells
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const cellRef = XLSX.utils.encode_col(c) + (r + 1);
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

          ws[cellRef].s = {
            font: baseFont,
            alignment: centerAlignment,
            border: borders
          };

          // Header rows background
          if (r < 3) {
            ws[cellRef].s.fill = { fgColor: { rgb: 'FFE6E6' } };
          }
        }
      }

      // Set column widths
      const colWidths = [12, 15, ...Array(dates.length).fill(15), 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10, 10];
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Data');
      const fromStr = dateFromDate.replace(/-/g, '');
      const toStr = dateToDate.replace(/-/g, '');
      XLSX.writeFile(wb, `AttendanceMonthlyData_${fromStr}_to_${toStr}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + err.message);
    }
  };

  ;
  const importExcel = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (!raw || raw.length < 3) {
        alert('Invalid file format');
        return;
      }

      // Find header row
      let headerRowIdx = 1;
      const headers = raw[headerRowIdx];
      const subHeaders = raw[headerRowIdx + 1] || [];

      const findColIndex = (label) => {
        const target = String(label).trim().toLowerCase();
        return (headers || []).findIndex(h => String(h).trim().toLowerCase() === target);
      };

      // Determine how many Daily columns exist in the file by locating "Day Work"
      // File structure: Staff ID, Name, [Department], [Daily...], Day Work, Attendance, ...
      const dayWorkIdxInFile = findColIndex('Day Work');
      let dailyStartIdx = 2;
      const deptHeader = String(headers?.[2] || '').trim().toLowerCase();
      if (deptHeader === 'department' || deptHeader === 'ផ្នែក') {
        dailyStartIdx = 3;
      }
      const dailyColCount = dayWorkIdxInFile > dailyStartIdx ? (dayWorkIdxInFile - dailyStartIdx) : null;

      const excelValueToTime = (v) => {
        if (v === null || typeof v === 'undefined' || v === '') return '';
        if (v instanceof Date) {
          const hh = String(v.getHours()).padStart(2, '0');
          const mm = String(v.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        }
        if (typeof v === 'number' && isFinite(v)) {
          // Excel time might be stored as a fraction of a day (or as a date serial with fractional part)
          const frac = ((v % 1) + 1) % 1;
          const totalMinutes = Math.round(frac * 24 * 60);
          const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
          const mm = String(totalMinutes % 60).padStart(2, '0');
          return `${hh}:${mm}`;
        }
        return String(v).trim();
      };

      const toNumber = (v) => {
        if (v === null || typeof v === 'undefined' || v === '') return 0;
        if (typeof v === 'number' && isFinite(v)) return v;
        const s = String(v).trim();
        if (!s) return 0;
        const n = Number(s);
        return isFinite(n) ? n : 0;
      };

      const parseWorkTimeMinutes = (v) => {
        if (v === null || typeof v === 'undefined' || v === '') return 0;
        if (typeof v === 'number' && isFinite(v)) return v;
        const s = String(v).trim();
        if (!s) return 0;
        // Formats like "8h 35m" or "8h35m"
        const hm = s.match(/^(\d+)\s*h\s*(\d+)?\s*m?$/i);
        if (hm) {
          const h = Number(hm[1] || 0);
          const m = Number(hm[2] || 0);
          return h * 60 + m;
        }
        // Formats like "08:35" meaning hours:minutes
        const colon = s.match(/^(\d{1,2}):(\d{2})$/);
        if (colon) {
          return Number(colon[1]) * 60 + Number(colon[2]);
        }
        return toNumber(s);
      };

      // Build an array of actual Date objects for each column using the UI range
      const columnDates = [];
      {
        let current = new Date(from);
        while (current <= to) {
          columnDates.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
      }

      // Parse records
      const [year, month] = monthYear.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      let imported = 0;
      let totalRows = 0;
      let skippedRows = 0;
      // We'll group rows by staffId + year + month because an export range may span multiple months
      const grouped = new Map(); // key: `${staffId}|${yyyy}-${mm}` -> aggregated record
      const seenStaffIds = new Set();
      let duplicateStaffIds = 0;

      // Summary columns start right after: StaffId, Name, then day columns
      const effectiveDailyColCount = dailyColCount ?? daysInMonth;
      const summaryStartIdx = dayWorkIdxInFile > 0 ? dayWorkIdxInFile : (2 + effectiveDailyColCount);
      // Backward-compatible: some exports have two "Clock" columns (Clock Q-mn + Clock Count)
      const hasClockCountColumn =
        headers?.[summaryStartIdx + 3] === 'Clock' &&
        headers?.[summaryStartIdx + 4] === 'Clock';

      const parseQmnCountPair = (rowArr, startIdx) => {
        const first = String(subHeaders?.[startIdx] ?? '').trim().toLowerCase();
        // Prefer Q-mn first when present
        const isQmnFirst = first === 'q-mn' || first.includes('q-mn');
        if (isQmnFirst) {
          return { minutes: rowArr?.[startIdx] ?? 0, count: rowArr?.[startIdx + 1] ?? 0 };
        }
        return { count: rowArr?.[startIdx] ?? 0, minutes: rowArr?.[startIdx + 1] ?? 0 };
      };

      // Data starts after title row + headerRow1 + headerRow2
      for (let r = headerRowIdx + 2; r < raw.length; r++) {
        const row = raw[r];
        if (!row || !row[0]) continue;

        const staffId = String(row[0] || '').trim();
        if (!staffId) continue;

        totalRows++;
        if (seenStaffIds.has(staffId)) duplicateStaffIds++;
        seenStaffIds.add(staffId);

        const baseRecordMeta = {
          staffId,
          name: row[1] || ''
        };

        // Pairs can be either (Q-mn, Count) or (Count, Q-mn) depending on export
        const lateStart = hasClockCountColumn ? (summaryStartIdx + 5) : (summaryStartIdx + 4);
        const earlyStart = lateStart + 2;
        const overtimeStart = earlyStart + 2;

        const latePair = parseQmnCountPair(row, lateStart);
        const earlyPair = parseQmnCountPair(row, earlyStart);
        const overtimePair = parseQmnCountPair(row, overtimeStart);

        // Use local variables for tail summary values (don't reference undefined `record`)
        const checkinLateCountVal = toNumber(latePair.count);
        const checkinLateMinutesVal = parseWorkTimeMinutes(latePair.minutes);
        const checkoutEarlyCountVal = toNumber(earlyPair.count);
        const checkoutEarlyMinutesVal = parseWorkTimeMinutes(earlyPair.minutes);
        const checkoutOvertimeCountVal = toNumber(overtimePair.count);
        const checkoutOvertimeMinutesVal = parseWorkTimeMinutes(overtimePair.minutes);

        const tailStart = overtimeStart + 2;
        const absentCountVal = toNumber(row[tailStart]);
        const leaveCountVal = toNumber(row[tailStart + 1]);
        const AVal = row[tailStart + 2] || '';
        const PlechVal = row[tailStart + 3] || '';
        const plechNumeric = toNumber(row[tailStart + 3]);

        // Attach summary tail values to the group corresponding to the UI month (best-effort fallback)
        const uiYear = Number(year);
        const uiMonth = Number(month);
        const uiKey = `${staffId}|${uiYear}-${String(uiMonth).padStart(2, '0')}`;
        let uiGrp = grouped.get(uiKey);
        if (!uiGrp) {
          uiGrp = {
            staffId,
            name: row[1] || '',
            dailyData: [],
            dayWorkCount: 0,
            attendanceCount: 0,
            workTime: 0,
            clock: 0,
            clockCount: 0,
            checkinLateCount: 0,
            checkinLateMinutes: 0,
            checkoutEarlyCount: 0,
            checkoutEarlyMinutes: 0,
            checkoutOvertimeCount: 0,
            checkoutOvertimeMinutes: 0,
            absentCount: 0,
            leaveCount: 0,
            A: '',
            Plech: '',
            month: uiMonth,
            year: uiYear
          };
          grouped.set(uiKey, uiGrp);
        }
        // Overwrite with parsed summary values (prefer explicit tail values from Excel)
        uiGrp.checkinLateCount = checkinLateCountVal || uiGrp.checkinLateCount;
        uiGrp.checkinLateMinutes = checkinLateMinutesVal || uiGrp.checkinLateMinutes;
        uiGrp.checkoutEarlyCount = checkoutEarlyCountVal || uiGrp.checkoutEarlyCount;
        uiGrp.checkoutEarlyMinutes = checkoutEarlyMinutesVal || uiGrp.checkoutEarlyMinutes;
        uiGrp.checkoutOvertimeCount = checkoutOvertimeCountVal || uiGrp.checkoutOvertimeCount;
        uiGrp.checkoutOvertimeMinutes = checkoutOvertimeMinutesVal || uiGrp.checkoutOvertimeMinutes;
        uiGrp.absentCount = absentCountVal || uiGrp.absentCount;
        uiGrp.leaveCount = leaveCountVal || uiGrp.leaveCount;
        uiGrp.A = AVal || uiGrp.A;
        uiGrp.Plech = PlechVal || uiGrp.Plech;
        uiGrp.plech = plechNumeric || uiGrp.plech;

        // Parse daily data. Use `columnDates` to determine the exact YYYY-MM-DD for each column
        // Helper to parse HH:MM into minutes
        const parseHM = (s) => {
          if (!s && s !== 0) return null;
          if (typeof s === 'number' && isFinite(s)) return null;
          const str = String(s || '').trim();
          const m = str.match(/^(\d{1,2}):(\d{2})$/);
          if (m) return Number(m[1]) * 60 + Number(m[2]);
          const dt = new Date(str);
          if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
          return null;
        };

        for (let i = 0; i < effectiveDailyColCount; i++) {
          const colIdx = dailyStartIdx + i;
          const cellVal = row[colIdx];
          if (cellVal === null || typeof cellVal === 'undefined' || cellVal === '') continue;

          const text = excelValueToTime(cellVal);
          if (!text) continue;

          const parts = String(text)
            .split(/\s*(?:-|–|—)\s*/)
            .map(s => String(s).trim())
            .filter(Boolean);

          const dateForCol = columnDates[i] || new Date(Number(year), Number(month) - 1, i + 1);
          const dateStr = ymdLocal(dateForCol);
          const dayNum = Number(headers?.[colIdx]) || dateForCol.getDate();

          const checkIn = parts[0] || '';
          const checkOut = parts[1] || '';

          // compute minutes for this day
          const inMin = parseHM(checkIn);
          const outMin = parseHM(checkOut);
          let diff = 0;
          if (inMin !== null && outMin !== null) {
            diff = outMin - inMin;
            if (diff < 0) diff += 24 * 60;
            if (diff < 0) diff = 0;
          }

          const y2 = dateForCol.getFullYear();
          const m2 = dateForCol.getMonth() + 1;
          const gKey = `${staffId}|${y2}-${String(m2).padStart(2, '0')}`;
          let grp = grouped.get(gKey);
          if (!grp) {
            grp = {
              staffId,
              name: row[1] || '',
              dailyData: [],
              dayWorkCount: 0,
              attendanceCount: 0,
              workTime: 0,
              clock: 0,
              clockCount: 0,
              checkinLateCount: 0,
              checkinLateMinutes: 0,
              checkoutEarlyCount: 0,
              checkoutEarlyMinutes: 0,
              checkoutOvertimeCount: 0,
              checkoutOvertimeMinutes: 0,
              absentCount: 0,
              leaveCount: 0,
              A: '',
              Plech: '',
              month: m2,
              year: y2
            };
            grouped.set(gKey, grp);
          }

          grp.dailyData.push({ day: dayNum, date: dateStr, checkIn, checkOut });
          if (checkIn || checkOut) {
            grp.dayWorkCount += 1;
            grp.attendanceCount += 1;
            grp.workTime += diff;
            grp.clock += diff;
            grp.clockCount += (checkIn ? 1 : 0) + (checkOut ? 1 : 0);
          }
        }
      }

      // Send grouped records in batches (one monthly summary per staff/month)
      const allRecords = Array.from(grouped.values());
      const batchSize = 200;
      for (let i = 0; i < allRecords.length; i += batchSize) {
        const batch = allRecords.slice(i, i + batchSize);
        try {
          await api.post('/attendance/monthly-data', batch);
          imported += batch.length;
        } catch (err) {
          console.error('Failed to import batch', { start: i, size: batch.length }, err);
          // Fallback: try per-record so we don't lose all
          for (let j = 0; j < batch.length; j++) {
            try {
              await api.post('/attendance/monthly-data', batch[j]);
              imported++;
            } catch (e2) {
              skippedRows++;
              console.error('Failed to import record', batch[j]?.staffId, e2);
            }
          }
        }
      }

      await load();
      setLastImportStats({
        fileName: file?.name || '',
        totalRows,
        imported,
        uniqueStaffIds: seenStaffIds.size,
        duplicateStaffIds,
        skippedRows,
        when: new Date().toISOString()
      });
      alert(`Imported ${imported} records`);
    } catch (err) {
      console.error(err);
      alert('Import failed: ' + err.message);
    }
  };

  const doPrint = () => {
    window.print();
  };

  const handleEdit = async (rec) => {
    try {
      const workTime = window.prompt('Work Time (Q-mn)', rec.workTime || '');
      if (workTime === null) return;
      const clock = window.prompt('Clock', rec.clock || '0');
      if (clock === null) return;
      const clockCount = window.prompt('Clock Count', String(rec.clockCount || 0));
      if (clockCount === null) return;

      const payload = {
        staffId: rec.staffId,
        name: rec.name || '',
        year: rec.year || new Date(dateFromDate).getFullYear(),
        month: rec.month || (new Date(dateFromDate).getMonth() + 1),
        workTime: Number(workTime) || 0,
        clock: Number(clock) || 0,
        clockCount: Number(clockCount) || 0,
        checkinLateMinutes: rec.checkinLateMinutes || 0,
        checkinLateCount: rec.checkinLateCount || 0,
        checkoutEarlyMinutes: rec.checkoutEarlyMinutes || 0,
        checkoutEarlyCount: rec.checkoutEarlyCount || 0,
        checkoutOvertimeMinutes: rec.checkoutOvertimeMinutes || 0,
        checkoutOvertimeCount: rec.checkoutOvertimeCount || 0,
        absentCount: rec.absentCount || 0,
        leaveCount: rec.leaveCount || 0
      };

      await api.post('/attendance/monthly-data', [payload]);
      await load();
      alert('Saved');
    } catch (err) {
      console.error('Edit failed', err);
      alert('Edit failed: ' + err.message);
    }
  };

  const handleDelete = async (rec) => {
    try {
      if (!window.confirm(`Delete monthly attendance for ${rec.staffId} ${rec.month}/${rec.year}? This will remove per-day attendance and monthly summary for this staff.`)) return;
      await api.delete('/attendance/monthly-data', { params: { staffId: rec.staffId, year: rec.year || new Date(dateFromDate).getFullYear(), month: rec.month || (new Date(dateFromDate).getMonth() + 1) } });
      await load();
      alert('Deleted');
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed: ' + err.message);
    }
  };

  const handleEditDay = async (rec, dayEntry) => {
    try {
      const checkIn = window.prompt('Check In (HH:MM)', dayEntry.checkIn || '');
      if (checkIn === null) return;
      const checkOut = window.prompt('Check Out (HH:MM)', dayEntry.checkOut || '');
      if (checkOut === null) return;

      if (dayEntry._id) {
        await api.put(`/attendance/${dayEntry._id}`, { checkIn, checkOut });
      } else {
        // create a new attendance record for that date
        const year = rec.year || new Date(dateFromDate).getFullYear();
        const month = (rec.month || (new Date(dateFromDate).getMonth() + 1));
        const dateObj = new Date(Number(year), Number(month) - 1, Number(dayEntry.day));
        await api.post('/attendance', { staffId: rec.staffId, date: dateObj.toISOString(), checkIn, checkOut });
      }
      await load();
    } catch (err) {
      console.error('Edit day failed', err);
      alert('Edit day failed: ' + err.message);
    }
  };

  const handleDeleteDay = async (rec, dayEntry) => {
    try {
      if (!dayEntry._id) {
        alert('No attendance record to delete');
        return;
      }
      if (!window.confirm(`Delete attendance for ${rec.staffId} on day ${dayEntry.day}?`)) return;
      await api.delete(`/attendance/${dayEntry._id}`);
      await load();
    } catch (err) {
      console.error('Delete day failed', err);
      alert('Delete day failed: ' + err.message);
    }
  };

  const handleDeleteAllByDate = async () => {
    try {
      const isRange = dateFromDate !== dateToDate;
      let params = {};
      let confirmMsg = "";

      if (isRange) {
        if (!window.confirm(`ចង់លុបទិន្នន័យទាំងអស់ចាប់ពីថ្ងៃទី ${dateFromDate} ដល់ ${dateToDate} មែនទេ?`)) return;
        params = { from: dateFromDate, to: dateToDate };
        confirmMsg = `ចាប់ពីថ្ងៃទី ${dateFromDate} ដល់ ${dateToDate}`;
      } else {
        const defaultDate = dateFromDate || ymdLocal(new Date());
        const dateStr = window.prompt('លុបទិន្នន័យតាមថ្ងៃ (YYYY-MM-DD):', defaultDate)?.trim();
        if (!dateStr) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          alert('ថ្ងៃខែឆ្នាំមិនត្រឹមត្រូវ (YYYY-MM-DD)');
          return;
        }
        if (!window.confirm(`ចង់លុបទិន្នន័យទាំងអស់សម្រាប់ថ្ងៃទី ${dateStr} មែនទេ?`)) return;
        params = { date: dateStr };
        confirmMsg = `ថ្ងៃទី ${dateStr}`;
      }

      const res = await api.delete('/attendance/day-data', { params });
      const info = res?.data || {};
      alert(
        `លុបទិន្នន័យសម្រេច!\n` +
        `កាលបរិច្ឆេទ: ${confirmMsg}\n` +
        `Attendance deleted: ${info.attendanceDeleted ?? 0}\n` +
        `DayData deleted: ${info.dayDataDeleted ?? 0}\n` +
        `DailyReport deleted: ${info.dailyReportDeleted ?? 0}`
      );
      await load();
    } catch (err) {
      console.error('Delete all by date failed', err);
      alert('Delete failed: ' + (err?.response?.data?.message || err.message));
    }
  };

  // Get date range for display
  const getDisplayDates = () => {
    const from = new Date(dateFromDate);
    const to = new Date(dateToDate);
    const dates = [];

    if (from > to) return dates;

    let current = new Date(from);
    while (current <= to) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const displayDates = getDisplayDates();

  const recordMatchesFilters = (record) => {
    const flags = filterFlags;
    const anyFlagOn = Object.values(flags).some(Boolean);

    const staffId = String(record?.staffId || '').toLowerCase();
    const name = String(record?.name || record?.khmerName || record?.staffName || '').toLowerCase();
    const dept = String(record?.department || '').toLowerCase();

    if (selectedDepartment && selectedDepartment !== 'all') {
      if (dept !== selectedDepartment.toLowerCase()) return false;
    }

    const q = String(searchText || '').trim().toLowerCase();
    const matchesText = !q || staffId.includes(q) || name.includes(q) || dept.includes(q);
    if (!matchesText) return false;

    if (!anyFlagOn) return true;

    const num = (v) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    const hasAnyTime = Array.isArray(record?.dailyData)
      ? record.dailyData.some(d => d && (d.checkIn || d.checkOut))
      : false;

    const isPresent = num(record?.attendanceCount) > 0 || hasAnyTime;
    const isAbsent = num(record?.absentCount) > 0;
    const isLeave = num(record?.leaveCount) > 0;
    const isLate = num(record?.checkinLateCount) > 0 || num(record?.checkinLateMinutes) > 0;
    const isEarly = num(record?.checkoutEarlyCount) > 0 || num(record?.checkoutEarlyMinutes) > 0;
    const isPlech = num(record?.Plech) > 0;
    const isNotWorking = !isPresent && !isAbsent && !isLeave && num(record?.dayWorkCount) === 0;

    return (
      (flags.present && isPresent) ||
      (flags.absent && isAbsent) ||
      (flags.leave && isLeave) ||
      (flags.late && isLate) ||
      (flags.early && isEarly) ||
      (flags.forgot && isPlech) ||
      (flags.notWorking && isNotWorking)
    );
  };

  const filteredData = Array.isArray(data) ? data.filter(recordMatchesFilters) : [];

  // Reset to first page when filters/search/range changes.
  useEffect(() => {
    setPage(1);
  }, [searchText, filterFlags, dateFromDate, dateToDate]);

  const totalFiltered = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const pageData = filteredData.slice(startIndex, endIndex);

  if (!canViewAttendanceMonthlyData) {
    return <div className="p-4">មិនមានការអនុញ្ញាត</div>;
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Khmer OS, Arial' }}>
      <h1 className="text-lg font-semibold mb-4">សរុបវត្តមានតាមចន្លោះថ្ងៃ (Attendance Summary by Range)</h1>

      <div className="flex gap-4 mb-4 flex-wrap items-center no-print">
        <div className="flex gap-2 items-center">
          <label className="text-sm whitespace-nowrap">ចាប់ពី:</label>
          <input
            type="date"
            value={dateFromDate}
            onChange={(e) => setDateFromDate(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
          />
        </div>

        <div className="flex gap-2 items-center">
          <label className="text-sm whitespace-nowrap ml-2">ដល់:</label>
          <input
            type="date"
            value={dateToDate}
            onChange={(e) => setDateToDate(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
          />
        </div>

        <div className="flex gap-2 items-center ml-2">
          <label className="text-sm whitespace-nowrap">ស្វែងរក:</label>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Staff ID / ឈ្មោះ"
            style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, minWidth: 220 }}
          />
        </div>

        <div>
          <button
            onClick={exportExcel}
            className="border rounded px-3 py-1 bg-green-600 text-white hover:bg-green-700"
          >
            នាំចេញ Excel
          </button>
        </div>

        <div>
          <label className="border rounded px-3 py-1 bg-orange-600 text-white cursor-pointer hover:bg-orange-700 inline-block">
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              disabled={loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) importExcel(file);
              }}
            />
          </label>
        </div>

        <div>
          <button
            onClick={doPrint}
            className="border rounded px-3 py-1 bg-gray-600 text-white hover:bg-gray-700"
          >
            ព្រីន
          </button>
        </div>

        <div>
          <button
            onClick={handleDeleteAllByDate}
            className="border rounded px-3 py-1 bg-red-600 text-white hover:bg-red-700"
          >
            លុបទិន្នន័យ
          </button>
        </div>
      </div>

      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fff'
        }}
      >
        <div className="no-print" style={{ padding: 8, borderBottom: '1px solid #e5e7eb', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            បង្ហាញ: <b>{totalFiltered === 0 ? 0 : startIndex + 1}-{endIndex}</b> / {totalFiltered}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>បង្ហាញម្តង:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value) || 20;
                setPageSize(next);
                setPage(1);
              }}
              style={{ padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, background: safePage <= 1 ? '#f3f4f6' : '#fff' }}
            >
              ◀
            </button>
            <div>
              ទំព័រ <b>{safePage}</b> / {totalPages}
            </div>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, background: safePage >= totalPages ? '#f3f4f6' : '#fff' }}
            >
              ▶
            </button>
          </div>
          {loading && <div>Loading...</div>}
        </div>

        <table
          style={{
            minWidth: 1000,
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: 11
          }}
        >
          <thead>
            <tr style={{ background: '#FFE6E6' }}>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Staff ID</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>khmerName</th>
              <th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Day Work</th>
              <th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Attendance</th>
              <th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Work Time</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Clock</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Checkin Late</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Checkout Early</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Checkout Overtime</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Absent</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>លទ្ធផលវាយតម្លៃ</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Leave</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>A</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Plech</th>
            </tr>
            <tr style={{ background: '#FFE6E6' }}>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={18} style={{ padding: 12, textAlign: 'center', color: '#6b7280' }}>
                  {loading ? 'កំពុងផ្ទុក...' : 'គ្មានទិន្នន័យ'}
                </td>
              </tr>
            ) : (
              pageData.map((rec) => {
                let percent = 0;
                if (rec.dayWorkCount && rec.attendanceCount) {
                  percent = (Number(rec.attendanceCount) / Number(rec.dayWorkCount)) * 100;
                }
                let performanceResult = '';
                if (percent >= 95) performanceResult = 'ល្អ';
                else if (percent >= 85) performanceResult = 'ល្អបង្គួរ';
                else if (percent >= 70) performanceResult = 'មធ្យម';
                else performanceResult = 'ខ្សោយ';
                rec.performanceResult = performanceResult;

                if (typeof window !== 'undefined') console.log('DEBUG rec:', rec);
                return (
                  <tr key={rec.staffId}>
                    <td style={{ border: '1px solid #000', padding: 6, whiteSpace: 'nowrap' }}>{rec.staffId}</td>
                    <td style={{ border: '1px solid #000', padding: 6, minWidth: 180 }}>{rec.name}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.dayWorkCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.attendanceCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.workTime)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.clock)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.clockCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.checkinLateMinutes)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkinLateCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.checkoutEarlyMinutes)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkoutEarlyCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.checkoutOvertimeMinutes)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkoutOvertimeCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.absentCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center', background: '#ffff99', color: '#d00' }}>{rec.performanceResult || 'NO DATA'}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.leaveCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.A}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.Plech}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
