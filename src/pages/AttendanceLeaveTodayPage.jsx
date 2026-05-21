import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// Lucide icons replaced with emojis for stability
import api from '../services/api';

const AttendanceLeaveTodayPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch both daily report and leave requests for today
      const [attRes, leaveReqsRes] = await Promise.all([
        api.get('/attendance/daily-report-list', { params: { date: selectedDate } }).catch(() => ({ data: [] })),
        api.get('/leave-requests', { params: { from: selectedDate, to: selectedDate } }).catch(() => ({ data: [] }))
      ]);

      const attRecords = Array.isArray(attRes.data) ? attRes.data : [];
      const approvedLeaves = (Array.isArray(leaveReqsRes.data) ? leaveReqsRes.data : []).filter(l => (l.status || '').toLowerCase() === 'approved');

      // Fetch HR list to get full names and details if needed
      const hrRes = await api.get('/hr').catch(() => ({ data: [] }));
      const hrList = Array.isArray(hrRes.data) ? hrRes.data : [];
      const hrMap = new Map();
      hrList.forEach(h => {
        const sid = (h.staffId || '').toString().trim();
        if (sid) hrMap.set(sid, h);
        const sidNoZero = sid.replace(/^0+/, '');
        if (sidNoZero !== sid) hrMap.set(sidNoZero, h);
      });

      // Build leave map from requests
      const leaveMap = new Map();
      approvedLeaves.forEach(l => {
        const sid = (l.staffId || l.no || (l.employeeId && (l.employeeId.staffId || l.employeeId.no)) || '').toString().trim();
        if (sid) {
          leaveMap.set(sid, l);
          const norm = sid.replace(/^0+/, '');
          if (norm !== sid) leaveMap.set(norm, l);
        }
      });

      // Combine and filter only those on leave
      const leaveKeywords = ['leave', 'ច្បាប់', 'សុំច្បាប់', 'លាឈប់', 'សម្រាកព្យាបាល', 'មាតុភាព', 'រៀបការ', 'បុណ្យសព'];
      
      const allLeaveStaff = [];
      const processedSids = new Set();

      // 1. Process Daily Report records marked as leave
      attRecords.forEach(r => {
        const sid = (r.staffId || '').toString().trim();
        const normSid = sid.replace(/^0+/, '');
        const isLeave = r.status === 'leave' || (r.status && leaveKeywords.some(k => r.status.toLowerCase().includes(k)));
        
        if (isLeave) {
          const lReq = leaveMap.get(sid) || leaveMap.get(normSid);
          const hr = hrMap.get(sid) || hrMap.get(normSid);
          
          allLeaveStaff.push({
            staffId: r.staffId,
            name: r.staffName || hr?.khmerName || hr?.name || '—',
            department: r.department || hr?.Department_Kh || '—',
            position: hr?.position || '—',
            leaveType: lReq?.type || r.leaveType || r.status || 'ផ្សេងៗ',
            leaveReason: lReq?.reason || r.leaveReason || '—',
            source: 'Daily Report'
          });
          processedSids.add(sid);
          processedSids.add(normSid);
        }
      });

      // 2. Add approved leaves that weren't in the daily report (or report not synced)
      approvedLeaves.forEach(l => {
        const sid = (l.staffId || l.no || (l.employeeId && (l.employeeId.staffId || l.employeeId.no)) || '').toString().trim();
        const normSid = sid.replace(/^0+/, '');
        
        if (!processedSids.has(sid) && !processedSids.has(normSid)) {
          const hr = hrMap.get(sid) || hrMap.get(normSid);
          allLeaveStaff.push({
            staffId: sid,
            name: hr?.khmerName || hr?.name || l.staffName || '—',
            department: hr?.Department_Kh || hr?.department || '—',
            position: hr?.position || '—',
            leaveType: l.type || 'ផ្សេងៗ',
            leaveReason: l.reason || '—',
            source: 'Leave Request'
          });
          processedSids.add(sid);
          processedSids.add(normSid);
        }
      });

      setData(allLeaveStaff);
    } catch (error) {
      console.error('Error fetching leave data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group and Sort Logic
  const groupedData = useMemo(() => {
    let filtered = data;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = data.filter(r => 
        r.name.toLowerCase().includes(s) || 
        r.staffId.toLowerCase().includes(s) || 
        r.department.toLowerCase().includes(s) ||
        r.leaveType.toLowerCase().includes(s)
      );
    }

    // Group by leaveType
    const groups = {};
    filtered.forEach(r => {
      const type = r.leaveType || 'ផ្សេងៗ';
      if (!groups[type]) groups[type] = [];
      groups[type].push(r);
    });

    // Convert to array and sort by count descending
    return Object.entries(groups)
      .map(([type, members]) => ({ type, members }))
      .sort((a, b) => b.members.length - a.members.length);
  }, [data, searchTerm]);

  const totalLeaves = data.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span style={{ fontSize: 20 }}>⬅️</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
                  របាយការណ៍អ្នកសុំច្បាប់ (ថ្ងៃនេះ)
                </h1>
                <p className="text-xs text-gray-500">សរុប: {totalLeaves} នាក់</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <span style={{ fontSize: 16 }}>📅</span>
              </div>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <span style={{ fontSize: 16 }}>🖨️</span>
                <span>បោះពុម្ព</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="ស្វែងរកតាម ឈ្មោះ, អត្តលេខ, ផ្នែក..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <span style={{ fontSize: 16, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            <span style={{ fontSize: 16 }}>📊</span>
            <span>រៀបតាមចំនួន: ច្រើនទៅតិច</span>
          </div>
        </div>

        {/* Summary Mini Cards */}
        {!loading && groupedData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            {groupedData.map((group) => (
              <div key={group.type} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mb-1 truncate w-full px-1">
                  {group.type}
                </span>
                <span className="text-xl font-black text-blue-700">{group.members.length}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 animate-pulse">កំពុងទាញទិន្នន័យ...</p>
          </div>
        ) : groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <span style={{ fontSize: 32 }}>👥</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900">មិនមានទិន្នន័យអ្នកសុំច្បាប់ទេ</h3>
            <p className="text-gray-500 mt-1">មិនមានបុគ្គលិកណាម្នាក់ស្ថិតក្នុងស្ថានភាពសុំច្បាប់នៅកាលបរិច្ឆេទនេះឡើយ</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedData.map((group) => (
              <div key={group.type} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                      <span style={{ fontSize: 20 }}>📄</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white leading-none mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                        {group.type}
                      </h2>
                      <p className="text-blue-100 text-xs">សរុបក្រុមនេះ: {group.members.length} នាក់</p>
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white/30">{group.members.length}</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-left border-b border-gray-100">
                        <th className="px-6 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-16">ល.រ</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">អត្តលេខ</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">ឈ្មោះមន្ត្រី</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">មុខតំណែង</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">ផ្នែក/អង្គភាព</th>
                        <th className="px-6 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">មូលហេតុ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {group.members.map((person, idx) => (
                        <tr key={person.staffId + idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-400 font-medium">{idx + 1}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono font-bold border border-gray-200">
                              {person.staffId}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                              {person.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{person.position}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{person.department}</td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 italic max-w-xs truncate">
                              {person.leaveReason}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print Footer */}
      <div className="hidden print:block fixed bottom-0 left-0 right-0 p-8 border-t border-gray-200 bg-white">
        <div className="flex justify-between items-end">
          <div className="text-sm text-gray-500 italic">របាយការណ៍បង្កើតដោយស្វ័យប្រវត្តិ</div>
          <div className="text-center min-w-[200px]">
            <p className="text-sm mb-8">{new Date().toLocaleDateString('km-KH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold text-gray-900">ហត្ថលេខា និងត្រា</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceLeaveTodayPage;
