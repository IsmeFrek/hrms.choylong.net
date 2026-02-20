import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import api from '../services/api';
import { departmentAPI } from '../services/departmentAPI';
import { positionAPI } from '../services/positionAPI';
import { skillAPI } from '../services/skillAPI';
import PersonalTab from './tabs/PersonalTab';
import WorkTab from './tabs/WorkTab';
import EducationTab from './tabs/EducationTab';
import DocumentsTab from './tabs/DocumentsTab';
import CivilServantTab from './tabs/CivilServantTab';
import UnionTab from './tabs/UnionTab';
import ParentTab from './tabs/ParentTab';
import ChildrenTab from './tabs/ChildrenTab';
import OtherTab from './tabs/OtherTab';
// Export/import buttons removed — toolbar simplified per UI request
import PerformanceTab from './tabs/PerformanceTab';

export default function StaftPage({
  showAddModal,
  showEditModal,
  newHR,
  editHR,
  setNewHR,
  setEditHR,
  closeAddModal,
  closeEditModal
}) {
  const [activeTab, setActiveTab] = useState('personal');
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [skills, setSkills] = useState([]);
  const [noOptions, setNoOptions] = useState([]);
  const [takenNos, setTakenNos] = useState([]);
  // បន្ថែមការជ្រើសរើស fields export/import
  const [selectedFields, setSelectedFields] = useState([]);
  const [allFields, setAllFields] = useState([]);
  const [showFieldPanel, setShowFieldPanel] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [educationList, setEducationList] = useState([]);

  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      try {
        const [depsRes, posRes, skillsRes] = await Promise.all([
          departmentAPI.getDepartments(),
          positionAPI.getPositions(),
          skillAPI.getSkills(),
        ]);
        if (!mounted) return;
        setDepartments(Array.isArray(depsRes?.data) ? depsRes.data : (depsRes || []));
        setPositions(Array.isArray(posRes?.data) ? posRes.data : (posRes || []));
        setSkills(Array.isArray(skillsRes?.data) ? skillsRes.data : (skillsRes || []));
      } catch (e) {
        console.error('Failed loading meta (departments/positions/skills):', e?.response?.data || e?.message);
        if (!mounted) return;
        setDepartments([]);
        setPositions([]);
        setSkills([]);
      }

      // Fetch all HRs for fields and to compute noOptions (1..N+1)
      try {
        const res = await api.get('/hr');
        const hrList = Array.isArray(res?.data) ? res.data : [];
        if (!mounted) return;
        if (hrList.length > 0) {
          setAllFields(Object.keys(hrList[0]));
          setSelectedFields(Object.keys(hrList[0])); // Default: select all
        }
  const nos = hrList
          .map(h => Number(h.no))
          .filter(n => Number.isFinite(n) && n > 0);
        const maxNo = nos.length ? Math.max(...nos) : 0;
        const opts = Array.from({ length: maxNo + 1 }, (_, i) => i + 1);
        setNoOptions(opts);
  setTakenNos([...new Set(nos)]);
      } catch {/* ignore */}
    };
    loadMeta();
    return () => { mounted = false; };
  }, []);

  // Refresh number options when opening add/edit modal
  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const res = await api.get('/hr');
        const hrList = Array.isArray(res?.data) ? res.data : [];
        if (!alive) return;
  const nos = hrList
          .map(h => Number(h.no))
          .filter(n => Number.isFinite(n) && n > 0);
        const maxNo = nos.length ? Math.max(...nos) : 0;
        const opts = Array.from({ length: maxNo + 1 }, (_, i) => i + 1);
        setNoOptions(opts);
  setTakenNos([...new Set(nos)]);
      } catch {/* ignore */}
    }
    if (showAddModal || showEditModal) refresh();
    return () => { alive = false; };
  }, [showAddModal, showEditModal]);

  const tabList = [
    { key: 'personal', label: 'ព័ត៌មានផ្ទាល់ខ្លួន' },
    { key: 'work', label: 'ព័ត៌មានការងារ' },
    { key: 'education', label: 'ការអប់រំ' },
    { key: 'documents', label: 'ឯកសារ' },
    { key: 'civilservant', label: 'មន្ត្រីរាជការ' },
    { key: 'union', label: 'ព័ត៌មានសហព័ន្ធ' },
    { key: 'parent', label: 'ព័ត៌មានឪពុកម្ដាយ' },
    { key: 'children', label: 'ព័ត៌មានកូន' },
    { key: 'other', label: 'ព័ត៌មានផ្សេងៗ' },
    { key: 'performance', label: 'ការវាយតម្លៃ' } // Re-added Performance tab
  ];

  // Add a helper to check required fields and mark them with *
  const requiredFields = ['staffId', 'khmerName', 'name', 'gender', 'dob', 'maritalStatus', 'bloodGroup'];

  function isRequiredInvalid(data, key) {
    return requiredFields.includes(key) && (!data[key] || data[key].trim() === '');
  }

  // Add this helper to check required fields for education tab
  function isEducationValid(list) {
    if (!Array.isArray(list) || list.length === 0) return false;
    for (const edu of list) {
      if (!edu.degreeLevel || !edu.skill || !edu.startDate || !edu.endDate || !edu.institution) {
        return false;
      }
    }
    return true;
  }

  // Helper to render fields for Add/Edit
  const renderFields = (data, setData, isEdit = false) => {
    switch (activeTab) {
      case 'personal':
  return <PersonalTab data={data} setData={setData} isRequiredInvalid={isRequiredInvalid} noOptions={noOptions} takenNos={takenNos} />;
      case 'work':
        return <WorkTab data={data} setData={setData} positions={positions} skills={skills} departments={departments} />;
      case 'parent':
        return <ParentTab editHR={data} setEditHR={setData} />;
      case 'children':
        return <ChildrenTab editHR={data} setEditHR={setData} />;
      case 'education':
        return <EducationTab editHR={data} setEditHR={setData} skills={skills} />;
      case 'documents':
        return <DocumentsTab editHR={data} setEditHR={setData} />;
      case 'civilservant':
        return <CivilServantTab editHR={data} setEditHR={setData} />;
      case 'union':
        return <UnionTab editHR={data} setEditHR={setData} />;
      case 'other':
        return <OtherTab editHR={data} setEditHR={setData} />;
      case 'performance': // Render PerformanceTab
        return <PerformanceTab editHR={data} setEditHR={setData} />;
      default:
        return null;
    }
  };

  const formatDate = (dateStr) => {
    // Convert "dd/MM/yyyy" to "yyyy-MM-dd" for backend
    if (!dateStr) return '';
    if (dateStr.length === 10 && dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      if (y && m && d) return `${y}-${m}-${d}`;
    }
    if (dateStr.length === 10 && dateStr.includes('-')) {
      // Already ISO format
      return dateStr;
    }
    return dateStr;
  };

  // Helper: format ISO date to dd/mm/yyyy
  function formatDateKhmer(val) {
    if (!val) return '';
    // ISO: yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    // Already dd/mm/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val;
    return val;
  }

  // Helper: convert gender value to Khmer
  function toKhmerGender(val) {
    if (val === 'Male') return 'ប្រុស';
    if (val === 'Female') return 'ស្រី';
    return val;
  }

  const handleAdd = async () => {
    // Check all required fields
    for (const key of requiredFields) {
      if (!newHR[key] || newHR[key].trim() === '') {
        alert('សូមបំពេញព័ត៌មានសំខាន់ៗទាំងអស់');
        return;
      }
    }
    if (activeTab === 'education' && !isEducationValid(educationList)) {
      alert('សូមបំពេញព័ត៌មានការអប់រំអោយគ្រប់គ្រាន់');
      return;
    }
    try {
  const payload = { ...newHR };
      if (payload.dob) payload.dob = formatDate(payload.dob);
  // Civil Servant tab: normalize date fields to ISO
  if (payload.civilServantStartDate) payload.civilServantStartDate = formatDate(payload.civilServantStartDate);
  if (payload.dateJoinedGov) payload.dateJoinedGov = formatDate(payload.dateJoinedGov);
  // If both dates are the same day, keep only civilServantStartDate
  if (payload.civilServantStartDate && payload.dateJoinedGov && payload.civilServantStartDate === payload.dateJoinedGov) {
    delete payload.dateJoinedGov;
  }
  if (payload.dateJoinedMinistry) payload.dateJoinedMinistry = formatDate(payload.dateJoinedMinistry);
  if (payload.nominationStartDate) payload.nominationStartDate = formatDate(payload.nominationStartDate);
  if (payload.medalReceivedDate) payload.medalReceivedDate = formatDate(payload.medalReceivedDate);
  if (payload.salaryPromotionDate) payload.salaryPromotionDate = formatDate(payload.salaryPromotionDate);
      // Normalize unionJoinDate if selects used
      if (payload.unionJoinDate) payload.unionJoinDate = formatDate(payload.unionJoinDate);
      else if (payload.unionJoinDateDay && payload.unionJoinDateMonth && payload.unionJoinDateYear) {
        payload.unionJoinDate = `${payload.unionJoinDateYear}-${payload.unionJoinDateMonth}-${payload.unionJoinDateDay}`;
      }
      // Remove temp unionJoinDate parts
      delete payload.unionJoinDateDay; delete payload.unionJoinDateMonth; delete payload.unionJoinDateYear;
      // Normalize childrenList child DOBs to ISO yyyy-mm-dd and strip temp parts
      if (Array.isArray(payload.childrenList)) {
        payload.childrenList = payload.childrenList.map(c => {
          const copy = { ...c };
          if (copy.dob) copy.dob = formatDate(copy.dob);
          // Remove temp fields if present
          delete copy.dobDay; delete copy.dobMonth; delete copy.dobYear;
          return copy;
        });
      }
      // Normalize educationList dates and strip temp fields
      if (Array.isArray(payload.educationList)) {
        payload.educationList = payload.educationList.map(e => {
          const copy = { ...e };
          if (copy.startDate) copy.startDate = formatDate(copy.startDate);
          else if (copy.startDateDay && copy.startDateMonth && copy.startDateYear) {
            copy.startDate = `${copy.startDateYear}-${copy.startDateMonth}-${copy.startDateDay}`;
          }
          if (copy.endDate) copy.endDate = formatDate(copy.endDate);
          else if (copy.endDateDay && copy.endDateMonth && copy.endDateYear) {
            copy.endDate = `${copy.endDateYear}-${copy.endDateMonth}-${copy.endDateDay}`;
          }
          delete copy.startDateDay; delete copy.startDateMonth; delete copy.startDateYear;
          delete copy.endDateDay; delete copy.endDateMonth; delete copy.endDateYear;
          return copy;
        });
      }
      // Normalize documents fields if single-document fields used
      if (payload.documentStartDate) payload.documentStartDate = formatDate(payload.documentStartDate);
      else if (payload.documentStartDateDay && payload.documentStartDateMonth && payload.documentStartDateYear) {
        payload.documentStartDate = `${payload.documentStartDateYear}-${payload.documentStartDateMonth}-${payload.documentStartDateDay}`;
      }
      if (payload.documentEndDate) payload.documentEndDate = formatDate(payload.documentEndDate);
      else if (payload.documentEndDateDay && payload.documentEndDateMonth && payload.documentEndDateYear) {
        payload.documentEndDate = `${payload.documentEndDateYear}-${payload.documentEndDateMonth}-${payload.documentEndDateDay}`;
      }
      if (payload.documentExpiryDate) payload.documentExpiryDate = formatDate(payload.documentExpiryDate);
      else if (payload.documentExpiryDateDay && payload.documentExpiryDateMonth && payload.documentExpiryDateYear) {
        payload.documentExpiryDate = `${payload.documentExpiryDateYear}-${payload.documentExpiryDateMonth}-${payload.documentExpiryDateDay}`;
      }
      // strip temp document date parts
      delete payload.documentStartDateDay; delete payload.documentStartDateMonth; delete payload.documentStartDateYear;
      delete payload.documentEndDateDay; delete payload.documentEndDateMonth; delete payload.documentEndDateYear;
      delete payload.documentExpiryDateDay; delete payload.documentExpiryDateMonth; delete payload.documentExpiryDateYear;
      // copy documentOther/documentFile/documentType into documents array for backend storage
      if (payload.documentFile || payload.documentType || payload.documentStartDate || payload.documentEndDate || payload.documentOther || payload.documentExpiryDate) {
        payload.documents = payload.documents || [];
        // create a single document entry representing the uploaded file / selected type
        const docEntry = {
          type: payload.documentType || '',
          fileUrl: payload.documentFile || '',
          startDate: payload.documentStartDate || undefined,
          endDate: payload.documentEndDate || undefined,
          other: payload.documentOther || '',
          expiryDate: payload.documentExpiryDate || undefined
        };
        // push or replace first document slot
        if (payload.documents.length === 0) payload.documents.push(docEntry);
        else payload.documents[0] = { ...payload.documents[0], ...docEntry };
      }
      // Normalize any documents[] entries (dates to ISO, drop empty strings)
      if (Array.isArray(payload.documents)) {
        payload.documents = payload.documents.map(d => {
          const doc = { ...d };
          if (doc.startDate) doc.startDate = formatDate(doc.startDate);
          if (doc.endDate) doc.endDate = formatDate(doc.endDate);
          if (doc.expiryDate) doc.expiryDate = formatDate(doc.expiryDate);
          ['type','fileUrl','other','startDate','endDate','expiryDate'].forEach(k => { if (doc[k] === '') delete doc[k]; });
          return doc;
        });
      }
      // remove flat document fields to avoid duplication
      delete payload.documentFile; delete payload.documentType; delete payload.documentStartDate; delete payload.documentEndDate; delete payload.documentOther; delete payload.documentExpiryDate;
      if (newHR.image) payload.image = newHR.image;
      // Debug: log payload size
      if (payload.image) {
        console.log('Sending image base64 length:', payload.image.length);
      }
      const response = await api.post('/hr', payload);
      if (response?.status >= 200 && response?.status < 300) {
        closeAddModal();
        // ...existing code...
      } else {
        const errorText = response?.data?.error || 'Unknown error';
        alert('បន្ថែមមិនបានជោគជ័យ: ' + errorText);
        // Debug: log backend error
        console.error('Backend error:', errorText);
      }
    } catch (error) {
      const msg = error?.response?.data?.error || error?.response?.data?.message || error.message;
      alert('បញ្ហាក្នុងការបន្ថែម: ' + msg);
      // Debug: log fetch error
      console.error('Add error:', error?.response?.data || error);
    }
  };

  const handleUpdate = async () => {
    try {
      const payload = { ...editHR };
      if (payload.no !== undefined && payload.no !== null && payload.no !== '') {
        const n = parseInt(payload.no, 10);
        if (!isNaN(n) && n > 0) payload.no = n; else delete payload.no;
      }
      if (payload.dob) payload.dob = formatDate(payload.dob);
  // Civil Servant tab: normalize date fields to ISO
  if (payload.civilServantStartDate) payload.civilServantStartDate = formatDate(payload.civilServantStartDate);
  if (payload.dateJoinedGov) payload.dateJoinedGov = formatDate(payload.dateJoinedGov);
  // If both dates are the same day, keep only civilServantStartDate
  if (payload.civilServantStartDate && payload.dateJoinedGov && payload.civilServantStartDate === payload.dateJoinedGov) {
    delete payload.dateJoinedGov;
  }
  if (payload.dateJoinedMinistry) payload.dateJoinedMinistry = formatDate(payload.dateJoinedMinistry);
  if (payload.nominationStartDate) payload.nominationStartDate = formatDate(payload.nominationStartDate);
  if (payload.medalReceivedDate) payload.medalReceivedDate = formatDate(payload.medalReceivedDate);
  if (payload.salaryPromotionDate) payload.salaryPromotionDate = formatDate(payload.salaryPromotionDate);
      // Normalize unionJoinDate for edit
      if (payload.unionJoinDate) payload.unionJoinDate = formatDate(payload.unionJoinDate);
      else if (payload.unionJoinDateDay && payload.unionJoinDateMonth && payload.unionJoinDateYear) {
        payload.unionJoinDate = `${payload.unionJoinDateYear}-${payload.unionJoinDateMonth}-${payload.unionJoinDateDay}`;
      }
      // Remove temp unionJoinDate parts
      delete payload.unionJoinDateDay; delete payload.unionJoinDateMonth; delete payload.unionJoinDateYear;
      if (Array.isArray(payload.childrenList)) {
        payload.childrenList = payload.childrenList.map(c => {
          const copy = { ...c };
          if (copy.dob) copy.dob = formatDate(copy.dob);
          delete copy.dobDay; delete copy.dobMonth; delete copy.dobYear;
          return copy;
        });
      }
      // Normalize educationList dates for edit
      if (Array.isArray(payload.educationList)) {
        payload.educationList = payload.educationList.map(e => {
          const copy = { ...e };
          if (copy.startDate) copy.startDate = formatDate(copy.startDate);
          else if (copy.startDateDay && copy.startDateMonth && copy.startDateYear) {
            copy.startDate = `${copy.startDateYear}-${copy.startDateMonth}-${copy.startDateDay}`;
          }
          if (copy.endDate) copy.endDate = formatDate(copy.endDate);
          else if (copy.endDateDay && copy.endDateMonth && copy.endDateYear) {
            copy.endDate = `${copy.endDateYear}-${copy.endDateMonth}-${copy.endDateDay}`;
          }
          delete copy.startDateDay; delete copy.startDateMonth; delete copy.startDateYear;
          delete copy.endDateDay; delete copy.endDateMonth; delete copy.endDateYear;
          return copy;
        });
      }
      // Normalize documents for edit similar to add
      if (payload.documentStartDate) payload.documentStartDate = formatDate(payload.documentStartDate);
      else if (payload.documentStartDateDay && payload.documentStartDateMonth && payload.documentStartDateYear) {
        payload.documentStartDate = `${payload.documentStartDateYear}-${payload.documentStartDateMonth}-${payload.documentStartDateDay}`;
      }
      if (payload.documentEndDate) payload.documentEndDate = formatDate(payload.documentEndDate);
      else if (payload.documentEndDateDay && payload.documentEndDateMonth && payload.documentEndDateYear) {
        payload.documentEndDate = `${payload.documentEndDateYear}-${payload.documentEndDateMonth}-${payload.documentEndDateDay}`;
      }
      if (payload.documentExpiryDate) payload.documentExpiryDate = formatDate(payload.documentExpiryDate);
      else if (payload.documentExpiryDateDay && payload.documentExpiryDateMonth && payload.documentExpiryDateYear) {
        payload.documentExpiryDate = `${payload.documentExpiryDateYear}-${payload.documentExpiryDateMonth}-${payload.documentExpiryDateDay}`;
      }
      delete payload.documentStartDateDay; delete payload.documentStartDateMonth; delete payload.documentStartDateYear;
      delete payload.documentEndDateDay; delete payload.documentEndDateMonth; delete payload.documentEndDateYear;
      delete payload.documentExpiryDateDay; delete payload.documentExpiryDateMonth; delete payload.documentExpiryDateYear;
      if (payload.documentFile || payload.documentType || payload.documentStartDate || payload.documentEndDate || payload.documentOther || payload.documentExpiryDate) {
        payload.documents = payload.documents || [];
        const docEntry = {
          type: payload.documentType || '',
          fileUrl: payload.documentFile || '',
          startDate: payload.documentStartDate || undefined,
          endDate: payload.documentEndDate || undefined,
          other: payload.documentOther || '',
          expiryDate: payload.documentExpiryDate || undefined
        };
        if (payload.documents.length === 0) payload.documents.push(docEntry);
        else payload.documents[0] = { ...payload.documents[0], ...docEntry };
      }
      // Normalize any documents[] entries (dates to ISO, drop empty strings)
      if (Array.isArray(payload.documents)) {
        payload.documents = payload.documents.map(d => {
          const doc = { ...d };
          if (doc.startDate) doc.startDate = formatDate(doc.startDate);
          if (doc.endDate) doc.endDate = formatDate(doc.endDate);
          if (doc.expiryDate) doc.expiryDate = formatDate(doc.expiryDate);
          ['type','fileUrl','other','startDate','endDate','expiryDate'].forEach(k => { if (doc[k] === '') delete doc[k]; });
          return doc;
        });
      }
      delete payload.documentFile; delete payload.documentType; delete payload.documentStartDate; delete payload.documentEndDate; delete payload.documentOther; delete payload.documentExpiryDate;
      if (editHR.image) payload.image = editHR.image;
      // Debug: log payload size
      if (payload.image) {
        console.log('Sending image base64 length (edit):', payload.image.length);
      }
      const response = await api.put(`/hr/${editHR._id}`, payload);
      if (response?.status >= 200 && response?.status < 300) {
        closeEditModal();
        // ...existing code...
      } else {
        const errorText = response?.data?.error || 'Unknown error';
        alert('កែប្រែមិនបានជោគជ័យ: ' + errorText);
        // Debug: log backend error
        console.error('Backend error (edit):', errorText);
      }
    } catch (error) {
      const msg = error?.response?.data?.error || error?.response?.data?.message || error.message;
      alert('បញ្ហាក្នុងការកែប្រែ: ' + msg);
      // Debug: log fetch error
      console.error('Edit error:', error?.response?.data || error);
    }
  };

  // Khmer headers for export (add all fields you want to see in Excel)
  const exportHeaders = [
    'ល.រ',
    'លេខកាត',
    'គោត្តនាម និងនាម',
    'ឡាតាំង',
    'ភេទ',
    'ថ្ងៃកំណើត',
    'ស្ថានភាពគ្រួសារ',
    'ក្រុមឈាម',
    'ទូរស័ព្ទ',
  'អ៊ីមែល',
    'ទីកន្លែងកំណើត',
    'ទីកន្លែងបច្ចុប្បន្ន',
    'តួនាទី',
    'ជំនាញ',
    'ផ្នែក',
    'រូបភាព',
    'ស្ថានភាព', // Example: status
    'ផ្សេងៗ'    // Example: other
  ];

  // Add all corresponding field keys here (must match backend field names)
  const exportFields = [
    'no',
    'staffId',
    'khmerName',
    'name',
    'gender',
    'dob',
    'maritalStatus',
    'bloodGroup',
    'phone',
  'email',
    'birthPlace',
    'currentPlace',
    'position',
    'skill',
    'Department_Kh',
    'image',
    'status',   // Example: status
    'other'     // Example: other
  ];

  const handleExport = async () => {
    try {
  const { data: hrList } = await api.get('/hr');
      if (!Array.isArray(hrList) || hrList.length === 0) {
        alert('មិនមានទិន្នន័យ HR');
        return;
      }
      const csvRows = [];
      // Add BOM for UTF-8 so Excel can read Khmer correctly
      csvRows.push('\uFEFF' + exportHeaders.map(h => `"${h}"`).join(','));
      hrList.forEach(hr => {
        const row = exportFields.map(f => {
          let val = hr[f] ?? '';
          // Remove tabs/newlines and wrap in quotes for CSV
          if (typeof val === 'string') {
            val = `"${val.replace(/"/g, '""').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')}"`;
          }
          return val;
        }).join(',');
        csvRows.push(row);
      });
      const csvContent = csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hr_export_selected_fields.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('បញ្ហាក្នុងការនាំចេញ: ' + err.message);
    }
  };

  // ប៊ូតុង "នាំចេញទាំងអស់ (fields hrSchema)" នឹង export fields ទាំងអស់ (header ជាអង់គ្លេសតាម schema)
  const handleExportAllFields = async () => {
    try {
  const { data: hrList } = await api.get('/hr');
      if (!Array.isArray(hrList) || hrList.length === 0) {
        alert('មិនមានទិន្នន័យ HR');
        return;
      }
      const allFields = Object.keys(hrList[0]);
      const csvRows = [];
      // Header: ប្រើឈ្មោះ field (fields hrSchema)
      csvRows.push('\uFEFF' + allFields.map(h => `"${h}"`).join(','));
      hrList.forEach(hr => {
        const row = allFields.map(f => {
          let val = hr[f] ?? '';
          if (typeof val === 'string') {
            val = `"${val.replace(/"/g, '""').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')}"`;
          }
          return val;
        }).join(',');
        csvRows.push(row);
      });
      const csvContent = csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hr_export_all_fields.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('បញ្ហាក្នុងការនាំចេញ: ' + err.message);
    }
  };

  // ប៊ូតុង "នាំចូលទាំងអស់ (fields hrSchema)" អាច import CSV ដែល header ត្រូវនឹង fields hrSchema
  const handleImportAllFields = async (file) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        alert('CSV មិនមានទិន្នន័យ');
        return;
      }
      const headers = lines[0].replace('\uFEFF', '').split(',');
      const records = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = values[i] ?? '';
        });
        return obj;
      });
  const res = await api.post('/hr/import', records);
      if (res?.status >= 200 && res?.status < 300) {
        alert('នាំចូលបានជោគជ័យ');
      } else {
        const errText = res?.data?.error || 'Unknown error';
        alert('បញ្ហាក្នុងការនាំចូល: ' + errText);
      }
    } catch (err) {
      alert('បញ្ហាក្នុងការនាំចូល: ' + err.message);
    }
  };

  // បន្ថែម function handleExportSelectedFields
  const handleExportSelectedFields = async () => {
    try {
  const { data: hrList } = await api.get('/hr');
      if (!Array.isArray(hrList) || hrList.length === 0) {
        alert('មិនមានទិន្នន័យ HR');
        return;
      }
      const csvRows = [];
      csvRows.push('\uFEFF' + selectedFields.map(h => `"${h}"`).join(','));
      hrList.forEach(hr => {
        const row = selectedFields.map(f => {
          let val = hr[f] ?? '';
          if (typeof val === 'string') {
            val = `"${val.replace(/"/g, '""').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')}"`;
          }
          return val;
        }).join(',');
        csvRows.push(row);
      });
      const csvContent = csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hr_export_selected_fields.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('បញ្ហាក្នុងការនាំចេញ: ' + err.message);
    }
  };

  // បន្ថែម function handleExportSelectedFieldsKhmer
  const handleExportSelectedFieldsKhmer = async () => {
    try {
  const res = await fetch(`${API_BASE}/api/hr`);
      const hrList = await res.json();
      if (!Array.isArray(hrList) || hrList.length === 0) {
        alert('មិនមានទិន្នន័យ HR');
        return;
      }
      // Header: Khmer label
      const csvRows = [];
      csvRows.push('\uFEFF' + selectedFields.map(f => `"${khmerFieldLabels[f] || f}"`).join(','));
      hrList.forEach(hr => {
        const row = selectedFields.map(f => {
          let val = hr[f] ?? '';
          // Format date fields to dd/mm/yyyy
          if (['dob', 'joinDate', 'mentorDate', 'civilServantStartDate', 'nominationStartDate', 'dateJoinedMinistry', 'lastSalaryIncrementDate', 'asOfDate', 'startYear', 'endYear'].includes(f)) {
            val = formatDateKhmer(val);
          }
          // Gender to Khmer
          if (f === 'gender') {
            val = toKhmerGender(val);
          }
          // Marital status to Khmer
          if (f === 'maritalStatus') {
            if (val === 'Single') val = 'លីវ';
            else if (val === 'Married') val = 'រៀបការហើយ';
            else if (val === 'Divorced') val = 'ពោះម៉ាយ';
            else if (val === 'Widowed') val = 'មេម៉ាយ';
          }
          // Blood group to Khmer (optional, if you want to localize)
          // ...add more mapping if needed...
          if (typeof val === 'string') {
            val = `"${val.replace(/"/g, '""').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')}"`;
          }
          return val;
        }).join(',');
        csvRows.push(row);
      });
      const csvContent = csvRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hr_export_selected_fields_khmer.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('បញ្ហាក្នុងការនាំចេញ: ' + err.message);
    }
  }

  // Khmer field labels mapping
  const khmerFieldLabels = {
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
    position: 'តួនាទី',
    skill: 'ជំនាញ',
    Department_Kh: 'ផ្នែក',
    image: 'រូបភាព',
    status: 'ស្ថានភាព',
    other: 'ផ្សេងៗ',
    officerType: 'ប្រភេទមន្ត្រី',
    joinDate: 'កាលបរិច្ឆេទចូលបម្រើការងារ',
    dateJoinedMinistry: 'កាលបរិច្ឆេទចូលកាន់តំណែងមន្ទីរពេទ្យ',
    lastSalaryIncrementDate: 'កាលបរិច្ឆេទបញ្ចប់តំណែងមន្ទីរពេទ្យ',
  civilServantStartDate: 'ថ្ងៃចូលក្របខ័ណ្ឌ',
  nominationStartDate: 'ថ្ងៃតាំងស៊ប់',
    workOther: 'ផ្សេងៗការងារ',
    degreeLevel: 'កម្រិតសញ្ញាប័ត្រ',
    degree: 'សញ្ញាប័ត្រ',
    educationLevel: 'កម្រិតវប្បធម៌',
    salaryLevel: 'កាំប្រាក់',
    mentorName: 'ឈ្មោះអ្នកណែនាំ',
    mentorDate: 'ថ្ងៃណែនាំ',
    institution: 'ស្ថានទីសិក្សា',
    startYear: 'ឆ្នាំចូលរៀន',
    endYear: 'ឆ្នាំបញ្ចប់រៀន',
    nid: 'លេខអត្តសញ្ញាណ',
    cardNumber: 'លេខកាតបសស',
    bankAccount: 'លេខគណនីធនាគារ',
    civilServantId: 'លេខមន្ត្រីរាជការ',
    // dateJoinedGov removed - use civilServantStartDate instead
    yearsInCurrentRank: 'ឆ្នាំក្នុងថ្នាក់បច្ចុប្បន្ន',
    rankExitReason: 'មូលហេតុចាកចេញពីថ្នាក់',
    rankExitDuration: 'រយៈពេលចាកចេញ',
    grade: 'ថ្នាក់',
    proposedBy: 'ស្នើដោយ',
    yearsInRank: 'ឆ្នាំក្នុងថ្នាក់',
    totalYearsWorked: 'ចំនួនឆ្នាំធ្វើការ',
    asOfDate: 'ថ្ងៃបច្ចុប្បន្ន',
    reason1: 'មូលហេតុ១',
    reason2: 'មូលហេតុ២',
    reason3: 'មូលហេតុ៣',
    reason4: 'មូលហេតុ៤',
    reason5: 'មូលហេតុ៥',
    reason6: 'មូលហេតុ៦'
    // ...add more if needed...
  };

  return (
    <>
      {/* Export/Import toolbar removed per user request */}
      {/* ផ្ទាំងជ្រើសរើស fields export */}
      {showFieldPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg min-w-[400px] max-w-[90vw]">
            <div className="mb-2 font-bold text-blue-700">ជ្រើសរើស fields (នាំចេញ):</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {allFields.map(f => (
                <label key={f} className="text-sm px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedFields([...selectedFields, f]);
                      } else {
                        setSelectedFields(selectedFields.filter(x => x !== f));
                      }
                    }}
                  /> {khmerFieldLabels[f] || f}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-2 py-1 bg-green-500 text-white rounded"
                onClick={() => setSelectedFields(allFields)}
              >ជ្រើសទាំងអស់</button>
              <button
                type="button"
                className="px-2 py-1 bg-red-500 text-white rounded"
                onClick={() => setSelectedFields([])}
              >លុបជ្រើសរើស</button>
              <button
                type="button"
                className="px-2 py-1 bg-blue-600 text-white rounded"
                onClick={() => {
                  setShowFieldPanel(false);
                  handleExportSelectedFieldsKhmer();
                }}
                disabled={selectedFields.length === 0}
              >នាំចេញ (CSV ភាសាខ្មែរ)</button>
              <button
                type="button"
                className="px-2 py-1 bg-gray-400 text-white rounded"
                onClick={() => setShowFieldPanel(false)}
              >បិទ</button>
            </div>
          </div>
        </div>
      )}
      {/* ផ្ទាំងជ្រើសរើស fields import */}
      {showImportPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg min-w-[400px] max-w-[90vw]">
            <div className="mb-2 font-bold text-purple-700">ជ្រើសរើស fields (នាំចូល):</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {allFields.map(f => (
                <label key={f} className="text-sm px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedFields([...selectedFields, f]);
                      } else {
                        setSelectedFields(selectedFields.filter(x => x !== f));
                      }
                    }}
                  /> {khmerFieldLabels[f] || f}
                </label>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                className="px-2 py-1 bg-green-500 text-white rounded"
                onClick={() => setSelectedFields(allFields)}
              >ជ្រើសទាំងអស់</button>
              <button
                type="button"
                className="px-2 py-1 bg-red-500 text-white rounded"
                onClick={() => setSelectedFields([])}
              >លុបជ្រើសរើស</button>
              <label className="px-2 py-1 bg-purple-600 text-white rounded cursor-pointer">
                ជ្រើសឯកសារ CSV
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      file.text().then(text => {
                        const lines = text.split(/\r?\n/).filter(l => l.trim());
                        if (lines.length < 2) {
                          alert('CSV មិនមានទិន្នន័យ');
                          return;
                        }
                        const headers = lines[0].replace('\uFEFF', '').split(',');
                        // Only import if headers match selectedFields
                        const valid = selectedFields.every(f => headers.includes(f));
                        if (!valid) {
                          alert('Header CSV មិនត្រូវ fields ជ្រើសរើស');
                          return;
                        }
                        const records = lines.slice(1).map(line => {
                          const values = line.split(',').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
                          const obj = {};
                          headers.forEach((h, i) => {
                            obj[h] = values[i] ?? '';
                          });
                          return obj;
                        });
                        api.post('/hr/import', records).then(res => {
                          if (res?.status >= 200 && res?.status < 300) {
                            alert('នាំចូលបានជោគជ័យ');
                          } else {
                            const errText = res?.data?.error || 'Unknown error';
                            alert('បញ្ហាក្នុងការនាំចូល: ' + errText);
                          }
                        }).catch(err => alert('បញ្ហាក្នុងការនាំចូល: ' + err.message));
                      });
                    }
                    e.target.value = '';
                    setShowImportPanel(false);
                  }}
                />
              </label>
              <button
                type="button"
                className="px-2 py-1 bg-gray-400 text-white rounded"
                onClick={() => setShowImportPanel(false)}
              >បិទ</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Add */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-100 flex items- justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[0px] w-[1500px] flex flex-col items-center">
            <h2 className="text-lg font-bold mb-4 text-purple-800">បន្ថែមបុគ្គលិក HR</h2>
            {/* Tab bar inside modal, not sticky */}
            <div className="mb-4 flex gap-2 w-full justify-center">
              {tabList.map(tab => (
                <button
                  key={tab.key}
                  className={`px-4 py-1 rounded-t ${ activeTab === tab.key ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Scrollable fields below tab bar */}
            <div className="overflow-y-auto max-h-[60vh] w-full">
              {renderFields(newHR, setNewHR)}
            </div>
            <div className="flex justify-end mt-4 w-full">
              <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-1 rounded mr-2 hover:bg-blue-700">រក្សាទុក</button>
              <button onClick={closeAddModal} className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600">បោះបង់</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-100 flex items- justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[0px] w-[1500px] flex flex-col items-center">
            <h3 className="text-lg font-bold mb-4 text-indigo-800">កែប្រែបុគ្គលិក HR</h3>
            {/* Tab bar inside modal, not sticky */}
            <div className="mb-4 flex gap-2 w-full justify-center">
              {tabList.map(tab => (
                <button
                  key={tab.key}
                  className={`px-4 py-1 rounded-t ${activeTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Scrollable fields below tab bar */}
            <div className="overflow-y-auto max-h-[60vh] w-full">
              {renderFields(editHR, setEditHR, true)}
            </div>
            <div className="flex justify-end mt-4 w-full">
              <button
                onClick={handleUpdate}
                className="bg-indigo-600 text-white px-4 py-1 rounded mr-2 hover:bg-indigo-700"
              >ធ្វើបច្ចុប្បន្នភាព</button>
              <button
                onClick={closeEditModal}
                className="bg-gray-500 text-white px-4 py-1 rounded hover:bg-gray-600"
              >បោះបង់</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
