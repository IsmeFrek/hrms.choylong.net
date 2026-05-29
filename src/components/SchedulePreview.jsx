import React from 'react';
import buildGroupReportHtml from './groupReportBuilder';
import { findShiftColor as utilFindShiftColor } from '../utils/shiftColor';
import * as XLSX from 'xlsx';
import headerBg from '../assets/3.JPG';

/**
 * Extract schedule grouped by ISO date string.
 * Params:
 *  - rows: array of row objects (displayRows)
 *  - monthMeta: { year, month }
 *  - totalDays: number of days to include (displayTotalDays)
 *  - resolveShiftForDay: function(row, dayIndex) => shift object
 *  - getEmployeeId: optional function(emp) => string id
 *
 * Returns: { [isoDate]: Array<{ employeeRef, employeeId, employeeName, shift }> }
 */
export function extractScheduleByDay({ rows = [], monthMeta = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }, totalDays = 0, resolveShiftForDay, getEmployeeId }) {
  const out = {};
  const days = Math.max(0, Number(totalDays) || 0);
  for (let di = 0; di < days; di += 1) {
    const date = new Date(monthMeta.year, monthMeta.month - 1, di + 1);
    if (Number.isNaN(date.getTime())) continue;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    out[iso] = [];
    rows.forEach((r) => {
      try {
        const sh = typeof resolveShiftForDay === 'function' ? resolveShiftForDay(r, di) : (r.groupShifts && r.groupShifts[di % (r.groupShifts.length || 1)]) || null;
        const emp = r.employee || null;
        const empId = typeof getEmployeeId === 'function' ? getEmployeeId(emp || { ...r.employee, ...{ staffId: r.employeeRef }}) : (emp && (emp.staffId || emp.id || emp._id)) || String(r.employeeRef || '');
        const empName = emp ? (emp.khmerName || emp.fullName || emp.name || '') : String(r.employeeRef || '');
        out[iso].push({ employeeRef: r.employeeRef, employeeId: empId, employeeName: empName, shift: sh });
      } catch (e) { /* ignore row errors */ }
    });
  }
  return out;
}

export default function SchedulePreview({
  subgroupsByCategory = {},
  pickedShiftsByCategory = {},
  days = 12,
  monthContext = null,
  monthLabel = '',
  department = '',
  allEmployees = [],
  weekendBehavior = 'dayOff',
  holidayBehavior = 'dayOff',
  // how to rotate weekend assignment for special groups: 'alternateDays' | 'alternateWeeks' | 'none'
  weekendRotationMode = 'alternateDays',
  holidayDates = [],
  // when true, render a fixed visual template (groups A..G) instead of real data
  exampleLayout = false,
  // 'A' = calendar template; 'B' = card-style groups + shift list (based on screenshot 2)
  exampleVariant = 'A',
  // optional mapping from group key -> display label (useful for Khmer names)
  groupLabelMap = {},
  // optional master lists (so preview can resolve colors from templates/global shifts)
  shiftTemplates = [],
  shifts = [],
  // Pass through manual overrides from parent for persistence
  manualOverrides = {},
  setManualOverrides = null,
}) {
  // Local editable phone map: { employeeKey: phone }
  const [phoneEdits, setPhoneEdits] = React.useState({});
  const [reportHtml, setReportHtml] = React.useState('');

  // helper to normalize phone: keep digits, collapse leading zeros to single 0, ensure single leading zero
  const normalizePhone = React.useCallback((raw) => {
    let p = String(raw || '').trim();
    p = p.replace(/\D/g, '');
    p = p.replace(/^0+/, '0');
    if (p && !p.startsWith('0')) p = '0' + p;
    if (p === '0') p = '';
    return p;
  }, []);

  // initialize phoneEdits when allEmployees change; actual population using rows occurs after displayRows is known
  React.useEffect(() => {
    try { setPhoneEdits({}); } catch (e) {}
  }, [allEmployees]);
  const categoryOrder = React.useMemo(() => Object.keys(subgroupsByCategory || {}), [subgroupsByCategory]);
  const monthMeta = React.useMemo(() => {
    if (monthContext && Number.isFinite(monthContext.year) && Number.isFinite(monthContext.month)) {
      return {
        year: Number(monthContext.year),
        month: Math.min(12, Math.max(1, Number(monthContext.month))),
      };
    }
    if (typeof monthLabel === 'string' && monthLabel.includes('-')) {
      const [y, m] = monthLabel.split('-');
      const year = Number(y);
      const month = Number(m);
      if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
        return { year, month };
      }
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [monthContext, monthLabel]);
  const monthDays = React.useMemo(() => {
    return new Date(monthMeta.year, monthMeta.month, 0).getDate();
  }, [monthMeta]);
  const isoMonthTag = React.useMemo(() => `${monthMeta.year}-${String(monthMeta.month).padStart(2, '0')}`, [monthMeta]);
  const displayMonthLabel = React.useMemo(() => {
    // Return Khmer month name + Khmer numerals year, e.g. "តុលា ឆ្នាំ ២០២៥"
    try {
      const khMonths = ['មករា','កុម្ភៈ','មិនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
      const toKhmerDigits = (num) => String(num).split('').map(ch => {
        if (ch >= '0' && ch <= '9') return ['០','១','២','៣','៤','៥','៦','៧','៨','៩'][parseInt(ch,10)];
        return ch;
      }).join('');
      const y = Number(monthMeta.year) || new Date().getFullYear();
      const m = Math.min(12, Math.max(1, Number(monthMeta.month) || (new Date().getMonth()+1)));
      const khMonth = khMonths[m-1] || '';
      return `${khMonth} ឆ្នាំ ${toKhmerDigits(y)}`;
    } catch (err) {
      return isoMonthTag;
    }
  }, [monthMeta, isoMonthTag]);
  const normalizedHolidaySet = React.useMemo(() => {
    const set = new Set();
    (holidayDates || []).forEach((date) => {
      if (!date) return;
      const raw = String(date).trim();
      if (!raw) return;
      const parts = raw.split('-');
      if (parts.length !== 3) return;
      const [y, m, d] = parts;
      if (y && m && d) {
        set.add(`${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      }
    });
    return set;
  }, [holidayDates]);
  const totalDays = React.useMemo(() => {
    const numeric = Number(days);
    if (Number.isFinite(numeric) && numeric > 0) return Math.max(1, Math.floor(numeric));
    return monthDays;
  }, [days, monthDays]);
  // when showing example layout, force 31 days (to match the attached visual)
  const displayTotalDays = exampleLayout ? 31 : totalDays;
  // state for inline report preview (avoid opening new tab)
  // state for inline report preview (avoid opening new tab)
  const reportFrameRef = React.useRef(null);


  // Printable/header HTML used for print views and group preview header
  const printableHeaderHtml = React.useMemo(() => {
    // Compact Khmer-style centered header similar to the provided screenshot.
    // Include the resolved month label when available.
    return `\
      <div style="text-align:center;margin-bottom:0px;font-weight: 100;font-family: 'Khmer OS Muol Light', Arial, sans-serif;">
        <div style={{ fontSize:22}}>ព្រះរាជាណាចក្រកម្ពុជា</div>
        <div style={{ fontSize:18}}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
        </div>`;
  }, [displayMonthLabel]);

  // Open a visible print tab with an instruction banner and attempt to trigger print.
  const openPrintWindow = (htmlString) => {
    try {
      let finalHtml = htmlString;
      // Open a visible tab (so the user can manually print if automatic print is blocked)
      const w = window.open('', '_blank');
      if (w) {
        try {
          w.document.open(); w.document.write(finalHtml); w.document.close();
          setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
          return true;
        } catch (e) {
          // fall through to data: URI fallback
        }
      }
      // Fallback: open a data URI in a new tab
      const popup = window.open('data:text/html;charset=utf-8,' + encodeURIComponent(finalHtml), '_blank');
      if (popup) {
        try { setTimeout(() => { try { popup.focus(); popup.print(); } catch (e) {} }, 400); } catch (e) {}
        return true;
      }
      alert('Unable to open a print tab. Please allow popups for this site or use Download Excel / Print from the browser menu.');
      return false;
    } catch (err) {
      try { alert('Unable to open print window. Please allow popups or use the browser Print option.'); } catch (e) {}
      return false;
    }
  };
  const previewRange = React.useMemo(() => {
    const startDate = new Date(monthMeta.year, monthMeta.month - 1, 1);
    const endDay = Math.min(monthDays, totalDays);
    const endDate = new Date(monthMeta.year, monthMeta.month - 1, endDay);
    const format = (date) => {
      try {
        return date.toLocaleDateString('km-KH', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch (err) {
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    };
    return {
      start: format(startDate),
      end: format(endDate),
    };
  }, [monthMeta, monthDays, totalDays]);
  // helper to resolve an employee reference (could be staffId, _id, or name)
  const resolveEmployee = React.useCallback((ref) => {
    if (!ref) return null;
    const key = String(ref).trim();
    const list = (allEmployees || []);
    // direct staffId match
    let found = list.find(a => String(a.staffId || '') === key);
    if (found) return found;
    // direct id/_id match
    found = list.find(a => String(a.id) === key || String(a._id) === key);
    if (found) return found;
    // name exact
    found = list.find(a => {
      const n = (a.khmerName || a.fullName || a.name || '').toString().trim();
      return n && n === key;
    });
    if (found) return found;
    // normalized name
    const normKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
    found = list.find(a => ((a.khmerName || a.fullName || a.name || '').toString().toLowerCase().replace(/\s+/g, ' ').trim()) === normKey);
    return found || null;
  }, [allEmployees]);

  const lookupEmployeeById = React.useCallback((id) => {
    if (!id) return null;
    const key = String(id).trim();
    return (allEmployees || []).find(a => String(a.id || a._id || '').trim() === key) || null;
  }, [allEmployees]);

  // Unified helper to extract an employee visible ID from multiple possible fields
  const getEmployeeId = React.useCallback((emp) => {
    if (!emp) return '';
    return (
      emp.staffId || emp.staff_id || emp.StaffId || emp.Staff_ID ||
      emp.staffNo || emp.staff_no ||
      emp.cardNumber || emp.card_no || emp.cardNo || emp.card ||
      emp.no || emp.civilServantId || emp.officerId ||
      emp.employeeId || emp.employeeCode || emp.code || emp.IDKSFH ||
      emp.id || emp._id || ''
    );
  }, []);

  const rows = React.useMemo(() => {
    const result = [];
    categoryOrder.forEach(catId => {
      const groups = subgroupsByCategory[catId] || [];
      const shiftsForCat = pickedShiftsByCategory[catId] || [];
      groups.forEach((group, groupIndex) => {
        const employees = Array.isArray(group.employees) ? group.employees : [];
        employees.forEach(empRef => {
          const emp = resolveEmployee(empRef);
          result.push({
            category: catId,
            groupName: group.name || '',
            employeeRef: empRef,
            employee: emp,
            groupShifts: shiftsForCat,
            groupIndex,
            group,
          });
        });
      });
    });
    return result;
  }, [categoryOrder, subgroupsByCategory, pickedShiftsByCategory, resolveEmployee]);
  // If there are no rows, show an empty state (unless exampleLayout forces a preview)
  if (!rows.length && !exampleLayout) {
    return (
      <div className="p-4 bg-white border rounded shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-3">Schedule preview</h2>
        <div className="text-gray-500">មិនមានបុគ្គលិកសម្រាប់បង្ហាញ។</div>
      </div>
    );
  }

  // Build example/template rows for demonstration.
  // Variant A: simple A..G groups. Variant B: card-style groups (from screenshot 2) with a right-side shift list.
  const exampleRows = React.useMemo(() => {
    if (!exampleLayout) return [];
    if (exampleVariant === 'B') {
      // sample groups similar to screenshot 2 (localized names simplified)
      const groups = [
        { name: 'ក្រុមលេខ១', employees: ['សោភា រ៉ែន', 'លក្ខា កុីន'] },
        { name: 'ក្រុមលេខ២', employees: ['អូន សុភា', 'ឡែន ទីង'] },
        { name: 'ក្រុមលេខ៣', employees: ['ឡេង លីណា', 'សុខ ស្រី'] },
        { name: 'ក្រុមលេខ៤', employees: ['រតនា ហួរ', 'ការ មិញ'] },
        { name: 'ក្រុមលេខ៥', employees: ['សុភា កា', 'គង់ បុត្រ'] },
      ];
      const pattern = [
        { id: 'R', title: 'R', color: '#fca5a5' },
        { id: 'D', title: 'D', color: '#60a5fa' },
        { id: 'G', title: 'G', color: '#60f0a3' },
        { id: 'DG', title: 'DG', color: '#93c5fd' },
      ];
      const out = [];
      groups.forEach((g, gi) => {
        g.employees.forEach((ename, ei) => {
          out.push({
            category: `grp-${gi}`,
            groupName: g.name,
            employeeRef: `${gi + 1}-${ei + 1}`,
            employee: { staffId: `${gi + 1}${ei + 1}`, khmerName: ename },
            groupShifts: pattern,
            groupIndex: gi,
            group: { name: g.name, startDayIndex: 0 },
          });
        });
      });
      return out;
    }
    // fallback / Variant A: A..G groups
    const groups = ['A','B','C','D','E','F','G'];
    const pattern = [
      { id: 'R', title: 'R', color: '#fca5a5' },
      { id: 'D', title: 'D', color: '#60a5fa' },
      { id: 'G', title: 'G', color: '#60f0a3' },
      { id: 'DG', title: 'DG', color: '#93c5fd' },
    ];
    const out = [];
    groups.forEach((g, gi) => {
      for (let r = 1; r <= 2; r += 1) {
        out.push({
          category: `grp-${g}`,
          groupName: `Group ${g}`,
          employeeRef: `${g}${r}`,
          employee: { staffId: `${gi + 1}${r}`, khmerName: `បុគ្គលិក ${g}${r}` },
          groupShifts: pattern,
          groupIndex: gi,
          group: { name: `Group ${g}`, startDayIndex: 0 },
        });
      }
    });
    return out;
  }, [exampleLayout, exampleVariant]);

  const displayRows = exampleLayout ? exampleRows : rows;

  // initialize phoneEdits when displayRows or allEmployees change
  React.useEffect(() => {
    try {
      const map = {};
      (displayRows || []).forEach(r => {
        const emp = r.employee || resolveEmployee(r.employeeRef) || lookupEmployeeById(r.employeeRef) || null;
        const key = String(getEmployeeId(emp || {}) || r.employeeRef || '');
        const raw = emp ? (emp.phone || emp.phoneNumber || emp.tel || emp.mobile || emp.contact || emp.mobilePhone || emp.phone_number || emp.telephone || emp.cell || '') : '';
        const p = normalizePhone(raw);
        if (key) map[key] = p;
      });
      setPhoneEdits(map);
    } catch (e) { /* ignore */ }
  }, [displayRows, allEmployees, normalizePhone]);

  

  // Helper to format day header (01, 02...)
  const dayHeader = (i) => String(i + 1).padStart(2, '0');

  const dayOffShift = React.useMemo(() => ({
    title: 'Day Off',
    start: '',
    end: '',
    shortTitle: 'Off',
    color: '#c92a2a',
  }), []);
  // per-cell overrides applied by bulk/column replace operations
  const scheduleOverrides = manualOverrides || {};
  const setScheduleOverrides = setManualOverrides || (() => {});

  const [replaceSrcInput, setReplaceSrcInput] = React.useState('');
  const [replaceTgtInput, setReplaceTgtInput] = React.useState('');
  const [onlyFirstSat, setOnlyFirstSat] = React.useState(false);
  const [onlyFirstSun, setOnlyFirstSun] = React.useState(false);
  const [includeSat, setIncludeSat] = React.useState(true);
  const [includeSun, setIncludeSun] = React.useState(true);
  // selected dates (indexes 0-based) for targeted replacements
  const [selectedDays, setSelectedDays] = React.useState(new Set());
  // master shift options from the `shifts` prop (used to pick replacement shifts)
  const masterShiftOptions = React.useMemo(() => {
    try {
      return (shifts || []).map(s => ({ id: s?.id || (s.title || `${s.start||''}-${s.end||''}`), label: (s.title || `${s.start||''}-${s.end||''}`) || '—', raw: s }));
    } catch (e) { return []; }
  }, [shifts]);
  // scope filters removed: replacements apply to all rows
  // selection mode: 'date' = pick explicit dates; 'weekday' = pick weekdays (e.g., all Mondays)
  const [selectedMode, setSelectedMode] = React.useState('date');
  // when in weekday mode, a Set of day-of-week numbers (0=Sun .. 6=Sat)
  const [selectedWeekdays, setSelectedWeekdays] = React.useState(new Set());
  const [includeDayOff, setIncludeDayOff] = React.useState(false);
  const weekdayLabels = React.useMemo(() => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], []);

  const toggleWeekday = React.useCallback((dow) => {
    setSelectedWeekdays(prev => {
      const next = new Set(prev);
      if (next.has(dow)) next.delete(dow); else next.add(dow);
      return next;
    });
  }, []);
  // category/group options removed
  // removed applyDate/applyTarget (single-date replace) per UI simplification

  // per-cell editing state
  const [editingCell, setEditingCell] = React.useState(null); // { empKey, dayIndex }

  // Build match options from preview data (unique time/title strings found in groupShifts)
  const matchOptions = React.useMemo(() => {
    try {
      const set = new Set();
      (rows || []).forEach(r => {
        const shifts = Array.isArray(r.groupShifts) ? r.groupShifts : [];
        shifts.forEach(s => {
          const label = (s && ((s.start || s.end) ? `${s.start || ''}-${s.end || ''}` : (s.title || ''))).toString().trim();
          if (label) set.add(label);
        });
      });
      return Array.from(set).sort();
    } catch (e) { return []; }
  }, [rows]);

  // Build replace options from pickedShiftsByCategory (flattened list)
  const replaceOptions = React.useMemo(() => {
    try {
      const arr = [];
      const catMap = pickedShiftsByCategory || {};
      Object.keys(catMap).forEach(k => {
        (catMap[k] || []).forEach(s => {
          const times = (s && ((s.start || s.end) ? `${s.start || ''}-${s.end || ''}` : '')) || '';
          const title = (s && (s.title || '') ) || '';
          const label = times ? (title ? `${times} — ${title}` : times) : (title || '');
          arr.push({ id: s?.id || label, label, raw: s });
        });
      });
      // include shifts that appear in the preview rows (groupShifts)
      (rows || []).forEach(r => {
        const shifts = Array.isArray(r.groupShifts) ? r.groupShifts : [];
        shifts.forEach(s => {
          const times = (s && ((s.start || s.end) ? `${s.start || ''}-${s.end || ''}` : '')) || '';
          const title = (s && (s.title || '') ) || '';
          const label = times ? (title ? `${times} — ${title}` : times) : (title || '');
          arr.push({ id: s?.id || label, label, raw: s });
        });
      });
      // unique by label
      const seen = new Set();
      const out = [];
      arr.forEach(x => { if (x.label && !seen.has(x.label)) { seen.add(x.label); out.push(x); } });
      return out;
    } catch (e) { return []; }
  }, [pickedShiftsByCategory]);

  // local color helper (similar to getColorForShift used elsewhere)
  const getColorForShift = React.useCallback((start, end) => {
    try {
      const parse = (t) => {
        if (!t) return null;
        const raw = String(t).trim();
        // strip AM/PM for numeric parse (we only need an approximate hour)
        const cleaned = raw.replace(/am/i, '').replace(/pm/i, '').trim();
        const parts = cleaned.split(':');
        if (parts.length < 1) return null;
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1] || '0', 10) || 0;
        return h + m / 60;
      };
      const s = parse(start || '');
      const e = parse(end || '');
      const mid = (s !== null && e !== null) ? ((s + e) / 2) : (s || e || 9);
      if (mid >= 5 && mid < 11) return '#16a34a';
      if (mid >= 11 && mid < 17) return '#0b74de';
      if (mid >= 17 && mid < 22) return '#f97316';
      return '#7c3aed';
    } catch (err) {
      return '#223366';
    }
  }, []);
  // try to find a color for a shift object by searching pickedShiftsByCategory
  const findShiftColor = React.useCallback((shift) => utilFindShiftColor(shift, { pickedShiftsByCategory, shifts, shiftTemplates }), [pickedShiftsByCategory, shifts, shiftTemplates]);
  const resolveShiftForDay = React.useCallback((row, dayIndex) => {
    const empKey = String(row.employeeRef || (row.employee && (row.employee.staffId || row.employee.id)) || '').trim();
    const overrideKey = `${empKey}-${dayIndex}`;
    if (scheduleOverrides && scheduleOverrides[overrideKey]) return scheduleOverrides[overrideKey];

    const date = new Date(monthMeta.year, monthMeta.month - 1, dayIndex + 1);
    if (Number.isNaN(date.getTime())) return null;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dow = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayKey = dayNames[dow];
    const isHoliday = normalizedHolidaySet.has(iso);

    // 1. Check for Custom Pattern (Standard/Flexible) from SubgroupEditModal
    if (row.group && row.group.customPattern) {
      const { mode, standard, flexible } = row.group.customPattern;
      
      if (mode === 'flexible' && flexible && flexible[currentDayKey]) {
        const config = flexible[currentDayKey];
        if (!config.work) return dayOffShift;
        return {
          title: `${config.start}-${config.end}`,
          start: config.start,
          end: config.end,
          color: getColorForShift(config.start, config.end),
          halfDay: config.halfDay
        };
      } 
      
      if (mode === 'standard' && standard) {
        const isWorkDay = standard.days && standard.days[currentDayKey];
        if (!isWorkDay) return dayOffShift;
        return {
          title: `${standard.start}-${standard.end}`,
          start: standard.start,
          end: standard.end,
          color: getColorForShift(standard.start, standard.end),
          halfDay: standard.halfDay
        };
      }
    }

    // 2. Default Rotation Logic
    const shifts = Array.isArray(row.groupShifts) && row.groupShifts.length ? row.groupShifts : [];
    const shiftsLen = Math.max(1, shifts.length);
    const startDayIndex = Math.max(0, Number((row.group && row.group.startDayIndex) ?? row.groupIndex ?? 0));

    let desiredStartIndex = null;
    try {
      if (row.group) {
        if (typeof row.group.startShiftIndex === 'number' && Number.isFinite(row.group.startShiftIndex)) {
          desiredStartIndex = Number(row.group.startShiftIndex);
        } else if (typeof row.group.startShift === 'string' && row.group.startShift.trim()) {
          const want = row.group.startShift.trim().toLowerCase();
          const found = shifts.findIndex(s => {
            const label = (s && ((s.start || s.end) ? `${s.start || ''}-${s.end || ''}` : (s.title || ''))).toString().trim().toLowerCase();
            return label === want || (s.title || '').toString().trim().toLowerCase() === want || (s.shortTitle || '').toString().trim().toLowerCase() === want;
          });
          if (found >= 0) desiredStartIndex = found;
        }
      }
    } catch (e) { desiredStartIndex = null; }

    let baseIndex;
    if (desiredStartIndex !== null && Number.isFinite(desiredStartIndex)) {
      baseIndex = ((desiredStartIndex - startDayIndex) % shiftsLen + shiftsLen) % shiftsLen;
    } else {
      baseIndex = Math.max(0, row.groupIndex || 0) % shiftsLen;
    }

    const shiftIndex = (baseIndex + dayIndex) % shiftsLen;
    const baseShift = shifts[shiftIndex] || null;

    const isWeekend = dow === 0 || dow === 6;
    const isSunday = dow === 0;
    const isSaturday = dow === 6;

    if (isHoliday) {
      try {
        if (row.group && row.group.customPattern && row.group.customPattern.holidayRotation === 'alternate') {
          const holidaysArr = Array.from(normalizedHolidaySet || []).sort();
          const hIdx = holidaysArr.indexOf(iso);
          if (hIdx >= 0) {
            const empPos = Math.max(0, typeof row.groupIndex === 'number' ? row.groupIndex : 0);
            if (hIdx % 2 === empPos % 2) return dayOffShift;
          }
        }
      } catch (e) {}

      if (baseShift && ((baseShift.title || '').toLowerCase().includes('day off') || (!baseShift.start && !baseShift.end))) return baseShift;
      if (baseShift && baseShift.holidayWork) return baseShift;
      return dayOffShift;
    }

    if (isWeekend) {
      try {
        // 1. Check explicit customPattern rotation from SubgroupEditModal
        if (row.group && row.group.customPattern && row.group.customPattern.weekendRotation && row.group.customPattern.weekendRotation !== 'none') {
           const wrm = row.group.customPattern.weekendRotation;
           const empPos = Math.max(0, typeof row.groupIndex === 'number' ? row.groupIndex : 0);
           if (wrm === 'alternateDays') {
             if (isSaturday) return (empPos % 2 === 0) ? baseShift : dayOffShift;
             if (isSunday) return (empPos % 2 === 1) ? baseShift : dayOffShift;
           } else if (wrm === 'alternateWeeks') {
             const dClone = new Date(date);
             const diffToMon = dClone.getDay() === 0 ? -6 : 1 - dClone.getDay();
             dClone.setDate(dClone.getDate() + diffToMon);
             const weekIndex = Math.floor(dClone.getTime() / (86400000 * 7));
             return (weekIndex % 2 === empPos % 2) ? dayOffShift : baseShift;
           }
        }

        const groupKey = (() => {
          try {
            const nm = String(row.groupName || row.category || '').trim();
            if (/^[A-G]$/i.test(nm)) return nm.toUpperCase();
            const m = /^group\s*([A-G])$/i.exec(nm);
            if (m && m[1]) return m[1].toUpperCase();
          } catch (e) {}
          return '';
        })();
        const baseCode = (() => {
          try {
            if (!baseShift) return '';
            const short = String(baseShift.shortTitle || '').toUpperCase();
            if (short === 'G') return 'G';
            const t = String((baseShift.title || `${baseShift.start||''}-${baseShift.end||''}`) || '').toLowerCase();
            if (t.includes('7:30') || t.includes('7:30am')) return 'G';
            return '';
          } catch (e) { return ''; }
        })();
        if (groupKey === 'G' && String(baseCode) === 'G' && weekendRotationMode && weekendRotationMode !== 'none') {
          let empPos = -1;
          try {
            const members = Array.isArray(row.group && row.group.employees) ? row.group.employees : null;
            if (members && members.length) {
              empPos = members.findIndex(x => String(x) === String(row.employeeRef));
            }
          } catch (e) { empPos = -1; }
          if (empPos < 0) {
            const s = String(row.employeeRef || '');
            let sum = 0;
            for (let i = 0; i < s.length; i += 1) sum += s.charCodeAt(i) || 0;
            empPos = sum % 2;
          }
          if (weekendRotationMode === 'alternateDays') {
            if (isSaturday) return (empPos % 2 === 0) ? baseShift : dayOffShift;
            if (isSunday) return (empPos % 2 === 1) ? baseShift : dayOffShift;
          } else if (weekendRotationMode === 'alternateWeeks') {
            const weekIndex = Math.floor((date.getDate() - 1) / 7);
            return ((weekIndex % 2) === (empPos % 2)) ? baseShift : dayOffShift;
          }
        }
      } catch (e) {}
      if (baseShift && ((baseShift.title || '').toLowerCase().includes('day off') || (!baseShift.start && !baseShift.end))) return baseShift;
      if (isSaturday && baseShift && baseShift.weekendWorkSaturday) return baseShift;
      if (isSunday && baseShift && baseShift.weekendWorkSunday) return baseShift;
      return dayOffShift;
    }
    return baseShift;
  }, [monthMeta, normalizedHolidaySet, dayOffShift, weekendRotationMode]);

  const toggleSelectedDay = React.useCallback((dayIndex) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex); else next.add(dayIndex);
      return next;
    });
  }, []);

  // Save overrides to backend (uses existing POST /api/schedule-overrides route)
  const saveOverrides = React.useCallback(async (overridesObj) => {
    try {
      const entries = Object.entries(overridesObj || {});
      const items = [];
      let prefailed = 0;
      for (const [key, sh] of entries) {
        try {
          const lastDash = String(key).lastIndexOf('-');
          if (lastDash < 0) { prefailed += 1; continue; }
          const empKey = String(key).slice(0, lastDash);
          const di = parseInt(String(key).slice(lastDash + 1), 10);
          if (!empKey || !Number.isFinite(di)) { prefailed += 1; continue; }
          const date = `${monthMeta.year}-${String(monthMeta.month).padStart(2,'0')}-${String(di + 1).padStart(2,'0')}`;
          items.push({
            employeeRef: empKey,
            date,
            shiftTitle: sh.title || sh.shortTitle || `${sh.start||''}-${sh.end||''}`,
            shiftStart: sh.start || '',
            shiftEnd: sh.end || '',
            shiftColor: sh.color || '',
            notes: sh.notes || '',
          });
        } catch (err) { prefailed += 1; }
      }
      if (items.length === 0) return { saved: 0, failed: prefailed, total: entries.length };

      const res = await fetch('/api/schedule-overrides/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items })
      });
      if (!res.ok) {
        return { saved: 0, failed: entries.length, total: entries.length };
      }
      const body = await res.json();
      // best-effort counts from bulk result
      const result = body && body.result ? body.result : {};
      const upserted = result.upsertedCount || result.upserted || (result.upsertedIds ? Object.keys(result.upsertedIds).length : 0) || 0;
      const modified = result.modifiedCount || result.modified || 0;
      const saved = upserted + modified;
      const failed = Math.max(0, entries.length - saved);
      return { saved, failed: failed + prefailed, total: entries.length };
    } catch (err) {
      return { saved: 0, failed: 0, total: 0 };
    }
  }, [monthMeta]);

  // Load persisted overrides for the visible month range and merge into state
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const start = `${monthMeta.year}-${String(monthMeta.month).padStart(2,'0')}-01`;
        const end = `${monthMeta.year}-${String(monthMeta.month).padStart(2,'0')}-${String(monthDays).padStart(2,'0')}`;
        const url = `/api/schedule-overrides?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const body = await res.json();
        if (!body || !Array.isArray(body.data)) return;
        const serverList = body.data;
        // transform server overrides into local keys { '<empRef>-<dayIndex>': shiftObj }
        const remoteOverrides = {};
        serverList.forEach((ov) => {
          try {
            const empRef = ov.employeeRef || ov.employee || ov.employeeId || '';
            if (!empRef) return;
            const date = new Date(ov.date);
            if (Number.isNaN(date.getTime())) return;
            if (date.getFullYear() !== monthMeta.year || (date.getMonth() + 1) !== monthMeta.month) return;
            const di = date.getDate() - 1; // 0-based
            const key = `${empRef}-${di}`;
            const shift = {
              title: ov.shiftTitle || ov.title || ov.shift?.title || '',
              start: ov.shiftStart || ov.shift?.start || '',
              end: ov.shiftEnd || ov.shift?.end || '',
              color: ov.shiftColor || ov.shift?.color || '',
              notes: ov.notes || '',
            };
            remoteOverrides[key] = shift;
          } catch (e) { /* ignore individual parse errors */ }
        });
        if (cancelled) return;
        // Merge: existing in-memory overrides take precedence; server fills missing ones
        setScheduleOverrides(prev => ({ ...(remoteOverrides || {}), ...(prev || {}) }));
      } catch (err) {
        // ignore fetch errors silently for now
      }
    })();
    return () => { cancelled = true; };
  }, [monthMeta, monthDays]);

  // Apply replacement shift (chosen from masterShiftOptions) to all rows for the currently selected days.
  // If replaceSrcInput is empty, replace any non-day-off cell; otherwise only replace when current cell matches the src string.
  const applyReplacementToSelectedDates = React.useCallback((shiftId) => {
    if (!shiftId) { alert('Please choose a replacement shift.'); return; }
    const chosen = masterShiftOptions.find(s => String(s.id) === String(shiftId));
    if (!chosen || !chosen.raw) { alert('Selected shift not found.'); return; }
    const srcLower = String(replaceSrcInput || '').toLowerCase();
    const targetRaw = chosen.raw;
    // create a shallow copy for overrides
    const next = { ...(scheduleOverrides || {}) };
    let replaced = 0;
    // compute target day indexes depending on selection mode
    let targetIndexes = [];
    if (selectedMode === 'weekday' && selectedWeekdays && selectedWeekdays.size > 0) {
      // collect all days in the month matching selected weekdays
      for (let i = 0; i < monthDays; i += 1) {
        const date = new Date(monthMeta.year, monthMeta.month - 1, i + 1);
        const dow = date.getDay();
        if (!selectedWeekdays.has(dow)) continue;
        // respect includeSat/includeSun
        if (dow === 6 && !includeSat) continue;
        if (dow === 0 && !includeSun) continue;
        targetIndexes.push(i);
      }
      // apply onlyFirstSat / onlyFirstSun if requested: keep only first occurrence per dow
      if (onlyFirstSat || onlyFirstSun) {
        const first = {};
        targetIndexes.forEach(i => {
          const d = new Date(monthMeta.year, monthMeta.month - 1, i + 1);
          const dow = d.getDay();
          if ((dow === 6 && onlyFirstSat) || (dow === 0 && onlyFirstSun)) {
            if (first[dow] === undefined) first[dow] = i;
          }
        });
        const picks = [];
        if (onlyFirstSat && first[6] !== undefined) picks.push(first[6]);
        if (onlyFirstSun && first[0] !== undefined) picks.push(first[0]);
        // include other dow occurrences if not flagged as onlyFirst
        if (!onlyFirstSat) picks.push(...targetIndexes.filter(i => new Date(monthMeta.year, monthMeta.month - 1, i + 1).getDay() === 6));
        if (!onlyFirstSun) picks.push(...targetIndexes.filter(i => new Date(monthMeta.year, monthMeta.month - 1, i + 1).getDay() === 0));
        targetIndexes = Array.from(new Set(picks));
      }
    } else {
      // explicit date selection mode
      targetIndexes = Array.from(selectedDays || new Set());
    }

    // iterate target indexes and apply same replacement logic as before
    targetIndexes.forEach((di) => {
      rows.forEach((r) => {
        try {
          const current = resolveShiftForDay(r, di) || null;
          if (!current) return;
          const title = (current.title || `${current.start || ''}-${current.end || ''}`).toString().toLowerCase();
          const times = `${current.start || ''}-${current.end || ''}`.toLowerCase();
          // determine whether to replace (respect includeDayOff)
          const isDayOffTitle = title.includes('day off') || title.includes('off');
          const shouldReplace = srcLower ? (title.includes(srcLower) || times.includes(srcLower)) : (includeDayOff ? true : !isDayOffTitle);
          if (!shouldReplace) return;
          const empKey = String(r.employeeRef || (r.employee && (r.employee.staffId || r.employee.id)) || '').trim();
          const overrideKey = `${empKey}-${di}`;
          // build override object from targetRaw; prefer existing color or compute one
          const overrideShift = { ...targetRaw };
          if (!overrideShift.color) {
            overrideShift.color = getColorForShift(overrideShift.start, overrideShift.end) || '#0b74de';
          }
          next[overrideKey] = overrideShift;
          replaced += 1;
        } catch (e) { /* ignore per-row errors */ }
      });
    });
    setScheduleOverrides(next);
    // try saving overrides to backend
    (async () => {
      try {
        const result = await saveOverrides(next);
        alert(`Applied replacement to ${replaced} cells on ${targetIndexes.length} selected date(s).\nSaved: ${result.saved}, Failed: ${result.failed}`);
      } catch (err) {
        alert(`Applied replacement to ${replaced} cells on ${targetIndexes.length} selected date(s).\nBut failed to save overrides to server.`);
      }
    })();
  }, [masterShiftOptions, selectedDays, rows, resolveShiftForDay, scheduleOverrides, replaceSrcInput, getColorForShift]);

  // Replace shifts in a specific day column for weekend/holiday cells
  const handleReplaceForDay = React.useCallback((dayIndex, srcOverride, tgtOverride) => {
    // use provided overrides (from toolbar) if present, otherwise ask the user
    const src = (typeof srcOverride === 'string' && srcOverride.length > 0) ? srcOverride : (replaceSrcInput || window.prompt('Replace which shift? Enter exact title or time substring (e.g. "8:00AM-4:00PM" or "8:00AM")'));
    if (!src) return;
    const tgt = (typeof tgtOverride === 'string' && tgtOverride.length > 0) ? tgtOverride : (replaceTgtInput || window.prompt('Replace with (enter title or start-end like "08:00-16:00" or "4:00PM-8:00AM"):'));
    if (!tgt) return;
    const srcLower = String(src || '').toLowerCase();
    const parts = String(tgt || '').split('-').map(s => s.trim()).filter(Boolean);
    const targetShift = { id: `ov-${Date.now()}`, title: tgt, start: '', end: '', shortTitle: tgt, color: '#0b74de' };
    if (parts.length >= 2) {
      targetShift.start = parts[0];
      targetShift.end = parts[1];
      targetShift.color = getColorForShift(targetShift.start, targetShift.end);
    } else {
      // keep provided text as title; color default stays
      targetShift.color = '#0b74de';
    }

    let replaced = 0;
    const next = { ...(scheduleOverrides || {}) };
    rows.forEach((r, idx) => {
      try {
        const date = new Date(monthMeta.year, monthMeta.month - 1, dayIndex + 1);
        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const isHoliday = normalizedHolidaySet.has(iso);
        if (!(isWeekend || isHoliday)) return; // only operate on weekend/holiday cells
        const current = resolveShiftForDay(r, dayIndex) || null;
        if (!current) return;
        const title = (current.title || `${current.start || ''}-${current.end || ''}`).toString().toLowerCase();
        const times = `${current.start || ''}-${current.end || ''}`.toLowerCase();
        if (title.includes(srcLower) || times.includes(srcLower)) {
          const empKey = String(r.employeeRef || (r.employee && (r.employee.staffId || r.employee.id)) || '').trim();
          const overrideKey = `${empKey}-${dayIndex}`;
          next[overrideKey] = { ...targetShift };
          replaced += 1;
        }
      } catch (e) {
        // ignore per-row failures
      }
    });
    setScheduleOverrides(next);
    alert(`Replaced ${replaced} cells on that day.`);
  }, [rows, monthMeta, normalizedHolidaySet, resolveShiftForDay, scheduleOverrides, getColorForShift]);

  // (previous prompt-based replace handler removed — use handleReplaceWholeMonth instead)

  // One-click apply replace to the whole month using toolbar inputs (no additional prompts)
  const handleReplaceWholeMonth = React.useCallback(() => {
    const src = (replaceSrcInput && replaceSrcInput.length > 0) ? replaceSrcInput : '';
    const tgt = (replaceTgtInput && replaceTgtInput.length > 0) ? replaceTgtInput : '';
    if (!src) {
      alert('Please enter a Match value in the toolbar (e.g. 8:00AM-4:00PM)');
      return;
    }
    if (!tgt) {
      alert('Please enter a Replace value or choose a shift in the "Replace with" select.');
      return;
    }
    // build weekend/holiday candidate indices
    const candidateIndices = [];
    for (let i = 0; i < monthDays; i += 1) {
      const date = new Date(monthMeta.year, monthMeta.month - 1, i + 1);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const isHoliday = normalizedHolidaySet.has(iso);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (isWeekend || isHoliday) candidateIndices.push({ i, dow: date.getDay() });
    }
    if (candidateIndices.length === 0) {
      alert('No weekend/holiday columns found in the current month.');
      return;
    }

    // apply include filters
    let filtered = candidateIndices.filter(c => {
      if (c.dow === 6 && !includeSat) return false;
      if (c.dow === 0 && !includeSun) return false;
      return true;
    });
    if (filtered.length === 0) {
      alert('No weekend/holiday columns found matching the selected weekend filters.');
      return;
    }

    // onlyFirst filters
    let targets = filtered.map(c => c.i);
    if (onlyFirstSat || onlyFirstSun) {
      const firstByDow = {};
      for (const c of candidateIndices) {
        if (c.dow === 6 && onlyFirstSat && firstByDow['6'] === undefined) firstByDow['6'] = c.i;
        if (c.dow === 0 && onlyFirstSun && firstByDow['0'] === undefined) firstByDow['0'] = c.i;
      }
      const picks = [];
      if (onlyFirstSat && firstByDow['6'] !== undefined) picks.push(firstByDow['6']);
      if (onlyFirstSun && firstByDow['0'] !== undefined) picks.push(firstByDow['0']);
      if (!onlyFirstSat) picks.push(...candidateIndices.filter(c => c.dow === 6).map(c => c.i));
      if (!onlyFirstSun) picks.push(...candidateIndices.filter(c => c.dow === 0).map(c => c.i));
      targets = Array.from(new Set(picks));
    }

    // count matches
    const srcLower = String(src).toLowerCase();
    let totalCount = 0;
    targets.forEach((idx) => {
      rows.forEach((r) => {
        try {
          const current = resolveShiftForDay(r, idx) || null;
          if (!current) return;
          const title = (current.title || `${current.start || ''}-${current.end || ''}`).toString().toLowerCase();
          const times = `${current.start || ''}-${current.end || ''}`.toLowerCase();
          if (title.includes(srcLower) || times.includes(srcLower)) totalCount += 1;
        } catch (e) {}
      });
    });
    if (totalCount === 0) {
      alert('No matching weekend/holiday cells found to replace for the current month.');
      return;
    }

    if (!window.confirm(`This will replace ${totalCount} cells across the month. Proceed?`)) return;

    // apply
    let applied = 0;
    targets.forEach(idx => {
      const before = Object.keys(scheduleOverrides || {}).length;
      handleReplaceForDay(idx, src, tgt);
      const after = Object.keys(scheduleOverrides || {}).length;
      applied += Math.max(0, after - before);
    });
    alert(`Applied replacements to ${totalCount} cells (created ${applied} overrides).`);
  }, [monthMeta, monthDays, normalizedHolidaySet, replaceSrcInput, replaceTgtInput, includeSat, includeSun, onlyFirstSat, onlyFirstSun, rows, resolveShiftForDay, handleReplaceForDay, scheduleOverrides]);

  const exportExcel = React.useCallback(() => {
    try {
      const dayCols = Array.from({ length: displayTotalDays }).map((_, i) => dayHeader(i));
      const header = ['ល.រ', 'លេខកាត', 'ឈ្មោះ', ...dayCols];
      // build body rows using scheduleByDay for consistent per-date values
      const body = displayRows.map((r, idx) => {
        const employeeRecord = r.employee || lookupEmployeeById(r.employeeRef) || null;
        const employeeId = employeeRecord ? getEmployeeId(employeeRecord) : String(r.employeeRef || '');
        const employeeName = employeeRecord ? (employeeRecord.khmerName || employeeRecord.fullName || employeeRecord.name || '') : String(r.employeeRef || '');
        const rowData = [idx + 1, employeeId, employeeName];
        for (let di = 0; di < displayTotalDays; di += 1) {
          const date = new Date(monthMeta.year, monthMeta.month - 1, di + 1);
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const list = scheduleByDay[iso] || [];
          // find shift for this row by matching employeeRef
          const found = list.find(x => String(x.employeeRef) === String(r.employeeRef) || String(x.employeeId) === String(getEmployeeId(r.employee || {}) || '')) || null;
          const title = found && found.shift ? (found.shift.title || `${found.shift.start || ''}-${found.shift.end || ''}`) : '';
          rowData.push(title);
        }
        return rowData;
      });

      // Title rows to include in Excel (plain text versions of printable header)
      const titleRow1 = ['ព្រះរាជាណាចក្រកម្ពុជា'];
      const titleRow2 = ['ក្រសួងសុខាភិបាល និងសង្គម'];
      const titleRow3 = ['ក្រុមការងារ និងកំណត់ម៉ោង'];
      const titleRow4 = [`${displayMonthLabel}`];

      // Compose final sheet AoA: title rows, month row, header, then body
      const sheetAoA = [
        titleRow1.concat(Array(header.length - 1).fill('')),
        titleRow2.concat(Array(header.length - 1).fill('')),
        titleRow3.concat(Array(header.length - 1).fill('')),
        titleRow4.concat(Array(header.length - 1).fill('')),
        header,
        ...body,
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sheetAoA);
      // merge title rows across all columns
      const totalCols = sheetAoA[4].length; // header index
      worksheet['!merges'] = worksheet['!merges'] || [];
      worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
      worksheet['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });
      worksheet['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } });
      worksheet['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } });

      // set column widths
      worksheet['!cols'] = header.map((_, index) => ({ wch: index < 3 ? 16 : 14 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule');
      const filename = `schedule-${isoMonthTag}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Failed to export schedule Excel', err);
      alert('មានបញ្ហាក្នុងការទាញ Excel។');
    }
  }, [rows, monthDays, dayHeader, resolveShiftForDay, lookupEmployeeById, isoMonthTag]);

  // selected example group (A..G) or real group names
  const [selectedGroupForReport, setSelectedGroupForReport] = React.useState('A');
  const [showGroupReport, setShowGroupReport] = React.useState(false);

  // Default Khmer labels for main categories A..G (override via groupLabelMap)
  const defaultGroupLabelMap = React.useMemo(() => ({
    A: 'គ្រូពេទ្យ',
    B: 'ថែទាំ',
    C: 'អនាម័យ',
    D: 'មិនប្រចាំការ',
    E: 'ក្រុម E',
    F: 'ក្រុម F',
    G: 'ក្រុម G',
  }), []);
  const labelMap = React.useMemo(() => ({ ...defaultGroupLabelMap, ...(groupLabelMap || {}) }), [defaultGroupLabelMap, groupLabelMap]);

  // Helper to extract a group key letter (A..G) from names like "A" or "Group A"
  const groupKeyFromName = React.useCallback((name) => {
    if (!name) return '';
    const raw = String(name).trim();
    // Exact single letter A..G
    if (/^[A-G]$/i.test(raw)) return raw.toUpperCase();
    // "Group A" or "Group  A" in any case
    const m = /^group\s*([A-G])$/i.exec(raw);
    if (m && m[1]) return m[1].toUpperCase();
    return '';
  }, []);

  // Shared short code helper used by both main preview and group print/preview
  const shortCodeForShift = React.useCallback((sh) => {
    if (!sh) return '';
    const t = (sh.title || `${sh.start||''}-${sh.end||''}`).toString().toLowerCase();
    if (t.includes('day off') || t.includes('off')) return 'R';
    if ((sh.shortTitle || '').toString().toLowerCase() === 'dg' || t.includes('dg')) return 'DG';
    if (t.includes('7:30') || t.includes('7:30am') || (sh && ((sh.start||'').toString().includes('07') || (sh.start||'').toString().includes('7:30')))) return 'G';
    if (t.includes('3:30') || t.includes('15:30') || t.includes('3:30pm') || (sh && ((sh.end||'').toString().includes('15') || (sh.end||'').toString().includes('3:30')))) return 'D';
    const maybe = (sh.shortTitle || sh.title || '').toString().trim().toUpperCase();
    return maybe || '';
  }, []);

  // Build legend items from displayRows (unique codes -> label, color)
  const legendItems = React.useMemo(() => {
    try {
      const map = {};
      const rows = displayRows || [];
      for (let r of rows) {
        for (let di = 0; di < (displayTotalDays || 0); di += 1) {
          const sh = (exampleLayout ? (r.groupShifts && r.groupShifts[di % (r.groupShifts.length || 1)]) : resolveShiftForDay(r, di));
          const code = shortCodeForShift(sh);
          if (!code) continue;
          const color = (sh && (sh.color || findShiftColor(sh))) || '#9ca3af';
          const label = sh ? (sh.title || `${sh.start||''}-${sh.end||''}`) : code;
          if (!map[code]) map[code] = { code, label, color };
        }
      }
      return Object.values(map);
    } catch (e) { return []; }
  }, [displayRows, displayTotalDays, exampleLayout, resolveShiftForDay, shortCodeForShift]);

  // Custom color & label map state (user-editable). Stored as { [code]: { color: '#rrggbb', opacity: 1, label: 'R' } }
  const COLOR_STORAGE_KEY = 'groupReportCustomColors_v1';
  const [customColors, setCustomColors] = React.useState(() => {
    try {
      const raw = window.localStorage.getItem(COLOR_STORAGE_KEY) || '{}';
      const parsed = JSON.parse(raw || '{}');
      return parsed || {};
    } catch (e) { return {}; }
  });
  const [showColorEditor, setShowColorEditor] = React.useState(false);

  // Ensure default entries exist for legendItems
  React.useEffect(() => {
    try {
      const next = { ...(customColors || {}) };
      (legendItems || []).forEach(li => {
        const code = String(li.code || '').trim();
        if (!code) return;
        if (!next[code]) next[code] = { color: (li.color || '#9ca3af'), opacity: 1, label: code };
      });
      setCustomColors(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch (e) {}
  }, [legendItems]);

  const saveCustomColors = (map) => {
    try {
      const toSave = map || customColors || {};
      window.localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(toSave));
      setCustomColors({ ...(toSave) });
    } catch (e) { /* ignore */ }
  };

  const resetCustomColors = () => {
    try {
      window.localStorage.removeItem(COLOR_STORAGE_KEY);
      setCustomColors({});
    } catch (e) {}
  };

  const hexToRgb = (hex) => {
    try {
      const h = String(hex || '').replace('#','').trim();
      if (h.length === 3) {
        return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
      }
      return { r: parseInt(h.substring(0,2),16), g: parseInt(h.substring(2,4),16), b: parseInt(h.substring(4,6),16) };
    } catch (e) { return { r: 156, g: 163, b: 175 }; }
  };

  // Compute the final customColorMap passed to builder: code -> rgba(...) string
  const computedCustomColorMap = React.useMemo(() => {
    try {
      const out = {};
      Object.keys(customColors || {}).forEach(code => {
        const entry = customColors[code] || {};
        const hex = entry.color || '#9ca3af';
        const op = (typeof entry.opacity === 'number') ? Math.max(0, Math.min(1, entry.opacity)) : 1;
        const { r, g, b } = hexToRgb(hex);
        out[code] = `rgba(${r},${g},${b},${op})`;
      });
      return out;
    } catch (e) { return {}; }
  }, [customColors]);

  // Compute badge label map { code: label }
  const computedBadgeLabelMap = React.useMemo(() => {
    try {
      const out = {};
      Object.keys(customColors || {}).forEach(code => {
        const entry = customColors[code] || {};
        if (entry && typeof entry.label === 'string' && entry.label.trim()) out[code] = String(entry.label).trim();
      });
      return out;
    } catch (e) { return {}; }
  }, [customColors]);

  // Build list of available main categories for report dropdown
  const availableGroupNames = React.useMemo(() => {
    if (exampleLayout) {
      // In example/demo mode, show letters A..G as categories
      return ['A','B','C','D','E','F','G'];
    }
    // Real data: categories from input order
    return categoryOrder && categoryOrder.length ? [...categoryOrder] : [];
  }, [exampleLayout, categoryOrder]);

  // ensure selectedGroupForReport is valid when available groups change
  React.useEffect(() => {
    if (!availableGroupNames || availableGroupNames.length === 0) return;
    if (!availableGroupNames.includes(selectedGroupForReport)) {
      setSelectedGroupForReport(availableGroupNames[0]);
    }
  }, [availableGroupNames, selectedGroupForReport]);

  

  // Export a single-group report that follows the compact Khmer layout (image 1 style).
  const exportGroupReport = React.useCallback((groupName) => {
    try {
      if (!groupName) { alert('Please select a group to export.'); return; }
      // Filter rows that belong to the selected main category (includes all child subgroups in order)
  const selectedCategory = String(groupName).trim();
  const groupRows = (displayRows || []).filter(r => groupKeyFromName(r.category) === groupKeyFromName(selectedCategory));

      if (!groupRows.length) { alert('No rows found for selected group.'); return; }

      // Prepare subgroup display like preview (ទី១/ទី២/…)
      const toKhmerDigits = (numStr) => {
        const kh = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
        return String(numStr).split('').map(ch => (ch >= '0' && ch <= '9') ? kh[parseInt(ch,10)] : ch).join('');
      };
      const formatSubgroupLabel = (name) => {
        if (!name) return '';
        const s = String(name);
        const m = s.match(/[0-9០-៩]+/);
        if (m && m[0]) {
          const token = m[0];
          const hasKhmer = /[០-៩]/.test(token);
          return `ទី${hasKhmer ? token : toKhmerDigits(token)}`;
        }
        if (s.includes('ទី')) return s;
        return s;
      };

      // Sort rows by subgroup ordinal (ទី១, ទី២, ...) then by employee name
      const khmerToArabic = (s) => String(s || '').replace(/[០-៩]/g, ch => '០១២៣៤៥៦៧៨៩'.indexOf(ch));
      const parseOrdinalNumber = (name) => {
        if (!name) return Number.NaN;
        const m = String(name).match(/[0-9០-៩]+/);
        if (!m || !m[0]) return Number.NaN;
        const arabic = khmerToArabic(m[0]);
        const n = parseInt(arabic, 10);
        return Number.isFinite(n) ? n : Number.NaN;
      };
      const sorted = [...groupRows].sort((a, b) => {
        const an = parseOrdinalNumber(a.groupName || a.group?.name || '');
        const bn = parseOrdinalNumber(b.groupName || b.group?.name || '');
        if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
        const aname = (a.employee?.khmerName || a.employee?.fullName || a.employee?.name || String(a.employeeRef || '')).toString();
        const bname = (b.employee?.khmerName || b.employee?.fullName || b.employee?.name || String(b.employeeRef || '')).toString();
        return aname.localeCompare(bname, 'km-KH');
      });

  // Build header rows: big title rows then column headers (Group, Name, Phone, Day 01..)
  const headerTitle = ['ក្រុមប្រឹក្សាផ្អែក', '', ''];
  const headerSub = [`${displayMonthLabel}`, '', ''];
  const groupTotalDays = monthDays; // Always export full month
  const dayCols = Array.from({ length: groupTotalDays }).map((_, i) => dayHeader(i));
      const header = ['ក្រុម', 'គោត្តនាម និងនាម', 'លេខទូរស័ព្ទ', ...dayCols];

      // use shared shortCodeForShift helper defined above

      // Build body rows: each should contain short codes per day
      // Build row data with subgroup label and codes
      const rowsData = sorted.map((r) => {
        const emp = r.employee || lookupEmployeeById(r.employeeRef) || null;
        const subgroup = r.groupName || (r.group && r.group.name) || '';
        const subgroupDisplay = formatSubgroupLabel(subgroup);
        const name = emp ? (emp.khmerName || emp.fullName || emp.name || '') : String(r.employeeRef || '');
        const phone = emp ? (emp.phone || emp.phoneNumber || emp.tel || emp.mobile || emp.contact || '') : '';
        // format for display
        let formattedPhone = phone;
        try { formattedPhone = require('../utils/formatPhone').formatPhoneDisplay(phone); } catch (e) {}
        const codes = Array.from({ length: groupTotalDays }).map((_, di) => {
          const sh = (exampleLayout ? (r.groupShifts && r.groupShifts[di % (r.groupShifts.length || 1)]) : resolveShiftForDay(r, di));
          return shortCodeForShift(sh) || '';
        });
        return { subgroupDisplay, name, phone, codes };
      });

      // Group rows by subgroup, then within each subgroup combine identical code patterns
      const groupMap = new Map();
      rowsData.forEach(r => {
        const key = r.subgroupDisplay || '';
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(r);
      });

      const body = [];
      const merges = [];
      let bodyRowIndex = 0; // 0-based within body only
      Array.from(groupMap.entries()).forEach(([key, list]) => {
        // combine by signature of codes
        const bySig = new Map();
        list.forEach(r => {
          const sig = (r.codes || []).join('|');
          if (!bySig.has(sig)) bySig.set(sig, { names: [], phones: new Set(), codes: r.codes });
          bySig.get(sig).names.push(r.name || '');
          const p = (r.phone || '').toString().trim();
          if (p) bySig.get(sig).phones.add(p);
        });
        const combined = Array.from(bySig.values()).sort((a, b) => String(a.names[0] || '').localeCompare(String(b.names[0] || ''), 'km-KH'));
        combined.forEach((rowData, i) => {
          const namesCell = rowData.names.join('\n');
          const phoneCell = Array.from(rowData.phones).join(', ');
          const row = [i === 0 ? key : '', namesCell, phoneCell, ...rowData.codes];
          body.push(row);
        });
        const span = combined.length;
        if (span > 1) {
          const start = 3 + bodyRowIndex; // header rows offset (2 titles + 1 header)
          const end = start + span - 1;
          merges.push({ s: { r: start, c: 0 }, e: { r: end, c: 0 } });
        }
        bodyRowIndex += span;
      });

      // Compose sheet data with a couple of title rows then header+body
  const sheetAoA = [
  headerTitle.concat(Array(groupTotalDays).fill('')),
  headerSub.concat(Array(groupTotalDays).fill('')),
        header,
        ...body,
        // legend row(s)
        [],
    ['Legend:', '', '', ...Array(groupTotalDays - 1).fill('')],
  ['R = Day Off', '', '', ...Array(groupTotalDays - 1).fill('')],
  ['DG', '', '', ...Array(groupTotalDays - 1).fill('')],
  ['G', '', '', ...Array(groupTotalDays - 1).fill('')],
  ['D', '', '', ...Array(groupTotalDays - 1).fill('')],
      ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetAoA);
  // set column widths: first three wider (Group, Name, Phone)
  worksheet['!cols'] = sheetAoA[2].map((_, i) => ({ wch: i === 0 ? 12 : (i === 1 ? 18 : (i === 2 ? 14 : 4)) }));
  if (merges.length) worksheet['!merges'] = merges;
      // apply some basic styling for header row (if using XLSX full style support it's complex; keep simple)

  const workbook = XLSX.utils.book_new();
  const sheetName = labelMap[groupName] ? `${labelMap[groupName]}` : `Group-${groupName}`;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
  const fileLabel = labelMap[groupName] ? labelMap[groupName].replace(/\s+/g, '_') : `group-${groupName}`;
  const filename = `schedule-${isoMonthTag}-${fileLabel}.xlsx`;
      XLSX.writeFile(workbook, filename);
      // ensure title rows are merged across sheet (we added headerTitle and headerSub at top)
      try {
        worksheet['!merges'] = worksheet['!merges'] || [];
        const totalCols = sheetAoA[2].length; // header row index
        // merge first two title rows across all columns
        worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } });
        worksheet['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } });
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('Failed to export group report', err);
      alert('មានបញ្ហាក្នុងការទាញរបាយការណ៍ក្រុម។');
    }
  }, [displayRows, displayTotalDays, dayHeader, exampleLayout, exampleVariant, exampleRows, isoMonthTag, lookupEmployeeById, monthMeta, resolveShiftForDay, lookupEmployeeById, displayMonthLabel, groupKeyFromName]);

  // Build an on-screen preview for a single group using the exact HTML that will be printed
  const GroupReportPreview = React.useMemo(() => {
    if (!showGroupReport || !reportHtml) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-all">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200" style={{ maxWidth: '98vw', maxHeight: '96vh', width: 1140, height: 820 }}>
          {/* Modal Header Actions */}
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-indigo-600 rounded-full" />
              <h3 className="font-bold text-slate-800 text-lg">របាយការណ៍តាមក្រុម (Preview)</h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm flex items-center gap-2" 
                onClick={() => exportGroupReport(selectedGroupForReport)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Download Excel
              </button>
              <button 
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-all shadow-sm flex items-center gap-2" 
                onClick={() => openPrintWindow(reportHtml)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Print
              </button>
              <button className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-all flex items-center gap-2" onClick={() => setShowGroupReport(false)}>
                Close
              </button>
            </div>
          </div>

          {/* Iframe content - 100% identical to print */}
          <div className="flex-1 overflow-hidden bg-slate-100 p-4">
            <iframe 
              srcDoc={reportHtml} 
              title="Group Report Preview"
              className="w-full h-full border-none shadow-inner bg-white rounded-lg"
              style={{ minHeight: '600px' }}
            />
          </div>
        </div>
      </div>
    );
  }, [showGroupReport, reportHtml, selectedGroupForReport, exportGroupReport]);

  // Print current preview as A4 landscape. Builds HTML snapshot and opens print dialog.
  const printA4Landscape = React.useCallback(() => {
    try {
      // Build a minimal HTML snapshot of the table
      const cols = displayTotalDays;
      const headerCells = ['ល.រ', 'លេខកាត', 'ឈ្មោះ', ...Array.from({ length: cols }).map((_, i) => dayHeader(i))];

      const rowsHtml = (displayRows || []).map((r, idx) => {
        const emp = r.employee || lookupEmployeeById(r.employeeRef) || null;
        const card = emp ? (emp.staffId || emp.staff_id || emp.cardNumber || emp.card_no || emp.id || emp._id || '') : String(r.employeeRef || '');
        const name = emp ? (emp.khmerName || emp.fullName || emp.name || '') : String(r.employeeRef || '');
        const cells = [idx + 1, card, name].concat(Array.from({ length: cols }).map((_, di) => {
          const sh = resolveShiftForDay(r, di);
          const title = sh ? (sh.title || `${sh.start || ''}-${sh.end || ''}`) : '';
          const bg = (sh ? (sh.color || findShiftColor(sh)) : null) || '#f3f4f6';
          const textColor = (function(hex) {
            try {
              const c = hex.replace('#', '');
              const r = parseInt(c.substring(0,2),16);
              const g = parseInt(c.substring(2,4),16);
              const b = parseInt(c.substring(4,6),16);
              const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
              return lum > 0.6 ? '#111827' : '#ffffff';
            } catch (e) { return '#111827'; }
          })(bg);
          return { title, bg, textColor };
        }));

        const cellHtml = cells.map((c, i) => {
          if (i < 3) return `<td style="border:1px solid #ccc;padding:4px;font-size:11px;text-align:center;">${String(c || '')}</td>`;
          const isWeekend = dayMeta[i-3]?.isWeekend;
          return `<td style="border:1px solid #ccc;padding:2px;font-size:10px;text-align:center;background:${isWeekend ? '#fee2e2' : 'white'}">
            ${c.title ? `<span style="background:${c.bg};color:${c.textColor};padding:2px 4px;border-radius:4px;font-weight:600;display:inline-block;min-width:18px;">${c.title}</span>` : '—'}
          </td>`;
        }).join('');
        return `<tr>${cellHtml}</tr>`;
      }).join('');

      const theadHtml = `<tr>${headerCells.map((h, i) => {
        const isWeekend = i >= 3 && dayMeta[i-3]?.isWeekend;
        return `<th style="border:1px solid #bbb;padding:6px;background:${isWeekend ? '#fecaca' : '#f3f4f6'};font-size:11px;">${h}</th>`;
      }).join('')}</tr>`;

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Schedule Print - ${displayMonthLabel}</title>
<style>
  @font-face { font-family: 'Khmer OS System'; src: local('Khmer OS System'); }
  @page { size: A4 landscape; margin: 8mm; }
  body { 
    margin: 0; 
    font-family: "Khmer OS System", Arial, sans-serif; 
    font-size: 11px; 
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { word-wrap: break-word; border: 1px solid #ccc; }
  .header { text-align: center; margin-bottom: 15px; }
  .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">${labelMap[selectedGroupForReport] || 'Schedule Report'}</div>
    <div>${displayMonthLabel}</div>
  </div>
  <table>
    <thead>${theadHtml}</thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div style="margin-top: 15px; font-size: 9px; color: #666; text-align: right;">
    Generated on ${new Date().toLocaleString('km-KH')}
  </div>
</body>
</html>`;

      openPrintWindow(html);
    } catch (err) {
      console.error('Print failed', err);
      alert('Failed to prepare printable A4 page.');
    }
  }, [displayRows, displayTotalDays, dayHeader, exampleLayout, resolveShiftForDay, lookupEmployeeById, displayMonthLabel, previewRange]);


  return (
    <div className="p-4 bg-white border rounded shadow-sm mb-6 overflow-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">Schedule preview <span className="ml-2 text-sm text-gray-500">{displayMonthLabel}</span></h2>
          <div className="text-xs text-gray-500 mt-1">{previewRange.start} → {previewRange.end}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* Mode selector: apply by explicit dates or by weekday(s) */}
            <select
              className="px-2 py-1 text-sm border rounded"
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
            >
              <option value="date">Apply by date</option>
              <option value="weekday">Apply by weekday</option>
            </select>
            {selectedMode === 'weekday' && (
              <div className="flex items-center gap-1">
                {weekdayLabels.map((label, idx) => {
                  const active = selectedWeekdays.has(idx);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`px-2 py-1 text-xs rounded border ${active ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                      onClick={() => toggleWeekday(idx)}
                      title={label}
                    >{label}</button>
                  );
                })}
              </div>
            )}
            <select
              className="px-2 py-1 text-sm border rounded"
              value={replaceTgtInput}
              onChange={(e) => setReplaceTgtInput(e.target.value)}
            >
              <option value="">Replace with (custom or pick shift)</option>
              {masterShiftOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
            <input className="px-2 py-1 border rounded text-sm" placeholder="Match (optional)" value={replaceSrcInput} onChange={(e) => setReplaceSrcInput(e.target.value)} />
            <button
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
              onClick={() => {
                if (!replaceTgtInput) {
                  // if the user typed a custom replace text, convert it to an override shift
                  if (replaceTgtInput && replaceTgtInput.trim()) {
                    // create a temporary shift and apply to selected days
                    const tmp = { id: `tmp-${Date.now()}`, title: replaceTgtInput.trim(), start: '', end: '', color: '#0b74de' };
                    // push into masterShiftOptions via applyReplacementToSelectedDates by adding temporarily to shifts is complex; instead, directly apply using tmp
                    // We'll reuse applyReplacementToSelectedDates by calling with null and setting scheduleOverrides directly here
                    // But to keep simple, if replaceTgtInput isn't a known id, build overrides below
                    const chosen = { raw: tmp };
                    const next = { ...(scheduleOverrides || {}) };
                    let replaced = 0;
                    Array.from(selectedDays).forEach((di) => {
                      rows.forEach((r) => {
                        try {
                          const current = resolveShiftForDay(r, di) || null;
                          if (!current) return;
                          const title = (current.title || `${current.start || ''}-${current.end || ''}`).toString().toLowerCase();
                          const times = `${current.start || ''}-${current.end || ''}`.toLowerCase();
                          const srcLower = String(replaceSrcInput || '').toLowerCase();
                          const isDayOffTitle = title.includes('day off') || title.includes('off');
                          const shouldReplace = srcLower ? (title.includes(srcLower) || times.includes(srcLower)) : (includeDayOff ? true : !isDayOffTitle);
                          if (!shouldReplace) return;
                          const empKey = String(r.employeeRef || (r.employee && (r.employee.staffId || r.employee.id)) || '').trim();
                          const overrideKey = `${empKey}-${di}`;
                          const overrideShift = { ...chosen.raw };
                          overrideShift.color = overrideShift.color || getColorForShift(overrideShift.start, overrideShift.end);
                          next[overrideKey] = overrideShift;
                          replaced += 1;
                        } catch (e) {}
                      });
                    });
                    setScheduleOverrides(next);
                    (async () => {
                      try {
                        const result = await saveOverrides(next);
                        alert(`Applied replacement to ${replaced} cells on ${selectedDays.size} selected date(s).\nSaved: ${result.saved}, Failed: ${result.failed}`);
                      } catch (err) {
                        alert(`Applied replacement to ${replaced} cells on ${selectedDays.size} selected date(s).\nBut failed to save overrides to server.`);
                      }
                    })();
                    return;
                  }
                  alert('Please pick a replacement shift or enter a custom replace value.');
                  return;
                }
                // if replaceTgtInput matches a master shift id, apply via helper
                applyReplacementToSelectedDates(replaceTgtInput);
              }}
            >Apply to selected dates</button>
            <button
              className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded"
              onClick={() => { setSelectedDays(new Set()); }}
            >Clear dates</button>
          </div>
          <button
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
            onClick={exportExcel}
          >Download Excel</button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">
              <span className="mr-2">ជ្រើសរើសក្រុម</span>
              <select
                className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-gray-800"
                value={selectedGroupForReport}
                onChange={(e) => setSelectedGroupForReport(e.target.value)}
              >
                {availableGroupNames.map(catId => {
                  const upper = String(catId).toUpperCase();
                  const isLetter = /^[A-G]$/.test(upper);
                  const display = labelMap[catId] || labelMap[upper] || (isLetter ? `ក្រុម ${upper}` : String(catId));
                  return (
                    <option key={catId} value={catId}>{display}</option>
                  );
                })}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded" onClick={() => {
              const grp = selectedGroupForReport || (availableGroupNames && availableGroupNames[0]);
              if (!grp) { alert('No group selected'); return; }
              // For printable group report we want the full month (day 1 -> end of month)
              const fullMonthTotalDays = Number(monthDays) || 0;
              // build full-month previewRange
              const formatDateForRange = (date) => {
                try { return date.toLocaleDateString('km-KH', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
              };
              const fullPreviewRange = {
                start: formatDateForRange(new Date(monthMeta.year, monthMeta.month - 1, 1)),
                end: formatDateForRange(new Date(monthMeta.year, monthMeta.month - 1, fullMonthTotalDays)),
              };

                const html = buildGroupReportHtml({
                  groupName: grp,
                  labelMap,
                  displayRows,
                  monthMeta,
                  monthDays,
                  // force report to include full month days
                  displayTotalDays: fullMonthTotalDays,
                  // provide full-month range for title
                  previewRange: fullPreviewRange,
                  // pass a snapshot of the preview schedule for the entire month so the builder uses exact per-date values (including overrides)
                  scheduleByDay: extractScheduleByDay({ rows: displayRows, monthMeta, totalDays: fullMonthTotalDays, resolveShiftForDay, getEmployeeId }),
                  printableHeaderHtml,
                  displayMonthLabel,
                  exampleLayout,
                  // show short code labels (សំគាល់) from Shift Group when available
                  displayShiftLabel: 'short',
                  resolveShiftForDay,
                  shortCodeForShift,
                  normalizedHolidaySet,
                  legendItems,
                  // pass computed per-code rgba map (may be empty)
                  customColorMap: computedCustomColorMap,
                  debug: false,
                  // include current department so the report header shows the exact department name
                  department: department,
                });
                // Store HTML and show modal
                setReportHtml(html);
                setShowGroupReport(true);
            }}>Preview Group</button>
              <button className="px-3 py-1.5 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 rounded" onClick={() => setShowColorEditor(s => !s)}>{showColorEditor ? 'Close color editor' : 'Customize colors'}</button>
            </div>
            {showColorEditor && (
              <div style={{ marginTop: 8, padding: 8, border: '1px solid #e6e6e6', borderRadius: 6, background: '#fff' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>Customize badge colors</div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button className="px-2 py-1 text-sm bg-blue-600 text-white rounded" onClick={() => saveCustomColors(customColors)}>Save</button>
                    <button className="px-2 py-1 text-sm bg-red-600 text-white rounded" onClick={() => { resetCustomColors(); }}>Reset</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 8 }}>
                  {(legendItems || []).map(li => {
                    const code = String(li.code || '');
                    const entry = customColors && customColors[code] ? customColors[code] : { color: (li.color || '#9ca3af'), opacity: 1 };
                    return (
                      <div key={code} style={{ border: '1px solid #eee', padding: 8, borderRadius: 4 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{code} — {li.label}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="color" value={entry.color || '#9ca3af'} onChange={(e) => { const next = { ...(customColors||{}) }; next[code] = { ...(next[code]||{}), color: e.target.value }; setCustomColors(next); }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: 11 }}>Opacity {Math.round((entry.opacity || 1) * 100)}%</label>
                            <input type="range" min={0} max={100} value={Math.round((entry.opacity || 1) * 100)} onChange={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value||0))); const next = { ...(customColors||{}) }; next[code] = { ...(next[code]||{}), opacity: v/100 }; setCustomColors(next); }} />
                          </div>
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 36, height: 18, borderRadius: 4, border: '1px solid #ddd', background: (entry.color ? `rgba(${hexToRgb(entry.color).r},${hexToRgb(entry.color).g},${hexToRgb(entry.color).b},${entry.opacity||1})` : '#fff') }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>
      {/* Inline modal for group report preview (replaces opening a new tab) */}

      {/* Example variant B header: group cards + shift list */}
      {exampleLayout && exampleVariant === 'B' && (
        <div className="mb-4 flex gap-4">
          <div className="flex gap-3 flex-wrap" style={{ flex: 1 }}>
            {/* small group cards */}
            {Array.from(new Set(exampleRows.map(r => r.groupName))).map((gName) => (
              <div key={gName} className="border rounded p-3 text-sm w-40 bg-white shadow-sm">
                <div className="text-blue-600 font-medium mb-2">{gName}</div>
                <div className="text-xs text-gray-600">Start shift</div>
                <select className="w-full mt-2 text-xs p-1 border rounded">
                  <option>07:30-07:30</option>
                  <option>07:30-15:30</option>
                </select>
                <ol className="mt-2 text-xs space-y-1">
                  {exampleRows.filter(rr => rr.groupName === gName).map((rr, i) => (
                    <li key={i} className="bg-blue-50 p-1 rounded">{rr.employee.khmerName}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="w-96 border rounded p-3 bg-white shadow-sm">
            <div className="text-purple-700 font-medium mb-2">Shift * A</div>
            <table className="w-full text-xs">
              <thead>
                <tr><th className="p-1 text-left">#</th><th className="p-1 text-left">Shift Title</th><th className="p-1">Color</th></tr>
              </thead>
              <tbody>
                <tr><td className="p-1">1</td><td className="p-1">7:30AM-7:30AM</td><td className="p-1"><span style={{display:'inline-block',width:12,height:12,background:'#0b74de',borderRadius:6}}/></td></tr>
                <tr><td className="p-1">2</td><td className="p-1">Day Off</td><td className="p-1"><span style={{display:'inline-block',width:12,height:12,background:'#f87171',borderRadius:6}}/></td></tr>
                <tr><td className="p-1">3</td><td className="p-1">7:30AM-3:30PM</td><td className="p-1"><span style={{display:'inline-block',width:12,height:12,background:'#34d399',borderRadius:6}}/></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <table className="w-full text-sm table-fixed border-collapse">
        <thead>
            <tr className="bg-gray-100 text-left text-gray-700">
            <th className="p-2 border" style={{ width: 48 }}>ល.រ</th>
            <th className="p-2 border" style={{ width: 120 }}>លេខកាត</th>
            <th className="p-2 border">ឈ្មោះ</th>
            <th className="p-2 border" style={{ width: 140 }}>លេខទូរស័ព្ទ</th>
            {Array.from({ length: displayTotalDays }).map((_, i) => {
              const date = new Date(monthMeta.year, monthMeta.month - 1, i + 1);
              const khmerDays = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
              const dayName = khmerDays[date.getDay()];
              const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const isHoliday = normalizedHolidaySet.has(iso);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isSelected = selectedDays.has(i);
              return (
                <th key={i} className={`p-2 border text-center ${isWeekend ? 'bg-red-50' : ''}`}>
                  <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleSelectedDay(i)}
                              className="flex items-center gap-2"
                              title={`Toggle ${dayHeader(i)}`}
                              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                              <div className={`text-xs font-semibold ${isWeekend || isHoliday ? 'text-red-600' : 'text-blue-700'}`}>{dayName}</div>
                              {isSelected && <span style={{ width: 10, height: 10, borderRadius: 6, background: '#0b74de', display: 'inline-block' }} aria-hidden />}
                            </button>
                  </div>
                  <div className={`${isWeekend ? 'text-red-600' : ''}`}>{dayHeader(i)}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r, idx) => (
            <tr key={`${String(r.employeeRef || r.employee?.id || r.employee?._id || idx)}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="p-2 border align-middle text-xs">{idx + 1}</td>
              <td className="p-2 border align-middle text-xs text-blue-600">{(() => {
                const found = r.employee || null;
                // prefer staffId (explicit card number) when available
                if (found) {
                  return getEmployeeId(found) || '—';
                }
                // try to lookup by raw employeeRef (maybe it's an _id) and show staffId if found
                const looked = lookupEmployeeById(r.employeeRef);
                if (looked) return getEmployeeId(looked) || '—';
                // show raw ref and an unresolved badge
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-700 truncate" title={String(r.employeeRef || '')}>{String(r.employeeRef || '')}</span>
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Unresolved</span>
                  </div>
                );
              })()}</td>
              <td className="p-2 border align-middle">{(() => {
                // Show only the name in this column. Phone moved to its own column.
                // Prefer resolved employee; try several resolvers so we find records indexed by staffId, id, or name
                const empRecord = r.employee || resolveEmployee(r.employeeRef) || lookupEmployeeById(r.employeeRef) || null;
                if (empRecord) return (empRecord.khmerName || empRecord.fullName || empRecord.name || '—');
                return <span className="text-red-600" title={String(r.employeeRef || '')}>{String(r.employeeRef || '—')}</span>;
              })()}</td>
              <td className="p-2 border align-middle text-center text-sm">{(() => {
                const empRecord = r.employee || resolveEmployee(r.employeeRef) || lookupEmployeeById(r.employeeRef) || null;
                  if (empRecord) {
                    const key = String(getEmployeeId(empRecord || {}) || r.employeeRef || '');
                    const current = phoneEdits[key] !== undefined ? phoneEdits[key] : (empRecord.phone || empRecord.phoneNumber || empRecord.tel || empRecord.mobile || empRecord.contact || empRecord.mobilePhone || empRecord.phone_number || empRecord.telephone || empRecord.cell || '').toString().trim();
                    return (
                      <input
                        type="text"
                        className="border rounded px-2 py-1 text-sm w-full text-center"
                        value={current}
                        onChange={(e) => {
                          const v = e.target.value || '';
                          setPhoneEdits(prev => ({ ...prev, [key]: v }));
                        }}
                        onBlur={async (e) => {
                          try {
                            const v = normalizePhone(e.target.value || '');
                            setPhoneEdits(prev => ({ ...prev, [key]: v }));
                            // try to persist edit if employee has an id and API exists
                            if (empRecord && (empRecord.id || empRecord._id)) {
                              const id = empRecord.id || empRecord._id;
                              // best-effort POST/PUT to update phone; ignore failures
                              try {
                                await fetch('/api/employees/' + encodeURIComponent(id), {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ phone: v })
                                });
                              } catch (err) { /* ignore save errors */ }
                            }
                          } catch (err) {}
                        }}
                      />
                    );
                  }
                  return '—';
              })()}</td>
              {Array.from({ length: displayTotalDays }).map((_, di) => {
                const date = new Date(monthMeta.year, monthMeta.month - 1, di + 1);
                const isWeekendCell = date.getDay() === 0 || date.getDay() === 6;
                const sh = (exampleLayout ? (r.groupShifts && r.groupShifts[di % (r.groupShifts.length || 1)]) : resolveShiftForDay(r, di));
                const title = sh ? (sh.title || `${sh.start || ''}-${sh.end || ''}`) : '';
                const isOff = (title || '').toLowerCase().includes('day off') || (title || '').toLowerCase().includes('off');
                // determine background color: use shift.color when available, otherwise red for Day Off or gray fallback
                // prefer shift.color, then try to lookup color from master shift lists, otherwise fallback
                const bg = (sh ? (sh.color || findShiftColor(sh)) : null) || (isOff ? '#ffefef' : '#f3f4f6');
                // compute text color for contrast: if bg is light, use dark text; otherwise white
                const computeTextColor = (hex) => {
                  try {
                    const c = hex.replace('#', '');
                    const r = parseInt(c.substring(0,2),16);
                    const g = parseInt(c.substring(2,4),16);
                    const b = parseInt(c.substring(4,6),16);
                    // relative luminance formula
                    const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
                    return luminance > 0.6 ? '#111827' : '#ffffff';
                  } catch (e) { return '#111827'; }
                };
                const textColor = isOff ? '#f00d0dff' : computeTextColor(bg);
                const style = isOff ? { backgroundColor: '#e4cfe3ff', color: '#ff0b0bff', borderRadius: 6, padding: '2px 6px', display: 'inline-block' } : { backgroundColor: bg, color: textColor, borderRadius: 6, padding: '2px 6px', display: 'inline-block' };
                return (
                  <td key={di} className={`p-2 border align-middle text-center ${isWeekendCell ? 'bg-red-50' : ''}`}>
                    {title ? (
                      <span style={style} className="text-xs font-medium">{title}</span>
                    ) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {GroupReportPreview}
    </div>
  );
}
