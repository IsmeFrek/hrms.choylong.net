import React, { useEffect, useState } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import * as XLSX from 'xlsx';

export default function AttendanceReportPage() {
  const perms = usePermission();
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance', { params: { from, to } });
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const exportExcel = () => {
    const header = ['ល.រ','លេខកាត','ថ្ងៃ','ស្ថានភាព','ផ្សេងៗ'];
    const data = (list||[]).map((r, i) => [i+1, r.staffId, new Date(r.date).toLocaleDateString(), r.status, r.notes || '']);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `Attendance_${from}_to_${to}.xlsx`);
  };

  return (
    <div className="p-6">
      <h3 className="text-xl font-semibold mb-3">របាយការណ៍វត្តមាន</h3>
      <div className="flex gap-2 items-end mb-4">
        <div>
          <label className="text-sm">From</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div>
          <label className="text-sm">To</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div>
          <button onClick={load} className="border rounded px-3 py-1 bg-blue-600 text-white">Load</button>
        </div>
        <div>
          <button onClick={exportExcel} className="border rounded px-3 py-1 bg-green-600 text-white">Export Excel</button>
        </div>
      </div>

      <div>
        {loading ? <div>Loading...</div> : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border px-2 py-1">#</th>
                <th className="border px-2 py-1">លេខកាត</th>
                <th className="border px-2 py-1">ថ្ងៃ</th>
                <th className="border px-2 py-1">ស្ថានភាព</th>
                <th className="border px-2 py-1">ផ្សេងៗ</th>
              </tr>
            </thead>
            <tbody>
              {(list||[]).map((r, i) => (
                <tr key={r._id || i}>
                  <td className="border px-2 py-1">{i+1}</td>
                  <td className="border px-2 py-1">{r.staffId}</td>
                  <td className="border px-2 py-1">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="border px-2 py-1">{r.status}</td>
                  <td className="border px-2 py-1">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
