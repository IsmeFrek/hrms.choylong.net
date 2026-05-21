import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function buildPrintStyle(orientation) {
  const o = (orientation === 'landscape') ? 'landscape' : 'portrait';
  const contentWidth = o === 'landscape' ? '277mm' : '190mm';
  return `
@media print {
  @page {
    size: A4 ${o};
    margin: 12mm;
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
    background: white !important;
    page-break-after: avoid;
    max-width: ${contentWidth};
  }
  body * {
    visibility: hidden;
  }
  #attendance-print-content, #attendance-print-content * {
    visibility: visible;
  }
  #attendance-print-content {
    position: static;
  }

  #attendance-print-content h1 { font-size: 18px !important; }
  #attendance-print-content p { font-size: 14px !important; }
  #attendance-print-content table { table-layout: fixed; }
}
`;
}
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

function parseWorkTimeToMinutes(v) {
  if (v === null || typeof v === 'undefined' || v === '') return 0;
  if (typeof v === 'number' && Number.isFinite(v)) {
    // If a numeric is passed, assume it's already minutes when >= 24, else treat as hours.
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

function fmtShortDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return String(d);
  } catch { return String(d); }
}

function fmtGenderShort(g) {
  const v = (g || '').toString().trim().toLowerCase();
  if (!v) return '';
  if (v === 'male' || v === 'm' || v === 'ប្រុស') return 'ប';
  if (v === 'female' || v === 'f' || v === 'ស្រី') return 'ស';
  return g;
}

export default function AttendanceMonthlyReportPage() {
  // Inject print style on mount
  useEffect(() => {
    let style = document.getElementById('attendance-print-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'attendance-print-style';
      document.head.appendChild(style);
    }

    return () => {
      if (style && style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);

  const [printOrientation, setPrintOrientation] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceMonthlyReportPrintOrientation');
      if (v === 'landscape' || v === 'portrait') return v;
    } catch { void 0; }
    return 'portrait';
  });

  useEffect(() => {
    try { localStorage.setItem('attendanceMonthlyReportPrintOrientation', printOrientation); } catch { void 0; }
    const style = document.getElementById('attendance-print-style');
    if (style) style.innerHTML = buildPrintStyle(printOrientation);
  }, [printOrientation]);

  const printCss = useMemo(() => buildPrintStyle(printOrientation), [printOrientation]);
  const perms = usePermission();
  const navigate = useNavigate();
  const [attendanceData, setAttendanceData] = useState([]);
  const [q, setQ] = useState('');
  // For department/position selection
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);
  // Date range state
  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10); // yyyy-mm-dd
  const [fromDate, setFromDate] = useState(defaultDate);
  const [toDate, setToDate] = useState(defaultDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowHeight, setRowHeight] = useState(28);
  const [showColsMenu, setShowColsMenu] = useState(false);
  const printRef = useRef();
  const fileInputRef = useRef();

  const mergeText = (a, b) => {
    const left = (a || '').toString().trim();
    const right = (b || '').toString().trim();
    if (!left) return right;
    if (!right) return left;
    if (left === right) return left;
    if (left.includes(right)) return left;
    return `${left}; ${right}`;
  };

  // Persist row height
  useEffect(() => {
    try {
      const rh = JSON.parse(localStorage.getItem('attendanceMonthlyReportRowHeight') || 'null');
      if (typeof rh === 'number' && Number.isFinite(rh)) setRowHeight(rh);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('attendanceMonthlyReportRowHeight', JSON.stringify(rowHeight));
    } catch {
      // ignore
    }
  }, [rowHeight]);

  const columnMeta = useMemo(() => ({
    index: { label: 'ល.រ', width: 30, align: 'center', header: 'ល.រ' },
    name: { label: 'គោត្តនាម និងនាម', width: 100, align: 'left', header: 'គោត្តនាម និងនាម' },
    gender: { label: 'ភេទ', width: 30, align: 'center', header: 'ភេទ' },
    position: { label: 'តួនាទី', width: 120, align: 'left', header: 'តួនាទី' },
    dayWorkCount: { label: 'ចំនួនថ្ងៃសរុប', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ថ្ងៃសរុប</div></>) },
    attendanceCount: { label: 'ចំនួនវត្តមាន', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>វត្តមាន</div></>) },
    leaveCount: { label: 'ចំនួនច្បាប់', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ច្បាប់</div></>) },
    leaveType: { label: 'ប្រភេទច្បាប់ឈប់សម្រាក', width: 90, align: 'left', header: (<><div>ប្រភេទច្បាប់</div><div>ឈប់សម្រាក</div></>) },
    A: { label: 'ចំនួនអត់ច្បាប់', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>អត់ច្បាប់</div></>) },
    workTime: { label: 'ចំនួនម៉ោងសរុប', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ម៉ោងសរុប</div></>) },
    lateEarly: { label: 'ចំនួនចូលយឺត/ចេញមុន', width: 50, align: 'center', header: (<><div>ចំនួនចូលយឺត</div><div>ចេញមុន/3</div></>) },
    plech: { label: 'ចំនួនភ្លេចស្កេន', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ភ្លេចស្កេន/3</div></>) },
    totalAbsent: { label: 'សរុបអវត្តមាន', width: 50, align: 'center', header: (<><div>សរុប</div><div>អវត្តមាន</div></>) },
    percentage: { label: '%', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>%</div></>) },
    absentToDeduct: { label: 'អវត្តមានត្រូវកាត់', width: 50, align: 'center', header: (<><div>ចំនួនអវត្តមាន</div><div>ត្រូវកាត់</div></>) },
    other: { label: 'ផ្សេងៗ', width: 80, align: 'left', header: (<><div>ផ្សេងៗ</div></>) },
    totalLeaveComment: { label: 'មតិ', width: 80, align: 'left', header: (<><div>មតិរបស់ការិយាល័យ/ផ្នែក</div><div>លើអវត្តមានបុគ្គលិក ផ្សេងៗ</div></>) },
  }), []);

  const defaultCols = useMemo(() => ([
    'index', 'name', 'gender', 'position', 'dayWorkCount', 'attendanceCount', 'leaveCount', 'leaveType', 'A', 'workTime',
    'lateEarly', 'plech', 'totalAbsent', 'percentage', 'absentToDeduct', 'other', 'totalLeaveComment'
  ]), []);

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceMonthlyReportVisibleCols');
      if (v) return JSON.parse(v);
    } catch { void 0; }
    return Object.fromEntries(defaultCols.map((k) => [k, true]));
  });

  const [colOrder, setColOrder] = useState(() => {
    try {
      const v = localStorage.getItem('attendanceMonthlyReportColOrder');
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
      const v = localStorage.getItem('attendanceMonthlyReportColWidths');
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
    try { localStorage.setItem('attendanceMonthlyReportColWidths', JSON.stringify(colWidths)); } catch { void 0; }
  }, [colWidths]);

  useEffect(() => {
    try { localStorage.setItem('attendanceMonthlyReportVisibleCols', JSON.stringify(visibleCols)); } catch { void 0; }
  }, [visibleCols]);

  useEffect(() => {
    try { localStorage.setItem('attendanceMonthlyReportColOrder', JSON.stringify(colOrder)); } catch { void 0; }
  }, [colOrder]);

  const toggleCol = (k) => {
    setVisibleCols((s) => ({ ...s, [k]: !(s?.[k] ?? true) }));
  };

  const resetColumns = () => {
    setColOrder(defaultCols);
    setVisibleCols(Object.fromEntries(defaultCols.map((k) => [k, true])));
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

  // Load departments/positions for dropdown
  useEffect(() => {
    let mounted = true;
    const loadDepts = async () => {
      try {
        const res = await api.get('/employees/meta/departments');
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          setDepartments(res.data.filter(Boolean));
          return;
        }
      } catch {
        // fall through
      }

      try {
        const res = await api.get('/departments');
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const names = list
          .map((d) => (d?.Department_Kh || d?.Department_En || d?.name || d?.title || '').toString().trim())
          .filter(Boolean);
        setDepartments(names);
      } catch {
        if (mounted) setDepartments([]);
      }
    };
    loadDepts();
    return () => {
      mounted = false;
    };
  }, []);

  // Load attendance data for day range
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewAttendance || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true);
      setError('');
      try {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error('Invalid date range');

        // Fetch in parallel: HR list, day-data range (attendance metrics), leave requests
        const [hrRes, dayRangeRes, leaveRes] = await Promise.all([
          api.get('/hr').catch(() => ({ data: [] })),
          api.get('/attendance/day-data', { params: { startDate: fromDate, endDate: toDate } }).catch(() => ({ data: [] })),
          api.get('/leave-requests', { params: { from: fromDate, to: toDate } }).catch(() => ({ data: [] }))
        ]);

        const hrList = Array.isArray(hrRes.data) ? hrRes.data : [];
        const hrByStaffId = new Map();
        const hrSortKeyByStaffId = new Map();
        hrList.forEach((h, idx) => {
          const sid = (h.staffId || h.no || '').toString().trim();
          if (!sid) return;
          hrByStaffId.set(sid, h);
          const noNum = Number(h?.no);
          hrSortKeyByStaffId.set(sid, Number.isFinite(noNum) && noNum > 0 ? noNum : (1_000_000 + idx));
        });

        const dayRangeRows = Array.isArray(dayRangeRes.data) ? dayRangeRes.data : [];
        const leaveList = (Array.isArray(leaveRes.data) ? leaveRes.data : [])
          .filter(lv => (lv.status || '').toLowerCase() === 'approved');

        // Build leave map: staffId_YYYY-MM-DD → leaveRecord
        const leaveTypeMap = {}; // staffId → { type: count }
        const leaveCountMap = {}; // staffId → count
        leaveList.forEach(lv => {
          const sid = (lv.staffId || lv.no || lv.employeeId?.staffId || '').toString().trim();
          if (!sid) return;
          const lvStart = new Date(lv.startDate || lv.from || lv.fromDate);
          const lvEnd = new Date(lv.endDate || lv.to || lv.toDate);
          if (isNaN(lvStart) || isNaN(lvEnd)) return;
          const type = (lv.type || lv.leaveType || '').toString().trim();
          leaveCountMap[sid] = (leaveCountMap[sid] || 0) + 1;
          if (!leaveTypeMap[sid]) leaveTypeMap[sid] = {};
          leaveTypeMap[sid][type] = (leaveTypeMap[sid][type] || 0) + 1;
        });

        // Build aggregated attendance map from day-data range
        const agg = {};
        dayRangeRows.forEach(rec => {
          const sid = (rec.staffId || '').toString().trim();
          if (!sid) return;
          const hr = hrByStaffId.get(sid);

          agg[sid] = {
            staffId: sid,
            hrSortKey: hrSortKeyByStaffId.get(sid) ?? 1_000_000_000,
            isCivilServant: Boolean(hr && !hr?.isRetiredThenContract && (
              (hr?.civilServantId || '').toString().trim() ||
              (hr?.officerId || '').toString().trim() ||
              (hr?.dateJoinedGov || '').toString().trim()
            )),
            khmerName: rec.name || hr?.khmerName || hr?.name || '',
            name: rec.name || hr?.khmerName || hr?.name || '',
            gender: hr?.gender || '',
            position: hr?.position || '',
            department: rec.department || hr?.Department_Kh || hr?.department || '',
            dayWorkCount: 0,
            attendanceCount: Number(rec.attendanceCount || 0),
            absentCount: Number(rec.absentCount || 0),
            leaveCount: Number(rec.leaveCount || 0),
            A: Number(rec.absentCount || 0), // Mapping backend absentCount to frontend 'A'
            leaveType: rec.leaveType || '',
            other: rec.leaveReason || '',
            totalLeaveComment: '',
            plech: Number(rec.plech || 0),
            checkinLateCount: Number(rec.checkinLateCount || 0),
            checkoutEarlyCount: Number(rec.checkoutEarlyCount || 0),
            workTime: rec.workTime > 0 ? formatMinutesAsHM(rec.workTime) : ''
          };

          // dayWorkCount = attendance + leave + absent
          agg[sid].dayWorkCount = agg[sid].attendanceCount + agg[sid].leaveCount + agg[sid].absentCount;
        });

        // Include staff who have NO data at all from HR list (purely absent staff)
        hrList.forEach((h, idx) => {
          const sid = (h.staffId || h.no || '').toString().trim();
          if (!sid || agg[sid]) return;
          agg[sid] = {
            staffId: sid,
            hrSortKey: hrSortKeyByStaffId.get(sid) ?? 1_000_000_000,
            isCivilServant: Boolean(h && !h?.isRetiredThenContract && (
              (h?.civilServantId || '').toString().trim() ||
              (h?.officerId || '').toString().trim() ||
              (h?.dateJoinedGov || '').toString().trim()
            )),
            khmerName: h.khmerName || h.name || '',
            name: h.khmerName || h.name || '',
            gender: h.gender || '',
            position: h.position || '',
            department: h.Department_Kh || h.department || '',
            dayWorkCount: 0, attendanceCount: 0, absentCount: 0,
            leaveCount: 0, A: 0, leaveType: '', other: '',
            totalLeaveComment: '', plech: 0,
            checkinLateCount: 0, checkoutEarlyCount: 0, workTime: ''
          };
        });

        const data = Object.values(agg);
        if (!mounted) return;
        setAttendanceData(data);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
        setAttendanceData([]);
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
        // Filter by department/position if selected
        if (selectedDeptNorm) {
          const dept = (record.department || record.Department_Kh || '').toString().trim();
          if (dept !== selectedDeptNorm) return false;
        }
        if (!term) return true;
        const name = (record.khmerName || record.name || '').toString().toLowerCase();
        const staffId = (record.staffId || record.no || '').toString().toLowerCase();
        const position = (record.position || '').toString().toLowerCase();
        const dept = (record.department || '').toString().toLowerCase();
        return name.includes(term) || staffId.includes(term) || position.includes(term) || dept.includes(term);
      })
      .sort((a, b) => {
        const ka = Number(a?.hrSortKey);
        const kb = Number(b?.hrSortKey);
        const aKey = Number.isFinite(ka) ? ka : 1_000_000_000;
        const bKey = Number.isFinite(kb) ? kb : 1_000_000_000;
        if (aKey !== bKey) return aKey - bKey;
        const aSid = (a?.staffId || a?.no || '').toString();
        const bSid = (b?.staffId || b?.no || '').toString();
        return aSid.localeCompare(bSid);
      })
      .map((record, idx) => {
        // Map fields from /attendance/monthly-data
        const dayWorkCount = Number(record.dayWorkCount) || 0;
        const attendanceCount = Number(record.attendanceCount) || 0;
        const leaveCount = Number(record.leaveCount) || 0;
        const A = Number(record.A) || 0;
        const workTime = record.workTime || '';
        const checkinLateCount = Number(record.checkinLateCount) || 0;
        const checkoutEarlyCount = Number(record.checkoutEarlyCount) || 0;
        const plech = Number(record.plech ?? record.Plech) || 0;
        const totalAbsent = leaveCount + A;
        const percentage = dayWorkCount > 0 ? Math.round((attendanceCount / dayWorkCount) * 100) : 0;
        const absentToDeduct = A;
        const leaveType = record.leaveType || '';
        const other = record.other || '';
        const totalLeaveComment = record.totalLeaveComment || '';
        return {
          ...record,
          index: idx + 1,
          name: record.khmerName || record.name || '',
          department: record.department || record.Department_Kh || '',
          genderShort: fmtGenderShort(record.gender),
          isCivilServant: Boolean(record.isCivilServant),
          dayWorkCount,
          attendanceCount,
          leaveCount,
          leaveType,
          A,
          workTime,
          lateEarly: checkinLateCount + checkoutEarlyCount,
          plech,
          totalAbsent,
          percentage,
          absentToDeduct,
          other,
          totalLeaveComment,
        };
      });

    const maleCount = rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length;
    const femaleCount = rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length;

    return { rows, male: maleCount, female: femaleCount, total: rows.length };
  }, [attendanceData, q, selectedDept]);

  const derivedAllDepts = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();

    const rows = (attendanceData || [])
      .filter(record => {
        if (!term) return true;
        const name = (record.khmerName || record.name || '').toString().toLowerCase();
        const staffId = (record.staffId || record.no || '').toString().toLowerCase();
        const position = (record.position || '').toString().toLowerCase();
        const dept = (record.department || '').toString().toLowerCase();
        return name.includes(term) || staffId.includes(term) || position.includes(term) || dept.includes(term);
      })
      .sort((a, b) => {
        const ka = Number(a?.hrSortKey);
        const kb = Number(b?.hrSortKey);
        const aKey = Number.isFinite(ka) ? ka : 1_000_000_000;
        const bKey = Number.isFinite(kb) ? kb : 1_000_000_000;
        if (aKey !== bKey) return aKey - bKey;
        const aSid = (a?.staffId || a?.no || '').toString();
        const bSid = (b?.staffId || b?.no || '').toString();
        return aSid.localeCompare(bSid);
      })
      .map((record, idx) => {
        const dayWorkCount = Number(record.dayWorkCount) || 0;
        const attendanceCount = Number(record.attendanceCount) || 0;
        const leaveCount = Number(record.leaveCount) || 0;
        const A = Number(record.A) || 0;
        const workTime = record.workTime || '';
        const checkinLateCount = Number(record.checkinLateCount) || 0;
        const checkoutEarlyCount = Number(record.checkoutEarlyCount) || 0;
        const plech = Number(record.plech ?? record.Plech) || 0;
        const totalAbsent = leaveCount + A;
        const percentage = dayWorkCount > 0 ? Math.round((attendanceCount / dayWorkCount) * 100) : 0;
        const absentToDeduct = A;
        const leaveType = record.leaveType || '';
        const other = record.other || '';
        const totalLeaveComment = record.totalLeaveComment || '';
        return {
          ...record,
          index: idx + 1,
          name: record.khmerName || record.name || '',
          department: record.department || record.Department_Kh || '',
          genderShort: fmtGenderShort(record.gender),
          isCivilServant: Boolean(record.isCivilServant),
          dayWorkCount,
          attendanceCount,
          leaveCount,
          leaveType,
          A,
          workTime,
          lateEarly: checkinLateCount + checkoutEarlyCount,
          plech,
          totalAbsent,
          percentage,
          absentToDeduct,
          other,
          totalLeaveComment,
        };
      });

    const maleCount = rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length;
    const femaleCount = rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length;
    return { rows, male: maleCount, female: femaleCount, total: rows.length };
  }, [attendanceData, q]);

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

  const handleExportExcel = () => {
    const dt = new Date(fromDate);
    const year = !isNaN(dt.getTime()) ? String(dt.getFullYear()) : '';
    const month = !isNaN(dt.getTime()) ? String(dt.getMonth() + 1).padStart(2, '0') : '';

    const visibleKeys = (colOrder || [])
      .filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));

    const header = visibleKeys.map((k) => columnMeta[k]?.label || k);

    const getCellValue = (k, row) => {
      switch (k) {
        case 'index': return row.index;
        case 'name': return row.name;
        case 'gender': return row.genderShort || row.gender;
        case 'position': return row.position;
        case 'dayWorkCount': return row.dayWorkCount;
        case 'attendanceCount': return row.attendanceCount;
        case 'leaveCount': return row.leaveCount;
        case 'leaveType': return row.leaveType;
        case 'A': return row.A;
        case 'workTime': return row.workTime;
        case 'lateEarly': return row.lateEarly;
        case 'plech': return row.plech;
        case 'totalAbsent': return row.totalAbsent;
        case 'percentage': return row.percentage;
        case 'absentToDeduct': return row.absentToDeduct;
        case 'other': return row.other;
        case 'totalLeaveComment': return row.totalLeaveComment;
        default: return row?.[k];
      }
    };

    const data = derived.rows.map((row) => visibleKeys.map((k) => getCellValue(k, row)));

    const summary = [
      [],
      ['សរុប', `${derived.total} នាក់`, `(ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់)`]
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, ...summary]);
    ws['!cols'] = visibleKeys.map((k) => {
      const w = Number(colWidths?.[k]) || columnMeta[k]?.width;
      const wch = typeof w === 'number' ? Math.max(6, Math.round(w / 3)) : 10;
      return { wch };
    });

    const wb = XLSX.utils.book_new();
    const sheetName = `វត្តមាន_${month}_${year}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fileSafe = year && month ? `AttendanceMonthly_${year}_${month}.xlsx` : `AttendanceMonthly_${fromDate}_${toDate}.xlsx`;
    XLSX.writeFile(wb, fileSafe);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    // Copy the full report page content (header, controls, main, footer)
    // Only print the content inside printRef (which already includes header/footer)
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
          <title>AttendanceMonthly_ByDepartment</title>
          <style>
            ${printCss}
            body { font-family: "Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif; margin: 0; }
            ${extraCss}
          </style>
        </head>
        <body>
          <div id="dept-root" style="padding: 12mm;"></div>
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
        border: '1px solid #e5e7eb',
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
        padding: '24px',
        margin: '0 auto 18px',
        maxWidth: (printOrientation === 'landscape') ? '297mm' : '210mm',
        minHeight: (printOrientation === 'landscape') ? '210mm' : '297mm'
      });
      page.className = 'dept-page';

      const header = makeEl('div', { marginBottom: '16px', borderBottom: '2px solid #ddd', paddingBottom: '10px' });
      header.appendChild(makeText('h1', 'ព្រះរាជាណាចក្រកម្ពុជា', { margin: '0', fontSize: '20px', fontWeight: '400', textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }));
      header.appendChild(makeText('h1', 'ជាតិ សាសនា ព្រះមហាក្សត្រ', { margin: '0', fontSize: '20px', fontWeight: '400', textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }));

      const imgDiv = makeEl('div', { textAlign: 'center', margin: '2px 0' });
      const img = w.document.createElement('img');
      img.src = headerBg;
      img.style.width = '250px';
      img.style.height = 'auto';
      imgDiv.appendChild(img);
      header.appendChild(imgDiv);
      header.appendChild(makeText('h1', 'ក្រសួងសុខាភិបាល', { margin: '0', fontSize: '18px', fontWeight: '400', textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }));
      header.appendChild(makeText('h1', 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត', { margin: '0', fontSize: '18px', fontWeight: '400', textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }));
      header.appendChild(makeText('h1', 'វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការ និងមន្រ្តីកិច្ចសន្យា', { margin: '0', fontSize: '20px', fontWeight: '700', textAlign: 'center' }));
      header.appendChild(makeText('div', `ផ្នែក: ${deptName}`, { marginTop: '6px', fontSize: '14px', fontWeight: '700', textAlign: 'center' }));
      header.appendChild(makeText('div', `ចាប់ពី ${fmtKhmerLongDate(fromDate)} ដល់ ថ្ងៃទី: ${fmtKhmerLongDate(toDate)}`, { marginTop: '4px', fontSize: '14px', textAlign: 'center', color: '#141313' }));
      page.appendChild(header);

      const male = rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length;
      const female = rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length;
      page.appendChild(makeText('div', `សរុប: ${toKhmerDigits(rows.length)} នាក់ ( ប្រុស: ${toKhmerDigits(male)} — ស្រី: ${toKhmerDigits(female)} )`, { marginBottom: '10px', fontSize: '12px', color: '#313030' }));

      const table = makeEl('table');
      const thead = makeEl('thead');
      const trh = makeEl('tr');
      visibleKeysNow.forEach((k) => {
        const th = makeEl('th', { textAlign: 'center', fontSize: '12px', width: `${Number(colWidths?.[k]) || columnMeta[k]?.width || 80}px` });
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
            fontSize: `${Math.max(10, Math.round(rowHeight * 0.46))}px`,
            verticalAlign: 'middle',
            textAlign: cell?.style?.textAlign || columnMeta[k]?.align || 'center',
            width: `${Number(colWidths?.[k]) || columnMeta[k]?.width || 80}px`
          });
          td.textContent = (cell?.value ?? '').toString();
          tbody.appendChild(tr).appendChild(td);
        });
        table.appendChild(tbody);
      });
      page.appendChild(table);

      const footer = makeEl('div', { marginTop: '20px', borderTop: '2px solid #8f8b8b', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' });
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

  const rowFontSize = Math.max(10, Math.round(rowHeight * 0.46));
  const bodyPadY = Math.max(1, Math.min(12, Math.round(rowHeight / 6)));
  const tdBase = {
    border: '1px solid #8f8b8b',
    padding: `${bodyPadY}px 6px`,
    verticalAlign: 'middle',
    fontSize: rowFontSize
  };

  const visibleKeys = (colOrder || [])
    .filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));

  const thBase = {
    border: '1px solid #8f8b8b',
    padding: 6,
    textAlign: 'center',
    fontSize: 12,
    userSelect: 'none'
  };

  const getColWidth = (k) => {
    const w = Number(colWidths?.[k]);
    if (Number.isFinite(w) && w > 0) return w;
    return columnMeta[k]?.width;
  };

  const renderCell = (key, row) => {
    const maybeHideZero = (v) => {
      if (v === null || typeof v === 'undefined') return '';
      const n = Number(v);
      if (Number.isFinite(n) && n === 0) return '';
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
      case 'name':
        return { value: row.name, style: { textAlign: 'left', width: columnMeta.name.width } };
      case 'gender':
        return { value: (row.genderShort || row.gender), style: { textAlign: 'center', width: columnMeta.gender.width } };
      case 'position':
        return { value: row.position, style: { textAlign: 'left', width: columnMeta.position.width, fontSize: Math.max(9, rowFontSize - 1) } };
      case 'dayWorkCount':
        return { value: maybeHideZero(row.dayWorkCount), style: { textAlign: 'center' } };
      case 'attendanceCount':
        return { value: maybeHideZero(row.attendanceCount), style: { textAlign: 'center' } };
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
      case 'totalAbsent':
        return { value: maybeHideZero(row.totalAbsent), style: { textAlign: 'center' } };
      case 'percentage':
        return { value: (Number(row.percentage) && Number(row.percentage) > 0) ? `${row.percentage}%` : '', style: { textAlign: 'center' } };
      case 'absentToDeduct':
        return { value: maybeHideZero(row.absentToDeduct), style: { textAlign: 'center' } };
      case 'other':
        return { value: row.other || '', style: { textAlign: 'left', fontSize: Math.max(8, rowFontSize - 2) } };
      case 'totalLeaveComment':
        return { value: row.totalLeaveComment, style: { fontSize: Math.max(8, rowFontSize - 2) } };
      default:
        return { value: row?.[key], style: {} };
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: '"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif' }}>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ marginRight: 8 }}>ចាប់ពីថ្ងៃ:</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, marginRight: 8 }}
          />
        </div>
        <div>
          <label style={{ marginRight: 8 }}>ដល់ថ្ងៃ:</label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={e => setToDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
        <div>
          <label style={{ marginRight: 8 }}>ទី:</label>
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, minWidth: 120, marginRight: 8 }}>
            <option value="">-- ទាំងអស់ --</option>
            {departments.map((d, i) => (
              <option key={`${String(d)}-${i}`} value={String(d)}>
                {String(d)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#111' }}>Row height</label>
          <input
            type="range"
            min={10}
            max={60}
            value={rowHeight}
            onChange={(e) => setRowHeight(Number(e.target.value))}
          />
          <span style={{ fontSize: 12, color: '#111', minWidth: 40, textAlign: 'right', fontWeight: 700 }}>{rowFontSize}px</span>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowColsMenu(v => !v)}
            style={{ padding: '6px 12px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
          >Columns</button>
          {showColsMenu && (
            <div style={{ position: 'absolute', right: 0, top: 38, background: '#fff', border: '1px solid #ddd', padding: 10, minWidth: 220, boxShadow: '0 2px 10px rgba(0,0,0,0.15)', zIndex: 100 }}>
              {defaultCols.map((k) => (
                <label key={k} style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', marginBottom: 6 }}>
                  <input type="checkbox" checked={!!(visibleCols?.[k] ?? true)} onChange={() => toggleCol(k)} style={{ marginRight: 8 }} />
                  {columnMeta[k]?.label || k}
                </label>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={resetColumns} style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, background: '#fff' }}>Reset</button>
                <button type="button" onClick={resetWidths} style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, background: '#fff' }}>Reset width</button>
              </div>
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <button type="button" onClick={() => setShowColsMenu(false)} style={{ padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, background: '#f5f5f5' }}>Close</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>Tip: អាច drag header ដើម្បីរៀបជួរឈរ</div>
              <div style={{ fontSize: 11, color: '#666' }}>Tip: អាចទាញបន្ទាត់ខាងស្តាំ header ដើម្បីកែទំហំ Column</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#111' }}>បោះពុម្ព</label>
          <select
            value={printOrientation}
            onChange={(e) => setPrintOrientation(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="ស្វែងរក (ឈ្មោះ, លេខកាត, តួនាទី, ផ្នែក)"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
        <button onClick={() => setQ('')} style={{ padding: '6px 12px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>សម្អាត់</button>
        <button onClick={() => navigate(`/attendance-daily-report?date=${fromDate}`)} style={{ padding: '6px 12px', background: '#6b21a8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>របាយការណ៍ជាថ្ងៃ</button>
        <button onClick={handleExportExcel} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>នាំចេញ Excel</button>
        <button onClick={handlePrint} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>បោះពុម្ព</button>
        <button onClick={handlePrintByDepartment} style={{ padding: '6px 12px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
          PDF តាមផ្នែក
        </button>
      </div>

      {/* Main Content + Header for Print */}
      <div
        ref={printRef}
        id="attendance-print-content"
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
        {/* Header */}
        <div style={{ marginBottom: 20, borderBottom: '2px solid #ddd', paddingBottom: 10 }}>

          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 400, textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }}>ព្រះរាជាណាចក្រកម្ពុជា</h1>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 400, textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</h1>
          <div style={{ textAlign: 'center', margin: '2px 0' }}>
            <img src={headerBg} alt="header" style={{ width: '250px', height: 'auto' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>ក្រសួងសុខាភិបាល</h1>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</h1>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, textAlign: 'center' }}>វត្តមានប្រចាំខែរបស់មន្រ្តីរាជការ និងមន្រ្តីកិច្ចសន្យា </h1>
          <p style={{ margin: 5, textAlign: 'center', fontSize: 16, color: '#111111' }}>
            ចាប់ពី {fmtKhmerLongDate(fromDate)} ដល់ ថ្ងៃទី: {fmtKhmerLongDate(toDate)}
          </p>
        </div>
        <div style={{ marginBottom: 10, fontSize: 12, color: '#313030' }}>
          សរុប: <strong>{toKhmerDigits(derived.total)}</strong> នាក់ ( ប្រុស: <strong>{toKhmerDigits(derived.male)}</strong> នាក់ — ស្រី: <strong>{toKhmerDigits(derived.female)}</strong> នាក់ )
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
                  title="Drag to reorder columns"
                  style={{
                    ...thBase,
                    width: getColWidth(k),
                    cursor: 'move',
                    position: 'relative'
                  }}
                >
                  {columnMeta[k]?.header ?? (columnMeta[k]?.label || k)}
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
            {derived.rows.map((row, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#f9fafb' : '#fff', height: rowHeight }}>
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
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: 20, borderTop: '2px solid #8f8b8b', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0 }}>ផលប័ត្រមន្ត្រីឃ្មាំងរដ្ឋ</p>
            <p style={{ margin: 0 }}>____________________</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0 }}>ប្រសាសន៍</p>
            <p style={{ margin: 0 }}>____________________</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0 }}>សម្ព័ន្ធបុគ្គលិក</p>
            <p style={{ margin: 0 }}>____________________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
