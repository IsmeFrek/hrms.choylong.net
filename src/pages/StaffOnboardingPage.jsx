import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PersonalTab from '../components/tabs/PersonalTab';
import WorkTab from '../components/tabs/WorkTab';
import EducationTab from '../components/tabs/EducationTab';
import DocumentsTab from '../components/tabs/DocumentsTab';
import CivilServantTab from '../components/tabs/CivilServantTab';
import UnionTab from '../components/tabs/UnionTab';
import ParentTab from '../components/tabs/ParentTab';
import ChildrenTab from '../components/tabs/ChildrenTab';
import OtherTab from '../components/tabs/OtherTab';

export default function StaffOnboardingPage({ embedded = false, allowApproved = false, onSubmitted, initialData } = {}) {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // Default behavior: if staff is already approved (has permissions), onboarding should not be shown.
  // When embedded in My HR, we may allow approved staff to submit/refresh their onboarding info.
  useEffect(() => {
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    const isApproved = perms.length > 0;
    if (!allowApproved && token && isApproved) {
      navigate('/my-hr', { replace: true });
    }
  }, [allowApproved, navigate, token, user?.permissions]);

  const API_BASE_RAW =
    (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/+$/, '')) ||
    '';
  const API_PREFIX = API_BASE_RAW ? `${API_BASE_RAW}/api` : '/api';

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeTab, setActiveTab] = useState('personal');
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [skills, setSkills] = useState([]);

  // Borrow the HR form data shape (subset: Personal + Work tabs)
  const [form, setForm] = useState({
    no: '',
    staffId: '',
    cardId: '',
    khmerName: '',
    name: '',
    gender: '',
    dob: '',
    maritalStatus: '',
    bloodGroup: '',
    phone: user?.phone || '',
    email: '',
    birthPlace: '',
    currentPlace: '',
    birthPlaceParts: {
      houseNo: '',
      road: '',
      village: '',
      commune: '',
      district: '',
      province: '',
    },
    currentPlaceParts: {
      houseNo: '',
      road: '',
      village: '',
      commune: '',
      district: '',
      province: '',
    },
    officerType: '',
    position: '',
    skill: '',
    Department_Kh: '',
    joinDate: '',
    dateJoinedMinistry: '',
    lastSalaryIncrementDate: '',
    degreeLevel: '',
    degree: '',
    educationLevel: '',
    officerId: '',
    cardNumber: '',
    nid: '',
    bankAccount: '',
    mentorName: '',
    mentorDate: '',

    // Education / Documents
    educationList: [],
    documents: [],

    // Civil Servant
    civilServantId: '',
    civilServantRole: '',
    salaryLevel: '',
    civilServantStartDate: '',
    nominationStartDate: '',
    salaryPromotionDate: '',
    medalType: '',
    medalReceivedDate: '',
    civilServantReason: '',
    isRetiredThenContract: false,
    isPartTime: false,

    // Union
    unionName: '',
    unionMemberId: '',
    unionJoinDate: '',
    unionRole: '',
    unionPhone: '',
    unionNote: '',

    // Parents
    fatherName: '',
    fatherDob: '',
    fatherOccupation: '',
    fatherPhone: '',
    fatherNote: '',
    motherName: '',
    motherDob: '',
    motherOccupation: '',
    motherPhone: '',
    motherNote: '',

    // Children
    childrenList: [],

    // Other
    other: '',

    // keep user's display name to help admin; not part of HR schema
    fullName: user?.fullName || '',
  });

  const parsePlaceString = (str) => {
    const parts = { houseNo: '', road: '', village: '', commune: '', district: '', province: '' };
    if (!str || typeof str !== 'string') return parts;
    
    const segments = str.split(', ');
    segments.forEach(seg => {
      const [key, val] = seg.split(':');
      if (key === 'ផ្ទះលេខ') parts.houseNo = val || '';
      if (key === 'ផ្លូវ') parts.road = val || '';
      if (key === 'ភូមិ') parts.village = val || '';
      if (key === 'ឃុំ/សង្កាត់') parts.commune = val || '';
      if (key === 'ស្រុក/ខណ្ឌ') parts.district = val || '';
      if (key === 'ខេត្ត/ក្រុង') parts.province = val || '';
    });
    return parts;
  };

  useEffect(() => {
    if (initialData) {
      setForm((prev) => {
        const next = { ...prev, ...initialData };
        
        // Parse birthPlace string if birthPlaceParts is empty
        if (initialData.birthPlace && (!next.birthPlaceParts || Object.values(next.birthPlaceParts).every(v => !v))) {
          next.birthPlaceParts = parsePlaceString(initialData.birthPlace);
        }
        
        // Parse currentPlace string if currentPlaceParts is empty
        if (initialData.currentPlace && (!next.currentPlaceParts || Object.values(next.currentPlaceParts).every(v => !v))) {
          next.currentPlaceParts = parsePlaceString(initialData.currentPlace);
        }
        
        return next;
      });
    }
  }, [initialData]);

  const isCivilServant = useMemo(
    () => String(form?.officerType || '').trim() === 'មន្ត្រីរាជការ',
    [form?.officerType]
  );

  const isSingle = useMemo(() => {
    const v = String(form?.maritalStatus || '').trim().toLowerCase();
    // Support both schema enum values and common Khmer label
    return v === 'single' || v === 'យកលីវ' || v.includes('លីវ');
  }, [form?.maritalStatus]);

  const hideEducation = useMemo(() => {
    const t = String(form?.officerType || '').trim();
    return t === 'កម្មករកិច្ចសន្យា' || t === 'កិច្ចសន្យារដ្ឋ';
  }, [form?.officerType]);

  const normalizeList = (v) => (Array.isArray(v) ? v : []);

  const coerceMaybeNumber = (v, fallback = '') => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return '';
      const n = Number(s);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  };

  const normalizePlaceParts = (v) => {
    const src = v && typeof v === 'object' ? v : {};
    return {
      houseNo: src.houseNo || '',
      road: src.road || '',
      village: src.village || '',
      commune: src.commune || '',
      district: src.district || '',
      province: src.province || '',
    };
  };

  const formatPlaceParts = (parts) => {
    const p = normalizePlaceParts(parts);
    const segments = [
      p.houseNo ? `ផ្ទះលេខ:${p.houseNo}` : '',
      p.road ? `ផ្លូវ:${p.road}` : '',
      p.village ? `ភូមិ:${p.village}` : '',
      p.commune ? `ឃុំ/សង្កាត់:${p.commune}` : '',
      p.district ? `ស្រុក/ខណ្ឌ:${p.district}` : '',
      p.province ? `ខេត្ត/ក្រុង:${p.province}` : '',
    ].filter(Boolean);
    return segments.join(', ');
  };

  const isRequiredInvalid = (data, key) => {
    const required = ['khmerName', 'name', 'gender', 'dob', 'maritalStatus'];
    if (!required.includes(key)) return false;
    const v = data?.[key];
    return !v || String(v).trim() === '';
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // If someone opens /staff-onboarding directly without being logged in.
        if (!token) {
          navigate('/staff-login', { replace: true, state: { redirect: '/employee-register' } });
          return;
        }

        // load dropdown options via public endpoints (pending users have no perms)
        try {
          const [depsRes, posRes, skillsRes] = await Promise.all([
            fetch(`${API_PREFIX}/departments/public`).then((r) => r.json()).catch(() => []),
            fetch(`${API_PREFIX}/positions/public`).then((r) => r.json()).catch(() => []),
            fetch(`${API_PREFIX}/skills/public`).then((r) => r.json()).catch(() => []),
          ]);
          if (!cancelled) {
            setDepartments(Array.isArray(depsRes) ? depsRes : []);
            setPositions(Array.isArray(posRes) ? posRes : []);
            setSkills(Array.isArray(skillsRes) ? skillsRes : []);
          }
        } catch {}

        const res = await fetch(`${API_PREFIX}/onboarding`, {
          method: 'GET',
          headers: authHeader,
        });
        const text = await res.text();
        let data;
        try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
        if (!res.ok) throw new Error(data.message || text || 'Load failed');

        const fields = data?.fields || {};
        if (!cancelled) {
          setForm((prev) => ({
            ...prev,
            // personal
            no: typeof fields.no !== 'undefined' ? fields.no : prev.no,
            staffId: fields.staffId || prev.staffId,
            khmerName: fields.khmerName || prev.khmerName,
            name: fields.name || prev.name,
            gender: fields.gender || prev.gender,
            dob: fields.dob || prev.dob,
            maritalStatus: fields.maritalStatus || prev.maritalStatus,
            bloodGroup: fields.bloodGroup || prev.bloodGroup,
            phone: fields.phone || prev.phone,
            email: fields.email || prev.email,
            birthPlace: fields.birthPlace || prev.birthPlace,
            currentPlace: fields.currentPlace || prev.currentPlace,
            birthPlaceParts: normalizePlaceParts(fields.birthPlaceParts || prev.birthPlaceParts),
            currentPlaceParts: normalizePlaceParts(fields.currentPlaceParts || prev.currentPlaceParts),
            officerId: fields.officerId || prev.officerId,
            cardNumber: fields.cardNumber || prev.cardNumber,
            nid: fields.nid || prev.nid,
            bankAccount: fields.bankAccount || prev.bankAccount,

            // work
            officerType: fields.officerType || prev.officerType,
            position: fields.position || prev.position,
            skill: fields.skill || prev.skill,
            Department_Kh: fields.Department_Kh || prev.Department_Kh,
            joinDate: fields.joinDate || prev.joinDate,
            dateJoinedMinistry: fields.dateJoinedMinistry || prev.dateJoinedMinistry,
            lastSalaryIncrementDate: fields.lastSalaryIncrementDate || prev.lastSalaryIncrementDate,
            degreeLevel: fields.degreeLevel || prev.degreeLevel,
            degree: fields.degree || prev.degree,
            educationLevel: fields.educationLevel || prev.educationLevel,
            mentorName: fields.mentorName || prev.mentorName,
            mentorDate: fields.mentorDate || prev.mentorDate,

            // Education / Documents
            educationList: typeof fields.educationList !== 'undefined' ? normalizeList(fields.educationList) : prev.educationList,
            documents: typeof fields.documents !== 'undefined' ? normalizeList(fields.documents) : prev.documents,

            // Civil servant
            civilServantId: typeof fields.civilServantId !== 'undefined' ? (fields.civilServantId || '') : prev.civilServantId,
            civilServantRole: typeof fields.civilServantRole !== 'undefined' ? (fields.civilServantRole || '') : prev.civilServantRole,
            salaryLevel: typeof fields.salaryLevel !== 'undefined' ? (fields.salaryLevel || '') : prev.salaryLevel,
            civilServantStartDate: typeof fields.civilServantStartDate !== 'undefined' ? (fields.civilServantStartDate || '') : prev.civilServantStartDate,
            nominationStartDate: typeof fields.nominationStartDate !== 'undefined' ? (fields.nominationStartDate || '') : prev.nominationStartDate,
            salaryPromotionDate: typeof fields.salaryPromotionDate !== 'undefined' ? (fields.salaryPromotionDate || '') : prev.salaryPromotionDate,
            medalType: typeof fields.medalType !== 'undefined' ? (fields.medalType || '') : prev.medalType,
            medalReceivedDate: typeof fields.medalReceivedDate !== 'undefined' ? (fields.medalReceivedDate || '') : prev.medalReceivedDate,
            civilServantReason: typeof fields.civilServantReason !== 'undefined' ? (fields.civilServantReason || '') : prev.civilServantReason,
            isRetiredThenContract: typeof fields.isRetiredThenContract !== 'undefined' ? !!fields.isRetiredThenContract : prev.isRetiredThenContract,
            isPartTime: typeof fields.isPartTime !== 'undefined' ? !!fields.isPartTime : prev.isPartTime,

            // Union
            unionName: typeof fields.unionName !== 'undefined' ? (fields.unionName || '') : prev.unionName,
            unionMemberId: typeof fields.unionMemberId !== 'undefined' ? (fields.unionMemberId || '') : prev.unionMemberId,
            unionJoinDate: typeof fields.unionJoinDate !== 'undefined' ? (fields.unionJoinDate || '') : prev.unionJoinDate,
            unionRole: typeof fields.unionRole !== 'undefined' ? (fields.unionRole || '') : prev.unionRole,
            unionPhone: typeof fields.unionPhone !== 'undefined' ? (fields.unionPhone || '') : prev.unionPhone,
            unionNote: typeof fields.unionNote !== 'undefined' ? (fields.unionNote || '') : prev.unionNote,

            // Parents
            fatherName: typeof fields.fatherName !== 'undefined' ? (fields.fatherName || '') : prev.fatherName,
            fatherDob: typeof fields.fatherDob !== 'undefined' ? (fields.fatherDob || '') : prev.fatherDob,
            fatherOccupation: typeof fields.fatherOccupation !== 'undefined' ? (fields.fatherOccupation || '') : prev.fatherOccupation,
            fatherPhone: typeof fields.fatherPhone !== 'undefined' ? (fields.fatherPhone || '') : prev.fatherPhone,
            fatherNote: typeof fields.fatherNote !== 'undefined' ? (fields.fatherNote || '') : prev.fatherNote,
            motherName: typeof fields.motherName !== 'undefined' ? (fields.motherName || '') : prev.motherName,
            motherDob: typeof fields.motherDob !== 'undefined' ? (fields.motherDob || '') : prev.motherDob,
            motherOccupation: typeof fields.motherOccupation !== 'undefined' ? (fields.motherOccupation || '') : prev.motherOccupation,
            motherPhone: typeof fields.motherPhone !== 'undefined' ? (fields.motherPhone || '') : prev.motherPhone,
            motherNote: typeof fields.motherNote !== 'undefined' ? (fields.motherNote || '') : prev.motherNote,

            // Children
            childrenList: typeof fields.childrenList !== 'undefined' ? normalizeList(fields.childrenList) : prev.childrenList,

            // Other
            other: typeof fields.other !== 'undefined' ? (fields.other || '') : prev.other,

            // helper
            fullName: fields.fullName || prev.fullName,
          }));
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [API_PREFIX, authHeader, navigate, token]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!token) {
        navigate('/staff-login', { replace: true, state: { redirect: '/employee-register' } });
        return;
      }

      if (isRequiredInvalid(form, 'khmerName') || isRequiredInvalid(form, 'name')) {
        throw new Error('សូមបំពេញព័ត៌មានសំខាន់ៗ (ឈ្មោះ/ឡាតាំង)');
      }
      if (!form.officerType || String(form.officerType).trim() === '') {
        throw new Error('សូមជ្រើសរើស “ប្រភេទមន្ត្រី”');
      }

      const payloadFields = {
        ...form,
        birthPlace: formatPlaceParts(form.birthPlaceParts) || form.birthPlace || '',
        currentPlace: formatPlaceParts(form.currentPlaceParts) || form.currentPlace || '',
      };

      // Remove evaluation/performance fields from employee-register payload
      delete payloadFields.creativityScore;
      delete payloadFields.responsibilityScore;
      delete payloadFields.patriotismScore;
      delete payloadFields.leadershipScore;
      delete payloadFields.ethicsScore;
      delete payloadFields.totalScore;
      delete payloadFields.reason1;
      delete payloadFields.reason2;
      delete payloadFields.reason3;
      delete payloadFields.reason4;
      delete payloadFields.reason5;
      delete payloadFields.reason6;

      // If single, hide/ignore union + children info
      if (isSingle) {
        delete payloadFields.unionName;
        delete payloadFields.unionMemberId;
        delete payloadFields.unionJoinDate;
        delete payloadFields.unionRole;
        delete payloadFields.unionPhone;
        delete payloadFields.unionNote;
        delete payloadFields.childrenList;
      }

      // Hide/ignore education for certain officer types
      if (hideEducation) {
        delete payloadFields.educationList;
      }

      const res = await fetch(`${API_PREFIX}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ fields: payloadFields }),
      });

      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
      if (!res.ok) throw new Error(data.message || text || 'Submit failed');

      setSuccess('បានផ្ញើព័ត៌មានរួចហើយ។');
      if (typeof onSubmitted === 'function') {
        try { onSubmitted(data); } catch {}
      }
      if (!embedded) {
        if (data && data._id) {
          navigate(`/staff-biography/${data._id}`, { replace: true });
        } else {
          navigate('/staff-biography', { replace: true });
        }
      }
    } catch (e2) {
      setError(e2.message || 'Submit failed');
    } finally {
      setSaving(false);
    }
  };
                    
  async function handleUpload(file) {
    if (!file) return '';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const base = API_BASE_RAW;
      const endpoint = `${API_PREFIX}/upload`;
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      if (!res.ok) {
        console.error('Upload failed:', res.status, await res.text());
        return '';
      }
      const result = await res.json();
      let url = result.url || '';
      if (url && /^https?:\/\//i.test(url)) return url;
      if (url && base) return `${base.replace(/\/+$/,'')}${url}`;
      return url;
    } catch (e) {
      console.error('Upload error:', e);
      return '';
    }
  }

  // If user changes officerType away from civil servant, don't keep them on civil tab.
  useEffect(() => {
    if (activeTab === 'civil' && !isCivilServant) {
      setActiveTab('work');
    }
  }, [activeTab, isCivilServant]);

  // If user selects single, don't keep them on union/children tabs.
  useEffect(() => {
    if (isSingle && (activeTab === 'union' || activeTab === 'children')) {
      setActiveTab('personal');
    }
  }, [activeTab, isSingle]);

  // If officerType hides education, don't keep them on education tab.
  useEffect(() => {
    if (hideEducation && activeTab === 'education') {
      setActiveTab('work');
    }
  }, [activeTab, hideEducation]);

  const isPersonalValid = form.khmerName && form.name && form.gender && form.dob;

  return (
    <div className={embedded ? '' : 'min-h-screen flex items-start justify-center bg-gray-50 p-4'}>
      <div className={embedded ? '' : 'w-full max-w-5xl bg-white border rounded-lg shadow p-6'}>
        {!embedded && (
          <>
            <h1 className="text-xl font-semibold mb-1 text-center">បុគ្គលិកចុះឈ្មោះ</h1>
            <p className="text-sm text-gray-500 mb-4 text-center">បំពេញព័ត៌មាន → រក្សាទុកជា “សំណើរង់ចាំ” → Admin មើល និងអនុម័ត</p>
          </>
        )}

        {loading ? (
          <div className="text-gray-600">កំពុងទាញយក...</div>
        ) : (
          <>
            {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}
            {success && <div className="mb-3 text-green-700 text-sm">{success}</div>}

            <form onSubmit={submit} className={embedded ? 'space-y-4' : 'space-y-4'}>
              <div className="sticky top-0 z-20 -mx-2 px-2 py-2 bg-white/95 backdrop-blur flex overflow-x-auto whitespace-nowrap items-center gap-2 border-b">
                <button
                  type="button"
                  onClick={() => setActiveTab('personal')}
                  className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'personal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'}`}
                >
                  ព័ត៌មានផ្ទាល់ខ្លួន
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('work')}
                  className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'work' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!isPersonalValid}
                >
                  ព័ត៌មានការងារ
                </button>
                {!hideEducation && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('education')}
                    className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'education' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!isPersonalValid}
                  >
                    ការអប់រំ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'documents' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!isPersonalValid}
                >
                  ឯកសារ
                </button>
                {isCivilServant && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('civil')}
                    className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'civil' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!isPersonalValid}
                  >
                    មន្ត្រីរាជការ
                  </button>
                )}
                {!isSingle && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('union')}
                    className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'union' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!isPersonalValid}
                  >
                    ព័ត៌មានសហព័ន្ធ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('parents')}
                  className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'parents' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!isPersonalValid}
                >
                  ព័ត៌មានឪពុកម្ដាយ
                </button>
                {!isSingle && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('children')}
                    className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'children' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!isPersonalValid}
                  >
                    ព័ត៌មានកូន
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('other')}
                  className={`flex-shrink-0 px-3 py-2 rounded text-sm border ${activeTab === 'other' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700'} ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!isPersonalValid}
                >
                  ព័ត៌មានផ្សេងៗ
                </button>
              </div>

              {activeTab === 'personal' && (
                <>
                  <PersonalTab
                    data={form}
                    setData={setForm}
                    isRequiredInvalid={isRequiredInvalid}
                    noOptions={[]}
                    takenNos={[]}
                    hideNo
                    splitBirthPlace
                    splitCurrentPlace
                    inputTextClass="text-base"
                    handleUpload={handleUpload}
                  />
                  <div className="flex justify-end mt-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab('work')}
                      className={`bg-blue-600 text-white px-4 py-2 rounded ${!isPersonalValid ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                      disabled={!isPersonalValid}
                    >
                      បន្តទៅផ្ទាំងបន្ទាប់
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'work' && (
                <WorkTab
                  data={form}
                  setData={setForm}
                  positions={positions}
                  skills={skills}
                  departments={departments}
                  inputTextClass="text-base"
                  degreeLevelOptions={["បណ្ឌិត", "បរិញ្ញាបត្រជាន់ខ្ពស់", "បរិញ្ញាបត្រ", "បរិញ្ញាបត្ររង", "ទុតិយភូមិ", "បឋមសិក្សា"]}
                  educationLevelOptions={["ទុតិយភូមិ", "មធ្យមសិក្សា", "បឋមសិក្សា"]}
                  hideRetiredThenContract
                  hidePartTime
                  hideDateJoinedMinistry
                  hideLastSalaryIncrementDate
                  hideMentorFields
                  requiredFields={['officerType']}
                />
              )}

              {activeTab === 'education' && !hideEducation && (
                <EducationTab editHR={form} setEditHR={setForm} skills={skills} />
              )}

              {activeTab === 'documents' && (
                <DocumentsTab editHR={form} setEditHR={setForm} />
              )}

              {activeTab === 'civil' && isCivilServant && (
                <CivilServantTab editHR={form} setEditHR={setForm} hideMinistryDates hideExtraOptions />
              )}

              {activeTab === 'union' && !isSingle && (
                <UnionTab editHR={form} setEditHR={setForm} />
              )}

              {activeTab === 'parents' && (
                <ParentTab editHR={form} setEditHR={setForm} />
              )}

              {activeTab === 'children' && !isSingle && (
                <ChildrenTab editHR={form} setEditHR={setForm} />
              )}

              {activeTab === 'other' && (
                <OtherTab editHR={form} setEditHR={setForm} />
              )}

              <button
                className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
