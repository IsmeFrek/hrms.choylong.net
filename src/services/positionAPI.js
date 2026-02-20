import api from './api';

export const positionAPI = {
  getPositions: () =>
    api.get('/positions').catch((err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return api.get('/positions/public');
      return Promise.reject(err);
    }),
  createPosition: (data) => api.post('/positions', data),
  updatePosition: (id, data) => api.put(`/positions/${id}`, data),
  deletePosition: (id) => api.delete(`/positions/${id}`)
};
