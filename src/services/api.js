import axios from 'axios';
import API_BASE from '../config';

// Always use explicit API_BASE to avoid proxy/port drift on LAN
// Helper: detect if a URL is a legacy endpoint (absolute path)
function isLegacyEndpoint(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('/kshf_hospital_app') || url.startsWith('kshf_hospital_app'))
  );
}

const API_BASE_URL = `${API_BASE.replace(/\/+$/, '')}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
});

// Custom axios instance that supports legacy endpoints
// Intercept requests to allow absolute legacy endpoints (bypass baseURL)
api.interceptors.request.use((config) => {
  if (isLegacyEndpoint(config.url)) {
    // Remove baseURL for legacy endpoints
    config.baseURL = '';
    // Ensure leading slash
    if (!config.url.startsWith('/')) config.url = '/' + config.url;
  }
  return config;
});

// Request interceptor
// Inject auth token if present in localStorage (set by AuthContext)
api.interceptors.request.use((config) => {
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || 'null');
    if (auth?.token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
  } catch { /* ignore */ }
  // DEBUG: print the final request target and whether an Authorization header is present.
  // Remove or comment out this log after diagnosis to avoid leaking tokens in console.
  try {
    const fullUrl = (config.baseURL || '') + (config.url || '');
    const hasAuth = !!(config.headers && (config.headers.Authorization || config.headers.authorization));
    // Use console.debug so it can be filtered easily in DevTools
    console.debug('[API request]', { url: fullUrl, method: config.method, hasAuth });
  } catch (e) {
    // swallow logging errors
  }

  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('API Error:', data || error.message);
    if (status === 401) {
      try { localStorage.removeItem('auth'); } catch {}
      const loc = window.location;
      const current = encodeURIComponent(loc.pathname + loc.search);
      if (!loc.pathname.startsWith('/login')) {
        loc.href = `/login?redirect=${current}`;
      }
    }
    return Promise.reject(error);
  }
);

// Employee API functions
export const employeeAPI = {
  // Get all employees with filters
  getEmployees: (params = {}) => {
    return api.get('/employees', { params });
  },

  // Get single employee
  getEmployee: (id) => {
    return api.get(`/employees/${id}`);
  },

  // Create new employee
  createEmployee: (employeeData) => {
    if (employeeData instanceof FormData) {
      return api.post('/employees', employeeData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.post('/employees', employeeData);
  },

  // Update employee
  updateEmployee: (id, employeeData) => {
    if (employeeData instanceof FormData) {
      return api.put(`/employees/${id}`, employeeData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.put(`/employees/${id}`, employeeData);
  },

  // Delete employee
  deleteEmployee: (id) => {
    return api.delete(`/employees/${id}`);
  },

  // Get departments
  getDepartments: () => {
    // Try the preferred meta endpoint, fall back to the departments collection route
    return api.get('/employees/meta/departments').catch(err => {
      console.debug('employeeAPI.getDepartments: fallback to /departments/public due to', err?.response?.status || err.message || err);
      return api.get('/departments/public');
    });
  },

  // Get positions
  getPositions: () => {
    return api.get('/employees/meta/positions');
  },
};

// Skill API functions
export const skillAPI = {
  getSkills: () => api.get('/skills'),
  createSkill: (skillData) => api.post('/skills', skillData),
  deleteSkill: (id) => api.delete(`/skills/${id}`)
};

// Shift Groups API functions
export const shiftGroupAPI = {
  // Get all shift groups
  getShiftGroups: (params = {}) => api.get('/shift-groups', { params }),
  
  // Get shift group by ID
  getShiftGroup: (id) => api.get(`/shift-groups/${id}`),
  
  // Create new shift group
  createShiftGroup: (data) => api.post('/shift-groups', data),
  
  // Update shift group
  updateShiftGroup: (id, data) => api.put(`/shift-groups/${id}`, data),
  
  // Delete shift group
  deleteShiftGroup: (id, permanent = false) => api.delete(`/shift-groups/${id}`, { params: { permanent } }),
  
  // Get shift groups by department
  getShiftGroupsByDepartment: (department, isActive = true) => 
    api.get(`/shift-groups/department/${encodeURIComponent(department)}`, { params: { isActive } }),
  
  // Update shift group status
  updateShiftGroupStatus: (id, isActive) => 
    api.patch(`/shift-groups/${id}/status`, { isActive })
};

// Schedule Overrides API functions
export const scheduleOverrideAPI = {
  // Get schedule overrides for a date range
  getScheduleOverrides: (params = {}) => api.get('/schedule-overrides', { params }),
  
  // Create or update a schedule override
  createScheduleOverride: (data) => api.post('/schedule-overrides', data),
  
  // Get override for specific employee and date
  getEmployeeScheduleOverride: (employeeRef, date) => 
    api.get(`/schedule-overrides/employee/${encodeURIComponent(employeeRef)}/date/${date}`),
  
  // Delete a schedule override
  deleteScheduleOverride: (id) => api.delete(`/schedule-overrides/${id}`),
  
  // Bulk delete overrides for an employee
  deleteEmployeeOverrides: async (employeeRef, from, to) => {
    const response = await api.get('/schedule-overrides', { 
      params: { employeeRef, from, to } 
    });
    if (response.data && Array.isArray(response.data)) {
      const deletePromises = response.data.map(override => 
        api.delete(`/schedule-overrides/${override._id}`)
      );
      await Promise.all(deletePromises);
    }
    return response;
  }
};

// Public Holidays API
export const holidaysAPI = {
  getPublicHolidays: (year) => api.get(`/holidays`, { params: { year } }),
};

// Department Unit (អង្គភាព) API
export const departmentUnitAPI = {
  getUnits: () => api.get('/department-units'),
  getUnit: (id) => api.get(`/department-units/${id}`),
  updateUnit: (id, data) => api.put(`/department-units/${id}`, data),
  deleteUnit: (id) => api.delete(`/department-units/${id}`),
};

export default api;
