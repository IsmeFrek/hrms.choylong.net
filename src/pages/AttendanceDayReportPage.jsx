import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// toast removed for troubleshooting


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
  #attendance1-print-content {
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
  #attendance1-print-content, #attendance1-print-content * {
    visibility: visible;
  }
  #attendance1-print-content {
    position: static;
  }

  #attendance1-print-content h1 { font-size: 18px !important; }
  #attendance1-print-content p { font-size: 14px !important; }
  #attendance1-print-content table { table-layout: fixed; }
}
`;
}
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

// Lucide icons removed for troubleshooting undefined component error

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

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function fmtKhmerLongDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const dd = String(dt.getDate()).padStart(1, '0');
  const mmName = khMonths[dt.getMonth()];
  const yyyy = dt.getFullYear();
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

function parseHM(s) {
  if (!s) return null;
  const str = String(s).trim();
  // Try AM/PM: e.g. "07:30 AM" or "05:18 PM"
  const ampm = str.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
  if (ampm) {
    let hh = parseInt(ampm[1], 10);
    const mm = parseInt(ampm[2], 10);
    const mer = ampm[3].toUpperCase();
    if (mer === 'PM' && hh < 12) hh += 12;
    if (mer === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
  }
  // Try HH:mm (24h) - match start of string to avoid matching substrings in noisy text
  const m = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

function fmtGenderShort(g) {
  const v = (g || '').toString().trim().toLowerCase();
  if (!v) return '';
  if (v === 'male' || v === 'm' || v === 'ប្រុស') return 'ប';
  if (v === 'female' || v === 'f' || v === 'ស្រី') return 'ស';
  return g;
}

function fmtTimeHM(val) {
  if (!val) return '';
  const s = String(val).trim();

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
}

function fmtTimeRange(val) {
  if (!val) return '';
  const s = String(val).trim();
  // Handle range with – or - or to
  const parts = s.split(/[–\-]| to /i);
  if (parts.length === 2) {
    const start = parts[0].trim();
    const end = parts[1].trim();
    if (start && end) {
      return `${fmtTimeHM(start)} – ${fmtTimeHM(end)}`;
    }
  }
  return fmtTimeHM(s);
}

function shortenLeaveType(txt) {
  if (!txt) return '';
  // Normalize: remove all whitespace and ZWSP to handle hidden character variations
  const s = String(txt).replace(/[\s\u200B]/g, '');

  if (s.includes('រយៈពេលខ្លី')) return 'ច្បាប់_រយៈពេលខ្លី';
  if (s.includes('ប្រចាំឆ្នាំ')) return 'ច្បាប់_ប្រចាំឆ្នាំ';
  if (s.includes('ព្យាបាលជំងឺ')) return 'ច្បាប់_ព្យាបាលជំងឺ';
  if (s.includes('កិច្ចការ')) return 'ច្បាប់_កិច្ចការផ្ទាល់ខ្លួន';

  return txt.trim();
}

const timeToDec = (t) => {
  if (!t) return 0;
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h + (min / 60);
};

const getLateMins = (checkin, scheduledTime) => {
  if (!checkin || !scheduledTime || scheduledTime === '—' || scheduledTime.includes('Day Off') || scheduledTime === 'មិនមានម៉ោង') return 0;
  const tCheck = timeToDec(checkin);
  const startStr = scheduledTime.split(/[–\-]| to /i)[0]?.trim();
  const tStart = timeToDec(startStr);
  if (tCheck === 0 || tStart === 0) return 0;
  const diff = (tCheck - tStart) * 60;
  return diff > 15 ? Math.round(diff) : 0; // 15 mins buffer
};

const getEarlyMins = (checkout, scheduledTime) => {
  if (!checkout || !scheduledTime || scheduledTime === '—' || scheduledTime.includes('Day Off') || scheduledTime === 'មិនមានម៉ោង') return 0;
  const tCheck = timeToDec(checkout);
  const endStr = scheduledTime.split(/[–\-]| to /i).pop()?.trim();
  const tEnd = timeToDec(endStr);
  if (tCheck === 0 || tEnd === 0) return 0;
  const diff = (tEnd - tCheck) * 60;
  return diff > 2 ? Math.round(diff) : 0;
};

const isIrregular = (r) => {
  const hasScans = !!(r.checkIn || r.checkOut);
  const sched = (r.scheduledTime || '').toString().trim();
  const noSched = !sched || sched === '—' || sched === '-';

  // 1. Scans but no schedule
  if (hasScans && noSched) return true;

  // 2. Conflict: Marked absent/leave but has scans
  if (hasScans && (r.status === 'absent' || r.status === 'leave')) return true;

  // 3. Time anomaly: check-out before check-in (only for same-day shifts)
  if (r.checkIn && r.checkOut) {
    const ci = timeToDec(r.checkIn);
    const co = timeToDec(r.checkOut);
    if (ci > co) {
      // Check if it's an overnight shift. If NOT overnight, it's irregular.
      const parts = sched.split(/[–\-]| to /i);
      if (parts.length >= 2) {
        const sTime = parts[0]?.trim();
        const eTime = parts[parts.length - 1]?.trim();
        const st = timeToDec(sTime);
        const et = timeToDec(eTime);
        if (et > st) return true; // Scheduled same-day, but scanned overnight? Irregular.
      } else {
        return true; // No clear schedule range to justify CI > CO
      }
    }
  }

  return false;
};

const forgotScan = (r, reportDateStr) => {
  const ci = r.checkIn || '';
  const co = r.checkOut || '';
  // Only mark as forgot if they have a check-in but no check-out
  if (!ci || co) return false;

  // Status exclusions like Page A
  if (r.status === 'absent' || r.status === 'leave' || r.status === 'pending') return false;

  const reportDate = new Date(reportDateStr);
  reportDate.setHours(0, 0, 0, 0);
  const now = new Date();

  let cutoffTime = new Date(reportDate);
  cutoffTime.setHours(17, 30, 0, 0);
  cutoffTime.setTime(cutoffTime.getTime() + 4 * 60 * 60 * 1000);

  if (r.scheduledTime && r.scheduledTime !== '—' && r.scheduledTime !== '-') {
    const parts = r.scheduledTime.split(/[–\-]| to /i);
    if (parts.length >= 2) {
      const startTimeStr = parts[0]?.trim();
      const endTimeStr = parts[parts.length - 1]?.trim();

      if (startTimeStr && endTimeStr) {
        const parseTime = (s) => {
          const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (!m) return null;
          let h = parseInt(m[1]);
          const min = parseInt(m[2]);
          const ampm = m[3] ? m[3].toUpperCase() : null;
          if (ampm === 'PM' && h < 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return h * 60 + min;
        };

        const startTotal = parseTime(startTimeStr);
        const endTotal = parseTime(endTimeStr);

        if (startTotal !== null && endTotal !== null) {
          cutoffTime = new Date(reportDate);
          const eh = Math.floor(endTotal / 60);
          const em = endTotal % 60;
          cutoffTime.setHours(eh, em, 0, 0);

          // Overnight detection like Page A:
          // 1. Start >= End (e.g. 19:00-07:00) 
          // 2. Very short same-day duration (e.g. 07:30-08:00) which are 24.5h guards
          const durationMins = endTotal - startTotal;
          if (endTotal <= startTotal || (durationMins > 0 && durationMins < 180)) {
            cutoffTime.setDate(cutoffTime.getDate() + 1);
          }

          cutoffTime.setTime(cutoffTime.getTime() + 4 * 60 * 60 * 1000);
        }
      }
    }
  }
  return now > cutoffTime;
};

const calculateStatusGroup = (r, reportDateStr) => {
  // 1. Holiday/DayOff and Leave have absolute priority if no scans exist
  const hasScans = !!(r.checkIn || r.checkOut);

  if (!hasScans) {
    if (r.status === 'leave') return 'leave';

    const schedLower = (r.scheduledTime || '').toLowerCase();
    const isDayOff = r.status === 'holiday' ||
      r.status === 'dayoff' ||
      r.status === 'day_off' ||
      schedLower.includes('day off') ||
      schedLower.includes('off') ||
      schedLower.includes('ឈប់');

    if (isDayOff) return 'holiday';

    // Check pending (shift hasn't started)
    if (r.scheduledTime && r.scheduledTime.includes('–')) {
      const startStr = r.scheduledTime.split('–')[0]?.trim();
      const tStart = timeToDec(startStr);
      const now = new Date();
      const reportDate = new Date(reportDateStr).setHours(0, 0, 0, 0);
      const today = new Date().setHours(0, 0, 0, 0);
      if (reportDate >= today) {
        const currentTotal = (now.getHours() + now.getMinutes() / 60);
        if (currentTotal < tStart) return 'pending';
      }
    }
    return 'absent';
  }

  // 2. If they have ANY scan
  if (r.plech === true || r.plech === 1 || forgotScan(r, reportDateStr)) return 'forgot';

  const lateMins = getLateMins(r.checkIn, r.scheduledTime);
  if (lateMins > 0) return 'late';

  const earlyMins = getEarlyMins(r.checkOut, r.scheduledTime);
  if (earlyMins > 0) return 'early';

  return 'present';
};

const DEPT_ORDER_PRIORITY = [
  'ថ្នាក់ដឹកនាំ',
  'ការិយាល័យរដ្ឋបាល និងបុគ្គលិក',
  'ការិយាល័យហិរញ្ញវត្ថុ',
  'ការិយាល័យហិរញ្ញវត្ថុ (សេវា)',
  'ការិយាល័យបច្ចេកទេស',
  'ផ្នែកជំងឺបេះដូង-មនុស្សចាស់',
  'ផ្នែកជំងឺទូទៅទារក និងកុមារ',
  'ផ្នែកវះកាត់ពោះ និងទ្រូង',
  'ផ្នែកវះកាត់បាក់បែកឆ្អឹង និងជំងឺឆ្អឹង',
  'ផ្នែកវះកាត់ប្រព័ន្ធប្រសាទ',
  'ផ្នែកជំងឺ ត្រចៀក ច្រមុះ បំពង់ក',
  'ផ្នែកជំងឺប្រព័ន្ធរំលាយអាហារ',
  'ផ្នែកជំងឺប្រព័ន្ធសរសៃប្រសាទ',
  'ផ្នែកជំងឺមហារីក',
  'ផ្នែកជំងឺសើស្បែក',
  'ផ្នែកថែទាំ',
  'ផ្នែកប្រពោធនកម្ម សល្យសាស្ត្រ',
  'ផ្នែកប្រពោធនកម្មវេជ្ជសាស្ត្រ',
  'ផ្នែកព័ត៌មានវិទ្យា',
  'ផ្នែកពិគ្រោះជំងឺក្រៅ',
  'ផ្នែកមន្ទីរពិសោធន៍ និងអាណាព្យាបាល',
  'ផ្នែករូបភាពវេជ្ជសាស្ត្រ',
  'ផ្នែកវះកាត់តម្រងនោម',
  'ផ្នែកវះកាត់ពោះ និងទ្រូង',
  'ផ្នែកវះកាត់មុខ មាត់ ឆ្អឹងថ្គាម និងជំងឺមាត់ធ្មេញ',
  'ផ្នែកសង្គ្រោះបន្ទាន់',
  'ផ្នែកសន្លប់ និងក្រោយសន្លប់',
  'ផ្នែកសម្ភព និងរោគស្ត្រី',
  'ផ្នែកសល្យាគារ',
  'ផ្នែកសាយភាយ',
  'ផ្នែកសុខភាពផ្លូវចិត្ត និងបំពានគ្រឿងញៀន'
];

function sortDepartments(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const idxA = DEPT_ORDER_PRIORITY.indexOf(a);
    const idxB = DEPT_ORDER_PRIORITY.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b, 'km');
  });
}

export default function AttendancedayReportPage() {
  const [notification, setNotification] = useState(null);
  
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    let style = document.getElementById('attendance1-print-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'attendance1-print-style';
      document.head.appendChild(style);
    }

    return () => {
      if (style && style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);

  const [printOrientation, setPrintOrientation] = useState(() => {
    try {
      const v = localStorage.getItem('attendancedayReportPrintOrientation');
      if (v === 'landscape' || v === 'portrait') return v;
    } catch { void 0; }
    return 'portrait';
  });

  useEffect(() => {
    try { localStorage.setItem('attendancedayReportPrintOrientation', printOrientation); } catch { void 0; }
    const style = document.getElementById('attendance1-print-style');
    if (style) style.innerHTML = buildPrintStyle(printOrientation);
  }, [printOrientation]);

  const printCss = useMemo(() => buildPrintStyle(printOrientation), [printOrientation]);
  const perms = usePermission();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [attendanceData, setAttendanceData] = useState([]);
  const [q, setQ] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedAbsent, setSelectedAbsent] = useState('');
  const [selectedLeaveFilter, setSelectedLeaveFilter] = useState('');
  const [selectedWorkTime, setSelectedWorkTime] = useState('');
  const [selectedLate, setSelectedLate] = useState('');
  const [selectedEarly, setSelectedEarly] = useState('');
  const [personPeriodTotals, setPersonPeriodTotals] = useState({});
  const [showPersonSummary, setShowPersonSummary] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f === 'leave') {
      setSelectedLeaveFilter('any');
    } else if (f === 'absent') {
      setSelectedAbsent('any');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!perms.isAdmin && perms.user?.department) {
      setSelectedDept(perms.user.department);
    }
  }, [perms.isAdmin, perms.user?.department]);
  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(defaultDate);
  const [toDate, setToDate] = useState(defaultDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowHeight, setRowHeight] = useState(24);
  const [showColsMenu, setShowColsMenu] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('attendance-day-report-view-mode') || 'table');
  const [syncing, setSyncing] = useState(false);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [syncSettings, setSyncSettings] = useState({
    sync_times: ['09:35'],
    auto_sync_enabled: true,
    google_sheets_sync_enabled: false,
    google_sheets_sync_times: ['10:00']
  });

  useEffect(() => {
    localStorage.setItem('attendance-day-report-view-mode', viewMode);
  }, [viewMode]);
  const printRef = useRef();
  const fileInputRef = useRef();
  const initialDeptSetRef = useRef(false);

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
      const rh = JSON.parse(localStorage.getItem('attendancedayReportRowHeight') || 'null');
      if (typeof rh === 'number' && Number.isFinite(rh)) setRowHeight(rh);
    } catch {
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('attendancedayReportRowHeight', JSON.stringify(rowHeight));
    } catch { }
  }, [rowHeight]);

  useEffect(() => {
    // Load Sync Settings
    api.get('/report-settings/group/attendance-day-sync').then(res => {
      if (res.data?.ok) {
        const s = res.data.settings;
        if (!Array.isArray(s.sync_times)) s.sync_times = ['09:35'];
        if (!Array.isArray(s.google_sheets_sync_times)) s.google_sheets_sync_times = ['10:00'];
        setSyncSettings(s);
      }
    }).catch(console.error);
  }, []);

  const handleSaveSyncSettings = async () => {
    try {
      const res = await api.post('/report-settings/group/attendance-day-sync', { settings: syncSettings });
      if (res.data?.ok) {
        showNotification('រក្សាទុកបានជោគជ័យ!', 'success');
        setIsSyncSettingsOpen(false);
      }
    } catch (err) {
      console.error(err);
      showNotification('រក្សាទុកមិនបានសម្រេច: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const columnMeta = useMemo(() => ({
    index: { label: 'ល.រ', width: 30, align: 'center', header: 'ល.រ' },
    staffId: { label: 'អត្តលេខ', width: 60, align: 'center', header: 'អត្តលេខ' },
    name: { label: 'គោត្តនាម និងនាម', width: 140, align: 'left', header: 'គោត្តនាម និងនាម' },
    gender: { label: 'ភេទ', width: 25, align: 'center', header: 'ភេទ' },
    position: { label: 'តួនាទី', width: 180, align: 'left', header: 'តួនាទី' },
    department: { label: 'ផ្នែក', width: 120, align: 'left', header: 'ផ្នែក' },
    scheduledTime: { label: 'ម៉ោងត្រូវធ្វើការ', width: 80, align: 'center', header: 'ម៉ោងត្រូវធ្វើការ' },
    checkIn: { label: 'ចូល', width: 60, align: 'center', header: 'ចូល' },
    checkOut: { label: 'ចេញ', width: 60, align: 'center', header: 'ចេញ' },
    dayWorkCount: { label: 'ចំនួនថ្ងៃសរុប', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ថ្ងៃសរុប</div></>) },
    attendanceCount: { label: 'ចំនួនវត្តមាន', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>វត្តមាន</div></>) },
    leaveCount: { label: 'ច្បាប់', width: 90, align: 'left', header: (<><div></div><div>ច្បាប់</div></>) },
    leaveType: { label: 'ច្បាប់', width: 90, align: 'left', header: (<><div>ប្រភេទច្បាប់</div><div>ឈប់សម្រាក</div></>) },
    A: { label: 'អវត្តមាន', width: 50, align: 'center', header: (<><div></div><div>អវត្តមាន</div></>) },
    workTime: { label: 'ចំនួនម៉ោងសរុប', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ម៉ោងសរុប</div></>) },
    late: { label: 'មកយឺត', width: 40, align: 'center', header: 'មកយឺត' },
    early: { label: 'ចេញមុន', width: 40, align: 'center', header: 'ចេញមុន' },
    plech: { label: 'ចំនួនភ្លេចស្កេន', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>ភ្លេចស្កេន</div></>) },
    totalAbsent: { label: 'សរុបអវត្តមាន', width: 50, align: 'center', header: (<><div>សរុប</div><div>អវត្តមាន</div></>) },
    percentage: { label: '%', width: 50, align: 'center', header: (<><div>ចំនួន</div><div>%</div></>) },
    absentToDeduct: { label: 'អវត្តមានត្រូវកាត់', width: 50, align: 'center', header: (<><div>ចំនួនអវត្តមាន</div><div>ត្រូវកាត់</div></>) },
    other: { label: 'ផ្សេងៗ', width: 150, align: 'left', header: (<><div>ផ្សេងៗ</div></>) },
    totalLeaveComment: { label: 'មតិ', width: 120, align: 'left', header: (<><div>មតិរបស់ការិយាល័យ/ផ្នែក</div><div>លើអវត្តមានបុគ្គលិក ផ្សេងៗ</div></>) },
    remarks: { label: 'មូលវិចារ', width: 100, align: 'left', header: 'មូលវិចារ' },
  }), []);

  const defaultCols = useMemo(() => ([
    'index', 'staffId', 'name', 'gender', 'position', 'scheduledTime', 'checkIn', 'checkOut', 'late', 'early', 'leaveCount', 'A', 'department', 'other', 'remarks'
  ]), []);

  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const v = localStorage.getItem('attendancedayReportVisibleCols');
      if (v) return JSON.parse(v);
    } catch { void 0; }
    return Object.fromEntries(defaultCols.map((k) => [k, true]));
  });

  const summaryCols = ['sumLeave', 'sumLateEarly', 'sumPlech', 'sumAbsent'];
  const [colOrder, setColOrder] = useState(() => {
    try {
      const v = localStorage.getItem('attendancedayReportColOrder');
      if (v) {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed) && parsed.length) {
          // Always inject summary columns after department
          const base = parsed.filter((k) => defaultCols.includes(k));
          const missing = defaultCols.filter((k) => !base.includes(k));
          const combined = [...base, ...missing];

          // Ensure 'late' and 'early' are after 'checkOut'
          if (combined.includes('late') || combined.includes('early')) {
            const list = combined.filter(k => k !== 'late' && k !== 'early');
            const outIdx = list.indexOf('checkOut');
            if (outIdx !== -1) {
              list.splice(outIdx + 1, 0, 'late', 'early');
            } else {
              list.push('late', 'early');
            }
            // Now handle summary columns (optional but good practice)
            const final = list.filter(k => !['sumLeave', 'sumLateEarly', 'sumPlech', 'sumAbsent'].includes(k));
            const deptIdx = final.indexOf('department');
            if (deptIdx !== -1) {
              final.splice(deptIdx + 1, 0, 'sumLeave', 'sumLateEarly', 'sumPlech', 'sumAbsent');
            }
            return final;
          }

          // Fallback to old summary column logic
          const filtered = base.filter(k => !['sumLeave', 'sumLateEarly', 'sumPlech', 'sumAbsent'].includes(k));
          const deptIdx = filtered.indexOf('department');
          if (deptIdx !== -1) {
            filtered.splice(deptIdx + 1, 0, 'sumLeave', 'sumLateEarly', 'sumPlech', 'sumAbsent');
          }
          return [...filtered, ...missing];
        }
      }
    } catch { void 0; }
    return defaultCols;
  });

  // Toggle summary columns when showPersonSummary changes
  useEffect(() => {
    setVisibleCols((prev) => {
      const next = { ...prev };
      summaryCols.forEach((k) => { next[k] = !!showPersonSummary; });
      return next;
    });
  }, [showPersonSummary]);

  const [colWidths, setColWidths] = useState(() => {
    try {
      const v = localStorage.getItem('attendancedayReportColWidths');
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
    try { localStorage.setItem('attendancedayReportColWidths', JSON.stringify(colWidths)); } catch { void 0; }
  }, [colWidths]);

  useEffect(() => {
    try { localStorage.setItem('attendancedayReportVisibleCols', JSON.stringify(visibleCols)); } catch { void 0; }
  }, [visibleCols]);

  useEffect(() => {
    try { localStorage.setItem('attendancedayReportColOrder', JSON.stringify(colOrder)); } catch { void 0; }
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

  useEffect(() => {
    let mounted = true;
    const loadDepts = async () => {
      try {
        const res = await api.get('/employees/meta/departments');
        if (!mounted) return;
        if (Array.isArray(res.data)) {
          setDepartments(sortDepartments(res.data.filter(Boolean)));
          return;
        }
      } catch {
      }

      try {
        const res = await api.get('/departments/public');
        if (!mounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        const names = list
          .map((d) => (d?.Department_Kh || d?.Department_En || d?.name || d?.title || '').toString().trim())
          .filter(Boolean);
        setDepartments(sortDepartments(names));
      } catch {
        if (mounted) setDepartments([]);
      }
    };
    loadDepts();
    return () => {
      mounted = false;
    };
  }, []);

  // Ensure department dropdown always matches departments present in current data
  useEffect(() => {
    if (!attendanceData || !attendanceData.length) return;
    const set = new Set();
    (attendanceData || []).forEach((r) => {
      const d = (r.department || r.Department_Kh || '').toString().trim();
      if (d) set.add(d);
    });
    const list = Array.from(set);
    setDepartments(sortDepartments(list));
  }, [attendanceData]);

  useEffect(() => {
    if (departments.length > 0 && !selectedDept && !initialDeptSetRef.current) {
      setSelectedDept(departments[0]);
      initialDeptSetRef.current = true;
    }
  }, [departments, selectedDept]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewAttendance || perms.canViewEmployees || perms.canViewDepartmentReport || !!perms.user?.department)) { setLoading(false); return; }
      setLoading(true);
      setError('');
      try {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new Error('Invalid date range');

        const [hrRes] = await Promise.all([
          api.get('/hr').catch(() => ({ data: [] }))
        ]);
        const hrList = (Array.isArray(hrRes.data) ? hrRes.data : [])
          .filter(h => {
            if (!h) return false;
            const st = (h.status || '').toString().toLowerCase();
            if (st === 'deleted' || st === 'resigned') return false;

            const hasResignData = !!(
              h.resignDate || h.resignReason || h.resignationDate || h.resignationReason ||
              h.dateRemoved || h.dateRemovedFromDataset || h.removalDate ||
              (h.delisted && (h.delisted.dateRemoved || h.delisted.date_removed))
            );
            const hasExplicitRemoval = !!(
              h.dateRemoved || h.dateRemovedFromDataset || h.removalDate ||
              (h.delisted && (h.delisted.dateRemoved || h.delisted.date_removed))
            );
            const isPrepared = !!h.__isPreparedForDeletion && !hasExplicitRemoval;

            if (hasResignData && !isPrepared) return false;
            return true;
          });
        const hrByStaffId = new Map();
        const hrSortKeyByStaffId = new Map();
        hrList.forEach((h, idx) => {
          const sid = (h.staffId || h.no || '').toString().trim();
          if (!sid) return;
          hrByStaffId.set(sid, h);

          const noNum = Number(h?.no);
          const sortKey = Number.isFinite(noNum) && noNum > 0 ? noNum : (1_000_000 + idx);
          hrSortKeyByStaffId.set(sid, sortKey);
        });

        const agg = {};
        const workMinutesByStaff = {};
        const sidToId = new Map();
        const noToId = new Map();

        // Seed with all HR employees first to ensure everyone is listed
        hrList.forEach((h, idx) => {
          const sid = (h.staffId || '').toString().trim();
          const pNo = (h.no || '').toString().trim();
          const internalId = h._id || `temp_${idx}`;

          if (sid) sidToId.set(sid, internalId);
          if (pNo) noToId.set(pNo, internalId);

          agg[internalId] = {
            staffId: sid || pNo,
            hrSortKey: hrSortKeyByStaffId.get(sid || pNo) ?? (1_000_000 + idx),
            isCivilServant: Boolean(
              !h?.isRetiredThenContract &&
              (
                (h?.civilServantId || '').toString().trim() ||
                (h?.officerId || '').toString().trim() ||
                (h?.dateJoinedGov || '').toString().trim()
              )
            ),
            khmerName: h.khmerName || h.name || '',
            name: h.name || '',
            gender: h.gender || '',
            position: h.position || '',
            scheduledTime: '',
            checkIn: '',
            checkOut: '',
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
            checkinLateMinutes: 0,
            checkoutEarlyMinutes: 0,
            checkoutOvertimeMinutes: 0,
            checkoutOvertimeCount: 0,
            clock: 0,
            clockCount: 0,
            workTime: ''
          };
          workMinutesByStaff[internalId] = 0;
        });

        const scheduleByStaffId = new Map();
        let monthlyRows = [];
        let leaves = [];

        if (fromDate === toDate) {
          const [dayRes, schedRes, leaveRes] = await Promise.all([
            api.get('/attendance/day-data', { params: { date: fromDate } }).catch(() => ({ data: [] })),
            api.get('/work-schedules', { params: { startDate: fromDate, endDate: fromDate } }).catch(() => ({ data: [] })),
            api.get('/leave-requests', { params: { from: fromDate, to: toDate } }).catch(() => ({ data: [] }))
          ]);

          monthlyRows = Array.isArray(dayRes.data) ? dayRes.data : [];
          leaves = Array.isArray(leaveRes.data) ? leaveRes.data : [];

          const schedList = Array.isArray(schedRes.data) ? schedRes.data : [];
          schedList.forEach((s) => {
            const sid = (s?.employeeId?.staffId || '').toString().trim();
            if (!sid) return;
            const start = (s.shiftStart || '').toString().trim();
            const end = (s.shiftEnd || '').toString().trim();
            const title = (s.shiftTitle || '').toString().trim();
            let range = '';
            if (start || end) {
              range = `${start || ''}${start && end ? '–' : ''}${end || ''}`;
            }
            if (!range && title) range = title;
            if (!range) return;
            scheduleByStaffId.set(sid, range);
          });
        } else {
          const months = [];
          const cur = new Date(from.getFullYear(), from.getMonth(), 1);
          const endM = new Date(to.getFullYear(), to.getMonth(), 1);
          while (cur <= endM) {
            months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
            cur.setMonth(cur.getMonth() + 1);
          }

          const [monthResults, leaveRequestsRes] = await Promise.all([
            Promise.all(months.map(({ year, month }) => api.get('/attendance/monthly-data', { params: { year, month } }).catch(() => ({ data: [] })))),
            api.get('/leave-requests', { params: { from: fromDate, to: toDate } }).catch(() => ({ data: [] }))
          ]);
          monthlyRows = monthResults.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
          leaves = Array.isArray(leaveRequestsRes.data) ? leaveRequestsRes.data : [];
        }

        const rows = (Array.isArray(monthlyRows) ? monthlyRows : []);
        rows.forEach((rec) => {
          const sid = (rec.staffId || '').toString().trim();
          if (!sid) return;

          let targetId = sidToId.get(sid) || noToId.get(sid) || sid;
          if (!agg[targetId]) {
            agg[targetId] = {
              staffId: sid,
              hrSortKey: 1_000_000,
              khmerName: rec.name || rec.khmerName || '',
              name: rec.name || '',
              gender: rec.gender || '',
              position: rec.position || '',
              department: rec.department || '',
              dayWorkCount: 0, attendanceCount: 0, absentCount: 0,
              leaveCount: 0, A: 0, leaveType: '', other: '',
              totalLeaveComment: '', plech: 0,
              checkinLateCount: 0, checkoutEarlyCount: 0, workTime: '0 h'
            };
          }

          const target = agg[targetId];

          target.attendanceCount = Number(rec.attendanceCount || 0);
          target.absentCount = Number(rec.absentCount || 0);
          target.leaveCount = Number(rec.leaveCount || 0);
          target.A = Number(rec.A || rec.absentCount || 0);
          target.leaveType = rec.leaveType || '';
          target.other = rec.other || rec.leaveReason || '';
          target.status = rec.status || '';
          target.remarks = rec.remarks || '';
          target.plech = Number(rec.plech || 0);
          target.checkinLateCount = Number(rec.checkinLateCount || 0);
          target.checkoutEarlyCount = Number(rec.checkoutEarlyCount || 0);
          target.checkinLateMinutes = Number(rec.checkinLateMinutes || 0);
          target.checkoutEarlyMinutes = Number(rec.checkoutEarlyMinutes || 0);
          target.workTime = rec.workTime > 0 ? formatMinutesAsHM(rec.workTime) : '0 h';

          if (rec.checkIn) target.checkIn = rec.checkIn;
          if (rec.checkOut) target.checkOut = rec.checkOut;

          // Re-apply scheduledTime if we have it from Day view
          const sched = scheduleByStaffId.get(sid);
          if (sched) target.scheduledTime = sched;
        });

        // Merge leaves into agg if not already there
        leaves.forEach(l => {
          const sid = (l.employeeId?.staffId || l.staffId || '').toString().trim();
          if (!sid) return;
          const targetId = sidToId.get(sid) || noToId.get(sid) || sid;
          if (agg[targetId]) {
            const target = agg[targetId];
            if (!target.status || target.status === 'absent') {
              target.status = 'leave';
              target.leaveCount = 1;
              target.leaveType = l.leaveType || 'ច្បាប់';
              target.other = l.reason || l.leaveReason || 'ច្បាប់';
            }
          }
        });

        const data = Object.values(agg)
          .map(r => ({
            ...r,
            dayWorkCount: (Number(r.attendanceCount) || 0) + (Number(r.leaveCount) || 0) + (Number(r.absentCount) || 0)
          }))
          .sort((a, b) => a.hrSortKey - b.hrSortKey);

        const deptsInData = [...new Set(data.map(r => (r.department || r.Department_Kh || '').toString().trim()))];
        console.log('User department:', perms.user?.department);
        console.log('Is Admin:', perms.isAdmin);
        console.log('Departments in data:', deptsInData);
        console.log('Total data items:', data.length);

        let filteredData = data;
        if (!perms.isAdmin && perms.user?.department) {
          const uDept = perms.user.department.replace(/[\s\u200B]/g, '');
          filteredData = data.filter(r => {
            const d = (r.department || r.Department_Kh || '').toString().replace(/[\s\u200B]/g, '');
            return d === uDept;
          });
        }

        if (!mounted) return;
        setAttendanceData(filteredData);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
        setAttendanceData([]);
      } finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [fromDate, toDate, perms.canViewAttendance, perms.canViewEmployees]);

  const absentFilterOptions = useMemo(() => {
    const set = new Set();
    (attendanceData || []).forEach((r) => {
      const v = Number(r.absentCount);
      if (Number.isFinite(v)) set.add(v);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [attendanceData]);

  const leaveFilterOptions = useMemo(() => {
    const set = new Set();
    (attendanceData || []).forEach((r) => {
      const v = Number(r.leaveCount);
      if (Number.isFinite(v)) set.add(v);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [attendanceData]);

  const workTimeFilterOptions = useMemo(() => ([
    { value: 'dayoff', label: 'ថ្ងៃឈប់ (Day off)' },
    { value: 'morning', label: 'ព្រឹក (ចូល 1AM–11AM)' },
    { value: 'evening', label: 'ល្ងាច (ចូល 12PM–11PM)' },
  ]), []);

  const classifyTimeBucket = (record) => {
    const sched = (record.scheduledTime || '').toString().trim();
    const dayWork = Number(record.dayWorkCount);

    if (!sched) {
      if (Number.isFinite(dayWork) && dayWork === 0) return 'dayoff';
      return '';
    }

    const lower = sched.toLowerCase();
    if (lower.includes('day off') || lower.includes('off') || lower.includes('ឈប់')) {
      return 'dayoff';
    }

    const firstPart = sched.split('–')[0].trim();
    const m = firstPart.match(/(\d{1,2}):(\d{2})/);
    if (!m) return '';
    const hour = Number(m[1]);
    if (!Number.isFinite(hour)) return '';
    if (hour >= 1 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 23) return 'evening';
    return '';
  };

  const derived = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();
    const selectedAbsentNorm = (selectedAbsent || '').toString().trim();
    const selectedLeaveNorm = (selectedLeaveFilter || '').toString().trim();
    const selectedWorkTimeNorm = (selectedWorkTime || '').toString().trim().toLowerCase();


    // Fallback: always show attendance rows for single day report
    const rows = (attendanceData || [])
      .filter(record => {
        if (statusFilter !== 'all') {
          if (statusFilter === 'irregular') {
            if (!isIrregular(record)) return false;
          } else {
            const group = calculateStatusGroup(record, fromDate);
            if (group !== statusFilter) {
              if (statusFilter === 'present') {
                if (!['present', 'late', 'early', 'forgot'].includes(group)) return false;
              } else {
                return false;
              }
            }
          }
        }
        if (selectedDept) {
          const d = (record.department || record.Department_Kh || '').toString().replace(/[\s\u200B]/g, '');
          const s = selectedDept.replace(/[\s\u200B]/g, '');
          if (d !== s) return false;
        }
        if (selectedAbsentNorm) {
          if (selectedAbsentNorm === 'any') {
            const rv = Number(record.absentCount);
            if (!Number.isFinite(rv) || rv <= 0) return false;
          } else {
            const n = Number(selectedAbsentNorm);
            const rv = Number(record.absentCount);
            if (!Number.isFinite(rv) || rv !== n) return false;
          }
        }
        if (selectedLeaveNorm) {
          if (selectedLeaveNorm === 'any') {
            const rv = Number(record.leaveCount);
            if (!Number.isFinite(rv) || rv <= 0) return false;
          } else {
            const n = Number(selectedLeaveNorm);
            const rv = Number(record.leaveCount);
            if (!Number.isFinite(rv) || rv !== n) return false;
          }
        }
        if (selectedWorkTimeNorm) {
          const bucket = classifyTimeBucket(record);
          if (bucket !== selectedWorkTimeNorm) return false;
        }
        if (selectedLate) {
          const n = Number(selectedLate);
          const v = Number(record.checkinLateCount || 0);
          if (!Number.isFinite(v) || v < n) return false;
        }
        if (selectedEarly) {
          const n = Number(selectedEarly);
          const v = Number(record.checkoutEarlyCount || 0);
          if (!Number.isFinite(v) || v < n) return false;
        }
        if (!term) return true;
        const name = (record.khmerName || record.name || '').toString().toLowerCase();
        const staffId = (record.staffId || record.no || '').toString().toLowerCase();
        const position = (record.position || '').toString().toLowerCase();
        const leaveType = (record.leaveType || '').toString().toLowerCase();
        const workTime = (record.workTime || '').toString().toLowerCase();
        const absent = String(record.absentCount ?? record.A ?? '').toLowerCase();
        return (
          name.includes(term) ||
          staffId.includes(term) ||
          position.includes(term) ||
          leaveType.includes(term) ||
          workTime.includes(term) ||
          absent.includes(term)
        );
      })
      .sort((a, b) => {
        if (statusFilter === 'leave') {
          const typeA = String(a.leaveType || '').trim();
          const typeB = String(b.leaveType || '').trim();
          if (typeA !== typeB) return typeA.localeCompare(typeB, 'km');
        }
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
        const absentCount = Number(record.absentCount) || 0;
        const A = Number(record.A) || 0; // A = អវត្តមានត្រូវកាត់
        const workTime = record.workTime || '';
        const checkinLateCount = Number(record.checkinLateCount) || 0;
        const checkoutEarlyCount = Number(record.checkoutEarlyCount) || 0;
        const checkinLateMinutes = Number(record.checkinLateMinutes) || 0;
        const checkoutEarlyMinutes = Number(record.checkoutEarlyMinutes) || 0;
        const plech = Number(record.plech ?? record.Plech) || 0;
        const totalAbsent = leaveCount + absentCount;
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
          absentCount,
          leaveType,
          A,
          workTime,
          lateEarly: checkinLateCount + checkoutEarlyCount,
          checkinLateMinutes,
          checkoutEarlyMinutes,
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
    const stats = {
      total: 0,
      present: 0,
      absent: 0,
      leave: 0,
      holiday: 0,
      late: 0,
      early: 0,
      forgot: 0,
      pending: 0,
      irregular: 0
    };

    rows.forEach(r => {
      stats.total++; // Every row counts towards total staff

      const group = calculateStatusGroup(r, fromDate);
      if (group === 'present') stats.present++;
      else if (group === 'late') { stats.late++; stats.present++; }
      else if (group === 'early') { stats.early++; stats.present++; }
      else if (group === 'forgot') { stats.forgot++; stats.present++; }
      else if (group === 'absent') stats.absent++;
      else if (group === 'leave') stats.leave++;
      else if (group === 'holiday') stats.holiday++;
      else if (group === 'pending') stats.pending++;

      if (isIrregular(r)) stats.irregular++;
    });

    return {
      rows,
      male: maleCount,
      female: femaleCount,
      ...stats
    };
  }, [attendanceData, q, selectedDept, selectedAbsent, selectedLeaveFilter, selectedWorkTime, selectedLate, selectedEarly, statusFilter, fromDate]);

  const derivedAllDepts = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();
    const selectedAbsentNorm = (selectedAbsent || '').toString().trim();
    const selectedLeaveNorm = (selectedLeaveFilter || '').toString().trim();
    const selectedWorkTimeNorm = (selectedWorkTime || '').toString().trim().toLowerCase();


    const rows = (attendanceData || [])
      .filter(record => {
        if (selectedAbsentNorm) {
          if (selectedAbsentNorm === 'any') {
            const rv = Number(record.absentCount);
            if (!Number.isFinite(rv) || rv <= 0) return false;
          } else {
            const n = Number(selectedAbsentNorm);
            const rv = Number(record.absentCount);
            if (!Number.isFinite(rv) || rv !== n) return false;
          }
        }
        if (selectedLeaveNorm) {
          if (selectedLeaveNorm === 'any') {
            const rv = Number(record.leaveCount);
            if (!Number.isFinite(rv) || rv <= 0) return false;
          } else {
            const n = Number(selectedLeaveNorm);
            const rv = Number(record.leaveCount);
            if (!Number.isFinite(rv) || rv !== n) return false;
          }
        }
        if (selectedWorkTimeNorm) {
          const bucket = classifyTimeBucket(record);
          if (bucket !== selectedWorkTimeNorm) return false;
        }
        if (selectedLate) {
          const n = Number(selectedLate);
          const v = Number(record.checkinLateCount || 0);
          if (!Number.isFinite(v) || v < n) return false;
        }
        if (selectedEarly) {
          const n = Number(selectedEarly);
          const v = Number(record.checkoutEarlyCount || 0);
          if (!Number.isFinite(v) || v < n) return false;
        }
        if (!term) return true;
        const name = (record.khmerName || record.name || '').toString().toLowerCase();
        const staffId = (record.staffId || record.no || '').toString().toLowerCase();
        const position = (record.position || '').toString().toLowerCase();
        const dept = (record.department || record.Department_Kh || '').toString().toLowerCase();
        const leaveType = (record.leaveType || '').toString().toLowerCase();
        const workTime = (record.workTime || '').toString().toLowerCase();
        const absent = String(record.absentCount ?? record.A ?? '').toLowerCase();
        return (
          name.includes(term) ||
          staffId.includes(term) ||
          position.includes(term) ||
          dept.includes(term) ||
          leaveType.includes(term) ||
          workTime.includes(term) ||
          absent.includes(term)
        );
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
        const absentCount = Number(record.absentCount) || 0;
        const A = Number(record.A) || 0;
        const workTime = record.workTime || '';
        const checkinLateCount = Number(record.checkinLateCount) || 0;
        const checkoutEarlyCount = Number(record.checkoutEarlyCount) || 0;
        const checkinLateMinutes = Number(record.checkinLateMinutes) || 0;
        const checkoutEarlyMinutes = Number(record.checkoutEarlyMinutes) || 0;
        const plech = Number(record.plech ?? record.Plech) || 0;
        const totalAbsent = leaveCount + absentCount;
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
          absentCount,
          leaveType,
          A,
          workTime,
          lateEarly: checkinLateCount + checkoutEarlyCount,
          checkinLateMinutes,
          checkoutEarlyMinutes,
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
  }, [attendanceData, q, selectedAbsent, selectedLeaveFilter, selectedWorkTime, selectedLate, selectedEarly]);

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
        case 'department': return row.department || '';
        case 'scheduledTime': return row.scheduledTime || '';
        case 'sumLeave': return personPeriodTotals?.[row.staffId]?.leave ?? '';
        case 'sumLateEarly': return personPeriodTotals?.[row.staffId]?.lateEarly ?? '';
        case 'sumPlech': return personPeriodTotals?.[row.staffId]?.plech ?? '';
        case 'sumAbsent': return personPeriodTotals?.[row.staffId]?.absent ?? '';
        case 'checkIn': return fmtTimeHM(row.checkIn);
        case 'checkOut': return fmtTimeHM(row.checkOut);
        case 'dayWorkCount': return row.dayWorkCount;
        case 'attendanceCount': return row.attendanceCount;
        case 'leaveCount': return row.leaveType || row.leaveCount;
        case 'leaveType': return row.leaveType;
        case 'A': return row.absentCount;
        case 'workTime': return row.workTime;
        case 'lateEarly': {
          const parts = [];
          if (row.checkinLateMinutes > 0) parts.push(`យឺត ${row.checkinLateMinutes}នាទី`);
          if (row.checkoutEarlyMinutes > 0) parts.push(`ចេញមុន ${row.checkoutEarlyMinutes}នាទី`);
          return parts.join(', ');
        }
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
    const fileSafe = year && month ? `Attendanceday_${year}_${month}.xlsx` : `Attendanceday_${fromDate}_${toDate}.xlsx`;
    XLSX.writeFile(wb, fileSafe);
  };

  // NOTE: This function requires the Google Apps Script to be updated to handle borders and formatting.
  // The script should use payload.header and payload.data to apply borders and set font size 11.
  const handleSyncGoogleSheets = async () => {
    if (!derived.rows || derived.rows.length === 0) {
      showNotification("គ្មានទិន្នន័យសម្រាប់បញ្ជូនទេ!", 'warning');
      return;
    }

    const scriptUrl = "https://script.google.com/macros/s/AKfycbxKg5mP-dV5C1Flbov9lQSfaHJW02VfKYFYI4RjJP3kEV7y6TIZHhOV5rK_godvbGjYrQ/exec";

    // Format date for sheet name: (DD/MM/YYYY)
    const dParts = fromDate.split('-'); // YYYY-MM-DD
    const sheetDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
    const sheetName = `(${sheetDate})`;

    if (!window.confirm(`តើលោកអ្នកពិតជាចង់បញ្ជូនទិន្នន័យចំនួន ${derived.rows.length} នាក់ ទៅកាន់ Google Sheets (Sheet: ${sheetName}) មែនទេ?`)) return;

    setSyncing(true);
    try {
      const visibleKeys = (colOrder || [])
        .filter((k) => columnMeta[k] && (visibleCols?.[k] ?? true));

      const headers = visibleKeys.map((k) => columnMeta[k]?.label || k);

      const getCellValue = (k, row) => {
        switch (k) {
          case 'index': return row.index;
          case 'name': return row.name;
          case 'gender': return row.genderShort || row.gender;
          case 'position': return row.position;
          case 'department': return row.department || '';
          case 'scheduledTime': return fmtTimeRange(row.scheduledTime);
          case 'checkIn': return fmtTimeHM(row.checkIn);
          case 'checkOut': return fmtTimeHM(row.checkOut);
          case 'dayWorkCount': return row.dayWorkCount;
          case 'attendanceCount': return row.attendanceCount;
          case 'leaveCount': return row.leaveType || row.leaveCount;
          case 'leaveType': return row.leaveType;
          case 'A': return row.absentCount;
          case 'workTime': return row.workTime;
          case 'late': {
            let v = Number(row.checkinLateCount || 0);
            if (row.checkIn && row.scheduledTime) {
              const calc = getLateMins(row.checkIn, row.scheduledTime);
              if (calc > 0) v = 1;
            }
            return v > 0 ? 1 : '';
          }
          case 'early': {
            let v = Number(row.checkoutEarlyCount || 0);
            if (row.checkOut && row.scheduledTime) {
              const calc = getEarlyMins(row.checkOut, row.scheduledTime);
              if (calc > 0) v = 1;
            }
            return v > 0 ? 1 : '';
          }
          case 'plech': return row.plech;
          case 'other': {
            let txt = (row.other || '').toString().trim();
            if (!txt) {
              const group = calculateStatusGroup(row, fromDate);
              if (isIrregular(row)) txt = 'មិនប្រក្រតី';
              else if (group === 'forgot') txt = 'ភ្លេចស្កេន';
              else if (group === 'absent') txt = 'អវត្តមាន';
              else if (group === 'holiday') txt = 'សម្រាក';
            }
            return txt;
          }
          default: return row?.[k] || '';
        }
      };

      const dataRows = derived.rows.map((row) => visibleKeys.map((k) => getCellValue(k, row)));

      const payload = {
        sheetName: sheetName,
        header: headers,
        data: dataRows
      };

      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      window.alert(`បានបញ្ជូនទិន្នន័យទៅ Google Sheets (${sheetName}) រួចរាល់!`);
    } catch (err) {
      console.error('Sync failed', err);
      window.alert("ការបញ្ជូនទិន្នន័យមិនបានសម្រេច៖ " + err.message);
    } finally {
      setSyncing(false);
    }
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
      header.appendChild(makeText('h1', 'វត្តមានប្រចាំថ្ងៃរបស់មន្រ្តីរាជការ និងមន្រ្តីកិច្ចសន្យា', { margin: '0', fontSize: '20px', fontWeight: '700', textAlign: 'center' }));
      header.appendChild(makeText('div', `ផ្នែក: ${deptName}`, { marginTop: '6px', fontSize: '14px', fontWeight: '700', textAlign: 'center' }));
      header.appendChild(makeText('div', `សម្រាប់: ថ្ងៃទី ${new Date(fromDate).getDate()} ${fmtKhmerLongDate(fromDate).split(' ').slice(2).join(' ')}`, { marginTop: '4px', fontSize: '16px', textAlign: 'center', color: '#141313' }));

      page.appendChild(header);

      const male = rows.filter(r => r.gender === 'Male' || r.gender === 'ប្រុស').length;
      const female = rows.filter(r => r.gender === 'Female' || r.gender === 'ស្រី').length;
      page.appendChild(makeText('div', `សរុប: ${rows.length} នាក់ ( ប្រុស: ${male} - ស្រី: ${female} )`, { marginBottom: '10px', fontSize: '12px', color: '#313030' }));

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

  const rowFontSize = Math.max(10, Math.round((rowHeight || 24) * 0.46)) || 11;
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
    fontSize: rowFontSize,
    userSelect: 'none'
  };

  const getColWidth = (k) => {
    const w = Number(colWidths?.[k]);
    if (Number.isFinite(w) && w > 0) return w;
    return columnMeta[k]?.width;
  };

  const renderCell = (key, row) => {
    const blankIfZero = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return '';
      return n === 0 ? '' : n;
    };

    /**
     * Heuristic for auto-scaling font size to stay on one line.
     * @param {string} text 
     * @param {number} baseFs 
     * @param {number} colId
     * @returns {number}
     */
    const getFitFs = (text, baseFs, colId) => {
      const txt = (text || '').toString().trim();
      if (!txt) return baseFs;

      // Calculate visual horizontal length by ignoring stacking Khmer characters
      // (vowels and signs that go above/below the base consonant)
      const visualLen = txt.replace(/[\u17B7-\u17D1\u17D3\u17D2]/g, '').length;

      const w = Number(colWidths?.[colId]) || columnMeta[colId]?.width || 80;
      const aw = w - 10; // Breathing room

      // Heuristic: Visual character width ratio (approx index 0.75 of font size for Khmer)
      const charWidthRatio = 0.75;
      const capacityAtBase = aw / (baseFs * charWidthRatio);

      if (visualLen <= capacityAtBase) return baseFs;

      // Calculate font size that would fit the available width
      let fitFs = aw / (visualLen * charWidthRatio);

      // Ensure it stays readable (min 7.5px).
      return Math.max(7.5, Math.min(baseFs, fitFs));
    };

    switch (key) {
      case 'sumLeave': {
        const v = personPeriodTotals?.[row.staffId]?.leave;
        return { value: Number.isFinite(v) ? v : '', style: { textAlign: 'center', width: columnMeta.sumLeave.width } };
      }
      case 'sumLateEarly': {
        const v = personPeriodTotals?.[row.staffId]?.lateEarly;
        return { value: Number.isFinite(v) ? v : '', style: { textAlign: 'center', width: columnMeta.sumLateEarly.width } };
      }
      case 'sumPlech': {
        const v = personPeriodTotals?.[row.staffId]?.plech;
        return { value: Number.isFinite(v) ? v : '', style: { textAlign: 'center', width: columnMeta.sumPlech.width } };
      }
      case 'sumAbsent': {
        const v = personPeriodTotals?.[row.staffId]?.absent;
        return { value: Number.isFinite(v) ? v : '', style: { textAlign: 'center', width: columnMeta.sumAbsent.width } };
      }
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
      case 'name': {
        const fs = getFitFs(row.name, rowFontSize, 'name');
        return { value: row.name, style: { textAlign: 'left', width: columnMeta.name.width, fontSize: fs, whiteSpace: 'nowrap' } };
      }
      case 'gender':
        return { value: (row.genderShort || row.gender), style: { textAlign: 'center', width: columnMeta.gender.width } };
      case 'position': {
        const fs = getFitFs(row.position, rowFontSize, 'position');
        return { value: row.position, style: { textAlign: 'left', width: columnMeta.position.width, fontSize: fs, whiteSpace: 'nowrap' } };
      }
      case 'department': {
        const fs = getFitFs(row.department, rowFontSize, 'department');
        return { value: row.department || '', style: { textAlign: 'left', width: columnMeta.department.width, fontSize: fs, whiteSpace: 'nowrap' } };
      }
      case 'remarks': {
        return {
          value: (
            <input
              type="text"
              defaultValue={row.remarks || ''}
              onChange={(e) => {
                row.remarks = e.target.value;
              }}
              onBlur={async (e) => {
                const val = e.target.value;
                console.log('Saving remarks for', row.staffId, 'val:', val);
                showNotification(`កំពុងរក្សាទុក មូលវិចារ សម្រាប់ ${row.staffId}...`, 'info');
                try {
                  const res = await api.post('/attendance/save-remarks', {
                    date: fromDate,
                    staffId: row.staffId,
                    remarks: val
                  });
                  console.log('Save remarks response:', res.data);
                  showNotification('រក្សាទុក មូលវិចារ បានសម្រេច!', 'success');
                } catch (err) {
                  console.error('Failed to save remarks:', err);
                  showNotification('រក្សាទុក មូលវិចារ មិនបានសម្រេច', 'error');
                }
              }}
              style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 11, fontFamily: 'Khmer OS Siemreap' }}
            />
          ),
          style: { textAlign: 'left', width: columnMeta.remarks.width }
        };
      }
      case 'scheduledTime': {
        const txt = fmtTimeRange(row.scheduledTime);
        const fs = getFitFs(txt, rowFontSize, 'scheduledTime');
        return { value: txt, style: { textAlign: 'center', width: columnMeta.scheduledTime.width, fontSize: fs, whiteSpace: 'nowrap' } };
      }
      case 'checkIn': {
        const txt = fmtTimeHM(row.checkIn);
        const fs = getFitFs(txt, rowFontSize, 'checkIn');
        return { value: txt, style: { textAlign: 'center', width: columnMeta.checkIn.width, fontSize: fs, whiteSpace: 'nowrap' } };
      }
      case 'checkOut': {
        const txt = fmtTimeHM(row.checkOut);
        const fs = getFitFs(txt, rowFontSize, 'checkOut');
        return { value: txt, style: { textAlign: 'center', width: columnMeta.checkOut.width, fontSize: fs, whiteSpace: 'nowrap' } };
      }
      case 'dayWorkCount':
        return { value: blankIfZero(row.dayWorkCount), style: { textAlign: 'center' } };
      case 'attendanceCount':
        return { value: blankIfZero(row.attendanceCount), style: { textAlign: 'center' } };
      case 'leaveCount': {
        const txt = row.leaveType || '';
        const fs = getFitFs(txt, rowFontSize, 'leaveCount');
        return {
          value: txt || blankIfZero(row.leaveCount),
          style: { textAlign: 'left', fontSize: fs, whiteSpace: 'nowrap' }
        };
      }
      case 'leaveType': {
        const txt = row.leaveType || '';
        const fs = getFitFs(txt, rowFontSize, 'leaveType');
        return {
          value: txt,
          style: { textAlign: 'left', fontSize: fs, whiteSpace: 'nowrap' }
        };
      }
      case 'A':
        return { value: blankIfZero(row.absentCount), style: { textAlign: 'center' } };
      case 'workTime':
        return { value: (Number.isFinite(Number(row.workTime)) ? row.workTime : ''), style: { textAlign: 'center' } };
      case 'late': {
        let v = Number(row.checkinLateMinutes || row.checkinLateCount || 0);
        if (row.checkIn && row.scheduledTime) {
          const calc = getLateMins(row.checkIn, row.scheduledTime);
          if (calc === 0) v = 0;
          else if (v === 0) v = calc;
        }
        return { value: v > 0 ? 1 : '', style: { textAlign: 'center' } };
      }
      case 'early': {
        let v = Number(row.checkoutEarlyMinutes || row.checkoutEarlyCount || 0);
        if (row.checkOut && row.scheduledTime) {
          const calc = getEarlyMins(row.checkOut, row.scheduledTime);
          if (calc === 0) v = 0;
          else if (v === 0) v = calc;
        }
        return { value: v > 0 ? 1 : '', style: { textAlign: 'center' } };
      }
      case 'plech':
        return { value: blankIfZero(row.plech), style: { textAlign: 'center' } };
      case 'totalAbsent':
        return { value: blankIfZero(row.totalAbsent), style: { textAlign: 'center' } };
      case 'percentage':
        return { value: (row.percentage && Number.isFinite(Number(row.percentage))) ? `${row.percentage}%` : '', style: { textAlign: 'center' } };
      case 'absentToDeduct':
        return { value: blankIfZero(row.absentToDeduct), style: { textAlign: 'center' } };
      case 'other': {
        let txt = '';
        if (Number(row.leaveCount) > 0) {
          txt = 'ច្បាប់';
        } else {
          txt = (row.other || '').toString().trim();
          if (!txt) {
            const group = calculateStatusGroup(row, fromDate);
            if (isIrregular(row)) txt = 'មិនប្រក្រតី';
            else if (group === 'forgot') txt = 'ភ្លេចស្កេន';
            else if (group === 'absent') txt = 'អវត្តមាន';
            else if (group === 'holiday') txt = 'សម្រាក';
          }
        }
        const fs = getFitFs(txt, rowFontSize, 'other');
        return { value: txt, style: { textAlign: 'left', fontSize: fs, whiteSpace: 'nowrap' } };
      }
      case 'totalLeaveComment': {
        const txt = row.totalLeaveComment || '';
        const fs = getFitFs(txt, rowFontSize, 'totalLeaveComment');
        return { value: txt, style: { fontSize: fs, whiteSpace: 'nowrap' } };
      }
      default:
        return { value: row?.[key], style: {} };
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: '"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif' }}>
      {notification && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: notification.type === 'success' ? '#10b981' : (notification.type === 'error' ? '#ef4444' : (notification.type === 'warning' ? '#f59e0b' : '#3b82f6')), color: 'white', padding: '10px 20px', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 9999 }}>
          {notification.message}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ marginRight: 8 }}>ចាប់ពីថ្ងៃ:</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => {
              setFromDate(e.target.value);
              setToDate(e.target.value);
            }}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, marginRight: 8 }}
          />
        </div>

        <div>
          <label style={{ marginRight: 8 }}>ផ្នែក:</label>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="">-- ទាំងអស់ --</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {/* 'To date' removed: report uses single date from 'fromDate' */}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#111' }}>Row height</label>
          <input
            type="range"
            min={10}
            max={60}
            value={rowHeight}
            onChange={(e) => setRowHeight(Number(e.target.value))}
          />
          <span style={{ fontSize: 12, color: '#111', minWidth: 40, textAlign: 'right', fontWeight: 700 }}>{(rowHeight || 24)}px</span>
        </div>



        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowColsMenu(v => !v)}
            style={{ padding: '6px 12px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
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
        <button onClick={handleExportExcel} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>នាំចេញ Excel</button>
        <button onClick={handleSyncGoogleSheets} disabled={syncing}
          style={{ padding: '6px 12px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, opacity: syncing ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {syncing ? '🔄' : '☁️'} Sync Google Sheets
        </button>
        <button onClick={handlePrint} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>បោះពុម្ព</button>
        <button onClick={handlePrintByDepartment} style={{ padding: '6px 12px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
          PDF តាមផ្នែក
        </button>

        <button
          onClick={() => setIsSyncSettingsOpen(true)}
          style={{ padding: '6px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="កំណត់ការទាញទិន្នន័យអូតូ"
        >
          <span style={{ fontSize: 20 }}>⚙️</span>
        </button>
      </div>

      {/* Sync Settings Modal */}
      {isSyncSettingsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 450, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>⚙️</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>កំណត់ការទាញទិន្នន័យអូតូ</h3>
              </div>
              <button onClick={() => setIsSyncSettingsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <span style={{ fontSize: 24 }}>✖️</span>
              </button>
            </div>

            <div style={{ padding: 24, maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Auto Paste Checkinme section */}
              <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⏰ ស្វ័យប្រវត្តិ Paste Checkinme
                </h4>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 15 }}>
                  <input
                    type="checkbox"
                    checked={syncSettings.auto_sync_enabled}
                    onChange={(e) => setSyncSettings({ ...syncSettings, auto_sync_enabled: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>បើកដំណើរការ (Enabled)</span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {syncSettings.sync_times.map((time, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => {
                          const newTimes = [...syncSettings.sync_times];
                          newTimes[idx] = e.target.value;
                          setSyncSettings({ ...syncSettings, sync_times: newTimes });
                        }}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                      />
                      {syncSettings.sync_times.length > 1 && (
                        <button
                          onClick={() => setSyncSettings({ ...syncSettings, sync_times: syncSettings.sync_times.filter((_, i) => i !== idx) })}
                          style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSyncSettings({ ...syncSettings, sync_times: [...syncSettings.sync_times, '12:00'] })}
                  style={{ marginTop: 10, width: '100%', padding: '6px', background: 'none', border: '1px dashed #0ea5e9', color: '#0ea5e9', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  + បន្ថែមម៉ោង
                </button>
              </div>

              {/* Google Sheets Sync section */}
              <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ☁️ Sync Google Sheets អូតូ
                </h4>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 15 }}>
                  <input
                    type="checkbox"
                    checked={syncSettings.google_sheets_sync_enabled}
                    onChange={(e) => setSyncSettings({ ...syncSettings, google_sheets_sync_enabled: e.target.checked })}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#334155' }}>បើកដំណើរការ (Enabled)</span>
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {syncSettings.google_sheets_sync_times.map((time, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => {
                          const newTimes = [...syncSettings.google_sheets_sync_times];
                          newTimes[idx] = e.target.value;
                          setSyncSettings({ ...syncSettings, google_sheets_sync_times: newTimes });
                        }}
                        style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
                      />
                      {syncSettings.google_sheets_sync_times.length > 1 && (
                        <button
                          onClick={() => setSyncSettings({ ...syncSettings, google_sheets_sync_times: syncSettings.google_sheets_sync_times.filter((_, i) => i !== idx) })}
                          style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#ef4444' }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSyncSettings({ ...syncSettings, google_sheets_sync_times: [...syncSettings.google_sheets_sync_times, '12:00'] })}
                  style={{ marginTop: 10, width: '100%', padding: '6px', background: 'none', border: '1px dashed #22c55e', color: '#22c55e', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  + បន្ថែមម៉ោង
                </button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 12 }}>
              <button
                onClick={() => setIsSyncSettingsOpen(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
              >
                បោះបង់
              </button>
              <button
                onClick={handleSaveSyncSettings}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                💾 រក្សាទុក
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 10,
        marginBottom: 20
      }}>
        {[
          { label: 'បុគ្គលិកសរុប', value: (derived.total || 0), color: '#3b82f6', bg: '#eff6ff', emoji: '👥', filter: 'all' },
          { label: 'វត្តមាន', value: (derived.present || 0), color: '#10b981', bg: '#ecfdf5', emoji: '✅', filter: 'present' },
          { label: 'អវត្តមាន', value: (derived.absent || 0), color: '#ef4444', bg: '#fef2f2', emoji: '❌', filter: 'absent' },
          { label: 'ច្បាប់', value: (derived.leave || 0), color: '#7c3aed', bg: '#f5f3ff', emoji: '📋', filter: 'leave' },
          { label: 'ចូលយឺត', value: (derived.late || 0), color: '#f59e0b', bg: '#fffbeb', emoji: '⏰', filter: 'late' },
          { label: 'ចេញមុន', value: (derived.early || 0), color: '#f97316', bg: '#fff7ed', emoji: '🏃', filter: 'early' },
          { label: 'ភ្លេចស្កេន', value: (derived.forgot || 0), color: '#ec4899', bg: '#fdf2f8', emoji: '📵', filter: 'forgot' },
          { label: 'សម្រាក', value: (derived.holiday || 0), color: '#14b8a6', bg: '#f0fdfa', emoji: '🏖️', filter: 'holiday' },
          { label: 'មិនទាន់ដល់ម៉ោង', value: (derived.pending || 0), color: '#475569', bg: '#f1f5f9', emoji: '⏳', filter: 'pending' },
          { label: 'មិនប្រក្រតី', value: (derived.irregular || 0), color: '#f59e0b', bg: '#fffbeb', emoji: '⚠️', filter: 'irregular' },
        ].map((stat, i) => (
          <div key={i}
            onClick={() => setStatusFilter(statusFilter === stat.filter ? 'all' : stat.filter)}
            style={{
              background: statusFilter === stat.filter ? stat.color : '#fff',
              borderRadius: 12,
              border: '1.5px solid ' + stat.color + (statusFilter === stat.filter ? '' : '33'),
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: statusFilter === stat.filter ? `0 4px 12px ${stat.color}44` : '0 1px 2px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: statusFilter === stat.filter ? 'translateY(-2px)' : 'none',
              color: statusFilter === stat.filter ? '#fff' : 'inherit'
            }}>
            <span style={{ fontSize: 12 }}>{stat.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: statusFilter === stat.filter ? '#fff' : stat.color }}>{stat.value}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: statusFilter === stat.filter ? 'rgba(255,255,255,0.9)' : '#666', whiteSpace: 'nowrap' }}>{stat.label}</span>
          </div>
        ))}
      </div>

      <div
        ref={printRef}
        id="attendance1-print-content"
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
        {/* Header and table rendering identical to original page (kept for parity) */}
        <div style={{ marginBottom: 20, paddingBottom: 10 }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 400, textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }}>ព្រះរាជាណាចក្រកម្ពុជា</h1>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 400, textAlign: 'center', fontFamily: 'Khmer OS Muol Light' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</h1>
          <div style={{ textAlign: 'center', margin: '2px 0' }}>
            <img src={headerBg} alt="header" style={{ width: '150px', height: 'auto', display: 'block', margin: '0 auto' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>ក្រសួងសុខាភិបាល</h1>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</h1>
          {selectedDept && (
            <h1 style={{ margin: 0, fontSize: 13, fontWeight: 400, textAlign: 'left', fontFamily: 'Khmer OS Muol Light' }}>{selectedDept}</h1>
          )}
          <h1 style={{ margin: 0, fontSize: 12, fontFamily: 'Khmer OS Siemreap', fontWeight: 900, textAlign: 'center' }}>វត្តមានប្រចាំថ្ងៃរបស់មន្រ្តីរាជការ និងមន្រ្តីកិច្ចសន្យា </h1>
          {(() => {
            // If no data, show only 'សម្រាប់:' wording
            if (derived.rows.length === 0) {
              return (
                <p style={{ margin: 5, textAlign: 'center', fontFamily: 'Khmer OS Siemreap', fontSize: 12, color: '#111111' }}>
                  សម្រាប់: {fmtKhmerLongDate(fromDate)}
                </p>
              );
            }
            // Otherwise, show range wording
            if (fromDate && toDate && fromDate === toDate) {
              return (
                <p style={{ margin: 5, textAlign: 'center', fontSize: 12, fontWeight: 900, fontFamily: 'Khmer OS Siemreap', color: '#111111' }}>
                  សម្រាប់: {fmtKhmerLongDate(fromDate)}
                </p>
              );
            }
            return null;
          })()}
        </div>


        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Khmer OS Siemreap', fontSize: 12, border: '1px solid #ddd', tableLayout: 'fixed' }}>
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
            {derived.rows.map((row, idx) => {
              const isRowAbsent = calculateStatusGroup(row, fromDate) === 'absent';
              const rowBg = isRowAbsent ? '#fee2e2' : (idx % 2 === 0 ? '#f9fafb' : '#fff');
              return (
                <tr key={idx} style={{ background: rowBg, height: rowHeight }}>
                {visibleKeys.map((k) => {
                  const cell = renderCell(k, row);
                  const cw = getColWidth(k);
                  return (
                    <td
                      key={k}
                      style={{
                        ...tdBase,
                        ...(cell.style || {}),
                        width: cw,
                        maxWidth: cw,
                        textAlign: cell.style?.textAlign || columnMeta[k]?.align || 'center',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ width: '100%', overflow: 'hidden', whiteSpace: cell.style?.whiteSpace || 'nowrap' }}>
                        {cell.value}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          </tbody>
        </table>

        <div style={{ marginTop: 10, fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <div>សរុប: <strong>{derived.total}</strong> នាក់ ( ប្រុស: <strong>{derived.male}</strong> នាក់ - ស្រី: <strong>{derived.female}</strong> នាក់ )</div>
          <div>| វត្តមាន: <strong>{derived.present}</strong></div>
          <div>| អវត្តមាន: <strong>{derived.absent}</strong></div>
          <div>| ច្បាប់: <strong>{derived.leave}</strong></div>
          <div>| ចូលយឺត: <strong>{derived.late}</strong></div>
          <div>| ចេញមុន: <strong>{derived.early}</strong></div>
          <div>| ភ្លេចស្កេន: <strong>{derived.forgot}</strong></div>
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
            <div style={{ display: 'flex', justifyContent: sigs.length === 1 ? 'flex-end' : 'space-between', marginTop: 20, paddingTop: 10, padding: sigs.length === 1 ? '0 120px 0 20px' : (dept.includes('ការិយាល័យរដ្ឋបាល និងបុគ្គលិក') ? '0 100px 0 100px' : '0 20px'), fontSize: 12 }}>
              {sigs.map((sig, idx) => (
                <div key={idx} style={{ textAlign: 'center', paddingRight: (idx === 2 && sigs.length === 3) ? 65 : 0, paddingLeft: (idx === 0 && sigs.length === 3) ? 35 : 0 }}>
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
