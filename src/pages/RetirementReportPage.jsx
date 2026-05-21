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

function khWeekday(d) {
  const names = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
  const dt = new Date(d);
  return names[dt.getDay()];
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

export default function RetirementReportPage() {
  const perms = usePermission();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retireYear, setRetireYear] = useState(new Date().getFullYear());
  const printRef = useRef();
  const [lunarText, setLunarText] = useState('');
  const [footerDate, setFooterDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewHR || perms.canViewEmployees)) { setLoading(false); return; }
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
  }, [perms.canViewHR, perms.canViewEmployees]);

  const derived = useMemo(() => {
    const rows = list
      .map(hr => ({ hr, rDate: computeRetirementDate(hr.dob) }))
      .filter(x => x.rDate && x.rDate.getFullYear() === Number(retireYear))
      .sort((a, b) => (a.hr.no || 0) - (b.hr.no || 0));
    const male = rows.filter(r => r.hr.gender === 'Male').length;
    const female = rows.filter(r => r.hr.gender === 'Female').length;
    // Category breakdowns (civil vs contract)
    const catMap = {
      civil: ['មន្ត្រីរាជការ', 'Civil', 'civil'],
      contract: ['កិច្ចសន្យា', 'contract', 'កម្មករកិច្ចសន្យា', 'WORKER']
    };
    const catCounts = { civil: { total: 0, female: 0 }, contract: { total: 0, female: 0 } };
    rows.forEach(r => {
      const ot = (r.hr.officerType || r.hr.officerType || '').toString();
      const txt = (ot || '').toString().toLowerCase();
      let matched = false;
      for (const key of Object.keys(catMap)) {
        const matches = catMap[key].some(token => txt.includes(token.toString().toLowerCase()));
        if (matches) {
          catCounts[key].total++;
          if (r.hr.gender === 'Female') catCounts[key].female++;
          matched = true;
          break;
        }
      }
      // If no explicit match, consider entries without officerType as contract fallback
      if (!matched) {
        if (!ot || ot.trim() === '') {
          catCounts.contract.total++;
          if (r.hr.gender === 'Female') catCounts.contract.female++;
        }
      }
    });

    return { rows, male, female, total: rows.length, categories: catCounts };
  }, [list, retireYear]);

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
      'អត្តលេខមន្រ្តីរាជការ',
      'គោត្តនាម-នាម',
      'ភេទ',
      'ថ្ងៃខែឆ្នាំកំណើត',
      'ថ្ងៃចូលធ្វើការ',
      'អតីតភាព',
      'មុខងារ',
      'កាំប្រាក់',
      'ថ្ងៃខែឆ្នាំចូលនិវត្តន៍'
    ];
    const data = rows.map((row, idx) => ([
      idx + 1,
      row.hr.staffId || row.hr.no || '',
      row.hr.khmerName || row.hr.name || '',
      row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : '',
      fmtDateSlash(row.hr.dob),
      fmtDateSlash(row.hr.joinDate || row.hr.dateJoinedMinistry || row.hr.civilServantStartDate),
      row.hr.grade || '',
      row.hr.civilServantRole || row.hr.position || '',
      row.hr.salaryLevel || '',
      fmtDateSlash(row.rDate),
    ]));

    const summary = [[
      `សរុប: ${derived.total} នាក់ ( ប្រុស: ${derived.male} នាក់ — ស្រី: ${derived.female} នាក់ )`
    ]];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, [], ...summary]);
    // Adjust column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 28 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = `Nivatt_${retireYear}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Retirement_${retireYear}.xlsx`);
  };

  if (!(perms.canViewHR || perms.canViewEmployees)) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">របាយការណ៍ចូលនិវត្តន៍</h2>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ​សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">របាយការណ៍ចូលនិវត្តន៍</h2>
          <p className="text-sm text-gray-600">បោះពុម្ពតាមគំរូ</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <label className="text-sm">ឆ្នាំ:</label>
          <input type="number" className="border rounded px-2 py-1 w-24" value={retireYear} onChange={(e) => setRetireYear(Number(e.target.value) || new Date().getFullYear())} />
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
          <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '13px', marginTop: '4px', fontWeight: 600 }}>បញ្ជីឈ្មោះមន្រ្តីរាជការចូលនិវត្តន៍របស់ មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត ឆ្នាំ {toKhmerDigits(retireYear)}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '35px' }}>ល.រ</th>
              <th style={{ width: '110px' }}>អត្តលេខមន្រ្តីរាជការ</th>
              <th>គោត្តនាម-នាម</th>
              <th style={{ width: '40px' }}>ភេទ</th>
              <th style={{ width: '110px' }}>ថ្ងៃខែឆ្នាំកំណើត</th>
              <th style={{ width: '110px' }}>ថ្ងៃចូលធ្វើការ</th>
              <th style={{ width: '90px' }}>អតីតភាព</th>
              <th>មុខងារ</th>
              <th style={{ width: '70px' }}>កាំប្រាក់</th>
              <th style={{ width: '115px' }}>ថ្ងៃខែឆ្នាំចូលនិវត្តន៍</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const rows = derived.rows;
              if (rows.length === 0) {
                return (
                  <tr>
                    <td colSpan={10} className="center text-gray-600">មិនមានទិន្នន័យ</td>
                  </tr>
                );
              }
              return rows.map((row, idx) => (
                <tr key={row.hr._id || idx}>
                  <td className="center">{toKhmerDigits(idx + 1)}</td>
                  <td className="center">{row.hr.staffId || row.hr.no || ''}</td>
                  <td>{row.hr.khmerName || row.hr.name || ''}</td>
                  <td className="center">{row.hr.gender === 'Male' ? 'ប' : row.hr.gender === 'Female' ? 'ស' : ''}</td>
                  <td className="center">{fmtDateSlash(row.hr.dob)}</td>
                  <td className="center">{fmtDateSlash(row.hr.joinDate || row.hr.dateJoinedMinistry || row.hr.civilServantStartDate)}</td>
                  <td className="center">{row.hr.grade || ''}</td>
                  <td>{row.hr.civilServantRole || row.hr.position || ''}</td>
                  <td className="center">{row.hr.salaryLevel || ''}</td>
                  <td className="center">{fmtDateSlash(row.rDate)}</td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
        {/* footer/signature area */}
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
