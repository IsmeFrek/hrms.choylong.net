import api from '../services/api';

// Get file transfer statistics summary
export async function getFileTransferStats() {
  const response = await api.get('/api/file-transfer-stats');
  return response.data;
}

// Get detailed file transfer records by status
export async function getDetailedFileTransferStats(status = null) {
  const params = status ? `?status=${status}` : '';
  const response = await api.get(`/api/file-transfer-stats/detailed${params}`);
  return response.data;
}

export default {
  getFileTransferStats,
  getDetailedFileTransferStats
};