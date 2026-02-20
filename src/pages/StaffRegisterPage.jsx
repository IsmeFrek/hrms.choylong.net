import React, { useState } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';

export default function StaffRegisterPage() {
  const perms = usePermission();
  const [form, setForm] = useState({ fullName: '', phone: '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (!perms.canManageUsers) throw new Error('Permission required: manage:users');
      if (!form.fullName.trim()) throw new Error('សូមបញ្ចូលឈ្មោះ');
      if (!form.phone.trim()) throw new Error('សូមបញ្ចូលលេខទូរស័ព្ទ');
      if (!form.password) throw new Error('សូមបញ្ចូលលេខសម្ងាត់');
      if (form.password.length < 6) throw new Error('លេខសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ 6 តួអក្សរ');
      if (form.password !== form.confirmPassword) throw new Error('Confirm password មិនត្រឹមត្រូវ');

      setSaving(true);
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        password: form.password,
        roleIds: ['User'],
        active: true,
      };
      await api.post('/users', payload);
      setSuccess('បានបង្កើត Account រួចរាល់');
      setForm({ fullName: '', phone: '', password: '', confirmPassword: '' });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">ចុះឈ្មោះបុគ្គលិក (Create Account)</h2>
      <div className="text-sm text-gray-600 mb-4">សម្រាប់ Admin បង្កើត Account ដោយលេខទូរស័ព្ទ</div>

      {error && <div className="mb-3 text-red-700 bg-red-50 border border-red-200 rounded p-2 text-sm">{error}</div>}
      {success && <div className="mb-3 text-green-700 bg-green-50 border border-green-200 rounded p-2 text-sm">{success}</div>}

      <div className="max-w-md bg-white border rounded-lg shadow-sm p-4">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">ឈ្មោះ</label>
            <input
              type="text"
              className="border rounded w-full px-3 py-2"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="ឈ្មោះពេញ"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">លេខទូរស័ព្ទ</label>
            <input
              type="tel"
              className="border rounded w-full px-3 py-2"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="070123456"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <div className="flex items-center gap-2">
              <input
                type={showPw ? 'text' : 'password'}
                className="border rounded w-full px-3 py-2"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
                required
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="px-2 py-2 text-xs border rounded"
                disabled={saving}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Confirm Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              className="border rounded w-full px-3 py-2"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              autoComplete="new-password"
              required
              disabled={saving}
            />
          </div>

          <button className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60" disabled={saving}>
            {saving ? 'Creating...' : 'បង្កើត Account'}
          </button>
        </form>
      </div>

      <div className="mt-4 text-sm">
        <a href="/users" className="text-blue-600 hover:underline">ទៅកាន់ User List</a>
      </div>
    </div>
  );
}
