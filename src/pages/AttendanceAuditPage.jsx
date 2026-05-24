import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

function buildPrintStyle(orientation) {
  const o = (orientation === 'landscape') ? 'landscape' : 'portrait';
  const contentWidth = o === 'landscape' ? '279mm' : '210mm';
  return `
@media print {
  @page {
    size: A4 ${o};
    margin-top: 10mm;
    margin-bottom: 10mm;
    margin-left: 0;
    margin-right: 0;
  }
  @page :first {
    margin-top: 0mm;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
  #attendance-print-content {
    box-sizing: border-box;
    margin: 0 auto !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: white !important;
    page-break-after: avoid;
    max-width: ${contentWidth};
  }
  .a4-sheet {
    margin: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: white !important;
    min-height: auto !important;
    height: auto !important;
  }
  .screen-only-label {
    display: none !important;
  }
  body * {
    visibility: hidden;
  }
  #attendance-print-content, #attendance-print-content * {
    visibility: visible;
  }
  #attendance-print-content {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    background: white !important;
  }

  #attendance-print-content h1 { font-size: 18px !important; }
  #attendance-print-content p { font-size: 14px !important; }
  #attendance-print-content table { table-layout: fixed; }
}
`;
}

function parseWorkTimeToMinutes(v) {
  if (v === null || typeof v === 'undefined' || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v >= 24) return Math.round(v);
    return Math.round(v * 60);
  }
  const s = String(v).trim();
  if (!s) return 0;
  const hm = s.match(/^(\d+)\s*h\s*(\d+)?\s*m?$/i);
  if (hm) {
    const h = Number(hm[1] || 0);
    const m = Number(hm[2] || 0);
    return h * 60 + m;
  }
  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n >= 24) return Math.round(n);
    return Math.round(n * 60);
  }
  return 0;
}

function formatMinutesAsHM(minutes) {
  const m = Number(minutes) || 0;
  const absMinutes = Math.max(0, Math.round(Math.abs(m)));
  const h = Math.floor(absMinutes / 60);
  const mm = absMinutes % 60;
  return `${h}h ${mm}m`;
}

function parseHMToMinutesSimple(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function parseDateSafe(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function toLocalISO(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtKhmerLongDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const dd = toKhmerDigits(String(dt.getDate()).padStart(1, '0'));
  const mmName = khMonths[dt.getMonth()];
  const yyyy = toKhmerDigits(dt.getFullYear());
  return `ថ្ងៃទី ${dd} ខែ ${mmName} ឆ្នាំ ${yyyy}`;
}

function fmtGenderShort(g) {
  const v = (g || '').toString().trim().toLowerCase();
  if (!v) return '';
  if (v === 'male' || v === 'm' || v === 'ប្រុស') return 'ប';
  if (v === 'female' || v === 'f' || v === 'ស្រី') return 'ស';
  return g;
}

function abbreviateLeaveType(type) {
  if (!type) return '';
  const map = {
    'ច្បាប់ឈប់ប្រចាំឆ្នាំ': 'ច_ប្រចាំឆ្នាំ',
    'បេសកកម្ម': 'បេសកកម្ម',
    'ច្បាប់ឈប់សម្រាលកូន': 'មាតុភាព',
    'ច្បាប់ឈប់ពិសេស': 'ច.ព',
    'ច្បាប់ឈប់ដោយមានជំងឺ': 'ច_មានជំងឺ',
    'ច្បាប់ឈប់ឈឺ': 'ច_មានជំងឺ',
    'ទៅរៀនរយៈពេលខ្លី': 'រ.ខ',
    'ទៅរៀនរយៈពេលវែង': 'រៀន.ពេលវែង',
    'ជំនួសថ្ងៃឈប់សម្រាក': 'ជ.ឈ',
    'ជំនួសថ្ងៃសម្រាក': 'ជ.ឈ',
    'សុំយឺត/ចេញមុន': 'យ/ម',
    'សុំចេញក្រៅ': 'ច.ក',
    'ច្បាប់រៀបអាពាហ៍ពិពាហ៍': 'ច.រ',
    'ច្បាប់ឈប់រយៈពេលខ្លី': 'ច_ពេលខ្លី',
    'ច្បាប់ឈប់សម្រាកដោយមានកិច្ចការផ្ទាល់ខ្លួន': 'ច_ផ្ទាល់ខ្លួន',
    'ច្បាប់សម្រាកព្យាបាលជំងឺ': 'ច_ព្យាបាលជំងឺ',
    'ទៅរៀនរយៈពេលយូ': 'រៀន.ពេលយូ'
  };

  return type.split(',').map(t => {
    const trimmed = t.trim();
    const cleanStr = trimmed.replace(/\u200B/g, ''); // Remove zero width spaces for matching

    if (map[cleanStr]) return map[cleanStr];
    if (map[trimmed]) return map[trimmed];

    if (cleanStr.includes('ផ្ទាល់ខ្លួន')) return 'ច_ផ្ទាល់ខ្លួន';
    if (cleanStr.includes('ព្យាបាលជំងឺ')) return 'ច_ព្យាបាលជំងឺ';

    return trimmed;
  }).join(', ');
}

export default function AttendanceAuditPage() {
  // Inject print style on mount
  useEffect(() => {
    let style = document.getElementById('attendance-audit-print-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'attendance-audit-print-style';
      document.head.appendChild(style);
    }

    return () => {
      if (style && style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);

  const [printOrientation, setPrintOrientation] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceAuditPrintOrientation');
      if (v === 'landscape' || v === 'portrait') return v;
    } catch { void 0; }
    return 'portrait';
  });

  useEffect(() => {
    try { localStorage.setItem('attendanceAuditPrintOrientation', printOrientation); } catch { void 0; }
    const style = document.getElementById('attendance-audit-print-style');
    if (style) style.innerHTML = buildPrintStyle(printOrientation);
  }, [printOrientation]);

  const printCss = useMemo(() => buildPrintStyle(printOrientation), [printOrientation]);
  const perms = usePermission();
  const navigate = useNavigate();
  const [attendanceData, setAttendanceData] = useState([]);
  const [q, setQ] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [firstPageRows, setFirstPageRows] = useState(25);
  const [otherPageRows, setOtherPageRows] = useState(28);

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

  const today = new Date();
  const defaultDate = toLocalISO(today);
  const [fromDate, setFromDate] = useState(() => getInitialDate('attendanceAuditFromDate', defaultDate));
  const [toDate, setToDate] = useState(() => getInitialDate('attendanceAuditToDate', defaultDate));
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timestamp = new Date().getTime();
    try {
      localStorage.setItem('attendanceAuditFromDate', JSON.stringify({ value: fromDate, timestamp }));
      localStorage.setItem('attendanceAuditToDate', JSON.stringify({ value: toDate, timestamp }));

      const d = new Date(fromDate);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const isoEnd = toLocalISO(endOfMonth);
      if (toDate === isoEnd && d.getDate() === 1) {
        setMonthYear(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } catch { void 0; }
  }, [fromDate, toDate]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowHeight, setRowHeight] = useState(28);
  const [showColsMenu, setShowColsMenu] = useState(false);
  const printRef = useRef();
  const colsMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colsMenuRef.current && !colsMenuRef.current.contains(e.target)) {
        setShowColsMenu(false);
      }
    };
    if (showColsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColsMenu]);

  const mergeText = (a, b) => {
    const left = (a || '').toString().trim();
    const right = (b || '').toString().trim();
    if (!left) return right;
    if (!right) return left;
    if (left === right) return left;
    if (left.includes(right)) return left;
    return `${left}; ${right}`;
  };

  useEffect(() => {
    try {
      const rh = JSON.parse(localStorage.getItem('attendanceAuditRowHeight') || 'null');
      if (typeof rh === 'number' && Number.isFinite(rh)) setRowHeight(rh);
    } catch { void 0; }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('attendanceAuditRowHeight', JSON.stringify(rowHeight));
    } catch { void 0; }
  }, [rowHeight]);

  const columnMeta = useMemo(() => ({
    index: { label: 'ល.រ', width: 'auto', align: 'center', header: 'ល.រ' },
    staffId: { label: 'អត្តលេខ', width: 60, align: 'center', header: 'Staff ID' },
    name: { label: 'គោត្តនាម និងនាម', width: 'auto', align: 'center', header: 'គោត្តនាម និងនាម' },
    gender: { label: 'ភេទ', width: 30, align: 'center', header: 'ភេទ' },
    position: { label: 'តួនាទី', width: 'auto', align: 'center', header: 'តួនាទី' },
    department: { label: 'ផ្នែក', width: 100, align: 'center', header: 'ផ្នែក' },
    dayWorkCount: { label: 'ចំនួន\nធ្វើការ', width: 'auto', align: 'center', header: 'ចំនួនធ្វើការ' },
    attendanceCount: { label: 'ចំនួនវត្តមាន', width: 50, align: 'center', header: 'ចំនួនវត្តមាន' },
    leaveCount: { label: 'ច្បាប់', width: 'auto', align: 'center', header: 'ច្បាប់' },
    leaveType: { label: 'ប្រភេទច្បាប់', width: 'auto', align: 'center', header: 'ប្រភេទច្បាប់' },
    A: { label: 'អវត្តមាន', width: 'auto', align: 'center', header: 'អវត្តមាន' },

    workTime: { label: 'ចំនួនម៉ោងសរុប', width: 50, align: 'center', header: 'ចំនួនម៉ោងសរុប' },
    lateEarly: { label: 'មកយឺត/\nចេញមុន', width: 'auto', align: 'center', header: 'មកយឺត/ចេញមុន' },
    plech: { label: 'ភ្លេច\nស្កេន', width: 'auto', align: 'center', header: 'ភ្លេចស្កេន' },
    totalAbsent: { label: 'សរុបអវត្តមាន', width: 50, align: 'center', header: 'សរុបអវត្តមាន' },
    percentage: { label: '%', width: 50, align: 'center', header: '%' },
    absentToDeduct: { label: 'អវត្តមានត្រូវកាត់', width: 50, align: 'center', header: 'អវត្តមានត្រូវកាត់' },
    other: { label: 'ផ្សេងៗ', width: 80, align: 'center', header: 'ផ្សេងៗ' },
    totalLeaveComment: { label: 'វិធានការ', width: 80, align: 'center', header: 'វិធានការ' },
  }), []);

  const defaultCols = useMemo(() => ([
    'index', 'name', 'gender', 'position', 'dayWorkCount', 'leaveCount', 'A', 'lateEarly', 'plech', 'totalLeaveComment',
    'leaveType', 'other'
  ]), []);

  const allColKeys = useMemo(() => ([
    ...defaultCols,
    'staffId', 'department', 'attendanceCount', 'workTime', 'totalAbsent', 'percentage', 'absentToDeduct'
  ]), [defaultCols]);

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceAuditVisibleCols');
      if (v) return JSON.parse(v);
    } catch { void 0; }
    return Object.fromEntries(allColKeys.map((k) => [k, defaultCols.includes(k)]));
  });

  const [colOrder, setColOrder] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceAuditColOrder');
      if (v) {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed) && parsed.length) {
          const base = parsed.filter((k) => allColKeys.includes(k));
          const missing = allColKeys.filter((k) => !base.includes(k));
          return [...base, ...missing];
        }
      }
    } catch { void 0; }
    return allColKeys;
  });

  const [colWidths, setColWidths] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceAuditColWidths_v2');
      if (v) {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch { void 0; }
    const initial = {};
    Object.keys(columnMeta).forEach((k) => {
      const w = columnMeta[k]?.width;
      if (typeof w === 'number') initial[k] = w;
    });
    return initial;
  });

  useEffect(() => {
    try { localStorage.setItem('attendanceAuditColWidths_v2', JSON.stringify(colWidths)); } catch { void 0; }
  }, [colWidths]);

  useEffect(() => {
    try { localStorage.setItem('attendanceAuditVisibleCols', JSON.stringify(visibleCols)); } catch { void 0; }
  }, [visibleCols]);

  useEffect(() => {
    try { localStorage.setItem('attendanceAuditColOrder', JSON.stringify(colOrder)); } catch { void 0; }
  }, [colOrder]);

  const toggleCol = (k) => {
    setVisibleCols((s) => ({ ...s, [k]: !(s?.[k] ?? true) }));
  };

  const resetColumns = () => {
    setColOrder(allColKeys);
    setVisibleCols(Object.fromEntries(allColKeys.map((k) => [k, defaultCols.includes(k)])));
    const initial = {};
    Object.keys(columnMeta).forEach((k) => {
      const w = columnMeta[k]?.width;
      if (typeof w === 'number') initial[k] = w;
    });
    setColWidths(initial);
  };

  const resetWidths = () => {
    const initial = {};
    Object.keys(columnMeta).forEach((k) => {
      const w = columnMeta[k]?.width;
      if (typeof w === 'number') initial[k] = w;
    });
    setColWidths(initial);
  };

  const draggingKeyRef = useRef(null);
  const resizingRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      const r = resizingRef.current;
      if (!r) return;
      const dx = (e?.clientX ?? 0) - r.startX;
      const next = Math.max(30, Math.min(600, r.startW + dx));
      setColWidths((s) => ({ ...s, [r.key]: next }));
    };
    const onUp = () => {
      if (resizingRef.current) resizingRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startResize = (key, e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentW = Number(colWidths?.[key]) || Number(columnMeta[key]?.width) || 80;
    resizingRef.current = { key, startX: e.clientX, startW: currentW };
  };

  useEffect(() => {
    let mounted = true;
    const loadDepts = async () => {
      try {
        const res = await api.get('/departments');
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];

        // Sort by Department ID (Natural Sort)
        list.sort((a, b) => {
          const idA = (a.Department_Id || '').toString();
          const idB = (b.Department_Id || '').toString();
          return idA.localeCompare(idB, undefined, { numeric: true });
        });

        const names = list.map((d) => (d?.Department_Kh || d?.Department_En || d?.name || d?.title || '').toString().trim()).filter(Boolean);

        // Put "ថ្នាក់ដឹកនាំ" first
        names.sort((a, b) => {
          if (a.includes('ថ្នាក់ដឹកនាំ')) return -1;
          if (b.includes('ថ្នាក់ដឹកនាំ')) return 1;
          return 0;
        });

        setDepartments(names);
        if (names.length > 0) {
          setSelectedDept(names[0]);
        }
      } catch (err) {
        if (mounted) setDepartments([]);
      }
    };
    loadDepts();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewAttendance || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true);
      setError('');
      try {
        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);
        if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) throw new Error('Invalid date range');

        // Robust normalization helper:
        // 1. Lowercase and trim
        // 2. Remove all non-alphanumeric characters
        // 3. Strip leading zeros after any prefix letters (e.g., D0009 -> d9, 00123 -> 123)
        const norm = (v) => {
          if (!v) return '';
          return String(v).trim().toUpperCase();
        };

        // 1. Fetch ALL HR records and filter by date range
        const hrRes = await api.get('/hr').catch(() => ({ data: [] }));
        const hrListAll = Array.isArray(hrRes.data) ? hrRes.data : [];

        const hrList = hrListAll.filter(hr => {
          const sid = norm(hr.staffId);
          if (!sid) return false;
          const joined = parseDateSafe(hr.joinDate);
          const removed = parseDateSafe(hr.dateRemoved || hr.resignationDate || hr.resignDate || hr.dateLeft);
          if (joined && joined > toDateObj) return false;
          if (removed && removed < fromDateObj) return false;
          return true;
        });

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

        // 2. Fetch Monthly Data for the overlapping months
        const startY = fromDateObj.getFullYear();
        const startM = fromDateObj.getMonth() + 1;
        const endY = toDateObj.getFullYear();
        const endM = toDateObj.getMonth() + 1;

        const promises = [];
        let curY = startY, curM = startM;
        while (curY < endY || (curY === endY && curM <= endM)) {
          promises.push(api.get('/attendance/monthly-data', { params: { year: curY, month: curM } }).catch(() => ({ data: [] })));
          curM++;
          if (curM > 12) { curM = 1; curY++; }
        }

        const resArray = await Promise.all(promises);
        const monthlyDataAll = resArray.flatMap(r => Array.isArray(r.data) ? r.data : []);

        const isStartOfMonth = fromDateObj.getDate() === 1;
        const isEndOfMonth = toDateObj.getDate() === new Date(toDateObj.getFullYear(), toDateObj.getMonth() + 1, 0).getDate();
        const useMonthlySummary = isStartOfMonth && isEndOfMonth;

        const monthlySummaryMap = new Map();
        if (useMonthlySummary) {
          monthlyDataAll.forEach(m => {
            const sid = norm(m.staffId);
            if (!sid) return;
            const mDate = new Date(m.year, m.month - 1, 1);
            if (mDate >= new Date(fromDateObj.getFullYear(), fromDateObj.getMonth(), 1) &&
              mDate <= new Date(toDateObj.getFullYear(), toDateObj.getMonth(), 1)) {
              if (!monthlySummaryMap.has(sid)) {
                monthlySummaryMap.set(sid, { late: 0, early: 0, plech: 0 });
              }
              const s = monthlySummaryMap.get(sid);
              s.late += (Number(m.checkinLateCount) || 0);
              s.early += (Number(m.checkoutEarlyCount) || 0);
              s.plech += (Number(m.plech || m.Plech) || 0);
            }
          });
        }

        const rangeStartStr = fromDateObj.toISOString().slice(0, 10);
        const rangeEndStr = toDateObj.toISOString().slice(0, 10);

        // Fetch range data to ensure we have ALL daily records even if not in monthly summaries
        const rangeRes = await api.get('/attendance/day-data', { params: { startDate: rangeStartStr, endDate: rangeEndStr } }).catch(() => ({ data: [] }));
        const rangeData = Array.isArray(rangeRes.data) ? rangeRes.data : [];

        // Fetch holidays for the date range
        let hMap = new Map();
        try {
          const holidayRes = await api.get('/holidays').catch(() => ({ data: [] }));
          const holidayList = Array.isArray(holidayRes.data) ? holidayRes.data : [];
          holidayList.forEach(h => {
            if (h.date) {
              const dKey = typeof h.date === 'string' ? h.date.slice(0, 10) : new Date(h.date).toISOString().slice(0, 10);
              hMap.set(dKey, h.name || 'Holiday');
            }
          });
        } catch (e) { console.error('Failed to load holidays', e); }

        // Fetch schedules for accurate Day Off calculation
        const schedRes = await api.get('/work-schedules', {
          params: { startDate: rangeStartStr, endDate: rangeEndStr }
        }).catch(() => ({ data: [] }));

        const sMap = new Map();
        const defaultShiftMap = new Map();
        (schedRes.data || []).forEach(s => {
          if (s.employeeId && s.employeeId.staffId && s.date) {
            const sidNorm = norm(s.employeeId.staffId);
            const dateKey = typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10);
            sMap.set(`${sidNorm}_${dateKey}`, s);

            if (!defaultShiftMap.has(sidNorm)) {
              const isDayOff = (s.shiftTitle || '').toLowerCase() === 'day off' || (s.shiftTitle || '').includes('សម្រាក');
              if (!isDayOff && s.shiftStart && s.shiftEnd) {
                defaultShiftMap.set(sidNorm, {
                  shiftStart: s.shiftStart,
                  shiftEnd: s.shiftEnd,
                  grace: s.scheduledGraceMinutes || 15
                });
              }
            }
          }
        });

        // Fetch leave requests for the date range
        let lMap = new Map();
        try {
          const leaveRes = await api.get('/leave-requests', {
            params: { from: fromDateObj.toISOString(), to: toDateObj.toISOString(), status: 'approved' }
          });
          const leaveList = Array.isArray(leaveRes.data) ? leaveRes.data : [];
          leaveList.forEach(l => {
            const sid = norm(l.staffId);
            if (sid && l.startDate && l.endDate) {
              const sDate = new Date(l.startDate);
              const eDate = new Date(l.endDate);
              let cur = new Date(sDate);
              while (cur <= eDate) {
                const dateKey = toLocalISO(cur);
                lMap.set(`${sid}_${dateKey}`, l.type || 'Leave');
                cur.setDate(cur.getDate() + 1);
              }
            } else if (sid && l.date) {
              const dateKey = typeof l.date === 'string' ? l.date.slice(0, 10) : toLocalISO(new Date(l.date));
              lMap.set(`${sid}_${dateKey}`, l.type || 'Leave');
            }
          });
        } catch (e) {
          console.error('Failed to load leave requests', e);
        }

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

        // Unified Daily Data Map
        const staffDailyMap = new Map();

        // Populate from monthly data source
        monthlyDataAll.forEach(row => {
          const sid = norm(row.staffId);
          if (!sid) return;
          if (!staffDailyMap.has(sid)) staffDailyMap.set(sid, new Map());
          const dMap = staffDailyMap.get(sid);
          (row.dailyData || []).forEach(d => {
            const dStr = d.date ? (typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10)) : '';
            if (dStr && dStr >= rangeStartStr && dStr <= rangeEndStr) {
              dMap.set(dStr, { ...d, date: dStr });
            }
          });
        });

        // Overlay from range data source (more accurate/recent)
        rangeData.forEach(row => {
          const sid = norm(row.staffId);
          if (!sid) return;
          if (!staffDailyMap.has(sid)) staffDailyMap.set(sid, new Map());
          const dMap = staffDailyMap.get(sid);
          (row.dailyData || []).forEach(d => {
            const dStr = d.date ? (typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10)) : '';
            if (dStr && dStr >= rangeStartStr && dStr <= rangeEndStr) {
              const existing = dMap.get(dStr) || {};
              dMap.set(dStr, { ...existing, ...d, date: dStr });
            }
          });
        });

        // Generate date list in range
        const datesInRange = [];
        {
          let cur = new Date(fromDateObj.getFullYear(), fromDateObj.getMonth(), fromDateObj.getDate());
          const end = new Date(toDateObj.getFullYear(), toDateObj.getMonth(), toDateObj.getDate());
          while (cur <= end) {
            const iso = toLocalISO(cur);
            const day = cur.getDay();
            datesInRange.push({ iso, isWeekend: (day === 0 || day === 6) });
            cur.setDate(cur.getDate() + 1);
          }
        }

        // Combine HR and Aggregated Data (Deduplicated by Staff ID)
        const seenSid = new Set();
        const combined = hrList.reduce((acc, h) => {
          const sidOriginal = (h.staffId || h.no || '').toString().trim();
          const sid = norm(sidOriginal);
          if (!sid || seenSid.has(sid)) return acc;
          seenSid.add(sid);

          const dMap = staffDailyMap.get(sid) || new Map();

          const res = {
            dayWorkCount: 0,
            attendanceCount: 0,
            leaveCount: 0,
            A: 0,
            checkinLateCount: 0,
            checkoutEarlyCount: 0,
            plech: 0,
            workTime: 0,
            leaveType: '',
            other: '',
            totalLeaveComment: ''
          };

          const leaveTypeCounts = {};
          const leaveReasons = new Set();

          datesInRange.forEach(({ iso: dayStr, isWeekend }) => {
            const entry = dMap.get(dayStr) || { date: dayStr };
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

            const schKey = `${sid}_${dayStr}`;
            const sch = sMap.get(schKey);
            const leaveType = lMap.get(schKey);
            let status = (entry.status || '').toLowerCase();

            const dailyLeaves = new Set();
            const addLeaveType = (lt) => {
              if (!lt || lt === '—') return;
              String(lt).split(',').forEach(p => {
                const abbr = abbreviateLeaveType(p);
                if (abbr) dailyLeaves.add(abbr);
              });
            };

            if (leaveType) {
              status = 'leave';
              addLeaveType(leaveType);
            }

            const { isOff, effectiveStatus, hasScheduleTime, isDayOffBySchedule, isOffByStatus } = checkIsOff(status, hasAny, sch, dayStr, isWeekend, hMap.has(dayStr));

            // Day Work Count should only count days where work was EXPECTED (not a weekend, not a day off, not a holiday)
            const isExpected = !(isDayOffBySchedule || isOffByStatus);
            if (isExpected) res.dayWorkCount++;

            if (effectiveStatus === 'absent') {
              res.A++;
            } else if (effectiveStatus === 'leave') {
              res.leaveCount++;
            } else if (hasAny) {
              res.attendanceCount++;
            }

            if (ci && !co) res.plech++;

            const inMin = parseHMToMinutes(ci);
            const outMin = parseHMToMinutes(co);
            if (inMin !== null && outMin !== null) {
              let diff = outMin - inMin;
              if (diff < 0) diff += 24 * 60;
              if (diff > 0) res.workTime += diff;
            }

            // Late/Early Checks dynamically calculated
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
                  res.checkinLateCount++;
                }
              }
              if (outMin !== null && shiftEndMin !== null) {
                const earlyDiff = shiftEndMin - outMin;
                if (earlyDiff > 0) {
                  res.checkoutEarlyCount++;
                }
              }
            }

            if (entry.leaveType) addLeaveType(entry.leaveType);
            if (entry.leaveReason && entry.leaveReason !== '—') leaveReasons.add(entry.leaveReason);

            dailyLeaves.forEach(abbr => {
              leaveTypeCounts[abbr] = (leaveTypeCounts[abbr] || 0) + 1;
            });
          });

          // Determine historical role based on end date of the report
          let activePosition = h.position || '';
          let activeDepartment = h.Department_Kh || h.department || '';
          
          if (h.roleHistory && h.roleHistory.length > 0) {
            // Find a historical role that was active during the end of the report period
            const reportEnd = new Date(rangeEndStr);
            const historicalRole = h.roleHistory.find(role => {
              const start = role.startDate ? new Date(role.startDate) : new Date(0);
              const end = role.endDate ? new Date(role.endDate) : new Date();
              return reportEnd >= start && reportEnd <= end;
            });
            if (historicalRole) {
              activePosition = historicalRole.position || activePosition;
              activeDepartment = historicalRole.department || activeDepartment;
            }
          }

          acc.push({
            staffId: sidOriginal,
            hrSortKey: h.no ? Number(h.no) : 999999,
            isCivilServant: Boolean(!h?.isRetiredThenContract && ((h?.civilServantId || '').toString().trim() || (h?.officerId || '').toString().trim())),
            khmerName: h.khmerName || h.name || '',
            name: h.name || '',
            gender: h.gender || '',
            position: activePosition,
            department: activeDepartment,
            dayWorkCount: res.dayWorkCount,
            attendanceCount: res.attendanceCount,
            leaveCount: res.leaveCount,
            A: res.A,
            leaveType: Object.entries(leaveTypeCounts).map(([type, count]) => `${type}(${count})`).join(', '),
            other: '',
            totalLeaveComment: '',
            plech: res.plech,
            checkinLateCount: res.checkinLateCount,
            checkoutEarlyCount: res.checkoutEarlyCount,
            workTime: res.workTime > 0 ? formatMinutesAsHM(res.workTime) : ''
          });
          return acc;
        }, []);

        if (mounted) setAttendanceData(combined);
      } catch (e) {
        if (mounted) {
          setError(e?.response?.data?.message || e?.message || 'Load failed');
          setAttendanceData([]);
        }
      } finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [fromDate, toDate, perms.canViewAttendance, perms.canViewEmployees]);

  const derived = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();
    const selectedDeptNorm = (selectedDept || '').toString().trim();
    const rows = (attendanceData || [])
      .filter(record => {
        if (selectedDeptNorm) {
          const dept = (record.department || record.Department_Kh || '').toString().trim();
          if (dept !== selectedDeptNorm) return false;
        }
        if (!term) return true;
        const name = (record.khmerName || record.name || '').toString().toLowerCase();
        const sid = (record.staffId || record.no || '').toString().toLowerCase();
        const pos = (record.position || '').toString().toLowerCase();
        const dep = (record.department || '').toString().toLowerCase();
        return name.includes(term) || sid.includes(term) || pos.includes(term) || dep.includes(term);
      })
      .sort((a, b) => {
        const ka = Number(a?.hrSortKey), kb = Number(b?.hrSortKey);
        if (ka !== kb) return ka - kb;
        return (a?.staffId || '').toString().localeCompare((b?.staffId || '').toString());
      })
      .map((r, idx) => {
        const plech = Number(r.plech ?? r.Plech) || 0;
        const totalAbsent = (Number(r.leaveCount) || 0) + (Number(r.A) || 0);
        const percentage = r.dayWorkCount > 0 ? Math.round((r.attendanceCount / r.dayWorkCount) * 100) : 0;
        return {
          ...r,
          index: idx + 1,
          name: r.khmerName || r.name || '',
          genderShort: fmtGenderShort(r.gender),
          lateEarly: (Number(r.checkinLateCount) || 0) + (Number(r.checkoutEarlyCount) || 0),
          plech,
          totalAbsent,
          percentage,
          absentToDeduct: Number(r.A) || 0
        };
      });
    return { rows, male: rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length, female: rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length, total: rows.length };
  }, [attendanceData, q, selectedDept]);

  const derivedAllDepts = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();
    const rows = (attendanceData || [])
      .filter(record => {
        if (!term) return true;
        const name = (record.khmerName || record.name || '').toString().toLowerCase();
        const sid = (record.staffId || record.no || '').toString().toLowerCase();
        return name.includes(term) || sid.includes(term);
      })
      .sort((a, b) => (Number(a?.hrSortKey) || 0) - (Number(b?.hrSortKey) || 0))
      .map((r, idx) => ({
        ...r,
        index: idx + 1,
        name: r.khmerName || r.name || '',
        genderShort: fmtGenderShort(r.gender),
        lateEarly: (Number(r.checkinLateCount) || 0) + (Number(r.checkoutEarlyCount) || 0),
        plech: Number(r.plech ?? r.Plech) || 0,
        totalAbsent: (Number(r.leaveCount) || 0) + (Number(r.A) || 0),
        percentage: r.dayWorkCount > 0 ? Math.round((r.attendanceCount / r.dayWorkCount) * 100) : 0,
        absentToDeduct: Number(r.A) || 0
      }));
    return { rows, male: rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length, female: rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length, total: rows.length };
  }, [attendanceData, q]);

  const handleDragStart = (e, key) => { draggingKeyRef.current = key; e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, key) => {
    e.preventDefault();
    const from = draggingKeyRef.current;
    if (!from || from === key) return;
    const idx1 = colOrder.indexOf(from), idx2 = colOrder.indexOf(key);
    if (idx1 < 0 || idx2 < 0) return;
    const n = [...colOrder];
    [n[idx1], n[idx2]] = [n[idx2], n[idx1]];
    setColOrder(n);
  };

  const handleExportExcel = () => {
    const dt = new Date(fromDate);
    const yr = !isNaN(dt.getTime()) ? String(dt.getFullYear()) : '';
    const mo = !isNaN(dt.getTime()) ? String(dt.getMonth() + 1).padStart(2, '0') : '';
    const visibleKeysNow = (colOrder || []).filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));
    const header = visibleKeysNow.map((k) => (columnMeta[k]?.label || k).replace(/\n/g, ' '));
    const data = derived.rows.map((row) => visibleKeysNow.map((k) => {
      if (k === 'gender') return row.genderShort || row.gender;
      return row[k];
    }));
    const ws = XLSX.utils.aoa_to_sheet([header, ...data, [], ['សរុប', `${derived.total} នាក់`, `(ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់)`]]);
    ws['!cols'] = visibleKeysNow.map((k) => ({ wch: Math.max(6, Math.round((Number(colWidths?.[k]) || columnMeta[k]?.width || 80) / 3)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការស៊ីវិល និង បុគ្គលិកកិច្ចសន្យា_${mo}_${yr}`);
    XLSX.writeFile(wb, yr && mo ? `AttendanceAudit_${yr}_${mo}.xlsx` : `AttendanceAudit_${fromDate}_${toDate}.xlsx`);
  };

  const renderCellData = (key, row) => {
    const maybeHideZero = (v) => {
      const n = Number(v);
      return (Number.isFinite(n) && n === 0) ? '' : (v ?? '');
    };
    switch (key) {
      case 'index': return { value: row.index, style: { textAlign: 'center', whiteSpace: 'nowrap', textDecoration: row.isCivilServant ? 'underline' : 'none', textDecorationThickness: '2px', textUnderlineOffset: 3 } };
      case 'staffId': return { value: row.staffId, style: { textAlign: 'center' } };
      case 'name': return { value: row.name, style: { textAlign: 'left', whiteSpace: 'nowrap' } };
      case 'gender': return { value: row.genderShort, style: { textAlign: 'center' } };
      case 'position': return { value: row.position, style: { textAlign: 'left', whiteSpace: 'nowrap', fontSize: Math.max(9, Math.max(10, Math.round(rowHeight * 0.46)) - 1) } };
      case 'department': return { value: row.department, style: { textAlign: 'center', fontSize: Math.max(9, Math.max(10, Math.round(rowHeight * 0.46)) - 1) } };
      case 'dayWorkCount': return { value: maybeHideZero(row.dayWorkCount), style: { textAlign: 'center', whiteSpace: 'nowrap' } };
      case 'attendanceCount': return { value: maybeHideZero(row.attendanceCount), style: { textAlign: 'center' } };
      case 'leaveCount': return { value: maybeHideZero(row.leaveCount), style: { textAlign: 'center', whiteSpace: 'nowrap' } };
      case 'leaveType': {
        const val = row.leaveType || '';
        let fs = Math.max(8, Math.max(10, Math.round(rowHeight * 0.46)) - 2);
        if (val.length > 20) fs = Math.max(6, fs - 2.5);
        return { value: val, style: { textAlign: 'center', whiteSpace: 'nowrap', fontSize: fs } };
      }
      case 'A': return { value: maybeHideZero(row.A), style: { textAlign: 'center', whiteSpace: 'nowrap' } };
      case 'workTime': return { value: row.workTime, style: { textAlign: 'center' } };
      case 'lateEarly': return { value: maybeHideZero(row.lateEarly), style: { textAlign: 'center', whiteSpace: 'nowrap' } };
      case 'plech': return { value: maybeHideZero(row.plech), style: { textAlign: 'center', whiteSpace: 'nowrap' } };
      case 'totalAbsent': return { value: maybeHideZero(row.totalAbsent), style: { textAlign: 'center' } };
      case 'percentage': return { value: row.percentage > 0 ? `${row.percentage}%` : '', style: { textAlign: 'center' } };
      case 'absentToDeduct': return { value: maybeHideZero(row.absentToDeduct), style: { textAlign: 'center' } };
      case 'other': return { value: row.other || '', style: { textAlign: 'center', fontSize: Math.max(8, Math.max(10, Math.round(rowHeight * 0.46)) - 2) } };
      case 'totalLeaveComment': return { value: row.totalLeaveComment, style: { textAlign: 'center', fontSize: Math.max(8, Math.max(10, Math.round(rowHeight * 0.46)) - 2) } };
      default: return { value: row[key], style: {} };
    }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Print Preview</title><style>${printCss}@page { size: ${printOrientation}; }body{font-family:"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif;margin:0;}</style></head><body>${printRef.current.outerHTML}</body></html>`);
    w.document.close();
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const handlePrintByDepartment = () => {
    const rowsSource = selectedDept ? derived.rows : derivedAllDepts.rows;
    const groups = new Map();
    rowsSource.forEach(r => {
      const dep = (r.department || r.Department_Kh || '').toString().trim() || 'មិនមានផ្នែក';
      if (!groups.has(dep)) groups.set(dep, []);
      groups.get(dep).push(r);
    });
    const groupList = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'km'));
    if (!groupList.length) { window.alert('មិនមានទិន្នន័យ'); return; }

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>AttendanceAudit_ByDepartment</title><style>${printCss}body{font-family:"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif;margin:0;}.dept-page{page-break-after:always;}.dept-page:last-child{page-break-after:auto;}table{width:100%;border-collapse:collapse;table-layout:fixed;}thead{display:table-header-group;}tr,td,th{page-break-inside:avoid;}th,td{border:1px solid #8f8b8b;padding:4px 6px;}th{background:#f3f4f6;}</style></head><body><div id="root" style="padding:12mm;"></div></body></html>`);
    const root = w.document.getElementById('root');
    const cols = (colOrder || []).filter(k => columnMeta[k] && (visibleCols?.[k] ?? true));

    groupList.forEach(([name, rows]) => {
      const page = w.document.createElement('div');
      page.className = 'dept-page';
      Object.assign(page.style, { padding: '24px', maxWidth: printOrientation === 'landscape' ? '297mm' : '210mm', margin: '0 auto' });

      const header = `<div style="margin-bottom:16px;border-bottom:2px solid #ddd;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="text-align:center;">
            <div style="font-family:'Khmer OS Muol Light';font-size:14px;">ក្រសួងសុខាភិបាល</div>
            <div style="font-family:'Khmer OS Muol Light';font-size:14px;">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:'Khmer OS Muol Light';font-size:16px;">ព្រះរាជាណាចក្រកម្ពុជា</div>
            <div style="font-family:'Khmer OS Muol Light';font-size:16px;">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
            <div style="margin-top:4px;"><img src="${headerBg}" alt="header" style="width:120px;height:auto;" /></div>
          </div>
        </div>
        <div style="text-align:center;margin-top:20px;">
          <div style="font-family:'Khmer OS Muol Light';font-size:16px;">វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការស៊ីវិល និង បុគ្គលិកកិច្ចសន្យា</div>
          <div style="font-weight:700;margin-top:5px;">ផ្នែក: ${name}</div>
          <div style="font-size:13px;margin-top:2px;">${fmtKhmerLongDate(fromDate)} ដល់ ${fmtKhmerLongDate(toDate)}</div>
        </div>
      </div>`;
      const male = rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length;
      const stats = `<div style="font-size:11px;margin-bottom:8px;">សរុប: ${toKhmerDigits(rows.length)} នាក់ (ប្រុស: ${toKhmerDigits(male)} - ស្រី: ${toKhmerDigits(rows.length - male)})</div>`;

      let table = '<table><thead><tr>';
      cols.forEach(k => {
        const w = colWidths?.[k] || columnMeta[k]?.width || 80;
        const ws = w === 'auto' ? 'nowrap' : 'normal';
        table += `<th style="width:${w}${w === 'auto' ? '' : 'px'};font-size:11px;white-space:${ws};">${(columnMeta[k].label || '').replace(/\n/g, '<br/>')}</th>`;
      });
      table += '</tr></thead><tbody>';
      rows.forEach((r, idx) => {
        table += `<tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#fff'}">`;
        cols.forEach(k => {
          const c = renderCellData(k, r);
          let styleStr = `font-size:11px;text-align:${c.style?.textAlign || columnMeta[k].align || 'center'};`;
          if (c.style?.whiteSpace) styleStr += `white-space:${c.style.whiteSpace};`;
          if (c.style?.textDecoration) styleStr += `text-decoration:${c.style.textDecoration};text-decoration-thickness:${c.style.textDecorationThickness};text-underline-offset:${c.style.textUnderlineOffset}px;`;
          table += `<td style="${styleStr}">${c.value}</td>`;
        });
        table += '</tr>';
      });
      table += '</tbody></table>';

      page.innerHTML = header + stats + table;
      root.appendChild(page);
    });
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  if (loading && !attendanceData.length) return <div style={{ padding: 20 }}>កំពុងផ្ទុក...</div>;

  const visibleKeys = (colOrder || []).filter(k => columnMeta[k] && (visibleCols?.[k] ?? true));
  const rowFontSize = Math.max(10, Math.round(rowHeight * 0.46));

  const renderPrintContent = () => {
    const allRows = derived.rows;
    const sheetW = printOrientation === 'landscape' ? '297mm' : '210mm';

    const page1Rows = Math.floor(780 / rowHeight) || 1;
    const page2PlusRows = Math.floor(1092 / rowHeight) || 1;
    const page1Limit = page1Rows - 1;

    const renderHeader = () => (
      <div style={{ textAlign: 'center', marginBottom: 0, paddingBottom: 5 }}>
        <div style={{ margin: 0, fontSize: 15, fontFamily: 'Khmer OS Muol Light' }}>ព្រះរាជាណាចក្រកម្ពុជា</div>
        <div style={{ margin: 0, fontSize: 14, fontFamily: 'Khmer OS Muol Light' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
        <img src={headerBg} alt="header" style={{ display: 'block', margin: '0px auto', width: '170px', height: 'auto' }} />
        <div style={{ margin: 0, fontSize: 14, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>ក្រសួងសុខាភិបាល</div>
        <div style={{ margin: 0, fontSize: 14, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
        <div style={{ margin: 1, fontSize: 13, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}> {selectedDept || ''}</div>
        <div style={{ margin: '5px 0', fontSize: 13, fontFamily: 'Khmer OS Muol Light' }}>វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការស៊ីវិល និង បុគ្គលិកកិច្ចសន្យា</div>
        <p style={{ fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", sans-serif', fontSize: 14, margin: '0px 0' }}>ចាប់ពី {fmtKhmerLongDate(fromDate)} ដល់ {fmtKhmerLongDate(toDate)}</p>
      </div>
    );

    const renderThead = () => (
      <thead style={{ display: 'table-header-group' }}>
        <tr style={{ background: '#eee' }}>
          {visibleKeys.map(k => (
            <th key={k} draggable onDragStart={e => handleDragStart(e, k)} onDragOver={handleDragOver} onDrop={e => handleDrop(e, k)} style={{ border: '1px solid #888', padding: 4, fontSize: 11, width: colWidths?.[k] || columnMeta[k].width || 80, cursor: 'move', position: 'relative', textAlign: 'center', whiteSpace: (colWidths?.[k] || columnMeta[k].width) === 'auto' ? 'nowrap' : 'normal' }}>
              {(columnMeta[k].label || '').split('\\n').map((str, si, arr) => (
                <React.Fragment key={si}>{str}{si < arr.length - 1 && <br />}</React.Fragment>
              ))}
              <div onMouseDown={e => startResize(k, e)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize' }} />
            </th>
          ))}
        </tr>
      </thead>
    );

    const renderSignatures = () => {
      const dept = selectedDept || '';
      let sigs = [];

      if (dept.includes('ថ្នាក់ដឹកនាំ')) {
        sigs = [
          { text: 'បានឃើញ', title: 'នាយមន្ទីរពេទ្យ' }
        ];
      } else if (dept.includes('ការិយាល័យរដ្ឋបាល និងបុគ្គលិក')) {
        sigs = [
          { text: 'បានឃើញ', title: 'នាយករងមន្ទីរពេទ្យ' },
          { text: '', title: 'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក' }
        ];
      } else {
        // Default to 3 signatures for other departments
        let rightTitle = 'នាយផ្នែក';
        if (dept.includes('ហិរញ្ញវត្ថុ')) {
          rightTitle = 'ប្រធានការិយាល័យហិរញ្ញវត្ថុ';
        } else if (dept.includes('បច្ចេកទេស')) {
          rightTitle = 'ប្រធានការិយាល័យបច្ចេកទេស';
        } else if (dept.startsWith('មណ្ឌល') || dept.startsWith('មជ្ឈមណ្ឌល')) {
          rightTitle = 'នាយមណ្ឌល';
        } else if (dept.startsWith('ផ្នែក')) {
          rightTitle = 'នាយផ្នែក';
        }

        sigs = [
          { text: 'បានឃើញ', title: 'នាយករងមន្ទីរពេទ្យ' },
          { text: 'បានឃើញ និងពិនិត្យត្រឹមត្រូវ', title: 'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក' },
          { text: '', title: rightTitle }
        ];
      }

      return (
        <div style={{ display: 'flex', justifyContent: sigs.length === 1 ? 'flex-end' : 'space-between', marginTop: 0, padding: sigs.length === 1 ? '0 120px 0 20px' : (dept.includes('ការិយាល័យរដ្ឋបាល និងបុគ្គលិក') ? '0 100px 0 100px' : '0 20px') }}>
          {sigs.map((sig, idx) => (
            <div key={idx} style={{ textAlign: 'center', paddingRight: (idx === 2 && sigs.length === 3) ? 65 : 0, paddingLeft: (idx === 0 && sigs.length === 3) ? 35 : 0 }}>
              {sig.text ? <div style={{ fontSize: 11 }}>{sig.text}</div> : <div style={{ height: 16 }} />}
              <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: 11, marginTop: 5 }}>{sig.title}</div>
              <div style={{ marginTop: 20, fontSize: 10 }}></div>
            </div>
          ))}
        </div>
      );
    };

    const renderFooter = () => (
      <>
        <div style={{ marginTop: 10, display: 'flex', fontSize: 9.5 }}>
          <div style={{ textAlign: 'left', flex: 8, paddingRight: 0 }}>
            <div style={{ lineHeight: '1.6' }}>
              <b>សម្គាល់៖ ទណ្ឌកម្មវិន័យអនុវត្តចំពោះអវត្តមានគ្មានច្បាប់អនុញ្ញាត</b><br />
              {allRows.length === page1Limit && (
                <div className="screen-only-label" style={{ borderTop: '2px dashed #1e40af', color: '#1e40af', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', paddingTop: 5, marginBottom: 5 }}>
                  ——— បញ្ចប់ទំព័រទី ១ (ការប៉ាន់ស្មានលើអេក្រង់) ———
                </div>
              )}
              <b>១. មន្ត្រីរាជការស៊ីវិល</b><br />
              - ការស្តីបន្ទោស<br />
              - ការស្តីបន្ទោសដោយមានចំណារក្នុងសំណុំលិខិតផ្ទាល់ខ្លួន<br />
              - ការផ្លាស់ដោយបង្ខំតាមវិធានការខាងវិន័យឬការលុបឈ្មោះចេញពីតារាងតម្លើងឋានន្តរស័ក្តិឬថ្នាក់<br />
              - ការលុបឈ្មោះចេញពីក្របខណ្ឌ<br />
              <b>២. មន្ត្រីជាប់កិច្ចសន្យា</b><br />
              - ណែនាំលើកទី១<br />
              - ណែនាំចុងក្រោយ<br />
              - លុបឈ្មោះចេញពីអង្គភាពសាមី
            </div>
          </div>
          <div style={{ textAlign: 'left', flex: 8.5, paddingLeft: 0, paddingRight: 0 }}>
            <div style={{ lineHeight: '1.6' }}>
              <b>ប្រភេទច្បាប់ឈប់សម្រាករបស់មន្ត្រីរាជការស៊ីវិលរួមមាន៖</b><br />
              ១. ច្បាប់ឈប់ប្រចាំឆ្នាំ 	   មានរយៈពេល១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ<br />
              ២. ច្បាប់ឈប់រយៈពេលខ្លី 	   មានរយៈពេល១៥ថ្ងៃនៃថ្ងៃធ្វើការ/១ឆ្នាំ<br />
              ៣. ច្បាប់ឈប់សម្រាកលំហែមាតុភាព	   មានរយៈពេល៣ខែ<br />
              ៤. ច្បាប់ឈប់សម្រាកព្យាបាលជម្ងឺ 	   មានរយៈពេល១២ខែក្នុងអំឡុងពេលបម្រើការជាមន្ត្រី<br />
              ៥. ច្បាប់ឈប់សម្រាកដោយមានកិច្ចការផ្ទាល់ខ្លួន មានរយៈពេល៣ខែក្នុងអំឡុងពេលបម្រើការងារជាមន្ត្រី
            </div>
          </div>
        </div>
        {renderSignatures()}
      </>
    );

    return (
      <div ref={printRef} id="attendance-print-content">
        <div className="a4-sheet" style={{ width: sheetW, margin: '10px auto', background: '#fff', border: '1px solid #ddd', padding: '7mm', boxSizing: 'border-box', boxShadow: '0 0 10px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
          {renderHeader()}

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #888', tableLayout: 'auto' }}>
            {renderThead()}
            <tbody>
              {allRows.map((r, i) => (
                <React.Fragment key={i}>
                  <tr style={{ height: rowHeight, background: i % 2 === 0 ? '#f9f9f9' : '#fff', pageBreakInside: 'avoid' }}>
                    {visibleKeys.map(k => {
                      const c = renderCellData(k, r);
                      return <td key={k} style={{ border: '1px solid #888', padding: '2px 5px', fontSize: rowFontSize, ...c.style, textAlign: c.style?.textAlign || columnMeta[k].align || 'center' }}>{c.value}</td>;
                    })}
                  </tr>
                  {(() => {
                    let showDivider = false;
                    let pageNum = 1;
                    
                    if (i === page1Limit) {
                      showDivider = true;
                      pageNum = 1;
                    } else if (i > page1Limit && (i - page1Limit) % page2PlusRows === 0) {
                      showDivider = true;
                      pageNum = Math.floor((i - page1Limit) / page2PlusRows) + 1;
                    }
                    
                    if (showDivider) {
                      const isLast = i === allRows.length - 1;
                      const label = isLast 
                        ? `——— បញ្ចប់ទំព័រទី ${pageNum} ជាក់ស្ដែង (ការប៉ាន់ស្មានលើអេក្រង់) ———`
                        : `——— បញ្ចប់ទំព័រទី ${pageNum} (ការប៉ាន់ស្មានលើអេក្រង់) ———`;
                        
                      return (
                        <tr className="screen-only-label">
                          <td colSpan={visibleKeys.length} style={{ border: 'none', padding: '10px 0' }}>
                            <div style={{ borderTop: '2px dashed #1e40af', color: '#1e40af', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', paddingTop: 5 }}>{label}</div>
                          </td>
                        </tr>
                      );
                    }
                    return null;
                  })()}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {renderFooter()}
          {(() => {
            // Assume footer takes space equivalent to 10 rows
            const page1Height = 780; // Calibrated to match 26 rows at current height
            const page2PlusHeight = 1092; // Actual A4 height (1122px) - Table Header (30px)
            const footerHeight = 150; // Estimated fixed height for footer
            
            const tableHeight = allRows.length * rowHeight;
            const totalContentHeight = tableHeight + footerHeight;
            
            let totalPages = 1;
            let missingHeight = 0;
            
            if (totalContentHeight <= page1Height) {
              totalPages = 1;
              missingHeight = page1Height - totalContentHeight;
            } else {
              const remainingHeight = totalContentHeight - page1Height;
              totalPages = Math.ceil(remainingHeight / page2PlusHeight) + 1;
              const heightOnLastPage = remainingHeight % page2PlusHeight;
              missingHeight = heightOnLastPage === 0 ? 0 : page2PlusHeight - heightOnLastPage;
            }
            
            const spacerHeight = missingHeight;
            
            return (
              <>
                <div className="screen-only-label" style={{ height: spacerHeight }} />
                <div className="screen-only-label" style={{ borderTop: '2px dashed #1e40af', color: '#1e40af', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', paddingTop: 5, marginTop: 10 }}>
                  ——— បញ្ចប់ទំព័រទី {totalPages} ជាក់ស្ដែង (ការប៉ាន់ស្មានលើអេក្រង់) ———
                </div>
              </>
            );
          })()}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 20, fontFamily: '"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif' }}>
      <style>{buildPrintStyle(printOrientation)}</style>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>ជ្រើសរើសខែ: <input type="month" value={monthYear} onChange={e => {
          const val = e.target.value;
          if (!val) return;
          setMonthYear(val);
          const d = new Date(val + '-01');
          setFromDate(toLocalISO(d));
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          setToDate(toLocalISO(endOfMonth));
        }} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }} /></div>
        <div style={{ width: 1, height: 24, background: '#ccc', margin: '0 8px' }}></div>
        <div>ចាប់ពី: <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }} /></div>
        <div>ដល់: <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }} /></div>
        {(() => { const f = new Date(fromDate); const t = new Date(toDate); const diffMonths = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()); if (diffMonths >= 1 || (f.getFullYear() !== t.getFullYear() || f.getMonth() !== t.getMonth())) { return (<div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '4px 10px', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 14 }}>⚠️</span><span>សរុបច្រើនខែ ({diffMonths + 1} ខែ)</span></div>); } return null; })()}
        <div>ផ្នែក: <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={{ padding: 6, borderRadius: 4, border: '1px solid #ccc' }}><option value="">-- ទាំងអស់ --</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Height: <input type="range" min={10} max={60} value={rowHeight} onChange={e => setRowHeight(Number(e.target.value))} /> <b>{rowFontSize}px</b></div>
        <div ref={colsMenuRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowColsMenu(!showColsMenu)} style={{ padding: '6px 12px', background: '#eee', borderRadius: 4 }}>Columns</button>
          {showColsMenu && (<div style={{ position: 'absolute', top: 35, right: 0, background: '#fff', border: '1px solid #ddd', padding: 8, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{allColKeys.map(k => <label key={k} style={{ display: 'block', fontSize: 11 }}><input type="checkbox" checked={!!visibleCols?.[k]} onChange={() => toggleCol(k)} /> {(columnMeta[k]?.label || '').replace(/\\n/g, ' ')}</label>)}<button onClick={resetColumns} style={{ display: 'block', width: '100%', marginTop: 5, fontSize: 10 }}>Reset</button></div>)}
        </div>
        <select value={printOrientation} onChange={e => setPrintOrientation(e.target.value)} style={{ padding: 6 }}>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
        <input type="text" placeholder="ស្វែងរក..." value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, padding: 6 }} />
        <button onClick={handleExportExcel} style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700 }}>Excel</button>
        <button onClick={handlePrint} style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700 }}>Print</button>
        <button onClick={handlePrintByDepartment} style={{ padding: '6px 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700 }}>PDF តាមផ្នែក</button>
        <button onClick={() => navigate(-1)} style={{ padding: '6px 12px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700 }}>បិទ</button>
      </div>

      {renderPrintContent()}
    </div>
  );
}
