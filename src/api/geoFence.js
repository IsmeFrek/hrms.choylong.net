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

export const listGeoFencePolicies = async () =>
  json(await fetch('/api/geo-fence/policies', { headers: authHeaders() }));

export const createGeoFencePolicy = async (payload) =>
  json(await fetch('/api/geo-fence/policies', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }));

export const updateGeoFencePolicy = async (id, payload) =>
  json(await fetch(`/api/geo-fence/policies/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  }));

export const deleteGeoFencePolicy = async (id) =>
  json(await fetch(`/api/geo-fence/policies/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }));
