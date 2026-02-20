const json = async (res) => {
  const txt = await res.text().catch(() => '');
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || txt || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
};

const authToken = () => {
  try { return JSON.parse(localStorage.getItem('auth') || '{}').token || ''; } catch { return ''; }
};
const authHeaders = (extra = {}) => {
  const t = authToken();
  return { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
};

// users
export const listUsers = async (q = '') =>
  json(await fetch(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, { headers: authHeaders() }));

export const createUser = async (payload) =>
  json(await fetch(`/api/users`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }));

export const updateUser = async (id, payload) =>
  json(await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }));

export const deleteUser = async (id) =>
  json(await fetch(`/api/users/${id}`, { method: 'DELETE', headers: authHeaders() }));

export const sendTestNotification = async (userId, payload = {}) =>
  json(await fetch(`/api/notifications/send-test`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, ...payload }),
  }));

// roles
export const listRoles = async () =>
  json(await fetch(`/api/roles`, { headers: authHeaders() }));

export const listAllPermissions = async () =>
  json(await fetch(`/api/roles/permissions`, { headers: authHeaders() }));

export const createRole = async (payload) =>
  json(await fetch(`/api/roles`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }));

export const updateRole = async (id, payload) =>
  json(await fetch(`/api/roles/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }));

export const deleteRole = async (id) =>
  json(await fetch(`/api/roles/${id}`, { method: 'DELETE', headers: authHeaders() }));
