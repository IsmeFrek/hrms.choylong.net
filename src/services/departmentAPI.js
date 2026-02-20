import api from './api';

export const departmentAPI = {
  getDepartments: () =>
    api.get('/departments').catch((err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return api.get('/departments/public');
      return Promise.reject(err);
    }),
  createDepartment: (data) => api.post('/departments', data),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/departments/${id}`)
};
