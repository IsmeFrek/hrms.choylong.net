import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function TelegramMiniApp() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [team, setTeam] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [scans, setScans] = useState({ in1: false, out1: false, in2: false, out2: false });
  const [scanning, setScanning] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [time, setTime] = useState(new Date());
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);
  const [location, setLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Self-edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [editReason, setEditReason] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [calendarFilter, setCalendarFilter] = useState('all');
  const todayRef = useRef(null);

  // Leave Requests State
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: 'ច្បាប់ឈប់សម្រាកប្រចាំឆ្នាំ (AL)',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
    attachments: []
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Attendance History State
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const fieldLabels = {
    khmerName: 'ឈ្មោះខ្មែរ',
    position: 'តួនាទី',
    civilServantId: 'លេខមន្ត្រីរាជការ',
    salaryLevel: 'កាំប្រាក់',
    nid: 'លេខអត្តសញ្ញាណ',
    bankAccount: 'លេខគណនីធនាគារ',
    skill: 'ជំនាញ/ឯកទេស',
    birthPlace: 'ទីកន្លែងកំណើត',
    currentPlace: 'អាសយដ្ឋានបច្ចុប្បន្ន',
    dob: 'ថ្ងៃខែឆ្នាំកំណើត',
    joinDate: 'ថ្ងៃចូលបម្រើការងារ',
    bloodGroup: 'ក្រុមឈាម',
    phone: 'លេខទូរស័ព្ទ',
    email: 'អ៊ីមែល',
    gender: 'ភេទ',
    Department_Kh: 'អង្គភាព/ផ្នែក'
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const results = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        results.push({ url: res.data.url, name: file.name });
      }
      setAttachments(prev => [...prev, ...results]);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!editReason.trim()) return alert('សូមបញ្ចូលមូលហេតុនៃការកែប្រែ');
    setSubmittingEdit(true);
    try {
      await api.post(`/self/hr/${profile.id}/self-edit`, {
        fields: editFields,
        reason: editReason,
        attachments: attachments.map(a => a.url)
      });
      alert('សំណើរបស់លោកអ្នកត្រូវបានបញ្ជូនទៅកាន់ Admin រួចហើយ។ សូមរង់ចាំការពិនិត្យ!');
      setIsEditing(false);
      setEditFields({});
      setEditReason('');
      setAttachments([]);
      fetchPendingRequest();
    } catch (err) {
      alert('បរាជ័យក្នុងការបញ្ជូន៖ ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingEdit(false);
    }
  };

  const MODELS_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

  // Fetch data on mount
  useEffect(() => {
    fetchTodayStatus();
    fetchProfile();
    fetchPolicy();
    fetchPendingRequest();
    loadFaceModels();
  }, []);

  const loadFaceModels = async () => {
    try {
      if (typeof window.faceapi === 'undefined') {
        setTimeout(loadFaceModels, 500);
        return;
      }
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
      await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      setFaceModelsLoaded(true);
      console.log('Face models loaded ✅');
    } catch (e) {
      console.error('Failed to load face models', e);
    }
  };

  const fetchPolicy = async () => {
    try {
      const res = await api.get('/geo-fence/my');
      if (res.data?.policy) setPolicy(res.data.policy);
    } catch (e) {
      console.error('Failed to fetch policy', e);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setFaceDetected(f => !f), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeTab === 'home') {
      startCamera();
      refreshLocation();
    } else {
      stopCamera();
    }
    if (activeTab === 'calendar') {
      fetchSchedules();
    }
    if (activeTab === 'leave') {
      fetchLeaveRequests();
    }
    if (activeTab === 'hist') {
      fetchAttendanceHistory();
    }
    return () => stopCamera();
  }, [activeTab]);

  const fetchAttendanceHistory = async () => {
    setLoadingHist(true);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const res = await api.get('/attendance', { params: { staffId: user?.username, from: firstDay, to: lastDay } });
      setHistory(res.data || []);
    } catch (e) {
      console.error('Failed to fetch attendance history', e);
    } finally {
      setLoadingHist(false);
    }
  };

  const fetchLeaveRequests = async () => {
    setLoadingLeave(true);
    try {
      const res = await api.get('/self/leave-requests');
      setLeaveRequests(res.data || []);
    } catch (e) {
      console.error('Failed to fetch leave requests', e);
    } finally {
      setLoadingLeave(false);
    }
  };

  const submitLeaveRequest = async () => {
    if (!leaveForm.type || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      alert('សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់');
      return;
    }
    setSubmittingLeave(true);
    try {
      const res = await api.post('/self/leave-requests', leaveForm);
      if (res.data.success) {
        setShowLeaveForm(false);
        setLeaveForm({
          type: 'ច្បាប់ឈប់សម្រាកប្រចាំឆ្នាំ (AL)',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          reason: '',
          attachments: []
        });
        fetchLeaveRequests();
        alert('សំណើសុំច្បាប់ត្រូវបានផ្ញើរួចរាល់! សូមរង់ចាំ ADMIN ពិនិត្យ');
      }
    } catch (e) {
      alert('ការបញ្ជូនសំណើបានបរាជ័យ: ' + (e.response?.data?.message || e.message));
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleLeaveFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.url) {
        setLeaveForm(prev => ({
          ...prev,
          attachments: [...prev.attachments, res.data.url]
        }));
      }
    } catch (e) {
      alert('Upload បរាជ័យ: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploadingFile(false);
    }
  };

  const removeAttachment = (index) => {
    setLeaveForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  useEffect(() => {
    if (activeTab === 'calendar' && schedules.length > 0 && calendarFilter === 'all') {
      const timer = setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeTab, schedules, calendarFilter]);

  const refreshLocation = () => {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setLocLoading(false);
      },
      (err) => {
        console.error('Location error:', err);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      console.warn('Camera failed', e);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/self/hr/me');
      if (res.data) setProfile(res.data);
    } catch (e) {
      console.error('Failed to fetch profile', e);
    }
  };

  const fetchPendingRequest = async () => {
    try {
      const res = await api.get('/self/self-edit');
      if (res.data?.pendingRequest) setPendingRequest(res.data.pendingRequest);
      else setPendingRequest(null);
    } catch (e) {
      console.error('Failed to fetch pending request', e);
    }
  };

  const fetchSchedules = async () => {
    if (!profile?.id) return;
    setLoadingSchedules(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const res = await api.get('/work-schedules', {
        params: { employeeId: profile.id, month, year }
      });
      setSchedules(res.data || []);
    } catch (e) {
      console.error('Failed to fetch schedules', e);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await api.get('/attendance', { params: { staffId: user?.username, from: today, to: today } });
      if (res.data && res.data.length > 0) {
        const att = res.data[0];
        setScans({
          in1: att.checkIn ? { time: att.checkIn, late: att.lateMinutes > 0 } : null,
          out1: att.checkOut ? { time: att.checkOut, early: att.earlyLeaveMinutes > 0 } : null,
          in2: att.checkIn2 ? { time: att.checkIn2, late: att.late2Minutes > 0 } : null,
          out2: att.checkOut2 ? { time: att.checkOut2, early: att.earlyLeave2Minutes > 0 } : null,
        });
      }
    } catch (e) {
      console.error('Failed to fetch attendance status', e);
    }
  };

  // Telegram WebApp initialization
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      tg.ready();
      tg.setHeaderColor('#1565c0');

      // Handle BackButton
      const handleBack = () => {
        setActiveTab('home');
      };
      tg.BackButton.onClick(handleBack);

      return () => {
        tg.BackButton.offClick(handleBack);
      };
    }
  }, []);

  // Show/Hide BackButton based on activeTab
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      if (activeTab === 'home') {
        window.Telegram.WebApp.BackButton.hide();
      } else {
        window.Telegram.WebApp.BackButton.show();
      }
    }
  }, [activeTab]);

  const triggerHaptic = (type = 'light') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'success') window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      else if (type === 'error') window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      else window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  };

  const showToast = (msg, color = '#10b981') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const doScan = async (key, label) => {
    if (scans[key] || scanning) return;

    // Check connectivity
    if (!navigator.onLine) {
      triggerHaptic('error');
      showToast('❌ គ្មានអ៊ីនធឺណិត!', '#ef4444');
      return;
    }

    if (!faceModelsLoaded) {
      showToast('⏳ កំពុងទាញយក Face Models...', '#f59e0b');
      return;
    }

    setScanning(key);
    triggerHaptic(); // Vibrate on press

    // 1. Face Match
    try {
      if (!videoRef.current) throw new Error('Camera not ready');

      const detection = await window.faceapi
        .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        throw new Error('រកមិនឃើញផ្ទៃមុខ! សូមដាក់មុខឲ្យត្រង់ និងមានពន្លឺគ្រប់គ្រាន់។');
      }

      const descriptor = Array.from(detection.descriptor, x => Number(x));
      const matchRes = await api.post('/face/match', { descriptor, threshold: 0.55 });

      if (!matchRes.data.matched) {
        throw new Error('ផ្ទៃមុខមិនត្រឹមត្រូវ! (Face not matched)');
      }

      // Check if matched face belongs to the current user
      const matchedStaffId = String(matchRes.data.staffId || '').toLowerCase();
      const currentStaffId = String(user?.username || '').toLowerCase();

      if (matchedStaffId !== currentStaffId && currentStaffId !== '') {
        throw new Error(`ផ្ទៃមុខនេះជារបស់ Staff ID ${matchedStaffId} មិនមែនរបស់លោកអ្នកទេ!`);
      }

    } catch (err) {
      setScanning(null);
      triggerHaptic('error');
      showToast('❌ ' + (err.message || 'Face Verification Failed'), '#ef4444');
      return;
    }

    // 2. Ensure we have location
    let currentLoc = location;
    if (!currentLoc) {
      try {
        currentLoc = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            }),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
        setLocation(currentLoc);
      } catch (err) {
        setScanning(null);
        triggerHaptic('error');
        showToast('❌ សូម Allow Location (GPS)!', '#ef4444');
        return;
      }
    }

    try {
      const res = await api.post('/attendance/scan-mini-app', {
        type: key,
        lat: currentLoc.lat,
        lng: currentLoc.lng,
        accuracy: currentLoc.accuracy
      });
      if (res.data.ok) {
        triggerHaptic('success');
        showToast(`✅ ${label} — ជោគជ័យ`, '#10b981');
        // Refresh status to get the calculated late/early info
        await fetchTodayStatus();
      }
    } catch (e) {
      triggerHaptic('error');
      const msg = e.response?.data?.message || '❌ បរាជ័យក្នុងការកត់ត្រា';
      showToast(msg, '#ef4444');
    } finally {
      setScanning(null);
    }
  };

  const gc = '#4ade80'; // green color for face detection

  // Display labels
  const displayName = profile?.khmerName || profile?.name || user?.fullName || 'User';
  const displayRole = profile?.position || profile?.officerType || 'Employee';
  const displayAvatar = profile?.image ? (profile.image.startsWith('http') ? profile.image : `/Uploads/${profile.image}`) : null;

  return (
    <div style={{ minHeight: '100%', background: '#eef2f3', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', fontFamily: "'Hanuman','Khmer OS Siemreap','Inter',sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: toast.color, color: '#fff', padding: '10px 24px', borderRadius: 24, fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* Phone Card */}
      <div style={{ width: '100%', maxWidth: 430, background: '#fff', borderRadius: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#2196f3,#1565c0)', padding: '14px 16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left: Tree + ABC CORP */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>🌿</div>
            <div style={{ color: '#fff', lineHeight: 1.2 }}>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.5 }}>Y&J</div>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.9 }}>PORTAL</div>
            </div>
          </div>
          {/* Right: Name + Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right', color: '#fff' }}>
              <div style={{ fontSize: 11, opacity: 0.85 }}>សូស្ដី, {displayName.split(' ').pop()}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{displayName}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '2.5px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {displayAvatar ? <img src={displayAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="P" /> : <span style={{ fontSize: 20 }}>👤</span>}
            </div>
          </div>
        </div>

        {/* ── HOME ── */}
        {activeTab === 'home' && (
          <>
            <div style={{ background: '#f0f7ff', padding: '0 14px 14px' }}>
              <div style={{ background: '#fff', borderRadius: 20, padding: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.07)', marginTop: 0 }}>
                <h2 style={{ textAlign: 'center', margin: '0 0 14px', fontSize: 17, fontWeight: 800, color: '#1e293b' }}>ចុះវត្តមានថ្ងៃនេះ</h2>

                {/* Camera 4:3 */}
                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#0f172a', aspectRatio: '4/3', marginBottom: 16 }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />

                  {/* Scanning Animation Overlay */}
                  {!!scanning && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '2px',
                      background: 'rgba(34, 197, 94, 0.8)',
                      boxShadow: '0 0 15px #22c55e, 0 0 30px #22c55e',
                      zIndex: 10,
                      animation: 'scan-move 2s linear infinite'
                    }} />
                  )}

                  <style>{`
                    @keyframes scan-move {
                      0% { top: 0; }
                      50% { top: 100%; }
                      100% { top: 0; }
                    }
                  `}</style>

                  {/* Face Oval Overlay */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ position: 'relative', width: '52%', height: '80%' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: `2.5px solid ${faceDetected ? gc : '#475569'}`, boxShadow: faceDetected ? `0 0 20px rgba(74,222,128,0.5), inset 0 0 20px rgba(74,222,128,0.05)` : 'none', transition: 'all 0.3s' }} />
                      {[
                        { top: '-4px', left: '50%', transform: 'translateX(-50%)' },
                        { bottom: '-4px', left: '50%', transform: 'translateX(-50%)' },
                        { left: '-4px', top: '50%', transform: 'translateY(-50%)' },
                        { right: '-4px', top: '50%', transform: 'translateY(-50%)' },
                      ].map((s, i) => (
                        <div key={i} style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: faceDetected ? gc : '#475569', boxShadow: faceDetected ? `0 0 6px ${gc}` : 'none', ...s }} />
                      ))}
                    </div>
                  </div>

                  {/* Corners Brackets */}
                  {[
                    { top: 10, left: 10, borderTop: `3px solid ${faceDetected ? gc : '#475569'}`, borderLeft: `3px solid ${faceDetected ? gc : '#475569'}`, borderRadius: '4px 0 0 0' },
                    { top: 10, right: 10, borderTop: `3px solid ${faceDetected ? gc : '#475569'}`, borderRight: `3px solid ${faceDetected ? gc : '#475569'}`, borderRadius: '0 4px 0 0' },
                    { bottom: 10, left: 10, borderBottom: `3px solid ${faceDetected ? gc : '#475569'}`, borderLeft: `3px solid ${faceDetected ? gc : '#475569'}`, borderRadius: '0 0 0 4px' },
                    { bottom: 10, right: 10, borderBottom: `3px solid ${faceDetected ? gc : '#475569'}`, borderRight: `3px solid ${faceDetected ? gc : '#475569'}`, borderRadius: '0 0 4px 0' },
                  ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s, transition: 'all 0.3s' }} />)}

                  {/* Status Label */}
                  <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: scanning ? 'rgba(34, 197, 94, 0.9)' : faceDetected ? 'rgba(16,185,129,0.85)' : 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', backdropFilter: 'blur(6px)', transition: 'all 0.3s', zIndex: 11 }}>
                    {!faceModelsLoaded ? '⏳ កំពុងដំឡើងប្រព័ន្ធ...' : scanning ? '🔍 កំពុងផ្ទៀងផ្ទាត់មុខ...' : faceDetected ? '✅ ស្គាល់ផ្ទៃមុខ' : '👤 សូមបង្ហាញមុខ'}
                  </div>
                </div>

                {/* Location Status Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>📍</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: location ? '#10b981' : '#f59e0b' }}>
                        {locLoading ? 'កំពុងទាញទីតាំង...' : location ? 'ទីតាំងរួចរាល់ ✅' : 'មិនទាន់មានទីតាំង'}
                      </span>
                      {location && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b' }}>
                          ចម្ងាយ៖ {(() => {
                            const lat1 = location.lat;
                            const lon1 = location.lng;
                            const lat2 = policy?.fence?.centerLat || 11.5369;
                            const lon2 = policy?.fence?.centerLng || 104.9126;
                            const R = 6371e3;
                            const p1 = lat1 * Math.PI / 180;
                            const p2 = lat2 * Math.PI / 180;
                            const dp = (lat2 - lat1) * Math.PI / 180;
                            const dl = (lon2 - lon1) * Math.PI / 180;
                            const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
                              Math.cos(p1) * Math.cos(p2) *
                              Math.sin(dl / 2) * Math.sin(dl / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            const d = R * c;
                            return d.toFixed(0) + ' ម៉ែត្រ';
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={refreshLocation} disabled={locLoading} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {locLoading ? '⏳' : '🔄 ឆែកឡើងវិញ'}
                  </button>
                </div>

                {/* Scan Buttons with Sequence & Logic */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  opacity: location ? 1 : 0.5,
                  pointerEvents: location ? 'auto' : 'none'
                }}>
                  {[
                    { key: 'in1', label: 'ស្វែរចូល 1', bg: scans?.in1 ? '#f1f5f9' : 'linear-gradient(135deg,#16a34a,#15803d)', shadow: '#16a34a44', icon: '⏱️', data: scans?.in1, show: true },
                    { key: 'out1', label: 'ស្វែរចេញ 1', bg: scans?.out1 ? '#f1f5f9' : 'linear-gradient(135deg,#dc2626,#b91c1c)', shadow: '#dc262644', icon: '↩️', data: scans?.out1, show: !!scans?.in1 },
                    { key: 'in2', label: 'ស្វែរចូល 2', bg: scans?.in2 ? '#f1f5f9' : 'linear-gradient(135deg,#16a34a,#15803d)', shadow: '#16a34a44', icon: '⏱️', data: scans?.in2, show: !!scans?.out1 && !policy?.note?.includes('2-scans') },
                    { key: 'out2', label: 'ស្វែរចេញ 2', bg: scans?.out2 ? '#f1f5f9' : '#linear-gradient(135deg,#dc2626,#b91c1c)', shadow: '#dc262644', icon: '↩️', data: scans?.out2, show: !!scans?.in2 && !policy?.note?.includes('2-scans') },
                  ].map(b => {
                    const done = !!b.data;
                    const timeStr = done ? new Date(b.data.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                    let statusLabel = '';
                    let statusColor = '#94a3b8';

                    if (done) {
                      if (b.key.startsWith('in')) {
                        statusLabel = b.data.late ? ' (យឺត)' : ' (ទាន់ពេល)';
                        statusColor = b.data.late ? '#ef4444' : '#10b981';
                      } else {
                        statusLabel = b.data.early ? ' (ចេញមុន)' : ' (ទាន់ពេល)';
                        statusColor = b.data.early ? '#f59e0b' : '#10b981';
                      }
                    }

                    return b.show ? (
                      <button key={b.key} onClick={() => doScan(b.key, b.label)} disabled={done || (!!scanning && scanning !== b.key)}
                        style={{
                          padding: '12px 8px',
                          borderRadius: 16,
                          background: b.bg,
                          border: done ? '1px solid #e2e8f0' : 'none',
                          color: done ? '#1e293b' : '#fff',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: done ? 'default' : 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          boxShadow: done ? 'none' : `0 4px 14px ${b.shadow}`,
                          transform: scanning === b.key ? 'scale(0.95)' : 'scale(1)',
                          transition: 'all 0.2s',
                          opacity: (!!scanning && scanning !== b.key && !done) ? 0.55 : 1
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>{done ? '✅' : b.icon}</span>
                          <span>{done ? timeStr : b.label}</span>
                        </div>
                        {done && (
                          <span style={{ fontSize: 10, color: statusColor }}>{statusLabel}</span>
                        )}
                      </button>
                    ) : <div key={b.key} />;
                  })}
                </div>
              </div>
            </div>

            {/* Shortcut Cards */}
            <div style={{ background: '#f0f7ff', padding: '4px 14px 14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                {[
                  { icon: '📅', label: 'ប្រតិទិន', sub: 'Calendar', tab: 'calendar' },
                  { icon: '📋', label: 'ស្នើសុំច្បាប់', sub: 'Leave Request', tab: 'leave' },
                ].map(s => (
                  <button key={s.tab} onClick={() => setActiveTab(s.tab)} style={{ background: '#fff', borderRadius: 16, padding: '14px 12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative', textAlign: 'left' }}>
                    <span style={{ fontSize: 26 }}>{s.icon}</span>
                    <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{s.label}</p><p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>{s.sub}</p></div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { icon: '📍', label: 'ចុះយកវត្តមាន', sub: 'Add Field Att...', tab: 'field' },
                  { icon: '🤝', label: 'វត្តមានប្រជុំ', sub: 'Meeting', tab: 'meeting' },
                  { icon: '👥', label: 'កូនក្រុម\n(មេផ្នែក)', sub: 'Team Head View', tab: 'team', arrow: true },
                ].map(s => (
                  <button key={s.tab} onClick={() => setActiveTab(s.tab)} style={{ background: '#fff', borderRadius: 16, padding: '12px 6px', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative', textAlign: 'center' }}>
                    <span style={{ fontSize: 24 }}>{s.icon}</span>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#1e293b', whiteSpace: 'pre-line', lineHeight: 1.3 }}>{s.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Team ── */}
        {activeTab === 'team' && (
          <div style={{ padding: '16px', minHeight: 400, background: '#f8fafc' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1e293b' }}>កូនក្រុម ({team.length})</h3>
              </div>
              <button onClick={fetchTeam} disabled={loadingTeam} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 12, cursor: 'pointer' }}>
                {loadingTeam ? '🔄...' : '🔄 ធ្វើបច្ចុប្បន្នភាព'}
              </button>
            </div>

            {team.length === 0 && !loadingTeam && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
                <p>មិនទាន់មានទិន្នន័យកូនក្រុមក្នុងផ្នែកនេះទេ</p>
              </div>
            )}

            {team.map((t) => {
              const s = t.status;
              const isOut = s.includes('out');
              const isIn = s.includes('in');
              const color = isIn ? '#10b981' : isOut ? '#f59e0b' : '#ef4444';
              const label = s === 'in1' ? '✅ ចូល ១' : s === 'out1' ? '↩️ ចេញ ១' : s === 'in2' ? '✅ ចូល ២' : s === 'out2' ? '↩️ ចេញ ២' : '❌ អវត្តមាន';
              const img = t.image ? (t.image.startsWith('http') ? t.image : `/Uploads/${t.image}`) : null;

              return (
                <div key={t.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${color}15`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {img ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="T" /> : <span style={{ fontSize: 18 }}>👤</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{t.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{t.position || 'Employee'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, color: color, fontWeight: 700, background: `${color}12`, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Profile (Personal Info) ── */}
        {activeTab === 'profile' && (
          <div style={{ padding: '16px', minHeight: 450, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>ព័ត៌មានផ្ទាល់ខ្លួន</h3>
            </div>

            {/* Profile Header Card */}
            <div style={{ background: 'linear-gradient(135deg, #1565c0, #1e88e5)', borderRadius: 20, padding: '24px 16px', color: '#fff', textAlign: 'center', marginBottom: 20, boxShadow: '0 10px 25px rgba(21, 101, 192, 0.2)' }}>
              <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '4px solid rgba(255,255,255,0.4)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {displayAvatar ? <img src={displayAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" /> : <span style={{ fontSize: 40 }}>👤</span>}
              </div>
              <h2
                onClick={() => setEditingKey('khmerName')}
                style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, cursor: 'pointer' }}
              >
                {editFields.khmerName ? <span style={{ color: '#ffd54f' }}>{editFields.khmerName} (ថ្មី)</span> : (profile?.khmerName || profile?.name || '—')}
              </h2>
              <p
                onClick={() => setEditingKey('position')}
                style={{ margin: 0, opacity: 0.9, fontSize: 14, cursor: 'pointer' }}
              >
                {editFields.position ? <span style={{ color: '#ffd54f' }}>{editFields.position} (ថ្មី)</span> : (profile?.position || 'Employee')}
              </p>
              <div style={{ display: 'inline-block', marginTop: 12, padding: '4px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                ID: {profile?.staffId || '—'}
              </div>
            </div>

            {/* Request Status Banner */}
            {pendingRequest && (
              <div style={{
                background: pendingRequest.status === 'pending' ? '#fff9c4' : pendingRequest.status === 'approved' ? '#e8f5e9' : '#ffebee',
                borderRadius: 20, padding: '16px', marginBottom: 20,
                border: `1px solid ${pendingRequest.status === 'pending' ? '#fbc02d' : pendingRequest.status === 'approved' ? '#81c784' : '#ef9a9a'}`,
                display: 'flex', alignItems: 'center', gap: 12
              }}>
                <div style={{ fontSize: 24 }}>
                  {pendingRequest.status === 'pending' ? '⏳' : pendingRequest.status === 'approved' ? '✅' : '❌'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: pendingRequest.status === 'pending' ? '#f57f17' : pendingRequest.status === 'approved' ? '#2e7d32' : '#c62828' }}>
                    {pendingRequest.status === 'pending' ? 'រង់ចាំការឯកភាពពី ADMIN' : pendingRequest.status === 'approved' ? 'សំណើត្រូវបានអនុម័ត' : 'សំណើត្រូវបានបដិសេធ'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: pendingRequest.status === 'pending' ? '#fbc02d' : pendingRequest.status === 'approved' ? '#4caf50' : '#ef5350', fontWeight: 600 }}>
                    {pendingRequest.status === 'rejected' && pendingRequest.reviewerNote ? `មូលហេតុ៖ ${pendingRequest.reviewerNote}` : 'ពិនិត្យចុងក្រោយ៖ ' + new Date(pendingRequest.reviewedAt || pendingRequest.createdAt).toLocaleDateString('km-KH')}
                  </p>
                </div>
                {pendingRequest.status === 'pending' && (
                  <button
                    onClick={() => alert(`សំណើកាលពី៖ ${new Date(pendingRequest.createdAt).toLocaleString()}\nមូលហេតុ៖ ${pendingRequest.reason}`)}
                    style={{ background: 'none', border: '1px solid #fbc02d', borderRadius: 10, color: '#f57f17', fontSize: 11, padding: '4px 8px', fontWeight: 700 }}
                  >មើល</button>
                )}
              </div>
            )}

            {/* Info Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {[
                { icon: '🏛️', label: 'អង្គភាព/ផ្នែក', value: profile?.Department_Kh || '—', key: 'Department_Kh', readonly: true },
                { icon: '🏷️', label: 'លេខមន្ត្រីរាជការ', value: profile?.civilServantId || '—', key: 'civilServantId' },
                { icon: '📈', label: 'កាំប្រាក់', value: profile?.salaryLevel || '—', key: 'salaryLevel' },
                { icon: '🆔', label: 'លេខអត្តសញ្ញាណ', value: profile?.nid || '—', key: 'nid' },
                { icon: '💳', label: 'លេខគណនីធនាគារ', value: profile?.bankAccount || '—', key: 'bankAccount' },
                { icon: '🎓', label: 'ជំនាញ/ឯកទេស', value: profile?.skill || '—', key: 'skill' },
                { icon: '🏠', label: 'ទីកន្លែងកំណើត', value: profile?.birthPlace || '—', key: 'birthPlace' },
                { icon: '📍', label: 'ទីកន្លែងបច្ចុប្បន្ន', value: profile?.currentPlace || '—', key: 'currentPlace' },
                { icon: '📅', label: 'ថ្ងៃខែឆ្នាំកំណើត', value: profile?.dob ? new Date(profile.dob).toLocaleDateString('km-KH') : '—', key: 'dob' },
                { icon: '💼', label: 'កាលបរិច្ឆេទចូលបម្រើការងារ', value: profile?.joinDate ? new Date(profile.joinDate).toLocaleDateString('km-KH') : '—', key: 'joinDate' },
                { icon: '🩸', label: 'ក្រុមឈាម', value: profile?.bloodGroup || '—', key: 'bloodGroup' },
                { icon: '📞', label: 'លេខទូរស័ព្ទ', value: profile?.phone || '—', key: 'phone' },
                { icon: '📧', label: 'អ៊ីមែល', value: profile?.email || '—', key: 'email' },
                { icon: '🚻', label: 'ភេទ', value: profile?.gender || '—', key: 'gender' },
              ].map((item, idx) => {
                const hasChange = editFields[item.key];
                return (
                  <div
                    key={idx}
                    onClick={() => !item.readonly && setEditingKey(item.key)}
                    style={{
                      background: '#fff', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: hasChange ? '2px solid #2196f3' : '1px solid #f1f5f9',
                      cursor: item.readonly ? 'default' : 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: hasChange ? '#e3f2fd' : '#f0f7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</p>
                      <p style={{ margin: 0, fontSize: 14, color: '#1e293b', fontWeight: 700 }}>
                        {hasChange ? <span style={{ color: '#2196f3' }}>{editFields[item.key]} (ថ្មី)</span> : item.value}
                      </p>
                    </div>
                    {!item.readonly && <div style={{ fontSize: 12, color: '#cbd5e1' }}>✎</div>}
                  </div>
                );
              })}
            </div>

            {/* Editing Overlay/Modal */}
            {editingKey && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                <div style={{ background: '#fff', borderRadius: 24, padding: '24px', width: '100%', maxWidth: 400, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>កែប្រែ {fieldLabels[editingKey] || editingKey}</h4>
                  <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>សូមបញ្ចូលព័ត៌មានថ្មីដែលលោកអ្នកចង់ផ្លាស់ប្តូរ</p>

                  <input
                    autoFocus
                    type="text"
                    defaultValue={editFields[editingKey] || profile?.[editingKey] || ''}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val !== profile?.[editingKey]) {
                        setEditFields(prev => ({ ...prev, [editingKey]: val }));
                      }
                      setEditingKey(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.target.value;
                        if (val !== profile?.[editingKey]) {
                          setEditFields(prev => ({ ...prev, [editingKey]: val }));
                        }
                        setEditingKey(null);
                      }
                      if (e.key === 'Escape') setEditingKey(null);
                    }}
                    style={{ width: '100%', padding: '14px', borderRadius: 14, border: '2px solid #2196f3', fontSize: 16, marginBottom: 20, outline: 'none' }}
                  />

                  <button
                    onClick={() => setEditingKey(null)}
                    style={{ width: '100%', padding: '12px', borderRadius: 14, background: '#2196f3', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                  >យល់ព្រម</button>
                </div>
              </div>
            )}

            {/* Action Area (Submit) */}
            {(Object.keys(editFields).length > 0 || attachments.length > 0) && (
              <div style={{ background: '#fff', borderRadius: 24, padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 -10px 25px rgba(0,0,0,0.05)', marginTop: 20 }}>
                <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>បញ្ជូនសំណើកែប្រែ</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>មូលហេតុនៃការកែប្រែ</label>
                    <input
                      type="text"
                      placeholder="ឧទាហរណ៍៖ ប្តូរអាសយដ្ឋានថ្មី"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>ឯកសារយោង (រូបថត ឬ PDF)</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {attachments.map((a, i) => (
                        <div key={i} style={{ fontSize: 10, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          📄 {a.name} <span onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ cursor: 'pointer', color: '#ef4444' }}>✕</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { setEditFields({}); setEditReason(''); setAttachments([]); }}
                      style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                    >សម្អាត</button>
                    <button
                      onClick={handleSubmitEdit}
                      disabled={submittingEdit || uploading}
                      style={{ flex: 2, padding: '12px', borderRadius: 12, background: '#2196f3', color: '#fff', border: 'none', fontWeight: 700, cursor: (submittingEdit || uploading) ? 'not-allowed' : 'pointer', opacity: (submittingEdit || uploading) ? 0.7 : 1 }}
                    >{submittingEdit ? 'កំពុងបញ្ជូន...' : 'បញ្ជូនសំណើ'}</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', padding: '20px 20px 20px' }}>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>* ប្រសិនបើព័ត៌មានមិនត្រឹមត្រូវ សូមទាក់ទងមកផ្នែករដ្ឋបាល</p>
            </div>
          </div>
        )}

        {/* ── Calendar Tab ── */}
        {activeTab === 'calendar' && (
          <div style={{ padding: '16px', minHeight: 450, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>កាលវិភាគការងារ</h3>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #2196f3, #1565c0)', borderRadius: 20, padding: '20px 16px', marginBottom: 16, boxShadow: '0 10px 25px rgba(33, 150, 243, 0.2)', textAlign: 'center', color: '#fff' }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8, fontWeight: 600 }}>កាលវិភាគប្រចាំខែ</p>
              <h4 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>
                {new Date().toLocaleDateString('km-KH', { month: 'long', year: 'numeric' })}
              </h4>
            </div>

            {/* Summary Cards */}
            {!loadingSchedules && schedules.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                {[
                  { id: 'all', label: 'ទាំងអស់', icon: '📅', color: '#64748b', count: schedules.length },
                  {
                    id: 'work', label: 'ធ្វើការ', icon: '🏢', color: '#3b82f6', count: schedules.filter(s => {
                      const isOff = s.shiftTitle === 'Day Off' || s.shiftTitle.includes('សម្រាក') || s.shiftTitle.includes('ឈប់');
                      const startH = parseInt((s.shiftStart || '0').split(':')[0]);
                      const endH = parseInt((s.shiftEnd || '0').split(':')[0]);
                      const isOvernight = !isOff && s.shiftStart && s.shiftEnd && (startH > endH || (startH === endH && parseInt(s.shiftStart.split(':')[1]) > parseInt(s.shiftEnd.split(':')[1])));
                      return !isOff && !isOvernight;
                    }).length
                  },
                  {
                    id: 'overnight', label: 'យាម', icon: '🌙', color: '#6366f1', count: schedules.filter(s => {
                      const isOff = s.shiftTitle === 'Day Off' || s.shiftTitle.includes('សម្រាក') || s.shiftTitle.includes('ឈប់');
                      if (isOff) return false;
                      const startH = parseInt((s.shiftStart || '0').split(':')[0]);
                      const endH = parseInt((s.shiftEnd || '0').split(':')[0]);
                      return s.shiftStart && s.shiftEnd && (startH > endH || (startH === endH && parseInt(s.shiftStart.split(':')[1]) > parseInt(s.shiftEnd.split(':')[1])));
                    }).length
                  },
                  { id: 'off', label: 'សម្រាក', icon: '😴', color: '#ef4444', count: schedules.filter(s => s.shiftTitle === 'Day Off' || s.shiftTitle.includes('សម្រាក') || s.shiftTitle.includes('ឈប់')).length }
                ].map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setCalendarFilter(c.id)}
                    style={{
                      background: calendarFilter === c.id ? `${c.color}15` : '#fff',
                      borderRadius: 14, padding: '10px 4px', textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: calendarFilter === c.id ? `2px solid ${c.color}` : '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{c.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: c.color }}>{c.count}</div>
                    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            )}

            {loadingSchedules ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTop: '4px solid #2196f3', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ color: '#64748b', fontWeight: 600 }}>កំពុងទាញយកទិន្នន័យ...</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            ) : schedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 24, border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: 54, marginBottom: 16 }}>📅</div>
                <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: 18, fontWeight: 800 }}>មិនទាន់មានកាលវិភាគ</h4>
                <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>មិនទាន់មានទិន្នន័យកាលវិភាគការងារសម្រាប់ខែនេះត្រូវបានរៀបចំនៅឡើយទេ</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
                {schedules.filter(s => {
                  if (calendarFilter === 'all') return true;
                  const isOff = s.shiftTitle === 'Day Off' || s.shiftTitle.includes('សម្រាក') || s.shiftTitle.includes('ឈប់');
                  const startH = parseInt((s.shiftStart || '0').split(':')[0]);
                  const endH = parseInt((s.shiftEnd || '0').split(':')[0]);
                  const isOvernight = !isOff && s.shiftStart && s.shiftEnd && (startH > endH || (startH === endH && parseInt(s.shiftStart.split(':')[1]) > parseInt(s.shiftEnd.split(':')[1])));

                  if (calendarFilter === 'off') return isOff;
                  if (calendarFilter === 'overnight') return isOvernight;
                  if (calendarFilter === 'work') return !isOff && !isOvernight;
                  return true;
                }).map((s, idx) => {
                  const d = new Date(s.date);
                  const isToday = d.toDateString() === new Date().toDateString();

                  // Shift Category Logic
                  const isOff = s.shiftTitle === 'Day Off' || s.shiftTitle.includes('សម្រាក') || s.shiftTitle.includes('ឈប់');
                  const startH = parseInt((s.shiftStart || '0').split(':')[0]);
                  const endH = parseInt((s.shiftEnd || '0').split(':')[0]);
                  const isOvernight = !isOff && s.shiftStart && s.shiftEnd && (startH > endH || (startH === endH && parseInt(s.shiftStart.split(':')[1]) > parseInt(s.shiftEnd.split(':')[1])));

                  let catLabel = 'ថ្ងៃធ្វើការ';
                  let catColor = '#3b82f6';
                  let catIcon = '🏢';

                  if (isOff) {
                    catLabel = 'សម្រាក';
                    catColor = '#ef4444';
                    catIcon = '😴';
                  } else if (isOvernight) {
                    catLabel = 'យាម (ឆ្លងម៉ោង)';
                    catColor = '#6366f1';
                    catIcon = '🌙';
                  }

                  return (
                    <div
                      key={idx}
                      ref={isToday ? todayRef : null}
                      style={{
                        background: isToday ? '#fff' : '#fff',
                        borderRadius: 20,
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        border: isToday ? '2px solid #2196f3' : '1px solid #f1f5f9',
                        boxShadow: isToday ? '0 10px 20px rgba(33, 150, 243, 0.12)' : '0 2px 10px rgba(0,0,0,0.03)',
                        transition: 'all 0.2s ease',
                        scrollMargin: '100px'
                      }}
                    >
                      <div style={{
                        textAlign: 'center',
                        minWidth: 50,
                        padding: '6px',
                        borderRadius: 14,
                        background: isToday ? '#e3f2fd' : '#f8fafc',
                        border: isToday ? 'none' : '1px solid #f1f5f9'
                      }}>
                        <div style={{ fontSize: 11, color: isToday ? '#2196f3' : '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>
                          {d.toLocaleDateString('km-KH', { weekday: 'short' })}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: isToday ? '#1565c0' : '#1e293b' }}>{d.getDate()}</div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 16 }}>{catIcon}</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: catColor }}>{catLabel}</span>
                          {s.shiftTitle && s.shiftTitle !== 'Work' && s.shiftTitle !== 'Day Off' && (
                            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>({s.shiftTitle})</span>
                          )}
                        </div>

                        {!isOff && s.shiftStart && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 13, fontWeight: 600 }}>
                            <span>⌚ {s.shiftStart} - {s.shiftEnd}</span>
                            {isOvernight && <span style={{ fontSize: 10, background: '#6366f115', color: '#6366f1', padding: '2px 6px', borderRadius: 6 }}>+1 ថ្ងៃ</span>}
                          </div>
                        )}

                        {s.notes && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, padding: '4px 8px', background: '#f8fafc', borderRadius: 8, display: 'inline-block' }}>
                            📝 {s.notes}
                          </div>
                        )}
                      </div>

                      {isToday && (
                        <div style={{ background: '#2196f3', color: '#fff', fontSize: 9, fontWeight: 900, padding: '4px 8px', borderRadius: 10, letterSpacing: 0.5 }}>
                          ថ្ងៃនេះ
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Leave Tab ── */}
        {activeTab === 'leave' && (
          <div style={{ padding: '16px', minHeight: 450, background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>ស្នើសុំច្បាប់</h3>
              </div>
              <button
                onClick={() => setShowLeaveForm(true)}
                style={{
                  background: '#2196f3', color: '#fff', border: 'none',
                  borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                }}
              >
                + ស្នើថ្មី
              </button>
            </div>

            {loadingLeave ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTop: '4px solid #2196f3', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : leaveRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 24, border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: 54, marginBottom: 16 }}>📝</div>
                <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: 18, fontWeight: 800 }}>មិនទាន់មានប្រវត្តិ</h4>
                <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>លោកអ្នកមិនទាន់មានប្រវត្តិស្នើសុំច្បាប់នៅឡើយទេ</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
                {leaveRequests.map((req, idx) => {
                  const statusColors = {
                    pending: { bg: '#fff7ed', text: '#ea580c', label: 'រង់ចាំពិនិត្យ', icon: '⏳' },
                    approved: { bg: '#f0fdf4', text: '#16a34a', label: 'បានឯកភាព', icon: '✅' },
                    rejected: { bg: '#fef2f2', text: '#dc2626', label: 'បដិសេធ', icon: '❌' }
                  };
                  const st = statusColors[(req.status || 'pending').toLowerCase()] || statusColors.pending;

                  return (
                    <div key={idx} style={{
                      background: '#fff', borderRadius: 20, padding: '16px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: st.bg, padding: '4px 12px', borderRadius: 100 }}>
                            <span style={{ fontSize: 12 }}>{st.icon}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: st.text }}>{st.label}</span>
                          </div>
                          <a
                            href={`${api.defaults.baseURL}/self/leave-requests/${req._id}/pdf?token=${(() => {
                              try {
                                const a = JSON.parse(localStorage.getItem('auth') || 'null');
                                return a?.token || '';
                              } catch { return ''; }
                            })()}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                              padding: '4px 8px', fontSize: 10, fontWeight: 800, color: '#64748b',
                              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4
                            }}
                          >
                            PDF 📥
                          </a>
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                          {new Date(req.requestedAt || req.createdAt).toLocaleDateString('km-KH')}
                        </div>
                      </div>
                      <h4 style={{ margin: '0 0 4px', color: '#1e293b', fontSize: 15, fontWeight: 800 }}>{req.type}</h4>
                      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        📅 {new Date(req.startDate).toLocaleDateString('km-KH')} - {new Date(req.endDate).toLocaleDateString('km-KH')}
                        <span style={{ color: '#2196f3', fontWeight: 700 }}>({req.amount} ថ្ងៃ)</span>
                      </p>
                      {req.reason && (
                        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 12, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                          <strong>មូលហេតុ:</strong> {req.reason}
                        </div>
                      )}
                      {req.attachments && req.attachments.length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {req.attachments.map((url, i) => (
                            <a
                              key={i}
                              href={url.startsWith('http') ? url : `/api${url}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'block', width: 60, height: 60, borderRadius: 10,
                                overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc'
                              }}
                            >
                              {url.toLowerCase().endsWith('.pdf') ? (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📄</div>
                              ) : (
                                <img src={url.startsWith('http') ? url : `/api${url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="att" />
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                      {req.note && (
                        <div style={{ marginTop: 8, borderTop: '1px dashed #e2e8f0', paddingTop: 8, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                          ⚠️ Admin: {req.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leave Request Form Modal */}
            {showLeaveForm && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 3000, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  background: '#fff', width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32,
                  padding: '24px 20px 40px', maxHeight: '90%', overflowY: 'auto',
                  animation: 'slideUp 0.3s ease-out'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>បំពេញពាក្យសុំច្បាប់</h3>
                    <button onClick={() => setShowLeaveForm(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 12, width: 36, height: 36, fontSize: 18, color: '#64748b' }}>×</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>ប្រភេទច្បាប់</label>
                      <select
                        value={leaveForm.type}
                        onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                        style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc' }}
                      >
                        <option value="ច្បាប់ឈប់សម្រាកប្រចាំឆ្នាំ (AL)">ច្បាប់ឈប់សម្រាកប្រចាំឆ្នាំ (AL)</option>
                        <option value="ច្បាប់ឈឺ (Sick)">ច្បាប់ឈឺ (Sick)</option>
                        <option value="ច្បាប់ការងារផ្ទាល់ខ្លួន (Personal)">ច្បាប់ការងារផ្ទាល់ខ្លួន (Personal)</option>
                        <option value="ច្បាប់មាតុភាព (Maternity)">ច្បាប់មាតុភាព (Maternity)</option>
                        <option value="ផ្សេងៗ (Other)">ផ្សេងៗ (Other)</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>ចាប់ពីថ្ងៃ</label>
                        <input
                          type="date"
                          value={leaveForm.startDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                          style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>ដល់ថ្ងៃ</label>
                        <input
                          type="date"
                          value={leaveForm.endDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                          style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>មូលហេតុ</label>
                      <textarea
                        placeholder="សូមបញ្ជាក់មូលហេតុឱ្យបានច្បាស់លាស់..."
                        value={leaveForm.reason}
                        onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                        style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 14, background: '#f8fafc', minHeight: 100, resize: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>ភ្ជាប់ឯកសារ (រូបភាព ឬ PDF)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {leaveForm.attachments.map((url, i) => (
                          <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            {url.toLowerCase().endsWith('.pdf') ? (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontSize: 24 }}>📄</div>
                            ) : (
                              <img src={url.startsWith('http') ? url : `/api${url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="att" />
                            )}
                            <button
                              onClick={() => removeAttachment(i)}
                              style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                            >×</button>
                          </div>
                        ))}
                        <label style={{
                          width: 64, height: 64, borderRadius: 12, border: '2px dashed #cbd5e1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          fontSize: 24, color: '#94a3b8', background: '#f8fafc'
                        }}>
                          +
                          <input type="file" accept="image/*,application/pdf" onChange={handleLeaveFileChange} style={{ display: 'none' }} />
                        </label>
                      </div>
                      {uploadingFile && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#2196f3', fontWeight: 600 }}>⏳ កំពុង Upload...</p>}
                    </div>

                    <button
                      onClick={submitLeaveRequest}
                      disabled={submittingLeave || uploadingFile}
                      style={{
                        marginTop: 8, background: '#2196f3', color: '#fff', border: 'none',
                        borderRadius: 16, padding: '16px', fontSize: 16, fontWeight: 800,
                        boxShadow: '0 8px 20px rgba(33, 150, 243, 0.3)',
                        opacity: (submittingLeave || uploadingFile) ? 0.7 : 1
                      }}
                    >
                      {submittingLeave ? 'កំពុងបញ្ជូន...' : 'បញ្ជូនសំណើ'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === 'hist' && (
          <div style={{ padding: '16px', minHeight: 450, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 22, cursor: 'pointer', padding: 0 }}>←</button>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>ប្រវត្តិវត្តមាន</h3>
            </div>

            {loadingHist ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTop: '4px solid #2196f3', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 24, border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: 54, marginBottom: 16 }}>⏱️</div>
                <h4 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: 18, fontWeight: 800 }}>មិនទាន់មានទិន្នន័យ</h4>
                <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>មិនទាន់មានកំណត់ត្រាវត្តមានសម្រាប់ខែនេះនៅឡើយទេ</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
                {history.map((h, i) => {
                  const d = new Date(h.date);
                  return (
                    <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '14px', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #f8fafc', paddingBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                          {d.toLocaleDateString('km-KH', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                        <div style={{ fontSize: 10, background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, color: '#64748b', fontWeight: 700 }}>
                          {h.shift || 'វេនធម្មតា'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, marginBottom: 2 }}>ចូល (IN)</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: '#166534' }}>{h.checkIn || '--:--'}</div>
                          {h.lateMinutes > 0 && <div style={{ fontSize: 8, color: '#dc2626' }}>យឺត {h.lateMinutes} នាទី</div>}
                        </div>
                        <div style={{ background: '#fef2f2', padding: '8px', borderRadius: 10, textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, marginBottom: 2 }}>ចេញ (OUT)</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: '#991b1b' }}>{h.checkOut || '--:--'}</div>
                          {h.earlyLeaveMinutes > 0 && <div style={{ fontSize: 8, color: '#dc2626' }}>ចេញមុន {h.earlyLeaveMinutes} នាទី</div>}
                        </div>
                      </div>

                      {(h.checkIn2 || h.checkOut2) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                          <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: 10, textAlign: 'center', opacity: 0.8 }}>
                            <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 700 }}>ចូល ២</div>
                            <div style={{ fontSize: 13, fontWeight: 900 }}>{h.checkIn2 || '--:--'}</div>
                          </div>
                          <div style={{ background: '#fef2f2', padding: '8px', borderRadius: 10, textAlign: 'center', opacity: 0.8 }}>
                            <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>ចេញ ២</div>
                            <div style={{ fontSize: 13, fontWeight: 900 }}>{h.checkOut2 || '--:--'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Other Tabs (Field, Meeting, etc.) ── */}
        {!['home', 'team', 'profile', 'calendar', 'leave', 'hist'].includes(activeTab) && (
          <div style={{ padding: '40px 20px', textAlign: 'center', minHeight: 300 }}>
            <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', color: '#2196f3', fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>← ត្រឡប់</button>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {activeTab === 'leave' ? '📋' : activeTab === 'field' ? '📍' : activeTab === 'meeting' ? '🤝' : '💬'}
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>កំពុងអភិវឌ្ឍ...</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}>ផ្នែកនេះនឹងមានវត្តមានក្នុងពេលឆាប់ៗនេះ។</p>
          </div>
        )}

        {/* Bottom Nav */}
        <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around', padding: '10px 0 14px' }}>
          {[
            { id: 'home', icon: '🏠', label: 'ទំព័រដើម' },
            { id: 'hist', icon: '⏱️', label: 'ប្រវត្តិ' },
            { id: 'profile', icon: '👤', label: 'ព័ត៌មាន' },
            { id: 'msg', icon: '✉️', label: 'សារ' },
            { id: 'cfg', icon: '⚙️', label: 'កំណត់' },
          ].map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: activeTab === n.id ? '#2196f3' : '#94a3b8' }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 9, fontWeight: activeTab === n.id ? 700 : 400 }}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
