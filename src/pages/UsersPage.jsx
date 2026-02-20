import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { listUsers, listRoles, createUser, updateUser, deleteUser, sendTestNotification } from '../api/users';
import usePermission from '../hooks/usePermission';

export default function UsersPage() {
  const perms = usePermission();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  // Change password modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const filtered = useMemo(() => users, [users]);

  const defaultForm = { fullName: '', email: '', phone: '', telegramId: '', password: '', roleIds: [], active: true, newPassword: '', department: '' };
  const [form, setForm] = useState(defaultForm);
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [u, r] = await Promise.all([listUsers(query), listRoles()]);
      setUsers(u || []); setRoles(r || []);
    } catch (e) { setError(e.message || 'Load failed'); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { if (perms.canManageUsers) load(); }, [perms.canManageUsers, load]); // initial

  const search = async (e) => { e?.preventDefault(); await load(); };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setModalOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({
      fullName: u.fullName || '',
      email: u.email || '',
      phone: u.phone || '',
      telegramId: u.telegramId || '',
      password: '',
      newPassword: '',
      roleIds: (u.roles || []).map(r => r.id),
      active: !!u.active,
      department: u.department || '',
    });
    setShowNewPwd(false);
    setModalOpen(true);
  };
  const closeModal = () => { if (!saving) setModalOpen(false); };

  const toggleRole = (rid) => {
    setForm(f => ({
      ...f,
      roleIds: f.roleIds.includes(rid) ? f.roleIds.filter(id => id !== rid) : [...f.roleIds, rid],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone ? form.phone.trim() : undefined,
        telegramId: form.telegramId ? form.telegramId.trim() : undefined,
        ...(editing ? {} : { password: form.password }),
        roleIds: form.roleIds,
        active: form.active,
        department: form.department ? form.department.trim() : undefined,
      };
      if (editing && form.newPassword) payload.password = form.newPassword;
      // require fullName and either a valid email or phone
      const hasEmail = payload.email && payload.email.includes('@');
      const hasPhone = payload.phone && payload.phone.length >= 7;
      if (!payload.fullName || !(hasEmail || hasPhone)) throw new Error('Full name and email (valid) or phone are required');
      if (!editing && !payload.password) throw new Error('Password is required');
      editing ? await updateUser(editing.id, payload) : await createUser(payload);
      await load();
      setModalOpen(false);
    } catch (e2) { setError(e2.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete user ${u.fullName || u.email}?`)) return;
    setSaving(true); setError('');
    try { await deleteUser(u.id); await load(); }
    catch (e) { setError(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  const openChangePwd = (u) => {
    setPwdTarget(u);
    setPwd1('');
    setPwd2('');
    setShowPwd1(false);
    setShowPwd2(false);
    setPwdModalOpen(true);
  };

  const closePwdModal = () => { if (!saving) setPwdModalOpen(false); };

  const submitPwd = async (e) => {
    e.preventDefault();
    if (!pwdTarget) return;
    if (!pwd1 || pwd1.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (pwd1 !== pwd2) { setError('Passwords do not match'); return; }
    setSaving(true); setError('');
    try {
      await updateUser(pwdTarget.id, { password: pwd1 });
      setPwdModalOpen(false);
    } catch (e2) { setError(e2.message || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  const handleSendTest = async (user) => {
    if (!user) return;
    if (!window.confirm(`Send test Telegram message to ${user.fullName || user.email}?`)) return;
    try {
      setSaving(true);
      const payload = { title: 'Test message', message: 'This is a test notification from the system.' };
      await sendTestNotification(user.id, payload);
      alert('Test notification enqueued/sent (check Telegram)');
    } catch (e) {
      console.error('Send test failed', e);
      alert('Failed to send test: ' + (e.message || e));
    } finally { setSaving(false); }
  };

  if (!perms.canManageUsers) {
    return <div className="p-6"><h1 className="text-xl font-semibold mb-2">Users</h1><div className="p-4 border rounded bg-yellow-50 text-yellow-800">Requires permission: manage:users</div></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">User Management</h1>
        <button onClick={openCreate} className="bg-blue-600 text-white px-3 py-2 rounded">Add User</button>
      </div>

      <form onSubmit={search} className="flex gap-2 mb-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, or phone" className="border rounded px-3 py-2 w-full" />
        <button className="border px-3 py-2 rounded">Search</button>
      </form>

      {error && <div className="mb-3 text-red-600">{error}</div>}

      <div className="border rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Full name</th>
              <th className="text-left p-2">Phone / Email</th>
              <th className="text-left p-2">Telegram</th>
              <th className="text-left p-2">Roles</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>No users</td></tr>
            ) : filtered.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.fullName}</td>
                <td className="p-2">{(() => {
                  const raw = u.phone || u.mobile || u.email || '';
                  try { const f = require('../utils/formatPhone').formatPhoneDisplay; return f(raw) || '-'; } catch (e) { return raw || '-'; }
                })()}</td>
                <td className="p-2 text-sm text-gray-600">{u.telegramId || '-'}</td>
                <td className="p-2">{(u.roles || []).map(r => r.name).join(', ')}</td>
                <td className="p-2">{u.active ? 'Active' : 'Disabled'}</td>
                <td className="p-2 text-right space-x-2">
                  <button onClick={() => openEdit(u)} className="px-2 py-1 border rounded">Edit</button>
                  <button onClick={() => openChangePwd(u)} className="px-2 py-1 border rounded">Change Password</button>
                  <button onClick={() => remove(u)} className="px-2 py-1 border rounded text-red-600">Delete</button>
                  <button onClick={() => handleSendTest(u)} className="px-2 py-1 border rounded text-blue-600">Send test</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!modalOpen ? null : (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{editing ? 'Edit user' : 'Add user'}</h2>
              <button onClick={closeModal} className="text-gray-500">✕</button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Full name</label>
                <input className="border rounded px-3 py-2 w-full" value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input type="email" className="border rounded px-3 py-2 w-full" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input type="text" className="border rounded px-3 py-2 w-full" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
                <div>
                  <label className="block text-sm mb-1">Telegram (chat id, @username or t.me link)</label>
                  <input type="text" className="border rounded px-3 py-2 w-full" value={form.telegramId} onChange={(e) => setForm(f => ({ ...f, telegramId: e.target.value }))} placeholder="e.g., 123456789 or @someuser or https://t.me/someuser" />
                </div>
              {!editing && (
                <div>
                  <label className="block text-sm mb-1">Password</label>
                  <div className="flex gap-2 items-center">
                    <input type={showPwd ? 'text' : 'password'} className="border rounded px-3 py-2 w-full" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => setShowPwd(v => !v)}>{showPwd ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
              )}
              {editing && (
                <div>
                  <label className="block text-sm mb-1">Set new password (optional)</label>
                  <div className="flex gap-2 items-center">
                    <input type={showNewPwd ? 'text' : 'password'} className="border rounded px-3 py-2 w-full" value={form.newPassword} onChange={(e) => setForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="Leave empty to keep current password" />
                    <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => setShowNewPwd(v => !v)}>{showNewPwd ? 'Hide' : 'Show'}</button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm mb-1">Department (for leadership users)</label>
                <input type="text" className="border rounded px-3 py-2 w-full" value={form.department} onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g., ផ្នែកបច្ចេកទេស" />
              </div>
              <div>
                <label className="block text-sm mb-2">Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => (
                    <label key={r.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="active" type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} />
                <label htmlFor="active">Active</label>
              </div>

              {error && <div className="text-red-600">{error}</div>}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="w-full border px-3 py-2 rounded">Cancel</button>
                <button disabled={saving} className="w-full bg-green-600 text-white px-3 py-2 rounded">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!pwdModalOpen ? null : (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Change password</h2>
              <button onClick={closePwdModal} className="text-gray-500">✕</button>
            </div>
            <form onSubmit={submitPwd} className="space-y-3">
              <div>
                <div className="text-sm text-gray-500 mb-1">User</div>
                <div className="font-medium">{pwdTarget?.fullName || pwdTarget?.email}</div>
              </div>
              <div>
                <label className="block text-sm mb-1">New password</label>
                <div className="flex gap-2 items-center">
                  <input type={showPwd1 ? 'text' : 'password'} className="border rounded px-3 py-2 w-full" value={pwd1} onChange={(e) => setPwd1(e.target.value)} />
                  <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => setShowPwd1(v => !v)}>{showPwd1 ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Confirm password</label>
                <div className="flex gap-2 items-center">
                  <input type={showPwd2 ? 'text' : 'password'} className="border rounded px-3 py-2 w-full" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
                  <button type="button" className="text-xs border rounded px-2 py-1" onClick={() => setShowPwd2(v => !v)}>{showPwd2 ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              {error && <div className="text-red-600">{error}</div>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closePwdModal} className="w-full border px-3 py-2 rounded">Cancel</button>
                <button disabled={saving} className="w-full bg-green-600 text-white px-3 py-2 rounded">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
