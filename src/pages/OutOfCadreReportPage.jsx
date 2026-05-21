import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

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
function khWeekday(d) {
  const names = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
  const dt = new Date(d);
  return names[dt.getDay()];
}
function buddhistEraYear(d) {
  const dt = new Date(d);
  return dt.getFullYear() + 543;
}

// Convert Excel serial date (e.g. 45627) to a JS Date at local midnight
function excelSerialToDate(serial) {
  if (serial == null || serial === '') return null;
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  try {
    if (typeof XLSX !== 'undefined' && XLSX && XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
      const dc = XLSX.SSF.parse_date_code(n);
      if (dc && dc.y && dc.m && dc.d) {
        const dt = new Date(dc.y, dc.m - 1, dc.d);
        if (!isNaN(dt.getTime())) {
          dt.setHours(0, 0, 0, 0);
          return dt;
        }
      }
    }
  } catch (e) {
    // ignore and fallback to manual calculation below
  }
  try {
    // Excel serial 1 = 1900-01-01, which is JS date 1899-12-31 or 1899-12-30 depending on leap-year bug.
    // Using 1899-12-30 is the common convention that matches most XLSX readers.
    const base = new Date(1899, 11, 30);
    const dt = new Date(base.getTime() + n * 86400000);
    if (isNaN(dt.getTime())) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  } catch {
    return null;
  }
}

function fmtShortDate(d) {
  if (!d) return '';
  try {
    if (d instanceof Date) {
      const dt = new Date(d.getTime());
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    if (typeof d === 'number') {
      const dt = excelSerialToDate(d);
      if (dt) {
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = dt.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    const s = String(d).trim();
    if (!s) return '';

    // Already dd/mm/yyyy (or dd/mm/yyyyy) -> normalize padding.
    // If year looks like an Excel serial (e.g. 45627), treat it as such.
    let m = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4,5})$/.exec(s);
    if (m) {
      const yearNum = Number(m[3]);
      if (m[3].length > 4 || yearNum > 3000) {
        const dt = excelSerialToDate(yearNum);
        if (dt) {
          const dd = String(dt.getDate()).padStart(2, '0');
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const yyyy = dt.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        }
      }
      const dd = String(Number(m[1])).padStart(2, '0');
      const mm = String(Number(m[2])).padStart(2, '0');
      const yyyy = String(yearNum).padStart(4, '0');
      return `${dd}/${mm}/${yyyy}`;
    }

    // ISO yyyy-mm-dd -> convert to dd/mm/yyyy
    m = /^([0-9]{4,5})-([0-9]{2})-([0-9]{2})$/.exec(s);
    if (m) {
      const yearNum = Number(m[1]);
      if (m[1].length > 4 || yearNum > 3000) {
        const dt = excelSerialToDate(yearNum);
        if (dt) {
          const dd = String(dt.getDate()).padStart(2, '0');
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const yyyy = dt.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        }
      }
      const yyyy = m[1];
      const mm = m[2];
      const dd = m[3];
      return `${dd}/${mm}/${yyyy}`;
    }

    // Fallback: let Date parse, then format
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return s;
  } catch { return String(d); }
}

function parseDateSafe(v) {
  if (!v) return null;
  try {
    if (v instanceof Date) {
      const dt0 = new Date(v.getTime());
      dt0.setHours(0, 0, 0, 0);
      return isNaN(dt0.getTime()) ? null : dt0;
    }
    if (typeof v === 'number') {
      const dtNum = excelSerialToDate(v);
      if (dtNum) return dtNum;
    }
    const s = String(v).trim();
    if (!s) return null;

    // dd/mm/yyyy (or dd/mm/yyyyy if year accidentally stored as Excel serial)
    let m = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4,5})$/.exec(s);
    if (m) {
      const yearNum = Number(m[3]);
      if (m[3].length > 4 || yearNum > 3000) {
        const dtSerial = excelSerialToDate(yearNum);
        if (dtSerial) return dtSerial;
      }
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yyyy = yearNum;
      const dt = new Date(yyyy, mm - 1, dd);
      if (isNaN(dt.getTime())) return null;
      dt.setHours(0, 0, 0, 0);
      return dt;
    }

    // ISO yyyy-mm-dd (allow 5-digit year to catch Excel-serial strings like 45627-01-01)
    m = /^([0-9]{4,5})-([0-9]{2})-([0-9]{2})$/.exec(s);
    if (m) {
      const yearNum = Number(m[1]);
      if (m[1].length > 4 || yearNum > 3000) {
        const dtSerial = excelSerialToDate(yearNum);
        if (dtSerial) return dtSerial;
      }
      const yyyy = yearNum;
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      const dt = new Date(yyyy, mm - 1, dd);
      if (isNaN(dt.getTime())) return null;
      dt.setHours(0, 0, 0, 0);
      return dt;
    }

    const dt = new Date(s);
    if (isNaN(dt.getTime())) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  } catch { return null; }
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const diff = Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function formatDurationDaysToKhmer(days) {
  if (days == null) return '';
  if (days <= 0) return toKhmerDigits(0) + ' ថ្ងៃ';
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const rem = days % 30;
    const parts = [];
    parts.push(`${toKhmerDigits(months)} ខែ`);
    if (rem > 0) parts.push(`${toKhmerDigits(rem)} ថ្ងៃ`);
    return parts.join(' ');
  }
  return `${toKhmerDigits(days)} ថ្ងៃ`;
}

// Convert any stored date-like value into an ISO yyyy-mm-dd string
// suitable for `<input type="date" />` value. If invalid, return empty.
function toDateInputValue(v) {
  const dt = parseDateSafe(v);
  if (!dt) return '';
  try {
    return dt.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function computeOutOfCadreMeta(outOfCadre, hr) {
  const start = parseDateSafe(outOfCadre && (outOfCadre.Start || outOfCadre.start));
  const end = parseDateSafe(outOfCadre && (outOfCadre.End || outOfCadre.end));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let statusLabel = '';
  let validityLabel = '';
  let durationLabel = '';

  // Detect if the employee has resigned or is inactive/deleted
  const isResigned = hr && (
    (hr.status || '').toString().toLowerCase() === 'resigned' ||
    (hr.status || '').toString().toLowerCase() === 'inactive' ||
    (hr.status || '').toString().toLowerCase() === 'deleted' ||
    hr.resignationDate ||
    hr.resignDate ||
    (hr.delisted && (hr.delisted.dateDelisted || hr.delisted.date))
  );

  // Only show "prepare" when there is a Start date in the future.
  if (start && start > today) {
    statusLabel = 'ត្រៀមក្រៅក្របខណ្ឌដើម';
  } else if (start && (!end || (end && end >= today))) {
    // if start is in the past and end is not present or end >= today -> ongoing
    statusLabel = 'កំពុងបន្តក្រៅក្របខណ្ឌដើម';
  } else if (end && end < today) {
    const daysSinceEnd = daysBetween(end, today);
    if (isResigned) {
      statusLabel = 'បានលាឈប់';
    } else if (daysSinceEnd > 30) {
      statusLabel = 'បញ្ចប់ក្រៅក្របខណ្ឌដើមលើស១ខែ';
    } else {
      statusLabel = 'ចូលបម្រើការងារវិញ';
    }
  }

  let validityDays = null;
  if (end) {
    // days from today to end (positive = days remaining, negative = days since ended)
    validityDays = daysBetween(today, end);
    validityLabel = (end >= today) ? 'សុពល' : 'មិនសុពល';
  }

  if (start && end) {
    const dur = daysBetween(start, end);
    durationLabel = formatDurationDaysToKhmer(dur >= 0 ? dur : 0);
  }

  // If start exists but end is missing and start is in the past or today, compute duration up to today
  if (start && !end) {
    const durNow = daysBetween(start, today);
    if (durNow != null) {
      durationLabel = formatDurationDaysToKhmer(durNow >= 0 ? durNow : 0);
    }
  }

  return { statusLabel, validityLabel, durationLabel, validityDays };
}


export default function OutOfCadreReportPage() {
  const perms = usePermission();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [dept] = useState('');

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [retireYear] = useState(new Date().getFullYear());
  const printRef = useRef();
  const importFileRef = useRef();
  // Column order state for draggable headers
  const defaultCols = [
    'index', 'civilId', 'name', 'gender', 'role', 'position', 'dept', 'newWorkplace', 'Start', 'End', 'status', 'image', 'other'
  ];
  if (perms.isAdmin || perms.canEditOutOfCadreLeaveReport) defaultCols.push('action');
  const [colOrder, setColOrder] = useState(defaultCols);
  const [visibleCols, setVisibleCols] = useState(() => {
    const obj = {};
    (defaultCols || []).forEach(k => { obj[k] = true; });
    return obj;
  });
  const [showColsPanel, setShowColsPanel] = useState(false);
  const colLabels = {
    index: 'ល.រ',
    civilId: 'លេខមន្ត្រី',
    name: 'គោត្តនាម និងនាម',
    gender: 'ភេទ',
    role: 'មុខងារ',
    position: 'តួនាទី',
    dept: 'ផ្នែក',
    newWorkplace: 'ទីកន្លែងកាងារថ្មី',
    Start: 'ថ្ងៃចាប់ផ្ដើម',
    End: 'ថ្ងៃបញ្ចប់',
    status: 'ស្ថានភាព',
    image: 'លិខិតយោង',
    other: 'ផ្សេងៗ',
    ...((perms.isAdmin || perms.canEditOutOfCadreLeaveReport) ? { action: 'សកម្មភាព' } : {})
  };
  const draggingKeyRef = useRef(null);
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Edit modal state for outOfCadre fields
  const [showEdit, setShowEdit] = useState(false);
  const [editingHr, setEditingHr] = useState(null);
  const [editingOutOfCadre, setEditingOutOfCadre] = useState({});
  const fileInputRef = useRef();
  const [originalOutOfCadre, setOriginalOutOfCadre] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  // Do not load full list on mount. Only fetch when user searches (q is non-empty) to match "search only" UX.
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewHR || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const params = {};
        const { data } = await api.get('/hr', { params });
        if (!mounted) return;
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
      } finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [perms.canViewHR, perms.canViewEmployees]);

  // Debounced server-side search when `q` changes — avoids firing too many requests while typing
  const searchTidRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!(perms.canViewHR || perms.canViewEmployees)) return;
    // clear any existing timer
    if (searchTidRef.current) { clearTimeout(searchTidRef.current); searchTidRef.current = null; }
    // schedule new debounced search
    // Only perform a debounced server search when query is non-empty
    if (!q || q.toString().trim() === '') {
      // empty query -> keep the currently loaded list (don't clear), matching Study page behavior
      // no-op: leave `list` as loaded on mount
    } else {
      searchTidRef.current = setTimeout(async () => {
        try {
          setLoading(true); setError('');
          const params = { q: q.toString().trim() };
          const { data } = await api.get('/hr', { params });
          if (!isMountedRef.current) return;
          setList(Array.isArray(data) ? data : []);
        } catch (err) {
          if (!isMountedRef.current) return;
          setError(err?.response?.data?.message || err?.message || 'Search failed');
        } finally {
          if (isMountedRef.current) setLoading(false);
        }
      }, 400);
    }
    return () => {
      if (searchTidRef.current) { clearTimeout(searchTidRef.current); searchTidRef.current = null; }
    };
  }, [q, perms.canViewHR, perms.canViewEmployees]);

  // Immediate search action (cancel debounce and fetch immediately)
  const doImmediateSearch = async (query) => {
    if (!(perms.canViewHR || perms.canViewEmployees)) return;
    // cancel pending
    if (searchTidRef.current) { clearTimeout(searchTidRef.current); searchTidRef.current = null; }
    const qTrim = (query || '').toString().trim();
    if (!qTrim) {
      // empty query -> clear results
      setList([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true); setError('');
    try {
      const params = { q: qTrim };
      const { data } = await api.get('/hr', { params });
      if (!isMountedRef.current) return;
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err?.response?.data?.message || err?.message || 'Search failed');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const derived = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();
    const hasOutOfCadreData = (hr) => {
      const u = hr && hr.outOfCadre ? hr.outOfCadre : null;
      if (!u) return false;
      try {
        return Object.keys(u).some(k => {
          const v = u[k];
          return v !== null && typeof v !== 'undefined' && String(v).trim() !== '';
        });
      } catch (e) { return false; }
    };

    const rows = (list || [])
      .filter(hr => {
        if (dept && (hr.Department_Kh || hr.department || '').trim() !== dept.trim()) return false;
        // Combine all ID-like fields so searching by any of them works
        const sid = [
          hr.civilServantId,
          hr.staffId,
          hr.no,
          hr.cardNo,
          hr.cardNumber,
        ]
          .filter(v => v != null && v !== '')
          .map(v => v.toString().toLowerCase())
          .join(' ');
        const name = (hr.khmerName || hr.name || '').toString().toLowerCase();
        const position = (hr.position || hr.role || hr.title || '').toString().toLowerCase();
        const deptField = (hr.Department_Kh || hr.department || '').toString().toLowerCase();
        const outOfCadre = hr.outOfCadre || {};
        const outOfCadreNumber = (outOfCadre.newWorkplace || '').toString().toLowerCase();
        const outOfCadreReason = '';
        const outOfCadreOther = (outOfCadre.other || '').toString().toLowerCase();
        // If a search term is present, match across common fields and outOfCadre fields (do not require hasOutOfCadreData)
        if (term) {
          return sid.includes(term) || name.includes(term) || position.includes(term) || deptField.includes(term) || outOfCadreNumber.includes(term) || outOfCadreReason.includes(term) || outOfCadreOther.includes(term);
        }
        // No search term: only include HR that actually have outOfCadre data
        if (!hasOutOfCadreData(hr)) return false;
        return true;
      })
      .map(hr => ({ hr }));
    const male = rows.filter(r => r.hr.gender === 'Male').length;
    const female = rows.filter(r => r.hr.gender === 'Female').length;
    return { rows, male, female, total: rows.length };
  }, [list, dept, q]);

  // Helper: map status text to badge style (background color). Keep Khmer labels as-is.
  const statusBadgeStyle = (statusText) => {
    if (!statusText) return { background: '#6b7280', color: '#fff' }; // gray
    const s = statusText.toString().toLowerCase();
    if (s.includes('ត្រៀម') || s.includes('prepare')) return { background: '#f59e0b', color: '#fff' }; // amber
    if (s.includes('កំពុង') || s.includes('ongoing')) return { background: '#10b981', color: '#fff' }; // green
    if (s.includes('បញ្ចប់') || s.includes('ended') || s.includes('លើស')) return { background: '#6366f1', color: '#fff' }; // indigo/purple
    if (s.includes('លាឈប់') || s.includes('resigned')) return { background: '#dc2626', color: '#fff' }; // red
    if (s.includes('ចូល') || s.includes('returned') || s.includes('resume')) return { background: '#047857', color: '#fff' }; // darker green
    // default blue
    return { background: '#2563eb', color: '#fff' };
  };
  // Render status badge (reuse Study styling)
  const renderStatusBadge = (s) => {
    if (!s) return null;
    const style = { display: 'inline-block', padding: '6px 10px', borderRadius: 14, color: '#fff', fontSize: 13, fontWeight: 700, minWidth: 40, textAlign: 'center' };
    const mapping = {
      'ត្រៀមទំនេរ': { background: '#f39c12' },
      'ត្រៀមក្រៅក្របខណ្ឌដើម': { background: '#f39c12' },
      'កំពុងទំនេរ': { background: '#16a34a' },
      'កំពុងបន្តក្រៅក្របខណ្ឌដើម': { background: '#16a34a' },
      'ចូលបម្រើការងារវិញ': { background: '#230ab4ff' },
      'បានលាឈប់': { background: '#dc2626' },
      'បញ្ចប់ក្រៅក្របខណ្ឌដើមលើស១ខែ': { background: '#b91c1c' }
    };
    const sStyle = mapping[s] || { background: '#333' };
    return <span style={{ ...style, ...sStyle }}>{s}</span>;
  };


  // Debug: log fetched list and computed rows for troubleshooting
  useEffect(() => {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[OutOfCadreLeaveReport] list count:', Array.isArray(list) ? list.length : 0, 'derived rows:', derived.rows ? derived.rows.length : 0);
      console.debug('[OutOfCadreLeaveReport] sample rows:', (derived.rows || []).slice(0, 5).map(r => ({ id: r.hr._id || r.hr.no || r.hr.staffId, name: r.hr.khmerName || r.hr.name })));
    }
  }, [list, derived]);

  const openEdit = (hr) => {
    setEditingHr({ ...hr, outOfCadre: { ...(hr.outOfCadre || {}) } });
    setEditingOutOfCadre(hr && hr.outOfCadre ? { ...hr.outOfCadre } : { image: '' });
    try { setOriginalOutOfCadre(JSON.parse(JSON.stringify(hr && hr.outOfCadre ? hr.outOfCadre : {}))); } catch { setOriginalOutOfCadre(hr && hr.outOfCadre ? { ...hr.outOfCadre } : {}); }
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
    setShowEdit(true);
  };

  const closeEdit = () => {
    try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch { /* ignore */ }
    setShowEdit(false);
    setEditingHr(null);
    setEditingOutOfCadre({});
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
  };

  const handleEditChange = (field, value) => {
    setEditingOutOfCadre(prev => {
      const next = { ...prev };
      if (field === 'validity') {
        const n = (value === '' || value == null) ? '' : Number(value);
        next.validity = n;
      } else if (field === 'Start') {
        next.Start = value;
      } else if (field === 'End') {
        next.End = value;
      } else {
        next[field] = value;
      }
      // auto-calc End if Start + validity available
      try {
        const st = parseDateSafe(next.Start || next.start);
        const valid = next.validity;
        if (st && valid !== '' && valid != null && !isNaN(Number(valid))) {
          const end = new Date(st);
          end.setDate(end.getDate() + Number(valid));
          next.End = end.toISOString().slice(0, 10);
        }
      } catch { /* ignore */ }
      return next;
    });
  };

  const handleFileSelect = (file) => {
    try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch { /* ignore */ }
    if (!file) { setSelectedFile(null); setSelectedPreviewUrl(null); return; }
    setSelectedFile(file);
    try { const url = URL.createObjectURL(file); setSelectedPreviewUrl(url); } catch { setSelectedPreviewUrl(null); }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) { window.alert('សូមជ្រើសឯកសារ'); return null; }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const { data } = await api.post('/upload', fd);
      const url = data && (data.url || data.path || data.fileUrl)
        ? (data.url || data.path || data.fileUrl)
        : (data && data[0] ? data[0].url : null);
      if (url) {
        // set into editingOutOfCadre so preview/current file updates
        setEditingOutOfCadre(prev => ({ ...(prev || {}), image: url }));
        // reset file input
        try { if (fileInputRef && fileInputRef.current) fileInputRef.current.value = ''; } catch { /* ignore */ }
      }
      return url;
    } catch (err) {
      console.error('Upload failed', err);
      window.alert('ផ្ទុកឯកសារបរាជ័យ: ' + (err?.response?.data?.message || err.message || 'Error'));
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteReference = async () => {
    if (!editingOutOfCadre || !(editingOutOfCadre.image)) return;
    const ok = window.confirm('លុបឯកសារយោង?');
    if (!ok) return;
    const imageUrl = editingOutOfCadre.image;
    setEditingOutOfCadre(prev => ({ ...(prev || {}), image: '' }));
    try {
      const q = new URL(imageUrl, window.location.origin).pathname;
      await api.delete('/upload', { params: { path: q } });
    } catch (err) {
      console.debug('Server-side delete not available or failed', err?.message || err);
    }
  };

  // Warn about unsaved changes in edit modal
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!showEdit) return;
      try {
        const curr = editingOutOfCadre || {};
        const orig = originalOutOfCadre || {};
        if (JSON.stringify(curr) !== JSON.stringify(orig)) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      } catch { /* ignore */ }
      return undefined;
    };
    if (showEdit) window.addEventListener('beforeunload', onBeforeUnload);
    return () => { window.removeEventListener('beforeunload', onBeforeUnload); };
  }, [showEdit, editingOutOfCadre, originalOutOfCadre]);

  // Helper to decide whether to render a modal input for a given outOfCadre field.
  // We show the input if the original record had that field (non-empty), or if the editing state already contains the field (allow adding new if the user typed it previously).
  const showIfPresent = (field) => {
    if (!showEdit) return false;
    try {
      if (originalOutOfCadre && Object.prototype.hasOwnProperty.call(originalOutOfCadre, field)) {
        // present on original even if empty string -> show
        return true;
      }
      // if editingOutOfCadre already has the property (user started typing), show it
      if (editingOutOfCadre && Object.prototype.hasOwnProperty.call(editingOutOfCadre, field)) return true;
    } catch (e) { /* ignore */ }
    return false;
  };

  const handleSaveEdit = async () => {
    if (!editingHr) return;
    setSaving(true);
    let uploadedUrl = null;
    try {
      if (selectedFile) {
        uploadedUrl = await handleUploadFile();
        if (!uploadedUrl) { setSaving(false); return; }
      }
      const payloadOutOfCadre = { ...(editingOutOfCadre || {}) };
      if (uploadedUrl) payloadOutOfCadre.image = uploadedUrl;
      // remove empty string image to avoid wiping server value unintentionally
      if (payloadOutOfCadre.image === '' || payloadOutOfCadre.image == null) delete payloadOutOfCadre.image;
      const id = editingHr._id || editingHr.no || editingHr.staffId;
      const { data } = await api.put(`/hr/${id}`, { outOfCadre: payloadOutOfCadre });
      setList(prev => prev.map(h => {
        if (h._id && data && data._id && h._id === data._id) return data;
        if (h._id && editingHr._id && h._id === editingHr._id) return { ...h, outOfCadre: payloadOutOfCadre };
        if (!h._id && (h.no === editingHr.no || h.staffId === editingHr.staffId)) return { ...h, outOfCadre: payloadOutOfCadre };
        return h;
      }));
      closeEdit();
    } catch (err) {
      console.error('Save outOfCadre failed', err);
      window.alert('រក្សាទុកបរាជ័យ: ' + (err?.response?.data?.message || err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOutOfCadre = async (hr) => {
    if (!hr) return;
    const ok = window.confirm('លុបទិន្នន័យក្រៅក្របខណ្ឌដើម?');
    if (!ok) return;
    setSaving(true);
    try {
      const id = hr._id || hr.no || hr.staffId;
      // send empty outOfCadre object to clear outOfCadre data for this staff
      const { data } = await api.put(`/hr/${id}`, { outOfCadre: {} });
      setList(prev => prev.map(h => {
        if (h._id && data && data._id && h._id === data._id) return data;
        if (h._id && hr._id && h._id === hr._id) return { ...h, outOfCadre: {} };
        if (!h._id && (h.no === hr.no || h.staffId === hr.staffId)) return { ...h, outOfCadre: {} };
        return h;
      }));
    } catch (err) {
      console.error('Delete outOfCadre failed', err);
      window.alert('លុបទិន្នន័យបរាជ័យ: ' + (err?.response?.data?.message || err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // removed edit modal and file-upload related handlers — this page is decoupled from study/edit flows

  const SCREEN_CSS = `
    .print-scope { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; }
    .print-scope h1, .print-scope h2, .print-scope h3 { margin: 0; }
    .print-scope .title { text-align: center; margin-bottom: 6px; }
    .print-scope .title h2 { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; font-size: 18px; }
    .print-scope .subtitle { text-align: center; margin-bottom: 10px; }
    .print-scope table { width: 100%; border-collapse: collapse; }
    .print-scope th, .print-scope td { border: 1px solid #e6dbdbff; padding: 4px 6px; font-size: 12px; }
    .print-scope th { background: #f3f4f6; }
    .print-scope .center { text-align: center; }
    /* hide print-only blocks on screen, and allow hiding large interactive parts when printing */
    .print-only { display: none; }
    .no-print { display: block; }
  `;

  const handlePrint = () => {
    // Require lunarText before printing
    if (!lunarText.trim()) {
      window.alert('សូមបំពេញ "ចន្ទគតិ" មុនពេលបោះពុម្ព');
      return;
    }
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const PRINT_STYLES = `
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        @media print {
          html, body { width: 297mm; height: 210mm; }
        }
        body { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h1,h2,h3 { margin: 0; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr, td, th { page-break-inside: avoid; }
        th, td { border: 1px solid #222; padding: 4px 6px; font-size: 12px; }
        th { background: #f3f4f6; }
        .center { text-align: center; }
        /* for print: hide interactive/no-print parts and show print-only content */
        .no-print { display: none !important; }
        .print-only { display: block !important; }
      </style>
    `;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>${PRINT_STYLES}</head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const handleExportExcel = () => {
    const rows = derived.rows;
    const header = [
      'ល.រ',
      'លេខមន្ត្រី',
      'គោត្តនាម និងនាម',
      'ភេទ',
      'មុខងារ',
      'តួនាទី',
      'ផ្នែក',
      'ទីកន្លែងកាងារថ្មី',
      'ថ្ងៃចាប់ផ្ដើម',
      'ថ្ងៃបញ្ចប់',
      'ស្ថានភាព',
      'លិខិតយោង',
      'ផ្សេងៗ'
    ];
    const data = rows.map((row, idx) => {
      // Export basic identifying fields + outOfCadre.* fields
      const outOfCadre = row.hr && row.hr.outOfCadre ? row.hr.outOfCadre : {};
      return ([
        idx + 1,
        row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || '',
        row.hr.khmerName || row.hr.name || '',
        row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : '',
        row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || '',
        row.hr.position || row.hr.role || row.hr.title || '',
        row.hr.Department_Kh || row.hr.department || '',
        outOfCadre.newWorkplace || '',
        fmtShortDate(outOfCadre.Start || outOfCadre.start || ''),
        fmtShortDate(outOfCadre.End || outOfCadre.end || ''),
        (outOfCadre.status || computeOutOfCadreMeta(outOfCadre, row.hr).statusLabel || ''),
        outOfCadre.image ? { f: `HYPERLINK("${window.location.origin}${outOfCadre.image}", "មើលឯកសារ")` } : '',
        outOfCadre.other || ''
      ]);
    });

    const summary = [[
      `សរុប: ${derived.total} នាក់ ( ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់ )`
    ]];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, [], ...summary]);
    // Adjust column widths
    ws['!cols'] = [
      { wch: 16 }, // staffId
      { wch: 16 }, // civilId
      { wch: 14 }, // Start
      { wch: 14 }, // End
      { wch: 24 }  // Other
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = `Nivatt_${retireYear}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `OutOfCadreLeave_${retireYear}.xlsx`);
  };

  const handleImportExcel = (file) => {
    if (!file) return;
    try {
      setImporting(true);
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        (async () => {
          try {
            const dataArr = new Uint8Array(e.target.result);
            const wb = XLSX.read(dataArr, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

            if (!aoa || aoa.length < 2) {
              window.alert('រកមិនឃើញទិន្នន័យសមរម្យក្នុង Excel ទេ');
              return;
            }

            const headers = aoa[0] || [];

            const findCol = (pred) => headers.findIndex((h) => {
              const t = String(h || '').toLowerCase();
              return pred(t, h);
            });

            const staffIdCol = findCol((t, h) => t.includes('លេខកាត') || t.includes('card') || t.includes('staff'));
            const civilIdCol = findCol((t, h) => t.includes('លេខមន្ត្រី') || t.includes('civil') || t.includes('officer'));
            const nameCol = findCol((t, h) => t.includes('ឈ្មោះ') || t.includes('name'));
            const numberCol = findCol((t, h) => t.includes('ចំនួនទំនេរ') || t.includes('number'));
            const startCol = findCol((t, h) => t.includes('ថ្ងៃចាប់') || t.includes('start'));
            const endCol = findCol((t, h) => t.includes('ថ្ងៃបញ្ចប់') || t.includes('end'));
            const validityCol = findCol((t, h) => t.includes('សុពលភាព') || t.includes('validity'));
            const statusCol = findCol((t, h) => t.includes('ស្ថានភាព') || t.includes('status'));
            const durationCol = findCol((t, h) => t.includes('រយៈពេល') || t.includes('duration'));
            const reasonCol = findCol((t, h) => t.includes('មូលហេតុ') || t.includes('reason'));
            const otherCol = findCol((t, h) => t.includes('ផ្សេងៗ') || t.includes('other'));

            if (staffIdCol === -1 && civilIdCol === -1) {
              window.alert('រកមិនឃើញជួរឈរ "លេខកាត" ឬ "លេខមន្ត្រី" ក្នុង Excel ទេ');
              return;
            }

            // Always build maps from the full HR list (not only the current filtered list)
            let hrList = Array.isArray(list) ? list : [];
            try {
              const { data: allHr } = await api.get('/hr', { params: {} });
              if (Array.isArray(allHr) && allHr.length > 0) {
                hrList = allHr;
              }
            } catch (loadAllErr) {
              console.debug('Load all HR for outOfCadre import failed, fallback to current list', loadAllErr?.message || loadAllErr);
            }

            const byStaff = new Map();
            const byCivil = new Map();

            hrList.forEach((hr) => {
              const sid = hr.staffId || hr.cardNumber || hr.cardNo || hr.no;
              const cid = hr.civilServantId || hr.officerId || hr.staffId || hr.no;
              if (sid) byStaff.set(String(sid).trim(), hr);
              if (cid) byCivil.set(String(cid).trim(), hr);
            });

            const normCell = (v) => {
              if (v == null || v === '') return '';
              if (v instanceof Date) {
                try {
                  return v.toISOString().slice(0, 10);
                } catch {
                  return v.toString();
                }
              }
              if (typeof v === 'number') {
                const dt = excelSerialToDate(v);
                if (dt) return dt.toISOString().slice(0, 10);
                return String(v);
              }
              const s = String(v).trim();
              return s;
            };

            let updated = 0;
            let failed = 0;
            let rowsWithData = 0;
            const failedDetails = [];
            let skippedNoMatch = 0;
            let skippedNoData = 0;
            const updatePromises = [];

            for (let i = 1; i < aoa.length; i++) {
              const row = aoa[i];
              if (!row || row.length === 0) continue;

              const excelRowNumber = i + 1; // 1-based row index for user display

              const rawStaff = staffIdCol !== -1 ? normCell(row[staffIdCol]) : '';
              const rawCivil = civilIdCol !== -1 ? normCell(row[civilIdCol]) : '';
              const rawName = nameCol !== -1 ? normCell(row[nameCol]) : '';

              if (!rawStaff && !rawCivil && !rawName) continue;

              const hr = (rawStaff && byStaff.get(rawStaff)) || (rawCivil && byCivil.get(rawCivil));
              if (!hr) {
                skippedNoMatch++;
                continue;
              }

              const numVal = numberCol !== -1 ? normCell(row[numberCol]) : '';
              const startVal = startCol !== -1 ? normCell(row[startCol]) : '';
              const endVal = endCol !== -1 ? normCell(row[endCol]) : '';
              const validityVal = validityCol !== -1 ? normCell(row[validityCol]) : '';
              const statusVal = statusCol !== -1 ? normCell(row[statusCol]) : '';
              const durationVal = durationCol !== -1 ? normCell(row[durationCol]) : '';
              const reasonVal = reasonCol !== -1 ? normCell(row[reasonCol]) : '';
              const otherVal = otherCol !== -1 ? normCell(row[otherCol]) : '';

              const hasAny = [numVal, startVal, endVal, validityVal, statusVal, durationVal, reasonVal, otherVal].some((v) => v && v !== '');
              if (!hasAny) {
                skippedNoData++;
                continue;
              }
              rowsWithData++;

              const existingOutOfCadre = hr.outOfCadre || {};
              const payloadOutOfCadre = { ...existingOutOfCadre };

              if (numVal) payloadOutOfCadre.number = numVal;
              if (startVal) payloadOutOfCadre.Start = startVal;
              if (endVal) payloadOutOfCadre.End = endVal;
              if (validityVal) payloadOutOfCadre.validity = isNaN(Number(validityVal)) ? validityVal : Number(validityVal);
              if (statusVal) payloadOutOfCadre.status = statusVal;
              if (durationVal) payloadOutOfCadre.duration = durationVal;
              if (reasonVal) payloadOutOfCadre.Reason = reasonVal;
              if (otherVal) payloadOutOfCadre.other = otherVal;

              const id = hr._id || hr.no || hr.staffId;
              if (!id) {
                skippedNoMatch++;
                continue;
              }

              updatePromises.push(
                api
                  .put(`/hr/${id}`, { outOfCadre: payloadOutOfCadre })
                  .then((resp) => {
                    updated++;
                    const updatedHr = resp && resp.data ? resp.data : { ...hr, outOfCadre: payloadOutOfCadre };
                    setList((prev) =>
                      (prev || []).map((h) => {
                        if (h._id && updatedHr._id && h._id === updatedHr._id) return updatedHr;
                        if (h._id && hr._id && h._id === hr._id) return { ...h, outOfCadre: payloadOutOfCadre };
                        if (!h._id && (h.no === hr.no || h.staffId === hr.staffId)) return { ...h, outOfCadre: payloadOutOfCadre };
                        return h;
                      })
                    );
                  })
                  .catch((errReq) => {
                    failed++;
                    const errMsg = errReq?.response?.data?.message || errReq?.message || 'Error';
                    console.error('Update outOfCadre from Excel failed', errMsg, errReq);
                    failedDetails.push({
                      row: excelRowNumber,
                      staff: rawStaff || rawCivil || rawName || '',
                      error: errMsg,
                    });
                  })
              );
            }

            if (updatePromises.length > 0) {
              await Promise.allSettled(updatePromises);
            }

            let msg = `Import បញ្ចប់៖ មានជួរដេកមានទិន្នន័យ ${rowsWithData}` +
              `\nបច្ចុប្បន្នភាពបានជោគជ័យ: ${updated} កំណត់ត្រា` +
              `\nបរាជ័យពេលធ្វើបច្ចុប្បន្នភាព: ${failed} ជួរដេក` +
              `\nមិនរកឃើញបុគ្គលិក: ${skippedNoMatch} ជួរដេក` +
              `\nមិនមានទិន្ន័យទំនេរ: ${skippedNoData} ជួរដេក`;
            if (failedDetails.length > 0) {
              msg += '\n\nលំអិតបរាជ័យ:\n' + failedDetails
                .slice(0, 10)
                .map((f) => `ជួរដេក ${f.row} (ID: ${f.staff || 'N/A'}) → ${f.error}`)
                .join('\n');
              if (failedDetails.length > 10) {
                msg += `\n… ចំនួនបន្ថែម ${failedDetails.length - 10} ជួរដេក`;
              }
            }
            window.alert(msg);
          } catch (err2) {
            console.error('Import outOfCadre Excel failed', err2);
            window.alert('Import Excel បរាជ័យ: ' + (err2?.message || 'Unknown error'));
          } finally {
            setImporting(false);
            setLoading(false);
            if (importFileRef.current) {
              try {
                importFileRef.current.value = '';
              } catch {
                // ignore
              }
            }
          }
        })();
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('Import Excel បរាជ័យ', err);
      setImporting(false);
      setLoading(false);
    }
  };

  // status badges removed (not used in OutOfCadreLeave report)

  // Render a single group table with a title and count
  const renderGroupTable = (title, rows, showHeader = true) => {
    if (!rows || rows.length === 0) return null;
    // determine which optional outOfCadre columns actually contain data across rows
    const hasOutOfCadreValue = (r, field) => {
      const u = (r.hr && r.hr.outOfCadre) ? r.hr.outOfCadre : {};
      try {
        if (field === 'validity') {
          const m = computeOutOfCadreMeta(u || {}, r.hr);
          return (m && (m.validityDays !== null && typeof m.validityDays !== 'undefined')) || (u && u.validity !== null && typeof u.validity !== 'undefined' && u.validity !== '');
        }
        if (field === 'status') {
          const m = computeOutOfCadreMeta(u || {}, r.hr);
          const raw = (u && (u.status || u.status === 0)) ? String(u.status).trim() : '';
          return (m && m.statusLabel) || (raw !== '');
        }
        if (field === 'duration') {
          const m = computeOutOfCadreMeta(u || {}, r.hr);
          return (m && m.durationLabel) || (u && u.duration !== null && typeof u.duration !== 'undefined' && u.duration !== '');
        }
        if (field === 'other') return (u && u.other !== null && typeof u.other !== 'undefined' && u.other !== '');
        if (field === 'Start') return (u && (u.Start || u.start) !== null && typeof (u.Start || u.start) !== 'undefined' && (u.Start || u.start) !== '');
        if (field === 'End') return (u && (u.End || u.end) !== null && typeof (u.End || u.end) !== 'undefined' && (u.End || u.end) !== '');
        if (field === 'image') return (u && u.image);
      } catch {
        return false;
      }
      return false;
    };

    // Always show outOfCadre-related columns to match Study report layout (even when values are empty)
    const visible = {
      validity: true,
      status: true,
      duration: true,
      other: true,
      Start: true,
      End: true,
      image: true,
    };

    // Build column definitions (include optional outOfCadre columns)
    const columnDefs = [
      { key: 'index', label: 'ល.រ', width: '40px' },
      { key: 'civilId', label: 'លេខមន្ត្រី', width: '80px' },
      { key: 'name', label: 'គោត្តនាម និងនាម', width: '120px' },
      { key: 'gender', label: 'ភេទ', width: '30px' },
      { key: 'role', label: 'មុខងារ', width: '150px' },
      { key: 'position', label: 'តួនាទី', width: '150px' },
      { key: 'dept', label: 'ផ្នែក', width: '200px' },
      { key: 'newWorkplace', label: 'ទីកន្លែងកាងារថ្មី', width: '180px' },
      ...(visible.Start ? [{ key: 'Start', label: 'ថ្ងៃចាប់ផ្ដើម', width: '90px' }] : []),
      ...(visible.End ? [{ key: 'End', label: 'ថ្ងៃបញ្ចប់', width: '90px' }] : []),
      ...(visible.status ? [{ key: 'status', label: 'ស្ថានភាព', width: '200px' }] : []),
      ...(visible.image ? [{ key: 'image', label: 'ឯកសារយោង', width: '80px' }] : []),
      ...(visible.other ? [{ key: 'other', label: 'ផ្សេងៗ', width: '140px' }] : []),
      { key: 'action', label: 'សកម្មភាព', width: '100px' }
    ];
    // Filter columnDefs to the order in colOrder (keep only defined keys)
    const orderedDefs = (colOrder || defaultCols).map(k => columnDefs.find(c => c.key === k)).filter(Boolean).filter(c => !!visibleCols[c.key]);
    const numCols = orderedDefs.length;
    const equalPct = (100 / numCols).toFixed(4) + '%';
    // Use explicit width from columnDefs when provided (e.g., '40px' or '90px'),
    // otherwise fall back to equal percentage width so layout remains balanced.
    const colElems = orderedDefs.map((c, i) => {
      const w = c && c.width ? c.width : equalPct;
      return <col key={c.key || i} style={{ width: w }} />;
    });
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          {(() => {
            const totalN = rows.length || 0;
            const maleN = rows.filter(r => r.hr && r.hr.gender === 'Male').length;
            const femaleN = rows.filter(r => r.hr && r.hr.gender === 'Female').length;
            return (
              <h4 style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>{title} — {toKhmerDigits(totalN)} នាក់ ( ប្រុស: {toKhmerDigits(maleN)} — ស្រី: {toKhmerDigits(femaleN)} )</h4>
            );
          })()}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup>
            {colElems}
          </colgroup>
          {showHeader && (
            <thead>
              <tr>
                {orderedDefs.map(col => (
                  <th
                    key={col.key}
                    draggable
                    onDragStart={(e) => { draggingKeyRef.current = col.key; e.dataTransfer?.setData('text/plain', col.key); }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = draggingKeyRef.current || e.dataTransfer?.getData('text/plain');
                      const to = col.key;
                      if (!from || from === to) return;
                      setColOrder(prev => {
                        const next = (prev || defaultCols).slice();
                        const fi = next.indexOf(from);
                        const ti = next.indexOf(to);
                        if (fi === -1 || ti === -1) return prev;
                        next.splice(fi, 1);
                        next.splice(ti, 0, from);
                        return next;
                      });
                      draggingKeyRef.current = null;
                    }}
                    style={{ border: '1px solid #d1cfcf', padding: '6px', cursor: 'grab', userSelect: 'none', textAlign: 'center' }}
                    className="center"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, idx) => {
              const staffId = row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || null;
              const civilId = row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || null;
              const fullName = row.hr.khmerName || row.hr.name || null;
              const gender = row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : null;
              const role = row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || null;
              const position = row.hr.position || row.hr.role || row.hr.title || null;
              const deptName = row.hr.Department_Kh || row.hr.department || null;
              const outOfCadre = row.hr && row.hr.outOfCadre ? row.hr.outOfCadre : {};
              return (
                <tr key={row.hr._id || idx}>
                  {orderedDefs.map((col) => {
                    const k = col.key;
                    if (k === 'index') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, wordBreak: 'break-word', overflowWrap: 'break-word' }} className="center">{toKhmerDigits(idx + 1)}</td>);
                    if (k === 'civilId') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, wordBreak: 'break-word', overflowWrap: 'break-word' }} className="center">{civilId ? civilId : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'name') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{fullName ? fullName : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'gender') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, wordBreak: 'break-word', overflowWrap: 'break-word' }} className="center">{gender ? gender : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'role') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{role ? role : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'position') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{position ? position : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'dept') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, wordBreak: 'break-word', overflowWrap: 'break-word' }}>{deptName ? deptName : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'newWorkplace') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6 }}>{outOfCadre && outOfCadre.newWorkplace ? outOfCadre.newWorkplace : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'status') {
                      const meta = computeOutOfCadreMeta(outOfCadre || {}, row.hr);
                      const rawStatus = (outOfCadre && (typeof outOfCadre.status !== 'undefined' && outOfCadre.status !== null)) ? String(outOfCadre.status).trim() : '';
                      const statusToShow = (meta && meta.statusLabel) ? meta.statusLabel : (rawStatus !== '' ? rawStatus : null);
                      return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6 }} className="center">{statusToShow ? renderStatusBadge(statusToShow) : (outOfCadre && outOfCadre.status ? renderStatusBadge(outOfCadre.status) : (<span className="text-gray-400">-</span>))}</td>);
                    }
                    if (k === 'other') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6 }}>{(outOfCadre && outOfCadre.other) ? outOfCadre.other : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'Start') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6 }} className="center">{(outOfCadre && (outOfCadre.Start || outOfCadre.start)) ? fmtShortDate(outOfCadre.Start || outOfCadre.start) : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'End') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6 }} className="center">{(outOfCadre && (outOfCadre.End || outOfCadre.end)) ? fmtShortDate(outOfCadre.End || outOfCadre.end) : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'image') return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6 }}>{outOfCadre && outOfCadre.image ? (<a href={outOfCadre.image} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>) : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'action') {
                      const outOfCadreObj = row.hr && row.hr.outOfCadre ? row.hr.outOfCadre : {};
                      let hasOutOfCadre = false;
                      try { hasOutOfCadre = Object.keys(outOfCadreObj || {}).some(uk => { const v = outOfCadreObj[uk]; return v !== null && typeof v !== 'undefined' && String(v).trim() !== ''; }); } catch { }
                      return (
                        <td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6, verticalAlign: 'middle', whiteSpace: 'nowrap' }} className="center">
                          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openEdit(row.hr)}
                              title="កែប្រែ"
                              aria-label="Edit outOfCadre"
                              style={{
                                background: '#f59e0b',
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                border: '1px solid #d4af2b',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0
                              }}
                              className="text-xs"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                                <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                              </svg>
                            </button>
                            {hasOutOfCadre && (
                              <button
                                type="button"
                                onClick={() => handleDeleteOutOfCadre(row.hr)}
                                title="លុបទិន្នន័យ"
                                aria-label="Delete outOfCadre"
                                style={{
                                  background: '#fa0404',
                                  width: 32,
                                  height: 32,
                                  borderRadius: 6,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '2px solid #f30303',
                                  color: '#ffffff',
                                  padding: 0
                                }}
                                className="text-xs"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
                                  <path d="M9 3v1H15V3H9zM7 7v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7H7zm3 3h2v8H10V10zm4 0h2v8h-2V10z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    }
                    return (<td key={k} style={{ border: '1px solid #e6dbdbff', padding: 6 }}>-</td>);
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (!(perms.canViewHR || perms.canViewEmployees)) {
    return (
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-2">របាយការណ៍ ក្រៅក្របខណ្ឌដើម</h3>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">របាយការណ៍ ក្រៅក្របខណ្ឌដើម</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-sm">ស្វែងរក (ID ឬ ឈ្មោះ):</label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              className="rounded-md bg-gray-50 px-3 py-2 w-56 text-sm placeholder-gray-400 border border-gray-200"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { doImmediateSearch(q); } }}
              placeholder="វាយលេខកាត ឬ ឈ្មោះ: S0015 ឬ ឈ្មោះ"
            />
            <button
              type="button"
              className="ml-1 border rounded px-2 py-1 text-sm bg-white text-gray-700"
              onClick={() => setQ('')}
            >
              Clear
            </button>
          </div>

          <label className="text-sm">ចន្ទគតិ*:</label>
          <input
            type="text"
            className="border rounded px-2 py-1 w-72"
            placeholder="ឧ. ថ្ងៃសុក្រ ១៣កើត ខែភទ្របទ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស. ២៥៦៩"
            value={lunarText}
            onChange={(e) => setLunarText(e.target.value)}
          />
          <label className="text-sm">ថ្ងៃខែឆ្នាំ:</label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={footerDate}
            onChange={(e) => setFooterDate(e.target.value)}
          />

          {/* inline warnings */}
          {(!lunarText.trim()) && <span className="text-red-600 text-xs">សូមបំពេញចន្ទគតិ</span>}
          <button className={`border px-2 py-1 rounded ${loading ? 'bg-gray-100 text-gray-300' : 'bg-green-600 text-white border-green-600'}`} onClick={handleExportExcel} disabled={loading}>Export Excel</button>
          <button
            type="button"
            className={`border px-2 py-1 rounded ml-2 ${importing || loading ? 'bg-gray-100 text-gray-300' : 'bg-orange-500 text-white border-orange-500'}`}
            disabled={importing || loading}
            onClick={() => importFileRef.current && importFileRef.current.click()}
          >
            Import Excel
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              if (file) handleImportExcel(file);
            }}
          />
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowColsPanel(s => !s)} title="ជ្រើសជួរឈរ" className="border px-2 py-1 rounded bg-white text-gray-700">Columns</button>
            {showColsPanel && (
              <div style={{ position: 'absolute', right: 0, top: '38px', background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 6px 12px rgba(0,0,0,0.08)', padding: 10, zIndex: 1200, minWidth: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>បង្ហាញជួរឈរ</strong>
                  <button type="button" onClick={() => setShowColsPanel(false)} style={{ border: 'none', background: 'transparent' }}>×</button>
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {(defaultCols || []).map(k => (
                    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <input type="checkbox" checked={!!visibleCols[k]} onChange={() => setVisibleCols(prev => ({ ...prev, [k]: !prev[k] }))} />
                      <span>{colLabels[k] || k}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button type="button" onClick={() => setVisibleCols(() => { const o = {}; defaultCols.forEach(k => o[k] = true); return o; })} className="border rounded px-2 py-1 text-sm">Select all</button>
                  <button type="button" onClick={() => setVisibleCols(() => { const o = {}; defaultCols.forEach(k => o[k] = false); return o; })} className="border rounded px-2 py-1 text-sm">Clear</button>
                </div>
              </div>
            )}
          </div>
          <button className={`border px-2 py-1 rounded ${(!lunarText.trim() || loading) ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white border-blue-600'}`} onClick={handlePrint} disabled={!lunarText.trim() || loading}>បោះពុម្ព</button>
        </div>
      </div>

      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

      <div ref={printRef} className="bg-white p-4 border rounded print-scope">
        <style dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '16px' }}>ព្រះរាជាណាចក្រកម្ពុជា</div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '14px' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          <div style={{ position: 'relative', textAlign: 'left', padding: '6px 0' }}>
            {/* background image behind the text */}
            <img src={headerBg} alt="" aria-hidden="true"
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150px', height: 'auto', opacity: 88, pointerEvents: 'none' }} />
            <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12.5px', position: 'relative', zIndex: 1 }}>ក្រសួងសុខាភិបាល</div>
          </div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'left' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>បញ្ជីឈ្មោះមន្រ្តី ក្រៅក្របខណ្ឌដើមពី មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត ឆ្នាំ {toKhmerDigits(retireYear)}</div>
        </div>
        {/* Single flat table for outOfCadre leave listing */}
        <div className="no-print">
          {(() => {
            const rows = derived.rows || [];
            if (rows.length === 0) return <div className="center text-gray-600">មិនមានទិន្នន័យ</div>;
            // Compute outOfCadre meta once per row to avoid repeated computation and make grouping explicit
            const rowsWithMeta = rows.map(r => ({ ...r, outOfCadreMeta: computeOutOfCadreMeta((r.hr && r.hr.outOfCadre) ? r.hr.outOfCadre : {}) }));
            // If none of the rows contain any outOfCadre data, treat all rows as 'no status' so the table shows data
            const anyOutOfCadreData = rowsWithMeta.some(rr => {
              const u = rr.hr && rr.hr.outOfCadre ? rr.hr.outOfCadre : {};
              return Object.keys(u).some(k => {
                const v = u[k];
                return v !== null && typeof v !== 'undefined' && String(v).trim() !== '';
              });
            });
            let g0 = [];
            let g1 = [];
            let g2 = [];
            let g3 = [];
            let g4 = [];
            if (!anyOutOfCadreData) {
              g0 = rowsWithMeta.map(r => r);
            } else {
              g0 = rowsWithMeta.filter(r => !r.outOfCadreMeta || !r.outOfCadreMeta.statusLabel).map(r => r);
              g1 = rowsWithMeta.filter(r => r.outOfCadreMeta && r.outOfCadreMeta.statusLabel && r.outOfCadreMeta.statusLabel.includes('ត្រៀម')).map(r => r);
              g2 = rowsWithMeta.filter(r => r.outOfCadreMeta && r.outOfCadreMeta.statusLabel && r.outOfCadreMeta.statusLabel.includes('កំពុង')).map(r => r);
              // Separate 'returned to service' and 'ended over 1 month' into distinct groups
              g3 = rowsWithMeta.filter(r => r.outOfCadreMeta && r.outOfCadreMeta.statusLabel && r.outOfCadreMeta.statusLabel.includes('ចូល')).map(r => r);
              g4 = rowsWithMeta.filter(r => r.outOfCadreMeta && r.outOfCadreMeta.statusLabel && r.outOfCadreMeta.statusLabel.includes('បញ្ចប់')).map(r => r);
            }
            // renderGroupTable expects rows with hr property — rowsWithMeta entries include hr, so pass them through
            return (
              <div>
                {(() => {
                  const groups = [
                    { title: 'មិនទាន់មានស្ថានភាព', rows: g0 },
                    { title: 'ត្រៀមទំនេរ', rows: g1 },
                    { title: 'កំពុងទំនេរ', rows: g2 },
                    { title: 'ចូលបម្រើការងារវិញ', rows: g3 },
                    { title: 'បញ្ចប់ក្រៅក្របខណ្ឌដើមលើស១ខែ', rows: g4 }
                  ];
                  const firstNonEmpty = groups.findIndex(g => g.rows && g.rows.length > 0);
                  return groups.map((g, idx) => (
                    <React.Fragment key={g.title || idx}>
                      {renderGroupTable(g.title, g.rows, idx === firstNonEmpty)}
                    </React.Fragment>
                  ));
                })()}
              </div>
            );
          })()}
        </div>
        {/* Print-only simplified tables for printing (mirror Study page behavior) */}
        <div className="print-only" style={{ display: 'none' }}>
          {(() => {
            const rowsAll = derived.rows || [];
            if (!rowsAll || rowsAll.length === 0) return <div className="center">មិនមានទិន្នន័យ</div>;
            const rowsWithMeta = rowsAll.map(r => ({ ...r, outOfCadreMeta: computeOutOfCadreMeta((r.hr && r.hr.outOfCadre) ? r.hr.outOfCadre : {}) }));
            const rowsOngoing = rowsWithMeta.filter(r => r.outOfCadreMeta && r.outOfCadreMeta.statusLabel && r.outOfCadreMeta.statusLabel.includes('កំពុង'));
            const rowsReturned = rowsWithMeta.filter(r => r.outOfCadreMeta && r.outOfCadreMeta.statusLabel && r.outOfCadreMeta.statusLabel.includes('ចូល'));
            const rowsEnded = rowsWithMeta.filter(r => r.outOfCadreMeta && r.outOfCadreMeta.statusLabel && r.outOfCadreMeta.statusLabel.includes('បញ្ចប់'));

            const renderSimpleTable = (title, rows) => {
              return (
                <div style={{ marginBottom: 12 }} key={title}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    {(() => {
                      const totalN = rows.length || 0;
                      const maleN = rows.filter(r => r.hr && r.hr.gender === 'Male').length;
                      const femaleN = rows.filter(r => r.hr && r.hr.gender === 'Female').length;
                      return (
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{title} — {toKhmerDigits(totalN)} នាក់ ( ប្រុស: {toKhmerDigits(maleN)} — ស្រី: {toKhmerDigits(femaleN)} )</div>
                      );
                    })()}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>ល.រ</th>
                        <th>លេខមន្ត្រី</th>
                        <th>គោត្តនាម និងនាម</th>
                        <th>ភេទ</th>
                        <th>មុខងារ</th>
                        <th>តួនាទី</th>
                        <th>ផ្នែក</th>
                        <th>ទីកន្លែងកាងារថ្មី</th>
                        <th>ថ្ងៃចាប់ផ្ដើម</th>
                        <th>ថ្ងៃបញ្ចប់</th>
                        <th>ស្ថានភាព</th>
                        <th>ផ្សេងៗ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const outOfCadre = (row.hr && row.hr.outOfCadre) ? row.hr.outOfCadre : {};
                        const meta = computeOutOfCadreMeta(outOfCadre || {});
                        return (
                          <tr key={row.hr._id || idx}>
                            <td className="center">{toKhmerDigits(idx + 1)}</td>
                            <td className="center">{row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || ''}</td>
                            <td>{row.hr.khmerName || row.hr.name || ''}</td>
                            <td className="center">{row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : ''}</td>
                            <td>{row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || ''}</td>
                            <td>{row.hr.position || row.hr.role || row.hr.title || ''}</td>
                            <td>{row.hr.Department_Kh || row.hr.department || ''}</td>
                            <td className="center">{outOfCadre && outOfCadre.newWorkplace ? outOfCadre.newWorkplace : ''}</td>
                            <td className="center">{(outOfCadre && (outOfCadre.Start || outOfCadre.start)) ? fmtShortDate(outOfCadre.Start || outOfCadre.start) : ''}</td>
                            <td className="center">{(outOfCadre && (outOfCadre.End || outOfCadre.end)) ? fmtShortDate(outOfCadre.End || outOfCadre.end) : ''}</td>
                            <td className="center">{meta && meta.statusLabel ? meta.statusLabel : (outOfCadre && outOfCadre.status ? outOfCadre.status : '')}</td>
                            <td>{outOfCadre && outOfCadre.other ? outOfCadre.other : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            };

            return (
              <div>
                {rowsOngoing.length > 0 ? renderSimpleTable('កំពុងទំនេរ', rowsOngoing) : null}
                {rowsReturned.length > 0 ? renderSimpleTable('ចូលបម្រើការងារវិញ', rowsReturned) : null}
                {(rowsOngoing.length === 0 && rowsReturned.length === 0) && <div className="center">មិនមានទិន្នន័យ</div>}
              </div>
            );
          })()}
        </div>
        {/* Edit modal removed — this page is read-only */}
        {/* Edit modal for outOfCadre fields */}
        {showEdit && (
          <div className="no-print" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ width: 720, background: '#fff', borderRadius: 6, padding: 16, maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>កែប្រែ ក្រៅក្របខណ្ឌដើម</h4>
                <button onClick={closeEdit} className="text-gray-600">បិទ</button>
              </div>

              {/* Two-column layout like the screenshot — always show the common outOfCadre fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="text-sm">ទីកន្លែងកាងារថ្មី</label>
                  <input type="text" value={editingOutOfCadre.newWorkplace || ''} onChange={(e) => handleEditChange('newWorkplace', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">ស្ថានភាព</label>
                  <input type="text" value={editingOutOfCadre.status || ''} onChange={(e) => handleEditChange('status', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">ផ្សេងៗ</label>
                  <input type="text" value={editingOutOfCadre.other || ''} onChange={(e) => handleEditChange('other', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">ថ្ងៃចាប់ផ្ដើម</label>
                  <input
                    type="date"
                    value={toDateInputValue(editingOutOfCadre.Start || editingOutOfCadre.start || '')}
                    onChange={(e) => handleEditChange('Start', e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </div>

                <div>
                  <label className="text-sm">ថ្ងៃបញ្ចប់</label>
                  <input
                    type="date"
                    value={toDateInputValue(editingOutOfCadre.End || editingOutOfCadre.end || '')}
                    onChange={(e) => handleEditChange('End', e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="text-sm">ឯកសារយោង (image/pdf)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input ref={fileInputRef} type="file" onChange={(e) => handleFileSelect(e.target.files && e.target.files[0])} />
                    {selectedPreviewUrl && <a href={selectedPreviewUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Preview</a>}
                    {!selectedPreviewUrl && editingOutOfCadre.image && <a href={editingOutOfCadre.image} target="_blank" rel="noreferrer" className="text-blue-600 underline">Current file</a>}
                    {editingOutOfCadre.image && (
                      <button
                        type="button"
                        onClick={handleDeleteReference}
                        title="លុបឯកសារ"
                        aria-label="Delete file"
                        style={{
                          background: '#ef4444',
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #ef4444',
                          color: '#fff',
                          padding: 0
                        }}
                        className="text-sm"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
                          <path d="M9 3v1H15V3H9zM7 7v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7H7zm3 3h2v8H10V10zm4 0h2v8h-2V10z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={closeEdit} className="border rounded px-3 py-1">បោះបង់</button>
                <button type="button" onClick={handleSaveEdit} className="border rounded px-3 py-1 bg-green-600 text-white" disabled={saving || uploadingFile}>{saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}</button>
              </div>
            </div>
          </div>
        )}
        {/* footer/signature area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '12px' }}>
          <div style={{ width: '33%' }}>
            <div className="no-print">
              {(() => {
                const totalN = (Number.isFinite(derived.total) ? derived.total : (derived.rows ? derived.rows.length : 0));
                const maleN = (Number.isFinite(derived.male) ? derived.male : 0);
                const femaleN = (Number.isFinite(derived.female) ? derived.female : 0);
                return `សរុប: ${toKhmerDigits(totalN)} នាក់ ( ប្រុស: ${toKhmerDigits(maleN)} នាក់ — ស្រី: ${toKhmerDigits(femaleN)} នាក់ )`;
              })()}
            </div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>បានឃើញ</div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>នាយកមន្ទីរពេទ្យ</div>
            <div style={{ height: '64px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
          <div style={{ width: '33%', textAlign: 'center' }}>
            <div style={{ marginTop: '16px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>បានពិនិត្យត្រឹមត្រូវ</div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</div>
            <div style={{ height: '82px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
          <div style={{ width: '33%', textAlign: 'right' }}>
            <div style={{ marginTop: '12px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>
              {lunarText && lunarText.trim()
                ? lunarText
                : `ថ្ងៃ${khWeekday(new Date())}  ព.ស. ${toKhmerDigits(buddhistEraYear(new Date()))}`}
            </div>
            <div style={{ marginTop: '2px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>
              រាជធានីភ្នំពេញ {fmtKhmerLongDate(footerDate)}
            </div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}> អ្នកធ្វើតារាង</div>
            <div style={{ height: '82px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
        </div>
      </div>
    </div>
  );
}
