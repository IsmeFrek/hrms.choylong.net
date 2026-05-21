import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
// Lucide icons removed to fix "Element type is invalid" crash

import api from '../services/api';
import usePermission from '../hooks/usePermission';

function toLocalYmd(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function fmtDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB');
}

export default function LeaveRequestsPage() {
  const perms = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [importing, setImporting] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [editType, setEditType] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('pending');
  const [editAmount, setEditAmount] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const fileInputRef = useRef(null);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);
  const [syncSettings, setSyncSettings] = useState({ sync_times: ['09:40'], auto_sync_enabled: true });


  const today = new Date();
  const year = today.getFullYear();
  const monthIdx = today.getMonth();
  const defaultMonthValue = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const [monthValue, setMonthValue] = useState('');
  const [leaveType, setLeaveType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Sync visible range when month changes
  useEffect(() => {
    if (!monthValue) return;
    const [y, m] = monthValue.split('-').map(Number);
    if (!y || !m) return;
    const fromStr = toLocalYmd(new Date(y, m - 1, 1));
    const toStr = toLocalYmd(new Date(y, m, 0));
    setFromDate(fromStr);
    setToDate(toStr);
    setCurrentPage(1); // Reset page on month/date filter change
  }, [monthValue]);

  useEffect(() => {
    api.get('/report-settings/group/leave-sync').then(res => {
      if (res.data?.ok) {
        const s = res.data.settings;
        if (!Array.isArray(s.sync_times)) {
          s.sync_times = [s.sync_time || '09:40'];
        }
        setSyncSettings(s);
      }
    }).catch(console.error);
  }, []);

  const saveSyncSettings = async () => {
    try {
      const { data } = await api.post('/report-settings/group/leave-sync', { settings: syncSettings });
      if (data.ok) {
        alert('រក្សាទុកការកំណត់ Auto Sync រួចរាល់');
        setIsSyncSettingsOpen(false);
      }
    } catch (err) {
      alert('រក្សាទុកមិនបានសម្រេច: ' + (err.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!(perms.canViewLeaveRequests || perms.canViewAttendance || perms.canViewHR || perms.canViewUnpaidLeaveReport)) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/leave-requests', {
          params: {
            from: fromDate,
            to: toDate,
            month: monthValue || undefined,
            status: status || undefined,
          },
        });
        
        let matLeaves = [];
        try {
          const hrRes = await api.get('/hr');
          const hrList = Array.isArray(hrRes.data) ? hrRes.data : [];
          matLeaves = hrList.filter(h => h.maternity && h.maternity.startDate).map(h => ({
            _id: `mat-${h._id || h.staffId}`,
            name: h.khmerName || h.name,
            staffId: h.staffId,
            department: h.Department_Kh || h.position,
            startDate: h.maternity.startDate,
            endDate: h.maternity.endDate,
            type: 'Maternity Leave',
            reason: h.maternity.reason || 'ឈប់សម្រាកមាតុភាព',
            status: 'approved',
            amount: 90,
          }));
        } catch (err) {
          console.error('Failed to fetch maternity data:', err);
        }

        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setItems([...list, ...matLeaves]);
      } catch (e) {
        if (cancelled) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fromDate, toDate, status, reloadToken, perms.canViewAttendance, perms.canViewHR, perms.canViewUnpaidLeaveReport]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [q, selectedDept, status]);

  const departments = useMemo(() => {
    const list = Array.from(new Set((items || []).map(i => (i.department || '').trim()).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const leaveTypes = useMemo(() => {
    const list = Array.from(new Set((items || []).map(i => (i.type || '').trim()).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = (q || '').toLowerCase().trim();
    let base = items || [];

    base = base.map(r => {
      const typeStr = String(r.type || '').toLowerCase();
      if (typeStr.includes('maternity') || typeStr.includes('មាតុភាព')) {
        const s = new Date(r.startDate || r.date);
        const e = new Date(r.endDate);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) {
          const s2 = new Date(s);
          s2.setFullYear(e.getFullYear() - 1);
          if (s2 < e) {
            return { ...r, startDate: s2.toISOString().slice(0, 10) };
          }
        }
      }
      return r;
    });

    if (leaveType) {
      base = base.filter(r => (r.type || '').trim() === leaveType.trim());
    }

    // Filter by Months column to match selected month when available
    if (monthValue) {
      const [yy, mm] = monthValue.split('-').map(Number);
      if (yy && mm) {
        base = base.filter((r) => {
          // Prefer explicit months field when present
          if (r.months) {
            const d = new Date(r.months);
            if (!Number.isNaN(d.getTime())) {
              return d.getFullYear() === yy && d.getMonth() + 1 === mm;
            }
          }
          // Fallback to startDate/date for legacy rows
          const fallback = r.startDate || r.date;
          if (!fallback) return false;
          const d2 = new Date(fallback);
          if (Number.isNaN(d2.getTime())) return false;
          return d2.getFullYear() === yy && d2.getMonth() + 1 === mm;
        });
      }
    }

    if (selectedDept) {
      base = base.filter(r => (r.department || '').trim() === selectedDept);
    }

    if (term) {
      base = base.filter((r) => {
        const name = (r.name || '').toLowerCase();
        const staffId = (r.staffId || '').toLowerCase();
        const manager = (r.manager || '').toLowerCase();
        const dept = (r.department || '').toLowerCase();
        const type = (r.type || '').toLowerCase();
        const reason = (r.reason || '').toLowerCase();
        const statusV = (r.status || '').toLowerCase();
        return (
          name.includes(term) ||
          staffId.includes(term) ||
          manager.includes(term) ||
          dept.includes(term) ||
          type.includes(term) ||
          reason.includes(term) ||
          statusV.includes(term)
        );
      });
    }
    return base.map((r, idx) => ({ ...r, _index: idx + 1 }));
  }, [items, q, monthValue, selectedDept, leaveType]);

  const rows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);

  const handleApprove = async (row) => {
    if (!row?._id) return;
    if (String(row.status || '').toLowerCase() === 'approved') return;
    if (!window.confirm('តើអ្នកប្រាកដថាចង់យល់ព្រមសំណើនេះទេ?')) return;
    try {
      await api.patch(`/leave-requests/${row._id}`, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
      });

      // Sync to Maternity Report if type is Maternity Leave
      if (String(row.type || '').toLowerCase().includes('maternity') || String(row.type || '').includes('មាតុភាព')) {
        try {
          await api.put(`/hr/${row.staffId}`, {
            maternity: {
              startDate: row.startDate || row.date,
              endDate: row.endDate,
              reason: row.reason || 'ឈប់សម្រាកមាតុភាព',
            }
          });
        } catch (err) {
          console.error('Failed to sync maternity to HR:', err);
        }
      }

      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Approve failed');
    }
  };

  const handlePrint = (row) => {
    if (!row?._id) return;
    let token = '';
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || 'null');
      token = auth?.token || '';
    } catch (e) { /* ignore */ }
    window.open(`${api.defaults.baseURL}/leave-requests/${row._id}/print?token=${token}`, '_blank');
  };

  const startEdit = (row) => {
    if (!row?._id) return;
    setEditingRow(row);
    setEditType(row.type || '');
    setEditReason(row.reason || '');
    const start = row.startDate || row.date;
    setEditStartDate(start ? toLocalYmd(start) : '');
    setEditEndDate(row.endDate ? toLocalYmd(row.endDate) : '');
    setEditStatus(row.status || 'pending');
    setEditAmount(row.amount != null ? String(row.amount) : '');
  };

  const handleSaveEdit = async () => {
    if (!editingRow?._id) return;
    const amountVal = editAmount.trim() === '' ? undefined : Number(editAmount);
    const startDateVal = editStartDate.trim() === '' ? undefined : editStartDate.trim();
    const endDateVal = editEndDate.trim() === '' ? undefined : editEndDate.trim();
    let statusVal = (editStatus || '').trim().toLowerCase();
    const allowedStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
    if (!allowedStatuses.includes(statusVal)) {
      statusVal = editingRow.status || 'pending';
    }
    try {
      await api.patch(`/leave-requests/${editingRow._id}`, {
        type: editType,
        reason: editReason,
        amount: Number.isNaN(amountVal) ? undefined : amountVal,
        startDate: startDateVal,
        endDate: endDateVal,
        // keep legacy date in sync with startDate for filtering
        date: startDateVal,
        status: statusVal,
      });
      setEditingRow(null);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Edit failed');
    }
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
  };

  const handleNote = async (row) => {
    if (!row?._id) return;
    const nextNote = window.prompt('ចំណាំ', row.note || '');
    if (nextNote === null) return;
    try {
      await api.patch(`/leave-requests/${row._id}`, {
        note: nextNote,
      });
      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Update note failed');
    }
  };

  const handleDelete = async (row) => {
    if (!row?._id) return;
    if (!window.confirm('តើអ្នកប្រាកដថាចង់លុបសំណើច្បាប់នេះទេ?')) return;
    try {
      await api.delete(`/leave-requests/${row._id}`);
      setReloadToken((t) => t + 1);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Delete failed');
    }
  };
  const handleExportExcel = () => {
    const header = [
      'No',
      'Name',
      'Staff ID',
      'Manager',
      'Department',
      'Start Date',
      'End Date',
      'Months',
      'Amount',
      'Type',
      'Reason',
      'Comment',
      'Status',
      'Requested At',
      'Approved At',
      'Note',
    ];

    const data = rows.map((r) => [
      r._index,
      r.name || '',
      r.staffId || '',
      r.manager || '',
      r.department || '',
      toLocalYmd(r.startDate || r.date) || '',
      toLocalYmd(r.endDate) || '',
      toLocalYmd(r.months) || '',
      r.amount ?? '',
      r.type || '',
      r.reason || '',
      r.comment || '',
      r.status || '',
      toLocalYmd(r.requestedAt) || '',
      toLocalYmd(r.approvedAt) || '',
      r.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    const sheetName = 'LeaveRequests';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fileSafe = monthValue
      ? `LeaveRequests_${monthValue}.xlsx`
      : `LeaveRequests_${fromDate || ''}_${toDate || ''}.xlsx`;
    XLSX.writeFile(wb, fileSafe);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAutoSync = async () => {
    if (!confirm('តើអ្នកចង់ទាញទិន្នន័យច្បាប់ពី Checkinme ដោយស្វ័យប្រវត្តិតាមរយៈ Backend មែនទេ?')) return;
    setAutoSyncing(true);
    try {
      const res = await api.post('/leave-requests/auto-sync-checkinme', {
        from: fromDate,
        to: toDate
      });
      if (res.data.ok) {
        alert(`ជោគជ័យ! បញ្ចូលបាន ${res.data.results?.imported || 0} ច្បាប់`);
        setReloadToken(prev => prev + 1);
      } else {
        alert(res.data.message || 'Sync បរាជ័យ');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Sync Error');
    } finally {
      setAutoSyncing(false);
    }
  };

  const handleClearRange = async () => {
    if (!fromDate && !toDate) {
      alert('សូមជ្រើសរើសចន្លោះថ្ងៃជាមុនសិន');
      return;
    }

    if (!confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យច្បាប់ទាំងអស់ក្នុងចន្លោះថ្ងៃនេះមែនទេ?\nការលុបនេះនឹងមិនអាចយកត្រឡប់មកវិញបានទេ។`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await api.delete('/leave-requests/range/clear', {
        params: { from: fromDate, to: toDate }
      });

      if (res.data.ok) {
        alert(`លុបទិន្នន័យបានជោគជ័យ! សរុបចំនួន ${res.data.deletedCount} កំណត់ត្រា។`);
        setReloadToken(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error clearing leave data:', error);
      alert('មានបញ្ហាក្នុងការលុបទិន្នន័យ: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };



  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/imports/leave-requests', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReloadToken((t) => t + 1);
    } catch (e2) {
      setError(e2?.response?.data?.error || e2?.message || 'Import failed');
    } finally {
      setImporting(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: '"Khmer OS Siemreap","Noto Sans Khmer",Arial,sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>បញ្ជីសំណើច្បាប់</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ marginRight: 4 }}>ប្រចាំខែ:</label>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
          {monthValue && <button onClick={() => setMonthValue('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}>×</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ marginRight: 4 }}>ចាប់ពីថ្ងៃ:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
          {fromDate && <button onClick={() => setFromDate('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}>×</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ marginRight: 4 }}>ដល់ថ្ងៃ:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
          {toDate && <button onClick={() => setToDate('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}>×</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ marginRight: 4 }}>ស្ថានភាព:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="">-- ទាំងអស់ --</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ marginRight: 4 }}>ផ្នែក:</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, maxWidth: 200 }}
          >
            <option value="">-- ទាំងអស់ --</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={{ marginRight: 4 }}>ប្រភេទច្បាប់:</label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="">-- ទាំងអស់ --</option>
            {leaveTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ស្វែងរក (Name, Staff ID, Department, Type, Status)"
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={handleExportExcel}
          style={{
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid #3b82f6',
            background: '#3b82f6',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          នាំចេញ Excel
        </button>
        <button
          type="button"
          onClick={handleImportClick}
          disabled={importing}
          style={{
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid #10b981',
            background: importing ? '#d1fae5' : '#10b981',
            color: importing ? '#065f46' : '#ffffff',
            cursor: importing ? 'wait' : 'pointer',
          }}
        >
          Import Excel
        </button>

        {(perms.isAdmin || perms.canEditHR) && (
          <button
            type="button"
            onClick={handleClearRange}
            disabled={loading}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid #ef4444',
              background: '#ef4444',
              color: '#ffffff',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            🗑️
            លុបទិន្នន័យច្បាប់តាមថ្ងៃ

          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          onClick={handleAutoSync}
          disabled={autoSyncing}
          className="hover:scale-105 active:scale-95 transition-transform ml-auto"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12,
            cursor: autoSyncing ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 4px rgba(217, 119, 6, 0.2)'
          }}
        >
          {autoSyncing ? <span className="animate-spin">🔄</span> : <span>⚡</span>}
          {autoSyncing ? 'កំពុងទាញ...' : 'Auto Sync (Backend)'}

        </button>

        <button onClick={() => setIsSyncSettingsOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          title="កំណត់ម៉ោង Auto Sync">
          <span>⚙️</span>

        </button>
      </div>


      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>បង្ហាញ:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span style={{ color: '#6b7280' }}>ក្នុងមួយទំព័រ (សរុប {filteredItems.length})</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage <= 1 ? 0.5 : 1
            }}
          >
            Previous
          </button>
          <span>ទំព័រ {currentPage} នៃ {totalPages || 1}</span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage >= totalPages ? 0.5 : 1
            }}
          >
            Next
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 10, color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ marginBottom: 8 }}>កំពុងផ្ទុក...</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>No</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Name</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Staff ID</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Manager</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Department</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Start Date</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>End Date</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Months</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Amount</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Type</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Reason</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Comment</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Status</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Requested At</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Approved At</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>Note</th>
              <th style={{ border: '1px solid #d1d5db', padding: 6 }}>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ border: '1px solid #e5e7eb', padding: 8, textAlign: 'center', color: '#6b7280' }}>
                  មិនមានទិន្នន័យ
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id || `${r.staffId}-${r._index}`} style={{ background: r._index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{r._index}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.name}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.staffId}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.manager}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.department}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{fmtDate(r.startDate || r.date)}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{fmtDate(r.endDate)}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{fmtDate(r.months)}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'right' }}>{r.amount || ''}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.type}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.reason}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.comment}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.status}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{fmtDate(r.requestedAt)}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6, textAlign: 'center' }}>{fmtDate(r.approvedAt)}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 6 }}>{r.note}</td>
                  <td style={{ border: '1px solid #e5e7eb', padding: 4 }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        type="button"
                        title="យល់ព្រម"
                        onClick={() => handleApprove(r)}
                        style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', color: '#16a34a' }}
                      >
                        <span>✅</span>

                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrint(r)}
                        style={{ 
                          border: '1px solid #d1d5db', 
                          background: '#fff', 
                          padding: '2px 8px', 
                          borderRadius: 4,
                          cursor: 'pointer', 
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      >
                        <span>🖨️</span>

                        ព្រីន
                      </button>
                      <button
                        type="button"
                        title="កែប្រែ"
                        onClick={() => startEdit(r)}
                        style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', color: '#4b5563' }}
                      >
                        <span>✏️</span>

                      </button>
                      <button
                        type="button"
                        title="ចំណាំ"
                        onClick={() => handleNote(r)}
                        style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', color: '#f59e0b' }}
                      >
                        <span>📝</span>

                      </button>
                      <button
                        type="button"
                        title="លុប"
                        onClick={() => handleDelete(r)}
                        style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', color: '#b91c1c' }}
                      >
                        <span>🗑️</span>

                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editingRow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: 16,
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 420,
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              fontSize: 13,
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>កែប្រែសំណើច្បាប់</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>ប្រភេទ:</label>
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>មូលហេតុ:</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>ថ្ងៃចាប់ផ្តើម:</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>ថ្ងៃបញ្ចប់:</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>ស្ថានភាព:</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>ចំនួន:</label>
                <input
                  type="number"
                  step="0.5"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                បោះបង់
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: '1px solid #3b82f6',
                  background: '#3b82f6',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                រក្សាទុក
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Auto Sync Settings Modal ─── */}
      {isSyncSettingsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚙️</span> កំណត់ម៉ោង Auto Sync Leaves
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
                * ប្រព័ន្ធនឹងទាញទិន្នន័យច្បាប់ពី Checkinme ដោយស្វ័យប្រវត្តិនៅតាមម៉ោងដែលបានកំណត់ខាងលើ។
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
