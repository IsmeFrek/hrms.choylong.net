import React, { useState, useEffect, useMemo, useRef } from 'react';
import usePermission from '../hooks/usePermission';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaEdit, FaTrash, FaPaperPlane, FaReply, FaFileAlt } from 'react-icons/fa';
import { API_BASE } from '../config';
import api from '../services/api';
import { fetchFileTransfers, createFileTransfer, updateFileTransfer, deleteFileTransfer, getFileTransfer } from '../api/fileTransfer';
import { listScans, fetchScan, deleteScan as deleteScanApi, scanNow, listDevices } from '../api/scanner';

const DEFAULT_RECIPIENT_DISPLAY = { state: 'pending', text: 'មិនទាន់មានការផ្ញើមតិ' };

// Missions (លិខិតបញ្ជាបេសកកម្ម) localStorage key is shared with /missions page
const MISSIONS_STORAGE_KEY = 'missions.data.v1';

const loadMissionsFromStorage = () => {
  try {
    const raw = localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveMissionsToStorage = (missions) => {
  try {
    localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(Array.isArray(missions) ? missions : []));
  } catch {
    // ignore
  }
};

const TELEGRAM_OTHER_LINE_RE = /^\s*\[Telegram\s*-\s*/i;

const splitLinesSafe = (v) => {
  if (!v) return [];
  return String(v).split(/\r?\n/);
};

const stripTelegramLinesFromOthers = (v) => {
  const lines = splitLinesSafe(v);
  const kept = lines.filter(l => l && !TELEGRAM_OTHER_LINE_RE.test(l));
  return kept.join('\n').trim();
};

const extractTelegramLinesFromOthers = (v) => {
  const lines = splitLinesSafe(v);
  return lines.filter(l => l && TELEGRAM_OTHER_LINE_RE.test(l));
};

const getLatestTelegramPreview = (rec) => {
  try {
    const meta = (rec && rec.meta) || {};
    const arr = meta && Array.isArray(meta.telegramFeedback) ? meta.telegramFeedback : [];
    if (arr.length > 0) {
      const last = arr[arr.length - 1] || {};
      const who = (last.userName || '').trim();
      const msg = (last.message || '').trim();
      const preview = who ? `${who}: ${msg}` : msg;
      return { preview: preview || '-', count: arr.length };
    }
    const tgLines = extractTelegramLinesFromOthers(rec && (rec.others || rec.notes));
    if (tgLines.length > 0) {
      const last = tgLines[tgLines.length - 1];
      return { preview: last, count: tgLines.length };
    }
  } catch (e) {}
  return { preview: '-', count: 0 };
};

const STAGE_NOTE_KEYS = {
  S: 'CourseNote',
  S1: 'Course1Note',
  S2: 'Course2Note',
  S3: 'Course3Note',
  S4: 'Course4Note',
  S5: 'Course5Note',
  S6: 'Course6Note'
};

const STAGE_LABELS = {
  S: 'មន្រ្តីទទួលបន្ទុក',
  S1: 'យោបល់ប្រធានការិយាល័យបច្ចេកទេស',
  S2: 'យោបល់ប្រធានការិយាល័យហិរញ្ញវត្ថុ',
  S3: 'យោបល់ប្រធានការិយាល័យរដ្ឋបាលបុគ្គលិក',
  S4: 'យោបល់នាយករងមន្ទីរពេទ្យ',
  S5: 'យោបល់នាយករងមន្ទីរពេទ្យ',
  S6: 'យោបល់នាយកមន្ទីរពេទ្យ'
};

const getStageLabel = (rec, key) => {
  if (!key) return null;
  const stageKey = String(key).toUpperCase();
  const meta = (rec && rec.meta) || {};
  const roleMap = meta && meta.feedbackStageRoles;
  const candidate = roleMap && (roleMap[stageKey.toLowerCase()] || roleMap[stageKey]);
  if (candidate && String(candidate).trim()) return String(candidate).trim();
  return STAGE_LABELS[stageKey] || `វគ្គ ${stageKey.replace(/\D/g, '') || stageKey}`;
};

// Helper functions (moved above component to avoid hoisting issues)
const getCompletedStageInfo = (rec) => {
  if (!rec) return null;
  const meta = rec.meta || {};
  const sequence = ['S6', 'S5', 'S4', 'S3', 'S2', 'S1', 'S'];
  for (const stageKey of sequence) {
    const metaKey = STAGE_NOTE_KEYS[stageKey];
    if (!metaKey) continue;
    const note = meta[metaKey];
    if (note && String(note).trim()) {
      return { stageKey, label: getStageLabel(rec, stageKey) };
    }
  }
  return null;
};

const getWaitingStageKey = (rec) => {
  try {
    if (!rec) return null;
    const meta = rec.meta || {};
    const stages = meta && meta.feedbackStages;
    const normalizedStages = {};
    if (stages && typeof stages === 'object') {
      Object.keys(stages).forEach(k => { if (k) normalizedStages[String(k).toUpperCase()] = stages[k]; });
    }
    const stageToMetaKey = {
      S: 'CourseNote', S1: 'Course1Note', S2: 'Course2Note', SD: 'Course3Note', S3: 'Course3Note', SDR: 'Course4Note', S4: 'Course4Note', S5: 'Course5Note', DIR: 'Course5Note', SDIR: 'Course5Note', S6: 'Course6Note', HO: 'Course6Note'
    };
    const order = ['S','S1','S2','SD','SDR','S3','S4','S5','S6'];
    for (const k of order) {
      const metaKey = stageToMetaKey[k];
      const metaVal = (meta && meta[metaKey]) || '';
      if (String(metaVal || '').trim() === '') {
        const raw = normalizedStages[k];
        if (!raw) continue;
        return k;
      }
    }
    return null;
  } catch (e) { return null; }
};

const resolveStageSenderByKey = (rec, stageKey, signaturesMap) => {
  try {
    if (!rec || !stageKey) return null;
    const meta = rec.meta || {};
    const stages = meta && meta.feedbackStages;
    const normalizedStages = {};
    if (stages && typeof stages === 'object') {
      Object.keys(stages).forEach(k => { if (k) normalizedStages[String(k).toUpperCase()] = stages[k]; });
    }
    const k = String(stageKey).toUpperCase();
    const raw = normalizedStages[k];
    if (!raw) {
      const roleMap = meta && meta.feedbackStageRoles;
      const roleLabel = roleMap && (roleMap[k.toLowerCase()] || roleMap[k] || roleMap[String(k).toUpperCase()]);
      return roleLabel || null;
    }
    if (typeof raw === 'object') {
      const n = raw.senderName || raw.sender || raw.name;
      if (n) return String(n).replace(/\\s*\\([^)]+\\)\\s*$/, '').trim();
      const id = raw._id || raw.id || raw.signatureId || raw.senderId || null;
      if (id && signaturesMap && signaturesMap[id]) {
        const s = signaturesMap[id];
        return (s && (s.fullNameKh || s.fullName || s.name)) || null;
      }
      return null;
    }
    if (typeof raw === 'string') {
      if (signaturesMap && signaturesMap[raw]) {
        const s = signaturesMap[raw];
        return (s && (s.fullNameKh || s.fullName || s.name)) || raw;
      }
      return raw;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Check if all feedback stages are completed for a record
const isAllStagesCompleted = (rec) => {
  if (!rec) return false;
  const meta = rec.meta || {};
  
  // Check if all required stages have notes/feedback
  const requiredStages = ['CourseNote', 'Course1Note', 'Course2Note', 'Course3Note', 'Course4Note', 'Course5Note', 'Course6Note'];
  let completedStages = 0;
  let totalAssignedStages = 0;
  
  // Count assigned stages
  const stages = meta && meta.feedbackStages;
  if (stages && typeof stages === 'object') {
    Object.keys(stages).forEach(k => {
      const stageKey = String(k).toUpperCase();
      const raw = stages[k];
      if (raw !== undefined && raw !== null && raw !== '') {
        totalAssignedStages++;
      }
    });
  }
  
  // Count completed stages that have actual feedback content
  requiredStages.forEach(metaKey => {
    const note = meta[metaKey];
    if (note && String(note).trim()) {
      completedStages++;
    }
  });
  
  // Document is considered complete if all assigned stages have feedback
  // or if we have at least 3 stages completed (minimum workflow)
  return totalAssignedStages > 0 ? completedStages >= totalAssignedStages : completedStages >= 3;
};

// Send completion report to Telegram (disabled - endpoint not implemented yet)
const sendCompletionReport = async (rec) => {
  try {
    // TODO: Implement /file-transfers/{id}/send-completion-report endpoint on backend
    // const recordId = rec._id || rec.id;
    // if (!recordId) return;
    // 
    // const response = await api.post(`/file-transfers/${recordId}/send-completion-report`);
    // 
    // if (response?.data?.success) {
    //   console.log('Completion report sent successfully for record:', recordId);
    //   return true;
    // } else {
    //   console.warn('Failed to send completion report for record:', recordId);
    //   return false;
    // }
    return false; // Feature not implemented
  } catch (error) {
    // console.error('Error sending completion report:', error);
    return false;
  }
};

export default function FileTransfer() {
  const { user: authUser } = useAuth();
  const currentCreatorName = authUser ? (authUser.fullName || authUser.name || authUser.email || authUser.username || '') : '';
    // Department units state
    const [departmentUnits, setDepartmentUnits] = useState([]);

    // Fetch department units from API
    useEffect(() => {
      fetch('/api/department-units')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setDepartmentUnits(data);
          else if (Array.isArray(data?.units)) setDepartmentUnits(data.units);
        })
        .catch(() => setDepartmentUnits([]));
    }, []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('ទាំងអស់');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRows, setTotalRows] = useState(0);

  const [showTelegramColumn, setShowTelegramColumn] = useState(() => {
    try {
      const raw = localStorage.getItem('fileTransfer.showTelegramColumn');
      if (raw === null || raw === undefined) return true;
      return raw !== '0';
    } catch (e) {
      return true;
    }
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ type: '', letterNo: '', source: '', date: '', entryNo: '', entryDate: '', entryTime: '', creatorName: currentCreatorName, qty: '', attachments: '', attachmentsFiles: [], content: '', others: '' });
  const [formErrors, setFormErrors] = useState({});

  const [showScanner, setShowScanner] = useState(false);
  const [showScannerHelp, setShowScannerHelp] = useState(false);
  const [showScannerDevicesModal, setShowScannerDevicesModal] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [scannerNameInput, setScannerNameInput] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewType, setPreviewType] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewTimeoutRef = useRef(null);
  
  // Statistics state
  const [statusFilter, setStatusFilter] = useState(null); // null, 'completed', 'notCompleted', 'noFeedback'
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [attachmentsModalList, setAttachmentsModalList] = useState([]);
  const [attachmentsModalRecordId, setAttachmentsModalRecordId] = useState(null);
  const [scannerName, setScannerName] = useState(() => { try { return localStorage.getItem('scannerName') || ''; } catch (e) { return ''; } });

  const dateInputRef = useRef(null);
  const singleDateRef = useRef(null);
  const [dateTarget, setDateTarget] = useState('entry');
  const videoRef = useRef(null);
  const [scannerFiles, setScannerFiles] = useState([]);
  const [loadingScannerFiles, setLoadingScannerFiles] = useState(false);
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [editingScan, setEditingScan] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const esRef = useRef(null);
  const [reviewMenuOpenFor, setReviewMenuOpenFor] = useState(null);
  const navigate = useNavigate();
  const perms = usePermission();

  // Missions modal (create a mission record from a file-transfer row)
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [missionSourceRecordId, setMissionSourceRecordId] = useState(null);
  const [missionForm, setMissionForm] = useState({ reference: '', assignTo: '', participants: '', date: '', location: '' });
  const [missionSaving, setMissionSaving] = useState(false);


  const [signaturesMap, setSignaturesMap] = useState({});
  // Search/filter state
  const [searchText, setSearchText] = useState("");
  // Date range filters: letter date (`r.date`) and entry date (`r.entryDate`)
  const [letterFrom, setLetterFrom] = useState('');
  const [letterTo, setLetterTo] = useState('');
  const [entryFrom, setEntryFrom] = useState('');
  const [entryTo, setEntryTo] = useState('');
  const [linkDates, setLinkDates] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('fileTransfer.showTelegramColumn', showTelegramColumn ? '1' : '0'); } catch (e) {}
  }, [showTelegramColumn]);

  // Auto-send completion reports when documents are fully completed
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    
    rows.forEach(async (row) => {
      try {
        if (isAllStagesCompleted(row)) {
          // Check if report was already sent to avoid duplicates
          const reportSent = row.meta?.completionReportSent;
          if (!reportSent) {
            console.log('Sending completion report for record:', row._id || row.id);
            const success = await sendCompletionReport(row);
            
            if (success) {
              // Update local state to mark report as sent
              setRows(prevRows => 
                prevRows.map(r => 
                  (r._id || r.id) === (row._id || row.id) 
                    ? { ...r, meta: { ...r.meta, completionReportSent: true } }
                    : r
                )
              );
            }
          }
        }
      } catch (error) {
        console.error('Error processing completion report for row:', row._id || row.id, error);
      }
    });
  }, [rows]); // Run when rows change

  // Base filtered rows (search + date filters, WITHOUT status filter) - used for type counts and status counts
  const baseFilteredRows = useMemo(() => {
    const lower = (searchText || '').trim().toLowerCase();

    const parseToTime = (v) => {
      if (!v) return null;
      try {
        // convert dd/mm/yyyy to ISO if needed
        if (typeof v === 'string' && v.includes('/')) v = parseDateToISO(v);
        const d = new Date(v);
        if (isNaN(d.getTime())) return null;
        return d.getTime();
      } catch (e) { return null; }
    };

    let letterFromT = parseToTime(letterFrom);
    let letterToT = parseToTime(letterTo);
    let entryFromT = parseToTime(entryFrom);
    let entryToT = parseToTime(entryTo);

    // If user selects only a single date (from but not to), treat it as that single day
    if (letterFromT && !letterToT) letterToT = letterFromT;
    if (entryFromT && !entryToT) entryToT = entryFromT;

    return (rows || []).filter(r => {
      // searchText match (if provided)
      if (lower) {
        const matched = [
          r.letterNo,
          r.letter_no,
          r.entryNo,
          r.entry_no,
          r.source,
          r.origin,
          r.content,
          r.description,
          r.others,
          r.notes,
          r.type,
          r.title
        ].some(val => val && String(val).toLowerCase().includes(lower));
        if (!matched) return false;
      }

      // letter date filter (r.date or created_at)
      if (letterFromT || letterToT) {
        const dVal = r.date || r.created_at || r.createdAt || null;
        const dt = parseToTime(dVal);
        if (!dt) return false;
        if (letterFromT && dt < letterFromT) return false;
        if (letterToT && dt > (letterToT + 24*60*60*1000 - 1)) return false;
      }

      // entry date filter (r.entryDate or r.entry_date)
      if (entryFromT || entryToT) {
        const eVal = r.entryDate || r.entry_date || null;
        const et = parseToTime(eVal);
        if (!et) return false;
        if (entryFromT && et < entryFromT) return false;
        if (entryToT && et > (entryToT + 24*60*60*1000 - 1)) return false;
      }

      return true;
    });
  }, [rows, searchText, letterFrom, letterTo, entryFrom, entryTo]);

  // Filtered rows with status filter applied (for display)
  const filteredRows = useMemo(() => {
    // Apply status filter if active
    if (!statusFilter) return baseFilteredRows;
    
    return baseFilteredRows.filter(row => {
      const wk = getWaitingStageKey(row);
      const completedStage = getCompletedStageInfo(row);
      
      if (statusFilter === 'completed') {
        return !wk && completedStage;
      } else if (statusFilter === 'notCompleted') {
        return wk;
      } else if (statusFilter === 'noFeedback') {
        return !wk && !completedStage;
      }
      return true;
    });
  }, [baseFilteredRows, statusFilter]);

  const canView = (perms && (perms.canViewFileTransfers || perms.canViewDocuments));
  const canEdit = (perms && (perms.canEditFileTransfers || perms.canEditDocuments));

  // granular action permissions (roles may toggle these individually)
  const canDelete = perms && (perms.any ? perms.any('delete:fileTransfers', 'delete:documents', 'edit:fileTransfers') : canEdit);
  const canSendReview = perms && (perms.any ? perms.any('send:feedback', 'edit:fileTransfers') : canEdit);
  // Reply visibility should be explicitly controlled by the reply:fileTransfers permission.
  const canReply = perms && (typeof perms.has === 'function' ? perms.has('reply:fileTransfers') : false);

  if (!canView) {
    return (<div style={{ padding: 20 }}>អ្នកមិនមានសិទ្ធិមើលទំព័រនេះទេ</div>);
  }

  const handleSendForReview = async (recordId, stage) => {
    if (!recordId) return;
    try {
      setLoading(true);
      await updateFileTransfer(recordId, { reviewStage: stage });
      // refresh rows
      const data = await fetchFileTransfers(selectedType, page, pageSize);
      setRows(Array.isArray(data) ? data : (data.items || []));
      setTotalRows((data && typeof data.total === 'number') ? data.total : (data && typeof data.count === 'number') ? data.count : (Array.isArray(data) ? data.length : (data.items || []).length));
      alert('បានផ្ញើឲ្យមានមតិ: វគ្គ ' + stage);
    } catch (err) {
      console.error('Failed to set review stage', err);
      alert('មិនអាចផ្ញើបាន — ព្យាយាមម្តងទៀត');
    } finally {
      setLoading(false);
      setReviewMenuOpenFor(null);
    }
  };

  const letterTypes = useMemo(() => (['សរុប', 'ទាំងអស់', 'លិខិតចូល', 'លិខិតចេញ', 'លិខិតចេញផ្ទៃក្នុង', 'លិខិតចូលការិយាល័យរដ្ឋបាល']), []);

  useEffect(() => { setPage(1); }, [selectedType, statusFilter]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchFileTransfers(selectedType, page, pageSize);
        if (!mounted) return;
        const items = Array.isArray(data) ? data : (data.items || []);
        setRows(items);
        const totalFromResp = (data && typeof data.total === 'number') ? data.total : (data && typeof data.count === 'number') ? data.count : items.length;
        setTotalRows(totalFromResp);
      } catch (err) { console.error(err); if (mounted) setError(err); }
      finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [selectedType, page, pageSize]);

  const parseDateToISO = (v) => {
    if (!v) return '';
    if (v.includes('/')) {
      const parts = v.split('/').map(p => p.trim());
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        return `${yyyy.padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return v;
  };

  const openMissionFromRow = (row) => {
    try {
      const recordId = row?._id ?? row?.id ?? null;
      const letterNo = String(row?.letterNo ?? row?.letter_no ?? '').trim();
      const letterDateIso = parseDateToISO(String(row?.date ?? row?.created_at ?? row?.createdAt ?? '').trim());
      let letterDate = '';
      try {
        const d = new Date(letterDateIso);
        letterDate = Number.isNaN(d.getTime()) ? (letterDateIso || '') : d.toLocaleDateString('en-GB');
      } catch {
        letterDate = letterDateIso || '';
      }
      const sourceDoc = String(row?.source ?? row?.origin ?? '').trim();

      // For "ឯកសារយោង" we pass attachment names (newline-separated) so Missions page can display them.
      let referenceDoc = '';
      try {
        const list = normalizeAttachments(row);
        if (Array.isArray(list) && list.length > 0) referenceDoc = list.map(String).join('\n');
      } catch (e) {
        referenceDoc = '';
      }

      const content = String(row?.content ?? row?.description ?? '').trim();
      const others = stripTelegramLinesFromOthers(row?.others ?? row?.notes ?? '');

      if (typeof navigate === 'function') {
        navigate('/missions', {
          state: {
            openMissionWord: true,
            sourceRecordId: recordId,
            prefill: {
              letterNo,
              letterDate,
              sourceDoc,
              referenceDoc,
              content,
              others,
            },
          },
        });
      }
    } catch (e) {
      console.error('openMissionFromRow failed', e);
      if (typeof navigate === 'function') {
        navigate('/missions', { state: { openMissionWord: true } });
      }
    }
  };

  const saveRowToMissions = (row) => {
    try {
      const recordId = row?._id ?? row?.id ?? null;
      if (!recordId) return window.alert('Record ID មិនមាន');

      const cur = loadMissionsFromStorage();
      if (cur.some((m) => String(m.sourceRecordId || '') === String(recordId))) {
        if (!window.confirm('មានលិខិតនេះរួចហើយក្នុង Missions។ តើអ្នកចង់បន្តរក្សាទុកម្តងទៀត?')) return;
      }

      const letterNo = String(row?.letterNo ?? row?.letter_no ?? row?.reference ?? '').trim();
      const parseDateToISO = (v) => {
        if (!v) return '';
        if (v.includes('/')) {
          const parts = v.split('/').map(p => p.trim());
          if (parts.length === 3) return `${parts[2].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        const d = new Date(v);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
        return '';
      };

      const letterDate = parseDateToISO(String(row?.date ?? row?.created_at ?? row?.createdAt ?? '').trim());
      const sourceDoc = String(row?.source ?? row?.origin ?? '').trim();
      let referenceDoc = '';
      try { const list = (Array.isArray(row?.attachments) && row.attachments.length) ? row.attachments.map(String) : (row?.attachments || ''); referenceDoc = Array.isArray(list) ? list.join('\n') : String(list || ''); } catch {}
      const content = String(row?.content ?? row?.description ?? '').trim();
      const others = stripTelegramLinesFromOthers(row?.others ?? row?.notes ?? '');

      const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
      const newMission = {
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
      };

      saveMissionsToStorage([newMission, ...cur]);
      // Notify other parts of the app that missions changed
      try { window.dispatchEvent(new Event('missions-updated')); } catch (e) {}

      // Open missions page in Word/modal mode with prefill so user can edit details
      try {
        if (typeof navigate === 'function') {
          navigate('/missions', {
            state: {
              openMissionWord: true,
              sourceRecordId: recordId,
              prefill: {
                letterNo: letterNo,
                letterDate: letterDate,
                sourceDoc: sourceDoc,
                referenceDoc: referenceDoc,
                content: content,
                others: others,
              },
            },
          });
        }
      } catch (e) {
        // ignore navigation failures
      }

      window.alert('បានរក្សាទុកទៅ Missions');
    } catch (e) {
      console.error('saveRowToMissions failed', e);
      window.alert('រក្សាទុកមិនបាន');
    }
  };

  const saveAttachmentToMissions = (attachmentName) => {
    try {
      const recordId = attachmentsModalRecordId;
      if (!recordId) return window.alert('Record ID មិនមាន');

      const rec = (rows || []).find(r => String(r._id || r.id) === String(recordId));
      if (!rec) return window.alert('មិនរកឃើញកំណត់ត្រា');

      const cur = loadMissionsFromStorage();
      const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
      const letterNo = String(rec?.letterNo ?? rec?.letter_no ?? rec?.reference ?? '').trim();
      const parseDateToISO_local = (v) => {
        if (!v) return '';
        if (v.includes('/')) {
          const parts = v.split('/').map(p => p.trim());
          if (parts.length === 3) return `${parts[2].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        try { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString().slice(0,10); } catch(e) {}
        return '';
      };
      const letterDate = parseDateToISO_local(String(rec?.date ?? rec?.created_at ?? rec?.createdAt ?? '').trim());
      const sourceDoc = String(rec?.source ?? rec?.origin ?? '').trim();
      const content = String(rec?.content ?? rec?.description ?? '').trim();
      const others = stripTelegramLinesFromOthers(rec?.others ?? rec?.notes ?? '');

      const newMission = {
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
        referenceDoc: String(attachmentName || ''),
        content: content,
        others: others,
        sourceRecordId: recordId,
        createdFrom: 'file-transfer',
      };

      saveMissionsToStorage([newMission, ...cur]);
      try { window.dispatchEvent(new Event('missions-updated')); } catch (e) {}

      try {
        if (typeof navigate === 'function') {
          navigate('/missions', {
            state: {
              openMissionWord: true,
              sourceRecordId: recordId,
              prefill: {
                letterNo: letterNo,
                letterDate: letterDate,
                sourceDoc: sourceDoc,
                referenceDoc: String(attachmentName || ''),
                content: content,
                others: others,
              },
            },
          });
        }
      } catch (e) {}

      window.alert('បានរក្សាទុកទៅ Missions');
    } catch (e) {
      console.error('saveAttachmentToMissions failed', e);
      window.alert('រក្សាទុកមិនបាន');
    }
  };

  const closeMissionModal = () => {
    if (missionSaving) return;
    setMissionModalOpen(false);
    setMissionSourceRecordId(null);
    setMissionForm({ reference: '', assignTo: '', participants: '', date: '', location: '' });
  };

  const saveMissionFromModal = () => {
    const payload = {
      reference: String(missionForm.reference || '').trim(),
      assignTo: String(missionForm.assignTo || '').trim(),
      participants: String(missionForm.participants || '').trim(),
      date: String(missionForm.date || '').trim(),
      location: String(missionForm.location || '').trim(),
    };

    if (!payload.reference) {
      window.alert('សូមបញ្ចូល យោង');
      return;
    }

    setMissionSaving(true);
    try {
      const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
      const newMission = {
        id,
        ...payload,
        stage: 'S1',
        telegram: '-',
        statusKey: 'pending',
        statusText: 'រង់ចាំ',
        sourceRecordId: missionSourceRecordId,
        createdFrom: 'file-transfer',
      };
      const cur = loadMissionsFromStorage();
      saveMissionsToStorage([newMission, ...(Array.isArray(cur) ? cur : [])]);
      window.alert('បានរក្សាទុកលិខិតបញ្ជាបេសកកម្ម');
      closeMissionModal();
    } catch (e) {
      console.error('saveMissionFromModal failed', e);
      window.alert('រក្សាទុកមិនបាន');
    } finally {
      setMissionSaving(false);
    }
  };

  const formatISOToDisplay = (iso) => {
    if (!iso) return '';
    try { const d = new Date(iso); if (isNaN(d.getTime())) return iso; return d.toLocaleDateString('en-GB'); } catch (e) { return iso; }
  };

  const getEntryTimeValue = (row) => row.entryTime || row.entry_time || '';
  const getEntryDateValue = (row) => row.entryDate || row.entry_date || '';
  const formatRowEntryTime = (row) => {
    const explicit = getEntryTimeValue(row);
    if (explicit) return explicit;
    const entryDateVal = getEntryDateValue(row);
    if (!entryDateVal) return '';
    try {
      const d = new Date(entryDateVal);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}
    return '';
  };
  const getCreatorDisplay = (row) => row.creatorName || row.owner || row.handler || row.current_handler || row.byName || row.sender || '';

  const clearDateFilters = () => {
    setLetterFrom(''); setLetterTo(''); setEntryFrom(''); setEntryTo('');
  };

  const clearAll = () => {
    setSearchText('');
    setSelectedType('ទាំងអស់');
    clearDateFilters();
    setLinkDates(false);
    setPage(1);
  };

  // helper: compute the first assigned stage sender who still has no saved note
  const getWaitingStageSender = (rec) => {
    try {
      if (!rec) return null;
      const meta = rec.meta || {};
      const stages = meta && meta.feedbackStages;
      // normalize stage keys
      const normalizedStages = {};
      if (stages && typeof stages === 'object') {
        Object.keys(stages).forEach(k => { if (k) normalizedStages[String(k).toUpperCase()] = stages[k]; });
      }
      const stageToMetaKey = {
        S1: 'Course1Note', S2: 'Course2Note', SD: 'Course3Note', S3: 'Course3Note', SDR: 'Course4Note', S4: 'Course4Note', S5: 'Course5Note', DIR: 'Course5Note', SDIR: 'Course5Note', S6: 'Course6Note', HO: 'Course6Note'
      };
      const order = ['S1','S2','SD','SDR','S3','S4','S5','S6'];
      // Enforce linear progression: return the earliest stage (by order) whose Course note is empty.
      // If that stage has an assigned sender, return their name (resolved via signaturesMap when possible),
      // otherwise return null so the UI shows '-' until a sender is assigned.
      for (const k of order) {
        const metaKey = stageToMetaKey[k];
        const metaVal = (meta && meta[metaKey]) || '';
        if (String(metaVal || '').trim() === '') {
          const raw = normalizedStages[k];
          // if no sender assigned for this stage, try per-record role label then continue
          if (!raw) {
            try {
              const roleMap = meta && meta.feedbackStageRoles;
              const roleLabel = roleMap && (roleMap[k.toLowerCase()] || roleMap[k] || roleMap[String(k).toUpperCase()]);
              if (roleLabel) return roleLabel;
            } catch (e) {}
            continue;
          }
          if (typeof raw === 'object') {
            const id = raw._id || raw.id || raw.signatureId || raw.senderId || null;
            if (id && signaturesMap && signaturesMap[id]) {
              const s = signaturesMap[id];
              return s.fullNameKh || s.fullName || s.name || raw.senderName || raw.sender || null;
            }
            return raw.senderName || raw.sender || raw.name || raw.byName || raw.fullName || raw.fullNameKh || null;
          }
          if (typeof raw === 'string') {
            if (signaturesMap && signaturesMap[raw]) {
              const s = signaturesMap[raw];
              return s.fullNameKh || s.fullName || s.name || raw;
            }
            return raw;
          }
          return null;
        }
      }
      // fallback to reporter/assignee fields in meta or record
      return meta && (meta.reporterName || meta.assigneeName) || rec.handler || rec.current_handler || rec.owner || null;
    } catch (e) {
      return null;
    }
  };

  // helper: return the first assigned stage sender name from feedbackStages (any assigned stage)
  const getAssignedStageSender = (rec) => {
    try {
      if (!rec) return null;
      const meta = rec.meta || {};
      const stages = meta && meta.feedbackStages;
      const normalizedStages = {};
      if (stages && typeof stages === 'object') {
        Object.keys(stages).forEach(k => { if (k) normalizedStages[String(k).toUpperCase()] = stages[k]; });
      }
      const order = ['S','S1','S2','SD','SDR','S3','S4','S5','S6'];
      for (const k of order) {
        const raw = normalizedStages[k];
        if (!raw) continue;
        if (typeof raw === 'object') {
          const n = raw.senderName || raw.sender || raw.name;
          if (n) return String(n).replace(/\s*\([^)]+\)\s*$/, '').trim();
          const id = raw._id || raw.id || raw.signatureId || raw.senderId || null;
          if (id && signaturesMap && signaturesMap[id]) {
            const s = signaturesMap[id];
            return (s && (s.fullNameKh || s.fullName || s.name)) || null;
          }
        }
        if (typeof raw === 'string') {
          // raw may be an id referencing signaturesMap
          if (signaturesMap && signaturesMap[raw]) {
            const s = signaturesMap[raw];
            return (s && (s.fullNameKh || s.fullName || s.name)) || raw;
          }
          return raw;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // load signatures map so we can resolve ids to names in the list
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/signatures?limit=500');
        const items = res?.data?.signatures || res?.data || [];
        const map = {};
        (items || []).forEach(s => { const id = s._id || s.id; if (id) map[id] = s; });
        if (mounted) setSignaturesMap(map);
      } catch (err) {
        console.warn('Failed to load signatures for list view', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleFormChange = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const openCreate = () => { setEditingId(null); setForm({ type: '', letterNo: '', source: '', date: '', entryNo: '', entryDate: '', entryTime: '', creatorName: currentCreatorName, qty: '', attachments: '', attachmentsFiles: [], content: '', others: '' }); setShowCreate(true); };

  const openEdit = async (id) => {
    if (!canEdit) { alert('អ្នកមិនមានសិទ្ធិកែសម្រួល'); return; }
    try {
      setLoading(true);
      const data = await getFileTransfer(id);
      if (data) {
        setEditingId(id);
        setForm({
          type: data.type || data.title || '',
          letterNo: data.letterNo ?? data.letter_no ?? '',
          source: data.source ?? data.origin ?? '',
          date: data.date || data.created_at || '',
          entryNo: data.entryNo ?? data.entry_no ?? '',
          entryDate: data.entryDate ?? data.entry_date ?? '',
            entryTime: data.entryTime ?? data.entry_time ?? '',
          creatorName: data.creatorName ?? data.creator_name ?? data.owner ?? currentCreatorName,
          qty: data.qty ?? data.count ?? '',
          attachments: Array.isArray(data.attachments) ? data.attachments.join(',') : (data.attachments || ''),
          attachmentsFiles: [],
          content: data.content ?? data.description ?? '',
          others: data.others || data.notes || ''
        });
        setShowCreate(true);
      }
    } catch (err) { console.error(err); alert('Failed to load item'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    if (!canEdit) { alert('អ្នកមិនមានសិទ្ធិកែសម្រួល'); return; }
    e && e.preventDefault && e.preventDefault();
    // Validate required fields (all except 'others')
    const required = ['type','letterNo','source','date','entryNo','entryDate','entryTime','qty','content'];
    const errors = {};
    required.forEach(k => {
      const v = form[k];
      if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') ) {
        errors[k] = 'សូមបំពេញវាលនេះ';
      }
    });
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      alert('សូមបំពេញគ្រប់វាលដែលមានសញ្ញាក្រហម មុនពេលបញ្ចូល');
      return;
    }
    setFormErrors({});
    try {
      setLoading(true);
      const payload = { ...form };
      if (payload.attachments && typeof payload.attachments === 'string') payload.attachments = payload.attachments.split(',').map(s => s.trim()).filter(Boolean);
      if (payload.attachmentsFiles && payload.attachmentsFiles.length > 0) {
        const toDataUrl = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
        try {
          const filesData = await Promise.all(payload.attachmentsFiles.map(f => toDataUrl(f)));
          payload.attachmentsFilesData = filesData.map((dataUrl, i) => ({ name: payload.attachmentsFiles[i].name, dataUrl }));
        } catch (err) { console.warn(err); }
        delete payload.attachmentsFiles;
      }
      if (editingId) { await updateFileTransfer(editingId, payload); setEditingId(null); }
      else { await createFileTransfer(payload); setPage(1); }
      setShowCreate(false);
      const data = await fetchFileTransfers(selectedType, page, pageSize);
      setRows(Array.isArray(data) ? data : (data.items || []));
      setTotalRows((data && typeof data.total === 'number') ? data.total : (data && typeof data.count === 'number') ? data.count : (Array.isArray(data) ? data.length : (data.items || []).length));
    } catch (err) { console.error(err); alert('មានបញ្ហា​នៅពេលបង្កើត'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!canEdit) { alert('អ្នកមិនមានសិទ្ធិលុប'); return; }
    if (!confirm('តើអ្នកប្រាកដជាចង់លុបឯកសារនេះ?')) return;
    try { setLoading(true); await deleteFileTransfer(id); const data = await fetchFileTransfers(selectedType, page, pageSize); setRows(Array.isArray(data) ? data : (data.items || [])); setTotalRows((data && typeof data.total === 'number') ? data.total : (data && typeof data.count === 'number') ? data.count : (Array.isArray(data) ? data.length : (data.items || []).length)); }
    catch (err) { console.error(err); alert('មិនអាចលុបបាន'); }
    finally { setLoading(false); }
  };

  // Compute local statistics from filtered rows (matching recipientDisplays logic)
  const localStats = useMemo(() => {
    let completed = 0;
    let notCompleted = 0;
    let noFeedback = 0;
    
    const typeBreakdown = {};
    const responsibleBreakdown = {};
    
    (filteredRows || []).forEach(row => {
      const type = row.type || row.title || row.letter_type || 'មិនកំណត់';
      
      // Use the same logic as recipientDisplays to determine status
      const wk = getWaitingStageKey(row);
      const completedStage = getCompletedStageInfo(row);
      
      let status = 'noFeedback';
      let responsible = 'មិនកំណត់';
      
      if (wk) {
        // Document is waiting for feedback (មិនទាន់រួច)
        status = 'notCompleted';
        const byKey = resolveStageSenderByKey(row, wk, signaturesMap);
        if (byKey) {
          responsible = String(byKey).replace(/\s*\([^)]+\)\s*$/, '').trim();
        } else {
          const waiting = getWaitingStageSender(row);
          if (waiting) {
            responsible = String(waiting).replace(/\s*\([^)]+\)\s*$/, '').trim();
          }
        }
      } else if (completedStage) {
        // Document is completed (រួចរាល់)
        status = 'completed';
        const actorName = resolveStageSenderByKey(row, completedStage.stageKey, signaturesMap);
        responsible = actorName ? String(actorName).replace(/\s*\([^)]+\)\s*$/, '').trim() : completedStage.label;
      } else {
        // No feedback sent (មិនមានផ្ញើមតិ)
        status = 'noFeedback';
        responsible = row.handler || row.current_handler || row.owner || row.creatorName || 'មិនកំណត់';
      }
      
      // Initialize breakdowns
      if (!typeBreakdown[type]) {
        typeBreakdown[type] = { completed: 0, notCompleted: 0, noFeedback: 0, total: 0 };
      }
      if (!responsibleBreakdown[responsible]) {
        responsibleBreakdown[responsible] = { completed: 0, notCompleted: 0, noFeedback: 0, total: 0 };
      }
      
      // Count status
      if (status === 'completed') {
        completed++;
      } else if (status === 'notCompleted') {
        notCompleted++;
      } else {
        noFeedback++;
      }
      
      // Update breakdowns
      typeBreakdown[type][status]++;
      typeBreakdown[type].total++;
      responsibleBreakdown[responsible][status]++;
      responsibleBreakdown[responsible].total++;
    });
    
    return {
      summary: {
        រួចរាល់: completed,
        មិនទាន់រួច: notCompleted,
        មិនមានផ្ញើមតិ: noFeedback,
        សរុប: (filteredRows || []).length
      },
      typeBreakdown,
      responsibleBreakdown
    };
  }, [filteredRows]); // Use filteredRows instead of rows

  // Scanner import helpers
  const RECENT_WINDOW_MS = 5 * 60 * 1000; // show files scanned in last 5 minutes
  const loadScannerFiles = async () => {
    try {
      setLoadingScannerFiles(true);
      const items = await listScans();
      const now = Date.now();
      const recent = (items || []).filter(it => (typeof it.mtime === 'number') ? (now - it.mtime) <= RECENT_WINDOW_MS : true);
      // sort newest first and keep only the single newest item
      recent.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      const newest = recent.length > 0 ? [recent[0]] : [];
      setScannerFiles(newest);
    } catch (err) {
      console.error('Failed to list scanner files', err);
      alert('មិនអាចទាញបានឯកសារពីម៉ាស៊ីនស្កែន');
    } finally {
      setLoadingScannerFiles(false);
    }
  };

  const importScan = async (name) => {
    try {
      const blob = await fetchScan(name);
      const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
      const nextFiles = (form.attachmentsFiles || []).concat(file);
      handleFormChange('attachmentsFiles', nextFiles);
      const names = (form.attachments || '').split(',').map(s => s.trim()).filter(Boolean).concat(file.name);
      handleFormChange('attachments', names.join(','));
    } catch (err) {
      console.error('Failed to import scan', err);
      alert('មិនអាចនាំចូលឯកសារបាន');
    }
  };

  const isPdfFile = (f) => {
    if (!f) return false;
    if (f.type) return f.type === 'application/pdf';
    const n = (f.name || f.url || '').toString().toLowerCase();
    return n.endsWith('.pdf');
  };

  const isImageName = (name) => {
    if (!name) return false;
    return /\.(jpe?g|png|gif|bmp|webp)$/i.test(name.toString().split('?')[0]);
  };

  // Normalize attachment input which may be a filename, a root-relative path,
  // or an encoded value like "%2FUploads%2F...". Returns a cleaned string.
  const normalizeAttachmentName = (raw) => {
    if (!raw) return '';
    let s = typeof raw === 'string' ? raw : (raw.name || raw.url || '');
    // try decoding up to two times to handle double-encoding
    try { const d1 = decodeURIComponent(s); if (d1 && d1 !== s) s = d1; } catch (e) {}
    try { const d2 = decodeURIComponent(s); if (d2 && d2 !== s) s = d2; } catch (e) {}
    return s;
  };

  const buildHrefFromAttachment = (rawName) => {
    const name = normalizeAttachmentName(rawName);
    if (!name) return null;
    // absolute URL stays absolute
    if (name.startsWith('http')) return name;
    // return a root-relative path so caller can decide API_BASE / host replacement
    if (name.startsWith('/')) return name;
    const idx = name.indexOf('/Uploads/');
    if (idx >= 0) return name.slice(idx);
    return '/Uploads/' + encodeURIComponent(name);
  };

  const getClientApiBase = () => {
    try {
      const host = window && window.location && window.location.hostname;
      if (API_BASE.includes('localhost') && host && host !== 'localhost' && host !== '127.0.0.1') {
        return API_BASE.replace('localhost', host).replace(/\/$/, '');
      }
    } catch (e) {}
    return API_BASE.replace(/\/$/, '');
  };

  const openPreview = (url, type) => {
    setPreviewUrl(url);
    setPreviewType(type || (isPdfFile({ name: url }) ? 'pdf' : 'image'));
    setPreviewLoading(true);
    setPreviewFailed(false);
    setPreviewOpen(true);
    // set a timeout to fallback for PDFs (in case iframe doesn't render)
    try { if (previewTimeoutRef.current) { clearTimeout(previewTimeoutRef.current); previewTimeoutRef.current = null; } } catch(e){}
    previewTimeoutRef.current = setTimeout(() => {
      // if still loading after timeout, mark failed; for PDFs we'll open in a new tab
      setPreviewLoading(false);
      setPreviewFailed(true);
      if (isPdfFile({ name: url })) {
        try { window.open(url, '_blank'); } catch (e) {}
        // close modal since we opened in a new tab
        setPreviewOpen(false);
      }
    }, 2000);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewUrl('');
    setPreviewType('');
    setPreviewLoading(false);
    setPreviewFailed(false);
    try { if (previewTimeoutRef.current) { clearTimeout(previewTimeoutRef.current); previewTimeoutRef.current = null; } } catch(e) {}
  };

  // Resolve an attachment name to a reachable URL by trying scanner route then /Uploads
  const resolveAttachmentUrl = async (name) => {
    if (!name) return null;
    const norm = normalizeAttachmentName(name);
    // derive a filename only portion for encoded candidates
    let filename = norm;
    // if it's root-relative starting with /Uploads/, remove leading /
    if (filename.startsWith('/')) filename = filename.replace(/^\//, '');
    // if filename contains '/Uploads/' segment, take part after Uploads/
    const uploadsIndex = filename.indexOf('Uploads/');
    if (uploadsIndex >= 0) filename = filename.slice(uploadsIndex + 'Uploads/'.length);
    const enc = encodeURIComponent(filename);
    // Try scanner route, root Uploads, then Uploads/scans (some files saved under scans/)
    const candidates = [`/kshf_hospital_app/scanner/file/${enc}`, `/Uploads/${enc}`, `/Uploads/scans/${enc}`];
    for (const c of candidates) {
      try {
        // try HEAD first
        const head = await fetch(c, { method: 'HEAD' });
        if (head && (head.status === 200 || head.status === 206)) return c;
      } catch (e) {
        // try GET with Range to avoid full download
        try {
          const get = await fetch(c, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          if (get && (get.status === 200 || get.status === 206)) return c;
        } catch (e2) {
          // ignore and try next candidate
        }
      }
    }
    return null;
  };

  const openPreviewByName = async (name, type) => {
    try {
      if (!name) { alert('មិនអាចទាញឯកសារ​មើលបាន'); return; }
      // Build an absolute href from the attachment value
      const href = buildHrefFromAttachment(name);
      // try resolving via candidates first (scanner route etc.)
      const resolved = await resolveAttachmentUrl(name);
      if (resolved) {
        const absolute = resolved.startsWith('/') ? (API_BASE.replace(/\/$/, '') + resolved) : resolved;
        openPreview(absolute, type);
        return;
      }
      if (href) { openPreview(href, type); return; }
    } catch (err) {
      console.error('openPreviewByName error', err);
      alert('មិនអាចទាញឯកសារ​មើលបាន');
    }
  };

  const openInNewTabByName = async (name) => {
    try {
      if (!name) return;
      // if already absolute, open directly
      if (typeof name === 'string' && name.startsWith('http')) { window.open(name, '_blank'); return; }
      // try resolver which will check scanner route, /Uploads, and /Uploads/scans
      const url = await resolveAttachmentUrl(name);
      if (url) {
        // if url is root-relative, make absolute to backend API
        const clientBase = getClientApiBase();
        const href = url.startsWith('/') ? (clientBase + url) : url;
        window.open(href, '_blank');
        return;
      }
      // fallback: build root-relative path then prefix client base
      const path = buildHrefFromAttachment(name);
      const clientBase = getClientApiBase();
      const fallback = path && path.startsWith('/') ? (clientBase + path) : path;
      if (fallback) window.open(fallback, '_blank');
    } catch (err) {
      console.error('openInNewTabByName error', err);
      alert('មិនអាចបើកឯកសារ​ក្នុងផ្ទាំងថ្មី');
    }
  };

  // Helper component: resolve attachment URL before rendering link
  function AttachmentLink({ name, className }) {
    const [state, setState] = useState({ status: 'loading', url: null });

    useEffect(() => {
      let mounted = true;
      if (!name) { setState({ status: 'missing', url: null }); return; }
      const tryResolve = async () => {
        try {
          const norm = normalizeAttachmentName(name);
          let filename = norm;
          if (filename.startsWith('/')) filename = filename.replace(/^\//, '');
          const uploadsIndex = filename.indexOf('Uploads/');
          if (uploadsIndex >= 0) filename = filename.slice(uploadsIndex + 'Uploads/'.length);
          const encode = encodeURIComponent(filename);
          const candidates = [`/kshf_hospital_app/scanner/file/${encode}`, `/Uploads/${encode}`];
          for (const c of candidates) {
            try {
              const res = await fetch(c, { method: 'HEAD' });
              if (res && (res.status === 200 || res.status === 206)) {
                if (!mounted) return;
                // ensure URL is absolute for the client
                const clientBase = getClientApiBase();
                const abs = c.startsWith('/') ? (clientBase + c) : c;
                setState({ status: 'ok', url: abs });
                return;
              }
            } catch (e) {
              // ignore and try next
            }
          }
          if (mounted) setState({ status: 'missing', url: null });
        } catch (err) {
          if (mounted) setState({ status: 'missing', url: null });
        }
      };
      tryResolve();
      return () => { mounted = false; };
    }, [name]);

    if (state.status === 'loading') return <span className={className || ''}><em className="text-xs text-gray-500">កំពុងពិនិត្យ…</em></span>;
    if (state.status === 'missing') return <span className={className || ''}><span className="text-xs text-red-600">ឯកសារមិនមាន</span></span>;
    return <a href={state.url} target="_blank" rel="noreferrer" className={`${className || ''} text-blue-600 underline text-xs`}>{name}</a>;
  }

  const renderAttachmentPreview = (f, i) => {
    const key = `attach-${i}`;
    // File object from input
    if (f instanceof File) {
      if (f.type && f.type.startsWith('image/')) {
        const src = URL.createObjectURL(f);
        return (
          <div key={key} className="w-20 h-20 border rounded overflow-hidden relative">
            <img src={src} alt={f.name} className="w-full h-full object-cover" />
            <button type="button" onClick={() => { const next = (form.attachmentsFiles || []).slice(); next.splice(i,1); handleFormChange('attachmentsFiles', next); }} className="absolute top-0 right-0 bg-white/80 text-red-600 text-xs px-1">x</button>
          </div>
        );
      }
      if (isPdfFile(f)) {
        const url = URL.createObjectURL(f);
        return (
          <div key={key} className="w-20 h-20 border rounded overflow-hidden relative p-2 bg-white flex flex-col items-center justify-center text-xs text-gray-700">
            <div className="text-red-600 font-bold">PDF</div>
            <a href={url} target="_blank" rel="noreferrer" className="text-[10px] truncate mt-1">{f.name}</a>
            <button type="button" onClick={() => { const next = (form.attachmentsFiles || []).slice(); next.splice(i,1); handleFormChange('attachmentsFiles', next); }} className="absolute top-0 right-0 bg-white/80 text-red-600 text-xs px-1">x</button>
          </div>
        );
      }
      // generic file
      return (
        <div key={key} className="w-20 h-20 border rounded overflow-hidden relative p-2 bg-white flex items-center justify-center text-xs text-gray-700">
          <div className="text-sm">{f.name}</div>
          <button type="button" onClick={() => { const next = (form.attachmentsFiles || []).slice(); next.splice(i,1); handleFormChange('attachmentsFiles', next); }} className="absolute top-0 right-0 bg-white/80 text-red-600 text-xs px-1">x</button>
        </div>
      );
    }

    // server-hosted item with url
    if (f && f.url) {
      if (isPdfFile(f)) {
        return (
          <div key={key} className="w-20 h-20 border rounded overflow-hidden relative p-2 bg-white flex flex-col items-center justify-center text-xs text-gray-700">
            <div className="text-red-600 font-bold">PDF</div>
            <a href={f.url} target="_blank" rel="noreferrer" className="text-[10px] truncate mt-1">{f.name || f.url}</a>
            <button type="button" onClick={() => { const next = (form.attachmentsFiles || []).slice(); next.splice(i,1); handleFormChange('attachmentsFiles', next); }} className="absolute top-0 right-0 bg-white/80 text-red-600 text-xs px-1">x</button>
          </div>
        );
      }
      // if it's an image url
      return (
        <div key={key} className="w-20 h-20 border rounded overflow-hidden relative">
          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
          <button type="button" onClick={() => { const next = (form.attachmentsFiles || []).slice(); next.splice(i,1); handleFormChange('attachmentsFiles', next); }} className="absolute top-0 right-0 bg-white/80 text-red-600 text-xs px-1">x</button>
        </div>
      );
    }

    return null;
  };

  const normalizeAttachments = (r) => {
    // r.attachments may be array, comma-separated string, URL, or stored under r.files
    let arr = [];
    if (!r) return arr;
    if (Array.isArray(r.attachments) && r.attachments.length) arr = r.attachments.slice();
    else if (typeof r.attachments === 'string' && r.attachments.trim()) {
      // split by comma if present
      if (r.attachments.indexOf(',') >= 0) arr = r.attachments.split(',').map(s => s.trim()).filter(Boolean);
      else arr = [r.attachments.trim()];
    }
    // fallback to files field
    if ((!arr || arr.length === 0) && Array.isArray(r.files) && r.files.length) arr = r.files.slice();
    // ensure URLs/strings only
    arr = (arr || []).map(a => (a && typeof a === 'string') ? a : '').filter(Boolean);
    return arr;
  };

  const openAttachmentsModal = (list, recordId = null) => {
    setAttachmentsModalList(list || []);
    setAttachmentsModalRecordId(recordId);
    setAttachmentsModalOpen(true);
  };

  const closeAttachmentsModal = () => {
    setAttachmentsModalOpen(false);
    setAttachmentsModalList([]);
  };

  // When user clicks "មើល" on the table: if single attachment, open it in a new tab;
  // if multiple attachments, open the modal.
  const handleViewAttachments = async (list, recordId = null) => {
    if (!list || list.length === 0) return;
    if (list.length === 1) {
      const a = list[0];
      try {
        await openInNewTabByName(a);
        return;
      } catch (err) { console.error('open single attachment failed', err); }
    }
    // fallback: show modal for multiple attachments (pass record id so we can delete per-file)
    openAttachmentsModal(list, recordId);
  };

  // Delete a single attachment from the record (and optionally from scanner files)
  const handleDeleteAttachment = async (name) => {
    if (!attachmentsModalRecordId) {
      // not associated with a record; just remove locally
      setAttachmentsModalList((s) => (s || []).filter(x => x !== name));
      return;
    }
    if (!confirm('តើអ្នកប្រាកដចង់លុបឯកសារនេះ?')) return;
    try {
      // 1) If the attachment is a scanner file (we can detect via kshf scanner route), issue delete
      try {
        const norm = normalizeAttachmentName(name || '');
        // if the value contains only filename or contains /Uploads/..., extract filename
        let fname = norm;
        if (fname.startsWith('/kshf_hospital_app/scanner/file/')) {
          fname = decodeURIComponent(fname.split('/').pop() || fname);
        } else if (fname.startsWith('/Uploads/') || fname.includes('/Uploads/')) {
          const idx = fname.indexOf('/Uploads/'); if (idx >= 0) fname = fname.slice(idx + '/Uploads/'.length);
        }
        // Try deleting from scanner endpoint (it will 404 if not present)
        try {
          await fetch(`/kshf_hospital_app/scanner/file/${encodeURIComponent(fname)}`, { method: 'DELETE' });
        } catch (e) {
          // ignore deletion errors for non-scanner files
        }
      } catch (e) {
        // ignore
      }

      // 2) Update record attachments by removing the item and sending updateFileTransfer
      const currentList = (attachmentsModalList || []).slice();
      const next = currentList.filter(x => x !== name);
      // send array to server
      await updateFileTransfer(attachmentsModalRecordId, { attachments: next });

      // 3) update UI
      setAttachmentsModalList(next);
      // refresh main table rows
      try {
        const data = await fetchFileTransfers(selectedType, page, pageSize);
        setRows(Array.isArray(data) ? data : (data.items || []));
        setTotalRows((data && typeof data.total === 'number') ? data.total : (data && typeof data.count === 'number') ? data.count : (Array.isArray(data) ? data.length : (data.items || []).length));
      } catch (e) { console.warn('failed to refresh rows after attachment delete', e); }
    } catch (err) {
      console.error('Failed to delete attachment', err);
      alert('មិនអាចលុបឯកសារបាន');
    }
  };

  // Download (open) all attachments for a record
  const handleDownloadAttachmentsForRecord = async (record) => {
    const list = normalizeAttachments(record);
    if (!list || list.length === 0) { alert('គ្មានឯកសារដើម្បីទាញយក'); return; }
    try {
      if (list.length === 1) {
        await openInNewTabByName(list[0]);
        return;
      }
      // open each in new tab (small delay to avoid popup blockers)
      for (let i = 0; i < list.length; i++) {
        try { await new Promise(r => setTimeout(r, 120)); await openInNewTabByName(list[i]); } catch (e) { console.warn('open attachment failed', e); }
      }
    } catch (err) {
      console.error('download attachments failed', err);
      alert('មិនអាចទាញយកឯកសារ');
    }
  };

  // Remove all attachments from a record (and attempt to delete scanner files)
  const handleRemoveAllAttachments = async (record) => {
    const id = record && (record._id || record.id);
    if (!id) return;
    if (!confirm('តើអ្នកប្រាកដចង់ដកឯកសារទាំងអស់ ចេញពីកំណត់ត្រានេះ?')) return;
    const list = normalizeAttachments(record);
    try {
      // attempt to delete scanner files where possible
      for (const a of (list || [])) {
        try {
          const norm = normalizeAttachmentName(a || '');
          let fname = norm;
          if (fname.startsWith('/kshf_hospital_app/scanner/file/')) {
            fname = decodeURIComponent(fname.split('/').pop() || fname);
          } else if (fname.startsWith('/Uploads/') || fname.includes('/Uploads/')) {
            const idx = fname.indexOf('/Uploads/'); if (idx >= 0) fname = fname.slice(idx + '/Uploads/'.length);
          }
          await fetch(`/kshf_hospital_app/scanner/file/${encodeURIComponent(fname)}`, { method: 'DELETE' }).catch(() => {});
        } catch (e) { /* ignore per-file errors */ }
      }

      // Update record attachments empty
      await updateFileTransfer(id, { attachments: [] });
      // refresh rows
      try {
        const data = await fetchFileTransfers(selectedType, page, pageSize);
        setRows(Array.isArray(data) ? data : (data.items || []));
        setTotalRows((data && typeof data.total === 'number') ? data.total : (data && typeof data.count === 'number') ? data.count : (Array.isArray(data) ? data.length : (data.items || []).length));
      } catch (e) { console.warn('failed to refresh rows after remove attachments', e); }
      // if modal open for this record, update it
      if (attachmentsModalRecordId === id) {
        setAttachmentsModalList([]);
        setAttachmentsModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to remove attachments', err);
      alert('មិនអាចដកឯកសារបាន');
    }
  };

  const triggerScanNow = async () => {
    // Open device picker modal instead of prompt
    setScannerNameInput(scannerName || '');
    try { setShowScannerDevicesModal(true); await loadDevices(); } catch (e) { setShowScannerDevicesModal(true); }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      const data = await listDevices();
      // Expecting an array of device names or objects { name }
      if (Array.isArray(data)) setDevices(data);
      else if (data && data.devices && Array.isArray(data.devices)) setDevices(data.devices);
      else setDevices([]);
    } catch (err) {
      // backend may not support listing devices — fall back to empty and allow manual entry
      console.debug('listDevices failed', err?.message || err);
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  };

  const confirmAndTriggerScan = async () => {
    setShowScannerDevicesModal(false);
    const chosen = (scannerNameInput || scannerName || '').toString().trim();
    if (!chosen) {
      alert('សូមបញ្ចូលឈ្មោះម៉ាស៊ីនស្កេនមុនចាប់ផ្ដើម');
      return;
    }
    try {
      try { localStorage.setItem('scannerName', chosen); } catch (e) {}
      setScannerName(chosen);
    } catch (_) {}
    try {
      setTriggeringScan(true);
      const res = await scanNow({ scannerName: chosen, format: 'jpg' });
      // If backend returned items, attach the newest scan to the form automatically
      if (res && Array.isArray(res.items) && res.items.length > 0) {
        const newest = res.items[0];
        try {
          const blob = await fetchScan(newest.name || newest.url || newest);
          const filename = newest.name || ('scan_' + Date.now() + '.jpg');
          const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
          // attach to current create form
          const nextFiles = (form.attachmentsFiles || []).concat(file);
          handleFormChange('attachmentsFiles', nextFiles);
          const names = (form.attachments || '').split(',').map(s => s.trim()).filter(Boolean).concat(file.name);
          handleFormChange('attachments', names.join(','));
          alert('ស្កេនបានបញ្ចប់ និងភ្ជាប់ទៅទំរង់');
        } catch (e) {
          console.error('Attach after scan failed', e);
          await loadScannerFiles();
          alert('ស្កេនបញ្ហា — ទាញបញ្ជីឯកសារ ដើម្បីភ្ជាប់ដោយដៃ');
        }
      } else {
        // fallback to listing
        await loadScannerFiles();
        alert('ស្កេនបានបញ្ចប់ — ជ្រើសឯកសារដើម្បីភ្ជាប់');
      }
    } catch (err) {
      console.error('Failed to trigger scan', err);
      alert('មិនអាចចាប់ផ្ដើមស្កេនបាន');
    } finally {
      setTriggeringScan(false);
    }
  };

  const handleDeleteScan = async (name) => {
    if (!confirm('តើអ្នកប្រាកដចង់លុបឯកសារនេះពីម៉ាស៊ីនស្កេន?')) return;
    try {
      setLoadingScannerFiles(true);
      await deleteScanApi(name);
      setScannerFiles((s) => s.filter(x => x.name !== name));
    } catch (err) {
      console.error('Failed to delete scan', err);
      alert('មិនអាចលុបឯកសារបាន');
    } finally {
      setLoadingScannerFiles(false);
    }
  };

  // Open SSE stream while the Create modal is visible to receive new-scan events
  useEffect(() => {
    if (!showCreate) {
      // ensure closed
      if (esRef.current) {
        try { esRef.current.close(); } catch(e) {}
        esRef.current = null;
      }
      return;
    }

    // create EventSource
    try {
      const es = new EventSource('/kshf_hospital_app/scanner/stream');
      esRef.current = es;
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data && data.type === 'new-scan' && data.item) {
            setScannerFiles((s) => {
              // avoid duplicates
              if (s.find(x => x.name === data.item.name)) return s;
              return [data.item].concat(s);
            });
          }
        } catch (e) {
          // ignore ping or malformed
        }
      };
      es.onerror = (err) => {
        // if connection fails, close and allow manual reload
        try { es.close(); } catch (e) {}
        esRef.current = null;
      };
    } catch (err) {
      console.warn('SSE not available', err);
    }

    return () => {
      if (esRef.current) {
        try { esRef.current.close(); } catch(e) {}
        esRef.current = null;
      }
    };
  }, [showCreate]);

  const typeCounts = useMemo(() => {
    const map = {};
    baseFilteredRows.forEach((r) => { const t = (r.type || r.title || r.letter_type || r.category || '').toString(); if (!t) return; map[t] = (map[t] || 0) + 1; });
    const result = {};
    letterTypes.forEach((lt) => { if (lt === 'សរុប' || lt === 'ទាំងអស់') result[lt] = baseFilteredRows.length; else result[lt] = map[lt] || 0; });
    return result;
  }, [baseFilteredRows, letterTypes]);

  // Decide when to use client-side filtering (use filteredRows) vs server-side (use rows)
  const useClientFiltering = Boolean(statusFilter || (searchText || '').trim() || letterFrom || letterTo || entryFrom || entryTo || (selectedType && selectedType !== 'ទាំងអស់'));
  // Use totalRows for server-side pagination, but use filteredRows.length if client-side filtering is active
  const effectiveTotal = useClientFiltering ? filteredRows.length : totalRows;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const startDisplay = effectiveTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const endDisplay = Math.min(page * pageSize, effectiveTotal);

  // precompute recipient display strings keyed by record id so filteredRows can look them up reliably
  const recipientDisplays = useMemo(() => {
    try {
      const map = {};
      (rows || []).forEach((r, i) => {
        const key = (r && (r._id || r.id)) || `idx-${i}`;
        try {
          const wk = getWaitingStageKey(r);
          if (wk) {
            const byKey = resolveStageSenderByKey(r, wk, signaturesMap);
            if (byKey) {
              map[key] = { state: 'waiting', text: String(byKey).replace(/\s*\([^)]+\)\s*$/, '').trim() };
              return;
            }
            const waiting = getWaitingStageSender(r);
            if (waiting) {
              map[key] = { state: 'waiting', text: String(waiting).replace(/\s*\([^)]+\)\s*$/, '').trim() };
              return;
            }
          }
          const completedStage = getCompletedStageInfo(r);
          if (completedStage) {
            const actorName = resolveStageSenderByKey(r, completedStage.stageKey, signaturesMap);
            const displayText = actorName || completedStage.label;
            map[key] = { state: 'completed', text: displayText ? String(displayText).replace(/\s*\([^)]+\)\s*$/, '').trim() : 'រួចរាល់' };
            return;
          }
          map[key] = { ...DEFAULT_RECIPIENT_DISPLAY };
        } catch (e) {
          map[key] = { ...DEFAULT_RECIPIENT_DISPLAY };
        }
      });
      return map;
    } catch (e) { return {}; }
  }, [rows, signaturesMap]);

  // Determine which rows to actually display in the table depending on client/server filtering
  const displayedRows = useMemo(() => {
    // Sort by numeric entry number (`entryNo` / `entry_no`) ascending.
    // If entry number is missing or not numeric, push it to the end.
    const parseEntryNo = (r) => {
      if (!r) return Infinity;
      const raw = r.entryNo ?? r.entry_no ?? '';
      if (raw === null || raw === undefined) return Infinity;
      const s = String(raw).trim();
      if (!s) return Infinity;
      // extract digits from the entry string (handles leading zeros)
      const digits = s.replace(/[^0-9]/g, '');
      if (!digits) return Infinity;
      const n = parseInt(digits, 10);
      return Number.isFinite(n) ? n : Infinity;
    };

    // sort numeric entry number descending (largest first)
    const sortByEntryNoDesc = (a, b) => {
      const na = parseEntryNo(a);
      const nb = parseEntryNo(b);
      if (na === nb) return 0;
      return nb - na;
    };

    if (useClientFiltering) {
      const copy = (filteredRows || []).slice();
      copy.sort(sortByEntryNoDesc);
      const start = (page - 1) * pageSize;
      const end = page * pageSize;
      return copy.slice(start, end);
    }

    // server-driven rows (already paged) - but sort client-side by entry number so ordering matches UI
    return (rows || []).slice().sort(sortByEntryNoDesc);
  }, [useClientFiltering, filteredRows, rows, page, pageSize]);

  // ...existing code... (removed stats array for summary boxes)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-[18px] font-semibold">ផ្ទេរឯកសារ</h4>
          <p className="text-sm text-gray-500">បញ្ជីឯកសារ និងស្ថានភាព</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="ស្វែងរក (ឈ្មោះ, លេខសម្គាល់)"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <label className="text-sm flex items-center gap-2 select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showTelegramColumn}
              onChange={(e) => setShowTelegramColumn(e.target.checked)}
            />
            បង្ហាញសារពី Telegram
          </label>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-600">:</div>
            <select className="border rounded px-2 py-1 text-sm" value={dateTarget} onChange={e => setDateTarget(e.target.value)}>
              <option value="entry">កាលបរិច្ឆេទចូល</option>
              <option value="letter">កាលបរិច្ឆេទលិខិត</option>
            </select>
            <div className="relative">
              <input ref={singleDateRef} type="date" className="border rounded px-2 py-1 text-sm" value={dateTarget === 'letter' ? letterFrom : entryFrom} onChange={e => {
                const v = e.target.value;
                if (dateTarget === 'letter') { setLetterFrom(v); if (linkDates) setEntryFrom(v); }
                else { setEntryFrom(v); if (linkDates) setLetterFrom(v); }
                setPage(1);
              }} />
              <button type="button" aria-label="Open date picker" onClick={() => { const el = singleDateRef.current; if (!el) return; if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch (e) { el.focus(); } } else { el.focus(); } }} className="absolute right-1 top-1/2 -translate-y-1/2 bg-transparent border rounded px-2 py-0.5 text-gray-600 hover:bg-gray-100">📅</button>
            </div>
          </div>
          <button type="button" onClick={clearAll} className="ml-2 bg-red-400 text-sm px-3 py-2 rounded">សម្អាត</button>
          <select className="border rounded px-3 py-2 text-sm" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            {letterTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">ឯកសារ ថ្មី</button>
        </div>
      </div>

      {/* Create / Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white rounded shadow p-6 w-full max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">{editingId ? 'កែប្រែឯកសារ' : 'បង្កើតឯកសារ'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <select className="border px-3 py-2 col-span-2" value={form.type} onChange={(e) => handleFormChange('type', e.target.value)}>
                <option value="">-- ប្រភេទលិខិត (ជ្រើស) --</option>
                {letterTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {formErrors.type && <div className="col-span-2 text-red-600 text-sm">{formErrors.type}</div>}
              {/* Row: លេខលិខិត + កាលបរិច្ឆេទលិខិត */}
              <input className="border px-3 py-2" placeholder="លេខលិខិត" value={form.letterNo} onChange={(e) => handleFormChange('letterNo', e.target.value)} />
              {formErrors.letterNo && <div className="text-red-600 text-sm">{formErrors.letterNo}</div>}
              <div className="relative">
                <input ref={dateInputRef} type="date" className="border px-3 py-2 w-full" value={form.date || ''} onChange={(e) => handleFormChange('date', parseDateToISO(e.target.value))} />
                {!form.date && (<div className="pointer-events-none absolute left-3 top-0 bottom-0 flex items-center text-gray-400 select-none">dd/mm/yyyy</div>)}
                <button type="button" aria-label="Open date picker" onClick={() => { const el = dateInputRef.current; if (!el) return; if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch (e) { el.focus(); } } else { el.focus(); } }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border rounded px-2 py-1 text-gray-600 hover:bg-gray-100">📅</button>
              </div>
              {/* Row: លេខចូល + កាលបរិច្ឆេទចូល */}
              <input className="border px-3 py-2" placeholder="លេខចូល" value={form.entryNo} onChange={(e) => handleFormChange('entryNo', e.target.value)} />
              {formErrors.entryNo && <div className="text-red-600 text-sm">{formErrors.entryNo}</div>}
              <div className="relative">
                <input type="date" className="border px-3 py-2 w-full" value={form.entryDate || ''} onChange={(e) => handleFormChange('entryDate', parseDateToISO(e.target.value))} />
                {!form.entryDate && (<div className="pointer-events-none absolute left-3 top-0 bottom-0 flex items-center text-gray-400 select-none">dd/mm/yyyy</div>)}
                {formErrors.entryDate && <div className="text-red-600 text-sm">{formErrors.entryDate}</div>}
              </div>
              <div className="relative">
                <input type="time" className="border px-3 py-2 w-full" value={form.entryTime || ''} onChange={(e) => handleFormChange('entryTime', e.target.value)} />
                {formErrors.entryTime && <div className="text-red-600 text-sm">{formErrors.entryTime}</div>}
              </div>
              <div className="flex flex-col gap-1">
            
                <input type="text" className="border px-3 py-2 w-full bg-gray-50 text-sm" value={form.creatorName || currentCreatorName} readOnly />
              </div>
              {/* Row: ប្រភពឯកសារ (creatable/autocomplete) + ចំនួន */}
              <div className="relative">
                <input
                  className="border px-3 py-2 w-full"
                  list="department-units-list"
                  placeholder="-- ជ្រើសរើស ឬ បញ្ចូលប្រភពឯកសារ --"
                  value={form.source}
                  onChange={async (e) => {
                    const val = e.target.value;
                    handleFormChange('source', val);
                  }}
                  onBlur={async (e) => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    // If not in departmentUnits, add it
                    if (!departmentUnits.some(u => u.name === val)) {
                      try {
                        const res = await fetch('/api/department-units', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: val })
                        });
                        if (res.ok) {
                          // Refresh department units
                          fetch('/api/department-units')
                            .then(res => res.json())
                            .then(data => {
                              if (Array.isArray(data)) setDepartmentUnits(data);
                              else if (Array.isArray(data?.units)) setDepartmentUnits(data.units);
                            });
                        }
                      } catch {}
                    }
                  }}
                />
                {formErrors.source && <div className="text-red-600 text-sm">{formErrors.source}</div>}
                <datalist id="department-units-list">
                  {departmentUnits.map((item, idx) => (
                    <option key={item._id || item.id || idx} value={item.name}>{item.name}{item.description ? ` - ${item.description}` : ''}</option>
                  ))}
                </datalist>
              </div>
              <input className="border px-3 py-2" placeholder="ចំនួន" type="number" value={form.qty} onChange={(e) => handleFormChange('qty', Number(e.target.value))} />
              {formErrors.qty && <div className="text-red-600 text-sm">{formErrors.qty}</div>}
              {/* Row: Attachments (col-span-2) */}
              <div className="col-span-2">
                <label className="block text-sm text-gray-700 mb-1">ឯកសារយោង (រូបភាព/PDF)</label>
                <div className="flex items-center gap-4">
                  <input type="file" multiple onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    setUploadingFiles(true);
                    try {
                      const uploaded = [];
                      for (const f of files) {
                        try {
                          const fd = new FormData();
                          fd.append('file', f, f.name);
                          const res = await fetch('/api/upload', { method: 'POST', body: fd });
                          if (!res.ok) {
                            console.warn('Upload failed for', f.name);
                            continue;
                          }
                          const data = await res.json().catch(() => null);
                          if (data && data.url) uploaded.push(data.url);
                        } catch (err) { console.warn('Upload error', err); }
                      }
                      // merge into attachments (keep only URLs)
                      const existing = (form.attachments && typeof form.attachments === 'string') ? form.attachments.split(',').map(s=>s.trim()).filter(Boolean) : (Array.isArray(form.attachments) ? form.attachments.slice() : []);
                      const final = existing.filter(a => a && (a.startsWith('/') || a.startsWith('http'))).concat(uploaded);
                      handleFormChange('attachments', final.join(','));
                      // clear attachmentsFiles since we've uploaded them to server
                      handleFormChange('attachmentsFiles', []);
                    } finally { setUploadingFiles(false); }
                  }} />
                  {uploadingFiles && <span className="text-sm text-gray-500">កំពុងផ្ទុក...</span>}
                  <button type="button" className="text-sm px-3 py-1 border rounded" onClick={triggerScanNow} disabled={triggeringScan}>{triggeringScan ? 'កំពុងស្កេន...' : 'ស្កេនឥឡូវ'}</button>
                </div>
                {/* Scanner files available on server */}
                {scannerFiles && scannerFiles.length > 0 && (
                  <div className="mt-2 p-2 border rounded bg-gray-50">
                    <div className="text-xs text-gray-600 mb-1">ឯកសារដែលបានស្កេន (កើតឡើងថ្មី):</div>
                    <div className="flex flex-col gap-2">
                      {scannerFiles.map((sf) => (
                        <div key={sf.name} className="flex items-center justify-between">
                          <div className="text-sm truncate">
                            {editingScan === sf.name ? (
                              <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="border px-2 py-1 text-sm w-64" />
                            ) : (
                              sf.name
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {editingScan === sf.name ? (
                              <>
                                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={async () => {
                                  try {
                                    const newName = (renameValue || '').trim();
                                    if (!newName) { alert('សូមបញ្ចូលឈ្មោះថ្មី'); return; }
                                    const res = await (await import('../api/scanner')).renameScan(sf.name, newName);
                                    if (res && res.success) {
                                      setScannerFiles((s) => s.map(it => it.name === sf.name ? res.item : it));
                                      setEditingScan(null);
                                    }
                                  } catch (err) { console.error(err); alert(err && err.message ? err.message : 'មិនអាចប្តូរឈ្មោះបាន'); }
                                }}>រក្សាទុក</button>
                                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => { setEditingScan(null); setRenameValue(''); }}>បោះបង់</button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => importScan(sf.name)}>នាំចូល</button>
                                <a className="text-xs text-blue-600" href={sf.url} target="_blank" rel="noreferrer">មើល</a>
                                <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => { setEditingScan(sf.name); setRenameValue(sf.name); }}>កែឈ្មោះ</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-2 flex gap-2 items-center">
                  {(form.attachmentsFiles || []).map((f, i) => renderAttachmentPreview(f, i))}
                </div>
              </div>
              {/* Row: ខ្លឹមសារ (col-span-2) */}
              <div className="col-span-2"><textarea className="border w-full p-2 h-36" placeholder="ខ្លឹមសារ" value={form.content} onChange={(e) => handleFormChange('content', e.target.value)} /></div>
              {formErrors.content && <div className="col-span-2 text-red-600 text-sm">{formErrors.content}</div>}
              {/* Row: ផ្សេងៗ (col-span-2) */}
              <div className="col-span-2"><input className="border px-3 py-2 w-full" placeholder="ផ្សេងៗ" value={form.others} onChange={(e) => handleFormChange('others', e.target.value)} /></div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {
                // compute simple validity: all required fields (except 'others') must be present
              }
              {(() => {
                const required = ['type','letterNo','source','date','entryNo','entryDate','entryTime','qty','content'];
                const ok = required.every(k => {
                  const v = form[k];
                  return !(v === null || v === undefined || (typeof v === 'string' && v.trim() === ''));
                });
                return (
                  <button type="submit" disabled={!ok} className={`px-4 py-2 bg-blue-600 text-white rounded ${!ok ? 'opacity-50 cursor-not-allowed' : ''}`}>បញ្ចូល</button>
                );
              })()}
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-2 border rounded">បិទ</button>
            </div>
          </form>
        </div>
      )}

      {/* Preview modal for image / pdf */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center">
          <div className="bg-white rounded shadow-lg max-w-4xl w-full max-h-[90vh] overflow-auto p-3">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-semibold">មើលឯកសារ</div>
              <button onClick={closePreview} className="text-sm px-2">បិទ</button>
            </div>
            <div className="w-full h-[80vh] flex items-center justify-center">
              {previewType === 'image' && (
                <img src={previewUrl} alt="preview" className="max-w-full max-h-[80vh] object-contain" onLoad={() => { setPreviewLoading(false); if (previewTimeoutRef.current) { clearTimeout(previewTimeoutRef.current); previewTimeoutRef.current = null; } }} onError={() => { setPreviewLoading(false); setPreviewFailed(true); }} />
              )}
              {previewType === 'pdf' && (
                <iframe src={previewUrl} title="pdf-preview" className="w-full h-[80vh] border" onLoad={() => { setPreviewLoading(false); if (previewTimeoutRef.current) { clearTimeout(previewTimeoutRef.current); previewTimeoutRef.current = null; } }} onError={() => { setPreviewLoading(false); setPreviewFailed(true); }} />
              )}
              {!previewType && previewUrl && (
                <iframe src={previewUrl} title="file-preview" className="w-full h-[80vh] border" onLoad={() => { setPreviewLoading(false); if (previewTimeoutRef.current) { clearTimeout(previewTimeoutRef.current); previewTimeoutRef.current = null; } }} onError={() => { setPreviewLoading(false); setPreviewFailed(true); }} />
              )}
              {previewLoading && (
                <div className="absolute text-sm text-gray-500">កំពុងផ្ទុក...</div>
              )}
              {previewFailed && (
                <div className="absolute text-sm text-red-600">មិនអាចបង្ហាញឯកសារ — បានបើកក្នុងទំព័រ​ថ្មី។</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera scanner modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-white p-4 rounded shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Scan (Camera)</h3>
              <button onClick={() => { try { const s = videoRef.current?.srcObject; if (s) { s.getTracks().forEach(t => t.stop()); } } catch (e) {} setShowScanner(false); }} className="text-sm px-2">បិទ</button>
            </div>
            <div className="w-full h-64 bg-black flex items-center justify-center"><video ref={videoRef} className="w-full h-full object-cover" /></div>
            <div className="mt-3 flex justify-end gap-2">
                    <button onClick={async () => {
                      const video = videoRef.current; if (!video) return;
                      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720; const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                      canvas.toBlob((blob) => {
                        if (!blob) return;
                        const file = new File([blob], `scan-${Date.now()}.jpg`, { type: blob.type });
                        const nextFiles = (form.attachmentsFiles || []).concat(file);
                        handleFormChange('attachmentsFiles', nextFiles);
                        const names = (form.attachments || '').split(',').map(s => s.trim()).filter(Boolean).concat(file.name);
                        handleFormChange('attachments', names.join(','));
                        try { const s = videoRef.current?.srcObject; if (s) { s.getTracks().forEach(t => t.stop()); } } catch (e) {}
                        setShowScanner(false);
                      }, 'image/jpeg', 0.9);
                    }} className="px-4 py-2 bg-blue-600 text-white rounded">Capture</button>
              <button onClick={() => { try { const s = videoRef.current?.srcObject; if (s) { s.getTracks().forEach(t => t.stop()); } } catch (e) {} setShowScanner(false); }} className="px-3 py-2 border rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}

            {/* Scanner Devices modal */}
            {showScannerDevicesModal && (
              <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, width: '100%', maxWidth: 420, boxShadow: '0 6px 40px rgba(0,0,0,0.3)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">ជ្រើសម៉ាស៊ីនស្កែន (Scanner)</h3>
                    <button onClick={() => setShowScannerDevicesModal(false)} className="text-sm px-2">បិទ</button>
                  </div>
                  <div className="space-y-3">
                    {loadingDevices ? (
                      <div>កំពងโหลดម៉ាស៊ីន...</div>
                    ) : (
                      <div>
                        {devices && devices.length > 0 ? (
                          <div>
                            <label className="text-sm block mb-1">ម៉ាស៊ីនដែលរកឃើញ</label>
                            <select className="w-full border rounded px-2 py-2" value={scannerNameInput} onChange={e => setScannerNameInput(e.target.value)}>
                              <option value="">-- ជ្រើស --</option>
                              {devices.map((d, i) => {
                                const name = (typeof d === 'string') ? d : (d.name || d.device || JSON.stringify(d));
                                return <option key={i} value={name}>{name}</option>;
                              })}
                            </select>
                            <div className="text-xs text-gray-500 mt-1">ឬ បញ្ចូលឈ្មោះម៉ាស៊ីនដោយដៃ</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">មិនមានម៉ាស៊ីនដែល.backend រួចរាល់ — អ្នកអាចបញ្ចូលឈ្មោះដោយដៃ</div>
                        )}
                        <div>
                          <label className="text-sm block mt-2">ឈ្មោះម៉ាស៊ីន (manual)</label>
                          <input className="w-full border rounded px-2 py-2" value={scannerNameInput} onChange={e => setScannerNameInput(e.target.value)} placeholder="ឈ្មោះម៉ាស៊ីន (ឧ. HP Scan)" />
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setShowScannerDevicesModal(false)} className="px-3 py-1 border rounded">Cancel</button>
                      <button onClick={confirmAndTriggerScan} className="px-3 py-1 bg-blue-600 text-white rounded">Scan</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

      {/* Attachments modal (list + previews) */}
      {attachmentsModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center">
          <div className="bg-white rounded shadow-lg max-w-3xl w-full max-h-[90vh] overflow-auto p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">ឯកសារ</h3>
              <button onClick={closeAttachmentsModal} className="text-sm px-2">បិទ</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {attachmentsModalList && attachmentsModalList.length > 0 ? attachmentsModalList.map((a, i) => {
                // compute default href (handles encoded values and /Uploads/ path)
                const clientBase = getClientApiBase();
                const pathOrUrl = buildHrefFromAttachment(a);
                const defaultHref = (typeof a === 'string' && a.startsWith('http')) ? a : (pathOrUrl && pathOrUrl.startsWith('http') ? pathOrUrl : (pathOrUrl ? clientBase + pathOrUrl : ''));
                return (
                  <div key={i} className="border rounded p-2 flex flex-col items-center">
                    {isImageName(a) ? (
                      <button type="button" onClick={() => openInNewTabByName(a)} className="w-full h-32 overflow-hidden mb-2"><img src={defaultHref} alt={a} className="w-full h-full object-cover" /></button>
                    ) : isPdfFile({ name: a }) ? (
                      <div className="w-full mb-2 text-sm text-gray-700">{a}</div>
                    ) : (
                      <div className="w-full mb-2 text-sm text-gray-700 truncate">{a}</div>
                    )}
                    <div className="flex gap-2 items-center">
                      <button type="button" onClick={() => openInNewTabByName(a)} className="text-blue-600 text-xs">មើល</button>
                      <button type="button" onClick={() => saveAttachmentToMissions(a)} className="text-indigo-600 text-xs">រក្សាទុកជា Missions</button>
                    </div>
                  </div>
                );
              }) : <div className="col-span-3 text-sm text-gray-500">គ្មានឯកសារ</div>}
            </div>
          </div>
        </div>
      )}

      {/* Scanner help modal */}
      {showScannerHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-white p-4 rounded shadow-lg w-full max-w-2xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">វិធីស្កេនពីម៉ាស៊ីន (Manual)</h3>
              <button onClick={() => setShowScannerHelp(false)} className="text-sm px-2">បិទ</button>
            </div>
            <div className="text-sm text-gray-800 space-y-3">
              <p>ម៉ាស៊ីនស្កែនដែលអ្នកបានស្គាល់: <strong>{scannerName || 'មិនបានកំណត់'}</strong></p>
              <ol className="list-decimal pl-5">
                <li>បើកកម្មវិធីស្កែន (ឧ. HP Scan, NAPS2 ឬកម្មវិធីអ្នកប្រើសាកល)</li>
                <li>ជ្រើសម៉ាស៊ីន: <em>{scannerName || '(វាយឈ្មោះនៅលើម៉ាស៊ីន)'}</em></li>
                <li>កំណត់ Quality/សុង/ទំព័រជាចាំបាច់ → ស្កេន និងរក្សាទុកជា JPG ឬ PDF</li>
                <li>នៅក្នុង UI នេះ ចុច <strong>Choose Files</strong> ហើយជ្រើសឯកសារ</li>
                <li>ឬ ប្រើ NAPS2 CLI/PowerShell ដើម្បី automate ស្កេនទៅថត ហើយ upload ពីថតនោះ</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-2 max-w-[100%]">
          {letterTypes.filter(t => t !== 'សរុប').map((t) => {
            const active = selectedType === t;
            const count = typeCounts[t] ?? 0;
            return (
              <button key={t} onClick={() => setSelectedType(t)} className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm border transition-colors whitespace-nowrap ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                <span>{t}</span>
                <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${active ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        
        {/* Responsible Status Filter Buttons */}
        <div className="flex flex-wrap gap-2 max-w-[100%]">
          <span className="text-sm text-gray-600 self-center mr-2">អ្នកទទួលបន្ទុក:</span>
          <button 
            onClick={() => setStatusFilter(null)} 
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm border transition-colors whitespace-nowrap ${
              !statusFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>ទាំងអស់</span>
            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
              !statusFilter ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}>{localStats.summary?.សរុប || 0}</span>
          </button>
          
          <button 
            onClick={() => setStatusFilter(statusFilter === 'completed' ? null : 'completed')} 
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm border transition-colors whitespace-nowrap ${
              statusFilter === 'completed' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>រួចរាល់</span>
            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
              statusFilter === 'completed' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}>{localStats.summary?.រួចរាល់ || 0}</span>
          </button>
          
          <button 
            onClick={() => setStatusFilter(statusFilter === 'notCompleted' ? null : 'notCompleted')} 
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm border transition-colors whitespace-nowrap ${
              statusFilter === 'notCompleted' ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>មិនទាន់រួច</span>
            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
              statusFilter === 'notCompleted' ? 'bg-yellow-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}>{localStats.summary?.មិនទាន់រួច || 0}</span>
          </button>
          
          <button 
            onClick={() => setStatusFilter(statusFilter === 'noFeedback' ? null : 'noFeedback')} 
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm border transition-colors whitespace-nowrap ${
              statusFilter === 'noFeedback' ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>មិនមានផ្ញើមតិ</span>
            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
              statusFilter === 'noFeedback' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}>{localStats.summary?.មិនមានផ្ញើមតិ || 0}</span>
          </button>
        </div>
        
        <div className="flex items-center">
          <label className="mr-2 text-sm">បង្ហាញ:</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {[10, 15, 20, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="ml-2 text-sm">ជួរ</span>
        </div>
      </div>

      {/* ...moved page size dropdown inline with letter type filter... */}
      <div className="bg-white border rounded">
        <div className="overflow-x-auto">
          <style>{`.filetransfer-table tbody tr:nth-child(odd) td { background: #e0e4e1; } .filetransfer-table tbody tr:nth-child(even) td { background: #f8fafc; } .filetransfer-table tbody tr:hover td { background: #a2c0e6; }`}</style>
          <table className="min-w-full w-full table-auto filetransfer-table">
            <thead style={{ backgroundColor: 'rgb(79, 204, 241)' }}>
              <tr>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800 w-8">ល.រ</th>
                <th className="border px-3 py-2 text-xs font-semibold">ប្រភេទលិខិត</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">លេខលិខិត</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">កាលបរិច្ឆេទលិខិត</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">លេខចូល</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">កាលបរិច្ឆេទចូល</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">ប្រភពឯកសារ</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800 w-12">ចំនួន</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">ឯកសារយោង</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800 w-1/3">ខ្លឹមសារ</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">ផ្សេងៗ</th>
                {showTelegramColumn && (
                  <th className="border px-3 py-2 text-xs font-semibold text-gray-800">សារពី Telegram</th>
                )}
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800">អ្នកទទួលបន្ទុក</th>
                <th className="border px-3 py-2 text-xs font-semibold text-gray-800 ">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={showTelegramColumn ? 14 : 13} className="px-3 py-4 text-center text-sm text-gray-500">កំពុងទាញទិន្នន័យ...</td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td colSpan={showTelegramColumn ? 14 : 13} className="px-3 py-4 text-center text-sm text-red-600">
                    {(error && error.response && error.response.status === 401) ? 'សូមចូលឡើងវិញ — អ្នកមិនបាន authenticate ទៅកាន់ស៊ែវ័រ (Unauthorized)' : 'មានបញ្ហាក្នុងការទាញទិន្នន័យ'}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={showTelegramColumn ? 14 : 13} className="px-3 py-4 text-center text-sm text-gray-500">គ្មានទិន្នន័យ</td>
                </tr>
              )}

              {displayedRows.map((r, idx) => {
                const entryTimeDisplay = formatRowEntryTime(r);
                const creator = getCreatorDisplay(r);
                return (
                  <tr key={r._id ?? r.id ?? idx} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 text-xs">{startDisplay + idx}</td>
                  <td className="border px-3 py-2 text-xs">{r.type || r.title}</td>
                  <td className="border px-3 py-2 text-xs">{r.letterNo ?? r.letter_no ?? '-'}</td>
                  <td className="border px-3 py-2 text-xs">{r.date ? formatISOToDisplay(r.date) : (r.created_at ? formatISOToDisplay(r.created_at) : '-')}</td>
                  <td className="border px-3 py-2 text-xs">{r.entryNo ?? r.entry_no ?? '-'}</td>
                  <td className="border px-3 py-2 text-xs">
                    <div>{r.entryDate ? formatISOToDisplay(r.entryDate) : (r.entry_date ? formatISOToDisplay(r.entry_date) : '-')}</div>
                    {entryTimeDisplay && (<div className="text-[10px] text-gray-500">ម៉ោង: {entryTimeDisplay}</div>)}
                    {creator && (<div className="text-[10px] text-gray-500">: {creator}</div>)}
                  </td>
                  <td className="border px-3 py-2 text-xs">{r.source ?? r.origin ?? '-'}</td>
                  <td className="border px-3 py-2 text-xs">{r.qty ?? r.count ?? '-'}</td>
                  <td className="border px-3 py-2 text-xs text-blue-600">
                    {(() => {
                      const list = normalizeAttachments(r);
                      if (!list || list.length === 0) return '-';
                      return (
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-gray-700">{list.length} ឯកសារ</div>
                          <button type="button" onClick={() => handleViewAttachments(list, r._id ?? r.id ?? null)} className="text-blue-600 underline text-xs">មើល</button>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="border px-3 py-2 text-xs break-words whitespace-normal max-w-[60ch]">{r.content ?? r.description ?? '-'}</td>
                  <td className="border px-3 py-2 text-xs whitespace-pre-wrap break-words max-w-[40ch]">
                    {(() => {
                      const cleaned = stripTelegramLinesFromOthers(r.others || r.notes);
                      return cleaned || '-';
                    })()}
                  </td>

                  {showTelegramColumn && (
                    <td className="border px-3 py-2 text-xs">
                      {(() => {
                        const { preview, count } = getLatestTelegramPreview(r);
                        const has = preview && preview !== '-';
                        return (
                          <div className="max-h-24 overflow-auto whitespace-pre-wrap break-words max-w-[50ch]">
                            <div>{preview}</div>
                            {has && count > 1 && (
                              <div className="text-[10px] text-gray-500 mt-1">(+{count - 1} សារផ្សេងទៀត)</div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  )}

                  {/* Removed 'ស្ថានភាព' cell */}
                  <td className="border px-3 py-2 text-xs">
                    {(() => {
                      try {
                        const idKey = (r && (r._id || r.id)) || (`idx-${startDisplay + idx}`);
                        const rawCurDisplay = (recipientDisplays && recipientDisplays[idKey]) || null;
                        const curDisplay = rawCurDisplay || DEFAULT_RECIPIENT_DISPLAY;
                        // if same as previous row (by id), suppress duplicate display (but don't suppress placeholder)
                        if (idx > 0) {
                          const prev = filteredRows[idx - 1];
                          const prevKey = (prev && (prev._id || prev.id)) || (`idx-${startDisplay + idx - 1}`);
                          const prevRawDisplay = (recipientDisplays && recipientDisplays[prevKey]) || null;
                          const prevDisplay = prevRawDisplay || DEFAULT_RECIPIENT_DISPLAY;
                          if (curDisplay.state !== 'pending' && prevDisplay.state === curDisplay.state && prevDisplay.text === curDisplay.text) return null;
                        }
                        if (curDisplay.state === 'completed') {
                          const label = curDisplay.text ? `រួចរាល់ · ${curDisplay.text}` : 'រួចរាល់';
                          return (<span style={{ background: '#3eeb9aff', color: '#0a0000ff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>{label}</span>);
                        }
                        if (curDisplay.state === 'pending') {
                          return (<span className="text-sm px-2 py-0.5 bg-gray-300 text-gray-900 rounded">{curDisplay.text}</span>);
                        }
                        if (curDisplay.state === 'waiting') {
                          const displayText = curDisplay.text || 'រង់ចាំការផ្ញើមតិ';
                          return (<span style={{ background: '#f3d967ff', color: '#490202ff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>{displayText}</span>);
                        }
                        // fallback: compute live (in case recipientDisplays isn't ready)
                        const wk = getWaitingStageKey(r);
                        let display = null;
                        if (wk) {
                          const byKey = resolveStageSenderByKey(r, wk, signaturesMap);
                          if (byKey) display = String(byKey).replace(/\s*\([^)]+\)\s*$/, '').trim();
                          if (!display) {
                            const waiting = getWaitingStageSender(r);
                            if (waiting) display = String(waiting).replace(/\s*\([^)]+\)\s*$/, '').trim();
                          }
                        }
                        if (display) {
                          return (<span style={{ background: '#f3d967ff', color: '#490202ff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>{display}</span>);
                        }
                      } catch (e) {}
                      return (<span className="text-sm text-gray-900">មិនទាន់មានការផ្ញើមតិ</span>);
                    })()}
                  </td>
                  <td className="border px-0 py-1 text-xs sticky right- bg-white z-3">
                    <div className="relative inline-block">
                      <div className="flex items-center gap-0">
                        {(() => {
                          // Show action buttons selectively based on granular permissions.
                          // Primary actions appear on the top row: edit, mission, delete
                          // Secondary actions appear below: send, reply, reply2
                          const primary = [];
                          const secondary = [];
                          const iconBtnStyle = { width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', padding: 0 };
                          const iconSmall = { width: 15, height: 15 };

                          if (canEdit) {
                            primary.push(
                              <button key="edit" onClick={() => openEdit(r._id ?? r.id)} title="កែប្រែ" style={{ ...iconBtnStyle, color: '#2563eb' }}>
                                <FaEdit style={iconSmall} />
                              </button>
                            );
                          }

                          if (canEdit) {
                            primary.push(
                              <button key="mission" onClick={() => openMissionFromRow(r)} title="លិខិតបញ្ជាបេសកកម្ម" style={{ ...iconBtnStyle, color: '#374151' }}>
                                <FaFileAlt style={iconSmall} />
                              </button>
                            );
                          }

                          if (canDelete) {
                            primary.push(
                              <button key="delete" onClick={() => handleDelete(r._id ?? r.id)} title="លុប" style={{ ...iconBtnStyle, color: '#dc2626' }}>
                                <FaTrash style={iconSmall} />
                              </button>
                            );
                          }

                          if (canSendReview) {
                            secondary.push(
                              <button key="send" onClick={() => navigate && navigate('/send-feedback?recordId=' + encodeURIComponent(r._id ?? r.id))} title="ផ្ញើមតិ" style={{ ...iconBtnStyle, color: '#16a34a' }}>
                                <FaPaperPlane style={iconSmall} />
                              </button>
                            );
                          }

                          if (canReply) {
                            secondary.push(
                              <button key="reply" onClick={() => navigate && navigate('/replay-file?recordId=' + encodeURIComponent(r._id ?? r.id))} title="ឆ្លើយតប" style={{ ...iconBtnStyle, color: '#4f46e5' }}>
                                <FaReply style={iconSmall} />
                              </button>
                            );
                            secondary.push(
                              <button key="reply2" onClick={() => navigate && navigate('/replay-file2?recordId=' + encodeURIComponent(r._id ?? r.id))} title="ឆ្លើយតបបន្ទាប់" style={{ ...iconBtnStyle, color: '#d97706' }}>
                                <FaReply style={iconSmall} />
                              </button>
                            );
                          }

                          if (primary.length === 0 && secondary.length === 0) return (<span className="text-sm text-gray-500">មិនមានសិទ្ធិ</span>);

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', gap: 6 }}>{primary}</div>
                              {secondary.length > 0 ? (<div style={{ display: 'flex', gap: 6 }}>{secondary}</div>) : null}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            បង្ហាញ {startDisplay}-{endDisplay} នៅក្នុង {effectiveTotal}
            {statusFilter && (
              <span className="ml-2 text-blue-600">(បានតម្រង)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`px-3 py-1 border rounded ${page === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}>មុន</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className={`px-3 py-1 border rounded ${page >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}>បន្ទាប់</button>
          </div>
        </div>
      </div>

      {missionModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-[560px] max-w-[95vw]">
            <div className="text-lg font-semibold text-gray-900 mb-4">លិខិតបញ្ជាបេសកកម្ម</div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">យោង</label>
                <input
                  value={missionForm.reference}
                  onChange={(e) => setMissionForm((s) => ({ ...s, reference: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">សូមចាត់បញ្ជូន</label>
                <input
                  value={missionForm.assignTo}
                  onChange={(e) => setMissionForm((s) => ({ ...s, assignTo: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ចូលរួម</label>
                <input
                  value={missionForm.participants}
                  onChange={(e) => setMissionForm((s) => ({ ...s, participants: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">កាលបរិច្ឆេទ</label>
                  <input
                    type="date"
                    value={missionForm.date}
                    onChange={(e) => setMissionForm((s) => ({ ...s, date: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ទីកន្លែង</label>
                  <input
                    value={missionForm.location}
                    onChange={(e) => setMissionForm((s) => ({ ...s, location: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 w-full"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={saveMissionFromModal}
                disabled={missionSaving}
                className={missionSaving ? 'bg-blue-400 text-white px-4 py-2 rounded cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded'}
              >
                រក្សាទុក
              </button>
              <button
                type="button"
                onClick={closeMissionModal}
                disabled={missionSaving}
                className={missionSaving ? 'bg-gray-300 text-white px-4 py-2 rounded cursor-not-allowed' : 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded'}
              >
                បោះបង់
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
