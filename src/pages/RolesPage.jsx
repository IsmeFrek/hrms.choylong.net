import React, { useEffect, useState, useMemo } from 'react';
import { listRoles, listAllPermissions, createRole, updateRole, deleteRole } from '../api/users';
import { useAuth } from '../context/AuthContext';

// Group permissions by category (outside component to avoid recreation on each render)
const groupPermissions = (permissions) => {
  const groups = {
    'User & Role Management': [],
    'Employees & HR': [],
    'Departments & Units': [],
    'Files & Documents': [],
    'SignSchemas (Signatures)': [],
    'Reports': [],
    'Other': []
  };

  permissions.forEach(perm => {
    if (perm.includes('manage:users') || perm.includes('manage:roles')) {
      groups['User & Role Management'].push(perm);
    } else if (perm.includes('employee') || perm.includes(':hr') || perm.includes('positions') || perm.includes('skills')) {
      groups['Employees & HR'].push(perm);
    } else if (perm.includes('department')) {
      groups['Departments & Units'].push(perm);
    } else if (perm.includes('file') || perm.includes('document')) {
      groups['Files & Documents'].push(perm);
    } else if (perm.includes('signSchema')) {
      groups['SignSchemas (Signatures)'].push(perm);
    } else if (perm.includes('report')) {
      groups['Reports'].push(perm);
    } else {
      groups['Other'].push(perm);
    }
  });

  return groups;
};

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newRole, setNewRole] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Memoize grouped permissions to avoid unnecessary recalculations
  const groupedPerms = useMemo(() => groupPermissions(perms), [perms]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [r, p] = await Promise.all([listRoles(), listAllPermissions()]);
      const basePerms = Array.isArray(p) ? p.slice() : [];
      // Ensure our important permissions are available in the list
      ['delete:fileTransfers', 'send:feedback', 'reply:fileTransfers', 'view:departments', 'edit:departments', 'view:setup', 'view:signSchemas', 'create:signSchemas', 'edit:signSchemas', 'delete:signSchemas'].forEach(np => {
        if (!basePerms.includes(np)) basePerms.push(np);
      });
      // stable sort for readability
      basePerms.sort();
      setRoles(r || []);
      setPerms(basePerms);
    } catch (e) { setError(e.message || 'Load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const { user: currentUser } = useAuth() || {};
  const isAdmin = Boolean(currentUser && (
    (currentUser.roles || []).some(r => (r && (r.name || r).toString?.() === 'Admin')) ||
    (currentUser.permissions || []).includes('manage:roles')
  ));

  const add = async (e) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    setSaving(true);
    try { await createRole({ name: newRole.trim(), permissions: [] }); setNewRole(''); await load(); }
    catch (e) { setError(e.message || 'Create failed'); }
    finally { setSaving(false); }
  };

  const togglePerm = async (role, perm) => {
    setSaving(true);
    try {
      const next = role.permissions?.includes(perm)
        ? role.permissions.filter((p) => p !== perm)
        : [...(role.permissions || []), perm];
      await updateRole(role.id, { permissions: next });
      await load();
    } catch (e) { setError(e.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const saveEditName = async () => {
    if (!editingId) return;
    setSaving(true);
    try { await updateRole(editingId, { name: editingName.trim() }); setEditingId(null); setEditingName(''); await load(); }
    catch (e) { setError(e.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const remove = async (role) => {
    if (!window.confirm(`Delete role ${role.name}?`)) return;
    setSaving(true);
    try { await deleteRole(role.id); await load(); }
    catch (e) { setError(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Role Management</h1>

      <form onSubmit={add} className="flex gap-2 mb-4">
        <input className="border rounded px-3 py-2 w-full" placeholder="New role name" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
        <button disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded">{saving ? 'Saving...' : 'Add'}</button>
      </form>

      {error && <div className="mb-3 text-red-600">{error}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Role</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="p-3" colSpan={2}>Loading...</td></tr>
              ) : roles.length === 0 ? (
                <tr><td className="p-3" colSpan={2}>No roles</td></tr>
              ) : roles.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">
                    {editingId === r.id ? (
                      <input className="border rounded px-2 py-1 w-full" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                    ) : r.name}
                  </td>
                  <td className="p-2 text-right space-x-2">
                    {editingId === r.id ? (
                      <>
                        <button onClick={saveEditName} className="px-2 py-1 border rounded" disabled={!isAdmin || saving}>Save</button>
                        <button onClick={() => { setEditingId(null); setEditingName(''); }} className="px-2 py-1 border rounded" disabled={!isAdmin || saving}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(r.id); setEditingName(r.name); }} className="px-2 py-1 border rounded" disabled={!isAdmin || saving}>Rename</button>
                        <button onClick={() => remove(r)} className="px-2 py-1 border rounded text-red-600" disabled={!isAdmin || saving}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Permissions matrix for selected role or inline per-role toggles */}
        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Permissions</h2>
          <p className="text-xs text-gray-600 mb-3">Toggle permissions per role. អាចកែ លុប មើ់ល</p>
          {roles.map(role => (
            <div key={role.id} className="mb-6 border-t pt-3 first:border-t-0 first:pt-0">
              <div className="font-semibold mb-3 text-blue-700">{role.name}</div>
              {Object.entries(groupedPerms).map(([group, groupPerms]) => 
                groupPerms.length > 0 && (
                  <div key={group} className="mb-4">
                    <div className="text-xs font-medium text-gray-600 mb-2 px-2">{group}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-2">
                      {groupPerms.map(p => (
                        <label key={p} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!role.permissions?.includes(p)}
                            onChange={() => togglePerm(role, p)}
                            disabled={!isAdmin || saving}
                            className="rounded"
                          />
                          <span className="text-sm">{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
