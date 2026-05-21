import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { 
  FiRefreshCw, 
  FiSearch, 
  FiDownload, 
  FiPrinter, 
  FiCalendar,
  FiUser,
  FiClock,
  FiSmartphone,
  FiMapPin,
  FiActivity
} from 'react-icons/fi';

const today = new Date().toISOString().split('T')[0];

export default function AttendanceDetailReportPage() {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [branchId, setBranchId] = useState('');
  const [categoryTypeId, setCategoryTypeId] = useState('all');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState('');
  const printRef = useRef(null);

  // Load records from local DB
  const loadLocal = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/detail-report-list', { 
        params: { fromDate, toDate } 
      });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('មិនអាចទាញទិន្នន័យ: ' + (err?.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Sync & save from Checkinme
  const syncFromCheckinme = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/attendance/sync-detail-report', {
        fromDate, toDate, branchId, categoryTypeId
      });
      if (data.ok) {
        toast.success(`Sync បានជោគជ័យ! ${data.synced} Scan Events`);
        await loadLocal();
      } else {
        toast.warning(data.message || 'Sync ended with no data');
      }
    } catch (err) {
      console.error(err);
      toast.error('Sync failed: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { 
    loadLocal(); 
  }, [fromDate, toDate]);

  const filtered = records.filter(r => {
    const name = String(r.staffName || '').toLowerCase();
    const sid = String(r.staffId || '').toLowerCase();
    const dept = String(r.department || '').toLowerCase();
    const qLow = q.toLowerCase();
    return !q || name.includes(qLow) || sid.includes(qLow) || dept.includes(qLow);
  });

  const exportExcel = () => {
    const headers = ['#', 'កាលបរិច្ឆេទ', 'ម៉ោង', 'លេខកាត', 'ឈ្មោះ', 'របៀប/Mode', 'ផ្នែក', 'សាខា', 'ឧបករណ៍'];
    const rows = filtered.map((r, i) => [
      i + 1,
      new Date(r.date).toLocaleDateString('km-KH'),
      r.checkTime || '',
      r.staffId || '',
      r.staffName || '',
      r.mode || '',
      r.department || '',
      r.branch || '',
      r.device || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detail Report');
    XLSX.writeFile(wb, `attendance_detail_${fromDate}_to_${toDate}.xlsx`);
  };

  const doPrint = () => window.print();

  return (
    <div style={{ padding: 25, fontFamily: '"Noto Sans Khmer", Arial, sans-serif', minHeight: '100vh', background: '#f0f2f5' }}>
      
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '20px 30px', borderRadius: 16, color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FiActivity style={{ color: '#38bdf8' }} /> របាយការណ៍ស្កេនលម្អិត
          </h1>
          <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: 14 }}>ពិនិត្យរាល់ទិន្នន័យស្កេនចេញ-ចូល របស់បុគ្គលិកគ្រប់រូប</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, cursor: 'pointer', fontWeight: 600, transition: '0.2s' }} onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.2)'} onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.1)'}>
            <FiDownload /> Excel
          </button>
          <button onClick={doPrint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
            <FiPrinter /> បោះពុម្ព
          </button>
          <button 
            onClick={syncFromCheckinme} 
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 10, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: syncing ? 0.7 : 1, boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.4)' }}
          >
            <FiRefreshCw className={syncing ? 'animate-spin' : ''} /> {syncing ? 'កំពុងទាញ...' : 'Sync & Save'}
          </button>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div style={{ background: '#fff', padding: 25, borderRadius: 16, marginBottom: 25, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 8 }}><FiCalendar style={{ verticalAlign: 'middle', marginRight: 5 }} /> ចាប់ពីថ្ងៃ</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 8 }}><FiCalendar style={{ verticalAlign: 'middle', marginRight: 5 }} /> ដល់ថ្ងៃ</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 8 }}><FiMapPin style={{ verticalAlign: 'middle', marginRight: 5 }} /> សាខា (Branch)</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none' }}>
            <option value="">ទាំងអស់</option>
            <option value="1">សាខា កណ្តាល</option>
            {/* Add more branches if needed */}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 8 }}><FiUser style={{ verticalAlign: 'middle', marginRight: 5 }} /> ប្រភេទបុគ្គលិក</label>
          <select value={categoryTypeId} onChange={e => setCategoryTypeId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none' }}>
            <option value="all">ទាំងអស់</option>
            <option value="12">ក្របខណ្ឌ</option>
            <option value="13">កិច្ចសន្យារដ្ឋ</option>
            <option value="14">កិច្ចសន្យាមន្ទីរពេទ្យ</option>
            <option value="15">កម្មករកិច្ចសន្យា</option>
          </select>
        </div>
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 8 }}><FiSearch style={{ verticalAlign: 'middle', marginRight: 5 }} /> ស្វែងរក</label>
          <input 
            type="text" 
            placeholder="ឈ្មោះ / លេខកាត / ផ្នែក..." 
            value={q} 
            onChange={e => setQ(e.target.value)} 
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 15, outline: 'none' }} 
          />
          <FiSearch style={{ position: 'absolute', left: 15, bottom: 15, color: '#94a3b8' }} />
        </div>
      </div>

      {/* ─── Data Table ─── */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px 20px', color: '#475569', fontSize: 13, textTransform: 'uppercase', width: 50 }}>#</th>
                <th style={{ padding: '16px 20px', color: '#475569', fontSize: 13, textTransform: 'uppercase' }}>បុគ្គលិក</th>
                <th style={{ padding: '16px 20px', color: '#475569', fontSize: 13, textTransform: 'uppercase' }}>ប្រភេទ</th>
                <th style={{ padding: '16px 20px', color: '#475569', fontSize: 13, textTransform: 'uppercase' }}>របៀប / Mode</th>
                <th style={{ padding: '16px 20px', color: '#475569', fontSize: 13, textTransform: 'uppercase' }}>ពេលវេលា</th>
                <th style={{ padding: '16px 20px', color: '#475569', fontSize: 13, textTransform: 'uppercase' }}>ឧបករណ៍</th>
                <th style={{ padding: '16px 20px', color: '#475569', fontSize: 13, textTransform: 'uppercase' }}>ទីតាំង/ផ្នែក</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>កំពុងទាញទិន្នន័យ...</td></tr>
              ) : filtered.length === 0 ? (
                 <tr><td colSpan="6" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>មិនមានទិន្នន័យឡើយ</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r._id || i} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: 14 }}>{i + 1}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0f2fe', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                        <FiUser />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{r.staffName || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>ID: {r.staffId}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{r.employeeCategory || '—'}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: 20, 
                      fontSize: 12, 
                      fontWeight: 700,
                      background: r.mode?.toLowerCase() === 'check-in' || r.mode?.includes('In') || r.mode?.includes('ចូល') ? '#dcfce7' : '#fee2e2',
                      color: r.mode?.toLowerCase() === 'check-in' || r.mode?.includes('In') || r.mode?.includes('ចូល') ? '#166534' : '#991b1b'
                    }}>
                      {r.mode || 'Unknown'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ color: '#1e293b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FiClock style={{ color: '#6366f1' }} /> {r.checkTime}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(r.date).toLocaleDateString('km-KH')}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 14 }}>
                      <FiSmartphone style={{ color: '#ec4899' }} /> {r.device || '...'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 14, marginBottom: 4 }}>
                      <FiMapPin style={{ color: '#f59e0b' }} /> {r.branch || '...'}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.department || '...'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media print {
          body { background: white !important; padding: 0 !important; }
          button, .filters, input { display: none !important; }
          .header { background: white !important; color: black !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
