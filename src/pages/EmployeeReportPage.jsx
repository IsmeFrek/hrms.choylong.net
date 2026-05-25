import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import api from '../services/api';
import { departmentAPI } from '../services/departmentAPI';
import { skillAPI } from '../services/skillAPI';
import { ministrySkillAPI } from '../services/api';
import usePermission from '../hooks/usePermission';
import { isExplicitlyRemoved as _isExplicitlyRemoved, hasResignData as _hasResignData, isPreparedForDeletion as _isPreparedForDeletion, isCountedActive as _isCountedActive } from '../utils/hrFilters';
import { Bold, Indent } from 'lucide-react';

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function formatCurrencyKhmer(v) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(/[,\s]/g, ''));
  if (isNaN(n)) return String(v);
  const parts = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // convert each latin digit to khmer digits while preserving commas
  return parts.replace(/[0-9]/g, d => {
    const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
    return map[Number(d)];
  });
}

function toKhmerRoman(n) {
  // 1->១, 2->២, ... for section numbering
  return toKhmerDigits(n);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Extra formatting helpers for picture-style report
function fmtDateSlash(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Parse a value into a local-date Date object (no time). Top-level so it's stable.
function parseDate(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } catch { return null; }
}

// Determine whether an HR record should be included as of a given date. Top-level for stability.
function isIncludedAsOf(hr, asOf) {
  if (!hr) return false;
  const asDate = parseDate(asOf);
  if (!asDate) return true;
  const join = parseDate(hr.joinDate) || parseDate(hr.dateJoinedMinistry) || parseDate(hr.nominationStartDate) || null;
  if (join && join > asDate) return false;
  // Exclude if explicit removal date <= asOf
  const removed = parseDate(hr.dateRemoved) || (hr.delisted && (parseDate(hr.delisted.dateRemoved) || parseDate(hr.delisted.date_removed))) || parseDate(hr.dateRemovedFromDataset) || parseDate(hr.removalDate) || null;
  if (removed && removed <= asDate) return false;
  // Exclude if resignation/leave date <= asOf
  const resign = parseDate(hr.resignDate) || parseDate(hr.resignationDate) || null;
  if (resign && resign <= asDate) return false;
  if ((hr.status || '').toString().toLowerCase() === 'deleted') return false;
  return true;
}

// Normalize officerType and provide tolerant matchers for common Khmer variants
function normOfficerType(v) {
  if (!v) return '';
  try { return String(v).trim().toLowerCase(); } catch { return ''; }
}
function isStateType(v) { const n = normOfficerType(v); return n === 'កិច្ចសន្យារដ្ឋ' || n.includes('រដ្ឋ') || n.includes('state'); }
function isHospitalType(v) { const n = normOfficerType(v); return n === 'កិច្ចសន្យាមន្ទីរពេទ្យ' || n.includes('មន្ទីរពេទ្យ') || n.includes('hospital'); }
function isPartTimeType(v) { const n = normOfficerType(v); return n === 'កិច្ចសន្យាក្រៅម៉ោង' || n.includes('ក្រៅម៉ោង') || n.includes('part'); }
function isWorkerType(v) { const n = normOfficerType(v); return n === 'កម្មករកិច្ចសន្យា' || n.includes('កម្មករ') || n.includes('worker'); }

function fmtDateLong(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return (
    <div style={{ fontFamily: '"Khmer OS Siemreap", "Noto Serif Khmer", serif', fontWeight: 'bold', fontSize: '13px' }}>
      គិតត្រឹម ថ្ងៃទី {toKhmerDigits(dd)}  ខែ {toKhmerDigits(mm)}  ឆ្នាំ {toKhmerDigits(yyyy)}
    </div>
  );
}

// add normalization helper for skills
function normSkill(s) {
  try { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); } catch { return ''; }
}

// (Removed unused helpers fmtDateWithKhmerMonth and computeRetirementDate)

// Move listColumns definition to top-level (outside of EmployeeReportPage) to ensure it's initialized before use
const listColumns = [
  { key: 'serialOverall', label: 'ស.រ', width: '35px', align: 'center' },
  { key: 'serialDept', label: 'ល.រ', width: '30px', align: 'center' },
  { key: 'name', label: 'គោត្តនាម និងនាម', width: '110px', align: 'left' },
  { key: 'gender', label: 'ភេទ', width: '30px', align: 'center' },
  { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកំណើត', width: '90px', align: 'center' },
  { key: 'salaryLevel', label: 'កាំប្រាក់', width: '55px', align: 'center' },
  { key: 'idOrOfficerType', label: 'អត្តលេខមន្ត្រី', width: '90px', align: 'center' },
  { key: 'skill', label: 'ជំនាញ', width: '140px', align: 'left' },
  { key: 'position', label: 'តួនាទី', width: '140px', align: 'left' },
  { key: 'department', label: 'ផ្នែក', width: '140px', align: 'left' },
  { key: 'staffId', label: 'អត្តលេខកាត់', width: '80px', align: 'center' },
  { key: 'totalMonthlyAttendance', label: 'សរុបវត្តមានប្រចាំខែ', width: '80px', align: 'center' },
  { key: 'performanceResult', label: 'លទ្ធផលការងារសម្រេចបាន', width: '120px', align: 'center' },
  { key: 'otherNotes', label: 'ផ្សេងៗ', width: '120px', align: 'left' },
  { key: 'latinName', label: 'ឈ្មោះឡាតាំង', width: '120px', align: 'left' },
  { key: 'phone', label: 'លេខទូរស័ព្ទ', width: '110px', align: 'center' },
  { key: 'joinDate', label: 'កាលបរិច្ឆេទចូល', width: '110px', align: 'center' },
  { key: 'birthplace', label: 'ទីកន្លែងកំណើត/បច្ចុប្បន្ន', width: '180px', align: 'left' },
  { key: 'nid', label: 'លេខអត្តសញ្ញាណ', width: '120px', align: 'center' },
  { key: 'bankAccount', label: 'លេខគណនីធនាគារ', width: '140px', align: 'left' },
];

export default function EmployeeReportPage() {
  const perms = usePermission();
  const [includeArchived, setIncludeArchived] = useState(false); // <-- new: include resigned/deleted when true
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lunarText, setLunarText] = useState('');
  const [reportType, setReportType] = useState('total');
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' or 'landscape'
  const [filterText, setFilterText] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => {
    const d = new Date();
    // default to today (ISO date string yyyy-mm-dd for input[type=date])
    return d.toISOString().slice(0, 10);
  });
  const [showColsMenu, setShowColsMenu] = useState(false);
  const printRef = useRef();
  // Column widths for the summary table (px). Persist in sessionStorage during the session.
  const [colWidths, setColWidths] = useState(() => {
    try {
      const v = sessionStorage.getItem('employee_report_col_widths');
      if (v) return JSON.parse(v);
    } catch { void 0; }
    return [380, 40, 76, 76, 76];
  });
  const filterCardRef = useRef(null);
  const [filterHeight, setFilterHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (filterCardRef.current) {
        setFilterHeight(filterCardRef.current.offsetHeight);
      }
    };
    measure();
    // Re-measure on window resize
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [reportType, showColsMenu]); // Re-measure if content changes

  const resizingRef = useRef(null);
  // Row height for preview/print (px). Persist in sessionStorage during the session.
  const [rowHeight, setRowHeight] = useState(() => {
    try {
      const v = sessionStorage.getItem('employee_report_row_height');
      if (v) return Number(v);
    } catch { void 0; }
    return 35;
  });
  useEffect(() => { try { sessionStorage.setItem('employee_report_row_height', String(rowHeight)); } catch { void 0; } }, [rowHeight]);
  const rowFontSize = Math.max(10, Math.round(rowHeight * 0.36));
  // Column visibility controls (persist in sessionStorage)
  const defaultColumns = {
    serialOverall: true,
    serialDept: true,
    name: true,
    latinName: true,
    staffId: true,
    gender: true,
    dob: true,
    salaryLevel: true,
    idOrOfficerType: true,
    skill: true,
    position: true,
    department: true,
    phone: true,
    joinDate: true,
    birthplace: true,
    totalMonthlyAttendance: true,
    performanceResult: true,
    otherNotes: true,
    nid: true,
    bankAccount: true,
  };
  if (perms.isAdmin || perms.canEditEmployeeReport) {
    if (!listColumns.find(c => c.key === 'actions')) {
      listColumns.push({ key: 'actions', label: 'កែ', width: '60px', align: 'center' });
    }
    defaultColumns.actions = true;
  }
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const v = sessionStorage.getItem('employee_report_visible_cols');
      if (v) return JSON.parse(v);
    } catch { void 0; }
    return defaultColumns;
  });
  useEffect(() => { try { sessionStorage.setItem('employee_report_visible_cols', JSON.stringify(visibleCols)); } catch { void 0; } }, [visibleCols]);
  const toggleCol = (k) => setVisibleCols(prev => ({ ...prev, [k]: !prev[k] }));

  // Auto-switch columns based on report type
  useEffect(() => {
    if (reportType === 'civil') {
      const civilSet = {
        serialOverall: true,
        serialDept: true,
        name: true,
        gender: true,
        dob: true,
        salaryLevel: true,
        idOrOfficerType: true,
        skill: true,
        position: true,
      };
      // For civil, we only want these 9 columns visible by default
      const newCols = {};
      Object.keys(defaultColumns).forEach(k => {
        newCols[k] = !!civilSet[k];
      });
      setVisibleCols(newCols);
    } else if (reportType === 'evaluation') {
      const evaluationSet = {
        serialDept: true,
        name: true,
        skill: true,
        position: true,
        totalMonthlyAttendance: true,
        performanceResult: true,
        otherNotes: true,
        staffId: true,
      };
      const newCols = {};
      Object.keys(defaultColumns).forEach(k => {
        newCols[k] = !!evaluationSet[k];
      });
      setVisibleCols(newCols);
    } else if (['state', 'hospital', 'worker', 'hospitalPlus', 'hospitalPartTime', 'retiredThenContract'].includes(reportType)) {
      const contractSet = {
        serialOverall: true,
        serialDept: true,
        name: true,
        gender: true,
        dob: true,
        salaryLevel: true,
        idOrOfficerType: true, // Will show "ប្រភេទមន្ត្រី"
        skill: true,
        position: true,
      };
      const newCols = {};
      Object.keys(defaultColumns).forEach(k => {
        newCols[k] = !!contractSet[k];
      });
      setVisibleCols(newCols);
    }
  }, [reportType]);
  const visibleCount = Object.values(visibleCols).filter(Boolean).length || 1;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewHR || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true); setError('');
      try {
        // Fetch HR data
        const { data: hrData } = await api.get('/hr');
        if (!mounted) return;
        // Fetch attendance monthly summary (the source of truth)
        let attendanceMap = {};
        try {
          const dt = new Date(asOfDate);
          const year = dt.getFullYear();
          const month = dt.getMonth() + 1;
          const { data: attData } = await api.get('/attendance/summary', { params: { year, month } });
          
          if (Array.isArray(attData)) {
            attData.forEach(row => {
              const sid = String(row.staffId || '').trim();
              if (!sid) return;

              const dayWorkCount = Number(row.dayWorkCount || 0);
              const attendanceCount = Number(row.attendanceCount || 0);
              const leaveCount = Number(row.leaveCount || 0);
              const A = Number(row.A || 0);
              const checkinLateCount = Number(row.checkinLateCount || 0);
              const checkoutEarlyCount = Number(row.checkoutEarlyCount || 0);
              const lateEarlyEvents = checkinLateCount + checkoutEarlyCount;
              const plechEvents = Number(row.plech || 0);

              let totalAbsent = A + (lateEarlyEvents / 3) + (plechEvents / 3);
              totalAbsent = Math.round(totalAbsent * 100) / 100;
              
              let overallPercent = 0;
              if (dayWorkCount > 0) {
                overallPercent = Math.round(((dayWorkCount - (totalAbsent + leaveCount)) / dayWorkCount) * 100);
              }

              let result = '';
              if (overallPercent >= 85) result = 'ល្អ';
              else if (overallPercent >= 65) result = 'ល្អបង្គួរ';
              else if (overallPercent >= 45) result = 'មធ្យម';
              else if (dayWorkCount > 0) result = 'ខ្សោយ';

              attendanceMap[sid] = result;
            });
          }
        } catch (e) {
          console.error('Attendance summary fetch failed', e);
        }

        const merged = (Array.isArray(hrData) ? hrData : []).map(hr => {
          const sid = String(hr.staffId || '').trim();
          const resultFromAttendance = attendanceMap[sid] || '';
          // totalMonthlyAttendance now shows the Performance Result text (ល្អ, ល្អបង្គួរ...)
          // performanceResult field is kept empty for manual use as requested before.
          return { ...hr, totalMonthlyAttendance: resultFromAttendance, performanceResult: '' };
        });
        setList(merged);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [perms.canViewHR, perms.canViewEmployees]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ot = params.get('officerType');
    if (ot === 'មន្រ្តីរាជការ' || ot === 'មន្ត្រីរាជការ') {
      setReportType('civil');
    }
  }, []);

  // load departments to obtain Department_Id ordering when available
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [showGroupList, setShowGroupList] = useState(false);
  const [deptQuery, setDeptQuery] = useState('');
  const [showDeptList, setShowDeptList] = useState(false);
  const [skills, setSkills] = useState([]);
  const [ministrySkills, setMinistrySkills] = useState([]);
  const [expandedSkills, setExpandedSkills] = useState(new Set());

  const toggleExpandSkill = (skillName) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillName)) next.delete(skillName); else next.add(skillName);
      return next;
    });
  };
  // Skill grouping (user can group multiple skills into one label)
  const [skillGroups, setSkillGroups] = useState(() => {
    try {
      const raw = localStorage.getItem('employee_skill_groups');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [isSkillGroupsLoaded, setIsSkillGroupsLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupSelection, setGroupSelection] = useState(new Set());
  const [selectedEditGroupIndex, setSelectedEditGroupIndex] = useState(null); // index of group being edited (or null)

  // memoized set of all members already assigned to groups (to hide them from the selection UI)
  const existingGroupMembers = useMemo(() => {
    try {
      return new Set((skillGroups || []).flatMap(g => (g.members || []).map(m => String(m))));
    } catch {
      return new Set();
    }
  }, [skillGroups]);

  // when editing a group, exclude only members of other groups so current group's members remain selectable
  const existingGroupMembersExcludingCurrent = useMemo(() => {
    try {
      const s = new Set();
      (skillGroups || []).forEach((g, idx) => {
        if (selectedEditGroupIndex != null && idx === selectedEditGroupIndex) return;
        (g.members || []).forEach(m => s.add(String(m)));
      });
      return s;
    } catch {
      return new Set();
    }
  }, [skillGroups, selectedEditGroupIndex]);

  // all skill names source: prefer skills list from API, fallback to HR list-derived skills
  const allSkillNames = useMemo(() => {
    try {
      if (skills && Array.isArray(skills) && skills.length > 0) {
        return Array.from(new Set(skills.map(s => (s.skills_Kh || '').toString()).filter(Boolean)));
      }
      return Array.from(new Set(list.map(hr => (hr.skill || '').toString()).filter(Boolean)));
    } catch {
      return [];
    }
  }, [skills, list]);

  // available skills for new group selection = all skills minus those already grouped
  const availableSkills = useMemo(() => {
    const excludeSet = (selectedEditGroupIndex == null) ? existingGroupMembers : existingGroupMembersExcludingCurrent;
    return allSkillNames.filter(s => !excludeSet.has(s));
  }, [allSkillNames, existingGroupMembers, existingGroupMembersExcludingCurrent, selectedEditGroupIndex]);

  // Load groups from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/report-settings/employee-skill-groups');
        if (res?.data?.ok && res.data.prefs?.groups) {
          if (Array.isArray(res.data.prefs.groups) && res.data.prefs.groups.length > 0) {
            setSkillGroups(res.data.prefs.groups);
          }
        }
      } catch (err) { /* ignore */ }
      finally {
        setIsSkillGroupsLoaded(true);
      }
    })();
  }, []);

  // Save to local storage and backend whenever skillGroups change (debounced)
  useEffect(() => {
    if (!isSkillGroupsLoaded) return;
    try { localStorage.setItem('employee_skill_groups', JSON.stringify(skillGroups || [])); } catch { void 0; }
    
    let t = null;
    setSaveStatus('saving');
    t = setTimeout(() => {
      api.post('/report-settings/employee-skill-groups', { groups: skillGroups || [], groupName: 'global' })
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
        }).catch(() => {
          setSaveStatus('error');
        });
    }, 700);
    return () => { if (t) clearTimeout(t); };
  }, [skillGroups, isSkillGroupsLoaded]);

  const toggleSelectSkillForGroup = (skillName) => {
    setGroupSelection(prev => {
      const next = new Set(prev);
      if (next.has(skillName)) next.delete(skillName); else next.add(skillName);
      return next;
    });
  };

  // create new group or save edits to an existing group
  const createSkillGroup = () => {
    const members = Array.from(groupSelection).map(s => String(s));
    if (!groupNameInput.trim() || members.length === 0) {
      alert('សូមបំពេញឈ្មោះក្រុម និងជ្រើសជំនាញយ៉ាងតិចមួយ');
      return;
    }
    if (selectedEditGroupIndex != null) {
      // save changes
      setSkillGroups(prev => prev.map((g, idx) => idx === selectedEditGroupIndex ? { name: groupNameInput.trim(), members } : g));
    } else {
      setSkillGroups(prev => [...prev, { name: groupNameInput.trim(), members }]);
    }
    // reset modal state
    setGroupNameInput(''); setGroupSelection(new Set()); setSelectedEditGroupIndex(null); setShowGroupModal(false);
  };

  const removeSkillGroup = (idx) => {
    setSkillGroups(prev => prev.filter((g, i) => i !== idx));
    // if we were editing that group, reset edit state
    if (selectedEditGroupIndex != null) {
      if (selectedEditGroupIndex === idx) {
        setSelectedEditGroupIndex(null);
        setGroupNameInput(''); setGroupSelection(new Set());
      } else if (selectedEditGroupIndex > idx) {
        setSelectedEditGroupIndex(v => (v == null ? null : v - 1));
      }
    }
  };
  // open existing group for editing
  const editSkillGroup = (idx) => {
    const g = skillGroups[idx];
    if (!g) return;
    setSelectedEditGroupIndex(idx);
    setGroupNameInput(g.name || '');
    setGroupSelection(new Set((g.members || []).map(m => String(m))));
    setShowGroupModal(true);
  };
  useEffect(() => {
    let mounted = true;
    departmentAPI.getDepartments().then(res => {
      if (!mounted) return;
      const data = res?.data || res;
      setDepartments(Array.isArray(data) ? data : []);
    }).catch(() => { if (mounted) setDepartments([]); });
    return () => { mounted = false; };
  }, []);

  // load skills for ordered technical summary
  useEffect(() => {
    let mounted = true;
    skillAPI.getSkills().then(res => {
      if (!mounted) return;
      const data = res?.data || res;
      setSkills(Array.isArray(data) ? data.filter(s => !s.ministryFunction || s.ministryFunction.trim() === '') : []);
    }).catch(() => { if (mounted) setSkills([]); });

    ministrySkillAPI.getSkills().then(res => {
      if (!mounted) return;
      const data = res?.data || res;
      setMinistrySkills(Array.isArray(data) ? data : []);
    }).catch(() => { if (mounted) setMinistrySkills([]); });

    return () => { mounted = false; };
  }, []);

  // (parseDate and isIncludedAsOf are defined at module top-level)

  // Wrapper that respects the "includeArchived" toggle.
  // When includeArchived===true we do NOT exclude records with status Resigned/Deleted
  // and we also do not exclude by resignDate (so resigned records remain in results).
  const included = (hr, asOf) => {
    if (!hr) return false;
    const asDate = parseDate(asOf);
    // If includeArchived is false, keep original behaviour (exclude Deleted and exclude if resigned on/before asOf)
    if (!includeArchived) return isIncludedAsOf(hr, asOf);
    // includeArchived === true: ignore status filters and resignation date filtering,
    // but still respect join-date (don't include people who joined after asOf)
    if (asDate) {
      const join = parseDate(hr.joinDate) || parseDate(hr.dateJoinedMinistry) || parseDate(hr.nominationStartDate) || null;
      if (join && join > asDate) return false;
    }
    return true;
  };

  // Determine if a record should be considered active as of a given date.
  // Active means status==='active', not deleted, joined on/before asOf and not resigned on/before asOf.
  const isActiveAsOf = (hr, asOf) => {
    if (!hr) return false;
    const st = (hr.status || '').toString().toLowerCase();
    if (st === 'deleted') return false;

    const asDate = parseDate(asOf);
    if (asDate) {
      const removed = parseDate(hr.dateRemoved) || (hr.delisted && (parseDate(hr.delisted.dateRemoved) || parseDate(hr.delisted.date_removed))) || parseDate(hr.dateRemovedFromDataset) || parseDate(hr.removalDate) || null;
      if (removed && removed <= asDate) return false;
      const resign = parseDate(hr.resignDate) || parseDate(hr.resignationDate) || null;
      if (resign && resign <= asDate) return false;

      // If resignation is explicitly in the future relative to asDate, they are still active
      if (resign && resign > asDate) return true;
      if (removed && removed > asDate) return true;
    }

    if (st === 'resigned') return false;

    const hasResign = _hasResignData(hr);
    const hasExplicitRemoval = _isExplicitlyRemoved(hr);
    const prepared = _isPreparedForDeletion(hr) && !hasExplicitRemoval;
    if (hasResign && !prepared) return false;
    return true;
  };

  // Apply as-of filtering first, then by report type
  const filteredList = useMemo(() => {
    const asOf = asOfDate;
    // For the 'total' report we explicitly use active-as-of semantics so resigned/left staff
    // are not shown even if the `includeArchived` toggle is on. For other reports use
    // the general `included` wrapper which respects `includeArchived`.
    // By default use strict active-as-of semantics for all report types so
    // records that have left/resigned/deleted are excluded. If the
    // `includeArchived` toggle is set, fall back to the looser `included` behaviour.
    let asOfFiltered = list.filter(hr => (includeArchived ? included(hr, asOf) : isActiveAsOf(hr, asOf)));
    // apply department filter if selected
    if (selectedDept) {
      const sd = selectedDept.toString();
      asOfFiltered = asOfFiltered.filter(hr => {
        if (!hr) return false;
        const candidates = [hr.Department_Kh, hr.Department_KH, hr.Department, hr.Department_En, hr.unit, hr.unitName];
        if (candidates.some(c => c && c.toString().trim() === sd)) return true;
        // also allow numeric Department_Id match
        if ((hr.Department_Id || hr.departmentId || hr.DepartmentId) && String(hr.Department_Id || hr.departmentId || hr.DepartmentId) === sd) return true;
        return false;
      });
    }
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const otypes = {
      STATE: 'កិច្ចសន្យារដ្ឋ',
      HOSPITAL: 'កិច្ចសន្យាមន្ទីរពេទ្យ',
      PART_TIME: 'កិច្ចសន្យាក្រៅម៉ោង',
      WORKER: 'កម្មករកិច្ចសន្យា',
    };
    if (reportType === 'state') {
      return asOfFiltered.filter(hr => isStateType(hr.officerType));
    }
    if (reportType === 'worker') {
      return asOfFiltered.filter(hr => isWorkerType(hr.officerType));
    }
    if (reportType === 'hospital') {
      return asOfFiltered.filter(hr => isHospitalType(hr.officerType));
    }
    if (reportType === 'hospitalPlus') {
      return asOfFiltered.filter(hr => {
        return isHospitalType(hr.officerType) || isPartTimeType(hr.officerType) || isWorkerType(hr.officerType);
      });
    }
    if (reportType === 'hospitalPartTime') {
      return asOfFiltered.filter(hr => isHospitalType(hr.officerType) && !!hr.isPartTime);
    }
    if (reportType === 'hospitalOver60') {
      // hospital contract staff aged 60 or older, excluding those marked as retired→contract
      const textFields = (hr) => (`${hr.position || ''} ${hr.note || ''} ${hr.status || ''} ${hr.remark || ''} ${hr.title || ''} ${hr.officerType || ''} ${hr.comments || ''}`);
      const isMarkedRetire = (hr) => /(?:retir|retired|និវត្ត|ចូលនិវត្ត|ចូលនិវត្តន៍)/i.test(textFields(hr)) || !!(hr.resignDate) || !!hr.isRetiredThenContract;
      const ageOf = (hr) => {
        const pd = parseDate(hr.dob);
        if (!pd) return null;
        const ref = parseDate(asOf) || new Date();
        let age = ref.getFullYear() - pd.getFullYear();
        if (ref.getMonth() < pd.getMonth() || (ref.getMonth() === pd.getMonth() && ref.getDate() < pd.getDate())) age--;
        return age;
      };
      return asOfFiltered.filter(hr => isHospitalType(hr.officerType) && !isMarkedRetire(hr) && (ageOf(hr) !== null && ageOf(hr) >= 60));
    }
    if (reportType === 'allhr') {
      // show raw employee data (respecting includeArchived / as-of semantics)
      return asOfFiltered;
    }
    if (reportType === 'partTime') {
      return asOfFiltered.filter(hr => isPartTimeType(hr.officerType));
    }
    if (reportType === 'retiredThenContract') {
      // Build retired civil sets and then return contract records that match by id/name or explicit flag
      const collapse = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().toLowerCase() : '');
      const idKeyOf = (hr) => {
        const id = hr.staffId || hr.officerId || hr.civilServantId || hr.cardNumber || hr.nid || '';
        if (id && String(id).trim()) return `id:${String(id).trim().toLowerCase()}`;
        return null;
      };
      const nameKeyOf = (hr) => {
        const k = `${hr.khmerName || ''} ${(hr.name || '')}`;
        const c = collapse(k);
        if (c) return `name:${c}`;
        return null;
      };
      const textFields = (hr) => (`${hr.position || ''} ${hr.note || ''} ${hr.status || ''} ${hr.remark || ''} ${hr.title || ''} ${hr.officerType || ''} ${hr.comments || ''}`);
      const isMarkedRetire = (hr) => /(?:retir|retired|និវត្ត|ចូលនិវត្ត|ចូលនិវត្តន៍)/i.test(textFields(hr)) || !!(hr.resignDate);
      const civilRetiredIdKeys = new Set();
      const civilRetiredNameKeys = new Set();
      for (const hr of list) {
        const o = hr.officerType;
        if (isHospitalType(o) || isPartTimeType(o) || isWorkerType(o)) continue;
        if (isMarkedRetire(hr) || !!hr.isRetiredThenContract) {
          const idk = idKeyOf(hr);
          const nk = nameKeyOf(hr);
          if (idk) civilRetiredIdKeys.add(idk);
          if (nk) civilRetiredNameKeys.add(nk);
        }
      }
      return asOfFiltered.filter(hr => {
        const o = hr.officerType;
        if (!(isHospitalType(o) || isPartTimeType(o) || isWorkerType(o))) return false;
        const idk = idKeyOf(hr);
        const nk = nameKeyOf(hr);
        const matchedByCivil = (idk && civilRetiredIdKeys.has(idk)) || (nk && civilRetiredNameKeys.has(nk));
        const matched = matchedByCivil || !!hr.isRetiredThenContract;
        return !!matched;
      });
    }
    // default: include all unless specifically a 'civil' servant report
    let base = asOfFiltered;
    if (reportType === 'civil') {
      base = asOfFiltered.filter(hr => !isStateType(hr.officerType) && !isHospitalType(hr.officerType) && !isPartTimeType(hr.officerType) && !isWorkerType(hr.officerType));
    }
    // apply simple text filter across khmer name, latin name, staffId, department, position
    if (filterText && String(filterText).trim()) {
      const t = String(filterText).toLowerCase();
      base = base.filter(hr => {
        return ((hr.khmerName || '').toString().toLowerCase().includes(t)
          || (hr.name || '').toString().toLowerCase().includes(t)
          || (hr.staffId || '').toString().toLowerCase().includes(t)
          || (hr.Department_Kh || '').toString().toLowerCase().includes(t)
          || (hr.position || '').toString().toLowerCase().includes(t)
        );
      });
    }

    // apply group filter if selected
    if (selectedGroup) {
      base = base.filter(hr => {
        const deptName = (hr.Department_Kh || hr.department || '').toString().trim();
        return deptName === selectedGroup;
      });
    }
    return base;
  }, [list, reportType, asOfDate, filterText, isIncludedAsOf, selectedGroup]);

  // Map each record to its global index in the filtered list so serials match the on-screen ordering
  const overallIndexMap = useMemo(() => {
    const m = {};
    try {
      filteredList.forEach((hr, i) => {
        const key = hr._id || hr.staffId || hr.officerId || hr.name || String(i);
        m[key] = i + 1;
      });
    } catch (e) { /* ignore */ }
    return m;
  }, [filteredList]);

  const grouped = useMemo(() => {
    // group by department but prefer canonical names from `departments` collection and keep empty group at end
    const by = new Map();
    // build a quick map from several department name variants -> Department_Id and canonical name
    const deptIdMap = new Map();
    const deptCanonical = new Map();
    for (const d of departments || []) {
      const id = Number(d.Department_Id) || null;
      const candidates = [d.Department_Kh, d.Department_KH, d.Department, d.Department_En];
      for (const raw of candidates) {
        try {
          if (!raw) continue;
          const key = raw.toString().trim();
          if (!key) continue;
          deptIdMap.set(key, id);
          // remember a canonical Khmer name for display if available
          if (!deptCanonical.has(key)) deptCanonical.set(key, (d.Department_Kh || d.Department || d.Department_En || key).toString().trim());
        } catch (e) { /* ignore */ }
      }
    }
    for (const hr of filteredList) {
      // try to find a canonical name using any of hr's department fields
      const rawDeptCandidates = [hr?.Department_Kh, hr?.Department_KH, hr?.Department, hr?.Department_En];
      let key = null;
      for (const cand of rawDeptCandidates) {
        if (!cand) continue;
        const s = cand.toString().trim();
        if (!s) continue;
        if (deptCanonical.has(s)) { key = deptCanonical.get(s); break; }
        if (deptIdMap.has(s)) { key = s; break; }
        // fallback to the raw string if no mapping
        if (!key) key = s;
      }
      if (!key) key = '—';

      if (!by.has(key)) by.set(key, []);
      by.get(key).push(hr);
    }

    const entries = Array.from(by.entries())
      .sort((a, b) => {
        // keep empty/unknown group at the end
        if (a[0] === '—') return 1;
        if (b[0] === '—') return -1;
        const depA = (a[0] || '').toString();
        const depB = (b[0] || '').toString();
        // if we have mapped ids, use them
        const ida = deptIdMap.has(depA) ? deptIdMap.get(depA) : null;
        const idb = deptIdMap.has(depB) ? deptIdMap.get(depB) : null;
        if (ida != null && idb != null) return (ida || 0) - (idb || 0);
        if (ida != null) return -1;
        if (idb != null) return 1;
        // try to parse a leading numeric index like "1.", "2 -", "3)"
        const num = (s) => {
          if (!s) return null;
          const m = s.match(/^\s*(\d+)\s*(?:[.)\-:]|\b)/);
          return m ? parseInt(m[1], 10) : null;
        };
        const na = num(depA);
        const nb = num(depB);
        if (na != null && nb != null) return na - nb;
        if (na != null) return -1;
        if (nb != null) return 1;
        
        return depA.localeCompare(depB, 'km');
      })
      .map(([dept, items]) => ({ dept, items: items.sort((x, y) => (x.no || 0) - (y.no || 0)) }));
    return entries;
  }, [filteredList, departments]);

  const totals = useMemo(() => {
    const total = filteredList.length;
    const male = filteredList.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length;
    const female = filteredList.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length;
    return { total, male, female };
  }, [filteredList]);

  // female-only list for the femaleCount report
  // Source directly from the HR `list` so the femaleCount report always
  // reflects HR records (respecting as-of / includeArchived semantics).
  const femaleOnlyList = useMemo(() => {
    try {
      const asOf = asOfDate;
      const base = (includeArchived ? (list || []).filter(hr => included(hr, asOf)) : (list || []).filter(hr => isActiveAsOf(hr, asOf)));
      return (base || []).filter(x => ((x.gender || '').toString().toLowerCase() === 'female') || ((x.gender || '').toString() === 'ស្រី'));
    } catch (e) { return []; }
  }, [list, includeArchived, asOfDate]);

  // Summary totals for 'total' report type (use full list)
  const grandSummary = useMemo(() => {
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const otypes = {
      STATE: 'កិច្ចសន្យារដ្ឋ',
      HOSPITAL: 'កិច្ចសន្យាមន្ទីរពេទ្យ',
      PART_TIME: 'កិច្ចសន្យាក្រៅម៉ោង',
      WORKER: 'កម្មករកិច្ចសន្យា',
    };
    const count = (arr) => {
      const total = arr.length;
      const male = arr.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length;
      const female = arr.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length;
      return { total, male, female };
    };
    // Apply strict active-as-of filtering for grand totals so components sum correctly
    const asOf = asOfDate;
    const asOfFiltered = list.filter(hr => isActiveAsOf(hr, asOf));
    const civil = asOfFiltered.filter(hr => !isStateType(hr.officerType) && !isHospitalType(hr.officerType) && !isPartTimeType(hr.officerType) && !isWorkerType(hr.officerType));
    const state = asOfFiltered.filter(hr => isStateType(hr.officerType));
    const hospital = asOfFiltered.filter(hr => isHospitalType(hr.officerType));
    const partTime = asOfFiltered.filter(hr => isPartTimeType(hr.officerType));
    const worker = asOfFiltered.filter(hr => isWorkerType(hr.officerType));
    return {
      // Match dashboard: use only active employees for the grand "all" total
      all: count((list || []).filter(hr => isActiveAsOf(hr, asOf))),
      civil: count(civil),
      state: count(state),
      hospital: count(hospital),
      partTime: count(partTime),
      worker: count(worker),
      hospitalPlus: (function () {
        const seen = new Set();
        const items = [];
        for (const hr of hospital.concat(partTime, worker)) {
          const key = hr._id || hr.staffId || hr.officerId || hr.cardNumber || (hr.name ? hr.name.trim() : null) || JSON.stringify(hr);
          if (seen.has(key)) continue;
          seen.add(key);
          items.push(hr);
        }
        return count(items);
      })(),
    };
  }, [list, asOfDate, isIncludedAsOf]);

  // Breakdown for hospital + part-time group: retired marker, age >= 60, age < 60
  const hospitalPlusBreakdown = useMemo(() => {
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const otypes = {
      HOSPITAL: 'កិច្ចសន្យាមន្ទីរពេទ្យ',
      PART_TIME: 'កិច្ចសន្យាក្រៅម៉ោង',
    };
    const asOf = asOfDate;
    // Use strict active-as-of filtering so left/resigned/deleted staff are not counted
    const asOfFiltered = list.filter(hr => isActiveAsOf(hr, asOf));
    const arr = asOfFiltered.filter(hr => isHospitalType(hr.officerType) || isPartTimeType(hr.officerType));

    const textFields = (hr) => (`${hr.position || ''} ${hr.note || ''} ${hr.status || ''} ${hr.remark || ''} ${hr.title || ''} ${hr.officerType || ''} ${hr.comments || ''}`);
    const isMarkedRetire = (hr) => /(?:retir|retired|និវត្ត|ចូលនិវត្ត|ចូលនិវត្តន៍)/i.test(textFields(hr)) || !!(hr.resignDate) || !!hr.isRetiredThenContract;

    const ageOf = (hr) => {
      const pd = parseDate(hr.dob);
      if (!pd) return null;
      const ref = parseDate(asOf) || new Date();
      let age = ref.getFullYear() - pd.getFullYear();
      if (ref.getMonth() < pd.getMonth() || (ref.getMonth() === pd.getMonth() && ref.getDate() < pd.getDate())) age--;
      return age;
    };

    const retired = arr.filter(isMarkedRetire);
    const remaining = arr.filter(hr => !isMarkedRetire(hr));
    const over60 = remaining.filter(hr => {
      const a = ageOf(hr);
      return a !== null && a >= 60;
    });
    const under60 = remaining.filter(hr => {
      const a = ageOf(hr);
      return a === null || a < 60;
    });

    const byGender = (listLike) => ({
      total: listLike.length,
      male: listLike.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length,
      female: listLike.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length,
    });

    return {
      all: byGender(arr),
      retired: byGender(retired),
      over60: byGender(over60),
      under60: byGender(under60),
    };
  }, [list, asOfDate, isIncludedAsOf]);

  // Counts of hospital + part-time contract staff whose age is >= 60 (regardless of 'retired' marker)
  const hospitalPlusAgeOver60 = useMemo(() => {
    const asOf = asOfDate;
    // Use strict active-as-of filtering so left/resigned/deleted staff are not counted
    const asOfFiltered = list.filter(hr => isActiveAsOf(hr, asOf));
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const otypes = { HOSPITAL: 'កិច្ចសន្យាមន្ទីរពេទ្យ', PART_TIME: 'កិច្ចសន្យាក្រៅម៉ោង' };
    // Exclude records that are marked as retired (text marker, resignDate, or explicit flag)
    const textFields = (hr) => (`${hr.position || ''} ${hr.note || ''} ${hr.status || ''} ${hr.remark || ''} ${hr.title || ''} ${hr.officerType || ''} ${hr.comments || ''}`);
    const isMarkedRetire = (hr) => /(?:retir|retired|និវត្ត|ចូលនិវត្ត|ចូលនិវត្តន៍)/i.test(textFields(hr)) || !!(hr.resignDate) || !!hr.isRetiredThenContract;
    const arr = asOfFiltered.filter(hr => (isHospitalType(hr.officerType) || isPartTimeType(hr.officerType)) && !isMarkedRetire(hr));
    const ageOf = (hr) => {
      const pd = parseDate(hr.dob);
      if (!pd) return null;
      const ref = parseDate(asOf) || new Date();
      let age = ref.getFullYear() - pd.getFullYear();
      if (ref.getMonth() < pd.getMonth() || (ref.getMonth() === pd.getMonth() && ref.getDate() < pd.getDate())) age--;
      return age;
    };
    const over60 = arr.filter(hr => {
      const a = ageOf(hr);
      return a !== null && a >= 60;
    });
    const byGender = (listLike) => ({
      total: listLike.length,
      male: listLike.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length,
      female: listLike.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length,
    });
    return byGender(over60);
  }, [list, asOfDate, isIncludedAsOf]);

  // Breakdown for worker contract group: retired marker, age >= 60, age < 60
  const workerBreakdown = useMemo(() => {
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const otypes = { WORKER: 'កម្មករកិច្ចសន្យា' };
    const asOf = asOfDate;
    // Use strict active-as-of filtering so left/resigned/deleted staff are not counted
    const asOfFiltered = list.filter(hr => isActiveAsOf(hr, asOf));
    const arr = asOfFiltered.filter(hr => isWorkerType(hr.officerType));

    const textFields = (hr) => (`${hr.position || ''} ${hr.note || ''} ${hr.status || ''} ${hr.remark || ''} ${hr.title || ''} ${hr.officerType || ''} ${hr.comments || ''}`);
    const isMarkedRetire = (hr) => /(?:retir|retired|និវត្ត|ចូលនិវត្ត|ចូលនិវត្តន៍)/i.test(textFields(hr)) || !!(hr.resignDate) || !!hr.isRetiredThenContract;

    const ageOf = (hr) => {
      const pd = parseDate(hr.dob);
      if (!pd) return null;
      const ref = parseDate(asOf) || new Date();
      let age = ref.getFullYear() - pd.getFullYear();
      if (ref.getMonth() < pd.getMonth() || (ref.getMonth() === pd.getMonth() && ref.getDate() < pd.getDate())) age--;
      return age;
    };

    const retired = arr.filter(isMarkedRetire);
    const remaining = arr.filter(hr => !isMarkedRetire(hr));
    const over60 = remaining.filter(hr => {
      const a = ageOf(hr);
      return a !== null && a >= 60;
    });
    const under60 = remaining.filter(hr => {
      const a = ageOf(hr);
      return a === null || a < 60;
    });

    const byGender = (listLike) => ({
      total: listLike.length,
      male: listLike.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length,
      female: listLike.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length,
    });

    return {
      all: byGender(arr),
      retired: byGender(retired),
      over60: byGender(over60),
      under60: byGender(under60),
    };
  }, [list, asOfDate, isIncludedAsOf]);

  // Count former civil servants who retired and later continued as contract staff
  const retiredThenContract = useMemo(() => {
    const asOf = asOfDate;
    // contract records that are active as of the date (exclude left/resigned/deleted)
    const asOfFiltered = list.filter(hr => isActiveAsOf(hr, asOf));
    const norm = (s) => (typeof s === 'string' ? s.trim() : s);
    const collapse = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().toLowerCase() : '');

    const textFields = (hr) => (`${hr.position || ''} ${hr.note || ''} ${hr.status || ''} ${hr.remark || ''} ${hr.title || ''} ${hr.officerType || ''} ${hr.comments || ''}`);
    // broaden retirement tokens (Khmer + English variants) and treat records with a resignDate as retired
    const isMarkedRetire = (hr) => /(?:retir|retired|និវត្ត|ចូលនិវត្ត|ចូលនិវត្តន៍)/i.test(textFields(hr)) || !!(hr.resignDate);

    const idKeyOf = (hr) => {
      const id = hr.staffId || hr.officerId || hr.civilServantId || hr.cardNumber || hr.nid || '';
      if (id && String(id).trim()) return `id:${String(id).trim().toLowerCase()}`;
      return null;
    };

    const nameKeyOf = (hr) => {
      const k = `${hr.khmerName || ''} ${(hr.name || '')}`;
      const c = collapse(k);
      if (c) return `name:${c}`;
      return null;
    };

    // Build sets of keys representing civil-servant records that show retirement.
    // Use structural detection (not relying on exact officerType strings) so variations won't be missed.
    const civilRetiredIdKeys = new Set();
    const civilRetiredNameKeys = new Set();
    for (const hr of list) {
      const o = hr.officerType;
      // skip contract types (hospital/part-time/worker) — treat the rest as civil-servant-like
      if (isHospitalType(o) || isPartTimeType(o) || isWorkerType(o)) continue;
      // include either textual retirement markers or explicit flag on civil record
      if (isMarkedRetire(hr) || !!hr.isRetiredThenContract) {
        const idk = idKeyOf(hr);
        const nk = nameKeyOf(hr);
        if (idk) civilRetiredIdKeys.add(idk);
        if (nk) civilRetiredNameKeys.add(nk);
      }
    }

    const counts = { hospitalPlus: { total: 0, male: 0, female: 0 }, worker: { total: 0, male: 0, female: 0 } };
    const seen = new Set();
    const matchedRecords = [];
    for (const hr of asOfFiltered) {
      const o = hr.officerType;
      const idk = idKeyOf(hr);
      const nk = nameKeyOf(hr);
      const matchedByCivil = (idk && civilRetiredIdKeys.has(idk)) || (nk && civilRetiredNameKeys.has(nk));
      // also count if the contract record itself was flagged manually
      const matched = matchedByCivil || !!hr.isRetiredThenContract;
      if (!matched) continue;
      const uniqueKey = idk || nk || JSON.stringify([hr.khmerName || '', hr.name || '', hr.cardNumber || '']);
      if (seen.has(uniqueKey)) continue; // avoid double-counting same person
      // capture debug info for UI inspection
      matchedRecords.push({ key: uniqueKey, idKey: idk, nameKey: nk, khmerName: hr.khmerName, name: hr.name, officerType: hr.officerType, gender: hr.gender, cardNumber: hr.cardNumber });
      if (isHospitalType(o) || isPartTimeType(o)) {
        counts.hospitalPlus.total += 1;
        if (hr.gender === 'Male' || hr.gender === 'ប្រុស') counts.hospitalPlus.male += 1;
        else if (hr.gender === 'Female' || hr.gender === 'ស្រី') counts.hospitalPlus.female += 1;
        seen.add(uniqueKey);
      } else if (isWorkerType(o)) {
        counts.worker.total += 1;
        if (hr.gender === 'Male' || hr.gender === 'ប្រុស') counts.worker.male += 1;
        else if (hr.gender === 'Female' || hr.gender === 'ស្រី') counts.worker.female += 1;
        seen.add(uniqueKey);
      }
    }
    // attach debug info for inspection in UI (non-destructive)
    counts._debug = {
      civilRetiredIdKeys: Array.from(civilRetiredIdKeys),
      civilRetiredNameKeys: Array.from(civilRetiredNameKeys),
      matchedRecords,
    };
    return counts;
  }, [list, asOfDate, isIncludedAsOf]);

  // Technical summary across all staff grouped by technical role field
  const technicalSummary = useMemo(() => {
    const label = (v) => (v && String(v).trim()) || 'មិនបានកំណត់';

    const hrSkillNormOf = (hr) => normSkill(hr.skill || '');
    // Respect as-of semantics when computing technical summary so resigned/deleted are excluded
    const sourceList = (list || []).filter(hr => (includeArchived ? isIncludedAsOf(hr, asOfDate) : isActiveAsOf(hr, asOfDate)));

    // If `skills` are available, build rows following skills order (skills_Id)
    if (skills && Array.isArray(skills) && skills.length > 0) {
      // prepare normalized group sets and reverse map member->groupIndex
      const groupNormSets = (skillGroups || []).map(g => new Set((g.members || []).map(m => normSkill(m))));
      const memberToGroup = new Map();
      (skillGroups || []).forEach((g, gi) => {
        (g.members || []).forEach(m => memberToGroup.set(normSkill(m), gi));
      });

      const rows = [];
      const emittedGroups = new Set();
      const processedSkills = new Set();

      // iterate skills in given order; if skill belongs to a group, emit the group row here (once),
      // otherwise emit the individual skill row
      for (const skill of skills) {
        const skillName = (skill.skills_Kh || '').toString();
        const skillNorm = normSkill(skillName);
        if (!skillNorm) continue;
        if (processedSkills.has(skillNorm)) continue;

        if (memberToGroup.has(skillNorm)) {
          const gi = memberToGroup.get(skillNorm);
          if (!emittedGroups.has(gi)) {
            // compute aggregate for the group
            const groupSet = groupNormSets[gi] || new Set();
            let male = 0, female = 0, civil = 0, contract = 0;
            for (const hr of sourceList || []) {
              const hs = hrSkillNormOf(hr);
              if (!hs) continue;
              if (!groupSet.has(hs)) continue;
              if (hr.civilServantId) civil++; else contract++;
              if (hr.gender === 'Male' || hr.gender === 'ប្រុស') male++;
              else if (hr.gender === 'Female' || hr.gender === 'ស្រី') female++;
            }
            rows.push({ name: (skillGroups[gi].name || `Group ${gi + 1}`), male, female, total: male + female, civil, contract, isGroup: true });
            emittedGroups.add(gi);
          }
          processedSkills.add(skillNorm); // Track that this member is handled
          continue;
        }

        // individual skill not in any group: emit normally
        let male = 0, female = 0, civil = 0, contract = 0;
        for (const hr of sourceList || []) {
          const hs = hrSkillNormOf(hr);
          if (!hs) continue;
          if (hs !== skillNorm) continue;
          if (hr.civilServantId) civil++; else contract++;
          if (hr.gender === 'Male' || hr.gender === 'ប្រុស') male++;
          else if (hr.gender === 'Female' || hr.gender === 'ស្រី') female++;
        }
        rows.push({ name: skillName, male, female, total: male + female, civil, contract, skills_Id: skill.skills_Id, skills_En: skill.skills_En });
        processedSkills.add(skillNorm);
      }

      // append any groups that were not emitted because none of their members appeared in skills[]
      for (let gi = 0; gi < (skillGroups || []).length; gi++) {
        if (emittedGroups.has(gi)) continue;
        const groupSet = groupNormSets[gi] || new Set();
        let male = 0, female = 0, civil = 0, contract = 0;
        let groupHasMembersInData = false;
        for (const hr of sourceList || []) {
          const hs = hrSkillNormOf(hr);
          if (!hs) continue;
          if (!groupSet.has(hs)) continue;
          groupHasMembersInData = true;
          if (hr.civilServantId) civil++; else contract++;
          if (hr.gender === 'Male' || hr.gender === 'ប្រុស') male++;
          else if (hr.gender === 'Female' || hr.gender === 'ស្រី') female++;
          processedSkills.add(hs); // Mark members as processed
        }
        if (groupHasMembersInData) {
          rows.push({ name: (skillGroups[gi].name || `Group ${gi + 1}`), male, female, total: male + female, civil, contract, isGroup: true });
          emittedGroups.add(gi);
        }
      }

      // NEW: Collect any remaining individual skills from employees not in the canonical list or any group
      let otherMale = 0, otherFemale = 0, otherCivil = 0, otherContract = 0;
      let hasOthers = false;
      for (const hr of sourceList || []) {
        const hs = hrSkillNormOf(hr);
        if (!hs) continue;
        if (processedSkills.has(hs)) continue;
        if (memberToGroup.has(hs)) continue; // Should have been caught by group loop above

        hasOthers = true;
        if (hr.civilServantId) otherCivil++; else otherContract++;
        if (hr.gender === 'Male' || hr.gender === 'ប្រុស') otherMale++;
        else if (hr.gender === 'Female' || hr.gender === 'ស្រី') otherFemale++;
      }

      // if (hasOthers) {
      //   rows.unshift({ name: 'ផ្សេងៗ', male: otherMale, female: otherFemale, total: otherMale + otherFemale, civil: otherCivil, contract: otherContract, isGroup: false });
      // }

      const totals = rows.reduce((acc, r) => ({
        male: acc.male + (r.male || 0),
        female: acc.female + (r.female || 0),
        total: acc.total + (r.total || 0),
        civil: (acc.civil || 0) + (r.civil || 0),
        contract: (acc.contract || 0) + (r.contract || 0),
      }), { male: 0, female: 0, total: 0, civil: 0, contract: 0 });

      return { rows, totals };
    }

    // Fallback: derive skills from existing HR list and sort by Khmer name, include civil/contract counts
    const rowsMap = new Map();
    for (const hr of sourceList || []) {
      const key = label(hr.skill);
      if (!rowsMap.has(key)) rowsMap.set(key, { name: key, male: 0, female: 0, civil: 0, contract: 0 });
      const row = rowsMap.get(key);
      if (hr.civilServantId) row.civil += 1; else row.contract += 1;
      if (hr.gender === 'Male' || hr.gender === 'ប្រុស') row.male += 1;
      else if (hr.gender === 'Female' || hr.gender === 'ស្រី') row.female += 1;
    }
    const rows = Array.from(rowsMap.values()).map(r => ({ ...r, total: r.male + r.female })).sort((a, b) => a.name.localeCompare(b.name, 'km'));
    const totals = rows.reduce((acc, r) => ({
      male: acc.male + r.male,
      female: acc.female + r.female,
      total: acc.total + r.total,
      civil: acc.civil + (r.civil || 0),
      contract: acc.contract + (r.contract || 0),
    }), { male: 0, female: 0, total: 0, civil: 0, contract: 0 });
    return { rows, totals };
  }, [list, skills, skillGroups, asOfDate, includeArchived, isIncludedAsOf, isActiveAsOf]);

  const ministryTechnicalSummary = useMemo(() => {
    const label = (v) => (v && String(v).trim()) || 'មិនបានកំណត់';
    const hrMinistrySkillNormOf = (hr) => normSkill(hr.civilServantRole || '');
    const sourceList = (list || []).filter(hr => (includeArchived ? isIncludedAsOf(hr, asOfDate) : isActiveAsOf(hr, asOfDate)));

    if (ministrySkills && Array.isArray(ministrySkills) && ministrySkills.length > 0) {
      const rows = [];
      const processedSkills = new Set();
      
      for (const skill of ministrySkills) {
        const skillName = (skill.ministryFunction || '').toString();
        const skillNorm = normSkill(skillName);
        if (!skillNorm) continue;
        if (processedSkills.has(skillNorm)) continue;

        let male = 0, female = 0, civil = 0, contract = 0;
        for (const hr of sourceList || []) {
          const hs = hrMinistrySkillNormOf(hr);
          if (!hs) continue;
          if (hs !== skillNorm) continue;
          if (hr.civilServantId) civil++; else contract++;
          if (hr.gender === 'Male' || hr.gender === 'ប្រុស') male++;
          else if (hr.gender === 'Female' || hr.gender === 'ស្រី') female++;
        }
        rows.push({ name: skillName, male, female, total: male + female, civil, contract, skills_Id: skill.skills_Id || skill.ID_skills, skills_En: skill.amount });
        processedSkills.add(skillNorm);
      }

      let otherMale = 0, otherFemale = 0, otherCivil = 0, otherContract = 0;
      let hasOthers = false;
      for (const hr of sourceList || []) {
        const hs = hrMinistrySkillNormOf(hr);
        if (!hs) continue;
        if (processedSkills.has(hs)) continue;

        hasOthers = true;
        if (hr.civilServantId) otherCivil++; else otherContract++;
        if (hr.gender === 'Male' || hr.gender === 'ប្រុស') otherMale++;
        else if (hr.gender === 'Female' || hr.gender === 'ស្រី') otherFemale++;
      }
      
      const totals = rows.reduce((acc, r) => ({
        male: acc.male + (r.male || 0),
        female: acc.female + (r.female || 0),
        total: acc.total + (r.total || 0),
        civil: (acc.civil || 0) + (r.civil || 0),
        contract: (acc.contract || 0) + (r.contract || 0),
      }), { male: 0, female: 0, total: 0, civil: 0, contract: 0 });

      return { rows, totals };
    }

    const rowsMap = new Map();
    for (const hr of sourceList || []) {
      const key = label(hr.civilServantRole);
      if (!rowsMap.has(key)) rowsMap.set(key, { name: key, male: 0, female: 0, civil: 0, contract: 0 });
      const row = rowsMap.get(key);
      if (hr.civilServantId) row.civil += 1; else row.contract += 1;
      if (hr.gender === 'Male' || hr.gender === 'ប្រុស') row.male += 1;
      else if (hr.gender === 'Female' || hr.gender === 'ស្រី') row.female += 1;
    }
    const rows = Array.from(rowsMap.values()).map(r => ({ ...r, total: r.male + r.female })).sort((a, b) => a.name.localeCompare(b.name, 'km'));
    const totals = rows.reduce((acc, r) => ({
      male: acc.male + r.male,
      female: acc.female + r.female,
      total: acc.total + r.total,
      civil: acc.civil + (r.civil || 0),
      contract: acc.contract + (r.contract || 0),
    }), { male: 0, female: 0, total: 0, civil: 0, contract: 0 });
    return { rows, totals };
  }, [list, ministrySkills, asOfDate, includeArchived, isIncludedAsOf, isActiveAsOf]);

  // total technical staff for the hospital (active as-of unless `includeArchived`)
  const hospitalTechnicalTotal = useMemo(() => {
    try {
      const asOf = asOfDate;
      const active = list.filter(hr => (includeArchived ? isIncludedAsOf(hr, asOf) : isActiveAsOf(hr, asOf)));
      const tech = active.filter(hr => {
        const s = normSkill(hr.skill || '');
        return !!s;
      });
      const seen = new Set();
      let n = 0;
      for (const hr of tech) {
        const key = hr._id || hr.staffId || hr.officerId || hr.cardNumber || (hr.name ? hr.name.trim() : JSON.stringify(hr));
        if (seen.has(key)) continue;
        seen.add(key);
        n += 1;
      }
      return n;
    } catch {
      return 0;
    }
  }, [list, asOfDate, includeArchived]);

  // Dynamic title per report type
  const computedTitle = useMemo(() => {
    if (reportType === 'total') return 'ចំនួនបុគ្គលិកសរុប នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'technical') return 'របាយការណ៍ជំនាញមន្ទីរពេទ្យ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'ministryTechnical') return 'របាយការណ៍ជំនាញក្រសួង នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'allhr') return 'បញ្ជីរាយនាម បុគ្គលិក នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'civil') return 'បញ្ជីរាយនាម មន្រ្តីរាជការ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'state') return 'បញ្ជីរាយនាម បុគ្គលិកកិច្ចសន្យារដ្ឋ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospital') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospitalOver60') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ អាយុ ៦០ ឆ្នាំឡើង នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'worker') return 'បញ្ជីរាយនាម កម្មករកិច្ចសន្យា នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospitalPartTime') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ (ក្រៅម៉ោង) នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospitalPlus') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ​ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'retiredThenContract') return 'បញ្ជីរាយនាម មន្រ្តីចូលនិវត្តន៍ បន្តកិច្ចសន្យា​ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'evaluation') return 'របាយការណ៍វាយតម្លៃការបំពេញមុខងារ និងការទទួលខុសត្រូវការងាររបស់បុគ្គលិក មន្ត្រីរាជការ';
    if (reportType === 'femaleCount') return 'តារាងប្រាក់ឧបត្ថម្ភសម្រាប់បុគ្គលិក និងមន្រ្តីរាជការជានារី - មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត ';
    return 'បញ្ជីរាយនាម មន្រ្តីចូលនិវត្តន៍ បន្តកិច្ចសន្យា នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
  }, [reportType]);

  // totals for the currently selected reportType (display next to selector)
  const selectedTotals = useMemo(() => {
    // use grandSummary for predefined groups, technicalSummary for technical report,
    // otherwise fall back to filteredList totals computed above.
    try {
      if (reportType === 'total') return grandSummary.all || { total: 0, male: 0, female: 0 };
      if (reportType === 'technical') return (technicalSummary && technicalSummary.totals) ? technicalSummary.totals : { total: 0, male: 0, female: 0 };
      if (reportType === 'ministryTechnical') return (ministryTechnicalSummary && ministryTechnicalSummary.totals) ? ministryTechnicalSummary.totals : { total: 0, male: 0, female: 0 };
      if (reportType === 'civil') return grandSummary.civil || { total: 0, male: 0, female: 0 };
      if (reportType === 'state') return grandSummary.state || { total: 0, male: 0, female: 0 };
      if (reportType === 'hospital') return grandSummary.hospital || { total: 0, male: 0, female: 0 };
      if (reportType === 'hospitalPlus') return grandSummary.hospitalPlus || { total: 0, male: 0, female: 0 };
      if (reportType === 'worker') return grandSummary.worker || { total: 0, male: 0, female: 0 };
      if (reportType === 'allhr') return totals || { total: 0, male: 0, female: 0 };
      if (reportType === 'evaluation') return totals || { total: 0, male: 0, female: 0 };
      if (reportType === 'femaleCount') {
        const f = femaleOnlyList || [];
        return { total: f.length, male: 0, female: f.length };
      }
      // fallback: counts of current filteredList
      return totals || { total: 0, male: 0, female: 0 };
    } catch { return { total: 0, male: 0, female: 0 }; }
  }, [reportType, grandSummary, technicalSummary, totals]);

  // Evaluation summary based on per-row selections (hr.evaluation or session `evaluations` state)
  // Ensure evaluation options and state are defined before use
  // Evaluation categories used in the department evaluation report
  const EVALUATION_OPTIONS = [
    'ល្អ',
    'ល្អបង្គួរ',
    'មធ្យម',
    'ខ្សោយ',
    'ផ្សេងៗ'
  ];
  const [evaluations, setEvaluations] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('employee_report_evaluations') || '{}'); } catch { return {}; }
  });
  // per-employee evaluator comments (e.g. មូលវិចារណាយផ្នែក/ការិយាល័យ)
  const [evaluatorComments, setEvaluatorComments] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('employee_report_evaluator_comments') || '{}'); } catch { return {}; }
  });
  // Footer signature titles for evaluation report
  const [footerLeftTitle, setFooterLeftTitle] = useState(() => {
    try { return sessionStorage.getItem('employee_report_footer_left') || 'នាយករងទទួលបន្ទុក'; } catch { return 'នាយករងទទួលបន្ទុក'; }
  });
  const [footerRightTitle, setFooterRightTitle] = useState(() => {
    try { return sessionStorage.getItem('employee_report_footer_right') || 'នាយផ្នែក/នាយមណ្ឌល'; } catch { return 'នាយផ្នែក/នាយមណ្ឌល'; }
  });
  useEffect(() => { try { sessionStorage.setItem('employee_report_footer_left', footerLeftTitle); } catch { } }, [footerLeftTitle]);
  useEffect(() => { try { sessionStorage.setItem('employee_report_footer_right', footerRightTitle); } catch { } }, [footerRightTitle]);

  // Auto-set footer right title based on selected department
  useEffect(() => {
    if (reportType === 'evaluation' && selectedDept) {
      const deptStr = selectedDept.toString().toLowerCase();
      if (deptStr.includes('ការិយាល័យរដ្ឋបាល') || deptStr.includes('ការិយាល័យរដ្ឋបាល') || deptStr.includes('office')) {
        setFooterRightTitle('ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក');
      } else if (deptStr.includes('ការិយាល័យហិរញ្ញវត្ថុ') || deptStr.includes('ការិយាល័យហិរញ្ញវត្ថុ')) {
        setFooterRightTitle('ប្រធានការិយាល័យហិរញ្ញវត្ថុ');
      } else if (deptStr.includes('បច្ចេកទេស') || deptStr.includes('ការិយាល័យបច្ចេកទេស') || deptStr.includes('technical')) {
        setFooterRightTitle('ប្រធានការិយាល័យបច្ចេកទេស');
      } else if (deptStr.includes('មណ្ឌល')) {
        setFooterRightTitle('នាយមណ្ឌល');
      } else if (deptStr.includes('ផ្នែក')) {
        setFooterRightTitle('នាយផ្នែក');
      }
    }
  }, [selectedDept, reportType]);
  useEffect(() => { try { sessionStorage.setItem('employee_report_evaluator_comments', JSON.stringify(evaluatorComments || {})); } catch { } }, [evaluatorComments]);
  useEffect(() => { try { sessionStorage.setItem('employee_report_evaluations', JSON.stringify(evaluations || {})); } catch { } }, [evaluations]);

  const evaluationSummary = useMemo(() => {
    const opts = EVALUATION_OPTIONS || [];
    const by = {};
    opts.forEach(o => by[o] = 0);
    let total = 0;
    for (const hr of filteredList || []) {
      const keyId = hr._id || hr.staffId || hr.officerId || hr.cardNumber || '';
      const val = (hr.evaluation) || (evaluations && evaluations[keyId]) || '';
      if (val && opts.includes(val)) {
        by[val] = (by[val] || 0) + 1;
      }
      total += 1;
    }
    const pct = {};
    opts.forEach(o => {
      pct[o] = total > 0 ? Math.round((by[o] || 0) * 100 / total) : 0;
    });
    return { total, by, pct, options: opts };
  }, [filteredList, evaluations]);

  // Scoped CSS so on-screen looks like the printed version
  const SCREEN_CSS = `
  .print-scope { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; font-size: 12px; }
    .print-scope h1, .print-scope h2, .print-scope h3 { margin: 6px 0; }
    .print-scope .title { text-align: center; margin-bottom: 6px; }
    .print-scope .title h2 { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; font-size: 15px; }
    .print-scope .subtitle { text-align: center; margin-bottom: 8px; }
    .print-scope table { width: 100%; border-collapse: collapse; border: 1px solid #222; }
  .print-scope th, .print-scope td { border: 1px solid #222; padding: 6px 4px; font-size: 13px; vertical-align: middle; text-align: center; }
    .print-scope th { background: #f7f7f7; font-family: "Khmer OS Siemreap", serif; font-weight: bold; text-align: center; }
  /* First column is label, second is small spacer, third is sub-label, last three are numbers */
  .print-scope th:first-child, .print-scope td:first-child { /* auto width - remaining space */ }
  /* Right-hand numeric columns use fixed pixel widths so numbers align */
  .print-scope th:nth-child(4), .print-scope th:nth-child(5), .print-scope th:nth-child(6),
  .print-scope td:nth-child(4), .print-scope td:nth-child(5), .print-scope td:nth-child(6) { width: 76px; }
    .print-scope td.center, .print-scope th.center { text-align: center; }
    .print-scope .section-row th { background: #efefef; text-align: left; font-weight: normal; font-family: "Khmer OS Muol Light", serif; font-size: 11px; }
    .print-scope .no-border { border: 0 none; }
    .print-scope .footer-notes { margin-top: 12px; font-size: 12px; }
    .print-scope .signatures { display: flex; justify-content: space-between; margin-top: 20px; font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; font-size: 12px; text-align: center; }
    .print-scope .signatures > div { flex: 1; }
    .print-scope .subtotal td, .print-scope .subtotal th { font-weight: 700; }
    /* A4 portrait preview for on-screen view - use px equivalents so screen preview closely matches printed size
       210mm ≈ 794px, 297mm ≈ 1123px at 96dpi. Use 20mm print margin ≈ 56.7px to match @page margin below. */
    .a4-portrait { 
      /* Use physical A4 units so on-screen preview matches print sizing */
      width: 210mm; 
      min-height: 297mm; 
      margin: 0 auto; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      background: #fff;
      position: relative;
      padding: 10mm; /* inner margin for content */
      box-sizing: border-box;
      overflow: visible;
    }
    .a4-landscape {
      width: 297mm;
      min-height: 210mm;
      margin: 0 auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      background: #fff;
      position: relative;
      padding: 10mm;
      box-sizing: border-box;
      overflow: visible;
    }
    .print-scope thead th {
      position: sticky;
      top: ${filterHeight - 24}px; 
      z-index: 30;
      background: #f7f7f7 !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    /* Special offset for technical report header which might need to stick above others */
    .print-scope table {
      border-collapse: separate; /* Required for some sticky border fixes */
      border-spacing: 0;
    }
    .print-scope th, .print-scope td {
      border: 1px solid #222;
    }
    /* column resizer handle for screen preview */
    .print-scope th { position: relative; padding-right: 12px; }
    .print-scope .col-resizer { position: absolute; top: 0; right: -6px; width: 16px; height: 100%; cursor: col-resize; background: transparent; z-index: 5; touch-action: none; }
    .print-scope .col-resizer:hover { background: rgba(0,0,0,0.06); }
    body._colresizing_ { user-select: none; }
    .a4-portrait .print-scope { background: transparent; }
    @media print {
      /* Remove preview chrome when printing and let @page control margins */
      .a4-portrait, .a4-landscape { width: auto; min-height: auto; box-shadow: none; padding: 0; }
      @page { size: A4; margin: 10mm; }
    }
  `;

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const pageSize = (orientation === 'landscape') ? 'A4 landscape' : 'A4';
    const PRINT_STYLES = `
      <style>
  /* Match on-screen preview sizing and margins so printed output visually matches preview */
    @page { size: ${pageSize}; margin: 10mm; }
  body { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; margin: 0;font-size: 12px; }
    h1,h2,h3 { margin-top: 0; }
  .title { text-align: center; margin-bottom: 6px; }
  .title h2 { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; font-size: 15px; }
  .subtitle { text-align: center; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #222; }
  th, td { border: 1px solid #222; padding: 8px 6px; font-size: 13px; vertical-align: middle; text-align: center; }
  th { background: #f7f7f7; font-family: "Khmer OS Siemreap", serif; font-weight: bold; text-align: center; }
  /* Let first columns size automatically; fix numeric right columns */
  th:first-child, td:first-child { }
  th:nth-child(4), th:nth-child(5), th:nth-child(6), td:nth-child(4), td:nth-child(5), td:nth-child(6) { width: 76px; }
  .center { text-align: center; }
  .section-row th { background: #efefef; text-align: left; font-weight: normal; font-family: "Khmer OS Muol Light", serif; font-size: 11px; }
  .no-border { border: 0 none; }
  .footer-notes { margin-top: 12px; font-size: 12px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 20px; font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; fontSize: 12px; text-align: center; }
  .signatures > div { flex: 1; }
  /* Constrain printed document to A4 content area so it matches preview layout */
  .a4-portrait { width: 210mm; min-height: 297mm; padding: 10mm; box-sizing: border-box; background: #fff; }
  .a4-landscape { width: 297mm; min-height: 210mm; padding: 10mm; box-sizing: border-box; background: #fff; }
  /* Dynamic row height / padding overrides - allow wrapping for multi-line cells */
  .print-scope tbody tr { min-height: ${rowHeight}px; }
  .print-scope tbody tr > td, .print-scope tbody tr > th { vertical-align: middle !important; white-space: normal !important; overflow: visible !important; text-overflow: unset !important; }
  .print-scope th, .print-scope td { padding: ${Math.max(6, Math.round(rowHeight / 4))}px ${Math.max(4, Math.round(rowHeight / 8))}px !important; line-height: ${Math.max(12, Math.round(rowHeight * 0.6))}px !important; }
      </style>
    `;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>${PRINT_STYLES}</head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  // Column resize handlers
  const startColResize = (colIndex, e) => {
    e.preventDefault();
    resizingRef.current = { colIndex, startX: e.clientX, startWidths: [...colWidths] };
    document.body.classList.add('_colresizing_');
    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidths = [...resizingRef.current.startWidths];
      newWidths[colIndex] = Math.max(40, Math.round(resizingRef.current.startWidths[colIndex] + delta));
      setColWidths(newWidths);
    };
    const onUp = () => {
      if (resizingRef.current) {
        try { sessionStorage.setItem('employee_report_col_widths', JSON.stringify(colWidths)); } catch { void 0; }
      }
      resizingRef.current = null;
      document.body.classList.remove('_colresizing_');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Edit handler for each row (only works when user has edit permissions)
  const handleEdit = (hr) => {
    try {
      const canEdit = !!(perms?.canEditHR || perms?.canEditEmployees);
      if (!canEdit) {
        alert('ត្រូវការ សិទ្ធិ: edit:hr ឬ edit:employees');
        return;
      }
      // prefer stable id keys
      const id = hr?._id || hr?.staffId || hr?.officerId || hr?.cardNumber;
      if (!id) {
        alert('មិនមានអត្តសញ្ញាណសម្រាប់កែប្រែ');
        return;
      }
      // navigate to an edit route (adjust path if your app uses a different route)
      window.location.href = `/hr/edit/${encodeURIComponent(id)}`;
    } catch (e) {
      console.error(e);
      alert('កើតបញ្ហារ');
    }
  };

  // Build the main report content (table) into a variable to keep JSX clean
  const reportContent = (() => {
    if (reportType === 'total') {
      return (
        <table>
          <colgroup>
            <col style={{ width: colWidths[0] + 'px' }} />
            <col style={{ width: colWidths[1] + 'px' }} />
            <col style={{ width: colWidths[2] + 'px' }} />
            <col style={{ width: colWidths[3] + 'px' }} />
            <col style={{ width: colWidths[4] + 'px' }} />
          </colgroup>
          <thead>
            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <th style={{ fontFamily: "Khmer OS Muol Light", fontSize: 13, fontWeight: 'normal' }}>
                ប្រភេទមន្ត្រី
                <div className="col-resizer" onMouseDown={(e) => startColResize(0, e)} />
              </th>
              <th style={{ fontFamily: "Khmer OS Muol Light", fontSize: 13, fontWeight: 'normal' }}>

                <div className="col-resizer" onMouseDown={(e) => startColResize(1, e)} />
              </th>
              <th style={{ fontFamily: "Khmer OS Muol Light", fontSize: 13, fontWeight: 'normal' }} className="center">សរុប<div className="col-resizer" onMouseDown={(e) => startColResize(2, e)} /></th>
              <th className="center">ប្រុស<div className="col-resizer" onMouseDown={(e) => startColResize(3, e)} /></th>
              <th className="center">ស្រី<div className="col-resizer" onMouseDown={(e) => startColResize(4, e)} /></th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <td>មន្រ្តីរាជការ</td>
              <td></td>
              <td className="center">{toKhmerDigits(grandSummary.civil.total)}</td>
              <td className="center">{toKhmerDigits(grandSummary.civil.male)}</td>
              <td className="center">{toKhmerDigits(grandSummary.civil.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <td>កិច្ចសន្យារដ្ឋ</td>
              <td></td>
              <td className="center">{toKhmerDigits(grandSummary.state.total)}</td>
              <td className="center">{toKhmerDigits(grandSummary.state.male)}</td>
              <td className="center">{toKhmerDigits(grandSummary.state.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Siemreap", fontSize: 13, fontWeight: 'bold' }}>
              <td rowSpan={4}>កិច្ចសន្យាមន្ទីរពេទ្យ <p style={{ marginTop: 10 }}>ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)</p> <p style={{ marginTop: 10 }}></p>និងកិច្ចសន្យាក្រៅម៉ោង</td>
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, }}>ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.hospitalPlus.total)}</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.hospitalPlus.male)}</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.hospitalPlus.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Siemreap", fontSize: 13, }}>
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, }}>អាយុលើស ៦០ឆ្នាំ</td>
              <td className="center">{toKhmerDigits(hospitalPlusAgeOver60.total)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusAgeOver60.male)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusAgeOver60.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Siemreap", fontSize: 13, }}>
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, }}>អាយុក្រោម ៦០ឆ្នាំ</td>
              <td className="center">{toKhmerDigits(hospitalPlusBreakdown.under60.total)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusBreakdown.under60.male)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusBreakdown.under60.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, fontWeight: 'bold' }}><center>សរុប</center></td>
              <td className="center">{toKhmerDigits(hospitalPlusBreakdown.all.total)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusBreakdown.all.male)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusBreakdown.all.female)}</td>
            </tr>
            {/* Worker group: mirror hospital+part-time layout (grouped rows with subtotal + breakdown) */}
            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <td rowSpan={4} style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, fontWeight: 'bold' }}>កម្មករកិច្ចសន្យា</td>
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, fontWeight: 'bold' }}>ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.worker.total)}</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.worker.male)}</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.worker.female)}</td>
            </tr>
            <tr style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, }}>
              <td>អាយុលើស ៦០ ឆ្នាំ</td>
              <td className="center">{toKhmerDigits(workerBreakdown.over60.total)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.over60.male)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.over60.female)}</td>
            </tr>
            <tr style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, }}>
              <td>អាយុក្រោម ៦០ឆ្នាំ</td>
              <td className="center">{toKhmerDigits(workerBreakdown.under60.total)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.under60.male)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.under60.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, fontWeight: 'bold' }}><center>សរុប</center></td>
              <td className="center">{toKhmerDigits(workerBreakdown.all.total)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.all.male)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.all.female)}</td>
            </tr>

            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <td>សរុបកិច្ចសន្យា (មន្ទីរពេទ្យ + ក្រៅម៉ោង + កម្មករ)</td>
              <td></td>
              <td className="center">{toKhmerDigits(grandSummary.hospitalPlus.total)}</td>
              <td className="center">{toKhmerDigits(grandSummary.hospitalPlus.male)}</td>
              <td className="center">{toKhmerDigits(grandSummary.hospitalPlus.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Muol Light", fontSize: 11, fontWeight: 'normal' }}>
              <td>សរុបបុគ្គលិកទាំងអស់</td>
              <td></td>
              <td className="center">{toKhmerDigits(grandSummary.all.total)}</td>
              <td className="center">{toKhmerDigits(grandSummary.all.male)}</td>
              <td className="center">{toKhmerDigits(grandSummary.all.female)}</td>
            </tr>
          </tbody>
        </table>
      );
    }
    if (reportType === 'technical') {
      // Render using precomputed technicalSummary.rows (which include civil/contract/male/female/total)
      return (
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>ល.រ</th>
              <th>ជំនាញបច្ចេកទេស</th>
              <th className="center">មន្រ្តីរាជការ</th>
              <th className="center">មន្រ្តីកិច្ចសន្យា</th>
              <th className="center">សរុប</th>
              <th className="center">ប្រុស</th>
              <th className="center">ស្រី</th>
            </tr>
          </thead>
          <tbody>
            {technicalSummary.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="center text-gray-600">មិនមានទិន្នន័យ</td>
              </tr>
            )}
            {technicalSummary.rows.map((r, idx) => (
              <tr key={r.name || idx}>
                <td className="center">{toKhmerDigits(idx + 1)}</td>
                <td style={{ textAlign: 'left' }}>{r.name}</td>
                <td className="center">{toKhmerDigits(r.civil || 0)}</td>
                <td className="center">{toKhmerDigits(r.contract || 0)}</td>
                <td className="center">{toKhmerDigits(r.total || 0)}</td>
                <td className="center">{toKhmerDigits(r.male || 0)}</td>
                <td className="center">{toKhmerDigits(r.female || 0)}</td>
              </tr>
            ))}
            {technicalSummary.rows.length > 0 && (
              <>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', fontWeight: 700 }}>សរុប </td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(technicalSummary.totals.civil || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(technicalSummary.totals.contract || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(technicalSummary.totals.total || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(technicalSummary.totals.male || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(technicalSummary.totals.female || 0)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      );
    }
    if (reportType === 'ministryTechnical') {
      return (
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>ល.រ</th>
              <th>ជំនាញក្រសួង</th>
              <th className="center">មន្រ្តីរាជការ</th>
              <th className="center">មន្រ្តីកិច្ចសន្យា</th>
              <th className="center">សរុប</th>
              <th className="center">ប្រុស</th>
              <th className="center">ស្រី</th>
            </tr>
          </thead>
          <tbody>
            {ministryTechnicalSummary.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="center text-gray-600">មិនមានទិន្នន័យ</td>
              </tr>
            )}
            {ministryTechnicalSummary.rows.map((r, idx) => (
              <tr key={r.name || idx}>
                <td className="center">{toKhmerDigits(idx + 1)}</td>
                <td style={{ textAlign: 'left' }}>{r.name}</td>
                <td className="center">{toKhmerDigits(r.civil || 0)}</td>
                <td className="center">{toKhmerDigits(r.contract || 0)}</td>
                <td className="center">{toKhmerDigits(r.total || 0)}</td>
                <td className="center">{toKhmerDigits(r.male || 0)}</td>
                <td className="center">{toKhmerDigits(r.female || 0)}</td>
              </tr>
            ))}
            {ministryTechnicalSummary.rows.length > 0 && (
              <>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', fontWeight: 700 }}>សរុប </td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(ministryTechnicalSummary.totals.civil || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(ministryTechnicalSummary.totals.contract || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(ministryTechnicalSummary.totals.total || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(ministryTechnicalSummary.totals.male || 0)}</td>
                  <td className="center" style={{ fontWeight: 700 }}>{toKhmerDigits(ministryTechnicalSummary.totals.female || 0)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      );
    }
    if (reportType === 'evaluation') {
      const evalOrder = ['serialDept', 'name', 'skill', 'position', 'totalMonthlyAttendance', 'performanceResult', 'otherNotes', 'staffId'];
      const visibleListCols = evalOrder
        .map(key => listColumns.find(c => c.key === key))
        .filter(c => c);
      
      const colCount = visibleListCols.length;

      return (
        <table style={{ tableLayout: 'auto', textAlign: 'center' }}>
          <thead>
            <tr>
              {visibleListCols.map(c => {
                let headerContent = c.label;
                if (c.key === 'totalMonthlyAttendance') {
                  headerContent = (
                    <div style={{ lineHeight: '1.2', fontWeight: 'bold' }}>
                      <div>សរុបវត្តមាន</div>
                      <div>ប្រចាំខែ</div>
                    </div>
                  );
                } else if (c.key === 'performanceResult') {
                  headerContent = (
                    <div style={{ lineHeight: '1.2', fontWeight: 'bold' }}>
                      <div>លទ្ធផលការងារ</div>
                      <div>សម្រេចបាន</div>
                    </div>
                  );
                } else if (c.key === 'staffId') {
                  headerContent = (
                    <div style={{ lineHeight: '1.2', fontWeight: 'bold' }}>
                      <div>អត្តលេខ</div>
                      <div>កាត់</div>
                    </div>
                  );
                } else if (c.key === 'serialDept') {
                  headerContent = <div style={{ fontWeight: 'bold' }}>ល.រ</div>;
                } else {
                  headerContent = <div style={{ fontWeight: 'bold' }}>{c.label}</div>;
                }
                
                return (
                  <th key={c.key} style={{ width: c.width, textAlign: 'center', padding: '10px 4px' }}>
                    {headerContent}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td colSpan={colCount} className="center text-gray-600">មិនមានទិន្នន័យ</td>
              </tr>
            )}
            {grouped.map((g, gi) => (
              <React.Fragment key={g.dept || gi}>
                <tr className="section-row">
                  <th colSpan={colCount} style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc', fontFamily: '"Khmer OS Muol Light", serif', borderBottom: '2px solid #cbd5e1' }}>
                    {g.dept}
                  </th>
                </tr>
                {g.items.map((r, idx) => (
                  <tr style={{ textAlign: 'center' }} key={r._id || idx}>
                    {visibleListCols.map(c => {
                      if (c.key === 'serialDept') {
                        return <td key={c.key} className="center">{toKhmerDigits(idx + 1)}</td>;
                      }
                      if (c.key === 'name') {
                        return <td key={c.key} style={{ textAlign: 'left', paddingLeft: '12px' }}>{r.khmerName || r.name || ''}</td>;
                      }
                      if (c.key === 'skill') {
                        return <td key={c.key} style={{ textAlign: 'left' }}>{r.skill || ''}</td>;
                      }
                      if (c.key === 'position') {
                        return <td key={c.key} style={{ textAlign: 'left' }}>{r.position || ''}</td>;
                      }
                      if (c.key === 'totalMonthlyAttendance') {
                        return <td key={c.key} className="center">{r.totalMonthlyAttendance || ''}</td>;
                      }
                      if (c.key === 'performanceResult') {
                        return <td key={c.key} className="center">{r.performanceResult || ''}</td>;
                      }
                      if (c.key === 'otherNotes') {
                        return <td key={c.key} style={{ textAlign: 'left' }}>{r.otherNotes || ''}</td>;
                      }
                      if (c.key === 'staffId') {
                        return <td key={c.key} className="center">{r.staffId || ''}</td>;
                      }
                      return <td key={c.key}>{''}</td>;
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      );
    }
    if (reportType === 'femaleCount') {
      return (
        <table>
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>អត្តលេខកាត់</th>
              <th style={{ width: '60px', textAlign: 'center' }}>ស.រ</th>
              <th style={{ width: '60px', textAlign: 'center' }}>ល.រ</th>
              <th style={{ textAlign: 'center' }}>គោត្តនាម និងនាម</th>
              <th style={{ textAlign: 'center' }}>អក្សរឡាតាំង</th>
              <th style={{ width: '60px', textAlign: 'center' }}>ភេទ</th>
              <th style={{ textAlign: 'center' }}>តួនាទី</th>
              <th style={{ width: '100px', textAlign: 'center' }}>ថ្ងៃខែឆ្នាំកណើត</th>
              <th style={{ textAlign: 'center' }}>លេខធនាគា</th>
              <th style={{ textAlign: 'center' }}>មុខងារ</th>
              <th style={{ width: '140px', textAlign: 'center' }}>ប្រាក់ឧបត្ថម្ភ</th>
              <th style={{ width: '140px', textAlign: 'center' }}>ផ្នែក</th>
            </tr>
          </thead>
          <tbody>
            {(femaleOnlyList || []).length === 0 && (
              <tr><td colSpan={10} className="center text-gray-600">មិនមានទិន្នន័យ</td></tr>
            )}
            {(femaleOnlyList || []).map((r, idx) => {
              const key = r._id || r.staffId || r.officerId || r.name || String(idx);
              const overall = overallIndexMap[key] || (idx + 1);
              const deptIdx = (() => {
                // compute per-department index
                const dept = grouped.find(g => (g.items || []).some(it => (it._id || it.staffId || it.officerId) === (r._id || r.staffId || r.officerId)));
                if (!dept) return 1;
                return (dept.items || []).findIndex(it => (it._id || it.staffId || it.officerId) === (r._id || r.staffId || r.officerId)) + 1;
              })();
              const grant = r.grantAmount || r.bonus || r.allowance || r.extraGrant || r.grant || '';
              return (
                <tr key={key}>
                  <td style={{ textAlign: 'left' }}>{r.staffId || ''}</td>
                  <td className="center">{toKhmerDigits(overall)}</td>
                  <td className="center">{toKhmerDigits(deptIdx)}</td>
                  <td style={{ textAlign: 'left' }}>{r.khmerName || r.name || ''}</td>
                  <td style={{ textAlign: 'left' }}>{r.name || r.nameEn || r.englishName || ''}</td>
                  <td className="center">{r.gender === 'Female' || r.gender === 'ស្រី' ? 'ស' : ''}</td>
                  <td style={{ textAlign: 'left' }}>{r.position || ''}</td>
                  <td className="center">{fmtDate(r.dob)}</td>
                  <td style={{ textAlign: 'left' }}>{r.bankAccount || r.bank_account || r.bank || ''}</td>
                  <td style={{ textAlign: 'left' }}>{r.civilServantRole || r.skill || ''}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrencyKhmer(grant)}50 000រៀល</td>
                  <td style={{ textAlign: 'left' }}>{r.department || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
    // default: list of staff (render columns conditionally based on `visibleCols`)
    const visibleListCols = listColumns.filter(c => !!visibleCols[c.key]);

    return (
      <table style={{ tableLayout: 'auto', textAlign: 'center' }}>
        <thead>
          <tr>
            {visibleListCols.map(c => {
              const label = (c.key === 'idOrOfficerType' && ['state', 'hospital', 'worker', 'hospitalPlus', 'hospitalPartTime', 'retiredThenContract'].includes(reportType)) ? 'ប្រភេទមន្ត្រី' : c.label;
              return <th key={c.key} style={{ width: c.width, textAlign: 'center' }}>{label}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {grouped.length === 0 && (
            <tr>
              <td colSpan={visibleCount} className="center text-gray-600">មិនមានទិន្នន័យ</td>
            </tr>
          )}
          {grouped.map((g, gi) => (
            <React.Fragment key={g.dept || gi}>
              <tr className="section-row">
                <th className="no-border" colSpan={visibleCount}>{toKhmerRoman(gi + 1)}&nbsp;&nbsp;{g.dept}</th>
              </tr>
              {g.items.map((r, idx) => (
                <tr style={{ textAlign: 'center' }} key={r._id || idx}>
                  {visibleListCols.map(c => {
                    if (c.key === 'serialOverall') {
                      const key = r._id || r.staffId || r.officerId || r.name || String(idx);
                      const overall = overallIndexMap[key] || (grouped.slice(0, gi).reduce((s, gp) => s + (gp.items?.length || 0), 0) + idx + 1);
                      return <td key={c.key} className="center">{toKhmerDigits(overall)}</td>;
                    }
                    if (c.key === 'serialDept') {
                      return <td key={c.key} className="center">{toKhmerDigits(idx + 1)}</td>;
                    }
                    if (c.key === 'name') {
                      return <td key={c.key} style={{ textAlign: 'left' }}>{r.khmerName || r.name || ''}</td>;
                    }
                    if (c.key === 'latinName') {
                      return <td key={c.key} style={{ textAlign: 'left' }}>{r.nameLatin || r.nameEn || r.englishName || r.name || ''}</td>;
                    }
                    if (c.key === 'staffId') {
                      return <td key={c.key} className="center">{r.staffId || r.cardNumber || r.staffCode || ''}</td>;
                    }
                    if (c.key === 'gender') {
                      return <td key={c.key} className="center">{r.gender === 'Male' ? 'ប' : r.gender === 'Female' ? 'ស' : ''}</td>;
                    }
                    if (c.key === 'dob') {
                      return <td key={c.key} className="center" style={{ textAlign: 'right' }}>{fmtDate(r.dob)}</td>;
                    }
                    if (c.key === 'salaryLevel') {
                      return <td key={c.key} className="center">{r.salaryLevel || ''}</td>;
                    }
                    if (c.key === 'idOrOfficerType') {
                      const isContract = ['state', 'hospital', 'worker', 'hospitalPlus', 'hospitalPartTime', 'retiredThenContract'].includes(reportType);
                      const displayVal = isContract ? (r.officerType || '') : (r.civilServantId || r.officerId || r.staffId || r.idCardNumber || r.officerCardNumber || r.cardNumber || '');
                      return <td key={c.key} className="center">{displayVal}</td>;
                    }
                    if (c.key === 'skill') {
                      const skillVal = r.civilServantRole || r.skill || '';
                      return <td key={c.key} style={{ textAlign: 'left' }}>{skillVal}</td>;
                    }
                    if (c.key === 'position') {
                      return <td key={c.key} style={{ textAlign: 'left' }}>{r.position || ''}</td>;
                    }
                    if (c.key === 'totalMonthlyAttendance') {
                      return (
                        <td key={c.key} className="center">
                          <input
                            type="number"
                            min="0"
                            style={{ width: 60, textAlign: 'center' }}
                            value={r.totalMonthlyAttendance || ''}
                            onChange={e => {
                              const val = e.target.value;
                              grouped[gi].items[idx].totalMonthlyAttendance = val;
                              setList([...list]);
                            }}
                          />
                        </td>
                      );
                    }
                    if (c.key === 'performanceResult') {
                      return (
                        <td key={c.key} className="center">
                          <select
                            value={r.performanceResult || ''}
                            onChange={e => {
                              grouped[gi].items[idx].performanceResult = e.target.value;
                              setList([...list]);
                            }}
                          >
                            <option value="">--ជ្រើសរើស--</option>
                            <option value="ល្អ">ល្អ</option>
                            <option value="ល្អបង្គួរ">ល្អបង្គួរ</option>
                            <option value="មធ្យម">មធ្យម</option>
                            <option value="ខ្សោយ">ខ្សោយ</option>
                          </select>
                        </td>
                      );
                    }
                    if (c.key === 'otherNotes') {
                      return (
                        <td key={c.key} style={{ textAlign: 'left' }}>
                          <input
                            type="text"
                            style={{ width: 100 }}
                            value={r.otherNotes || ''}
                            onChange={e => {
                              grouped[gi].items[idx].otherNotes = e.target.value;
                              setList([...list]);
                            }}
                          />
                        </td>
                      );
                    }
                    if (c.key === 'department') {
                      return <td key={c.key} style={{ textAlign: 'left' }}>{r.Department_Kh || r.department || r.unit || ''}</td>;
                    }
                    if (c.key === 'phone') {
                      return <td key={c.key} className="center">{r.phone || r.mobile || r.tel || r.contact || ''}</td>;
                    }
                    if (c.key === 'nid') {
                      return <td key={c.key} className="center">{r.nid || r.nationalId || r.identityNumber || r.identity || ''}</td>;
                    }
                    if (c.key === 'bankAccount') {
                      return <td key={c.key} style={{ textAlign: 'left' }}>{r.bankAccount || r.bank_account || r.bank || ''}</td>;
                    }
                    if (c.key === 'joinDate') {
                      return <td key={c.key} className="center">{fmtDate(r.joinDate || r.dateJoinedMinistry || r.nominationStartDate || r.startDate || '')}</td>;
                    }
                    if (c.key === 'birthplace') {
                      return <td key={c.key} style={{ textAlign: 'left' }}>{r.placeOfBirth || r.birthPlace || r.currentAddress || r.address || ''}</td>;
                    }
                    if (c.key === 'actions') {
                      return (
                        <td key={c.key} className="center">
                          <button type="button" onClick={() => handleEdit(r)} className="px-2 py-1 border rounded text-sm">កែ</button>
                        </td>
                      );
                    }
                    // default empty cell for any other column
                    return <td key={c.key}>{''}</td>;
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    );
  })();

  // Export current filteredList as CSV (Excel-friendly)
  const handleExportExcel = async () => {
    try {
      const isCivil = (reportType === 'civil');
      const isFemaleExport = (reportType === 'femaleCount');

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('EmployeeReport');

      // 1. Define column structure
      const listColumnsLocal = [
        { key: 'serialOverall', label: 'ស.រ', width: 5.7 },
        { key: 'serialDept', label: 'ល.រ', width: 4.7 },
        { key: 'name', label: 'គោត្តនាម និងនាម', width: 17.1 },
        { key: 'gender', label: 'ភេទ', width: 4.8 },
        { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកំណើត', width: 15.3 },
        { key: 'salaryLevel', label: 'កាំប្រាក់', width: 9.1 },
        { key: 'idOrOfficerType', label: 'អត្តលេខមន្ត្រី', width: 16.3 },
        { key: 'skill', label: 'ជំនាញ', width: 26.7 },
        { key: 'position', label: 'តួនាទី', width: 26.1 },
        { key: 'department', label: 'ផ្នែក', width: 25 },
        { key: 'staffId', label: 'អត្តលេខកាត់', width: 15 },
        { key: 'totalMonthlyAttendance', label: 'សរុបវត្តមានប្រចាំខែ', width: 15 },
        { key: 'performanceResult', label: 'លទ្ធផលការងារសម្រេចបាន', width: 20 },
        { key: 'otherNotes', label: 'ផ្សេងៗ', width: 20 },
        { key: 'latinName', label: 'ឈ្មោះឡាតាំង', width: 20 },
        { key: 'phone', label: 'លេខទូរស័ព្ទ', width: 15 },
        { key: 'joinDate', label: 'កាលបរិច្ឆេទចូល', width: 15 },
        { key: 'birthplace', label: 'ទីកន្លែងកំណើត/បច្ចុប្បន្ន', width: 30 },
        { key: 'nid', label: 'លេខអត្តសញ្ញាណ', width: 15 },
        { key: 'bankAccount', label: 'លេខគណនីធនាគារ', width: 20 }
      ];

      const civilCols = [
        { key: 'serialOverall', label: 'ស.រ', width: 6 },
        { key: 'serialDept', label: 'ល.រ', width: 6 },
        { key: 'name', label: 'គោត្តនាម និងនាម', width: 22 },
        { key: 'gender', label: 'ភេទ', width: 6 },
        { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកំណើត', width: 14 },
        { key: 'salaryLevel', label: 'កាំប្រាក់', width: 10 },
        { key: 'skill', label: 'ជំនាញ', width: 20 },
        { key: 'position', label: 'តួនាទី', width: 20 },
      ];

      const femaleDetailCols = [
        { key: 'staffId', label: 'អត្តលេខកាត់', width: 15 },
        { key: 'serialOverall', label: 'ស.រ', width: 8 },
        { key: 'serialDept', label: 'ល.រ', width: 8 },
        { key: 'name', label: 'គោត្តនាម និងនាម', width: 25 },
        { key: 'latinName', label: 'អក្សរឡាតាំង', width: 20 },
        { key: 'gender', label: 'ភេទ', width: 8 },
        { key: 'position', label: 'តួនាទី', width: 25 },
        { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកណើត', width: 15 },
        { key: 'bankAccount', label: 'លេខធនាគា', width: 20 },
        { key: 'skill', label: 'មុខងារ', width: 20 },
        { key: 'grant', label: 'ប្រាក់ឧបត្ថម្ភ', width: 15 },
        { key: 'department', label: 'ផ្នែក', width: 25 },
      ];

      let visibleOrder = [];
      if (isFemaleExport) {
        visibleOrder = femaleDetailCols;
      } else {
        visibleOrder = listColumnsLocal.filter(c => !!visibleCols[c.key]);
      }

      // Set Keys and Widths
      sheet.columns = visibleOrder.map(c => ({ key: c.key, width: c.width || 15 }));

      const footerDateStr = asOfDate || new Date().toISOString().slice(0, 10);
      const titleText = (typeof computedTitle === 'string' && computedTitle) ? computedTitle : (isCivil ? 'បញ្ជីរាយនាម មន្រ្តីរាជការ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត' : '');
      const dateText = footerDateStr ? `គិតត្រឹម ${fmtKhmerLongDate(footerDateStr)}` : '';

      // 1. Add Row 1 Empty
      sheet.addRow([]);

      // 2. Add Title & Date
      const titleRow = sheet.addRow([titleText]);
      titleRow.getCell(1).font = { name: 'Khmer OS Muol Light', size: 10 };
      titleRow.getCell(1).alignment = { horizontal: 'center' };
      sheet.mergeCells(2, 1, 2, visibleOrder.length);

      const dateRow = sheet.addRow([dateText]);
      dateRow.getCell(1).font = { name: 'Khmer OS Siemreap', size: 11, bold: true };
      dateRow.getCell(1).alignment = { horizontal: 'center' };
      sheet.mergeCells(3, 1, 3, visibleOrder.length);

      sheet.addRow([]); // spacer (Row 4)

      // 3. Female Summary (if applicable)
      if (isFemaleExport) {
        const femaleSummaryCols = [
          { key: 'idx', label: 'ល.រ', width: 8 },
          { key: 'dept', label: 'ផ្នែក', width: 40 },
          { key: 'count', label: 'ចំនួនស្រី', width: 15 },
        ];
        const hRow = sheet.addRow(femaleSummaryCols.map(c => c.label));
        hRow.eachCell(c => {
          c.font = { name: 'Khmer OS Siemreap', bold: true };
          c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
          c.alignment = { horizontal: 'center' };
        });

        const femaleBase = femaleOnlyList || [];
        const map = new Map();
        femaleBase.forEach(hr => {
          const d = hr.Department_Kh || hr.department || hr.unit || '—';
          if (!map.has(d)) map.set(d, []);
          map.get(d).push(hr);
        });
        Array.from(map.entries()).forEach((entry, i) => {
          const r = sheet.addRow([String(i + 1), entry[0], String(entry[1].length)]);
          r.eachCell(c => {
            c.font = { name: 'Khmer OS Siemreap' };
            c.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          });
        });
        sheet.addRow([]);
      }

      // 4. Main Header
      const headerRow = sheet.addRow(visibleOrder.map(c => c.label));
      headerRow.eachCell((cell, i) => {
        cell.font = { name: 'Khmer OS Siemreap', size: 11, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // 5. Data Rows
      let overallIdx = 0;
      (grouped || []).forEach((g, gi) => {
        // Dept Header (Image B)
        const deptLabel = `${toKhmerRoman(gi + 1)} ${g.dept || ''}`.trim();
        const dRow = sheet.addRow([deptLabel]);
        sheet.mergeCells(dRow.number, 1, dRow.number, visibleOrder.length);
        dRow.getCell(1).font = { name: 'Khmer OS Muol Light', size: 9, bold: false };
        dRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
        dRow.getCell(1).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        let deptIdx = 0;
        (g.items || []).forEach(hr => {
          overallIdx += 1;
          deptIdx += 1;
          const rowValues = visibleOrder.map(c => {
            const k = c.key;
            if (k === 'serialOverall') return overallIdx;
            if (k === 'serialDept') return deptIdx;
            if (k === 'name') return hr.khmerName || hr.name || '';
            if (k === 'latinName') return hr.nameLatin || hr.nameEn || hr.englishName || hr.name || '';
            if (k === 'staffId') return hr.staffId || hr.cardNumber || hr.staffCode || '';
            if (k === 'gender') {
              const gval = (hr.gender || '').toString().toLowerCase();
              if (gval === 'female' || gval === 'ស' || gval.startsWith('f')) return 'ស';
              return 'ប';
            }
            if (k === 'dob') return fmtDateSlash(hr.dob || hr.birthDate || '');
            if (k === 'salaryLevel') return hr.salaryLevel || hr.kamPrak || '';
            if (k === 'idOrOfficerType') {
              const isContract = ['state', 'hospital', 'worker', 'hospitalPlus', 'hospitalPartTime', 'retiredThenContract'].includes(reportType);
              return isContract ? (hr.officerType || '') : (hr.civilServantId || hr.officerId || hr.staffId || hr.idCardNumber || hr.officerCardNumber || hr.cardNumber || '');
            }
            if (k === 'skill') return hr.civilServantRole || hr.skill || '';
            if (k === 'position') return hr.position || '';
            if (k === 'department') return hr.Department_Kh || hr.department || hr.unit || '';
            if (k === 'bankAccount') return hr.bankAccount || '';
            if (k === 'grant') {
              const grantVal = hr.grantAmount || hr.bonus || hr.allowance || '';
              return grantVal ? (formatCurrencyKhmer(grantVal) + ' រៀល') : '';
            }
            return '';
          });
          const newRow = sheet.addRow(rowValues);
          newRow.eachCell((cell, i) => {
            cell.font = { name: 'Khmer OS Siemreap', size: 11 };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            const key = visibleOrder[i - 1].key;
            if (['serialOverall', 'serialDept', 'gender', 'dob', 'salaryLevel', 'idOrOfficerType'].includes(key)) {
              cell.alignment = { horizontal: 'center' };
            }
          });
        });
      });

      // 6. Totals & Signatures
      sheet.addRow([]);
      const totalsStr = `បញ្ចប់បញ្ជីត្រឹមចំនួន: ${toKhmerDigits((selectedTotals && selectedTotals.total) || 0)} នាក់  (ប្រុស: ${toKhmerDigits((selectedTotals && selectedTotals.male) || 0)} នាក់  ស្រី: ${toKhmerDigits((selectedTotals && selectedTotals.female) || 0)} នាក់)`;
      const totalRow = sheet.addRow([totalsStr]);
      totalRow.getCell(1).font = { name: 'Khmer OS Siemreap', bold: true };
      sheet.mergeCells(totalRow.number, 1, totalRow.number, visibleOrder.length);

      sheet.addRow([]);
      sheet.addRow([]);
      const midStart = Math.floor(visibleOrder.length / 3) + 1;
      const rightStart = Math.floor((visibleOrder.length * 2) / 3) + 1;
      const last = visibleOrder.length;

      // Row 1: Dates and First lines
      const sigRow1 = sheet.addRow([]);
      sigRow1.getCell(1).value = 'បានឃើញ';
      sigRow1.getCell(midStart).value = 'បានពិនិត្យត្រឹមត្រូវ';
      sigRow1.getCell(rightStart).value = (lunarText && lunarText.trim()) ? lunarText : ('ថ្ងៃ' + khWeekday(new Date()) + '  ព.ស. ' + toKhmerDigits(buddhistEraYear(new Date())));
      
      sheet.mergeCells(sigRow1.number, 1, sigRow1.number, midStart - 1);
      sheet.mergeCells(sigRow1.number, midStart, sigRow1.number, rightStart - 1);
      sheet.mergeCells(sigRow1.number, rightStart, sigRow1.number, last);

      sigRow1.eachCell(c => {
        c.font = { name: 'Khmer OS Siemreap', size: 11 };
        c.alignment = { horizontal: 'center' };
      });

      // Row 2: Roles and Full Date
      const sigRow2 = sheet.addRow([]);
      sigRow2.getCell(1).value = 'នាយកមន្ទីរពេទ្យ';
      sigRow2.getCell(midStart).value = 'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក';
      sigRow2.getCell(rightStart).value = `រាជធានីភ្នំពេញ ${fmtKhmerLongDate(footerDateStr)}`;

      sheet.mergeCells(sigRow2.number, 1, sigRow2.number, midStart - 1);
      sheet.mergeCells(sigRow2.number, midStart, sigRow2.number, rightStart - 1);
      sheet.mergeCells(sigRow2.number, rightStart, sigRow2.number, last);

      sigRow2.getCell(1).font = { name: 'Khmer OS Muol Light', size: 11 };
      sigRow2.getCell(midStart).font = { name: 'Khmer OS Muol Light', size: 11 };
      sigRow2.getCell(rightStart).font = { name: 'Khmer OS Siemreap', size: 11 };
      
      sigRow2.eachCell(c => {
        c.alignment = { horizontal: 'center' };
      });

      // Row 3: Final title for report maker
      const sigRow3 = sheet.addRow([]);
      sigRow3.getCell(rightStart).value = 'អ្នកធ្វើរបាយការណ៍';
      sheet.mergeCells(sigRow3.number, rightStart, sigRow3.number, last);
      sigRow3.getCell(rightStart).font = { name: 'Khmer OS Muol Light', size: 11 };
      sigRow3.getCell(rightStart).alignment = { horizontal: 'center' };

      // 7. Write & Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `employee_report_${reportType}_${footerDateStr}.xlsx`;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed: ' + (err?.message || err));
    }
  };

  // Ensure footer and helper values exist (used in JSX below)
  const footerDate = asOfDate || new Date().toISOString().slice(0, 10);
  function khWeekday(d) {
    const days = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ៍', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
    try { return days[new Date(d).getDay()] || ''; } catch { return ''; }
  }
  function buddhistEraYear(d) { try { return new Date(d).getFullYear() + 543; } catch { return new Date().getFullYear() + 543; } }
  function fmtKhmerLongDate(d) { if (!d) return ''; const dt = new Date(d); if (isNaN(dt.getTime())) return ''; const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ']; return `ថ្ងៃទី ${toKhmerDigits(String(dt.getDate()).padStart(2, '0'))} ខែ ${khMonths[dt.getMonth()]} ឆ្នាំ ${toKhmerDigits(String(dt.getFullYear()))}`; }

  if (!(perms.canViewHR || perms.canViewEmployees)) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">របាយការណ៍បុគ្គលិក</h2>
        <div className="p-3 border rounded bg-yellow-50 text-yellow-800">ត្រូវការ សិទ្ធិ: view:hr ឬ view:employees</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Modern Filter Card */}
      <div 
        ref={filterCardRef}
        style={{
          position: 'sticky',
          top: '-24px', 
          zIndex: 40,
          background: '#fff',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid #edf2f7',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Row 1: Search and Main Actions */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="ស្វែងរកឈ្មោះ, អត្តលេខ, ផ្នែក, តួនាទី..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#f8fafc' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowGroupModal(true)}
              style={{ padding: '8px 16px', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >បង្កើតក្រុមជំនាញ</button>
            <button
              type="button"
              onClick={handleExportExcel}
              style={{ padding: '8px 16px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >នាំចេញ Excel</button>
            <button
              type="button"
              onClick={handlePrint}
              style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >បោះពុម្ព</button>
          </div>
        </div>

        {/* Row 2: All Filters and Controls */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>ផ្នែក:</label>
            <div style={{ position: 'relative', width: '180px' }}>
              <input
                type="text"
                placeholder="ស្វែងរកផ្នែក..."
                value={deptQuery || selectedDept}
                onChange={(e) => { setDeptQuery(e.target.value); setShowDeptList(true); }}
                onFocus={() => setShowDeptList(true)}
                onBlur={() => setTimeout(() => setShowDeptList(false), 150)}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff' }}
              />
              {showDeptList && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '200px', overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', zIndex: 100, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderRadius: '4px', marginTop: '2px' }}>
                  <div onMouseDown={() => { setSelectedDept(''); setDeptQuery(''); setShowDeptList(false); }} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>-- ទាំងអស់ --</div>
                  {departments.filter(d => {
                    const label = (d.Department_Kh || d.Department || d.Department_En || '').toString();
                    return !deptQuery || label.toLowerCase().includes(deptQuery.toLowerCase());
                  }).map(d => {
                    const label = (d.Department_Kh || d.Department || d.Department_En || '').toString();
                    const val = (d.Department_Kh || d.Department || d.Department_En).toString();
                    return (
                      <div key={val + label} onMouseDown={() => { setSelectedDept(val); setDeptQuery(label); setShowDeptList(false); }} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }} onMouseEnter={(e) => e.target.style.background = '#f8fafc'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>{label}</div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>ប្រភេទ:</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff', minWidth: '150px' }}>
              <option value="total">សរុបបុគ្គលិក</option>
              <option value="ministryTechnical">របាយការណ៍ជំនាញក្រសួង</option>
              <option value="technical">របាយការណ៍ជំនាញមន្ទីរពេទ្យ</option>
              <option value="civil">មន្ត្រីរាជការ</option>
              <option value="state">កិច្ចសន្យារដ្ឋ</option>
              <option value="hospital">កិច្ចសន្យាមន្ទីរពេទ្យ</option>
              <option value="worker">កម្មករកិច្ចសន្យា</option>
              <option value="hospitalPlus">កិច្ចសន្យាសរុប</option>
              <option value="hospitalPartTime">កិច្ចសន្យា (ក្រៅម៉ោង)</option>
              <option value="retiredThenContract">ចូលនិវត្តន៍បន្តកិច្ចសន្យា</option>
              <option value="hospitalOver60">កិច្ចសន្យា (≥៦០ឆ្នាំ)</option>
              <option value="allhr">ទិន្នន័យបុគ្គលិក</option>
              <option value="evaluation">ការវាយតម្លៃ</option>
              <option value="femaleCount">ចំនួនស្រ្តី</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>ក្រុម:</label>
            <div style={{ position: 'relative', width: '150px' }}>
              <input
                type="text"
                placeholder="ស្វែងរកក្រុម..."
                value={groupQuery || selectedGroup}
                onChange={(e) => { setGroupQuery(e.target.value); setShowGroupList(true); }}
                onFocus={() => setShowGroupList(true)}
                onBlur={() => setTimeout(() => setShowGroupList(false), 150)}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff' }}
              />
              {showGroupList && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '200px', overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', zIndex: 100, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderRadius: '4px', marginTop: '2px' }}>
                  <div onMouseDown={() => { setSelectedGroup(''); setGroupQuery(''); setShowGroupList(false); }} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>-- ទាំងអស់ --</div>
                  {[
                    'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក', 'ប្រធានការិយាល័យហិរញ្ញវត្ថុ', 'ប្រធានការិយាល័យបច្ចេកទេស',
                    'ការិយាល័យរដ្ឋបាល និងបុគ្គលិក បុគ្គលិកអនាម័យ', 'ការិយាល័យបច្ចេកទេស ចំហុយសម្ភារៈ និង ផ្នែកបោកអ៊ុត',
                    ...Array.from(new Set(list.map(hr => (hr.Department_Kh || hr.department || '').toString().trim()))).filter(Boolean)
                  ].filter((g, index, self) => self.indexOf(g) === index).filter(g => !groupQuery || g.toLowerCase().includes(groupQuery.toLowerCase())).map(g => (
                    <div key={g} onMouseDown={() => { setSelectedGroup(g); setGroupQuery(g); setShowGroupList(false); }} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }} onMouseEnter={(e) => e.target.style.background = '#f8fafc'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>{g}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>គម្រៀប:</label>
            <select value={orientation} onChange={e => setOrientation(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff' }}>
              <option value="portrait">បញ្ឈរ (A4)</option>
              <option value="landscape">ទទឹង (A4)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>គិតត្រឹម:</label>
            <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>ចន្ទគតិ:</label>
            <input type="text" placeholder="ចន្ទគតិ..." value={lunarText} onChange={(e) => setLunarText(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid', borderColor: lunarText.trim() ? '#cbd5e1' : '#fca5a5', borderRadius: '4px', fontSize: '12px', background: '#fff' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>Row Height</label>
              <input type="range" min={20} max={60} value={rowHeight} onChange={(e) => setRowHeight(Number(e.target.value))} style={{ width: '80px' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowColsMenu(v => !v)} style={{ padding: '6px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Columns</button>
              {showColsMenu && (
                <div style={{ position: 'absolute', right: 0, bottom: '100%', marginBottom: '8px', background: '#fff', border: '1px solid #ddd', padding: '12px', minWidth: '200px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, borderRadius: '8px' }}>
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {Object.keys(defaultColumns).map(k => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', fontSize: '11px', marginBottom: '6px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!visibleCols[k]} onChange={() => toggleCol(k)} style={{ marginRight: '8px' }} />
                        {({ serialOverall: 'ស.រ', serialDept: 'ល.រ', name: 'ឈ្មោះ', staffId: 'អត្តលេខ', gender: 'ភេទ', dob: 'ថ្ងៃកំណើត', salaryLevel: 'កាំប្រាក់', skill: 'ជំនាញ', position: 'តួនាទី', department: 'ផ្នែក', phone: 'ទូរស័ព្ទ' }[k] || k)}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {error && <div className="mb-2 text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-600">កំពុងទាញយកទិន្នន័យ...</div>
      ) : (
        <div ref={printRef} className="bg-white p-4 border rounded print-scope a4-portrait">
          {/* Screen-only style to match print layout */}
          <style dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />
          <style>{`.print-scope tbody tr { min-height: ${rowHeight}px; }
            .print-scope thead tr > th {
              position: sticky;
              top: ${filterHeight - 24}px;
              z-index: 30;
              background: #f7f7f7 !important;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .print-scope thead tr > th, .print-scope tbody tr > td, .print-scope tbody tr > th { 
              vertical-align: middle !important; 
              white-space: nowrap !important; 
              overflow: visible !important;
            }
            /* Scaling container for long text */
            .scale-container {
              display: inline-block;
              width: 100%;
              transform-origin: left center;
            }
            .print-scope th, .print-scope td { padding: ${Math.max(6, Math.round(rowHeight / 4))}px ${Math.max(4, Math.round(rowHeight / 8))}px !important; line-height: ${Math.max(12, Math.round(rowHeight * 0.6))}px !important; }
            `}</style>
          <div className="title">
            <h2 style={{ marginBottom: 0 }}>
              {computedTitle}
              {reportType === 'evaluation' && selectedDept && (
                <span style={{ marginLeft: '10px' }}>{selectedDept}</span>
              )}
            </h2>
          </div>
          {reportType === 'evaluation' ? (
            <div style={{ textAlign: 'center', marginTop: 2, fontSize: 14, fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontWeight: 'bold' }}>
              {asOfDate ? (
                <div style={{ fontSize: '13px' }}>
                  ប្រចាំ ខែ{(() => {
                    const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
                    const dt = new Date(asOfDate);
                    return `${khMonths[dt.getMonth()]} ឆ្នាំ${toKhmerDigits(String(dt.getFullYear()))}`;
                  })()}
                </div>
              ) : ''}
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: 2, fontSize: 14 }}>{asOfDate ? fmtDateLong(asOfDate) : ''}</div>
          )}

          {reportContent}

          {showGroupModal && (
            <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 740, maxHeight: '80vh', overflow: 'auto', background: '#fff', padding: 16, borderRadius: 6 }}>
                <h3 style={{ marginTop: 0 }}>បង្កើតក្រុមជំនាញ</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 8 }}>ជ្រើសជំនាញ (ចុចដាក់សញ្ញាក្រោម):</div>
                    <div style={{ maxHeight: 860, overflowY: 'auto', border: '1px solid #eee', padding: 8 }}>
                      {/* hide names already present in existing groups to avoid duplicate selection */}
                      {availableSkills.length === 0 && <div className="text-gray-600">គ្មានជំនាញសម្រាប់ជ្រើស (ទាំងអស់បានបញ្ចូលក្នុងក្រុមរួចហើយ)</div>}
                      {availableSkills.map((sk, i) => (
                        <label key={sk + i} style={{ display: 'block', padding: '4px 0' }}>
                          <input type="checkbox" checked={groupSelection.has(sk)} onChange={() => toggleSelectSkillForGroup(sk)} style={{ marginRight: 8 }} /> {sk}
                        </label>
                      ))}
                      {existingGroupMembers.size > 0 && <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>ចំណាំ៖ ជំនាញដែលបានបញ្ចូលក្នុងក្រុមរួចហើយមិនបង្ហាញនៅទីនេះ ដើម្បីទប់ស្កាត់ការជ្រើសពីរដង</div>}
                    </div>
                  </div>
                  <div style={{ width: 380 }}>
                    <div style={{ marginBottom: 8 }}>ឈ្មោះក្រុម:</div>
                    <input value={groupNameInput} onChange={e => setGroupNameInput(e.target.value)} placeholder="ឧ. សាស្រ្តាចារ្យ" style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
                    <div style={{ marginTop: 12 }}>
                      {selectedEditGroupIndex == null ? (
                        <button type="button" onClick={createSkillGroup} className="px-3 py-1 bg-blue-600 text-white rounded">បង្កើត</button>
                      ) : (
                        <>
                          <button type="button" onClick={createSkillGroup} className="px-3 py-1 bg-blue-600 text-white rounded">រក្សាទុក</button>
                          <button type="button" onClick={() => { removeSkillGroup(selectedEditGroupIndex); setSelectedEditGroupIndex(null); }} className="ml-2 px-3 py-1 border rounded text-red-600">លុប</button>
                        </>
                      )}
                      <button type="button" onClick={() => { setShowGroupModal(false); setGroupSelection(new Set()); setGroupNameInput(''); setSelectedEditGroupIndex(null); }} className="ml-2 px-3 py-1 border rounded">បោះបង់</button>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 700 }}>ក្រុមដែលមាន:</div>
                      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #eee', padding: 8 }}>
                        {skillGroups.length === 0 && <div className="text-gray-600">មិនមាន</div>}
                        {skillGroups.map((g, idx) => (
                          <div key={g.name + idx} style={{ padding: '6px 0', borderBottom: '1px solid #fafafa', cursor: 'pointer' }} onClick={() => editSkillGroup(idx)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>{g.name}</div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={(e) => { e.stopPropagation(); editSkillGroup(idx); }} className="px-2 py-1 border rounded text-sm">កែ</button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); removeSkillGroup(idx); }} className="text-red-600">លុប</button>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#444' }}>{g.members.join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Evaluation marking "A" label below data */}
          {reportType === 'evaluation' && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '13px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontWeight: 'bold' }}>
                សំគាល់៖
              </div>
              <div style={{ fontSize: '12px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', paddingLeft: '10px', lineHeight: '1.6' }}>
                ១. វឌ្ឍនការងារ៖ ល្អ (≥៨៥%-១០០%), ល្អបង្គួរ (≥៦៥%-{"<"}៨៥%), មធ្យម (≥៤៥%-{"<"}៦៥%), ខ្សោយ ({"<"}៤៥%)<br />
                ២. ការផ្តល់ប្រាក់លើកទឹកចិត្ត៖ ល្អ (១០០%), ល្អបង្គួរ (៧៥%), មធ្យម (៥០%), ខ្សោយ (០%)
              </div>
            </div>
          )}
          {reportType !== 'evaluation' && (
            <div className="footer-notes" style={{ fontFamily: '"Khmer OS Siemreap", "Noto Serif Khmer", serif', fontWeight: 'bold', fontSize: '12px' }}>
              <div>បញ្ចប់បញ្ជីត្រឹមចំនួន: {toKhmerDigits((selectedTotals && selectedTotals.total) || 0)} នាក់ &nbsp;&nbsp; (ប្រុស: {toKhmerDigits((selectedTotals && selectedTotals.male) || 0)} នាក់ &nbsp;&nbsp; ស្រី: {toKhmerDigits((selectedTotals && selectedTotals.female) || 0)} នាក់)</div>
            </div>
          )}

          {/* footer/signature area for evaluation report */}
          {reportType === 'evaluation' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px' }}>
              <div style={{ width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>បានឃើញ និងឯកភាព</div>
                <div style={{ marginTop: '2px' }}>
                  <select
                    value={footerLeftTitle}
                    onChange={(e) => setFooterLeftTitle(e.target.value)}
                    style={{
                      fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '13px', textAlign: 'center', border: 'none', background: 'transparent', cursor: 'pointer', outline: 'none'
                    }}
                  >
                    <option value="នាយករងទទួលបន្ទុក">នាយករងទទួលបន្ទុក</option>
                    <option value="នាយកមន្ទីរពេទ្យ">នាយកមន្ទីរពេទ្យ</option>
                  </select>
                </div>
              </div>

              <div style={{ width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>
                  បានវាយតម្លៃ និងគោរពជូន លោកនាយក
                </div>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>
                  ដើម្បីពិនិត្យនិងសម្រេច
                </div>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>
                  រាជធានីភ្នំពេញ ថ្ងៃទី..........ខែ..............ឆ្នាំ២០....
                </div>
                <div style={{ marginTop: '5px' }}>
                  <select
                    value={footerRightTitle}
                    onChange={(e) => setFooterRightTitle(e.target.value)}
                    style={{
                      fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '13px', textAlign: 'center', border: 'none', background: 'transparent', cursor: 'pointer', outline: 'none', width: '100%'
                    }}
                  >
                    <option value="នាយករងទទួលបន្ទុក">នាយករងទទួលបន្ទុក</option>
                    <option value="ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក">ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</option>
                    <option value="ប្រធានការិយាល័យហិរញ្ញវត្ថុ">ប្រធានការិយាល័យហិរញ្ញវត្ថុ</option>
                    <option value="ប្រធានការិយាល័យបច្ចេកទេស">ប្រធានការិយាល័យបច្ចេកទេស</option>
                    <option value="នាយផ្នែក">នាយផ្នែក</option>
                    <option value="នាយមណ្ឌល">នាយមណ្ឌល</option>
                    <option value="នាយផ្នែករងក្ដាប់រូប">នាយផ្នែករងក្ដាប់រូប</option>
                    <option value="មន្រ្តីទទួលបន្ទុក">មន្រ្តីទទួលបន្ទុក</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* footer/signature area for other reports */}
          {reportType !== 'evaluation' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px', fontSize: '12px' }}>
              <div style={{ width: '30%', paddingLeft: '40px' }}>
                <div style={{ marginTop: '27px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>បានឃើញ</div>
                <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>នាយកមន្ទីរពេទ្យ</div>
                <div style={{ height: '64px' }}></div>
                <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
              </div>
              <div style={{ width: '50%', textAlign: 'center', paddingLeft: '50px' }}>
                <div style={{ marginTop: '25px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>បានពិនិត្យត្រឹមត្រូវ</div>
                <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</div>
                <div style={{ height: '82px' }}></div>
                <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
              </div>
              <div style={{ width: '45%', textAlign: 'right', paddingRight: '0px' }}>
                <div style={{ marginTop: '0px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>
                  {(lunarText && lunarText.trim()) ? lunarText : ('ថ្ងៃ' + khWeekday(new Date()) + '  ព.ស. ' + toKhmerDigits(buddhistEraYear(new Date())))}
                </div>
                <div style={{ marginTop: '2px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}>
                  រាជធានីភ្នំពេញ {fmtKhmerLongDate(footerDate)}
                </div>
                <div style={{ marginTop: '1px', fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '12px', textAlign: 'center' }}> អ្នកធ្វើរបាយការណ៍</div>
                <div style={{ height: '82px' }}></div>
                <div style={{ textDecoration: 'underline', visibility: 'hidden' }}>............................</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
