import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Phone, Lock, Eye, EyeOff, TreeDeciduous } from 'lucide-react';

export default function StaffLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const API_BASE_RAW = (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) || '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  // Telegram WebApp detection
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.ready();
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_PREFIX}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.phone.trim(), password: form.password }),
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

      if (!res.ok) throw new Error(data.message || 'ការចូលប្រើប្រាស់បានបរាជ័យ');

      login(data.token, data.user);

      const perms = Array.isArray(data?.user?.permissions) ? data.user.permissions : [];
      const isPending = perms.length === 0;
      const roles = Array.isArray(data?.user?.roles) ? data.user.roles : [];
      const isAdmin = roles.some((r) => (r?.name || r) === 'Admin');
      const isStaffOnly = !isAdmin && roles.length === 1 && (roles[0]?.name || roles[0]) === 'User';
      const redirect = searchParams.get('redirect');

      if (isPending) {
        navigate('/employee-register', { replace: true });
      } else if (redirect) {
        navigate(decodeURIComponent(redirect), { replace: true });
      } else {
        navigate('/staff-biography', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្ដងទៀត');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f0f7ff 0%, #e0e7ff 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Hanuman', 'Inter', sans-serif"
    }}>
      {/* Background blobs for aesthetics */}
      <div style={{ position: 'fixed', top: '-10%', right: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(33, 150, 243, 0.1)', filter: 'blur(60px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-10%', left: '-10%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', filter: 'blur(60px)', zIndex: 0 }} />

      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '40px 30px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        zIndex: 1,
        textAlign: 'center'
      }}>
        {/* Logo Section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #2196f3, #1565c0)',
            borderRadius: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(33, 150, 243, 0.3)'
          }}>
            <TreeDeciduous size={40} color="white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Y&J PORTAL</h1>
          <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>ប្រព័ន្ធគ្រប់គ្រងវត្តមានបុគ្គលិក</p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#ef4444',
            padding: '12px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px',
            border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Phone Input */}
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', marginLeft: '4px' }}>Staff ID ឬ លេខទូរស័ព្ទ</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Phone size={18} />
              </div>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Staff ID ឬ លេខទូរស័ព្ទ"
                spellCheck="false"
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  borderRadius: '14px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  background: '#f8fafc'
                }}
                required
                disabled={saving}
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', marginLeft: '4px' }}>លេខសម្ងាត់</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Lock size={18} />
              </div>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password || ''}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                spellCheck="false"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 44px',
                  borderRadius: '14px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  background: '#f8fafc'
                }}
                required
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                disabled={saving}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #2196f3, #1565c0)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '8px',
              boxShadow: '0 4px 15px rgba(33, 150, 243, 0.3)',
              transition: 'transform 0.2s, opacity 0.2s',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? (
              'កំពុងចូល...'
            ) : (
              <>
                <LogIn size={20} />
                ចូលប្រើប្រាស់
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            មិនទាន់មានគណនី?{' '}
            <a href="/staff-signup" style={{ color: '#2196f3', fontWeight: 700, textDecoration: 'none' }}>ចុះឈ្មោះនៅទីនេះ</a>
          </p>
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a href="/login" style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>← ចូលប្រើក្នុងនាមជា Admin</a>
            <a href="/forgot-password" style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none', fontWeight: 500 }}>ភ្លេចលេខសម្ងាត់?</a>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
        © 2026 KSFH Hospital Management System
      </div>
    </div>
  );
}
