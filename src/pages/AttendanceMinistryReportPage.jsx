import React, { useEffect, useMemo, useState } from 'react';
import headerBg from '../assets/3.JPG';
import api from '../services/api';
import * as XLSX from 'xlsx';

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, (d) => map[d]);
}

function fmtKhmerLongDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const khMonths = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ',
  ];
  const dd = toKhmerDigits(String(dt.getDate()));
  const mmName = khMonths[dt.getMonth()];
  const yyyy = toKhmerDigits(dt.getFullYear());
  return `ថ្ងៃទី ${dd} ខែ ${mmName} ឆ្នាំ ${yyyy}`;
}

function fmtKhmerMonthYear(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const khMonths = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ',
  ];
  const mmName = khMonths[dt.getMonth()];
  const yyyy = toKhmerDigits(dt.getFullYear());
  return `ប្រចាំខែ ${mmName} ឆ្នាំ ${yyyy}`;
}

function toLocalYmdString(input) {
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper functions to mirror HR row classification logic so that
// attendance absences can be mapped into the same ministry-report
// row codes (2.1, 2.1.1, 2.1.2, 3.1.1, 3.1.2, 3.1.3, 3.1.4, ...).
function normOfficerTypeMinistry(v) {
  if (!v) return '';
  try { return String(v).trim().toLowerCase(); } catch { return ''; }
}

function isStateTypeMinistry(v) {
  const n = normOfficerTypeMinistry(v);
  return n === 'កិច្ចសន្យារដ្ឋ' || n.includes('រដ្ឋ') || n.includes('state');
}

function isHospitalTypeMinistry(v) {
  const n = normOfficerTypeMinistry(v);
  return n === 'កិច្ចសន្យាមន្ទីរពេទ្យ' || n.includes('មន្ទីរពេទ្យ') || n.includes('hospital');
}

function isPartTimeTypeMinistry(v) {
  const n = normOfficerTypeMinistry(v);
  return n === 'កិច្ចសន្យាក្រៅម៉ោង' || n.includes('ក្រៅម៉ោង') || n.includes('part');
}

function isWorkerTypeMinistry(v) {
  const n = normOfficerTypeMinistry(v);
  return n === 'កម្មករកិច្ចសន្យា' || n.includes('កម្មករ') || n.includes('worker');
}

function buildHrTextForMinistry(h) {
  return [
    h?.civilServantReason,
    h?.reason,
    h?.other,
    h?.workOther,
    h?.civilServantRole,
    h?.position,
    h?.officerType,
  ]
    .map((x) => (x || '').toString().toLowerCase())
    .join(' ');
}

// Helpers to mirror unpaid-leave status logic so that we can
// count ongoing "ទំនេរគ្មានបៀវត្ស" staff for the ministry report.
function parseDateSafeUnpaid(v) {
  if (!v) return null;
  try {
    const dt = new Date(v);
    if (Number.isNaN(dt.getTime())) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  } catch {
    return null;
  }
}

function daysBetweenUnpaid(a, b) {
  if (!a || !b) return null;
  const diff = Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function computeUnpaidStatusLabel(unpaid) {
  const start = parseDateSafeUnpaid(unpaid && (unpaid.Start || unpaid.start));
  const end = parseDateSafeUnpaid(unpaid && (unpaid.End || unpaid.end));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let statusLabel = '';

  if (start && start > today) {
    statusLabel = 'ត្រៀមទំនេរគ្មានបៀវត្ស';
  } else if (start && (!end || (end && end >= today))) {
    statusLabel = 'កំពុងបន្តទំនេរគ្មានបៀវត្ស';
  } else if (end && end < today) {
    const daysSinceEnd = daysBetweenUnpaid(end, today);
    if (daysSinceEnd > 30) statusLabel = 'បញ្ចប់ទំនេរគ្មានបៀវត្សលើស១ខែ';
    else statusLabel = 'ចូលបម្រើការងារវិញ';
  }

  return statusLabel;
}

function computeOutOfCadreStatusLabel(outOfCadre) {
  const start = parseDateSafeUnpaid(outOfCadre && (outOfCadre.Start || outOfCadre.start));
  const end = parseDateSafeUnpaid(outOfCadre && (outOfCadre.End || outOfCadre.end));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let statusLabel = '';

  if (start && start > today) {
    statusLabel = 'ត្រៀមចេញក្រៅក្របខណ្ឌដើម';
  } else if (start && (!end || (end && end >= today))) {
    statusLabel = 'កំពុងបន្តក្រៅក្របខណ្ឌដើម';
  } else if (end && end < today) {
    statusLabel = 'បញ្ចប់ក្រៅក្របខណ្ឌដើម';
  }

  return statusLabel;
}

const initialRows = [
  { code: '2.1', label: 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '2.1.1', label: 'នាយក', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '2.1.2', label: 'នាយករង', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.1', label: 'ការិយាល័យរដ្ឋបាល និងបុគ្គលិក', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.1.1', label: 'ប្រធានការិយាល័យ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.1.2', label: 'អនុប្រធានការិយាល័យ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.1.3', label: 'មន្រ្តីក្របខណ្ឌ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.1.4', label: 'មន្ត្រីជាប់កិច្ចសន្យា', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.2', label: 'ការិយាល័យហិរញ្ញវត្ថុ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.2.1', label: 'ប្រធានការិយាល័យ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.2.2', label: 'អនុប្រធានការិយាល័យ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.2.3', label: 'មន្រ្តីក្របខណ្ឌ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.2.4', label: 'មន្ត្រីជាប់កិច្ចសន្យា', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.3', label: 'ការិយាល័យហិរញ្ញវត្ថុ (សេវា)', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.3.3', label: 'មន្រ្តីក្របខណ្ឌ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.3.4', label: 'មន្ត្រីជាប់កិច្ចសន្យា', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.4', label: 'ការិយាល័យបច្ចេកទេស', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.4.1', label: 'ប្រធានការិយាល័យ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.4.2', label: 'អនុប្រធានការិយាល័យ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.4.3', label: 'មន្រ្តីក្របខណ្ឌ', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
  { code: '3.4.4', label: 'មន្ត្រីជាប់កិច្ចសន្យា', civilTotal: '', civilFemale: '', contractTotal: '', contractFemale: '', absentMale: '', absentFemale: '', noSalaryMale: '', noSalaryFemale: '', outOfCadreMale: '', outOfCadreFemale: '', other: '' },
];

export default function AttendanceMinistryReportPage() {
  const today = new Date().toISOString().slice(0, 7); // YYYY-MM for month input
  const [reportDate, setReportDate] = useState(today);
  const [unitName, setUnitName] = useState('');
  const [rows, setRows] = useState(initialRows);
  const [showDetails, setShowDetails] = useState(false);
  const [staffWithIssues, setStaffWithIssues] = useState([]);

  const exportToExcel = () => {
    if (staffWithIssues.length === 0) return;

    const data = staffWithIssues.map((st, i) => ({
      'ល.រ': i + 1,
      'គោត្តនាម និងនាម': st.name,
      'អត្តលេខ': st.id,
      'ភេទ': st.gender,
      'ប្រភេទមន្រ្តី': st.officerType,
      'ផ្នែក': st.dept,
      'ក្រុមរាយការណ៍': st.mCode,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DetailedAttendance');
    XLSX.writeFile(wb, `Attendance_Details_${reportDate}.xlsx`);
  };

  const handlePrintList = () => {
    window.print();
  };


  const handleYearShift = (delta) => {
    setReportDate((prev) => {
      const base = (prev && prev.length >= 7) ? prev : today;
      const [y, m] = base.split('-');
      const yearNum = Number.parseInt(y, 10) || new Date().getFullYear();
      const monthPart = (m && m.length === 2) ? m : '01';
      const newYear = yearNum + delta;
      const safeYear = Number.isFinite(newYear) ? newYear : yearNum;
      return `${String(safeYear).padStart(4, '0')}-${monthPart}`;
    });
  };

  const totals = useMemo(() => {
    const sum = {
      civilTotal: 0,
      civilFemale: 0,
      contractTotal: 0,
      contractFemale: 0,
      absentMale: 0,
      absentFemale: 0,
      noSalaryMale: 0,
      noSalaryFemale: 0,
      outOfCadreMale: 0,
      outOfCadreFemale: 0,
    };

    rows.forEach((r) => {
      const code = (r.code || '').toString();
      // Only aggregate top-level rows like 2.1, 3.1, 3.2, 3.3, 3.4
      // Skip detail rows (eg 2.1.1, 3.1.3, 3.1.4) to avoid double-counting.
      if (code && code.split('.').length > 2) return;

      sum.civilTotal += Number(r.civilTotal) || 0;
      sum.civilFemale += Number(r.civilFemale) || 0;
      sum.contractTotal += Number(r.contractTotal) || 0;
      sum.contractFemale += Number(r.contractFemale) || 0;
      sum.absentMale += Number(r.absentMale) || 0;
      sum.absentFemale += Number(r.absentFemale) || 0;
      sum.noSalaryMale += Number(r.noSalaryMale) || 0;
      sum.noSalaryFemale += Number(r.noSalaryFemale) || 0;
      sum.outOfCadreMale += Number(r.outOfCadreMale) || 0;
      sum.outOfCadreFemale += Number(r.outOfCadreFemale) || 0;
    });
    return sum;
  }, [rows]);

  const handleCellChange = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const handlePrint = () => {
    window.print();
  };

  // Load active HR stats by Department_Kh and prefill counts
  useEffect(() => {
    let isCancelled = false;
    const loadStats = async () => {
      try {
        const [year, month] = (reportDate || '').split('-');
        const params = (year && month) ? { year, month } : undefined;
        const res = await api.get('/hr/stats/ministry-report', { params });
        const data = res.data || {};
        const deptList = Array.isArray(data) ? data : Array.isArray(data.departments) ? data.departments : [];
        const roleList = Array.isArray(data.roles) ? data.roles : [];
        const rowStatsList = Array.isArray(data.rows) ? data.rows : [];

        const byDept = {};
        deptList.forEach((r) => {
          const name = (r.departmentKh || '').toString().trim();
          if (!name) return;
          byDept[name] = r;
        });

        const byRole = {};
        roleList.forEach((r) => {
          const name = (r.roleLabel || '').toString().trim();
          if (!name) return;
          byRole[name] = r;
        });

        const byRowCode = {};
        rowStatsList.forEach((r) => {
          const code = (r.code || r.rowCode || '').toString().trim();
          if (!code) return;
          byRowCode[code] = r;
        });

        if (isCancelled) return;
        const leaderRoleByCode = {
          '2.1.1': 'នាយក',
          '2.1.2': 'នាយករង',
        };

        setRows((prev) => prev.map((row) => {
          const label = (row.label || '').toString().trim();
          const deptRef = byDept[label];
          const roleKey = leaderRoleByCode[row.code];
          const roleRef = roleKey ? byRole[roleKey] : null;
          const rowRef = byRowCode[row.code];

          let base = row;

          if (deptRef) {
            base = {
              ...base,
              civilTotal: deptRef.civilTotal || '',
              civilFemale: deptRef.civilFemale || '',
              contractTotal: deptRef.contractTotal || '',
              contractFemale: deptRef.contractFemale || '',
            };
          }

          if (roleRef) {
            base = {
              ...base,
              civilTotal: roleRef.civilTotal || '',
              civilFemale: roleRef.civilFemale || '',
              contractTotal: roleRef.contractTotal || '',
              contractFemale: roleRef.contractFemale || '',
            };
          }

          if (rowRef) {
            base = {
              ...base,
              civilTotal: rowRef.civilTotal || '',
              civilFemale: rowRef.civilFemale || '',
              contractTotal: rowRef.contractTotal || '',
              contractFemale: rowRef.contractFemale || '',
            };
          }

          return base;
        }));
      } catch (e) {
        console.error('Failed to load ministry HR stats', e);
      }
    };

    loadStats();
    return () => { isCancelled = true; };
  }, [reportDate]);

  // Load attendance summary (ចំនួនអវត្តមាន / ចំនួនអត់ច្បាប់) and
  // aggregate by department to prefill the "អវត្តមានប្រចាំខែ" columns
  useEffect(() => {
    let cancelled = false;

    const loadAttendance = async () => {
      try {
        const [yearStr, monthStr] = (reportDate || '').split('-');
        const year = Number.parseInt(yearStr, 10);
        const month = Number.parseInt(monthStr, 10);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return;

        // Business period: 22nd of previous month -> 21st of selected month
        const fromStr = toLocalYmdString(new Date(year, month - 2, 22));
        const toStr = toLocalYmdString(new Date(year, month - 1, 21));

        const [hrRes, summaryRes] = await Promise.all([
          api.get('/hr').catch(() => ({ data: [] })),
          api.get('/attendance/summary', { params: { year, month, from: fromStr, to: toStr } }).catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const hrList = Array.isArray(hrRes.data) ? hrRes.data : [];
        const hrByStaffId = new Map();
        hrList.forEach((h) => {
          const sid = (h.staffId || h.no || '').toString().trim();
          if (!sid) return;
          hrByStaffId.set(sid, h);
        });

        const rowsSummary = Array.isArray(summaryRes.data) ? summaryRes.data : [];
        const num = (v) => (typeof v === 'number' ? v : Number(v || 0) || 0);

        const deptTotals = new Map();
        const codeTotals = new Map();
        const noSalaryDeptTotals = new Map();
        const noSalaryCodeTotals = new Map();
        const outOfCadreDeptTotals = new Map();
        const outOfCadreCodeTotals = new Map();
        const issuesMap = new Map();

        rowsSummary.forEach((rec) => {
          const staffId = (rec.staffId || rec.no || '').toString().trim();
          if (!staffId) return;
          const hr = hrByStaffId.get(staffId) || {};
          const deptName = (hr.Department_Kh || hr.department || '').toString().trim();
          if (!deptName) return;

          // Only count civil servants and state-contract officers,
          // same as main HR ministry report.
          const otRawTop = hr.officerType || '';
          const isStateTop = isStateTypeMinistry(otRawTop);
          const isHospTop = isHospitalTypeMinistry(otRawTop);
          const isPartTop = isPartTimeTypeMinistry(otRawTop);
          const isWorkerTop = isWorkerTypeMinistry(otRawTop);
          const isCivilTop = !isStateTop && !isHospTop && !isPartTop && !isWorkerTop;
          const isContractTop = isStateTop;
          if (!isCivilTop && !isContractTop) return;

          const gender = (hr.gender || '').toString();
          const isFemale = gender === 'Female' || gender === 'ស្រី' || gender === 'female';

          const absentCount = num(rec.absentCount);
          const unexcused = num(rec.A);

          const current = deptTotals.get(deptName) || { absentTotal: 0, unexcusedTotal: 0 };

          // Ministry report wants to count 1 per staff
          // if they have at least 1 day of absence / unexcused.
          if (absentCount >= 1) {
            current.absentTotal += 1;
          }
          if (unexcused >= 1) {
            current.unexcusedTotal += 1;
          }

          deptTotals.set(deptName, current);

          // Map this HR record into ministry-report row codes, using the
          // same department + position logic as the backend HR stats.
          const depLower = deptName.toLowerCase();
          const text = buildHrTextForMinistry(hr);
          const isLeadershipDept = depLower.includes('ថ្នាក់ដឹកនាំ');

          const codes = [];

          // Leadership department summary
          if (isLeadershipDept) {
            codes.push('2.1');
          }

          // Map Departments_Kh to office codes (3.1, 3.2, 3.3, 3.4)
          let deptCode = null;
          if (
            depLower.includes('រដ្ឋបាល') ||
            depLower.includes('បុគ្គលិក') ||
            depLower.includes('ជួសជុលថែទាំសម្ភារបរិក្ខារ') ||
            depLower.includes('ព័ត៌មានវិទ្យា')
          ) {
            deptCode = '3.1';
          } else if (depLower.includes('ហិរញ្ញវត្ថុ') && depLower.includes('សេវា')) {
            deptCode = '3.3';
          } else if (depLower.includes('ហិរញ្ញវត្ថុ')) {
            deptCode = '3.2';
          }

          if (!deptCode && !isLeadershipDept) {
            deptCode = '3.4';
          }

          if (deptCode) {
            codes.push(deptCode);
          }

          // Determine civil vs contract to split 3.x.3 / 3.x.4 rows
          const otRaw = hr.officerType || '';
          const isState = isStateTypeMinistry(otRaw);
          const isHosp = isHospitalTypeMinistry(otRaw);
          const isPart = isPartTimeTypeMinistry(otRaw);
          const isWorker = isWorkerTypeMinistry(otRaw);
          const isCivil = !isState && !isHosp && !isPart && !isWorker;
          const isContract = isState;

          if (deptCode) {
            const posLower = text;
            let subCode = null;
            // Match deputy head first so "អនុប្រធាន" does not
            // fall into the generic "ប្រធាន" condition.
            if (posLower.includes('អនុប្រធានការិយាល័យ')) {
              subCode = `${deptCode}.2`;
            } else if (posLower.includes('ប្រធានការិយាល័យ')) {
              subCode = `${deptCode}.1`;
            } else if (isCivil) {
              subCode = `${deptCode}.3`;
            } else if (isContract) {
              subCode = `${deptCode}.4`;
            }
            if (subCode) codes.push(subCode);
          }

          // Leadership by role (director / deputy director) for hospital
          const lowerText = `${deptName} ${text}`.toLowerCase();
          if (lowerText.includes('នាយករង') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
            codes.push('2.1.2');
          } else if (lowerText.includes('នាយក') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
            codes.push('2.1.1');
          }

          const uniqueCodes = Array.from(new Set(codes));
          uniqueCodes.forEach((code) => {
            if (!code) return;
            const entry = codeTotals.get(code) || { absentTotal: 0, unexcusedTotal: 0 };
            if (absentCount >= 1) {
              entry.absentTotal += 1;
            }
            if (unexcused >= 1) {
              entry.unexcusedTotal += 1;
            }
            codeTotals.set(code, entry);
          });

          // ADD TO ISSUES LIST
          if (absentCount >= 1 || unexcused >= 1) {
            const genderRaw = (hr.gender || '').toString();
            const genderKh = (genderRaw === 'Female' || genderRaw === 'ស្រី' || genderRaw === 'female') ? 'ស' : 'ប';

            issuesMap.set(staffId, {
              id: staffId,
              name: hr.khmerName || hr.fullname || hr.name || hr.name_en,
              gender: genderKh,
              dept: deptName,
              pos: hr.position || '',
              mCode: deptCode || (isLeadershipDept ? '2.1' : ''),
              absent: absentCount,
              unexcused: unexcused,
              isUnpaid: false,
              isOutOfCadre: false,
              officerType: hr.officerType || ''
            });
          }
        });

        // Compute ongoing unpaid-leave (ទំនេរគ្មានបៀវត្ស) counts
        // from HR records themselves, reusing the same row-code
        // mapping as above.
        hrList.forEach((hr) => {
          const deptName = (hr.Department_Kh || hr.department || '').toString().trim();
          if (!deptName) return;

          const statusLabel = computeUnpaidStatusLabel(hr.unpaid || {});
          if (!statusLabel || !statusLabel.includes('កំពុងបន្តទំនេរគ្មានបៀវត្ស')) return;

          // Only count civil servants and state-contract officers
          const otRaw = hr.officerType || '';
          const isState = isStateTypeMinistry(otRaw);
          const isHosp = isHospitalTypeMinistry(otRaw);
          const isPart = isPartTimeTypeMinistry(otRaw);
          const isWorker = isWorkerTypeMinistry(otRaw);
          const isCivil = !isState && !isHosp && !isPart && !isWorker;
          const isContract = isState;
          if (!isCivil && !isContract) return;

          const gender = (hr.gender || '').toString();
          const isFemale = gender === 'Female' || gender === 'ស្រី' || gender === 'female';

          const depLower = deptName.toLowerCase();
          const text = buildHrTextForMinistry(hr);
          const isLeadershipDept = depLower.includes('ថ្នាក់ដឹកនាំ');

          const codes = [];

          if (isLeadershipDept) {
            codes.push('2.1');
          }

          let deptCode = null;
          if (
            depLower.includes('រដ្ឋបាល') ||
            depLower.includes('បុគ្គលិក') ||
            depLower.includes('ជួសជុលថែទាំសម្ភារបរិក្ខារ') ||
            depLower.includes('ព័ត៌មានវិទ្យា')
          ) {
            deptCode = '3.1';
          } else if (depLower.includes('ហិរញ្ញវត្ថុ') && depLower.includes('សេវា')) {
            deptCode = '3.3';
          } else if (depLower.includes('ហិរញ្ញវត្ថុ')) {
            deptCode = '3.2';
          }

          if (!deptCode && !isLeadershipDept) {
            deptCode = '3.4';
          }

          if (deptCode) {
            codes.push(deptCode);
          }

          if (deptCode) {
            const posLower = text;
            let subCode = null;
            if (posLower.includes('អនុប្រធានការិយាល័យ')) {
              subCode = `${deptCode}.2`;
            } else if (posLower.includes('ប្រធានការិយាល័យ')) {
              subCode = `${deptCode}.1`;
            } else if (isCivil) {
              subCode = `${deptCode}.3`;
            } else if (isContract) {
              subCode = `${deptCode}.4`;
            }
            if (subCode) codes.push(subCode);
          }

          const lowerText = `${deptName} ${text}`.toLowerCase();
          if (lowerText.includes('នាយករង') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
            codes.push('2.1.2');
          } else if (lowerText.includes('នាយក') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
            codes.push('2.1.1');
          }

          // Department-level totals
          const deptEntry = noSalaryDeptTotals.get(deptName) || { total: 0, female: 0 };
          deptEntry.total += 1;
          if (isFemale) deptEntry.female += 1;
          noSalaryDeptTotals.set(deptName, deptEntry);

          // Row-code-level totals
          const uniqueCodesUnpaid = Array.from(new Set(codes));
          uniqueCodesUnpaid.forEach((code) => {
            if (!code) return;
            const entry = noSalaryCodeTotals.get(code) || { total: 0, female: 0 };
            entry.total += 1;
            if (isFemale) entry.female += 1;
            noSalaryCodeTotals.set(code, entry);
          });

          // ADD TO ISSUES LIST
          const sid = (hr.staffId || hr.no || '').toString().trim();
          const existing = issuesMap.get(sid);
          if (existing) {
            existing.isUnpaid = true;
          } else {
            const genderRaw = (hr.gender || '').toString();
            const genderKh = (genderRaw === 'Female' || genderRaw === 'ស្រី' || genderRaw === 'female') ? 'ស' : 'ប';

            issuesMap.set(sid, {
              id: sid,
              name: hr.khmerName || hr.fullname || hr.name || hr.name_en,
              gender: genderKh,
              dept: deptName,
              pos: hr.position || '',
              mCode: deptCode || (isLeadershipDept ? '2.1' : ''),
              absent: 0,
              unexcused: 0,
              isUnpaid: true,
              isOutOfCadre: false,
              officerType: hr.officerType || ''
            });
          }
        });

        // Compute ongoing out of cadre (ក្រៅក្របខណ្ឌដើម) counts
        hrList.forEach((hr) => {
          const deptName = (hr.Department_Kh || hr.department || '').toString().trim();
          if (!deptName) return;

          const statusLabel = computeOutOfCadreStatusLabel(hr.outOfCadre || {});
          if (!statusLabel || !statusLabel.includes('កំពុងបន្តក្រៅក្របខណ្ឌដើម')) return;

          const otRaw = hr.officerType || '';
          const isState = isStateTypeMinistry(otRaw);
          const isHosp = isHospitalTypeMinistry(otRaw);
          const isPart = isPartTimeTypeMinistry(otRaw);
          const isWorker = isWorkerTypeMinistry(otRaw);
          const isCivil = !isState && !isHosp && !isPart && !isWorker;
          const isContract = isState;
          if (!isCivil && !isContract) return;

          const gender = (hr.gender || '').toString();
          const isFemale = gender === 'Female' || gender === 'ស្រី' || gender === 'female';

          const depLower = deptName.toLowerCase();
          const text = buildHrTextForMinistry(hr);
          const isLeadershipDept = depLower.includes('ថ្នាក់ដឹកនាំ');

          const codes = [];

          if (isLeadershipDept) {
            codes.push('2.1');
          }

          let deptCode = null;
          if (
            depLower.includes('រដ្ឋបាល') ||
            depLower.includes('បុគ្គលិក') ||
            depLower.includes('ជួសជុលថែទាំសម្ភារបរិក្ខារ') ||
            depLower.includes('ព័ត៌មានវិទ្យា')
          ) {
            deptCode = '3.1';
          } else if (depLower.includes('ហិរញ្ញវត្ថុ') && depLower.includes('សេវា')) {
            deptCode = '3.3';
          } else if (depLower.includes('ហិរញ្ញវត្ថុ')) {
            deptCode = '3.2';
          }

          if (!deptCode && !isLeadershipDept) {
            deptCode = '3.4';
          }

          if (deptCode) {
            codes.push(deptCode);
          }

          if (deptCode) {
            const posLower = text;
            let subCode = null;
            if (posLower.includes('អនុប្រធានការិយាល័យ')) {
              subCode = `${deptCode}.2`;
            } else if (posLower.includes('ប្រធានការិយាល័យ')) {
              subCode = `${deptCode}.1`;
            } else if (isCivil) {
              subCode = `${deptCode}.3`;
            } else if (isContract) {
              subCode = `${deptCode}.4`;
            }
            if (subCode) codes.push(subCode);
          }

          const lowerText = `${deptName} ${text}`.toLowerCase();
          if (lowerText.includes('នាយករង') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
            codes.push('2.1.2');
          } else if (lowerText.includes('នាយក') && (isLeadershipDept || lowerText.includes('មន្ទីរពេទ្យ'))) {
            codes.push('2.1.1');
          }

          const uniqueCodesOutOfCadre = Array.from(new Set(codes));
          uniqueCodesOutOfCadre.forEach((code) => {
            if (!code) return;
            const entry = outOfCadreCodeTotals.get(code) || { total: 0, female: 0 };
            entry.total += 1;
            if (isFemale) entry.female += 1;
            outOfCadreCodeTotals.set(code, entry);
          });
        });

        if (cancelled) return;

        // 1. Add people from attendance summary (Absent/Unauthorized)
        rowsSummary.forEach((rec) => {
          const sid = (rec.staffId || rec.no || '').toString().trim();
          if (!sid) return;
          const hr = hrByStaffId.get(sid);
          if (!hr) return;

          // Only count civil servants and state-contract officers
          const otRaw = hr.officerType || '';
          const isState = isStateTypeMinistry(otRaw);
          const isHosp = isHospitalTypeMinistry(otRaw);
          const isPart = isPartTimeTypeMinistry(otRaw);
          const isWorker = isWorkerTypeMinistry(otRaw);
          const isCivil = !isState && !isHosp && !isPart && !isWorker;
          const isContract = isState;
          if (!isCivil && !isContract) return;

          const absentCount = num(rec.absentCount);
          const unexcused = num(rec.A);
          if (absentCount < 1 && unexcused < 1) return;

          const depName = (hr.Department_Kh || hr.department || '').toString().trim();
          const depLower = depName.toLowerCase();
          const isLeadershipDept = depLower.includes('ថ្នាក់ដឹកនាំ');
          let mCode = isLeadershipDept ? '2.1' : '3.4';
          if (depLower.includes('រដ្ឋបាល') || depLower.includes('បុគ្គលិក') || depLower.includes('ជួសជុលថែទាំសម្ភារបរិក្ខារ') || depLower.includes('ព័ត៌មានវិទ្យា')) mCode = '3.1';
          else if (depLower.includes('ហិរញ្ញវត្ថុ') && depLower.includes('សេវា')) mCode = '3.3';
          else if (depLower.includes('ហិរញ្ញវត្ថុ')) mCode = '3.2';

          const genderRaw = (hr.gender || '').toString();
          const genderKh = (genderRaw === 'Female' || genderRaw === 'ស្រី' || genderRaw === 'female') ? 'ស' : 'ប';

          issuesMap.set(sid, {
            id: sid,
            name: hr.khmerName || hr.fullname || hr.name || hr.name_en,
            gender: genderKh,
            dept: depName,
            pos: hr.position || '',
            mCode,
            absent: absentCount,
            unexcused: unexcused,
            isUnpaid: false,
            isOutOfCadre: false,
            officerType: hr.officerType || ''
          });
        });

        // 2. Add/Update people from HR list (No Salary / Out of Cadre)
        hrList.forEach((hr) => {
          const sid = (hr.staffId || hr.no || '').toString().trim();
          if (!sid) return;

          const unpaidLabel = computeUnpaidStatusLabel(hr.unpaid || {});
          const outOfCadreLabel = computeOutOfCadreStatusLabel(hr.outOfCadre || {});
          const isUnpaid = unpaidLabel.includes('កំពុងបន្ត');
          const isOutOfCadre = outOfCadreLabel.includes('កំពុងបន្ត');

          if (!isUnpaid && !isOutOfCadre) return;

          // Only count civil servants and state-contract officers
          const otRaw = hr.officerType || '';
          const isState = isStateTypeMinistry(otRaw);
          const isHosp = isHospitalTypeMinistry(otRaw);
          const isPart = isPartTimeTypeMinistry(otRaw);
          const isWorker = isWorkerTypeMinistry(otRaw);
          const isCivil = !isState && !isHosp && !isPart && !isWorker;
          const isContract = isState;
          if (!isCivil && !isContract) return;

          const existing = issuesMap.get(sid);
          if (existing) {
            existing.isUnpaid = isUnpaid;
            existing.isOutOfCadre = isOutOfCadre;
          } else {
            const depName = (hr.Department_Kh || hr.department || '').toString().trim();
            const depLower = depName.toLowerCase();
            const isLeadershipDept = depLower.includes('ថ្នាក់ដឹកនាំ');
            let mCode = isLeadershipDept ? '2.1' : '3.4';
            if (depLower.includes('រដ្ឋបាល') || depLower.includes('បុគ្គលិក') || depLower.includes('ជួសជុលថែទាំសម្ភារបរិក្ខារ') || depLower.includes('ព័ត៌មានវិទ្យា')) mCode = '3.1';
            else if (depLower.includes('ហិរញ្ញវត្ថុ') && depLower.includes('សេវា')) mCode = '3.3';
            else if (depLower.includes('ហិរញ្ញវត្ថុ')) mCode = '3.2';

            const genderRaw = (hr.gender || '').toString();
            const genderKh = (genderRaw === 'Female' || genderRaw === 'ស្រី' || genderRaw === 'female') ? 'ស' : 'ប';

            issuesMap.set(sid, {
              id: sid,
              name: hr.khmerName || hr.fullname || hr.name || hr.name_en,
              gender: genderKh,
              dept: depName,
              pos: hr.position || '',
              mCode,
              absent: 0,
              unexcused: 0,
              isUnpaid,
              isOutOfCadre,
              officerType: hr.officerType || ''
            });
          }
        });

        setStaffWithIssues(Array.from(issuesMap.values()).sort((a, b) => (a.mCode || '').localeCompare(b.mCode || '')));

        setRows((prev) => prev.map((row) => {
          const label = (row.label || '').toString().trim();
          const code = (row.code || '').toString().trim();

          const codeStats = codeTotals.get(code);
          const noSalaryCode = noSalaryCodeTotals.get(code);
          const outOfCadreCode = outOfCadreCodeTotals.get(code);

          if (codeStats || noSalaryCode || outOfCadreCode) {
            const vAbsent = codeStats ? codeStats.absentTotal || '' : row.absentMale;
            const vAbsentFemale = codeStats ? codeStats.unexcusedTotal || '' : row.absentFemale;
            const vNoSalaryTotal = noSalaryCode ? noSalaryCode.total || '' : row.noSalaryMale;
            const vNoSalaryFemale = noSalaryCode ? noSalaryCode.female || '' : row.noSalaryFemale;
            const vOutOfCadreTotal = outOfCadreCode ? outOfCadreCode.total || '' : row.outOfCadreMale;
            const vOutOfCadreFemale = outOfCadreCode ? outOfCadreCode.female || '' : row.outOfCadreFemale;
            
            return {
              ...row,
              absentMale: vAbsent,
              absentFemale: vAbsentFemale,
              noSalaryMale: vNoSalaryTotal,
              noSalaryFemale: vNoSalaryFemale,
              outOfCadreMale: vOutOfCadreTotal,
              outOfCadreFemale: vOutOfCadreFemale,
            };
          }

          const stats = deptTotals.get(label);
          const noSalaryDept = noSalaryDeptTotals.get(label);
          const outOfCadreDept = outOfCadreDeptTotals.get(label);
          if (!stats && !noSalaryDept && !outOfCadreDept) return row;

          const vAbsent = stats ? stats.absentTotal || '' : row.absentMale;
          const vAbsentFemale = stats ? stats.unexcusedTotal || '' : row.absentFemale;
          const vNoSalaryTotal = noSalaryDept ? noSalaryDept.total || '' : row.noSalaryMale;
          const vNoSalaryFemale = noSalaryDept ? noSalaryDept.female || '' : row.noSalaryFemale;
          const vOutOfCadreTotal = outOfCadreDept ? outOfCadreDept.total || '' : row.outOfCadreMale;
          const vOutOfCadreFemale = outOfCadreDept ? outOfCadreDept.female || '' : row.outOfCadreFemale;

          return {
            ...row,
            absentMale: vAbsent,
            absentFemale: vAbsentFemale,
            noSalaryMale: vNoSalaryTotal,
            noSalaryFemale: vNoSalaryFemale,
            outOfCadreMale: vOutOfCadreTotal,
            outOfCadreFemale: vOutOfCadreFemale,
          };
        }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load attendance summary for ministry report', err);
      }
    };

    loadAttendance();
    return () => { cancelled = true; };
  }, [reportDate]);

  const inputStyle = {
    width: '100%',
    border: 'none',
    outline: 'none',
    textAlign: 'center',
    fontSize: '12px',
    padding: 0,
  };

  const inputTextStyle = {
    ...inputStyle,
    textAlign: 'left',
  };

  return (
    <div style={{ padding: '10px', fontFamily: '"Khmer OS Sereap", "Noto Sans Khmer", Arial, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>

      <div className="no-print" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div>
          <label style={{ marginRight: 8 }}>ប្រចាំខែឆ្នាំ:</label>
          <button
            type="button"
            onClick={() => handleYearShift(-1)}
            style={{ marginRight: 4, padding: '4px 8px', borderRadius: 999, border: '1px solid #d4d4d4', background: '#f9fafb', cursor: 'pointer', fontSize: '11px' }}
          >
            ឆ្នាំមុន
          </button>
          <input
            type="month"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          />
          <button
            type="button"
            onClick={() => handleYearShift(1)}
            style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 999, border: '1px solid #d4d4d4', background: '#f9fafb', cursor: 'pointer', fontSize: '11px' }}
          >
            ឆ្នាំក្រោយ
          </button>
        </div>
        <div>
          <label style={{ marginRight: 8 }}>អង្គភាព/ផ្នែក:</label>
          <input
            type="text"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, minWidth: 260 }}
            placeholder="ឧ. ផ្នែកធនធានមនុស្ស"
          />
        </div>
        <button
          type="button"
          onClick={handlePrint}
          style={{
            padding: '6px 16px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 999,
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(37,99,235,0.25)',
            fontWeight: 600,
          }}
        >
          បោះពុម្ព
        </button>
      </div>

      <div
        id="a4-page"
        style={{
          width: '210mm',
          minHeight: '297mm',
          maxWidth: '210mm',
          margin: '0 auto',
          background: 'white',
          boxSizing: 'border-box',
          padding: '5mm',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="mb-2 flex justify-between items-start w-full" style={{ position: 'relative', marginBottom: '12px' }}>
          {/* Left ministry block */}
          <div style={{ minWidth: '220px', marginRight: '8px', marginTop: '45px', textAlign: 'left' }}>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '15px', marginBottom: '4px' }}>ក្រសួងសុខាភិបាល</div>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '14px', marginBottom: '4px' }}>មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
            <div style={{ fontFamily: 'Khmer OS Seamreap', fontSize: '13px', fontWeight: 'bold' }}>លេខៈ {unitName || '...........................ម.ម.ខ.ស'}</div>
          </div>

          {/* Center logo + title */}
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center', margin: 0, fontFamily: 'Khmer OS Muol Light', top: '8px', zIndex: 2 }}>
            <div style={{ fontSize: '17px', padding: '5px 0' }}>ព្រះរាជាណាចក្រកម្ពុជា</div>
            <div style={{ fontSize: '16px' }}>ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
            <div style={{ position: 'relative', textAlign: 'left', padding: '10px 0' }}>
              <img
                src={headerBg}
                alt=""
                aria-hidden="true"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150px', height: 'auto', opacity: 0.88, pointerEvents: 'none' }}
              />
            </div>
            <div style={{ fontSize: '14px', marginTop: '30px' }}>តារាង២.សម្រង់ព័ត៌មានស្ដីពី
              <p>ស្ថានភាពមន្រ្តីរាជការស៊ីវិល និងមន្រ្តីជាប់កិច្ចសន្យា</p>
</div>
            <div style={{ fontSize: '13px', marginTop: '10px', fontFamily: 'Khmer OS Content' }}>
              {fmtKhmerMonthYear(reportDate)}
            </div>
          </div>

          {/* Right small number */}
          <div className="text-right w-16" style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '14px', marginTop: '18px' }}></div>
        </div>

        {/* Table */}
        <div style={{ width: '100%', marginTop: '18mm' }}>
          <table
            className="border border-black text-center text-sm"
            style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '210mm', margin: '0 auto', fontSize: '11px' }}
          >
            <thead>
              {/* Row 1 */}
              <tr>
                <th rowSpan={3} style={{ border: '1px solid black', padding: '4px', width: '10mm' }}>ល.រ</th>
                <th rowSpan={3} style={{ border: '1px solid black', padding: '4px', width: '70mm' }}>អង្គភាពតាមរចនាសម្ព័ន្ឋ</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>ចំនួន</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>ចំនួន</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>អវត្តមានប្រចាំខែ</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>ទំនេរគ្មានបៀវត្ស</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>ក្រៅក្របខណ្ឌដើម</th>
                <th rowSpan={3} style={{ border: '1px solid black', padding: '4px', width: '25mm' }}>ផ្សេងៗ</th>
              </tr>

              {/* Row 2 */}
              <tr>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>មន្រ្តីរាជការ</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>មន្រ្តីជាប់កិច្ចសន្យា</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>(ចំនួននាក់)</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>(ចំនួននាក់)</th>
                <th colSpan={2} style={{ border: '1px solid black', padding: '4px' }}>(ចំនួននាក់)</th>
              </tr>

              {/* Row 3 */}
              <tr>
                <th style={{ border: '1px solid black', padding: '4px', width: '12mm' }}>សរុប</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '10mm' }}>ស្រី</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '12mm' }}>សរុប</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '10mm' }}>ស្រី</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '12mm' }}>សរុប</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '12mm' }}>អត់ច្បាប់</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '12mm' }}>សរុប</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '10mm' }}>ស្រី</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '12mm' }}>សរុប</th>
                <th style={{ border: '1px solid black', padding: '4px', width: '10mm' }}>ស្រី</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.code || idx}>
                  <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{row.code}</td>
                  <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'left' }}>{row.label}</td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.civilTotal}
                      onChange={(e) => handleCellChange(idx, 'civilTotal', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.civilFemale}
                      onChange={(e) => handleCellChange(idx, 'civilFemale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.contractTotal}
                      onChange={(e) => handleCellChange(idx, 'contractTotal', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.contractFemale}
                      onChange={(e) => handleCellChange(idx, 'contractFemale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.absentMale}
                      onChange={(e) => handleCellChange(idx, 'absentMale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.absentFemale}
                      onChange={(e) => handleCellChange(idx, 'absentFemale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.noSalaryMale}
                      onChange={(e) => handleCellChange(idx, 'noSalaryMale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.noSalaryFemale}
                      onChange={(e) => handleCellChange(idx, 'noSalaryFemale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.outOfCadreMale}
                      onChange={(e) => handleCellChange(idx, 'outOfCadreMale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.outOfCadreFemale}
                      onChange={(e) => handleCellChange(idx, 'outOfCadreFemale', e.target.value)}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                    <input
                      type="text"
                      value={row.other}
                      onChange={(e) => handleCellChange(idx, 'other', e.target.value)}
                      style={inputTextStyle}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>សរុប</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'left' }}>សរុបបុគ្គលិកទាំងអស់</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.civilTotal || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.civilFemale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.contractTotal || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.contractFemale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.absentMale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.absentFemale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.noSalaryMale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.noSalaryFemale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.outOfCadreMale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px', textAlign: 'center' }}>{totals.outOfCadreFemale || ''}</td>
                <td style={{ border: '1px solid black', padding: '2px 4px' }} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer signatures */}
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '12px',
            fontFamily: 'Khmer OS Content',
          }}
        >
          <div style={{ textAlign: 'center',marginLeft: '2cm', marginTop: '30px' }}>
            <div>បានឃើញ</div>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '13px', marginTop: '0px' }}>នាយកមន្ទីរពេទ្យ</div>
          </div>
          <div style={{ textAlign: 'center', marginLeft: '1cm', marginTop: '25px' }}>
            <div>បានឃើញ និងពិនិត្យត្រឹមត្រូវ</div>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '13px', marginTop: '0px' }}>ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</div>
          </div>
          <div style={{ textAlign: 'center', marginRight: '0cm', marginTop: '0px' }}>
            <div>ថ្ងៃសុក្រ ១២កើត ខែមាឃ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស. ២៥៦៩
                <p>រាជធានីភ្នំពេញ ថ្ងៃទី៣០ ខែមករា ឆ្នាំ២០២៦</p></div>
            <div style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '13px', marginTop: '0px' }}>អ្នកធ្វើរបាយការណ៍</div>
          </div>
        </div>

        {/* Detailed Staff List at the bottom */}
        <div style={{ marginTop: '40px', borderTop: '2px dashed #ccc', paddingTop: '20px' }}>
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontFamily: 'Khmer OS Muol Light', fontSize: '16px', color: '#1e40af' }}>
              បញ្ជីឈ្មោះបុគ្គលិកដែលមានអវត្តមាន ឬស្ថានភាពពិសេស (លម្អិត)
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={exportToExcel}
                style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                Export Excel
              </button>
              <button
                onClick={handlePrintList}
                style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                ព្រីនបញ្ជីនេះ
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{ padding: '6px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                {showDetails ? 'លាក់បញ្ជីឈ្មោះ' : 'បង្ហាញបញ្ជីឈ្មោះ'}
              </button>
            </div>
          </div>

          {showDetails && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(() => {
                const groups = [
                  { code: '2.1', label: '២.១ ថ្នាក់ដឹកនាំ' },
                  { code: '3.1', label: '៣.១ ការិយាល័យរដ្ឋបាល និងបុគ្គលិក' },
                  { code: '3.2', label: '៣.២ ការិយាល័យហិរញ្ញវត្ថុ' },
                  { code: '3.3', label: '៣.៣ ការិយាល័យហិរញ្ញវត្ថុ (សេវា)' },
                  { code: '3.4', label: '៣.៤ ការិយាល័យបច្ចេកទេស' },
                ];

                return groups.map((group) => {
                  const members = staffWithIssues.filter((st) => (st.mCode || '').startsWith(group.code));
                  if (members.length === 0) return null;

                  return (
                    <div key={group.code}>
                      <div style={{ background: '#f3f4f6', padding: '8px 12px', fontWeight: 700, border: '1px solid #e5e7eb', borderBottom: 'none' }}>
                        {group.label} ({members.length} នាក់)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', width: '50px', textAlign: 'center' }}>ល.រ</th>
                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left' }}>គោត្តនាម និងនាម</th>
                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center', width: '60px' }}>ភេទ</th>
                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left' }}>ប្រភេទមន្រ្តី</th>
                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left' }}>ផ្នែក</th>
                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', width: '100px' }}>ផ្សេងៗ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((st, i) => (
                            <tr key={st.id + i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center' }}>{i + 1}</td>
                              <td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>
                                <div style={{ fontWeight: 600 }}>{st.name}</div>
                                <div style={{ fontSize: '10px', color: '#9ca3af' }}>ID: {st.id}</div>
                              </td>
                              <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center' }}>{st.gender || ''}</td>
                              <td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>{st.officerType || ''}</td>
                              <td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>{st.dept}</td>
                              <td style={{ border: '1px solid #e5e7eb', padding: '8px' }}></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                });
              })()}
              {staffWithIssues.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', border: '1px dashed #e5e7eb' }}>
                  មិនមានទិន្នន័យអវត្តមានសម្រាប់ខែនេះទេ
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
