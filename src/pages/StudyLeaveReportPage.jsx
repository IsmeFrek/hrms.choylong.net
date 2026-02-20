import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

function toKhmerDigits(n) {
  const map = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function fmtDateSlash(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

// Compute years, months, days between two dates in Y/M/D form
function computeYMDInterval(start, end) {
  if (!start) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  // Ensure s <= e; if start > end, swap
  let neg = false;
  let a = s; let b = e;
  if (a.getTime() > b.getTime()) { neg = true; a = e; b = s; }

  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();

  if (days < 0) {
    // borrow days from previous month of b
    const prev = new Date(b.getFullYear(), b.getMonth(), 0); // last day of prev month
    days += prev.getDate();
    months -= 1;
  }
  if (months < 0) { months += 12; years -= 1; }

  return { years, months, days, negative: neg };
}

function formatYMDIntervalKhmer(start, end) {
  const v = computeYMDInterval(start, end);
  if (!v) return null;
  const parts = [];
  if (v.years && v.years !== 0) parts.push(`${toKhmerDigits(v.years)} ឆ្នាំ`);
  if (v.months && v.months !== 0) parts.push(`${toKhmerDigits(v.months)} ខែ`);
  if (v.days && v.days !== 0) parts.push(`${toKhmerDigits(v.days)} ថ្ងៃ`);
  if (parts.length === 0) return toKhmerDigits(0) + ' ថ្ងៃ';
  return (v.negative ? '-' : '') + parts.join(' ');
}

function khWeekday(d) {
  const names = ['អាទិត្យ','ចន្ទ','អង្គារ','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍'];
  const dt = new Date(d);
  return names[dt.getDay()];
}

function khContains(text, keywords) {
  // Simple case-insensitive keywords presence check.
  if (!text) return false;
  const s = String(text).toLowerCase();
  if (!Array.isArray(keywords) || keywords.length === 0) return false;
  return keywords.some(k => {
    if (!k && k !== 0) return false;
    const kw = String(k).toLowerCase();
    return kw.split(/\s+/).every(tok => tok ? s.includes(tok) : true);
  });
}

function buddhistEraYear(d) {
  const dt = new Date(d);
  return dt.getFullYear() + 543;
}

function computeRetirementDate(dob) {
  // Assumption: retirement at age 60 from DOB; adjust if different
  if (!dob) return null;
  const dt = new Date(dob);
  if (isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear() + 60, dt.getMonth(), dt.getDate());
}

function daysDiffFromToday(dateLike) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return '';
  // normalize to local midnight for both dates to count whole days
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  // positive => days remaining until endDate; negative => days since expired
  return Math.round((t1 - t0) / msPerDay);
}

// Compute study status from a study object
function computeStudyStatus(stu) {
  if (!stu) return null;
  try {
    const startDate = stu.studyStart || stu.startDate;
    const daysToStart = startDate ? daysDiffFromToday(startDate) : '';
    let validityDays = daysDiffFromToday(stu.studyEnd || stu.endDate);
    if (validityDays === '' || validityDays == null) {
      const v2 = stu.validity;
      if (v2 !== '' && v2 != null && !isNaN(Number(v2))) validityDays = Number(v2);
      else validityDays = null;
    }

    if (daysToStart !== '' && daysToStart > 0) return 'ត្រៀមចូលសិក្សា';
    const nVal = (validityDays !== null && !isNaN(Number(validityDays))) ? Number(validityDays) : null;
  if (nVal !== null && nVal >= 1) return 'កំពុងបន្តការសិក្សា';
  if (nVal !== null && nVal < -30) return 'បានបញ្ចប់ការសិក្សាលើស១ខែ';
  if (nVal !== null) return 'ចូលបម្រើការងារវិញ';
    return null;
  } catch (e) { return null; }
}

export default function RetirementReportPage() {
  const perms = usePermission();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retireYear, setRetireYear] = useState(new Date().getFullYear());
  const printRef = useRef();
  const fileInputRef = useRef();
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0,10));
  const [editingHr, setEditingHr] = useState(null);
  const [originalStu, setOriginalStu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewHR || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true); setError('');
      try {
        // If a search query is present, request server-side filtered results
        const params = {};
        if (q && q.toString().trim() !== '') params.q = q.toString().trim();
        const { data } = await api.get('/hr', { params });
        if (!mounted) return;
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    // immediate load on mount
    load();
    return () => { mounted = false; };
  }, [perms.canViewHR, perms.canViewEmployees]);

  // Debounced server-side search when `q` changes — avoids firing too many requests while typing
  useEffect(() => {
    if (!(perms.canViewHR || perms.canViewEmployees)) return;
    let mounted = true;
    const tid = setTimeout(async () => {
      try {
        setLoading(true); setError('');
        const params = {};
        if (q && q.toString().trim() !== '') params.q = q.toString().trim();
        const { data } = await api.get('/hr', { params });
        if (!mounted) return;
        setList(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.message || err?.message || 'Search failed');
      } finally {
        if (mounted) setLoading(false);
      }
    }, 400);
    return () => { mounted = false; clearTimeout(tid); };
  }, [q, perms.canViewHR, perms.canViewEmployees]);

  const derived = useMemo(() => {
    const isCurrentlyStudying = (stu) => {
      if (!stu) return false;
      // prefer explicit start/end fields
      const start = stu.studyStart || stu.startDate;
      const end = stu.studyEnd || stu.endDate;
      try {
        if (end) {
          const dEnd = new Date(end);
          if (isNaN(dEnd.getTime())) return !!start; // if end invalid but has start, consider studying
          // if end is today or in future, still studying
          return daysDiffFromToday(dEnd) >= 0;
        }
        // no end date but has a start date -> treat as ongoing
        if (start) return true;
      } catch (e) {
        return false;
      }
      return false;
    };
    const isNotStarted = (stu) => {
      if (!stu) return false;
      const start = stu.studyStart || stu.startDate;
      if (!start) return false;
      try {
        const d = new Date(start);
        if (isNaN(d.getTime())) return false;
        // not started if start is strictly in the future (daysDiffFromToday > 0)
        return daysDiffFromToday(d) > 0;
      } catch (e) {
        return false;
      }
    };
    const keywords = ['សិក្សា','ស្រាវជ្រាវ','ហាត់ការងារ','បណ្ដុះបណ្ដាល','training','study','scholarship'];
    const term = (q || '').toString().trim().toLowerCase();
    const rows = (list || [])
      .map(hr => {
        const r = { hr, rDate: computeRetirementDate(hr.dob) };
        // attach computed study status for filtering/sorting
        const stuForFilter = hr.stu || hr.study || {};
        r.status = computeStudyStatus(stuForFilter);
        return r;
      })
      .filter(x => {
        // Department filter (applies always)
        if (dept && (x.hr.Department_Kh || '').trim() !== dept.trim()) return false;
  // If needed, additional filters (by study state) can be re-added here.

  const sid = (x.hr.civilServantId || x.hr.staffId || x.hr.no || x.hr.cardNo || x.hr.cardNumber || '').toString().toLowerCase();
        const name = (x.hr.khmerName || x.hr.name || '').toString().toLowerCase();

        // If a search term is provided, match by sid or name OR the keyword reason
        if (term) {
          return sid.includes(term) || name.includes(term) || khContains(x.hr.civilServantReason, keywords);
        }

        // No term: keep rows that either match the keyword reasons OR have study-related data
        const reasonMatches = khContains(x.hr.civilServantReason, keywords);
        const stu = x.hr.stu || x.hr.study || {};
        const hasStudyData = !!(
          (stu.studyStart || stu.startDate) ||
          (stu.studyEnd || stu.endDate) ||
          stu.studySkill ||
          stu.studyPlace ||
          (stu.validity !== '' && stu.validity != null && !isNaN(Number(stu.validity)))
        );
        return reasonMatches || hasStudyData;
      })
      .sort((a,b) => {
        // desired order: ត្រៀមចូលសិក្សា, កំពុងបន្តការសិក្សា, ចូលបម្រើការងារវិញ, បានបញ្ចប់ការសិក្សាលើស១ខែ
        const order = {
          'ត្រៀមចូលសិក្សា': 0,
          'កំពុងបន្តការសិក្សា': 1,
          'ចូលបម្រើការងារវិញ': 2,
          'បានបញ្ចប់ការសិក្សាលើស១ខែ': 3
        };
        const oa = (a.status && order.hasOwnProperty(a.status)) ? order[a.status] : 99;
        const ob = (b.status && order.hasOwnProperty(b.status)) ? order[b.status] : 99;
        if (oa !== ob) return oa - ob;
        return (a.hr.no||0)-(b.hr.no||0);
      });
    const male = rows.filter(r => r.hr.gender === 'Male').length;
    const female = rows.filter(r => r.hr.gender === 'Female').length;
    return { rows, male, female, total: rows.length };
  }, [list, dept, q]);
  

  // Debug: log fetched list and computed rows for troubleshooting
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug('[StudyLeaveReport] list count:', Array.isArray(list) ? list.length : 0, 'derived rows:', derived.rows ? derived.rows.length : 0);
      // eslint-disable-next-line no-console
      console.debug('[StudyLeaveReport] sample rows:', (derived.rows || []).slice(0,5).map(r => ({ id: r.hr._id || r.hr.no || r.hr.staffId, name: r.hr.khmerName || r.hr.name }))); 
    } catch (err) { /* ignore */ }
  }, [list, derived]);

  // Edit modal handlers
  const openEdit = (hr) => {
    const stu = hr.stu || hr.study || {};
    // deep copy to avoid mutating original until saved
    setEditingHr({ ...hr, stu: { ...(stu || {}) } });
    // keep original snapshot for unsaved-change detection
    try { setOriginalStu(JSON.parse(JSON.stringify(stu || {}))); } catch (e) { setOriginalStu(stu || {}); }
  };
  const closeEdit = () => setEditingHr(null);

  const handleEditChange = (field, value) => {
    setEditingHr(prev => {
      const stuPrev = (prev && prev.stu) ? { ...prev.stu } : {};
      const nextStu = { ...stuPrev };
      if (field === 'validity') {
        // store as number when possible, allow empty
        const n = (value === '' || value === null) ? '' : Number(value);
        nextStu.validity = n;
      } else if (field === 'studyStart') {
        // value from <input type=date> is YYYY-MM-DD
        nextStu.studyStart = value;
      } else if (field === 'studyEnd') {
        nextStu.studyEnd = value;
      } else {
        nextStu[field] = value;
      }

      // Auto-calc studyEnd when start + validity available
      try {
        const start = nextStu.studyStart || nextStu.startDate;
        const valid = nextStu.validity;
        if (start && valid !== '' && valid != null && !isNaN(Number(valid))) {
          const st = new Date(start);
          if (!isNaN(st.getTime())) {
            const end = new Date(st);
            end.setDate(end.getDate() + Number(valid));
            nextStu.studyEnd = end.toISOString().slice(0,10);
          }
        }
      } catch (e) {
        // ignore
      }

      return { ...prev, stu: nextStu };
    });
  };

  const handleSaveEdit = async () => {
    if (!editingHr) return;
    // If a file is selected, upload it first. We reuse the existing handler which manages uploadingFile/selectedFile state.
    let uploadedUrl = null;
    if (selectedFile) {
      uploadedUrl = await handleUploadFile();
      if (!uploadedUrl) return; // abort save if upload failed
    }
    setSaving(true);
    try {
      const id = editingHr._id || editingHr.no || editingHr.staffId;
      // prepare stu payload but do not include empty image string (preserve server value when omitted)
      const stuPayload = { ...(editingHr.stu || {}) };
      // If we just uploaded a file, ensure the URL is included (avoid relying on state update timing)
      if (uploadedUrl) {
        stuPayload.image = uploadedUrl;
      }
      if (stuPayload.image === '' || stuPayload.image == null) delete stuPayload.image;
      const payload = { stu: stuPayload };
      const { data } = await api.put(`/hr/${id}`, payload);
      // If backend returns updated hr object, use it; otherwise merge locally
      setList(prev => prev.map(h => {
        if (h._id && data && data._id && h._id === data._id) return data;
        if (h._id && editingHr._id && h._id === editingHr._id) return { ...h, stu: editingHr.stu };
        if (!h._id && (h.no === editingHr.no || h.staffId === editingHr.staffId)) return { ...h, stu: editingHr.stu };
        return h;
      }));
      closeEdit();
      setOriginalStu(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Save failed', err);
      window.alert('រក្សាទុកបរាជ័យ: ' + (err?.response?.data?.message || err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // File upload for reference document/image
  const handleFileSelect = (file) => {
    // Revoke previous preview URL if any
    try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch (e) { /* ignore */ }
    if (!file) {
      setSelectedFile(null);
      setSelectedPreviewUrl(null);
      return;
    }
    setSelectedFile(file);
    // Create an object URL for quick preview/opening for any selected file (image or pdf)
    try {
      const url = URL.createObjectURL(file);
      setSelectedPreviewUrl(url);
    } catch (e) {
      setSelectedPreviewUrl(null);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) { window.alert('សូមជ្រើសរើសឯកសារសិន'); return null; }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      // Debug: log FormData keys to help troubleshooting in browser console
      try {
        for (const entry of fd.entries()) {
          // entry[1] may be a File object — log its name/type when available
          if (entry[1] && entry[1].name) console.debug('FormData', entry[0], entry[1].name, entry[1].type, entry[1].size);
          else console.debug('FormData', entry[0], entry[1]);
        }
      } catch (e) { /* ignore */ }
      // api baseURL already includes /api, so POST to /upload -> /api/upload
      // Ensure axios/browser set the multipart boundary automatically by
      // explicitly avoiding any Content-Type being sent here. Setting it to
      // undefined will let the browser populate the correct header including
      // the boundary value.
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': undefined } });
      if (data && data.url) {
        // set the returned url into editingHr.stu.image
        setEditingHr(prev => ({ ...prev, stu: { ...(prev.stu||{}), image: data.url } }));
        setSelectedFile(null);
        // reset native file input so same file can be selected again
        try { if (fileInputRef && fileInputRef.current) fileInputRef.current.value = ''; } catch (e) { /* ignore */ }
        // revoke preview URL if any
        try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); setSelectedPreviewUrl(null); } } catch (e) { /* ignore */ }
        return data.url;
      }
      return null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Upload failed', err);
      window.alert('Upload failed: ' + (err?.response?.data?.error || err.message || 'Error'));
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteReference = async () => {
    if (!editingHr || !(editingHr.stu && editingHr.stu.image)) return;
    const ok = window.confirm('លុបឯកសារយោង? អនុវត្តន៍នេះនឹងលុប URL ពីកត់ត្រា និងព្យាយាមលុបឯកសារពីម៉ាស៊ីនបម្រើ។');
    if (!ok) return;
    const imageUrl = editingHr.stu.image;
    // locally clear first for responsive UI
    setEditingHr(prev => ({ ...prev, stu: { ...(prev.stu || {}), image: '' } }));
    try {
      // Attempt server-side delete if backend supports it; send the stored path or filename.
      // Many upload endpoints return URLs like '/Uploads/filename.ext'
      const q = new URL(imageUrl, window.location.origin).pathname;
      await api.delete('/upload', { params: { path: q } });
    } catch (err) {
      // It's okay if server doesn't support delete; just keep local cleared state.
      // eslint-disable-next-line no-console
      console.debug('Server-side delete not available or failed', err?.message || err);
    }
  };

  // Warn user about unsaved changes when trying to close modal or leave page
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!editingHr || !originalStu) return;
      try {
        const curr = editingHr.stu || {};
        const orig = originalStu || {};
        if (JSON.stringify(curr) !== JSON.stringify(orig)) {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }
      } catch (err) {
        // ignore comparison errors
      }
      return undefined;
    };
    if (editingHr) {
      window.addEventListener('beforeunload', onBeforeUnload);
    }
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [editingHr, originalStu]);

  // Cleanup preview URL when modal closes or component unmounts
  useEffect(() => {
    return () => {
      try { if (selectedPreviewUrl) { URL.revokeObjectURL(selectedPreviewUrl); } } catch (e) { /* ignore */ }
    };
  }, [selectedPreviewUrl]);

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
      'ជំនាញសិក្សា',
      'ទីកន្លែងសិក្សា',
      'សុពលភាព',
      'ផ្សេងៗ',
      'ថ្ងៃចាប់ផ្ដើម',
      'ថ្ងៃបញ្ចប់',
      'ឯកសារយោង'
    ];
    const data = rows.map((row, idx) => {
      const stu = row.hr.stu || row.hr.study || {};
      // compute validityDays from studyEnd (number of days from today to end)
      const validityDays = daysDiffFromToday(stu.studyEnd || stu.endDate) || stu.validity || '';
      return ([
        idx+1,
        row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || '',
        row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || '',
        row.hr.khmerName || row.hr.name || '',
        row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : '',
        // មុខងារ: prefer explicit role fields, fall back to position
        row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || '',
        // តួនាទី: show position primarily
        row.hr.position || row.hr.role || row.hr.title || '',
        row.hr.Department_Kh || row.hr.department || '',
        stu.studySkill || '',
        stu.studyPlace || '',
  validityDays,
        stu.other || '',
        fmtDateSlash(stu.studyStart || stu.startDate),
        fmtDateSlash(stu.studyEnd || stu.endDate),
        stu.image || ''
      ]);
    });

    const summary = [[
      `សរុប: ${derived.total} នាក់ ( ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់ )`
    ]];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, [], ...summary]);
    // Adjust column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 6 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = `Nivatt_${retireYear}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Retirement_${retireYear}.xlsx`);
  };

  // Small helper to render status badges with colors
  const renderStatusBadge = (s) => {
    if (!s) return null;
    const style = { display:'inline-block', padding:'6px 10px', borderRadius:14, color:'#fff', fontSize:13, fontWeight:700, minWidth:40, textAlign:'center' };
    const mapping = {
      'ត្រៀមចូលសិក្សា': { background: '#f39c12' }, // orange / amber
      'កំពុងបន្តការសិក្សា': { background: '#16a34a' }, // green
      'ចូលបម្រើការងារវិញ': { background: '#230ab4ff' }, // orange-ish for returned
      'បានបញ្ចប់ការសិក្សាលើស១ខែ': { background: '#b91c1c' } // dark red
    };
    const sStyle = mapping[s] || { background: '#333' };
    return <span style={{ ...style, ...sStyle }}>{s}</span>;
  };

  // Render a single group table with a title and count
  // showHeader: when false, do not render the <thead> (used so header appears only once)
  const renderGroupTable = (title, rows, showHeader = true) => {
    if (!rows || rows.length === 0) return null;
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
          {(() => {
            // Build column definitions similar to Unpaid report so widths and order are consistent
            const visible = { validity: true, status: true, duration: true, other: true, Start: true, End: true, image: true };
            const columnDefs = [
              { key: 'index', label: 'ល.រ', width: '35px' },
              { key: 'staffId', label: 'លេខកាត', width: '70px' },
              { key: 'civilId', label: 'លេខមន្ត្រី', width: '90px' },
              { key: 'name', label: 'គោត្តនាម និងនាម', width: '120px' },
              { key: 'gender', label: 'ភេទ', width: '40px' },
              { key: 'role', label: 'មុខងារ', width: '150px' },
              { key: 'position', label: 'តួនាទី', width: '150px' },
              { key: 'dept', label: 'ផ្នែក', width: '250px' },
              { key: 'skill', label: 'ជំនាញសិក្សា', width: '150px' },
              { key: 'place', label: 'ទីកន្លែងសិក្សា', width: '150px' },
              ...(visible.validity ? [{ key: 'validity', label: 'សុពលភាព', width: '70px' }] : []),
              ...(visible.status ? [{ key: 'status', label: 'ស្ថានភាព', width: '150px' }] : []),
              ...(visible.duration ? [{ key: 'duration', label: 'រយៈពេល', width: '110px' }] : []),
              ...(visible.other ? [{ key: 'other', label: 'ផ្សេងៗ', width: '140px' }] : []),
              ...(visible.Start ? [{ key: 'Start', label: 'ថ្ងៃចាប់ផ្ដើម', width: '80px' }] : []),
              ...(visible.End ? [{ key: 'End', label: 'ថ្ងៃបញ្ចប់', width: '80px' }] : []),
              ...(visible.image ? [{ key: 'image', label: 'ឯកសារយោង', width: '70px' }] : []),
              { key: 'action', label: 'សកម្មភាព', width: '60px' }
            ];
            const orderedDefs = (columnDefs || []).map(c => c).filter(Boolean);
            const numCols = orderedDefs.length;
            const equalPct = (100 / numCols).toFixed(4) + '%';
            const colElems = orderedDefs.map((c, i) => {
              const w = c && c.width ? c.width : equalPct;
              return <col key={c.key || i} style={{ width: w }} />;
            });

            return (
              <>
                <colgroup>{colElems}</colgroup>
                {showHeader && (
                  <thead>
                    <tr>
                      {orderedDefs.map(col => (
                        <th key={col.key} style={{border:'1px solid #d1cfcf', padding:'6px', textAlign:'center'}} className="center">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                )}
              </>
            );
          })()}
          <tbody>
            {rows.map((row, idx) => {
              const stu = row.hr.stu || row.hr.study || {};
              const staffId = row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || null;
              const civilId = row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || null;
              const fullName = row.hr.khmerName || row.hr.name || null;
              const gender = row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : null;
              const role = row.hr.civilServantRole || row.hr.role || row.hr.title || row.hr.position || null;
              const position = row.hr.position || row.hr.role || row.hr.title || null;
              const deptName = row.hr.Department_Kh || row.hr.department || null;
              const studySkill = stu.studySkill || null;
              const studyPlace = stu.studyPlace || null;
              let validityVal = daysDiffFromToday(stu.studyEnd || stu.endDate);
              if (validityVal === '' || validityVal == null) {
                const v2 = stu.validity;
                if (v2 !== '' && v2 != null && !isNaN(Number(v2))) validityVal = Number(v2);
                else validityVal = null;
              }
              const other = stu.other || null;
              const startFmt = fmtDateSlash(stu.studyStart || stu.startDate) || null;
              const endFmt = fmtDateSlash(stu.studyEnd || stu.endDate) || null;
              const status = row.status;
              let imageLink = null;
              if (stu.image && typeof stu.image === 'string') {
                try {
                  const full = new URL(stu.image, window.location.origin).href;
                  const parts = (stu.image || '').split('/');
                  const name = parts[parts.length-1] || stu.image;
                  const isImg = /\.(jpg|jpeg|png|gif)$/i.test(name);
                  imageLink = (
                    <a href={full} target="_blank" rel="noopener noreferrer" style={{color:'#1f6feb'}}>
                      {isImg ? 'View' : name}
                    </a>
                  );
                } catch (e) { imageLink = stu.image; }
              }

              // Render row cells by matching the columnDefs order used for the header
              const cellMap = {
                index: <td className="center">{toKhmerDigits(idx+1)}</td>,
                staffId: <td className="center">{staffId ? staffId : null}</td>,
                civilId: <td className="center">{civilId ? civilId : null}</td>,
                name: <td>{fullName ? fullName : null}</td>,
                gender: <td className="center">{gender ? gender : null}</td>,
                role: <td>{role ? role : null}</td>,
                position: <td>{position ? position : null}</td>,
                dept: <td>{deptName ? deptName : null}</td>,
                skill: <td>{studySkill ? studySkill : null}</td>,
                place: <td>{studyPlace ? studyPlace : null}</td>,
                validity: <td className="center">{validityVal !== null && validityVal !== undefined ? validityVal : null}</td>,
                status: <td className="center">{status ? renderStatusBadge(status) : null}</td>,
                duration: <td className="center">{(stu.studyStart || stu.startDate) ? formatYMDIntervalKhmer(stu.studyStart || stu.startDate, stu.studyEnd || stu.endDate) : null}</td>,
                other: <td>{other ? other : null}</td>,
                Start: <td className="center">{startFmt ? startFmt : null}</td>,
                End: <td className="center">{endFmt ? endFmt : null}</td>,
                image: <td>{imageLink}</td>,
                action: <td className="center"><button className="border px-2 py-1 text-sm rounded bg-yellow-200" onClick={()=> openEdit(row.hr)}>Edit</button></td>
              };

              // orderedDefs is in the surrounding closure from header rendering; re-create consistent order here
              const orderedKeys = ['index','staffId','civilId','name','gender','role','position','dept','skill','place','validity','status','duration','other','Start','End','image','action'];
              return (
                <tr key={row.hr._id || idx}>
                  {orderedKeys.map((k, i) => React.cloneElement(cellMap[k] || <td key={`empty-${i}`}>-</td>, { key: k }))}
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
        <h3 className="text-xl font-semibold mb-2">របាយការណ៍ បណ្ដុះបណ្ដាល</h3>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ​សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">របាយការណ៍ បណ្ដុះបណ្ដាល</h3>
          <p className="text-sm text-gray-600">បោះពុម្ពតាមគំរូ</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-sm">ស្វែងរក (ID ឬ ឈ្មោះ):</label>
          <div style={{display:'inline-flex', alignItems:'center', gap:6}}>
            <input type="text" className="rounded-md bg-gray-50 px-3 py-2 w-56 text-sm placeholder-gray-400 border border-gray-200" value={q} onChange={(e)=> setQ(e.target.value)} placeholder="វាយលេខកាត ឬ ឈ្មោះ: S0015 ឬ ឈ្មោះ" />
            <button type="button" className="ml-1 border rounded px-2 py-1 text-sm bg-white text-gray-700" onClick={() => setQ('')}>Clear</button>
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
          <div style={{fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'13px',marginTop:'4px', fontWeight:600}}>បញ្ជីឈ្មោះមន្រ្តីរាជការចូលនិវត្តន៍របស់ មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត ឆ្នាំ {toKhmerDigits(retireYear)}</div>
        </div>
        {/* Render grouped sections by status in the order required (screen) */}
        <div className="no-print">
          {(() => {
            const rows = derived.rows || [];
            if (rows.length === 0) {
              return <div className="center text-gray-600">មិនមានទិន្នន័យ</div>;
            }
            const grpReady = rows;
            const g0 = grpReady.filter(r => !r.status);
            const g1 = grpReady.filter(r => r.status === 'ត្រៀមចូលសិក្សា');
            const g2 = grpReady.filter(r => r.status === 'កំពុងបន្តការសិក្សា');
            const g3 = grpReady.filter(r => r.status === 'ចូលបម្រើការងារវិញ');
            const g4 = grpReady.filter(r => r.status === 'បានបញ្ចប់ការសិក្សាលើស១ខែ');
            return (
              <div>
                {(() => {
                  const groups = [ {title:'មិនទាន់មានស្ថានភាព', rows:g0}, {title:'ត្រៀមចូលសិក្សា', rows:g1}, {title:'កំពុងបន្តការសិក្សា', rows:g2}, {title:'ចូលបម្រើការងារវិញ', rows:g3}, {title:'បានបញ្ចប់ការសិក្សាលើស១ខែ', rows:g4} ];
                  const firstNonEmpty = groups.findIndex(g => g.rows && g.rows.length > 0);
                  return groups.map((g, idx) => renderGroupTable(g.title, g.rows, idx === firstNonEmpty));
                })()}
              </div>
            );
          })()}
        </div>

        {/* Print-only simplified tables: one for 'កំពុងបន្តការសិក្សា' and one for 'ចូលបម្រើការងារវិញ' */}
        <div className="print-only" style={{display:'none'}}>
          {(() => {
            const rowsAll = derived.rows || [];
            const rowsStudying = rowsAll.filter(r => r.status === 'កំពុងបន្តការសិក្សា');
            const rowsReturned = rowsAll.filter(r => r.status === 'ចូលបម្រើការងារវិញ');

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
                        <th>ទីកន្លែងសិក្សា</th>
                        <th>រយៈពេល</th>
                        <th>ថ្ងៃចាប់ផ្ដើម</th>
                        <th>ថ្ងៃបញ្ចប់</th>
                        <th>ផ្សេងៗ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => {
                        const stu = row.hr.stu || row.hr.study || {};
                        return (
                          <tr key={row.hr._id || idx}>
                            <td className="center">{toKhmerDigits(idx+1)}</td>
                            <td className="center">{row.hr.staffId || row.hr.cardNumber || row.hr.cardNo || row.hr.no || ''}</td>
                            <td className="center">{row.hr.civilServantId || row.hr.officerId || row.hr.staffId || row.hr.no || ''}</td>
                            <td>{row.hr.khmerName || row.hr.name || ''}</td>
                            <td className="center">{row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : ''}</td>
                            <td>{row.hr.position || row.hr.role || row.hr.title || ''}</td>
                            <td>{row.hr.Department_Kh || row.hr.department || ''}</td>
                            <td>{stu.studyPlace || ''}</td>
                            <td className="center">{(stu.studyStart || stu.startDate) ? formatYMDIntervalKhmer(stu.studyStart || stu.startDate, stu.studyEnd || stu.endDate) : ''}</td>
                            <td className="center">{fmtDateSlash(stu.studyStart || stu.startDate)}</td>
                            <td className="center">{fmtDateSlash(stu.studyEnd || stu.endDate)}</td>
                            <td>{stu.other || ''}</td>
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
                {rowsStudying.length > 0 ? renderSimpleTable('កំពុងបន្តការសិក្សា', rowsStudying) : null}
                {rowsReturned.length > 0 ? renderSimpleTable('ចូលបម្រើការងារវិញ', rowsReturned) : null}
                {(rowsStudying.length === 0 && rowsReturned.length === 0) && <div className="center">មិនមានទិន្នន័យ</div>}
              </div>
            );
          })()}
        </div>
        {/* Edit Modal */}
        {editingHr && (
          <div role="dialog" aria-modal="true" style={{position:'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{background:'#fff', padding:16, width:720, maxWidth:'95%', borderRadius:6}}>
              <h3 style={{margin:0, marginBottom:8}}>កែប្រែព័ត៌មានសិក្សា — {editingHr.khmerName || editingHr.name || editingHr.staffId}</h3>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                <div>
                  <label className="text-sm">ជំនាញសិក្សា</label>
                  <input className="border rounded w-full px-2 py-1" value={editingHr.stu?.studySkill||''} onChange={(e)=> handleEditChange('studySkill', e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">ទីកន្លែងសិក្សា</label>
                  <input className="border rounded w-full px-2 py-1" value={editingHr.stu?.studyPlace||''} onChange={(e)=> handleEditChange('studyPlace', e.target.value)} />
                </div>
                {/* validity removed per request */}
                <div>
                  <label className="text-sm">ផ្សេងៗ</label>
                  <input className="border rounded w-full px-2 py-1" value={editingHr.stu?.other||''} onChange={(e)=> handleEditChange('other', e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">ថ្ងៃចាប់ផ្ដើម</label>
                  <input type="date" className="border rounded w-full px-2 py-1" value={editingHr.stu?.studyStart ? (new Date(editingHr.stu.studyStart).toISOString().slice(0,10)) : ''} onChange={(e)=> handleEditChange('studyStart', e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">ថ្ងៃបញ្ចប់</label>
                  <input type="date" className="border rounded w-full px-2 py-1" value={editingHr.stu?.studyEnd ? (new Date(editingHr.stu.studyEnd).toISOString().slice(0,10)) : ''} onChange={(e)=> handleEditChange('studyEnd', e.target.value)} />
                </div>
                <div style={{gridColumn:'1 / -1'}}>
                  <label className="text-sm">ឯកសារយោង</label>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    {/* hidden native file input triggered by Browse button */}
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={(e)=> handleFileSelect(e.target.files && e.target.files[0])} />
                    <button type="button" className="border px-3 py-1 rounded bg-white" onClick={() => fileInputRef.current && fileInputRef.current.click()}>{selectedFile ? selectedFile.name : 'Browse...'}</button>
                    <div style={{flex:1, fontSize:13, color:'#333'}}>{editingHr.stu?.image ? `Current: ${editingHr.stu.image}` : (selectedFile ? selectedFile.name : 'No file selected')}</div>
                    <div style={{fontSize:11, color:'#666', marginLeft:8}}></div>
                    {/* Upload is performed automatically when saving; keep Delete if existing image */}
                    {editingHr.stu?.image && (
                      <button className="border px-2 py-1 rounded bg-red-600 text-white" onClick={handleDeleteReference} style={{marginLeft:6}}>លុប</button>
                    )}
                  </div>
                  {/* preview area: show selected file preview first, else stored image */}
                  {(selectedPreviewUrl || (selectedFile && selectedFile.type && selectedFile.type === 'application/pdf')) && (
                    <div style={{marginTop:8}}>
                      {selectedPreviewUrl && (
                        <img src={selectedPreviewUrl} alt="preview" style={{maxWidth:200, maxHeight:120, marginTop:6, border:'1px solid #ddd'}} />
                      )}
                      {(!selectedPreviewUrl && selectedFile && selectedFile.type === 'application/pdf') && (
                        <div style={{marginTop:6}}><a href={selectedPreviewUrl} target="_blank" rel="noopener noreferrer">{selectedFile.name}</a></div>
                      )}
                    </div>
                  )}
                  {/* when no selected file preview, show existing stored image if any */}
                  {!selectedPreviewUrl && (!selectedFile) && editingHr.stu?.image && (
                    <div style={{marginTop:8}}>
                      <div style={{fontSize:12, color:'#333'}}>Current: {editingHr.stu.image}</div>
                      {/* preview if image */}
                      {editingHr.stu.image.match(/\.(jpg|jpeg|png|gif)$/i) && (
                        <img src={editingHr.stu.image} alt="preview" style={{maxWidth:200, maxHeight:120, marginTop:6, border:'1px solid #ddd'}} />
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
                <button className="border px-3 py-1 rounded" onClick={closeEdit} disabled={saving || uploadingFile}>ចាកចេញ</button>
                <button className="border px-3 py-1 rounded bg-green-600 text-white" onClick={handleSaveEdit} disabled={saving || uploadingFile}>{(uploadingFile && !saving) ? 'កំពុងផ្ទុក...' : (saving ? 'កំពុងរក្សា...' : 'រក្សាទុក')}</button>
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
