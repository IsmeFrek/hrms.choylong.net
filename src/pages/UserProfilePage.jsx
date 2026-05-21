import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Key, 
  MessageSquare, 
  ChevronRight,
  Send,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50/50 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-32 md:h-48 w-full relative">
        <div className="absolute -bottom-12 left-6 md:left-12">
          <div className="h-24 w-24 md:h-32 md:w-32 rounded-3xl bg-white p-2 shadow-xl ring-4 ring-white/50 overflow-hidden">
            <div className="h-full w-full rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <User size={48} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-16 lg:mt-20 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Shield className="text-indigo-600" size={20} />
              ឯកសារផ្ទាល់ខ្លួន
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <User size={18} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Staff ID</div>
                  <div className="text-sm font-bold text-slate-700">{user?.staffId || '---'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <User size={18} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">ឈ្មោះពេញ</div>
                  <div className="text-sm font-bold text-slate-700">{user?.fullName || '---'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <Mail size={18} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Email</div>
                  <div className="text-sm font-bold text-slate-700 truncate max-w-[180px]">{user?.email || '---'}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <Phone size={18} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">លេខទូរស័ព្ទ</div>
                  <div className="text-sm font-bold text-slate-700">{user?.phone || '---'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Settings Section */}
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Send size={80} className="text-blue-500 rotate-12" />
            </div>
            
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="text-blue-500" size={20} />
              Telegram
            </h2>
            
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              ភ្ជាប់គណនី Telegram របស់អ្នកដើម្បីទទួលការជូនដំណឹងពីប្រព័ន្ធដោយស្វ័យប្រវត្តិ។
            </p>

            <button
              onClick={() => navigate('/link-telegram')}
              className="w-full group flex items-center justify-between p-4 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-bold text-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                  <Send size={16} />
                </div>
                ភ្ជាប់ Telegram ឥឡូវ
              </div>
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Right Column: Security */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
              <Key className="text-amber-500" size={22} />
              សុវត្ថិភាព និងលេខសម្ងាត់
            </h2>

            {passwordError && (
              <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm animate-shake">
                <Shield size={18} />
                {passwordError}
              </div>
            )}

            {passwordMessage && (
              <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm animate-fade-in">
                <Shield size={18} />
                {passwordMessage}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">លេខសម្ងាត់បច្ចុប្បន្ន</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all text-sm"
                      placeholder="••••••••"
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                      disabled={changingPassword}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">លេខសម្ងាត់ថ្មី</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                      <Key size={18} />
                    </div>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all text-sm"
                      placeholder="••••••••"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      disabled={changingPassword}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">បញ្ជាក់លេខសម្ងាត់ថ្មី</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1 group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                        <Shield size={18} />
                      </div>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all text-sm"
                        placeholder="••••••••"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        disabled={changingPassword}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswords((v) => !v)}
                      className="px-4 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all border border-slate-100"
                      aria-label={showPasswords ? 'លាក់' : 'បង្ហាញ'}
                    >
                      {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <p className="text-xs text-slate-400 max-w-[280px]">
                  ចំណាំ៖ លេខសម្ងាត់ត្រូវតែមានយ៉ាងហោចណាស់ ៦ តួអក្សរ។
                </p>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                >
                  {changingPassword ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      កំពុងផ្លាស់ប្តូរ...
                    </>
                  ) : (
                    <>រក្សាទុក</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
