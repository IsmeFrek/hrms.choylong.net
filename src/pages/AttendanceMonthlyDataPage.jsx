import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import usePermission from '../hooks/usePermission';

export default function AttendanceMonthlyDataPage() {
  const { canViewAttendanceMonthlyData } = usePermission();

  const pad2 = (n) => String(n).padStart(2, '0');

  // Use LOCAL date (not UTC) to avoid off-by-one day when backend stores local-midnight dates.
  // Example: 2026-02-02 00:00 (+07) is stored as 2026-02-01T17:00:00.000Z.
  const ymdLocal = (v) => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  
  // Local state and refs (ensure these are defined)
  const [dateFromDate, setDateFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateToDate, setDateToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const from = new Date(dateFromDate);
  const to = new Date(dateToDate);
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date(dateFromDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const [lastImportStats, setLastImportStats] = useState(null);

  const [searchText, setSearchText] = useState('');
  const [filterFlags, setFilterFlags] = useState({
    present: false,
    absent: false,
    leave: false,
    late: false,
    early: false,
    forgot: false,
    notWorking: false
  });

  const PAGE_SIZES = [10, 20, 50, 100, 200, 500];
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Format work time as "Hh Mm" (e.g., 245h 26m)
  const formatWorkTime = (val) => {
    if (val === null || typeof val === 'undefined' || val === '') return '';
    let n = Number(val);
    if (isNaN(n)) return String(val);
    // If value is less than 24, treat as hours (legacy decimal hours)
    if (n < 24 && n !== 0 && String(val).indexOf('.') !== -1) {
      const h = Math.floor(n);
      const m = Math.round((n - h) * 60);
      return `${h}h ${m}m`;
    }
    // Otherwise treat as minutes
    const h = Math.floor(Math.abs(n) / 60);
    const m = Math.abs(n) % 60;
    return `${n < 0 ? '-' : ''}${h}h ${m}m`;
  };

  const getDayCellBackground = (dayData) => {
    if (!dayData) return 'white';

    const ci = (dayData.checkIn || '').toString().trim();
    const co = (dayData.checkOut || '').toString().trim();
    const status = (dayData.status || '').toString().toLowerCase();

    // Full times: no color
    if (ci && co) return 'white';

    // Leave: yellow
    if (status === 'leave') return '#FFFACD';

    // Rest/day-off: blue (supported if such statuses exist)
    if (status === 'rest' || status === 'dayoff' || status === 'off' || status === 'holiday') return '#ADD8E6';

    // Scan-in only: green
    if (ci && !co) return '#90EE90';

    return 'white';
  };
  
  // Load data on mount and when date range changes
  useEffect(() => {
    // Keep monthYear in sync with dateFromDate
    try {
      const d = new Date(dateFromDate);
      setMonthYear(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    } catch (e) {
      // ignore
    }
    load();
  }, [dateFromDate, dateToDate]);

  const load = async () => {
    setLoading(true);
    try {
      // Try to fetch monthly aggregated data (falls back gracefully on error)
      const res = await api.get('/attendance/monthly-data', {
        params: { year: new Date(dateFromDate).getFullYear(), month: new Date(dateFromDate).getMonth() + 1 }
      });
      setData(res.data || []);
    } catch (err) {
      console.error('Load failed:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Modal state for data-entry form
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('day'); // 'day' or 'summary'
  const [modalData, setModalData] = useState(null);

  const openDayModal = (rec, dayEntry) => {
    setModalType('day');
    setModalData({
      staffId: rec.staffId,
      name: rec.name || '',
      year: rec.year || new Date(dateFromDate).getFullYear(),
      month: rec.month || (new Date(dateFromDate).getMonth() + 1),
      day: dayEntry.day,
      _id: dayEntry._id,
      checkIn: dayEntry.checkIn || '',
      checkOut: dayEntry.checkOut || ''
    });
    setModalOpen(true);
  };

  const openSummaryModal = (rec) => {
    setModalType('summary');
    setModalData({
      staffId: rec.staffId,
      name: rec.name || '',
      year: rec.year || new Date(dateFromDate).getFullYear(),
      month: rec.month || (new Date(dateFromDate).getMonth() + 1),
      leaveType: rec.leaveType || '',
      other: rec.other || '',
      totalLeaveComment: rec.totalLeaveComment || '',
      dayWorkCount: rec.dayWorkCount || 0,
      attendanceCount: rec.attendanceCount || 0,
      workTime: rec.workTime || '',
      checkinLateCount: rec.checkinLateCount || 0,
      checkoutEarlyCount: rec.checkoutEarlyCount || 0,
      checkoutOvertimeCount: rec.checkoutOvertimeCount || 0,
      checkoutOvertimeMinutes: rec.checkoutOvertimeMinutes || 0,
      absentCount: rec.absentCount || 0,
      leaveCount: rec.leaveCount || 0,
      A: rec.A || '',
      plech: rec.plech ?? rec.Plech ?? ''
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setModalData(null); };

  const saveModal = async () => {
    try {
      if (modalType === 'day') {
        const d = modalData;
        if (d._id) {
          await api.put(`/attendance/${d._id}`, { checkIn: d.checkIn, checkOut: d.checkOut });
        } else {
          const dateObj = new Date(Number(d.year), Number(d.month) - 1, Number(d.day));
          await api.post('/attendance', { staffId: d.staffId, date: dateObj.toISOString(), checkIn: d.checkIn, checkOut: d.checkOut });
        }
      } else {
        const p = {
          staffId: modalData.staffId,
          name: modalData.name || '',
          year: Number(modalData.year),
          month: Number(modalData.month),
          leaveType: modalData.leaveType || '',
          other: modalData.other || '',
          totalLeaveComment: modalData.totalLeaveComment || '',
          dayWorkCount: Number(modalData.dayWorkCount) || 0,
          attendanceCount: Number(modalData.attendanceCount) || 0,
          workTime: Number(modalData.workTime) || 0,
          checkinLateCount: Number(modalData.checkinLateCount) || 0,
          checkoutEarlyCount: Number(modalData.checkoutEarlyCount) || 0,
          checkoutOvertimeCount: Number(modalData.checkoutOvertimeCount) || 0,
          checkoutOvertimeMinutes: Number(modalData.checkoutOvertimeMinutes) || 0,
          absentCount: Number(modalData.absentCount) || 0,
          leaveCount: Number(modalData.leaveCount) || 0,
          A: modalData.A || '',
          plech: modalData.plech ?? modalData.Plech ?? ''
        };
        await api.post('/attendance/monthly-data', [p]);
      }
      closeModal();
      await load();
    } catch (err) {
      console.error('Save failed', err);
      alert('Save failed: ' + err.message);
    }
  };
      
  const exportExcel = () => {
    try {
      
      const dates = [];
      let current = new Date(from);
      while (current <= to) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      const dateRangeLabel = `${from.toLocaleDateString('en-US')} to ${to.toLocaleDateString('en-US')}`;
      
      // Use actual data or sample data if empty
      const exportData = data.length > 0 ? data : [
        {
          staffId: 'EMP001',
          name: 'Sample Employee 1',
          dailyData: [
            { day: 1, checkIn: '08:00', checkOut: '17:00' },
            { day: 2, checkIn: '08:15', checkOut: '17:30' },
            { day: 3, checkIn: '08:00', checkOut: '17:00' }
          ],
          dayWorkCount: 3,
          attendanceCount: 3,
          workTime: '24',
          clock: '45',
          clockCount: 1,
          checkinLateMinutes: 15,
          checkinLateCount: 1,
          checkoutEarlyMinutes: 0,
          checkoutEarlyCount: 0,
          checkoutOvertimeMinutes: 30,
          checkoutOvertimeCount: 1,
          absentCount: 0,
          leaveCount: 0
        }
      ];

      // Build header (match screenshot fields)
      // Summary fields:
      // - Day Work: Count
      // - Attendance: Q-mn
      // - Work Time: Q-mn
      // - Clock: Q-mn
      // - Checkin Late: Count + Q-mn
      // - Checkout Early: Count + Q-mn
      // - Checkout Overtime: Count + Q-mn
      // - Absent, Leave, A, Plech
      const headerRow1 = [
        'Staff ID',
        'Name',
        ...dates.map(d => d.getDate()),
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
        'Plech'
      ];
      const headerRow2 = [
        '',
        '',
        ...dates.map(() => 'Check in - Check out'),
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
        ''
      ];
      
      // Build data rows
      const rows = [
        [`Detail Report Payroll ${dateRangeLabel}`, ...Array(headerRow1.length - 1).fill('')],
        headerRow1,
        headerRow2,
        ...exportData.map(record => {
          const row = [record.staffId || '', record.name || ''];
          
          // Add daily data for all dates in range
          for (const dt of dates) {
            const dayNum = dt.getDate();
            const dtStr = ymdLocal(dt);
            const dayData = record.dailyData?.find(dd => {
              if (dd?.date) return ymdLocal(dd.date) === dtStr;
              return dd?.day === dayNum;
            });
            if (!dayData) {
              row.push('');
            } else if (dayData.checkIn && dayData.checkOut) {
              row.push(`${dayData.checkIn} - ${dayData.checkOut}`);
            } else {
              row.push(dayData.checkIn || dayData.checkOut || '');
            }
          }
          
          // Add summaries
          row.push(record.dayWorkCount || '');
          row.push(record.attendanceCount || '');
          row.push(record.workTime || '');
          row.push(record.clock || '');
          row.push(record.clockCount || '');
          row.push(record.checkinLateMinutes || '');
          row.push(record.checkinLateCount || '');
          row.push(record.checkoutEarlyMinutes || '');
          row.push(record.checkoutEarlyCount || '');
          row.push(record.checkoutOvertimeMinutes || '');
          row.push(record.checkoutOvertimeCount || '');
          row.push(record.absentCount || '');
          row.push(record.leaveCount || '');
          row.push(record.A || '');
          row.push(record.Plech || '');
          
          return row;
        })
      ];
      
      // Create sheet
      const ws = XLSX.utils.aoa_to_sheet(rows);
      
      // Add borders and styling
      const borders = {
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } }
      };
      
      const baseFont = { name: 'Times New Roman', sz: 12 };
      const centerAlignment = { horizontal: 'center', vertical: 'center', wrapText: true };
      
      // Style all cells
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const cellRef = XLSX.utils.encode_col(c) + (r + 1);
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
          
          ws[cellRef].s = {
            font: baseFont,
            alignment: centerAlignment,
            border: borders
          };
          
          // Header rows background
          if (r < 3) {
            ws[cellRef].s.fill = { fgColor: { rgb: 'FFE6E6' } };
          }
        }
      }
      
      // Set column widths
      const colWidths = [12, 15, ...Array(dates.length).fill(15), 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10, 10];
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Data');
      const fromStr = dateFromDate.replace(/-/g, '');
      const toStr = dateToDate.replace(/-/g, '');
      XLSX.writeFile(wb, `AttendanceMonthlyData_${fromStr}_to_${toStr}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + err.message);
    }
  };

  ;
  const importExcel = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      if (!raw || raw.length < 3) {
        alert('Invalid file format');
        return;
      }
      
      // Find header row
      let headerRowIdx = 1;
      const headers = raw[headerRowIdx];
      const subHeaders = raw[headerRowIdx + 1] || [];

      const findColIndex = (label) => {
        const target = String(label).trim().toLowerCase();
        return (headers || []).findIndex(h => String(h).trim().toLowerCase() === target);
      };

      // Determine how many Daily columns exist in the file by locating "Day Work"
      // File structure: Staff ID, Name, [Daily...], Day Work, Attendance, ...
      const dayWorkIdxInFile = findColIndex('Day Work');
      const dailyStartIdx = 2;
      const dailyColCount = dayWorkIdxInFile > dailyStartIdx ? (dayWorkIdxInFile - dailyStartIdx) : null;

      const excelValueToTime = (v) => {
        if (v === null || typeof v === 'undefined' || v === '') return '';
        if (v instanceof Date) {
          const hh = String(v.getHours()).padStart(2, '0');
          const mm = String(v.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        }
        if (typeof v === 'number' && isFinite(v)) {
          // Excel time might be stored as a fraction of a day (or as a date serial with fractional part)
          const frac = ((v % 1) + 1) % 1;
          const totalMinutes = Math.round(frac * 24 * 60);
          const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
          const mm = String(totalMinutes % 60).padStart(2, '0');
          return `${hh}:${mm}`;
        }
        return String(v).trim();
      };

      const toNumber = (v) => {
        if (v === null || typeof v === 'undefined' || v === '') return 0;
        if (typeof v === 'number' && isFinite(v)) return v;
        const s = String(v).trim();
        if (!s) return 0;
        const n = Number(s);
        return isFinite(n) ? n : 0;
      };

      const parseWorkTimeMinutes = (v) => {
        if (v === null || typeof v === 'undefined' || v === '') return 0;
        if (typeof v === 'number' && isFinite(v)) return v;
        const s = String(v).trim();
        if (!s) return 0;
        // Formats like "8h 35m" or "8h35m"
        const hm = s.match(/^(\d+)\s*h\s*(\d+)?\s*m?$/i);
        if (hm) {
          const h = Number(hm[1] || 0);
          const m = Number(hm[2] || 0);
          return h * 60 + m;
        }
        // Formats like "08:35" meaning hours:minutes
        const colon = s.match(/^(\d{1,2}):(\d{2})$/);
        if (colon) {
          return Number(colon[1]) * 60 + Number(colon[2]);
        }
        return toNumber(s);
      };
      
      // Parse records
      const [year, month] = monthYear.split('-');
      const daysInMonth = new Date(year, month, 0).getDate();
      let imported = 0;
      let totalRows = 0;
      let skippedRows = 0;
      const recordsToSend = [];
      const seenStaffIds = new Set();
      let duplicateStaffIds = 0;

      // Summary columns start right after: StaffId, Name, then day columns
      const effectiveDailyColCount = dailyColCount ?? daysInMonth;
      const summaryStartIdx = dayWorkIdxInFile > 0 ? dayWorkIdxInFile : (2 + effectiveDailyColCount);
      // Backward-compatible: some exports have two "Clock" columns (Clock Q-mn + Clock Count)
      const hasClockCountColumn =
        headers?.[summaryStartIdx + 3] === 'Clock' &&
        headers?.[summaryStartIdx + 4] === 'Clock';

      const parseQmnCountPair = (rowArr, startIdx) => {
        const first = String(subHeaders?.[startIdx] ?? '').trim().toLowerCase();
        // Prefer Q-mn first when present
        const isQmnFirst = first === 'q-mn' || first.includes('q-mn');
        if (isQmnFirst) {
          return { minutes: rowArr?.[startIdx] ?? 0, count: rowArr?.[startIdx + 1] ?? 0 };
        }
        return { count: rowArr?.[startIdx] ?? 0, minutes: rowArr?.[startIdx + 1] ?? 0 };
      };
      
      // Data starts after title row + headerRow1 + headerRow2
      for (let r = headerRowIdx + 2; r < raw.length; r++) {
        const row = raw[r];
        if (!row || !row[0]) continue;
        
        const staffId = String(row[0] || '').trim();
        if (!staffId) continue;

        totalRows++;
        if (seenStaffIds.has(staffId)) duplicateStaffIds++;
        seenStaffIds.add(staffId);
        
        const record = {
          staffId,
          name: row[1] || '',
          dailyData: [],
          dayWorkCount: toNumber(row[summaryStartIdx]),
          attendanceCount: toNumber(row[summaryStartIdx + 1]),
          workTime: parseWorkTimeMinutes(row[summaryStartIdx + 2]),
          clock: toNumber(row[summaryStartIdx + 3]),
          clockCount: hasClockCountColumn ? toNumber(row[summaryStartIdx + 4]) : 0,
          checkinLateCount: 0,
          checkinLateMinutes: 0,
          checkoutEarlyCount: 0,
          checkoutEarlyMinutes: 0,
          checkoutOvertimeCount: 0,
          checkoutOvertimeMinutes: 0,
          absentCount: 0,
          leaveCount: 0,
          A: '',
          plech: '',
          month: parseInt(month),
          year: parseInt(year)
        };

        // Pairs can be either (Q-mn, Count) or (Count, Q-mn) depending on export
        const lateStart = hasClockCountColumn ? (summaryStartIdx + 5) : (summaryStartIdx + 4);
        const earlyStart = lateStart + 2;
        const overtimeStart = earlyStart + 2;

        const latePair = parseQmnCountPair(row, lateStart);
        const earlyPair = parseQmnCountPair(row, earlyStart);
        const overtimePair = parseQmnCountPair(row, overtimeStart);

        record.checkinLateCount = toNumber(latePair.count);
        record.checkinLateMinutes = parseWorkTimeMinutes(latePair.minutes);
        record.checkoutEarlyCount = toNumber(earlyPair.count);
        record.checkoutEarlyMinutes = parseWorkTimeMinutes(earlyPair.minutes);
        record.checkoutOvertimeCount = toNumber(overtimePair.count);
        record.checkoutOvertimeMinutes = parseWorkTimeMinutes(overtimePair.minutes);

        const tailStart = overtimeStart + 2;
        record.absentCount = toNumber(row[tailStart]);
        record.leaveCount = toNumber(row[tailStart + 1]);
        record.A = row[tailStart + 2] || '';
        record.Plech = row[tailStart + 3] || '';
        
        // Parse daily data
        for (let i = 0; i < effectiveDailyColCount; i++) {
          const colIdx = dailyStartIdx + i;
          const cellVal = row[colIdx];
          if (cellVal === null || typeof cellVal === 'undefined' || cellVal === '') continue;

          const text = excelValueToTime(cellVal);
          if (!text) continue;

          // Allow formats like "08:00 - 17:00" or "08:00-17:00" or using en/em dash
          const parts = String(text)
            .split(/\s*(?:-|–|—)\s*/)
            .map(s => String(s).trim())
            .filter(Boolean);

          record.dailyData.push({
            day: Number(headers?.[colIdx]) || (i + 1),
            checkIn: parts[0] || '',
            checkOut: parts[1] || ''
          });
        }

        recordsToSend.push(record);
      }

      // Send in batches (more reliable for large Excel files)
      const batchSize = 200;
      for (let i = 0; i < recordsToSend.length; i += batchSize) {
        const batch = recordsToSend.slice(i, i + batchSize);
        try {
          await api.post('/attendance/monthly-data', batch);
          imported += batch.length;
        } catch (err) {
          console.error('Failed to import batch', { start: i, size: batch.length }, err);
          // Fallback: try per-record so we don't lose all
          for (let j = 0; j < batch.length; j++) {
            try {
              await api.post('/attendance/monthly-data', batch[j]);
              imported++;
            } catch (e2) {
              skippedRows++;
              console.error('Failed to import record', batch[j]?.staffId, e2);
            }
          }
        }
      }
      
      await load();
      setLastImportStats({
        fileName: file?.name || '',
        totalRows,
        imported,
        uniqueStaffIds: seenStaffIds.size,
        duplicateStaffIds,
        skippedRows,
        when: new Date().toISOString()
      });
      alert(`Imported ${imported} records`);
    } catch (err) {
      console.error(err);
      alert('Import failed: ' + err.message);
    }
  };

  const doPrint = () => {
    window.print();
  };

  const handleEdit = async (rec) => {
    try {
      const workTime = window.prompt('Work Time (Q-mn)', rec.workTime || '');
      if (workTime === null) return;
      const clock = window.prompt('Clock', rec.clock || '0');
      if (clock === null) return;
      const clockCount = window.prompt('Clock Count', String(rec.clockCount || 0));
      if (clockCount === null) return;

      const payload = {
        staffId: rec.staffId,
        name: rec.name || '',
        year: rec.year || new Date(dateFromDate).getFullYear(),
        month: rec.month || (new Date(dateFromDate).getMonth() + 1),
        workTime: Number(workTime) || 0,
        clock: Number(clock) || 0,
        clockCount: Number(clockCount) || 0,
        checkinLateMinutes: rec.checkinLateMinutes || 0,
        checkinLateCount: rec.checkinLateCount || 0,
        checkoutEarlyMinutes: rec.checkoutEarlyMinutes || 0,
        checkoutEarlyCount: rec.checkoutEarlyCount || 0,
        checkoutOvertimeMinutes: rec.checkoutOvertimeMinutes || 0,
        checkoutOvertimeCount: rec.checkoutOvertimeCount || 0,
        absentCount: rec.absentCount || 0,
        leaveCount: rec.leaveCount || 0
      };

      await api.post('/attendance/monthly-data', [payload]);
      await load();
      alert('Saved');
    } catch (err) {
      console.error('Edit failed', err);
      alert('Edit failed: ' + err.message);
    }
  };

  const handleDelete = async (rec) => {
    try {
      if (!window.confirm(`Delete monthly attendance for ${rec.staffId} ${rec.month}/${rec.year}? This will remove per-day attendance and monthly summary for this staff.`)) return;
      await api.delete('/attendance/monthly-data', { params: { staffId: rec.staffId, year: rec.year || new Date(dateFromDate).getFullYear(), month: rec.month || (new Date(dateFromDate).getMonth() + 1) } });
      await load();
      alert('Deleted');
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed: ' + err.message);
    }
  };

  const handleEditDay = async (rec, dayEntry) => {
    try {
      const checkIn = window.prompt('Check In (HH:MM)', dayEntry.checkIn || '');
      if (checkIn === null) return;
      const checkOut = window.prompt('Check Out (HH:MM)', dayEntry.checkOut || '');
      if (checkOut === null) return;

      if (dayEntry._id) {
        await api.put(`/attendance/${dayEntry._id}`, { checkIn, checkOut });
      } else {
        // create a new attendance record for that date
        const year = rec.year || new Date(dateFromDate).getFullYear();
        const month = (rec.month || (new Date(dateFromDate).getMonth() + 1));
        const dateObj = new Date(Number(year), Number(month) - 1, Number(dayEntry.day));
        await api.post('/attendance', { staffId: rec.staffId, date: dateObj.toISOString(), checkIn, checkOut });
      }
      await load();
    } catch (err) {
      console.error('Edit day failed', err);
      alert('Edit day failed: ' + err.message);
    }
  };

  const handleDeleteDay = async (rec, dayEntry) => {
    try {
      if (!dayEntry._id) {
        alert('No attendance record to delete');
        return;
      }
      if (!window.confirm(`Delete attendance for ${rec.staffId} on day ${dayEntry.day}?`)) return;
      await api.delete(`/attendance/${dayEntry._id}`);
      await load();
    } catch (err) {
      console.error('Delete day failed', err);
      alert('Delete day failed: ' + err.message);
    }
  };

  const handleDeleteAllByDate = async () => {
    try {
      const defaultDate = (dateFromDate && dateToDate && dateFromDate === dateToDate) ? dateFromDate : (dateFromDate || new Date().toISOString().slice(0, 10));
      const dateStr = (dateFromDate && dateToDate && dateFromDate === dateToDate)
        ? dateFromDate
        : (window.prompt('លុបទិន្នន័យតាមថ្ងៃ (YYYY-MM-DD):', defaultDate) || '').trim();

      if (!dateStr) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        alert('ថ្ងៃខែឆ្នាំមិនត្រឹមត្រូវ (YYYY-MM-DD)');
        return;
      }
      if (!window.confirm(`ចង់លុបទិន្នន័យទាំងអស់សម្រាប់ថ្ងៃទី ${dateStr} មែនទេ?`)) return;

      const res = await api.delete('/attendance/day-data', { params: { date: dateStr } });
      const info = res?.data || {};
      alert(
        `លុបទិន្នន័យសម្រេច!\n` +
        `Date: ${dateStr}\n` +
        `Attendance deleted: ${info.attendanceDeleted ?? 0}\n` +
        `DayData deleted: ${info.dayDataDeleted ?? 0}`
      );
      await load();
    } catch (err) {
      console.error('Delete all by date failed', err);
      alert('Delete failed: ' + (err?.response?.data?.message || err.message));
    }
  };

  // Get date range for display
  const getDisplayDates = () => {
    const from = new Date(dateFromDate);
    const to = new Date(dateToDate);
    const dates = [];
    
    if (from > to) return dates;
    
    let current = new Date(from);
    while (current <= to) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };
  
  const displayDates = getDisplayDates();

  const recordMatchesFilters = (record) => {
    const flags = filterFlags;
    const anyFlagOn = Object.values(flags).some(Boolean);

    const staffId = String(record?.staffId || '').toLowerCase();
    const name = String(record?.name || record?.khmerName || record?.staffName || '').toLowerCase();
    const q = String(searchText || '').trim().toLowerCase();
    const matchesText = !q || staffId.includes(q) || name.includes(q);
    if (!matchesText) return false;

    if (!anyFlagOn) return true;

    const num = (v) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    const hasAnyTime = Array.isArray(record?.dailyData)
      ? record.dailyData.some(d => d && (d.checkIn || d.checkOut))
      : false;

    const isPresent = num(record?.attendanceCount) > 0 || hasAnyTime;
    const isAbsent = num(record?.absentCount) > 0;
    const isLeave = num(record?.leaveCount) > 0;
    const isLate = num(record?.checkinLateCount) > 0 || num(record?.checkinLateMinutes) > 0;
    const isEarly = num(record?.checkoutEarlyCount) > 0 || num(record?.checkoutEarlyMinutes) > 0;
    const isPlech = num(record?.plech) > 0;
    const isNotWorking = !isPresent && !isAbsent && !isLeave && num(record?.dayWorkCount) === 0;

    return (
      (flags.present && isPresent) ||
      (flags.absent && isAbsent) ||
      (flags.leave && isLeave) ||
      (flags.late && isLate) ||
      (flags.early && isEarly) ||
      (flags.Plech && isForgot) ||
      (flags.notWorking && isNotWorking)
    );
  };

  const filteredData = Array.isArray(data) ? data.filter(recordMatchesFilters) : [];

  // Reset to first page when filters/search/range changes.
  useEffect(() => {
    setPage(1);
  }, [searchText, filterFlags, dateFromDate, dateToDate]);

  const totalFiltered = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const pagedData = filteredData.slice(startIndex, endIndex);

  if (!canViewAttendanceMonthlyData) {
    return <div className="p-4">មិនមានការអនុញ្ញាត</div>;
  }

  return (
    <div className="p-4" style={{ fontFamily: 'Khmer OS, Arial' }}>
      <h1>ទិន្នន័យវត្តមានប្រចាំខែ (Monthly Attendance Data)</h1>
      {modalOpen && modalData && (
        <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 6, minWidth: 360 }}>
            <h3 style={{ marginTop: 0 }}>{modalType === 'day' ? 'Edit Daily Attendance' : 'Edit Monthly Summary'}</h3>
            {modalType === 'day' ? (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 12 }}>Staff</label>
                  <div>{modalData.staffId} - {modalData.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12 }}>Day</label>
                    <div>{modalData.day}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12 }}>Check In</label>
                    <input value={modalData.checkIn} onChange={(e) => setModalData({...modalData, checkIn: e.target.value})} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12 }}>Check Out</label>
                    <input value={modalData.checkOut} onChange={(e) => setModalData({...modalData, checkOut: e.target.value})} />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 12 }}>Staff</label>
                  <div>{modalData.staffId} - {modalData.name}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>ប្រភេទច្បាប់ឈប់សម្រាក</label>
                    <input value={modalData.leaveType} onChange={(e) => setModalData({...modalData, leaveType: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>ផ្សេងៗ</label>
                    <input value={modalData.other} onChange={(e) => setModalData({...modalData, other: e.target.value})} />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 12 }}>មតិ (លើអវត្តមាន/ច្បាប់)</label>
                  <input value={modalData.totalLeaveComment} onChange={(e) => setModalData({...modalData, totalLeaveComment: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Day Work</label>
                    <input value={modalData.dayWorkCount} onChange={(e) => setModalData({...modalData, dayWorkCount: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Attendance</label>
                    <input value={modalData.attendanceCount} onChange={(e) => setModalData({...modalData, attendanceCount: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Work Time (minutes)</label>
                    <input value={modalData.workTime} onChange={(e) => setModalData({...modalData, workTime: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Checkin Late (count)</label>
                    <input value={modalData.checkinLateCount} onChange={(e) => setModalData({...modalData, checkinLateCount: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Checkout Early (count)</label>
                    <input value={modalData.checkoutEarlyCount} onChange={(e) => setModalData({...modalData, checkoutEarlyCount: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Checkout Overtime (count)</label>
                    <input value={modalData.checkoutOvertimeCount} onChange={(e) => setModalData({...modalData, checkoutOvertimeCount: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Checkout Overtime (minutes)</label>
                    <input value={modalData.checkoutOvertimeMinutes} onChange={(e) => setModalData({...modalData, checkoutOvertimeMinutes: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Absent</label>
                    <input value={modalData.absentCount} onChange={(e) => setModalData({...modalData, absentCount: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Leave</label>
                    <input value={modalData.leaveCount} onChange={(e) => setModalData({...modalData, leaveCount: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>A</label>
                    <input value={modalData.A} onChange={(e) => setModalData({...modalData, A: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12 }}>Plech</label>
                    <input value={modalData.plech} onChange={(e) => setModalData({...modalData, plech: e.target.value})} />
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={closeModal} className="border rounded px-3 py-1">Cancel</button>
              <button onClick={saveModal} className="border rounded px-3 py-1 bg-green-600 text-white">Save</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div>
            <label className="text-sm block mb-2">ថ្ងៃចាប់ផ្តើម</label>
            <input
              type="date"
              value={dateFromDate}
              onChange={(e) => setDateFromDate(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
            />
          </div>
          
          <span style={{ fontSize: 12 }}>ដល់</span>
          
          <div>
            <label className="text-sm block mb-2">ថ្ងៃបញ្ចប់</label>
            <input
              type="date"
              value={dateToDate}
              onChange={(e) => setDateToDate(e.target.value)}
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

          <div>
            <label className="text-sm block mb-2">Filter</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={filterFlags.present}
                  onChange={(e) => setFilterFlags(s => ({ ...s, present: e.target.checked }))}
                />
                វត្តមាន
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={filterFlags.absent}
                  onChange={(e) => setFilterFlags(s => ({ ...s, absent: e.target.checked }))}
                />
                អវត្តមាន
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={filterFlags.leave}
                  onChange={(e) => setFilterFlags(s => ({ ...s, leave: e.target.checked }))}
                />
                ច្បាប់
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={filterFlags.late}
                  onChange={(e) => setFilterFlags(s => ({ ...s, late: e.target.checked }))}
                />
                ចូលយឺត
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={filterFlags.early}
                  onChange={(e) => setFilterFlags(s => ({ ...s, early: e.target.checked }))}
                />
                ចេញមុន
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={filterFlags.forgot}
                  onChange={(e) => setFilterFlags(s => ({ ...s, forgot: e.target.checked }))}
                />
                ភ្លេច
              </label>
              <label
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                title="Day Work = 0 និងគ្មានវត្តមាន/អវត្តមាន/ច្បាប់"
              >
                <input
                  type="checkbox"
                  checked={filterFlags.notWorking}
                  onChange={(e) => setFilterFlags(s => ({ ...s, notWorking: e.target.checked }))}
                />
                សម្រាក
              </label>

              <button
                type="button"
                onClick={() => {
                  setSearchText('');
                  setFilterFlags({ present: false, absent: false, leave: false, late: false, early: false, forgot: false, notWorking: false });
                }}
                style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, background: '#f3f4f6' }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        
        <div>
          <button
            onClick={exportExcel}
            className="border rounded px-3 py-1 bg-green-600 text-white hover:bg-green-700"
          >
            នាំចេញ Excel
          </button>
        </div>

        <div>
          <button
            onClick={handleDeleteAllByDate}
            className="border rounded px-3 py-1 bg-red-600 text-white hover:bg-red-700"
            title="លុបទិន្នន័យវត្តមាន/ច្បាប់/ស្កេន (ទាំងអស់) សម្រាប់ថ្ងៃដែលបានជ្រើស"
          >
            លុបតាមថ្ងៃ
          </button>
        </div>
        
        <div>
          <label className="border rounded px-3 py-1 bg-orange-600 text-white cursor-pointer hover:bg-orange-700 inline-block">
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importExcel(file);
              }}
            />
          </label>
        </div>
        
        <div className="no-print">
          <button
            onClick={doPrint}
            className="border rounded px-3 py-1 bg-gray-600 text-white hover:bg-gray-700"
          >
            ព្រីន
          </button>
        </div>
      </div>

      {/* Data Table */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          table { font-size: 10px; }
          .page-break { page-break-after: always; }
        }
      `}</style>

      <div
        ref={containerRef}
        style={{
          overflowX: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fff'
        }}
      >
        <div className="no-print" style={{ padding: 8, borderBottom: '1px solid #e5e7eb', fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            បង្ហាញ: <b>{totalFiltered === 0 ? 0 : (startIndex + 1)}-{endIndex}</b> / {totalFiltered} (សរុប: {Array.isArray(data) ? data.length : 0})
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>បង្ហាញម្តង:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const next = Number(e.target.value) || 50;
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
          {lastImportStats && (
            <div>
              Excel: <b>{lastImportStats.totalRows}</b> row(s), Imported: <b>{lastImportStats.imported}</b>
              {typeof lastImportStats.uniqueStaffIds === 'number' ? `, Unique: ${lastImportStats.uniqueStaffIds}` : ''}
              {typeof lastImportStats.duplicateStaffIds === 'number' && lastImportStats.duplicateStaffIds > 0 ? `, Duplicates: ${lastImportStats.duplicateStaffIds}` : ''}
              {typeof lastImportStats.skippedRows === 'number' && lastImportStats.skippedRows > 0 ? `, Failed: ${lastImportStats.skippedRows}` : ''}
              {lastImportStats.fileName ? ` (${lastImportStats.fileName})` : ''}
              {totalFiltered < (Array.isArray(data) ? data.length : 0) ? ' — មាន Filter/ស្វែងរក កំពុងលាក់ខ្លះៗ' : ''}
            </div>
          )}
        </div>
        <table
          style={{
            minWidth: 1200,
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: 11
          }}
        >
          <thead>
            <tr style={{ background: '#FFE6E6' }}>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Staff ID</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>khmerName</th>
              <th colSpan={displayDates.length} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Daily
              </th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Day Work</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Attendance</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Work Time</th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Clock
              </th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Checkin Late
              </th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Checkout Early
              </th>
              <th colSpan={2} style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>
                Checkout Overtime
              </th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Absent</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Leave</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>A</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Plech</th>
              <th rowSpan={2} style={{ border: '1px solid #000', padding: 8 }}>Actions</th>
            </tr>
            <tr style={{ background: '#FFE6E6' }}>
              {/* first two headers use rowSpan=2, so no placeholders here */}
              {displayDates.map((dt, i) => (
                <th
                  key={i}
                  style={{ border: '1px solid #000', padding: 6, fontSize: 10, textAlign: 'center' }}
                  title="Check in - Check out"
                >
                  <div style={{ fontWeight: 700 }}>{dt.getDate()}</div>
                  <div style={{ fontSize: 9, opacity: 0.8 }}>Check in - Check out</div>
                </th>
              ))}
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Q-mn</th>
              <th style={{ border: '1px solid #000', padding: 8 }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={20}
                  style={{
                    border: '1px solid #e2e8f0',
                    padding: 8,
                    textAlign: 'center',
                    color: '#999'
                  }}
                >
                  {loading ? 'កំពុងផ្ទុក...' : 'គ្មានទិន្នន័យ'}
                </td>
              </tr>
            ) : (
              pagedData.map((record, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8 }}>{record.staffId}</td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8 }}>{record.name || record.khmerName || record.staffName}</td>
                  {displayDates.map((dt, i) => {
                    const dtStr = ymdLocal(dt);
                    const dayData = record.dailyData?.find(d => {
                      if (d?.date) return ymdLocal(d.date) === dtStr;
                      return d?.day === dt.getDate();
                    });
                    return (
                      <td
                        key={i}
                        onClick={() => dayData && openDayModal(record, dayData)}
                        onDoubleClick={() => dayData && handleDeleteDay(record, dayData)}
                        style={{
                          cursor: dayData ? 'pointer' : 'default',
                          border: '1px solid #e2e8f0',
                          padding: 8,
                          textAlign: 'center',
                          background: getDayCellBackground(dayData)
                        }}
                        title={dayData ? `Click to edit, double-click to delete${dayData.status ? ` | Status: ${dayData.status}` : ''}` : ''}
                      >
                        {dayData
                          ? (dayData.checkIn && dayData.checkOut)
                            ? `${dayData.checkIn} - ${dayData.checkOut}`
                            : (dayData.checkIn || dayData.checkOut || '-')
                          : '-'}
                      </td>
                    );
                  })}
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.dayWorkCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.attendanceCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.workTime)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.clock || 0}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.clockCount || 0}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.checkinLateMinutes)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.checkinLateCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.checkoutEarlyMinutes)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.checkoutEarlyCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {formatWorkTime(record.checkoutOvertimeMinutes)}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.checkoutOvertimeCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.absentCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.leaveCount}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.A || ''}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    {record.Plech || ''}
                  </td>
                  <td style={{ border: '1px solid #e2e8f0', padding: 8, textAlign: 'center' }}>
                    <button
                      onClick={() => openSummaryModal(record)}
                      className="mr-2 border rounded px-2 py-1 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(record)}
                      className="border rounded px-2 py-1 bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
