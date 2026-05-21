import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaPaperPlane, FaReply, FaUser } from 'react-icons/fa';
import logo3 from '../assets/3.JPG';
import HRAPI from '../services/hrAPI';
import api from '../services/api';
import { fetchFileTransfers } from '../api/fileTransfer';
import usePermission from '../hooks/usePermission';

const KHMER_FONT = { fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif" };

const STATUS_TABS = [
  { key: 'all', label: 'ទាំងអស់' },
  { key: 'pending', label: 'រង់ចាំ' },
  { key: 'processing', label: 'កំពុងដំណើរការ' },
  { key: 'done', label: 'រួចរាល់' },
  { key: 'rejected', label: 'បដិសេធ' },
];

const STAGE_OPTIONS = [
  { value: 'all', label: 'គ្រប់វគ្គ' },
  { value: 'S', label: 'វគ្គ 0' },
  { value: 'S1', label: 'វគ្គ 1' },
  { value: 'S2', label: 'វគ្គ 2' },
  { value: 'S3', label: 'វគ្គ 3' },
  { value: 'S4', label: 'វគ្គ 4' },
  { value: 'S5', label: 'វគ្គ 5' },
  { value: 'S6', label: 'វគ្គ 6' },
];

const getStageLabel = (val) => {
  if (!val) return '-';
  const found = STAGE_OPTIONS.find((o) => String(o.value) === String(val));
  return found ? found.label : String(val);
};

const statusBadgeClass = (statusKey) => {
  switch (statusKey) {
    case 'done':
      return 'bg-green-200 text-green-900';
    case 'pending':
      return 'bg-yellow-200 text-yellow-900';
    case 'processing':
      return 'bg-blue-200 text-blue-900';
    case 'rejected':
      return 'bg-red-200 text-red-900';
    default:
      return 'bg-gray-200 text-gray-900';
  }
};

const toDateInputValue = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toKhmerDigits = (value) => String(value ?? '')
  .replace(/0/g, '០')
  .replace(/1/g, '១')
  .replace(/2/g, '២')
  .replace(/3/g, '៣')
  .replace(/4/g, '៤')
  .replace(/5/g, '៥')
  .replace(/6/g, '៦')
  .replace(/7/g, '៧')
  .replace(/8/g, '៨')
  .replace(/9/g, '៩');

const KHMER_MONTHS = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
];

const KHMER_WEEKDAYS = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];

const formatFullKhmerDate = (input) => {
  const s = String(input || '').trim();
  if (!s) return '';
  // If already looks like a Khmer long-form, return as-is.
  if (s.includes('ថ្ងៃ') && (s.includes('ខែ') || s.includes('ឆ្នាំ'))) return s;

  // Try to parse ISO date or datetime: YYYY-MM-DD or YYYY-MM-DD HH:MM
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!m) return s;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const hh = m[4] ? Number(m[4]) : null;
  const min = m[5] ? Number(m[5]) : null;

  const dt = new Date(yyyy, mm - 1, dd, hh || 0, min || 0);
  if (Number.isNaN(dt.getTime())) return s;

  const weekday = KHMER_WEEKDAYS[dt.getDay()] || '';
  const beYear = yyyy + 543;

  const hour24 = hh != null ? hh : dt.getHours();
  const minute = min != null ? min : dt.getMinutes();
  const period = hour24 < 12 ? 'ព្រឹក' : 'ល្ងាច';
  const hourDisplay = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `ថ្ងៃ${weekday} ថ្ងៃទី${toKhmerDigits(dd)} ខែ${KHMER_MONTHS[mm - 1] || ''} ឆ្នាំ${toKhmerDigits(beYear)} វេលាម៉ោង ${toKhmerDigits(hourDisplay)}:${toKhmerDigits(String(minute).padStart(2, '0'))} នាទី ${period}។`;
};

const extractIsoDate = (input) => {
  const s = String(input ?? '').trim();
  if (!s) return '';

  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dd = String(Number(dmy[1])).padStart(2, '0');
    const mm = String(Number(dmy[2])).padStart(2, '0');
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
};

const formatLetterDateKhmer = (input) => {
  const s = String(input ?? '').trim();
  if (!s) return '';
  if (s.includes('ចុះថ្ងៃទី') && s.includes('ឆ្នាំ')) return s;

  const iso = extractIsoDate(s);
  if (!iso) return s;

  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return s;

  const monthName = KHMER_MONTHS[mm - 1] || '';
  return `ចុះថ្ងៃទី${toKhmerDigits(dd)} ខែ${monthName} ឆ្នាំ${toKhmerDigits(yyyy)}`;
};

const formatKhmerDateWithWeekday = (input) => {
  const s = String(input ?? '').trim();
  if (!s) return '';

  // Try to parse using Date first (handles full ISO datetimes)
  let dt = new Date(s);
  if (Number.isNaN(dt.getTime())) {
    // fallback: try to extract yyyy-mm-dd then parse
    const iso = extractIsoDate(s);
    if (!iso) return s;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(dt.getTime())) return s;
  }

  const weekday = KHMER_WEEKDAYS[dt.getDay()] || '';
  const dd = dt.getDate();
  const mm = dt.getMonth();
  const yyyy = dt.getFullYear();
  const beYear = yyyy + 543;

  return `ចុះថ្ងៃ${weekday} ថ្ងៃទី${toKhmerDigits(dd)} ខែ${KHMER_MONTHS[mm] || ''} ឆ្នាំ${toKhmerDigits(beYear)}`;
};

const STORAGE_KEY = 'missions.data.v1';

const seedMissions = () => ([
  {
    id: '1',
    reference: '០១/២០២៦',
    assignTo: 'លោក/លោកស្រី ..........',
    participants: '១) ..........  ២) ..........',
    date: '2026-02-03',
    location: 'ភ្នំពេញ',
    stage: 'S1',
    telegram: 'យោបល់ - អនុប្រធានផ្នែក',
    statusKey: 'processing',
    statusText: 'កំពុង - អនុប្រធានផ្នែក',
    createdFrom: 'sample',
  },
  {
    id: '2',
    reference: '០២/២០២៦',
    assignTo: 'ផ្នែក/អង្គភាព ..........',
    participants: 'ក្រុមការងារ ..........',
    date: '2026-02-01',
    location: 'កណ្តាល',
    stage: 'S1',
    telegram: 'យោបល់ - ប្រធានការិយាល័យ',
    statusKey: 'processing',
    statusText: 'កំពុង - ប្រធានការិយាល័យ',
    createdFrom: 'sample',
  },
  {
    id: '3',
    reference: '០៣/២០២៦',
    assignTo: 'ការិយាល័យ ..........',
    participants: '........../........../..........',
    date: '2026-02-01',
    location: 'កំពង់ស្ពឺ',
    stage: 'S1',
    telegram: 'យោបល់ - នាយករង',
    statusKey: 'processing',
    statusText: 'កំពុង - នាយករង',
    createdFrom: 'sample',
  },
]);

const loadMissions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const persistMissions = (missions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(missions || []));
  } catch {
    // ignore
  }
};

export default function MissionsPage() {
  const perms = usePermission();
  const location = useLocation();
  const navigate = useNavigate();
  const wordPageRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [showTemplateBg, setShowTemplateBg] = useState(true);
  const [showNationalHeader, setShowNationalHeader] = useState(false);

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showTelegramColumn, setShowTelegramColumn] = useState(false);
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const [missions, setMissions] = useState([]);
  const [serverAvailable, setServerAvailable] = useState(null); // null=unknown, true/false
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [wordMode, setWordMode] = useState(false);
  const [sourceRecordId, setSourceRecordId] = useState(null);
  const [editForm, setEditForm] = useState({
    // Existing missions fields
    reference: '',
    assignTo: '',
    participants: '',
    date: '',
    location: '',
    traditionalDate: '',
    // MS Word / FileTransfer fields
    letterNo: '',
    letterDate: '',
    sourceDoc: '',
    referenceDoc: '',
    content: '',
    others: '',
    participationDate: '',
    participationLocation: '',
  });

  // HR picker states
  const [showHrPicker, setShowHrPicker] = useState(false);
  const [hrData, setHrData] = useState([]);
  const [hrSearch, setHrSearch] = useState('');
  const [hrDeptFilter, setHrDeptFilter] = useState('all');
  const [selectedHrIds, setSelectedHrIds] = useState([]);

  const fetchHrData = async () => {
    try {
      const res = await HRAPI.getAll();
      const data = (res && res.data) || res || [];
      setHrData(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchHrData failed', e);
      setHrData([]);
    }
  };

  const filteredHr = useMemo(() => {
    try {
      const q = String(hrSearch || '').trim().toLowerCase();
      return (hrData || []).filter((h) => {
        if (hrDeptFilter && hrDeptFilter !== 'all') {
          const dept = (h.Department_Kh || h.department || '').trim();
          if (dept !== hrDeptFilter) return false;
        }
        if (!q) return true;
        const name = (h.NAMEKHMER || h.nameKhmer || h.khmerName || h.name || '').toString().toLowerCase();
        const staff = String(h.staffId || h.STAFFID || h.staffID || '').toLowerCase();
        return name.includes(q) || staff.includes(q);
      }).slice(0, 200);
    } catch (e) {
      return [];
    }
  }, [hrData, hrSearch, hrDeptFilter]);

  const toggleSelectHr = (h) => {
    const id = String(h._id || h.id || h.staffId || h.STAFFID || h.STAFFID || '');
    setSelectedHrIds((prev) => {
      const s = new Set(prev || []);
      if (s.has(id)) s.delete(id); else s.add(id);
      return Array.from(s);
    });
  };

  const applySelectedHrsToParticipants = () => {
    try {
      const sel = (filteredHr || []).filter((h) => selectedHrIds.includes(String(h._id || h.id || h.staffId || h.STAFFID || '')));
      if (!sel || sel.length === 0) {
        window.alert('សូមជ្រើសរើសបុគ្គលិកមុន');
        return;
      }

      const lines = sel.map((h, i) => {
        const nameKh = h.NAMEKHMER || h.nameKhmer || h.khmerName || h.name || '';
        const role = h.Role || h.title || h.Title || h.Position || h.position || h.jobTitle || h.JOB || '';
        const dept = h.Department_Kh || h.department || h.Department || '';
        const num = toKhmerDigits(i + 1);
        const suffix = [role, dept].filter(Boolean).join(' - ');
        // Two-line left-aligned entry: first line number+name, second line 'ជា Role - Dept'
        return `${num}. ${nameKh}` + (suffix ? `\nជា ${suffix}` : '');
      });

      // Save the formatted selection into `assignTo` (សូមចាត់បញ្ជូន)
      setEditForm((s) => ({ ...s, assignTo: lines.join('\n') }));
      setShowHrPicker(false);
    } catch (e) {
      console.error(e);
      window.alert('មានបញ្ហាកាលណាដាក់ឈ្មោះ');
    }
  };

  const wordInlineEditClass =
    'inline-block px-1 border-b border-transparent hover:border-gray-300 focus:outline-none';
  const wordBlockEditClass =
    'whitespace-pre-wrap min-h-[28px] focus:outline-none';
  const wordBlockEditClassLg =
    'whitespace-pre-wrap min-h-[120px] focus:outline-none';

  // Persist to localStorage only when server is unavailable
  useEffect(() => {
    try {
      if (serverAvailable === false) persistMissions(missions);
    } catch (e) { }
  }, [missions, serverAvailable]);

  // Load from server on mount, fallback to localStorage
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get('/missions');
        if (!mounted) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        // normalize to have `id` property used by UI
        const norm = data.map(d => ({ ...d, id: d.id || d._id }));
        setMissions(norm);
        setServerAvailable(true);
      } catch (err) {
        // fallback to localStorage
        const fromStorage = loadMissions();
        setMissions(Array.isArray(fromStorage) ? fromStorage : seedMissions());
        setServerAvailable(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Refresh missions state when other parts of the app update localStorage
  useEffect(() => {
    const reload = () => {
      try {
        const fromStorage = loadMissions();
        if (Array.isArray(fromStorage)) setMissions(fromStorage);
      } catch (e) {
        // ignore
      }
    };

    const onStorage = (ev) => {
      if (!ev) return;
      if (ev.key && ev.key !== STORAGE_KEY) return;
      reload();
    };

    const onCustom = () => reload();

    try { window.addEventListener('storage', onStorage); } catch (e) { }
    try { window.addEventListener('missions-updated', onCustom); } catch (e) { }
    return () => {
      try { window.removeEventListener('storage', onStorage); } catch (e) { }
      try { window.removeEventListener('missions-updated', onCustom); } catch (e) { }
    };
  }, []);

  const rows = missions;

  const openEdit = (row) => {
    setEditingId(row?.id || null);
    setShowTemplateBg(true);
    // Do not auto-show national header; user can toggle
    setEditForm({
      reference: row?.reference || '',
      assignTo: row?.assignTo || '',
      participants: row?.participants || '',
      date: row?.date || '',
      location: row?.location || '',
      traditionalDate: row?.traditionalDate || '',
      letterNo: row?.letterNo || '',
      letterDate: row?.letterDate || '',
      sourceDoc: row?.sourceDoc || '',
      referenceDoc: row?.referenceDoc || '',
      content: row?.content || '',
      others: row?.others || '',
      participationDate: row?.participationDate ? toDateInputValue(row.participationDate) : '',
      participationLocation: row?.participationLocation || '',
    });
    setWordMode(true);
    setSourceRecordId(row?.sourceRecordId ?? null);
    setShowEditModal(true);
  };

  // Open full-field edit form (non Word-style)
  const openFullEdit = (row) => {
    setEditingId(row?.id || null);
    setShowTemplateBg(true);
    setEditForm({
      reference: row?.reference || '',
      assignTo: row?.assignTo || '',
      participants: row?.participants || row?.content || '',
      date: row?.date || '',
      location: row?.location || '',
      traditionalDate: row?.traditionalDate || '',
      letterNo: row?.letterNo || '',
      letterDate: row?.letterDate ? toDateInputValue(row.letterDate) : '',
      sourceDoc: row?.sourceDoc || '',
      referenceDoc: row?.referenceDoc || '',
      content: row?.content || '',
      others: row?.others || '',
      participationDate: row?.participationDate ? toDateInputValue(row.participationDate) : '',
      participationLocation: row?.participationLocation || '',
    });
    setWordMode(false);
    setSourceRecordId(row?.sourceRecordId ?? null);
    setShowEditModal(true);
  };

  const openCreate = (prefill) => {
    setEditingId(null);
    setShowTemplateBg(true);
    // Do not auto-show national header; user can toggle
    const p = prefill && typeof prefill === 'object' ? prefill : null;
    const preLetterNo = String(p?.letterNo ?? '').trim();
    const preLetterDate = String(p?.letterDate ?? '').trim();
    const preSourceDoc = String(p?.sourceDoc ?? '').trim();
    const preReferenceDoc = String(p?.referenceDoc ?? '').trim();
    const preContent = String(p?.content ?? '').trim();
    const preParticipants = String(p?.participants ?? p?.content ?? '').trim();
    const preOthers = String(p?.others ?? '').trim();

    // Keep missions list usable: map letterNo/letterDate into reference/date when available.
    setEditForm({
      reference: preLetterNo || '',
      assignTo: '',
      participants: preParticipants || '',
      date: extractIsoDate(preLetterDate) || '',
      location: '',
      traditionalDate: preLetterDate || '',
      letterNo: preLetterNo,
      letterDate: preLetterDate,
      sourceDoc: preSourceDoc,
      referenceDoc: preReferenceDoc,
      content: preContent,
      others: preOthers,
      participationDate: '',
      participationLocation: '',
    });
    setWordMode(true);
    setShowEditModal(true);
  };

  const safeParseDateToISO = (v) => {
    if (!v) return '';
    const s = String(v).trim();
    // dd/mm/yyyy
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`;
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    return '';
  };

  const importFromFileTransfers = async () => {
    try {
      if (!window.confirm('នាំចូល លិខិតពី File Transfer ទៅ Missions? (នាំចូលច្រើន)')) return;
      const res = await fetchFileTransfers('ទាំងអស់', 1, 200);
      const items = (res && res.items) || res || [];
      if (!Array.isArray(items) || items.length === 0) {
        window.alert('មិនមានឯកសារ File Transfer សម្រាប់នាំចូល');
        return;
      }

      const existingSourceIds = new Set((missions || []).map((m) => String(m.sourceRecordId || '')));
      const toAdd = [];
      for (const row of items) {
        const recordId = row?._id ?? row?.id ?? null;
        if (!recordId) continue;
        if (existingSourceIds.has(String(recordId))) continue;

        const letterNo = String(row?.letterNo ?? row?.letter_no ?? row?.reference ?? '').trim();
        const letterDate = safeParseDateToISO(String(row?.date ?? row?.created_at ?? row?.createdAt ?? '').trim());
        const sourceDoc = String(row?.source ?? row?.origin ?? '').trim();
        let referenceDoc = '';
        try { const list = (Array.isArray(row?.attachments) && row.attachments.length) ? row.attachments.map(String) : (row?.attachments || ''); referenceDoc = Array.isArray(list) ? list.join('\n') : String(list || ''); } catch { };
        const content = String(row?.content ?? row?.description ?? '').trim();
        const others = String(row?.others ?? row?.notes ?? '').trim();

        const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
        toAdd.push({
          id,
          reference: letterNo || id,
          assignTo: '',
          participants: '',
          date: letterDate || '',
          location: '',
          stage: 'S1',
          telegram: '-',
          statusKey: 'pending',
          statusText: 'រង់ចាំ',
          letterNo: letterNo,
          letterDate: letterDate,
          sourceDoc: sourceDoc,
          referenceDoc: referenceDoc,
          content: content,
          others: others,
          sourceRecordId: recordId,
          createdFrom: 'file-transfer',
        });
      }

      if (toAdd.length === 0) {
        window.alert('មិនមានឯកសារ​ថ្មី​សម្រាប់នាំចូល');
        return;
      }

      setMissions((prev) => [...toAdd, ...(Array.isArray(prev) ? prev : [])]);
      window.alert(`បាននាំចូល ${toAdd.length} លិខិតពី File Transfer`);
    } catch (err) {
      console.error('importFromFileTransfers failed', err);
      window.alert('មានកំហុសក្នុងការនាំចូលពី File Transfer');
    }
  };

  const closeEdit = () => {
    setShowEditModal(false);
    setEditingId(null);
    setWordMode(false);
    setSourceRecordId(null);
    setEditForm({
      reference: '',
      assignTo: '',
      participants: '',
      date: '',
      location: '',
      traditionalDate: '',
      letterNo: '',
      letterDate: '',
      sourceDoc: '',
      referenceDoc: '',
      content: '',
      others: '',
      participationDate: '',
      participationLocation: '',
    });
  };

  const pastePlainText = (e) => {
    try {
      e.preventDefault();
      const text = (e.clipboardData && e.clipboardData.getData && e.clipboardData.getData('text/plain')) || '';
      if (typeof document !== 'undefined' && document.execCommand) {
        document.execCommand('insertText', false, text);
        return;
      }
    } catch {
      // ignore
    }
  };

  const onWordFieldInput = (field) => (e) => {
    const v = (e && e.currentTarget && (e.currentTarget.innerText ?? e.currentTarget.textContent)) || '';
    setEditForm((s) => {
      const next = { ...s, [field]: String(v).replace(/\u00a0/g, ' ').trimEnd() };
      // keep legacy fields in sync when typing Word fields
      if (field === 'letterNo' && !String(next.reference || '').trim()) next.reference = next.letterNo;
      if (field === 'letterDate' && !String(next.date || '').trim()) {
        const iso = extractIsoDate(next.letterDate);
        if (iso) next.date = iso;
      }
      return next;
    });
  };

  const onCombinedHeaderInput = (e) => {
    const text = (e && e.currentTarget && (e.currentTarget.innerText ?? e.currentTarget.textContent)) || '';
    const s = String(text).replace(/\u00a0/g, ' ').trim();
    if (!s) {
      setEditForm((s0) => ({ ...s0, letterNo: '', letterDate: '', sourceDoc: '' }));
      return;
    }

    // Try to split by the Khmer word 'របស់' to extract sourceDoc
    let left = s;
    let source = '';
    const rb = 'របស់';
    const rbIndex = s.indexOf(rb);
    if (rbIndex !== -1) {
      source = s.slice(rbIndex + rb.length).trim();
      left = s.slice(0, rbIndex).trim();
    }

    // Try to find Khmer date phrase starting with 'ចុះថ្ងៃទី'
    let letter = left;
    let datePhrase = '';
    const dateMarker = 'ចុះថ្ងៃទី';
    const di = left.indexOf(dateMarker);
    if (di !== -1) {
      datePhrase = left.slice(di).trim();
      letter = left.slice(0, di).trim();
    }

    // strip common label 'លិខិតលេខ' if user included it
    letter = String(letter || '').replace(/លិខិតលេខ\s*[:\-–—]?\s*/g, '').trim();

    // clean up source leading punctuation
    source = String(source || '').replace(/^[:\s\-–—]+/, '').trim();

    setEditForm((prev) => ({
      ...prev,
      letterNo: letter || prev.letterNo,
      letterDate: datePhrase || prev.letterDate,
      sourceDoc: source || prev.sourceDoc,
      // if the combined header contains a traditional lunar phrase (look for ព.ស. or កើត), save it
      traditionalDate: (s.match(/([\u1780-\u17FF\s\d\-:.,]*?(?:កើត|ព\.ស\.|សប្តស័ក)[\u1780-\u17FF\d\s\-:.,]*)/u) || [])[0] || prev.traditionalDate,
    }));
  };

  const sanitizeFilePart = (v) => String(v || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const buildPrintHtml = (pageHtml) => {
    const fontStack = "'Khmer OS Siemreap','Noto Sans Khmer',sans-serif";
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print</title>
  <style>
    body{margin:0;background:#fff;font-family:${fontStack};}
    .page-wrap{padding:16px;}
    @page{size:A4 portrait;margin:0mm;}
    @media print{.page-wrap{padding:0;}}
  </style>
</head>
<body>
  <div class="page-wrap">${pageHtml}</div>
</body>
</html>`;
  };

  const formatAssignToHtml = (text) => {
    try {
      if (!text) return '';
      // Split on newlines and normalize
      const parts = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const items = [];
      for (let i = 0; i < parts.length; i++) {
        const line = parts[i];
        // If line starts with Khmer digit + dot (e.g., '១.'), treat as start of item
        const isNumbered = /^[\u17E0-\u17E9]+\./.test(line) || /^\d+\./.test(line);
        if (isNumbered) {
          const nameLine = line;
          const next = parts[i + 1];
          if (next && next.startsWith('ជា')) {
            items.push({ name: nameLine, role: next });
            i++; // skip next
          } else {
            items.push({ name: nameLine, role: '' });
          }
        } else {
          // If non-numbered, append as its own item
          items.push({ name: line, role: '' });
        }
      }

      // Produce HTML blocks
      return items
        .map((it) => `
          <div class="assign-item" style="margin-bottom:6px;">
            <div class="assign-name" style="display:block;">${String(it.name).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            ${it.role ? `<div class="assign-role" style="padding-left:18px;">${String(it.role).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
          </div>
        `)
        .join('');
    } catch (e) {
      return String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    }
  };

  const printWord = () => {
    const el = wordPageRef.current;
    if (!el) return;
    try {
      // Print from the same window so the UI matches wordMode (Tailwind/styles apply).
      const cleanup = () => {
        try { window.removeEventListener('afterprint', cleanup); } catch { }
        try { document.documentElement.classList.remove('printing-word'); } catch { }
      };
      try { window.addEventListener('afterprint', cleanup); } catch { }
      try { document.documentElement.classList.add('printing-word'); } catch { }
      setTimeout(() => {
        try { window.print(); } catch (e) {
          console.error('window.print failed', e);
          cleanup();
          // Fallback: popup print
          try {
            const pageHtml = el.outerHTML;
            const w = window.open('', '_blank');
            if (!w) {
              window.alert('Browser បានបិទ popup — សូមអនុញ្ញាត popup ហើយសាកល្បងម្ដងទៀត');
              return;
            }
            w.document.open();
            w.document.write(buildPrintHtml(pageHtml));
            w.document.close();
            w.focus();
            setTimeout(() => {
              try { w.print(); } catch { }
            }, 250);
          } catch (e2) {
            console.error('printWord fallback failed', e2);
            window.alert('មិនអាចព្រីនបាន');
          }
        }
      }, 50);
    } catch (e) {
      console.error('printWord failed', e);
      window.alert('មិនអាចព្រីនបាន');
    }
  };

  const exportPdf = async () => {
    try {
      const el = wordPageRef.current;
      if (!el) return;
      setExporting(true);
      const mod = await import('html2pdf.js');
      const html2pdf = mod.default || mod;

      const baseName = sanitizeFilePart(editForm.letterNo || editForm.reference || 'mission');
      const filename = `${baseName || 'mission'}.pdf`;

      const opt = {
        margin: [0, 0, 0, 0],
        filename,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(el).save();
    } catch (e) {
      console.error('exportPdf failed', e);
      window.alert('មិនអាចបង្កើត PDF បាន');
    } finally {
      setExporting(false);
    }
  };

  // Open MS Word-style mission form when coming from FileTransfer (via router state)
  useEffect(() => {
    const st = location && location.state;
    if (!st || !st.openMissionWord) return;

    try {
      setSourceRecordId(st.sourceRecordId ?? null);
      openCreate(st.prefill || {});
    } finally {
      // Clear location.state so refresh/back doesn't reopen unexpectedly.
      navigate('/missions', { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.key]);

  const saveEdit = async () => {
    const payload = {
      reference: String(editForm.reference || '').trim(),
      assignTo: String(editForm.assignTo || '').trim(),
      participants: String(editForm.participants || '').trim(),
      date: String(editForm.date || '').trim(),
      location: String(editForm.location || '').trim(),
      letterNo: String(editForm.letterNo || '').trim(),
      letterDate: String(editForm.letterDate || '').trim(),
      sourceDoc: String(editForm.sourceDoc || '').trim(),
      referenceDoc: String(editForm.referenceDoc || '').trim(),
      content: String(editForm.content || '').trim(),
      others: String(editForm.others || '').trim(),
      participationDate: String(editForm.participationDate || '').trim(),
      participationLocation: String(editForm.participationLocation || '').trim(),
    };

    if (!payload.reference && payload.letterNo) payload.reference = payload.letterNo;
    if (!payload.date && payload.letterDate) payload.date = extractIsoDate(payload.letterDate) || '';

    if (!payload.reference) {
      window.alert('សូមបញ្ចូល យោង');
      return;
    }

    if (editingId) {
      // Edit existing
      if (serverAvailable) {
        try {
          const serverPayload = { ...payload, participationDate: payload.participationDate || editForm.participationDate, participationLocation: payload.participationLocation || editForm.participationLocation, letterDate: payload.letterDate || editForm.letterDate };
          const res = await api.put(`/missions/${editingId}`, serverPayload);
          const updated = res && res.data ? res.data : null;
          if (updated) {
            const norm = { ...updated, id: updated.id || updated._id };
            setMissions((prev) => prev.map((m) => (String(m.id) === String(norm.id) ? norm : m)));
          }
        } catch (err) {
          console.error('Failed to update mission on server, falling back to local update', err);
          setMissions((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...payload } : m)));
        }
      } else {
        setMissions((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...payload } : m)));
      }
      setActiveTab('all');
      setPage(1);
      closeEdit();
      return;
    }

    // Create new
    if (serverAvailable) {
      try {
        // include participation fields
        const serverPayload = { ...payload, participationDate: payload.participationDate || editForm.participationDate, participationLocation: payload.participationLocation || editForm.participationLocation, letterDate: payload.letterDate || editForm.letterDate };
        const res = await api.post('/missions', serverPayload);
        const created = res && res.data ? res.data : null;
        if (created) {
          const norm = { ...created, id: created.id || created._id };
          setMissions((prev) => [norm, ...(Array.isArray(prev) ? prev : [])]);
          setActiveTab('all');
          setPage(1);
          closeEdit();
          return;
        }
      } catch (err) {
        console.error('Failed to create mission on server, falling back to local save', err);
        // fallthrough to local save
      }
    }

    // Local-only save fallback
    const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
    setMissions((prev) => [
      {
        id,
        ...payload,
        stage: 'S1',
        telegram: '-',
        statusKey: 'pending',
        statusText: 'រង់ចាំ',
        sourceRecordId: sourceRecordId ?? null,
        createdFrom: wordMode ? 'file-transfer' : (payload.createdFrom || 'missions'),
      },
      ...prev,
    ]);
    setActiveTab('all');
    setPage(1);
    closeEdit();
  };

  const deleteRow = (row) => {
    if (!row?.id) return;
    if (!window.confirm('លុបឯកសារនេះ?')) return;
    setMissions((prev) => prev.filter((m) => m.id !== row.id));
  };

  const sendRow = (row) => {
    if (!row?.id) return;
    const to = window.prompt('ផ្ញើទៅ (ឈ្មោះ/Telegram/អ្នកទទួល):', '');
    if (to === null) return;
    const trimmed = String(to || '').trim();

    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== row.id) return m;
        const nextTelegram = trimmed ? `បានផ្ញើទៅ: ${trimmed}` : (m.telegram || 'បានផ្ញើ');
        return { ...m, telegram: nextTelegram, statusKey: 'processing', statusText: 'កំពុង - បានផ្ញើ' };
      })
    );
  };

  const fetchHrAndFill = async (row) => {
    try {
      // Attempt to infer staffId from existing fields (assignTo may contain it)
      const infer = String(row?.assignTo || row?.participants || '') || '';
      const prefill = (infer.match(/\d{3,}/) || [])[0] || '';
      const staffId = window.prompt('បញ្ចូល Staff ID ដើម្បីទាញពី HR:', prefill);
      if (staffId === null) return;
      const s = String(staffId || '').trim();
      if (!s) {
        window.alert('សូមបញ្ចូល Staff ID');
        return;
      }

      // Try to call API to fetch HR records and find matching staffId
      // Use HRAPI.getAll() and then find matching record by staffId (backend may support direct endpoint)
      const res = await HRAPI.getAll();
      const data = (res && res.data) || res || [];
      const found = (Array.isArray(data) ? data.find((h) => String(h.staffId) === s || String(h.STAFFID) === s) : null) || null;
      if (!found) {
        window.alert('មិនឃើញបុគ្គលិកដោយ Staff ID នេះ');
        return;
      }

      // Prefer Khmer name field `NAMEKHMER` or `khmerName` or `name`
      const nameKh = found.NAMEKHMER || found.nameKhmer || found.khmerName || found.name || '';
      const dept = found.department || found.Department_Kh || found.Department || '';
      const assignText = [nameKh, dept].filter(Boolean).join(' - ');

      setMissions((prev) => prev.map((m) => (m.id === row.id ? { ...m, assignTo: assignText || m.assignTo } : m)));
      window.alert('បានទាញឈ្មោះពី HR និងបញ្ចូលទៅក្នុង `assignTo`');
    } catch (err) {
      console.error('fetchHrAndFill failed', err);
      window.alert('មានកំហុសក្នុងការទាញទិន្នន័យពី HR');
    }
  };

  const replyRow = (row) => {
    if (!row?.id) return;
    const msg = window.prompt('សរសេរមតិតប:', '');
    if (msg === null) return;
    const trimmed = String(msg || '').trim();
    if (!trimmed) return;

    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== row.id) return m;
        const existing = String(m.telegram || '').trim();
        const nextTelegram = existing ? `${existing}\nតប: ${trimmed}` : `តប: ${trimmed}`;
        return { ...m, telegram: nextTelegram, statusKey: 'done', statusText: 'រួចរាល់' };
      })
    );
  };

  const filtered = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    const tabKey = activeTab;

    return rows.filter((r) => {
      if (tabKey !== 'all' && r.statusKey !== tabKey) return false;
      if (selectedStage !== 'all' && String(r.stage || '') !== selectedStage) return false;
      if (selectedDate) {
        const d = toDateInputValue(r.date);
        if (d !== selectedDate) return false;
      }
      if (!q) return true;

      const blob = [
        r.reference,
        r.letterNo,
        r.assignTo,
        r.participants,
        r.participationLocation,
        r.location,
        r.participationDate,
        r.date,
        r.letterDate,
        r.sourceDoc,
        r.referenceDoc,
        r.content,
        r.others,
        r.telegram,
        r.statusText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(q);
    });
  }, [rows, search, activeTab, selectedStage, selectedDate]);

  const counts = useMemo(() => {
    const base = { all: rows.length };
    STATUS_TABS.forEach((t) => {
      if (t.key === 'all') return;
      base[t.key] = rows.filter((r) => r.statusKey === t.key).length;
    });
    return base;
  }, [rows]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const sortedRows = useMemo(() => {
    try {
      const arr = Array.isArray(filtered) ? [...filtered] : [];
      if (!sortBy) return arr;

      arr.sort((a, b) => {
        const getVal = (r, key) => {
          if (key === 'date') return String(r.participationDate || r.date || r.letterDate || '').toLowerCase();
          if (key === 'participationDate') return String(r.participationDate || r.date || r.letterDate || '').toLowerCase();
          if (key === 'stage') return String(r.stage || '').toLowerCase();
          if (key === 'assignTo') return String(r.assignTo || '').toLowerCase();
          if (key === 'participants') return String(r.participants || '').toLowerCase();
          if (key === 'reference') return String(r.letterNo || r.reference || '').toLowerCase();
          if (key === 'location' || key === 'participationLocation') return String(r.participationLocation || r.location || '').toLowerCase();
          return String(r[key] || '').toLowerCase();
        };

        const va = getVal(a, sortBy);
        const vb = getVal(b, sortBy);

        if (va === vb) return 0;
        return va > vb ? 1 : -1;
      });

      if (sortDir === 'desc') arr.reverse();
      return arr;
    } catch (e) {
      return filtered;
    }
  }, [filtered, sortBy, sortDir]);

  const pageRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const onSearchClick = () => {
    setPage(1);
  };

  return (
    <div className="w-full missions-page-root" style={{ ...KHMER_FONT, fontSize: '12px' }}>
      <style>{`
        @page { size: A4 portrait; margin: 0mm; }
        @media print {
          /* Print only the Word page so output matches wordMode */
          body * { visibility: hidden !important; }
          #wordPrintRoot, #wordPrintRoot * { visibility: visible !important; }
          #wordPrintRoot { position: absolute; left: 0; top: 0; }
          /* Remove modal layout constraints during print */
          .printing-word body { overflow: visible !important; }
        }
        /* Ensure table cells align at top so tall cells don't vertically offset other columns */
        table td, table th { vertical-align: top; }
        table td { word-break: break-word; }
        .missions-table { font-size: inherit; }
        .missions-table th, .missions-table td { padding-top: 6px; padding-bottom: 6px; }
      `}</style>
      <div className="mb-3">
        <div className="text-lg font-semibold text-gray-900">លិខិតបញ្ជាបេសកកម្ម</div>
        <div className="text-sm text-gray-600">បញ្ជីឯកសារ និងស្ថានភាពការអនុម័ត</div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ស្វែងរក (យោង, សូមចាត់បញ្ជូន, ចូលរួម, ទីកន្លែង...)"
            className="border border-gray-300 rounded px-3 py-2 w-72"
          />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showTelegramColumn}
              onChange={(e) => setShowTelegramColumn(e.target.checked)}
              className="h-4 w-4"
            />
            បង្ហាញ Telegram
          </label>

          <select
            value={selectedStage}
            onChange={(e) => {
              setSelectedStage(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded px-3 py-2"
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded px-3 py-2"
          />

          <button
            onClick={onSearchClick}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            ស្វែងរក
          </button>

          <div className="flex-1" />

          <label className="flex items-center gap-2 text-sm text-gray-700">
            បង្ហាញ:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          {(perms.isAdmin || perms.canEditMissions) && <button
            type="button"
            onClick={() => openFullEdit(null)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            បន្ថែមថ្មី
          </button>}
        </div>

        {/* Tabs */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((t) => {
            const isActive = activeTab === t.key;
            const count = t.key === 'all' ? counts.all : counts[t.key] || 0;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setActiveTab(t.key);
                  setPage(1);
                }}
                className={
                  isActive
                    ? 'bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-full text-sm flex items-center gap-2'
                }
              >
                <span>{t.label}</span>
                <span className={isActive ? 'bg-white/20 px-2 py-0.5 rounded-full' : 'bg-white px-2 py-0.5 rounded-full'}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="mt-3 bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse missions-table">
          <thead>
            <tr className="bg-sky-100 text-gray-800">
              <th className="border border-gray-200 px-2 py-2 text-center w-12">ល.រ</th>
              <th
                className="border border-gray-200 px-2 py-2 text-center w-15 cursor-pointer"
                onClick={() => handleSort('reference')}
              >
                យោង / លិខិតលេខ {sortBy === 'reference' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="border border-gray-200 px-2 py-2 text-center w-36 cursor-pointer"
                onClick={() => handleSort('date')}
              >
                កាលបរិច្ឆេទលិខិត {sortBy === 'date' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="border border-gray-200 px-2 py-2 text-center w-48">ប្រភពឯកសារ</th>
              <th
                className="border border-gray-200 px-2 py-2 text-center cursor-pointer"
                onClick={() => handleSort('assignTo')}
              >
                សូមចាត់បញ្ជូន {sortBy === 'assignTo' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="border border-gray-200 px-2 py-2 text-center cursor-pointer"
                onClick={() => handleSort('participants')}
              >
                ចូលរួម {sortBy === 'participants' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="border border-gray-200 px-2 py-2 text-center w-32 cursor-pointer"
                onClick={() => handleSort('participationDate')}
              >
                កាលបរិច្ឆេទចូលរួម {sortBy === 'participationDate' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                className="border border-gray-200 px-2 py-2 text-center w-40 cursor-pointer"
                onClick={() => handleSort('participationLocation')}
              >
                ទីកន្លែងចូលរួម {sortBy === 'participationLocation' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </th>
              {showTelegramColumn && (
                <th className="border border-gray-200 px-2 py-2 text-left w-40">Telegram</th>
              )}
              <th className="border border-gray-200 px-2 py-2 text-center w-10">ស្ថានភាព</th>
              {(perms.isAdmin || perms.canEditMissions) && <th className="border border-gray-200 px-2 py-2 text-center w-10">សកម្មភាព</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, idx) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-2 py-2 text-center">{(safePage - 1) * pageSize + idx + 1}</td>
                <td className="border border-gray-200 px-2 py-2">{r.reference || '-'}</td>
                <td className="border border-gray-200 px-2 py-2">{formatKhmerDateWithWeekday(r.letterDate || r.date || '') || '-'}</td>
                <td className="border border-gray-200 px-2 py-2">{r.sourceDoc || '-'}</td>
                <td className="border border-gray-200 px-2 py-2 whitespace-pre-line max-w-[260px]">{r.assignTo || '-'}</td>
                <td className="border border-gray-200 px-2 py-2 whitespace-pre-line max-w-[260px]">{r.participants || '-'}</td>
                <td className="border border-gray-200 px-2 py-2">{formatKhmerDateWithWeekday(r.participationDate || r.date || '') || '-'}</td>
                <td className="border border-gray-200 px-2 py-2">{r.participationLocation || r.location || '-'}</td>
                {showTelegramColumn && <td className="border border-gray-200 px-2 py-2 text-sm">{r.telegram || '-'}</td>}
                <td className="border border-gray-200 px-2 py-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusBadgeClass(r.statusKey)}`}>
                    {r.statusText}
                  </span>
                </td>
                {(perms.isAdmin || perms.canEditMissions) && (
                  <td className="border border-gray-200 px-2 py-2">
                    <div className="flex items-center gap-2 text-gray-600">
                      <button type="button" onClick={() => openEdit(r)} className="hover:text-blue-600" title="កែ">
                        <FaEdit />
                      </button>
                      <button type="button" onClick={() => openFullEdit(r)} className="hover:text-indigo-600" title="កែ (ពេញ)">
                        <FaUser />
                      </button>

                      <button type="button" onClick={() => sendRow(r)} className="hover:text-green-700" title="ផ្ញើ">
                        <FaPaperPlane />
                      </button>
                      <button type="button" onClick={() => replyRow(r)} className="hover:text-amber-700" title="តប">
                        <FaReply />
                      </button>
                      <button type="button" onClick={() => deleteRow(r)} className="hover:text-red-600" title="លុប">
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={showTelegramColumn ? 12 : 11}
                  className="border border-gray-200 px-2 text-center text-gray-500"
                  style={{ minHeight: 260, verticalAlign: 'middle' }}
                >
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">មិនទាន់មានទិន្នន័យ</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-gray-700">
        <div>
          បង្ហាញ {(safePage - 1) * pageSize + (pageRows.length ? 1 : 0)} - {(safePage - 1) * pageSize + pageRows.length} នៃ {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className={
              safePage === 1
                ? 'px-3 py-1 rounded border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50'
            }
          >
            Prev
          </button>
          <div className="px-3 py-1 rounded bg-blue-600 text-white">{safePage} / {totalPages}</div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className={
              safePage === totalPages
                ? 'px-3 py-1 rounded border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50'
            }
          >
            Next
          </button>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[860px] max-w-[95vw] max-h-[90vh] overflow-auto" style={KHMER_FONT}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-lg font-semibold text-gray-900">{editingId ? 'កែប្រែបេសកកម្ម' : 'បន្ថែមបេសកកម្ម'}</div>
              {wordMode && (
                <div className="flex items-center gap-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={showTemplateBg}
                        onChange={(e) => setShowTemplateBg(e.target.checked)}
                      />
                      បង្ហាញ background
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={showNationalHeader}
                        onChange={(e) => setShowNationalHeader(e.target.checked)}
                      />
                      បង្ហាញ ព្រះរាជា/ជាតិ
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={showHrPicker}
                        onChange={async (e) => {
                          const v = e.target.checked;
                          setShowHrPicker(v);
                          if (v && (!hrData || hrData.length === 0)) await fetchHrData();
                        }}
                      />
                      បង្ហាញ HR
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={printWord}
                      disabled={!wordMode}
                      className={!wordMode ? 'bg-gray-200 text-gray-400 px-3 py-1.5 rounded cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded'}
                    >
                      ព្រីន
                    </button>
                    <button
                      type="button"
                      onClick={exportPdf}
                      disabled={!wordMode || exporting}
                      className={!wordMode || exporting ? 'bg-gray-200 text-gray-400 px-3 py-1.5 rounded cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded'}
                    >
                      PDF
                    </button>
                    <button type="button" onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded">
                      រក្សាទុក
                    </button>
                    <button type="button" onClick={closeEdit} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded">
                      បោះបង់
                    </button>
                  </div>
                </div>
              )}
            </div>

            {wordMode && (
              <div className="mb-4 bg-gray-100 p-3 rounded">
                <div
                  ref={wordPageRef}
                  id="wordPrintRoot"
                  className="relative bg-white border mx-auto w-[800px] max-w-full overflow-hidden"
                  style={{ minHeight: 1111 }}
                >
                  {showTemplateBg && (
                    <img
                      src="/Uploads/miss.png"
                      alt=""
                      className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
                      draggable={false}
                    />
                  )}

                  <div className="relative z-10 px-16 pt-6 pb-24 text-[16px] leading-2">
                    <div className={`text-center font-nomal text-[18px] ${showNationalHeader ? '' : 'invisible'}`} style={{ fontFamily: 'Khmer OS Muol Light' }}>ព្រះរាជាណាចក្រកម្ពុជា</div>
                    <div className={`text-center font-nomal text-[18px] ${showNationalHeader ? '' : 'invisible'}`} style={{ fontFamily: 'Khmer OS Muol Light' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
                    <div className="text-center font-nomal text-[16px]" style={{ fontFamily: 'Khmer OS Muol Light', marginTop: 200 }}>លិខិតបញ្ជាបេសកកម្ម</div>
                    <div className="mt-1 flex justify-center">
                      <img src={logo3} alt="" className="h-[20px] w-auto object-contain" />
                    </div>

                    {showHrPicker && (
                      <div className="mt-4 p-3 border rounded bg-white text-sm text-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            value={hrSearch}
                            onChange={(e) => setHrSearch(e.target.value)}
                            placeholder="ស្វែងរក ឈ្មោះ ឬ Staff ID"
                            className="border border-gray-300 rounded px-2 py-1 w-56"
                          />
                          <select value={hrDeptFilter} onChange={(e) => setHrDeptFilter(e.target.value)} className="border border-gray-300 rounded px-2 py-1">
                            <option value="all">ទាំងអស់ ផ្នែក</option>
                            {Array.from(new Set((hrData || []).map(h => (h.Department_Kh || h.department || '').trim()).filter(Boolean))).map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <button type="button" onClick={fetchHrData} className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">Refresh</button>
                          <button
                            type="button"
                            onClick={applySelectedHrsToParticipants}
                            disabled={(selectedHrIds || []).length === 0}
                            className={(selectedHrIds || []).length === 0 ? 'bg-gray-200 text-gray-400 px-2 py-1 rounded cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded'}
                          >

                            <span className="ml-2 inline-block bg-white/5 px-2 py-0.1 rounded text-sm">{toKhmerDigits((selectedHrIds || []).length)} +</span>
                          </button>
                        </div>

                        <div style={{ maxHeight: 220, overflow: 'auto' }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-600">
                                <th className="py-1 w-8" />
                                <th className="py-1">Staff ID</th>
                                <th className="py-1">Name (KH)</th>
                                <th className="py-1">តួនាទី</th>
                                <th className="py-1">ផ្នែក</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredHr.map((h) => {
                                const id = String(h._id || h.id || h.staffId || h.STAFFID || '');
                                const nameKh = h.NAMEKHMER || h.nameKhmer || h.khmerName || h.name || '';
                                const dept = h.Department_Kh || h.department || h.Department || '';
                                const role = h.Role || h.title || h.Title || h.Position || h.position || h.jobTitle || h.JOB || '';
                                return (
                                  <tr
                                    key={id || Math.random()}
                                    className="hover:bg-gray-50 cursor-pointer"
                                    onClick={() => toggleSelectHr(h)}
                                    onDoubleClick={() => {
                                      const role = h.Role || h.title || h.Title || h.Position || h.position || h.jobTitle || h.JOB || '';
                                      const suffix = [role, dept].filter(Boolean).join(' - ');
                                      const num = toKhmerDigits(1);
                                      const assignText = `${num}. ${nameKh}` + (suffix ? `\nជា ${suffix}` : '');
                                      setEditForm((s) => ({ ...s, assignTo: assignText }));
                                      setShowHrPicker(false);
                                    }}
                                  >
                                    <td className="py-1">
                                      <input
                                        type="checkbox"
                                        checked={selectedHrIds.includes(id)}
                                        onChange={(e) => { e.stopPropagation(); toggleSelectHr(h); }}
                                        className="h-4 w-4"
                                      />
                                    </td>
                                    <td className="py-1">{h.staffId || h.STAFFID || '-'}</td>
                                    <td className="py-1">{nameKh || '-'}</td>
                                    <td className="py-1">{role || '-'}</td>
                                    <td className="py-1">{dept || '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="flex items-baseline min-w-0 w-full" style={{ marginTop: 6, fontSize: 15, fontFamily: 'Khmer OS Siemreap' }}>
                        <span className="label" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: 15, paddingLeft: 20 }}>យោង ៖</span>
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          onInput={onCombinedHeaderInput}
                          onPaste={pastePlainText}
                          className={`${wordInlineEditClass} min-w-0 break-words whitespace-pre-wrap flex-1`}
                          style={{ paddingLeft: 30, paddingRight: 0, flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                          {`លិខិតលេខ ${editForm.letterNo || editForm.reference || ''}  ${formatKhmerDateWithWeekday(editForm.letterDate || editForm.date || '')}  របស់${editForm.sourceDoc || ''}`}
                        </span>
                      </div>
                    </div>



                    <div className="mt-4">
                      <span className="label" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: 15, paddingLeft: 20 }}>សូមចាត់បញ្ជូន</span>

                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onInput={onWordFieldInput('assignTo')}
                        onPaste={pastePlainText}
                        className={`${wordBlockEditClass} mt-1 pl-6`}
                      >
                        {editForm.assignTo || ''}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[110px_20px_1fr] gap-x-3 gap-y-3">
                      <span className="label" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: 15, paddingLeft: 20 }}>ចូលរួម</span>
                      <div>៖</div>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onInput={onWordFieldInput('content')}
                        onPaste={pastePlainText}
                        className={wordBlockEditClassLg}
                      >
                        {editForm.content || ''}
                      </div>

                      <span className="label" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: 15, paddingLeft: 20 }}>កាលបរិច្ឆេទ</span>
                      <div>៖</div>
                      <div>
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onInput={onWordFieldInput('participationDate')}
                          onPaste={pastePlainText}
                          className={wordBlockEditClass}
                        >
                          {formatFullKhmerDate(editForm.participationDate || editForm.date || editForm.letterDate || '')}
                        </div>
                        <div className="text-sm text-gray-700 mt-1" style={{ fontFamily: 'Khmer OS Siemreap' }}>
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            onInput={onWordFieldInput('traditionalDate')}
                            onPaste={pastePlainText}
                            className="whitespace-pre-wrap break-words"
                            style={{ minHeight: 20 }}
                          >
                            {editForm.traditionalDate || ''}
                          </div>
                        </div>
                      </div>

                      <span className="label" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: 15, paddingLeft: 20 }}>ទីកន្លែង</span>
                      <div>៖</div>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onInput={onWordFieldInput('participationLocation')}
                        onPaste={pastePlainText}
                        className={wordBlockEditClass}
                      >
                        {editForm.participationLocation || editForm.location || ''}
                      </div>
                    </div>

                    <div className="mt-14 text-[15px]">
                      <div className="font-semibold">បញ្ជូនជូន៖</div>
                      <div className="mt-2 whitespace-pre-wrap pl-6">- ឯកសារជូនជ្រាប
                        - រក្សាទុក</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!wordMode && (
              <div className="p-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">យោង / លិខិតលេខ</label>
                    <input value={editForm.letterNo} onChange={(e) => setEditForm(s => ({ ...s, letterNo: e.target.value }))} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">កាលបរិច្ឆេទលិខិត</label>
                    <input type="date" value={toDateInputValue(editForm.letterDate)} onChange={(e) => setEditForm(s => ({ ...s, letterDate: e.target.value }))} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">ប្រភពឯកសារ</label>
                    <input value={editForm.sourceDoc} onChange={(e) => setEditForm(s => ({ ...s, sourceDoc: e.target.value }))} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">ចាត់បញ្ជូន (assignTo)</label>
                    <textarea value={editForm.assignTo} onChange={(e) => setEditForm(s => ({ ...s, assignTo: e.target.value }))} rows={4} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">អត្ថបទចូលរួម</label>
                    <textarea value={editForm.content} onChange={(e) => setEditForm(s => ({ ...s, content: e.target.value }))} rows={3} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">កាលបរិច្ឆេទចូលរួម</label>
                    <input type="date" value={toDateInputValue(editForm.participationDate)} onChange={(e) => setEditForm(s => ({ ...s, participationDate: e.target.value }))} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">ទីកន្លែងចូលរួម</label>
                    <input value={editForm.participationLocation} onChange={(e) => setEditForm(s => ({ ...s, participationLocation: e.target.value }))} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">ផ្សេងៗ</label>
                    <input value={editForm.others} onChange={(e) => setEditForm(s => ({ ...s, others: e.target.value }))} className="mt-1 block w-full border rounded px-2 py-1" />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button type="button" onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded">រក្សាទុក</button>
                  <button type="button" onClick={closeEdit} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded">បោះបង់</button>
                </div>
              </div>
            )}


          </div>
        </div>
      )}
    </div>
  );
}
