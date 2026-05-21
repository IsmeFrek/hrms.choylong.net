import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';

function buildPrintStyle(orientation = 'landscape', rowHeight = 13) {
  const o = (orientation === 'landscape') ? 'landscape' : 'portrait';
  const contentWidth = o === 'landscape' ? '277mm' : '190mm';
  return `
@media print {
  @page { size: A4 ${o}; margin: 12mm; }
  html, body { margin:0 !important; padding:0 !important; background: white !important; }
  #attendance-print-content { box-sizing: border-box; margin:0 auto !important; padding:0 !important; background: white !important; page-break-after: avoid; max-width: ${contentWidth}; }
  body * { visibility: hidden; }
  #attendance-print-content, #attendance-print-content * { visibility: visible; }
  #attendance-print-content { position: static; }
  #attendance-print-content table tr td, #attendance-print-content table tr th { height: ${rowHeight}px !important; }
  #attendance-print-content table { table-layout: fixed; }
}
`;
}

function parseMinutes(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const s = String(str);
  const m1 = s.match(/(\d+)h\s*(\d+)?m?/i);
  if (m1) return parseInt(m1[1], 10) * 60 + (m1[2] ? parseInt(m1[2], 10) : 0);
  const m2 = s.match(/(\d+):(\d+)/);
  if (m2) return parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  const m3 = s.match(/(\d+)m/i);
  if (m3) return parseInt(m3[1], 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

function formatMinutes(total) {
  const n = Number(total || 0);
  if (!n) return '';
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function DailyReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [printOrientation, setPrintOrientation] = useState(() => {
    try { const v = localStorage.getItem('dailyReportPrintOrientation'); if (v === 'landscape' || v === 'portrait') return v; } catch { };
    return 'portrait';
  });
  const [rowHeight, setRowHeight] = useState(() => {
    try { const v = Number(localStorage.getItem('dailyReportRowHeight')); if (Number.isFinite(v) && v > 0) return v; } catch { };
    return 10;
  });
  const [q, setQ] = useState('');
  const [showColsMenu, setShowColsMenu] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let style = document.getElementById('attendance-print-style-daily');
    if (!style) {
      style = document.createElement('style');
      style.id = 'attendance-print-style-daily';
      document.head.appendChild(style);
    }
    try { localStorage.setItem('dailyReportPrintOrientation', printOrientation); localStorage.setItem('dailyReportRowHeight', String(rowHeight)); } catch { }
    if (style) style.innerHTML = buildPrintStyle(printOrientation, rowHeight);
    return () => { if (style && style.parentNode) style.parentNode.removeChild(style); };
  }, [printOrientation, rowHeight]);

  const rowFontSize = Math.max(10, Math.round(rowHeight * 0.46));

  const load = async () => {
    setLoading(true);
    try {
      try {
        const { data } = await api.get('/attendance/daily', { params: { date } });
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        const { data } = await api.get('/attendance', { params: { from: date, to: date } });
        setList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const exportPdf = () => {
    try {
      if (window.html2pdf) {
        const opt = { margin: 10, filename: `attendance_daily_${date}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: printOrientation } };
        window.html2pdf().set(opt).from(document.getElementById('attendance-print-content')).save();
        return;
      }
    } catch (e) {
      // ignore
    }
    doPrint();
  };

  const doPrint = () => window.print();
  const exportExcel = () => {
    try {
      const headers = ['លេខកាត', 'ឈ្មោះ', 'ចូល - ចេញ', 'ម៉ោងធ្វើការ ចំនួន', 'វត្តមាន ចំនួន', 'ចំនួនម៉ោង', 'ម៉ោងឆែក នាទី', 'ម៉ោងឆែក ចំនួន', 'ចូលយឺត នាទី', 'ចូលយឺត ចំនួន', 'ចេញមុន នាទី', 'ចេញមុន ចំនួន', 'ចេញលើម៉ោង នាទី', 'ចេញលើម៉ោង ចំនួន', 'អវត្តមាន', 'ច្បាប់'];
      const data = (list || []).map(r => {
        const present = !(r.status === 'absent' || r.status === 'leave');
        return [
          r.staffId || r.cardId || r.staff?.cardId || r.card || '',
          r.staffName || r.staff?.fullName || r.name || '',
          `${r.checkIn || ''} - ${r.checkOut || ''}`,
          present ? (r.halfDay ? 0.5 : 1) : 0,
          present ? 1 : 0,
          r.workTime || '',
          r.clock || '',
          r.clock ? 1 : 0,
          r.isLate ? (r.lateMinutes || 0) : '',
          r.isLate ? 1 : '',
          r.leftEarly ? (r.earlyMinutes || 0) : '',
          r.leftEarly ? 1 : '',
          r.overtimeMinutes || '',
          r.overtimeMinutes ? 1 : '',
          r.status === 'absent' ? 1 : '',
          r.status === 'leave' ? 1 : ''
        ];
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily');
      XLSX.writeFile(wb, `attendance_daily_${date}.xlsx`);
    } catch (e) {
      console.error('Failed to export Excel', e);
    }
  };

  const totals = (list || []).reduce((acc, r) => {
    const present = !(r.status === 'absent' || r.status === 'leave');
    acc.dayWork += present ? (r.halfDay ? 0.5 : 1) : 0;
    acc.attendance += present ? 1 : 0;
    acc.workMinutes += parseMinutes(r.workTime) || 0;
    if (r.clock) acc.clockCount += 1;
    if (r.isLate) { acc.lateMinutes += (r.lateMinutes || 0); acc.lateCount += 1; }
    if (r.leftEarly) { acc.earlyMinutes += (r.earlyMinutes || 0); acc.earlyCount += 1; }
    if (r.overtimeMinutes) { acc.overtimeMinutes += (r.overtimeMinutes || 0); acc.overtimeCount += 1; }
    if (r.status === 'absent') acc.absent += 1;
    if (r.status === 'leave') acc.leave += 1;
    return acc;
  }, { dayWork: 0, attendance: 0, workMinutes: 0, clockCount: 0, lateMinutes: 0, lateCount: 0, earlyMinutes: 0, earlyCount: 0, overtimeMinutes: 0, overtimeCount: 0, absent: 0, leave: 0 });

  const sampleRows = [];

  return (
    <div style={{ padding: 20, fontFamily: '"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ background: '#2f6fb2', color: '#fff', padding: 12, borderRadius: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>របាយការណ៍ប្រចាំថ្ងៃ</h2>
          <div style={{ fontSize: 12, opacity: 0.9 }}>ថ្ងៃ: {new Date(date).toLocaleDateString()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="no-print">
          <button type="button" onClick={() => setShowColsMenu(v => !v)} style={{ padding: '6px 10px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>Columns</button>
          {showColsMenu && (
            <div style={{ position: 'absolute', right: 0, top: 72, background: '#fff', border: '1px solid #ddd', padding: 10, minWidth: 220, boxShadow: '0 2px 10px rgba(0,0,0,0.15)', zIndex: 100 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Column menu (preview only)</div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>Tip: Columns configurable in monthly report</div>
              <div style={{ textAlign: 'right', marginTop: 8 }}><button onClick={() => setShowColsMenu(false)} style={{ padding: '4px 8px' }}>Close</button></div>
            </div>
          )}
          <label style={{ fontSize: 12 }}>Row height</label>
          <input type="range" min={8} max={60} value={rowHeight} onChange={(e) => setRowHeight(Number(e.target.value))} />
          <span style={{ fontSize: 12, color: '#111', minWidth: 40, textAlign: 'right', fontWeight: 700 }}>{rowFontSize}px</span>
          <select value={printOrientation} onChange={(e) => setPrintOrientation(e.target.value)} className="border rounded px-2 py-1">
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
          <input type="text" placeholder="ស្វែងរក (ឈ្មោះ, លេខកាត, ផ្នែក)" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, minWidth: 220 }} />
          <button onClick={() => setQ('')} style={{ padding: '6px 12px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 4 }}>សម្អាត់</button>
          <button onClick={load} className="border rounded px-3 py-1 bg-blue-600 text-white">ទាញយក</button>
          <button onClick={exportExcel} className="border rounded px-3 py-1 bg-green-600 text-white">នាំចេញ Excel</button>
          <button onClick={exportPdf} className="border rounded px-3 py-1 bg-blue-500 text-white">PDF ទាញចុះ</button>
          <button onClick={doPrint} className="border rounded px-3 py-1 bg-gray-300">ព្រីន</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginBottom: 12 }} className="no-print">
        <div>
          <label className="text-sm">ថ្ងៃ</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-2 py-1" />
        </div>
      </div>

      <div id="attendance-print-content" ref={containerRef} style={{ background: '#fff', padding: 12 }}>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
          <table style={{ minWidth: 1000, borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>លេខកាត</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>ឈ្មោះ</th>
                <th colSpan={1} style={{ border: '1px solid #cbd5e1', padding: 8 }}>ថ្ងៃ</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>ម៉ោងធ្វើការ<br />ចំនួន</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>វត្តមាន<br />ចំនួន</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>ចំនួនម៉ោង</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>ម៉ោងឆែក<br />នាទី</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>ម៉ោងឆែក<br />ចំនួន</th>
                <th colSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fff59d' }}>ចូលយឺត</th>
                <th colSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fff59d' }}>ចេញមុន</th>
                <th colSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fed7d7' }}>ចេញលើម៉ោង</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>អវត្តមាន</th>
                <th rowSpan={2} style={{ border: '1px solid #cbd5e1', padding: 8 }}>ច្បាប់</th>
              </tr>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ border: '1px solid #cbd5e1', padding: 8 }}>{new Date(date).getDate()}<br /><span style={{ fontSize: 11, color: '#555' }}>ចូល - ចេញ</span></th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fff59d' }}>នាទី</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fff59d' }}>ចំនួន</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fff59d' }}>នាទី</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fff59d' }}>ចំនួន</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fed7d7' }}>នាទី</th>
                <th style={{ border: '1px solid #cbd5e1', padding: 8, background: '#fed7d7' }}>ចំនួន</th>
              </tr>
            </thead>
            <tbody>
              {(((list || []).length) ? list : sampleRows).map((r, i) => {
                const present = !(r.status === 'absent' || r.status === 'leave');
                const dayWork = present ? (r.halfDay ? 0.5 : 1) : 0;
                const attendanceCount = present ? 1 : 0;
                const workTime = r.workTime || '';
                const clock = r.clock || '';
                const clockCount = clock ? 1 : '';
                const checkinLate = r.isLate ? (r.lateMinutes || '') : '';
                const checkinLateCount = r.isLate ? 1 : '';
                const checkoutEarly = r.leftEarly ? (r.earlyMinutes || '') : '';
                const checkoutEarlyCount = r.leftEarly ? 1 : '';
                const checkoutOver = r.overtimeMinutes || '';
                const checkoutOverCount = r.overtimeMinutes ? 1 : '';
                return (
                  <tr key={r._id || i}>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8 }}>{r.staffId || r.cardId || r.staff?.cardId || r.card || ''}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8 }}>{r.staffName || r.staff?.fullName || r.name || ''}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                      <div style={{ display: 'inline-block', minWidth: 90, padding: 6, borderRadius: 4, color: '#fff', background: r.status === 'absent' ? '#ef4444' : (r.checkIn ? '#16a34a' : '#f59e0b') }}>
                        <div style={{ fontWeight: 600 }}>{r.checkIn || ''}</div>
                        <div style={{ fontSize: 12, opacity: 0.9 }}>{r.checkOut || ''}</div>
                      </div>
                    </td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{dayWork || ''}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{attendanceCount}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{workTime}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{clock}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{clockCount}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{checkinLate}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{checkinLateCount}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{checkoutEarly}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{checkoutEarlyCount}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{checkoutOver}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{checkoutOverCount}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{r.count || ''}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{r.status === 'absent' ? 1 : ''}</td>
                    <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>{r.status === 'leave' ? 1 : ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, fontWeight: 700 }}>សរុប</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8 }} />
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }} />
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.dayWork || ''}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.attendance || ''}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{formatMinutes(totals.workMinutes)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }} />
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.clockCount || ''}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{formatMinutes(totals.lateMinutes)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.lateCount || ''}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{formatMinutes(totals.earlyMinutes)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.earlyCount || ''}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{formatMinutes(totals.overtimeMinutes)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.overtimeCount || ''}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.absent || ''}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: 8, textAlign: 'center' }}>{totals.leave || ''}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
