import api from './api';

const HRAPI = {
  getAll: () => api.get('/hr'),
  getGenderStats: () => api.get('/hr/stats/gender'),
  create: (data) => api.post('/hr', data),
  update: (id, data) => api.put(`/hr/${id}`, data),
  delete: (id) => api.delete(`/hr/${id}`),
  resequence: () => api.post('/hr/resequence'),
  reposition: (id, newNo) => api.post(`/hr/${id}/reposition`, { newNo }),
};

export default HRAPI;
