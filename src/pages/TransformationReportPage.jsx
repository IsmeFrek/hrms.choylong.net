import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';

function toKhmerDigits(n) {
  const map = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function toKhmerRoman(n) {
  // 1->១, 2->២, ... for section numbering
  return toKhmerDigits(n);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Extra formatting helpers for picture-style report
function fmtDateSlash(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function computeRetirementDate(dob) {
  // Assumption: retirement at age 60 from DOB
  if (!dob) return null;
  const dt = new Date(dob);
  if (isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear() + 60, dt.getMonth(), dt.getDate());
}

export default function EmployeeReportPage() {
  const perms = usePermission();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef();
  // Report variants: 'civil' (មន្ត្រីរាជការ), 'state' (កិច្ចសន្យារដ្ឋ), 'hospitalPlus' (កិច្ចសន្យាមន្ទីរពេទ្យ)
  const [reportType, setReportType] = useState('civil');

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

  // Filter list according to report type
  const filteredList = useMemo(() => {
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const otypes = {
      STATE: 'កិច្ចសន្យារដ្ឋ',
      HOSPITAL: 'កិច្ចសន្យាមន្ទីរពេទ្យ',
      PART_TIME: 'កិច្ចសន្យាក្រៅម៉ោង',
      WORKER: 'កម្មករកិច្ចសន្យា',
    };
    if (reportType === 'state') {
      return list.filter(hr => norm(hr.officerType) === otypes.STATE);
    }
    if (reportType === 'hospitalPlus') {
      return list.filter(hr => {
        const o = norm(hr.officerType);
        return o === otypes.HOSPITAL || o === otypes.PART_TIME || o === otypes.WORKER;
      });
    }
    // civil servants: exclude all contract types
    return list.filter(hr => {
      const o = norm(hr.officerType);
      return o !== otypes.STATE && o !== otypes.HOSPITAL && o !== otypes.PART_TIME && o !== otypes.WORKER;
    });
  }, [list, reportType]);

  const grouped = useMemo(() => {
    // group by Department_Kh; keep empty group at end
    const by = new Map();
    for (const hr of filteredList) {
      const key = hr?.Department_Kh || '—';
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(hr);
    }
    const entries = Array.from(by.entries())
      .sort((a,b) => {
        if (a[0] === '—') return 1;
        if (b[0] === '—') return -1;
        return a[0].localeCompare(b[0], 'km');
      })
    .map(([dept, items]) => ({ dept, items: items.sort((x,y) => (x.no||0)-(y.no||0)) }));
    return entries;
  }, [filteredList]);

  const totals = useMemo(() => {
    const total = filteredList.length;
    const male = filteredList.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length;
    const female = filteredList.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length;
    return { total, male, female };
  }, [filteredList]);

  // Summary totals for 'total' report type (use full list)
  const grandSummary = useMemo(() => {
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const otypes = {
      STATE: 'កិច្ចសន្យារដ្ឋ',
      HOSPITAL: 'កិច្ចសន្យាមន្ទីរពេទ្យ',
      PART_TIME: 'កិច្ចសន្យាក្រៅម៉ោង',
      WORKER: 'កម្មករកិច្ចសន្យា',
    };
    const count = (arr) => {
      const total = arr.length;
      const male = arr.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length;
      const female = arr.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length;
      return { total, male, female };
    };
    const civil = list.filter(hr => {
      const o = norm(hr.officerType);
      return o !== otypes.STATE && o !== otypes.HOSPITAL && o !== otypes.PART_TIME && o !== otypes.WORKER;
    });
    const state = list.filter(hr => norm(hr.officerType) === otypes.STATE);
    const hospital = list.filter(hr => norm(hr.officerType) === otypes.HOSPITAL);
    const partTime = list.filter(hr => norm(hr.officerType) === otypes.PART_TIME);
    const worker = list.filter(hr => norm(hr.officerType) === otypes.WORKER);
    return {
      all: count(list),
      civil: count(civil),
      state: count(state),
      hospital: count(hospital),
      partTime: count(partTime),
      worker: count(worker),
      hospitalPlus: count([...hospital, ...partTime, ...worker]),
    };
  }, [list]);

  // Technical summary across all staff grouped by technical role field
  const technicalSummary = useMemo(() => {
    const rowsMap = new Map();
    const label = (v) => (v && String(v).trim()) || 'មិនបានកំណត់';
    for (const hr of list) {
      const key = label(hr.civilServantRole || hr.technicalRole || hr.skill || hr.specialty);
      if (!rowsMap.has(key)) rowsMap.set(key, { name: key, male: 0, female: 0 });
      const row = rowsMap.get(key);
      if (hr.gender === 'Male' || hr.gender === 'ប្រុស') row.male += 1;
      else if (hr.gender === 'Female' || hr.gender === 'ស្រី') row.female += 1;
      else {
        // Unknown gender, ignore or count separately if needed
      }
    }
    const rows = Array.from(rowsMap.values())
      .map(r => ({ ...r, total: r.male + r.female }))
      .sort((a,b) => a.name.localeCompare(b.name, 'km'));
    const totals = rows.reduce((acc, r) => ({
      male: acc.male + r.male,
      female: acc.female + r.female,
      total: acc.total + r.total,
    }), { male: 0, female: 0, total: 0 });
    return { rows, totals };
  }, [list]);

  // Dynamic title per report type
  const computedTitle = useMemo(() => {
    if (reportType === 'total') return 'សរុបបុគ្គលិក នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'technical') return 'បញ្ជីររាយនាម បុគ្គលិក តាមជំនាញបច្ចេកទេស';
    if (reportType === 'state') return 'បញ្ជីររាយនាម បុគ្គលិកកិច្ចសន្យារដ្ឋ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospitalPlus') return 'បញ្ជីររាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ​ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    return 'បញ្ជីររាយនាម មន្រ្តីរាជការ នៃមន្ទី្រពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
  }, [reportType]);

  // Scoped CSS so on-screen looks like the printed version
  const SCREEN_CSS = `
    .print-scope { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; }
    .print-scope h1, .print-scope h2, .print-scope h3 { margin: 0; }
    .print-scope .title { text-align: center; margin-bottom: 6px; }
    .print-scope .title h2 { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; font-size: 18px; }
    .print-scope .subtitle { text-align: center; margin-bottom: 10px; }
    .print-scope table { width: 100%; border-collapse: collapse; }
    .print-scope th, .print-scope td { border: 1px solid #e6dbdbff; padding: 4px 6px; font-size: 12px; }
    .print-scope th { background: #f3f4f6; }
    .print-scope .section-row th { background: #e5e7eb; text-align: left; font-weight: 700; }
    .print-scope .no-border { border: 0 none; }
    .print-scope .footer-notes { margin-top: 16px; font-size: 12px; }
    .print-scope .signatures { display: flex; justify-content: space-between; margin-top: 28px; font-size: 13px; }
    .print-scope .center { text-align: center; }
  `;

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const PRINT_STYLES = `
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; }
        h1,h2,h3 { margin: 0; }
        .title { text-align: center; margin-bottom: 6px; }
        .title h2 { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; font-size: 18px; }
        .subtitle { text-align: center; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #222; padding: 4px 6px; font-size: 12px; }
        th { background: #f3f4f6; }
        .section-row th { background: #e5e7eb; text-align: left; font-weight: 700; }
        .no-border { border: 0 none; }
        .footer-notes { margin-top: 16px; font-size: 12px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 28px; font-size: 13px; }
        .center { text-align: center; }
      </style>
    `;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>${PRINT_STYLES}</head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  if (!(perms.canViewHR || perms.canViewEmployees)) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">របាយការណ៍បុគ្គលិក</h2>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ​សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">របាយការណ៍បុគ្គលិក</h2>
          <p className="text-sm text-gray-600">បោះពុម្ពតាមទម្រង់តារាង</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`border px-2 py-1 rounded ${loading ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white border-blue-600'}`} onClick={handlePrint} disabled={loading}>បោះពុម្ព</button>
        </div>
      </div>

      {/* Report selector */}
        <div className="mb-3 flex items-center gap-2">
          <label className="text-sm text-gray-700 border-blue-600">ជ្រើសរើសប្រភេទរបាយការណ៍:</label>
          <select
            className="border rounded px-3 py-1 text-gray-900 bg-white"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="total">សរុបបុគ្គលិក</option>
            <option value="technical">ជំនាញបច្ចេកទេស</option>
            <option value="civil">មន្ត្រីរាជការ</option>
            <option value="state">កិច្ចសន្យារដ្ឋ</option>
            <option value="hospitalPlus">កិច្ចសន្យាមន្ទីរពេទ្យ</option>
            
          </select>
          {/* retirement year control moved to RetirementReportPage */}
        </div>

      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-600">កំពុងទាញយកទិន្នន័យ...</div>
      ) : (
        <div ref={printRef} className="bg-white p-4 border rounded print-scope">
          {/* Screen-only style to match print layout */}
          <style dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />
          <div className="title">
            <h2>{computedTitle}</h2>
            <div className="subtitle">គិតត្រឹមថ្ងៃទី</div>
          </div>

          {reportType === 'total' ? (
            <table>
              <thead>
                <tr>
                  <th>ប្រភេទបុគ្គលិក</th>
                  <th className="center">សរុប</th>
                  <th className="center">ប្រុស</th>
                  <th className="center">ស្រី</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>មន្រ្តីរាជការ</td>
                  <td className="center">{toKhmerDigits(grandSummary.civil.total)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.civil.male)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.civil.female)}</td>
                </tr>
                <tr>
                  <td>កិច្ចសន្យារដ្ឋ</td>
                  <td className="center">{toKhmerDigits(grandSummary.state.total)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.state.male)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.state.female)}</td>
                </tr>
                <tr>
                  <td>កិច្ចសន្យាមន្ទីរពេទ្យ</td>
                  <td className="center">{toKhmerDigits(grandSummary.hospital.total)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.hospital.male)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.hospital.female)}</td>
                </tr>
                <tr>
                  <td>កិច្ចសន្យាក្រៅម៉ោង</td>
                  <td className="center">{toKhmerDigits(grandSummary.partTime.total)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.partTime.male)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.partTime.female)}</td>
                </tr>
                <tr>
                  <td>កម្មករកិច្ចសន្យា</td>
                  <td className="center">{toKhmerDigits(grandSummary.worker.total)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.worker.male)}</td>
                  <td className="center">{toKhmerDigits(grandSummary.worker.female)}</td>
                </tr>
                <tr>
                  <td><strong>សរុបកិច្ចសន្យា (មន្ទីរពេទ្យ + ក្រៅម៉ោង + កម្មករ)</strong></td>
                  <td className="center"><strong>{toKhmerDigits(grandSummary.hospitalPlus.total)}</strong></td>
                  <td className="center"><strong>{toKhmerDigits(grandSummary.hospitalPlus.male)}</strong></td>
                  <td className="center"><strong>{toKhmerDigits(grandSummary.hospitalPlus.female)}</strong></td>
                </tr>
                <tr>
                  <td><strong>សរុបបុគ្គលិកទាំងអស់</strong></td>
                  <td className="center"><strong>{toKhmerDigits(grandSummary.all.total)}</strong></td>
                  <td className="center"><strong>{toKhmerDigits(grandSummary.all.male)}</strong></td>
                  <td className="center"><strong>{toKhmerDigits(grandSummary.all.female)}</strong></td>
                </tr>
              </tbody>
            </table>
          ) : reportType === 'technical' ? (
            <table>
              <thead>
                <tr>
                  <th style={{width:'40px'}}>ល.រ</th>
                  <th>ជំនាញបច្ចេកទេស</th>
                  <th className="center">ប្រុស</th>
                  <th className="center">ស្រី</th>
                  <th className="center">សរុប</th>
                </tr>
              </thead>
              <tbody>
                {technicalSummary.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="center text-gray-600">មិនមានទិន្នន័យ</td>
                  </tr>
                )}
                {technicalSummary.rows.map((r, idx) => (
                  <tr key={r.name || idx}>
                    <td className="center">{toKhmerDigits(idx+1)}</td>
                    <td>{r.name}</td>
                    <td className="center">{toKhmerDigits(r.male)}</td>
                    <td className="center">{toKhmerDigits(r.female)}</td>
                    <td className="center">{toKhmerDigits(r.total)}</td>
                  </tr>
                ))}
                {technicalSummary.rows.length > 0 && (
                  <tr>
                    <th colSpan={2}>សរុប</th>
                    <th className="center">{toKhmerDigits(technicalSummary.totals.male)}</th>
                    <th className="center">{toKhmerDigits(technicalSummary.totals.female)}</th>
                    <th className="center">{toKhmerDigits(technicalSummary.totals.total)}</th>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
          <table>
            <thead>
              <tr>
                <th style={{width:'50px'}}>ល.រ</th>
                <th>គោត្តនាម និងនាម</th>
                <th style={{width:'20px'}}>ភេទ</th>
                <th style={{width:'100px'}}>ថ្ងៃខែឆ្នាំកំណើត</th>
                <th style={{width:'130px'}}>{(reportType==='hospitalPlus' || reportType==='state') ? 'ប្រភេទមន្ត្រី' : 'អត្តលេខមន្ត្រី'}</th>
                <th>ជំនាញបច្ចេកទេស</th>
                <th>តួនាទី</th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={7} className="center text-gray-600">មិនមានទិន្នន័យ</td>
                </tr>
              )}
              {grouped.map((g, gi) => (
                <React.Fragment key={g.dept || gi}>
                  <tr className="section-row">
                    <th className="no-border" colSpan={7}>{toKhmerRoman(gi+1)}&nbsp;&nbsp;{g.dept}</th>
                  </tr>
                  {g.items.map((r, idx) => (
                    <tr key={r._id || idx}>
                      <td className="center">{toKhmerDigits(idx+1)}</td>
                      <td>{r.khmerName || r.name || ''}</td>
                      <td className="center">{r.gender === 'Male' ? 'ប' : r.gender === 'Female' ? 'ស' : ''}</td>
                      <td className="center">{fmtDate(r.dob)}</td>
                      <td className="center">{(reportType==='hospitalPlus' || reportType==='state') ? (r.officerType || '') : (r.civilServantId || r.officerId || '')}</td>
                      <td>{r.civilServantRole || ''}</td>
                      <td>{r.position || ''}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          )}

          <div className="footer-notes">
            <div>បុគ្គលិកសរុបចំនួន: {toKhmerDigits(totals.total)} នាក់</div>
            <div>ប្រុស: {toKhmerDigits(totals.male)} នាក់ &nbsp;&nbsp; ស្រី: {toKhmerDigits(totals.female)} នាក់</div>
          </div>

          <div className="signatures">
            <div className="center">បានឃើញ និងឯកភាព<br/>នាយកមន្ទីរពេទ្យ</div>
            <div className="center">បានឃើញ និង​ពិនិត្យត្រឹមត្រូវ<br/>ប្រធានការិយាល័យរដ្ឋបាលនិងបុគ្កលិក</div>
            <div className="center">អ្នកធ្វើរបាយការណ៍<br/>លោក នេត ចន្ថា</div>
          </div>
        </div>
      )}
    </div>
  );
}