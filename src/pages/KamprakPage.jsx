import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';

/**
 * Helper to convert numbers to Khmer digits.
 */
function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, (d) => map[d]);
}

/**
 * Format date to DD/MM/YYYY.
 */
function fmtDateSlash(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

/**
 * Format a long Khmer date string.
 */
function fmtKhmerLongDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  return `ថ្ងៃទី ${toKhmerDigits(dt.getDate())} ខែ${khMonths[dt.getMonth()]} ឆ្នាំ${toKhmerDigits(dt.getFullYear())}`;
}

const PROMO_TYPES = ['វេនជ្រើសរើស', 'ឧត្តមសិទ្ធិ', 'កិត្តិយស'];

/**
 * Calculate seniority in years and months from a start date to a target date.
 */
function calculateSeniority(startDate, targetDate = '2026-04-13') {
  if (!startDate) return { years: 0, months: 0 };
  const start = new Date(startDate);
  const target = new Date(targetDate);
  if (isNaN(start.getTime())) return { years: 0, months: 0 };

  let years = target.getFullYear() - start.getFullYear();
  let months = target.getMonth() - start.getMonth();

  if (target.getDate() < start.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months };
}

export default function KamprakPage() {
  const perms = usePermission();
  const printRef = useRef();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState('');
  const [promoType, setPromoType] = useState('');

  // Custom form state for the selected user
  const [selectedId, setSelectedId] = useState(null);
  const [lunarDate1, setLunarDate1] = useState(''); // Part 1 date line
  const [lunarDate2, setLunarDate2] = useState(''); // Part 2 date line
  const [footerDate, setFooterDate] = useState(new Date().toISOString().slice(0, 10));

  // Specific fields from the Word UI
  const [biographyData, setBiographyData] = useState({}); // { [id]: { f1, f2, ... } }
  const [scores, setScores] = useState({}); // { [id]: [s1, s2, s3, s4, s5] }
  const [totalScore, setTotalScore] = useState({}); // { [id]: string }
  const [gradeText, setGradeText] = useState({}); // { [id]: string }
  const [noteContent, setNoteContent] = useState({}); // { [id]: string }

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/hr');
        if (alive) setList(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) setError(e?.response?.data?.message || e?.message || 'Load failed');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((hr) => {
      if (promoType && (hr.salaryPromotionBy || '') !== promoType) return false;
      if (year && hr.salaryPromotionDate) {
        const dt = new Date(hr.salaryPromotionDate);
        if (dt.getFullYear() !== Number(year)) return false;
        if (month && String(dt.getMonth() + 1).padStart(2, '0') !== month) return false;
      }
      if (q) {
        const fields = [hr.khmerName, hr.name, hr.staffId, hr.no, hr.position, hr.civilServantRole];
        if (!fields.some((f) => f && String(f).toLowerCase().includes(q))) return false;
      }
      return !!hr.salaryPromotionDate;
    }).sort((a, b) => (a.no || 0) - (b.no || 0));
  }, [list, search, year, month, promoType]);

  const selectedHr = useMemo(() => {
    const found = filtered.find((h) => (h._id || h.no) === selectedId);
    return found || filtered[0] || null;
  }, [filtered, selectedId]);

  // Expanded Summary stats for the report years
  const getStats = (yrStr) => {
    const yearList = list.filter(h => h.salaryPromotionDate?.includes(yrStr));
    return {
      total: yearList.length,
      promoted: yearList.filter(h => !h.isNotPromoted).length,
      notPromoted: yearList.filter(h => h.isNotPromoted).length,
      health: yearList.filter(h => h.type === 'Technical' || h.position?.includes('គ្រូពេទ្យ')).length,
      medium: yearList.filter(h => h.category === 'B').length,
      senior: yearList.filter(h => h.category === 'A' || h.civilServantRole?.includes('ជាន់ខ្ពស់')).length,
      carryOver: yrStr === '2025' ? 15 : 0, // "ដក់ចំនួន2024"
      reasons: yearList.filter(h => h.isNotPromoted).map(h => h.reason).filter(Boolean).length || 0
    };
  };

  const stats2025 = useMemo(() => getStats('2025-04-13'), [list]);
  const stats2026 = useMemo(() => getStats('2026-04-13'), [list]);

  // Helpers for nested state
  const getBio = (hr) => biographyData[hr?._id || hr?.no] || {};
  const setBio = (hr, f, v) => {
    const id = hr._id || hr.no;
    setBiographyData(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [f]: v } }));
  };

  const currentScores = useMemo(() => {
    const id = selectedHr?._id || selectedHr?.no;
    return scores[id] || ['', '', '', '', ''];
  }, [selectedHr, scores]);

  const updateScore = (idx, val) => {
    const id = selectedHr._id || selectedHr.no;
    setScores(prev => {
      const arr = [...(prev[id] || ['', '', '', '', ''])];
      arr[idx] = val;
      return { ...prev, [id]: arr };
    });
  };

  const sumScore = useMemo(() => {
    return currentScores.reduce((acc, s) => acc + (parseInt(s) || 0), 0);
  }, [currentScores]);

  const handlePrint = () => {
    if (!printRef.current || !selectedHr) return window.alert('សូមជ្រើសរើសមន្ត្រី');
    const w = window.open('', '_blank');
    if (!w) return;

    const styles = `
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
        .paper-page { 
          width: 210mm; 
          min-height: 297mm; 
          padding: 15mm 20mm; 
          box-sizing: border-box; 
          position: relative; 
          background: white; 
          page-break-after: always;
          font-family: "Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif;
          color: #000;
          line-height: 1.5;
          font-size: 12pt;
        }
        .paper-page:last-child { page-break-after: auto; }
        .kh-muol { font-family: "Khmer OS Muol Light", "Khmer OS Muol", "Noto Serif Khmer", serif; font-weight: normal; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .justify-between { justify-content: space-between; }
        .items-start { align-items: flex-start; }
        .items-end { align-items: flex-end; }
        .mt-8 { margin-top: 2rem; }
        .mt-3 { margin-top: 0.75rem; }
        .mt-1 { margin-top: 0.25rem; }
        .mb-10 { margin-bottom: 2.5rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .text-center { text-align: center; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .text-xl { font-size: 1.25rem; }
        .leading-relaxed { line-height: 1.625; }
        
        .summary-table {
          border-collapse: collapse;
          border: 1px solid black;
          width: 400px !important;
          margin: 0 auto 20px auto;
        }
        .summary-table td {
          border: 1px solid black;
          padding: 6px;
          text-align: center;
          vertical-align: middle;
          font-size: 12pt;
        }
        .border-r { border-right: 1px solid black !important; }
        
        .biography-line {
          display: flex;
          align-items: flex-end;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          font-size: 12pt;
        }
        .biography-line .label { padding-right: 5px; background: white; position: relative; z-index: 1; }
        .biography-line .dots { flex-grow: 1; border-bottom: 1px dotted #000; margin-bottom: 4px; }
        .biography-line .val-text { font-weight: bold; padding-left: 5px; color: #1a365d; }
        
        .score-box { border: 1px solid #000; width: 60px; height: 35px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .score-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        
        .note-container { border: 1.5px solid #000; padding: 10px; font-size: 11px; line-height: 1.4; height: 100%; box-sizing: border-box; }
        
        .signature-block {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
        }
        .signature-cell { width: 45%; text-align: center; }
        
        /* Hide inputs during print */
        input, textarea, select, .no-print { visibility: hidden !important; display: none !important; }
        .print-only { display: block !important; }
        .print-value { display: inline-block !important; font-weight: bold; }
      </style>
    `;

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>${styles}</head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  const exportToExcel = () => {
    const data = filtered.map((hr, idx) => ({
      'ល.រ': idx + 1,
      'អត្តលេខ': hr.staffId || hr.no || '',
      'គោត្តនាម-នាម': hr.khmerName || hr.name,
      'កាំប្រាក់': hr.salaryLevel || '',
      'ថ្ងៃឡើងកាំ': fmtDateSlash(hr.salaryPromotionDate)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kamprak');
    XLSX.writeFile(wb, `Kamprak_List_${year}.xlsx`);
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Search and Filters Header */}
      <div className="mb-6 flex flex-wrap items-end gap-3 no-print">
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-xl font-bold text-blue-900 border-l-4 border-blue-600 pl-3 mb-2">ប្រព័ន្ធគ្រប់គ្រងការឡើងថ្នាក់/កាំប្រាក់</h2>
          <input
            className="w-full border p-2 rounded-lg"
            placeholder="ស្វែងរកឈ្មោះ ឬអត្តលេខ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">ឆ្នាំ</label>
          <input
            type="number"
            className="border p-2 rounded-lg w-24"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">ខែ</label>
          <select className="border p-2 rounded-lg" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">ទាំងអស់</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition">📊 Excel</button>
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition">🖨️ បោះពុម្ព (Word Style)</button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar List */}
        <div className="w-80 flex flex-col gap-4 no-print">
          {/* Summary Report Box */}
          <div className="bg-white border rounded-xl shadow-sm p-4 text-[12px] space-y-4 border-l-4 border-l-blue-600">
            <h3 className="font-bold text-blue-900 border-b pb-1 mb-2">របាយការណ៍សង្ខេប</h3>

            {/* 2025 Section */}
            <div className="space-y-1.5 border-b pb-3">
              <div className="font-bold text-blue-800">ឆ្នាំ ១៣/០៤/២០២៥</div>
              <div className="flex justify-between px-1">
                <span>មន្រីរាជការសរុប:</span>
                <span className="font-bold">{toKhmerDigits(stats2025.total)} នាក់</span>
              </div>
              <div className="flex justify-between px-1 text-gray-500 italic">
                <span>ដក់ចំនួន២០២៤:</span>
                <span>{toKhmerDigits(stats2025.carryOver)} នាក់</span>
              </div>
              <div className="flex justify-between px-1 text-green-700">
                <span>ដំឡើង:</span>
                <span className="font-bold underline">{toKhmerDigits(stats2025.promoted)} នាក់</span>
              </div>
              <div className="flex justify-between px-1 text-red-600">
                <span>មិនដំឡើង:</span>
                <span className="font-bold">{toKhmerDigits(stats2025.notPromoted)} នាក់</span>
              </div>
              <div className="flex justify-between px-1 text-[10px] text-gray-500 pl-4 italic">
                <span>មូលហេតុ:</span>
                <span>{stats2025.reasons > 0 ? `មាន ${toKhmerDigits(stats2025.reasons)} ករណី` : 'គ្មាន'}</span>
              </div>
              <div className="pt-1 mt-1 border-t border-dashed border-gray-200">
                <div className="flex justify-between px-1">
                  <span>- មានសុខាភិបាល:</span>
                  <span>{toKhmerDigits(stats2025.health)}</span>
                </div>
                <div className="flex justify-between px-1">
                  <span>- មធ្យម:</span>
                  <span>{toKhmerDigits(stats2025.medium)}</span>
                </div>
                <div className="flex justify-between px-1">
                  <span>- ជាន់ខ្ពស់:</span>
                  <span>{toKhmerDigits(stats2025.senior)}</span>
                </div>
              </div>
            </div>

            {/* 2026 Section */}
            <div className="space-y-1.5">
              <div className="font-bold text-blue-800">ឆ្នាំ ១៣/០៤/២០២៦</div>
              <div className="flex justify-between px-1">
                <span>មន្រីរាជការសរុប:</span>
                <span className="font-bold">{toKhmerDigits(stats2026.total)} នាក់</span>
              </div>
              <div className="flex justify-between px-1 text-green-700">
                <span>ដំឡើង:</span>
                <span className="font-bold underline">{toKhmerDigits(stats2026.promoted)} នាក់</span>
              </div>
              <div className="flex justify-between px-1 text-red-600">
                <span>មិនដំឡើង:</span>
                <span className="font-bold">{toKhmerDigits(stats2026.notPromoted)} នាក់</span>
              </div>
              <div className="flex justify-between px-1 text-[10px] text-gray-400 pl-4 italic">
                <span>មូលហេតុ:</span>
                <span>{stats2026.reasons > 0 ? `មាន ${toKhmerDigits(stats2026.reasons)} ករណី` : 'គ្មាន'}</span>
              </div>
              <div className="pt-1 mt-1 border-t border-dashed border-gray-200">
                <div className="flex justify-between px-1">
                  <span>- មានសុខាភិបាល:</span>
                  <span>{toKhmerDigits(stats2026.health)}</span>
                </div>
                <div className="flex justify-between px-1">
                  <span>- មធ្យម:</span>
                  <span>{toKhmerDigits(stats2026.medium)}</span>
                </div>
                <div className="flex justify-between px-1">
                  <span>- ជាន់ខ្ពស់:</span>
                  <span>{toKhmerDigits(stats2026.senior)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* List Section */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-380px)]">
            <div className="bg-blue-900 text-white p-3 text-sm font-bold flex justify-between items-center">
              <span>បញ្ជីឈ្មោះមន្ត្រី</span>
              <span className="bg-blue-700 px-2 py-0.5 rounded text-xs">{filtered.length}</span>
            </div>
            <div className="overflow-y-auto h-full pb-10">
              {filtered.map((hr) => {
                const id = hr._id || hr.no;
                const isActive = id === (selectedId || (filtered[0]?._id || filtered[0]?.no));
                return (
                  <div
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={`p-3 border-b cursor-pointer transition ${isActive ? 'bg-blue-50 border-l-4 border-blue-600 pl-2' : 'hover:bg-gray-50'}`}
                  >
                    <div className="font-bold text-sm text-gray-800">{hr.khmerName || hr.name}</div>
                    <div className="text-[10px] text-gray-500 flex justify-between mt-1">
                      <span>{hr.civilServantId || hr.staffId || hr.no}</span>
                      <span>{hr.salaryLevel} · {fmtDateSlash(hr.salaryPromotionDate)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Document Render Area */}
        <div className="flex-1 flex flex-col items-center bg-gray-200 p-8 rounded-xl overflow-y-auto h-[calc(100vh-180px)] shadow-inner">
          {selectedHr ? (
            <div ref={printRef} className="document-container shadow-2xl">

              {/* PAGE 1 */}
              <div className="paper-page" style={{ position: 'relative' }}>
                <div className="flex justify-between items-start mb-10">
                  <div className="flex flex-col mt-8">
                    <div className="kh-muol text-[13px]">ក្រសួងសុខាភិបាល</div>
                    <div className="kh-muol text-[12px] mt-1">អង្គភាព : មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="kh-muol text-[15px]">ព្រះរាជាណាចក្រកម្ពុជា</div>
                    <div className="kh-muol text-[14px] mt-1">ជាតិ  សាសនា  ព្រះមហាក្សត្រ</div>
                    <div className="mt-1">
                      <img src={headerBg} alt="" className="mx-auto" style={{ width: '120px' }} />
                    </div>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <div className="kh-muol text-[13.0px] leading-relaxed underline">ព្រឹត្តិបត្រពិន្ទុសម្រាប់ការឡើងថ្នាក់</div>
                  <div className="kh-muol text-[13.0px] leading-relaxed underline">នៃក្រុមខណ្ឌមន្ត្រីសុខាភិបាលជាន់ខ្ពស់</div>
                </div>

                <div className="flex justify-center mb-8 relative">
                  <table className="summary-table" style={{ width: '400px' }}>
                    <tbody>
                      <tr>
                        <td colSpan="2" className="text-[12pt] p-2 text-center bold">គិតត្រឹមថ្ងៃទី ១៣ ខែមេសា ឆ្នាំ២០២៦</td>
                      </tr>
                      <tr className="text-[12pt] text-center">
                        <td style={{ width: '50%' }} className="p-2 border-r">រយៈការបំពេញការងារក្នុង<br />ឋានន្តរស័ក្តិ ថ្នាក់បច្ចុប្បន្ន</td>
                        <td className="p-2">រយៈកាលសរុបបំពេញការងារ</td>
                      </tr>
                      <tr className="text-[12pt] text-center bold">
                        <td className="p-2 border-r">
                          {(() => {
                            const sen = calculateSeniority(selectedHr.salaryPromotionDate || '2024-04-13', '2026-04-13');
                            return `${toKhmerDigits(sen.years)}ឆ្នាំ`;
                          })()}
                        </td>
                        <td className="p-2">
                          {(() => {
                            const sen = calculateSeniority(selectedHr.startDate || '1995-02-02', '2026-04-13');
                            return `${toKhmerDigits(sen.years)}ឆ្នាំ`;
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="center mb-6">
                  <div className="kh-muol text-sm underline">១. ជីវប្រវត្តិផ្ទាល់ខ្លួន</div>
                </div>

                <div className="space-y-1">
                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">១. គោត្តនាម និងនាម :...</span>
                    <span className="val-text min-w-[50px]">{selectedHr.khmerName || selectedHr.name}</span>
                    <span className="label">...ជាអក្សរឡាតាំង :...</span>
                    <span className="val-text min-w-[100px]">{selectedHr.name?.toUpperCase() || ''}</span>
                    <span className="label">...ភេទ :..</span>
                    <span className="val-text w-12">{selectedHr.gender === 'Male' ? 'ប្រុស' : 'ស្រី'}</span>
                  </div>

                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">២. អត្តលេខ :...</span>
                    <span className="val-text min-w-[120px]">{selectedHr.civilServantId || selectedHr.staffId || selectedHr.no}</span>
                    <span className="label">....ថ្ងៃ-ខែ-ឆ្នាំ កំណើត :</span>
                    <span className="val-text grow">{fmtDateSlash(selectedHr.dob)}</span>
                  </div>

                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">៣. កំរិតវប្បធម៌ទូទៅ :...</span>
                    <span className="val-text min-w-[150px]">ទុតិយភូមិ...</span>
                    <span className="label">...កំរិតជំនាញ :...</span>
                    <span className="val-text grow">{selectedHr.skillLevel || selectedHr.skill || '—'}</span>
                  </div>

                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">៤. កាលបរិច្ឆេទចូលធ្វើការងាររដ្ឋ :...</span>
                    <span className="val-text grow">{fmtDateSlash(selectedHr.startDate || '02/02/1994')}</span>
                  </div>

                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">៥. កាលបរិច្ឆេទដែលបានតាំងស៊ប់ក្នុងក្របខណ្ឌ :..</span>
                    <span className="val-text grow">{fmtDateSlash(selectedHr.appointmentDate || '02/02/1995')}</span>
                  </div>

                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">៦. ឋានន្តរស័ក្តិ ថ្នាក់បច្ចុប្បន្ន :...</span>
                    <span className="val-text min-w-[80px] text-center">{selectedHr.salaryLevel || 'ខ.៣.១'}</span>
                    <span className="label">...អតីតភាពក្នុងឋានន្តរស័ក្តិថ្នាក់បច្ចុប្បន្ន...</span>
                    <span className="val-text w-10 text-center">
                      {toKhmerDigits(calculateSeniority(selectedHr.salaryPromotionDate || '2024-04-13', '2026-04-13').years)}
                    </span>
                    <span className="label">...ឆ្នាំ</span>
                  </div>

                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">៧. កាលបរិច្ឆេទក្នុងថ្នាក់បច្ចុប្បន្ន( ថ្ងៃ ខែ ឆ្នាំ ឡើងថ្នាក់ចុងក្រោយ ) :...</span>
                    <span className="val-text grow">{fmtDateSlash(selectedHr.salaryPromotionDate || '13/04/2026')}</span>
                  </div>

                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt]">
                    <span className="label">៨. ការឈប់ពីការងារក្នុងឋានន្តរស័ក្តិ ថ្នាក់បច្ចុប្បន្នៈ...</span>
                    <span className="val-text grow"></span>
                  </div>
                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt] pl-6">
                    <span className="label">- មូលហេតុៈ</span>
                    <div className="dots mt-0 mb-[3px] border-dotted border-b border-black"></div>
                  </div>
                  <div className="flex biography-line items-end whitespace-nowrap overflow-hidden text-[12pt] pl-6">
                    <span className="label">- រយៈពេលៈ</span>
                    <div className="dots mt-0 mb-[3px] border-dotted border-b border-black"></div>
                  </div>
                </div>

                <div className="mt-4 text-[12pt] text-center">
                  ខ្ញុំសូមធានាទទួលខុសត្រូវចំមុខច្បាប់ថា ព័ត៌មានខាងលើនេះពិតជាត្រឹមត្រូវប្រាកដមែន ។
                </div>

                <div className="signature-block" style={{ marginTop: '50px' }}>
                  <div className="signature-cell">
                    <div className="text-xs">បានឃើញ និង បញ្ជាក់ព័ត៌មានដែល</div>
                    <div className="text-xs">លោក-លោកស្រី... <span className="bold">{selectedHr.khmerName || selectedHr.name}</span> ...</div>
                    <div className="text-xs">បានអះអាងខាងលើពិតជាត្រឹមត្រូវប្រាកដមែន ។</div>
                    <div className="text-xs mt-2 italic">ធ្វើនៅភ្នំពេញ, ថ្ងៃទី... <span className="print-only hidden font-bold">២០</span><input className="border-b w-8 text-center no-print" defaultValue="២០" />...ខែ... <span className="print-only hidden font-bold">មេសា</span><input className="border-b w-12 text-center no-print" defaultValue="មេសា" />...ឆ្នាំ ២០២៥</div>
                    <div className="kh-muol text-xs mt-3 underline">ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</div>
                  </div>
                  <div className="signature-cell flex flex-col items-center" style={{ position: 'relative', top: '-100px', left: '150px' }}>
                    <div className="text-xs italic">ធ្វើនៅភ្នំពេញ, ថ្ងៃទី... <span className="print-only hidden font-bold">១០</span><input className="border-b w-8 text-center no-print" defaultValue="១០" />...ខែ... <span className="print-only hidden font-bold">មេសា</span><input className="border-b w-12 text-center no-print" defaultValue="មេសា" />...ឆ្នាំ ២០២៥</div>
                    <div className="kh-muol text-xs mt-3 underline">ហត្ថលេខា និងឈ្មោះសាមីខ្លួន</div>
                  </div>
                </div>
              </div>

              {/* PAGE 2 */}
              <div className="paper-page">
                <div className="center mb-6">
                  <div className="kh-muol text-sm underline">២. ការវាយតម្លៃដាក់ពិន្ទុ</div>
                </div>

                <div className="space-y-4 px-5">
                  <ScoreRow num="១" label="មានគំនិតផ្ដួចផ្ដើម ច្នៃប្រឌិត និងទទួលខុសត្រូវក្នុងការងារ" value={currentScores[0]} onChange={(v) => updateScore(0, v)} />
                  <ScoreRow num="២" label="មានស្មារតីទទួលខុសត្រូវក្នុងកិច្ចការងារ និងវិន័យភក្ដីភាពការងារ" value={currentScores[1]} onChange={(v) => updateScore(1, v)} />
                  <ScoreRow num="៣" label="ការយកចិត្តទុកដាក់ដល់ផលប្រយោជន៍ជាតិ" value={currentScores[2]} onChange={(v) => updateScore(2, v)} />
                  <ScoreRow num="៤" label="ប្រសិទ្ធភាពនៃការដឹកនាំ គ្រប់គ្រងចាត់ចែងអនុវត្តន៍ការងារ" value={currentScores[3]} onChange={(v) => updateScore(3, v)} />
                  <ScoreRow num="៥-សីលធម៌ និងមានសីលធម៌រស់នៅល្អ" value={currentScores[4]} onChange={(v) => updateScore(4, v)} />
                </div>

                <div className="flex flex-col items-end mt-10 pr-10">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">ពិន្ទុដែលទទួលបាន:</span>
                    <div className="score-box">{sumScore}</div>
                    <span className="text-sm">/២០</span>
                  </div>
                  <div className="mt-2 text-sm">និទ្ទេស: ............................</div>
                </div>

                <div className="center mt-8 mb-4">
                  <div className="kh-muol text-sm underline">មូលវិចារណ៍ និងការវាយតម្លៃទូទៅ</div>
                </div>

                <div className="flex gap-4">
                  <div className="w-1/3">
                    <div className="note-container">
                      <div className="bold text-xs center underline mb-2">កំណត់សំគាល់</div>
                      <div className="text-[10px] space-y-1">
                        <div>- ពិន្ទុក្នុងទម្រង់វាយតម្លៃ មានចាប់ពី ០១ ដល់ ២០</div>
                        <div>- ពិន្ទុសរុបដែលមានស្មើនឹងពិន្ទុទាំង ៥ បណ្តាញចែកនឹង ៥ ដើម្បីរកមធ្យមភាគ ។</div>
                        <div>- ការកំណត់ពិន្ទុសម្រាប់និទ្ទេសមានដូចខាងក្រោម:</div>
                        <div className="pl-4">ក- និទ្ទេស ល្អណាស់ ចាប់ពី ១៩ ដល់ ២០ ពិន្ទុ</div>
                        <div className="pl-4">ខ- និទ្ទេស ល្អ ចាប់ពី ១៦ ដល់ក្រោម ១៩ ពិន្ទុ</div>
                        <div className="pl-4">គ- និទ្ទេស ល្អបង្គួរ ចាប់ពី ១៣ ដល់ក្រោម ១៦ ពិន្ទុ</div>
                        <div className="pl-4">ឃ- និទ្ទេស មធ្យម ចាប់ពី ១០ ដល់ក្រោម ១៣ ពិន្ទុ</div>
                        <div className="pl-4">ង- និទ្ទេស ខ្សោយ ចាប់ពី ០ ដល់ក្រោម ១០ ពិន្ទុ</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="border-b h-5"></div>
                    <div className="border-b h-5"></div>
                    <div className="border-b h-5 text-xs text-gray-400">សំណេររបស់អ្នក...</div>
                    <div className="border-b h-5"></div>
                    <div className="border-b h-5"></div>
                  </div>
                </div>

                <div className="signature-block mt-24">
                  <div className="signature-cell flex flex-col items-center">
                    <div className="text-xs bold underline">បានឃើញ និងឯកភាព</div>
                    <div className="text-xs italic mt-1">ធ្វើនៅភ្នំពេញ, ថ្ងៃទី... <span className="print-only hidden font-bold">៣០</span><input className="border-b w-8 text-center no-print" defaultValue="៣០" />...ខែ... <span className="print-only hidden font-bold">មេសា</span><input className="border-b w-12 text-center no-print" defaultValue="មេសា" />...ឆ្នាំ ២០២៥</div>
                    <div className="kh-muol text-[11px] mt-4 underline">នាយកមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
                  </div>
                  <div className="signature-cell flex flex-col items-center">
                    <div className="text-xs italic">ធ្វើនៅភ្នំពេញ, ថ្ងៃទី... <span className="print-only hidden font-bold">២៨</span><input className="border-b w-8 text-center no-print" defaultValue="២៨" />...ខែ... <span className="print-only hidden font-bold">មេសា</span><input className="border-b w-12 text-center no-print" defaultValue="មេសា" />...ឆ្នាំ ២០២៥</div>
                    <div className="kh-muol text-[11px] mt-4 underline">ប្រធានគណៈកម្មការចំណាត់ថ្នាក់</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 italic">
              សូមជ្រើសរើសមន្ត្រីដើម្បីមើលឯកសារ...
            </div>
          )}
        </div>
      </div>

      <style>{`
        .document-container {
          background: #ccc;
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding: 20px;
        }
        .paper-page {
          width: 210mm;
          min-height: 297mm;
          padding: 15mm 20mm;
          background: white;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          overflow: hidden;
          font-family: "Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif;
          font-size: 12pt;
        }
        .kh-muol {
          font-family: "Khmer OS Muol Light", "Khmer OS Muol", "Noto Serif Khmer", serif;
          font-weight: normal;
        }
        .biography-line .label {
          padding-right: 5px;
          background: white;
          position: relative;
          z-index: 1;
        }
        .biography-line .dots {
          flex-grow: 1;
          border-bottom: 1px dotted #888;
          margin-bottom: 4px;
        }
        .biography-line .val-text {
          margin-left: 5px;
          font-weight: bold;
          color: #1a365d;
        }
        .summary-table {
          border-collapse: collapse;
          border: 1px solid black;
          width: 100%;
        }
        .summary-table td {
          border: 1px solid black;
          vertical-align: middle;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .note-container { border: 1.5px solid #000; padding: 10px; font-size: 11px; line-height: 1.4; height: 100%; box-sizing: border-box; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            -webkit-print-color-adjust: exact;
          }
          /* Hide EVERYTHING that is not the document container */
          nav, aside, header, footer, .sidebar, .top-nav, .no-print, button, .no-print * { 
            display: none !important; 
            visibility: hidden !important; 
          }
          /* Ensure Document Container is the ONLY thing visible */
          .document-container { 
            display: block !important;
            visibility: visible !important;
            background: transparent !important; 
            padding: 0 !important; 
            gap: 0 !important; 
            margin: 0 !important;
            box-shadow: none !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            z-index: 9999;
          }
          .paper-page { 
            box-shadow: none !important; 
            margin: 0 auto !important; 
            width: 210mm !important; 
            min-height: 297mm !important; 
            padding: 15mm 20mm !important;
            page-break-after: always !important;
            font-size: 12pt !important;
            background: white !important;
            visibility: visible !important;
          }
          .paper-page:last-child { page-break-after: auto !important; }
          .biography-line { margin-bottom: 8px !important; font-size: 12pt !important; }
          .biography-line .dots { margin-bottom: 4px !important; }
          .summary-table td { padding: 8px !important; }
        }
      `}</style>
    </div >
  );
}

/**
 * Line component with dotted placeholder.
 */
function DocumentLine({ num, label, value, extra }) {
  return (
    <div className="biography-line text-[12pt]">
      <span className="label">{num ? `${num}. ` : ''}{label}:</span>
      <div className="dots"></div>
      <span className="val-text">{value}</span>
      {extra && <span className="ml-2 text-gray-500 italic text-[11px]">{extra}</span>}
    </div>
  );
}

/**
 * Scoring row with square input.
 */
function ScoreRow({ num, label, value, onChange }) {
  return (
    <div className="flex items-end justify-between gap-2 mb-3 text-[12pt]">
      <div className="flex-1 flex items-end overflow-hidden">
        <span className="whitespace-nowrap">{num ? `${toKhmerDigits(num)}- ` : ''}{label}:</span>
        <div className="flex-1 border-b border-dotted border-black ml-2 mb-1"></div>
      </div>
      <div className="flex items-center gap-2">
        <div className="no-print">
          <input
            type="number"
            max={20} min={0}
            className="w-16 h-8 border border-black text-center font-bold"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <div className="score-box print-only hidden">{value}</div>
        <span>/២០</span>
      </div>
    </div>
  );
}
