import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PendingApprovalPage() {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');

  const checkStatus = async () => {
    setChecking(true);
    setNote('');
    try {
      const { data } = await api.get('/auth/me');
      const nextUser = data?.user;
      if (nextUser) {
        login(token, nextUser);
        const perms = Array.isArray(nextUser?.permissions) ? nextUser.permissions : [];
        if (perms.length > 0) {
          navigate('/', { replace: true });
          return;
        }
      }
      setNote('នៅតែរង់ចាំ Admin អនុម័ត...');
    } catch (e) {
      setNote(e?.response?.data?.message || e?.message || 'បរាជ័យក្នុងការពិនិត្យស្ថានភាព');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white border rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-1 text-center">កំពុងរង់ចាំការអនុម័ត</h1>
        <p className="text-sm text-gray-600 mb-4 text-center">
          សូមរង់ចាំ Admin បន្ថែមទិន្នន័យរបស់អ្នកទៅក្នុង HR
        </p>

        <div className="text-sm border rounded p-3 bg-gray-50">
          <div><span className="text-gray-600">ឈ្មោះ:</span> {user?.fullName || '-'}</div>
          <div><span className="text-gray-600">លេខទូរស័ព្ទ:</span> {user?.phone || '-'}</div>
        </div>

        <div className="mt-4 text-sm text-gray-700">
          បន្ទាប់ពី Admin អនុម័ត អ្នកអាច Login ម្តងទៀត ដើម្បីប្រើប្រាស់ប្រព័ន្ធ។
        </div>

        {note && (
          <div className="mt-3 text-sm text-gray-700">{note}</div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <a href="/staff-login" className="text-blue-600 hover:underline text-sm">ទៅទំព័រ Login</a>
          <button
            type="button"
            className="px-3 py-2 border rounded text-sm disabled:opacity-60"
            onClick={checkStatus}
            disabled={checking}
          >
            {checking ? 'កំពុងពិនិត្យ...' : 'ពិនិត្យស្ថានភាព'}
          </button>
          <button
            type="button"
            className="px-3 py-2 border rounded text-sm"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
