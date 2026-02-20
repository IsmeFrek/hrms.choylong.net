import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function UserProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Resolve API base
  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('ដែនទាំងអស់ត្រូវបានបំពេញ');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('លេខសម្ងាត់ថ្មីមិនផ្គូផ្គងទេ');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('លេខសម្ងាត់ត្រូវតែយ៉ាងហោចណាស់ ៦ តួអក្សរ');
      return;
    }

    setChangingPassword(true);
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      const token = auth?.token;
      
      if (!token) {
        setPasswordError('មិនមានលេខ authentication ឡើយ។ សូមចូលឡើងវិញ');
        setChangingPassword(false);
        return;
      }

      const res = await fetch(`${API_PREFIX}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setPasswordMessage('លេខសម្ងាត់បានប្រែប្រួលដោយជោគជ័យ!');
        setPasswordForm({
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(() => {
          setPasswordMessage('');
        }, 3000);
      } else {
        setPasswordError(data.message || 'មានបញ្ហាក្នុងការប្រែប្រួលលេខសម្ងាត់');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      setPasswordError('មានបញ្ហាក្នុងការប្រែប្រួលលេខសម្ងាត់');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">ប្រែប្រួលលេខសម្ងាត់</h1>

      {/* Change Password Section */}
      <div className="bg-white border rounded-lg p-6">
        {passwordError && (
          <div className="mb-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
            {passwordError}
          </div>
        )}

        {passwordMessage && (
          <div className="mb-3 text-green-700 text-sm bg-green-50 border border-green-200 rounded p-3">
            {passwordMessage}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">លេខសម្ងាត់បច្ចុប្បន្ន</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={passwordForm.oldPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
              disabled={changingPassword}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">លេខសម្ងាត់ថ្មី</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              disabled={changingPassword}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">បញ្ជាក់លេខសម្ងាត់ថ្មី</label>
            <div className="flex items-center gap-2">
              <input
                type={showPasswords ? 'text' : 'password'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                disabled={changingPassword}
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="px-2 py-2 text-xs border rounded"
                disabled={changingPassword}
                aria-label={showPasswords ? 'លាក់លេខសម្ងាត់' : 'បង្ហាញលេខសម្ងាត់'}
              >
                {showPasswords ? 'លាក់' : 'បង្ហាញ'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="w-full bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {changingPassword ? 'កំពុងប្រែប្រួល...' : 'ប្រែប្រួលលេខសម្ងាត់'}
          </button>
        </form>
      </div>
    </div>
  );
}
