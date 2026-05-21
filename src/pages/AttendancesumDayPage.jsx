import React, { useEffect, useState } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import usePermission from '../hooks/usePermission';

export default function AttendancesumDayPage() {
  const { canViewAttendanceMonthlyData } = usePermission();

  const pad2 = (n) => String(n).padStart(2, '0');

  const ymdLocal = (v) => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };



  const ymOf = (iso) => {
    if (!iso) return '';
    const m = String(iso).slice(0, 7);
    return m;
  };

  const [monthValue, setMonthValue] = useState(() => ymOf(new Date().toISOString()));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const PAGE_SIZES = [10, 20, 50, 100, 200, 500];

  const parseHMToMinutes = (s) => {
    if (!s && s !== 0) return null;
    if (typeof s === 'number' && isFinite(s)) return null;
    const str = String(s || '').trim();
    if (!str) return null;
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
    return null;
  };

  const parseWorkTimeMinutes = (v) => {
    if (v === null || typeof v === 'undefined' || v === '') return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    if (!s) return 0;
    // Formats like "8h 35m" or "8h35m" or "52m"
    const hm = s.match(/^(\d+)\s*h\s*(\d+)?\s*m?$/i);
    if (hm) {
      const h = Number(hm[1] || 0);
      const m = Number(hm[2] || 0);
      return h * 60 + m;
    }
    const onlyM = s.match(/^(\d+)\s*m$/i);
    if (onlyM) {
      return Number(onlyM[1] || 0);
    }
    // Formats like "08:35" meaning hours:minutes
    const colon = s.match(/^(\d{1,2}):(\d{2})$/);
    if (colon) {
      return Number(colon[1]) * 60 + Number(colon[2]);
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const formatWorkTime = (val) => {
    if (val === null || typeof val === 'undefined' || val === '' || val === 0) return '0 h';
    let n = Number(val);
    if (isNaN(n)) return String(val);
    const h = Math.floor(Math.abs(n) / 60);
    const m = Math.abs(n) % 60;
    return `${n < 0 ? '-' : ''}${h}h ${m}m`;
  };



  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue]);

  const load = async () => {
    setLoading(true);
    try {
      if (!monthValue) {
        setData([]);
        return;
      }
      const [y, m] = monthValue.split('-').map(Number);
      if (!y || !m) {
        setData([]);
        return;
      }
      // Query by year/month
      const resp = await api
        .get('/attendance/summary', { params: { year: y, month: m } })
        .catch(() => ({ data: [] }));

      const rows = Array.isArray(resp.data) ? resp.data : [];

      const processed = rows.map((r) => {
        // Calculate percent for performanceResult
        let percent = 0;
        if (r.dayWorkCount && r.attendanceCount) {
          percent = (Number(r.attendanceCount) / Number(r.dayWorkCount)) * 100;
        }
        let performanceResult = '';
        if (percent >= 95) performanceResult = 'ល្អ';
        else if (percent >= 85) performanceResult = 'ល្អបង្គួរ';
        else if (percent >= 70) performanceResult = 'មធ្យម';
        else performanceResult = 'ខ្សោយ';
        return {
          staffId: String(r.staffId || '').trim(),
          name: r.name || '',
          dayWorkCount: typeof r.dayWorkCount === 'number' ? r.dayWorkCount : Number(r.dayWorkCount || 0) || 0,
          attendanceCount:
            typeof r.attendanceCount === 'number' ? r.attendanceCount : Number(r.attendanceCount || 0) || 0,
          workTime: typeof r.workTime === 'number' ? r.workTime : Number(r.workTime || 0) || 0,
          clock: typeof r.clock === 'number' ? r.clock : Number(r.clock || 0) || 0,
          clockCount: typeof r.clockCount === 'number' ? r.clockCount : Number(r.clockCount || 0) || 0,
          checkinLateMinutes:
            typeof r.checkinLateMinutes === 'number'
              ? r.checkinLateMinutes
              : Number(r.checkinLateMinutes || 0) || 0,
          checkinLateCount:
            typeof r.checkinLateCount === 'number' ? r.checkinLateCount : Number(r.checkinLateCount || 0) || 0,
          checkoutEarlyMinutes:
            typeof r.checkoutEarlyMinutes === 'number'
              ? r.checkoutEarlyMinutes
              : Number(r.checkoutEarlyMinutes || 0) || 0,
          checkoutEarlyCount:
            typeof r.checkoutEarlyCount === 'number'
              ? r.checkoutEarlyCount
              : Number(r.checkoutEarlyCount || 0) || 0,
          checkoutOvertimeMinutes:
            typeof r.checkoutOvertimeMinutes === 'number'
              ? r.checkoutOvertimeMinutes
              : Number(r.checkoutOvertimeMinutes || 0) || 0,
          checkoutOvertimeCount:
            typeof r.checkoutOvertimeCount === 'number'
              ? r.checkoutOvertimeCount
              : Number(r.checkoutOvertimeCount || 0) || 0,
          absentCount: typeof r.absentCount === 'number' ? r.absentCount : Number(r.absentCount || 0) || 0,
          leaveCount: typeof r.leaveCount === 'number' ? r.leaveCount : Number(r.leaveCount || 0) || 0,
          A: typeof r.A === 'number' ? r.A : Number(r.A || 0) || 0,
          Plech:
            typeof r.plech === 'number' ? r.plech : typeof r.Plech === 'number' ? r.Plech : Number(r.plech || r.Plech || 0) || 0,
          performanceResult
        };
      });

      setData(processed);
    } catch (err) {
      console.error('Load failed:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = Array.isArray(data)
    ? data.filter((r) => {
        const q = String(searchText || '').trim().toLowerCase();
        if (!q) return true;
        const sid = String(r.staffId || '').toLowerCase();
        const name = String(r.name || '').toLowerCase();
        return sid.includes(q) || name.includes(q);
      })
    : [];

  useEffect(() => {
    setPage(1);
  }, [searchText, monthValue]);

  const totalFiltered = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const pageData = filteredData.slice(startIndex, endIndex);

  const handleExportExcel = () => {
    try {
      const headerRow1 = [
        'Staff ID',
        'Name',
        'Day Work',
        'Attendance',
        'Work Time',
        'Clock',
        'Clock',
        'Checkin Late',
        'Checkin Late',
        'Checkout Early',
        'Checkout Early',
        'Checkout Overtime',
        'Checkout Overtime',
        'Absent',
        'Leave',
        'A',
        'Plech',
        'Performance Result'
      ];
      const headerRow2 = [
        '',
        '',
        'Count',
        'Q-mn',
        'Q-mn',
        'Q-mn',
        'Count',
        'Q-mn',
        'Count',
        'Q-mn',
        'Count',
        'Q-mn',
        'Count',
        '',
        '',
        '',
        '',
        ''
      ];

      const [y, m] = monthValue.split('-');
      const monthLabel = y && m ? `${y}-${m}` : '';
      const rows = [
        [
          `Summary Report Payroll ${monthLabel}`,
          ...Array(headerRow1.length - 1).fill('')
        ],
        headerRow1,
        headerRow2,
        ...filteredData.map((r) => [
          r.staffId || '',
          r.name || '',
          r.dayWorkCount || '',
          r.attendanceCount || '',
          r.workTime || '',
          r.clock || '',
          r.clockCount || '',
          r.checkinLateMinutes || '',
          r.checkinLateCount || '',
          r.checkoutEarlyMinutes || '',
          r.checkoutEarlyCount || '',
          r.checkoutOvertimeMinutes || '',
          r.checkoutOvertimeCount || '',
          r.absentCount || '',
          r.leaveCount || '',
          r.A || '',
          r.Plech || '',
          r.performanceResult || ''
        ])
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const borders = {
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } }
      };
      const baseFont = { name: 'Times New Roman', sz: 12 };
      const centerAlignment = { horizontal: 'center', vertical: 'center', wrapText: true };
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const cellRef = XLSX.utils.encode_col(c) + (r + 1);
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
          ws[cellRef].s = { font: baseFont, alignment: centerAlignment, border: borders };
          if (r < 3) ws[cellRef].s.fill = { fgColor: { rgb: 'FFE6E6' } };
        }
      }
      const colWidths = [12, 18, 10, 10, 12, 10, 10, 12, 10, 12, 10, 12, 10, 10, 10, 8, 8];
      ws['!cols'] = colWidths.map((w) => ({ wch: w }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
      XLSX.writeFile(wb, `AttendanceSummary_${monthLabel}.xlsx`);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed: ' + err.message);
    }
  };

  const handleImportExcel = (file) => {
    try {
      setImporting(true);
      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const dataArr = new Uint8Array(e.target.result);
          const wb = XLSX.read(dataArr, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

          if (!aoa || aoa.length < 3) {
            alert('រកមិនឃើញទិន្នន័យសមរម្យក្នុង Excel ទេ');
            return;
          }

          // Try to parse date range from title row like: Summary Report Payroll MM/DD/YYYY to MM/DD/YYYY
          const title = String(aoa[0]?.[0] || '');
          const m = title.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
          // Ignore imported date range, always use monthValue



          // Parse year and month from monthValue (format: yyyy-mm)
          let year = 0, month = 0;
          if (monthValue) {
            const [y, m] = monthValue.split('-').map(Number);
            if (y && m) {
              year = y;
              month = m;
            }
          }

          // Build rows with only year/month (no fromDate/toDate)
          const rows = [];
          for (let i = 3; i < aoa.length; i++) {
            const row = aoa[i];
            if (!row) continue;
            const staffId = String(row[0] || '').trim();
            const name = row[1] || '';
            if (!staffId && !name) continue;
            rows.push({
              staffId,
              name,
              dayWorkCount: Number(row[2] || 0) || 0,
              attendanceCount: Number(row[3] || 0) || 0,
              workTime: parseWorkTimeMinutes(row[4]),
              clock: parseWorkTimeMinutes(row[5]),
              clockCount: Number(row[6] || 0) || 0,
              checkinLateMinutes: parseWorkTimeMinutes(row[7]),
              checkinLateCount: Number(row[8] || 0) || 0,
              checkoutEarlyMinutes: parseWorkTimeMinutes(row[9]),
              checkoutEarlyCount: Number(row[10] || 0) || 0,
              checkoutOvertimeMinutes: parseWorkTimeMinutes(row[11]),
              checkoutOvertimeCount: Number(row[12] || 0) || 0,
              absentCount: Number(row[13] || 0) || 0,
              leaveCount: Number(row[14] || 0) || 0,
              A: row[15] || '',
              Plech: row[16] || '',
              year,
              month
            });
          }

          setData(rows);

          // Save into /attendance/summary with year, month only
          api
            .post('/attendance/summary', rows)
            .then(() => {
              // reload from DB so UI reflects canonical data
              load();
            })
            .catch((err3) => {
              console.error('Save summary failed', err3);
            });
        } catch (err2) {
          console.error('Import failed', err2);
          alert('Import failed: ' + err2.message);
        } finally {
          setImporting(false);
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setImporting(false);
        setLoading(false);
        alert('មិនអាចអានឯកសារ Excel បានទេ');
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('Import failed', err);
      setImporting(false);
      setLoading(false);
      alert('Import failed: ' + err.message);
    }
  };

  const doPrint = () => {
    try {
      if (typeof window !== 'undefined' && window.print) {
        window.print();
      }
    } catch (e) {
      console.error('Print failed', e);
    }
  };

  if (!canViewAttendanceMonthlyData) {
    return <div className="p-4">មិនមានការអនុញ្ញាត</div>;
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Khmer OS, Arial' }}>
      <h1 className="text-lg font-semibold mb-4">សរុបវត្តមានតាមចន្លោះថ្ងៃ (Attendance Summary by Range)</h1>

      <div className="flex gap-4 mb-4 flex-wrap no-print">
        <div className="text-sm" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="text-sm block mb-1">ប្រចាំខែ</label>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="text-sm block mb-2">ស្វែងរក</label>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Staff ID / ឈ្មោះ"
              style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12, minWidth: 220 }}
            />
          </div>
        </div>

        <div>
          <button
            onClick={handleExportExcel}
            className="border rounded px-3 py-1 bg-green-600 text-white hover:bg-green-700"
          >
            នាំចេញ Excel
          </button>
        </div>

        <div>
          <label className="border rounded px-3 py-1 bg-orange-600 text-white cursor-pointer hover:bg-orange-700 inline-block">
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              disabled={importing || loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handleImportExcel(file);
              }}
            />
          </label>
        </div>

        <div>
          <button
            onClick={doPrint}
            className="border rounded px-3 py-1 bg-gray-600 text-white hover:bg-gray-700"
          >
            ព្រីន
          </button>
        </div>
      </div>

      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fff'
        }}
      >
        <div className="no-print" style={{ padding: 8, borderBottom: '1px solid #e5e7eb', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            បង្ហាញ: <b>{totalFiltered === 0 ? 0 : startIndex + 1}-{endIndex}</b> / {totalFiltered}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>បង្ហាញម្តង:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value) || 20;
                setPageSize(next);
                setPage(1);
              }}
              style={{ padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, background: safePage <= 1 ? '#f3f4f6' : '#fff' }}
            >
              ◀
            </button>
            <div>
              ទំព័រ <b>{safePage}</b> / {totalPages}
            </div>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '2px 8px', border: '1px solid #ccc', borderRadius: 4, background: safePage >= totalPages ? '#f3f4f6' : '#fff' }}
            >
              ▶
            </button>
          </div>
          {loading && <div>Loading...</div>}
        </div>

        <table
          style={{
            minWidth: 1000,
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: 11
          }}
        >
          <thead>
            <tr style={{ background: '#FFE6E6' }}>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Staff ID</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>khmerName</th>
              <th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Day Work</th>
              <th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Attendance</th>
              <th colSpan={1} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Work Time</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Clock</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Checkin Late</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Checkout Early</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>Checkout Overtime</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Absent</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>លទ្ធផលវាយតម្លៃ</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Leave</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>A</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Plech</th>
            </tr>
            <tr style={{ background: '#FFE6E6' }}>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={18} style={{ padding: 12, textAlign: 'center', color: '#6b7280' }}>
                  {loading ? 'កំពុងផ្ទុក...' : 'គ្មានទិន្នន័យ'}
                </td>
              </tr>
            ) : (
              pageData.map((rec) => {
                if (typeof window !== 'undefined') console.log('DEBUG rec:', rec);
                return (
                  <tr key={rec.staffId}>
                    <td style={{ border: '1px solid #000', padding: 6, whiteSpace: 'nowrap' }}>{rec.staffId}</td>
                    <td style={{ border: '1px solid #000', padding: 6, minWidth: 180 }}>{rec.name}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.dayWorkCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.attendanceCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.workTime)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.clock)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.clockCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.checkinLateMinutes)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkinLateCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.checkoutEarlyMinutes)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkoutEarlyCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{formatWorkTime(rec.checkoutOvertimeMinutes)}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.checkoutOvertimeCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.absentCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center', background: '#ffff99', color: '#d00' }}>{rec.performanceResult || 'NO DATA'}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.leaveCount}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.A}</td>
                    <td style={{ border: '1px solid #000', padding: 6, textAlign: 'center' }}>{rec.Plech}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
