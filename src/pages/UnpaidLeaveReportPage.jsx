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

function computeUnpaidMeta(unpaid, hr) {
  const start = parseDateSafe(unpaid && (unpaid.Start || unpaid.start));
  const end = parseDateSafe(unpaid && (unpaid.End || unpaid.end));
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
    statusLabel = 'ត្រៀមទំនេរគ្មានបៀវត្ស';
  } else if (start && (!end || (end && end >= today))) {
    // if start is in the past and end is not present or end >= today -> ongoing
    statusLabel = 'កំពុងបន្តទំនេរគ្មានបៀវត្ស';
  } else if (end && end < today) {
    const daysSinceEnd = daysBetween(end, today);
    if (isResigned) {
      statusLabel = 'បានលាឈប់';
    } else if (daysSinceEnd > 30) {
      statusLabel = 'បញ្ចប់ទំនេរគ្មានបៀវត្សលើស១ខែ';
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


export default function RetirementReportPage() {
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
    'index', 'staffId', 'civilId', 'name', 'gender', 'dob', 'role', 'position', 'dept', 'number', 'Start', 'End', 'image', 'validity', 'status', 'duration', 'reason', 'other'
  ];
  if (perms.isAdmin || perms.canEditUnpaidLeaveReport) defaultCols.push('action');
  const [colOrder, setColOrder] = useState(defaultCols);
  const [visibleCols, setVisibleCols] = useState(() => {
    const obj = {};
    (defaultCols || []).forEach(k => { obj[k] = true; });
    return obj;
  });
  const [showColsPanel, setShowColsPanel] = useState(false);
  const colLabels = {
    index: 'ល.រ',
    staffId: 'លេខកាត',
    civilId: 'លេខមន្ត្រី',
    name: 'គោត្តនាម និងនាម',
    gender: 'ភេទ',
    dob: 'ថ្ងៃខែឆ្នាំកំណើត',
    role: 'មុខងារ',
    position: 'តួនាទី',
    dept: 'ផ្នែក',
    number: 'ចំនួនទំនេរ',
    Start: 'ថ្ងៃចាប់ផ្ដើម',
    End: 'ថ្ងៃបញ្ចប់',
    image: 'ឯកសារយោង',
    validity: 'សុពលភាព',
    status: 'ស្ថានភាព',
    duration: 'រយៈពេល',
    reason: 'មូលហេតុ',
    other: 'ផ្សេងៗ',
    ...((perms.isAdmin || perms.canEditUnpaidLeaveReport) ? { action: 'សកម្មភាព' } : {})
  };
  const draggingKeyRef = useRef(null);
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Edit modal state for unpaid fields
  const [showEdit, setShowEdit] = useState(false);
  const [editingHr, setEditingHr] = useState(null);
  const [editingUnpaid, setEditingUnpaid] = useState({});
  const fileInputRef = useRef();
  const [originalUnpaid, setOriginalUnpaid] = useState(null);
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
    const hasUnpaidData = (hr) => {
      const u = hr && hr.unpaid ? hr.unpaid : null;
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
        const unpaid = hr.unpaid || {};
        const unpaidNumber = (unpaid.number || unpaid.no || '').toString().toLowerCase();
        const unpaidReason = (unpaid.Reason || unpaid.reason || unpaid.reasonText || '').toString().toLowerCase();
        const unpaidOther = (unpaid.other || '').toString().toLowerCase();
        // If a search term is present, match across common fields and unpaid fields (do not require hasUnpaidData)
        if (term) {
          return sid.includes(term) || name.includes(term) || position.includes(term) || deptField.includes(term) || unpaidNumber.includes(term) || unpaidReason.includes(term) || unpaidOther.includes(term);
        }
        // No search term: only include HR that actually have unpaid data
        if (!hasUnpaidData(hr)) return false;
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
      'ត្រៀមទំនេរគ្មានបៀវត្ស': { background: '#f39c12' },
      'កំពុងទំនេរ': { background: '#16a34a' },
      'កំពុងបន្តទំនេរគ្មានបៀវត្ស': { background: '#16a34a' },
      'ចូលបម្រើការងារវិញ': { background: '#230ab4ff' },
      'បានលាឈប់': { background: '#dc2626' },
      'បញ្ចប់ទំនេរគ្មានបៀវត្សលើស១ខែ': { background: '#b91c1c' }
    };
    const sStyle = mapping[s] || { background: '#333' };
    return <span style={{ ...style, ...sStyle }}>{s}</span>;
  };


  // Debug: log fetched list and computed rows for troubleshooting
  useEffect(() => {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[UnpaidLeaveReport] list count:', Array.isArray(list) ? list.length : 0, 'derived rows:', derived.rows ? derived.rows.length : 0);
      console.debug('[UnpaidLeaveReport] sample rows:', (derived.rows || []).slice(0, 5).map(r => ({ id: r.hr._id || r.hr.no || r.hr.staffId, name: r.hr.khmerName || r.hr.name })));
    }
  }, [list, derived]);

  const openEdit = (hr) => {
    setEditingHr({ ...hr, unpaid: { ...(hr.unpaid || {}) } });
    setEditingUnpaid(hr && hr.unpaid ? { ...hr.unpaid } : { image: '' });
    try { setOriginalUnpaid(JSON.parse(JSON.stringify(hr && hr.unpaid ? hr.unpaid : {}))); } catch { setOriginalUnpaid(hr && hr.unpaid ? { ...hr.unpaid } : {}); }
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
    setShowEdit(true);
  };

  const closeEdit = () => {
    try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch { /* ignore */ }
    setShowEdit(false);
    setEditingHr(null);
    setEditingUnpaid({});
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
  };

  const handleEditChange = (field, value) => {
    setEditingUnpaid(prev => {
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
        // set into editingUnpaid so preview/current file updates
        setEditingUnpaid(prev => ({ ...(prev || {}), image: url }));
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
    if (!editingUnpaid || !(editingUnpaid.image)) return;
    const ok = window.confirm('លុបឯកសារយោង?');
    if (!ok) return;
    const imageUrl = editingUnpaid.image;
    setEditingUnpaid(prev => ({ ...(prev || {}), image: '' }));
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
        const curr = editingUnpaid || {};
        const orig = originalUnpaid || {};
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
  }, [showEdit, editingUnpaid, originalUnpaid]);

  // Helper to decide whether to render a modal input for a given unpaid field.
  // We show the input if the original record had that field (non-empty), or if the editing state already contains the field (allow adding new if the user typed it previously).
  const showIfPresent = (field) => {
    if (!showEdit) return false;
    try {
      if (originalUnpaid && Object.prototype.hasOwnProperty.call(originalUnpaid, field)) {
        // present on original even if empty string -> show
        return true;
      }
      // if editingUnpaid already has the property (user started typing), show it
      if (editingUnpaid && Object.prototype.hasOwnProperty.call(editingUnpaid, field)) return true;
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
      const payloadUnpaid = { ...(editingUnpaid || {}) };
      if (uploadedUrl) payloadUnpaid.image = uploadedUrl;
      // remove empty string image to avoid wiping server value unintentionally
      if (payloadUnpaid.image === '' || payloadUnpaid.image == null) delete payloadUnpaid.image;
      const id = editingHr._id || editingHr.no || editingHr.staffId;
      const { data } = await api.put(`/hr/${id}`, { unpaid: payloadUnpaid });
      setList(prev => prev.map(h => {
        if (h._id && data && data._id && h._id === data._id) return data;
        if (h._id && editingHr._id && h._id === editingHr._id) return { ...h, unpaid: payloadUnpaid };
        if (!h._id && (h.no === editingHr.no || h.staffId === editingHr.staffId)) return { ...h, unpaid: payloadUnpaid };
        return h;
      }));
      closeEdit();
    } catch (err) {
      console.error('Save unpaid failed', err);
      window.alert('រក្សាទុកបរាជ័យ: ' + (err?.response?.data?.message || err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUnpaid = async (hr) => {
    if (!hr) return;
    const ok = window.confirm('លុបទិន្នន័យទំនេរគ្មានបៀវត្ស?');
    if (!ok) return;
    setSaving(true);
    try {
      const id = hr._id || hr.no || hr.staffId;
      // send empty unpaid object to clear unpaid data for this staff
      const { data } = await api.put(`/hr/${id}`, { unpaid: {} });
      setList(prev => prev.map(h => {
        if (h._id && data && data._id && h._id === data._id) return data;
        if (h._id && hr._id && h._id === hr._id) return { ...h, unpaid: {} };
        if (!h._id && (h.no === hr.no || h.staffId === hr.staffId)) return { ...h, unpaid: {} };
        return h;
      }));
    } catch (err) {
      console.error('Delete unpaid failed', err);
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
      'លេខកាត',
      'លេខមន្ត្រី',
      'គោត្តនាម និងនាម',
      'ភេទ',
      'ថ្ងៃខែឆ្នាំកំណើត',
      'មុខងារ',
      'តួនាទី',
      'ផ្នែក',
      'ចំនួនទំនេរ',
      'ថ្ងៃចាប់ផ្ដើម',
      'ថ្ងៃបញ្ចប់',
      'ឯកសារយោង',
      'សុពលភាព',
      'ស្ថានភាព',
      'រយៈពេល',
      'មូលហេតុ',
      'ផ្សេងៗ'
    ];
    const data = rows.map((row, idx) => {
      // Export basic identifying fields + unpaid.* fields
      const unpaid = row.hr && row.hr.unpaid ? row.hr.unpaid : {};
      return ([
        idx + 1,
        row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || '',
        row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || '',
        row.hr.khmerName || row.hr.name || '',
        row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : '',
        fmtShortDate(row.hr.birthDate || row.hr.dob || row.hr.BirthDate || ''),
        row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || '',
        row.hr.position || row.hr.role || row.hr.title || '',
        row.hr.Department_Kh || row.hr.department || '',
        unpaid.number || '',
        fmtShortDate(unpaid.Start || unpaid.start || ''),
        fmtShortDate(unpaid.End || unpaid.end || ''),
        unpaid.image || '',
        // validity (prefer numeric days when available)
        ((computeUnpaidMeta(unpaid, row.hr).validityDays !== null && typeof computeUnpaidMeta(unpaid, row.hr).validityDays !== 'undefined') ? computeUnpaidMeta(unpaid, row.hr).validityDays : (unpaid.validity || '')),
        (unpaid.status || ''),
        (computeUnpaidMeta(unpaid, row.hr).durationLabel || unpaid.duration || ''),
        unpaid.Reason || unpaid.reason || '',
        unpaid.other || ''
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
    XLSX.writeFile(wb, `UnpaidLeave_${retireYear}.xlsx`);
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
              console.debug('Load all HR for unpaid import failed, fallback to current list', loadAllErr?.message || loadAllErr);
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

              const existingUnpaid = hr.unpaid || {};
              const payloadUnpaid = { ...existingUnpaid };

              if (numVal) payloadUnpaid.number = numVal;
              if (startVal) payloadUnpaid.Start = startVal;
              if (endVal) payloadUnpaid.End = endVal;
              if (validityVal) payloadUnpaid.validity = isNaN(Number(validityVal)) ? validityVal : Number(validityVal);
              if (statusVal) payloadUnpaid.status = statusVal;
              if (durationVal) payloadUnpaid.duration = durationVal;
              if (reasonVal) payloadUnpaid.Reason = reasonVal;
              if (otherVal) payloadUnpaid.other = otherVal;

              const id = hr._id || hr.no || hr.staffId;
              if (!id) {
                skippedNoMatch++;
                continue;
              }

              updatePromises.push(
                api
                  .put(`/hr/${id}`, { unpaid: payloadUnpaid })
                  .then((resp) => {
                    updated++;
                    const updatedHr = resp && resp.data ? resp.data : { ...hr, unpaid: payloadUnpaid };
                    setList((prev) =>
                      (prev || []).map((h) => {
                        if (h._id && updatedHr._id && h._id === updatedHr._id) return updatedHr;
                        if (h._id && hr._id && h._id === hr._id) return { ...h, unpaid: payloadUnpaid };
                        if (!h._id && (h.no === hr.no || h.staffId === hr.staffId)) return { ...h, unpaid: payloadUnpaid };
                        return h;
                      })
                    );
                  })
                  .catch((errReq) => {
                    failed++;
                    const errMsg = errReq?.response?.data?.message || errReq?.message || 'Error';
                    console.error('Update unpaid from Excel failed', errMsg, errReq);
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
            console.error('Import unpaid Excel failed', err2);
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

  // status badges removed (not used in UnpaidLeave report)

  // Render a single group table with a title and count
  const renderGroupTable = (title, rows, showHeader = true) => {
    if (!rows || rows.length === 0) return null;
    // determine which optional unpaid columns actually contain data across rows
    const hasUnpaidValue = (r, field) => {
      const u = (r.hr && r.hr.unpaid) ? r.hr.unpaid : {};
      try {
        if (field === 'validity') {
          const m = computeUnpaidMeta(u || {}, r.hr);
          return (m && (m.validityDays !== null && typeof m.validityDays !== 'undefined')) || (u && u.validity !== null && typeof u.validity !== 'undefined' && u.validity !== '');
        }
        if (field === 'status') {
          const m = computeUnpaidMeta(u || {}, r.hr);
          const raw = (u && (u.status || u.status === 0)) ? String(u.status).trim() : '';
          return (m && m.statusLabel) || (raw !== '');
        }
        if (field === 'duration') {
          const m = computeUnpaidMeta(u || {}, r.hr);
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

    // Always show unpaid-related columns to match Study report layout (even when values are empty)
    const visible = {
      validity: true,
      status: true,
      duration: true,
      other: true,
      Start: true,
      End: true,
      image: true,
    };

    // Build column definitions (include optional unpaid columns)
    const columnDefs = [
      { key: 'index', label: 'ល.រ', width: '40px' },
      { key: 'staffId', label: 'លេខកាត', width: '70px' },
      { key: 'civilId', label: 'លេខមន្ត្រី', width: '80px' },
      { key: 'name', label: 'គោត្តនាម និងនាម', width: '120px' },
      { key: 'gender', label: 'ភេទ', width: '30px' },
      { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកំណើត', width: '110px' },
      { key: 'role', label: 'មុខងារ', width: '150px' },
      { key: 'position', label: 'តួនាទី', width: '150px' },
      { key: 'dept', label: 'ផ្នែក', width: '250px' },
      { key: 'number', label: 'ចំនួនទំនេរ', width: '150px' },
      { key: 'reason', label: 'មូលហេតុ', width: '150px' },
      ...(visible.validity ? [{ key: 'validity', label: 'សុពលភាព', width: '50px' }] : []),
      ...(visible.status ? [{ key: 'status', label: 'ស្ថានភាព', width: '200px' }] : []),
      ...(visible.duration ? [{ key: 'duration', label: 'រយៈពេល', width: '100px' }] : []),
      ...(visible.other ? [{ key: 'other', label: 'ផ្សេងៗ', width: '140px' }] : []),
      ...(visible.Start ? [{ key: 'Start', label: 'ថ្ងៃចាប់ផ្ដើម', width: '90px' }] : []),
      ...(visible.End ? [{ key: 'End', label: 'ថ្ងៃបញ្ចប់', width: '90px' }] : []),
      ...(visible.image ? [{ key: 'image', label: 'ឯកសារយោង', width: '80px' }] : []),
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
      <div style={{ marginBottom: 20 }} className="w-full">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {(() => {
            const totalN = rows.length || 0;
            const maleN = rows.filter(r => r.hr && r.hr.gender === 'Male').length;
            const femaleN = rows.filter(r => r.hr && r.hr.gender === 'Female').length;
            return (
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#374151' }} className="font-khmer">
                {title} — <span style={{ color: '#2563eb' }}>{toKhmerDigits(totalN)}</span> នាក់ ( ប្រុស: <span style={{ color: '#4b5563' }}>{toKhmerDigits(maleN)}</span> — ស្រី: <span style={{ color: '#4b5563' }}>{toKhmerDigits(femaleN)}</span> )
              </h4>
            );
          })()}
        </div>
        <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', WebkitOverflowScrolling: 'touch' }} className="no-print-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: '1200px' }}>
            <colgroup>
              {colElems}
            </colgroup>
            {showHeader && (
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
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
                      style={{ borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '10px 8px', cursor: 'grab', userSelect: 'none', textAlign: 'center', fontWeight: 'bold', color: '#374151' }}
                      className="center font-khmer"
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
                const unpaid = row.hr && row.hr.unpaid ? row.hr.unpaid : {};
                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                return (
                  <tr key={row.hr._id || idx} style={{ backgroundColor: rowBg, borderBottom: '1px solid #f3f4f6' }} className="hover:bg-gray-50 transition-colors">
                    {orderedDefs.map((col) => {
                      const k = col.key;
                      const cellStyle = { borderRight: '1px solid #e5e7eb', padding: '10px 8px', wordBreak: 'break-word', overflowWrap: 'break-word', color: '#4b5563' };
                      if (k === 'index') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{toKhmerDigits(idx + 1)}</td>);
                      if (k === 'staffId') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{staffId ? staffId : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'civilId') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{civilId ? civilId : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'name') return (<td key={k} style={{ ...cellStyle, fontWeight: '500', color: '#1f2937' }}>{fullName ? fullName : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'gender') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{gender ? gender : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'dob') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{(row.hr && (row.hr.birthDate || row.hr.dob || row.hr.BirthDate)) ? fmtShortDate(row.hr.birthDate || row.hr.dob || row.hr.BirthDate) : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'role') return (<td key={k} style={cellStyle}>{role ? role : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'position') return (<td key={k} style={cellStyle}>{position ? position : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'dept') return (<td key={k} style={cellStyle}>{deptName ? deptName : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'number') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{unpaid && unpaid.number ? unpaid.number : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'reason') return (<td key={k} style={cellStyle}>{unpaid && (unpaid.Reason || unpaid.reason) ? (unpaid.Reason || unpaid.reason) : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'validity') {
                        const meta = computeUnpaidMeta(unpaid || {}, row.hr);
                        let validityDisplay = null;
                        if (meta && (meta.validityDays !== null && typeof meta.validityDays !== 'undefined')) validityDisplay = toKhmerDigits(meta.validityDays);
                        else if (meta && meta.validityLabel) validityDisplay = meta.validityLabel;
                        else if (unpaid && unpaid.validity) validityDisplay = unpaid.validity;
                        return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{validityDisplay || (<span className="text-gray-400">-</span>)}</td>);
                      }
                      if (k === 'status') {
                        const meta = computeUnpaidMeta(unpaid || {}, row.hr);
                        const rawStatus = (unpaid && (typeof unpaid.status !== 'undefined' && unpaid.status !== null)) ? String(unpaid.status).trim() : '';
                        const statusToShow = (meta && meta.statusLabel) ? meta.statusLabel : (rawStatus !== '' ? rawStatus : null);
                        return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{statusToShow ? renderStatusBadge(statusToShow) : (unpaid && unpaid.status ? renderStatusBadge(unpaid.status) : (<span className="text-gray-400">-</span>))}</td>);
                      }
                      if (k === 'duration') {
                        const meta = computeUnpaidMeta(unpaid || {}, row.hr);
                        return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{(meta && meta.durationLabel) ? meta.durationLabel : ((unpaid && unpaid.duration) ? unpaid.duration : (<span className="text-gray-400">-</span>))}</td>);
                      }
                      if (k === 'other') return (<td key={k} style={cellStyle}>{(unpaid && unpaid.other) ? unpaid.other : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'Start') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{(unpaid && (unpaid.Start || unpaid.start)) ? fmtShortDate(unpaid.Start || unpaid.start) : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'End') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{(unpaid && (unpaid.End || unpaid.end)) ? fmtShortDate(unpaid.End || unpaid.end) : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'image') return (<td key={k} style={{ ...cellStyle, textAlign: 'center' }} className="center">{unpaid && unpaid.image ? (<a href={unpaid.image} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline font-medium">View</a>) : (<span className="text-gray-400">-</span>)}</td>);
                      if (k === 'action') {
                        const unpaidObj = row.hr && row.hr.unpaid ? row.hr.unpaid : {};
                        let hasUnpaid = false;
                        try { hasUnpaid = Object.keys(unpaidObj || {}).some(uk => { const v = unpaidObj[uk]; return v !== null && typeof v !== 'undefined' && String(v).trim() !== ''; }); } catch { }
                        return (
                          <td key={k} style={{ ...cellStyle, textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }} className="center">
                            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => openEdit(row.hr)}
                                title="កែប្រែ"
                                aria-label="Edit unpaid"
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
                                  padding: 0,
                                  cursor: 'pointer'
                                }}
                                className="text-xs hover:bg-amber-600 transition-colors shadow-sm"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                                  <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                </svg>
                              </button>
                              {hasUnpaid && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUnpaid(row.hr)}
                                  title="លុបទិន្នន័យ"
                                  aria-label="Delete unpaid"
                                  style={{
                                    background: '#fa0404',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #fa0404',
                                    color: '#ffffff',
                                    padding: 0,
                                    cursor: 'pointer'
                                  }}
                                  className="text-xs hover:bg-red-700 transition-colors shadow-sm"
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
                      return (<td key={k} style={cellStyle}>-</td>);
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!(perms.canViewHR || perms.canViewEmployees)) {
    return (
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-2">របាយការណ៍ ទំនេរគ្មានបៀវត្ស</h3>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 bg-gray-50 min-h-screen">
      <div className="bg-white w-full border border-gray-200 rounded-xl shadow-sm p-4 md:p-6 mb-6 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-800 font-khmer">របាយការណ៍ ទំនេរគ្មានបៀវត្ស</h3>
            <p className="text-xs text-gray-500 font-khmer mt-0.5">គ្រប់គ្រង និងស្វែងរកបញ្ជីឈ្មោះមន្ត្រីទំនេរគ្មានបៀវត្ស</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
            <button 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all font-khmer shadow-sm ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`} 
              onClick={handleExportExcel} 
              disabled={loading}
            >
              Export Excel
            </button>
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all font-khmer shadow-sm ${importing || loading ? "bg-gray-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600"}`}
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
              <button 
                type="button" 
                onClick={() => setShowColsPanel(s => !s)} 
                title="ជ្រើសជួរឈរ" 
                className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-all font-khmer"
              >
                Columns
              </button>
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
            <button 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all font-khmer shadow-sm ${(!lunarText.trim() || loading) ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`} 
              onClick={handlePrint} 
              disabled={!lunarText.trim() || loading}
            >
              បោះពុម្ព
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 font-khmer">ស្វែងរក (ID ឬ ឈ្មោះ):</label>
            <div className="relative flex gap-2">
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-khmer"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { doImmediateSearch(q); } }}
                placeholder="S0015 ឬ ឈ្មោះ"
              />
              <button
                type="button"
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-all font-khmer animate-none"
                onClick={() => setQ('')}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-600 font-khmer">ចន្ទគតិ*:</label>
              {!lunarText.trim() && <span className="text-red-500 text-[10px] font-khmer">សូមបំពេញចន្ទគតិ</span>}
            </div>
            <input
              type="text"
              className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-khmer ${!lunarText.trim() ? "border-red-300 bg-red-50/20" : "border-gray-300"}`}
              placeholder="ឧ. ថ្ងៃសុក្រ ១៣កើត ខែភទ្របទ ឆ្នាំម្សាញ់..."
              value={lunarText}
              onChange={(e) => setLunarText(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 font-khmer">ថ្ងៃខែឆ្នាំ:</label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={footerDate}
              onChange={(e) => setFooterDate(e.target.value)}
            />
          </div>
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
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>បញ្ជីឈ្មោះមន្រ្តី ទំនេរគ្មានបៀវត្សពី មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត ឆ្នាំ {toKhmerDigits(retireYear)}</div>
        </div>
        {/* Single flat table for unpaid leave listing */}
        <div className="no-print">
          {(() => {
            const rows = derived.rows || [];
            if (rows.length === 0) return <div className="center text-gray-600">មិនមានទិន្នន័យ</div>;
            // Compute unpaid meta once per row to avoid repeated computation and make grouping explicit
            const rowsWithMeta = rows.map(r => ({ ...r, unpaidMeta: computeUnpaidMeta((r.hr && r.hr.unpaid) ? r.hr.unpaid : {}) }));
            // If none of the rows contain any unpaid data, treat all rows as 'no status' so the table shows data
            const anyUnpaidData = rowsWithMeta.some(rr => {
              const u = rr.hr && rr.hr.unpaid ? rr.hr.unpaid : {};
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
            if (!anyUnpaidData) {
              g0 = rowsWithMeta.map(r => r);
            } else {
              g0 = rowsWithMeta.filter(r => !r.unpaidMeta || !r.unpaidMeta.statusLabel).map(r => r);
              g1 = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('ត្រៀម')).map(r => r);
              g2 = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('កំពុង')).map(r => r);
              // Separate 'returned to service' and 'ended over 1 month' into distinct groups
              g3 = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('ចូល')).map(r => r);
              g4 = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('បញ្ចប់')).map(r => r);
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
                    { title: 'បញ្ចប់ទំនេរគ្មានបៀវត្សលើស១ខែ', rows: g4 }
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
            const rowsWithMeta = rowsAll.map(r => ({ ...r, unpaidMeta: computeUnpaidMeta((r.hr && r.hr.unpaid) ? r.hr.unpaid : {}) }));
            const rowsOngoing = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('កំពុង'));
            const rowsReturned = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('ចូល'));
            const rowsEnded = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('បញ្ចប់'));

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
                        <th>លេខកាត</th>
                        <th>លេខមន្ត្រី</th>
                        <th>គោត្តនាម និងនាម</th>
                        <th>ភេទ</th>
                        <th>តួនាទី</th>
                        <th>ផ្នែក</th>
                        <th>ចំនួនទំនេរ</th>
                        <th>រយៈពេល</th>
                        <th>ថ្ងៃចាប់ផ្ដើម</th>
                        <th>ថ្ងៃបញ្ចប់</th>
                        <th>ផ្សេងៗ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const unpaid = (row.hr && row.hr.unpaid) ? row.hr.unpaid : {};
                        const meta = computeUnpaidMeta(unpaid || {});
                        return (
                          <tr key={row.hr._id || idx}>
                            <td className="center">{toKhmerDigits(idx + 1)}</td>
                            <td className="center">{row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || ''}</td>
                            <td className="center">{row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || ''}</td>
                            <td>{row.hr.khmerName || row.hr.name || ''}</td>
                            <td className="center">{row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : ''}</td>
                            <td>{row.hr.position || row.hr.role || row.hr.title || ''}</td>
                            <td>{row.hr.Department_Kh || row.hr.department || ''}</td>
                            <td className="center">{unpaid && unpaid.number ? unpaid.number : ''}</td>
                            <td className="center">{(meta && meta.durationLabel) ? meta.durationLabel : (unpaid && unpaid.duration ? unpaid.duration : '')}</td>
                            <td className="center">{(unpaid && (unpaid.Start || unpaid.start)) ? fmtShortDate(unpaid.Start || unpaid.start) : ''}</td>
                            <td className="center">{(unpaid && (unpaid.End || unpaid.end)) ? fmtShortDate(unpaid.End || unpaid.end) : ''}</td>
                            <td>{unpaid && unpaid.other ? unpaid.other : ''}</td>
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
        {/* Edit modal for unpaid fields */}
        {showEdit && (
          <div className="no-print fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto font-khmer flex flex-col">
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                <h4 className="text-base font-bold text-gray-800">កែប្រែ ទំនេរគ្មានបៀវត្ស</h4>
                <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>

              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">ចំនួនទំនេរ</label>
                  <input type="number" value={editingUnpaid.number || ''} onChange={(e) => handleEditChange('number', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">ស្ថានភាព</label>
                  <input type="text" value={editingUnpaid.status || ''} onChange={(e) => handleEditChange('status', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">មូលហេតុ</label>
                  <input type="text" value={editingUnpaid.Reason || editingUnpaid.reason || ''} onChange={(e) => handleEditChange('Reason', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">សុពលភាព (ថ្ងៃ)</label>
                  <input type="number" value={editingUnpaid.validity || ''} onChange={(e) => handleEditChange('validity', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">រយៈពេល</label>
                  <input type="text" value={editingUnpaid.duration || ''} onChange={(e) => handleEditChange('duration', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">ផ្សេងៗ</label>
                  <input type="text" value={editingUnpaid.other || ''} onChange={(e) => handleEditChange('other', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">ថ្ងៃចាប់ផ្ដើម</label>
                  <input
                    type="date"
                    value={toDateInputValue(editingUnpaid.Start || editingUnpaid.start || '')}
                    onChange={(e) => handleEditChange('Start', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">ថ្ងៃបញ្ចប់</label>
                  <input
                    type="date"
                    value={toDateInputValue(editingUnpaid.End || editingUnpaid.end || '')}
                    onChange={(e) => handleEditChange('End', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">ឯកសារយោង (image/pdf)</label>
                  <div className="flex flex-wrap gap-3 items-center">
                    <input ref={fileInputRef} type="file" onChange={(e) => handleFileSelect(e.target.files && e.target.files[0])} className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all" />
                    {selectedPreviewUrl && <a href={selectedPreviewUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs font-medium">Preview</a>}
                    {!selectedPreviewUrl && editingUnpaid.image && <a href={editingUnpaid.image} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs font-medium">Current file</a>}
                    {editingUnpaid.image && (
                      <button
                        type="button"
                        onClick={handleDeleteReference}
                        title="លុបឯកសារ"
                        aria-label="Delete file"
                        className="w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-sm transition-all"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 3v1H15V3H9zM7 7v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7H7zm3 3h2v8H10V10zm4 0h2v8h-2V10z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl">
                <button type="button" onClick={closeEdit} className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-all">បោះបង់</button>
                <button type="button" onClick={handleSaveEdit} className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-all shadow-sm" disabled={saving || uploadingFile}>{saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}</button>
              </div>
            </div>
          </div>
        )}
        {/* footer/signature area */}
        <div className="flex flex-col md:flex-row print:flex-row print:justify-between justify-between gap-6 md:gap-4 mt-8 text-xs text-gray-800">
          <div className="w-full md:w-[30%] print:w-[30%] flex flex-col items-center text-center">
            <div className="no-print self-start mb-4 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded px-2.5 py-1">
              {(() => {
                const totalN = (Number.isFinite(derived.total) ? derived.total : (derived.rows ? derived.rows.length : 0));
                const maleN = (Number.isFinite(derived.male) ? derived.male : 0);
                const femaleN = (Number.isFinite(derived.female) ? derived.female : 0);
                return `សរុប: ${toKhmerDigits(totalN)} នាក់ ( ប្រុស: ${toKhmerDigits(maleN)} នាក់ — ស្រី: ${toKhmerDigits(femaleN)} នាក់ )`;
              })()}
            </div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>បានឃើញ</div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', fontWeight: 'bold' }}>នាយកមន្ទីរពេទ្យ</div>
            <div style={{ height: '64px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
          <div className="w-full md:w-[30%] print:w-[30%] flex flex-col items-center text-center">
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>បានពិនិត្យត្រឹមត្រូវ</div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', fontWeight: 'bold' }}>ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</div>
            <div style={{ height: '64px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
          <div className="w-full md:w-[30%] print:w-[30%] flex flex-col items-center text-center">
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>
              {lunarText && lunarText.trim()
                ? lunarText
                : `ថ្ងៃ${khWeekday(new Date())}  ព.ស. ${toKhmerDigits(buddhistEraYear(new Date()))}`}
            </div>
            <div style={{ marginTop: '2px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>
              រាជធានីភ្នំពេញ {fmtKhmerLongDate(footerDate)}
            </div>
            <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', fontWeight: 'bold' }}> អ្នកធ្វើតារាង</div>
            <div style={{ height: '64px' }}></div>
            <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
          </div>
        </div>
      </div>
    </div>
  );
}
