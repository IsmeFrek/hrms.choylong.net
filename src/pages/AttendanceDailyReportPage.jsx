import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { departmentAPI } from '../services/departmentAPI';
// Lucide icons removed for troubleshooting
import ManualPasteModal from '../components/ManualPasteModal';

const today = new Date().toISOString().slice(0, 10);

function parseHoursMinutes(workHours) {
  if (!workHours) return '';
  const n = Number(workHours);
  if (!isNaN(n) && n > 0) {
    const h = Math.floor(n);
    const m = Math.round((n - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return String(workHours);
}

export default function AttendanceDailyReportPage() {
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(today);
  const [categoryTypeId, setCategoryTypeId] = useState('all'); // Default ទាំងអស់
  const [selectedDept, setSelectedDept] = useState('all');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('filter') || 'all'); // 'all' | 'present' | 'absent' | 'late'
  const [syncResult, setSyncResult] = useState(null);
  const [syncDuration, setSyncDuration] = useState(0);
  const [allDepts, setAllDepts] = useState([]);
  const [hrTotalCount, setHrTotalCount] = useState(0); // Live count from HR
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [syncSettings, setSyncSettings] = useState({ sync_times: ['09:35'], auto_sync_enabled: true });
  const printRef = useRef(null);

  useEffect(() => {
    departmentAPI.getDepartments().then(res => {
      const data = res?.data || res;
      setAllDepts(Array.isArray(data) ? data : []);
    }).catch(console.error);

    // Fetch targeted headcount for Daily Report (Target 1539)
    api.get('/hr/stats/total-count').then(res => {
      setHrTotalCount(res.data?.count || 0);
    }).catch(console.error);

    // Load Sync Settings
    api.get('/report-settings/group/attendance-sync').then(res => {
      if (res.data?.ok) {
        const s = res.data.settings;
        if (!Array.isArray(s.sync_times)) {
          s.sync_times = [s.sync_time || '09:35'];
        }
        setSyncSettings(s);
      }
    }).catch(console.error);
  }, []);

  // Load records from local DB (attendance)
  const loadLocal = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/daily-report-list', { params: { date } });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('មិនអាចទាញទិន្នន័យ: ' + (err?.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Preview from Checkinme (no save)
  const previewFromCheckinme = async () => {
    setLoading(true);
    setSyncResult(null);
    try {
      const { data } = await api.get('/attendance/daily-report-preview', {
        params: { date, categoryTypeId }
      });
      if (data?.records) {
        setRecords(data.records);
        toast.success(`បង្ហាញទិន្នន័យ ${data.records.length} នាក់ពី Checkinme (មិនបានរក្សាទុក)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Preview failed: ' + (err?.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Sync & save from Checkinme
  const syncFromCheckinme = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncDuration(0);
    const startTime = Date.now();
    const timer = setInterval(() => {
      setSyncDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const { data } = await api.post('/attendance/sync-daily-report', {
        date, categoryTypeId
      });
      if (data.ok) {
        setSyncResult(data);
        const failed = data.failedCategories;
        if (failed && failed.length > 0) {
          toast.warning(`Sync បានខ្លះ! ប៉ុន្តែក្រុម ${failed.join(', ')} ខកខានដោយសារបញ្ហា Server Checkinme គាំង (Retried 3 times).`);
        } else {
          toast.success(`Sync បានជោគជ័យ! ${data.synced} នាក់ ថ្ងៃ ${date}`);
        }
        await loadLocal(); // Reload from DB
      } else {
        toast.warning(data.message || 'Sync ended with no data');
      }
    } catch (err) {
      console.error(err);
      toast.error('Sync failed: ' + (err?.response?.data?.message || err.message));
    } finally {
      clearInterval(timer);
      setSyncing(false);
    }
  };

  const handleManualSave = async (pastedRecords, result) => {
    // If called with a result object, it means the fast-sync was already done on server
    if (result && result.ok) {
      const msg = result.details ? `ទាញយកបានសរុប ${result.synced} នាក់ (${result.details})` : `ទាញយកបានសរុប ${result.synced} នាក់`;
      toast.success(msg);
      loadLocal();
      return;
    }

    // Fallback for empty calls (just reload)
    if (!pastedRecords) {
      loadLocal();
      return;
    }

    try {
      const { data } = await api.post('/attendance/bulk-save-manual', {
        date,
        records: pastedRecords
      });
      if (data.ok) {
        toast.success(`រក្សាទុកបានជោគជ័យ ${data.synced} នាក់ (បានជំនួសទិន្នន័យចាស់)`);
        loadLocal();
      }
    } catch (err) {
      console.error(err);
      toast.error('រក្សាទុកមិនបានសម្រេច: ' + (err?.response?.data?.message || err.message));
      throw err;
    }
  };

  const saveSyncSettings = async () => {
    try {
      const { data } = await api.post('/report-settings/group/attendance-sync', { settings: syncSettings });
      if (data.ok) {
        toast.success('រក្សាទុកការកំណត់ Auto Sync រួចរាល់');
        setIsSyncSettingsOpen(false);
      }
    } catch (err) {
      toast.error('រក្សាទុកមិនបានសម្រេច: ' + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    loadLocal();

    // Auto-refresh every 1 minute to catch background syncs
    const interval = setInterval(() => {
      // Only refresh if not already loading or syncing
      if (!loading && !syncing) {
        loadLocal();
      }
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [date, categoryTypeId]);

  // Helper: has check-in but no check-out = forgot to scan out
  // Helper: has check-in but no check-out = forgot to scan out (only if past check-out time)
  const forgotScan = (r) => {
    const ci = r.checkin1 || r.checkIn || '';
    const co = r.checkout1 || r.checkOut || '';

    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);
    const now = new Date();

    // Default cutoff: If no schedule, assume 5:30 PM + 4h buffer = 9:30 PM
    let cutoffTime = new Date(reportDate);
    cutoffTime.setHours(17, 30, 0, 0);
    cutoffTime.setTime(cutoffTime.getTime() + 4 * 60 * 60 * 1000);

    if (r.scheduledTime && r.scheduledTime !== '—' && r.scheduledTime.includes(' - ')) {
      const parts = r.scheduledTime.split(' - ');
      const startTimeStr = parts[0]?.trim();
      const endTimeStr = parts[1]?.trim();

      if (startTimeStr && endTimeStr && startTimeStr.includes(':') && endTimeStr.includes(':')) {
        const [sh] = startTimeStr.split(':').map(Number);
        const [eh, em] = endTimeStr.split(':').map(Number);

        if (!isNaN(sh) && !isNaN(eh)) {
          cutoffTime = new Date(reportDate);
          cutoffTime.setHours(eh, em || 0, 0, 0);

          // Overnight detection: 1. Start >= End (e.g. 19:00-07:00) 
          // 2. Very short same-day duration (e.g. 07:30-08:00) which in this hospital are 24.5h guards
          const durationMins = (eh * 60 + em) - (sh * 60);
          if (sh >= eh || (durationMins > 0 && durationMins < 180)) {
            cutoffTime.setDate(cutoffTime.getDate() + 1);
          }

          // Apply the user's requested 4-hour buffer
          cutoffTime.setTime(cutoffTime.getTime() + 4 * 60 * 60 * 1000);
        }
      }
    }

    // Only mark as "Forgot" if the current time has passed the cutoff (Shift End + 4 Hours)
    if (now < cutoffTime) return false;

    return ci && !co && r.status !== 'absent' && r.status !== 'leave' && r.status !== 'pending';
  };

  
  const isLateCheck = (checkin, scheduledTime) => {
    if (!checkin || !scheduledTime || scheduledTime === '—' || scheduledTime.includes('Day Off') || scheduledTime === 'មិនមានម៉ោង') return false;
    const timeToDec = (t) => {
      if (!t) return 0;
      const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!m) return 0;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h + (min / 60);
    };
    const tCheck = timeToDec(checkin);
    const startStr = scheduledTime.split('-')[0].trim();
    const tStart = timeToDec(startStr);
    if (tCheck === 0 || tStart === 0) return false;
    return tCheck > (tStart + 15/60); // 15 mins buffer
  };

  const isEarlyCheck = (checkout, scheduledTime) => {
    if (!checkout || !scheduledTime || scheduledTime === '—' || scheduledTime.includes('Day Off') || scheduledTime === 'មិនមានម៉ោង') return false;
    const timeToDec = (t) => {
      if (!t) return 0;
      const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!m) return 0;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h + (min / 60);
    };
    const tCheck = timeToDec(checkout);
    const endStr = scheduledTime.split('-').pop().trim();
    const tEnd = timeToDec(endStr);
    return tCheck > 0 && tEnd > 0 && tCheck < (tEnd - 2/60);
  };

  const calculateStatusGroup = (r) => {
    // 1. Holiday/DayOff and Leave have absolute priority if no scans exist
    // However, if they HAVE scans, they might be working on their day off
    const hasScans = !!(r.checkin1 || r.checkIn || r.checkout1 || r.checkOut);
    
    if (!hasScans) {
      if (r.status === 'holiday' || r.status === 'dayoff' || r.status === 'day_off') return 'holiday';
      if (r.status === 'leave') return 'leave';
    }

    // 2. If they have ANY scan, they are some form of "Present"
    if (hasScans) {
      const ci = r.checkin1 || r.checkIn;
      const co = r.checkout1 || r.checkOut;
      const sched = r.scheduledTime;

      if (r.plech === true || forgotScan(r)) return 'forgot';
      
      // Use local checks as ground truth if scans exist
      const late = isLateCheck(ci, sched);
      const early = isEarlyCheck(co, sched);

      if (late) return 'late';
      if (early) return 'early';
      
      return 'present';
    }

    // 3. No scans: Determine if they are "Pending" (not yet started) or "Absent"
    if (r.scheduledTime && r.scheduledTime !== '—' && !r.scheduledTime.includes('Day Off')) {
      const parts = String(r.scheduledTime).split(' - ');
      const startTimeStr = parts[0]?.trim();
      if (startTimeStr && startTimeStr.includes(':')) {
        const [h, m] = startTimeStr.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const now = new Date();
          const reportDate = new Date(date).setHours(0, 0, 0, 0);
          const today = new Date().setHours(0, 0, 0, 0);

          if (reportDate === today) {
            const currentTotal = now.getHours() * 60 + now.getMinutes();
            const startTotal = h * 60 + m;
            if (currentTotal < startTotal) {
              return 'pending'; // Shift hasn't started yet
            }
          } else if (reportDate > today) {
            return 'pending'; // Future date
          }
        }
      }
    }

    // 4. Default if no scans and shift already started or no schedule
    return (r.status === 'leave') ? 'leave' : 'absent';
  };

  const getSortScore = (r) => {
    const group = calculateStatusGroup(r);
    const orderMap = {
      'present': 1,
      'absent': 2,
      'leave': 3,
      'late': 4,
      'early': 5,
      'forgot': 6,
      'holiday': 7,
      'pending': 8,
    };
    return orderMap[group] || 99;
  };

  let filtered = (records || []).filter(r => {
    const name = String(r.staffName || r.name || r.staffCode || r.staffId || '').toLowerCase();
    const sid = String(r.staffId || r.staffCode || '').toLowerCase();
    const dept = String(r.department || '').toLowerCase();
    const cat = String(r.employeeCategory || '').toLowerCase();
    const qLow = q.toLowerCase();
    const matchQ = !q || name.includes(qLow) || sid.includes(qLow) || dept.includes(qLow) || cat.includes(qLow);

    // Department filter
    const matchDept = selectedDept === 'all' || r.department === selectedDept;

    const catMap = { '12': 'មន្ត្រីរាជការ', '13': 'កិច្ចសន្យារដ្ឋ', '14': 'កិច្ចសន្យាមន្ទីរពេទ្យ', '15': 'កម្មករកិច្ចសន្យា' };
    const rCat = String(r.employeeCategory || '').toLowerCase();
    let matchCategory = categoryTypeId === 'all';
    
    if (!matchCategory) {
      if (categoryTypeId === '12') {
        // Match multiple Khmer spelling variations for 'Civil Servant' (មន្ត្រីរាជការ / មន្រ្តីរាជការ)
        // and older labels like ក្របខណ្ឌ
        const isCivilServant = rCat.includes('មន្ត្រីរាជការ') || 
                              rCat.includes('មន្រ្តីរាជការ') || 
                              rCat.includes('ក្របខណ្ឌ') || 
                              rCat.includes('ក្របខ័ណ្ឌ') || 
                              rCat.includes('officer') || 
                              rCat.includes('civil');
        matchCategory = isCivilServant;
      } else {
        const target = String(catMap[categoryTypeId] || '').toLowerCase().trim();
        // Also support variations for other categories if needed
        matchCategory = rCat.includes(target);
      }
    }

    // Status filtering logic
    const group = calculateStatusGroup(r);
    let matchStatus = filterStatus === 'all' || group === filterStatus;

    // User requested that Late and Forgot Scan count as Present
    if (filterStatus === 'present') {
      matchStatus = ['present', 'late', 'forgot', 'early'].includes(group);
    }

    // If searching (q exists), let it override other filters for better discoverability
    if (matchQ && q.trim().length > 0) return true;

    return matchQ && matchStatus && matchCategory && matchDept;
  });


  // Map departments to their IDs for sorting (matching HR logic)
  const deptIdMap = new Map();
  allDepts.forEach(d => {
    const id = Number(d.Department_Id);
    if (!isNaN(id)) {
      if (d.Department_Kh) deptIdMap.set(String(d.Department_Kh).trim(), id);
      if (d.Department_En) deptIdMap.set(String(d.Department_En).trim(), id);
    }
  });

  // Sort them like HR (Department ID first, then No within department)
  filtered = [...filtered].sort((a, b) => {
    // If filtering by LEAVE, sort by Leave Type first
    if (filterStatus === 'leave') {
      const typeA = String(a.leaveType || '').trim();
      const typeB = String(b.leaveType || '').trim();
      if (typeA !== typeB) return typeA.localeCompare(typeB, 'km');
    }

    const deptA = String(a.department || '').trim();
    const deptB = String(b.department || '').trim();
    const idA = deptIdMap.get(deptA) || 9999;
    const idB = deptIdMap.get(deptB) || 9999;

    if (idA !== idB) return idA - idB;

    // Within same department, sort by No
    const noA = Number(a.no) || 100000;
    const noB = Number(b.no) || 100000;
    if (noA !== noB) return noA - noB;

    // Fallback: StaffId natural sort
    const sidA = String(a.staffId || a.staffCode || '');
    const sidB = String(b.staffId || b.staffCode || '');
    return sidA.localeCompare(sidB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Unique departments for filter, sorted by Department_Id
  const deptList = Array.from(new Set(records.map(r => r.department).filter(Boolean))).sort((a, b) => {
    const idA = deptIdMap.get(String(a).trim()) || 9999;
    const idB = deptIdMap.get(String(b).trim()) || 9999;
    if (idA !== idB) return idA - idB;
    return a.localeCompare(b, 'km');
  });

  const stats = {
    total: records.length, // All employees synced for this day
    filtered: filtered.length,
    present: records.filter(r => ['present', 'late', 'early', 'forgot'].includes(calculateStatusGroup(r))).length,
    absent: records.filter(r => calculateStatusGroup(r) === 'absent').length,
    leave: records.filter(r => calculateStatusGroup(r) === 'leave').length,
    holiday: records.filter(r => calculateStatusGroup(r) === 'holiday').length,
    pending: records.filter(r => calculateStatusGroup(r) === 'pending').length,
    late: records.filter(r => calculateStatusGroup(r) === 'late').length,
    early: records.filter(r => calculateStatusGroup(r) === 'early').length,
    forgot: records.filter(r => calculateStatusGroup(r) === 'forgot').length,
  };

  const exportExcel = () => {
    let headers = [];
    let rows = [];

    if (filterStatus === 'leave') {
      headers = ['#', 'លេខកាត', 'ឈ្មោះ', 'ប្រភេទមន្រ្តី', 'ផ្នែក', 'អ្នកគ្រប់គ្រង', 'ប្រភេទច្បាប់', 'មូលហេតុ'];
      rows = filtered.map((r, i) => [
        i + 1,
        r.staffId || r.staffCode || '',
        r.staffName || r.name || '',
        r.employeeCategory || '',
        r.department || '',
        r.manager || '',
        r.leaveType || '',
        r.leaveReason || ''
      ]);
    } else if (filterStatus === 'holiday') {
      headers = ['#', 'លេខកាត', 'ឈ្មោះ', 'ប្រភេទមន្រ្តី', 'ផ្នែក', 'Note', 'ស្ថានភាព'];
      rows = filtered.map((r, i) => [
        i + 1,
        r.staffId || r.staffCode || '',
        r.staffName || r.name || '',
        r.employeeCategory || '',
        r.department || '',
        r.note || '',
        'សម្រាក'
      ]);
    } else {
      headers = ['#', 'លេខកាត', 'ឈ្មោះ', 'ប្រភេទមន្រ្តី', 'ផ្នែក', 'ម៉ោងត្រូវធ្វើការ', 'ស្ថានភាព', 'ចូល (1)', 'ចេញ (1)', 'ចូល (2)', 'ចេញ (2)', 'ម៉ោងធ្វើការ', 'Late', 'Note'];

      const getLocalStatus = (r) => {
        const group = calculateStatusGroup(r);
        if (group === 'absent') return 'អវត្តមាន';
        if (group === 'late') return 'យឺត';
        if (group === 'leave') return 'ច្បាប់';
        if (group === 'pending') return 'មិនទាន់';
        if (group === 'holiday') return 'សម្រាក';
        if (group === 'early') return 'ចេញមុន';
        if (group === 'forgot') return 'ភ្លេចស្កេន';
        return 'វត្តមាន';
      };

      rows = filtered.map((r, i) => [
        i + 1,
        r.staffId || r.staffCode || '',
        r.staffName || r.name || '',
        r.employeeCategory || '',
        r.department || '',
        r.scheduledTime || '—',
        getLocalStatus(r),
        r.checkin1 || r.checkIn || '',
        r.checkout1 || r.checkOut || '',
        r.checkin2 || r.checkIn2 || '',
        r.checkout2 || r.checkOut2 || '',
        r.workHours ? parseHoursMinutes(r.workHours) : '',
        r.isLate ? 'យឺត' : '',
        r.note || r.notes || '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
    XLSX.writeFile(wb, `checkinme_daily_${date}.xlsx`);
  };

  const deleteReport = async () => {
    if (!window.confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យរបាយការណ៍ថ្ងៃទី ${date} មែនទេ?`)) return;
    try {
      setLoading(true);
      const res = await api.delete('/attendance/daily-report-delete', { params: { date } });
      if (res.data?.ok) {
        toast.success(`លុបទិន្នន័យថ្ងៃទី ${date} រួចរាល់ (${res.data.deletedCount} items)`);
        loadLocal();
      } else {
        toast.error(res.data?.message || 'មិនអាចលុបទិន្នន័យបាន');
      }
    } catch (err) {
      alert('Error deleting: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const doPrint = () => window.print();

  const statusBadge = (r) => {
    const group = calculateStatusGroup(r);
    if (group === 'absent') return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>អវត្តមាន</span>;
    if (group === 'late') return <span style={{ background: '#fef9c3', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>⏰ យឺត</span>;
    if (group === 'leave') return <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>ច្បាប់</span>;
    if (group === 'pending') return <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>⏳ មិនទាន់</span>;
    if (group === 'holiday') return <span style={{ background: '#ccfbf1', color: '#0f766e', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>សម្រាក</span>;
    if (group === 'early') return <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>🏃 ចេញមុន</span>;
    if (group === 'forgot') return <span style={{ background: '#fce7f3', color: '#be185d', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>📵 ភ្លេចស្កេន</span>;
    return <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>✓ វត្តមាន</span>;
  };

  // NOTE: This function requires the Google Apps Script to be updated to handle borders and formatting.
  // The script should use payload.header and payload.data to apply borders and set font size 11.
  const syncToGoogleSheets = async () => {
    if (!filtered || filtered.length === 0) {
      toast.warning("គ្មានទិន្នន័យសម្រាប់បញ្ជូនទេ!");
      return;
    }

    const scriptUrl = "https://script.google.com/macros/s/AKfycbxKg5mP-dV5C1Flbov9lQSfaHJW02VfKYFYI4RjJP3kEV7y6TIZHhOV5rK_godvbGjYrQ/exec";

    
    // Format date for sheet name: DD/MM/YYYY
    const dParts = date.split('-'); // YYYY-MM-DD
    const sheetDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
    const sheetName = `(${sheetDate})`;

    if (!window.confirm(`តើលោកអ្នកពិតជាចង់បញ្ជូនទិន្នន័យចំនួន ${filtered.length} នាក់ ទៅកាន់ Google Sheets (Sheet: ${sheetName}) មែនទេ?`)) return;

    setSyncing(true);
    try {
      const headers = ['ល.រ', 'លេខកាត', 'ឈ្មោះ', 'ប្រភេទមន្រ្តី', 'ផ្នែក', 'ម៉ោងត្រូវធ្វើការ', 'ស្ថានភាព', 'ចូល', 'ចេញ', 'ចូល (2)', 'ចេញ (2)', 'ម៉ោងធ្វើការ', 'Note'];

      
      const getLocalStatus = (r) => {
        const group = calculateStatusGroup(r);
        if (group === 'absent') return 'អវត្តមាន';
        if (group === 'late') return 'យឺត';
        if (group === 'leave') return 'ច្បាប់';
        if (group === 'pending') return 'មិនទាន់';
        if (group === 'holiday') return 'សម្រាក';
        if (group === 'early') return 'ចេញមុន';
        if (group === 'forgot') return 'ភ្លេចស្កេន';
        return 'វត្តមាន';
      };

      const dataRows = filtered.map((r, i) => [
        i + 1,
        r.staffId || r.staffCode || '',
        r.staffName || r.name || '',
        r.employeeCategory || '',
        r.department || '',
        r.scheduledTime || '—',
        getLocalStatus(r),
        r.checkin1 || r.checkIn || '',
        r.checkout1 || r.checkOut || '',
        r.checkin2 || r.checkIn2 || '',
        r.checkout2 || r.checkOut2 || '',
        r.workHours ? parseHoursMinutes(r.workHours) : '',
        r.note || r.notes || '',
      ]);

      const payload = {
        sheetName: sheetName,
        header: headers,
        data: dataRows
      };

      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      toast.success(`បានបញ្ជូនទិន្នន័យទៅ Google Sheets (${sheetName}) រួចរាល់!`);
    } catch (err) {
      console.error('Sync failed', err);
      toast.error("ការបញ្ជូនទិន្នន័យមិនបានសម្រេច៖ " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: '"Noto Sans Khmer", "Khmer OS Siemreap", Arial, sans-serif', minHeight: '100vh', background: '#f8fafc' }}>

      {/* ─── Print Style ─── */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          #daily-report-print, #daily-report-print * { visibility: visible; }
          #daily-report-print { position: static; }
        }
      `}</style>

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e40af' }}>
            📋 Daily Report ពី Checkinme
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            ទាញទិន្នន័យវត្តមានប្រចាំថ្ងៃពីប្រព័ន្ធ Checkinme
          </p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setIsPasteModalOpen(true)} disabled={loading || syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>📋</span> Paste Checkinme
          </button>

          <button onClick={() => setIsSyncSettingsOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            title="កំណត់ម៉ោង Auto Sync">
            <span style={{ fontSize: 15 }}>⚙️</span>
          </button>

          <button onClick={deleteReport} disabled={loading || syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>🗑️</span> លុបទិន្នន័យ
          </button>
          <button onClick={exportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>📥</span> Excel
          </button>
          <button onClick={syncToGoogleSheets} disabled={loading || syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: syncing ? 0.7 : 1 }}>
            {syncing ? <span style={{ fontSize: 15, display: 'inline-block', animation: 'spin 1s linear infinite' }}>🔄</span> : <span style={{ fontSize: 15 }}>☁️</span>}
            {syncing ? `Syncing...` : 'Sync Google Sheets'}
          </button>
          <button onClick={doPrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>🖨️</span> Print
          </button>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>📅 ថ្ងៃ</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>ផ្នែក (Department)</label>
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, minWidth: 150 }}>
            <option value="all">ទាំងអស់ (គ្រប់ផ្នែក)</option>
            {deptList.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>Category Type</label>
          <select value={categoryTypeId} onChange={e => setCategoryTypeId(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, minWidth: 140 }}>
            <option value="all">ទាំងអស់</option>
            <option value="12">មន្ត្រីរាជការ</option>
            <option value="13">កិច្ចសន្យារដ្ឋ</option>
            <option value="14">កិច្ចសន្យាមន្ទីរពេទ្យ</option>
            <option value="15">កម្មករកិច្ចសន្យា</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>🔍 ស្វែងរក</label>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            <span style={{ margin: '0 8px', fontSize: 14, color: '#9ca3af' }}>🔍</span>
            <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="ឈ្មោះ / លេខកាត / ផ្នែក..."
              style={{ flex: 1, padding: '7px 8px', border: 'none', outline: 'none', fontSize: 14 }} />
            {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px' }}><span style={{ fontSize: 14, color: '#9ca3af' }}>✖️</span></button>}
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>
            📋 ស្ថានភាព
          </label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}>
            <option value="all">ទាំងអស់</option>
            <option value="present">វត្តមាន</option>
            <option value="absent">អវត្តមាន</option>
            <option value="leave">ច្បាប់</option>
            <option value="late">ចូលយឺត</option>
            <option value="early">ចេញមុន</option>
            <option value="forgot">ភ្លេចស្កេន</option>
            <option value="holiday">សម្រាក</option>
            <option value="pending">មិនទាន់ដល់ម៉ោង</option>
          </select>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'សរុបបុគ្គលិក', value: hrTotalCount || stats.total, color: '#3b82f6', bg: '#eff6ff', emoji: '👥', clickFilter: 'all' },
          { label: 'វត្តមាន', value: stats.present, color: '#10b981', bg: '#f0fdf4', emoji: '✅', clickFilter: 'present' },
          { label: 'អវត្តមាន', value: stats.absent, color: '#ef4444', bg: '#fef2f2', emoji: '❌', clickFilter: 'absent' },
          { label: 'ច្បាប់', value: stats.leave, color: '#8b5cf6', bg: '#f5f3ff', emoji: '📋', clickFilter: 'leave' },
          { label: 'ចូលយឺត', value: stats.late, color: '#f59e0b', bg: '#fffbeb', emoji: '⏰', clickFilter: 'late' },
          { label: 'ចេញមុន', value: stats.early, color: '#f97316', bg: '#fff7ed', emoji: '🏃', clickFilter: 'early' },
          { label: 'ភ្លេចស្កេន', value: stats.forgot, color: '#ec4899', bg: '#fdf2f8', emoji: '📵', clickFilter: 'forgot' },
          { label: 'សម្រាក', value: stats.holiday, color: '#14b8a6', bg: '#f0fdfa', emoji: '🏖️', clickFilter: 'holiday' },
          { label: 'មិនទាន់ដល់ម៉ោង', value: stats.pending, color: '#475569', bg: '#f1f5f9', emoji: '⏳', clickFilter: 'pending' },
        ].map(c => (
          <div key={c.label}
            onClick={() => setFilterStatus(filterStatus === c.clickFilter ? 'all' : c.clickFilter)}
            style={{
              flex: '1 1 80px', // Allow smaller flex basis
              minWidth: 90,
              background: filterStatus === c.clickFilter ? c.color : c.bg,
              border: `1.5px solid ${c.color}${filterStatus === c.clickFilter ? 'ff' : '44'}`,
              borderRadius: 10, padding: '8px 6px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
              color: filterStatus === c.clickFilter ? '#fff' : 'inherit',
              boxShadow: filterStatus === c.clickFilter ? `0 4px 12px ${c.color}44` : 'none'
            }}>
            <div style={{ fontSize: 16, marginBottom: 1 }}>{c.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: filterStatus === c.clickFilter ? '#fff' : c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 10, color: filterStatus === c.clickFilter ? 'rgba(255,255,255,0.9)' : '#6b7280', marginTop: 4, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Sync Result Banner ─── */}
      {syncResult && (
        <div className="no-print" style={{ background: syncResult.ok ? '#d1fae5' : '#fee2e2', border: `1px solid ${syncResult.ok ? '#6ee7b7' : '#fca5a5'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: syncResult.ok ? '#065f46' : '#991b1b', fontSize: 14 }}>
          {syncResult.ok
            ? `✅ Sync ជោគជ័យ! ${syncResult.synced} records ត្រូវបានរក្សាទុក សម្រាប់ ${syncResult.date}`
            : `❌ ${syncResult.message}`}
        </div>
      )}

      {/* ─── Table ─── */}
      <div id="daily-report-print" ref={printRef}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#6b7280' }}>
              <span style={{ fontSize: 32, display: 'inline-block', animation: 'spin 1s linear infinite', marginBottom: 12, color: '#3b82f6' }}>🔄</span>
              <p>កំពុងទាញទិន្នន័យ...</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  {filterStatus === 'leave' ? (
                    <tr style={{ background: '#1e40af', color: '#fff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>លេខកាត</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ឈ្មោះ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ប្រភេទមន្រ្តី</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ផ្នែក</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ម៉ោងត្រូវធ្វើការ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ប្រភេទច្បាប់</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>មូលហេតុ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Note</th>
                    </tr>
                  ) : filterStatus === 'holiday' ? (
                    <tr style={{ background: '#1e40af', color: '#fff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>លេខកាត</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ឈ្មោះ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ប្រភេទមន្រ្តី</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ផ្នែក</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ម៉ោងត្រូវធ្វើការ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Note</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ស្ថានភាព</th>
                    </tr>
                  ) : (
                    <tr style={{ background: '#1e40af', color: '#fff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>លេខកាត</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ឈ្មោះ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ប្រភេទមន្រ្តី</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ផ្នែក</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>ម៉ោងត្រូវធ្វើការ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>ស្ថានភាព</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', background: '#1d4ed8' }}>ចូល ១</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', background: '#1d4ed8' }}>ចេញ ១</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', background: '#1e3a8a' }}>ចូល ២</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap', background: '#1e3a8a' }}>ចេញ ២</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>ម៉ោងធ្វើការ</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', whiteSpace: 'nowrap' }}>Note</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                        <p style={{ fontSize: 16, margin: 0 }}>គ្មានទិន្នន័យ</p>
                        <p style={{ fontSize: 13, marginTop: 8 }}>ចុច "Preview Checkinme" ឬ "Sync & Save" ដើម្បីទាញទិន្នន័យ</p>
                      </td>
                    </tr>
                  ) : filtered.map((r, i) => {
                    const isAbsent = r.status === 'absent';
                    const rowBg = isAbsent ? '#fef2f2' : (i % 2 === 0 ? '#fff' : '#f9fafb');
                    return (
                      <tr key={r._id || r.staffId || i} style={{ background: rowBg, borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', textAlign: 'center', color: '#4b5563', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}>
                          {r.staffId || r.staffCode || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>
                          {r.staffName || r.name || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#4b5563', fontSize: 12, fontWeight: 600 }}>
                          {r.employeeCategory || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#6b7280', fontSize: 12 }}>
                          {r.department || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: '#1e40af', fontWeight: 600, fontSize: 12 }}>
                          {statusBadge(r).props?.children?.includes('សម្រាក') || calculateStatusGroup(r) === 'holiday' ? 'សម្រាក' : (r.scheduledTime || '—')}
                        </td>

                        {filterStatus === 'leave' ? (
                          <>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: '#4f46e5', fontWeight: 500 }}>{r.leaveType || '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>{r.leaveReason || '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: '#6b7280' }}>{r.note || '—'}</td>
                          </>
                        ) : filterStatus === 'holiday' ? (
                          <>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: '#6b7280', maxWidth: 200 }}>{r.note || '—'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12 }}>
                              <span style={{ color: '#0f766e', background: '#ccfbf1', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                                សម្រាក
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              {statusBadge(r)}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', background: '#f0f9ff' }}>
                              {r.checkin1 || r.checkIn
                                ? <span style={{ color: '#065f46', fontWeight: 600 }}>{r.checkin1 || r.checkIn}</span>
                                : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', background: '#f0f9ff' }}>
                              {r.checkout1 || r.checkOut
                                ? <span style={{ color: '#7c3aed', fontWeight: 600 }}>{r.checkout1 || r.checkOut}</span>
                                : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', background: '#fafafa' }}>
                              {r.checkin2 || r.checkIn2
                                ? <span style={{ color: '#065f46' }}>{r.checkin2 || r.checkIn2}</span>
                                : <span style={{ color: '#e5e7eb' }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', background: '#fafafa' }}>
                              {r.checkout2 || r.checkOut2
                                ? <span style={{ color: '#7c3aed' }}>{r.checkout2 || r.checkOut2}</span>
                                : <span style={{ color: '#e5e7eb' }}>—</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#1e40af' }}>
                              {r.workHours ? parseHoursMinutes(r.workHours) : '—'}
                            </td>
                            <td style={{ padding: '9px 12px', color: '#6b7280', fontSize: 12, maxWidth: 180 }}>
                              {r.note || r.notes || ''}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1', fontSize: 12 }}>
                    <td colSpan={2} style={{ padding: '10px 12px' }}>សរុប: {filtered.length} នាក់</td>
                    <td colSpan={2} style={{ padding: '10px 12px' }}>
                      <span style={{ color: '#065f46', marginRight: 8 }}>✅ {stats.present} វត្តមាន</span>
                      <span style={{ color: '#991b1b', marginRight: 8 }}>❌ {stats.absent} អវត្តមាន</span>
                      <span style={{ color: '#7c3aed' }}>📋 {stats.leave} ច្បាប់</span>
                    </td>
                    <td colSpan={2} style={{ padding: '10px 12px' }}>
                      <span style={{ color: '#b45309', marginRight: 8 }}>⏰ {stats.late} យឺត</span>
                      <span style={{ color: '#c2410c', marginRight: 8 }}>🏃 {stats.early} ចេញមុន</span>
                      <span style={{ color: '#be185d', marginRight: 8 }}>📵 {stats.forgot} ភ្លេចស្កេន</span>
                      <span style={{ color: '#0d9488' }}>🏖️ {stats.holiday} សម្រាក</span>
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── CSS Animation for spinner ─── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <ManualPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onSave={handleManualSave}
        date={date}
        categoryTypeId={categoryTypeId}
        branchId={selectedDept}
      />

      {/* ─── Auto Sync Settings Modal ─── */}
      {isSyncSettingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚙️</span> កំណត់ម៉ោង Auto Sync
              </h3>
              <button onClick={() => setIsSyncSettingsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <span style={{ fontSize: 20 }}>✖️</span>
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                ស្ថានភាពស្វ័យប្រវត្តិ
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  type="checkbox" 
                  id="auto_sync_enabled"
                  checked={syncSettings.auto_sync_enabled}
                  onChange={(e) => setSyncSettings({ ...syncSettings, auto_sync_enabled: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="auto_sync_enabled" style={{ fontSize: 14, cursor: 'pointer' }}>
                  {syncSettings.auto_sync_enabled ? 'បើកដំណើរការ (Enabled)' : 'បិទដំណើរការ (Disabled)'}
                </label>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                កំណត់ម៉ោងទាញទិន្នន័យ (រាល់ថ្ងៃ)
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {syncSettings.sync_times.map((time, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input 
                      type="time" 
                      value={time}
                      onChange={(e) => {
                        const newTimes = [...syncSettings.sync_times];
                        newTimes[idx] = e.target.value;
                        setSyncSettings({ ...syncSettings, sync_times: newTimes });
                      }}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, outline: 'none' }}
                    />
                    {syncSettings.sync_times.length > 1 && (
                        <button 
                          onClick={() => {
                            const newTimes = syncSettings.sync_times.filter((_, i) => i !== idx);
                            setSyncSettings({ ...syncSettings, sync_times: newTimes });
                          }}
                          style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '8px', borderRadius: 8, cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                    )}
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setSyncSettings({ ...syncSettings, sync_times: [...syncSettings.sync_times, '12:00'] })}
                style={{ marginTop: 12, background: 'none', border: '1px dashed #3b82f6', color: '#3b82f6', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' }}
              >
                + បន្ថែមម៉ោងថ្មី
              </button>

              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>
                * ប្រព័ន្ធនឹងទាញទិន្នន័យពី Checkinme ដោយស្វ័យប្រវត្តិនៅតាមម៉ោងដែលបានកំណត់ខាងលើ។
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={() => setIsSyncSettingsOpen(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                បោះបង់
              </button>
              <button 
                onClick={saveSyncSettings}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#1e40af', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                រក្សាទុក
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
