import React, { useEffect, useState } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { Search, Clock, User, Shield, Info, Calendar } from 'lucide-react';

export default function ActivityReportPage() {
  const perms = usePermission();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(50);
  const [skip, setSkip] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', { params: { q, limit, skip } });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Fetch logs failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (perms.isAdmin) fetchLogs();
  }, [perms.isAdmin, q, skip, limit]);

  const formatDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleString('km-KH', { 
      year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'LOGIN': return 'bg-blue-100 text-blue-700';
      case 'CREATE': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-yellow-100 text-yellow-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (!perms.isAdmin) {
    return <div className="p-8 text-center text-gray-500">អ្នកមិនមានសិទ្ធិចូលមើលទំព័រនេះទេ។</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">របាយការណ៍សកម្មភាពប្រព័ន្ធ</h1>
          <p className="text-sm text-gray-500">ត្រួតពិនិត្យរាល់សកម្មភាពរបស់អ្នកប្រើប្រាស់ក្នុងប្រព័ន្ធ</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-gray-700">សរុប: {total} សកម្មភាព</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="ស្វែងរកតាមឈ្មោះ, សកម្មភាព, ឬចំណងជើង..." 
            value={q} 
            onChange={(e) => { setQ(e.target.value); setSkip(0); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">បង្ហាញ:</span>
          <select 
            value={limit} 
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none"
          >
            <option value={20}>២០</option>
            <option value={50}>៥០</option>
            <option value={100}>១០០</option>
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">កាលបរិច្ឆេទ</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">អ្នកប្រើប្រាស់</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">សកម្មភាព</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ព័ត៌មានលម្អិត</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">កំពុងផ្ទុក...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">មិនមានទិន្នន័យ</td></tr>
              ) : logs.map((log) => (
                <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatDate(log.timestamp)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="text-sm font-medium text-gray-900">{log.userName || 'Unknown'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-1 uppercase font-medium">{log.resource}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2 max-w-md">
                      <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-600 line-clamp-2">{log.details}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                    {log.ip || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            បង្ហាញ {skip + 1} ដល់ {Math.min(skip + limit, total)} ក្នុងចំណោម {total}
          </div>
          <div className="flex gap-2">
            <button 
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - limit))}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
            >
              ថយក្រោយ
            </button>
            <button 
              disabled={skip + limit >= total}
              onClick={() => setSkip(skip + limit)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
            >
              បន្ទាប់
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
