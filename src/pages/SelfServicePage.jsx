import React, { useEffect, useState } from 'react';

export default function SelfServicePage() {
  const [step, setStep] = useState('creds'); // creds -> otp -> edit
  const [form, setForm] = useState({ staffId: '', mobile: '' });
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState(null);
  const [hrId, setHrId] = useState(null);
  const [profile, setProfile] = useState(null);
  const API_BASE = '';

  const startOtp = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/self/otp/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: form.staffId.trim(), mobile: form.mobile.trim() })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Failed');
    // Stop revealing OTP; show SMS notice
    alert('សូមពិនិត្យលេខ OTP តាមសារ SMS នៅលើទូរស័ព្ទរបស់អ្នក');
    setStep('otp');
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/self/otp/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId: form.staffId.trim(), code: otp.trim() })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Failed');
    setToken(data.token); setHrId(data.hrId); setStep('edit');
  };

  const [edit, setEdit] = useState({
    phone: '', email: '', currentPlace: '', birthPlace: '',
    khmerName: '', name: '', position: '', skill: '',
    civilServantId: '', officerId: '', cardNumber: '', nid: '',
    officerType: '', Department_Kh: '', bankAccount: ''
  });

  // Load own profile when entering edit step
  useEffect(() => {
    const load = async () => {
      if (step !== 'edit' || !token) return;
      try {
        const res = await fetch('/api/self/hr/me', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
          setProfile(data);
          // Prefill editable fields from current data
          setEdit(e => ({
            ...e,
            phone: data.phone || '',
            email: data.email || '',
            currentPlace: data.currentPlace || '',
            birthPlace: data.birthPlace || '',
            khmerName: data.khmerName || '',
            name: data.name || '',
            position: data.position || '',
            skill: data.skill || '',
            officerType: data.officerType || '',
            Department_Kh: data.Department_Kh || '',
            civilServantId: data.civilServantId || '',
            officerId: data.officerId || '',
            cardNumber: data.cardNumber || '',
            nid: data.nid || '',
            bankAccount: data.bankAccount || ''
          }));
        }
      } catch {}
    };
    load();
  }, [step, token]);

  const submitEdit = async (e) => {
    e.preventDefault();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`/api/self/hr/${hrId}/self-edit`, {
      method: 'POST', headers,
      body: JSON.stringify({ fields: edit })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || 'Failed');
    alert('បានផ្ញើសំណើរង់ចាំអនុម័ត');
    setStep('creds'); setForm({ staffId: '', mobile: '' }); setOtp(''); setEdit({
      phone: '', email: '', currentPlace: '', birthPlace: '',
      khmerName: '', name: '', position: '', skill: '',
      civilServantId: '', officerId: '', cardNumber: '', nid: '',
      officerType: '', Department_Kh: '', bankAccount: ''
    });
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-semibold mb-2">Self Service</h2>
      {step === 'creds' && (
        <form onSubmit={startOtp} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Staff ID</label>
            <input className="border rounded w-full px-3 py-2" value={form.staffId} onChange={(e)=>setForm(f=>({...f,staffId:e.target.value}))} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Mobile</label>
            <input className="border rounded w-full px-3 py-2" value={form.mobile} onChange={(e)=>setForm(f=>({...f,mobile:e.target.value}))} required />
          </div>
          <button className="bg-blue-600 text-white rounded px-4 py-2">Send OTP</button>
        </form>
      )}
      {step === 'otp' && (
        <form onSubmit={verifyOtp} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Enter OTP</label>
            <input className="border rounded w-full px-3 py-2" value={otp} onChange={(e)=>setOtp(e.target.value)} required />
          </div>
          <button className="bg-blue-600 text-white rounded px-4 py-2">Verify</button>
        </form>
      )}
      {step === 'edit' && (
        <form onSubmit={submitEdit} className="space-y-3">
          {profile && (
            <div className="border rounded p-3 bg-gray-50 text-sm">
              <div className="font-medium mb-1">ព័ត៌មានបុគ្គលិក</div>
              <div><strong>អត្តលេខ:</strong> {profile.staffId || '—'}</div>
              <div><strong>ឈ្មោះ:</strong> {profile.khmerName || profile.name || '—'}</div>
              <div><strong>ភេទ:</strong> {profile.gender || '—'}</div>
              <div><strong>តួនាទី:</strong> {profile.position || '—'}</div>
              <div><strong>នាយកដ្ឋាន:</strong> {profile.Department_Kh || '—'}</div>
            </div>
          )}
          {/* Basic contacts */}
          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input className="border rounded w-full px-3 py-2" value={edit.phone} onChange={(e)=>setEdit(f=>({...f,phone:e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input className="border rounded w-full px-3 py-2" value={edit.email} onChange={(e)=>setEdit(f=>({...f,email:e.target.value}))} />
          </div>
          {/* Identity/location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Khmer Name</label>
              <input className="border rounded w-full px-3 py-2" value={edit.khmerName} onChange={(e)=>setEdit(f=>({...f,khmerName:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Latin Name</label>
              <input className="border rounded w-full px-3 py-2" value={edit.name} onChange={(e)=>setEdit(f=>({...f,name:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Current Address</label>
            <input className="border rounded w-full px-3 py-2" value={edit.currentPlace} onChange={(e)=>setEdit(f=>({...f,currentPlace:e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Birth Place</label>
            <input className="border rounded w-full px-3 py-2" value={edit.birthPlace} onChange={(e)=>setEdit(f=>({...f,birthPlace:e.target.value}))} />
          </div>
          {/* Job/role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Position</label>
              <input className="border rounded w-full px-3 py-2" value={edit.position} onChange={(e)=>setEdit(f=>({...f,position:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Skill</label>
              <input className="border rounded w-full px-3 py-2" value={edit.skill} onChange={(e)=>setEdit(f=>({...f,skill:e.target.value}))} />
            </div>
          </div>
          {/* Government/IDs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Civil Servant ID</label>
              <input className="border rounded w-full px-3 py-2" value={edit.civilServantId} onChange={(e)=>setEdit(f=>({...f,civilServantId:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Officer ID</label>
              <input className="border rounded w-full px-3 py-2" value={edit.officerId} onChange={(e)=>setEdit(f=>({...f,officerId:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Card Number</label>
              <input className="border rounded w-full px-3 py-2" value={edit.cardNumber} onChange={(e)=>setEdit(f=>({...f,cardNumber:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm mb-1">NID</label>
              <input className="border rounded w-full px-3 py-2" value={edit.nid} onChange={(e)=>setEdit(f=>({...f,nid:e.target.value}))} />
            </div>
          </div>
          {/* Org */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Officer Type</label>
              <input className="border rounded w-full px-3 py-2" value={edit.officerType} onChange={(e)=>setEdit(f=>({...f,officerType:e.target.value}))} />
            </div>
            <div>
              <label className="block text-sm mb-1">Department (Kh)</label>
              <input className="border rounded w-full px-3 py-2" value={edit.Department_Kh} onChange={(e)=>setEdit(f=>({...f,Department_Kh:e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Bank Account</label>
            <input className="border rounded w-full px-3 py-2" value={edit.bankAccount} onChange={(e)=>setEdit(f=>({...f,bankAccount:e.target.value}))} />
          </div>

          <button className="bg-blue-600 text-white rounded px-4 py-2">Submit for approval</button>
        </form>
      )}
    </div>
  );
}
