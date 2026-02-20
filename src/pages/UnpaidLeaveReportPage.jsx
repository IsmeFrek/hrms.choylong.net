import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

function toKhmerDigits(n) {
  const map = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function fmtKhmerLongDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const khMonths = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
  const dd = toKhmerDigits(String(dt.getDate()).padStart(1,'0'));
  const mmName = khMonths[dt.getMonth()];
  const yyyy = toKhmerDigits(dt.getFullYear());
  return `ថ្ងៃទី ${dd} ខែ ${mmName} ឆ្នាំ ${yyyy}`;
}
function khWeekday(d) {
  const names = ['អាទិត្យ','ចន្ទ','អង្គារ','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍'];
  const dt = new Date(d);
  return names[dt.getDay()];
}
function buddhistEraYear(d) {
  const dt = new Date(d);
  return dt.getFullYear() + 543;
}

function fmtShortDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2,'0');
      const mm = String(dt.getMonth()+1).padStart(2,'0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    // If it's already in dd/mm/yyyy form, return as-is
    return String(d);
  } catch { return String(d); }
}

function parseDateSafe(v) {
  if (!v) return null;
  try {
    const dt = new Date(v);
    if (isNaN(dt.getTime())) return null;
    // normalize to midnight
    dt.setHours(0,0,0,0);
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

function computeUnpaidMeta(unpaid) {
  const start = parseDateSafe(unpaid && (unpaid.Start || unpaid.start));
  const end = parseDateSafe(unpaid && (unpaid.End || unpaid.end));
  const today = new Date(); today.setHours(0,0,0,0);

  let statusLabel = '';
  let validityLabel = '';
  let durationLabel = '';

  // Only show "prepare" when there is a Start date in the future.
  if (start && start > today) {
    statusLabel = 'ត្រៀមទំនេរគ្មានបៀវត្ស';
  } else if (start && (!end || (end && end >= today))) {
    // if start is in the past and end is not present or end >= today -> ongoing
    statusLabel = 'កំពុងបន្តទំនេរគ្មានបៀវត្ស';
  } else if (end && end < today) {
    const daysSinceEnd = daysBetween(end, today);
    if (daysSinceEnd > 30) statusLabel = 'បញ្ចប់ទំនេរគ្មានបៀវត្សលើស១ខែ';
    else statusLabel = 'ចូលបម្រើការងារវិញ';
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
  const [error, setError] = useState('');
  const [retireYear] = useState(new Date().getFullYear());
  const printRef = useRef();
  // Column order state for draggable headers
  const defaultCols = [
    'index','staffId','civilId','name','gender','role','position','dept','number','reason','validity','status','duration','other','Start','End','image','action'
  ];
  const [colOrder, setColOrder] = useState(defaultCols);
  const draggingKeyRef = useRef(null);
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0,10));
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
        const sid = (hr.civilServantId || hr.staffId || hr.no || hr.cardNo || hr.cardNumber || '').toString().toLowerCase();
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
    if (s.includes('ចូល') || s.includes('returned') || s.includes('resume')) return { background: '#047857', color: '#fff' }; // darker green
    // default blue
    return { background: '#2563eb', color: '#fff' };
  };
  // Render status badge (reuse Study styling)
  const renderStatusBadge = (s) => {
    if (!s) return null;
    const style = { display:'inline-block', padding:'6px 10px', borderRadius:14, color:'#fff', fontSize:13, fontWeight:700, minWidth:40, textAlign:'center' };
    const mapping = {
      'ត្រៀមទំនេរ': { background: '#f39c12' },
      'ត្រៀមទំនេរគ្មានបៀវត្ស': { background: '#f39c12' },
      'កំពុងទំនេរ': { background: '#16a34a' },
      'កំពុងបន្តទំនេរគ្មានបៀវត្ស': { background: '#16a34a' },
      'ចូលបម្រើការងារវិញ': { background: '#230ab4ff' },
      'បញ្ចប់ទំនេរគ្មានបៀវត្សលើស១ខែ': { background: '#b91c1c' }
    };
    const sStyle = mapping[s] || { background: '#333' };
    return <span style={{ ...style, ...sStyle }}>{s}</span>;
  };
  

  // Debug: log fetched list and computed rows for troubleshooting
  useEffect(() => {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[UnpaidLeaveReport] list count:', Array.isArray(list) ? list.length : 0, 'derived rows:', derived.rows ? derived.rows.length : 0);
      console.debug('[UnpaidLeaveReport] sample rows:', (derived.rows || []).slice(0,5).map(r => ({ id: r.hr._id || r.hr.no || r.hr.staffId, name: r.hr.khmerName || r.hr.name })));
    }
  }, [list, derived]);

  const openEdit = (hr) => {
    setEditingHr({ ...hr, unpaid: { ...(hr.unpaid || {}) } });
    setEditingUnpaid(hr && hr.unpaid ? { ...hr.unpaid } : {});
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
          next.End = end.toISOString().slice(0,10);
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
      const url = data && (data.url || data.path || data.fileUrl) ? (data.url || data.path || data.fileUrl) : (data && data[0] ? data[0].url : null);
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
    setEditingUnpaid(prev => ({ ...(prev||{}), image: '' }));
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
      'លេខមន្ត្រីរាជការ',
      'គោត្តនាម និងនាម',
      'ភេទ',
      'មុខងារ',
      'តួនាទី',
      'ផ្នែក',
      'ចំនួនទំនេរគ្មានបៀវត្ស',
      'មូលហេតុ',
      'សុពលភាពទំនេរគ្មានបៀវត្ស',
      'ស្ថានភាពទំនេរគ្មានបៀវត្ស',
      'រយៈពេលទំនេរគ្មានបៀវត្ស',
      'ផ្សេងៗ',
      'ថ្ងៃចាប់ផ្ដើម',
      'ថ្ងៃបញ្ចប់',
      'ឯកសារយោង'
    ];
    const data = rows.map((row, idx) => {
      // Export basic identifying fields + unpaid.* fields
      const unpaid = row.hr && row.hr.unpaid ? row.hr.unpaid : {};
      return ([
        idx+1,
        row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || '',
        row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || '',
        row.hr.khmerName || row.hr.name || '',
        row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : '',
        row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || '',
        row.hr.position || row.hr.role || row.hr.title || '',
        row.hr.Department_Kh || row.hr.department || '',
  unpaid.number || '',
  unpaid.Reason || unpaid.reason || '',
  // prefer numeric validityDays if available, else raw validity
  ((computeUnpaidMeta(unpaid).validityDays !== null && typeof computeUnpaidMeta(unpaid).validityDays !== 'undefined') ? computeUnpaidMeta(unpaid).validityDays : (unpaid.validity || '')),
  (unpaid.status || ''),
  unpaid.duration || '',
  // computed fields (labels)
  (computeUnpaidMeta(unpaid).validityLabel || ''),
  (computeUnpaidMeta(unpaid).statusLabel || ''),
  (computeUnpaidMeta(unpaid).durationLabel || ''),
        unpaid.other || '',
        unpaid.Start || unpaid.start || '',
        unpaid.End || unpaid.end || '',
        unpaid.image || ''
      ]);
    });

    const summary = [[
      `សរុប: ${derived.total} នាក់ ( ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់ )`
    ]];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, [], ...summary]);
    // Adjust column widths
    // adjusted column widths for the reduced columns
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 6 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
      { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 24 }
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = `Nivatt_${retireYear}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `UnpaidLeave_${retireYear}.xlsx`);
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
          const m = computeUnpaidMeta(u || {});
          return (m && (m.validityDays !== null && typeof m.validityDays !== 'undefined')) || (u && u.validity !== null && typeof u.validity !== 'undefined' && u.validity !== '');
        }
        if (field === 'status') {
          const m = computeUnpaidMeta(u || {});
          const raw = (u && (u.status || u.status === 0)) ? String(u.status).trim() : '';
          return (m && m.statusLabel) || (raw !== '');
        }
        if (field === 'duration') {
          const m = computeUnpaidMeta(u || {});
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
      { key: 'action', label: 'សកម្មភាព', width: '70px' }
    ];
    // Filter columnDefs to the order in colOrder (keep only defined keys)
    const orderedDefs = (colOrder || defaultCols).map(k => columnDefs.find(c => c.key === k)).filter(Boolean);
    const numCols = orderedDefs.length;
    const equalPct = (100 / numCols).toFixed(4) + '%';
    // Use explicit width from columnDefs when provided (e.g., '40px' or '90px'),
    // otherwise fall back to equal percentage width so layout remains balanced.
    const colElems = orderedDefs.map((c, i) => {
      const w = c && c.width ? c.width : equalPct;
      return <col key={c.key || i} style={{ width: w }} />;
    });
    return (
      <div style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
          {(() => {
            const totalN = rows.length || 0;
            const maleN = rows.filter(r => r.hr && r.hr.gender === 'Male').length;
            const femaleN = rows.filter(r => r.hr && r.hr.gender === 'Female').length;
            return (
              <h4 style={{fontSize:12, fontWeight:700, margin:0}}>{title} — {toKhmerDigits(totalN)} នាក់ ( ប្រុស: {toKhmerDigits(maleN)} — ស្រី: {toKhmerDigits(femaleN)} )</h4>
            );
          })()}
        </div>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:12, tableLayout:'fixed'}}>
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
                        next.splice(fi,1);
                        next.splice(ti,0,from);
                        return next;
                      });
                      draggingKeyRef.current = null;
                    }}
                    style={{border:'1px solid #d1cfcf', padding:'6px', cursor:'grab', userSelect:'none', textAlign: 'center'}}
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
              const unpaid = row.hr && row.hr.unpaid ? row.hr.unpaid : {};
              return (
                <tr key={row.hr._id || idx}>
                  {orderedDefs.map((col) => {
                    const k = col.key;
                    if (k === 'index') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6, wordBreak:'break-word', overflowWrap:'break-word'}} className="center">{toKhmerDigits(idx+1)}</td>);
                    if (k === 'staffId') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center">{staffId ? staffId : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'civilId') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6, wordBreak:'break-word', overflowWrap:'break-word'}} className="center">{civilId ? civilId : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'name') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6, wordBreak:'break-word', overflowWrap:'break-word'}}>{fullName ? fullName : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'gender') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6, wordBreak:'break-word', overflowWrap:'break-word'}} className="center">{gender ? gender : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'role') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6, wordBreak:'break-word', overflowWrap:'break-word'}}>{role ? role : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'position') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6, wordBreak:'break-word', overflowWrap:'break-word'}}>{position ? position : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'dept') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6, wordBreak:'break-word', overflowWrap:'break-word'}}>{deptName ? deptName : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'number') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center">{unpaid && unpaid.number ? unpaid.number : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'reason') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}}>{unpaid && (unpaid.Reason || unpaid.reason) ? (unpaid.Reason || unpaid.reason) : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'validity') {
                      const meta = computeUnpaidMeta(unpaid || {});
                      let validityDisplay = null;
                      if (meta && (meta.validityDays !== null && typeof meta.validityDays !== 'undefined')) validityDisplay = toKhmerDigits(meta.validityDays);
                      else if (meta && meta.validityLabel) validityDisplay = meta.validityLabel;
                      else if (unpaid && unpaid.validity) validityDisplay = unpaid.validity;
                      return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center">{validityDisplay || (<span className="text-gray-400">-</span>)}</td>);
                    }
                    if (k === 'status') {
                      const meta = computeUnpaidMeta(unpaid || {});
                      const rawStatus = (unpaid && (typeof unpaid.status !== 'undefined' && unpaid.status !== null)) ? String(unpaid.status).trim() : '';
                      const statusToShow = (meta && meta.statusLabel) ? meta.statusLabel : (rawStatus !== '' ? rawStatus : null);
                      return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center">{statusToShow ? renderStatusBadge(statusToShow) : (unpaid && unpaid.status ? renderStatusBadge(unpaid.status) : (<span className="text-gray-400">-</span>))}</td>);
                    }
                    if (k === 'duration') {
                      const meta = computeUnpaidMeta(unpaid || {});
                      return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center">{(meta && meta.durationLabel) ? meta.durationLabel : ((unpaid && unpaid.duration) ? unpaid.duration : (<span className="text-gray-400">-</span>))}</td>);
                    }
                    if (k === 'other') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}}>{(unpaid && unpaid.other) ? unpaid.other : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'Start') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center">{(unpaid && (unpaid.Start || unpaid.start)) ? fmtShortDate(unpaid.Start || unpaid.start) : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'End') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center">{(unpaid && (unpaid.End || unpaid.end)) ? fmtShortDate(unpaid.End || unpaid.end) : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'image') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}}>{unpaid && unpaid.image ? (<a href={unpaid.image} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>) : (<span className="text-gray-400">-</span>)}</td>);
                    if (k === 'action') return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}} className="center"><div style={{display:'inline-flex', gap:8, alignItems:'center', justifyContent:'center'}}><button type="button" onClick={() => openEdit(row.hr)} style={{background:'#facc15', borderRadius:4, padding:'4px 8px', border:'1px solid #d4af2b'}} className="text-xs">Edit</button></div></td>);
                    return (<td key={k} style={{border:'1px solid #e6dbdbff', padding:6}}>-</td>);
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
        <h3 className="text-xl font-semibold mb-2">របាយការណ៍ ទំនេរគ្មានបៀវត្ស</h3>
  <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
          <div>
          <h3 className="text-xl font-semibold text-gray-900">របាយការណ៍ ទំនេរគ្មានបៀវត្ស</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-sm">ស្វែងរក (ID ឬ ឈ្មោះ):</label>
            <div style={{display:'inline-flex', alignItems:'center', gap:6}}>
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
            onChange={(e)=> setLunarText(e.target.value)}
          />
          <label className="text-sm">ថ្ងៃខែឆ្នាំ:</label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={footerDate}
            onChange={(e)=> setFooterDate(e.target.value)}
          />
          
          {/* inline warnings */}
          {(!lunarText.trim()) && <span className="text-red-600 text-xs">សូមបំពេញចន្ទគតិ</span>}
          <button className={`border px-2 py-1 rounded ${loading ? 'bg-gray-100 text-gray-300' : 'bg-green-600 text-white border-green-600'}`} onClick={handleExportExcel} disabled={loading}>Export Excel</button>
          <button className={`border px-2 py-1 rounded ${(!lunarText.trim() || loading) ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white border-blue-600'}`} onClick={handlePrint} disabled={!lunarText.trim() || loading}>បោះពុម្ព</button>
        </div>
      </div>

      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

      <div ref={printRef} className="bg-white p-4 border rounded print-scope">
        <style dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />
        <div style={{textAlign:'center', marginBottom: '8px'}}>
            <div style={{fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'16px'}}>ព្រះរាជាណាចក្រកម្ពុជា</div>
          <div style={{fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'14px'}}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
            <div style={{position:'relative', textAlign:'left', padding:'6px 0'}}>
              {/* background image behind the text */}
              <img src={headerBg} alt="" aria-hidden="true"
                   style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', width:'150px', height:'auto', opacity:88, pointerEvents:'none'}} />
              <div style={{fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12.5px', position:'relative', zIndex:1}}>ក្រសួងសុខាភិបាល</div>
            </div>
            <div style={{fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'left'}}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
          <div style={{fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'13px',marginTop:'4px', fontWeight:600}}>បញ្ជីឈ្មោះមន្រ្តី ទំនេរគ្មានបៀវត្សពី មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត ឆ្នាំ {toKhmerDigits(retireYear)}</div>
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
                  return groups.map((g, idx) => renderGroupTable(g.title, g.rows, idx === firstNonEmpty));
                })()}
              </div>
            );
          })()}
        </div>
        {/* Print-only simplified tables for printing (mirror Study page behavior) */}
        <div className="print-only" style={{display:'none'}}>
          {(() => {
            const rowsAll = derived.rows || [];
            if (!rowsAll || rowsAll.length === 0) return <div className="center">មិនមានទិន្នន័យ</div>;
            const rowsWithMeta = rowsAll.map(r => ({ ...r, unpaidMeta: computeUnpaidMeta((r.hr && r.hr.unpaid) ? r.hr.unpaid : {}) }));
            const rowsOngoing = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('កំពុង'));
            const rowsReturned = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('ចូល'));
            const rowsEnded = rowsWithMeta.filter(r => r.unpaidMeta && r.unpaidMeta.statusLabel && r.unpaidMeta.statusLabel.includes('បញ្ចប់'));

            const renderSimpleTable = (title, rows) => {
              return (
                <div style={{marginBottom:12}} key={title}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                    {(() => {
                      const totalN = rows.length || 0;
                      const maleN = rows.filter(r => r.hr && r.hr.gender === 'Male').length;
                      const femaleN = rows.filter(r => r.hr && r.hr.gender === 'Female').length;
                      return (
                        <div style={{fontSize:12,fontWeight:700}}>{title} — {toKhmerDigits(totalN)} នាក់ ( ប្រុស: {toKhmerDigits(maleN)} — ស្រី: {toKhmerDigits(femaleN)} )</div>
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
                            <td className="center">{toKhmerDigits(idx+1)}</td>
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
          <div className="no-print" style={{position:'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999}}>
            <div style={{width:720, background:'#fff', borderRadius:6, padding:16, maxHeight:'90vh', overflow:'auto'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                <h4 style={{margin:0}}>កែប្រែ ទំនេរគ្មានបៀវត្ស</h4>
                <button onClick={closeEdit} className="text-gray-600">បិទ</button>
              </div>

              {/* Two-column layout like the screenshot — always show the common unpaid fields */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                <div>
                  <label className="text-sm">ចំនួនទំនេរ</label>
                  <input type="number" value={editingUnpaid.number || ''} onChange={(e) => handleEditChange('number', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">ស្ថានភាព</label>
                  <input type="text" value={editingUnpaid.status || ''} onChange={(e) => handleEditChange('status', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">មូលហេតុ</label>
                  <input type="text" value={editingUnpaid.Reason || editingUnpaid.reason || ''} onChange={(e) => handleEditChange('Reason', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">សុពលភាព (ថ្ងៃ)</label>
                  <input type="number" value={editingUnpaid.validity || ''} onChange={(e) => handleEditChange('validity', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">រយៈពេល</label>
                  <input type="text" value={editingUnpaid.duration || ''} onChange={(e) => handleEditChange('duration', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">ផ្សេងៗ</label>
                  <input type="text" value={editingUnpaid.other || ''} onChange={(e) => handleEditChange('other', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">ថ្ងៃចាប់ផ្ដើម</label>
                  <input type="date" value={editingUnpaid.Start || editingUnpaid.start || ''} onChange={(e) => handleEditChange('Start', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div>
                  <label className="text-sm">ថ្ងៃបញ្ចប់</label>
                  <input type="date" value={editingUnpaid.End || editingUnpaid.end || ''} onChange={(e) => handleEditChange('End', e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>

                <div style={{gridColumn:'1 / -1'}}>
                  <label className="text-sm">ឯកសារយោង (image/pdf)</label>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input ref={fileInputRef} type="file" onChange={(e) => handleFileSelect(e.target.files && e.target.files[0])} />
                    {selectedPreviewUrl && <a href={selectedPreviewUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Preview</a>}
                    {!selectedPreviewUrl && editingUnpaid.image && <a href={editingUnpaid.image} target="_blank" rel="noreferrer" className="text-blue-600 underline">Current file</a>}
                    {editingUnpaid.image && <button type="button" onClick={handleDeleteReference} className="border rounded px-2 py-0.5 text-sm bg-red-50 text-red-700">Delete</button>}
                  </div>
                </div>
              </div>

              <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
                <button type="button" onClick={closeEdit} className="border rounded px-3 py-1">បោះបង់</button>
                <button type="button" onClick={handleSaveEdit} className="border rounded px-3 py-1 bg-green-600 text-white" disabled={saving || uploadingFile}>{saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}</button>
              </div>
            </div>
          </div>
        )}
        {/* footer/signature area */}
        <div style={{display:'flex', justifyContent:'space-between', marginTop:'16px', fontSize:'12px'}}>
          <div style={{width:'33%'}}>
            <div className="no-print">
              {(() => {
                const totalN = (Number.isFinite(derived.total) ? derived.total : (derived.rows ? derived.rows.length : 0));
                const maleN = (Number.isFinite(derived.male) ? derived.male : 0);
                const femaleN = (Number.isFinite(derived.female) ? derived.female : 0);
                return `សរុប: ${toKhmerDigits(totalN)} នាក់ ( ប្រុស: ${toKhmerDigits(maleN)} នាក់ — ស្រី: ${toKhmerDigits(femaleN)} នាក់ )`;
              })()}
            </div>
            <div style={{marginTop:'1px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>បានឃើញ</div>
            <div style={{marginTop:'1px', fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>នាយកមន្ទីរពេទ្យ</div>
            <div style={{height:'64px'}}></div>
            <div style={{textDecoration:'underline', visibility:'hidden'}}>............................</div>
          </div>
          <div style={{width:'33%', textAlign:'center'}}>
            <div style={{marginTop:'16px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>បានពិនិត្យត្រឹមត្រូវ</div>
            <div style={{marginTop:'1px', fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>ប្រធានការិយាល័យរដ្ឋបាលនិងបុគ្គលិក</div>
            <div style={{height:'82px'}}></div>
            <div style={{textDecoration:'underline', visibility:'hidden'}}>............................</div>
          </div>
          <div style={{width:'33%', textAlign:'right'}}>
            <div style={{marginTop:'12px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center'}}>
              {lunarText && lunarText.trim()
                ? lunarText
                : `ថ្ងៃ${khWeekday(new Date())}  ព.ស. ${toKhmerDigits(buddhistEraYear(new Date()))}`}
            </div>
            <div style={{marginTop:'2px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center'}}>
              រាជធានីភ្នំពេញ {fmtKhmerLongDate(footerDate)}
            </div>
            <div style={{marginTop:'1px', fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}> អ្នកធ្វើតារាង</div>
            <div style={{height:'82px'}}></div>
            <div style={{textDecoration:'underline', visibility:'hidden'}}>............................</div>
          </div>
        </div>
      </div>
    </div>
  );
}
