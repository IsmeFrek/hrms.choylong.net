import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { listScans, fetchScan, scanNow, scanNowWithFormat, listDevices } from '../api/scanner';
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

function defaultMonthlyReportText(d = new Date()) {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return 'ប្រចាំខែ';
    const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const mmName = khMonths[dt.getMonth()] || '';
    return `ប្រចាំខែ${mmName}`;
  } catch {
    return 'ប្រចាំខែ';
  }
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

function fmtDateInput(d) {
  if (!d) return '';
  const dt = parseDateSafe(d);
  if (!dt || isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function fmtShortDate(d) {
  if (!d) return '';
  try {
    const dt = parseDateSafe(d);
    if (dt && !isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return String(d);
  } catch { return String(d); }
}

function parseDateSafe(v) {
  if (!v) return null;
  try {
    let dt = new Date(v);
    if (isNaN(dt.getTime())) {
      // Try parsing DD/MM/YYYY
      const s = String(v).trim();
      const parts = s.split(/[\/\-]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) { // DD/MM/YYYY
          dt = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        } else if (parts[0].length === 4) { // YYYY/MM/DD
          dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
      }
    }
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

function computeDelistedMeta(delisted) {
  const dateDelisted = parseDateSafe(delisted && (delisted.dateDelisted || delisted.date));
  const reason = (delisted && (delisted.reason || delisted.Reason)) || '';
  const delistStatus = (delisted && (delisted.delistStatus || delisted.delistingStatus)) || '';

  let statusLabel = '';
  if (dateDelisted) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateDelisted > today) {
      statusLabel = 'ត្រៀមលុបឈ្មោះ';
    } else {
      statusLabel = 'លុបឈ្មោះរួច';
    }
  }

  return { statusLabel, reason, delistStatus };
}

export default function OfficialDelistedReportPage() {
  const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const perms = usePermission();
  const [list, setList] = useState([]);

  const getProbationStatus = (h) => {
    if (!h) return '';
    const jd = parseDateSafe(h.joinDate);
    const pEnd = parseDateSafe(h.probationEndDate || h.probationEnd) || (jd ? new Date(jd.getFullYear(), jd.getMonth() + 3, jd.getDate()) : null);
    if (!pEnd) return '';
    const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0);
    const diffMs = pEnd.getTime() - todayLocal.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'បញ្ចប់សាកល្បង';
    if (days < 10) return 'ជិតចប់សាកល្បង';
    return 'កំពុងសាកល្បង';
  };
  const [q, setQ] = useState('');
  const [dept] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterDateField, setFilterDateField] = useState('removed');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportYear] = useState(new Date().getFullYear());
  const printRef = useRef();

  const defaultCols = [
    'index', 'civilId', 'name', 'gender', 'role', 'position', 'dept', 'reason', 'delistStatus', 'dateDelisted', 'dateRemoved', 'note', 'image', 'action'
  ];
  const [colOrder, setColOrder] = useState(() => {
    if (!(perms.isAdmin || perms.canEditOfficialDelistedReport)) {
      return defaultCols.filter(c => c !== 'action');
    }
    return defaultCols;
  });
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editingHr, setEditingHr] = useState(null);
  const [editingDelisted, setEditingDelisted] = useState({});
  const [selectedMonthKey, setSelectedMonthKey] = useState('all');
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [noteAutoMode, setNoteAutoMode] = useState(false);
  const fileInputRef = useRef();
  const [originalDelisted, setOriginalDelisted] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerFiles, setScannerFiles] = useState([]);
  const [loadingScannerFiles, setLoadingScannerFiles] = useState(false);
  const [showScannerDevicesModal, setShowScannerDevicesModal] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [scannerNameInput, setScannerNameInput] = useState('');
  const [scannerName, setScannerName] = useState(() => { try { return localStorage.getItem('scannerName') || ''; } catch (e) { return ''; } });
  const [editingScan, setEditingScan] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [multiScanActive, setMultiScanActive] = useState(false);
  const [multiScanFiles, setMultiScanFiles] = useState([]);
  const [modalMode, setModalMode] = useState('delist'); // 'delist' or 'probation'

  // Sync colOrder if permissions change (e.g. login/logout or admin override)
  useEffect(() => {
    if (!(perms.isAdmin || perms.canEditOfficialDelistedReport)) {
      setColOrder(prev => (prev || []).filter(c => c !== 'action'));
    } else {
      setColOrder(prev => {
        if (prev && !prev.includes('action')) return [...prev, 'action'];
        return prev || defaultCols;
      });
    }
  }, [perms.isAdmin, perms.canEditOfficialDelistedReport]);

  // Load initial data
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewHR || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/hr', { params: {} });
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

  // Debounced search
  const searchTidRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!(perms.canViewHR || perms.canViewEmployees)) return;
    if (searchTidRef.current) { clearTimeout(searchTidRef.current); searchTidRef.current = null; }

    if (!q || q.toString().trim() === '') {
      // No-op: keep loaded list
    } else {
      searchTidRef.current = setTimeout(async () => {
        try {
          setLoading(true);
          setError('');
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

  const doImmediateSearch = async (query) => {
    if (!(perms.canViewHR || perms.canViewEmployees)) return;
    if (searchTidRef.current) { clearTimeout(searchTidRef.current); searchTidRef.current = null; }
    const qTrim = (query || '').toString().trim();
    if (!qTrim) {
      setList([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
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

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const data = await listDevices();
      if (Array.isArray(data)) setDevices(data);
      else if (data && Array.isArray(data.devices)) setDevices(data.devices);
      else setDevices([]);
    } catch (err) {
      console.debug('listDevices failed', err?.message || err);
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  const confirmAndTriggerScan = async (format = 'jpg') => {
    // If doing a multi-page session, keep the devices modal open so user can scan more pages
    if (!multiScanActive) setShowScannerDevicesModal(false);
    const chosen = (scannerNameInput || '').toString().trim();
    if (!chosen) { window.alert('សូមបញ្ចូលឈ្មោះម៉ាស៊ីនស្កេន'); return; }
    try {
      try { localStorage.setItem('scannerName', chosen); } catch (e) { }
      setScannerName(chosen);
      setLoadingScannerFiles(true);
      // Try to start a scan and attach the newest resulting file automatically
      const res = await scanNow({ scannerName: chosen, format });
      // If backend returns items, attach or add the newest one
      if (res && Array.isArray(res.items) && res.items.length > 0) {
        const newest = res.items[0];
        try {
          if (multiScanActive) {
            // Add newest to session (and refresh scanner list)
            setMultiScanFiles(s => (s || []).concat([{ name: newest.name, url: newest.url }]));
            // refresh list shown in scanner modal
            setScannerFiles((s) => [newest].concat(s || []));
            setShowScannerModal(true);
          } else {
            await attachScan(newest.name);
          }
        } catch (e) { console.error('Attach after scan failed', e); setShowScannerModal(true); await openScannerPicker(); }
      } else {
        // Fallback: query list and attach newest
        try {
          const items = await listScans();
          if (Array.isArray(items) && items.length > 0) {
            if (multiScanActive) {
              const first = items[0];
              setMultiScanFiles(s => (s || []).concat([{ name: first.name, url: first.url }]));
              setScannerFiles(items);
              setShowScannerModal(true);
            } else {
              await attachScan(items[0].name || items[0].url || items[0]);
            }
          } else {
            // nothing to attach — open scanner file list for manual attach
            setTimeout(() => openScannerPicker(), 800);
          }
        } catch (e) {
          console.error('Post-scan list failed', e);
          setTimeout(() => openScannerPicker(), 800);
        }
      }
    } catch (err) {
      try { await scanNow(); setTimeout(() => openScannerPicker(), 1200); } catch (e) { console.error('Scan now failed', e); window.alert('បរាជ័យក្នុងការចាប់ផ្ដើមស្កេន'); }
    } finally {
      setLoadingScannerFiles(false);
    }
  };

  const derived = useMemo(() => {
    const term = (q || '').toString().trim().toLowerCase();
    const currentYear = new Date().getFullYear();

    const getMonthlyReportNote = (hr) => {
      try {
        const del = hr && hr.delisted ? hr.delisted : {};
        return (
          hr.resignationOther ||
          hr.otherReason ||
          hr.additionalInfo ||
          hr.remarks ||
          hr.comments ||
          hr.note ||
          del.note ||
          del.Note ||
          ''
        );
      } catch (e) { return ''; }
    };

    const parseYearFromText = (text) => {
      try {
        const t = String(text || '');
        if (!t) return null;
        const map = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };
        const normalized = t.replace(/[០-៩]/g, ch => map[ch] || ch);
        const m = normalized.match(/\b(19\d{2}|20\d{2})\b/);
        if (!m) return null;
        const y = Number(m[1]);
        if (!Number.isFinite(y)) return null;
        return y;
      } catch {
        return null;
      }
    };

    const monthKeyFromNote = (note, fallbackDate) => {
      const n = (note || '').toString();
      if (!n) return null;
      const monthIndex = khMonths.findIndex(m => n.includes(m));
      if (monthIndex < 0) return null;
      const yFromText = parseYearFromText(n);
      const y = yFromText || (fallbackDate ? fallbackDate.getFullYear() : currentYear);
      return (y * 12) + monthIndex;
    };

    const getDelistedDate = (hr) => {
      const del = (hr && hr.delisted) ? hr.delisted : {};
      const dateStr = del.dateDelisted || del.date || hr?.resignationDate || hr?.resignDate || hr?.date_resigned || hr?.dateLeft || hr?.leftDate || hr?.departureDate || null;
      return parseDateSafe(dateStr);
    };

    const getRemovedDate = (hr) => {
      const del = (hr && hr.delisted) ? hr.delisted : {};
      const removedStr = hr?.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || hr?.dateRemovedFromDataset || hr?.removalDate || null;
      return parseDateSafe(removedStr);
    };

    const compareMostRecent = (a, b) => {
      const hra = a?.hr;
      const hrb = b?.hr;
      const da = getDelistedDate(hra) || getRemovedDate(hra);
      const db = getDelistedDate(hrb) || getRemovedDate(hrb);
      const na = (hra?.delisted && (hra.delisted.note || hra.delisted.Note)) || '';
      const nb = (hrb?.delisted && (hrb.delisted.note || hrb.delisted.Note)) || '';
      const ka = monthKeyFromNote(na, da);
      const kb = monthKeyFromNote(nb, db);

      if (ka != null && kb != null && ka !== kb) return kb - ka;
      if (ka != null && kb == null) return -1;
      if (ka == null && kb != null) return 1;

      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      if (ta !== tb) return tb - ta;
      const ida = (hra?.staffId || hra?.civilServantId || hra?.no || '').toString();
      const idb = (hrb?.staffId || hrb?.civilServantId || hrb?.no || '').toString();
      return idb.localeCompare(ida);
    };
    const hasDelistedData = (hr) => {
      const d = hr && hr.delisted ? hr.delisted : null;
      if (!d) return false;
      try {
        return Object.keys(d).some(k => {
          const v = d[k];
          return v !== null && typeof v !== 'undefined' && String(v).trim() !== '';
        });
      } catch (e) { return false; }
    };

    // Check if employee is marked as inactive/resigned/deleted
    const isDelistedStatus = (hr) => {
      const status = (hr && hr.status) || '';
      return status === 'Resigned' || status === 'Deleted' || status === 'Inactive';
    };

    // Enrich delisted data with various possible field names
    const enrichDelistedData = (hr) => {
      if (!hr.delisted) hr.delisted = {};

      // Debug: log first record to see available fields
      if (!window.__logged_hr_fields) {
        console.log('Sample HR record fields:', Object.keys(hr).sort());
        window.__logged_hr_fields = true;
      }

      // Map date from primary field: resignationDate
      if (!hr.delisted.dateDelisted && !hr.delisted.date) {
        if (hr.resignationDate) hr.delisted.dateDelisted = hr.resignationDate;
        else if (hr.resignDate) hr.delisted.dateDelisted = hr.resignDate;
        else if (hr.date_resigned) hr.delisted.dateDelisted = hr.date_resigned;
        else if (hr.dateLeft) hr.delisted.dateDelisted = hr.dateLeft;
        else if (hr.leftDate) hr.delisted.dateDelisted = hr.leftDate;
        else if (hr.departureDate) hr.delisted.dateDelisted = hr.departureDate;
        else if (hr.endDate) hr.delisted.dateDelisted = hr.endDate;
        else if (hr.separationDate) hr.delisted.dateDelisted = hr.separationDate;
      }

      // Map reason from primary field: resignationReason
      if (!hr.delisted.reason && !hr.delisted.Reason) {
        if (hr.resignationReason) hr.delisted.reason = hr.resignationReason;
        else if (hr.reasonLeft) hr.delisted.reason = hr.reasonLeft;
        else if (hr.resignReason) hr.delisted.reason = hr.resignReason;
        else if (hr.reason && hr.status === 'Resigned') hr.delisted.reason = hr.reason;
        else if (hr.reasonForLeaving) hr.delisted.reason = hr.reasonForLeaving;
        else if (hr.separationReason) hr.delisted.reason = hr.separationReason;
        else if (hr.departureReason) hr.delisted.reason = hr.departureReason;
        else if (hr.resignation_reason) hr.delisted.reason = hr.resignation_reason;
      }

      // Map documents from primary field: resignationDocument
      if (!hr.delisted.image) {
        if (hr.resignationDocument) hr.delisted.image = hr.resignationDocument;
        else if (hr.document) hr.delisted.image = hr.document;
        else if (hr.attachment) hr.delisted.image = hr.attachment;
        else if (hr.resignDocument) hr.delisted.image = hr.resignDocument;
        else if (hr.documents) hr.delisted.image = hr.documents;
        else if (hr.attachments) hr.delisted.image = hr.attachments;
        else if (hr.resignation_document) hr.delisted.image = hr.resignation_document;
        else if (hr.separationDocument) hr.delisted.image = hr.separationDocument;
        else if (hr.file) hr.delisted.image = hr.file;
        else if (hr.files) hr.delisted.image = hr.files;
      }

      // Map other/note from resignationOther
      if (!hr.delisted.note && !hr.delisted.Note) {
        if (hr.resignationOther) hr.delisted.note = hr.resignationOther;
        else if (hr.otherReason) hr.delisted.note = hr.otherReason;
        else if (hr.additionalInfo) hr.delisted.note = hr.additionalInfo;
        else if (hr.remarks) hr.delisted.note = hr.remarks;
        else if (hr.comments) hr.delisted.note = hr.comments;
      }

      return hr;
    };

    // Build all candidate rows (unenforced filtering), then partition into groups.
    const allRows = (list || []).map(hr => enrichDelistedData(hr));

    const matchedRows = allRows.filter(hr => {
      if (dept && (hr.Department_Kh || hr.department || '').trim() !== dept.trim()) return false;
      // Date range filter (from/to) — match if any relevant date (delisted or removed) falls within range
      try {
        const fromDate = parseDateSafe(filterFrom);
        const toDate = parseDateSafe(filterTo);
        if (fromDate || toDate) {
          const del = hr.delisted || {};
          // Choose which date field to filter: removal date or delisted/resignation date
          let selectedStr = null;
          if (filterDateField === 'removed') {
            selectedStr = hr.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || hr.dateRemovedFromDataset || hr.removalDate || null;
            const parsedSel = parseDateSafe(selectedStr);
            if (!parsedSel) return false;
            if (fromDate && parsedSel.getTime() < fromDate.getTime()) return false;
            if (toDate && parsedSel.getTime() > toDate.getTime()) return false;
          } else if (filterDateField === 'delisted') {
            selectedStr = del.dateDelisted || del.date || hr.resignationDate || hr.resignDate || hr.date_resigned || hr.dateLeft || hr.leftDate || hr.departureDate || null;
            const parsedSel = parseDateSafe(selectedStr);
            if (!parsedSel) return false;
            if (fromDate && parsedSel.getTime() < fromDate.getTime()) return false;
            if (toDate && parsedSel.getTime() > toDate.getTime()) return false;
          } else {
            // either: accept row if either removed OR delisted date is within the range
            const removedStr = hr.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || hr.dateRemovedFromDataset || hr.removalDate || null;
            const delistedStr = del.dateDelisted || del.date || hr.resignationDate || hr.resignDate || hr.date_resigned || hr.dateLeft || hr.leftDate || hr.departureDate || null;
            const parsedRem = parseDateSafe(removedStr);
            const parsedDel = parseDateSafe(delistedStr);
            const candidates = [parsedRem, parsedDel].filter(Boolean);
            if (candidates.length === 0) return false;
            const anyInRange = candidates.some(d => {
              if (fromDate && d.getTime() < fromDate.getTime()) return false;
              if (toDate && d.getTime() > toDate.getTime()) return false;
              return true;
            });
            if (!anyInRange) return false;
          }
        }
      } catch (e) {
        // ignore parse errors and continue
      }

      // Location filter: match against common place fields
      try {
        const loc = (filterLocation || '').toString().trim().toLowerCase();
        if (loc) {
          const fields = [hr.currentPlace, hr.birthPlace, hr.Department_Kh, hr.department, hr.previousPlace, hr.officeLocation, hr.locationBefore];
          const found = fields.some(f => (f || '').toString().toLowerCase().includes(loc));
          if (!found) return false;
        }
      } catch (e) { }
      const sid = (hr.civilServantId || hr.staffId || hr.no || hr.cardNo || hr.cardNumber || '').toString().toLowerCase();
      const name = (hr.khmerName || hr.name || '').toString().toLowerCase();
      const position = (hr.position || hr.role || hr.title || '').toString().toLowerCase();
      const deptField = (hr.Department_Kh || hr.department || '').toString().toLowerCase();
      const status = (hr.status || '').toString().toLowerCase();
      const delisted = hr.delisted || {};
      const delistedReason = (delisted.reason || delisted.Reason || '').toString().toLowerCase();
      const delistedNote = (delisted.note || delisted.Note || '').toString().toLowerCase();

      if (term) {
        return sid.includes(term) || name.includes(term) || position.includes(term) || deptField.includes(term) || status.includes(term) || delistedReason.includes(term) || delistedNote.includes(term);
      }
      return true;
    }).map(hr => ({ hr }));

    // Partition into groups: prepared (future delisted), deleted (past or status deleted)
    const prepared = [];
    const deleted = [];
    const other = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);

    matchedRows.forEach(r => {
      const hr = r.hr;
      const del = hr.delisted || {};
      const dateStr = (del.dateDelisted || del.date || hr.resignationDate || hr.dateLeft || hr.leftDate || hr.departureDate || null);
      const removedStr = hr.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || hr.dateRemovedFromDataset || hr.removalDate || null;
      const parsed = parseDateSafe(dateStr);
      const parsedRemoved = parseDateSafe(removedStr);
      const hrStatus = (hr && (hr.status || '')).toString().toLowerCase();

      // If there's an explicit removal-from-dataset date, treat it as deletion
      // (presence of a removal/dateRemoved means the record is considered removed)
      if (parsedRemoved) {
        deleted.push(r);
        return;
      }

      // Fall back to delisted/resignation date
      if (parsed && parsed.getTime() > today.getTime()) {
        prepared.push(r);
        return;
      }
      if (hrStatus === 'deleted') {
        deleted.push(r);
        return;
      }
      if (parsed && parsed.getTime() <= today.getTime()) {
        deleted.push(r);
        return;
      }
      other.push(r);
    });

    // Sort so the most recently stopped shows first (by monthly report note, then delisted date)
    try {
      prepared.sort(compareMostRecent);
      deleted.sort(compareMostRecent);
    } catch (e) { /* ignore sort errors */ }

    // Group into monthly buckets based on filtered 'deleted' rows AND 'new' rows
    const monthlyGroups = {}; // key: "YYYY-MM" -> { month, year, label, records: [], newRecords: [], closingDate: null, entryClosingDate: null }

    // Group resigned employees
    deleted.forEach(r => {
      const hr = r.hr;
      const note = getMonthlyReportNote(hr);
      const delDate = getDelistedDate(hr);
      const remDate = getRemovedDate(hr);
      const mIdx = monthKeyFromNote(note, delDate);

      let y, m;
      if (mIdx != null) {
        y = Math.floor(mIdx / 12);
        m = (mIdx % 12) + 1;
      } else if (delDate) {
        y = delDate.getFullYear();
        m = delDate.getMonth() + 1;
      } else if (remDate) {
        y = remDate.getFullYear();
        m = remDate.getMonth() + 1;
      } else {
        y = new Date().getFullYear();
        m = new Date().getMonth() + 1;
      }

      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!monthlyGroups[key]) {
        monthlyGroups[key] = {
          month: m,
          year: y,
          label: `ខែ ${khMonths[m - 1]} ${toKhmerDigits(y)}`,
          records: [],
          newRecords: [],
          closingDate: null,
          entryClosingDate: null
        };
      }
      monthlyGroups[key].records.push(r);

      // Closing date is the latest removal or delisted date in this group
      const refDate = remDate || delDate;
      if (refDate) {
        if (!monthlyGroups[key].closingDate || refDate > monthlyGroups[key].closingDate) {
          monthlyGroups[key].closingDate = refDate;
        }
      }
    });

    // Group NEW employees
    matchedRows.forEach(r => {
      const hr = r.hr;
      // Exclude those already in 'deleted' if they are also new (rare but possible)
      // Actually, we want them in both if they joined and left in the same month?
      // For now, just count all new entries.
      const jd = parseDateSafe(hr.joinDate || hr.nominationStartDate || hr.contractStartDate || hr.civilServantStartDate);
      if (!jd) return;
      const y = jd.getFullYear();
      const m = jd.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;

      if (!monthlyGroups[key]) {
        monthlyGroups[key] = {
          month: m,
          year: y,
          label: `ខែ ${khMonths[m - 1]} ${toKhmerDigits(y)}`,
          records: [],
          newRecords: [],
          closingDate: null,
          entryClosingDate: null
        };
      }
      monthlyGroups[key].newRecords.push({ hr });

      const eClose = parseDateSafe(hr.entryClosingDate);
      if (eClose) {
        if (!monthlyGroups[key].entryClosingDate || eClose > monthlyGroups[key].entryClosingDate) {
          monthlyGroups[key].entryClosingDate = eClose;
        }
      }
    });

    const sortedGroups = Object.values(monthlyGroups).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));

    const rows = (selectedMonthKey === 'all')
      ? deleted
      : (monthlyGroups[selectedMonthKey]?.records || []);

    const male = rows.filter(r => r.hr.gender === 'Male').length;
    const female = rows.filter(r => r.hr.gender === 'Female').length;
    return {
      rows,
      preparedRows: prepared,
      deletedRows: deleted,
      otherRows: other,
      male,
      female,
      total: rows.length,
      monthlyGroups: sortedGroups
    };
  }, [list, dept, q, filterFrom, filterTo, filterLocation, filterDateField, selectedMonthKey]);

  const renderStatusBadge = (s) => {
    if (!s) return null;
    const style = { display: 'inline-block', padding: '6px 10px', borderRadius: 14, color: '#fff', fontSize: 13, fontWeight: 700, minWidth: 40, textAlign: 'center' };
    const mapping = {
      'ត្រៀមលុបឈ្មោះ': { background: '#f39c12' },
      'លុបឈ្មោះរួច': { background: '#b91c1c' }
    };
    const sStyle = mapping[s] || { background: '#333' };
    return <span style={{ ...style, ...sStyle }}>{s}</span>;
  };

  const openEdit = (hr) => {
    // Enrich delisted data with field mapping when opening edit modal
    const enrichedDelisted = { ...(hr.delisted || {}) };

    // Map date from primary field: resignationDate
    if (!enrichedDelisted.dateDelisted && !enrichedDelisted.date) {
      if (hr.resignationDate) enrichedDelisted.dateDelisted = hr.resignationDate;
      else if (hr.resignDate) enrichedDelisted.dateDelisted = hr.resignDate;
      else if (hr.date_resigned) enrichedDelisted.dateDelisted = hr.date_resigned;
      else if (hr.dateLeft) enrichedDelisted.dateDelisted = hr.dateLeft;
      else if (hr.leftDate) enrichedDelisted.dateDelisted = hr.leftDate;
      else if (hr.departureDate) enrichedDelisted.dateDelisted = hr.departureDate;
      else if (hr.endDate) enrichedDelisted.dateDelisted = hr.endDate;
      else if (hr.separationDate) enrichedDelisted.dateDelisted = hr.separationDate;
    }

    // Map reason from primary field: resignationReason
    if (!enrichedDelisted.reason && !enrichedDelisted.Reason) {
      if (hr.resignationReason) enrichedDelisted.reason = hr.resignationReason;
      else if (hr.reasonLeft) enrichedDelisted.reason = hr.reasonLeft;
      else if (hr.resignReason) enrichedDelisted.reason = hr.resignReason;
      else if (hr.reason && hr.status === 'Resigned') enrichedDelisted.reason = hr.reason;
      else if (hr.reasonForLeaving) enrichedDelisted.reason = hr.reasonForLeaving;
      else if (hr.separationReason) enrichedDelisted.reason = hr.separationReason;
      else if (hr.departureReason) enrichedDelisted.reason = hr.departureReason;
      else if (hr.resignation_reason) enrichedDelisted.reason = hr.resignation_reason;
    }

    // Map documents from primary field: resignationDocument
    if (!enrichedDelisted.image) {
      if (hr.resignationDocument) enrichedDelisted.image = hr.resignationDocument;
      else if (hr.document) enrichedDelisted.image = hr.document;
      else if (hr.attachment) enrichedDelisted.image = hr.attachment;
      else if (hr.resignDocument) enrichedDelisted.image = hr.resignDocument;
      else if (hr.documents) enrichedDelisted.image = hr.documents;
      else if (hr.attachments) enrichedDelisted.image = hr.attachments;
      else if (hr.resignation_document) enrichedDelisted.image = hr.resignation_document;
      else if (hr.separationDocument) enrichedDelisted.image = hr.separationDocument;
      else if (hr.file) enrichedDelisted.image = hr.file;
      else if (hr.files) enrichedDelisted.image = hr.files;
    }

    // Map other/note from resignationOther
    if (!enrichedDelisted.note && !enrichedDelisted.Note) {
      if (hr.resignationOther) enrichedDelisted.note = hr.resignationOther;
      else if (hr.otherReason) enrichedDelisted.note = hr.otherReason;
      else if (hr.additionalInfo) enrichedDelisted.note = hr.additionalInfo;
      else if (hr.remarks) enrichedDelisted.note = hr.remarks;
      else if (hr.comments) enrichedDelisted.note = hr.comments;
    }

    // Normalize dateDelisted to yyyy-MM-dd for <input type="date"> value
    if (enrichedDelisted.dateDelisted) {
      try {
        const d = enrichedDelisted.dateDelisted.toString();
        // If ISO-like, take first 10 chars
        if (d.includes('T')) enrichedDelisted.dateDelisted = d.slice(0, 10);
        else enrichedDelisted.dateDelisted = d;
      } catch (e) {
        // leave as-is on failure
      }
    }

    // Auto-fill monthly report text from delisted date (editable)
    if (!enrichedDelisted.note || String(enrichedDelisted.note).trim() === '') {
      const dt = parseDateSafe(enrichedDelisted.dateDelisted) || new Date();
      enrichedDelisted.note = defaultMonthlyReportText(dt);
      setNoteAutoMode(true);
    } else {
      setNoteAutoMode(false);
    }

    // Map joining info
    if (hr.joinDate) enrichedDelisted.joinDate = fmtDateInput(hr.joinDate);
    if (hr.probationEndDate || hr.probationEnd) enrichedDelisted.probationEndDate = fmtDateInput(hr.probationEndDate || hr.probationEnd);

    // Map any existing removal-from-dataset date into editing object
    if (!enrichedDelisted.dateRemoved && !enrichedDelisted.date_removed) {
      if (hr.dateRemoved) enrichedDelisted.dateRemoved = hr.dateRemoved;
      else if (hr.dateRemovedFromDataset) enrichedDelisted.dateRemoved = hr.dateRemovedFromDataset;
      else if (hr.removalDate) enrichedDelisted.dateRemoved = hr.removalDate;
      else if (hr.date_removed) enrichedDelisted.dateRemoved = hr.date_removed;
    }

    // Normalize dateRemoved to yyyy-MM-dd for <input type="date"> value
    if (enrichedDelisted.dateRemoved) {
      try {
        const d2 = enrichedDelisted.dateRemoved.toString();
        if (d2.includes('T')) enrichedDelisted.dateRemoved = d2.slice(0, 10);
        else enrichedDelisted.dateRemoved = d2;
      } catch (e) { }
    }

    console.log('Opening edit for HR:', hr.staffId, 'Enriched delisted:', enrichedDelisted);

    setEditingHr({ ...hr, delisted: enrichedDelisted });
    setEditingDelisted(enrichedDelisted);
    try { setOriginalDelisted(JSON.parse(JSON.stringify(enrichedDelisted))); } catch { setOriginalDelisted(enrichedDelisted); }
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
    setShowEdit(true);
  };

  const closeEdit = () => {
    try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch { /* ignore */ }
    setShowEdit(false);
    setEditingHr(null);
    setEditingDelisted({});
    setNoteAutoMode(false);
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
  };

  const handleEditChange = (field, value) => {
    if (field === 'note') setNoteAutoMode(false);
    setEditingDelisted(prev => {
      const next = { ...prev };
      next[field] = value;

      // If user changes the delisted date and note is still in auto-mode, update it to match the month
      if (field === 'dateDelisted' && noteAutoMode) {
        const dt = parseDateSafe(value) || new Date();
        next.note = defaultMonthlyReportText(dt);
      }
      return next;
    });
  };

  const handleFileSelect = (file) => {
    try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch { /* ignore */ }
    if (!file) { setSelectedFile(null); setSelectedPreviewUrl(null); return; }
    setSelectedFile(file);
    setSelectedFileName(file.name || '');
    try { const url = URL.createObjectURL(file); setSelectedPreviewUrl(url); } catch { setSelectedPreviewUrl(null); }
  };

  const openScannerPicker = async () => {
    setShowScannerModal(true);
    setLoadingScannerFiles(true);
    try {
      const items = await listScans();
      setScannerFiles(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('List scans failed', err);
      setScannerFiles([]);
      window.alert('បរាជ័យក្នុងការទាញបញ្ជីស្កែន');
    } finally {
      setLoadingScannerFiles(false);
    }
  };

  const attachScan = async (name) => {
    try {
      // If multi-scan session is active, just add to the session list and don't attach immediately
      if (multiScanActive) {
        setMultiScanFiles(s => (s || []).concat([{ name, url: `/kshf_hospital_app/scanner/file/${encodeURIComponent(name)}` }]));
        // also refresh scannerFiles list
        try { const items = await listScans(); setScannerFiles(Array.isArray(items) ? items : []); } catch { }
        return;
      }

      const blob = await fetchScan(name);
      const filenameOriginal = name || ('scan_' + Date.now() + '.jpg');
      // if we're editing a record, suggest a filename based on staff/card id
      let fileNameToUse = filenameOriginal;
      try {
        const id = (editingHr && (editingHr.staffId || editingHr.cardNumber || editingHr.no || editingHr._id)) || null;
        if (id) {
          const ext = (filenameOriginal && filenameOriginal.toString().split('.').pop()) || 'jpg';
          const safeId = String(id).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
          const suggested = `${safeId}-Resign.${ext}`;
          // try renaming remote scanner file to suggested name (best-effort)
          try {
            const res = await (await import('../api/scanner')).renameScan(name, suggested);
            if (res && res.item && res.item.name) {
              fileNameToUse = res.item.name;
            } else {
              fileNameToUse = suggested;
            }
          } catch (e) {
            // backend may not allow rename; fall back to using suggested locally
            fileNameToUse = suggested;
          }
          setSelectedFileName(fileNameToUse);
        }
      } catch (e) { }
      const file = new File([blob], fileNameToUse, { type: blob.type || 'image/jpeg' });
      handleFileSelect(file);
      setShowScannerModal(false);
    } catch (err) {
      console.error('Fetch scan failed', err);
      window.alert('បរាជ័យក្នុងការទាញឯកសារ​ស្កេន');
    }
  };

  const handleDeleteScan = async (name) => {
    if (!confirm('តើអ្នកប្រាកដចង់លុបឯកសារនេះពីម៉ាស៊ីនស្កែន?')) return;
    try {
      setLoadingScannerFiles(true);
      await (await import('../api/scanner')).deleteScan(name);
      setScannerFiles((s) => (s || []).filter(x => (x && (x.name || x)) !== name));
      // also remove from multi-scan session if present
      setMultiScanFiles(s => (s || []).filter(x => (x && (x.name || x)) !== name));
    } catch (err) {
      console.error('Failed to delete scan', err);
      window.alert('មិនអាចលុបឯកសារបាន');
    } finally {
      setLoadingScannerFiles(false);
    }
  };

  const finishMultiScanAndMerge = async () => {
    if (!multiScanFiles || multiScanFiles.length === 0) { window.alert('មិនមានទំព័រនៅក្នុងសេស្យុង'); return; }
    try {
      // Load images as blobs
      const blobs = [];
      for (const it of multiScanFiles) {
        try {
          const name = it && it.name ? it.name : (typeof it === 'string' ? it : null);
          if (!name) continue;
          const b = await fetchScan(name);
          blobs.push({ name, blob: b });
        } catch (e) { console.error('Failed fetch scan for merge', it, e); }
      }
      if (blobs.length === 0) { window.alert('មិនអាចទាញទំព័រណាមួយសម្រាប់បង្កើត PDF'); return; }

      // Use jspdf to create a PDF from images
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      for (let i = 0; i < blobs.length; i++) {
        const { blob } = blobs[i];
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });

        // Create an image to get dimensions
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = dataUrl;
        });

        // Fit to page width with aspect ratio
        const imgWmm = pageW - 16; // 8mm margin each side
        const scale = imgWmm / img.width;
        const imgHmm = img.height * scale;
        const x = 8;
        const y = 8;

        if (i > 0) doc.addPage();
        // addImage accepts dataURL; detect type
        const fmt = (dataUrl.indexOf('image/png') >= 0) ? 'PNG' : 'JPEG';
        try { doc.addImage(dataUrl, fmt, x, y, imgWmm, imgHmm); } catch (e) { console.error('addImage failed', e); }
      }

      // Generate PDF blob
      const pdfBlob = doc.output('blob');

      // Create a File and set as selectedFile then upload
      const id = (editingHr && (editingHr.staffId || editingHr.no || editingHr._id)) || ('scan-' + Date.now());
      const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const pdfName = `${safeId}-Resign.pdf`;
      const pdfFile = new File([pdfBlob], pdfName, { type: 'application/pdf' });
      setSelectedFile(pdfFile);
      setSelectedFileName(pdfName);
      // upload using existing handler
      try {
        setShowScannerModal(false);
        setMultiScanActive(false);
        setMultiScanFiles([]);
        const uploaded = await handleUploadFile();
        if (uploaded) {
          window.alert('Merged PDF uploaded');
        }
      } catch (e) { console.error('Upload merged PDF failed', e); window.alert('Upload failed'); }
    } catch (err) {
      console.error('finishMultiScanAndMerge failed', err);
      window.alert('បង្កើត PDF បរាជ័យ');
    }
  };

  const saveRenameScan = async (oldName) => {
    const newName = (renameValue || '').toString().trim();
    if (!newName) { alert('សូមបញ្ចូលឈ្មោះថ្មី'); return; }
    try {
      const res = await (await import('../api/scanner')).renameScan(oldName, newName);
      if (res && res.item) {
        setScannerFiles((s) => (s || []).map(it => ((it && it.name) === oldName ? res.item : it)));
      }
      setEditingScan(null);
      setRenameValue('');
    } catch (err) {
      console.error('Rename failed', err);
      alert('មិនអាចប្តូរឈ្មោះបាន');
    }
  };

  const triggerScanNow = async (format = 'jpg') => {
    try {
      setLoadingScannerFiles(true);
      await scanNowWithFormat?.(format);
      // reload list after short delay
      setTimeout(() => openScannerPicker(), 1200);
    } catch (err) {
      try { await scanNow(); setTimeout(() => openScannerPicker(), 1200); } catch (e) { console.error('Scan now failed', e); window.alert('បរាជ័យក្នុងការចាប់ផ្តើមស្កេន'); }
    } finally {
      setLoadingScannerFiles(false);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) { window.alert('សូមជ្រើសឯកសារ'); return null; }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      // allow overriding filename before upload
      const uploadName = (selectedFileName && selectedFileName.toString().trim()) ? selectedFileName.toString().trim() : selectedFile.name;
      fd.append('file', selectedFile, uploadName);
      const { data } = await api.post('/upload', fd);
      const url = data && (data.url || data.path || data.fileUrl) ? (data.url || data.path || data.fileUrl) : (data && data[0] ? data[0].url : null);
      if (url) {
        setEditingDelisted(prev => ({ ...(prev || {}), image: url }));
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
    if (!editingDelisted || !(editingDelisted.image)) return;
    const ok = window.confirm('លុបឯកសារយោង?');
    if (!ok) return;
    const imageUrl = editingDelisted.image;
    setEditingDelisted(prev => ({ ...(prev || {}), image: '' }));
    try {
      const q = new URL(imageUrl, window.location.origin).pathname;
      await api.delete('/upload', { params: { path: q } });
    } catch (err) {
      console.debug('Server-side delete not available or failed', err?.message || err);
    }
  };

  const renameAttachedScannerFile = async () => {
    try {
      const cur = editingDelisted && editingDelisted.image;
      if (!cur) { window.alert('គ្មានឯកសារសម្រាប់ប្តូរឈ្មោះ'); return; }
      // detect scanner file route
      const marker = '/kshf_hospital_app/scanner/file/';
      let oldName = null;
      if (typeof cur === 'string' && cur.includes(marker)) {
        oldName = decodeURIComponent(cur.split('/').pop() || cur);
      } else if (typeof cur === 'string' && cur.startsWith('/')) {
        // possible encoded path like /Uploads/..., not supported by rename API
        window.alert('មិនអាចប្តូរឈ្មោះសម្រាប់ប្រភេទឯកសារនេះ');
        return;
      } else {
        window.alert('មិនអាចប្តូរឈ្មោះសម្រាប់ប្រភេទឯកសារនេះ');
        return;
      }
      const newName = window.prompt('ឈ្មោះថ្មីសម្រាប់ឯកសារ', oldName);
      if (!newName || !newName.toString().trim()) return;
      try {
        const res = await (await import('../api/scanner')).renameScan(oldName, newName.toString().trim());
        if (res && res.item) {
          // update editingDelisted.image to new scanner route if available
          const newUrl = res.item.url || (`/kshf_hospital_app/scanner/file/${encodeURIComponent(res.item.name || newName)}`);
          setEditingDelisted(prev => ({ ...(prev || {}), image: newUrl }));
          setScannerFiles((s) => (s || []).map(it => ((it && (it.name || it)) === oldName ? res.item : it)));
          window.alert('ប្តូរឈ្មោះបានសម្រេច');
        } else {
          window.alert('បរាជ័យក្នុងការប្តូរឈ្មោះ');
        }
      } catch (err) {
        console.error('Rename failed', err);
        window.alert('មិនអាចប្តូរឈ្មោះបាន');
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!showEdit) return;
      try {
        const curr = editingDelisted || {};
        const orig = originalDelisted || {};
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
  }, [showEdit, editingDelisted, originalDelisted]);

  const handleSaveEdit = async () => {
    if (!editingHr) return;
    setSaving(true);
    let uploadedUrl = null;
    try {
      if (selectedFile) {
        uploadedUrl = await handleUploadFile();
        if (!uploadedUrl) { setSaving(false); return; }
      }

      // Map form fields to database schema fields (top-level, not nested delisted object)
      const payload = {};

      if (modalMode === 'probation') {
        if (editingDelisted.probationEndDate) payload.probationEndDate = editingDelisted.probationEndDate;
      } else {
        // Map reason to resignationReason
        if (editingDelisted.reason) payload.resignationReason = editingDelisted.reason;

        // Map dateDelisted to resignationDate (allow clearing)
        if (typeof editingDelisted.dateDelisted !== 'undefined') payload.resignationDate = editingDelisted.dateDelisted ? editingDelisted.dateDelisted : null;

        // Map image to resignationDocument
        if (uploadedUrl) payload.resignationDocument = uploadedUrl;
        else if (editingDelisted.image && editingDelisted.image !== '') payload.resignationDocument = editingDelisted.image;

        // Map note/other to resignationOther
        if (editingDelisted.note) payload.resignationOther = editingDelisted.note;

        // Map dateRemoved (កាលបរិច្ឆេទដកទិន្នន័យ) — allow clearing when empty
        if (typeof editingDelisted.dateRemoved !== 'undefined') payload.dateRemoved = editingDelisted.dateRemoved ? editingDelisted.dateRemoved : null;
      }

      const id = editingHr._id || editingHr.no || editingHr.staffId;
      console.log('Saving delisted for HR ID:', id, 'Payload:', payload);

      const { data } = await api.put(`/hr/${id}`, payload);
      console.log('Save response:', data);

      // Update list with returned data
      setList(prev => prev.map(h => {
        if (h._id && data && data._id && h._id === data._id) return data;
        if (h._id && editingHr._id && h._id === editingHr._id) return data;
        if (!h._id && (h.no === editingHr.no || h.staffId === editingHr.staffId)) return data;
        return h;
      }));
      window.alert('រក្សាទុកបានដោយជោគជ័យ');
      closeEdit();
    } catch (err) {
      console.error('Save delisted failed', err);
      const errMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown error';
      const detailsMsg = err?.response?.data?.details ? '\n' + JSON.stringify(err.response.data.details, null, 2) : '';
      window.alert('រក្សាទុកបរាជ័យ: ' + errMsg + detailsMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleReturnToWork = async (hr) => {
    if (!hr) return;
    const id = hr._id || hr.no || hr.staffId;
    if (!id) return window.alert('Cannot determine HR id');
    const ok = window.confirm('តើអ្នកប្រាកដចង់ធ្វើឲ្យបុគ្គលនេះត្រឡប់មកធ្វើការ? វានឹងលុបវាលដែលទាក់ទងនឹងការសម្រាកពីការងារ (ថ្ងៃលាឈប់, មូលហេតុ, ឯកសារ)។');
    if (!ok) return;
    try {
      const payload = {
        status: 'Active',
        resignationDate: null,
        resignationReason: '',
        resignationDocument: '',
        resignationOther: '',
        dateRemoved: null
      };
      const { data } = await api.put(`/hr/${id}`, payload);
      // update local list
      setList(prev => (prev || []).map(h => {
        if ((h._id && data && data._id && h._id === data._id) || (!h._id && (h.no === hr.no || h.staffId === hr.staffId))) return data;
        return h;
      }));
      // if currently editing this hr, close editor
      if (editingHr && ((editingHr._id && editingHr._id === id) || (!editingHr._id && (editingHr.no === id || editingHr.staffId === id)))) {
        closeEdit();
      }
      window.alert('បានកំណត់ថាត្រឡប់មកធ្វើការ');
    } catch (err) {
      console.error('Return to work failed', err);
      window.alert('មិនអាចកំណត់បាន: ' + (err?.response?.data?.message || err?.message || 'កំហុស'));
    }
  };

  const handleSetGroupClosingDate = async (groupRecords, selectedDate) => {
    if (!groupRecords || groupRecords.length === 0 || !selectedDate) return;
    const ok = window.confirm(`តើអ្នកចង់រក្សាទុក "ថ្ងៃទី ${toKhmerDigits(new Date(selectedDate).getDate())}" ជាថ្ងៃបិទរបាយការណ៍ សម្រាប់មន្ត្រីទាំង ${toKhmerDigits(groupRecords.length)} នាក់ក្នុងខែនេះ?`);
    if (!ok) return;

    // Immediate local update for responsiveness
    setList(prev => (prev || []).map(h => {
      const isMember = groupRecords.some(r =>
        (r.hr._id && h._id && r.hr._id === h._id) ||
        (r.hr.staffId && h.staffId && r.hr.staffId === h.staffId) ||
        (r.hr.no && h.no && r.hr.no === h.no)
      );
      if (isMember) return { ...h, dateRemoved: selectedDate };
      return h;
    }));

    setSaving(true);
    try {
      const promises = groupRecords.map(r => {
        const id = r.hr._id || r.hr.no || r.hr.staffId;
        return api.put(`/hr/${id}`, { dateRemoved: selectedDate });
      });
      await Promise.all(promises);

      const { data } = await api.get('/hr');
      setList(Array.isArray(data) ? data : []);
      window.alert('រក្សាទុកបានដោយជោគជ័យ');
    } catch (err) {
      console.error('Batch save failed', err);
      window.alert('រក្សាទុកបរាជ័យ');
    } finally {
      setSaving(false);
    }
  };

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
    .print-only { display: none; }
    .no-print { display: block; }
  `;

  const handlePrint = () => {
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
    // 1. Export Resigned Employees (Delisted)
    const resignedRows = derived.rows;
    const headerResigned = [
      'ល.រ',
      'លេខមន្ត្រីរាជការ',
      'គោត្តនាម និងនាម',
      'ភេទ',
      'មុខងារ',
      'តួនាទី',
      'ផ្នែក',
      'មូលហេតុលុប',
      'ស្ថានភាព',
      'ថ្ងៃលុប',
      'កាលបរិច្ឆេទដកទិន្នន័យ',
      'ចូលរបាយការណ៍ខែ',
      'ឯកសារយោង'
    ];
    const dataResigned = resignedRows.map((row, idx) => {
      const delisted = row.hr && row.hr.delisted ? row.hr.delisted : {};
      const meta = computeDelistedMeta(delisted || {});
      return ([
        idx + 1,
        row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || '',
        row.hr.khmerName || row.hr.name || '',
        row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : '',
        row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || '',
        row.hr.position || row.hr.role || row.hr.title || '',
        row.hr.Department_Kh || row.hr.department || '',
        delisted.reason || delisted.Reason || '',
        meta.statusLabel || delisted.delistStatus || delisted.delistingStatus || '',
        (delisted.dateDelisted || delisted.date) ? fmtShortDate(delisted.dateDelisted || delisted.date) : '',
        (row.hr && (row.hr.dateRemoved || (delisted && (delisted.dateRemoved || delisted.date_removed)))) ? fmtShortDate(row.hr.dateRemoved || (delisted && (delisted.dateRemoved || delisted.date_removed))) : '',
        delisted.note || delisted.Note || '',
        delisted.image || ''
      ]);
    });

    const summaryResigned = [[
      `សរុប: ${derived.total} នាក់ ( ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់ )`
    ]];

    // 2. Export New Employees (Joined)
    const joinedRows = (selectedMonthKey === 'all')
      ? derived.monthlyGroups.reduce((acc, g) => acc.concat(g.newRecords || []), [])
      : (derived.monthlyGroups.find(g => `${g.year}-${String(g.month).padStart(2, '0')}` === selectedMonthKey)?.newRecords || []);

    const headerJoined = [
      'ល.រ',
      'លេខកាត',
      'គោត្តនាម និងនាម',
      'ភេទ',
      'តួនាទី',
      'ផ្នែក',
      'ថ្ងៃចូលបម្រើការ',
      'សាកល្បងដល់ថ្ងៃ',
      'ស្ថានភាព'
    ];

    const dataJoined = joinedRows.map((row, idx) => {
      const hr = row.hr;
      return ([
        idx + 1,
        hr.staffId || hr.no || '',
        hr.khmerName || hr.name || '',
        hr.gender === 'Male' ? 'ប' : hr.gender === 'Female' ? 'ស' : '',
        hr.position || hr.role || '',
        hr.Department_Kh || hr.department || '',
        fmtShortDate(hr.joinDate),
        fmtShortDate(hr.probationEndDate || hr.probationEnd),
        getProbationStatus(hr)
      ]);
    });
    
    const maleJoined = joinedRows.filter(r => r.hr.gender === 'Male').length;
    const femaleJoined = joinedRows.filter(r => r.hr.gender === 'Female').length;
    const summaryJoined = [[
      `សរុប: ${joinedRows.length} នាក់ ( ប្រុស: ${maleJoined} នាក់ — ស្រី: ${femaleJoined} នាក់ )`
    ]];

    // Combine data into a single sheet
    const finalData = [];
    
    if (joinedRows.length > 0) {
      finalData.push([`១. បញ្ជីបុគ្គលិកចូលថ្មី (${joinedRows.length} នាក់)`]);
      finalData.push(headerJoined);
      finalData.push(...dataJoined);
      finalData.push(summaryJoined[0]);
      finalData.push([]);
    }

    if (resignedRows.length > 0) {
      finalData.push([`២. បញ្ជីបុគ្គលិកឈប់ពីការងារ (${resignedRows.length} នាក់)`]);
      finalData.push(headerResigned);
      finalData.push(...dataResigned);
      finalData.push(summaryResigned[0]);
    }

    const ws = XLSX.utils.aoa_to_sheet(finalData);
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 18 },
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 24 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'របាយការណ៍បម្រែបម្រួល');
    XLSX.writeFile(wb, `OfficialReport_${reportYear}.xlsx`);
  };

  const renderGroupTable = (group, showHeader = true) => {
    const { label, records: resignedRows = [], newRecords: joinedRows = [], closingDate, entryClosingDate } = group;
    if ((!resignedRows || resignedRows.length === 0) && (!joinedRows || joinedRows.length === 0)) return null;

    // Status checks
    const isResignedClosed = resignedRows.length > 0 && resignedRows.every(r => {
      const d = r.hr.dateRemoved || (r.hr.delisted && (r.hr.delisted.dateRemoved || r.hr.delisted.date_removed));
      return d && d !== '';
    });
    const isJoinedClosed = joinedRows.length > 0 && joinedRows.every(r => r.hr.entryClosingDate && r.hr.entryClosingDate !== '');
    const isFullyClosed = (resignedRows.length === 0 || isResignedClosed) && (joinedRows.length === 0 || isJoinedClosed);

    const refClosing = closingDate || entryClosingDate || footerDate;
    const title = refClosing ? fmtKhmerLongDate(refClosing) : label;

    const columnDefsResigned = [
      { key: 'index', label: 'ល.រ', width: '40px' },
      { key: 'civilId', label: 'លេខមន្ត្រី', width: '80px' },
      { key: 'name', label: 'គោត្តនាម និងនាម', width: '120px' },
      { key: 'gender', label: 'ភេទ', width: '30px' },
      { key: 'role', label: 'មុខងារ', width: '150px' },
      { key: 'position', label: 'តួនាទី', width: '150px' },
      { key: 'dept', label: 'ផ្នែក', width: '250px' },
      { key: 'reason', label: 'មូលហេតុលុប', width: '190px' },
      { key: 'delistStatus', label: 'ស្ថានភាពលុប', width: '120px' },
      { key: 'dateDelisted', label: 'ថ្ងៃលុប', width: '90px' },
      { key: 'dateRemoved', label: 'កាលបរិច្ឆេទដកទិន្នន័យ', width: '90px' },
      { key: 'note', label: 'ចូលរបាយការណ៍ខែ', width: '100px' },
      { key: 'image', label: 'ឯកសារ', width: '60px' },
      { key: 'action', label: 'សកម្មភាព', width: '90px' }
    ];

    const columnDefsNew = [
      { key: 'index', label: 'ល.រ', width: '40px' },
      { key: 'civilId', label: 'លេខកាត', width: '80px' },
      { key: 'name', label: 'គោត្តនាម និងនាម', width: '150px' },
      { key: 'gender', label: 'ភេទ', width: '30px' },
      { key: 'position', label: 'តួនាទី', width: '150px' },
      { key: 'dept', label: 'ផ្នែក', width: '200px' },
      { key: 'joinDate', label: 'ថ្ងៃចូលបម្រើការ', width: '100px' },
      { key: 'probationEnd', label: 'សាកល្បងដល់ថ្ងៃ', width: '100px' },
      { key: 'probationStatus', label: 'ស្ថានភាព', width: '100px' },
      { key: 'action', label: 'សកម្មភាព', width: '60px' }
    ];
    const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const now = new Date();
    const currentKey = (now.getFullYear() * 12) + now.getMonth();

    const handleSetMovementClosingDate = async (targetRowsJoined, targetRowsResigned, selectedDate) => {
      if (!selectedDate) return;
      const count = (targetRowsJoined?.length || 0) + (targetRowsResigned?.length || 0);
      const confirm = window.confirm(`តើលោកអ្នកចង់កំណត់ថ្ងៃបិទរបាយការណ៍បម្រែបម្រួលបុគ្គលិកទាំង ${toKhmerDigits(count)} នាក់ ជាថ្ងៃទី ${fmtShortDate(selectedDate)} មែនទេ?`);
      if (!confirm) return;

      try {
        setSaving(true);
        const promises = [];
        if (targetRowsJoined) {
          targetRowsJoined.forEach(r => {
            const id = r.hr._id || r.hr.no || r.hr.staffId;
            if (id) promises.push(api.put(`/hr/${id}`, { entryClosingDate: selectedDate }));
          });
        }
        if (targetRowsResigned) {
          targetRowsResigned.forEach(r => {
            const id = r.hr._id || r.hr.no || r.hr.staffId;
            if (id) promises.push(api.put(`/hr/${id}`, { dateRemoved: selectedDate }));
          });
        }

        await Promise.all(promises);
        // Refresh data
        const { data } = await api.get('/hr');
        if (isMountedRef.current) setList(Array.isArray(data) ? data : []);
      } catch (err) {
        window.alert('ការរក្សាទុកមានបញ្ហា: ' + (err.response?.data?.message || err.message));
      } finally {
        if (isMountedRef.current) setSaving(false);
      }
    };

    let sectionCounter = 1;
    const titleParts = [];
    if (joinedRows.length > 0) titleParts.push(`ថ្មី: ${toKhmerDigits(joinedRows.length)}`);
    if (resignedRows.length > 0) titleParts.push(`ឈប់: ${toKhmerDigits(resignedRows.length)}`);
    const countSuffix = titleParts.length > 0 ? ` (${titleParts.join(' | ')})` : '';

    return (
      <div style={{ marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#fff' }}>
        {/* Unified Group Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          background: isFullyClosed ? '#f0fdf4' : '#f8fafc',
          padding: '8px 12px',
          borderRadius: '6px',
          border: isFullyClosed ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: isFullyClosed ? '#166534' : '#1e293b' }}>
              {title}{countSuffix}
            </h4>
            {isFullyClosed && (
              <span style={{ fontSize: '10px', background: '#22c55e', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                ✓ បានបិទរបាយការណ៍រួម
              </span>
            )}
          </div>
          {(perms.isAdmin || perms.canEditOfficialDelistedReport) && (
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, background: isFullyClosed ? '#dcfce7' : '#eff6ff', padding: '4px 10px', borderRadius: '4px', border: isFullyClosed ? '1px solid #86efac' : '1px solid #dbeafe' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: isFullyClosed ? '#166534' : '#1e40af' }}>{isFullyClosed ? 'ប្តូរថ្ងៃបិទរួម:' : 'កំណត់ថ្ងៃបិទរួម:'}</span>
              <input
                type="date"
                value={fmtDateInput(refClosing)}
                onChange={(e) => handleSetMovementClosingDate(joinedRows, resignedRows, e.target.value)}
                style={{ fontSize: '11px', padding: '2px 6px', border: '1px solid #bfdbfe', borderRadius: '3px' }}
              />
            </div>
          )}
        </div>

        {/* Section 1: New Employees */}
        {joinedRows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h5 style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }}></span>
              {toKhmerDigits(sectionCounter++)}. បញ្ជីបុគ្គលិកចូលថ្មី ({toKhmerDigits(joinedRows.length)} នាក់)
            </h5>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {columnDefsNew.map(c => <th key={c.key} style={{ border: '1px solid #cbd5e1', padding: '4px', width: c.width, textAlign: 'center' }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {joinedRows.map((r, idx) => (
                  <tr key={r.hr._id || idx} style={{ background: r.hr.entryClosingDate ? '#f1f5f9' : '#fff' }}>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{toKhmerDigits(idx + 1)}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{r.hr.staffId || r.hr.no}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{r.hr.khmerName || r.hr.name}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{r.hr.gender === 'Male' ? 'ប' : r.hr.gender === 'Female' ? 'ស' : ''}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{r.hr.position || r.hr.role}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{r.hr.Department_Kh || r.hr.department}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{fmtShortDate(r.hr.joinDate)}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{fmtShortDate(r.hr.probationEndDate || r.hr.probationEnd)}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>
                      {(() => {
                        const s = getProbationStatus(r.hr);
                        if (!s) return '';
                        const color = s === 'កំពុងសាកល្បង' ? '#854d0e' : s === 'បញ្ចប់សាកល្បង' ? '#166534' : '#9a3412';
                        const bg = s === 'កំពុងសាកល្បង' ? '#fef9c3' : s === 'បញ្ចប់សាកល្បង' ? '#dcfce7' : '#ffedd5';
                        return <span style={{ padding: '1px 4px', borderRadius: '4px', background: bg, color, fontSize: '9px', fontWeight: 600 }}>{s}</span>;
                      })()}
                    </td>
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setModalMode('probation'); openEdit(r.hr); }} className="px-2 py-0.5 bg-yellow-400 rounded text-[10px]">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 2: Resigned Employees */}
        {resignedRows.length > 0 && (
          <div>
            <h5 style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e11d48' }}></span>
              {toKhmerDigits(sectionCounter++)}. បញ្ជីបុគ្គលិកឈប់ពីការងារ ({toKhmerDigits(resignedRows.length)} នាក់)
            </h5>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {columnDefsResigned.filter(c => colOrder.includes(c.key)).map(c => <th key={c.key} style={{ border: '1px solid #cbd5e1', padding: '4px', width: c.width, textAlign: 'center' }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {resignedRows.map((row, idx) => (
                  <tr key={row.hr._id || idx} style={{ background: row.hr.dateRemoved ? '#f1f5f9' : '#fff' }}>
                    {(colOrder || defaultCols).map(k => {
                      const hr = row.hr;
                      const del = hr.delisted || {};
                      if (k === 'index') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{toKhmerDigits(idx + 1)}</td>;
                      if (k === 'civilId') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{hr.civilServantId || hr.staffId || hr.no}</td>;
                      if (k === 'name') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{hr.khmerName || hr.name}</td>;
                      if (k === 'gender') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{hr.gender === 'Male' ? 'ប' : 'ស'}</td>;
                      if (k === 'role') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{hr.civilServantRole || hr.role}</td>;
                      if (k === 'position') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{hr.position}</td>;
                      if (k === 'dept') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{hr.Department_Kh || hr.department}</td>;
                      if (k === 'reason') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{del.reason || del.Reason || '-'}</td>;
                      if (k === 'delistStatus') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{computeDelistedMeta(del).statusLabel}</td>;
                      if (k === 'dateDelisted') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{fmtShortDate(del.dateDelisted || del.date)}</td>;
                      if (k === 'dateRemoved') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{fmtShortDate(hr.dateRemoved)}</td>;
                      if (k === 'note') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px' }}>{del.note || del.Note || '-'}</td>;
                      if (k === 'image') return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>{del.image ? 'មាន' : '-'}</td>;
                      if (k === 'action') return (
                        <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setModalMode('delist'); openEdit(hr); }} className="px-2 py-0.5 bg-yellow-400 rounded text-[10px]">Edit</button>
                        </td>
                      );
                      return <td key={k} style={{ border: '1px solid #e2e8f0', padding: '4px' }}>-</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (!(perms.canViewHR || perms.canViewEmployees)) {
    return (
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-2">របាយការណ៍បម្រែបម្រួលបុគ្គលិកប្រចាំខែ</h3>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">របាយការណ៍បម្រែបម្រួលបុគ្គលិកប្រចាំខែ</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-sm" title="ស្វែងរកក្នុងចំណោម មន្ត្រីឈប់ទាំងអស់ - ID, ឈ្មោះ, តួនាទី, ផ្នែក, មូលហេតុ">ស្វែងរក (ID ឬ ឈ្មោះ):</label>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              className="rounded-md bg-gray-50 px-3 py-2 w-56 text-sm placeholder-gray-400 border border-gray-200"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { doImmediateSearch(q); } }}
              placeholder="ស្វែងរក: លេខកាត, ឈ្មោះ, តួនាទី, មូលហេតុ"
            />
            <button
              type="button"
              className="ml-1 border rounded px-2 py-1 text-sm bg-white text-gray-700"
              onClick={() => setQ('')}
            >
              Clear
            </button>
          </div>

          <label className="text-sm">គ្រប់គ្រង​:</label>
          <select value={filterDateField} onChange={(e) => setFilterDateField(e.target.value)} className="border rounded px-2 py-1">
            <option value="removed">ថ្ងៃលុប (dateRemoved)</option>
            <option value="delisted">ថ្ងៃលាលែង (dateDelisted)</option>
            <option value="either">ទាំងពីរ (Either)</option>
          </select>

          <label className="text-sm">ពីថ្ងៃ:</label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
          <label className="text-sm">ដល់ថ្ងៃ:</label>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />

          <label className="text-sm">ចន្ទគតិ*:</label>
          <input
            type="text"
            className="border rounded px-2 py-1 w-72"
            placeholder="ឧ. ថ្ងៃសុក្រ ១៣កើត ខែភទ្របទ ឆ្នាំម្សាញ់"
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

          <label className="text-sm">ខែរបាយការណ៍:</label>
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="border rounded px-2 py-1 bg-white"
            style={{ minWidth: '150px' }}
          >
            <option value="all">-- ទាំងអស់ --</option>
            {derived.monthlyGroups.map(g => (
              <option key={`${g.year}-${g.month}`} value={`${g.year}-${String(g.month).padStart(2, '0')}`}>
                {g.label} ({toKhmerDigits(g.records.length)} នាក់)
              </option>
            ))}
          </select>

          {(!lunarText.trim()) && <span className="text-red-600 text-xs">សូមបំពេញចន្ទគតិ</span>}
          <button className={`border px-2 py-1 rounded ${loading ? 'bg-gray-100 text-gray-300' : 'bg-green-600 text-white border-green-600'}`} onClick={handleExportExcel} disabled={loading}>Export Excel</button>
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
            <img src={headerBg} alt="" aria-hidden="true"
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150px', height: 'auto', opacity: 88, pointerEvents: 'none' }} />
            <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12.5px', position: 'relative', zIndex: 1 }}>ក្រសួងសុខាភិបាល</div>
          </div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'left' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>របាយការណ៍បម្រែបម្រួលបុគ្គលិកប្រចាំខែ ឆ្នាំ {toKhmerDigits(reportYear)}</div>
          {selectedMonthKey !== 'all' && (() => {
            const group = derived.monthlyGroups.find(g => `${g.year}-${String(g.month).padStart(2, '0')}` === selectedMonthKey);
            if (!group) return null;
            return (
              <div style={{ fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                ថ្ងៃទី {toKhmerDigits(group.closingDate ? new Date(group.closingDate).getDate() : new Date(footerDate).getDate())} {group.label}
              </div>
            );
          })()}
        </div>

        <div className="no-print">
          {(() => {
            const prepared = derived.preparedRows || [];
            const other = derived.otherRows || [];
            const hasSearch = (q || '').toString().trim() !== '';

            return (
              <div>
                {prepared.length > 0 && renderGroupTable({ label: 'ត្រៀមលុបឈ្មោះ (Prepared for deletion)', records: prepared }, true)}
                {derived.monthlyGroups.map((g, index) => {
                  if (selectedMonthKey !== 'all' && `${g.year}-${String(g.month).padStart(2, '0')}` !== selectedMonthKey) return null;
                  if (selectedMonthKey === 'all' && !hasSearch && !showAllMonths && index >= 3) return null;
                  return (
                    <div key={`${g.year}-${g.month}`} style={{ marginBottom: '24px' }}>
                      {renderGroupTable(g, true)}
                    </div>
                  );
                })}
                {selectedMonthKey === 'all' && !hasSearch && !showAllMonths && derived.monthlyGroups.length > 3 && (
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <button type="button" onClick={() => setShowAllMonths(true)} className="px-4 py-2 border rounded-md text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                      បង្ហាញខែផ្សេងទៀតទាំងអស់ ({toKhmerDigits(derived.monthlyGroups.length - 3)} ខែទៀត)
                    </button>
                  </div>
                )}

                {hasSearch && other.length > 0 && renderGroupTable({ label: 'ផ្សេងៗ (Other)', records: other }, true)}
              </div>
            );
          })()}
        </div>

        {/* Print-only simplified table */}
        <div className="print-only" style={{ display: 'none' }}>
          {derived.monthlyGroups.map(g => {
            if (selectedMonthKey !== 'all' && `${g.year}-${String(g.month).padStart(2, '0')}` !== selectedMonthKey) return null;
            const rows = g.records || [];
            if (rows.length === 0) return null;
            return (
              <div key={`${g.year}-${g.month}`} style={{ marginBottom: 24, breakAfter: 'auto' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #000', paddingBottom: 4 }}>
                  មន្ត្រីលុបឈ្មោះ — ថ្ងៃទី {toKhmerDigits(g.closingDate ? new Date(g.closingDate).getDate() : new Date(footerDate).getDate())} {g.label}
                  <span style={{ float: 'right' }}>សរុប {toKhmerDigits(rows.length)} នាក់</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>ល.រ</th>
                      <th style={{ width: '80px' }}>លេខកាត</th>
                      <th style={{ width: '80px' }}>លេខមន្ត្រី</th>
                      <th style={{ width: '150px' }}>គោត្តនាម និងនាម</th>
                      <th style={{ width: '40px' }}>ភេទ</th>
                      <th style={{ width: '160px' }}>តួនាទី</th>
                      <th style={{ width: '180px' }}>ផ្នែក</th>
                      <th>មូលហេតុ</th>
                      <th style={{ width: '90px' }}>ថ្ងៃលុប</th>
                      <th style={{ width: '100px' }}>ស្ថានភាព</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const delisted = (row.hr && row.hr.delisted) ? row.hr.delisted : {};
                      const meta = computeDelistedMeta(delisted || {});
                      const now = new Date();
                      const currentKey = (now.getFullYear() * 12) + now.getMonth();
                      const note = (delisted.note || delisted.Note || row.hr.resignationOther || row.hr.note || '').toString();
                      const delistedDate = parseDateSafe(delisted.dateDelisted || delisted.date || row.hr.resignationDate || row.hr.resignDate || row.hr.date_resigned || row.hr.dateLeft || row.hr.leftDate || row.hr.departureDate || null);
                      const yearFallback = delistedDate ? delistedDate.getFullYear() : now.getFullYear();
                      const monthIndex = note ? khMonths.findIndex(m => note.includes(m)) : -1;
                      let rowKey = null;
                      if (monthIndex >= 0) {
                        // best-effort year parse (supports Khmer digits)
                        const map = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };
                        const normalized = note.replace(/[០-៩]/g, ch => map[ch] || ch);
                        const m = normalized.match(/\b(19\d{2}|20\d{2})\b/);
                        const y = m ? Number(m[1]) : yearFallback;
                        rowKey = (y * 12) + monthIndex;
                      } else if (delistedDate) {
                        rowKey = (delistedDate.getFullYear() * 12) + delistedDate.getMonth();
                      }
                      const isOldMonth = (rowKey != null) && (rowKey < currentKey);
                      const isFutureMonth = (rowKey != null) && (rowKey > currentKey);
                      return (
                        <tr
                          key={row.hr._id || idx}
                          style={
                            isFutureMonth
                              ? { background: '#fef9c3' }
                              : isOldMonth
                                ? { background: '#f1f5f9' }
                                : undefined
                          }
                        >
                          <td className="center">{toKhmerDigits(idx + 1)}</td>
                          <td className="center">{row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || ''}</td>
                          <td className="center">{row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || ''}</td>
                          <td>{row.hr.khmerName || row.hr.name || ''}</td>
                          <td className="center">{row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : ''}</td>
                          <td>{row.hr.position || row.hr.role || row.hr.title || ''}</td>
                          <td>{row.hr.Department_Kh || row.hr.department || ''}</td>
                          <td>{delisted && (delisted.reason || delisted.Reason) ? (delisted.reason || delisted.Reason) : ''}</td>
                          <td className="center">{(delisted && (delisted.dateDelisted || delisted.date)) ? fmtShortDate(delisted.dateDelisted || delisted.date) : ''}</td>
                          <td className="center">{meta.statusLabel || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Edit modal for delisted fields */}
        {showEdit && (
          <div className="no-print" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ width: 720, background: '#fff', borderRadius: 6, padding: 16, maxHeight: '90vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>{modalMode === 'probation' ? 'កែទិន្នន័យសាកល្បង' : 'កែប្រែ មន្ត្រីលុបឈ្មោះ'}</h4>
                <button onClick={closeEdit} className="text-gray-600">បិទ</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {modalMode === 'probation' ? (
                  <>
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                      <div className="text-xs text-gray-500">លេខកាត: <span className="font-semibold text-gray-800">{editingHr?.staffId || editingHr?.no}</span></div>
                      <div className="text-xs text-gray-500">ឈ្មោះ: <span className="font-semibold text-gray-800">{editingHr?.khmerName || editingHr?.name}</span></div>
                    </div>

                    <div>
                      <label className="text-sm block mb-1 font-semibold">សាកល្បងដល់ថ្ងៃ</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                        {['៣ ខែ', '៦ ខែ', '១ ឆ្នាំ'].map((label, i) => {
                          const months = [3, 6, 12][i];
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                const jd = parseDateSafe(editingHr?.joinDate) || new Date();
                                const next = new Date(jd.getFullYear(), jd.getMonth() + months, jd.getDate());
                                handleEditChange('probationEndDate', fmtDateInput(next));
                              }}
                              className="py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 transition-colors"
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input
                          type="number"
                          placeholder="ចំនួន"
                          className="w-1/3 border rounded px-3 py-2 text-sm"
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            const unit = document.getElementById('probationUnit')?.value || 'months';
                            if (!isNaN(val)) {
                              const jd = parseDateSafe(editingHr?.joinDate) || new Date();
                              let next = new Date(jd);
                              if (unit === 'days') next.setDate(jd.getDate() + val);
                              else if (unit === 'months') next.setMonth(jd.getMonth() + val);
                              else if (unit === 'years') next.setFullYear(jd.getFullYear() + val);
                              handleEditChange('probationEndDate', fmtDateInput(next));
                            }
                          }}
                        />
                        <select id="probationUnit" className="w-2/3 border rounded px-3 py-2 text-sm">
                          <option value="days">ថ្ងៃ</option>
                          <option value="months">ខែ</option>
                          <option value="years">ឆ្នាំ</option>
                        </select>
                      </div>

                      <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '6px', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <input
                          type="date"
                          value={editingDelisted.probationEndDate || ''}
                          onChange={(e) => handleEditChange('probationEndDate', e.target.value)}
                          className="bg-transparent border-none focus:ring-0 text-blue-700 font-bold"
                        />
                        <span className="text-gray-400">📅</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm block mb-1 font-semibold">ស្ថានភាពសាកល្បង</label>
                      <input
                        type="text"
                        readOnly
                        value={getProbationStatus({ ...editingHr, probationEndDate: editingDelisted.probationEndDate })}
                        className="w-full border rounded px-3 py-2 bg-gray-50 text-sm text-gray-700 font-medium"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Date Delisted */}
                    <div>
                      <label className="text-sm block mb-1">កាលបរិច្ឆេទលាលែង</label>
                      <input
                        type="date"
                        value={editingDelisted.dateDelisted || ''}
                        onChange={(e) => handleEditChange('dateDelisted', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        placeholder="dd/mm/yyyy"
                      />
                    </div>

                    {/* Date Removed from dataset */}
                    <div>
                      <label className="text-sm block mb-1">កាលបរិច្ឆេទដកទិន្នន័យ</label>
                      <input
                        type="date"
                        value={editingDelisted.dateRemoved || ''}
                        onChange={(e) => handleEditChange('dateRemoved', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        placeholder="dd/mm/yyyy"
                      />
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="text-sm block mb-1">មូលហេតុលាលែង</label>
                      <textarea
                        value={editingDelisted.reason || ''}
                        onChange={(e) => handleEditChange('reason', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        rows={3}
                        placeholder="ផ្តល់ឱ្យមូលហេតុលុបឈ្មោះ"
                      />
                    </div>

                    {/* Note / Month report entry */}
                    <div>
                      <label className="text-sm block mb-1">ចូលរបាយការណ៍ខែ</label>
                      <textarea
                        value={editingDelisted.note || ''}
                        onChange={(e) => handleEditChange('note', e.target.value)}
                        className="w-full border rounded px-3 py-2"
                        rows={2}
                        placeholder="បញ្ចូលចូលរបាយការណ៍ខែ..."
                      />
                    </div>

                    {/* Document Upload */}
                    <div>
                      <label className="text-sm block mb-1">ឯកសារលាលែង</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileSelect(e.target.files && e.target.files[0])}
                          className="w-full border rounded px-3 py-2"
                        />
                        <button type="button" onClick={async () => { try { setScannerNameInput(scannerName || ''); setShowScannerDevicesModal(true); await loadDevices(); } catch (e) { setScannerNameInput(scannerName || ''); setShowScannerDevicesModal(true); } }} className="border rounded px-3 py-1 bg-gray-100 text-sm">Import from scanner</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', fontSize: '12px' }}>
                        {selectedPreviewUrl && (
                          <>
                            <a href={selectedPreviewUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Preview file</a>
                            <input value={selectedFileName} onChange={(e) => setSelectedFileName(e.target.value)} className="border rounded px-2 py-1 text-sm ml-2" style={{ width: 220 }} />
                          </>
                        )}
                        {!selectedPreviewUrl && editingDelisted.image && (
                          <>
                            <a href={editingDelisted.image} target="_blank" rel="noreferrer" className="text-blue-600 underline">Current file</a>
                            {editingDelisted.image && editingDelisted.image.includes('/kshf_hospital_app/scanner/file/') && (
                              <button type="button" onClick={renameAttachedScannerFile} className="border rounded px-2 py-0.5 text-sm ml-2">កែឈ្មោះ</button>
                            )}
                          </>
                        )}
                        {editingDelisted.image && <button type="button" onClick={handleDeleteReference} className="border rounded px-2 py-0.5 text-sm bg-red-50 text-red-700 ml-2">លុប</button>}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button type="button" onClick={closeEdit} className="border rounded px-3 py-1">បោះបង់</button>
                <button type="button" onClick={handleSaveEdit} className="border rounded px-3 py-1 bg-green-600 text-white" disabled={saving || uploadingFile}>{saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}</button>
              </div>
            </div>
          </div>
        )}
        {showScannerDevicesModal && (
          <div className="no-print" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 8, width: '100%', maxWidth: 420, boxShadow: '0 6px 40px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>ជ្រើសម៉ាស៊ីនស្កែន (Scanner)</h4>
                <button type="button" onClick={() => setShowScannerDevicesModal(false)} className="text-sm">បិទ</button>
              </div>
              <div>
                {loadingDevices ? <div>កំពុងស្វែងរកម៉ាស៊ីន...</div> : (
                  <div>
                    {devices && devices.length > 0 ? (
                      <div>
                        <label className="text-sm block mb-1">ម៉ាស៊ីនដែលរកឃើញ</label>
                        <select className="w-full border rounded px-2 py-2" value={scannerNameInput} onChange={e => setScannerNameInput(e.target.value)}>
                          <option value="">-- ជ្រើស --</option>
                          {devices.map((d, i) => {
                            const name = (typeof d === 'string') ? d : (d.name || d.device || JSON.stringify(d));
                            return <option key={i} value={name}>{name}</option>;
                          })}
                        </select>
                        <div className="text-xs text-gray-500 mt-1">ឬ បញ្ចូលឈ្មោះម៉ាស៊ីនដោយដៃ</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">មិនមានម៉ាស៊ីននៅលើ backend — អ្នកអាចបញ្ចូលឈ្មោះដោយដៃ</div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <label className="text-sm block mb-1">ឈ្មោះម៉ាស៊ីន (manual)</label>
                      <input className="w-full border rounded px-2 py-2" value={scannerNameInput} onChange={e => setScannerNameInput(e.target.value)} placeholder="ឈ្មោះម៉ាស៊ីន (ឧ. HP Scan)" />
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input id="multiScanChk" type="checkbox" checked={multiScanActive} onChange={(e) => setMultiScanActive(!!e.target.checked)} />
                      <label htmlFor="multiScanChk" className="text-sm">សេស្យុងពហុទំព័រ (ស្កេនច្រើនទំព័រ និងបញ្ចូលជា PDF)</label>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => setShowScannerDevicesModal(false)} className="border rounded px-3 py-1">បោះបង់</button>
                  <button type="button" onClick={() => confirmAndTriggerScan('jpg')} className="border rounded px-3 py-1 bg-blue-600 text-white">{multiScanActive ? 'ស្កេន (បន្ថែមទំព័រ)' : 'ស្កេន'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showScannerModal && (
          <div className="no-print" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ width: 640, background: '#fff', borderRadius: 6, padding: 12, maxHeight: '80vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>Scanned files</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => { setShowScannerModal(false); }} className="border rounded px-2 py-1">បិទ</button>
                  {multiScanActive ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 6 }}>
                        <div className="text-sm">សេស្យុង:</div>
                        <div className="text-sm font-medium">{(multiScanFiles || []).length} ទំព័រ</div>
                      </div>
                      <button type="button" onClick={async () => {
                        // open devices to scan next page
                        try { setScannerNameInput(scannerName || ''); setShowScannerDevicesModal(true); await loadDevices(); } catch (e) { setScannerNameInput(scannerName || ''); setShowScannerDevicesModal(true); }
                      }} className="border rounded px-2 py-1 bg-green-600 text-white">ស្កេនបន្ថែម</button>
                      <button type="button" onClick={async () => {
                        // finish and merge
                        try { await finishMultiScanAndMerge(); } catch (e) { console.error(e); alert('បរាជ័យក្នុងការបញ្ចូលទំព័រ'); }
                      }} className="border rounded px-2 py-1 bg-blue-600 text-white">បញ្ចប់ និង បង្កើត PDF</button>
                    </>
                  ) : (
                    <button type="button" onClick={async () => { try { setScannerNameInput(scannerName || ''); setShowScannerDevicesModal(true); await loadDevices(); } catch (e) { setScannerNameInput(scannerName || ''); setShowScannerDevicesModal(true); } }} className="border rounded px-2 py-1 bg-green-600 text-white">ស្កេនឥឡូវ</button>
                  )}
                </div>
              </div>
              <div style={{ minHeight: 120 }}>
                {loadingScannerFiles ? <div>Loading...</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {scannerFiles.length === 0 && <div className="text-gray-600">No scanned files found</div>}
                    {scannerFiles.map((f) => {
                      const name = (f && (f.name || f.url)) ? (f.name || f.url) : String(f);
                      return (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid #eee', padding: '6px 0' }}>
                          <div style={{ flex: 1 }}>
                            {editingScan === name ? (
                              <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="border px-2 py-1 text-sm w-64" />
                            ) : (
                              name
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {editingScan === name ? (
                              <>
                                <button type="button" onClick={() => saveRenameScan(name)} className="px-2 py-1 border rounded text-sm">រក្សាទុក</button>
                                <button type="button" onClick={() => { setEditingScan(null); setRenameValue(''); }} className="px-2 py-1 border rounded text-sm">បោះបង់</button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={async () => { try { const blob = await fetchScan(name); const url = URL.createObjectURL(blob); window.open(url, '_blank'); } catch (e) { console.error(e); alert('Failed to preview'); } }} className="px-2 py-1 border rounded text-sm">មើល</button>
                                <button type="button" onClick={() => attachScan(name)} className="px-2 py-1 border rounded text-sm bg-blue-600 text-white">នាំចូល</button>
                                <button type="button" onClick={async () => { if (multiScanActive) { setMultiScanFiles(s => (s || []).concat([{ name, url: `/kshf_hospital_app/scanner/file/${encodeURIComponent(name)}` }])); setScannerFiles((s) => s); alert('បញ្ចូលទំព័រនេះចូលក្នុងសេស្យុង'); } else { setEditingScan(name); setRenameValue(name); } }} className="px-2 py-1 border rounded text-sm">{multiScanActive ? 'បន្ថែមទំព័រ' : 'កែឈ្មោះ'}</button>
                                <button type="button" onClick={() => handleDeleteScan(name)} className="px-2 py-1 border rounded text-sm text-red-600">លុប</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer area */}
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
