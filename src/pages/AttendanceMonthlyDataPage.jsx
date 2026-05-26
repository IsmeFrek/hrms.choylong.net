import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import usePermission from '../hooks/usePermission';
import './AttendanceMonthlyDataPage.css';

export default function AttendanceMonthlyDataPage() {
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
          month: fromObj.getMonth() + 1
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

          const { isOff, effectiveStatus, hasScheduleTime, isDayOffBySchedule, isOffByStatus } = checkIsOff(status, hasAny, sch, dayISO, isWeekend, hMap.has(dayISO));

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
            if (diff < 0) diff += 24 * 60;
            if (diff > 0) {
              rec.workTime += diff;
              rec.clock += diff;
              rec.clockCount += (ci ? 1 : 0) + (co ? 1 : 0);
            }
          }

          // Late/Early Checks
          let refStart = null, refEnd = null, refGrace = 15;
          if (hasScheduleTime && !isDayOffBySchedule) {
            refStart = sch.shiftStart;
            refEnd = sch.shiftEnd;
            refGrace = sch.scheduledGraceMinutes || 15;
          } else if (isDayOffBySchedule && hasAny) {
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
  const pagedData = filteredData.slice(startIndex, endIndex);

  if (!canViewAttendanceMonthlyData) {
    return <div className="p-4">មិនមានការអនុញ្ញាត</div>;
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Khmer OS, Arial', paddingBottom: '2rem' }}>
      <div
        className="no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: '#f8fafc',
          margin: '-1rem -1rem 1rem -1rem',
          padding: '1rem 1rem 0 1rem',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>ទិន្នន័យវត្តមានប្រចាំខែ (Monthly Attendance Data)</h1>
        {modalOpen && modalData && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 6, minWidth: 360 }}>
              <h3 style={{ marginTop: 0 }}>{modalType === 'day' ? 'Edit Daily Attendance' : 'Edit Monthly Summary'}</h3>
              {modalType === 'day' ? (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: 12 }}>Staff</label>
                    <div>{modalData.staffId} - {modalData.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12 }}>Day</label>
                      <div>{modalData.day}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12 }}>Check In</label>
                      <input value={modalData.checkIn} onChange={(e) => setModalData({ ...modalData, checkIn: e.target.value })} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12 }}>Check Out</label>
                      <input value={modalData.checkOut} onChange={(e) => setModalData({ ...modalData, checkOut: e.target.value })} />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: 12 }}>Staff</label>
                    <div>{modalData.staffId} - {modalData.name}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>ប្រភេទច្បាប់ឈប់សម្រាក</label>
                      <input value={modalData.leaveType} onChange={(e) => setModalData({ ...modalData, leaveType: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>ផ្សេងៗ</label>
                      <input value={modalData.other} onChange={(e) => setModalData({ ...modalData, other: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: 12 }}>មតិ (លើអវត្តមាន/ច្បាប់)</label>
                    <input value={modalData.totalLeaveComment} onChange={(e) => setModalData({ ...modalData, totalLeaveComment: e.target.value })} style={{ width: '100%' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Day Work</label>
                      <input value={modalData.dayWorkCount} onChange={(e) => setModalData({ ...modalData, dayWorkCount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Attendance</label>
                      <input value={modalData.attendanceCount} onChange={(e) => setModalData({ ...modalData, attendanceCount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Work Time (minutes)</label>
                      <input value={modalData.workTime} onChange={(e) => setModalData({ ...modalData, workTime: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Checkin Late (count)</label>
                      <input value={modalData.checkinLateCount} onChange={(e) => setModalData({ ...modalData, checkinLateCount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Checkout Early (count)</label>
                      <input value={modalData.checkoutEarlyCount} onChange={(e) => setModalData({ ...modalData, checkoutEarlyCount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Checkout Overtime (count)</label>
                      <input value={modalData.checkoutOvertimeCount} onChange={(e) => setModalData({ ...modalData, checkoutOvertimeCount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Checkout Overtime (minutes)</label>
                      <input value={modalData.checkoutOvertimeMinutes} onChange={(e) => setModalData({ ...modalData, checkoutOvertimeMinutes: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Absent</label>
                      <input value={modalData.absentCount} onChange={(e) => setModalData({ ...modalData, absentCount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Leave</label>
                      <input value={modalData.leaveCount} onChange={(e) => setModalData({ ...modalData, leaveCount: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>A</label>
                      <input value={modalData.A} onChange={(e) => setModalData({ ...modalData, A: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12 }}>Plech</label>
                      <input value={modalData.plech} onChange={(e) => setModalData({ ...modalData, plech: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={closeModal} className="border rounded px-3 py-1">Cancel</button>
                <button onClick={saveModal} className="border rounded px-3 py-1 bg-green-600 text-white">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label className="text-sm block mb-2">ជ្រើសរើសខែ</label>
              <input
                type="month"
                value={monthYear}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  setMonthYear(val);
                  const [y, m] = val.split('-');
                  const start = `${y}-${m}-01`;
                  const end = ymdLocal(new Date(y, m, 0));
                  setDateFromDate(start);
                  setDateToDate(end);
                }}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
              />
            </div>

            <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 8px 6px' }}></div>

            <div>
              <label className="text-sm block mb-2">ថ្ងៃចាប់ផ្តើម</label>
              <input
                type="date"
                value={dateFromDate}
                onChange={(e) => setDateFromDate(e.target.value)}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
              />
            </div>

            <span style={{ fontSize: 12, marginBottom: 8 }}>ដល់</span>

            <div>
              <label className="text-sm block mb-2">ថ្ងៃបញ្ចប់</label>
              <input
                type="date"
                value={dateToDate}
                onChange={(e) => setDateToDate(e.target.value)}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
              />
            </div>

            {(() => {
              const f = new Date(dateFromDate);
              const t = new Date(dateToDate);
              const diffMonths = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth());
              if (diffMonths >= 1 || (f.getFullYear() !== t.getFullYear() || f.getMonth() !== t.getMonth())) {
                return (
                  <div style={{
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    color: '#9a3412',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4
                  }}>
                    <span style={{ fontSize: 14 }}>⚠️</span>
                    <span>បង្ហាញទិន្នន័យសរុបច្រើនខែ ({diffMonths + 1} ខែ)</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label className="text-sm block mb-2">ផ្នែក (Department)</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, minWidth: 150 }}
              >
                <option value="all">ទាំងអស់ (All)</option>
                {departmentsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm block mb-2">ស្វែងរក</label>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Staff ID / ឈ្មោះ / ផ្នែក"
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, minWidth: 220 }}
              />
            </div>

            <div>
              <label className="text-sm block mb-2">Filter</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filterFlags.present}
                    onChange={(e) => setFilterFlags(s => ({ ...s, present: e.target.checked }))}
                  />
                  វត្តមាន
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filterFlags.absent}
                    onChange={(e) => setFilterFlags(s => ({ ...s, absent: e.target.checked }))}
                  />
                  អវត្តមាន
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filterFlags.leave}
                    onChange={(e) => setFilterFlags(s => ({ ...s, leave: e.target.checked }))}
                  />
                  ច្បាប់
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filterFlags.late}
                    onChange={(e) => setFilterFlags(s => ({ ...s, late: e.target.checked }))}
                  />
                  ចូលយឺត
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filterFlags.early}
                    onChange={(e) => setFilterFlags(s => ({ ...s, early: e.target.checked }))}
                  />
                  ចេញមុន
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filterFlags.forgot}
                    onChange={(e) => setFilterFlags(s => ({ ...s, forgot: e.target.checked }))}
                  />
                  ភ្លេច
                </label>
                <label
                  style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                  title="Day Work = 0 និងគ្មានវត្តមាន/អវត្តមាន/ច្បាប់"
                >
                  <input
                    type="checkbox"
                    checked={filterFlags.notWorking}
                    onChange={(e) => setFilterFlags(s => ({ ...s, notWorking: e.target.checked }))}
                  />
                  សម្រាក
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setSearchText('');
                    setSelectedDepartment('all');
                    setFilterFlags({ present: false, absent: false, leave: false, late: false, early: false, forgot: false, notWorking: false });
                  }}
                  style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, background: '#f3f4f6' }}
                >
                  Clear
                </button>
              </div>
            </div>
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
            <button
              onClick={handleDeleteAllByDate}
              className="border rounded px-3 py-1 bg-red-600 text-white hover:bg-red-700"
              title="លុបទិន្នន័យវត្តមាន/ច្បាប់/ស្កេន (ទាំងអស់) សម្រាប់ថ្ងៃដែលបានជ្រើស"
            >
              លុបតាមថ្ងៃ
            </button>
          </div>

          <div>
            <label className="border rounded px-3 py-1 bg-orange-600 text-white cursor-pointer hover:bg-orange-700 inline-block">
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importExcel(file);
                }}
              />
            </label>
          </div>

          <div className="no-print">
            <button
              onClick={doPrint}
              className="border rounded px-3 py-1 bg-gray-600 text-white hover:bg-gray-700"
            >
              ព្រីន
            </button>
          </div>
        </div>

        {/* Data Table */}
        <style>{`
        @media print {
          .no-print { display: none !important; }
          table { font-size: 10px; }
          .page-break { page-break-after: always; }
        }
      `}</style>

        {/* Table Pagination (moved inside the sticky header above) */}
        <div style={{
          background: '#fff',
          padding: 8,
          border: '1px solid #e5e7eb',
          borderBottom: 'none',
          borderRadius: '6px 6px 0 0',
          fontSize: 12,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div>
            បង្ហាញ: <b>{totalFiltered === 0 ? 0 : (startIndex + 1)}-{endIndex}</b> / {totalFiltered} (សរុប: {Array.isArray(data) ? data.length : 0})
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>បង្ហាញម្តង:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value) || 50;
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
          {lastImportStats && (
            <div>
              Excel: <b>{lastImportStats.totalRows}</b> row(s), Imported: <b>{lastImportStats.imported}</b>
              {typeof lastImportStats.uniqueStaffIds === 'number' ? `, Unique: ${lastImportStats.uniqueStaffIds}` : ''}
              {typeof lastImportStats.duplicateStaffIds === 'number' && lastImportStats.duplicateStaffIds > 0 ? `, Duplicates: ${lastImportStats.duplicateStaffIds}` : ''}
              {typeof lastImportStats.skippedRows === 'number' && lastImportStats.skippedRows > 0 ? `, Failed: ${lastImportStats.skippedRows}` : ''}
              {lastImportStats.fileName ? ` (${lastImportStats.fileName})` : ''}
              {totalFiltered < (Array.isArray(data) ? data.length : 0) ? ' — មាន Filter/ស្វែងរក កំពុងលាក់ខ្លះៗ' : ''}
            </div>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          overflow: 'auto',
          maxHeight: 'calc(100vh - 220px)',
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          background: '#fff'
        }}
      >
        <table
          style={{
            minWidth: 1200,
            borderCollapse: 'separate',
            borderSpacing: 0,
            width: '100%',
            fontSize: 11
          }}
        >
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <tr style={{ background: '#FFE6E6' }}>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Staff ID</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>khmerName</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>ផ្នែក</th>
              <th colSpan={displayDates.length} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Daily
              </th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Day Work</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Attendance</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Work Time</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Clock
              </th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Checkin Late
              </th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Checkout Early
              </th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Checkout Overtime
              </th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Absent</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Leave</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>A</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Plech</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Actions</th>
            </tr>
            <tr style={{ background: '#FFE6E6' }}>
              {/* first two headers use rowSpan=2, so no placeholders here */}
              {displayDates.map((dt, i) => (
                <th
                  key={i}
                  style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: 6, fontSize: 10, textAlign: 'center', background: '#FFE6E6' }}
                  title="Check in - Check out"
                >
                  <div style={{ fontWeight: 700 }}>{dt.getDate()}</div>
                  <div style={{ fontSize: 9, opacity: 0.8 }}>Check in - Check out</div>
                </th>
              ))}
              <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: 8, background: '#FFE6E6' }}>Count</th>
              <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: 8, background: '#FFE6E6' }}>Count</th>
              <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: 8, background: '#FFE6E6' }}>Q-mn</th>
              <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', padding: 8, background: '#FFE6E6' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={20}
                  style={{
                    border: '1px solid #e2e8f0',
                    padding: 8,
                    textAlign: 'center',
                    color: '#999'
                  }}
                >
                  {loading ? 'កំពុងផ្ទុក...' : 'គ្មានទិន្នន័យ'}
                </td>
              </tr>
            ) : (
              pagedData.map((record, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8 }}>{record.staffId}</td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8 }}>{record.name || record.khmerName || record.staffName}</td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8 }}>{record.department || '—'}</td>
                  {displayDates.map((dt, i) => {
                    const dtStr = ymdLocal(dt);
                    const dayData = record.dailyData?.find(d => {
                      if (d?.date) return ymdLocal(d.date) === dtStr;
                      return d?.day === dt.getDate();
                    });

                    const schKey = `${record.staffId}_${dtStr}`;
                    const sch = schedulesMap.get(schKey);
                    const isDayOffBySchedule = sch && (
                      (sch.shiftTitle || '').toLowerCase() === 'day off' ||
                      (sch.shiftTitle || '').includes('សម្រាក')
                    );
                    const hasScheduleTime = sch && sch.shiftStart && sch.shiftEnd;
                    const schText = isDayOffBySchedule ? 'Day Off' : (hasScheduleTime ? `${formatHMTo12(sch.shiftStart)} - ${formatHMTo12(sch.shiftEnd)}` : (sch?.shiftTitle || 'No Schedule'));

                    let bgColor = getDayCellBackground(dayData);
                    if (isDayOffBySchedule && (!dayData || (!dayData.checkIn && !dayData.checkOut))) {
                      bgColor = '#C084FC'; // Purple for Day Off
                    } else if (bgColor === '#ADD8E6') {
                      bgColor = '#C084FC'; // standard rest color
                    }

                    return (
                      <td
                        key={i}
                        onClick={() => dayData && openDayModal(record, dayData)}
                        onDoubleClick={() => dayData && handleDeleteDay(record, dayData)}
                        style={{
                          cursor: dayData ? 'pointer' : 'default',
                          border: '1px solid #e2e8f0',
                          padding: 8,
                          textAlign: 'center',
                          background: bgColor
                        }}
                        title={dayData ? `Click to edit, double-click to delete${dayData.status ? ` | Status: ${dayData.status}` : ''}` : ''}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {dayData
                            ? (dayData.checkIn && dayData.checkOut)
                              ? `${formatHMTo12(dayData.checkIn)} - ${formatHMTo12(dayData.checkOut)}`
                              : (formatHMTo12(dayData.checkIn) || formatHMTo12(dayData.checkOut) || '-')
                            : '-'}
                        </div>
                        {sch && (
                          <div style={{ fontSize: '10px', color: '#555', marginTop: 4 }}>
                            វេន: {schText}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.dayWorkCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.attendanceCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.workTime)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {""}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {""}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.checkinLateMinutes)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.checkinLateCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.checkoutEarlyMinutes)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.checkoutEarlyCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.checkoutOvertimeMinutes)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.checkoutOvertimeCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.absentCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.leaveCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.A || ''}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.Plech || ''}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    <button
                      onClick={() => openSummaryModal(record)}
                      className="mr-2 border rounded px-2 py-1 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(record)}
                      className="border rounded px-2 py-1 bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Card Modal */}
      {cardModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] no-print">
          <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 overflow-y-auto max-h-[95vh] shadow-2xl border-4 border-blue-100">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-2xl font-bold text-blue-800" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                កាតសង្ខេបវត្តមានបុគ្គលិក
              </h3>
              <div className="flex gap-4 items-center">
                <button
                  onClick={() => setHideCardContent(!hideCardContent)}
                  className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${hideCardContent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                >
                  {hideCardContent ? 'បង្ហាញខ្លឹមសារ' : 'លាក់ខ្លឹមសារដើម្បីមើល Background'}
                </button>
                <button onClick={() => setCardModalOpen(false)} className="text-gray-400 hover:text-red-500 text-3xl">✕</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* FRONT SIDE (Profile) */}
              <div className="relative group">
                <div
                  className="w-full aspect-[1.6/1] rounded-2xl shadow-xl overflow-hidden relative border-2 border-blue-400"
                  style={{
                    backgroundImage: selectedRecord.staffId?.startsWith('D')
                      ? 'url(./Uploads/CardDA.png)'
                      : 'linear-gradient(to bottom right, #1d4ed8, #1e3a8a)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                >
                  {/* Background Pattern (Only for non-D cards) */}
                  {!selectedRecord.staffId?.startsWith('D') && (
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                  )}

                  <div className={`h-full flex flex-col relative z-10 transition-opacity duration-300 ${hideCardContent ? 'opacity-0' : 'opacity-100'}`}>
                    {/* Header */}
                    <div className={`${selectedRecord.staffId?.startsWith('D') ? 'bg-white/80 backdrop-blur-sm' : 'bg-white'} px-4 py-2 flex items-center justify-between border-b-4 border-yellow-400`}>
                      <img src="./Uploads/MOH_logo.png" className="w-10 h-10 object-contain" alt="MOH" />
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-blue-900" style={{ fontFamily: "'Khmer OS Muol Light', sans-serif" }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
                        <div className="text-[9px] text-blue-800 font-bold">KHMER-SOVIET FRIENDSHIP HOSPITAL</div>
                      </div>
                      <img src="./Uploads/Logo_KSFH-Short.png" className="w-10 h-10 object-contain" alt="KSFH" />
                    </div>

                    {/* Body */}
                    <div className="flex-1 p-4 flex gap-4 text-white">
                      <div className="w-24 h-28 bg-white/20 rounded-lg border-2 border-white/50 overflow-hidden flex-shrink-0 backdrop-blur-sm">
                        {cardHrData?.image ? (
                          <img src={cardHrData.image} className="w-full h-full object-cover" alt="Profile" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] opacity-60">គ្មានរូបថត</div>
                        )}
                      </div>
                      <div className="flex flex-col justify-center space-y-1">
                        <div>
                          <div className="text-[10px] text-blue-200">ឈ្មោះ / Name</div>
                          <div className="text-sm font-bold truncate" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>{selectedRecord.khmerName || selectedRecord.name}</div>
                          <div className="text-[10px] font-medium opacity-80 uppercase">{cardHrData?.name || '-'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-blue-200">អត្តលេខ / Staff ID</div>
                          <div className="text-lg font-black text-yellow-400 tracking-wider">{selectedRecord.staffId}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-blue-200">ផ្នែក / Department</div>
                          <div className="text-[11px] font-bold" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>{cardHrData?.Department_Kh || '-'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-yellow-400 py-1 text-center text-blue-900 font-black text-[10px] uppercase tracking-widest">
                      Staff Identification Card
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center text-sm font-bold text-blue-600">ផ្នែកខាងមុខ (Front)</div>
              </div>

              {/* BACK SIDE (Attendance Summary) */}
              <div className="relative">
                <div
                  className="w-full aspect-[1.6/1] rounded-2xl shadow-xl overflow-hidden relative border-2 border-slate-200 flex flex-col"
                  style={{
                    backgroundImage: selectedRecord.staffId?.startsWith('D')
                      ? 'url(./Uploads/CardDB.png)'
                      : 'none',
                    backgroundColor: selectedRecord.staffId?.startsWith('D') ? 'transparent' : '#f8fafc',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                >
                  <div className={`flex flex-col h-full transition-opacity duration-300 ${hideCardContent ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="bg-blue-800 text-white py-2 px-4 flex justify-between items-center relative z-10">
                      <span className="text-[12px] font-bold" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>សេចក្តីសរុបវត្តមាន</span>
                      <span className="text-[10px] opacity-80">{dateFromDate} - {dateToDate}</span>
                    </div>

                    <div className="flex-1 p-3 grid grid-cols-3 gap-2">
                      {[
                        { label: 'ថ្ងៃធ្វើការ', val: selectedRecord.dayWorkCount, color: 'bg-blue-100 text-blue-700' },
                        { label: 'វត្តមាន', val: selectedRecord.attendanceCount, color: 'bg-green-100 text-green-700' },
                        { label: 'ម៉ោងសរុប', val: formatWorkTime(selectedRecord.workTime), color: 'bg-indigo-100 text-indigo-700' },
                        { label: 'មកយឺត', val: selectedRecord.checkinLateCount, color: 'bg-orange-100 text-orange-700' },
                        { label: 'ចេញមុន', val: selectedRecord.checkoutEarlyCount, color: 'bg-amber-100 text-amber-700' },
                        { label: 'Overtime', val: selectedRecord.checkoutOvertimeCount, color: 'bg-purple-100 text-purple-700' },
                        { label: 'អវត្តមាន', val: selectedRecord.absentCount, color: 'bg-red-100 text-red-700' },
                        { label: 'ច្បាប់', val: selectedRecord.leaveCount, color: 'bg-violet-100 text-violet-700' },
                        { label: 'ភ្លេចស្កេន', val: selectedRecord.plech || 0, color: 'bg-slate-200 text-slate-700' },
                      ].map((item, i) => (
                        <div key={i} className={`${item.color} rounded-lg p-2 flex flex-col items-center justify-center border border-black/5 shadow-sm`}>
                          <div className="text-[9px] font-bold mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>{item.label}</div>
                          <div className="text-[13px] font-black">{item.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* QR/Verification section */}
                    <div className="bg-slate-200 p-2 flex items-center justify-between px-4">
                      <div className="text-[8px] text-slate-500 italic">Generated by HR System v4.0</div>
                      <div className="flex gap-2 items-center">
                        <div className="w-6 h-6 bg-white border border-slate-300 rounded flex items-center justify-center text-[8px] font-bold">QR</div>
                        <div className="text-[9px] font-bold text-slate-700">{selectedRecord.staffId}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-center text-sm font-bold text-slate-600">ផ្នែកខាងក្រោយ (Back Summary)</div>
              </div>
            </div>

            <div className="mt-8 flex justify-center gap-4 border-top pt-6">
              <button
                onClick={() => window.print()}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
                style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                បោះពុម្ពកាត
              </button>
              <button
                onClick={() => setCardModalOpen(false)}
                className="px-8 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
                style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
              >
                បិទផ្ទាំងនេះ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
