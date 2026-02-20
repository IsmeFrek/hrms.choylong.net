import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { departmentAPI } from '../services/departmentAPI';
import { skillAPI } from '../services/skillAPI';
import usePermission from '../hooks/usePermission';
import { isExplicitlyRemoved as _isExplicitlyRemoved, hasResignData as _hasResignData, isPreparedForDeletion as _isPreparedForDeletion, isCountedActive as _isCountedActive } from '../utils/hrFilters';
import { Bold, Indent } from 'lucide-react';

function toKhmerDigits(n) {
  const map = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function formatCurrencyKhmer(v) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(/[,\s]/g, ''));
  if (isNaN(n)) return String(v);
  const parts = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // convert each latin digit to khmer digits while preserving commas
  return parts.replace(/[0-9]/g, d => {
    const map = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
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
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yyyy = dt.getFullYear();
  return  `${dd}-${mm}-${yyyy}`;
}

// Extra formatting helpers for picture-style report
function fmtDateSlash(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
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
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
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

export default function EmployeeReportPage() {
  const perms = usePermission();
  const [includeArchived, setIncludeArchived] = useState(false); // <-- new: include resigned/deleted when true
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lunarText, setLunarText] = useState('');
  const printRef = useRef();
  // Column widths for the summary table (px). Persist in sessionStorage during the session.
  const [colWidths, setColWidths] = useState(() => {
    try {
      const v = sessionStorage.getItem('employee_report_col_widths');
      if (v) return JSON.parse(v);
    } catch { void 0; }
    return [380, 40, 76, 76, 76];
  });
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
    actions: true, // new: edit/action column
    nid: true,
    bankAccount: true,
  };
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const v = sessionStorage.getItem('employee_report_visible_cols');
      if (v) return JSON.parse(v);
    } catch { void 0; }
    return defaultColumns;
  });
  useEffect(() => { try { sessionStorage.setItem('employee_report_visible_cols', JSON.stringify(visibleCols)); } catch { void 0; } }, [visibleCols]);
  const toggleCol = (k) => setVisibleCols(prev => ({ ...prev, [k]: !prev[k] }));
  const visibleCount = Object.values(visibleCols).filter(Boolean).length || 1;
  const [showColsMenu, setShowColsMenu] = useState(false);
  // Report variants: 'civil' (មន្ត្រីរាជការ), 'state' (កិច្ចសន្យារដ្ឋ), 'hospitalPlus' (កិច្ចសន្យាមន្ទីរពេទ្យ)
  const [reportType, setReportType] = useState('total');
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' or 'landscape'
  const [filterText, setFilterText] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => {
    const d = new Date();
    // default to today (ISO date string yyyy-mm-dd for input[type=date])
    return d.toISOString().slice(0,10);
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!(perms.canViewHR || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const { data } = await api.get('/hr');
        if (!mounted) return;
        setList(Array.isArray(data) ? data : []);
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

  // load departments to obtain Department_Id ordering when available
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [deptQuery, setDeptQuery] = useState('');
  const [showDeptList, setShowDeptList] = useState(false);
  const [skills, setSkills] = useState([]);
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

  useEffect(() => {
    try { localStorage.setItem('employee_skill_groups', JSON.stringify(skillGroups || [])); } catch { void 0; }
  }, [skillGroups]);

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
    setSkillGroups(prev => prev.filter((g,i) => i !== idx));
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
      setSkills(Array.isArray(data) ? data : []);
    }).catch(() => { if (mounted) setSkills([]); });
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
      // Use shared HR filter rules so counts match HR listing
      if (!hr) return false;
      // If explicit 'Deleted' or 'Resigned' statuses, exclude
      const st = (hr.status || '').toString();
      if (st === 'Deleted' || st === 'Resigned' || st === 'deleted' || st === 'resigned') return false;
      const asDate = parseDate(asOf);
      // If asOf provided, exclude if explicit removal/resignation occurred on or before asOf
      if (asDate) {
        const removed = parseDate(hr.dateRemoved) || (hr.delisted && (parseDate(hr.delisted.dateRemoved) || parseDate(hr.delisted.date_removed))) || parseDate(hr.dateRemovedFromDataset) || parseDate(hr.removalDate) || null;
        if (removed && removed <= asDate) return false;
        const resign = parseDate(hr.resignDate) || parseDate(hr.resignationDate) || null;
        if (resign && resign <= asDate) return false;
      }
      // If record has resign/removal data and is NOT prepared-for-deletion, exclude
      const hasResign = _hasResignData(hr);
      const hasExplicitRemoval = _isExplicitlyRemoved(hr);
      const prepared = _isPreparedForDeletion(hr) && !hasExplicitRemoval;
      if (hasResign && !prepared) return false;
      // Otherwise include (do not require status === 'active' to match HR listing semantics)
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
      const textFields = (hr) => (`${hr.position||''} ${hr.note||''} ${hr.status||''} ${hr.remark||''} ${hr.title||''} ${hr.officerType||''} ${hr.comments||''}`);
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
        const k = `${hr.khmerName||''} ${(hr.name||'')}`;
        const c = collapse(k);
        if (c) return `name:${c}`;
        return null;
      };
      const textFields = (hr) => (`${hr.position||''} ${hr.note||''} ${hr.status||''} ${hr.remark||''} ${hr.title||''} ${hr.officerType||''} ${hr.comments||''}`);
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
    // civil servants: exclude all contract types
    let base = asOfFiltered.filter(hr => {
      // treat as civil unless it matches any contract type
      return !isStateType(hr.officerType) && !isHospitalType(hr.officerType) && !isPartTimeType(hr.officerType) && !isWorkerType(hr.officerType);
    });
    // apply simple text filter across khmer name, latin name, staffId, department
    if (filterText && String(filterText).trim()) {
      const t = String(filterText).toLowerCase();
      base = base.filter(hr => {
        return ((hr.khmerName||'').toString().toLowerCase().includes(t)
          || (hr.name||'').toString().toLowerCase().includes(t)
          || (hr.staffId||'').toString().toLowerCase().includes(t)
          || (hr.Department_Kh||'').toString().toLowerCase().includes(t)
        );
      });
    }
    return base;
  }, [list, reportType, asOfDate, filterText, isIncludedAsOf]);

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
      .sort((a,b) => {
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
    .map(([dept, items]) => ({ dept, items: items.sort((x,y) => (x.no||0)-(y.no||0)) }));
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
      hospitalPlus: (function(){
        const seen = new Set();
        const items = [];
        for (const hr of hospital.concat(partTime, worker)) {
          const key = hr._id || hr.staffId || hr.officerId || hr.cardNumber || (hr.name?hr.name.trim():null) || JSON.stringify(hr);
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

    const textFields = (hr) => (`${hr.position||''} ${hr.note||''} ${hr.status||''} ${hr.remark||''} ${hr.title||''} ${hr.officerType||''} ${hr.comments||''}`);
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
    const textFields = (hr) => (`${hr.position||''} ${hr.note||''} ${hr.status||''} ${hr.remark||''} ${hr.title||''} ${hr.officerType||''} ${hr.comments||''}`);
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

    const textFields = (hr) => (`${hr.position||''} ${hr.note||''} ${hr.status||''} ${hr.remark||''} ${hr.title||''} ${hr.officerType||''} ${hr.comments||''}`);
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

    const textFields = (hr) => (`${hr.position||''} ${hr.note||''} ${hr.status||''} ${hr.remark||''} ${hr.title||''} ${hr.officerType||''} ${hr.comments||''}`);
    // broaden retirement tokens (Khmer + English variants) and treat records with a resignDate as retired
    const isMarkedRetire = (hr) => /(?:retir|retired|និវត្ត|ចូលនិវត្ត|ចូលនិវត្តន៍)/i.test(textFields(hr)) || !!(hr.resignDate);

    const idKeyOf = (hr) => {
      const id = hr.staffId || hr.officerId || hr.civilServantId || hr.cardNumber || hr.nid || '';
      if (id && String(id).trim()) return `id:${String(id).trim().toLowerCase()}`;
      return null;
    };

    const nameKeyOf = (hr) => {
      const k = `${hr.khmerName||''} ${(hr.name||'')}`;
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

    const counts = { hospitalPlus: { total:0, male:0, female:0 }, worker: { total:0, male:0, female:0 } };
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
      const uniqueKey = idk || nk || JSON.stringify([hr.khmerName||'', hr.name||'', hr.cardNumber||'']);
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

    const hrSkillNormOf = (hr) => normSkill(hr.skill || hr.technicalRole || hr.specialty || '');
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

      // iterate skills in given order; if skill belongs to a group, emit the group row here (once),
      // otherwise emit the individual skill row
      for (const skill of skills) {
        const skillName = (skill.skills_Kh || '').toString();
        const skillNorm = normSkill(skillName);
        if (!skillNorm) continue;

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
            rows.push({ name: (skillGroups[gi].name || `Group ${gi+1}`), male, female, total: male + female, civil, contract, isGroup: true });
            emittedGroups.add(gi);
          }
          // skip emitting the individual skill row because it's grouped
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
      }

      // append any groups that were not emitted because none of their members appeared in skills[]
      for (let gi = 0; gi < (skillGroups || []).length; gi++) {
        if (emittedGroups.has(gi)) continue;
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
        rows.push({ name: (skillGroups[gi].name || `Group ${gi+1}`), male, female, total: male + female, civil, contract, isGroup: true });
      }

      const totals = rows.reduce((acc, r) => ({
        male: acc.male + (r.male||0),
        female: acc.female + (r.female||0),
        total: acc.total + (r.total||0),
        civil: (acc.civil||0) + (r.civil||0),
        contract: (acc.contract||0) + (r.contract||0),
      }), { male: 0, female: 0, total: 0, civil: 0, contract: 0 });

      return { rows, totals };
    }

    // Fallback: derive skills from existing HR list and sort by Khmer name, include civil/contract counts
    const rowsMap = new Map();
    for (const hr of sourceList || []) {
      const key = label(hr.civilServantRole || hr.technicalRole || hr.skill || hr.specialty);
      if (!rowsMap.has(key)) rowsMap.set(key, { name: key, male: 0, female: 0, civil: 0, contract: 0 });
      const row = rowsMap.get(key);
      if (hr.civilServantId) row.civil += 1; else row.contract += 1;
      if (hr.gender === 'Male' || hr.gender === 'ប្រុស') row.male += 1;
      else if (hr.gender === 'Female' || hr.gender === 'ស្រី') row.female += 1;
    }
    const rows = Array.from(rowsMap.values()).map(r => ({ ...r, total: r.male + r.female })).sort((a,b) => a.name.localeCompare(b.name, 'km'));
    const totals = rows.reduce((acc, r) => ({
      male: acc.male + r.male,
      female: acc.female + r.female,
      total: acc.total + r.total,
      civil: acc.civil + (r.civil||0),
      contract: acc.contract + (r.contract||0),
    }), { male: 0, female: 0, total: 0, civil: 0, contract: 0 });
    return { rows, totals };
  }, [list, skills, skillGroups, asOfDate, includeArchived, isIncludedAsOf, isActiveAsOf]);

  // total technical staff for the hospital (active as-of unless `includeArchived`)
  const hospitalTechnicalTotal = useMemo(() => {
    try {
      const asOf = asOfDate;
      const active = list.filter(hr => (includeArchived ? isIncludedAsOf(hr, asOf) : isActiveAsOf(hr, asOf)));
      const tech = active.filter(hr => {
        const s = normSkill(hr.skill || hr.technicalRole || hr.specialty || '');
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
    if (reportType === 'technical') return 'ចំនួនសរុបជំនាញបច្ចេកទេស នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'allhr') return 'បញ្ជីរាយនាម បុគ្គលិក នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'civil') return 'បញ្ជីរាយនាម មន្រ្តីរាជការ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'state') return 'បញ្ជីរាយនាម បុគ្គលិកកិច្ចសន្យារដ្ឋ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospital') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospitalOver60') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ អាយុ ៦០ ឆ្នាំឡើង នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'worker') return 'បញ្ជីរាយនាម កម្មករកិច្ចសន្យា នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospitalPartTime') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ (ក្រៅម៉ោង) នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'hospitalPlus') return 'បញ្ជីរាយនាម កិច្ចសន្យាមន្ទីរពេទ្យ​ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'retiredThenContract') return 'បញ្ជីរាយនាម មន្រ្តីចូលនិវត្តន៍ បន្តកិច្ចសន្យា​ នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
    if (reportType === 'evaluation') return 'របាយការណ៍វាយតំលៃការបំពេញមុខងារ និងការទទួលខុសត្រូវការងាររបស់បុគ្គលិក មន្រ្តីរាជការ';
    if (reportType === 'femaleCount') return 'តារាងប្រាក់ឧបត្ថម្ភសម្រាប់បុគ្គលិក និងមន្រ្តីរាជការជានារី - មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត ';
    return 'បញ្ជីរាយនាម មន្រ្តីចូលនិវត្តន៍ បន្តកិច្ចសន្យា នៃមន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
  }, [reportType]);

  // totals for the currently selected reportType (display next to selector)
  const selectedTotals = useMemo(() => {
    // use grandSummary for predefined groups, technicalSummary for technical report,
    // otherwise fall back to filteredList totals computed above.
    try {
      if (reportType === 'total') return grandSummary.all || { total:0, male:0, female:0 };
      if (reportType === 'technical') return (technicalSummary && technicalSummary.totals) ? technicalSummary.totals : { total:0, male:0, female:0 };
      if (reportType === 'civil') return grandSummary.civil || { total:0, male:0, female:0 };
      if (reportType === 'state') return grandSummary.state || { total:0, male:0, female:0 };
      if (reportType === 'hospital') return grandSummary.hospital || { total:0, male:0, female:0 };
      if (reportType === 'hospitalPlus') return grandSummary.hospitalPlus || { total:0, male:0, female:0 };
      if (reportType === 'worker') return grandSummary.worker || { total:0, male:0, female:0 };
      if (reportType === 'allhr') return totals || { total:0, male:0, female:0 };
      if (reportType === 'evaluation') return { total: (filteredList || []).length || 0, male: 0, female: 0 };
      if (reportType === 'femaleCount') {
        const f = femaleOnlyList || [];
        return { total: f.length, male: 0, female: f.length };
      }
      // fallback: counts of current filteredList
      return totals || { total:0, male:0, female:0 };
    } catch { return { total:0, male:0, female:0 }; }
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
  useEffect(() => { try { sessionStorage.setItem('employee_report_footer_left', footerLeftTitle); } catch {} }, [footerLeftTitle]);
  useEffect(() => { try { sessionStorage.setItem('employee_report_footer_right', footerRightTitle); } catch {} }, [footerRightTitle]);
  
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
  useEffect(() => { try { sessionStorage.setItem('employee_report_evaluator_comments', JSON.stringify(evaluatorComments || {})); } catch {} }, [evaluatorComments]);
  useEffect(() => { try { sessionStorage.setItem('employee_report_evaluations', JSON.stringify(evaluations || {})); } catch {} }, [evaluations]);

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
  .print-scope th, .print-scope td { border: 1px solid #222; padding: 6px 4px; font-size: 13px; vertical-align: middle; }
    .print-scope th { background: #f7f7f7; }
  /* First column is label, second is small spacer, third is sub-label, last three are numbers */
  .print-scope th:first-child, .print-scope td:first-child { /* auto width - remaining space */ }
  /* Right-hand numeric columns use fixed pixel widths so numbers align */
  .print-scope th:nth-child(4), .print-scope th:nth-child(5), .print-scope th:nth-child(6),
  .print-scope td:nth-child(4), .print-scope td:nth-child(5), .print-scope td:nth-child(6) { width: 76px; }
    .print-scope td.center, .print-scope th.center { text-align: center; }
    .print-scope .section-row th { background: #efefef; text-align: left; font-weight: 700; }
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
      overflow: hidden;
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
      overflow: hidden;
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
  th, td { border: 1px solid #222; padding: 8px 6px; font-size: 13px; vertical-align: middle; }
  th { background: #f7f7f7; }
  /* Let first columns size automatically; fix numeric right columns */
  th:first-child, td:first-child { }
  th:nth-child(4), th:nth-child(5), th:nth-child(6), td:nth-child(4), td:nth-child(5), td:nth-child(6) { width: 76px; }
  .center { text-align: center; }
  .section-row th { background: #efefef; text-align: left; font-weight: 700; }
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
  .print-scope th, .print-scope td { padding: ${Math.max(6, Math.round(rowHeight/4))}px ${Math.max(4, Math.round(rowHeight/8))}px !important; line-height: ${Math.max(12, Math.round(rowHeight*0.6))}px !important; }
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
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13,  }}>ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.hospitalPlus.total)}</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.hospitalPlus.male)}</td>
              <td className="center" style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif' }}>{toKhmerDigits(retiredThenContract.hospitalPlus.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Siemreap", fontSize: 13,  }}>
              <td style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13, }}>អាយុលើស ៦០ឆ្នាំ</td>
              <td className="center">{toKhmerDigits(hospitalPlusAgeOver60.total)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusAgeOver60.male)}</td>
              <td className="center">{toKhmerDigits(hospitalPlusAgeOver60.female)}</td>
            </tr>
            <tr style={{ fontFamily: "Khmer OS Siemreap", fontSize: 13,  }}>
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
            <tr style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13,  }}>
              <td>អាយុលើស ៦០ ឆ្នាំ</td>
              <td className="center">{toKhmerDigits(workerBreakdown.over60.total)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.over60.male)}</td>
              <td className="center">{toKhmerDigits(workerBreakdown.over60.female)}</td>
            </tr>
            <tr style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: 13,  }}>
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
              <th style={{width:'40px'}}>ល.រ</th>
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
                <td className="center">{toKhmerDigits(idx+1)}</td>
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
    if (reportType === 'evaluation') {
      // Render evaluation summary table: per-option counts and per-employee marks
      return (
        <table>
          <thead>
            <tr>
              <th rowSpan={2} className="center" style={{width:'40px'}}>ល.រ</th>
              <th rowSpan={2} className="center" style={{width:'150px'}}>គោត្តនាម និងនាម</th>
              <th rowSpan={2} className="center" style={{width:'150px'}}>តួនាទី</th>
              <th colSpan={4} className="center">មូលវិចារណាយផ្នែក/ការិយាល័យ</th>
              <th rowSpan={2} className="center"style={{width:'160px'}}>ផ្សេងៗ</th>
            </tr>
            <tr>
              <th className="center" style={{width:'50px'}}>ល្អ</th>
              <th className="center" style={{width:'50px'}}>ល្អបង្គួរ</th>
              <th className="center" style={{width:'50px'}}>មធ្យម</th>
              <th className="center" style={{width:'70px'}}>ខ្សោយ</th>
            </tr>
          </thead>
          <tbody>
                    {(filteredList || []).map((hr, idx) => {
                      const keyId = hr._id || hr.staffId || hr.officerId || hr.cardNumber || '';
                      const val = (hr.evaluation) || (evaluations && evaluations[keyId]) || '';
                      const comment = (hr.evaluatorComment) || (evaluatorComments && evaluatorComments[keyId]) || '';
                      return (
                        <tr key={hr._id || idx}>
                          <td className="center">{toKhmerDigits(idx+1)}</td>
                          <td style={{ textAlign: 'left' }}>{hr.khmerName || hr.name || ''}</td>
                          <td style={{ textAlign: 'left' }}>{hr.position || ''}</td>
                          <td className="center" style={{background: val === 'ល្អ' ? '#fff3cd' : '#fff'}}>
                            <button type="button" onClick={() => setEvaluations(prev => ({ ...(prev||{}), [keyId]: 'ល្អ' }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: val === 'ល្អ' ? 'bold' : 'normal' }}>{val === 'ល្អ' ? '✓' : ''}</button>
                          </td>
                          <td className="center" style={{background: val === 'ល្អបង្គួរ' ? '#fff3cd' : '#fff'}}>
                            <button type="button" onClick={() => setEvaluations(prev => ({ ...(prev||{}), [keyId]: 'ល្អបង្គួរ' }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: val === 'ល្អបង្គួរ' ? 'bold' : 'normal' }}>{val === 'ល្អបង្គួរ' ? '✓' : ''}</button>
                          </td>
                          <td className="center" style={{background: val === 'មធ្យម' ? '#fff3cd' : '#fff'}}>
                            <button type="button" onClick={() => setEvaluations(prev => ({ ...(prev||{}), [keyId]: 'មធ្យម' }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: val === 'មធ្យម' ? 'bold' : 'normal' }}>{val === 'មធ្យម' ? '✓' : ''}</button>
                          </td>
                          <td className="center" style={{background: val === 'ខ្សោយ' ? '#fff3cd' : '#fff'}}>
                            <button type="button" onClick={() => setEvaluations(prev => ({ ...(prev||{}), [keyId]: 'ខ្សោយ' }))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: val === 'ខ្សោយ' ? 'bold' : 'normal' }}>{val === 'ខ្សោយ' ? '✓' : ''}</button>
                          </td>
                          <td style={{ textAlign: 'left' }}>{comment || ''}</td>
                        </tr>
                      );
                    })}
          </tbody>
          
        </table>
      );
    }
    // Female-only grants table for International Women's Day
    if (reportType === 'femaleCount') {
      return (
        <table>
          <thead>
            <tr>
              <th style={{width:'60px', textAlign:'center'}}>អត្តលេខកាត់</th>
              <th style={{width:'60px', textAlign:'center'}}>ស.រ</th>
              <th style={{width:'60px', textAlign:'center'}}>ល.រ</th>
              <th style={{textAlign:'center'}}>គោត្តនាម និងនាម</th>
              <th style={{textAlign:'center'}}>អក្សរឡាតាំង</th>
              <th style={{width:'60px', textAlign:'center'}}>ភេទ</th>
              <th style={{textAlign:'center'}}>តួនាទី</th>
              <th style={{width:'100px', textAlign:'center'}}>ថ្ងៃខែឆ្នាំកណើត</th>
              <th style={{textAlign:'center'}}>លេខធនាគា</th>
              <th style={{textAlign:'center'}}>មុខងារ</th>
              <th style={{width:'140px', textAlign:'center'}}>ប្រាក់ឧបត្ថម្ភ</th>
              <th style={{width:'140px', textAlign:'center'}}>ផ្នែក</th>
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
                  <td style={{textAlign:'left'}}>{r.staffId || ''}</td>
                  <td className="center">{toKhmerDigits(overall)}</td>
                  <td className="center">{toKhmerDigits(deptIdx)}</td>
                  <td style={{textAlign:'left'}}>{r.khmerName || r.name || ''}</td>
                  <td style={{textAlign:'left'}}>{r.name || r.nameEn || r.englishName || ''}</td>
                  <td className="center">{r.gender === 'Female' || r.gender === 'ស្រី' ? 'ស' : ''}</td>
                  <td style={{textAlign:'left'}}>{r.position || ''}</td>
                  <td className="center">{fmtDate(r.dob)}</td>
                  <td style={{textAlign:'left'}}>{r.bankAccount || r.bank_account || r.bank || ''}</td>
                  <td style={{textAlign:'left'}}>{r.skill || ''}</td>
                  <td style={{textAlign:'right'}}>{formatCurrencyKhmer(grant)}50 000រៀល</td>
                  <td style={{textAlign:'left'}}>{r.department || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
    // default: list of staff (render columns conditionally based on `visibleCols`)
    const listColumns = [
      { key: 'staffId', label: 'អត្តលេខកាត់', width: '80px', align: 'center' },
      { key: 'serialOverall', label: 'ស.រ', width: '30px', align: 'center' },
      { key: 'serialDept', label: 'ល.រ', width: '30px', align: 'center' },
      { key: 'name', label: 'គោត្តនាម និងនាម', width: '120px', align: 'left' },
      { key: 'latinName', label: 'ឈ្មោះឡាតាំង', width: '120px', align: 'left' },
      { key: 'gender', label: 'ភេទ', width: '25px', align: 'center' },
      { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកំណើត', width: '85px', align: 'right' },
      { key: 'salaryLevel', label: 'កាំប្រាក់', width: '45px', align: 'center' },
      { key: 'idOrOfficerType', label: (reportType === 'hospitalPlus' || reportType === 'state' || reportType === 'hospital' || reportType === 'hospitalPartTime' || reportType === 'hospitalOver60' || reportType === 'retiredThenContract' || reportType === 'worker') ? 'ប្រភេទមន្ត្រី' : 'អត្តលេខមន្ត្រី', width: '100px', align: 'center' },
      { key: 'skill', label: 'ជំនាញបច្ចេកទេស', width: '130px', align: 'left' },
      { key: 'position', label: 'តួនាទី', width: '140px', align: 'left' },
      { key: 'department', label: 'ផ្នែក', width: '140px', align: 'left' },
      { key: 'phone', label: 'លេខទូរស័ព្ទ', width: '110px', align: 'center' },
      { key: 'joinDate', label: 'កាលបរិច្ឆេទចូល', width: '110px', align: 'center' },
      { key: 'birthplace', label: 'ទីកន្លែងកំណើត/បច្ចុប្បន្ន', width: '180px', align: 'left' },
        { key: 'nid', label: 'លេខអត្តសញ្ញាណ', width: '120px', align: 'center' },
        { key: 'bankAccount', label: 'លេខគណនីធនាគារ', width: '140px', align: 'left' },
      { key: 'actions', label: 'កែ', width: '60px', align: 'center' }, // added edit column
     ];
     const visibleListCols = listColumns.filter(c => !!visibleCols[c.key]);
 
     return (
       <table style={{ tableLayout: 'fixed', textAlign: 'center' }}>
         <thead>
           <tr>
             {visibleListCols.map(c => (
               <th key={c.key} style={{ width: c.width, textAlign: c.align || 'center' }}>{c.label}</th>
             ))}
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
                 <th className="no-border" colSpan={visibleCount}>{toKhmerRoman(gi+1)}&nbsp;&nbsp;{g.dept}</th>
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
                       // For contract-style reports show the `officerType` in the ID column
                       const showType = (reportType === 'hospitalPlus' || reportType === 'state' || reportType === 'hospital' || reportType === 'hospitalPartTime' || reportType === 'retiredThenContract' || reportType === 'worker');
                       return <td key={c.key} className="center">{showType ? (r.officerType || r.civilServantId || r.officerId || '') : (r.civilServantId || r.officerId || r.officerType || '')}</td>;
                     }
                    if (c.key === 'skill') {
                      // show skill from HR (hrs collection) first, then fall back to other fields
                      const skillVal = r.skill || r.technicalRole || r.civilServantRole || r.specialty || '';
                      return <td key={c.key} style={{ textAlign: 'left' }}>{skillVal}</td>;
                    }
                    if (c.key === 'position') {
                      return <td key={c.key} style={{ textAlign: 'left' }}>{r.position || ''}</td>;
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
  const handleExportExcel = () => {
    try {
      // Build CSV columns from the same visible column definitions used for rendering so
      // the export matches what the user sees on screen.
      const rows = [];
      // Reconstruct listColumns here (must match the columns used for rendering)
      const listColumnsLocal = [
        { key: 'staffId', label: 'អត្តលេខកាត់' },
        { key: 'serialOverall', label: 'ស.រ' },
        { key: 'serialDept', label: 'ល.រ' },
        { key: 'name', label: 'គោត្តនាម និងនាម' },
        { key: 'latinName', label: 'ឈ្មោះឡាតាំង' },
        { key: 'gender', label: 'ភេទ' },
        { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកំណើត' },
        { key: 'salaryLevel', label: 'កាំប្រាក់' },
        { key: 'idOrOfficerType', label: (reportType === 'hospitalPlus' || reportType === 'state' || reportType === 'hospital' || reportType === 'hospitalPartTime' || reportType === 'hospitalOver60' || reportType === 'retiredThenContract' || reportType === 'worker') ? 'ប្រភេទមន្ត្រី' : 'អត្តលេខមន្ត្រី' },
        { key: 'skill', label: 'ជំនាញ' },
        { key: 'position', label: 'តួនាទី' },
        { key: 'department', label: 'ផ្នែក' },
        { key: 'phone', label: 'លេខទូរស័ព្ទ' },
        { key: 'joinDate', label: 'កាលបរិច្ឆេទចូល' },
        { key: 'birthplace', label: 'ទីកន្លែងកំណើត/បច្ចុប្បន្ន' },
          { key: 'nid', label: 'លេខអត្តសញ្ញាណ' },
          { key: 'bankAccount', label: 'លេខគណនីធនាគារ' },
        { key: 'actions', label: 'ស្ថានភាព' }
      ];

      // If exporting the femaleCount report, build a tailored column order and
      // include a department summary followed by the detailed female list.
      let visibleOrder = listColumnsLocal.filter(c => !!visibleCols[c.key]);
      const isFemaleExport = (reportType === 'femaleCount');
      const femaleSummaryCols = [
        { key: 'idx', label: 'ល.រ' },
        { key: 'dept', label: 'ផ្នែក' },
        { key: 'count', label: 'ចំនួនស្រី' },
      ];
      const femaleDetailCols = [
        { key: 'staffId', label: 'អត្តលេខកាត់' },
        { key: 'serialOverall', label: 'ស.រ' },
        { key: 'serialDept', label: 'ល.រ' },
        { key: 'name', label: 'គោត្តនាម និងនាម' },
        { key: 'latinName', label: 'អក្សរឡាតាំង' },
        { key: 'gender', label: 'ភេទ' },
        { key: 'position', label: 'តួនាទី' },
        { key: 'dob', label: 'ថ្ងៃខែឆ្នាំកណើត' },
        { key: 'bankAccount', label: 'លេខធនាគា' },
        { key: 'skill', label: 'មុខងារ' },
        { key: 'grant', label: 'ប្រាក់ឧបត្ថម្ភ' },
        { key: 'department', label: 'ផ្នែក' },
      ];
      if (isFemaleExport) visibleOrder = femaleDetailCols;
      // Always include serial columns at start
      const headerRow = visibleOrder.map(c => c.label);
      // top title and date rows to mirror printed report
      const footerDate = asOfDate || new Date().toISOString().slice(0,10);
      const titleText = (typeof computedTitle !== 'undefined' && computedTitle) ? computedTitle : '';
      const dateText = asOfDate ? fmtDateLong(asOfDate) : '';
      const titleRow = visibleOrder.map((c, i) => (i === 0 ? titleText : ''));
      const dateRow = visibleOrder.map((c, i) => (i === 0 ? dateText : ''));
      rows.push(titleRow);
      rows.push(dateRow);
      rows.push(visibleOrder.map(() => ''));
      rows.push(headerRow);

      // For femaleCount export, first include a department summary
      if (isFemaleExport) {
        // Build department grouping from femaleOnlyList so export matches the
        // visible female table (femaleOnlyList is derived from HR `list`).
        const femaleBase = femaleOnlyList || [];
        const getDeptLabel = (hr) => (hr.Department_Kh || hr.department || hr.unit || '—');
        const map = new Map();
        (femaleBase || []).forEach(hr => {
          const d = getDeptLabel(hr) || '—';
          if (!map.has(d)) map.set(d, []);
          map.get(d).push(hr);
        });
        const deptEntries = Array.from(map.entries());
        // push summary headers
        rows.push(femaleSummaryCols.map(c => c.label));
        deptEntries.forEach((entry, i) => {
          const dept = entry[0];
          const count = (entry[1] || []).length;
          if (count === 0) return;
          rows.push([String(i+1), dept, String(count)]);
        });
        rows.push(['']);
        // detailed header
        rows.push(femaleDetailCols.map(c => c.label));
        let overallIdx = 0;
        deptEntries.forEach((entry, di) => {
          const dept = entry[0];
          const items = entry[1] || [];
          if (!items.length) return;
          // dept header row (use Khmer romanized index)
          rows.push([`${toKhmerRoman(di+1)} ${dept}`]);
          let deptIdx = 0;
          items.forEach(hr => {
            overallIdx += 1; deptIdx += 1;
            const grantVal = hr.grantAmount || hr.bonus || hr.allowance || hr.extraGrant || hr.grant || '';
            const row = [
              hr.staffId || hr.cardNumber || hr.staffCode || '',
              String(overallIdx),
              String(deptIdx),
              hr.khmerName || hr.name || '',
              hr.nameLatin || hr.nameEn || hr.englishName || hr.name || '',
              (hr.gender === 'Female' || hr.gender === 'ស្រី') ? 'ស' : (hr.gender || ''),
              hr.position || '',
              fmtDateSlash(hr.dob || hr.birthDate || ''),
              hr.bankAccount || hr.bank_account || hr.bank || '',
              hr.skill || hr.technicalRole || '',
              formatCurrencyKhmer(grantVal) ? (formatCurrencyKhmer(grantVal) + ' រៀល') : '',
              hr.Department_Kh || hr.department || hr.unit || '',
            ];
            rows.push(row);
          });
        });
      } else {
        // default export path for other report types
        let overallIdx = 0;
        (grouped || []).forEach((g, gi) => {
          // department header row (put dept name in first column, leave others blank)
          const deptLabel = `${toKhmerRoman(gi+1)} ${g.dept || ''}`.trim();
          const deptHeaderRow = visibleOrder.map((c, i) => (i === 0 ? deptLabel : ''));
          rows.push(deptHeaderRow);
          let deptIdx = 0;
          (g.items || []).forEach(hr => {
            overallIdx += 1;
            deptIdx += 1;
            const row = visibleOrder.map(c => {
              const k = c.key;
              if (k === 'serialOverall') return String(overallIdx);
              if (k === 'serialDept') return String(deptIdx);
              if (k === 'name') return hr.khmerName || hr.name || '';
              if (k === 'latinName') return hr.nameLatin || hr.nameEn || hr.englishName || hr.name || '';
              if (k === 'staffId') return hr.staffId || hr.cardNumber || hr.staffCode || '';
              if (k === 'gender') {
                const gval = (hr.gender || '').toString();
                const gl = gval.toLowerCase();
                if (gval === 'ប' || gl === 'male' || gl.startsWith('m')) return 'ប';
                if (gval === 'ស' || gl === 'female' || gl.startsWith('f')) return 'ស';
                return gval;
              }
              if (k === 'dob') return fmtDateSlash(hr.dob || hr.birthDate || '');
              if (k === 'salaryLevel') return hr.salaryLevel || hr.kamPrak || '';
              if (k === 'idOrOfficerType') {
                const showType = (reportType === 'hospitalPlus' || reportType === 'state' || reportType === 'hospital' || reportType === 'hospitalPartTime' || reportType === 'hospitalOver60' || reportType === 'retiredThenContract' || reportType === 'worker');
                return showType ? (hr.officerType || hr.civilServantId || hr.officerId || '') : (hr.civilServantId || hr.officerId || hr.officerType || hr.staffId || '');
              }
              if (k === 'skill') return hr.skill || hr.technicalRole || '';
              if (k === 'position') return hr.position || '';
              if (k === 'department') return hr.Department_Kh || hr.department || hr.unit || '';
              if (k === 'phone') return hr.phone || hr.mobile || hr.tel || hr.contact || '';
              if (k === 'joinDate') return fmtDateSlash(hr.joinDate || hr.dateJoinedMinistry || hr.nominationStartDate || hr.startDate || '');
              if (k === 'birthplace') return hr.placeOfBirth || hr.birthPlace || hr.currentAddress || hr.address || '';
              if (k === 'actions') return hr.status || '';
              if (k === 'nid') return hr.nid || hr.nationalId || hr.identityNumber || hr.identity || '';
              if (k === 'bankAccount') return hr.bankAccount || hr.bank_account || hr.bank || '';
              return '';
            });
            rows.push(row);
          });
        });
      }
      // after all groups, add totals and signature blocks similar to printed report
      rows.push(visibleOrder.map(() => ''));
      const totalsStr = `បញ្ចប់បញ្ជីត្រឹមចំនួន: ${toKhmerDigits((selectedTotals && selectedTotals.total) || 0)} នាក់  (ប្រុស: ${toKhmerDigits((selectedTotals && selectedTotals.male) || 0)} នាក់  ស្រី: ${toKhmerDigits((selectedTotals && selectedTotals.female) || 0)} នាក់)`;
      rows.push(visibleOrder.map((c, i) => (i === 0 ? totalsStr : '')));
      // signature rows: left, center, right (place text approximately in columns)
      rows.push(visibleOrder.map((c, i) => (i === 0 ? 'បានឃើញ\nនាយកមន្ទីរពេទ្យ' : '')));
      rows.push(visibleOrder.map((c, i) => (i === Math.floor(visibleOrder.length/2) ? 'បានពិនិត្យត្រឹមត្រូវ\nប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក' : '')));
      rows.push(visibleOrder.map((c, i) => (i === (visibleOrder.length - 1) ? `រាជធានីភ្នំពេញ ${fmtKhmerLongDate(footerDate)}` : '')));
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
      const content = '\uFEFF' + csv;
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = `employee_report_${reportType}_${asOfDate || ''}.csv`;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed: ' + (err?.message || err));
    }
  };

  // Ensure footer and helper values exist (used in JSX below)
  const footerDate = asOfDate || new Date().toISOString().slice(0,10);
  function khWeekday(d) {
    const days = ['អាទិត្យ','ចន្ទ','អង្គារ៍','ពុធ','ព្រហស្បតិ៍','សុក្រ','សៅរ៍'];
    try { return days[new Date(d).getDay()] || ''; } catch { return ''; }
  }
  function buddhistEraYear(d) { try { return new Date(d).getFullYear() + 543; } catch { return new Date().getFullYear() + 543; } }
  function fmtKhmerLongDate(d) { if (!d) return ''; const dt = new Date(d); if (isNaN(dt.getTime())) return ''; const khMonths = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ']; return `ថ្ងៃទី ${toKhmerDigits(String(dt.getDate()).padStart(2,'0'))} ខែ ${khMonths[dt.getMonth()]} ឆ្នាំ ${toKhmerDigits(String(dt.getFullYear()))}`; }

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
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
           
          </div>
          <div className="flex items-center gap-1">
            <label className="text-sm text-gray-700">ផ្នែក:</label>
            <div style={{ position: 'relative', width: 280, marginRight: 8 }}>
              <input
                type="text"
                placeholder="ស្វែងរកផ្នែក..."
                value={deptQuery || (departments.find(d => ((d.Department_Kh||d.Department||d.Department_En||'').toString()) === (selectedDept || '')) ? selectedDept : deptQuery)}
                onChange={(e) => { setDeptQuery(e.target.value); setShowDeptList(true); }}
                onFocus={() => setShowDeptList(true)}
                onBlur={() => setTimeout(()=>setShowDeptList(false), 150)}
                className="border rounded px-3 py-1 text-gray-900 bg-white w-full"
              />
              {showDeptList && (
                <div style={{ position: 'absolute', top: '38px', left: 0, right: 0, maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid #ddd', zIndex: 60 }}>
                  <div onMouseDown={() => { setSelectedDept(''); setDeptQuery(''); setShowDeptList(false); }} style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #f3f3f3' }}>-- ទាំងអស់ --</div>
                  {(departments || []).filter(d => {
                    const label = (d.Department_Kh || d.Department || d.Department_En || '').toString();
                    if (!deptQuery) return true;
                    return label.toLowerCase().includes(deptQuery.toLowerCase());
                  }).map(d => {
                    const label = (d.Department_Kh || d.Department || d.Department_En || '').toString();
                    const val = (d.Department_Kh || d.Department || d.Department_En || d.Department_Id || '').toString();
                    return (
                      <div key={val + label} onMouseDown={() => { setSelectedDept(val); setDeptQuery(label); setShowDeptList(false); }} style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #fafafa' }}>{label}</div>
                    );
                  })}
                </div>
              )}
            </div>
            <label className="text-sm text-gray-700">ជ្រើសរើស:</label>
            <select
              className="border rounded px-3 py-1 text-gray-900 bg-white w-72"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="total">សរុបបុគ្គលិក</option>
              <option value="technical">ជំនាញបច្ចេកទេស</option>
              <option value="civil">មន្ត្រីរាជការ</option>
              <option value="state">កិច្ចសន្យារដ្ឋ</option>
              <option value="hospital">កិច្ចសន្យាមន្ទីរពេទ្យ</option>
              <option value="worker">កម្មករកិច្ចសន្យា</option>
              <option value="hospitalPlus">កិច្ចសន្យា (មន្ទីរពេទ្យ + ក្រៅម៉ោង + កម្មករ)</option>
              <option value="hospitalPartTime">កិច្ចសន្យាមន្ទីរពេទ្យ (ក្រៅម៉ោង)</option>
              <option value="retiredThenContract">ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)</option>
              <option value="hospitalOver60">កិច្ចសន្យាមន្ទីរពេទ្យ (អាយុ ៦០ ឆ្នាំឡើង)</option>
              <option value="allhr">ទិន្នន័យបុគ្គលិក</option>
              <option value="evaluation">ការវាយតម្លៃ</option>
              <option value="femaleCount">ចំនួនស្រ្តី</option>
            </select>

            <label className="text-sm" style={{marginLeft:8, marginRight:6}}>គម្រៀប:</label>
            <select className="border rounded px-2 py-1 text-gray-900 bg-white" value={orientation} onChange={e => setOrientation(e.target.value)}>
              <option value="portrait">Portrait (ឌីហ្វូល)</option>
              <option value="landscape">Landscape</option>
            </select>

            {/* Quick roster buttons removed as requested */}

            <button type="button" className="ml-2 px-2 py-1 rounded text-sm bg-gray-100" onClick={() => setShowGroupModal(true)} title="ចាប់បញ្ចូលជំនាញ">បញ្ចូលជំនាញ</button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm">គិតត្រឹម:</label>
          <input type="date" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)} className="border px-2 py-1 rounded text-sm" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 6 }}>
            <input type="text" className="border rounded px-2 py-1" style={{ width: 340 }} placeholder="ចន្ទគតិ (ឧ. ថ្ងៃសុក្រ ១៣កើត...)" value={lunarText} onChange={(e)=> setLunarText(e.target.value)} />
            {(!lunarText.trim()) && <span className="text-red-600 text-xs">សូមបំពេញចន្ទគតិ</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 6, position: 'relative' }}>
            <label className="text-sm">Row height</label>
            <input type="range" min={20} max={60} step={1} value={rowHeight} onChange={(e) => setRowHeight(Number(e.target.value))} style={{width: 160}} />
            <div style={{minWidth:40, textAlign:'right', fontWeight:600}}>{rowFontSize}px</div>
            <div style={{marginLeft:8, position:'relative'}}>
              <button type="button" onClick={() => setShowColsMenu(v => !v)} className="border px-2 py-1 rounded text-sm">Columns</button>
              {showColsMenu && (
                <div style={{position:'absolute', right:0, top:36, background:'#fff', border:'1px solid #ddd', padding:8, boxShadow:'0 2px 6px rgba(0,0,0,0.12)', zIndex:50}}>
                  {Object.keys(defaultColumns).map(k => (
                    <label key={k} style={{display:'block', fontSize:12, whiteSpace:'nowrap'}}>
                      <input type="checkbox" checked={!!visibleCols[k]} onChange={() => toggleCol(k)} style={{marginRight:6}} /> {({serialOverall:'ស.រ',serialDept:'ល.រ',name:'គោត្តនាម និងនាម',latinName:'ឈ្មោះឡាតាំង',staffId:'អត្តលេខកាត់',gender:'ភេទ',dob:'ថ្ងៃកំណើត',salaryLevel:'កាំប្រាក់',idOrOfficerType:'អត្តលេខ/ប្រភេទ',skill:'ជំនាញ',position:'តួនាទី',femaleCount:'ចំនួនស្រ្តី'}[k] || k)}
                    </label>
                  ))}
                  <div style={{textAlign:'right', marginTop:6}}>
                    <button type="button" onClick={() => setShowColsMenu(false)} className="px-2 py-1 border rounded text-sm">Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button onClick={handleExportExcel} className="bg-green-600 text-white px-2 py-1 rounded">Export</button>
          <button className={`border px-2 py-1 rounded ml-2 ${(!lunarText.trim() || loading) ? 'bg-gray-100 text-gray-300' : 'bg-blue-600 text-white border-blue-600'}`} onClick={handlePrint} disabled={!lunarText.trim() || loading}>បោះពុម្ព</button>
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
            .print-scope tbody tr > td, .print-scope tbody tr > th { vertical-align: middle !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
            .print-scope th, .print-scope td { padding: ${Math.max(6, Math.round(rowHeight/4))}px ${Math.max(4, Math.round(rowHeight/8))}px !important; line-height: ${Math.max(12, Math.round(rowHeight*0.6))}px !important; }
            `}</style>
          <div className="title">
            <h2>{computedTitle}</h2>
            {reportType === 'evaluation' && selectedDept && (
              <div style={{textAlign:'center', fontSize:'14px', fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', marginTop:'4px', }}>
                {selectedDept}
              </div>
            )}
          </div>
          {reportType === 'evaluation' ? (
            <div style={{textAlign:'center', marginTop:6, fontSize:14, fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontWeight:'bold'}}>
              {asOfDate ? (
                <>
                  <div style={{marginTop:'4px', fontSize:'13px'}}>
                    ប្រចាំ ខែ{(() => {
                      const khMonths = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
                      const dt = new Date(asOfDate);
                      return `${khMonths[dt.getMonth()]} ឆ្នាំ${toKhmerDigits(String(dt.getFullYear()))}`;
                    })()}
                  </div>
                </>
              ) : ''}
            </div>
          ) : (
            <div style={{textAlign:'center', marginTop:6, fontSize:14}}>{asOfDate ? fmtDateLong(asOfDate) : ''}</div>
          )}

          {reportContent}

          {showGroupModal && (
            <div style={{position:'fixed', left:0, top:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <div style={{width:740, maxHeight:'80vh', overflow:'auto', background:'#fff', padding:16, borderRadius:6}}>
                <h3 style={{marginTop:0}}>បង្កើតក្រុមជំនាញ</h3>
                <div style={{display:'flex', gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{marginBottom:8}}>ជ្រើសជំនាញ (ចុចដាក់សញ្ញាក្រោម):</div>
                    <div style={{maxHeight:860, overflowY:'auto', border:'1px solid #eee', padding:8}}>
                      {/* hide names already present in existing groups to avoid duplicate selection */}
                      {availableSkills.length === 0 && <div className="text-gray-600">គ្មានជំនាញសម្រាប់ជ្រើស (ទាំងអស់បានបញ្ចូលក្នុងក្រុមរួចហើយ)</div>}
                      {availableSkills.map((sk, i) => (
                        <label key={sk+i} style={{display:'block', padding:'4px 0'}}>
                          <input type="checkbox" checked={groupSelection.has(sk)} onChange={() => toggleSelectSkillForGroup(sk)} style={{marginRight:8}} /> {sk}
                        </label>
                      ))}
                      {existingGroupMembers.size > 0 && <div style={{marginTop:8, fontSize:12, color:'#666'}}>ចំណាំ៖ ជំនាញដែលបានបញ្ចូលក្នុងក្រុមរួចហើយមិនបង្ហាញនៅទីនេះ ដើម្បីទប់ស្កាត់ការជ្រើសពីរដង</div>}
                    </div>
                  </div>
                  <div style={{width:380}}>
                    <div style={{marginBottom:8}}>ឈ្មោះក្រុម:</div>
                    <input value={groupNameInput} onChange={e=>setGroupNameInput(e.target.value)} placeholder="ឧ. សាស្រ្តាចារ្យ" style={{width:'100%', padding:8, boxSizing:'border-box'}} />
                    <div style={{marginTop:12}}>
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
                    <div style={{marginTop:16}}>
                      <div style={{fontWeight:700}}>ក្រុមដែលមាន:</div>
                      <div style={{maxHeight:220, overflowY:'auto', border:'1px solid #eee', padding:8}}>
                        {skillGroups.length === 0 && <div className="text-gray-600">មិនមាន</div>}
                        {skillGroups.map((g, idx) => (
                          <div key={g.name+idx} style={{padding:'6px 0', borderBottom:'1px solid #fafafa', cursor:'pointer'}} onClick={() => editSkillGroup(idx)}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                              <div>{g.name}</div>
                              <div style={{display:'flex', gap:8}}>
                                <button type="button" onClick={(e)=>{ e.stopPropagation(); editSkillGroup(idx); }} className="px-2 py-1 border rounded text-sm">កែ</button>
                                <button type="button" onClick={(e)=>{ e.stopPropagation(); removeSkillGroup(idx); }} className="text-red-600">លុប</button>
                              </div>
                            </div>
                            <div style={{fontSize:12, color:'#444'}}>{g.members.join(', ')}</div>
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
            <div style={{marginTop:'10px', display:'flex', alignItems:'flex-start', gap:'8px'}}>
            
              <div style={{fontSize:'12px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontWeight: 'bold'}}>សំគាល់៖  ល្អ ទទួលបានប្រាក់លាភការ 100%  ,ល្អបង្គួរ ទទួលបាន 75%  ,មធ្យម ទទួលបាន 50%  ,ខ្សោយ ទទួលបាន 0%</div>
            </div>
          )}
          {reportType !== 'evaluation' && (
            <div className="footer-notes" style={{ fontFamily: '"Khmer OS Siemreap", "Noto Serif Khmer", serif', fontWeight: 'bold', fontSize: '12px' }}>
              <div>បញ្ចប់បញ្ជីត្រឹមចំនួន: {toKhmerDigits((selectedTotals && selectedTotals.total) || 0)} នាក់ &nbsp;&nbsp; (ប្រុស: {toKhmerDigits((selectedTotals && selectedTotals.male) || 0)} នាក់ &nbsp;&nbsp; ស្រី: {toKhmerDigits((selectedTotals && selectedTotals.female) || 0)} នាក់)</div>
            </div>
          )}

          {/* footer/signature area for evaluation report */}
          {reportType === 'evaluation' && (
            <div style={{display:'flex', justifyContent:'space-between', marginTop:'20px', fontSize:'12px'}}>
              <div style={{width:'50%', paddingLeft: '20px'}}>
                <div style={{marginTop:'10px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>បានឃើញ និងឯកភាព</div>
                <div style={{height:'0px'}}></div>
                <select 
                  value={footerLeftTitle} 
                  onChange={(e) => setFooterLeftTitle(e.target.value)}
                  style={{fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center', width:'100%',
                     padding:'6px', boxSizing:'border-box', borderRadius:'3px', border:'none', background:'transparent', appearance:'none', WebkitAppearance:'none', MozAppearance:'none', cursor:'pointer'}}
                >
                  <option value="នាយករងទទួលបន្ទុក">នាយករងទទួលបន្ទុក</option>
                  <option value="នាយកមន្ទីរពេទ្យ">នាយកមន្ទីរពេទ្យ</option>
                </select>
              </div>
              <div style={{width:'30%', textAlign:'center'}}>
                <div style={{marginTop:'10px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}></div>
                <div style={{marginTop:'5px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}></div>
                <div style={{height:'0px'}}></div>
              </div>
              <div style={{width:'50%', textAlign:'right', paddingRight: '20px'}}>
                 <div style={{marginTop:'0px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center'}}>
                  បានវាយតម្លៃ និងគោរពជូន លោកនាយក
                </div>
                <div style={{marginTop:'0px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center'}}>
                  ដើម្បីពិនិត្យនិងសម្រេច
                </div>
                <div style={{marginTop:'0px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center'}}>
                   រាជធានីភ្នំពេញ ថ្ងៃទី..........ខែ..............ឆ្នាំ២០....
                </div>
                <div style={{marginTop:'5px', height:'0px'}}></div>
                <select 
                  value={footerRightTitle} 
                  onChange={(e) => setFooterRightTitle(e.target.value)}
                  style={{fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center', width:'100%', padding:'6px', boxSizing:'border-box', borderRadius:'3px', border:'none', background:'transparent', appearance:'none', WebkitAppearance:'none', MozAppearance:'none', cursor:'pointer'}}
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
          )}

          {/* footer/signature area for other reports */}
          {reportType !== 'evaluation' && (
            <div style={{display:'flex', justifyContent:'space-between', marginTop:'1px', fontSize:'12px'}}>
            <div style={{width:'30%', paddingLeft: '40px'}}>
              <div style={{marginTop:'27px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>បានឃើញ</div>
              <div style={{marginTop:'1px', fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>នាយកមន្ទីរពេទ្យ</div>
              <div style={{height:'64px'}}></div>
              <div style={{textDecoration:'underline', visibility:'hidden'}}>............................</div>
            </div>
            <div style={{width:'50%', textAlign:'center', paddingLeft: '50px'}}>
              <div style={{marginTop:'25px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>បានពិនិត្យត្រឹមត្រូវ</div>
              <div style={{marginTop:'1px', fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}>ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</div>
              <div style={{height:'82px'}}></div>
              <div style={{textDecoration:'underline', visibility:'hidden'}}>............................</div>
            </div>
            <div style={{width:'45%', textAlign:'right', paddingRight: '0px'}}>
              <div style={{marginTop:'0px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center'}}>
                {(lunarText && lunarText.trim()) ? lunarText : ('ថ្ងៃ' + khWeekday(new Date()) + '  ព.ស. ' + toKhmerDigits(buddhistEraYear(new Date())))}
              </div>
              <div style={{marginTop:'2px', fontFamily:'"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize:'12px', textAlign:'center'}}>
                រាជធានីភ្នំពេញ {fmtKhmerLongDate(footerDate)}
              </div>
              <div style={{marginTop:'1px', fontFamily:'"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize:'12px',textAlign:'center'}}> អ្នកធ្វើរបាយការណ៍</div>
              <div style={{height:'82px'}}></div>
              <div style={{textDecoration:'underline', visibility:'hidden'}}>............................</div>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
