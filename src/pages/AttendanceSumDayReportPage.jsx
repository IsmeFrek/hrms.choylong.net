import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

function buildPrintStyleSumDay(orientation) {
  const o = (orientation === 'landscape') ? 'landscape' : 'portrait';
  return `
@media print {
  @page {
    size: A4 ${o};
    margin-top: 5mm;
    margin-bottom: 5mm;
    margin-left: 0;
    margin-right: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    width: 100% !important;
  }
  #attendance-sumday-print-content {
    box-sizing: border-box;
    width: 100% !important;
    margin: 0 !important;
    padding: 10mm !important;
    background: white !important;
  }
  body * {
    visibility: hidden;
  }
  #attendance-sumday-print-content, #attendance-sumday-print-content * {
    visibility: visible;
  }
  #attendance-sumday-print-content {
    position: static;
  }
  #attendance-sumday-print-content table {
    width: 100% !important;
    table-layout: auto !important;
  }
  #attendance-sumday-print-content {
    border: none !important;
    box-shadow: none !important;
    min-height: unset !important;
  }
}
`;
}

function parseWorkTimeToMinutesSumDay(v) {
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

function formatMinutesAsHMSumDay(minutes) {
  const m = Number(minutes) || 0;
  const absMinutes = Math.max(0, Math.round(Math.abs(m)));
  const h = Math.floor(absMinutes / 60);
  const mm = absMinutes % 60;
  return `${h}h ${mm}m`;
}

function parseHMToMinutesSimpleSumDay(s) {
  if (!s) return null;
  const str = String(s).trim();
  const ampm = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const mer = ampm[3].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

function ShortenLeaveTypeSumDay(t) {
  if (!t) return '';
  const s = String(t).trim();
  if (s.includes('ប្រចាំ​ឆ្នាំ') || s.includes('ប្រចាំឆ្នាំ')) return 'ច្បាប់_ប្រចាំ​ឆ្នាំ';
  if (s.includes('រយៈពេល​ខ្លី') || s.includes('រយៈពេលខ្លី')) return 'ច្បាប់_រយៈពេល​ខ្លី';
  if (s.includes('មាតុភាព')) return 'មាតុភាព';
  if (s.includes('ព្យាបាល​ជំងឺ') || s.includes('ព្យាបាលជំងឺ')) return 'ច្បាប់_ព្យាបាល​ជំងឺ';
  if (s.includes('កិច្ចការ​ផ្ទាល់​ខ្លួន') || s.includes('កិច្ចការផ្ទាល់ខ្លួន')) return 'ច្បាប់_មាន​កិច្ចការ​ផ្ទាល់​ខ្លួន';
  if (s.includes('បេសកកម្ម')) return 'បេសកកម្ម';
  return s;
}

function toKhmerDigitsSumDay(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function fmtKhmerLongDateSumDay(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const dd = toKhmerDigitsSumDay(String(dt.getDate()).padStart(1, '0'));
  const mmName = khMonths[dt.getMonth()];
  const yyyy = toKhmerDigitsSumDay(dt.getFullYear());
  return `ថ្ងៃទី ${dd} ខែ ${mmName} ឆ្នាំ ${yyyy}`;
}

function toLocalYmdStringSumDay(input) {
  const dt = new Date(input);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtGenderShortSumDay(g) {
  const v = (g || '').toString().trim().toLowerCase();
  if (!v) return '';
  if (v === 'male' || v === 'm' || v === 'ប្រុស') return 'ប';
  if (v === 'female' || v === 'f' || v === 'ស្រី') return 'ស';
  return g;
}

export default function AttendanceSumDayReportPage() {
  useEffect(() => {
    let style = document.getElementById('attendance-sumday-print-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'attendance-sumday-print-style';
      document.head.appendChild(style);
    }

    return () => {
      if (style && style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);

  const [printOrientation, setPrintOrientation] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceSumDayReportPrintOrientation');
      if (v === 'landscape' || v === 'portrait') return v;
    } catch { void 0; }
    return 'landscape';
  });

  useEffect(() => {
    try { localStorage.setItem('attendanceSumDayReportPrintOrientation', printOrientation); } catch { void 0; }
    const style = document.getElementById('attendance-sumday-print-style');
    if (style) style.innerHTML = buildPrintStyleSumDay(printOrientation);
  }, [printOrientation]);

  const printCss = useMemo(() => buildPrintStyleSumDay(printOrientation), [printOrientation]);
  const perms = usePermission();
  const navigate = useNavigate();
  const [attendanceData, setAttendanceData] = useState([]);
  const [q, setQ] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [selectedLeaveFilter, setSelectedLeaveFilter] = useState('');
  const [leaveFilterOptions, setLeaveFilterOptions] = useState([]);
  const today = new Date();
  // Default period = full current month (same logic as AttendancesumDayPage)
  const periodYear = today.getFullYear();
  const periodMonthIndex = today.getMonth(); // 0-based (current month is the END month)
  const defaultMonthValue = `${periodYear}-${String(periodMonthIndex + 1).padStart(2, '0')}`;
  // Default range: from 22nd of previous month to 21st of current month
  const defaultFromDate = (() => {
    const [yStr, mStr] = defaultMonthValue.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return toLocalYmdStringSumDay(new Date(periodYear, periodMonthIndex, 1));
    return toLocalYmdStringSumDay(new Date(y, m - 2, 22));
  })();
  const defaultToDate = (() => {
    const [yStr, mStr] = defaultMonthValue.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return toLocalYmdStringSumDay(new Date(periodYear, periodMonthIndex + 1, 0));
    return toLocalYmdStringSumDay(new Date(y, m - 1, 21));
  })();
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  // Internal range used for API calls (always tied to selected month)
  const [apiFromDate, setApiFromDate] = useState(defaultFromDate);
  const [apiToDate, setApiToDate] = useState(defaultToDate);
  const [monthValue, setMonthValue] = useState(defaultMonthValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowHeight, setRowHeight] = useState(28);
  const [showColsMenu, setShowColsMenu] = useState(false);
  const [showPositionMenu, setShowPositionMenu] = useState(false);
  const [sortByOverallPercent, setSortByOverallPercent] = useState(null); // null=default, 'desc', 'asc'
  const printRef = useRef();
  const [syncing, setSyncing] = useState(false);

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
      const rh = JSON.parse(localStorage.getItem('attendanceSumDayReportRowHeight') || 'null');
      if (typeof rh === 'number' && Number.isFinite(rh)) setRowHeight(rh);
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('attendanceSumDayReportRowHeight', JSON.stringify(rowHeight));
    } catch {
    }
  }, [rowHeight]);

  // When user picks "ប្រចាំខែ" (month), sync inputs
  useEffect(() => {
    if (!monthValue) return;
    const [y, m] = monthValue.split('-').map(Number);
    if (!y || !m) return;
    const fromStr = toLocalYmdStringSumDay(new Date(y, m - 2, 22));
    const toStr = toLocalYmdStringSumDay(new Date(y, m - 1, 21));
    setFromDate(fromStr);
    setToDate(toStr);
    setApiFromDate(fromStr);
    setApiToDate(toStr);
  }, [monthValue]);

  const handleManualLoad = () => {
    setApiFromDate(fromDate);
    setApiToDate(toDate);
  };

  const columnMeta = useMemo(() => ({
    index: { label: 'ល.រ', width: 30, align: 'center', header: 'ល.រ' },
    staffId: { label: 'អត្តលេខបុគ្គលិក', width: 70, align: 'center', header: (<><div>អត្តលេខ</div><div>បុគ្គលិក</div></>) },
    name: { label: 'គោត្តនាម និងនាម', width: 100, align: 'left', header: 'គោត្តនាម និងនាម' },
    gender: { label: 'ភេទ', width: 30, align: 'center', header: 'ភេទ' },
    position: { label: 'តួនាទី', width: 120, align: 'left', header: 'តួនាទី' },
    skill: { label: 'ជំនាញ', width: 100, align: 'left', header: 'ជំនាញ' },
    department: { label: 'ផ្នែក', width: 90, align: 'left', header: 'ផ្នែក' },
    dayWorkCount: { label: 'ចំនួនថ្ងៃសរុប', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ថ្ងៃសរុប</div></>) },
    attendanceCount: { label: 'ចំនួនវត្តមាន', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>វត្តមាន</div></>) },
    leaveCount: { label: 'ច្បាប់', width: 50, align: 'center', header: (<><div></div><div>ច្បាប់</div></>) },
    leaveType: { label: 'ច្បាប់', width: 90, align: 'left', header: (<><div>ប្រភេទច្បាប់</div><div>ឈប់សម្រាក</div></>) },
    A: { label: 'អវត្តមាន', width: 50, align: 'center', header: (<><div></div><div>អវត្តមាន</div></>) },

    workTime: { label: 'ចំនួនម៉ោងសរុប', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ម៉ោងសរុប</div></>) },
    lateEarly: { label: 'ចំនួនយឺត/ចេញមុន/ភ្លេចស្កេន', width: 50, align: 'center', header: (<><div>ចូលយឺត ចេញមុន</div><div>ភ្លេចស្កេន</div></>) },
    plech: { label: 'បេសកកម្ម', width: 50, align: 'center', header: (<><div></div><div>បេសកកម្ម</div></>) },
    plechPercent: { label: 'បេសកកម្ម %', width: 50, align: 'center', header: (<><div></div><div>បេសកកម្ម %</div></>) },
    lateEarlyPercent: { label: 'ចំនួនយឺត/ចេញមុន/ភ្លេចស្កេន %', width: 50, align: 'center', header: (<><div>យឺត/ចេញមុន</div><div>ភ្លេចស្កេន %</div></>) },
    totalAbsent: { label: 'សរុបអវត្តមាន', width: 50, align: 'center', header: (<><div>សរុប</div><div>អវត្តមាន</div></>) },
    percentage: { label: '%', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>%</div></>) },
    overallPercent: { label: 'សរុប %', width: 50, align: 'center', header: (<><div>សរុប</div><div>%</div></>) },
    absentToDeduct: { label: 'អវត្តមានត្រូវកាត់', width: 50, align: 'center', header: (<><div>ចំនួនអវត្តមាន</div><div>ត្រូវកាត់</div></>) },
    other: { label: 'ផ្សេងៗ', width: 80, align: 'left', header: (<><div>ផ្សេងៗ</div></>) },
    totalLeaveComment: { label: 'មតិ', width: 80, align: 'left', header: (<><div>មតិរបស់ការិយាល័យ/ផ្នែក</div><div>លើអវត្តមានបុគ្គលិក ផ្សេងៗ</div></>) },
    performanceResult: { label: 'លទ្ធផលវាយតម្លៃ', width: 80, align: 'center', header: (<><div>លទ្ធផល</div><div>វាយតម្លៃ</div></>) },
  }), []);

  const defaultCols = useMemo(() => ([
    'index', 'name', 'gender', 'position', 'dayWorkCount', 'attendanceCount', 'leaveCount', 'plech', 'A', 'workTime', 'lateEarly', 'totalAbsent', 'overallPercent', 'performanceResult', 'leaveType', 'department', 'staffId',
    'skill', 'plechPercent', 'lateEarlyPercent', 'percentage', 'absentToDeduct', 'other', 'totalLeaveComment'
  ]), []);
  // Use per-user localStorage keys so each user keeps their own column preferences.
  const userStorageId = (() => {
    const u = perms?.user || {};
    const raw =
      (u.id && String(u.id).trim()) ||
      (u.staffId && String(u.staffId).trim()) ||
      (u.username && String(u.username).trim()) ||
      (u.email && String(u.email).trim()) ||
      'guest';
    return raw || 'guest';
  })();

  const VISIBLE_KEY = `attendanceSumDayReportVisibleCols_v2_${userStorageId}`;
  const ORDER_KEY = `attendanceSumDayReportColOrder_v2_${userStorageId}`;
  const WIDTHS_KEY = `attendanceSumDayReportColWidths_v2_${userStorageId}`;

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const v = localStorage.getItem(VISIBLE_KEY);
      if (v) return JSON.parse(v);
    } catch { void 0; }

    const requested = [
      'index', 'name', 'gender', 'position', 'dayWorkCount', 'attendanceCount', 'leaveCount', 'A', 'workTime',
      'lateEarly', 'plech', 'totalAbsent', 'overallPercent', 'performanceResult', 'leaveType', 'department', 'staffId'
    ];
    return Object.fromEntries(defaultCols.map((k) => [k, requested.includes(k)]));
  });

  const [colOrder, setColOrder] = useState(() => {
    try {
      const v = localStorage.getItem(ORDER_KEY);
      if (v) {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed) && parsed.length) {
          const base = parsed.filter((k) => defaultCols.includes(k));
          const missing = defaultCols.filter((k) => !base.includes(k));
          return [...base, ...missing];
        }
      }
    } catch { void 0; }
    return defaultCols;
  });

  const [colWidths, setColWidths] = useState(() => {
    try {
      const v = localStorage.getItem(WIDTHS_KEY);
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

  // Re-load column preferences whenever the real user identity becomes known
  // (perms loads asynchronously, so userStorageId may start as 'guest').
  const prevUserStorageIdRef = useRef(null);
  useEffect(() => {
    if (prevUserStorageIdRef.current === userStorageId) return;
    prevUserStorageIdRef.current = userStorageId;

    // Load visibleCols
    try {
      const v = localStorage.getItem(VISIBLE_KEY) || localStorage.getItem('attendanceSumDayReportVisibleCols');
      if (v) {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed === 'object') {
          setVisibleCols(parsed);
        }
      }
    } catch { void 0; }

    // Load colOrder
    try {
      const v = localStorage.getItem(ORDER_KEY) || localStorage.getItem('attendanceSumDayReportColOrder');
      if (v) {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed) && parsed.length) {
          const base = parsed.filter((k) => defaultCols.includes(k));
          const missing = defaultCols.filter((k) => !base.includes(k));
          setColOrder([...base, ...missing]);
        }
      }
    } catch { void 0; }

    // Load colWidths
    try {
      const v = localStorage.getItem(WIDTHS_KEY) || localStorage.getItem('attendanceSumDayReportColWidths');
      if (v) {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed === 'object') {
          setColWidths(parsed);
        }
      }
    } catch { void 0; }
  }, [userStorageId, VISIBLE_KEY, ORDER_KEY, WIDTHS_KEY, defaultCols]);

  useEffect(() => {
    try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(colWidths)); } catch { void 0; }
  }, [colWidths, WIDTHS_KEY]);

  useEffect(() => {
    try { localStorage.setItem(VISIBLE_KEY, JSON.stringify(visibleCols)); } catch { void 0; }
  }, [visibleCols, VISIBLE_KEY]);

  useEffect(() => {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(colOrder)); } catch { void 0; }
  }, [colOrder, ORDER_KEY]);

  const toggleCol = (k) => {
    setVisibleCols((s) => ({ ...s, [k]: !(s?.[k] ?? true) }));
  };

  const resetColumns = () => {
    setColOrder(defaultCols);
    const requested = [
      'index', 'name', 'gender', 'position', 'dayWorkCount', 'attendanceCount', 'leaveCount', 'A', 'workTime',
      'lateEarly', 'plech', 'totalAbsent', 'overallPercent', 'performanceResult', 'leaveType', 'department', 'staffId'
    ];
    setVisibleCols(Object.fromEntries(defaultCols.map((k) => [k, requested.includes(k)])));
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

        list.sort((a, b) => {
          const idA = (a.Department_Id || '').toString();
          const idB = (b.Department_Id || '').toString();
          return idA.localeCompare(idB, undefined, { numeric: true });
        });

        const names = list.map((d) => (d?.Department_Kh || d?.Department_En || d?.name || d?.title || '').toString().trim()).filter(Boolean);

        names.sort((a, b) => {
          if (a.includes('ថ្នាក់ដឹកនាំ')) return -1;
          if (b.includes('ថ្នាក់ដឹកនាំ')) return 1;
          return 0;
        });

        setDepartments(names);
        if (names.length > 0) {
          setSelectedDept(names[0]);
        }
        return;
      } catch {
      }

      try {
        const res = await api.get('/employees/meta/departments');
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          const list = res.data.filter(Boolean);
          list.sort((a, b) => a.localeCompare(b, 'km'));
          list.sort((a, b) => {
            if (a.includes('ថ្នាក់ដឹកនាំ')) return -1;
            if (b.includes('ថ្នាក់ដឹកនាំ')) return 1;
            return 0;
          });
          setDepartments(list);
          return;
        }
      } catch {
      }

      try {
        // Fallback to public departments endpoint (no special permission required).
        const res = await api.get('/departments/public');
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const names = list
          .map((d) => (d?.Department_Kh || d?.Department_En || d?.name || d?.title || '').toString().trim())
          .filter(Boolean);

        names.sort((a, b) => a.localeCompare(b, 'km'));
        names.sort((a, b) => {
          if (a.includes('ថ្នាក់ដឹកនាំ')) return -1;
          if (b.includes('ថ្នាក់ដឹកនាំ')) return 1;
          return 0;
        });
        setDepartments(names);
      } catch {
        if (mounted) setDepartments([]);
      }
    };
    const loadPositions = async () => {
      try {
        const res = await api.get('/employees/meta/positions');
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setPositions(list.filter(Boolean));
      } catch {
        if (mounted) setPositions([]);
      }
    };
    loadDepts();
    loadPositions();
    return () => {
      mounted = false;
    };
  }, []);

  // Fallback: if department APIs are empty or unavailable,
  // derive distinct departments from the loaded attendance data.
  useEffect(() => {
    if (!attendanceData || !attendanceData.length) return;
    setDepartments((prev) => {
      const existing = new Set((prev || []).map((d) => (d || '').toString().trim()).filter(Boolean));
      const extra = new Set();
      (attendanceData || []).forEach((r) => {
        const name = (r.department || r.Department_Kh || '').toString().trim();
        if (name && !existing.has(name)) extra.add(name);
      });
      if (!extra.size) return prev;
      const merged = Array.from(new Set([...existing, ...extra]));
      merged.sort((a, b) => a.localeCompare(b, 'km'));
      return merged;
    });
  }, [attendanceData]);

  // Fallback: if meta/positions has no data or is not permitted,
  // derive distinct positions from the loaded attendance data.
  useEffect(() => {
    if (!attendanceData || !attendanceData.length) return;
    // Merge positions derived from attendance data with any positions
    // already loaded from the API.
    setPositions((prev) => {
      const existing = new Set((prev || []).map((p) => (p || '').toString().trim()).filter(Boolean));
      const extra = new Set();
      (attendanceData || []).forEach((r) => {
        const p = (r.position || '').toString().trim();
        if (p && !existing.has(p)) extra.add(p);
      });
      if (!extra.size) return prev;
      const merged = Array.from(new Set([...existing, ...extra]));
      merged.sort((a, b) => a.localeCompare(b, 'km'));
      return merged;
    });
  }, [attendanceData]);

  // Fallback: derive distinct departments from attendance data so the
  // "ទី:" dropdown always has values even if metadata APIs fail.
  useEffect(() => {
    if (!attendanceData || !attendanceData.length) return;
    setDepartments((prev) => {
      const existing = new Set((prev || []).map((d) => (d || '').toString().trim()).filter(Boolean));
      const extra = new Set();
      (attendanceData || []).forEach((r) => {
        const d = (r.department || r.Department_Kh || '').toString().trim();
        if (d && !existing.has(d)) extra.add(d);
      });
      if (!extra.size) return prev;
      const merged = Array.from(new Set([...existing, ...extra]));
      merged.sort((a, b) => a.localeCompare(b, 'km'));
      return merged;
    });
  }, [attendanceData]);

  // Build selectable options for "ប្រភេទច្បាប់/មតិ" from
  // distinct leaveType and totalLeaveComment values.
  useEffect(() => {
    const set = new Set();
    (attendanceData || []).forEach((r) => {
      const combined = [r.totalLeaveComment, r.leaveType]
        .filter(Boolean)
        .join(';');
      if (!combined) return;
      combined
        .split(/[;,]/)
        .map((s) => (s || '').toString().trim())
        .filter(Boolean)
        .forEach((token) => set.add(token));
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'km'));
    setLeaveFilterOptions(list);
  }, [attendanceData]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewAttendance || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true);
      setError('');
      try {
        const startStr = apiFromDate;
        const endStr = apiToDate;
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error('Invalid date range');

        const [hrRes] = await Promise.all([
          api.get('/hr').catch(() => ({ data: [] }))
        ]);

        // 1. Filter Active Staff
        const hrList = (Array.isArray(hrRes.data) ? hrRes.data : [])
          .filter(h => {
            if (!h) return false;
            const status = (h.status || '').toString().toLowerCase();
            if (status === 'deleted' || status === 'resigned' || status === 'retired') return false;
            const hasResignData = !!(
              h.resignDate || h.resignReason || h.resignationDate || h.resignationReason ||
              h.dateRemoved || h.dateRemovedFromDataset || h.removalDate ||
              (h.delisted && (h.delisted.dateRemoved || h.delisted.date_removed))
            );
            return !hasResignData;
          });

        const activeSids = hrList.map(h => (h.staffId || h.no || '').toString().trim()).filter(Boolean);
        const sidToLookup = new Map();
        const hrMap = new Map();
        hrList.forEach((h, idx) => {
          const sid = (h.staffId || '').toString().trim();
          const pNo = (h.no || '').toString().trim();
          const key = sid || pNo;
          if (key) {
            sidToLookup.set(sid, key);
            sidToLookup.set(pNo, key);
            hrMap.set(key, h);
          }
        });

        // 2. Fetch Data
        const months = [];
        const startY = startDate.getFullYear();
        const startM = startDate.getMonth(); // 0-11
        const endY = endDate.getFullYear();
        const endM = endDate.getMonth();

        let itY = startY;
        let itM = startM;
        while (itY < endY || (itY === endY && itM <= endM)) {
          months.push({ year: itY, month: itM + 1 });
          itM++;
          if (itM > 11) {
            itM = 0;
            itY++;
          }
        }

        const isSingleDay = (startStr === endStr);

        const summaryParams = { from: startStr, to: endStr };
        if (monthValue) {
          const [y, m] = monthValue.split('-');
          if (y && m) {
            summaryParams.year = y;
            summaryParams.month = m;
          }
        }

        // Fetch data from Attendance Summary (the source of truth for /attendance-sum-day)
        const [summaryRes, leaveRes, schedRes] = await Promise.all([
          api.get('/attendance/summary', { params: summaryParams }).catch(() => ({ data: [] })),
          api.get('/leave-requests', { params: { from: startStr, to: endStr } }).catch(() => ({ data: [] })),
          api.get('/work-schedules', { params: { startDate: startStr, endDate: endStr } }).catch(() => ({ data: [] }))
        ]);

        const summaryRows = Array.isArray(summaryRes.data) ? summaryRes.data : [];
        const leaveList = (Array.isArray(leaveRes.data) ? leaveRes.data : []).filter(lv => {
          const s = (lv.status || '').toLowerCase();
          return s === 'approved' || s === 'pending';
        });
        const schedList = Array.isArray(schedRes.data) ? schedRes.data : [];

        // 3. Create Fast Lookups
        const leaveMap = new Map();
        leaveList.forEach(lv => {
          const sid = (lv.staffId || lv.no || lv.employeeId?.staffId || '').toString().trim();
          const lookup = sidToLookup.get(sid);
          if (!lookup) return;
          const lvStart = new Date(lv.startDate || lv.from || lv.fromDate);
          const lvEnd = new Date(lv.endDate || lv.to || lv.toDate);
          if (isNaN(lvStart.getTime()) || isNaN(lvEnd.getTime())) return;
          for (let d = new Date(lvStart); d <= lvEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = toLocalYmdStringSumDay(d);
            leaveMap.set(`${lookup}_${dateStr}`, lv);
          }
        });

        const schedMap = new Map();
        schedList.forEach(s => {
          const sid = (s?.employeeId?.staffId || s?.employeeId?.no || '').toString().trim();
          const lookup = sidToLookup.get(sid);
          if (lookup) {
            const range = `${s.shiftStart || ''}–${s.shiftEnd || ''}`;
            const dateStr = s.date ? toLocalYmdStringSumDay(new Date(s.date)) : '';
            if (dateStr && range !== '–') schedMap.set(`${lookup}_${dateStr}`, range);
            if (range !== '–') schedMap.set(lookup, range);
          }
        });

        // 4. Aggregate
        const agg = {};
        hrList.forEach((h, idx) => {
          const sid = (h.staffId || h.no || '').toString().trim();
          const noNum = Number(h?.no);
          const sortKey = Number.isFinite(noNum) && noNum > 0 ? noNum : (1_000_000 + idx);
          agg[sid] = {
            staffId: sid,
            hrSortKey: sortKey,
            isCivilServant: Boolean(
              !h?.isRetiredThenContract &&
              ((h?.civilServantId || '').toString().trim() || (h?.officerId || '').toString().trim() || (h?.dateJoinedGov || '').toString().trim())
            ),
            khmerName: h.khmerName || h.name || '',
            name: h.name || '',
            gender: h.gender || '',
            position: h.position || '',
            skill: h.skill || '',
            department: h.Department_Kh || h.department || '',
            dayWorkCount: 0,
            attendanceCount: 0,
            absentCount: 0,
            leaveCount: 0,
            A: 0,
            leaveType: '',
            other: '',
            totalLeaveComment: '',
            plech: 0,
            checkinLateCount: 0,
            checkoutEarlyCount: 0,
            workTimeMinutes: 0,
            scheduledTime: isSingleDay ? (schedMap.get(sid) || '') : ''
          };
        });

        // Apply pre-calculated summary data
        summaryRows.forEach(row => {
          const sid = (row.staffId || '').toString().trim();
          const lookup = sidToLookup.get(sid);
          if (!lookup || !agg[lookup]) return;

          const target = agg[lookup];
          target.dayWorkCount = Number(row.dayWorkCount || 0);
          target.attendanceCount = Number(row.attendanceCount || 0);
          target.leaveCount = Number(row.leaveCount || 0);
          target.A = Number(row.A || 0);
          target.absentCount = Number(row.absentCount || 0);
          target.checkinLateCount = Number(row.checkinLateCount || 0);
          target.checkoutEarlyCount = Number(row.checkoutEarlyCount || 0);
          target.plech = Number(row.plech || 0);
          target.workTimeMinutes = Number(row.workTime || 0);
          target.totalLeaveComment = row.totalLeaveComment || '';
          if (row.skill) target.skill = row.skill;
        });

        // Calculate leaveType breakdown string from leaveList
        const dateList = [];
        const it = new Date(startDate);
        while (it <= endDate) {
          dateList.push(toLocalYmdStringSumDay(it));
          it.setDate(it.getDate() + 1);
        }
        const leaveTypeMapBySid = new Map();
        dateList.forEach(dateStr => {
          hrList.forEach(h => {
            const sid = (h.staffId || h.no || '').toString().trim();
            const lookup = sidToLookup.get(sid);
            if (!lookup) return;
            const leave = leaveMap.get(`${lookup}_${dateStr}`);
            if (leave) {
              if (!leaveTypeMapBySid.has(sid)) leaveTypeMapBySid.set(sid, {});
              const map = leaveTypeMapBySid.get(sid);
              const shortType = ShortenLeaveTypeSumDay(leave.type || leave.leaveType || '');
              if (shortType) map[shortType] = (map[shortType] || 0) + 1;
            }
          });
        });

        if (!mounted) return;
        const finalData = Object.values(agg).map(item => {
          const map = leaveTypeMapBySid.get(item.staffId) || {};
          const leaveTypeStr = Object.entries(map)
            .filter(([t]) => t !== 'បេសកកម្ម')
            .map(([t, c]) => `${t}: ${c}`)
            .join(', ');

          let trueLeaveCount = 0;
          Object.entries(map).forEach(([t, c]) => {
            if (t !== 'បេសកកម្ម') {
              trueLeaveCount += c;
            }
          });

          return {
            ...item,
            leaveCount: trueLeaveCount,
            leaveType: leaveTypeStr,
            mission: map['បេសកកម្ម'] || 0,
            workTime: item.workTimeMinutes > 0 ? formatMinutesAsHMSumDay(item.workTimeMinutes) : '0 h'
          };
        });
        setAttendanceData(finalData);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
        setAttendanceData([]);
      } finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [apiFromDate, apiToDate, perms.canViewAttendance, perms.canViewEmployees]);

  const derived = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();
    const selectedDeptNorm = (selectedDept || '').toString().trim();
    const selectedPosSet = new Set(
      (selectedPositions || [])
        .map((p) => (p || '').toString().trim())
        .filter(Boolean)
    );
    const selectedLeaveNorm = (selectedLeaveFilter || '').toString().trim();

    let rows = (attendanceData || [])
      .filter(record => {
        if (selectedDeptNorm) {
          const dept = (record.department || record.Department_Kh || '').toString().trim();
          if (dept !== selectedDeptNorm) return false;
        }
        if (selectedPosSet.size) {
          const pos = (record.position || '').toString().trim();
          if (!selectedPosSet.has(pos)) return false;
        }
        if (selectedLeaveNorm) {
          const lt = (record.leaveType || '').toString().trim();
          const comment = (record.totalLeaveComment || '').toString().trim();
          if (!lt.includes(selectedLeaveNorm) && !comment.includes(selectedLeaveNorm)) return false;
        }
        if (!term) return true;
        const name = (record.khmerName || record.name || '').toString().toLowerCase();
        const staffId = (record.staffId || record.no || '').toString().toLowerCase();
        const position = (record.position || '').toString().toLowerCase();
        const dept = (record.department || '').toString().toLowerCase();
        return name.includes(term) || staffId.includes(term) || position.includes(term) || dept.includes(term);
      })
      .map((record) => {
        const dayWorkCount = Number(record.dayWorkCount) || 0;
        const attendanceCount = Number(record.attendanceCount) || 0;
        const leaveCount = Number(record.leaveCount) || 0;
        const A = Number(record.A) || 0;
        const workTime = record.workTime || '';
        const checkinLateCount = Number(record.checkinLateCount) || 0;
        const checkoutEarlyCount = Number(record.checkoutEarlyCount) || 0;
        const lateEarlyEvents = checkinLateCount + checkoutEarlyCount;
        const plechEvents = Number(record.plech ?? record.Plech) || 0;
        const combinedEvents = lateEarlyEvents + plechEvents;

        let totalAbsent = A + (combinedEvents / 3);
        totalAbsent = Math.round(totalAbsent * 100) / 100;
        const presentDays = attendanceCount + leaveCount;

        const missionCount = Number(record.mission) || 0;

        let percentage = dayWorkCount > 0 ? Math.round((Math.min(presentDays, dayWorkCount) / dayWorkCount) * 100) : 0;
        let plechPercent = dayWorkCount > 0 ? Math.round((missionCount / dayWorkCount) * 100) : 0;
        let lateEarlyPercent = dayWorkCount > 0 ? Math.round(100 - (combinedEvents / dayWorkCount) * 100) : 0;

        const clamp = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
        percentage = clamp(percentage);
        plechPercent = clamp(plechPercent);
        lateEarlyPercent = clamp(lateEarlyPercent);

        let overallPercent = 0;
        if (dayWorkCount > 0) {
          overallPercent = Math.round(((dayWorkCount - (totalAbsent + leaveCount)) / dayWorkCount) * 100);
          overallPercent = clamp(overallPercent);
        }

        const absentToDeduct = totalAbsent;
        const leaveType = record.leaveType || '';
        const other = record.other || '';
        const totalLeaveComment = record.totalLeaveComment || '';

        let performanceResult = '';
        if (overallPercent >= 85 && overallPercent <= 100) performanceResult = 'ល្អ';
        else if (overallPercent >= 65 && overallPercent < 85) performanceResult = 'ល្អបង្គួរ';
        else if (overallPercent >= 45 && overallPercent < 65) performanceResult = 'មធ្យម';
        else if (overallPercent < 45) performanceResult = 'ខ្សោយ';

        return {
          ...record,
          name: record.khmerName || record.name || '',
          department: record.department || record.Department_Kh || '',
          genderShort: fmtGenderShortSumDay(record.gender),
          isCivilServant: Boolean(record.isCivilServant),
          dayWorkCount,
          attendanceCount,
          leaveCount,
          leaveType,
          A,
          workTime,
          lateEarly: combinedEvents,
          plech: missionCount,
          totalAbsent,
          percentage,
          plechPercent,
          lateEarlyPercent,
          overallPercent,
          absentToDeduct,
          other,
          totalLeaveComment,
          performanceResult,
        };
      });

    const totals = {
      dayWorkCount: 0,
      attendanceCount: 0,
      leaveCount: 0,
      A: 0,
      lateEarly: 0,
      plech: 0,
      totalAbsent: 0,
      workTimeMinutes: 0
    };

    rows.forEach(r => {
      totals.dayWorkCount += (Number(r.dayWorkCount) || 0);
      totals.attendanceCount += (Number(r.attendanceCount) || 0);
      totals.leaveCount += (Number(r.leaveCount) || 0);
      totals.A += (Number(r.A) || 0);
      totals.lateEarly += (Number(r.lateEarly) || 0);
      totals.plech += (Number(r.plech) || 0);
      totals.totalAbsent += (Number(r.totalAbsent) || 0);
      totals.workTimeMinutes += (Number(r.workTimeMinutes) || 0);
    });
    totals.workTime = totals.workTimeMinutes > 0 ? formatMinutesAsHMSumDay(totals.workTimeMinutes) : '0 h';

    rows.sort((a, b) => {
      if (sortByOverallPercent) {
        const ao = Number(a?.overallPercent);
        const bo = Number(b?.overallPercent);
        const aVal = Number.isFinite(ao) ? ao : -1;
        const bVal = Number.isFinite(bo) ? bo : -1;
        if (aVal !== bVal) return sortByOverallPercent === 'desc' ? bVal - aVal : aVal - bVal;
      }
      const ka = Number(a?.hrSortKey);
      const kb = Number(b?.hrSortKey);
      const aKey = Number.isFinite(ka) ? ka : 1_000_000_000;
      const bKey = Number.isFinite(kb) ? kb : 1_000_000_000;
      if (aKey !== bKey) return aKey - bKey;
      const aSid = (a?.staffId || a?.no || '').toString();
      const bSid = (b?.staffId || b?.no || '').toString();
      return aSid.localeCompare(bSid);
    });

    rows = rows.map((record, idx) => ({ ...record, index: idx + 1 }));

    const maleCount = rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length;
    const femaleCount = rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length;
    return { rows, male: maleCount, female: femaleCount, total: rows.length, totals };
  }, [attendanceData, q, selectedDept, selectedPositions, selectedLeaveFilter, sortByOverallPercent]);

  const handleDragStart = (e, key) => {
    draggingKeyRef.current = key;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, key) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, key) => {
    e.preventDefault();
    const from = draggingKeyRef.current;
    if (!from || from === key) return;
    const idx1 = colOrder.indexOf(from);
    const idx2 = colOrder.indexOf(key);
    if (idx1 < 0 || idx2 < 0) return;
    const newOrder = [...colOrder];
    [newOrder[idx1], newOrder[idx2]] = [newOrder[idx2], newOrder[idx1]];
    setColOrder(newOrder);
  };

  const handleExportExcel = async () => {
    // Use the selected month (END month) for file naming
    const [yStr, mStr] = (monthValue || '').split('-');
    const year = yStr || '';
    const month = mStr || '';

    const visibleKeys = (colOrder || [])
      .filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));

    const getCellValueLocal = (k, row) => {
      switch (k) {
        case 'index': return row.index;
        case 'staffId': return row.staffId;
        case 'name': return row.name;
        case 'gender': return row.genderShort || row.gender;
        case 'position': return row.position;
        case 'department': return row.department || row.Department_Kh;
        case 'dayWorkCount': return row.dayWorkCount;
        case 'attendanceCount': return row.attendanceCount;
        case 'leaveCount': return row.leaveCount;
        case 'leaveType': return row.leaveType;
        case 'A': return row.A;
        case 'workTime': return row.workTime;
        case 'lateEarly': return row.lateEarly;
        case 'plech': return row.plech;
        case 'plechPercent': return row.plechPercent;
        case 'lateEarlyPercent': return row.lateEarlyPercent;
        case 'totalAbsent': return row.totalAbsent;
        case 'percentage': return row.percentage;
        case 'overallPercent': return row.overallPercent;
        case 'absentToDeduct': return '';
        case 'other': return row.other;
        case 'totalLeaveComment': return buildCommentText(row);
        default: return row?.[k];
      }
    };

    const wb = new ExcelJS.Workbook();
    const sheetName = `វត្តមាន_${month}_${year}`;
    const ws = wb.addWorksheet(sheetName.substring(0, 31)); // Excel sheet name limit

    const colsCount = visibleKeys.length;
    const midCol = Math.ceil(colsCount / 2);

    // Apply basic font settings to the sheet
    ws.properties.defaultRowHeight = 20;

    // Define columns
    ws.columns = visibleKeys.map(k => {
      let w = Number(colWidths?.[k]) || columnMeta[k]?.width;
      let wch = typeof w === 'number' ? Math.max(8, Math.round(w / 6.5)) : 12;
      if (k === 'index') wch = 6;
      if (k === 'name') wch = 20;
      if (k === 'position') wch = 25;
      if (k === 'department') wch = 25;
      if (k === 'totalLeaveComment') wch = 30;
      return { key: k, width: wch };
    });

    // Add UI/UX Headers
    // Row 1: ព្រះរាជាណាចក្រកម្ពុជា
    const r1 = ws.addRow([]);
    const c1 = ws.getCell(1, midCol);
    c1.value = 'ព្រះរាជាណាចក្រកម្ពុជា';
    c1.font = { name: 'Khmer OS Muol Light', size: 16 };
    c1.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(1, Math.max(1, midCol - 1), 1, Math.min(colsCount, midCol + 2));

    // Row 2: ជាតិ សាសនា ព្រះមហាក្សត្រ
    const r2 = ws.addRow([]);
    const c2 = ws.getCell(2, midCol);
    c2.value = 'ជាតិ សាសនា ព្រះមហាក្សត្រ';
    c2.font = { name: 'Khmer OS Muol Light', size: 16 };
    c2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(2, Math.max(1, midCol - 1), 2, Math.min(colsCount, midCol + 2));

    // Empty row
    ws.addRow([]);

    // Row 4: ក្រសួងសុខាភិបាល
    const r4 = ws.addRow([]);
    const c4 = ws.getCell(r4.number, 1);
    c4.value = 'ក្រសួងសុខាភិបាល';
    c4.font = { name: 'Khmer OS Muol Light', size: 14 };
    c4.alignment = { horizontal: 'left', vertical: 'middle' };

    // Row 5: មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត
    const r5 = ws.addRow([]);
    const c5 = ws.getCell(r5.number, 1);
    c5.value = 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    c5.font = { name: 'Khmer OS Muol Light', size: 14 };
    c5.alignment = { horizontal: 'left', vertical: 'middle' };

    // Row 6: Department
    if (selectedDept) {
      const r6 = ws.addRow([]);
      const c6 = ws.getCell(r6.number, 1);
      c6.value = `ផ្នែក: ${selectedDept}`;
      c6.font = { name: 'Khmer OS Muol Light', size: 14 };
      c6.alignment = { horizontal: 'left', vertical: 'middle' };
    }

    // Row 7: Title
    const rTitle = ws.addRow([]);
    const cTitle = ws.getCell(rTitle.number, 1);
    cTitle.value = `វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការ និងមន្រ្តីកិច្ចសន្យា គិតពី ${fmtKhmerLongDateSumDay(apiFromDate)} ដល់ ${fmtKhmerLongDateSumDay(apiToDate)}`;
    cTitle.font = { name: 'Khmer OS Siemreap', size: 15, bold: true };
    cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(rTitle.number, 1, rTitle.number, colsCount);

    ws.addRow([]); // empty row before table

    // Table Header
    const headerRow = ws.addRow(visibleKeys.map(k => columnMeta[k]?.label || k));
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Khmer OS Siemreap', size: 11, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF8F8B8B' } },
        left: { style: 'thin', color: { argb: 'FF8F8B8B' } },
        bottom: { style: 'thin', color: { argb: 'FF8F8B8B' } },
        right: { style: 'thin', color: { argb: 'FF8F8B8B' } }
      };
    });

    // Table Data
    derived.rows.forEach(row => {
      const rowData = visibleKeys.map(k => getCellValueLocal(k, row));
      const excelRow = ws.addRow(rowData);
      excelRow.eachCell((cell, colNumber) => {
        const k = visibleKeys[colNumber - 1];
        cell.font = { name: 'Khmer OS Siemreap', size: 11 };
        
        let align = 'center';
        if (k === 'name' || k === 'position' || k === 'department' || k === 'leaveType' || k === 'other' || k === 'totalLeaveComment') {
          align = 'left';
        }
        
        cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF8F8B8B' } },
          left: { style: 'thin', color: { argb: 'FF8F8B8B' } },
          bottom: { style: 'thin', color: { argb: 'FF8F8B8B' } },
          right: { style: 'thin', color: { argb: 'FF8F8B8B' } }
        };
      });
    });

    // Summary Row
    const totalRow = visibleKeys.map(k => {
      if (k === 'index') return 'សរុប';
      if (k === 'dayWorkCount') return derived.totals?.dayWorkCount;
      if (k === 'attendanceCount') return derived.totals?.attendanceCount;
      if (k === 'leaveCount') return derived.totals?.leaveCount;
      if (k === 'A') return derived.totals?.A;
      if (k === 'lateEarly') return derived.totals?.lateEarly;
      if (k === 'plech') return derived.totals?.plech;
      if (k === 'totalAbsent') return derived.totals?.totalAbsent;
      if (k === 'workTime') return derived.totals?.workTime;
      return '';
    });
    
    const summaryExcelRow = ws.addRow(totalRow);
    summaryExcelRow.eachCell((cell, colNumber) => {
      const k = visibleKeys[colNumber - 1];
      cell.font = { name: 'Khmer OS Siemreap', size: 11, bold: true };
      let align = 'center';
      if (k === 'index') align = 'right';
      cell.alignment = { horizontal: align, vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF8F8B8B' } },
        left: { style: 'thin', color: { argb: 'FF8F8B8B' } },
        bottom: { style: 'thin', color: { argb: 'FF8F8B8B' } },
        right: { style: 'thin', color: { argb: 'FF8F8B8B' } }
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    });

    ws.addRow([]);
    ws.addRow(['សរុបបុគ្គលិក', `${derived.total} នាក់`, `(ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់)`]);

    const fileSafe = year && month ? `AttendanceSumDay_${year}_${month}.xlsx` : `AttendanceSumDay_${fromDate}_${toDate}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileSafe);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const printContent = printRef.current.outerHTML;
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Preview</title>
          <style>
            ${printCss}
            body { font-family: "Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif; margin: 0; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const handlePrintByDepartment = () => {
    const rowsSource = selectedDept ? (derived.rows || []) : (derivedAllDepts.rows || []);
    const deptKey = (s) => (s || '').toString().trim() || 'មិនមានផ្នែក';
    const groups = new Map();
    rowsSource.forEach((r) => {
      const dep = deptKey(r.department || r.Department_Kh);
      if (!groups.has(dep)) groups.set(dep, []);
      groups.get(dep).push(r);
    });

    const groupList = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'km'));
    if (groupList.length === 0) {
      window.alert('មិនមានទិន្នន័យសម្រាប់បោះពុម្ព');
      return;
    }

    const w = window.open('', '_blank');
    if (!w) return;

    const extraCss = `
      .dept-page { page-break-after: always; }
      .dept-page:last-child { page-break-after: auto; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead { display: table-header-group; }
      tr, td, th { page-break-inside: avoid; }
      th, td { border: 1px solid #8f8b8b; padding: 4px 6px; }
      th { background: #f3f4f6; }
    `;

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>AttendanceSumDay_ByDepartment</title>
          <style>
            ${printCss}
            body { font-family: 'Khmer OS Siemreap','Noto Sans Khmer',Arial,sans-serif; margin: 0; padding: 0; }
            ${extraCss}
          </style>
        </head>
        <body>
          <div id="dept-root" style="width:100%;margin:0;padding:0;"></div>
        </body>
      </html>
    `);
    w.document.close();

    const root = w.document.getElementById('dept-root');
    if (!root) return;

    const visibleKeysNow = (colOrder || []).filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));

    const makeEl = (tag, style) => {
      const el = w.document.createElement(tag);
      if (style) Object.assign(el.style, style);
      return el;
    };

    const makeText = (tag, text, style) => {
      const el = makeEl(tag, style);
      el.textContent = text;
      return el;
    };

    groupList.forEach(([deptName, rows]) => {
      const page = makeEl('div', {
        background: '#fff',
        padding: '10mm',
        margin: '0',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: (printOrientation === 'landscape') ? '210mm' : '297mm'
      });
      page.className = 'dept-page';

      const header = makeEl('div', { marginBottom: '4px', paddingBottom: '0' });
      header.appendChild(makeText('h1', 'ព្រះរាជាណាចក្រកម្ពុជា', { margin: '0', fontSize: '16px', fontWeight: '400', textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }));
      header.appendChild(makeText('h1', 'ជាតិ សាសនា ព្រះមហាក្សត្រ', { margin: '0', fontSize: '16px', fontWeight: '400', textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }));
      
      const logoWrapper = makeEl('div', { display: 'flex', justifyContent: 'center', width: '100%', margin: '4px 0' });
      const logo = makeEl('img');
      logo.src = headerBg;
      logo.alt = 'header-symbol';
      logo.style.height = 'auto';
      logo.style.maxWidth = '120px';
      logoWrapper.appendChild(logo);
      header.appendChild(logoWrapper);

      header.appendChild(makeText('h1', 'ក្រសួងសុខាភិបាល', { margin: '0', marginTop: '-5mm', fontSize: '14px', fontWeight: '400', textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }));
      header.appendChild(makeText('h1', 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត', { margin: '0', fontSize: '14px', fontWeight: '400', textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }));
      header.appendChild(makeText('h1', deptName || '', { margin: '0', fontSize: '14px', fontWeight: '400', textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }));
      
      header.appendChild(makeText('p', `វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការ និងមន្រ្តីកិច្ចសន្យា គិតពី ${fmtKhmerLongDateSumDay(fromDate)} ដល់ ${fmtKhmerLongDateSumDay(toDate)}`, { margin: '0', fontSize: '15px', fontWeight: '700', textAlign: 'center', fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", sans-serif' }));
      page.appendChild(header);

      const male = rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length;
      const female = rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length;
      page.appendChild(makeText('div', `សរុប: ${toKhmerDigitsSumDay(rows.length)} នាក់ ( ប្រុស: ${toKhmerDigitsSumDay(male)} — ស្រី: ${toKhmerDigitsSumDay(female)} )`, { marginBottom: '10px', fontSize: '12px', color: '#313030' }));

      const table = makeEl('table');
      Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' });
      const thead = makeEl('thead');
      const trh = makeEl('tr');
      visibleKeysNow.forEach((k) => {
        const th = makeEl('th', { textAlign: 'center', fontSize: '12px', padding: '4px 3px', border: '1px solid #8f8b8b', background: '#f3f4f6', whiteSpace: 'nowrap' });
        th.textContent = columnMeta[k]?.label || k;
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = makeEl('tbody');
      rows.forEach((row, idx) => {
        const tr = makeEl('tr');
        tr.style.background = (idx % 2 === 0) ? '#f9fafb' : '#fff';
        visibleKeysNow.forEach((k) => {
          const cell = renderCell(k, row);
          const td = makeEl('td', {
            fontSize: '12px',
            verticalAlign: 'middle',
            textAlign: cell?.style?.textAlign || columnMeta[k]?.align || 'center',
            border: '1px solid #8f8b8b',
            padding: '3px 4px',
            whiteSpace: 'nowrap'
          });
          td.textContent = (cell?.value ?? '').toString();
          tbody.appendChild(tr).appendChild(td);
        });
        table.appendChild(tbody);
      });
      page.appendChild(table);

      const footer = makeEl('div', { marginTop: '20px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' });
      const f1 = makeEl('div', { textAlign: 'left' });
      f1.appendChild(makeText('p', 'ផលប័ត្រមន្ត្រីឃ្មាំងរដ្ឋ', { margin: '0' }));
      f1.appendChild(makeText('p', '____________________', { margin: '0' }));
      const f2 = makeEl('div', { textAlign: 'center' });
      f2.appendChild(makeText('p', 'ប្រសាសន៍', { margin: '0' }));
      f2.appendChild(makeText('p', '____________________', { margin: '0' }));
      const f3 = makeEl('div', { textAlign: 'right' });
      f3.appendChild(makeText('p', 'សម្ព័ន្ធបុគ្គលិក', { margin: '0' }));
      f3.appendChild(makeText('p', '____________________', { margin: '0' }));
      footer.appendChild(f1);
      footer.appendChild(f2);
      footer.appendChild(f3);
      page.appendChild(footer);

      root.appendChild(page);
    });

    setTimeout(() => w.print(), 600);
  };

  if (loading && !attendanceData.length) {
    return <div style={{ padding: 20 }}><p>កំពុងផ្ទុក...</p></div>;
  }

  const rowFontSize = Math.max(10, Math.round(rowHeight * 0.46)) + 1;
  const bodyPadY = Math.max(1, Math.min(12, Math.round(rowHeight / 6)));

  const tdBase = {
    border: '1px solid #8f8b8b',
    padding: `${bodyPadY}px 6px`,
    verticalAlign: 'middle',
    fontSize: rowFontSize,
    whiteSpace: 'nowrap'
  };

  const visibleKeys = (colOrder || [])
    .filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));

  const thBase = {
    border: '1px solid #8f8b8b',
    padding: 6,
    textAlign: 'center',
    fontSize: 13,
    userSelect: 'none'
  };

  const getColWidth = (k) => {
    const w = Number(colWidths?.[k]);
    if (Number.isFinite(w) && w > 0) return w;
    return columnMeta[k]?.width;
  };

  const buildCommentText = (row) => {
    // Comment should follow leave-requests type only.
    // Merge backend-provided totalLeaveComment and leaveType;
    // if both empty, keep comment empty (no auto text).
    return mergeText(row.totalLeaveComment, row.leaveType);
  };

  const togglePosition = (pos) => {
    const value = (pos || '').toString().trim();
    if (!value) {
      setSelectedPositions([]);
      return;
    }
    setSelectedPositions((prev) => {
      const exists = prev.includes(value);
      if (exists) return prev.filter((p) => p !== value);
      return [...prev, value];
    });
  };

  const clearPositions = () => {
    setSelectedPositions([]);
  };

  const renderCell = (key, row) => {
    const maybeHideZero = (v, showZero = false) => {
      if (v === null || typeof v === 'undefined') return '';
      const n = Number(v);
      if (Number.isFinite(n)) {
        if (n === 0 && !showZero) return '';
        return n;
      }
      return v;
    };
    switch (key) {
      case 'index':
        return {
          value: row.index,
          style: {
            textAlign: 'center',
            width: columnMeta.index.width,
            textDecoration: row.isCivilServant ? 'underline' : 'none',
            textDecorationThickness: row.isCivilServant ? '2px' : undefined,
            textUnderlineOffset: row.isCivilServant ? 3 : undefined
          }
        };
      case 'staffId':
        return {
          value: row.staffId,
          style: { textAlign: 'center', width: columnMeta.staffId.width }
        };
      case 'name':
        return { value: row.name, style: { textAlign: 'left', width: columnMeta.name.width } };
      case 'gender':
        return { value: (row.genderShort || row.gender), style: { textAlign: 'center', width: columnMeta.gender.width } };
      case 'position':
        return { value: row.position, style: { textAlign: 'left', width: columnMeta.position.width, fontSize: Math.max(9, rowFontSize - 1) } };
      case 'skill':
        return { value: row.skill || '', style: { textAlign: 'left', width: columnMeta.skill.width, fontSize: Math.max(9, rowFontSize - 1) } };
      case 'department':
        return { value: row.department || row.Department_Kh, style: { textAlign: 'left', width: columnMeta.department.width, fontSize: Math.max(9, rowFontSize - 1) } };
      case 'dayWorkCount':
        return { value: maybeHideZero(row.dayWorkCount, true), style: { textAlign: 'center' } };
      case 'attendanceCount':
        return { value: maybeHideZero(row.attendanceCount, true), style: { textAlign: 'center' } };
      case 'leaveCount':
        return { value: maybeHideZero(row.leaveCount), style: { textAlign: 'center' } };
      case 'leaveType':
        return { value: row.leaveType || '', style: { textAlign: 'left', fontSize: Math.max(8, rowFontSize - 2) } };
      case 'A':
        return { value: maybeHideZero(row.A), style: { textAlign: 'center' } };
      case 'workTime':
        return { value: row.workTime, style: { textAlign: 'center' } };
      case 'lateEarly':
        return { value: maybeHideZero(row.lateEarly), style: { textAlign: 'center' } };
      case 'plech':
        return { value: maybeHideZero(row.plech), style: { textAlign: 'center' } };
      case 'plechPercent':
        return {
          value: (Number(row.plechPercent) && Number(row.plechPercent) > 0) ? `${row.plechPercent}%` : (Number.isFinite(Number(row.plechPercent)) ? '0%' : ''),
          style: { textAlign: 'center' }
        };
      case 'totalAbsent':
        return { value: maybeHideZero(row.totalAbsent), style: { textAlign: 'center' } };
      case 'percentage':
        return {
          value: Number.isFinite(Number(row.percentage)) ? `${Number(row.percentage)}%` : '',
          style: { textAlign: 'center' }
        };
      case 'lateEarlyPercent':
        return {
          value: (Number(row.lateEarlyPercent) && Number(row.lateEarlyPercent) > 0) ? `${row.lateEarlyPercent}%` : (Number.isFinite(Number(row.lateEarlyPercent)) ? '0%' : ''),
          style: { textAlign: 'center' }
        };
      case 'overallPercent':
        return {
          value: Number.isFinite(Number(row.overallPercent)) ? `${Number(row.overallPercent)}%` : '',
          style: { textAlign: 'center' }
        };
      case 'absentToDeduct':
        // Field "ចំនួនអវត្តមានត្រូវកាត់" should not display any data for now.
        // Keep the column header, but always render an empty cell.
        return { value: '', style: { textAlign: 'center' } };
      case 'other':
        return { value: row.other || '', style: { textAlign: 'left', fontSize: Math.max(8, rowFontSize - 2) } };
      case 'totalLeaveComment': {
        // Only show comment if leaveCount > 0
        const leaveCount = Number(row.leaveCount) || 0;
        return {
          value: leaveCount > 0 ? buildCommentText(row) : '',
          style: { fontSize: Math.max(8, rowFontSize - 2) }
        };
      }
      default:
        return { value: row?.[key], style: {} };
    }
  };

  const copyToGoogleSheets = () => {
    if (!derived?.rows || derived.rows.length === 0) {
      alert("គ្មានទិន្នន័យសម្រាប់ចម្លងទេ!");
      return;
    }

    const visibleKeys = (colOrder || []).filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));
    const header = visibleKeys.map((k) => columnMeta[k]?.label || k).join('\t');

    const getCellValueLocal = (k, row) => {
      switch (k) {
        case 'index': return row.index;
        case 'staffId': return row.staffId;
        case 'name': return row.name;
        case 'gender': return row.genderShort || row.gender;
        case 'position': return row.position;
        case 'department': return row.department || row.Department_Kh;
        case 'dayWorkCount': return row.dayWorkCount;
        case 'attendanceCount': return row.attendanceCount;
        case 'leaveCount': return row.leaveCount;
        case 'leaveType': return row.leaveType;
        case 'A': return row.A;
        case 'workTime': return row.workTime;
        case 'lateEarly': return row.lateEarly;
        case 'plech': return row.plech;
        case 'plechPercent': return row.plechPercent;
        case 'lateEarlyPercent': return row.lateEarlyPercent;
        case 'totalAbsent': return row.totalAbsent;
        case 'percentage': return row.percentage;
        case 'overallPercent': return row.overallPercent;
        case 'absentToDeduct': return '';
        case 'other': return row.other;
        case 'totalLeaveComment': return buildCommentText(row);
        default: return row?.[k];
      }
    };

    const rows = derived.rows.map((row, idx) => {
      const adjustedRow = { ...row, index: idx + 1 };
      return visibleKeys.map((k) => {
        const val = getCellValueLocal(k, adjustedRow);
        return val === null || val === undefined ? '' : val;
      }).join('\t');
    });

    const content = [header, ...rows].join('\n');

    navigator.clipboard.writeText(content)
      .then(() => alert("បានចម្លងទិន្នន័យទាំងអស់រួចរាល់! លោកអ្នកអាចផាស (Paste) ចូលទៅ Google Sheets បាន។"))
      .catch(err => {
        console.error('Copy failed', err);
        alert("ការចម្លងមិនបានសម្រេច៖ " + err.message);
      });
  };

  // NOTE: This function requires the Google Apps Script to be updated to handle borders and formatting.
  // The script should use payload.header and payload.data to apply borders and set font size 11.
  const syncToGoogleSheets = async () => {
    if (!derived?.rows || derived.rows.length === 0) {
      alert("គ្មានទិន្នន័យសម្រាប់បញ្ជូនទេ!");
      return;
    }

    // Mapping of Department keywords to their respective Web App URLs
    const deptConfig = {
      "ចក្ខុរោគ": "https://script.google.com/macros/s/AKfycbziQ66g12gKv__z9wtRHoaafJt1oADnNX4BX3su_2gWd-E_e59EdDv2P7ibO2jJ546yfw/exec",
      "ហិរញ្ញវត្ថុ": "https://script.google.com/macros/s/AKfycbx2gscLVje_ZJCCDD3OFPEdYEOrvdK4BqFPFj2EC5ogbtLsiVJeEminoxtSV29FxBaz/exec",
      "ទាំងអស់": "https://script.google.com/macros/s/AKfycbxMeoZRsZDu-bD94AX9oXY3gIv8_TJzPqBZRXwErk36Ov9C12wXaIhV53O2OgF9mIEOrw/exec",
    };

    // User wants to sync ALL data at once ("លែងគិតជាផ្នែក")
    // We prefer the "ទាំងអស់" URL if provided, otherwise fallback to "ហិរញ្ញវត្ថុ"
    const targetUrl = deptConfig["ទាំងអស់"] || deptConfig["ហិរញ្ញវត្ថុ"];

    const confirmMsg = "តើលោកអ្នកពិតជាចង់បញ្ជូនទិន្នន័យទាំងអស់ (គ្រប់ផ្នែក) ទៅ Google Sheets មែនទេ?";

    if (!window.confirm(confirmMsg)) return;

    setSyncing(true);

    try {
      const visibleKeys = (colOrder || []).filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));

      const getCellValue = (k, row) => {
        switch (k) {
          case 'index': return row.index;
          case 'staffId': return row.staffId;
          case 'name': return row.name;
          case 'gender': return row.genderShort || row.gender;
          case 'position': return row.position;
          case 'department': return row.department || row.Department_Kh;
          case 'dayWorkCount': return row.dayWorkCount;
          case 'attendanceCount': return row.attendanceCount;
          case 'leaveCount': return row.leaveCount;
          case 'leaveType': return row.leaveType;
          case 'A': return row.A;
          case 'workTime': return row.workTime;
          case 'lateEarly': return row.lateEarly;
          case 'plech': return row.plech;
          case 'plechPercent': return row.plechPercent;
          case 'lateEarlyPercent': return row.lateEarlyPercent;
          case 'totalAbsent': return row.totalAbsent;
          case 'percentage': return row.percentage;
          case 'overallPercent': return row.overallPercent;
          case 'absentToDeduct': return '';
          case 'other': return row.other;
          case 'totalLeaveComment': return buildCommentText(row);
          default: return row?.[k];
        }
      };

      const data = derived.rows.map((row, idx) => {
        const adjustedRow = { ...row, index: idx + 1 };
        return visibleKeys.map((k) => getCellValue(k, adjustedRow));
      });

      const payload = {
        sheetName: `វត្តមានសរុប_${(monthValue || '').replace('-', '_')}`,
        header: visibleKeys.map((k) => columnMeta[k]?.label || k),
        data: data,
        metadata: {
          fromDate: apiFromDate,
          toDate: apiToDate,
          month: monthValue,
          totalRows: derived.rows.length
        }
      };

      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      alert("បានបញ្ជូនទិន្នន័យទាំងអស់ទៅ Google Sheets រួចរាល់!");
    } catch (err) {
      console.error('Sync failed', err);
      alert("ការបញ្ជូនទិន្នន័យមិនបានសម្រេច៖ " + err.message);
    } finally {
      setSyncing(false);
    }
  };




  return (
    <div style={{ padding: 20, fontFamily: '"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif' }}>

      {/* Filter Card (A) */}
      <div style={{
        background: '#fff',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid #edf2f7',
        marginBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Top Row: Search and Quick Actions */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#718096' }}>🔍</span>
            <input
              type="text"
              placeholder="ស្វែងរកបុគ្គលិក (ឈ្មោះ, អត្តលេខ, តួនាទី, ផ្នែក...)"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            {q && (
              <button
                onClick={() => setQ('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '10px',
                  color: '#64748b'
                }}
              >✕</button>
            )}
          </div>
          <button onClick={() => navigate(`/attendance-daily-report?date=${fromDate}`)} style={{ padding: '10px 16px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>របាយការណ៍ជាថ្ងៃ</button>
          <button onClick={handleExportExcel} style={{ padding: '10px 16px', background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>នាំចេញ Excel</button>
          <button onClick={handlePrint} style={{ padding: '10px 16px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>បោះពុម្ព</button>
          <button onClick={handlePrintByDepartment} style={{ padding: '10px 16px', background: '#faf5ff', color: '#9333ea', border: '1px solid #e9d5ff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>PDF តាមផ្នែក</button>
        </div>

        {/* Bottom Row: Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>ប្រចាំខែ:</label>
            <input
              type="month"
              value={monthValue}
              onChange={e => setMonthValue(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>ចាប់ពីថ្ងៃ:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                const val = e.target.value;
                setFromDate(val);
                setApiFromDate(val);
              }}
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>ដល់ថ្ងៃ:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                const val = e.target.value;
                setToDate(val);
                setApiToDate(val);
              }}
              min={fromDate}
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
            />
          </div>
          <button
            onClick={handleManualLoad}
            style={{
              padding: '9px 20px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            ទាញយក
          </button>

          <div style={{ width: '1px', height: '30px', background: '#cbd5e1', margin: '0 8px' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>ផ្នែក:</label>
            <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', minWidth: '150px', background: '#fff' }}>
              <option value="">-- ទាំងអស់ --</option>
              {departments.map((d, i) => (
                <option key={`${String(d)}-${i}`} value={String(d)}>
                  {String(d)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>តួនាទី:</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowPositionMenu(v => !v)}
                style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', minWidth: '180px', background: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '13px' }}
              >
                {selectedPositions.length === 0 && '-- ទាំងអស់ --'}
                {selectedPositions.length === 1 && selectedPositions[0]}
                {selectedPositions.length > 1 && `${selectedPositions[0]} + ${selectedPositions.length - 1} ទៀត`}
              </button>
              {showPositionMenu && (
                <div style={{ position: 'absolute', zIndex: 120, top: '100%', marginTop: '8px', background: '#fff', border: '1px solid #ddd', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '12px', minWidth: '250px', maxHeight: '300px', overflowY: 'auto', borderRadius: '8px' }}>
                  <div style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                    <button type="button" onClick={clearPositions} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>សម្អាតទាំងអស់</button>
                  </div>
                  {positions.map((p, i) => {
                    const label = String(p);
                    const checked = selectedPositions.includes(label);
                    return (
                      <label key={`${label}-${i}`} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePosition(label)}
                          style={{ marginRight: '10px' }}
                        />
                        {label}
                      </label>
                    );
                  })}
                  <div style={{ textAlign: 'right', marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    <button type="button" onClick={() => setShowPositionMenu(false)} style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}>បិទ</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>ប្រភេទច្បាប់/មតិ:</label>
            <select
              value={selectedLeaveFilter}
              onChange={(e) => setSelectedLeaveFilter(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', minWidth: '200px', background: '#fff' }}
            >
              <option value="">-- ទាំងអស់ --</option>
              {leaveFilterOptions.map((opt, idx) => (
                <option key={`${String(opt)}-${idx}`} value={String(opt)}>
                  {String(opt)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>Row height</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={rowHeight}
                  onChange={(e) => setRowHeight(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{rowFontSize}px</span>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowColsMenu(v => !v)}
                style={{ padding: '8px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
              >Columns</button>
              {showColsMenu && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '8px', background: '#fff', border: '1px solid #ddd', padding: '12px', minWidth: '220px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, borderRadius: '8px' }}>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                    {defaultCols.map((k) => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap', marginBottom: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!(visibleCols?.[k] ?? true)} onChange={() => toggleCol(k)} style={{ marginRight: '10px' }} />
                        {columnMeta[k]?.label || k}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                    <button type="button" onClick={resetColumns} style={{ padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', fontSize: '11px' }}>Reset</button>
                    <button type="button" onClick={resetWidths} style={{ padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', fontSize: '11px' }}>Reset width</button>
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '8px' }}>
                    <button type="button" onClick={() => setShowColsMenu(false)} style={{ padding: '4px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', fontSize: '12px' }}>បិទ</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: '#64748b' }}>បោះពុម្ព</label>
              <select
                value={printOrientation}
                onChange={(e) => setPrintOrientation(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: '#64748b' }}>Google Sheets</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={copyToGoogleSheets}
                  style={{
                    padding: '8px 12px',
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                  title="ចម្លងទិន្នន័យទាំងអស់ដើម្បីផាស (Paste) ចូល Google Sheets"
                >
                  ចម្លងទិន្នន័យ
                </button>
                <button
                  type="button"
                  onClick={syncToGoogleSheets}
                  disabled={syncing}
                  style={{
                    padding: '8px 12px',
                    background: syncing ? '#9ca3af' : '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {syncing ? 'កំពុងបញ្ជូន...' : 'បញ្ជូនទិន្នន័យ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={printRef}
        id="attendance-sumday-print-content"
        style={{
          margin: '0 auto 20px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
          maxWidth: printOrientation === 'landscape' ? '297mm' : '210mm',
          minHeight: printOrientation === 'landscape' ? '210mm' : '297mm',
          padding: 24
        }}
      >
        <div style={{ marginBottom: 4, paddingBottom: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 400, textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }}>ព្រះរាជាណាចក្រកម្ពុជា</h1>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 400, textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</h1>
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '4px 0' }}>
            <img src={headerBg} alt="header-symbol" style={{ height: 'auto', maxWidth: '120px' }} />
          </div>
          <h1 style={{ margin: 0, marginTop: '-5mm', fontSize: 14, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>ក្រសួងសុខាភិបាល</h1>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</h1>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>{selectedDept || ''}</h1>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, textAlign: 'center', fontFamily: '"Khmer OS Siemreap", "Noto Sans Khmer", sans-serif' }}>
            វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការ និងមន្រ្តីកិច្ចសន្យា គិតពី {fmtKhmerLongDateSumDay(apiFromDate)} ដល់ {fmtKhmerLongDateSumDay(apiToDate)}
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid #ddd', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {visibleKeys.map((k) => (
                <th
                  key={k}
                  draggable
                  onDragStart={(e) => handleDragStart(e, k)}
                  onDragOver={(e) => handleDragOver(e, k)}
                  onDrop={(e) => handleDrop(e, k)}
                  title={k === 'overallPercent' ? 'ចុចដើម្បីរៀបតាម សរុប %' : 'Drag to reorder columns'}
                  onClick={k === 'overallPercent'
                    ? () => setSortByOverallPercent((prev) => {
                      if (prev === 'desc') return 'asc';
                      if (prev === 'asc') return null;
                      return 'desc';
                    })
                    : undefined}
                  style={{
                    ...thBase,
                    width: getColWidth(k),
                    cursor: k === 'overallPercent' ? 'pointer' : 'move',
                    position: 'relative'
                  }}
                >
                  {columnMeta[k]?.header ?? (columnMeta[k]?.label || k)}
                  {k === 'overallPercent' && sortByOverallPercent && (
                    <span style={{ marginLeft: 4, fontSize: 10 }}>
                      {sortByOverallPercent === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                  <div
                    onMouseDown={(e) => startResize(k, e)}
                    title="Drag to resize"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 8,
                      cursor: 'col-resize',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ width: 2, height: '60%', background: 'rgba(0,0,0,0.18)', borderRadius: 1 }} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {derived.rows.length === 0 ? (
              <tr>
                <td colSpan={visibleKeys.length} style={{ textAlign: 'center', color: '#b91c1c', padding: 24, fontSize: 16 }}>
                  គ្មានទិន្នន័យ
                </td>
              </tr>
            ) : (
              derived.rows.map((row, idx) => {
                // Highlight if leaveCount >= 4 and leaveType does not include 'បេសកកម្ម' or 'មាតុភាព'
                const leaveCount = Number(row.leaveCount) || 0;
                const leaveType = (row.leaveType || '').toString();
                const highlight = leaveCount >= 4 &&
                  !leaveType.includes('បេសកកម្ម') &&
                  !leaveType.includes('មាតុភាព');
                return (
                  <tr
                    key={idx}
                    style={{
                      background: highlight
                        ? '#FFF3CD' // yellow highlight
                        : (idx % 2 === 0 ? '#f9fafb' : '#fff'),
                      minHeight: rowHeight,
                      height: 'auto'
                    }}
                  >
                    {visibleKeys.map((k) => {
                      const cell = renderCell(k, row);
                      return (
                        <td
                          key={k}
                          style={{
                            ...tdBase,
                            ...(cell.style || {}),
                            width: getColWidth(k),
                            textAlign: cell.style?.textAlign || columnMeta[k]?.align || 'center'
                          }}
                        >
                          {cell.value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

        </table>

        <div style={{ marginTop: 10, fontSize: 12, color: '#313030' }}>
          សរុប: <strong>{toKhmerDigitsSumDay(derived.total)}</strong> នាក់ ( ប្រុស: <strong>{toKhmerDigitsSumDay(derived.male)}</strong> នាក់ — ស្រី: <strong>{toKhmerDigitsSumDay(derived.female)}</strong> នាក់ )
        </div>

        {(() => {
          const dept = selectedDept || '';
          let sigs = [];

          if (dept.includes('ថ្នាក់ដឹកនាំ')) {
            sigs = [
              { text: 'បានឃើញ', title: 'នាយមន្ទីរពេទ្យ' }
            ];
          } else if (dept.includes('ការិយាល័យរដ្ឋបាល និងបុគ្គលិក')) {
            sigs = [
              { text: '', title: '' },
              { text: 'បានឃើញ និងពិនិត្យត្រឹមត្រូវ', title: 'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក' }
            ];
          } else if (dept.includes('ហិរញ្ញវត្ថុ')) {
            sigs = [
              { text: 'បានឃើញ និងពិនិត្យត្រឹមត្រូវ', title: 'ប្រធានការិយាល័យហិរញ្ញវត្ថុ' }
            ];
          } else if (dept.includes('បច្ចេកទេស')) {
            sigs = [
              { text: 'បានឃើញ និងពិនិត្យត្រឹមត្រូវ', title: 'ប្រធានការិយាល័យបច្ចេកទេស' }
            ];
          } else if (dept.startsWith('មណ្ឌល') || dept.startsWith('មជ្ឈមណ្ឌល')) {
            sigs = [
              { text: 'បានឃើញ និងពិនិត្យត្រឹមត្រូវ', title: 'នាយមណ្ឌល' },
              { text: '', title: 'នាយសាល' }
            ];
          } else if (dept.startsWith('ផ្នែក')) {
            sigs = [
              { text: 'បានឃើញ និងពិនិត្យត្រឹមត្រូវ', title: 'នាយផ្នែក' },
              { text: '', title: 'នាយសាល' }
            ];
          } else {
            let rightTitle = 'នាយផ្នែក';
            sigs = [
              { text: 'បានឃើញ', title: 'នាយករងមន្ទីរពេទ្យ' },
              { text: 'បានឃើញ និងពិនិត្យត្រឹមត្រូវ', title: 'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក' },
              { text: '', title: rightTitle }
            ];
          }

          return (
            <div style={{ display: 'flex', justifyContent: sigs.length === 1 ? 'flex-end' : 'space-between', marginTop: 10, paddingTop: 10, padding: sigs.length === 1 ? '0 120px 0 20px' : (dept.includes('ការិយាល័យរដ្ឋបាល និងបុគ្គលិក') ? '0 100px 0 100px' : '0 20px') }}>
              {sigs.map((sig, idx) => (
                <div key={idx} style={{
                  textAlign: 'center',
                  paddingRight: (idx === 2 && sigs.length === 3) ? 65 : (idx === 1 && sigs.length === 2 && !dept.includes('ការិយាល័យរដ្ឋបាល') ? 110 : 0),
                  paddingLeft: (idx === 0 && sigs.length === 3) ? 35 : (idx === 0 && sigs.length === 2 && !dept.includes('ការិយាល័យរដ្ឋបាល') ? 110 : 0)
                }}>
                  {sig.text ? <div style={{ fontSize: 11 }}>{sig.text}</div> : <div style={{ height: 16 }} />}
                  <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: 11, marginTop: 5 }}>{sig.title}</div>
                  <div style={{ marginTop: 20, fontSize: 10 }}></div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
