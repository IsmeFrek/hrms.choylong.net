import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import api from '../services/api';
import { departmentAPI } from '../services/departmentAPI';
import usePermission from '../hooks/usePermission';
import { isExplicitlyRemoved as _isExplicitlyRemoved, hasResignData as _hasResignData, isPreparedForDeletion as _isPreparedForDeletion, isCountedActive as _isCountedActive } from '../utils/hrFilters';
import { Printer, FileSpreadsheet, Plus, Search, Edit2, Trash2, X, Settings2, SlidersHorizontal, ChevronDown, ShieldCheck } from 'lucide-react';

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, d => map[d]);
}

function getFontSize(text, defaultSize = 13) {
  if (!text) return defaultSize + 'px';
  const len = text.toString().length;
  if (len >= 40) return (defaultSize - 5) + 'px'; // 8px for very long text
  if (len >= 34) return (defaultSize - 4) + 'px'; // 9px
  if (len >= 30) return (defaultSize - 3) + 'px'; // 10px
  if (len >= 27) return (defaultSize - 2) + 'px'; // 11px
  if (len >= 25) return (defaultSize - 1) + 'px'; // 12px
  return defaultSize + 'px';
}

function parseDate(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } catch { return null; }
}

function isIncludedAsOf(hr, asOf) {
  if (!hr) return false;
  const asDate = parseDate(asOf);
  if (!asDate) return true;
  const join = parseDate(hr.joinDate) || parseDate(hr.dateJoinedMinistry) || parseDate(hr.nominationStartDate) || null;
  if (join && join > asDate) return false;
  const removed = parseDate(hr.dateRemoved) || (hr.delisted && (parseDate(hr.delisted.dateRemoved) || parseDate(hr.delisted.date_removed))) || parseDate(hr.dateRemovedFromDataset) || parseDate(hr.removalDate) || null;
  if (removed && removed <= asDate) return false;
  const resign = parseDate(hr.resignDate) || parseDate(hr.resignationDate) || null;
  if (resign && resign <= asDate) return false;
  if ((hr.status || '').toString().toLowerCase() === 'deleted') return false;
  return true;
}

const listColumns = [
  { key: 'serialDept', label: 'ល.រ', width: '35px', align: 'center' },
  { key: 'name', label: 'គោត្តនាម និងនាម', width: '110px', align: 'left' },
  { key: 'skill', label: 'ជំនាញ', width: '140px', align: 'left' },
  { key: 'position', label: 'តួនាទី', width: '130px', align: 'left' },
  { key: 'attendancePercentage', label: ['ភាគរយ', 'វត្តមាន'], width: '50px', align: 'center' },
  { key: 'totalMonthlyAttendance', label: ['លទ្ធផល', 'វត្តមាន'], width: '50px', align: 'center' },
  { key: 'performanceResult', label: ['លទ្ធផល', 'ការងារសម្រេច'], width: '75px', align: 'center' },
  { key: 'otherNotes', label: 'ផ្សេងៗ', width: '115px', align: 'left' },
  { key: 'staffId', label: ['អត្តលេខ', 'កាត់'], width: '80px', align: 'center' },
];

const LEFT_TITLES = ['នាយករងមន្ទីរពេទ្យ', 'នាយករងទទួលបន្ទុក', 'នាយកមន្ទីរពេទ្យ'];
const RIGHT_TITLES = [
  'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក',
  'ប្រធានការិយាល័យហិរញ្ញវត្ថុ',
  'ប្រធានការិយាល័យបច្ចេកទេស',
  'នាយករងមន្ទីរពេទ្យ',
  'នាយផ្នែក',
  'នាយមណ្ឌល'
];

export default function EvaluationReportPage() {
  const perms = usePermission();
  const printRef = useRef(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);

  const [filterText, setFilterText] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rowHeight, setRowHeight] = useState(35);
  const [layout, setLayout] = useState('បញ្ឈរ (A4)');
  const [showColsMenu, setShowColsMenu] = useState(false);

  // Default selected group based on permissions
  const [selectedGroup, setSelectedGroup] = useState(() => {
    if (perms.isAdmin) return 'ថ្នាក់ដឹកនាំ';
    return perms.user?.department || '';
  });

  // Default visible columns for evaluation report
  const [visibleCols, setVisibleCols] = useState({
    serialDept: true,
    name: true,
    skill: true,
    position: true,
    attendancePercentage: true,
    totalMonthlyAttendance: true,
    performanceResult: true,
    otherNotes: true,
    staffId: false,
  });

  useEffect(() => {
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const dStart = new Date(year, month - 2, 22);
      const dEnd = new Date(year, month - 1, 21);
      
      const toLocalISO = (d) => {
        const off = d.getTimezoneOffset();
        const local = new Date(d.getTime() - (off * 60 * 1000));
        return local.toISOString().slice(0, 10);
      };

      setStartDate(toLocalISO(dStart));
      setEndDate(toLocalISO(dEnd));
    }
  }, [selectedMonth]);

  function ShortenLeaveTypeSumDay(t) {
  if (!t) return '';
  const s = String(t).trim();
  if (s.includes('ប្រចាំ​ឆ្នាំ') || s.includes('ប្រចាំឆ្នាំ')) return 'ច្បាប់_ប្រចាំ​ឆ្នាំ';
  if (s.includes('រយៈពេល​ខ្លី') || s.includes('រយៈពេលខ្លី')) return 'ច្បាប់_រយៈពេល​ខ្លី';
  if (s.includes('មាតុភាព')) return 'មាតុភាព';
  if (s.includes('ព្យាបាល​ជំងឺ') || s.includes('ព្យាបាលជំងឺ')) return 'ច្បាប់_ព្យាបាល​ជំងឺ';
  if (s.includes('កិច្ចការ​ផ្ទាល់​ខ្លួន') || s.includes('កិច្ចការផ្ទាល់ខ្លួន')) return 'ច្បាប់_មាន​កិច្ចការ​ផ្ទាល់​ខ្លួន';
  if (s.includes('បេសកកម្ម')) return 'បេសកកម្ម';
  return s;
}

const toggleCol = (k) => setVisibleCols(prev => ({ ...prev, [k]: !prev[k] }));

  const [evaluationGroups, setEvaluationGroups] = useState([]);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/evaluation-groups');
      setEvaluationGroups(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error('Fetch groups error:', e); }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupSelection, setGroupSelection] = useState(new Set());
  const [selectedEditGroupIndex, setSelectedEditGroupIndex] = useState(null);
  const [groupSearchText, setGroupSearchText] = useState('');

  const [footerLeftTitle, setFooterLeftTitle] = useState('នាយករងមន្ទីរពេទ្យ');
  const [footerRightTitle, setFooterRightTitle] = useState('ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក');
  const [isCustomLeftFooter, setIsCustomLeftFooter] = useState(false);
  const [isCustomRightFooter, setIsCustomRightFooter] = useState(false);

  const [signaturePolicies, setSignaturePolicies] = useState([]);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ keyword: '', leftTitle: 'នាយករងមន្ទីរពេទ្យ', rightTitle: '' });
  const [isCustomLeftModal, setIsCustomLeftModal] = useState(false);
  const [isCustomRightModal, setIsCustomRightModal] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState(null);

  const fetchPolicies = async () => {
    try {
      const res = await api.get('/signature-policies');
      if (res.data.length === 0) {
        // Seed initial policies if empty
        const initial = [
          { keyword: 'ប្រធាន', leftTitle: 'នាយកមន្ទីរពេទ្យ', rightTitle: 'នាយករងមន្ទីរពេទ្យ', priority: 10 },
          { keyword: 'រដ្ឋបាល', leftTitle: 'នាយករងមន្ទីរពេទ្យ', rightTitle: 'ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក', priority: 5 },
          { keyword: 'ហិរញ្ញវត្ថុ', leftTitle: 'នាយករងមន្ទីរពេទ្យ', rightTitle: 'ប្រធានការិយាល័យហិរញ្ញវត្ថុ', priority: 5 },
          { keyword: 'បច្ចេកទេស', leftTitle: 'នាយករងមន្ទីរពេទ្យ', rightTitle: 'ប្រធានការិយាល័យបច្ចេកទេស', priority: 5 },
          { keyword: 'ផ្នែក', leftTitle: 'នាយករងមន្ទីរពេទ្យ', rightTitle: 'នាយផ្នែក', priority: 1 },
          { keyword: 'មជ្ឈមណ្ឌល', leftTitle: 'នាយករងមន្ទីរពេទ្យ', rightTitle: 'នាយមណ្ឌល', priority: 1 }
        ];
        for (const p of initial) await api.post('/signature-policies', p);
        const res2 = await api.get('/signature-policies');
        setSignaturePolicies(res2.data);
      } else {
        setSignaturePolicies(res.data);
      }
    } catch (e) { console.error('Fetch policies error:', e); }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const editPolicy = (p) => {
    setEditingPolicyId(p._id);
    setNewPolicy({ keyword: p.keyword, leftTitle: p.leftTitle, rightTitle: p.rightTitle });
    setIsCustomLeftModal(!LEFT_TITLES.includes(p.leftTitle));
    setIsCustomRightModal(!RIGHT_TITLES.includes(p.rightTitle));
  };

  const resetPolicyForm = () => {
    setNewPolicy({ keyword: '', leftTitle: 'នាយករងមន្ទីរពេទ្យ', rightTitle: '' });
    setIsCustomLeftModal(false);
    setIsCustomRightModal(false);
    setEditingPolicyId(null);
  };

  // Auto-suggest signatures based on database policies
  useEffect(() => {
    if (!selectedGroup || selectedGroup === 'all' || signaturePolicies.length === 0) return;
    
    // Find the first matching policy (sorted by priority in backend)
    const match = signaturePolicies.find(p => selectedGroup.includes(p.keyword));
    
    if (match) {
      setFooterLeftTitle(match.leftTitle);
      setIsCustomLeftFooter(!LEFT_TITLES.includes(match.leftTitle));
      
      setFooterRightTitle(match.rightTitle);
      setIsCustomRightFooter(!RIGHT_TITLES.includes(match.rightTitle));
    } else {
      // Default if no match
      setFooterLeftTitle('នាយករងមន្ទីរពេទ្យ');
      setIsCustomLeftFooter(false);
      setFooterRightTitle('ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក');
      setIsCustomRightFooter(false);
    }
  }, [selectedGroup, signaturePolicies]);

  const availableLeftTitles = useMemo(() => {
    const set = new Set(LEFT_TITLES);
    signaturePolicies.forEach(p => { if (p.leftTitle) set.add(p.leftTitle); });
    return Array.from(set);
  }, [signaturePolicies]);

  const availableRightTitles = useMemo(() => {
    const set = new Set(RIGHT_TITLES);
    signaturePolicies.forEach(p => { if (p.rightTitle) set.add(p.rightTitle); });
    return Array.from(set);
  }, [signaturePolicies]);

  useEffect(() => {
    let mounted = true;
    departmentAPI.getDepartments().then(res => {
      if (!mounted) return;
      const data = res?.data || res;
      setDepartments(Array.isArray(data) ? data : []);
    }).catch(() => { if (mounted) setDepartments([]); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const toLocalYmd = (date) => {
      const dt = new Date(date);
      if (isNaN(dt.getTime())) return '';
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const load = async () => {
      if (!(perms.canViewHR || perms.canViewEmployees)) { setLoading(false); return; }
      setLoading(true); setError('');
      
      const [yStr, mStr] = selectedMonth.split('-');
      const y = parseInt(yStr);
      const m = parseInt(mStr);
      const startD = new Date(y, m - 2, 22);
      const endD = new Date(y, m - 1, 21);
      const startStr = toLocalYmd(startD);
      const endStr = toLocalYmd(endD);

      try {
        const [hrRes, attRes, leaveRes, evalRes] = await Promise.all([
          api.get('/hr'),
          api.get('/attendance/summary', { params: { from: startStr, to: endStr, year: yStr, month: mStr } }),
          api.get('/leave-requests', { params: { from: startStr, to: endStr } }),
          api.get('/evaluation-records', { params: { yearMonth: selectedMonth } })
        ]);
        if (!mounted) return;
        const hrData = hrRes.data;
        const attData = attRes.data;
        const leaveData = (Array.isArray(leaveRes.data) ? leaveRes.data : []).filter(lv => {
          const s = (lv.status || '').toLowerCase();
          return s === 'approved' || s === 'pending';
        });
        const evalRecordsData = Array.isArray(evalRes.data) ? evalRes.data : [];
        const evalMap = {};
        evalRecordsData.forEach(r => {
          if (r.staffId) evalMap[r.staffId.toUpperCase()] = r;
        });

        // Exact day-by-day mapping logic from Sum-Day Report
        const leaveMap = new Map();
        leaveData.forEach(lv => {
          const sid = String(lv.staffId || lv.no || (lv.employeeId && (lv.employeeId.staffId || lv.employeeId.no)) || '').trim().toUpperCase();
          if (!sid) return;
          const lvStart = new Date(lv.startDate || lv.from || lv.fromDate);
          const lvEnd = new Date(lv.endDate || lv.to || lv.toDate);
          if (isNaN(lvStart.getTime()) || isNaN(lvEnd.getTime())) return;
          for (let d = new Date(lvStart); d <= lvEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = toLocalYmd(d);
            leaveMap.set(`${sid}_${dateStr}`, lv);
          }
        });

        const dateList = [];
        const it = new Date(startD);
        while (it <= endD) {
          dateList.push(toLocalYmd(it));
          it.setDate(it.getDate() + 1);
        }

        let attendanceMap = {};
        if (Array.isArray(attData)) {
          attData.forEach(row => {
            const sid = String(row.staffId || row.no || '').trim().toUpperCase();
            if (!sid) return;

            // Calculate leave types from daily map
            const typeCounts = {};
            dateList.forEach(dateStr => {
              const lv = leaveMap.get(`${sid}_${dateStr}`);
              if (lv) {
                const short = ShortenLeaveTypeSumDay(lv.type || lv.leaveType || '');
                if (short) typeCounts[short] = (typeCounts[short] || 0) + 1;
              }
            });

            let trueLeaveCount = 0;
            let missionDays = 0;
            Object.entries(typeCounts).forEach(([t, c]) => {
              if (t === 'បេសកកម្ម') missionDays += c;
              else trueLeaveCount += c;
            });

            const dayWorkCount = Number(row.dayWorkCount || 0);
            const A = Number(row.A || 0);
            const lateEarlyEvents = Number(row.checkinLateCount || 0) + Number(row.checkoutEarlyCount || 0);
            
            // Must round totalAbsent first to match Sum-Day Report logic
            let totalAbsent = A + (lateEarlyEvents / 3);
            totalAbsent = Math.round(totalAbsent * 100) / 100;
            
            const clamp = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
            let overallPercent = dayWorkCount > 0 ? clamp(Math.round(((dayWorkCount - (totalAbsent + trueLeaveCount)) / dayWorkCount) * 100)) : 0;
            
            let result = '';
            if (overallPercent >= 85) result = 'ល្អ';
            else if (overallPercent >= 65) result = 'ល្អបង្គួរ';
            else if (overallPercent >= 45) result = 'មធ្យម';
            else if (dayWorkCount > 0) result = 'ខ្សោយ';
            
            attendanceMap[sid] = {
              percent: overallPercent > 0 ? toKhmerDigits(overallPercent) + '%' : (dayWorkCount > 0 ? toKhmerDigits(0) + '%' : ''),
              result: result,
              typeCounts: typeCounts
            };
          });
        }

        const merged = (Array.isArray(hrData) ? hrData : []).map(hr => {
          const sid = String(hr.staffId || hr.no || '').trim().toUpperCase();
          const att = attendanceMap[sid] || { percent: '', result: '', typeCounts: {} };
          
          let specialLeaves = [];
          let hasSpecialLeave = false;
          Object.entries(att.typeCounts || {}).forEach(([t, c]) => {
            if (t.includes('ទំនេរគ្មានបៀវត្ស') || t.includes('ទៅរៀន') || t.includes('មាតុភាព') || t.includes('ប្រចាំ​ឆ្នាំ') || t.includes('ប្រចាំឆ្នាំ')) {
              hasSpecialLeave = true;
              let name = t;
              if (t.includes('ប្រចាំ')) name = 'ច្បាប់ប្រចាំឆ្នាំ';
              else if (t.includes('មាតុភាព')) name = 'មាតុភាព';
              else if (t.includes('ទំនេរគ្មានបៀវត្ស')) name = 'ទំនេរគ្មានបៀវត្ស';
              else if (t.includes('ទៅរៀន')) name = 'ទៅរៀន';
              specialLeaves.push(`${name} ${toKhmerDigits(c)}ថ្ងៃ`);
            }
          });
          const note = specialLeaves.join(', ');

          const dbRec = evalMap[sid];
          let finalPerf = '';
          let finalNote = '';
          if (dbRec) {
            finalPerf = dbRec.performanceResult || '';
            finalNote = dbRec.otherNotes || '';
          } else {
            finalPerf = hasSpecialLeave ? note : '';
            finalNote = note;
          }

          return { 
            ...hr, 
            attendancePercentage: att.percent,
            totalMonthlyAttendance: att.result, 
            performanceResult: finalPerf, 
            otherNotes: finalNote,
            hasSpecialLeave: hasSpecialLeave
          };
        });
        setList(merged);
      } catch (e) {
        console.error('Fetch error:', e);
        if (mounted) setError(e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [perms.canViewHR, perms.canViewEmployees, startDate, endDate, selectedMonth]);

  const handleEditEvaluation = (staffId, field, value) => {
    setList(prev => prev.map(hr => {
      const sid = String(hr.staffId || hr.no || '').trim().toUpperCase();
      if (sid === String(staffId).trim().toUpperCase()) {
        return { ...hr, [field]: value };
      }
      return hr;
    }));
  };

  const saveEvaluation = async (staffId, performanceResult, otherNotes) => {
    if (!staffId) return;
    try {
      await api.post('/evaluation-records', {
        staffId: String(staffId).trim().toUpperCase(),
        yearMonth: selectedMonth,
        performanceResult: performanceResult || '',
        otherNotes: otherNotes || ''
      });
    } catch (e) {
      console.error('Failed to save evaluation', e);
    }
  };

  const filteredList = useMemo(() => {
    let filtered = list.filter(hr => isIncludedAsOf(hr, endDate));
    
    // Enforce department access rule: Non-admins can ONLY see their own department
    if (!perms.isAdmin && perms.user?.department) {
      filtered = filtered.filter(hr => (hr.Department_Kh || hr.department || '').toString() === perms.user.department);
    }

    if (filterText) {
      const q = filterText.toLowerCase();
      filtered = filtered.filter(hr => (hr.khmerName || '').toLowerCase().includes(q) || (hr.name || '').toLowerCase().includes(q) || (hr.staffId || '').toString().includes(q));
    }
    if (selectedGroup) {
      const evalGroup = evaluationGroups.find(g => g.name === selectedGroup);
      if (evalGroup) {
        // If a specific custom group is selected, show ONLY its members
        filtered = filtered.filter(hr => (evalGroup.members || []).map(String).includes(String(hr.staffId || hr.no || hr._id)));
      } else {
        // If a department is selected, show its members BUT EXCLUDE anyone who is in a custom group
        const allGroupMembers = new Set(evaluationGroups.flatMap(g => g.members || []).map(String));
        filtered = filtered.filter(hr =>
          (hr.Department_Kh || hr.department || '').toString() === selectedGroup &&
          !allGroupMembers.has(String(hr.staffId || hr.no || hr._id))
        );
      }
    } else {
      // If no group/dept selected, hide everyone who is in a custom group
      const allGroupMembers = new Set(evaluationGroups.flatMap(g => g.members || []).map(String));
      filtered = filtered.filter(hr => !allGroupMembers.has(String(hr.staffId || hr.no || hr._id)));
    }
    return filtered;
  }, [list, filterText, endDate, selectedGroup, evaluationGroups]);

  const grouped = useMemo(() => {
    const by = new Map();
    for (const hr of filteredList) {
      const key = (hr.Department_Kh || hr.department || '—').toString().trim();
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(hr);
    }
    return Array.from(by.entries()).map(([dept, members]) => ({ dept, members }));
  }, [filteredList]);

  // Exact same SCREEN_CSS as EmployeeReportPage.jsx
  const SCREEN_CSS = `
    .print-scope { font-family: "Khmer OS Siemreap","Noto Sans Khmer", Arial, sans-serif; color:#111; font-size: 12px; }
    .print-scope h1, .print-scope h2, .print-scope h3 { margin: 6px 0; }
    .print-scope .title { text-align: center; margin-bottom: 6px; }
    .print-scope .title h2 { font-family: "Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif; font-size: 15px; font-weight: normal; }
    .print-scope .subtitle { text-align: center; margin-bottom: 8px; }
    .print-scope table { width: 100%; border-collapse: collapse; border: 1px solid #222; table-layout: fixed; }
    .print-scope th, .print-scope td { border: 1px solid #222; padding: 6px 4px; font-size: 13px; vertical-align: middle; text-align: center; word-wrap: break-word; overflow: hidden; }
    .print-scope th { background: #f7f7f7; font-family: "Khmer OS Siemreap", serif; font-weight: bold; text-align: center; }
    .print-scope .section-row th { background: #efefef; text-align: left; font-weight: normal; font-family: "Khmer OS Muol Light", serif; font-size: 11px; padding-left: 10px !important; }
    .print-scope .no-border { border: 0 none; }
    .a4-portrait { 
      max-width: 210mm; width: 100%; min-height: 297mm; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      background: #fff; position: relative; overflow: visible;
    }
    .print-wrapper {
      width: 200mm;
      margin: 5mm auto;
      box-sizing: border-box;
    }
    .print-scope tbody tr { min-height: ${rowHeight}px; }
    .print-scope th, .print-scope td { padding: ${Math.max(4, Math.round(rowHeight / 6))}px 2px !important; line-height: ${Math.max(12, Math.round(rowHeight * 0.6))}px !important; }
    .print-scope td.left { text-align: left !important; padding-left: 3px !important; }
    .print-scope td.center { text-align: center !important; }
    .print-scope select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background: transparent; border: none; color: inherit; font-family: inherit; font-size: inherit; padding: 0; margin: 0; cursor: default; }
    .print-scope select::-ms-expand { display: none; }
    @media print {
      .no-print { display: none !important; }
    }
  `;

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const PRINT_STYLES = `
      <style>
        @page { size: A4; margin: 5mm; }
        body { 
          font-family: "Khmer OS Siemreap", "Noto Sans Khmer", Arial, sans-serif; 
          color: #111; 
          margin: 0; 
          padding: 0; 
          width: 100%;
        }
        .title { text-align: center; margin-bottom: 6px; }
        .title h2 { font-family: "Khmer OS Muol Light", serif; font-size: 15px; margin: 0; font-weight: normal; }
        .subtitle { text-align: center; margin-bottom: 8px; font-size: 13px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #222; table-layout: fixed; }
        th, td { border: 1px solid #222; padding: 6px 4px; vertical-align: middle; text-align: center; font-size: 13px; word-wrap: break-word; overflow: hidden; }
        th { background: #f7f7f7; font-family: "Khmer OS Siemreap", serif; font-weight: bold; }
        .section-row th { background: #efefef; text-align: left; padding: 6px 10px; font-family: "Khmer OS Muol Light", serif; border-bottom: 1px solid #222; font-size: 11px; font-weight: normal; }
        tbody tr { min-height: ${rowHeight}px; }
        th, td { padding: ${Math.max(4, Math.round(rowHeight / 6))}px 2px !important; line-height: ${Math.max(12, Math.round(rowHeight * 0.6))}px !important; }
        .signatures { display: flex; justify-content: space-around; margin-top: 40px; font-size: 12px; text-align: center; }
        .sig-box { width: 40%; display: flex; flex-direction: column; align-items: center; }
        .sig-role { font-family: "Khmer OS Muol Light", serif; font-size: 12px; margin-top: 2px; }
        td.left { text-align: left !important; padding-left: 3px !important; }
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; background: transparent; border: none; color: inherit; font-family: inherit; font-size: inherit; padding: 0; margin: 0; }
        select::-ms-expand { display: none; }
      </style>
    `;
    w.document.write("<!doctype html><html><head><meta charset=\"utf-8\"/>" + PRINT_STYLES + "</head><body>" + printRef.current.innerHTML + "</body></html>");
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Evaluation Report');
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'evaluation.xlsx'; a.click();
    } catch (e) { alert('Excel failed'); }
  };

  const saveGroup = async () => {
    if (!groupNameInput.trim()) return;
    try {
      await api.post('/evaluation-groups', {
        name: groupNameInput.trim(),
        members: Array.from(groupSelection)
      });
      await fetchGroups();
      setGroupNameInput('');
      setGroupSelection(new Set());
      setSelectedEditGroupIndex(null);
      setShowGroupModal(false);
    } catch (e) {
      console.error('Save group error:', e);
      alert('រក្សាទុកក្រុមមិនបានសម្រេច: ' + (e.response?.data?.message || e.message));
    }
  };

  const deleteGroup = async (name) => {
    if (!window.confirm(`តើអ្នកប្រាកដថាចង់លុបក្រុម "${name}" នេះមែនទេ?`)) return;
    try {
      await api.delete(`/evaluation-groups/${encodeURIComponent(name)}`);
      await fetchGroups();
      if (groupNameInput === name) {
        setGroupNameInput('');
        setGroupSelection(new Set());
      }
    } catch (e) {
      console.error('Delete group error:', e);
      alert('លុបក្រុមមិនបានសម្រេច');
    }
  };

  const editGroup = (g) => {
    setGroupNameInput(g.name);
    setGroupSelection(new Set(g.members));
    setShowGroupModal(true);
  };

  const [yearStr, monthStr] = selectedMonth.split('-');
  const khMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const subtitleText = `ប្រចាំ ខែ${khMonths[parseInt(monthStr) - 1]} ឆ្នាំ${toKhmerDigits(yearStr)}`;

  return (
    <div className="p-4" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: '"Khmer OS Siemreap", sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />

      {/* Top Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input type="text" placeholder="ស្វែងរកឈ្មោះ, អត្តលេខ, ផ្នែក, តួនាទី..." value={filterText} onChange={e => setFilterText(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-400 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            {perms.isAdmin && (
              <button onClick={() => setShowGroupModal(true)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-all">បង្កើតក្រុមជំនាញ</button>
            )}
            <button onClick={handleExportExcel} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-100 transition-all">នាំចេញ Excel</button>
            <button onClick={handlePrint} className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-100 transition-all">បោះពុម្ព</button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
          <div className="flex flex-col min-w-[140px]"><label className="text-[11px] font-bold text-gray-400 mb-1 ml-1">ប្រចាំខែ:</label><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none" /></div>
          <div className="flex flex-col min-w-[140px]"><label className="text-[11px] font-bold text-gray-400 mb-1 ml-1">ចាប់ពីថ្ងៃ:</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none" /></div>
          <div className="flex flex-col min-w-[140px]"><label className="text-[11px] font-bold text-gray-400 mb-1 ml-1">ដល់ថ្ងៃ:</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none" /></div>
          <div className="flex flex-col min-w-[200px]">
            <label className="text-[11px] font-bold text-gray-400 mb-1 ml-1">ក្រុម:</label>
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none bg-white" disabled={!perms.isAdmin}>
              {!perms.isAdmin ? (
                <option value={perms.user?.department || ''}>{perms.user?.department || 'គ្មានផ្នែក'}</option>
              ) : (
                <>
                  <option value="">— ជ្រើសរើសក្រុម —</option>
                  {evaluationGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                  {departments.map(d => <option key={d._id} value={d.Department_Kh}>{d.Department_Kh}</option>)}
                </>
              )}
            </select>
          </div>
          <div className="flex flex-col min-w-[120px]"><label className="text-[11px] font-bold text-gray-400 mb-1 ml-1">របៀប:</label><select value={layout} onChange={e => setLayout(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none bg-white"><option>បញ្ឈរ (A4)</option><option>ផ្តេក (A4)</option></select></div>
          <div className="flex flex-col min-w-[120px]"><label className="text-[11px] font-bold text-gray-400 mb-1 ml-1 text-center">Row Height:</label><div className="flex items-center gap-2"><input type="range" min={20} max={60} value={rowHeight} onChange={e => setRowHeight(parseInt(e.target.value))} className="w-full h-1.5 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600" /></div></div>

          <div className="relative">
            <button onClick={() => setShowColsMenu(!showColsMenu)} className="px-4 py-1.5 border border-gray-200 rounded-md text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 h-[34px]">Columns</button>
            {showColsMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 shadow-xl rounded-xl p-4 min-w-[260px] z-[100]">
                <div className="text-[11px] font-bold text-gray-400 mb-3 uppercase tracking-wider">បង្ហាញជួរឈរ</div>
                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-2">
                  {listColumns.map(c => (
                    <label key={c.key} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={!!visibleCols[c.key]}
                        onChange={() => toggleCol(c.key)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all shrink-0"
                      />
                      <span className="text-[13px] text-gray-700 group-hover:text-indigo-600 transition-colors">
                        {Array.isArray(c.label) ? c.label.join('') : c.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report Container */}
      <div className="flex justify-center mb-20">
        <div ref={printRef} className="print-scope a4-portrait">
          <div className="print-wrapper">
            <div className="title">
              <h2>របាយការណ៍វាយតម្លៃការបំពេញមុខងារ និងការទទួលខុសត្រូវការងាររបស់បុគ្គលិក មន្ត្រីរាជការ</h2>
            </div>
            <div style={{ textAlign: 'center', marginTop: 2, fontSize: 14, fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontWeight: 'bold' }}>
              {subtitleText}
            </div>

            <table style={{ marginTop: '10px' }}>
              <thead>
                <tr>
                  {listColumns.filter(c => !!visibleCols[c.key]).map(c => (
                    <th key={c.key} style={{ width: c.width }}>
                      {c.key === 'totalMonthlyAttendance' ? (
                        <div style={{ lineHeight: '1.2' }}><div>លទ្ធផល</div><div>វត្តមាន</div></div>
                      ) : c.key === 'attendancePercentage' ? (
                        <div style={{ lineHeight: '1.2' }}><div>ភាគរយ</div><div>វត្តមាន</div></div>
                      ) : c.key === 'performanceResult' ? (
                        <div style={{ lineHeight: '1.2' }}><div>លទ្ធផល</div><div>ការងារសម្រេច</div></div>
                      ) : c.key === 'staffId' ? (
                        <div style={{ lineHeight: '1.2' }}><div>អត្តលេខ</div><div>កាត់</div></div>
                      ) : c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, gi) => (
                  <React.Fragment key={g.dept + gi}>
                    <tr className="section-row">
                      <th colSpan={listColumns.filter(c => !!visibleCols[c.key]).length}>
                        {g.dept}
                      </th>
                    </tr>
                    {g.members.map((r, idx) => (
                      <tr key={r._id || idx}>
                        {visibleCols.serialDept && <td className="center">{toKhmerDigits(idx + 1)}</td>}
                        {visibleCols.name && <td className="left" style={{ paddingLeft: '2px' }}>{r.khmerName || r.name}</td>}
                        {visibleCols.skill && <td className="left" style={{ fontSize: getFontSize(r.skill || r.technicalRole), whiteSpace: 'nowrap', paddingLeft: '2px' }}>{r.skill || r.technicalRole || ''}</td>}
                        {visibleCols.position && <td className="left" style={{ fontSize: getFontSize(r.position), whiteSpace: 'nowrap', paddingLeft: '2px' }}>{r.position || ''}</td>}
                        {visibleCols.attendancePercentage && <td className="center">{r.attendancePercentage || ''}</td>}
                        {visibleCols.totalMonthlyAttendance && <td className="center">{r.totalMonthlyAttendance || ''}</td>}
                        {(visibleCols.performanceResult && visibleCols.otherNotes && r.hasSpecialLeave) ? (
                          <td colSpan={2} className="center" style={{ padding: 0 }}>
                            <input
                              className="no-print-border"
                              style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', outline: 'none', fontWeight: 'bold', minHeight: '30px' }}
                              value={r.otherNotes || ''}
                              onChange={(e) => {
                                handleEditEvaluation(r.staffId || r.no, 'performanceResult', e.target.value);
                                handleEditEvaluation(r.staffId || r.no, 'otherNotes', e.target.value);
                              }}
                              onBlur={() => saveEvaluation(r.staffId || r.no, r.otherNotes, r.otherNotes)}
                            />
                          </td>
                        ) : (
                          <>
                            {visibleCols.performanceResult && (
                              <td className="center" style={{ padding: 0 }}>
                                <input
                                  className="no-print-border"
                                  style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', outline: 'none', minHeight: '30px' }}
                                  value={r.performanceResult || ''}
                                  onChange={(e) => handleEditEvaluation(r.staffId || r.no, 'performanceResult', e.target.value)}
                                  onBlur={() => saveEvaluation(r.staffId || r.no, r.performanceResult, r.otherNotes)}
                                />
                              </td>
                            )}
                            {visibleCols.otherNotes && (
                              <td className="left" style={{ padding: 0 }}>
                                <input
                                  className="no-print-border"
                                  style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'left', outline: 'none', paddingLeft: '4px', minHeight: '30px' }}
                                  value={r.otherNotes || ''}
                                  onChange={(e) => handleEditEvaluation(r.staffId || r.no, 'otherNotes', e.target.value)}
                                  onBlur={() => saveEvaluation(r.staffId || r.no, r.performanceResult, r.otherNotes)}
                                />
                              </td>
                            )}
                          </>
                        )}
                        {visibleCols.staffId && <td className="center">{r.staffId || ''}</td>}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '13px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontWeight: 'bold' }}>សំគាល់៖</div>
              <div style={{ fontSize: '12px', fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', paddingLeft: '10px', lineHeight: '1.6' }}>
                ១. វឌ្ឍនការងារ៖ ល្អ (≥{toKhmerDigits(85)}%-{toKhmerDigits(100)}%), ល្អបង្គួរ (≥{toKhmerDigits(65)}%-{"<"}{toKhmerDigits(85)}%), មធ្យម (≥{toKhmerDigits(45)}%-{"<"}{toKhmerDigits(65)}%), ខ្សោយ ({"<"}{toKhmerDigits(45)}%)<br />
                ២. ការផ្តល់ប្រាក់លើកទឹកចិត្ត៖ ល្អ ({toKhmerDigits(100)}%), ល្អបង្គួរ ({toKhmerDigits(75)}%), មធ្យម ({toKhmerDigits(50)}%), ខ្សោយ ({toKhmerDigits(0)}%)
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '12px', alignItems: 'flex-start' }}>
              <div style={{ width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '25px' }}>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>បានឃើញ និងឯកភាព</div>
                <div style={{ marginTop: '2px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  {!isCustomLeftFooter ? (
                    <select 
                      value={footerLeftTitle} 
                      onChange={e => {
                        if (e.target.value === 'OTHER') {
                          setIsCustomLeftFooter(true);
                        } else {
                          setFooterLeftTitle(e.target.value);
                        }
                      }} 
                      style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '13px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', paddingTop: '1px', paddingBottom: '1px', lineHeight: '1.8', width: '100%' }}
                    >
                      {availableLeftTitles.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="OTHER">ផ្សេងៗ...</option>
                    </select>
                  ) : (
                    <input 
                      type="text"
                      value={footerLeftTitle}
                      onChange={e => setFooterLeftTitle(e.target.value)}
                      onBlur={() => { if (!footerLeftTitle) setIsCustomLeftFooter(false); }}
                      placeholder="បញ្ចូលតួនាទី..."
                      style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '13px', textAlign: 'center', border: '1px dashed #ccc', background: 'transparent', outline: 'none', width: '100%', padding: '0px' }}
                    />
                  )}
                </div>
              </div>
              <div style={{ width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '-25px' }}>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>បានវាយតម្លៃ និងគោរពជូន លោកនាយក</div>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>ដើម្បីពិនិត្យនិងសម្រេច</div>
                <div style={{ fontFamily: '"Khmer OS Siemreap","Noto Serif Khmer", serif', fontSize: '12px' }}>រាជធានីភ្នំពេញ ថ្ងៃទី..........ខែ..............ឆ្នាំ២០....</div>
                <div style={{ marginTop: '5px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                  {!isCustomRightFooter ? (
                    <select 
                      value={footerRightTitle} 
                      onChange={e => {
                        if (e.target.value === 'OTHER') {
                          setIsCustomRightFooter(true);
                        } else {
                          setFooterRightTitle(e.target.value);
                        }
                      }} 
                      style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '13px', textAlign: 'center', border: 'none', background: 'transparent', outline: 'none', width: '100%', paddingTop: '1px', paddingBottom: '1px', lineHeight: '1.8' }}
                    >
                      {availableRightTitles.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="OTHER">ផ្សេងៗ...</option>
                    </select>
                  ) : (
                    <input 
                      type="text"
                      value={footerRightTitle}
                      onChange={e => setFooterRightTitle(e.target.value)}
                      onBlur={() => { if (!footerRightTitle) setIsCustomRightFooter(false); }}
                      placeholder="បញ្ចូលតួនាទី..."
                      style={{ fontFamily: '"Khmer OS Muol Light","Khmer OS Muol","Noto Serif Khmer", serif', fontSize: '13px', textAlign: 'center', border: '1px dashed #ccc', background: 'transparent', outline: 'none', width: '100%', padding: '0px' }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Policy Info Panel (Screen Only) */}
      <div className="max-w-[1000px] mx-auto mt-12 mb-20 no-print">
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Settings2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-900">គោលការណ៍ហត្ថលេខាស្វ័យប្រវត្តិ (Auto-Signature Policy)</h3>
                <p className="text-[11px] text-blue-600">ប្រព័ន្ធនឹងរើសហត្ថលេខាខាងក្រោមដោយស្វ័យប្រវត្តិតាមប្រភេទផ្នែកដែលបានជ្រើសរើស</p>
              </div>
            </div>
            <button onClick={() => setShowPolicyModal(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 transition-all flex items-center gap-1">
              <Settings2 size={14} /> កែប្រែគោលការណ៍
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {signaturePolicies.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/30 hover:bg-blue-50/20 transition-colors group relative">
                  <span className="text-xl">📋</span>
                  <div className="flex-1">
                    <div className="text-[12px] font-bold text-gray-700 mb-1">ពាក្យគន្លឹះ: "{item.keyword}"</div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[11px] text-gray-500"><span className="font-semibold text-blue-600">ឆ្វេង:</span> {item.leftTitle}</div>
                      <div className="text-[11px] text-gray-500"><span className="font-semibold text-indigo-600">ស្តាំ:</span> {item.rightTitle}</div>
                    </div>
                  </div>
                </div>
              ))}
              {signaturePolicies.length === 0 && <div className="col-span-full py-10 text-center text-gray-400 text-sm italic">មិនទាន់មានគោលការណ៍កំណត់នៅឡើយ</div>}
            </div>
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">💡</div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>សម្គាល់:</strong> លោកអ្នកនៅតែអាចផ្លាស់ប្តូរហត្ថលេខាដោយដៃផ្ទាល់ (Manual) នៅក្នុង Dropdown នៃតារាងបោះពុម្ពខាងលើបានគ្រប់ពេលវេលា។
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Management Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">គ្រប់គ្រងគោលការណ៍ហត្ថលេខា</h3>
                  <p className="text-xs text-gray-500">កំណត់ពាក្យគន្លឹះដើម្បីរើសហត្ថលេខាដោយស្វ័យប្រវត្តិ</p>
                </div>
              </div>
              <button onClick={() => setShowPolicyModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-6 bg-indigo-50/30 border-b">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase">ពាក្យគន្លឹះ (Keyword)</label>
                    <input value={newPolicy.keyword} onChange={e => setNewPolicy({...newPolicy, keyword: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400" placeholder="ឧ: ផ្នែក, រដ្ឋបាល..." />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase">ហត្ថលេខាឆ្វេង</label>
                    {!isCustomLeftModal ? (
                      <select 
                        value={newPolicy.leftTitle} 
                        onChange={e => {
                          if (e.target.value === 'OTHER') {
                            setIsCustomLeftModal(true);
                            setNewPolicy({...newPolicy, leftTitle: ''});
                          } else {
                            setNewPolicy({...newPolicy, leftTitle: e.target.value});
                          }
                        }} 
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        {availableLeftTitles.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="OTHER">ផ្សេងៗ (កំណត់ខ្លួនឯង)</option>
                      </select>
                    ) : (
                      <div className="relative">
                        <input 
                          value={newPolicy.leftTitle} 
                          onChange={e => setNewPolicy({...newPolicy, leftTitle: e.target.value})} 
                          className="w-full px-4 py-2.5 bg-white border border-indigo-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400" 
                          placeholder="បញ្ចូលតួនាទី..." 
                        />
                        <button onClick={() => { setIsCustomLeftModal(false); setNewPolicy({...newPolicy, leftTitle: LEFT_TITLES[0]}); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-indigo-500 font-bold hover:underline">បញ្ជី</button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase">ហត្ថលេខាស្តាំ</label>
                    {!isCustomRightModal ? (
                      <select 
                        value={newPolicy.rightTitle} 
                        onChange={e => {
                          if (e.target.value === 'OTHER') {
                            setIsCustomRightModal(true);
                            setNewPolicy({...newPolicy, rightTitle: ''});
                          } else {
                            setNewPolicy({...newPolicy, rightTitle: e.target.value});
                          }
                        }} 
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
                      >
                        <option value="">— ជ្រើសរើសតួនាទី —</option>
                        {availableRightTitles.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="OTHER">ផ្សេងៗ (កំណត់ខ្លួនឯង)</option>
                      </select>
                    ) : (
                      <div className="relative">
                        <input 
                          value={newPolicy.rightTitle} 
                          onChange={e => setNewPolicy({...newPolicy, rightTitle: e.target.value})} 
                          className="w-full px-4 py-2.5 bg-white border border-indigo-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400" 
                          placeholder="បញ្ចូលតួនាទី..." 
                        />
                        <button onClick={() => { setIsCustomRightModal(false); setNewPolicy({...newPolicy, rightTitle: ''}); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-indigo-500 font-bold hover:underline">បញ្ជី</button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      if (!newPolicy.keyword || !newPolicy.rightTitle) return;
                      try {
                        if (editingPolicyId) {
                          await api.put(`/signature-policies/${editingPolicyId}`, newPolicy);
                        } else {
                          await api.post('/signature-policies', newPolicy);
                        }
                        await fetchPolicies();
                        resetPolicyForm();
                      } catch (e) { alert('បរាជ័យក្នុងការរក្សាទុក'); }
                    }} className="flex-1 h-[46px] bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
                      {editingPolicyId ? <ShieldCheck size={18} /> : <Plus size={18} />}
                      {editingPolicyId ? 'រក្សាទុកការកែប្រែ' : 'បន្ថែមគោលការណ៍'}
                    </button>
                    {editingPolicyId && (
                      <button onClick={resetPolicyForm} className="px-6 h-[46px] bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">បោះបង់</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-black text-gray-400 uppercase tracking-widest border-b pb-4">
                      <th className="text-left pb-4 pl-2">ពាក្យគន្លឹះ</th>
                      <th className="text-left pb-4">ហត្ថលេខាឆ្វេង</th>
                      <th className="text-left pb-4">ហត្ថលេខាស្តាំ</th>
                      <th className="text-right pb-4 pr-2">សកម្មភាព</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {signaturePolicies.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 pl-2 font-bold text-indigo-600">"{p.keyword}"</td>
                        <td className="py-4 text-sm text-gray-600">{p.leftTitle}</td>
                        <td className="py-4 text-sm text-gray-600">{p.rightTitle}</td>
                        <td className="py-4 text-right pr-2">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => editPolicy(p)} className="p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={async () => {
                              if (!window.confirm('លុបគោលការណ៍នេះ?')) return;
                              await api.delete(`/signature-policies/${p._id}`);
                              await fetchPolicies();
                            }} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setShowPolicyModal(false)} className="px-8 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-100 transition-all">រួចរាល់</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 text-[#111]">
          <div className="bg-white w-full max-w-6xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <Settings2 size={20} className="text-indigo-600" />
                <h3 className="text-lg font-bold">គ្រប់គ្រងក្រុមជំនាញ (រក្សាទុកបានច្រើនក្រុម)</h3>
              </div>
              <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-72 border-r bg-gray-50/50 p-4 overflow-y-auto">
                <div className="text-[11px] font-bold text-gray-400 mb-4 uppercase tracking-wider">ក្រុមដែលបានបង្កើតរួច</div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => { setGroupNameInput(''); setGroupSelection(new Set()); }} className="flex items-center gap-2 w-full p-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all mb-2">
                    <Plus size={18} /> បង្កើតក្រុមថ្មី
                  </button>
                  {evaluationGroups.map((g, i) => (
                    <div key={i} className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${groupNameInput === g.name ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'bg-white border-gray-100 hover:border-indigo-100 shadow-sm'}`} onClick={() => editGroup(g)}>
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <span className="text-sm font-bold text-gray-700 truncate">{g.name}</span>
                        <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded font-bold shrink-0">{toKhmerDigits(g.members?.length || 0)}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteGroup(g.name); }} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 ml-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex flex-col h-full">
                  <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">ជ្រើសរើសបុគ្គលិក</label>
                      <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full uppercase">Selected: {toKhmerDigits(groupSelection.size)}</div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        value={groupSearchText}
                        onChange={e => setGroupSearchText(e.target.value)}
                        placeholder="ស្វែងរកឈ្មោះ, តួនាទី, ផ្នែក..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="border border-gray-100 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden bg-white">
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="p-4 w-12 text-center border-b">
                              <input
                                type="checkbox"
                                onChange={e => setGroupSelection(e.target.checked ? new Set(list.map(x => x.staffId || x.no || x._id)) : new Set())}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </th>
                            <th className="p-4 font-bold text-gray-500 uppercase tracking-wider border-b">ឈ្មោះ</th>
                            <th className="p-4 font-bold text-gray-500 uppercase tracking-wider border-b">តួនាទី</th>
                            <th className="p-4 font-bold text-gray-500 uppercase tracking-wider border-b">ផ្នែក</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {list.filter(emp => {
                            // Filter by search text first
                            if (groupSearchText) {
                              const q = groupSearchText.replace(/\s/g, '').toLowerCase();
                              const matchName = (emp.khmerName || emp.name || '').replace(/\s/g, '').toLowerCase().includes(q);
                              const matchPos = (emp.position || '').replace(/\s/g, '').toLowerCase().includes(q);
                              const matchDept = (emp.Department_Kh || emp.department || '').replace(/\s/g, '').toLowerCase().includes(q);
                              if (!(matchName || matchPos || matchDept)) return false;
                            }
                            return true;
                          }).map(emp => {
                            const otherGroup = evaluationGroups.find(g => g.name !== groupNameInput && g.members.includes(emp.staffId));
                            const isDisabled = !!otherGroup;
                            
                            return (
                              <tr key={emp._id} onClick={() => !isDisabled && setGroupSelection(prev => { const n = new Set(prev); if (n.has(emp.staffId)) n.delete(emp.staffId); else n.add(emp.staffId); return n; })} className={`transition-all ${isDisabled ? 'bg-gray-50/50 cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-indigo-50/20'}`}>
                                <td className="p-4 text-center">
                                  {isDisabled ? (
                                    <div className="w-4 h-4 rounded border-gray-200 bg-gray-100 mx-auto"></div>
                                  ) : (
                                    <input type="checkbox" checked={groupSelection.has(emp.staffId)} readOnly className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                  )}
                                </td>
                                <td className="p-4">
                                  <div className="font-bold text-gray-700">{emp.khmerName || emp.name}</div>
                                  {isDisabled && <div className="text-[9px] text-orange-500 font-bold uppercase mt-0.5">នៅក្នុងក្រុម: {otherGroup.name}</div>}
                                </td>
                                <td className="p-4 text-gray-500">{emp.position || ''}</td>
                                <td className="p-4 text-gray-500">{emp.Department_Kh || emp.department}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-80 p-6 bg-gray-50/30 border-l flex flex-col gap-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-widest">ឈ្មោះក្រុម</label>
                  <input value={groupNameInput} onChange={e => setGroupNameInput(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all shadow-sm" placeholder="ឧទាហរណ៍៖ ក្រុមពេទ្យធ្មេញ..." />
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-indigo-50 shadow-sm flex flex-col gap-3">
                    <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">សេចក្តីសង្ខេបក្រុម</div>
                    <div className="flex items-end gap-2 border-b border-indigo-50 pb-3">
                      <div className="text-4xl font-black text-indigo-700">{toKhmerDigits(groupSelection.size)}</div>
                      <div className="text-sm font-bold text-gray-400 mb-1.5 uppercase">នាក់ ក្នុងក្រុមនេះ</div>
                    </div>

                    <div className="max-h-[180px] overflow-y-auto flex flex-col gap-2 pt-1 pr-1">
                      {Array.from(groupSelection).map(sid => {
                        const emp = list.find(x => x.staffId === sid);
                        if (!emp) return null;
                        return (
                          <div key={sid} className="flex items-center gap-2 bg-indigo-50/30 p-2 rounded-lg">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                            <span className="text-[12px] font-bold text-gray-700">{emp.khmerName || emp.name}</span>
                          </div>
                        );
                      })}
                      {groupSelection.size === 0 && <div className="text-[11px] text-gray-400 italic text-center py-4">មិនទាន់មានបុគ្គលិកត្រូវបានជ្រើសរើស</div>}
                    </div>
                  </div>
                </div>
                <button onClick={saveGroup} disabled={!groupNameInput.trim() || groupSelection.size === 0} className="w-full py-4 bg-indigo-600 disabled:bg-gray-200 disabled:shadow-none text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all transform active:scale-[0.98]">
                  រក្សាទុកក្រុម
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
