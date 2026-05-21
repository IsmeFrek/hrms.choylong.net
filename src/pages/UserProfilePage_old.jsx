import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function UserProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    telegramChatId: '',
    telegramChatId2: ''
  });

  // Resolve API base
  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_PREFIX}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setForm({
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          telegramChatId: data.telegramChatId || '',
          telegramChatId2: data.telegramChatId2 || ''
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_PREFIX}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        alert('បានរក្សាទុកព័ត៌មាន!');
        await loadProfile();
      } else {
        const data = await res.json();
        alert(data.message || 'មានបញ្ហាក្នុងការរក្សាទុក');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('មានបញ្ហាក្នុងការរក្សាទុក');
    } finally {
      setSaving(false);
    }
  };

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
      const token = localStorage.getItem('token');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-600">កំពុងផ្ទុក...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">ព័ត៌មានផ្ទាល់ខ្លួន</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">ឈ្មោះពេញ</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">លេខទូរសព្ទ</label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>

        {/* Telegram Settings */}
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
            </svg>
            ការកំណត់ Telegram
          </h2>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-sm">
            <div className="font-medium text-yellow-900 mb-2">📌 របៀបរក Chat ID:</div>
            <ol className="list-decimal list-inside space-y-1 text-yellow-800">
              <li>បើក Telegram ហើយស្វែងរក bot ដែលអ្នកចង់ប្រើ</li>
              <li>ចុច <strong>Start</strong> button ឬវាយ <code className="bg-yellow-100 px-1 rounded">/start</code></li>
              <li>Forward សារណាមួយពី bot នោះទៅ <strong>@userinfobot</strong></li>
              <li>@userinfobot នឹងបង្ហាញ Chat ID របស់អ្នក (លេខ numeric)</li>
              <li>ចម្លងលេខនោះមកបំពេញខាងក្រោម</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Chat ID សម្រាប់ Bot 1 (@Chantha_Attendance_bot)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                value={form.telegramChatId}
                onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                placeholder="ឧ. 6716545902"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Chat ID សម្រាប់ Bot 2 (@frek_automatebot)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                value={form.telegramChatId2}
                onChange={(e) => setForm({ ...form, telegramChatId2: e.target.value })}
                placeholder="ឧ. 1234567890"
              />
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">ប្រែប្រួលលេខសម្ងាត់</h2>
          
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">លេខសម្ងាត់បច្ចុប្បន្ន</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">លេខសម្ងាត់ថ្មី</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700"
            >
              {changingPassword ? 'កំពុងប្រែប្រួល...' : 'ប្រែប្រួលលេខសម្ងាត់'}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700"
          >
            {saving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកព័ត៌មាន'}
          </button>
        </div>
      </form>
    </div>
  );
}
