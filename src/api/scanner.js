const BASE = '';

export async function listScans() {
  const res = await fetch(`${BASE}/kshf_hospital_app/scanner/list`);
  if (!res.ok) throw new Error('Failed to list scans');
  const data = await res.json();
  return data.items || [];
}

export async function fetchScan(name) {
  const res = await fetch(`${BASE}/kshf_hospital_app/scanner/file/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Failed to fetch scan');
  const blob = await res.blob();
  return blob;
}

export async function deleteScan(name) {
  const res = await fetch(`${BASE}/kshf_hospital_app/scanner/file/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Failed to delete scan: ' + (text || res.status));
  }
  return await res.json();
}

export async function scanNow(options = {}) {
  // options: { format?: 'jpg'|'pdf', scannerName?: string }
  const payload = { format: (options && options.format) ? options.format : 'jpg' };
  if (options && options.scannerName) payload.scannerName = options.scannerName;
  const res = await fetch(`${BASE}/kshf_hospital_app/scanner/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Failed to start scan: ' + (text || res.status));
  }
  return await res.json();
}

export async function scanNowWithFormat(format, scannerName) {
  const payload = { format: format || 'jpg' };
  if (scannerName) payload.scannerName = scannerName;
  const res = await fetch(`${BASE}/kshf_hospital_app/scanner/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Failed to start scan: ' + (text || res.status));
  }
  return await res.json();
}

export async function checkScanner() {
  try {
    const res = await fetch(`${BASE}/kshf_hospital_app/scanner/check`);
    if (!res.ok) return { naps2: false };
    return await res.json();
  } catch (err) {
    return { naps2: false };
  }
}

export async function listDevices() {
  // Try to get scanner devices from backend. May 404 if backend doesn't support it.
  const res = await fetch(`${BASE}/kshf_hospital_app/scanner/devices`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Failed to list devices: ' + (text || res.status));
  }
  return await res.json();
}

export async function renameScan(oldName, newName) {
  const res = await fetch(`${BASE}/kshf_hospital_app/scanner/file/${encodeURIComponent(oldName)}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Failed to rename scan: ' + (text || res.status));
  }
  return await res.json();
}

export default { listScans, fetchScan, deleteScan, scanNow, scanNowWithFormat, renameScan, checkScanner };
