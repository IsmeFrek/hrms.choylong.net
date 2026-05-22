import React, { useState, useEffect } from 'react';
import { getFileTransferStats, getDetailedFileTransferStats } from '../api/fileTransferStats';
import { FaFile, FaCheckCircle, FaClock, FaExclamationCircle } from 'react-icons/fa';

export default function FileTransferStats() {
  const [stats, setStats] = useState(null);
  const [detailedData, setDetailedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showDetailed, setShowDetailed] = useState(false);

  // Fetch summary statistics
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getFileTransferStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching file transfer stats:', err);
      setError('មិនអាចទាញយកទិន្នន័យស្ថិតិបាន');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedData = async (status) => {
    try {
      setLoading(true);
      const data = await getDetailedFileTransferStats(status);
      setDetailedData(data);
      setSelectedStatus(status);
      setShowDetailed(true);
    } catch (err) {
      console.error('Error fetching detailed data:', err);
      setError('មិនអាចទាញយកទិន្នន័យលម្អិតបាន');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'រួចរាល់': return 'text-green-600 bg-green-100';
      case 'មិនទាន់រួច': return 'text-yellow-600 bg-yellow-100';
      case 'មិនមានផ្ញើមតិ': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'រួចរាល់': return <FaCheckCircle className="text-green-600" />;
      case 'មិនទាន់រួច': return <FaClock className="text-yellow-600" />;
      case 'មិនមានផ្ញើមតិ': return <FaExclamationCircle className="text-red-600" />;
      default: return <FaFile className="text-gray-600" />;
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">កំពុងទាញយកទិន្នន័យ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={() => { setError(null); fetchStats(); }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            ព្យាយាមម្តងទៀត
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-[18px] font-semibold">ស្ថិតិឯកសារផ្ទេរ</h4>
          <p className="text-sm text-gray-500">សង្ខេបស្ថានភាពឯកសារតាមការបំពេញមតិ</p>
        </div>
        <button 
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? 'កំពុងផ្ទុក...' : 'ផ្ទុកឡើងវិញ'}
        </button>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">សរុបឯកសារ</p>
                <p className="text-2xl font-bold text-gray-900">{stats.summary.សរុប}</p>
              </div>
              <FaFile className="h-8 w-8 text-blue-600" />
            </div>
            <button
              onClick={() => fetchDetailedData()}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              មើលលម្អិត →
            </button>
          </div>

          <div 
            className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => fetchDetailedData('completed')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">រួចរាល់</p>
                <p className="text-2xl font-bold text-green-600">{stats.summary.រួចរាល់}</p>
              </div>
              <FaCheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-500">
                {stats.summary.សរុប > 0 ? Math.round((stats.summary.រួចរាល់ / stats.summary.សរុប) * 100) : 0}% នៃឯកសារសរុប
              </div>
            </div>
          </div>

          <div 
            className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => fetchDetailedData('notCompleted')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">មិនទាន់រួច</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.summary.មិនទាន់រួច}</p>
              </div>
              <FaClock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-500">
                {stats.summary.សរុប > 0 ? Math.round((stats.summary.មិនទាន់រួច / stats.summary.សរុប) * 100) : 0}% នៃឯកសារសរុប
              </div>
            </div>
          </div>

          <div 
            className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => fetchDetailedData('noFeedback')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">មិនមានផ្ញើមតិ</p>
                <p className="text-2xl font-bold text-red-600">{stats.summary.មិនមានផ្ញើមតិ}</p>
              </div>
              <FaExclamationCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-500">
                {stats.summary.សរុប > 0 ? Math.round((stats.summary.មិនមានផ្ញើមតិ / stats.summary.សរុប) * 100) : 0}% នៃឯកសារសរុប
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Type Breakdown */}
      {stats && stats.typeBreakdown && (
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-4 border-b">
            <h5 className="text-lg font-semibold">ស្ថិតិតាមប្រភេទឯកសារ</h5>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">ប្រភេទឯកសារ</th>
                    <th className="text-center py-3 px-4 text-green-600">រួចរាល់</th>
                    <th className="text-center py-3 px-4 text-yellow-600">មិនទាន់រួច</th>
                    <th className="text-center py-3 px-4 text-red-600">មិនមានផ្ញើមតិ</th>
                    <th className="text-center py-3 px-4">សរុប</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.typeBreakdown).map(([type, counts]) => (
                    <tr key={type} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{type}</td>
                      <td className="py-3 px-4 text-center text-green-600 font-semibold">{counts.completed}</td>
                      <td className="py-3 px-4 text-center text-yellow-600 font-semibold">{counts.notCompleted}</td>
                      <td className="py-3 px-4 text-center text-red-600 font-semibold">{counts.noFeedback}</td>
                      <td className="py-3 px-4 text-center font-semibold">{counts.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detailed View Modal */}
      {showDetailed && detailedData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h5 className="text-lg font-semibold">
                {selectedStatus ? 
                  `ឯកសារ${selectedStatus === 'completed' ? 'រួចរាល់' : selectedStatus === 'notCompleted' ? 'មិនទាន់រួច' : 'មិនមានផ្ញើមតិ'}` :
                  'ឯកសារទាំងអស់'
                }
              </h5>
              <button 
                onClick={() => setShowDetailed(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {selectedStatus && detailedData.records ? (
                <div className="space-y-3">
                  {detailedData.records.map((record) => (
                    <div key={record._id} className="border rounded-lg p-4 hover:bg-gray-50 bg-white">
                      <div className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-sm">
                        <div className="font-semibold text-gray-700">លេខរៀងឯកសារ / No</div>
                        <div>{record.no || 'មិនមាន'}</div>

                        <div className="font-semibold text-gray-700">លេខលិខិត / Letter No</div>
                        <div>{record.letterNo || 'មិនមាន'}</div>

                        <div className="font-semibold text-gray-700">កាលបរិច្ឆេទ / Date</div>
                        <div>{new Date(record.date).toLocaleDateString('km-KH')}</div>

                        <div className="font-semibold text-gray-700">ខ្លឹមសារ / Content</div>
                        <div>{record.content || 'មិនមាន'}</div>

                        <div className="font-semibold text-gray-700">ត្រូវផ្ញើមតិប៉ុន្មាន / Stages needed</div>
                        <div>{record.assignedStages?.length || 0} វគ្គ</div>

                        <div className="font-semibold text-gray-700">អ្នកណាមានមតិរួច / Commented</div>
                        <div>{record.commented && record.commented.length > 0 ? record.commented.join(', ') : 'មិនទាន់មាន'}</div>

                        <div className="font-semibold text-gray-700">អ្នកណានៅ / Pending</div>
                        <div>{record.pending && record.pending.length > 0 ? record.pending.join(', ') : 'គ្មាន'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : detailedData.all ? (
                <div className="space-y-6">
                  {Object.entries(detailedData.all).map(([status, records]) => (
                    <div key={status}>
                      <h6 className="text-md font-semibold mb-3 flex items-center gap-2">
                        {getStatusIcon(status === 'completed' ? 'រួចរាល់' : status === 'notCompleted' ? 'មិនទាន់រួច' : 'មិនមានផ្ញើមតិ')}
                        {status === 'completed' ? 'រួចរាល់' : status === 'notCompleted' ? 'មិនទាន់រួច' : 'មិនមានផ្ញើមតិ'} ({records.length})
                      </h6>
                      <div className="grid gap-2">
                        {records.slice(0, 5).map((record) => (
                          <div key={record._id} className="border rounded-lg p-4 hover:bg-gray-50 bg-white">
                            <div className="grid grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-sm">
                              <div className="font-semibold text-gray-700">លេខរៀងឯកសារ / No</div>
                              <div>{record.no || 'មិនមាន'}</div>

                              <div className="font-semibold text-gray-700">លេខលិខិត / Letter No</div>
                              <div>{record.letterNo || 'មិនមាន'}</div>

                              <div className="font-semibold text-gray-700">កាលបរិច្ឆេទ / Date</div>
                              <div>{new Date(record.date).toLocaleDateString('km-KH')}</div>

                              <div className="font-semibold text-gray-700">ខ្លឹមសារ / Content</div>
                              <div>{record.content || 'មិនមាន'}</div>

                              <div className="font-semibold text-gray-700">ត្រូវផ្ញើមតិប៉ុន្មាន / Stages needed</div>
                              <div>{record.assignedStages?.length || 0} វគ្គ</div>

                              <div className="font-semibold text-gray-700">អ្នកណាមានមតិរួច / Commented</div>
                              <div>{record.commented && record.commented.length > 0 ? record.commented.join(', ') : 'មិនទាន់មាន'}</div>

                              <div className="font-semibold text-gray-700">អ្នកណានៅ / Pending</div>
                              <div>{record.pending && record.pending.length > 0 ? record.pending.join(', ') : 'គ្មាន'}</div>
                            </div>
                          </div>
                        ))}
                        {records.length > 5 && (
                          <p className="text-sm text-gray-500 text-center py-2">
                            និងមានបន្ថែមទៀត {records.length - 5} ឯកសារ
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">មិនមានទិន្នន័យ</p>
              )}
            </div>

            <div className="p-4 border-t">
              <button 
                onClick={() => setShowDetailed(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}