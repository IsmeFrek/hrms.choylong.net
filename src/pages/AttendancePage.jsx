import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Zap, RefreshCcw, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import * as XLSX from 'xlsx';
import AttendanceEditModal from '../components/AttendanceEditModal';

export default function AttendancePage() {
  const perms = usePermission();
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0,10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0,10));
  const [searchStaffId, setSearchStaffId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLate, setFilterLate] = useState('');
  const [filterEarly, setFilterEarly] = useState('');
  const [loading, setLoading] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [lastImportFile, setLastImportFile] = useState(null);
  const [importMode, setImportMode] = useState('file'); // 'file' | 'mapped'
  const [fieldMap, setFieldMap] = useState({}); // maps target field -> header name
  const [error, setError] = useState('');
  const [list, setList] = useState([]);
  const [hrList, setHrList] = useState([]);
  const [hrLookup, setHrLookup] = useState({});
  const scanInputRef = useRef();
  const [scanValue, setScanValue] = useState('');
  const [autoSyncing, setAutoSyncing] = useState(false);

  useEffect(() => { loadList(); }, [fromDate, toDate, filterLate, filterEarly, searchStaffId]);

  // load HR reference data once to enrich attendance display (card no, names, position, dept)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get('/hr');
        if (!mounted) return;
        const items = Array.isArray(data) ? data : [];
        const lookup = {};
        items.forEach(r => {
          if (r.staffId) lookup[r.staffId] = r;
          if (r.cardNumber) lookup[r.cardNumber] = r;
          if (r.cardNo) lookup[r.cardNo] = r;
          if (r.no) lookup[r.no] = r;
          if (r._id) lookup[r._id] = r;
        });
        setHrList(items);
        setHrLookup(lookup);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function loadList() {
    try {
      setLoading(true);
      let url = `/attendance?from=${fromDate}&to=${toDate}`;
      if (searchStaffId) url += `&staffId=${encodeURIComponent(searchStaffId)}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (filterLate === 'yes') url += `&isLate=true`;
      if (filterEarly === 'yes') url += `&leftEarly=true`;
      
      const res = await api.get(url);
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const handleAutoSyncCheckinme = async () => {
    setAutoSyncing(true);
    setError('');
    try {
      // Sync for the currently selected fromDate
      const resp = await api.post('/attendance/auto-sync-checkinme', { date: fromDate });
      if (resp.data?.ok) {
        const res = resp.data.results || {};
        alert(`Sync ជោគជ័យ!\nនាំចូលបាន: ${res.imported || 0}\nបញ្ជាក់៖ ${res.matched || 0} នាក់ស្គាល់អត្តសញ្ញាណ`);
        await loadList();
      } else {
        throw new Error(resp.data?.message || 'Sync failed');
      }
    } catch (err) {
      console.error('Auto Sync Error:', err);
      setError(err?.response?.data?.message || err.message || 'Auto Sync failed');
    } finally {
      setAutoSyncing(false);
    }
  };

  const handleScan = async (sid) => {
    if (!sid) return setError('No scan value');
    setLoading(true); setError('');
    try {
      const hr = hrLookup[sid] || hrLookup[String(sid)];
      const today = fromDate;
      const now = new Date().toISOString();

      // default scheduled values, may be overridden by HR or schedules
      let scheduledStart = hr?.scheduledStart || hr?.shiftStart || '07:30';
      let scheduledEnd = hr?.scheduledEnd || hr?.shiftEnd || '15:30';
      let scheduledGraceMinutes = hr?.scheduledGraceMinutes ?? 15;
      let scheduledEndGraceMinutes = hr?.scheduledEndGraceMinutes ?? 0;

      // try loading schedules for the date and prefer a matching department schedule
      try {
        const schRes = await api.get(`/schedules?from=${today}&to=${today}`);
        const schedules = Array.isArray(schRes.data) ? schRes.data : [];
        const match = schedules.find(s => {
          if (!s) return false;
          if (!s.department) return true;
          if (hr && hr.Department_Kh && s.department === hr.Department_Kh) return true;
          if (hr && hr.department && s.department === hr.department) return true;
          return false;
        });
        if (match) {
          scheduledStart = match.scheduledStart || scheduledStart;
          scheduledEnd = match.scheduledEnd || scheduledEnd;
          scheduledGraceMinutes = (typeof match.scheduledGraceMinutes === 'number') ? match.scheduledGraceMinutes : scheduledGraceMinutes;
          scheduledEndGraceMinutes = (typeof match.scheduledEndGraceMinutes === 'number') ? match.scheduledEndGraceMinutes : scheduledEndGraceMinutes;
        }
      } catch (e) {
        // ignore schedule load errors and fallback to HR/defaults
      }

      // check if attendance exists for the staff/date
      const existingRes = await api.get(`/attendance?staffId=${encodeURIComponent(sid)}&from=${today}&to=${today}`);
      const existing = Array.isArray(existingRes.data) ? existingRes.data : [];
      if (existing.length > 0) {
        const rec = existing[0];
        const updates = {};
        if (!rec.checkIn) updates.checkIn = now;
        else if (!rec.checkOut) updates.checkOut = now;
        else updates.checkOut2 = now;

        updates.scheduledStart = scheduledStart;
        updates.scheduledEnd = scheduledEnd;
        updates.scheduledGraceMinutes = scheduledGraceMinutes;
        updates.scheduledEndGraceMinutes = scheduledEndGraceMinutes;

        await api.put(`/attendance/${rec._id}`, updates);
      } else {
        const payload = {
          staffId: sid,
          date: today,
          status: 'present',
          checkIn: now,
          scheduledStart,
          scheduledEnd,
          scheduledGraceMinutes,
          scheduledEndGraceMinutes,
          service: hr?.Department_Kh || hr?.department || undefined,
          notes: 'scanned'
        };
        await api.post('/attendance', payload);
      }
      setScanValue('');
      await loadList();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Scan failed');
    } finally { setLoading(false); }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!staffId) return setError('Staff ID required');
    setLoading(true); setError('');
    try {
      const payload = { staffId, date, status, notes };
      await api.post('/attendance', payload);
      setStaffId(''); setNotes(''); setStatus('present');
      await loadList();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Save failed');
    } finally { setLoading(false); }
  };

  // Quick helper: add a single sample attendance (useful for testing)
  const addSample = async (sampleStaffId = 's0932') => {
    setLoading(true); setError('');
    try {
      const hr = hrLookup[sampleStaffId] || hrLookup[String(sampleStaffId)];
      const now = new Date();
      const payload = {
        staffId: sampleStaffId,
        date,
        status: 'present',
        notes: 'sample',
        checkIn: now.toISOString(),
        // attach scheduled times if available on HR record, else defaults
        scheduledStart: hr?.scheduledStart || hr?.shiftStart || '07:30',
        scheduledEnd: hr?.scheduledEnd || hr?.shiftEnd || '15:30',
        scheduledGraceMinutes: hr?.scheduledGraceMinutes ?? 15,
        scheduledEndGraceMinutes: hr?.scheduledEndGraceMinutes ?? 0,
        service: hr?.Department_Kh || hr?.department || undefined,
      };
      await api.post('/attendance', payload);
      await loadList();
    } catch (err) {
      // ignore duplicate errors but surface others
      if (err?.response?.status === 409) {
        // already exists
      } else {
        setError(err?.response?.data?.message || err.message || 'Sample add failed');
      }
    } finally { setLoading(false); }
  };

  // Chat handler - simple alert or could open a chat modal
  const handleChat = (rec) => {
    const hr = hrLookup[rec.staffId] || null;
    alert(`Chat with ${hr ? (hr.khmerName || hr.fullName || hr.name) : rec.staffId}\nNotes: ${rec.notes || ''}`);
  };

  // Edit handler - quick inline edit for notes (could open a modal)
  const handleEdit = async (rec) => {
    // open modal to edit full record
    setEditRecord(rec);
    setEditOpen(true);
  };

  // Delete handler
  const handleDelete = async (rec) => {
    if (!confirm('Confirm delete attendance for ' + (rec.staffId || '')) ) return;
    try {
      await api.delete(`/attendance/${rec._id}`);
      await loadList();
    } catch (e) { setError(e?.response?.data?.message || e.message || 'Delete failed'); }
  };

  // Edit modal state & save handler
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const handleSaveEdit = async (form) => {
    if (!editRecord) return;
    setLoading(true); setError('');
    try {
      // prepare payload: allow updating checkIn/checkOut/time by composing ISO if date provided
      const payload = {};
      if (form.staffId) payload.staffId = form.staffId;
      if (form.service !== undefined) payload.service = form.service || '';
      if (form.status !== undefined) payload.status = form.status || '';
      if (form.notes !== undefined) payload.notes = form.notes || '';

      // normalize time strings into HH:MM:SS and ISO when possible
      const pad = (n) => String(n).padStart(2, '0');
      const normalizeShort = (t) => {
        if (!t && t !== 0) return '';
        let s = String(t).trim();
        // ISO datetime -> extract time
        const maybeDate = new Date(s);
        if (!isNaN(maybeDate.getTime()) && /T/.test(s)) {
          return pad(maybeDate.getHours()) + ':' + pad(maybeDate.getMinutes()) + ':' + pad(maybeDate.getSeconds());
        }
        // handle 12-hour times with AM/PM (e.g. "11:00 PM" or "11:00:00 PM")
        const ampm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
        if (ampm) {
          let hh = parseInt(ampm[1], 10);
          const mm = ampm[2];
          const ss = ampm[3] ? ampm[3].padStart(2,'0') : '00';
          const mer = ampm[4].toUpperCase();
          if (mer === 'PM' && hh !== 12) hh += 12;
          if (mer === 'AM' && hh === 12) hh = 0;
          return pad(hh) + ':' + pad(Number(mm)) + ':' + ss;
        }
        // plain hour like "7" -> 07:00:00
        const mHour = s.match(/^\d{1,2}$/);
        if (mHour) return pad(Number(s)) + ':00:00';
        // HH:MM -> add seconds
        const mHM = s.match(/^(\d{1,2}):(\d{2})$/);
        if (mHM) return pad(Number(mHM[1])) + ':' + pad(Number(mHM[2])) + ':00';
        // HH:MM:SS -> accept
        const mHMS = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
        if (mHMS) return pad(Number(mHMS[1])) + ':' + pad(Number(mHMS[2])) + ':' + pad(Number(mHMS[3]));
        // fallback: return original string (may be empty)
        return s;
      };
      const toIso = (dateStr, timeStr) => {
        if (!dateStr) return undefined;
        const short = normalizeShort(timeStr);
        if (!short) return undefined;
        // construct ISO
        try { return new Date(`${dateStr}T${short}`).toISOString(); } catch (e) { return undefined; }
      };

      const shortIn = normalizeShort(form.checkIn);
      const shortOut = normalizeShort(form.checkOut);
  const shortIn2 = normalizeShort(form.checkIn2);
  const shortOut2 = normalizeShort(form.checkOut2);
      const ci = toIso(form.date, form.checkIn);
      const co = toIso(form.date, form.checkOut);
  const ci2 = toIso(form.date, form.checkIn2);
  const co2 = toIso(form.date, form.checkOut2);
      if (ci) payload.checkIn = ci;
      if (co) payload.checkOut = co;
  if (ci2) payload.checkIn2 = ci2;
  if (co2) payload.checkOut2 = co2;
      // also send short time strings so backend can persist readable times
      if (shortIn) payload.checkInShort = shortIn;
      if (shortOut) payload.checkOutShort = shortOut;
  if (shortIn2) payload.checkIn2Short = shortIn2;
  if (shortOut2) payload.checkOut2Short = shortOut2;

      await api.put(`/attendance/${editRecord._id}`, payload);
      setEditOpen(false); setEditRecord(null);
      await loadList();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Update failed');
    } finally { setLoading(false); }
  };

  // Export attendance list to Excel
  const exportAttendance = () => {
    const header = ['#', 'Staff ID', 'Employees', 'Check-in', 'Check-out', 'Check-in-2', 'Check-out-2', 'Note', 'Department_Kh'];
    const data = (list||[]).map((r,i) => {
      const hr = hrLookup[r.staffId] || {};
      const name = hr.khmerName || hr.name || r.staffName || r.staff?.fullName || '';
      const notes = r.notes || '';
      const depKh = r.departmentKh || hr.Department_Kh || '';
      const formatTime = (t) => {
        if (!t) return '';
        const d = new Date(t);
        return isNaN(d.getTime()) ? t : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      };
      return [
        i+1,
        r.staffId || '',
        name,
        formatTime(r.checkIn),
        formatTime(r.checkOut),
        formatTime(r.checkIn2),
        '', // Check-out-2 placeholder
        notes,
        depKh
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `Attendance_${date}.xlsx`);
  };

  // Import attendance from Excel - simple mapping
  const importAttendance = async (file) => {
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header:1, defval: '' });
      let headerIdx = raw.findIndex(r => r.some(c => /លេខកាត|staff id|card/i.test(String(c||''))));
      if (headerIdx === -1) headerIdx = 0;
      // detect 2-row header (improved heuristic)
      let headerRowsCount = 1;
      const nextRow = raw[headerIdx+1];
      if (Array.isArray(nextRow)) {
        const nonEmpty = nextRow.filter(c => String(c||'').trim() !== '').length;
        if (nonEmpty >= 3) {
          // count how many cells look like headers (contain letters and are not just times/numbers)
          const headerLikeCount = nextRow.filter(c => {
            const s = String(c||'').trim();
            if (!s) return false;
            // treat pure times/numbers as non-header
            if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(s)) return false;
            if (/^[\d\-\/\.]+$/.test(s)) return false;
            // letters (Latin or Khmer) indicate header-like
            return /[A-Za-z\u1780-\u17FF]/.test(s);
          }).length;
          // require a strong majority of header-like cells to consider second row a header
          if (headerLikeCount >= Math.ceil(nonEmpty * 0.75)) headerRowsCount = 2;
        }
      }
      const maxCols = Math.max(...raw.slice(headerIdx, headerIdx+headerRowsCount).map(r=>r.length));
      const headers = [];
      for (let c=0;c<maxCols;c++) {
        const parts = [];
        for (let r=0;r<headerRowsCount;r++) {
          const v = raw[headerIdx + r] && raw[headerIdx + r][c] ? String(raw[headerIdx + r][c]).trim() : '';
          if (v) parts.push(v);
        }
        headers.push(parts.join(' ').trim() || `col${c}`);
      }
      const dataRows = raw.slice(headerIdx + headerRowsCount);
      const rows = dataRows.map(r => {
        const obj = {};
        headers.forEach((h,i) => obj[h] = r[i] !== undefined ? r[i] : '');
        return obj;
      });
      // Quick sanity check: if headers look like they include first-row data (e.g. "Staff ID E001")
      const badHeader = headers.some(h => {
        if (!h) return false;
        // header combined with a value often contains digits or time patterns after the header text
        return /\d/.test(h) || /\d{1,2}:\d{2}/.test(h);
      });
      if (badHeader && rows.length === 0) {
        setError('Detected possible combined header+row (CSV with only one data row). Please upload a proper Excel (.xlsx) file or include more data rows.');
        setPreviewHeaders(headers);
        setPreviewRows([]);
        setImportPreviewOpen(true);
        return;
      }
      setPreviewHeaders(headers);
      setPreviewRows(rows.slice(0,200));
      // reset mapping and default to file mode
      setFieldMap({});
      setImportMode('file');
      setImportPreviewOpen(true);
    } catch (e) { setError(e?.message || 'Import failed'); }
  };

  // Called when user confirms preview import
  const confirmImport = async () => {
    setImportPreviewOpen(false);
    if (!previewRows || previewRows.length === 0) return alert('No rows to import');
    setLoading(true);
    try {
      if (importMode === 'file' && lastImportFile) {
        // Upload original file to server import endpoint which performs mapping & upsert
        const form = new FormData();
        form.append('file', lastImportFile);
        const q = `?date=${encodeURIComponent(date)}`;
        const resp = await fetch(`/api/imports/attendance${q}`, { method: 'POST', body: form });
        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.error || json?.message || 'Import failed');
        }
        const res = json.results || json;
        await loadList();
        // If there are errors, show a dialog with a short sample and log full errors to console for debugging
        if (res.errors && Array.isArray(res.errors) && res.errors.length > 0) {
          const sample = res.errors.slice(0, 10).map(e => `Row ${e.row}: ${e.message}`).join('\n');
          alert(`Imported ${res.imported || 0} rows, skipped ${res.skipped || 0}. ${res.errors.length} errors.\n\nSample errors:\n${sample}`);
          console.error('Import errors full list:', res.errors);
        } else {
          alert(`Imported ${res.imported || 0} rows, skipped ${res.skipped || 0}.`);
        }
      } else {
        // Client-side import using previewRows and mapping (or legacy heuristics)
        let imported = 0, skipped = 0;
        for (const r of previewRows) {
          // resolve fields using fieldMap if provided, otherwise fallback to common column names
          const get = (targetKeys) => {
            // if fieldMap maps this key to a header name, use it
            if (fieldMap && fieldMap[targetKeys]) return r[fieldMap[targetKeys]] || '';
            // else try sensible fallbacks
            const fallbacks = {
              staffId: ['លេខកាត','Staff ID','StaffID','card','Card','staffId','Card No','No','no'],
              name: ['Name','name','នាម','ឈ្មោះ','គោត្តនាម និងនាម','Full Name'],
              checkIn: ['Check in','Checkin','Checkin 1','ចូល','Check in 08:00','Check in 08'],
              checkOut: ['Check out','Checkout','ចេញ'],
              checkIn2: ['Checkin-2','Checkin 2','ចូល២'],
              checkOut2: ['Checkout-2','Checkout 2','ចេញ២'],
              status1: ['Status','Status1','ស្ថានភាព','ស្ថានភាពចូល'],
              status2: ['Status2','ស្ថានភាព២'],
              service: ['Service','Dept','Department','ផ្នែក','សេវាកម្ម'],
              note: ['Note','Notes','សំគាល់','កំណត់សម្គាល់']
            };
            const keys = fallbacks[targetKeys] || [];
            for (const k of keys) {
              if (r[k] !== undefined && r[k] !== null && String(r[k]).toString().trim() !== '') return r[k];
            }
            return '';
          };

          const sidRaw = get('staffId') || get('name');
          const sid = sidRaw ? String(sidRaw).trim() : '';
          if (!sid) { skipped++; continue; }

          const payload = {
            staffId: sid,
            date: (get('date') || r['ថ្ងៃ'] || r['Date'] || date),
            checkIn: get('checkIn') || '',
            checkOut: get('checkOut') || '',
            checkIn2: get('checkIn2') || '',
            checkOut2: get('checkOut2') || '',
            service: get('service') || '',
            notes: get('note') || ''
          };
          try { await api.post('/attendance', payload); imported++; } catch (e) { skipped++; }
        }
        await loadList();
        alert(`Imported ${imported} rows, skipped ${skipped}`);
      }
    } catch (err) {
      setError(err?.message || err?.response?.data?.message || 'Import failed');
    } finally { setLoading(false); setPreviewRows([]); setPreviewHeaders([]); setLastImportFile(null); }
  };

  // Bulk helper: mark all employees present for the selected date
  const markAllPresent = async () => {
    setLoading(true); setError('');
    try {
      // use preloaded HR list if available
      const employees = Array.isArray(hrList) && hrList.length > 0 ? hrList : (await api.get('/hr')).data;
      if (!Array.isArray(employees) || employees.length === 0) {
        setError('No HR records found');
        return;
      }
      const tasks = employees.map(emp => {
        const sid = emp.staffId || emp.cardNumber || emp.cardNo || emp.no || emp._id;
        if (!sid) return Promise.resolve({ status: 'skipped' });
        const payload = { staffId: sid, date, status: 'present', notes: 'bulk-mark', service: emp.Department_Kh || emp.department || emp.service };
        return api.post('/attendance', payload).then(() => ({ status: 'ok', sid })).catch(err => ({ status: 'err', sid, code: err?.response?.status }));
      });
      const results = await Promise.all(tasks.map(p => p.catch(e => e)));
      const created = results.filter(r => r && r.status === 'ok').length;
      const skipped = results.filter(r => r && r.status === 'skipped').length;
      const errors = results.filter(r => r && r.status === 'err');
      await loadList();
      if (errors.length > 0) setError(`${created} created, ${errors.length} errors`);
      else setError(`${created} attendance records created${skipped ? `, ${skipped} skipped` : ''}`);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Bulk mark failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h3 className="text-2xl font-semibold">វត្តមាន</h3>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input ref={scanInputRef} value={scanValue} onChange={e => setScanValue(e.target.value)} placeholder="Scan staffId" className="border rounded px-2 py-1" style={{width:130}} />
          <button onClick={() => handleScan(scanValue)} className="bg-teal-600 text-white px-3 py-2 rounded">Scan</button>
          
          <button 
            onClick={handleAutoSyncCheckinme}
            disabled={autoSyncing}
            className="group relative flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded shadow-md transition-all active:scale-95 disabled:grayscale disabled:cursor-not-allowed"
          >
            {autoSyncing ? <RefreshCcw size={18} className="animate-spin" /> : <Zap size={18} className="fill-white group-hover:scale-110 transition-transform" /> }
            <span className="font-bold text-sm whitespace-nowrap">{autoSyncing ? 'កំពុង Sync...' : 'Auto Sync (Backend)'}</span>
          </button>

          <button onClick={() => addSample()} className="bg-blue-600 text-white px-3 py-2 rounded whitespace-nowrap">បន្ថែមវត្តមាន</button>
          
          <label className="bg-blue-700 text-white px-3 py-2 rounded cursor-pointer whitespace-nowrap" style={{display:'inline-block'}}>
            នាំចូល
            <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>{ const f = e.target.files && e.target.files[0]; setLastImportFile(f); importAttendance(f); }} />
          </label>
          <button onClick={exportAttendance} className="bg-green-600 text-white px-3 py-2 rounded whitespace-nowrap">នាំចេញ</button>
        </div>
      </div>

      {/* Filters grid */}
      <div style={{border:'1px solid #e5e7eb', padding:12, borderRadius:6, marginBottom:12}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12, alignItems:'end'}}>
          <div>
            <label className="text-sm block">ពីថ្ងៃ</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="text-sm block">ដល់ថ្ងៃ</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="text-sm block">យឺត</label>
            <select value={filterLate} onChange={e => setFilterLate(e.target.value)} className="border rounded px-2 py-1 w-full">
              <option value="">-- ទាំងអស់ --</option>
              <option value="yes">យឺត</option>
            </select>
          </div>
          <div>
            <label className="text-sm block">ចេញមុន</label>
            <select value={filterEarly} onChange={e => setFilterEarly(e.target.value)} className="border rounded px-2 py-1 w-full">
              <option value="">-- ទាំងអស់ --</option>
              <option value="yes">ចេញមុន</option>
            </select>
          </div>

          <div>
            <label className="text-sm block">បុគ្គលិក (ID)</label>
            <input type="text" value={searchStaffId} onChange={e => setSearchStaffId(e.target.value)} placeholder="ស្វែងរកតាម ID" className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="text-sm block">សេវាកម្ម</label>
            <select className="border rounded px-2 py-1 w-full"><option>--</option></select>
          </div>
          <div>
            <label className="text-sm block">ប្រភេទបុគ្គលិក</label>
            <select className="border rounded px-2 py-1 w-full"><option>--</option></select>
          </div>
          <div>
            <label className="text-sm block">ស្វែងរក (ឈ្មោះ/ID)</label>
            <div style={{display:'flex'}}>
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadList()} placeholder="ស្វែងរកឈ្មោះ..." className="border rounded-l px-2 py-1 w-full" />
              <button onClick={loadList} className="border rounded-r px-3 bg-blue-50 hover:bg-blue-100 transition-colors">🔍</button>
            </div>
          </div>
        </div>

        <div style={{marginTop:12, display:'flex', gap:8, alignItems:'center'}}>
          <label className="text-sm font-medium text-gray-700">Show/Page</label>
          <select className="border rounded px-2 py-1 text-sm">
            <option>10 records</option>
            <option>25 records</option>
            <option>50 records</option>
          </select>
        </div>
          {/* Import preview modal */}
          {importPreviewOpen && (
            <div style={{position:'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <div style={{width:'70%', maxHeight:'80%', background:'#fff', borderRadius:6, overflow:'auto', padding:16}}>
                <h3>Import preview ({previewRows.length} rows)</h3>

                {/* Sticky header controls: radio options on left, Auto-map on right */}
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:10, position:'sticky', top:0, background:'#fff', zIndex:2, paddingTop:8, paddingBottom:8}}>
                  <div style={{display:'flex', gap:12, alignItems:'center'}}>
                    <label style={{display:'flex', alignItems:'center', gap:6}}>
                      <input type="radio" name="importMode" checked={importMode==='file'} onChange={()=>setImportMode('file')} /> Upload original file (server-side)
                    </label>
                    <label style={{display:'flex', alignItems:'center', gap:6}}>
                      <input type="radio" name="importMode" checked={importMode==='mapped'} onChange={()=>setImportMode('mapped')} /> Import mapped preview rows (client-side)
                    </label>
                  </div>

                  <div style={{display:'flex', alignItems:'center', gap:12}}>
                    {/* show hint when user selected server-side upload but no file chosen */}
                    {importMode === 'file' && !lastImportFile && (
                      <span style={{color:'#b91c1c', fontSize:13}}>No file selected — please choose a file to upload</span>
                    )}
                    <button onClick={() => {
                        // quick auto-map heuristic
                        const headers = previewHeaders || [];
                        const norm = h => String(h||'').toLowerCase();
                        const pick = (cands) => headers.find(h => cands.some(c => norm(String(h||'')).includes(c)));
                        const m = {
                          staffId: pick(['staff id','staffid','លេខកាត','card','card no','cardnumber','no']),
                          name: pick(['name','ឈ្មោះ','គោត្តនាម','នាម','full name']),
                          checkIn: pick(['check in','checkin','ចូល','time in','check in 1','check in 08']),
                          checkOut: pick(['check out','checkout','ចេញ','time out']),
                          checkIn2: pick(['checkin-2','checkin 2','check in 2','ចូល២','ចូល ២']),
                          checkOut2: pick(['checkout-2','checkout 2','check out 2','ចេញ២','ចេញ ២']),
                          status1: pick(['status','ស្ថានភាព','status1']),
                          status2: pick(['status2','ស្ថានភាព២']),
                          service: pick(['service','dept','department','ផ្នែក','សេវាកម្ម']),
                          note: pick(['note','notes','សំគាល់','កំណត់សម្គាល់','comment'])
                        };
                        setFieldMap(m);
                        setImportMode('mapped');
                      }} className="border px-2 py-1 rounded">Auto-map</button>
                  </div>
                </div>

                {importMode === 'mapped' && (
                  <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:10}}>
                    {['staffId','name','checkIn','checkOut','checkIn2','checkOut2','status1','status2','note'].map((f) => (
                      <div key={f} style={{display:'flex', flexDirection:'column', minWidth:140}}>
                        <label style={{fontSize:12, color:'#444'}}>{f}</label>
                        <select value={fieldMap[f] || ''} onChange={e => setFieldMap({...fieldMap, [f]: e.target.value})}>
                          <option value="">-- unmapped --</option>
                          {previewHeaders.map((h,hi)=> (<option key={hi} value={h}>{h}</option>))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                      <tr>{previewHeaders.map((h,i)=>(<th key={i} style={{border:'1px solid #ddd', padding:6}}>{h}</th>))}</tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r,ri)=>(
                        <tr key={ri}>{previewHeaders.map((h,ci)=>(<td key={ci} style={{border:'1px solid #eee', padding:6}}>{String(r[h]||'')}</td>))}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
                  <button onClick={()=>{ setImportPreviewOpen(false); setPreviewRows([]); setPreviewHeaders([]); }} className="border px-3 py-1">Cancel</button>
                  {/* disable Confirm when server-side selected but no file was provided */}
                  <button onClick={confirmImport} disabled={importMode==='file' && !lastImportFile} className={`px-3 py-1 rounded ${importMode==='file' && !lastImportFile ? 'bg-gray-300 text-gray-600' : 'bg-green-600 text-white'}`}>Confirm Import</button>
                </div>
              </div>
            </div>
          )}
      {/* Edit modal */}
      <AttendanceEditModal open={editOpen} onClose={() => { setEditOpen(false); setEditRecord(null); }} record={editRecord} onSave={handleSaveEdit} />

      </div>

      {/* Table Container with Horizontal Scroll */}
      <div style={{background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', tableLayout: 'fixed', fontSize: 13}}>
          <colgroup>
            <col style={{width: '45px'}} />
            <col style={{width: '90px'}} />
            <col style={{width: '180px'}} />
            <col style={{width: '160px'}} />
            <col style={{width: '160px'}} />
            <col style={{width: '160px'}} />
            <col style={{width: '70px'}} />
            <col style={{width: '200px'}} />
            <col style={{width: '180px'}} />
            <col style={{width: '120px'}} />
          </colgroup>
          <thead style={{background:'#f8fafc'}}>
            <tr style={{height: 48, backgroundColor: '#fdfdfd'}}>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>#</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'left'}}>Staff ID</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Employees</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Check-in</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Check-out</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Check-in-2</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Check-out-2</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Note</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Dept_Kh</th>
              <th style={{border:'1px solid #cbd5e1', padding:8, textAlign: 'center'}}>Action</th>
            </tr>
          </thead>
          <tbody>
            {(list||[]).map((r, i) => {
              const isLate = r.isLate;
              const leftEarly = r.leftEarly;
              const rowBg = isLate ? '#fff7ed' : (leftEarly ? '#fff1f2' : (i%2===0 ? '#fff' : '#f8fafc'));
              const hr = hrLookup[r.staffId] || hrLookup[r.cardNumber] || hrLookup[r.cardNo] || hrLookup[r.no] || hrLookup[r._id] || null;
              const card = hr ? (hr.cardNumber || hr.cardNo || hr.staffId || hr._id) : (r.staffId || r.cardNumber || r.cardNo || r.no || r._id || '');
              const name = hr ? (hr.khmerName || hr.khName || hr.kh_fullname || hr.fullName || hr.name) : (r.khmerName || r.khName || (r.lastName || r.familyName ? `${r.lastName || r.familyName}${(r.firstName || r.givenName) ? ' ' + (r.firstName || r.givenName) : ''}` : (r.staffName || r.name || r.fullName || r.staffId || '')));

              const notes = r.notes || '';
              const extractStatus = (key) => {
                const m = String(notes).match(new RegExp(`${key}:(.*?)((\||$))`, 'i'));
                return m ? m[1].trim() : '';
              };
              const s1 = extractStatus('status1') || (r.status || '');
              
              const formatTime = (iso) => {
                if (!iso) return null;
                const d = new Date(iso);
                if (isNaN(d.getTime())) return { date: '', time: iso, status: '' };
                const datePart = d.toISOString().slice(0, 10);
                const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                return { date: datePart, time: timePart };
              };

              const renderTimeCell = (iso, schedTime, statusStr) => {
                const f = formatTime(iso);
                if (!f) return <td style={{border:'1px solid #e2e8f0', padding:4, textAlign:'center'}}>-</td>;
                
                let displayStatus = statusStr || '';
                if (displayStatus.toLowerCase() === 'present') displayStatus = 'Good';
                if (displayStatus.toLowerCase() === 'late') displayStatus = 'Late';

                return (
                  <td style={{border:'1px solid #e2e8f0', padding:'4px 8px', fontSize: 11, verticalAlign: 'top'}}>
                    <div style={{fontWeight: 500, color: '#1e293b'}}>
                      {f.date} {f.time} - <span style={{color: displayStatus === 'Late' ? '#ef4444' : '#10b981'}}>{displayStatus}</span>
                    </div>
                  </td>
                );
              };

              return (
                <tr key={r._id || i} style={{background: rowBg, height: 44, borderBottom: '1px solid #f1f5f9'}} className="hover:bg-blue-50/30 transition-colors">
                  <td style={{border:'1px solid #e2e8f0', padding:8, textAlign:'center', color: '#64748b'}}>{i+1}</td>
                  <td style={{border:'1px solid #e2e8f0', padding:8, color: '#1e293b', fontWeight: 500}}>{r.staffId || ''}</td>
                  <td style={{border:'1px solid #e2e8f0', padding:8, fontWeight: 500, color: '#1e293b'}}>{name}</td>
                  {renderTimeCell(r.checkIn, r.scheduledStart || '07:30', r.checkIn ? r.status : '')}
                  {renderTimeCell(r.checkOut, r.scheduledEnd || '15:30', r.checkOut ? 'Good' : '')}
                  {renderTimeCell(r.checkIn2, r.scheduledStart2, '')}
                  <td style={{border:'1px solid #e2e8f0', padding:8, textAlign:'center', color: '#64748b'}}></td>
                  <td style={{border:'1px solid #e2e8f0', padding:8, color: '#64748b', fontSize: 11}}>{notes}</td>
                  <td style={{border:'1px solid #e2e8f0', padding:8, color: '#475569', fontSize: 11}}>{r.departmentKh || hr?.Department_Kh || ''}</td>
                  <td style={{border:'1px solid #e2e8f0', padding:8, textAlign:'center'}}>
                    <div className="flex justify-center gap-1">
                      <button className="bg-sky-500 hover:bg-sky-600 text-white p-1.5 rounded transition-colors" title="Chat" onClick={() => handleChat(r)}><RefreshCcw size={14} /></button>
                      <button className="bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded transition-colors" title="Edit" onClick={() => handleEdit(r)}><Zap size={14} /></button>
                      <button className="bg-rose-500 hover:bg-rose-600 text-white p-1.5 rounded transition-colors" title="Delete" onClick={() => handleDelete(r)}><Zap size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(!list || list.length === 0) && (
              <tr><td colSpan={10} style={{padding:32, textAlign:'center', color: '#94a3b8'}}>មិនមានទិន្នន័យសម្រាប់ថ្ងៃនេះទេ</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
