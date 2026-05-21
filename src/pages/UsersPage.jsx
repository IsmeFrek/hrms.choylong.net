import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { listUsers, listRoles, createUser, updateUser, deleteUser, sendTestNotification } from '../api/users';
import { departmentAPI } from '../services/departmentAPI';
import api from '../services/api';
import usePermission from '../hooks/usePermission';

export default function UsersPage() {
  const perms = usePermission();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Face Enrollment State
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState(null);
  const [capturedSnapshot, setCapturedSnapshot] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const MODELS_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

  // Change password modal
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState(null);
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const filtered = useMemo(() => users, [users]);

  const defaultForm = { fullName: '', email: '', phone: '', staffId: '', telegramId: '', password: '', roleIds: [], active: true, newPassword: '', department: '' };
  const [form, setForm] = useState(defaultForm);
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [u, r, d] = await Promise.all([
        listUsers(query), 
        listRoles(),
        departmentAPI.getDepartments()
      ]);
      setUsers(u || []); 
      setRoles(r || []);
      setDepartments(Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []));
    } catch (e) { setError(e.message || 'Load failed'); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { if (perms.canManageUsers) load(); }, [perms.canManageUsers, load]);

  const loadFaceModels = async () => {
    if (faceModelsLoaded) return;
    try {
      if (typeof window.faceapi === 'undefined') {
        setTimeout(loadFaceModels, 500);
        return;
      }
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
      await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      setFaceModelsLoaded(true);
    } catch (e) { console.error('Face models load failed', e); }
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) { console.error('Camera failed', e); alert('Cannot access camera'); }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (showFaceEnroll) {
      loadFaceModels();
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showFaceEnroll]);

  useEffect(() => {
    let interval;
    if (showFaceEnroll && faceModelsLoaded) {
      interval = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const detection = await window.faceapi.detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 160 }));
          setFaceDetected(!!detection);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showFaceEnroll, faceModelsLoaded]);

  const captureFace = async () => {
    if (!videoRef.current || !faceModelsLoaded) return;
    setEnrolling(true);
    try {
      const detection = await window.faceapi
        .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        alert('No face detected. Please face the camera clearly.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      
      setCapturedSnapshot(canvas.toDataURL('image/jpeg', 0.8));
      setCapturedDescriptor(Array.from(detection.descriptor, x => Number(x)));
      alert('Face captured successfully! ✅');
      setShowFaceEnroll(false);
    } catch (e) {
      console.error(e);
      alert('Face capture failed');
    } finally {
      setEnrolling(false);
    }
  };

  const search = async (e) => { e?.preventDefault(); await load(); };

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setCapturedDescriptor(null);
    setCapturedSnapshot(null);
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      fullName: u.fullName || '',
      email: u.email || '',
      phone: u.phone || '',
      staffId: u.staffId || '',
      telegramId: u.telegramId || '',
      password: '',
      newPassword: '',
      roleIds: (u.roles || []).map(r => r.id),
      active: !!u.active,
      department: u.department || '',
    });
    setCapturedDescriptor(null);
    setCapturedSnapshot(null);
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
        staffId: form.staffId ? form.staffId.trim() : undefined,
        telegramId: form.telegramId ? form.telegramId.trim() : undefined,
        ...(editing ? {} : { password: form.password }),
        roleIds: form.roleIds,
        active: form.active,
        department: form.department ? form.department.trim() : undefined,
      };
      if (editing && form.newPassword) payload.password = form.newPassword;
      
      if (!payload.fullName) throw new Error('Full name is required');
      if (!editing && !payload.password) throw new Error('Password is required');
      
      const userRes = editing ? await updateUser(editing.id, payload) : await createUser(payload);
      
      if (capturedDescriptor) {
        const sid = payload.staffId || (editing ? editing.staffId : userRes.staffId);
        if (sid) {
          await api.post('/face/enroll', {
            staffId: sid,
            fullName: payload.fullName,
            descriptor: capturedDescriptor,
            snapshot: capturedSnapshot,
            consent: true,
            replace: true
          });
        }
      }

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
    setPwd1(''); setPwd2(''); setShowPwd1(false); setShowPwd2(false);
    setPwdModalOpen(true);
  };

  const closePwdModal = () => { if (!saving) setPwdModalOpen(false); };

  const submitPwd = async (e) => {
    e.preventDefault();
    if (!pwdTarget) return;
    if (!pwd1 || pwd1.length < 4) { setError('Password too short'); return; }
    if (pwd1 !== pwd2) { setError('Passwords do not match'); return; }
    setSaving(true); setError('');
    try {
      await updateUser(pwdTarget.id, { password: pwd1 });
      setPwdModalOpen(false);
    } catch (e2) { setError(e2.message || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  if (!perms.canManageUsers) return <div className="p-6">Access Denied</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto font-hanuman">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">គ្រប់គ្រងអ្នកប្រើប្រាស់</h1>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
          <span>➕</span> បន្ថែមអ្នកប្រើប្រាស់
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <form onSubmit={search} className="relative max-w-md">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ស្វែងរកតាមឈ្មោះ, អ៊ីមែល ឬលេខទូរស័ព្ទ..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40">🔍</span>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-100">
                <th className="text-left p-4 font-semibold">ឈ្មោះពេញ</th>
                <th className="text-left p-4 font-semibold">Staff ID / ទូរស័ព្ទ</th>
                <th className="text-left p-4 font-semibold">Telegram</th>
                <th className="text-left p-4 font-semibold">តួនាទី</th>
                <th className="text-left p-4 font-semibold">ស្ថានភាព</th>
                <th className="text-right p-4 font-semibold">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td className="p-10 text-center text-slate-400" colSpan={6}>កំពុងទាញទិន្នន័យ...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="p-10 text-center text-slate-400" colSpan={6}>រកមិនឃើញទិន្នន័យ</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-700">{u.fullName}</td>
                  <td className="p-4 text-slate-600">
                    <div className="font-mono text-xs text-blue-600 mb-0.5">{u.staffId || 'NO ID'}</div>
                    {u.phone || u.email}
                  </td>
                  <td className="p-4 text-slate-500">{u.telegramId || '-'}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || []).map(r => <span key={r.id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold">{r.name}</span>)}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.active ? 'សកម្ម' : 'បិទ'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(u)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">✏️</button>
                      <button onClick={() => openChangePwd(u)} className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors">🔑</button>
                      <button onClick={() => remove(u)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Modal */}
      {!modalOpen ? null : (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">{editing ? 'កែប្រែព័ត៌មានអ្នកប្រើប្រាស់' : 'បង្កើតអ្នកប្រើប្រាស់ថ្មី'}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <form onSubmit={submit} id="userForm" className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">ព័ត៌មានទូទៅ</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Staff ID</label>
                      <input required className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={form.staffId} onChange={(e) => setForm(f => ({ ...f, staffId: e.target.value }))} placeholder="S0001" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">ឈ្មោះពេញ</label>
                      <input required className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="John Doe" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">លេខទូរស័ព្ទ</label>
                      <input className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="012 345 678" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">អ៊ីមែល</label>
                      <input type="email" className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@ksfh.com" />
                    </div>
                  </div>
                  {!editing && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">ពាក្យសម្ងាត់</label>
                      <input required type="password" className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">ផ្នែក (Department)</label>
                    <select 
                      className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      value={form.department} 
                      onChange={(e) => setForm(f => ({ ...f, department: e.target.value }))}
                    >
                      <option value="">-- ជ្រើសរើសផ្នែក --</option>
                      {departments.map((d, idx) => (
                        <option key={idx} value={d.Department_Kh || d.Department || d.name}>
                          {d.Department_Kh || d.Department || d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Telegram ID</label>
                    <input className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={form.telegramId} onChange={(e) => setForm(f => ({ ...f, telegramId: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2">តួនាទី (Roles)</label>
                    <div className="flex flex-wrap gap-2">
                      {roles.map(r => (
                        <button key={r.id} type="button" onClick={() => toggleRole(r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${form.roleIds.includes(r.id) ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          {r.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-2">ចុះឈ្មោះផ្ទៃមុខ (Face Enrollment)</h3>
                  <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-100 shadow-inner group">
                    {showFaceEnroll ? (
                      <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className={`w-40 h-52 rounded-[50%] border-2 ${faceDetected ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-white/30'} transition-all`} />
                        </div>
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                          <button type="button" onClick={captureFace} disabled={!faceDetected || enrolling} className="bg-white hover:bg-slate-100 text-slate-800 px-6 py-2 rounded-full font-bold shadow-xl transition-all disabled:opacity-50">
                            {enrolling ? '⌛ កំពុងស្កែន...' : '📸 ថតរូបមុខ'}
                          </button>
                          <button type="button" onClick={() => setShowFaceEnroll(false)} className="bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md">បោះបង់</button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-400">
                        {capturedSnapshot ? (
                          <img src={capturedSnapshot} className="w-full h-full object-cover" alt="Face" />
                        ) : (
                          <div className="text-4xl opacity-20">👤</div>
                        )}
                        <button type="button" onClick={() => setShowFaceEnroll(true)} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all">
                           <span className="bg-white text-slate-800 px-6 py-2 rounded-full font-bold shadow-xl opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                             {capturedSnapshot ? '🔄 ស្កេនម្ដងទៀត' : '📷 ចាប់ផ្ដើមស្កេនមុខ'}
                           </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-4">
              <button type="button" onClick={closeModal} className="flex-1 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all">បោះបង់</button>
              <button form="userForm" type="submit" disabled={saving} className="flex-2 bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-2xl font-bold shadow-xl shadow-blue-200 transition-all disabled:opacity-50">
                {saving ? '⌛ កំពុងរក្សាទុក...' : '💾 រក្សាទុកទិន្នន័យទាំងអស់'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {!pwdModalOpen ? null : (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">ប្តូរពាក្យសម្ងាត់</h2>
              <button onClick={closePwdModal} className="text-gray-500">✕</button>
            </div>
            <form onSubmit={submitPwd} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">អ្នកប្រើប្រាស់</label>
                <div className="font-bold text-slate-700">{pwdTarget?.fullName || pwdTarget?.email}</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ពាក្យសម្ងាត់ថ្មី</label>
                <input required type={showPwd1 ? 'text' : 'password'} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={pwd1} onChange={(e) => setPwd1(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">បញ្ជាក់ពាក្យសម្ងាត់ថ្មី</label>
                <input required type={showPwd2 ? 'text' : 'password'} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
              </div>
              {error && <div className="text-red-600 text-xs font-bold">{error}</div>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closePwdModal} className="flex-1 border border-slate-200 px-4 py-3 rounded-2xl font-bold">បោះបង់</button>
                <button disabled={saving} className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-2xl font-bold shadow-xl shadow-blue-200">
                  {saving ? '...' : 'រក្សាទុក'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
