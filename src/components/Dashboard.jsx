
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { Users, UserPlus, UserMinus, Clock, TrendingUp, Award, Calendar, CalendarDays } from 'lucide-react';
import api, { employeeAPI } from '../services/api';
import HRAPI from '../services/hrAPI';
import { isExplicitlyRemoved as _isExplicitlyRemoved, isCountedActive as _isCountedActive, hasResignData as _hasResignData } from '../utils/hrFilters';
import { useNavigate } from 'react-router-dom';
import usePermission from '../hooks/usePermission';

const Dashboard = () => {
  const navigate = useNavigate();
  const perms = usePermission();
  const canViewHR = perms?.canViewHR || perms?.canViewEmployees;

  // Removed inline edit modal; navigate to employee edit listing instead
  // Normalize image path for backend images
  const getImageSrc = (image) => {
    if (!image) return '';
    if (image.startsWith('/uploads/')) {
  return `${API_BASE}${image}`;
    }
    return image;
  };
  const getEmployeeDisplayName = (emp) => {
    if (!emp) return 'គ្មានឈ្មោះ';
    return (
      emp.name || emp.fullName || emp.employeeName || emp.khmerName || emp.khmer_name || emp.displayName || emp.staffName || emp.no || 'គ្មានឈ្មោះ'
    );
  };
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    newThisMonth: 0,
    stoppedThisMonth: 0,
    departments: 0
  });
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [departmentList, setDepartmentList] = useState([]);
  const [metricsExtra, setMetricsExtra] = useState({
    studyLeave: 0,
    vacancies: 0,
    retirements: 0,
    officerTypes: []
  });
  const [studyStatusCounts, setStudyStatusCounts] = useState({
    preparing: { total: 0, female: 0 },
    studying: { total: 0, female: 0 },
    returned: { total: 0, female: 0 },
    total: 0,
    femaleTotal: 0
  });
  const [vacancyCounts, setVacancyCounts] = useState({ total: 0, female: 0 });
  const [vacancyStatusCounts, setVacancyStatusCounts] = useState({
    preparing: { total: 0, female: 0 },
    ongoing: { total: 0, female: 0 },
    returned: { total: 0, female: 0 },
    total: 0,
    femaleTotal: 0
  });
  const [retirementCounts, setRetirementCounts] = useState({ total: 0, male: 0, female: 0, civil: { total: 0, female: 0 }, contract: { total: 0, female: 0 } });
  const [genderCounts, setGenderCounts] = useState({ male: 0, female: 0, other: 0 });
  const [genderBreakdowns, setGenderBreakdowns] = useState({
    total: { male: 0, female: 0, other: 0 },
    active: { male: 0, female: 0, other: 0 },
    newThisMonth: { male: 0, female: 0, other: 0 },
    stoppedThisMonth: { male: 0, female: 0, other: 0 },
    studyLeave: { male: 0, female: 0, other: 0 },
    vacancies: { male: 0, female: 0, other: 0 },
    retirements: { male: 0, female: 0, other: 0 }
  });
  const [workScheduleDaily, setWorkScheduleDaily] = useState({
    totalSchedules: 0,
    workingToday: 0,
    dayOffToday: 0,
    dayShift: 0,
    nightShift: 0,
    shift24Hours: 0
  });
  const [missingCounts, setMissingCounts] = useState({ phone: 0, position: 0, department: 0, image: 0, signature: 0 });
  const [missionToday, setMissionToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState({
    civil: { joined: 0, stopped: 0 },
    state: { joined: 0, stopped: 0 },
    hospital: { joined: 0, stopped: 0 },
    contract: { joined: 0, stopped: 0 }
  });

  useEffect(() => {
    fetchDashboardData();
  }, [canViewHR]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

  // Fetch HR/employee data (dashboard shows aggregated stats regardless of detailed HR view permission)
  let employees = [];
  try {
    const res = await HRAPI.getAll();
    employees = Array.isArray(res?.data) ? res.data : [];
  } catch (e) {
    // fallback to old employees endpoint if HR API not available
    try {
      const response = await employeeAPI.getEmployees({ limit: 100 });
      employees = (response?.data?.employees) || [];
    } catch (err) {
      employees = [];
    }
  }
  setAllEmployees(employees);

  // DEBUG: provide a breakdown of why some employees are excluded from active counts
  try {
    const explicitlyRemovedList = employees.filter(_isExplicitlyRemoved);
    const preparedList = employees.filter(emp => Boolean(emp.__isPreparedForDeletion));
    const activeStatusList = employees.filter(e => (e.status || '').toString().toLowerCase() === 'active');
    const nonActiveList = employees.filter(e => (e.status || '').toString().toLowerCase() !== 'active');
    console.debug('Dashboard debug breakdown', {
      total: employees.length,
      explicitlyRemoved: explicitlyRemovedList.length,
      preparedForDeletion: preparedList.length,
      activeByStatus: activeStatusList.length,
      nonActive: nonActiveList.length
    });
    console.debug('Dashboard samples: explicitlyRemoved', explicitlyRemovedList.slice(0,5).map(e => ({ _id: e._id, name: e.name, dateRemoved: e.dateRemoved || (e.delisted && (e.delisted.dateRemoved || e.delisted.date_removed)) || e.dateRemovedFromDataset || e.removalDate })));
  } catch (err) { console.debug('Dashboard debug breakdown failed', err); }
  // Calculate stats
  const totalEmployees = employees.length;
  // Exclude prepared-for-deletion or explicit removal from "active" counts
  const isExplicitlyRemoved = _isExplicitlyRemoved;
  // Build a canonical active list used across stats and breakdowns
  const isCountedActive = _isCountedActive;
  const activeList = employees.filter(isCountedActive);
  const activeEmployees = activeList.length;
  try {
    const excludedFromActive = employees.filter(e => !isCountedActive(e));
    console.debug('[Dashboard] excludedFromActive count:', excludedFromActive.length);
    console.debug('[Dashboard] excludedFromActive sample:', (excludedFromActive || []).slice(0, 20).map(e => ({ id: e._id || e.staffId || e.no, name: e.name || e.khmerName || '', status: e.status || '', explicitRemoved: _isExplicitlyRemoved(e), hasResignData: _hasResignData(e), preparedForDeletion: Boolean(e.__isPreparedForDeletion), dateRemoved: e.dateRemoved || (e.delisted && (e.delisted.dateRemoved || e.delisted.date_removed)) || e.dateRemovedFromDataset || e.removalDate, resignDate: e.resignDate || e.resignationDate || e.resignDocument })));
  } catch (err) { console.debug('Dashboard excludedFromActive debug failed', err); }
      
      // Get employees added this month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const newThisMonth = employees.filter(emp => {
        const raw = emp.joinDate || emp.civilServantStartDate || emp.dateJoinedMinistry;
        const joinDate = raw ? new Date(raw) : null;
        if (!joinDate || Number.isNaN(joinDate.getTime())) return false;
        return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
      }).length;

      // Employees stopped this month (resigned/removed)
      const khMonths = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
      const currentMonthNameKh = khMonths[currentMonth] || '';
      const normalizeText = (v) => {
        try { return String(v || '').replace(/\s+/g, ' ').trim(); } catch { return ''; }
      };
      const noteMatchesThisMonth = (note) => {
        const t = normalizeText(note);
        if (!t) return false;
        if (!currentMonthNameKh) return false;
        // tolerate: "ប្រចាំខែកុម្ភៈ", "ប្រចាំខែ កុម្ភៈ", or any text containing the month name
        return t.includes(currentMonthNameKh);
      };

      const getStoppedDate = (emp) => {
        try {
          const del = emp?.delisted || {};
          const raw =
            emp?.resignDate ||
            emp?.resignationDate ||
            emp?.dateRemoved ||
            emp?.dateRemovedFromDataset ||
            emp?.removalDate ||
            // official-delisted / nested delisted dates
            del?.dateDelisted ||
            del?.date_delisted ||
            del?.date ||
            del?.dateRemoved ||
            del?.date_removed;
          if (!raw) return null;
          const d = new Date(raw);
          if (!Number.isNaN(d.getTime())) return d;

          // Tolerate dd/mm/yyyy or dd-mm-yyyy
          const m = String(raw).trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
          if (!m) return null;
          const dd = Number(m[1]);
          const mm = Number(m[2]);
          const yyyy = Number(m[3]);
          const d2 = new Date(yyyy, mm - 1, dd);
          if (Number.isNaN(d2.getTime())) return null;
          if (d2.getFullYear() !== yyyy || d2.getMonth() !== (mm - 1) || d2.getDate() !== dd) return null;
          return d2;
        } catch {
          return null;
        }
      };

      const getMonthlyReportNote = (emp) => {
        try {
          const del = emp?.delisted || {};
          return (
            emp?.resignationOther ||
            emp?.otherReason ||
            emp?.additionalInfo ||
            emp?.remarks ||
            emp?.comments ||
            emp?.note ||
            del?.note ||
            del?.Note
          );
        } catch {
          return '';
        }
      };

      const stoppedThisMonthList = (employees || []).filter(emp => {
        if (!emp) return false;
        if (emp.__isPreparedForDeletion) return false;

        // Primary source: "ចូលរបាយការណ៍ខែ" (monthly report text)
        const note = getMonthlyReportNote(emp);
        if (noteMatchesThisMonth(note)) return true;

        // Fallback: stop-date within this month
        const stoppedDate = getStoppedDate(emp);
        if (!stoppedDate) return false;
        return stoppedDate.getMonth() === currentMonth && stoppedDate.getFullYear() === currentYear;
      });
      const stoppedThisMonth = stoppedThisMonthList.length;
      
      // Get unique departments
  // Backend field for department in model is 'Department_Kh'
  const departments = [...new Set(employees.map(emp => emp.Department_Kh || emp.department || '').filter(Boolean))].length;

      setStats({
        totalEmployees,
        activeEmployees,
        newThisMonth,
        stoppedThisMonth,
        departments
      });

      // Get recent HR records (based on createdAt or joinDate)
      const recent = (employees || []).slice().sort((a, b) => {
        const ta = new Date(a.createdAt || a.joinDate || 0).getTime();
        const tb = new Date(b.createdAt || b.joinDate || 0).getTime();
        return tb - ta;
      }).slice(0, 5);
      setRecentEmployees(recent);

      // Try to fetch department meta from API, fall back to computed list
      // compute department list from HR records
      const map = {};
      employees.forEach(e => {
        const d = (e.Department_Kh || e.department || 'Unassigned') || 'Unassigned';
        map[d] = (map[d] || 0) + 1;
      });
      const computed = Object.keys(map).map(k => ({ name: k, count: map[k] }));
      setDepartmentList(computed.slice(0, 10));

      // Compute missing-data counts (phone, position, department, image, signature)
      try {
        const missingPhone = (employees || []).filter(e => {
          const p = e?.phone || e?.mobile || e?.phoneNumber || e?.telephone || e?.contact || e?.contactPhone || e?.contact_number;
          return !(p !== null && typeof p !== 'undefined' && String(p).trim() !== '');
        }).length;

        const missingPosition = (employees || []).filter(e => {
          const pos = e?.position || e?.civilServantRole || e?.officerType || e?.grade;
          return !(pos !== null && typeof pos !== 'undefined' && String(pos).trim() !== '');
        }).length;

        const missingDepartment = (employees || []).filter(e => {
          const d = e?.Department_Kh || e?.department || e?.departmentName;
          return !(d !== null && typeof d !== 'undefined' && String(d).trim() !== '');
        }).length;

        const missingImage = (employees || []).filter(e => {
          const img = e?.image || e?.photo || e?.avatar;
          return !(img !== null && typeof img !== 'undefined' && String(img).trim() !== '');
        }).length;

        const missingSignature = (employees || []).filter(e => {
          const s = e?.signature || e?.signatureFile || e?.signature_url || e?.signatureUrl || e?.signature_image || e?.sign;
          return !(s !== null && typeof s !== 'undefined' && String(s).trim() !== '');
        }).length;

        setMissingCounts({ phone: missingPhone, position: missingPosition, department: missingDepartment, image: missingImage, signature: missingSignature });
      } catch (err) { console.debug('Failed to compute missingCounts', err); }

      // Compute mission assignments for today (heuristic: look for mission/missions/assignments with date fields)
      try {
        const today = new Date(); today.setHours(0,0,0,0);
        const sameDay = (val) => {
          if (!val) return false;
          try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) { d.setHours(0,0,0,0); return d.getTime() === today.getTime(); }
            // try dd/mm/yyyy or d/m/yyyy
            const m = String(val).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (m) { const dd = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])); dd.setHours(0,0,0,0); return dd.getTime() === today.getTime(); }
            // try yyyy-mm-dd
            const m2 = String(val).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m2) { const dd = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])); dd.setHours(0,0,0,0); return dd.getTime() === today.getTime(); }
          } catch (e) { return false; }
          return false;
        };

        const extractDatesFromObj = (obj) => {
          if (!obj) return [];
          const dates = [];
          const keys = ['date','missionDate','startDate','assignedDate','dateAssigned','date_from','date_to','start'];
          keys.forEach(k => { if (obj[k]) dates.push(obj[k]); });
          return dates;
        };

        const hasMissionToday = (emp) => {
          if (!emp) return false;
          const check = (v) => {
            if (!v) return false;
            if (Array.isArray(v)) return v.some(item => (typeof item === 'object') ? extractDatesFromObj(item).some(sameDay) : sameDay(item));
            if (typeof v === 'object') return extractDatesFromObj(v).some(sameDay);
            return sameDay(v);
          };

          if (check(emp.missions) || check(emp.mission) || check(emp.assignments) || check(emp.assignedMissions)) return true;
          // root-level date-like fields
          if (sameDay(emp.missionDate) || sameDay(emp.assignedDate) || sameDay(emp.dateAssigned)) return true;
          return false;
        };

        const todays = (employees || []).filter(hasMissionToday);

        // Also include assignments coming from the standalone Missions page (localStorage)
        try {
          const rawM = localStorage.getItem('missions.data.v1');
          const parsedM = rawM ? JSON.parse(rawM) : null;
          const missionsFromStorage = Array.isArray(parsedM) ? parsedM : [];
          const missionEntries = [];
          const existingNames = new Set((todays || []).map(e => (e.name || e.khmerName || '').toString().trim()).filter(Boolean));

          const splitParticipants = (txt) => {
            if (!txt) return [];
            // try splitting on newlines, commas, slashes, or numbered list markers
            return String(txt).split(/\r?\n|\,|\;|\/|\u2022|\(|\)|\d+\)\s*/).map(s => s.trim()).filter(Boolean);
          };

          const missionSameDay = (m) => {
            if (!m) return false;
            if (sameDay(m.date) || sameDay(m.letterDate) || sameDay(m.referenceDate) || sameDay(m.traditionalDate)) return true;
            return false;
          };

          (missionsFromStorage || []).forEach(m => {
            try {
              if (!missionSameDay(m)) return;
              // participants field may contain numbered list or comma-separated names
              const parts = splitParticipants(m.participants || m.assignTo || m.participant || '');
              if (parts.length === 0 && m.assignTo) parts.push(String(m.assignTo).trim());
              parts.forEach(p => {
                const name = p;
                if (!name) return;
                if (existingNames.has(name)) return;
                existingNames.add(name);
                missionEntries.push({ name, khmerName: '', position: '', Department_Kh: '', mission: { title: m.reference || m.location || m.reference || m.content || m.letterNo || '' } });
              });
            } catch (e) { /* ignore mission parse errors */ }
          });

          const combined = [...todays, ...missionEntries];
          setMissionToday((combined || []).slice(0, 50));
        } catch (e) {
          setMissionToday(todays.slice(0, 50));
        }
      } catch (err) { console.debug('Failed to compute missionToday', err); }

      // Extra metrics: study leave, vacancies, retirements, officer types
      const studyKeywords = ['សិក្សា','ស្រាវជ្រាវ','ហាត់ការងារ','បណ្ដុះបណ្ដាល','training','study','scholarship'];
      let studyArr = [];
      let vacancyArr = [];
      let retireArr = [];

      // Officer type breakdown should NOT count resigned/deleted employees.
      // Reuse the dashboard's active inclusion rule, and ignore any prepared-for-deletion placeholders.
      const officerTypeSource = (activeList || []).filter(e => !e?.__isPreparedForDeletion);
      const oMap = {};
      const oGenderMap = {};

      // Exclude resigned/removed/inactive or prepared-for-deletion employees from certain metric counts
      const isExcludedStatus = (s) => {
        if (!s) return false;
        // Only treat resigned statuses as excluded for these metrics
        return /resign|resigned|លាលែង|deleted|delete/i.test(String(s));
      };
      const metricEmployees = employees.filter(e => {
        if (isExcludedStatus(e.status)) return false;
        if (e.__isPreparedForDeletion) return false;
        if (isExplicitlyRemoved(e)) return false;
        return true;
      });

      // Debug: counts before/after filtering
      try { console.debug('Dashboard counts: total employees', employees.length, 'metricEmployees', metricEmployees.length); } catch (e) {}
      try { console.debug('[Dashboard] metricEmployees sample:', (metricEmployees || []).slice(0,10).map(e => ({ id: e._id || e.staffId || e.no, name: e.name || e.khmerName || '', gender: e.gender || '', reason: e.civilServantReason || e.reason || '' }))); } catch (e) {}

      const vacancyKeywords = ['ទំនេរ','ទំនេរគ្មានបៀវត្ស','unpaid','leave without pay','leave'];
      const hasUnpaidData = (hr) => {
        const u = hr && hr.unpaid ? hr.unpaid : null;
        if (!u) return false;
        try {
          return Object.keys(u).some(k => {
            const v = u[k];
            return v !== null && typeof v !== 'undefined' && String(v).trim() !== '';
          });
        } catch (e) { return false; }
      };

      metricEmployees.forEach(e => {
        const textFields = [e.civilServantReason, e.reason, e.other, e.workOther, e.civilServantRole, e.position].map(x => (x||'').toString().toLowerCase()).join(' ');
        // study leave heuristic
        if (studyKeywords.some(k => textFields.includes(k))) studyArr.push(e);
        // vacancy/unpaid heuristic: prefer explicit `unpaid` subdocument; fall back to previous heuristics
        if (hasUnpaidData(e) || !(e.staffId || e.no || '').toString().trim() || !(e.position || e.civilServantRole || '').toString().trim() || vacancyKeywords.some(k => textFields.includes(k))) vacancyArr.push(e);
        // retirement heuristic: look for 'retire' or Khmer 'និវត្ត' or 'ចូលនិវត្ត'
        if (/(retir|និវត្ត|ចូលនិវត្ត)/i.test(textFields)) retireArr.push(e);
      });

      // Officer type counts (include resigned/deleted)
      officerTypeSource.forEach(e => {
        const ot = (e.officerType || '').toString().trim() || 'Unspecified';
        oMap[ot] = (oMap[ot] || 0) + 1;
        const g = (e.gender || '').toString();
        const gKey = g === 'Male' || g === 'ប្រុស' ? 'male' : g === 'Female' || g === 'ស្រី' ? 'female' : 'other';
        oGenderMap[ot] = oGenderMap[ot] || { male: 0, female: 0, other: 0 };
        oGenderMap[ot][gKey] = (oGenderMap[ot][gKey] || 0) + 1;
      });
      const officerTypes = Object.keys(oMap).map(k => ({ type: k, count: oMap[k] })).sort((a,b) => b.count - a.count).slice(0,10);
      setMetricsExtra({ studyLeave: studyArr.length, vacancies: vacancyArr.length, retirements: retireArr.length, officerTypes });

      // Vacancy female counts
      const vacancyFemale = (vacancyArr || []).filter(e => {
        const g = (e.gender || '').toString();
        return (g === 'Female' || g === 'ស្រី');
      }).length;
      setVacancyCounts({ total: (vacancyArr || []).length, female: vacancyFemale });
      console.debug('[Dashboard] vacancyArr sample:', (vacancyArr || []).slice(0,10).map(e => ({ id: e._id || e.staffId || e.no, name: e.name || e.khmerName || '', gender: e.gender || '', reason: e.civilServantReason || e.reason || '' })));

      // Compute vacancy status breakdowns based on unpaid dates when available
      const parseDateSafe = (v) => {
        if (!v) return null;
        try { const d = new Date(v); if (isNaN(d.getTime())) return null; d.setHours(0,0,0,0); return d; } catch { return null; }
      };
      const daysBetween = (a, b) => { if (!a || !b) return null; return Math.round((b.getTime() - a.getTime())/(24*60*60*1000)); };
      const today = new Date(); today.setHours(0,0,0,0);

      const vCounts = { preparing: { total:0, female:0 }, ongoing: { total:0, female:0 }, returned: { total:0, female:0 } };
      (vacancyArr || []).forEach(e => {
        const unpaid = e.unpaid || e.unpaidLeave || e.leave || {};
        const start = parseDateSafe(unpaid.Start || unpaid.start || unpaid.startDate || unpaid.studyStart);
        const end = parseDateSafe(unpaid.End || unpaid.end || unpaid.endDate || unpaid.studyEnd);
        let status = 'returned';
        if (start && start > today) status = 'preparing';
        else if (start && (!end || (end && end >= today))) status = 'ongoing';
        else if (end && end < today) {
          const daysSinceEnd = daysBetween(end, today);
          // treat both recent end and long-end as returned
          status = 'returned';
        }
        const g = (e.gender || '').toString(); const isFemale = (g === 'Female' || g === 'ស្រី');
        if (!vCounts[status]) vCounts[status] = { total:0, female:0 };
        vCounts[status].total++;
        if (isFemale) vCounts[status].female++;
      });
      const totalVac = (vCounts.preparing.total||0) + (vCounts.ongoing.total||0) + (vCounts.returned.total||0);
      const femaleVac = (vCounts.preparing.female||0) + (vCounts.ongoing.female||0) + (vCounts.returned.female||0);
      setVacancyStatusCounts({ ...vCounts, total: totalVac, femaleTotal: femaleVac });
      console.debug('[Dashboard] vacancyStatusCounts:', { ...vCounts, total: totalVac, femaleTotal: femaleVac });

      // Compute study status counts (preparing, studying, returned) using study object when available
      const daysDiffFromTodayLocal = (dateLike) => {
        if (!dateLike) return '';
        const d = new Date(dateLike);
        if (isNaN(d.getTime())) return '';
        const today = new Date();
        const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.round((t1 - t0) / msPerDay);
      };

      const computeStudyStatusLocal = (stu) => {
        if (!stu) return null;
        try {
          const startDate = stu.studyStart || stu.startDate;
          const daysToStart = startDate ? daysDiffFromTodayLocal(startDate) : '';
          let validityDays = daysDiffFromTodayLocal(stu.studyEnd || stu.endDate);
          if (validityDays === '' || validityDays == null) {
            const v2 = stu.validity;
            if (v2 !== '' && v2 != null && !isNaN(Number(v2))) validityDays = Number(v2);
            else validityDays = null;
          }
          if (daysToStart !== '' && daysToStart > 0) return 'preparing';
          const nVal = (validityDays !== null && !isNaN(Number(validityDays))) ? Number(validityDays) : null;
          if (nVal !== null && nVal >= 1) return 'studying';
          // treat finished long ago or small negative as returned
          if (nVal !== null) return 'returned';
          return null;
        } catch (e) { return null; }
      };

      const studyCandidates = metricEmployees.filter(e => {
        const textFields = [e.civilServantReason, e.reason, e.other, e.workOther, e.civilServantRole, e.position].map(x => (x||'').toString().toLowerCase()).join(' ');
        const reasonMatches = studyKeywords.some(k => textFields.includes(k));
        const stu = (e.stu || e.study || {});
        const hasStudyData = Boolean(stu && (stu.studyStart || stu.startDate || stu.studyEnd || stu.endDate || stu.studySkill || stu.studyPlace || stu.validity));
        return reasonMatches || hasStudyData;
      });

      const studyCounts = { preparing: { total:0, female:0 }, studying: { total:0, female:0 }, returned: { total:0, female:0 } };
      studyCandidates.forEach(e => {
        const stu = (e.stu || e.study || {});
        const status = computeStudyStatusLocal(stu) || 'returned';
        const g = (e.gender || '').toString();
        const isFemale = (g === 'Female' || g === 'ស្រី');
        if (!studyCounts[status]) studyCounts[status] = { total:0, female:0 };
        studyCounts[status].total++;
        if (isFemale) studyCounts[status].female++;
      });
      const totalStudy = (studyCounts.preparing.total || 0) + (studyCounts.studying.total || 0) + (studyCounts.returned.total || 0);
      const femaleStudyTotal = (studyCounts.preparing.female || 0) + (studyCounts.studying.female || 0) + (studyCounts.returned.female || 0);
      setStudyStatusCounts({ ...studyCounts, total: totalStudy, femaleTotal: femaleStudyTotal });

      // Compute retirements for the current year using DOB + 60 years heuristic
      const computeRetirementDate = (dob) => {
        if (!dob) return null;
        try {
          const d = new Date(dob);
          if (isNaN(d.getTime())) return null;
          return new Date(d.getFullYear() + 60, d.getMonth(), d.getDate());
        } catch (e) { return null; }
      };
      const civilTokens = ['មន្ត្រីរាជការ', 'មន្រ្តីរាជការ', 'civil', 'civil servant', 'civilservice'];
      const contractTokens = ['កិច្ចសន្យា', 'contract', 'worker', 'កម្មករ', 'contractor', 'worker'];
      let rTotal = 0, rMale = 0, rFemale = 0;
      const rCivil = { total: 0, female: 0 };
      const rContract = { total: 0, female: 0 };
      (metricEmployees || []).forEach(e => {
        const rDate = computeRetirementDate(e.dob || e.DOB || e.birthDate || e.dateOfBirth);
        if (!rDate) return;
        if (rDate.getFullYear() !== currentYear) return;
        rTotal++;
        const g = (e.gender || '').toString();
        if (g === 'Male' || g === 'ប្រុស') rMale++; else if (g === 'Female' || g === 'ស្រី') rFemale++;
        // combine possible text fields to detect category
        const otRaw = [e.officerType, e.civilServantRole, e.position, e.grade, e.contractType, e.employmentType, e.officerCategory, e.type].filter(Boolean).join(' ');
        const ot = (otRaw || '').toString().toLowerCase();
        const isCivil = civilTokens.some(t => ot.includes(t.toString().toLowerCase()));
        const isContract = contractTokens.some(t => ot.includes(t.toString().toLowerCase()));
        if (isCivil) {
          rCivil.total++; if (g === 'Female' || g === 'ស្រី') rCivil.female++;
        } else if (isContract) {
          rContract.total++; if (g === 'Female' || g === 'ស្រី') rContract.female++;
        } else {
          // fallback: if officerType missing or ambiguous, try looking at other flags, else count as contract fallback
          if (!ot || ot.trim() === '') {
            rContract.total++; if (g === 'Female' || g === 'ស្រី') rContract.female++;
          } else {
            // ambiguous text: don't mis-classify; try a looser heuristic
            const looseCivil = /មន|រាជ|civil/i.test(ot);
            const looseContract = /កិច្ច|contract|worker|កម្មករ/i.test(ot);
            if (looseCivil) { rCivil.total++; if (g === 'Female' || g === 'ស្រី') rCivil.female++; }
            else if (looseContract) { rContract.total++; if (g === 'Female' || g === 'ស្រី') rContract.female++; }
          }
        }
      });
      setRetirementCounts({ total: rTotal, male: rMale, female: rFemale, civil: rCivil, contract: rContract });
      setMetricsExtra(prev => ({ ...prev, retirements: rTotal }));

      // Debug: log metric counts so we can inspect values in browser console
      try {
        console.debug('Dashboard metricsExtra computed:', { studyLeave: studyArr.length, vacancies: vacancyArr.length, retirements: retireArr.length, officerTypesCount: officerTypes.length });
      } catch (e) {}

      // build officer types detailed list with gender breakdowns
      const officerTypesDetailed = Object.keys(oMap).map(k => ({
        type: k,
        count: oMap[k],
        male: (oGenderMap[k] && oGenderMap[k].male) || 0,
        female: (oGenderMap[k] && oGenderMap[k].female) || 0,
        other: (oGenderMap[k] && oGenderMap[k].other) || 0
      })).sort((a,b) => b.count - a.count).slice(0, 10);
      setDepartmentList(computed.slice(0, 10));
      // stash officerTypesDetailed for UI
      setMetricsExtra(prev => ({ ...prev, officerTypesDetailed }));

  // Compute gender breakdown helper
      const countGender = (arr) => {
        const res = { male: 0, female: 0, other: 0 };
        (arr || []).forEach(x => {
          const g = (x.gender || '').toString();
          if (g === 'Male' || g === 'ប្រុស') res.male++;
          else if (g === 'Female' || g === 'ស្រី') res.female++;
          else res.other++;
        });
        return res;
      };

      const totalGender = countGender(employees);
      const activeGender = countGender(activeList);
      const newGender = countGender(employees.filter(emp => {
        const raw = emp.joinDate || emp.civilServantStartDate || emp.dateJoinedMinistry;
        const joinDate = raw ? new Date(raw) : null;
        if (!joinDate || Number.isNaN(joinDate.getTime())) return false;
        return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
      }));
      const stoppedThisMonthGender = countGender(stoppedThisMonthList);
      const studyGender = countGender(studyArr);
      const vacancyGender = countGender(vacancyArr);
      const retireGender = countGender(retireArr);

      setGenderBreakdowns({
        total: totalGender,
        active: activeGender,
        newThisMonth: newGender,
        stoppedThisMonth: stoppedThisMonthGender,
        studyLeave: studyGender,
        vacancies: vacancyGender,
        retirements: retireGender
      });

      try {
        console.debug('Dashboard genderBreakdowns:', { totalGender, activeGender, newGender, studyGender, vacancyGender, retireGender });
      } catch (e) {}

      // Category counts: map officerType or other flags to categories
      const isJoinedThisMonth = (emp) => {
        const raw = emp.joinDate || emp.civilServantStartDate || emp.dateJoinedMinistry;
        const joinDate = raw ? new Date(raw) : null;
        if (!joinDate || Number.isNaN(joinDate.getTime())) return false;
        return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
      };

      const catMap = {
        civil: ['មន្ត្រីរាជការ','Civil','civil'],
        state: ['កិច្ចសន្យារដ្ឋ','State','state'],
        hospital: ['កិច្ចសន្យាមន្ទីរពេទ្យ','hospital','hospitalPlus'],
        contract: ['កិច្ចសន្យា','contract','កម្មករកិច្ចសន្យា','WORKER']
      };

      const counts = { civil: { joined:0, stopped:0 }, state: { joined:0, stopped:0 }, hospital: { joined:0, stopped:0 }, contract: { joined:0, stopped:0 } };
      employees.forEach(emp => {
        const ot = (emp.officerType || emp.officerType || '').toString();
        const status = (emp.status || '').toString().toLowerCase();
        const isStopped = status !== 'active' && status !== 'active'; // treat non-active as stopped
        // check which category
        for (const key of Object.keys(catMap)) {
          const matches = catMap[key].some(token => (ot || '').toString().toLowerCase().includes(token.toString().toLowerCase()) || (emp.officerType || '').toString().toLowerCase() === token.toString().toLowerCase());
          if (matches) {
            if (isJoinedThisMonth(emp)) counts[key].joined++;
            if (isStopped) counts[key].stopped++;
            break;
          }
        }
      });
      setCategoryCounts(counts);

      // Daily work-schedule stats (today)
      try {
        const now0 = new Date();
        const start = new Date(now0); start.setHours(0, 0, 0, 0);
        const end = new Date(now0); end.setHours(23, 59, 59, 999);
        const { data } = await api.get('/work-schedules', {
          params: { startDate: start.toISOString(), endDate: end.toISOString() }
        });
        const todays = Array.isArray(data) ? data : [];

        const daily = {
          totalSchedules: todays.length,
          workingToday: 0,
          dayOffToday: 0,
          dayShift: 0,
          nightShift: 0,
          shift24Hours: 0
        };

        todays.forEach(s => {
          const title = (s?.shiftTitle || '').toString();
          if (title === 'Day Off') {
            daily.dayOffToday++;
            return;
          }
          if (!s?.shiftStart || !s?.shiftEnd) return;
          daily.workingToday++;
          try {
            const startParts = String(s.shiftStart).split(':');
            const endParts = String(s.shiftEnd).split(':');
            const startHour = parseInt(startParts[0], 10);
            const endHour = parseInt(endParts[0], 10);
            if (Number.isNaN(startHour) || Number.isNaN(endHour)) {
              daily.dayShift++;
              return;
            }
            // Day shift: AM → PM
            if (startHour < 12 && endHour >= 12) daily.dayShift++;
            // Night shift: PM → AM
            else if (startHour >= 12 && endHour < 12) daily.nightShift++;
            // 24-hour shift: AM → AM (>= 20h)
            else if (startHour < 12 && endHour < 12) {
              const startMinutes = startHour * 60 + parseInt(startParts[1] || 0, 10);
              const endMinutes = endHour * 60 + parseInt(endParts[1] || 0, 10);
              let duration = endMinutes - startMinutes;
              if (duration <= 0) duration += 24 * 60;
              if (duration >= 20 * 60) daily.shift24Hours++;
              else daily.dayShift++;
            }
            // PM → PM (count as day shift)
            else if (startHour >= 12 && endHour >= 12) daily.dayShift++;
            else daily.dayShift++;
          } catch (e) {
            daily.dayShift++;
          }
        });

        setWorkScheduleDaily(daily);
      } catch (err) {
        setWorkScheduleDaily({ totalSchedules: 0, workingToday: 0, dayOffToday: 0, dayShift: 0, nightShift: 0, shift24Hours: 0 });
      }

      // Fetch server-side gender stats if available; fall back to computed totals
      try {
        const gRes = await HRAPI.getGenderStats();
        const g = gRes?.data || {};
        setGenderCounts({ male: g.male || totalGender.male || 0, female: g.female || totalGender.female || 0, other: g.other || totalGender.other || 0 });
      } catch (err) {
        // fallback to computed gender totals
        setGenderCounts(totalGender);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Export helpers
  const download = (filename, content, mime = 'text/csv') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toCSV = (arr) => {
    if (!arr || arr.length === 0) return '';
    const keys = Object.keys(arr[0]);
    const rows = [keys.join(',')];
    for (const item of arr) {
      rows.push(keys.map(k => `"${(item[k] ?? '').toString().replace(/"/g, '""')}"`).join(','));
    }
    return rows.join('\n');
  };

  const exportEmployees = (format = 'csv') => {
    const data = allEmployees;
    if (!data || data.length === 0) return;
    if (format === 'json') {
      download('employees.json', JSON.stringify(data, null, 2), 'application/json');
    } else {
      download('employees.csv', toCSV(data), 'text/csv');
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, change, meta, compact = false, onClick }) => {
    const baseCls = `bg-white rounded-lg border border-gray-200 ${compact ? 'p-3' : 'p-6'} hover:shadow-md transition-shadow`;
    const cursor = onClick ? 'cursor-pointer hover:bg-gray-50' : '';
    return (
      <div className={`${baseCls} ${cursor}`} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyPress={onClick ? (e => { if (e.key === 'Enter') onClick(); }) : undefined}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", fontWeight: 700, fontSize: compact ? 12 : 14, margin: 0, color: '#1e3a8a' }}>{title}</p>
            <p className={`${compact ? 'text-sm' : 'text-font-size-12'} font-normal text-gray-900 mt-1`}>{value}</p>
            {change && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {change}
              </p>
            )}
            {meta && (
              <div className={`mt-2 text-xs text-gray-600 ${compact ? 'space-x-2' : 'space-x-3'}`}>
                {meta}
              </div>
            )}
          </div>
          <div className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-lg flex items-center justify-center ${color}`}>
            <Icon className={`${compact ? 'w-4 h-4' : 'w-6 h-6'} text-white`} />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
          <span className="ml-2 text-gray-600">កំពុងទាញយកទិន្នន័យ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ទំព័រដើម</h1>
                </div>
        <div className="flex items-center gap-2">
          {/* Export buttons removed per request */}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mb-2">
          {/* Replace total-employees card with active-employees as the primary metric */}
          <StatCard
            title="បុគ្គលិកសកម្ម"
            value={stats.activeEmployees}
            icon={UserPlus}
            color="bg-green-500"
            change="+8% ពីខែមុន"
            meta={(
              <>
                <span>បុរស: <strong className="text-gray-900">{genderBreakdowns.active.male}</strong></span>
                <span>ស្រី: <strong className="text-gray-900">{genderBreakdowns.active.female}</strong></span>
              </>
            )}
          />
          <StatCard
            title="បុគ្គលិកថ្មីខែនេះ"
            value={stats.newThisMonth}
            icon={Calendar}
            color="bg-orange-500"
            meta={(
              <>
                <span>បុរស: <strong className="text-gray-900">{genderBreakdowns.newThisMonth.male}</strong></span>
                <span>ស្រី: <strong className="text-gray-900">{genderBreakdowns.newThisMonth.female}</strong></span>
              </>
            )}
          />
          <StatCard
            title="បុគ្គលិកឈប់ខែនេះ"
            value={stats.stoppedThisMonth}
            icon={UserMinus}
            color="bg-rose-600"
            onClick={() => navigate('/official-delisted-report')}
            meta={(
              <>
                <span>បុរស: <strong className="text-gray-900">{genderBreakdowns.stoppedThisMonth.male}</strong></span>
                <span>ស្រី: <strong className="text-gray-900">{genderBreakdowns.stoppedThisMonth.female}</strong></span>
              </>
            )}
          />
          <StatCard
            title="ផ្នែកសរុប"
            value={stats.departments}
            icon={Award}
            color="bg-purple-500"
          />
        </div>

      {/* Extra Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 mb-2">
        <StatCard
          title="សិក្សា"
          value={studyStatusCounts.total}
          icon={Clock}
          compact={true}
          color="bg-indigo-600"
          onClick={() => navigate('/study-leave-report')}
          meta={(
            <>
              <div className="text-sm">
                <div>ត្រៀមទៅសិក្សា: <strong className="text-gray-900">{studyStatusCounts.preparing?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{studyStatusCounts.preparing?.female ?? 0}</strong></div>
                <div>កំពុងតែសិក្សា: <strong className="text-gray-900">{studyStatusCounts.studying?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{studyStatusCounts.studying?.female ?? 0}</strong></div>
                <div>ចូលបម្រើការងារវិញ: <strong className="text-gray-900">{studyStatusCounts.returned?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{studyStatusCounts.returned?.female ?? 0}</strong></div>
                <div className="mt-1">សរុប: <strong className="text-gray-900">{studyStatusCounts.total ?? 0}</strong>  •  ស្រីសរុប: <strong className="text-gray-900">{studyStatusCounts.femaleTotal ?? 0}</strong></div>
              </div>
            </>
          )}
        />
        <StatCard
          title="បុគ្គលិកទៅបេសកកម្ម (ថ្ងៃនេះ)"
          value={missionToday.length}
          icon={Users}
          compact={true}
          color="bg-emerald-600"
          onClick={() => navigate('/missions')}
          meta={(
            <>
              <div className="text-sm max-w-[220px] truncate">
                {(missionToday || []).slice(0,6).map((m, idx) => (
                  <div key={m._id || m.id || idx} className="truncate">{m.name || m.khmerName || 'គ្មានឈ្មោះ'}</div>
                ))}
                {(missionToday || []).length > 6 && <div className="text-xs text-gray-500">…</div>}
              </div>
            </>
          )}
        />
        <StatCard
          title="ទំនេរគ្មានបៀវត្ស"
          value={vacancyStatusCounts.total || vacancyCounts.total}
          icon={Users}
          compact={true}
          color="bg-red-500"
          onClick={() => navigate('/unpaid-leave-report')}
          meta={(
            <>
              <div className="text-sm">
                <div>ត្រៀមទំនេរ: <strong className="text-gray-900">{vacancyStatusCounts.preparing?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{vacancyStatusCounts.preparing?.female ?? 0}</strong></div>
                <div>កំពុងទំនេរ: <strong className="text-gray-900">{vacancyStatusCounts.ongoing?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{vacancyStatusCounts.ongoing?.female ?? 0}</strong></div>
                <div>ចូលបម្រើការងារវិញ: <strong className="text-gray-900">{vacancyStatusCounts.returned?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{vacancyStatusCounts.returned?.female ?? 0}</strong></div>
                <div className="mt-1">សរុប: <strong className="text-gray-900">{vacancyStatusCounts.total ?? vacancyCounts.total}</strong>  •  ស្រីសរុប: <strong className="text-gray-900">{vacancyStatusCounts.femaleTotal ?? vacancyCounts.female ?? 0}</strong></div>
              </div>
            </>
          )}
        />
        <StatCard
          title="មន្រ្តីចូលនិវត្ត"
          value={metricsExtra.retirements}
          icon={Award}
          compact={true}
          color="bg-yellow-500"
          onClick={() => navigate('/retirement-report')}
          meta={(
            <>
              <div className="text-sm">
                <div>សរុប: <strong className="text-gray-900">{retirementCounts.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{retirementCounts.female ?? 0}</strong></div>
                <div>មន្រ្តីរាជការ: <strong className="text-gray-900">{retirementCounts.civil?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{retirementCounts.civil?.female ?? 0}</strong></div>
                <div>កិច្ចសន្យា: <strong className="text-gray-900">{retirementCounts.contract?.total ?? 0}</strong>  •  ស្រី: <strong className="text-gray-900">{retirementCounts.contract?.female ?? 0}</strong></div>
              </div>
            </>
          )}
        />

        <StatCard
          title="Work Schedule (ថ្ងៃនេះ)"
          value={workScheduleDaily.workingToday}
          icon={CalendarDays}
          compact={true}
          color="bg-blue-600"
          onClick={() => navigate('/work-schedule')}
          meta={(
            <>
              <div className="text-sm">
                <div>វេនថ្ងៃ: <strong className="text-gray-900">{workScheduleDaily.dayShift ?? 0}</strong>  •  វេនល្ងាច: <strong className="text-gray-900">{workScheduleDaily.nightShift ?? 0}</strong></div>
                <div>វេន 24h: <strong className="text-gray-900">{workScheduleDaily.shift24Hours ?? 0}</strong>  •  Day Off: <strong className="text-gray-900">{workScheduleDaily.dayOffToday ?? 0}</strong></div>
              </div>
            </>
          )}
        />

        <StatCard
          title="ប្រតិទិនការងារ"
          value="មើល"
          icon={Calendar}
          compact={true}
          color="bg-sky-600"
          onClick={() => navigate('/work-calendar')}
          meta={(
            <>
              <div className="text-sm">
                <div>មើលកាលវិភាគ និងវេនការងារ</div>
              </div>
            </>
          )}
        />
        <div className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50" onClick={() => navigate('/employee-report?group=officertype')}>
          <p style={{ fontFamily: "'Khmer OS Siemreap', 'Noto Sans Khmer', sans-serif", fontWeight: 700, fontSize: 13, margin: 0, color: '#1e3a8a' }}>ប្រភេទមន្ត្រី</p>
          <div className="mt-2 space-y-2">
            {(metricsExtra.officerTypesDetailed || metricsExtra.officerTypes).map(o => (
              <div key={o.type} className="flex justify-between items-center text-sm">
                <div className="truncate max-w-[220px] text-gray-700"><a onClick={(e) => { e.stopPropagation(); navigate(`/employee-report?officerType=${encodeURIComponent(o.type)}`); }} className="text-gray-700 hover:underline">{o.type}</a></div>
                <div className="text-right text-sm">
                  <a onClick={(e) => { e.stopPropagation(); navigate(`/employee-report?officerType=${encodeURIComponent(o.type)}`); }} className="font-medium text-gray-900 hover:underline">{o.count ?? o.count} <span className="text-xs text-gray-500">នាក់</span></a>
                  {o.male !== undefined && (
                    <span className="text-xs text-gray-400 ml-3">ប: {o.male}  |  ស: {o.female ?? 0}</span>
                  )}
                </div>
              </div>
            ))}
            {metricsExtra.officerTypes.length === 0 && (
              <div className="text-gray-500">មិនមានទិន្នន័យ</div>
            )}

            
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Employees (hide details if user lacks HR view permission) */}
        {canViewHR ? (
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">របាយការណ៍បេសកកម្ម</h3>
              <p className="text-sm text-gray-600 mt-1">បុគ្គលិកដែលត្រូវទៅបេសកកម្មសម្រាប់ថ្ងៃ</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                        {missionToday.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 text-lg">មិនមានបុគ្គលិកដែលត្រូវទៅបេសកកម្មសម្រាប់ថ្ងៃនេះ</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full table-auto border-collapse">
                              <thead>
                                <tr className="bg-gray-50 text-left">
                                  <th className="px-3 py-2 text-sm text-gray-600">#</th>
                                  <th className="px-3 py-2 text-sm text-gray-600">ឈ្មោះ</th>
                                  <th className="px-3 py-2 text-sm text-gray-600">ឈ្មោះខ្មែរ</th>
                                  <th className="px-3 py-2 text-sm text-gray-600">មុខតំណែង</th>
                                  <th className="px-3 py-2 text-sm text-gray-600">ផ្នែក</th>
                                  <th className="px-3 py-2 text-sm text-gray-600">បេសកកម្ម</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(missionToday || []).map((employee, idx) => {
                                  const displayName = getEmployeeDisplayName(employee);
                                  const khmerName = employee.khmerName || employee.khmer_name || '';
                                  const position = employee.position || employee.officerType || '';
                                  const dept = employee.Department_Kh || employee.department || '';
                                  const missionTitle = employee.mission?.title || (Array.isArray(employee.missions) && employee.missions[0]?.title) || '';
                                  return (
                                    <tr key={employee._id || employee.id || displayName} className="border-t">
                                      <td className="px-3 py-2 text-sm text-gray-700 align-top">{idx + 1}</td>
                                      <td className="px-3 py-2 text-sm text-gray-900 align-top">{displayName}</td>
                                      <td className="px-3 py-2 text-sm text-gray-700 align-top">{khmerName}</td>
                                      <td className="px-3 py-2 text-sm text-gray-700 align-top">{position}</td>
                                      <td className="px-3 py-2 text-sm text-gray-700 align-top">{dept}</td>
                                      <td className="px-3 py-2 text-sm text-gray-700 align-top">{missionTitle}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="lg:col-span-2 p-6 bg-white rounded-lg border border-gray-200 text-sm text-gray-600">មិនមានសិទ្ធិមើលបុគ្គលិក</div>
        )}

        {/* Quick Actions */}
        <div>
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">សកម្មភាពរហ័ស</h3>
              <p className="text-sm text-gray-600 mt-1">ការងារទូទៅ</p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">បន្ថែមបុគ្គលិក</p>
                    <p className="text-sm text-gray-600">បន្ថែមបុគ្គលិកថ្មី</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-colors">
                  <Clock className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">វត្តមាន</p>
                    <p className="text-sm text-gray-600">គ្រប់គ្រងវត្តមាន</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 transition-colors">
                  <Award className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-gray-900">របាយការណ៍</p>
                    <p className="text-sm text-gray-600">មើលរបាយការណ៍</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Missing data overview */}
          <div className="bg-white rounded-lg border border-gray-200 mt-6">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">ទិន្នន័យខ្វះ</h3>
              <p className="text-sm text-gray-600 mt-1">បញ្ជីទិន្នន័យដែលគ្មាន</p>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                <button onClick={() => navigate('/employee-report?missing=phone')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-sm text-gray-700">ទំនាក់ទំនង (ទូរស័ព្ទ/ម៉ូបៃល៍) ខ្វះ</div>
                  <div className="text-sm font-medium text-gray-900">{missingCounts.phone ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=position')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-sm text-gray-700">មុខតំណែង / តួនាទី ខ្វះ</div>
                  <div className="text-sm font-medium text-gray-900">{missingCounts.position ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=department')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-sm text-gray-700">ផ្នែក ខ្វះ</div>
                  <div className="text-sm font-medium text-gray-900">{missingCounts.department ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=image')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-sm text-gray-700">រូបថត​(Image) ខ្វះ</div>
                  <div className="text-sm font-medium text-gray-900">{missingCounts.image ?? 0}</div>
                </button>

                <button onClick={() => navigate('/employee-report?missing=signature')} className="w-full flex items-center justify-between gap-3 p-3 text-left rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-sm text-gray-700">ហត្ថលេខា (Signature) ខ្វះ</div>
                  <div className="text-sm font-medium text-gray-900">{missingCounts.signature ?? 0}</div>
                </button>
              </div>
            </div>
          </div>

          {/* Department Overview */}
          <div className="bg-white rounded-lg border border-gray-200 mt-6">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">ផ្នែកនានា</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {departmentList.length === 0 ? (
                  <div className="text-gray-500">មិនមានផ្នែក</div>
                ) : (
                  departmentList.map((d, idx) => (
                    <div key={d.name || idx} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">{d.name}</span>
                      <span className="text-sm font-medium text-gray-900">{d.count ?? d.total ?? 0} នាក់</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          

          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
