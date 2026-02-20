import React, { useEffect, useMemo, useState } from 'react';
import {
  createGeoFencePolicy,
  deleteGeoFencePolicy,
  listGeoFencePolicies,
  updateGeoFencePolicy,
} from '../api/geoFence';
import usePermission from '../hooks/usePermission';

const emptyForm = () => ({
  id: null,
  name: '',
  enabled: true,
  priority: 0,
  match: {
    staffId: '',
    department: '',
    skill: '',
    position: '',
    officerType: '',
    role: '',
  },
  fence: {
    centerLat: '',
    centerLng: '',
    radiusM: 200,
    maxAccuracyM: 250,
  },
  note: '',
});

const normNum = (v, fallback = null) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  if (!Number.isFinite(n)) return fallback;
  return n;
};

export default function GeoFencePoliciesPage() {
  const perms = usePermission() || {};
  const canEdit = !!perms.canManageUsers;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const [form, setForm] = useState(() => emptyForm());
  const isEditing = !!form.id;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listGeoFencePolicies();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    const copy = items.slice(0);
    copy.sort((a, b) => {
      const pa = Number(a?.priority || 0);
      const pb = Number(b?.priority || 0);
      if (pb !== pa) return pb - pa;
      return String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || ''));
    });
    return copy;
  }, [items]);

  const startNew = () => setForm(emptyForm());

  const startEdit = (p) => {
    setForm({
      id: p?._id || p?.id || null,
      name: p?.name || '',
      enabled: p?.enabled !== false,
      priority: Number(p?.priority || 0),
      match: {
        staffId: p?.match?.staffId || '',
        department: p?.match?.department || '',
        skill: p?.match?.skill || '',
        position: p?.match?.position || '',
        officerType: p?.match?.officerType || '',
        role: p?.match?.role || '',
      },
      fence: {
        centerLat: p?.fence?.centerLat ?? '',
        centerLng: p?.fence?.centerLng ?? '',
        radiusM: Number(p?.fence?.radiusM || 200),
        maxAccuracyM: Number(p?.fence?.maxAccuracyM || 250),
      },
      note: p?.note || '',
    });
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: String(form.name || '').trim(),
        enabled: !!form.enabled,
        priority: Number(form.priority || 0),
        match: {
          staffId: String(form.match.staffId || '').trim(),
          department: String(form.match.department || '').trim(),
          skill: String(form.match.skill || '').trim(),
          position: String(form.match.position || '').trim(),
          officerType: String(form.match.officerType || '').trim(),
          role: String(form.match.role || '').trim(),
        },
        fence: {
          centerLat: normNum(form.fence.centerLat, null),
          centerLng: normNum(form.fence.centerLng, null),
          radiusM: normNum(form.fence.radiusM, 200),
          maxAccuracyM: normNum(form.fence.maxAccuracyM, 250),
        },
        note: String(form.note || '').trim(),
      };

      if (form.id) {
        await updateGeoFencePolicy(form.id, payload);
      } else {
        await createGeoFencePolicy(payload);
      }
      await load();
      startNew();
    } catch (e2) {
      setError(e2?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p) => {
    const id = p?._id || p?.id;
    if (!id) return;
    if (!window.confirm('Delete this geo-fence policy?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteGeoFencePolicy(id);
      await load();
      if (form.id === id) startNew();
    } catch (e) {
      setError(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Geo-fence Policies</h1>
          <p className="text-sm text-gray-600">កំណត់ទីតាំង (lat/lng + radius) តាមផ្នែក/ជំនាញ/បុគ្គលិក ដើម្បីបិទ/បើកប៊ូតុងស្កេនវត្តមាន។</p>
        </div>
        <button className="px-3 py-2 border rounded" onClick={startNew} disabled={saving}>New</button>
      </div>

      {error && <div className="mb-3 text-red-600">{error}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 text-sm font-medium">Policies</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Priority</th>
                  <th className="text-left p-2">Match</th>
                  <th className="text-left p-2">Fence</th>
                  <th className="text-right p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="p-3" colSpan={4}>Loading...</td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td className="p-3" colSpan={4}>No policies yet</td></tr>
                ) : sorted.map((p) => {
                  const id = p?._id || p?.id;
                  const match = p?.match || {};
                  const fence = p?.fence || {};
                  return (
                    <tr key={id} className="border-t">
                      <td className="p-2 align-top">
                        <div className="font-medium">{Number(p?.priority || 0)}</div>
                        <div className={`text-xs ${p?.enabled === false ? 'text-red-600' : 'text-green-700'}`}>{p?.enabled === false ? 'disabled' : 'enabled'}</div>
                        <div className="text-xs text-gray-600 truncate max-w-[12rem]" title={p?.name || ''}>{p?.name || ''}</div>
                      </td>
                      <td className="p-2 align-top">
                        <div className="text-xs text-gray-800">staffId: <span className="font-mono">{match.staffId || '-'}</span></div>
                        <div className="text-xs text-gray-800">dept: {match.department || '-'}</div>
                        <div className="text-xs text-gray-800">skill: {match.skill || '-'}</div>
                        <div className="text-xs text-gray-500">pos: {match.position || '-'}</div>
                      </td>
                      <td className="p-2 align-top">
                        <div className="text-xs text-gray-800">center: {Number.isFinite(fence.centerLat) ? fence.centerLat : '-'}, {Number.isFinite(fence.centerLng) ? fence.centerLng : '-'}</div>
                        <div className="text-xs text-gray-800">radiusM: {Number(fence.radiusM || 0)}</div>
                        <div className="text-xs text-gray-500">maxAccM: {Number(fence.maxAccuracyM || 0)}</div>
                      </td>
                      <td className="p-2 text-right align-top space-x-2">
                        <button className="px-2 py-1 border rounded" onClick={() => startEdit(p)} disabled={saving}>Edit</button>
                        <button className="px-2 py-1 border rounded text-red-600" onClick={() => onDelete(p)} disabled={!canEdit || saving}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">{isEditing ? 'Edit policy' : 'Create policy'}</div>
            {isEditing && <button className="text-sm px-2 py-1 border rounded" onClick={startNew} disabled={saving}>Cancel</button>}
          </div>

          <form onSubmit={onSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="text-gray-700 mb-1">Name</div>
                <input className="border rounded px-3 py-2 w-full" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className="text-sm">
                <div className="text-gray-700 mb-1">Priority</div>
                <input type="number" className="border rounded px-3 py-2 w-full" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
              <span>Enabled</span>
            </label>

            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">Match (optional)</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Department (HR.Department_Kh)</div>
                  <input className="border rounded px-3 py-2 w-full" value={form.match.department} onChange={(e) => setForm((p) => ({ ...p, match: { ...p.match, department: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Skill (HR.skill)</div>
                  <input className="border rounded px-3 py-2 w-full" value={form.match.skill} onChange={(e) => setForm((p) => ({ ...p, match: { ...p.match, skill: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Staff ID</div>
                  <input className="border rounded px-3 py-2 w-full" value={form.match.staffId} onChange={(e) => setForm((p) => ({ ...p, match: { ...p.match, staffId: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Position</div>
                  <input className="border rounded px-3 py-2 w-full" value={form.match.position} onChange={(e) => setForm((p) => ({ ...p, match: { ...p.match, position: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Officer Type</div>
                  <input className="border rounded px-3 py-2 w-full" value={form.match.officerType} onChange={(e) => setForm((p) => ({ ...p, match: { ...p.match, officerType: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Role (optional)</div>
                  <input className="border rounded px-3 py-2 w-full" value={form.match.role} onChange={(e) => setForm((p) => ({ ...p, match: { ...p.match, role: e.target.value } }))} />
                </label>
              </div>
              <div className="text-xs text-gray-500 mt-2">Priority ខ្ពស់ នឹងឈ្នះ។ បើ priority ដូចគ្នា នឹងយក rule ដែល match ច្រើនជាង។</div>
            </div>

            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">Fence</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Center Lat</div>
                  <input className="border rounded px-3 py-2 w-full" placeholder="11.56..." value={form.fence.centerLat} onChange={(e) => setForm((p) => ({ ...p, fence: { ...p.fence, centerLat: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Center Lng</div>
                  <input className="border rounded px-3 py-2 w-full" placeholder="104.92..." value={form.fence.centerLng} onChange={(e) => setForm((p) => ({ ...p, fence: { ...p.fence, centerLng: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Radius (meters)</div>
                  <input type="number" className="border rounded px-3 py-2 w-full" value={form.fence.radiusM} onChange={(e) => setForm((p) => ({ ...p, fence: { ...p.fence, radiusM: e.target.value } }))} />
                </label>
                <label className="text-sm">
                  <div className="text-gray-700 mb-1">Max accuracy (meters)</div>
                  <input type="number" className="border rounded px-3 py-2 w-full" value={form.fence.maxAccuracyM} onChange={(e) => setForm((p) => ({ ...p, fence: { ...p.fence, maxAccuracyM: e.target.value } }))} />
                </label>
              </div>
              <div className="text-xs text-gray-500 mt-2">បើ accuracy ធំជាង maxAccuracyM នឹងបិទប៊ូតុងស្កេន (GPS មិនច្បាស់)។</div>
            </div>

            <label className="text-sm block">
              <div className="text-gray-700 mb-1">Note</div>
              <textarea className="border rounded px-3 py-2 w-full" rows={2} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
            </label>

            <div className="flex gap-2">
              <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded" disabled={!canEdit || saving}>
                {saving ? 'Saving...' : (isEditing ? 'Save changes' : 'Create')}
              </button>
              <button type="button" className="px-3 py-2 border rounded" onClick={load} disabled={saving}>Refresh</button>
            </div>

            {!canEdit && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                You can view policies, but you don't have permission to edit (need manage:users).
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
