import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function fmtDateSlash(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

export default function PromotionByRotationReportPage() {
  const perms = usePermission();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(''); // optional filter
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const printRef = useRef();
  const [excluded, setExcluded] = useState(new Set());
  // allow unlimited excludes by default; earlier implementation limited to 2/3.
  const maxExcluded = Infinity;
  const AUTO_PROMO_DATE = '2025-04-13'; // ISO date used for auto replacement
  const [searchQuery, setSearchQuery] = useState('');

  const isExcluded = (hr) => {
    const id = hr._id || hr.staffId || hr.no || '';
    return excluded.has(id);
  };

  const toggleExclude = (hr) => {
    const id = hr._id || hr.staffId || hr.no || '';
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Promotion mapping: explicit next-level mapping based on the provided template.
  // If a level exists in this map, use the mapped next level. Otherwise fall back to the
  // heuristic parser that attempts a reasonable change.
  const PROMOTION_MAP = useMemo(() => {
    const map = {};
    // Build a reverse mapping so that pressing "កែ" moves from a higher rung to the previous one
    // e.g. ក.១.២ -> ក.១.១
    const ka = ['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦', 'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤', 'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'];
    for (let i = 1; i < ka.length; i++) map[ka[i]] = ka[i - 1];
    const kha = ['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'];
    for (let i = 1; i < kha.length; i++) map[kha[i]] = kha[i - 1];
    const ko = ['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'];
    for (let i = 1; i < ko.length; i++) map[ko[i]] = ko[i - 1];
    return map;
  }, []);

  function khToArabic(str) {
    return String(str).replace(/[០១២៣៤៥៦៧៨៩]/g, d => '0123456789'['០១២៣៤៥៦៧៨៩'.indexOf(d)]);
  }

  function promoteLevelAuto(level) {
    if (!level) return '';
    const s = String(level).trim();
    // normalize Khmer digits so mapping keys match
    const normalized = khToArabic(s).replace(/\s+/g, '');
    // try direct map match first
    if (PROMOTION_MAP[s]) return PROMOTION_MAP[s];
    // attempt match against normalized keys (e.g., 'ក.១.២' -> 'ក.1.2')
    const mapKey = Object.keys(PROMOTION_MAP).find(k => khToArabic(k) === normalized);
    if (mapKey) return PROMOTION_MAP[mapKey];

    // fallback: decrement numeric components when possible
    const match = s.match(/^([កខគឃងចឆជឈញទដធណបពព្]?.?)\.?\s*([\d០១២៣៤៥៦៧៨៩]+)\.?\s*([\d០១២៣៤៥៦៧៨៩]+)?$/);
    if (match) {
      const prefix = match[1] || '';
      const a = match[2] || '';
      const b = match[3] || '';
      const toNum = (x) => Number(khToArabic(x) || x);
      if (b) {
        const bn = toNum(b);
        if (!isNaN(bn) && bn > 1) {
          return `${prefix}${a}.${bn - 1}`;
        }
      }
      const an = toNum(a);
      if (!isNaN(an) && an > 1) {
        return `${prefix}${an - 1}`;
      }
    }
    return level;
  }

  const getPromoDateFor = (hr) => {
    // if this row already has a salaryPromotionDate and we want to replace only when it's equal to
    // the default or always replace — here we replace for all rows unless excluded
    if (isExcluded(hr)) return hr.salaryPromotionDate || '';
    return AUTO_PROMO_DATE;
  };

  // Helpers to mark rows as excluded based on a search

  const selectMatchesByQuery = (q) => {
    if (!q || !q.trim()) return;
    const ql = q.trim().toLowerCase();
    const matches = (derived.rows || []).filter(hr => {
      return (hr.khmerName || '').toLowerCase().includes(ql) || (hr.name || '').toLowerCase().includes(ql) || (hr.staffId || hr.no || '').toLowerCase().includes(ql);
    }).map(hr => hr._id || hr.staffId || hr.no || '');
    setExcluded(prev => {
      const next = new Set(prev);
      matches.forEach(id => { if (id) next.add(id); });
      return next;
    });
  };

  const clearSelectedExcludes = () => setExcluded(new Set());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!perms.canViewHR) { setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const { data } = await api.get('/hr');
        if (!mounted) return;
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [perms.canViewHR]);

  const derived = useMemo(() => {
    const rows = (list || [])
      .filter(hr => (hr.salaryPromotionBy || '').trim() === 'វេនជ្រើសរើស' && hr.salaryPromotionDate)
      .filter(hr => {
        const dt = new Date(hr.salaryPromotionDate);
        if (isNaN(dt)) return false;
        if (Number(dt.getFullYear()) !== Number(year)) return false;
        if (month) return String(dt.getMonth() + 1).padStart(2, '0') === String(month).padStart(2, '0');
        return true;
      })
      .sort((a, b) => (a.no || 0) - (b.no || 0));
    const male = rows.filter(r => r.gender === 'Male').length;
    const female = rows.filter(r => r.gender === 'Female').length;
    return { rows, male, female, total: rows.length };
  }, [list, year, month]);

  const allRowIds = useMemo(() => (derived.rows || []).map(r => r._id || r.staffId || r.no || ''), [derived.rows]);
  const allSelected = useMemo(() => allRowIds.length > 0 && allRowIds.every(id => excluded.has(id)), [allRowIds, excluded]);

  const toggleSelectAll = () => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // clear all
        allRowIds.forEach(id => next.delete(id));
      } else {
        // select all
        allRowIds.forEach(id => { if (id) next.add(id); });
      }
      return next;
    });
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
  `;

  const handlePrint = () => {
    if (!lunarText.trim()) { window.alert('សូមបំពេញ "ចន្ទគតិ" មុនពេលបោះពុម្ព'); return; }
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const PRINT_STYLES = `
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        @media print { html, body { width: 297mm; height: 210mm; } }
        body { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h1,h2,h3 { margin: 0; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr, td, th { page-break-inside: avoid; }
        th, td { border: 1px solid #222; padding: 4px 6px; font-size: 12px; }
        th { background: #f3f4f6; }
        .center { text-align: center; }
      </style>
    `;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>${PRINT_STYLES}</head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const handleExportExcel = () => {
    const header = ['ល.រ', 'អត្តលេខមន្រ្តីរាជការ', 'គោត្តនាម-នាម', 'ភេទ', 'ថ្ងៃខែឆ្នាំកំណើត', 'មុខងារ', 'កាំប្រាក់', 'ប្រភេទឡើងកាំប្រាក់', 'ថ្ងៃខែឆ្នាំឡើងកាំប្រាក់'];
    const data = derived.rows.map((hr, idx) => ([
      idx + 1,
      hr.staffId || hr.no || '',
      hr.khmerName || hr.name || '',
      hr.gender === 'Male' ? 'ប' : hr.gender === 'Female' ? 'ស' : '',
      fmtDateSlash(hr.dob),
      hr.civilServantRole || hr.position || '',
      hr.salaryLevel || '',
      hr.salaryPromotionBy || '',
      fmtDateSlash(getPromoDateFor(hr))
    ]));
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 6 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Promo_${year}${month ? ('_' + month) : ''}`);
    XLSX.writeFile(wb, `Promotion_Rotation_${year}${month ? ('_' + month) : ''}.xlsx`);
  };

  if (!perms.canViewHR) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">របាយការណ៍ឡើងកាំប្រាក់តាមវេន</h2>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ​សិទ្ធិ: view:hr</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">របាយការណ៍ឡើងកាំប្រាក់តាមវេន</h2>
          <p className="text-sm text-gray-600">បោះពុម្ពតាមគំរូ</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-sm">ឆ្នាំ:</label>
          <input type="number" className="border rounded px-2 py-1 w-24" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} />
          <label className="text-sm">ខែ:</label>
          <select className="border rounded px-2 py-1" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">ទាំងអស់</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (<option key={m} value={m}>{m}</option>))}
          </select>
          <label className="text-sm">ចន្ទគតិ*:</label>
          <input type="text" className="border rounded px-2 py-1 w-72" placeholder="ឧ. ថ្ងៃសុក្រ ១៣កើត ខែភទ្របទ ឆ្នាំ..." value={lunarText} onChange={(e) => setLunarText(e.target.value)} />
          <label className="text-sm">ថ្ងៃខែឆ្នាំ:</label>
          <input type="date" className="border rounded px-2 py-1" value={footerDate} onChange={(e) => setFooterDate(e.target.value)} />
          {/* date-picker removed per request */}
          <input type="text" className="border rounded px-2 py-1 w-48" placeholder="ស្វែងរក ឈ្មោះ ឬ អត្តលេខ" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') selectMatchesByQuery(searchQuery); }} />
          <button className="border px-2 py-1 rounded bg-yellow-500 text-white" onClick={async () => {
            // bulk apply -- promote selected rows. In the UI a checked box marks the row as selected,
            // so we act on ids that ARE in the `excluded` set (i.e. the checked rows).
            const ids = allRowIds.filter(id => excluded.has(id));
            if (!ids.length) { window.alert('សូមជ្រើសមន្រ្តីយ៉ាងហោចណាស់មួយ (ចុចចុក) មុនចុច "កែ"'); return; }
            if (!window.confirm(`តើអ្នកប្រាកដថាចង់កែ ${ids.length} នាក់ដែលបានជ្រើស?`)) return;
            try {
              // compute promoted level + promo date for each and send PUT
              for (const id of ids) {
                const hr = derived.rows.find(r => (r._id || r.staffId || r.no || '') === id);
                if (!hr) continue;
                const promotedLevel = hr.salaryLevel ? promoteLevelAuto(hr.salaryLevel) : hr.salaryLevel;
                const payload = { salaryLevel: promotedLevel || hr.salaryLevel, salaryPromotionDate: getPromoDateFor(hr) };
                await api.put(`/hr/${id}`, payload);
              }
              // reload
              const { data } = await api.get('/hr');
              setList(Array.isArray(data) ? data : []);
              window.alert('ការកែប្រែបានសម្រេច');
            } catch (err) {
              console.error('Bulk promote error', err);
              window.alert('កើតបញ្ហា​ពេលកែប្រែ មើល Console សម្រាប់ពត៌មានលម្អិត');
            }
          }}>កែ</button>
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
            <img src={headerBg} alt="" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150px', height: 'auto', opacity: 88, pointerEvents: 'none' }} />
            <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12.5px', position: 'relative', zIndex: 1 }}>ក្រសួងសុខាភិបាល</div>
          </div>
          <div style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'left' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>បញ្ជីឈ្មោះមន្រ្តីរាជការឡើងកាំប្រាក់តាមវេន ឆ្នាំ {toKhmerDigits(year)} {(month ? (`ខែ ${toKhmerDigits(month)}`) : '')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '36px' }} className="center"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="select all" /></th>
              <th style={{ width: '35px' }}>ល.រ</th>
              <th style={{ width: '110px' }}>អត្តលេខមន្រ្តីរាជការ</th>
              <th>គោត្តនាម-នាម</th>
              <th style={{ width: '40px' }}>ភេទ</th>
              <th style={{ width: '110px' }}>ថ្ងៃខែឆ្នាំកំណើត</th>
              <th>មុខងារ</th>
              <th style={{ width: '70px' }}>កាំប្រាក់</th>
              <th style={{ width: '90px' }}>កាំប្រាក់ (ថ្មី)</th>
              <th style={{ width: '120px' }}>ប្រភេទឡើងកាំប្រាក់</th>
              <th style={{ width: '120px' }}>ថ្ងៃខែឆ្នាំឡើងកាំប្រាក់</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const rows = derived.rows;
              if (rows.length === 0) {
                return (
                  <tr>
                    <td colSpan={9} className="center text-gray-600">មិនមានទិន្នន័យ</td>
                  </tr>
                );
              }
              return rows.map((hr, idx) => {
                const id = hr._id || hr.staffId || hr.no || '';
                const replacedDate = getPromoDateFor(hr);
                const promotedLevel = hr.salaryLevel ? promoteLevelAuto(hr.salaryLevel) : '';
                // Debugging: if this specific staffId has unexpected mapping, print raw hr and computed value
                if ((hr.staffId || '').toString().toUpperCase() === 'S0932') {
                  try { console.debug('DEBUG S0932 hr raw:', hr, 'computed promotedLevel:', promotedLevel); } catch (e) { }
                }
                return (
                  <tr key={id || idx}>
                    <td className="center">
                      <input type="checkbox" checked={isExcluded(hr)} onChange={() => toggleExclude(hr)} />
                    </td>
                    <td className="center">{toKhmerDigits(idx + 1)}</td>
                    <td className="center">{hr.staffId || hr.no || ''}</td>
                    <td>{hr.khmerName || hr.name || ''}</td>
                    <td className="center">{hr.gender === 'Male' ? 'ប' : hr.gender === 'Female' ? 'ស' : ''}</td>
                    <td className="center">{fmtDateSlash(hr.dob)}</td>
                    <td>{hr.civilServantRole || hr.position || ''}</td>
                    <td className="center">{hr.salaryLevel || ''}</td>
                    <td className="center" style={{ color: promotedLevel && promotedLevel !== (hr.salaryLevel || '') ? '#0b74de' : 'inherit', fontWeight: promotedLevel && promotedLevel !== (hr.salaryLevel || '') ? 600 : 'normal' }}>{promotedLevel || ''}</td>
                    <td className="center">{hr.salaryPromotionBy || ''}</td>
                    <td className="center">{fmtDateSlash(replacedDate)}</td>
                  </tr>
                )
              });
            })()}
          </tbody>
        </table>

        {/* Summary & signature */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '12px' }}>
          <div style={{ width: '33%' }}>
            <div>
              សរុប: {toKhmerDigits(derived.total)} នាក់ ( ប្រុស: {toKhmerDigits(derived.male)} នាក់ — ស្រី: {toKhmerDigits(derived.female)} នាក់ )
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
              {lunarText && lunarText.trim() ? lunarText : ''}
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
