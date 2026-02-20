import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import HRAPI from '../services/hrAPI';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';
import StaftPage from './StaftPage';
import { MdVisibility, MdDescription, MdPerson, MdEdit, MdDelete, MdAssignmentInd, MdGroup, MdExitToApp, MdCreditCard } from 'react-icons/md';
import HRReportView from './HRReportView';
import { hasResignData as _hasResignData, isExplicitlyRemoved as _isExplicitlyRemoved, isPreparedForDeletion as _isPreparedForDeletion, isCountedActive as _isCountedActive } from '../utils/hrFilters';

// Fix for "Failed to resolve import 'react-icons/md'":
// You must install react-icons in your project folder.
// In your terminal, run one of these commands inside d:\app9a:

// Recommended (avoids most peer dependency issues):
//   npm install react-icons --legacy-peer-deps

// If you still get errors, try:
//   npm install react-icons --force

// After successful install, restart your dev server (e.g., npm run dev).
// The import will then work and the error will be resolved.

// Required npm packages for this file:
// 1. react-icons
//    Install with:
//      npm install react-icons --legacy-peer-deps
//
// If you use FontAwesome icons (the <i className="fas fa-user ..."/>), you may also want:
// 2. @fortawesome/fontawesome-free
//    Install with:
//      npm install @fortawesome/fontawesome-free
//
// For everything else in this file, no additional packages are needed.

export default function HRPage() {
  const perms = usePermission();
  const { user } = useAuth();
  const [hrList, setHRList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Grouped filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [filterOfficerType, setFilterOfficerType] = useState('');

  const [viewMode, setViewMode] = useState('active'); // 'active' | 'all' | 'archived'
  const [newHR, setNewHR] = useState({
  no: '', staffId: '', khmerName: '', name: '', gender: '', dob: '', maritalStatus: '', bloodGroup: '',
  phone: '', email: '', birthPlace: '', currentPlace: '', officerType: '', position: '', skill: '', Department_Kh: '',
  joinDate: '', civilServantStartDate: '', nominationStartDate: '', dateJoinedMinistry: '', lastSalaryIncrementDate: '', workOther: '',
    degreeLevel: '', degree: '', educationLevel: '',
    officerId: '', cardNumber: '', nid: '', bankAccount: '',
    civilServantId: '', dateJoinedGov: '', yearsInCurrentRank: '', rankExitReason: '', rankExitDuration: '', grade: '',
    proposedBy: '', yearsInRank: '', totalYearsWorked: '', asOfDate: '', salaryLevel: '', mentorName: '', mentorDate: '',
    creativityScore: '', responsibilityScore: '', patriotismScore: '', leadershipScore: '', ethicsScore: '', totalScore: '',
    reason1: '', reason2: '', reason3: '', reason4: '', reason5: '', reason6: '',
    status: 'Active', image: '', other: ''
    , isRetiredThenContract: false, isPartTime: false
  });
  const [editHR, setEditHR] = useState({ ...newHR });
  const [editingId, setEditingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState('no');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [visibleFields, setVisibleFields] = useState([]);
  const [draftVisibleFields, setDraftVisibleFields] = useState([]);
  const [fieldsSaving, setFieldsSaving] = useState(false);
  const [fieldsError, setFieldsError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [reviewImage, setReviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  // Resign modal state
  const [showResignModal, setShowResignModal] = useState(false);
  const [resignId, setResignId] = useState(null);
  const [resignDate, setResignDate] = useState('');
  const [resignReason, setResignReason] = useState('');
  const [resignDocument, setResignDocument] = useState('');
  const [resignDocumentFile, setResignDocumentFile] = useState(null); // <-- new: keep actual File for multipart upload
  // Compute max no for inline selection
  const maxNo = React.useMemo(() => {
    const nums = hrList.map(h => Number(h.no)).filter(n => Number.isFinite(n) && n > 0);
    return nums.length ? Math.max(...nums) : 0;
  }, [hrList]);
  const noOptions = React.useMemo(() => Array.from({ length: Math.max(maxNo, hrList.length) }, (_, i) => i + 1), [maxNo, hrList.length]);
  // kept for future display, but we now allow selecting taken numbers (backend swaps)
  const takenNoSet = React.useMemo(() => new Set(hrList.map(h => Number(h.no)).filter(n => Number.isFinite(n) && n > 0)), [hrList]);
  // Khmer header labels for known HR fields (scalar fields only)
  const KH_LABELS = {
    no: 'ល.រ',
    staffId: 'លេខកាត',
    khmerName: 'គោត្តនាម និងនាម',
    name: 'ឡាតាំង',
    gender: 'ភេទ',
    dob: 'ថ្ងៃកំណើត',
    maritalStatus: 'ស្ថានភាពគ្រួសារ',
    bloodGroup: 'ក្រុមឈាម',
    phone: 'ទូរស័ព្ទ',
    email: 'អ៊ីមែល',
    birthPlace: 'ទីកន្លែងកំណើត',
    currentPlace: 'ទីកន្លែងបច្ចុប្បន្ន',
    fatherName: 'ឈ្មោះឪពុក',
    fatherDob: 'ថ្ងៃកំណើតឪពុក',
    fatherOccupation: 'មុខរបរឪពុក',
    fatherPhone: 'ទូរស័ព្ទឪពុក',
    fatherNote: 'កំណត់សម្គាល់ឪពុក',
    motherName: 'ឈ្មោះម្តាយ',
    motherDob: 'ថ្ងៃកំណើតម្តាយ',
    motherOccupation: 'មុខរបរម្តាយ',
    motherPhone: 'ទូរស័ព្ទម្តាយ',
    motherNote: 'កំណត់សម្គាល់ម្តាយ',
    unionName: 'ឈ្មោះសហជីព',
    unionMemberId: 'លេខសមាជិកសហជីព',
    unionJoinDate: 'ថ្ងៃចូលសហជីព',
    unionRole: 'តួនាទីក្នុងសហជីព',
    unionPhone: 'ទូរស័ព្ទសហជីព',
    unionNote: 'កំណត់សម្គាល់សហជីព',
    officerType: 'ប្រភេទមន្ត្រី',
    position: 'តួនាទី',
    skill: 'ជំនាញ',
    Department_Kh: 'ផ្នែក',
    joinDate: 'កាលបរិច្ឆេទចូលបម្រើការងារ',
    civilServantRole: 'តួនាទីរាជការ',
    civilServantStartDate: 'ថ្ងៃចូលក្របខ័ណ្ឌ',
    nominationStartDate: 'ថ្ងៃតាំងស៊ប់',
    dateJoinedMinistry: 'កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរ',
    lastSalaryIncrementDate: 'កាលបរិច្ឆេទបន្ថែមប្រាក់បៀវត្ស',
    workOther: 'ផ្សេងៗការងារ',
    degreeLevel: 'កម្រិតសញ្ញាប័ត្រ',
    degree: 'សញ្ញាប័ត្រ',
    educationLevel: 'កម្រិតវប្បធម៌',
    officerId: 'លេខមន្ត្រី',
    cardNumber: 'លេខបសស',
    nid: 'លេខអត្តសញ្ញាណ',
    bankAccount: 'លេខគណនីធនាគារ',
    civilServantId: 'លេខមន្ត្រីរាជការ',
    yearsInCurrentRank: 'ឆ្នាំក្នុងថ្នាក់បច្ចុប្បន្ន',
    rankExitReason: 'មូលហេតុចាកចេញពីថ្នាក់',
    rankExitDuration: 'រយៈពេលចាកចេញ',
    grade: 'ថ្នាក់',
    proposedBy: 'ស្នើដោយ',
    yearsInRank: 'ឆ្នាំក្នុងថ្នាក់',
    totalYearsWorked: 'ចំនួនឆ្នាំធ្វើការ',
    asOfDate: 'ថ្ងៃបច្ចុប្បន្ន',
    salaryLevel: 'កាំប្រាក់',
    mentorName: 'ឈ្មោះអ្នកណែនាំ',
    mentorDate: 'ថ្ងៃណែនាំ',
    civilServantReason: 'មូលហេតុ (រាជការ)',
    creativityScore: 'ពិន្ទុសិល្បៈ',
    responsibilityScore: 'ពិន្ទុទទួលខុសត្រូវ',
    patriotismScore: 'ពិន្ទុស្មោះត្រង់',
    leadershipScore: 'ពិន្ទុភាពជាអ្នកដឹកនាំ',
    ethicsScore: 'ពិន្ទុសីលធម៌',
    totalScore: 'ពិន្ទុសរុប',
    reason1: 'មូលហេតុ១',
    reason2: 'មូលហេតុ២',
    reason3: 'មូលហេតុ៣',
    reason4: 'មូលហេតុ៤',
    reason5: 'មូលហេតុ៥',
    reason6: 'មូលហេតុ៦',
    reason: 'មូលហេតុផ្សេងៗ',
    status: 'ស្ថានភាព',
    image: 'រូបភាព',
    other: 'ផ្សេងៗ',
    salaryPromotionDate: 'ថ្ងៃឡើងកាំប្រាក់',
    medalType: 'ប្រភេទផ្កាយរង្វាន់',
    medalReceivedDate: 'ថ្ងៃទទួលផ្កាយរង្វាន់'
  };
  // Add resign-related Khmer labels
  KH_LABELS.resignDate = 'ថ្ងៃលាលែង';
  KH_LABELS.resignReason = 'មូលហេតុលាលែង';
  KH_LABELS.resignDocument = 'ឯកសារលាលែង';

  const toKhmerMaritalStatus = (val) => {
    if (!val) return '';
    if (val === 'Single') return 'លីវ';
    if (val === 'Married') return 'រៀបការហើយ';
    if (val === 'Divorced') return 'ពោះម៉ាយ';
    if (val === 'Widowed') return 'មេម៉ាយ';
    return val;
  };

  // Simple vs Full templates (arrays of field keys)
  const TEMPLATE_SIMPLE_KEYS = ['staffId','khmerName','name','gender','dob','position','phone','status','image','other'];
  const TEMPLATE_FULL_KEYS = [
    'no','staffId','khmerName','name','gender','dob','bloodGroup','phone','email','birthPlace','currentPlace',
    'fatherName','fatherDob','fatherOccupation','fatherPhone','fatherNote','motherName','motherDob','motherOccupation','motherPhone','motherNote',
    'unionName','unionMemberId','unionJoinDate','unionRole','unionPhone','unionNote',
  'officerType','position','skill','Department_Kh','joinDate','civilServantRole','nominationStartDate','dateJoinedMinistry','lastSalaryIncrementDate','workOther',
    'degreeLevel','degree','educationLevel','officerId','cardNumber','nid','bankAccount','civilServantId',
    'yearsInCurrentRank','rankExitReason','rankExitDuration','grade','proposedBy','yearsInRank','totalYearsWorked','asOfDate',
    'salaryLevel','mentorName','mentorDate','civilServantReason',
    'creativityScore','responsibilityScore','patriotismScore','leadershipScore','ethicsScore','totalScore',
    'reason1','reason2','reason3','reason4','reason5','reason6','reason',
    'status','image','other','salaryPromotionDate','medalType','medalReceivedDate'
  ];

  // Default visible column order (matches the requested serial layout)
  const DEFAULT_VISIBLE_ORDER = [
    'no','staffId','khmerName','name','gender','dob','bloodGroup','phone','email','birthPlace','currentPlace',
    'position','Department_Kh','skill','joinDate','nominationStartDate','dateJoinedMinistry','lastSalaryIncrementDate','salaryLevel','salaryPromotionDate','nid','cardNumber','bankAccount'
  ];

  // Example/sample values for demonstration
  const SAMPLE_ROW = {
    staffId: '0001',
    khmerName: 'តេស្ត អា',
    name: 'Test A',
    gender: 'Male',
    dob: '01/01/1990',
    position: 'Officer',
    phone: '012345678',
    status: 'Active',
    image: '',
    other: 'សម្គាល់'
  };

  const handleImport = async (e) => {
    if (!perms.canEditHR) return;
    if (!templateDownloaded) {
      alert('សូមទាញយក "គំរូ" ជាមុន សម្រាប់បំពេញទិន្នន័យ ហើយបន្ទាប់មកទើបនាំចូល។');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error('សន្លឹកទិន្នន័យគ្មាន');

        // Read as AoA to control headers
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
        if (!aoa || aoa.length === 0) throw new Error('ឯកសារទទេ');

  // Build header mapping (supports either Khmer labels or English keys)
  const header = (aoa[0] || []).map(h => String(h).trim());
        const khToKey = Object.fromEntries(Object.entries(KH_LABELS).map(([k, v]) => [String(v).trim(), k]));
        const headerKeyOrder = header.map(h => {
          if (KH_LABELS[h]) return h; // unlikely: header equals a key that is also a label key
          if (khToKey[h]) return khToKey[h];
          // Accept raw keys too
          return Object.prototype.hasOwnProperty.call(KH_LABELS, h) ? h : (Object.values(KH_LABELS).includes(h) ? khToKey[h] : h);
        }).map(h => (Object.prototype.hasOwnProperty.call(KH_LABELS, h) ? h : (khToKey[h] || null)));

        // Validate required keys exist in mapped header
        const REQUIRED = ['staffId','khmerName','name'];
        const missingRequired = REQUIRED.filter(r => !headerKeyOrder.includes(r));
        if (missingRequired.length) {
          alert(`ទម្រង់ក្បាលតារាងមិនមានជួរឈរចាំបាច់៖ ${missingRequired.join(', ')}\nសូមប្រើគំរូដែលបានទាញយក (Khmer headers).`);
          e.target.value = '';
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
  const rows = aoa.slice(1);

        const creations = [];
        let created = 0;

        for (const row of rows) {
          if (!row || row.every(v => (String(v || '').trim().length === 0))) continue; // skip blank
          const hrObj = {};
          headerKeyOrder.forEach((mappedKey, i) => {
            if (!mappedKey) return;
            const val = row[i];
            hrObj[mappedKey] = typeof val === 'string' ? val.trim() : (val ?? '');
          });
          if (REQUIRED.every(k => (hrObj[k] || '').toString().trim().length > 0)) {
            creations.push(HRAPI.create(hrObj).then(() => { created++; }).catch(() => {}));
          }
        }

        if (creations.length > 0) await Promise.allSettled(creations);

        if (created === 0) {
          alert('មិនមានទិន្នន័យណាត្រូវបាននាំចូលទេ។ សូមបំពេញជួរឈរចាំបាច់នៅក្នុងគំរូ (staffId, khmerName, name).');
        }
        await fetchHR();
      } catch (err) {
        console.error('XLSX import error', err);
        alert('មានបញ្ហាក្នុងការនាំចូល XLSX។ សូមពិនិត្យឯកសាររបស់អ្នក។');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const allFields = [
    { key: 'no', label: 'ល.រ / លេខកាត' },
    { key: 'khmerName', label: 'គោត្តនាម និងនាម / ឡាតាំង' },
    { key: 'dob', label: 'ថ្ងៃកំណើត' },
    { key: 'officerType', label: 'ប្រភេទមន្ត្រី' },
    { key: 'position', label: 'តួនាទី / ផ្នែក' },
    { key: 'skill', label: '/ជំនាញ' },
    { key: 'salaryLevel', label: 'កាំប្រាក់' },
    { key: 'phone', label: 'ទូរស័ព្ទ' },
    { key: 'civilServantId', label: 'លេខមន្ត្រីរាជការ' },
    { key: 'nid', label: 'លេខអត្តសញ្ញាណ' },
    { key: 'bankAccount', label: 'លេខគណនីធនាគារ' },
    { key: 'birthPlace', label: 'ទីកន្លែងកំណើត / ទីកន្លែងបច្ចុប្បន្ន' },
    // maritalStatus moved to display above bloodGroup; keep label mapping in KH_LABELS
    { key: 'bloodGroup', label: '/ក្រុមឈាម' },
    { key: 'joinDate', label: 'កាលបរិច្ឆេទចូលបម្រើការងារ' },
    { key: 'dateJoinedMinistry', label: 'កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរ' },
    { key: 'lastSalaryIncrementDate', label: 'កាលបរិច្ឆេទបញ្ចប់តំណែង' },
    { key: 'workOther', label: 'ផ្សេងៗការងារ' },
    { key: 'degreeLevel', label: 'កម្រិតសញ្ញាប័ត្រ' },
    { key: 'degree', label: 'សញ្ញាប័ត្រ' },
    { key: 'educationLevel', label: 'កម្រិតវប្បធម៌' },
    { key: 'officerId', label: 'លេខមន្ត្រី' },
    { key: 'nominationStartDate', label: '/ថ្ងៃតាំងស៊ប់' },
    { key: 'yearsInCurrentRank', label: 'ឆ្នាំក្នុងថ្នាក់បច្ចុប្បន្ន' },
    { key: 'rankExitReason', label: 'មូលហេតុចាកចេញពីថ្នាក់' },
    { key: 'rankExitDuration', label: 'រយៈពេលចាកចេញ' },
    { key: 'grade', label: 'ថ្នាក់' },
    { key: 'proposedBy', label: 'ស្នើដោយ' },
    { key: 'yearsInRank', label: 'ឆ្នាំក្នុងថ្នាក់' },
    { key: 'totalYearsWorked', label: 'ចំនួនឆ្នាំធ្វើការ' },
    { key: 'asOfDate', label: 'ថ្ងៃបច្ចុប្បន្ន' },
    { key: 'mentorName', label: 'ឈ្មោះអ្នកណែនាំ' },
    { key: 'mentorDate', label: 'ថ្ងៃណែនាំ' },
    { key: 'salaryPromotionDate', label: 'ថ្ងៃឡើងកាំប្រាក់ / ប្រភេទការតម្លឹងកាំប្រាក់' },
    { key: 'email', label: 'អ៊ីមែល' },
    { key: 'creativityScore', label: 'ពិន្ទុសិល្បៈ' },
    { key: 'responsibilityScore', label: 'ពិន្ទុទទួលខុសត្រូវ' },
    { key: 'patriotismScore', label: 'ពិន្ទុស្មោះត្រង់' },
    { key: 'leadershipScore', label: 'ពិន្ទុភាពជាអ្នកដឹកនាំ' },
    { key: 'ethicsScore', label: 'ពិន្ទុសីលធម៌' },
    { key: 'totalScore', label: 'ពិន្ទុសរុប' },
    { key: 'reason1', label: 'មូលហេតុ១' },
    { key: 'reason2', label: 'មូលហេតុ២' },
    { key: 'reason3', label: 'មូលហេតុ៣' },
    { key: 'reason4', label: 'មូលហេតុ៤' },
    { key: 'reason5', label: 'មូលហេតុ៥' },
    { key: 'reason6', label: 'មូលហេតុ៦' },
    { key: 'image', label: 'រូបភាព' },
    { key: 'other', label: 'ផ្សេងៗ' },
    { key: 'status', label: 'ស្ថានភាព' }
    ,{ key: 'resignDate', label: 'ថ្ងៃលាលែង' }
    ,{ key: 'resignReason', label: 'មូលហេតុលាលែង' }
    ,{ key: 'resignDocument', label: 'ឯកសារលាលែង' }
  ];

  const computeDefaultVisibleFields = () => {
    const allKeys = allFields.map(f => f.key);
    const base = DEFAULT_VISIBLE_ORDER.filter(k => allKeys.includes(k));
    // include resign fields by default if present
    const resignKeys = ['resignDate', 'resignReason', 'resignDocument'].filter(k => allKeys.includes(k));
    const merged = Array.from(new Set([...base, ...resignKeys]));
    return merged.length ? merged : allKeys;
  };

  const normalizeToKnownKeys = (keys) => {
    const known = new Set(allFields.map(f => f.key));
    return (Array.isArray(keys) ? keys : []).map(String).filter(k => known.has(k));
  };

  const loadVisibleFieldsSetting = async () => {
    const fallback = computeDefaultVisibleFields();
    try {
      const res = await api.get('/report-settings/hr-visible-fields', { params: { groupName: 'global' } });
      const fields = normalizeToKnownKeys(res?.data?.fields);
      setVisibleFields(fields.length ? fields : fallback);
    } catch (e) {
      setVisibleFields(fallback);
    }
  };

  const saveVisibleFieldsSetting = async (fieldsToSave) => {
    if (!perms.canEditHR) return;
    setFieldsSaving(true);
    setFieldsError('');
    const fallback = computeDefaultVisibleFields();
    const cleaned = normalizeToKnownKeys(fieldsToSave);
    const payload = { groupName: 'global', fields: cleaned.length ? cleaned : fallback };
    try {
      const res = await api.post('/report-settings/hr-visible-fields', payload);
      const saved = normalizeToKnownKeys(res?.data?.fields);
      setVisibleFields(saved.length ? saved : payload.fields);
      setShowDropdown(false);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Save failed';
      setFieldsError(msg);
    } finally {
      setFieldsSaving(false);
    }
  };

  // Initial load + refresh after closing Add/Edit modal
  useEffect(() => {
    if (!perms.canViewHR) return;
    if (!showAddModal && !showEditModal) {
      fetchHR();
    }
  }, [perms.canViewHR, showAddModal, showEditModal]);

  // Load column visibility setting once HR view permission is available
  useEffect(() => {
    if (!perms.canViewHR) return;
    loadVisibleFieldsSetting();
  }, [perms.canViewHR]);

  const fetchHR = async () => {
  if (!perms.canViewHR) return; // guard
  setLoading(true);
    try {
      const res = await HRAPI.getAll();
      const rows = Array.isArray(res.data) ? res.data : [];
      // Normalize resignation field names from backend (resignationDate, resignationReason, resignationDocument)
      const normalized = rows.map(r => ({
        ...r,
        resignDate: r.resignDate || r.resignationDate || r.resignation_date || null,
        resignReason: r.resignReason || r.resignationReason || r.resignation_reason || r.resign_reason || null,
        resignDocument: r.resignDocument || r.resignationDocument || r.resignation_document || r.resign_document || null
      }));
      setHRList(normalized);
    } catch (err) {
      setHRList([]);
    }
    setLoading(false);
  };

  const openAddModal = () => {
    if (!perms.canEditHR) return;
    // Prefill next sequential no (max + 1)
    const nextNo = (() => {
      const nums = hrList.map(h => Number(h.no)).filter(n => Number.isFinite(n) && n > 0);
      if (!nums.length) return 1;
      return Math.max(...nums) + 1;
    })();
    setNewHR({
  no: nextNo, staffId: '', khmerName: '', name: '', gender: '', dob: '', maritalStatus: '', bloodGroup: '',
  phone: '', email: '', birthPlace: '', currentPlace: '', officerType: '', position: '', skill: '', Department_Kh: '',
      joinDate: '', dateJoinedMinistry: '', lastSalaryIncrementDate: '', workOther: '',
      degreeLevel: '', degree: '', educationLevel: '',
      officerId: '', cardNumber: '', nid: '', bankAccount: '',
      civilServantId: '', dateJoinedGov: '', yearsInCurrentRank: '', rankExitReason: '', rankExitDuration: '', grade: '',
      proposedBy: '', yearsInRank: '', totalYearsWorked: '', asOfDate: '', salaryLevel: '', mentorName: '', mentorDate: '',
      creativityScore: '', responsibilityScore: '', patriotismScore: '', leadershipScore: '', ethicsScore: '', totalScore: '',
      reason1: '', reason2: '', reason3: '', reason4: '', reason5: '', reason6: '',
      status: 'Active', image: '', other: ''
      , isRetiredThenContract: false, isPartTime: false
    });
    setShowAddModal(true);
  };
  const closeAddModal = () => { setShowAddModal(false); };
  const openEditModal = (hr) => {
    setEditingId(hr._id);
    setEditHR({ ...hr });
    setShowEditModal(true);
  };
  const closeEditModal = () => { setShowEditModal(false); setEditingId(null); };

  const handleAdd = async () => {
    if (!perms.canEditHR) return;
    if (!newHR.staffId.trim() || !newHR.khmerName.trim() || !newHR.name.trim()) return;
    await HRAPI.create(newHR); // newHR មាន field image (base64 string)
    setShowAddModal(false);
    await fetchHR();
  };
  const handleUpdate = async () => {
    if (!perms.canEditHR) return;
    await HRAPI.update(editingId, editHR);
    setShowEditModal(false);
    setEditingId(null);
  await fetchHR();
  };
  // Soft-delete: mark status='Deleted' so record can be restored later
  const handleDelete = async (id) => {
    if (!perms.canEditHR) return;
    if (!window.confirm('តើអ្នកចង់លុបទិន្នន័យនេះមែនទេ? វានឹងត្រូវបានផ្លាស់ស្ថានភាពទៅ "Deleted" និងអាចស្ដារឡើងវិញបាន។')) return;
    try {
      await HRAPI.update(id, { status: 'Deleted' });
      await fetchHR();
    } catch (err) {
      console.error('Failed to soft-delete HR', err);
      alert('មិនអាចលុបទិន្នន័យបាន - សូមព្យាយាមម្តងទៀត។');
    }
  };

  const handleRestore = async (id) => {
    if (!perms.canEditHR) return;
    if (!window.confirm('តើអ្នកចង់ស្ដារឡើងវិញទិន្នន័យនេះមែនទេ?')) return;
    try {
      await HRAPI.update(id, { status: 'Active' });
      await fetchHR();
    } catch (err) {
      console.error('Failed to restore HR', err);
      alert('មិនអាចស្ដារឡើងវិញបាន - សូមព្យាយាមម្តងទៀត។');
    }
  };

  const openResignModal = (id) => {
    if (!perms.canEditHR) return;
    setResignId(id);
    setResignDate('');
    setResignReason('');
    setResignDocument('');
    setShowResignModal(true);
  };

  const closeResignModal = () => {
    setShowResignModal(false);
    setResignId(null);
    setResignDate('');
    setResignReason('');
    setResignDocument('');
  };

  const handleResignDocumentUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setResignDocumentFile(null);
      setResignDocument('');
      return;
    }
    // reject very large files early to avoid socket/timeouts
    const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_BYTES) {
      alert('ឯកសាររបស់អ្នកធំពេក (លើស 20MB) — សូមប្រើឯកសារតូចជាង។');
      e.target.value = '';
      setResignDocumentFile(null);
      setResignDocument('');
      return;
    }
    setResignDocumentFile(file);
    const reader = new FileReader();
    reader.onload = () => setResignDocument(reader.result);
    reader.readAsDataURL(file);
  };
  
  const handleResign = async () => {
    if (!perms.canEditHR || !resignId) return;
    if (!resignDate) {
      alert('សូមជ្រើសរើសកាលបរិច្ឆេទលាលែងការងារ។');
      return;
    }
    if (!resignReason.trim()) {
      alert('សូមបំពេញមូលហេតុ');
      return;
    }
    if (!window.confirm('តើអ្នកប្រាកដថាចង់ដាក់ស្ថានភាពជា Resigned?')) return;
    try {
      // If user selected a File, try to upload it first (multipart/form-data)
      let documentPayload = resignDocument || null;
      if (resignDocumentFile) {
        const form = new FormData();
        form.append('file', resignDocumentFile);
        const uploadEndpoints = ['/uploads', '/upload', '/api/upload'];
        // axios options: longer timeout, allow large bodies
        const opts = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000, maxContentLength: Infinity, maxBodyLength: Infinity };
        let uploaded = false;
        for (const ep of uploadEndpoints) {
          try {
            const upRes = await api.post(ep, form, opts);
            const data = upRes && upRes.data;
            const candidate = data && (data.url || data.path || (Array.isArray(data) && data[0]?.url) || data.fileUrl || data.filename || (data.data && data.data.url));
            if (candidate) {
              documentPayload = candidate;
              uploaded = true;
              break;
            }
            // if server returned an object with file info (fallback)
            if (data && typeof data === 'string') {
              documentPayload = data;
              uploaded = true;
              break;
            }
          } catch (uErr) {
            console.error('upload attempt failed', ep, uErr?.code || uErr?.message || uErr);
            // Stop retrying on timeout to surface a clearer message to user
            if (uErr && (uErr.code === 'ECONNABORTED' || uErr.message?.includes('timeout'))) {
              alert('ការផ្ទុកឯកសារពេលវេលាត្រូវបានផ្អាក (timeout) — សូមព្យាយាមម្តងទៀត ឬប្រើឯកសារតូចជាង។');
              break;
            }
            // otherwise continue to next candidate endpoint
          }
        }
        if (!uploaded) {
          // leave documentPayload as base64 preview if present; otherwise null
          if (!documentPayload) {
            console.warn('upload failed, falling back to base64 preview (if any)');
          }
        }
      }
       // Send both variant keys to backend where possible to maximize compatibility
       await HRAPI.update(resignId, { 
         status: 'Resigned', 
         resignDate,
         resignReason: resignReason.trim(),
         resignDocument: documentPayload || null,
         // also include alternative backend naming
         resignationDate: resignDate,
         resignationReason: resignReason.trim(),
         resignationDocument: documentPayload || null
       });
       await fetchHR();
       closeResignModal();
     } catch (err) {
       console.error('Failed to set Resigned', err);
       alert('មិនអាចធ្វើការប្តូរស្ថានភាពបាន - សូមព្យាយាមម្តងទៀត។');
     }
   };

  // Inline change of sequence number
  const [noSavingId, setNoSavingId] = useState(null);
  const handleNoChange = async (hrId, newNo) => {
    if (!perms.canEditHR) return;
    const n = Number(newNo);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await reorderByInserting(hrId, n);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'បរាជ័យក្នុងការកែ ល.រ';
      alert(msg);
      await fetchHR();
    }
  };

  // Insert-style reorder: move source row to `newNo` and shift intervening rows
  const reorderByInserting = async (sourceId, newNo) => {
    if (!perms.canEditHR) return;
    const src = hrList.find(h => (h._id || h.id) === sourceId);
    if (!src) return;
    const current = Number(src.no) || 0;
    if (current === newNo) return;
    // Build updates: if moving up (newNo < current) -> increment numbers in [newNo, current-1]
    // if moving down (newNo > current) -> decrement numbers in [current+1, newNo]
    const updates = [];
    setNoSavingId(sourceId);
    try {
      if (newNo < current) {
        const toIncrease = hrList.filter(h => {
          const v = Number(h.no) || 0;
          return v >= newNo && v < current;
        });
        // increase those by 1
        for (const h of toIncrease) {
          updates.push(HRAPI.update(h._id || h.id, { no: (Number(h.no) || 0) + 1 }));
        }
        // move source to newNo
        updates.push(HRAPI.update(sourceId, { no: newNo }));
      } else {
        const toDecrease = hrList.filter(h => {
          const v = Number(h.no) || 0;
          return v <= newNo && v > current;
        });
        // decrease those by 1
        for (const h of toDecrease) {
          updates.push(HRAPI.update(h._id || h.id, { no: (Number(h.no) || 0) - 1 }));
        }
        // move source to newNo
        updates.push(HRAPI.update(sourceId, { no: newNo }));
      }
      if (updates.length) await Promise.allSettled(updates);
      await fetchHR();
    } finally {
      setNoSavingId(null);
    }
  };

  // Move the row up (decrease `no`) by swapping with the previous sequence number
  const handleMoveUp = async (hrId) => {
    if (!perms.canEditHR) return;
    try {
      const hr = hrList.find(h => (h._id || h.id) === hrId);
      if (!hr) return;
      const current = Number(hr.no) || 0;
      if (current <= 1) return;
      const targetNo = current - 1;
      await reorderByInserting(hrId, targetNo);
    } catch (err) {
      console.error('Move up failed', err);
      alert('មិនអាចផ្លាស់ទីឡើងបាន - សូមព្យាយាមម្តងទៀត។');
    } finally {
      setNoSavingId(null);
    }
  };

  // Move the row down (increase `no`) by swapping with the next sequence number
  const handleMoveDown = async (hrId) => {
    if (!perms.canEditHR) return;
    try {
      const hr = hrList.find(h => (h._id || h.id) === hrId);
      if (!hr) return;
      const current = Number(hr.no) || 0;
      const targetNo = current + 1;
      await reorderByInserting(hrId, targetNo);
    } catch (err) {
      console.error('Move down failed', err);
      alert('មិនអាចផ្លាស់ទីចុះបាន - សូមព្យាយាមម្តងទៀត។');
    } finally {
      setNoSavingId(null);
    }
  };

  // Drag & drop reordering
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = (e, hrId) => {
    try { e.dataTransfer.setData('text/plain', hrId || ''); } catch (e) {}
    setDraggingId(hrId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverRow = (e, hrId) => {
    e.preventDefault();
    setDragOverId(hrId);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropRow = async (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    try {
      const src = hrList.find(h => (h._id || h.id) === sourceId);
      const tgt = hrList.find(h => (h._id || h.id) === targetId);
      if (!src || !tgt) return;
      const tgtNo = Number(tgt.no) || 0;
      await reorderByInserting(sourceId, tgtNo);
    } catch (err) {
      console.error('Drag drop swap failed', err);
      alert('មិនអាចផ្លាស់ទីបាន - សូមព្យាយាមម្តងទៀត។');
    } finally {
      setNoSavingId(null);
      setDraggingId(null);
      setDragOverId(null);
    }
  };

  // Sorting (numeric for 'no', string for others; undefined 'no' goes to end)
  // Special sorting: when sorting by department, also sort names alphabetically within each department
  const sortedHR = [...hrList].sort((a, b) => {
    if (sortField === 'no') {
      const an = Number.isFinite(Number(a.no)) ? Number(a.no) : Infinity;
      const bn = Number.isFinite(Number(b.no)) ? Number(b.no) : Infinity;
      return sortOrder === 'asc' ? an - bn : bn - an;
    }
    
    // Special case: when sorting by Department_Kh, also sort by name within departments
    if (sortField === 'Department_Kh') {
      const deptA = (a.Department_Kh ?? '').toString();
      const deptB = (b.Department_Kh ?? '').toString();
      const deptCompare = sortOrder === 'asc' 
        ? deptA.localeCompare(deptB, 'km') 
        : deptB.localeCompare(deptA, 'km');
      
      // If departments are the same, sort by name alphabetically
      if (deptCompare === 0) {
        const nameA = (a.khmerName ?? a.name ?? '').toString();
        const nameB = (b.khmerName ?? b.name ?? '').toString();
        return nameA.localeCompare(nameB, 'km');
      }
      
      return deptCompare;
    }
    
    const valA = (a[sortField] ?? '').toString();
    const valB = (b[sortField] ?? '').toString();
    return sortOrder === 'asc'
      ? valA.localeCompare(valB, 'km')
      : valB.localeCompare(valA, 'km');
  });

  // Detect if current logged-in user has a leadership role
  // If user has a department assignment, they are automatically considered leadership for filtering
  const isUserLeadership = Boolean(user?.department) || Boolean((user?.roles || []).some(r => {
    const n = (r && r.name) ? String(r.name) : '';
    return n.includes('ដឹក') || n.toLowerCase().includes('lead') || /chief|head|manager|director/i.test(n);
  }));

  function hrIsLeadership(hrRec) {
    // If the logged-in user has a department assignment, show only HR from that department
    const userDept = (user && user.department) ? String(user.department).trim() : '';
    const normalize = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (userDept) {
      const dept = hrRec.Department_Kh || '';
      if (normalize(dept) === normalize(userDept)) return true;
      return false; // strict department-only view when user has department assignment
    }
    // fallback: check common leadership keywords in several fields
    const fields = [hrRec.officerType, hrRec.position, hrRec.Department_Kh, hrRec.title, hrRec.officerRole];
    for (const f of fields) {
      if (!f) continue;
      const s = String(f);
      if (s.includes('ដឹក') || s.toLowerCase().includes('lead') || /chief|head|manager|director/i.test(s)) return true;
    }
    return false;
  }

  // Filtering, Pagination
  // use shared helper to determine resign/removal data
  const hasResignData = _hasResignData;

  const filterOptions = React.useMemo(() => {
    const uniq = (arr) => {
      const s = new Set();
      for (const v of arr) {
        const t = String(v ?? '').trim();
        if (t) s.add(t);
      }
      return Array.from(s).sort((a, b) => a.localeCompare(b, 'km'));
    };
    return {
      departments: uniq((hrList || []).map(h => h.Department_Kh)),
      skills: uniq((hrList || []).map(h => h.skill)),
      positions: uniq((hrList || []).map(h => h.position)),
      officerTypes: uniq((hrList || []).map(h => h.officerType)),
    };
  }, [hrList]);

  const filteredHR = sortedHR.filter(hr => {
    const q = String(search || '').trim().toLowerCase();
    const norm = (v) => String(v ?? '').trim().toLowerCase();
    const matchesSearch = !q ? true : [
      // Requested fields
      hr.staffId, // លេខកាត
      hr.khmerName, // គោត្តនាម និងនាម
      hr.name, // ឡាតាំង
      hr.position, // តួនាទី
      hr.Department_Kh, // ផ្នែក
      hr.officerType, // ប្រភេទមន្ត្រី
      hr.skill, // ជំនាញ
      hr.nid, // លេខអត្តសញ្ញាណ
      hr.bankAccount, // លេខគណនីធនាគារ
      // Extra common IDs (useful in practice)
      hr.no,
      hr.officerId,
      hr.civilServantId,
      hr.cardNumber
    ].some(v => norm(v).includes(q));
    if (!matchesSearch) return false;

    // Apply grouped filters
    const eq = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    if (filterDepartment && !eq(hr.Department_Kh, filterDepartment)) return false;
    if (filterSkill && !eq(hr.skill, filterSkill)) return false;
    if (filterPosition && !eq(hr.position, filterPosition)) return false;
    if (filterOfficerType && !eq(hr.officerType, filterOfficerType)) return false;

    if (isUserLeadership) {
      // show only leadership HR rows
      return hrIsLeadership(hr);
    }
    if (viewMode === 'all') return true;
    // Respect backend-provided prepared-for-deletion flag so future deletions aren't counted as resigned
    // If a record has an explicit dataset removal date, treat it as removed regardless of prepared flag
    const hasExplicitRemoval = _isExplicitlyRemoved(hr);
    const isPrepared = _isPreparedForDeletion(hr) && !hasExplicitRemoval;
    if (viewMode === 'archived') return (hr.status === 'Resigned' || hr.status === 'Deleted' || (hasResignData(hr) && !isPrepared));
    // default 'active': exclude only those actually resigned/deleted or with resign data that's NOT prepared
    return !(hr.status === 'Resigned' || hr.status === 'Deleted' || (hasResignData(hr) && !isPrepared));
  });
  const pagedHR = filteredHR.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredHR.length / limit);

  const handleSort = (field) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  // Export HRs to CSV
  const handleExport = () => {
    if (!(perms.canPrintHR || perms.canEditHR || perms.canViewHR)) return;
    const fields = ['staffId','khmerName','name','gender','dob','position','phone','status','image','other'];
    const csvRows = [fields];
    hrList.forEach(hr => {
      csvRows.push(fields.map(f => JSON.stringify(hr[f] ?? '')));
    });
    const csvContent = '\uFEFF' + csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hr.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download XLSX template for import
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    // Instructions sheet (Khmer)
    const inst = [
      ['ការណែនាំ'],
      ['- សូមប្រើសន្លឹក "គំរូសាមញ្ញ" ឬ "គំរូពេញលេញ" ដើម្បីបញ្ចូលទិន្នន័យ។'],
      ['- អក្សរខ្មែរ អាចបញ្ចូលបានដោយផ្ទាល់។ សូមប្រើពុម្ពអក្សរ Khmer OS Siemreap / Noto Sans Khmer នៅក្នុង Excel របស់អ្នក។'],
      ['- កាលបរិច្ឆេទ អាចបញ្ចូលជា dd/mm/yyyy ឬ yyyy-mm-dd។'],
      ['- ជួរឈរចាំបាច់៖ staffId, គោត្តនាម និងនាម, ឡាតាំង'],
      ['- មានជួរដាតាទូទៅ "សម្គាល់" នៅជួរឈរ "ផ្សេងៗ"។']
    ];
    const wsInst = XLSX.utils.aoa_to_sheet(inst);
    XLSX.utils.book_append_sheet(wb, wsInst, 'ការណែនាំ');

    // Simple template with Khmer headers + sample row
    const simpleHeadersKh = TEMPLATE_SIMPLE_KEYS.map(k => KH_LABELS[k] || k);
    const simpleSampleRow = TEMPLATE_SIMPLE_KEYS.map(k => (SAMPLE_ROW[k] ?? ''));
    const wsSimple = XLSX.utils.aoa_to_sheet([simpleHeadersKh, simpleSampleRow]);
    XLSX.utils.book_append_sheet(wb, wsSimple, 'គំរូសាមញ្ញ');

    // Full template (scalar fields) with Khmer headers + sample row (fill from SAMPLE_ROW where applicable)
    const fullHeadersKh = TEMPLATE_FULL_KEYS.map(k => KH_LABELS[k] || k);
    const fullSampleRow = TEMPLATE_FULL_KEYS.map(k => (SAMPLE_ROW[k] ?? ''));
    const wsFull = XLSX.utils.aoa_to_sheet([fullHeadersKh, fullSampleRow]);
    XLSX.utils.book_append_sheet(wb, wsFull, 'គំរូពេញលេញ');

    XLSX.writeFile(wb, 'hr-import-template.xlsx');
    setTemplateDownloaded(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Tab state for column selection
  const [colTab, setColTab] = useState('personal');
  const isFieldsDirty = React.useMemo(() => {
    const a = normalizeToKnownKeys(draftVisibleFields);
    const b = normalizeToKnownKeys(visibleFields);
    if (a.length !== b.length) return true;
    const bSet = new Set(b);
    return a.some(k => !bSet.has(k));
  }, [draftVisibleFields, visibleFields]);

  useEffect(() => {
    if (showDropdown) {
      setDraftVisibleFields(visibleFields);
      setFieldsError('');
    }
  }, [showDropdown]);

  // Split fields by tab (personal, work, education, documents, civilServant, union, parents, children, other, performance, resign)
  const tabFields = {
    all: allFields,
    personal: allFields.filter(f =>
      ['no', 'khmerName', 'name', 'dob', 'phone', 'email', 'birthPlace', 'currentPlace', 'maritalStatus', 'bloodGroup'].includes(f.key)
    ),
    work: allFields.filter(f =>
      ['officerType', 'position', 'skill', 'Department_Kh', 'joinDate', 'dateJoinedMinistry', 'lastSalaryIncrementDate', 'workOther', 'salaryLevel', 'salaryPromotionDate'].includes(f.key)
    ),
    education: allFields.filter(f =>
      ['degreeLevel', 'degree', 'educationLevel'].includes(f.key)
    ),
    documents: allFields.filter(f =>
      ['officerId', 'cardNumber', 'nid', 'bankAccount', 'image', 'other'].includes(f.key)
    ),
    civilServant: allFields.filter(f =>
      ['civilServantId', 'civilServantRole', 'civilServantStartDate', 'dateJoinedMinistry', 'nominationStartDate', 'yearsInCurrentRank'].includes(f.key)
    ),
    union: allFields.filter(f =>
      ['unionName', 'unionMemberId', 'unionJoinDate', 'unionRole', 'unionPhone', 'unionNote'].includes(f.key)
    ),
    parents: allFields.filter(f =>
      ['fatherName','fatherDob','fatherOccupation','fatherPhone','fatherNote','motherName','motherDob','motherOccupation','motherPhone','motherNote'].includes(f.key)
    ),
    children: allFields.filter(f =>
      // placeholder: if child fields exist, include them; otherwise empty
      ['childName','childDob','childNote'].includes(f.key)
    ),
    performance: allFields.filter(f =>
      ['creativityScore', 'responsibilityScore', 'patriotismScore', 'leadershipScore', 'ethicsScore', 'totalScore'].includes(f.key)
    ),
    resign: allFields.filter(f =>
      ['resignDate','resignReason','resignDocument'].includes(f.key)
    ),
    other: allFields.filter(f =>
      ['officerId', 'cardNumber', 'nid', 'bankAccount', 'civilServantId', 'yearsInCurrentRank', 'rankExitReason', 'rankExitDuration', 'grade', 'proposedBy', 'yearsInRank', 'totalYearsWorked', 'asOfDate', 'reason1', 'reason2', 'reason3', 'reason4', 'reason5', 'reason6', 'status', 'image', 'other', 'workOther'].includes(f.key)
    )
  };

  // Helper to format date
  // Date fields to render in dd/mm/yyyy
  const dateKeys = [
    'dob',
    'joinDate',
    'dateJoinedMinistry',
    'lastSalaryIncrementDate',
    'civilServantStartDate',
    'nominationStartDate',
    'salaryPromotionDate',
    'asOfDate',
    'resignDate',
    'mentorDate'
  ];
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Safely open data: (base64) URLs by converting to a Blob URL first to avoid about:blank issues
  const openDataUrl = (dataUrl) => {
    try {
      if (typeof dataUrl !== 'string') return window.open(dataUrl, '_blank');
      if (!dataUrl.startsWith('data:')) return window.open(dataUrl, '_blank');
      const parts = dataUrl.split(',');
      const meta = parts[0] || '';
      const b64 = parts[1] || '';
      const m = (meta.match(/data:([^;]+);/) || [null, 'application/octet-stream'])[1];
      const byteChars = atob(b64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: m });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      // Revoke after a minute
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
      return w;
    } catch (e) {
      try { return window.open(dataUrl, '_blank'); } catch (E) { return null; }
    }
  };

  if (!perms.canViewHR) {
    return (
      <div className="p-6">
        <h4 className="text-2xl font-bold mb-2 text-gray-900">ព័ត៌មានបុគ្គលិក</h4>
        <div className="mt-6 p-4 border rounded bg-yellow-50 text-yellow-800">
          អ្នកមិនមានសិទ្ធិមើលទំព័រនេះទេ (requires permission: view:hr).
        </div>
      </div>
    );
  }

  return (
    <div className="p-3" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", fontSize: '12px' }}>
      <h5 className="text-xl font-normal mb-2 text-gray-900" style={{ fontSize: '14px', fontFamily: "'Khmer OS muol light', 'Noto Sans Khmer', sans-serif" }}>ព័ត៌មានបុគ្គលិក</h5>
      <div className="mb-4 flex items-center">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="ស្វែងរក (លេខកាត, ឈ្មោះខ្មែរ/ឡាតាំង, តួនាទី, ផ្នែក, ប្រភេទមន្ត្រី, ជំនាញ, អត្តសញ្ញាណ, គណនីធនាគារ)"
          className="border px-3 py-1 rounded w-80 mr-6"
          style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
        />
        <span className="mr-6 font-semibold" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>ចំនួនបុគ្គលិក៖ {filteredHR.length}</span>

        <div className="flex items-center mr-6" style={{ gap: 8 }}>
          <button
            type="button"
            className="border px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
            onClick={() => setShowFilters(v => !v)}
            style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
          >
            ជ្រើស Filter
          </button>
          {(filterDepartment || filterSkill || filterPosition || filterOfficerType) && (
            <button
              type="button"
              className="border px-3 py-1 rounded bg-white hover:bg-gray-50 text-sm"
              onClick={() => { setFilterDepartment(''); setFilterSkill(''); setFilterPosition(''); setFilterOfficerType(''); setPage(1); }}
              style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
            >
              សម្អាត Filter
            </button>
          )}
        </div>
        <label className="flex items-center mr-6 text-sm">
          <span className="mr-2 text-sm" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>ទិដ្ឋភាព</span>
          <select value={viewMode} onChange={e => { setViewMode(e.target.value); setPage(1); }} className="border rounded px-2 py-1" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
            <option value="active">សកម្ម</option>
            <option value="all">គ្រប់គ្នា</option>
            <option value="archived">បានលាលែង / លុប</option>
          </select>
        </label>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="bg-purple-500 text-white px-4 py-1 rounded mr-5" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={70}>70</option>
          <option value={100}>100</option>
        </select>

        {showFilters && (
          <div className="ml-2 flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label className="flex items-center" style={{ gap: 6 }}>
              <span className="text-xs">ផ្នែក</span>
              <select
                className="border rounded px-2 py-1"
                value={filterDepartment}
                onChange={(e) => { setFilterDepartment(e.target.value); setPage(1); }}
                style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              >
                <option value="">ទាំងអស់</option>
                {filterOptions.departments.map(v => (<option key={v} value={v}>{v}</option>))}
              </select>
            </label>

            <label className="flex items-center" style={{ gap: 6 }}>
              <span className="text-xs">ជំនាញ</span>
              <select
                className="border rounded px-2 py-1"
                value={filterSkill}
                onChange={(e) => { setFilterSkill(e.target.value); setPage(1); }}
                style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              >
                <option value="">ទាំងអស់</option>
                {filterOptions.skills.map(v => (<option key={v} value={v}>{v}</option>))}
              </select>
            </label>

            <label className="flex items-center" style={{ gap: 6 }}>
              <span className="text-xs">តួនាទី</span>
              <select
                className="border rounded px-2 py-1"
                value={filterPosition}
                onChange={(e) => { setFilterPosition(e.target.value); setPage(1); }}
                style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              >
                <option value="">ទាំងអស់</option>
                {filterOptions.positions.map(v => (<option key={v} value={v}>{v}</option>))}
              </select>
            </label>

            <label className="flex items-center" style={{ gap: 6 }}>
              <span className="text-xs">ប្រភេទមន្ត្រី</span>
              <select
                className="border rounded px-2 py-1"
                value={filterOfficerType}
                onChange={(e) => { setFilterOfficerType(e.target.value); setPage(1); }}
                style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              >
                <option value="">ទាំងអស់</option>
                {filterOptions.officerTypes.map(v => (<option key={v} value={v}>{v}</option>))}
              </select>
            </label>
          </div>
        )}

        {/* Column selection stays at the same spot */}
        {perms.canEditHR && (
          <div className="relative inline-block">
            <button
              className="border px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm font-semibold"
              onClick={() => setShowDropdown(v => !v)}
              type="button"
              style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
            >
              ជ្រើសរើសបង្ហាញ Fields
            </button>
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute z-50 bg-white border rounded shadow-lg mt-2 right-0"
                style={{ maxHeight: '60vh', overflowY: 'auto', minWidth: '520px', maxWidth: 'calc(100vw - 40px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
              >
                <div className="flex items-center justify-between border-b px-3 py-2" style={{ gap: 8 }}>
                  <div className="flex border-b-0" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    {['all','personal','work','education','documents','civilServant','union','parents','children','performance','resign','other'].map(tab => (
                      <button
                        key={tab}
                        className={`inline-block px-2 py-1 mr-1 text-xs ${colTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        onClick={() => setColTab(tab)}
                        type="button"
                        style={{ minWidth: 72 }}
                      >
                        {tab === 'all' ? 'ទាំងអស់' : tab === 'personal' ? 'ផ្ទាល់ខ្លួន' : tab === 'work' ? 'ការងារ' : tab === 'education' ? 'ការអប់រំ' : tab === 'documents' ? 'ឯកសារ' : tab === 'civilServant' ? 'មន្រ្តីរាជការ' : tab === 'union' ? 'ព័ត៌មានសហព័ន្ធ' : tab === 'parents' ? 'ព័ត៌មានឪពុកម្ដាយ' : tab === 'children' ? 'ព័ត៌មានកូន' : tab === 'performance' ? 'ការវាយតម្លៃ' : tab === 'resign' ? 'លាឈប់' : 'ផ្សេងៗ'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="border px-2 py-1 rounded bg-white hover:bg-gray-50 text-xs"
                      onClick={() => setDraftVisibleFields(computeDefaultVisibleFields())}
                      disabled={fieldsSaving}
                      title="Reset to default"
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      className="border px-2 py-1 rounded bg-white hover:bg-gray-50 text-xs"
                      onClick={() => setShowDropdown(false)}
                      disabled={fieldsSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`border px-3 py-1 rounded text-xs font-semibold ${isFieldsDirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500'}`}
                      onClick={() => saveVisibleFieldsSetting(draftVisibleFields)}
                      disabled={fieldsSaving || !isFieldsDirty}
                    >
                      {fieldsSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                {fieldsError ? (
                  <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-b">
                    {fieldsError}
                  </div>
                ) : null}

                <div className="px-3 py-2">
                  {/* Select All Checkbox */}
                  <label className="flex items-center gap-2 py-1 text-sm font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftVisibleFields.filter(k => tabFields[colTab].map(f => f.key).includes(k)).length === tabFields[colTab].length}
                      onChange={e => {
                        const tabKeys = tabFields[colTab].map(f => f.key);
                        if (e.target.checked) {
                          const newFields = Array.from(new Set([...draftVisibleFields, ...tabKeys]));
                          setDraftVisibleFields(newFields);
                        } else {
                          setDraftVisibleFields(draftVisibleFields.filter(k => !tabKeys.includes(k)));
                        }
                      }}
                    />
                    ជ្រើសរើសទាំងអស់
                  </label>
                  <hr className="my-2" />
                  {tabFields[colTab].map(f => (
                    <label key={f.key} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftVisibleFields.includes(f.key)}
                        onChange={e => {
                          if (e.target.checked) setDraftVisibleFields([...draftVisibleFields, f.key]);
                          else setDraftVisibleFields(draftVisibleFields.filter(k => k !== f.key));
                        }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right-side Add button */}
        <div className="flex items-center" style={{ marginLeft: 'auto' }}>
          {perms.canEditHR && (
            <button
              type="button"
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
              onClick={openAddModal}
              style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
            >
              បន្ថែមទិន្នន័យ
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div>កំពុងទាញ...</div>
      ) : (
        <table className="min-w-full border" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr className="bg-purple-100">
              <th className="border px-1 py-1" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", width: '40px', minWidth: '40px', maxWidth: '40px', textAlign: 'center' }}>សកម្មភាព<br/>ភេទ</th>
              <th className="border px-1 py-1" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", width: '40px', minWidth: '40px', maxWidth: '40px', textAlign: 'center' }}>រូបភាព</th>
              {allFields.filter(f => visibleFields.includes(f.key) && f.key !== 'officerType').map(f => {
                // Set column widths based on field type and content - Fixed widths as requested
                let width = '80px'; // default width
                if (f.key === 'no') width = '55px';
                else if (f.key === 'khmerName') width = '90px';
                else if (f.key === 'dob') width = '50px';
                else if (f.key === 'position') width = '170px'; // wider for stacked position/department
                else if (f.key === 'skill') width = '150px';
                else if (f.key === 'joinDate') width = '50px';
                else if (f.key === 'salaryLevel') width = '60px';
                else if (f.key === 'officerType') width = '70px';
                else if (f.key === 'phone') width = '85px';
                else if (f.key === 'birthPlace') width = '200px'; // wider for stacked locations
                
                else if (f.key === 'bloodGroup') width = '50px';
                else if (f.key === 'email') width = '100px';
                else if (f.key === 'nid') width = '50px';
                
                return (
                  <th
                    key={f.key}
                    className="border px-2 py-1 cursor-pointer"
                    onClick={() => handleSort(f.key)}
                    style={{ 
                      fontSize: '12px', 
                      fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", 
                      width: width, 
                      minWidth: width, 
                      maxWidth: width,
                      textAlign: 'center'
                    }}
                  >
                    {f.key === 'skill' ? (
                      <div>
                        <div style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>{KH_LABELS.officerType || 'ប្រភេទមន្ត្រី'}</div>
                        <div style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", marginTop: '2px' }}>{f.label}</div>
                      </div>
                    ) : f.key === 'bloodGroup' ? (
                      <div>
                        <div style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>{KH_LABELS.maritalStatus || 'ស្ថានភាពគ្រួសារ'}</div>
                        <div style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", marginTop: '2px' }}>{f.label}</div>
                      </div>
                    ) : f.key === 'nominationStartDate' ? (
                      <div>
                        <div style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>{KH_LABELS.civilServantStartDate || 'ថ្ងៃចូលក្របខ័ណ្ឌ'}</div>
                        <div style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", marginTop: '2px' }}>{f.label}</div>
                      </div>
                    ) : (
                      f.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedHR.map(hr => (
              <tr
                key={hr._id}
                draggable={perms.canEditHR}
                onDragStart={e => handleDragStart(e, (hr._id || hr.id))}
                onDragOver={e => handleDragOverRow(e, (hr._id || hr.id))}
                onDrop={e => handleDropRow(e, (hr._id || hr.id))}
                onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                style={{
                  cursor: perms.canEditHR ? 'grab' : 'default',
                  background: dragOverId === (hr._id || hr.id) ? '#f0f9ff' : undefined,
                  opacity: draggingId === (hr._id || hr.id) ? 0.7 : 1
                }}
              >
                {/* Action icons with gender below */}
                <td className="border px-2 py-1 text-center" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                  <div>
                    <ActionIcons
                      hr={hr}
                      openEditModal={() => openEditModal(hr)}
                      handleDelete={() => handleDelete(hr._id)}
                      handleRestore={() => handleRestore(hr._id)}
                      openResignModal={() => openResignModal(hr._id)}
                      handleMoveUp={() => handleMoveUp(hr._id)}
                      handleMoveDown={() => handleMoveDown(hr._id)}
                      isSavingNo={noSavingId === (hr._id || hr.id)}
                    />
                    <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '2px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
                      {hr.gender === 'Male' ? 'ប្រុស' : hr.gender === 'Female' ? 'ស្រី' : hr.gender || ''}
                    </div>
                  </div>
                </td>
                <td className="border px-1 py-1 text-center" style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>
                  {hr.image ? (
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full overflow-hidden p-0 border-0 bg-transparent mx-auto flex items-center justify-center"
                      onClick={() => setReviewImage(hr.image)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img src={hr.image} alt="profile" className="w-10 h-10 object-cover rounded-full" />
                    </button>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
                      <i className="fas fa-user text-gray-400 text-xl"></i>
                    </div>
                  )}
                </td>
                {allFields.filter(f => visibleFields.includes(f.key) && f.key !== 'officerType').map(f => {
                  // Match cell widths to header widths - Fixed widths as requested
                  let width = '80px'; // default width
                  if (f.key === 'no') width = '30px';
                  else if (f.key === 'khmerName') width = '120px';
                  else if (f.key === 'dob') width = '90px';
                  else if (f.key === 'officerType') width = '80px';
                  else if (f.key === 'position') width = '150px';
                  else if (f.key === 'skill') width = '100px';
                  else if (f.key === 'joinDate') width = '90px';
                  else if (f.key === 'salaryLevel') width = '60px';
                  else if (f.key === 'phone') width = '80px';
                  else if (f.key === 'birthPlace') width = '200px';
                  
                  else if (f.key === 'bloodGroup') width = '50px';
                  else if (f.key === 'email') width = '100px';
                  else if (f.key === 'nid') width = '120px';
                  
                  return (
                    <td key={f.key} className="border px-2 py-1" style={{ 
                      fontSize: '12px', 
                      fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", 
                      width: width, 
                      minWidth: width, 
                      maxWidth: width, 
                      wordWrap: 'break-word', 
                      overflow: 'hidden',
                      textAlign: f.key === 'no' ? 'center' : 'left'
                    }}>
                      {(() => {
                      if (f.key === 'no') {
                        // Display sequence number above staff ID
                        return (
                          <div>
                            <div>{hr.no || ''}</div>
                            <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '1px' }}>
                              {hr.staffId || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'khmerName') {
                        // Display Khmer name above Latin name
                        return (
                          <div>
                            <div>{hr.khmerName || ''}</div>
                            <div style={{ fontSize: '10px', color: '#9b5403ff', marginTop: '1px', fontFamily: 'Times New Roman' }}>
                              {hr.name || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'birthPlace') {
                        // Display birthPlace above currentPlace
                        return (
                          <div>
                            <div>{hr.birthPlace || ''}</div>
                            <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '1px' }}>
                              {hr.currentPlace || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'position') {
                        // Display position above department
                        return (
                          <div>
                            <div>{hr.position || ''}</div>
                            <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '1px' }}>
                              {hr.Department_Kh || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'skill') {
                        // Display officerType above skill
                        return (
                          <div>
                            <div>{hr.officerType || ''}</div>
                            <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '1px' }}>
                              {hr.skill || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'bloodGroup') {
                        // Display maritalStatus above bloodGroup
                        return (
                          <div>
                              <div>{toKhmerMaritalStatus(hr.maritalStatus)}</div>
                            <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '1px' }}>
                              {hr.bloodGroup || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'nominationStartDate') {
                        // Display civilServantStartDate above nominationStartDate (both dates)
                        return (
                          <div>
                            <div>{formatDate(hr.civilServantStartDate) || ''}</div>
                            <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '1px' }}>
                              {formatDate(hr.nominationStartDate) || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'skill') {
                        // Display officerType above skill
                        return (
                          <div>
                            <div>{hr.officerType || ''}</div>
                            <div style={{ fontSize: '12px', color: '#9b5403ff', marginTop: '1px' }}>
                              {hr.skill || ''}
                            </div>
                          </div>
                        );
                      }
                      if (f.key === 'salaryPromotionDate') {
                        return (
                          <div>
                            <div>{formatDate(hr.salaryPromotionDate) || ''}</div>
                            <div style={{ fontSize: '11px', color: '#9b5403ff', marginTop: '4px' }}>{hr.salaryPromotionBy || ''}</div>
                          </div>
                        );
                      }
                      if (f.key === 'resignDocument') {
                        if (!hr.resignDocument) return '';
                        const doc = hr.resignDocument;
                        const isData = typeof doc === 'string' && doc.startsWith('data:');
                        if (isData) {
                          return (
                            <button onClick={() => openDataUrl(doc)} type="button" className="text-blue-600 underline text-sm bg-transparent border-0 p-0">មើលឯកសារ</button>
                          );
                        }
                        return (
                          <a href={doc} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">មើលឯកសារ</a>
                        );
                      }
                      if (dateKeys.includes(f.key)) return formatDate(hr[f.key]);
                      if (f.key === 'gender') {
                        return hr.gender === 'Male' ? 'ប្រុស' : hr.gender === 'Female' ? 'ស្រី' : hr.gender;
                      }
                      
                      return hr[f.key];
                    })()}
                  </td>
                  );
                })}
              </tr>
            ))}
            {pagedHR.length === 0 && (
              <tr>
                <td colSpan={visibleFields.length + 2} className="py-6 text-center text-gray-500" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
                  មិនមានបុគ្គលិក HR
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {/* Pagination */}
      <div className="flex justify-center items-center mt-4 gap-2">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className={`px-3 py-1 border rounded ${page === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white'}`}
          style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
        >Prev</button>
        <span className="px-4 py-1 rounded bg-blue-600 text-white font-bold" style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>ទំព័រ {page} / {totalPages}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page === totalPages}
          className={`px-3 py-1 border rounded ${page === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white'}`}
          style={{ fontSize: '12px', fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
        >Next</button>
      </div>
      {/* Modal Add & Edit moved to StaftPage */}
      <StaftPage
        showAddModal={showAddModal}
        showEditModal={showEditModal}
        newHR={newHR}
        editHR={editHR}
        setNewHR={setNewHR}
        setEditHR={setEditHR}
        handleAdd={handleAdd}
        handleUpdate={handleUpdate}
        closeAddModal={closeAddModal}
        closeEditModal={closeEditModal}
      />
      {reviewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 flex flex-col items-center">
            <h3 className="text-lg font-bold mb-2 text-blue-700">មើលរូបភាព</h3>
            <img src={reviewImage} alt="Review" className="w-80 h-80 object-contain rounded mb-4" />
            <button
              className="bg-red-600 text-white px-4 py-2 rounded"
              onClick={() => setReviewImage(null)}
            >
              បិទ
            </button>
          </div>
        </div>
      )}
      {/* Resign modal */}
      {showResignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>លាលែងការងារ</h3>
              <button onClick={closeResignModal} className="text-gray-600">✕</button>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>កាលបរិច្ឆេទលាលែង</label>
              <input 
                type="date" 
                value={resignDate} 
                onChange={e => setResignDate(e.target.value)} 
                className="w-full border rounded px-2 py-1" 
                style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>មូលហេតុ *</label>
              <textarea 
                value={resignReason} 
                onChange={e => setResignReason(e.target.value)} 
                className="w-full border rounded px-2 py-1 h-20" 
                placeholder="បញ្ចូលមូលហេតុលាលែងការងារ..."
                style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>បញ្ចូលឯកសារ</label>
              <input 
                type="file" 
                onChange={handleResignDocumentUpload} 
                className="w-full border rounded px-2 py-1" 
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              />
              {resignDocument && (
                <div className="mt-2 text-xs text-green-600" style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}>
                  ឯកសារត្រូវបានបញ្ចូលហើយ ✓
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={closeResignModal} 
                className="px-4 py-2 border rounded"
                style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              >
                បោះបង់
              </button>
              <button 
                onClick={handleResign} 
                className="px-4 py-2 bg-yellow-600 text-white rounded"
                style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" }}
              >
                លាលែង
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionIcons({ hr, openEditModal, handleDelete, handleRestore, openResignModal, handleMoveUp, handleMoveDown, isSavingNo }) {
  const perms = usePermission();
  // Generate Word (.doc) file from staff info
  function generateWord(hr) {
    const khLabels = {
      no: 'ល.រ', staffId: 'លេខកាត', khmerName: 'គោត្តនាម និងនាម', name: 'ឡាតាំង', gender: 'ភេទ', dob: 'ថ្ងៃកំណើត', maritalStatus: 'ស្ថានភាពគ្រួសារ', bloodGroup: 'ក្រុមឈាម', phone: 'ទូរស័ព្ទ', email: 'អ៊ីមែល', birthPlace: 'ទីកន្លែងកំណើត', currentPlace: 'ទីកន្លែងបច្ចុប្បន្ន', officerType: 'ប្រភេទមន្ត្រី', position: 'តួនាទី', skill: 'ជំនាញ', Department_Kh: 'ផ្នែក', joinDate: 'កាលបរិច្ឆេទចូលបម្រើការងារ', dateJoinedMinistry: 'កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរ', lastSalaryIncrementDate: 'កាលបរិច្ឆេទបញ្ចប់តំណែង', workOther: 'ផ្សេងៗការងារ', degreeLevel: 'កម្រិតសញ្ញាប័ត្រ', degree: 'សញ្ញាប័ត្រ', educationLevel: 'កម្រិតវប្បធម៌', officerId: 'លេខមន្ត្រី', cardNumber: 'លេខបសស', nid: 'លេខអត្តសញ្ញាណ', bankAccount: 'លេខគណនីធនាគារ', civilServantId: 'លេខមន្ត្រីរាជការ', yearsInCurrentRank: 'ឆ្នាំក្នុងថ្នាក់បច្ចុប្បន្ន', rankExitReason: 'មូលហេតុចាកចេញពីថ្នាក់', rankExitDuration: 'រយៈពេលចាកចេញ', grade: 'ថ្នាក់', proposedBy: 'ស្នើដោយ', yearsInRank: 'ឆ្នាំក្នុងថ្នាក់', totalYearsWorked: 'ចំនួនឆ្នាំធ្វើការ', asOfDate: 'ថ្ងៃបច្ចុប្បន្ន', salaryLevel: 'កាំប្រាក់', mentorName: 'ឈ្មោះអ្នកណែនាំ', mentorDate: 'ថ្ងៃណែនាំ', creativityScore: 'ពិន្ទុសិល្បៈ', responsibilityScore: 'ពិន្ទុទទួលខុសត្រូវ', patriotismScore: 'ពិន្ទុស្មោះត្រង់', leadershipScore: 'ពិន្ទុភាពជាអ្នកដឹកនាំ', ethicsScore: 'ពិន្ទុសីលធម៌', totalScore: 'ពិន្ទុសរុប', reason1: 'មូលហេតុ១', reason2: 'មូលហេតុ២', reason3: 'មូលហេតុ៣', reason4: 'មូលហេតុ៤', reason5: 'មូលហេតុ៥', reason6: 'មូលហេតុ៦', image: 'រូបភាព', other: 'ផ្សេងៗ', status: 'ស្ថានភាព'
    };
    const rows = Object.keys(hr)
      .filter(key => key !== '_id' && key !== '__v')
      .map(key => `<tr><td style='border:1px solid #bfcfff;padding:8px 12px;font-weight:bold;background:#f6f8ff;color:#1a237e;width:40%'>${khLabels[key] || key}</td><td style='border:1px solid #bfcfff;padding:8px 12px;color:#222'>${typeof hr[key] === 'object' && hr[key] !== null ? JSON.stringify(hr[key], null, 2) : hr[key]}</td></tr>`)
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'><title>ព័ត៌មានបុគ្គលិក</title></head><body style="font-family:'Khmer OS Siemreap','Noto Sans Khmer',Arial,sans-serif;color:#222;">
      <h2 style='text-align:center;color:#1565c0;font-size:22px;font-weight:bold;margin-bottom:24px;'>ព័ត៌មានបុគ្គលិក</h2>
      <table style='width:100%;border-collapse:collapse;font-size:16px;margin-bottom:24px;'>${rows}</table>
      <div style='display:flex;justify-content:space-between;margin-top:32px;font-size:12px;color:#888;'>
        <span>បង្កើតដោយ HR System</span>
        <span>${new Date().toLocaleDateString('km-KH',{year:'numeric',month:'2-digit',day:'2-digit'})}</span>
      </div>
    </body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Staff-${hr.staffId || hr.khmerName || 'report'}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const [showIcons, setShowIcons] = React.useState(false);
  const [isNewBadge, setIsNewBadge] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [showView, setShowView] = React.useState(false);
  const [showIdCard, setShowIdCard] = React.useState(false);
  const [cardMode, setCardMode] = React.useState('view'); // 'view' | 'create' | 'edit'
  const [cardData, setCardData] = React.useState({});
  const iconsRef = React.useRef(null);
  const [reportHR, setReportHR] = React.useState(null);

  // Hide action icons when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (iconsRef.current && !iconsRef.current.contains(event.target)) {
        setShowIcons(false);
      }
    }
    if (showIcons) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIcons]);

  // compute "new" badge using stored lastSeen for letters/documents keyed by id
  React.useEffect(() => {
    try {
      const id = hr && (hr._id || hr.id);
      if (!id) return;
      const ts = (hr && (hr.updatedAt || hr.createdAt)) ? new Date(hr.updatedAt || hr.createdAt).getTime() : 0;
      const seenKey = `lastSeenLetter_${id}`;
      const seen = Number(localStorage.getItem(seenKey) || '0');
      setIsNewBadge(ts > 0 && ts > seen);
    } catch (e) {
      // ignore
    }
  }, [hr && (hr.updatedAt || hr.createdAt)]);

  // Generate a simple MS Word (.doc) file from HR data (HTML inside .doc)
  async function viewAsWord(hrData) {
    

    // Helper: convert image URL/Response to data URI (base64). Returns null on failure.
    async function toDataUrl(url) {
      try {
        if (!url) return null;
        if (typeof url === 'string' && url.startsWith('data:')) return url;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.error('toDataUrl error', err);
        return null;
      }
    }

    // We'll attempt both image and logo in parallel but never let failures stop preview update.
    let imgData = null;
    let logoData = null;
    let errors = [];

    try {
      const imgPromise = (async () => {
        if (!hrData.image) return null;
        if (typeof hrData.image === 'string' && hrData.image.startsWith('data:')) return hrData.image;
        return await toDataUrl(hrData.image);
      })();
      const logoUrl = (window && window.__ORG_LOGO__) || hrData.orgLogo || null;
      const logoPromise = (async () => {
        if (!logoUrl) return null;
        if (typeof logoUrl === 'string' && logoUrl.startsWith('data:')) return logoUrl;
        return await toDataUrl(logoUrl);
      })();

      const results = await Promise.allSettled([imgPromise, logoPromise]);
      if (results[0].status === 'fulfilled') imgData = results[0].value;
      else errors.push(results[0].reason || 'image fetch failed');
      if (results[1].status === 'fulfilled') logoData = results[1].value;
      else errors.push(results[1].reason || 'logo fetch failed');
    } catch (err) {
      console.error('parallel fetch error', err);
      errors.push(err.toString());
    }

    // Build tags
    let imgTag = '';
    if (imgData) imgTag = `<div style="text-align:right; margin-bottom:8px"><img src="${imgData}" style="max-width:120px; max-height:140px; object-fit:cover; border:1px solid #ccc;"/></div>`;
    else if (hrData.image && typeof hrData.image === 'string') imgTag = `<div style="text-align:right; margin-bottom:8px"><img src="${hrData.image}" style="max-width:120px; max-height:140px; object-fit:cover; border:1px solid #ccc;"/></div>`;

    let logoTag = '';
    const logoUrlUsed = (window && window.__ORG_LOGO__) || hrData.orgLogo || null;
    if (logoData) logoTag = `<img src="${logoData}" style="max-width:90px; max-height:90px; object-fit:contain;"/>`;
    else if (logoUrlUsed) logoTag = `<img src="${logoUrlUsed}" style="max-width:90px; max-height:90px; object-fit:contain;"/>`;

  }

  // Khmer labels for allFields
  const khLabels = {
    no: 'ល.រ', staffId: 'លេខកាត', khmerName: 'គោត្តនាម និងនាម', name: 'ឡាតាំង', gender: 'ភេទ', dob: 'ថ្ងៃកំណើត', maritalStatus: 'ស្ថានភាពគ្រួសារ', bloodGroup: 'ក្រុមឈាម', phone: 'ទូរស័ព្ទ', email: 'អ៊ីមែល', birthPlace: 'ទីកន្លែងកំណើត', currentPlace: 'ទីកន្លែងបច្ចុប្បន្ន', officerType: 'ប្រភេទមន្ត្រី', position: 'តួនាទី', skill: 'ជំនាញ', Department_Kh: 'ផ្នែក', joinDate: 'កាលបរិច្ឆេទចូលបម្រើការងារ', dateJoinedMinistry: 'កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរ', lastSalaryIncrementDate: 'កាលបរិច្ឆេទបញ្ចប់តំណែង', workOther: 'ផ្សេងៗការងារ', degreeLevel: 'កម្រិតសញ្ញាប័ត្រ', degree: 'សញ្ញាប័ត្រ', educationLevel: 'កម្រិតវប្បធម៌', officerId: 'លេខមន្ត្រី', cardNumber: 'លេខបសស', nid: 'លេខអត្តសញ្ញាណ', bankAccount: 'លេខគណនីធនាគារ', civilServantId: 'លេខមន្ត្រីរាជការ', dateJoinedGov: 'ថ្ងៃចូលក្របខ័ណ្ឌ', yearsInCurrentRank: 'ឆ្នាំក្នុងថ្នាក់បច្ចុប្បន្ន', rankExitReason: 'មូលហេតុចាកចេញពីថ្នាក់', rankExitDuration: 'រយៈពេលចាកចេញ', grade: 'ថ្នាក់', proposedBy: 'ស្នើដោយ', yearsInRank: 'ឆ្នាំក្នុងថ្នាក់', totalYearsWorked: 'ចំនួនឆ្នាំធ្វើការ', asOfDate: 'ថ្ងៃបច្ចុប្បន្ន', salaryLevel: 'កាំប្រាក់', mentorName: 'ឈ្មោះអ្នកណែនាំ', mentorDate: 'ថ្ងៃណែនាំ', creativityScore: 'ពិន្ទុសិល្បៈ', responsibilityScore: 'ពិន្ទុទទួលខុសត្រូវ', patriotismScore: 'ពិន្ទុស្មោះត្រង់', leadershipScore: 'ពិន្ទុភាពជាអ្នកដឹកនាំ', ethicsScore: 'ពិន្ទុសីលធម៌', totalScore: 'ពិន្ទុសរុប', reason1: 'មូលហេតុ១', reason2: 'មូលហេតុ២', reason3: 'មូលហេតុ៣', reason4: 'មូលហេតុ៤', reason5: 'មូលហេតុ៥', reason6: 'មូលហេតុ៦', image: 'រូបភាព', other: 'ផ្សេងៗ', status: 'ស្ថានភាព'
  };
  return (
    <div className="flex flex-col items-center relative" ref={iconsRef}>
      <button
        className="w-6 h-6 bg-green-800 rounded flex items-center justify-center focus:outline-none border border-green-700 shadow"
        onClick={() => {
          // mark as seen when opening the popover so badge clears reliably
          try {
            const id = hr && (hr._id || hr.id);
            if (id) {
              const ts = (hr && (hr.updatedAt || hr.createdAt)) ? new Date(hr.updatedAt || hr.createdAt).getTime() : Date.now();
              localStorage.setItem(`lastSeenLetter_${id}`, String(ts));
              setIsNewBadge(false);
            }
          } catch (e) {}
          setShowIcons(v => !v);
        }}
        title="Show Actions"
      >
        {/* Main grid icon */}
        <span className="w-4 h-4 flex items-center justify-center">
          <svg width="15" height="15" fill="white"><rect x="2" y="2" width="4" height="4"/><rect x="10" y="2" width="4" height="4"/><rect x="2" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/></svg>
        </span>
      </button>
      {isNewBadge && (
        <span title="ថ្មី" style={{ position: 'absolute', top: -8, right: -8, display: 'inline-block' }}>
          <span style={{
            display: 'inline-block',
            background: '#e11d48',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: '0 0 0 rgba(225,29,72,0.7)',
            animation: 'pulseBadgeHR 0.9s infinite'
          }}>កែ</span>
          <style>{`@keyframes pulseBadgeHR { 0% { box-shadow: 0 0 0 0 rgba(225,29,72,0.6); } 70% { box-shadow: 0 0 0 8px rgba(225,29,72,0); } 100% { box-shadow: 0 0 0 0 rgba(225,29,72,0); } }`}</style>
        </span>
      )}
      {showIcons && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 flex gap-1 px-1 py-1 rounded shadow-lg bg-white border z-20"
          style={{
            minWidth: 'max-content',
            maxWidth: '200px',
            width: '200px',
            marginLeft: '1px'
          }}
        >
          {/* Move up/down + View, Report, Edit, Profile, Delete, Team */}
          {perms.canEditHR && (
            <div className="flex flex-col items-center gap-1 mr-1">
              <button title="Move up" onClick={() => handleMoveUp && handleMoveUp()} className="w-2 h-2 bg-white rounded flex items-center justify-center border text-gray-700" disabled={isSavingNo}>
                ▲
              </button>
              <button title="Move down" onClick={() => handleMoveDown && handleMoveDown()} className="w-2 h-2 bg-white rounded flex items-center justify-center border text-gray-700" disabled={isSavingNo}>
                ▼
              </button>
            </div>
          )}
          <button title="View" onClick={() => setShowView(true)} className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-700 text-white">
            <MdVisibility className="w-4 h-4" />
          </button>
          {perms.canPrintHR && (
          <button title="Report" onClick={() => { setReportHR(hr); setShowReport(true); }} className="w-6 h-6 flex items-center justify-center rounded bg-orange-500 hover:bg-orange-600 text-white">
            <MdDescription className="w-4 h-4" />
          </button>
          )}
          {perms.canEditHR && (
          <button title="Edit" onClick={openEditModal} className="w-6 h-6 flex items-center justify-center rounded bg-green-600 hover:bg-green-700 text-white">
            <MdEdit className="w-4 h-4" />
          </button>
          )}
          <button title="Profile" className="w-6 h-6 flex items-center justify-center rounded bg-gray-500 hover:bg-gray-600 text-white">
            <MdPerson className="w-4 h-4" />
          </button>
          <button title="ID Card" onClick={() => { 
            setCardData(hr); 
            setCardMode('view'); 
            setShowIdCard(true); 
          }} className="w-6 h-6 flex items-center justify-center rounded bg-purple-600 hover:bg-purple-700 text-white">
            <MdCreditCard className="w-4 h-4" />
          </button>
          {perms.canEditHR && hr && (hr.status === 'Deleted' || hr.status === 'Resigned') ? (
            <button title="Restore" onClick={handleRestore} className="w-6 h-6 flex items-center justify-center rounded bg-yellow-500 hover:bg-yellow-600 text-white">
              {/* reuse MdAssignmentInd as a restore-style icon */}
              <MdAssignmentInd className="w-4 h-4" />
            </button>
          ) : (perms.canEditHR && (
            <button title="Delete" onClick={handleDelete} className="w-6 h-6 flex items-center justify-center rounded bg-red-600 hover:bg-red-700 text-white">
              <MdDelete className="w-4 h-4" />
            </button>
          ))}
          {/* Show Resign for Active records */}
          {perms.canEditHR && hr && hr.status === 'Active' && (
            <button title="Resign" onClick={openResignModal} className="w-6 h-6 flex items-center justify-center rounded bg-yellow-600 hover:bg-yellow-700 text-white">
              <MdExitToApp className="w-4 h-4" />
            </button>
          )}
          <button title="Team" className="w-6 h-6 flex items-center justify-center rounded bg-green-500 hover:bg-green-600 text-white">
            <MdGroup className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Modal for staff view (all fields in Khmer) */}
      {showView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-8 min-w-[800px] max-w-[95vw] max-h-[95vh] overflow-auto" style={{fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', Arial, sans-serif", width: '800px'}}>
            {/* Header */}
            <div style={{textAlign:'center', marginBottom:'8px'}}>
              <div style={{fontWeight:'bold', fontSize:'20px'}}>ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div style={{fontWeight:'bold', fontSize:'16px'}}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
              <div style={{borderBottom:'2px solid #222', width:'120px', margin:'8px auto 0'}}></div>
            </div>
            <div style={{textAlign:'center', fontWeight:'bold', fontSize:'18px', margin:'16px 0 8px'}}>លិខិតបញ្ជាក់ព័ត៌មានបុគ្គលិក</div>
            <div style={{textAlign:'center', fontWeight:'bold', fontSize:'16px', marginBottom:'24px'}}>សម្រាប់បុគ្គលិកអង្គភាព/ក្រុមហ៊ុន/ស្ថាប័ន</div>
            {/* Main info row */}
            <div style={{display:'flex', flexDirection:'row', alignItems:'flex-start', marginBottom:'16px'}}>
              {/* Info table */}
              <div style={{flex:'1 1 0%', paddingRight:'24px'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'15px'}}>
                  <tbody>
                    <tr>
                      <td style={{padding:'4px 0', fontWeight:'bold', width:'120px'}}>ឈ្មោះ</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.khmerName || ''}</td>
                      <td style={{padding:'4px 0', fontWeight:'bold', width:'60px'}}>ភេទ</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.gender === 'Male' ? 'ប្រុស' : hr.gender === 'Female' ? 'ស្រី' : hr.gender || ''}</td>
                    </tr>
                    <tr>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>ថ្ងៃ ខែ ឆ្នាំ កំណើត</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.dob || ''}</td>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>លេខកាត</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.staffId || ''}</td>
                    </tr>
                    <tr>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>ទីកន្លែងកំណើត</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.birthPlace || ''}</td>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>តួនាទី</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.position || ''}</td>
                    </tr>
                    <tr>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>ផ្នែក</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.Department_Kh || ''}</td>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>ទូរស័ព្ទ</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.phone || ''}</td>
                    </tr>
                    <tr>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>អ៊ីមែល</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.email || ''}</td>
                      <td style={{padding:'4px 0', fontWeight:'bold'}}>ស្ថានភាព</td>
                      <td style={{padding:'4px 0'}}>៖ {hr.status || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Photo box */}
              <div style={{width:'140px', height:'160px', border:'1px solid #888', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'12px', fontSize:'18px', color:'#888', background:'#fafbfc'}}>
                {hr.image ? (
                  <img src={hr.image} alt="profile" style={{maxWidth:'100%', maxHeight:'100%', objectFit:'cover'}} />
                ) : (
                  <span>dx b</span>
                )}
              </div>
            </div>
            {/* Footer/notes */}
            <div style={{marginTop:'32px', fontSize:'15px', color:'#222', minHeight:'40px'}}>
              <div>កិច្ចការផ្សេងៗ៖ ...............................................................</div>
              <div>...............................................................</div>
            </div>
            <div style={{marginTop:'32px', fontSize:'13px', color:'#444', textAlign:'left'}}>
              <div>សូមអនុញ្ញាតឲ្យប្រើប្រាស់ព័ត៌មានខាងលើសម្រាប់បំពេញកិច្ចការផ្សេងៗតាមតម្រូវការរបស់អង្គភាព/ក្រុមហ៊ុន/ស្ថាប័ន។</div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full" onClick={() => setShowView(false)}>បិទ</button>
              <button className="bg-green-600 text-white px-4 py-2 rounded w-full" onClick={() => generateWord(hr)}>បង្កើត Word</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal for staff report using HRReportView */}
      {showReport && reportHR && (
  <HRReportView hr={reportHR} onClose={() => { setShowReport(false); setReportHR(null); }} isApprover={perms.canApproveHR} />
      )}
      
      {/* ID Card Management Modal */}
      {showIdCard && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                គ្រប់គ្រងកាតសម្គាល់បុគ្គលិក
              </h3>
              <div className="flex gap-2">
                {cardMode === 'view' && (
                  <button 
                    onClick={() => setCardMode('create')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
                    style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                  >
                    បង្កើតកាតថ្មី
                  </button>
                )}
                {cardMode === 'view' && (
                  <button 
                    onClick={() => setCardMode('edit')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                    style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                  >
                    កែប្រែកាត
                  </button>
                )}
                <button 
                  onClick={() => { setShowIdCard(false); setCardMode('view'); }} 
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Mode Display */}
            <div className="mb-4">
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded text-sm ${cardMode === 'view' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                  មើលកាត
                </span>
                <span className={`px-3 py-1 rounded text-sm ${cardMode === 'create' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  បង្កើតថ្មី
                </span>
                <span className={`px-3 py-1 rounded text-sm ${cardMode === 'edit' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                  កែប្រែ
                </span>
              </div>
            </div>

            {cardMode === 'view' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Front Side */}
                <div className="relative">
                  <h4 className="text-lg font-semibold mb-3 text-center text-blue-600" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                    ផ្ទៃមុខ
                  </h4>
                  <div 
                    className="w-full border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg relative"
                    style={{ 
                      aspectRatio: '1.6/1', 
                      backgroundColor: '#ffffff',
                      backgroundImage: 'url("./Uploads/IDCADEA.jpg?v=' + Date.now() + '"), linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      filter: 'brightness(1) contrast(1)',
                      '--tw-brightness': 'brightness(1)'
                    }}
                  >
                    <div className="bg-white px-4 py-2 text-center border-b-4 border-green-500">
                      <div className="flex items-center justify-between gap-2">
                        {/* MOH Logo on left */}
                        <div className="w-12 h-12 flex items-center justify-center">
                          <img 
                            src="./Uploads/MOH_logo.png" 
                            alt="MOH Logo" 
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                        
                        {/* Center content */}
                        <div className="flex-1">
                      
                          <h5 className="text-sm font-NORMAL text-blue-900" style={{ fontFamily: "'Khmer OS MUOL LIGHT', sans-serif", marginTop: '2px', fontSize: '16px' }}>
                            មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត
                          </h5>
                          <p className="text-xs text-blue-900" style={{ fontFamily: "'Khmer OS MUOL LIGHT', sans-serif", marginTop: '2px', fontSize: '15px' }}>
                            បណ្ណសំគាល់បុគ្គលិក
                          </p>
                        </div>

                        {/* KSFH Logo on right */}
                        <div className="w-19 h-19 flex items-center justify-center">
                          <img 
                            src="./Uploads/Logo_KSFH-Short.png" 
                            alt="KSFH Logo" 
                            className="w-14 h-14 object-contain"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Overlay for better text readability */}
                    <div className="absolute inset-0 bg-black bg-opacity-10 rounded-lg"></div>
                    
                    <div className="relative p-4 text-white">
                      <div className="flex gap-4">
                        <div className="w-20 h-24 bg-gray-200 rounded border-2 border-white overflow-hidden">
                          {cardData.image ? (
                            <img src={cardData.image} alt="Staff" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                              <span className="text-gray-500 text-xs">រូបភាព</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-1">
                          <div>
                            <span className="text-xs opacity-80">នាមត្រកូល និង នាម:</span>
                            <p className="font-semibold" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                              {cardData.khmerName || 'មិនមាន'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs opacity-80">បុគ្គលិកលេខ:</span>
                            <p className="font-bold text-lg text-yellow-300">{cardData.nid || cardData.staffId || '0000000000'}</p>
                          </div>
                          <div>
                            <span className="text-xs opacity-80">បុគ្គលិកលេខកូដ:</span>
                            <p className="font-semibold">{cardData.staffId || 'D0000'}</p>
                          </div>
                          <div>
                            <span className="text-xs opacity-80">មុខតំណែង:</span>
                            <p className="font-semibold" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                              {cardData.position || 'មិនបានបញ្ជាក់'}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 bg-red-600 text-white px-3 py-1 rounded-full text-center">
                        <span className="text-sm font-bold" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                          ផ្នែកការងារ: {cardData.Department_Kh || 'មិនបានបញ្ជាក់'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Back Side */}
                <div className="relative">
                  <h4 className="text-lg font-semibold mb-3 text-center text-blue-600" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                    ផ្ទៃក្រោយ
                  </h4>
                  <div 
                    className="w-full border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg relative"
                    style={{ 
                      aspectRatio: '1.6/1',
                      backgroundColor: '#ffffff',
                      backgroundImage: 'url(/Uploads/IDCADEB.jpg)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}
                  >
                    {/* Header with logos */}
                    <div className="bg-white px-9 py-2 text-center border-b-2 border-blue-500">
                      <div className="flex items-center justify-between">
                        {/* MOH Logo on left */}
                        <div className="w-15 h-15 flex items-center justify-center">
                          <img 
                            src="./Uploads/MOH_logo.png" 
                            alt="MOH Logo" 
                            className="w-14 h-14 object-contain"
                          />
                        </div>
                        
                       

                        {/* KSFH Logo on right */}
                        <div className="w-8 h-8 flex items-center justify-center">
                          <img 
                            src="./Uploads/Logo_KSFH-Short.png" 
                            alt="KSFH Logo" 
                            className="w-6 h-6 object-contain"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Content overlay matching the image design */}
                    <div className="absolute inset-0 flex flex-col" style={{ top: '60px' }}>
                      {/* Top spacing */}
                      <div className="flex-1"></div>
                      
                      {/* Main content area */}
                      <div className="flex items-center justify-between px-4 pb-4">
                        {/* QR Code on left */}
                        <div className="w-20 h-20 bg-black flex items-center justify-center">
                          <div className="w-16 h-16 bg-white flex items-center justify-center text-xs font-bold">
                            QR
                          </div>
                        </div>
                        
                        {/* Center content */}
                        <div className="flex-1 text-center mx-4">
                          <h3 className="text-xl font-bold text-blue-800 mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                            {cardData.name || cardData.khmerName || 'KIET SOPHEN'}
                          </h3>
                        </div>
                        

                      </div>
                      
                      {/* Bottom section */}
                      <div className="flex justify-between items-end px-4 pb-2">
                        {/* Expiry date */}
                        <div className="text-left">
                          <p className="text-blue-800 font-bold text-sm">EXP: 31-12-2025</p>
                        </div>
                        
                        {/* Department */}
                        <div className="text-right">
                          <p className="text-blue-800 font-bold text-sm" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                            {cardData.Department_KH || 'Unknown Department'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(cardMode === 'create' || cardMode === 'edit') && (
              <div className="space-y-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                  <p className="text-yellow-800" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                    {cardMode === 'create' ? 'បង្កើតកាតសម្គាល់បុគ្គលិកថ្មី' : 'កែប្រែព័ត៌មានកាតសម្គាល់បុគ្គលិក'}
                  </p>
                </div>
                
                {/* Card Data Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      គោត្តនាម និងនាម (ខ្មែរ)
                    </label>
                    <input
                      type="text"
                      value={cardData.khmerName || ''}
                      onChange={(e) => setCardData({...cardData, khmerName: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      ឈ្មោះ (ឡាតាំង)
                    </label>
                    <input
                      type="text"
                      value={cardData.name || ''}
                      onChange={(e) => setCardData({...cardData, name: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      លេខបុគ្គលិក
                    </label>
                    <input
                      type="text"
                      value={cardData.staffId || ''}
                      onChange={(e) => setCardData({...cardData, staffId: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      លេខអត្តសញ្ញាណ
                    </label>
                    <input
                      type="text"
                      value={cardData.nid || ''}
                      onChange={(e) => setCardData({...cardData, nid: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      តួនាទី
                    </label>
                    <input
                      type="text"
                      value={cardData.position || ''}
                      onChange={(e) => setCardData({...cardData, position: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      ផ្នែកការងារ
                    </label>
                    <input
                      type="text"
                      value={cardData.Department_Kh || ''}
                      onChange={(e) => setCardData({...cardData, Department_Kh: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      ទូរស័ព្ទ
                    </label>
                    <input
                      type="text"
                      value={cardData.phone || ''}
                      onChange={(e) => setCardData({...cardData, phone: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}>
                      អ៊ីមែល
                    </label>
                    <input
                      type="email"
                      value={cardData.email || ''}
                      onChange={(e) => setCardData({...cardData, email: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                
                {/* Preview Button */}
                <div className="flex justify-center">
                  <button 
                    onClick={() => setCardMode('view')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                    style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                  >
                    មើលកាតមុនបោះពុម្ព
                  </button>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 justify-center">
              {cardMode === 'view' && (
                <button 
                  onClick={() => window.print()} 
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
                  style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                >
                  បោះពុម្ព
                </button>
              )}
              {(cardMode === 'create' || cardMode === 'edit') && (
                <button 
                  onClick={() => {
                    // Save card data logic here
                    alert('រក្សាទុកទិន្នន័យកាតបានជោគជ័យ!');
                    setCardMode('view');
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
                  style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
                >
                  រក្សាទុក
                </button>
              )}
              <button 
                onClick={() => { setShowIdCard(false); setCardMode('view'); }} 
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium"
                style={{ fontFamily: "'Khmer OS Siemreap', sans-serif" }}
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
