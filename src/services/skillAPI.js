import api from './api';

export const skillAPI = {
  getSkills: () =>
    api.get('/skills').catch((err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return api.get('/skills/public');
      return Promise.reject(err);
    }),
  createSkill: (data) => api.post('/skills', data),
  updateSkill: (id, data) => api.put(`/skills/${id}`, data),
  deleteSkill: (id) => api.delete(`/skills/${id}`)
};
