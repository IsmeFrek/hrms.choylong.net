import React, { useState, useEffect } from 'react';
import { getFileTransferStats } from '../api/fileTransferStats';
import { FaCheckCircle, FaClock, FaExclamationCircle, FaChartBar } from 'react-icons/fa';

export default function FileTransferSummaryCards({ onRefresh = null }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (showStats) {
      fetchStats();
    }
  }, [showStats]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getFileTransferStats();
      setStats(data);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!showStats) {
    return (
      <button 
        onClick={() => setShowStats(true)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
      >
        <FaChartBar />
        បង្ហាញស្ថិតិ
      </button>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-semibold text-gray-700">ស្ថិតិសង្ខេប</h5>
        <div className="flex gap-2">
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'កំពុងផ្ទុក...' : 'ផ្ទុកឡើងវិញ'}
          </button>
          <button 
            onClick={() => setShowStats(false)}
            className="text-xs px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            លាក់
          </button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">សរុប</p>
                <p className="text-lg font-bold text-gray-900">{stats.summary.សរុប}</p>
              </div>
              <div className="text-blue-600 opacity-60">📁</div>
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-lg border border-green-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700">រួចរាល់</p>
                <p className="text-lg font-bold text-green-700">{stats.summary.រួចរាល់}</p>
              </div>
              <FaCheckCircle className="text-green-600" />
            </div>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-700">មិនទាន់រួច</p>
                <p className="text-lg font-bold text-yellow-700">{stats.summary.មិនទាន់រួច}</p>
              </div>
              <FaClock className="text-yellow-600" />
            </div>
          </div>

          <div className="bg-red-50 p-3 rounded-lg border border-red-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-700">មិនមានផ្ញើមតិ</p>
                <p className="text-lg font-bold text-red-700">{stats.summary.មិនមានផ្ញើមតិ}</p>
              </div>
              <FaExclamationCircle className="text-red-600" />
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">កំពុងទាញយកទិន្នន័យ...</span>
        </div>
      ) : (
        <div className="text-center p-4 text-sm text-gray-500">
          មានបញ្ហាក្នុងការទាញយកទិន្នន័យ
        </div>
      )}
    </div>
  );
}