import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Edit2 } from 'lucide-react';
import api from '../services/api';
import HRAPI from '../services/hrAPI';
import headerBg from '../assets/3.JPG';
import usePermission from '../hooks/usePermission';
import { useLocation } from 'react-router-dom';

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function fmtKhmerLongDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const dd = toKhmerDigits(String(dt.getDate()));
  const mmName = khMonths[dt.getMonth()];
  const yyyy = toKhmerDigits(dt.getFullYear());
  return `ថ្ងៃទី ${dd} ខែ ${mmName} ឆ្នាំ ${yyyy}`;
}

function fmtShortDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
    return String(d);
  } catch {
    return String(d);
  }
}

function parseDateSafe(v) {
  if (!v) return null;
  try {
    const s = String(v).trim();
    // Handle DD/MM/YYYY or DD-MM-YYYY
    const parts = s.split(/[\/\-]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      if (y > 1000 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        return new Date(y, m, d);
      }
    }
    const dt = new Date(v);
    if (Number.isNaN(dt.getTime())) return null;
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  } catch {
    return null;
  }
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

export default function NewEmployeesThisMonthPage() {
  const perms = usePermission();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlFilter = searchParams.get('filter');

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const printRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [editProbationEnd, setEditProbationEnd] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/hr', { params: {} });
        if (!mounted) return;
        setAll(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const departments = useMemo(() => {
    const set = new Set();
    (all || []).forEach((h) => {
      const name = (h.Department_Kh || h.department || '').toString().trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'km'));
  }, [all]);

  const derived = useMemo(() => {
    if (!Array.isArray(all)) return { rows: [], total: 0, male: 0, female: 0 };

    let start = null;
    let end = null;
    if (month && month.length >= 7) {
      const [yStr, mStr] = month.split('-');
      const y = Number.parseInt(yStr, 10);
      const m = Number.parseInt(mStr, 10) - 1; // 0-11
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 0 && m <= 11) {
        start = new Date(y, m, 1);
        end = new Date(y, m + 1, 1);
      }
    }

    const qTrim = (q || '').toString().trim().toLowerCase();

    const rows = (all || []).filter((h) => {
      try {
        if (h.status === 'Deleted') return false;

        const matchesQuery = !qTrim || [
          h.staffId,
          h.cardNumber,
          h.cardNo,
          h.no,
          h.khmerName,
          h.name,
          h.Department_Kh,
          h.department,
          h.position,
        ].some((x) => (x || '').toString().toLowerCase().includes(qTrim));

        if (qTrim) {
          // If searching, ignore the month/date filter to allow finding any employee
          if (!matchesQuery) return false;
        } else if (urlFilter === 'probation') {
          // If linked from dashboard probation card, show only those with active/upcoming probation
          const jd = parseDateSafe(h.joinDate || h.nominationStartDate || h.contractStartDate || h.nomination_start_date || h.contract_start_date || h.civilServantStartDate || h.dateJoinedMinistry || h.contractDate || h.contract_date || h.retiredDate || h.retirementDate);
          const pEnd = parseDateSafe(h.probationEndDate || h.probationEnd) || (jd ? new Date(jd.getFullYear(), jd.getMonth() + 3, jd.getDate()) : null);
          if (!pEnd) return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((pEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          // Show only those who haven't completed probation or completed very recently
          if (diffDays <= -30) return false;
        } else {
          // If not searching, stick to the selected month's filter
          const jd = parseDateSafe(h.joinDate || h.nominationStartDate || h.contractStartDate || h.nomination_start_date || h.contract_start_date || h.civilServantStartDate || h.dateJoinedMinistry || h.contractDate || h.contract_date || h.retiredDate || h.retirementDate);
          if (!jd || !start || !end) return false;
          if (!(jd.getTime() >= start.getTime() && jd.getTime() < end.getTime())) return false;
        }

        if (dept) {
          const dName = (h.Department_Kh || h.department || '').toString().trim();
          if (dName !== dept) return false;
        }

        return true;
      } catch {
        return false;
      }
    });

    const male = rows.filter((r) => r.gender === 'Male').length;
    const female = rows.filter((r) => r.gender === 'Female').length;

    return { rows, total: rows.length, male, female };
  }, [all, month, dept, q]);
  const getProbationEnd = (h) => {
    const stored = parseDateSafe(h && (h.probationEndDate || h.probationEnd));
    if (stored) return stored;
    const jd = parseDateSafe(h && h.joinDate);
    if (!jd) return null;
    const end = new Date(jd);
    end.setMonth(end.getMonth() + 3);
    end.setHours(0, 0, 0, 0);
    return end;
  };

  const getProbationStatus = (h) => {
    const end = getProbationEnd(h);
    if (!end) return '';
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - todayLocal.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(days)) return '';
    if (days <= 0) return 'បញ្ចប់សាកល្បង';
    if (days < 10) return 'ជិតចប់សាកល្បង';
    return 'កំពុងសាកល្បង';
  };

  const getRemainingDays = (h) => {
    const end = getProbationEnd(h);
    if (!end) return '';
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const diffMs = end.getTime() - todayLocal.getTime();
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (!Number.isFinite(days) || days <= 0) return '0';
    return toKhmerDigits(days);
  };

  const openEdit = (row) => {
    if (!row) return;
    setEditing(row);
    const end = getProbationEnd(row);
    setEditProbationEnd(end ? end.toISOString().slice(0, 10) : '');
  };

  const applyDuration = (amount, unit) => {
    if (!editing) return;
    const raw = editing.joinDate || editing.nominationStartDate || editing.contractStartDate || editing.nomination_start_date || editing.contract_start_date || editing.civilServantStartDate || editing.dateJoinedMinistry || editing.contractDate || editing.contract_date || editing.retiredDate || editing.retirementDate;
    const jd = parseDateSafe(raw);
    if (!jd) return;
    const end = new Date(jd);
    const amt = parseInt(amount, 10);
    if (isNaN(amt)) return;

    if (unit === 'days') end.setDate(end.getDate() + amt);
    else if (unit === 'months') end.setMonth(end.getMonth() + amt);
    else if (unit === 'years') end.setFullYear(end.getFullYear() + amt);

    setEditProbationEnd(end.toISOString().slice(0, 10));
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing._id) return;
    setSaving(true);
    try {
      const payload = {
        probationEndDate: editProbationEnd || null,
      };
      const { data } = await HRAPI.update(editing._id, payload);
      setAll((prev) => (Array.isArray(prev) ? prev.map((h) => (h._id === data._id ? data : h)) : prev));
      setEditing(null);
    } catch (e) {
      window.alert(e?.response?.data?.error || e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSetGroupClosingDate = async (rows, selectedDate) => {
    if (!rows || rows.length === 0 || !selectedDate) return;
    const confirm = window.confirm(`តើលោកអ្នកចង់កំណត់ថ្ងៃបិទរបាយការណ៍មន្ត្រីថ្មីទាំង ${toKhmerDigits(rows.length)} នាក់ ជាថ្ងៃទី ${fmtShortDate(selectedDate)} មែនទេ?`);
    if (!confirm) return;

    try {
      setSaving(true);
      // Update local state first for immediate UI feedback
      setAll(prev => prev.map(h => {
        const match = rows.find(r => r._id === h._id);
        if (match) {
          return { ...h, entryClosingDate: selectedDate };
        }
        return h;
      }));

      // Update backend in parallel
      const promises = rows.map(r => HRAPI.update(r._id, { entryClosingDate: selectedDate }));
      await Promise.all(promises);
    } catch (err) {
      window.alert('ការរក្សាទុកមានបញ្ហា: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const PRINT_STYLES = `
      <style>
        @page { size: A4; margin: 12mm; }
        body { font-family: "Khmer OS Siemreap", "Noto Serif Khmer", serif; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 2px 4px; }
        th { text-align: center; }
      </style>
    `;
    const w = window.open('', '_blank', 'width=1024,height=768');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charSet="utf-8"/>${PRINT_STYLES}</head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const handleExportExcel = () => {
    const rows = derived.rows || [];
    if (!rows.length) return;
    const header = [
      'ល.រ',
      'លេខកាត',
      'គោត្តនាម និងនាម',
      'ភេទ',
      'តួនាទី',
      'ផ្នែក',
      'ថ្ងៃចូលបម្រើការ',
      'សាកល្បងដល់ថ្ងៃ',
      'ស្ថានភាពសាកល្បង',
    ];
    const data = rows.map((h, idx) => ([
      idx + 1,
      h.staffId || h.cardNumber || h.cardNo || h.no || '',
      h.khmerName || h.name || '',
      h.gender === 'Male' ? 'ប' : h.gender === 'Female' ? 'ស' : '',
      h.position || h.role || h.title || '',
      h.Department_Kh || h.department || '',
      h.joinDate ? fmtShortDate(h.joinDate) : '',
      (() => {
        const end = getProbationEnd(h);
        return end ? fmtShortDate(end) : '';
      })(),
      getRemainingDays(h),
      getProbationStatus(h),
    ]));

    const summary = [[
      `សរុបបុគ្គលិកថ្មីខែនេះ: ${derived.total} នាក់ ( ប្រុស: ${derived.male} — ស្រី: ${derived.female} )`,
    ]];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, [], ...summary]);
    ws['!cols'] = [
      { wch: 5 },  // ល.រ
      { wch: 12 }, // លេខកាត
      { wch: 30 }, // គោត្តនាម និងនាម
      { wch: 6 },  // ភេទ
      { wch: 20 }, // តួនាទី
      { wch: 24 }, // ផ្នែក
      { wch: 14 }, // ថ្ងៃចូលបម្រើការ
      { wch: 16 }, // សាកល្បងដល់ថ្ងៃ
      { wch: 14 }, // ចំនួនថ្ងៃនៅសល់
      { wch: 20 }, // ស្ថានភាពសាកល្បង
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'New_Employees');
    XLSX.writeFile(wb, 'New_Employees_This_Month.xlsx');
  };

  const today = new Date();
  const headingMonth = (() => {
    try {
      if (!month || month.length < 7) return '';
      const [y, m] = month.split('-');
      const dt = new Date(Number.parseInt(y, 10), Number.parseInt(m, 10) - 1, 1);
      return fmtKhmerLongDate(dt).replace(/^ថ្ងៃទី \d+ /, 'ខែ ');
    } catch {
      return '';
    }
  })();

  const isMonthClosed = derived.rows.length > 0 && derived.rows.every(r => r.entryClosingDate);
  const isAdminOrEditor = perms.isAdmin || perms.canEditNewEmployeesThisMonthReport;
  const pickerValue = fmtDateInput(derived.rows.find(r => r.entryClosingDate)?.entryClosingDate || footerDate);

  return (
    <div className="p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">បុគ្គលិកថ្មីខែនេះ</h1>
          <p className="text-sm text-gray-600">បញ្ជីបុគ្គលិកដែលចូលបម្រើការងារថ្មី ក្នុងខែដែលបានជ្រើស</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <span>ខែរបាយការណ៍</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          </label>
          <label className="flex items-center gap-1">
            <span>ផ្នែក</span>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className="border rounded px-2 py-1 text-sm min-w-[120px]">
              <option value="">— ទាំងអស់ —</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ស្វែងរក ឈ្មោះ / លេខកាត / ផ្នែក"
            className="border rounded px-2 py-1 text-sm min-w-[220px]"
          />
          <button type="button" onClick={handleExportExcel} className="border px-2 py-1 rounded bg-emerald-600 text-white text-sm">Excel</button>
          <button type="button" onClick={handlePrint} className="border px-2 py-1 rounded bg-blue-600 text-white text-sm">បោះពុម្ព</button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div ref={printRef} className="bg-white p-4 border rounded mt-1">
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '16px' }}>ព្រះរាជាណាចក្រកម្ពុជា</div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '14px' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          <div style={{ position: 'relative', textAlign: 'left', padding: '6px 0' }}>
            <img
              src={headerBg}
              alt=""
              aria-hidden="true"
              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150px', height: 'auto', opacity: 0.88, pointerEvents: 'none' }}
            />
            <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12.5px', position: 'relative', zIndex: 1 }}>ក្រសួងសុខាភិបាល</div>
          </div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'left' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>
            បញ្ជីបុគ្គលិកថ្មីខែនេះ
          </div>
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', marginTop: '2px' }}>
            ថ្ងៃទី {toKhmerDigits(new Date(derived.rows.find(r => r.entryClosingDate)?.entryClosingDate || footerDate).getDate())} {headingMonth}
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 8,
          background: isMonthClosed ? '#f0fdf4' : 'transparent',
          padding: isMonthClosed ? '4px 10px' : '0',
          borderRadius: '6px',
          border: isMonthClosed ? '1px solid #bbf7d0' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-sm">
              សរុបបុគ្គលិកថ្មីខែនេះ: <strong>{toKhmerDigits(derived.total)}</strong> នាក់ ( ប្រុស: <strong>{toKhmerDigits(derived.male)}</strong> — ស្រី: <strong>{toKhmerDigits(derived.female)}</strong> )
            </span>
            {isMonthClosed && (
              <span style={{ fontSize: '10px', background: '#22c55e', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
                ✓ បានបិទរបាយការណ៍
              </span>
            )}
          </div>
          {isAdminOrEditor && (
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 6, background: isMonthClosed ? '#dcfce7' : '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: isMonthClosed ? '1px solid #86efac' : '1px solid #dbeafe' }}>
              <span style={{ fontSize: '10px', color: isMonthClosed ? '#166534' : '#1e40af' }}>{isMonthClosed ? 'ប្តូរថ្ងៃបិទ:' : 'កំណត់ថ្ងៃបិទ:'}</span>
              <input 
                type="date"
                value={pickerValue}
                onChange={(e) => handleSetGroupClosingDate(derived.rows, e.target.value)}
                style={{ fontSize: '10px', padding: '0 4px', border: '1px solid #bfdbfe', borderRadius: '2px' }}
              />
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-1 py-1 text-center">ល.រ</th>
                <th className="border px-1 py-1 text-center">លេខកាត</th>
                <th className="border px-1 py-1 text-center">គោត្តនាម និងនាម</th>
                <th className="border px-1 py-1 text-center">ភេទ</th>
                <th className="border px-1 py-1 text-center">តួនាទី</th>
                <th className="border px-1 py-1 text-center">ផ្នែក</th>
                <th className="border px-1 py-1 text-center">ថ្ងៃចូលបម្រើការ</th>
                <th className="border px-1 py-1 text-center">សាកល្បងដល់ថ្ងៃ</th>
                <th className="border px-1 py-1 text-center">ចំនួនថ្ងៃនៅសល់</th>
                <th className="border px-1 py-1 text-center">ស្ថានភាពសាកល្បង</th>
                {(perms.isAdmin || perms.canEditNewEmployeesThisMonthReport) && <th className="border px-1 py-1 text-center">កែ</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="border px-2 py-4 text-center text-gray-500 text-sm">
                    កំពុងទាញទិន្នន័យ...
                  </td>
                </tr>
              ) : derived.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border px-2 py-4 text-center text-gray-500 text-sm">
                    មិនមានទិន្នន័យ
                  </td>
                </tr>
              ) : (
                derived.rows.map((h, idx) => (
                  <tr
                    key={h._id || idx}
                    className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50 cursor-pointer' : 'bg-gray-50 hover:bg-blue-50 cursor-pointer'}
                    style={isMonthClosed ? { background: '#cccad4' } : {}}
                    onClick={() => openEdit(h)}
                  >
                    <td className="border px-1 py-1 text-right">{toKhmerDigits(idx + 1)}</td>
                    <td className="border px-1 py-1 text-center">{h.staffId || h.cardNumber || h.cardNo || h.no || ''}</td>
                    <td className="border px-1 py-1">{h.khmerName || h.name || ''}</td>
                    <td className="border px-1 py-1 text-center">{h.gender === 'Male' ? 'ប' : h.gender === 'Female' ? 'ស' : ''}</td>
                    <td className="border px-1 py-1">{h.position || h.role || h.title || ''}</td>
                    <td className="border px-1 py-1">{h.Department_Kh || h.department || ''}</td>
                    <td className="border px-1 py-1 text-center">{h.joinDate ? fmtShortDate(h.joinDate) : ''}</td>
                    <td className="border px-1 py-1 text-center">{(() => { const end = getProbationEnd(h); return end ? fmtShortDate(end) : ''; })()}</td>
                    <td className="border px-1 py-1 text-center">{getRemainingDays(h)}</td>
                    <td className="border px-1 py-1 text-center">
                      {(() => {
                        const s = getProbationStatus(h);
                        const base = 'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium';
                        if (s === 'កំពុងសាកល្បង') {
                          return <span className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-300`}>{s}</span>;
                        }
                        if (s === 'ជិតចប់សាកល្បង') {
                          return <span className={`${base} bg-orange-100 text-orange-800 border border-orange-300`}>{s}</span>;
                        }
                        if (s === 'បញ្ចប់សាកល្បង') {
                          return <span className={`${base} bg-emerald-100 text-emerald-800 border border-emerald-300`}>{s}</span>;
                        }
                        return <span className={`${base} bg-gray-100 text-gray-700 border border-gray-300`}>{s || '—'}</span>;
                      })()}
                    </td>
                    {(perms.isAdmin || perms.canEditNewEmployeesThisMonthReport) && <td className="border px-1 py-1 text-center">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-1 rounded hover:bg-blue-50 text-blue-600"
                        onClick={() => openEdit(h)}
                        title="កែស្ថានភាពសាកល្បង"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg p-4 w-full max-w-md space-y-3">
              <h2 className="text-lg font-semibold mb-1">កែទិន្នន័យសាកល្បង</h2>
              <div className="text-sm text-gray-700">
                <div><strong>លេខកាត:</strong> {editing.staffId || editing.cardNumber || editing.cardNo || editing.no}</div>
                <div><strong>ឈ្មោះ:</strong> {editing.khmerName || editing.name}</div>
              </div>
              <div className="space-y-2 text-sm">
                <label className="block">
                  <span className="block mb-1">សាកល្បងដល់ថ្ងៃ</span>
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => applyDuration(3, 'months')} className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 border rounded">៣ ខែ</button>
                    <button type="button" onClick={() => applyDuration(6, 'months')} className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 border rounded">៦ ខែ</button>
                    <button type="button" onClick={() => applyDuration(1, 'years')} className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 border rounded">១ ឆ្នាំ</button>
                  </div>
                  <div className="flex gap-2 items-center mb-3">
                    <input
                      type="number"
                      placeholder="ចំនួន"
                      className="w-20 border rounded px-2 py-1 text-sm"
                      onChange={(e) => {
                        const val = e.target.value;
                        const unit = document.getElementById('durationUnit')?.value || 'months';
                        if (val) applyDuration(val, unit);
                      }}
                    />
                    <select
                      id="durationUnit"
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      onChange={(e) => {
                        const amt = e.target.previousSibling.value;
                        if (amt) applyDuration(amt, e.target.value);
                      }}
                    >
                      <option value="days">ថ្ងៃ</option>
                      <option value="months">ខែ</option>
                      <option value="years">ឆ្នាំ</option>
                    </select>
                  </div>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full font-bold text-blue-600 bg-blue-50"
                    value={editProbationEnd}
                    onChange={(e) => setEditProbationEnd(e.target.value)}
                  />
                </label>
                <div className="block">
                  <span className="block mb-1">ស្ថានភាពសាកល្បង</span>
                  <div className="border rounded px-2 py-1 bg-gray-50">
                    {getProbationStatus(editing)}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 text-sm">
                <button
                  type="button"
                  className="px-3 py-1 rounded border"
                  onClick={() => !saving && setEditing(null)}
                  disabled={saving}
                >
                  បិទ
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុក'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-xs">
          <div className="flex justify-between">
            <div>
              <div>ធ្វើនៅ៖ មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
              <div>
                ថ្ងៃទីបោះពុម្ព៖ {fmtKhmerLongDate(footerDate)}
              </div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '200px' }}>
              <div>អនុញ្ញាតិដោយ</div>
              <div style={{ height: '48px' }} />
              <div>នាយកមន្ទីរពេទ្យ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
