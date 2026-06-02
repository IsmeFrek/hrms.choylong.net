import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import usePermission from '../hooks/usePermission';
import headerBg from '../assets/3.JPG';
import { isCountedActive } from '../utils/hrFilters';

function toKhmerDigits(n) {
  const map = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(n).replace(/[0-9]/g, (d) => map[d]);
}

function formatRiel(amount) {
  if (amount === null || typeof amount === 'undefined') return '—';
  return Number(amount).toLocaleString('en-US') + ' រៀល';
}

export default function BudgetReportPage() {
  const perms = usePermission();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [year, setYear] = useState(() => {
    // Default target year is next year (e.g. 2026 if current is 2025)
    return new Date().getFullYear() + 1;
  });
  const [selectedEmployees, setSelectedEmployees] = useState(null);
  const [modalTitle, setModalTitle] = useState('');

  const openModal = (title, employees) => {
    if (!employees || employees.length === 0) return;
    setModalTitle(title);
    setSelectedEmployees(employees);
  };

  useEffect(() => {
    let active = true;
    const fetchBudget = async () => {
      try {
        setLoading(true);
        const res = await api.get('/hr');
        if (!active) return;
        
        const rawList = Array.isArray(res.data) ? res.data : [];
        
        // Filter active employees
        const activeEmployees = rawList.filter(isCountedActive);

        setData(activeEmployees);
      } catch (err) {
        if (active) setError('មិនអាចទាញយកទិន្នន័យបានទេ');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchBudget();
    return () => { active = false; };
  }, []);

  const demoteLevel = (lvl) => {
    const ka = ['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦', 'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤', 'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'];
    const kha = ['ខ.១.阻.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'];
    // Wait, let's fix the typo in kha first element: 'ខ.១.១'
    const khaCorrect = ['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'];
    const ko = ['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'];

    if (!lvl) return '';
    const s = lvl.trim();
    let idx = ka.indexOf(s);
    if (idx !== -1 && idx < ka.length - 1) return ka[idx + 1];
    idx = khaCorrect.indexOf(s);
    if (idx !== -1 && idx < khaCorrect.length - 1) return khaCorrect[idx + 1];
    idx = ko.indexOf(s);
    if (idx !== -1 && idx < ko.length - 1) return ko[idx + 1];
    return s;
  };

  const promoteLevel = (lvl) => {
    const ka = ['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦', 'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤', 'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'];
    const kha = ['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'];
    const ko = ['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'];

    if (!lvl) return '';
    const s = lvl.trim();
    let idx = ka.indexOf(s);
    if (idx !== -1 && idx > 0) return ka[idx - 1];
    idx = kha.indexOf(s);
    if (idx !== -1 && idx > 0) return kha[idx - 1];
    idx = ko.indexOf(s);
    if (idx !== -1 && idx > 0) return ko[idx - 1];
    return s;
  };

  const getEmployeeCategory = (emp) => {
    const ot = (emp.officerType || '').toString().trim();
    if (ot.includes('រាជការ') || ot.includes('ក្របខណ្ឌ')) {
      return 'civil';
    }
    if (ot.includes('កិច្ចសន្យារដ្ឋ') || ot === 'កិច្ចសន្យា') {
      return 'contract_state';
    }
    return 'floating';
  };

  // Computes lists for each level dynamically based on selected year
  const computedStats = useMemo(() => {
    const listPrev = {};
    const listTarget = {};

    data.forEach(emp => {
      const cat = getEmployeeCategory(emp);
      if (cat === 'civil') {
        const lvl = (emp.salaryLevel || '').toString().trim();
        if (!lvl) return;

        // Auto-exclude if retired by/during the respective year
        const dob = emp.dob ? new Date(emp.dob) : null;
        let isRetiredPrev = false;
        let isRetiredTarget = false;
        const isCivil = !emp.isRetiredThenContract && !emp.isPartTime;

        if (isCivil && dob && !Number.isNaN(dob.getTime())) {
          const retDate = new Date(dob);
          retDate.setFullYear(retDate.getFullYear() + 60);
          const retYear = retDate.getFullYear();
          // Exclude from prevYear (year - 1) if retired before prevYear
          if (retYear < (year - 1)) isRetiredPrev = true;
          // Exclude from targetYear (year) if retired in or before prevYear
          if (retYear <= (year - 1)) isRetiredTarget = true;
        }

        let lvlPrev = lvl;
        let lvlTarget = lvl;
        if (emp.salaryPromotionDate) {
          const promoYear = new Date(emp.salaryPromotionDate).getFullYear();
          if (promoYear === year) {
            lvlPrev = demoteLevel(lvl);
          } else if (promoYear === year - 2) {
            lvlTarget = promoteLevel(lvl);
          }
        }
        if (!isRetiredPrev) {
          if (!listPrev[lvlPrev]) listPrev[lvlPrev] = [];
          listPrev[lvlPrev].push(emp);
        }
        if (!isRetiredTarget) {
          if (!listTarget[lvlTarget]) listTarget[lvlTarget] = [];
          listTarget[lvlTarget].push(emp);
        }
      } else if (cat === 'contract_state') {
        if (!listPrev['កិច្ចសន្យា']) listPrev['កិច្ចសន្យា'] = [];
        if (!listTarget['កិច្ចសន្យា']) listTarget['កិច្ចសន្យា'] = [];
        listPrev['កិច្ចសន្យា'].push(emp);
        listTarget['កិច្ចសន្យា'].push(emp);
      } else {
        if (!listPrev['អណ្ដែត']) listPrev['អណ្ដែត'] = [];
        if (!listTarget['អណ្ដែត']) listTarget['អណ្ដែត'] = [];
        listPrev['អណ្ដែត'].push(emp);
        listTarget['អណ្ដែត'].push(emp);
      }
    });

    return { listPrev, listTarget };
  }, [data, year]);

  // Standard rates estimated from Excel template (Average rate per officer per year in Riels)
  const rates = {
    'ក.១.១': { base: 17358000, func: 11775000, child: 120000, dep: 60000, other: 100000 },
    'ក.១.២': { base: 16758360, func: 2406000, child: 72000, dep: 36000, other: 100000 },
    'ក.១.៣': { base: 16190280, func: 3572857, child: 51428, dep: 42857, other: 100000 },
    'ក.១.៤': { base: 15653760, func: 8497500, child: 97500, dep: 45000, other: 100000 },
    'ក.១.៥': { base: 15117240, func: 16064500, child: 30000, dep: 7500, other: 100000 },
    'ក.១.៦': { base: 14549160, func: 17514705, child: 77647, dep: 21176, other: 100000 },
    'ក.២.១': { base: 13981080, func: 6458181, child: 98181, dep: 16363, other: 100000 },
    'ក.២.២': { base: 13444560, func: 5692857, child: 85714, dep: 34285, other: 100000 },
    'ក.២.៣': { base: 12939600, func: 7470000, child: 81951, dep: 13170, other: 100000 },
    'ក.២.៤': { base: 12434640, func: 26929411, child: 42352, dep: 31764, other: 100000 },
    'ក.៣.១': { base: 11961240, func: 13123636, child: 43636, dep: 16363, other: 100000 },
    'ក.៣.២': { base: 11487840, func: 32993333, child: 16666, dep: 25000, other: 100000 },
    'ក.៣.៣': { base: 10990440, func: 10119272, child: 8727, dep: 6545, other: 100000 },
    'ក.៣.៤': { base: 10888200, func: 14821935, child: 24193, dep: 7258, other: 100000 },
    'ខ.១.១': { base: 11132640, func: 1445000, child: 18000, dep: 10000, other: 100000 },
    'ខ.១.២': { base: 10738080, func: 1350000, child: 15000, dep: 8000, other: 100000 },
    'ខ.១.៣': { base: 10343520, func: 1250000, child: 12000, dep: 6000, other: 100000 },
    'ខ.១.៤': { base: 9948960, func: 1150000, child: 10000, dep: 5000, other: 100000 },
    'ខ.១.៥': { base: 9554400, func: 1050000, child: 8000, dep: 4000, other: 100000 },
    'ខ.១.៦': { base: 9159840, func: 950000, child: 6000, dep: 3000, other: 100000 },
    'ខ.២.១': { base: 9028800, func: 4272000, child: 54000, dep: 14000, other: 100000 },
    'ខ.២.២': { base: 8710800, func: 4125000, child: 45000, dep: 12000, other: 100000 },
    'ខ.២.៣': { base: 8408400, func: 3980000, child: 36000, dep: 10000, other: 100000 },
    'ខ.២.៤': { base: 8106000, func: 3835000, child: 27000, dep: 8000, other: 100000 },
    'ខ.៣.១': { base: 7904400, func: 17220000, child: 10000, dep: 5000, other: 100000 },
    'ខ.៣.២': { base: 7606800, func: 1650000, child: 8000, dep: 4000, other: 100000 },
    'ខ.៣.៣': { base: 7309200, func: 1580000, child: 6000, dep: 3000, other: 100000 },
    'ខ.៣.៤': { base: 7011600, func: 1510000, child: 4000, dep: 2000, other: 100000 },
    'គ.១': { base: 7120000, func: 950000, child: 0, dep: 0, other: 100000 },
    'គ.២': { base: 6920000, func: 900000, child: 0, dep: 0, other: 100000 },
    'គ.៣': { base: 6720000, func: 850000, child: 0, dep: 0, other: 100000 },
    'គ.៤': { base: 6520000, func: 800000, child: 0, dep: 0, other: 100000 },
    'គ.៥': { base: 6320000, func: 750000, child: 0, dep: 0, other: 100000 },
    'គ.៦': { base: 6120000, func: 700000, child: 0, dep: 0, other: 100000 },
    'គ.៧': { base: 5920000, func: 650000, child: 0, dep: 0, other: 100000 },
    'គ.៨': { base: 5720000, func: 600000, child: 0, dep: 0, other: 100000 },
    'គ.៩': { base: 5520000, func: 550000, child: 0, dep: 0, other: 100000 },
    'គ.១០': { base: 5320000, func: 500000, child: 0, dep: 0, other: 100000 },
    'កិច្ចសន្យា': { base: 9480000, func: 0, child: 0, dep: 0, other: 100000 },
    'អណ្ដែត': { base: 0, func: 0, child: 0, dep: 0, other: 0 }
  };

  // Build the raw rows based on counts and rates
  const tableRows = useMemo(() => {
    const { listPrev, listTarget } = computedStats;
    const rows = {};

    const listCodes = [
      'ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦',
      'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤',
      'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤',
      'ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦',
      'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤',
      'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤',
      'គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០',
      'កិច្ចសន្យា', 'អណ្ដែត'
    ];

    listCodes.forEach(code => {
      const empsPrev = listPrev[code] || [];
      const empsTarget = listTarget[code] || [];
      const count25 = empsPrev.length;
      const count26 = empsTarget.length;
      const rate = rates[code] || { base: 0, func: 0, child: 0, dep: 0, other: 0 };
      
      const base = rate.base * count26;
      const func = rate.func * count26;
      const child = rate.child * count26;
      const dep = rate.dep * count26;
      const other = rate.other * count26;
      const total = base + func + child + dep + other;

      rows[code] = {
        empsPrev,
        empsTarget,
        count25,
        count26,
        total,
        base,
        func,
        child,
        dep,
        other
      };
    });

    const sumGroup = (subCodes) => {
      const res = { empsPrev: [], empsTarget: [], count25: 0, count26: 0, total: 0, base: 0, func: 0, child: 0, dep: 0, other: 0 };
      subCodes.forEach(c => {
        const row = rows[c];
        if (row) {
          res.empsPrev = res.empsPrev.concat(row.empsPrev || []);
          res.empsTarget = res.empsTarget.concat(row.empsTarget || []);
          res.count25 += row.count25;
          res.count26 += row.count26;
          res.total += row.total;
          res.base += row.base;
          res.func += row.func;
          res.child += row.child;
          res.dep += row.dep;
          res.other += row.other;
        }
      });
      return res;
    };

    rows['ក.១'] = sumGroup(['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦']);
    rows['ក.២'] = sumGroup(['ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤']);
    rows['ក.៣'] = sumGroup(['ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤']);
    rows['សរុប ក'] = sumGroup(['ក.១', 'ក.២', 'ក.៣']);

    rows['ខ.១'] = sumGroup(['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦']);
    rows['ខ.២'] = sumGroup(['ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤']);
    rows['ខ.៣'] = sumGroup(['ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤']);
    rows['សរុប ខ'] = sumGroup(['ខ.១', 'ខ.២', 'ខ.៣']);

    rows['សរុប គ'] = sumGroup(['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០']);

    rows['បុគ្គលិកអចិន្ត្រៃយ៍'] = sumGroup(['សរុប ក', 'សរុប ខ', 'សរុប គ']);
    rows['បុគ្គលិកមិនអចិន្ត្រៃយ៍'] = sumGroup(['កិច្ចសន្យា', 'អណ្ដែត']);
    rows['សរុបរួម'] = sumGroup(['បុគ្គលិកអចិន្ត្រៃយ៍', 'បុគ្គលិកមិនអចិន្ត្រៃយ៍']);

    return rows;
  }, [computedStats]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await api.get(`/hr/export-budget-excel?year=${year}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `គម្រោងថវិកាឆ្នាំ${year}.xlsx`;
      link.click();
    } catch (e) {
      console.error(e);
      window.alert('មិនអាចទាញយកឯកសារ Excel បានទេ');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">កំពុងផ្ទុកទិន្នន័យ...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 font-medium">{error}</div>;
  }

  const grandTotal = tableRows['សរុបរួម'] || {};

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-[13px] font-sans text-slate-800">
      
      {/* Top Banner Control Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-4">
          <span className="h-10 w-1 bg-blue-600 rounded-full hidden sm:block"></span>
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              របាយការណ៍គម្រោងថវិកា ឆ្នាំ{toKhmerDigits(year)}
            </h2>
            <p className="text-slate-500 text-xs mt-1">គម្រោងបន្ទុកបុគ្គលិកក្របខ័ណ្ឌ និងមិនមែនក្របខ័ណ្ឌ</p>
          </div>
        </div>
        
        {/* Year Select & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-600 text-xs">ជ្រើសរើសឆ្នាំ៖</label>
            <select 
              value={year} 
              onChange={e => setYear(Number(e.target.value))} 
              className="border border-slate-300 rounded-lg p-2 bg-white font-bold text-blue-800 outline-none focus:border-blue-500 transition"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                <option key={y} value={y}>ឆ្នាំ {toKhmerDigits(y)}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleExport} 
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
          >
            📊 {exporting ? 'កំពុងនាំចេញ...' : 'នាំចេញ Excel'}
          </button>
          <button 
            onClick={handlePrint} 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition"
          >
            🖨️ បោះពុម្ព PDF
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 no-print">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold block uppercase">បុគ្គលិកសរុប ({toKhmerDigits(year)})</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{toKhmerDigits(grandTotal.count26 || 0)} នាក់</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold block uppercase">សរុបគម្រោងថវិការួម ({toKhmerDigits(year)})</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{formatRiel(grandTotal.total || 0)}</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold block uppercase">មធ្យមភាគក្នុងម្នាក់ / ឆ្នាំ</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{formatRiel(Math.round((grandTotal.total || 0) / (grandTotal.count26 || 1)))}</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
        </div>
      </div>

      {/* Document Area */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg max-w-full overflow-x-auto print:border-none print:shadow-none print:p-0">
        
        {/* Document Header */}
        <div className="text-center mb-8 relative flex flex-col items-center">
          <div className="w-full flex justify-between items-start mb-6">
            <div className="text-left font-bold text-slate-800">
              <div className="font-muol text-[14px]">ក្រសួងសុខាភិបាល</div>
              <div className="font-muol text-[13px] mt-1">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
            </div>
            <div className="text-center font-bold text-slate-800">
              <div className="font-muol text-[15px]">ព្រះរាជាណាចក្រកម្ពុជា</div>
              <div className="font-muol text-[13px] mt-1">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
            </div>
          </div>
          <img src={headerBg} alt="" className="w-28 opacity-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <h1 className="font-muol text-lg text-slate-900 mt-4">គម្រោងថវិកាឆ្នាំ{toKhmerDigits(year)}</h1>
          <p className="font-muol text-[13px] text-slate-700 mt-2">គម្រោងបន្ទុកបុគ្គលិកក្របខ័ណ្ឌ និងមិនមែនក្របខ័ណ្ឌ</p>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold mt-2 no-print">តារាង ៤"គ"</span>
        </div>

        {/* Preview Table */}
        <table className="w-full border-collapse border border-slate-400 text-left font-sans text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800 font-semibold text-center border-b border-slate-400">
              <th className="border border-slate-400 p-2" rowSpan="2">កាំប្រាក់/កូដថវិកា</th>
              <th className="border border-slate-400 p-1 colspan-2" colSpan="2">ចំនួនមន្រ្តី (នាក់)</th>
              <th className="border border-slate-400 p-2 rowspan-2" rowSpan="2">សរុបទឹកប្រាក់ (រៀល)</th>
              <th className="border border-slate-400 p-2 rowspan-2" rowSpan="2">បៀវត្សមូលដ្ឋាន</th>
              <th className="border border-slate-400 p-2 rowspan-2" rowSpan="2">ប្រាក់មុខងារ</th>
              <th className="border border-slate-400 p-2" colSpan="5">ប្រាក់បំណាច់ឧបត្ថម្ភផ្សេងៗ</th>
              <th className="border border-slate-400 p-2 rowspan-2" rowSpan="2">កូន &lt; ១៥ឆ្នាំ</th>
              <th className="border border-slate-400 p-2 rowspan-2" rowSpan="2">ក្នុងបន្ទុក</th>
              <th className="border border-slate-400 p-2 rowspan-2" rowSpan="2">ប្រាក់ផ្សេងៗ</th>
            </tr>
            <tr className="bg-slate-50 text-slate-600 text-[10px] text-center border-b border-slate-400">
              <th className="border border-slate-400 p-1">{toKhmerDigits(year - 1)}</th>
              <th className="border border-slate-400 p-1">{toKhmerDigits(year)}</th>
              <th className="border border-slate-400 p-1">ម៉ោងបន្ថែម</th>
              <th className="border border-slate-400 p-1">ទទួលខុសត្រូវ</th>
              <th className="border border-slate-400 p-1">សម្រាលកូន</th>
              <th className="border border-slate-400 p-1">មរណៈភាព</th>
              <th className="border border-slate-400 p-1">និវត្តជន</th>
            </tr>
          </thead>
          <tbody>
            {renderTableRow('សរុបរួម', null, 'សរុបរួម', true)}
            {renderTableRow('បុគ្គលិកអចិន្ត្រៃយ៍', null, 'បុគ្គលិកអចិន្ត្រៃយ៍', true, 'bg-slate-50')}
            {renderTableRow('សរុប ក', null, 'សរុប ក', true, 'pl-4 bg-slate-50/50')}
            
            {renderTableRow(null, 'ក.១', 'ក.១', true, 'pl-6 font-semibold')}
            {['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦'].map(c => renderTableRow(null, c, c))}

            {renderTableRow(null, 'ក.២', 'ក.២', true, 'pl-6 font-semibold')}
            {['ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤'].map(c => renderTableRow(null, c, c))}

            {renderTableRow(null, 'ក.៣', 'ក.៣', true, 'pl-6 font-semibold')}
            {['ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'].map(c => renderTableRow(null, c, c))}

            {renderTableRow('សរុប ខ', null, 'សរុប ខ', true, 'pl-4 bg-slate-50/50')}
            {renderTableRow(null, 'ខ.១', 'ខ.១', true, 'pl-6 font-semibold')}
            {['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦'].map(c => renderTableRow(null, c, c))}

            {renderTableRow(null, 'ខ.២', 'ខ.២', true, 'pl-6 font-semibold')}
            {['ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤'].map(c => renderTableRow(null, c, c))}

            {renderTableRow(null, 'ខ.៣', 'ខ.៣', true, 'pl-6 font-semibold')}
            {['ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'].map(c => renderTableRow(null, c, c))}

            {renderTableRow('សរុប គ', null, 'សរុប គ', true, 'pl-4 bg-slate-50/50')}
            {['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'].map(c => renderTableRow(null, c, c))}

            {renderTableRow('បុគ្គលិកមិនអចិន្ត្រៃយ៍', null, 'បុគ្គលិកមិនអចិន្ត្រៃយ៍', true, 'bg-slate-50')}
            {renderTableRow(null, 'កិច្ចសន្យា', 'កិច្ចសន្យា')}
            {renderTableRow(null, 'អណ្ដែត', 'អណ្ដែត')}
          </tbody>
        </table>

        {/* Signature Section */}
        <div className="flex justify-between mt-12 text-center text-xs print:mt-8">
          <div className="w-[30%]">
            <p className="font-semibold">បានឃើញ និងបញ្ជាក់</p>
            <p className="font-muol text-[11px] mt-1">នាយកមន្ទីរពេទ្យ</p>
            <div className="h-20"></div>
          </div>
          <div className="w-[30%]">
            <p className="font-semibold">បានពិនិត្យត្រឹមត្រូវ</p>
            <p className="font-muol text-[11px] mt-1">ប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក</p>
            <div className="h-20"></div>
          </div>
          <div className="w-[30%] text-right pr-6">
            <p className="italic">រាជធានីភ្នំពេញ, ថ្ងៃទី....... ខែ....... ឆ្នាំ {toKhmerDigits(year - 1)}</p>
            <p className="font-muol text-[11px] mt-1 text-center">អ្នកធ្វើតារាង</p>
            <div className="h-20"></div>
          </div>
        </div>

      </div>

      {/* Selected Employees Modal */}
      {selectedEmployees && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 font-muol">{modalTitle}</h3>
              <button 
                onClick={() => setSelectedEmployees(null)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-full hover:bg-slate-100 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left font-sans text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="p-3 text-center w-12">ល.រ</th>
                      <th className="p-3">អត្តលេខ</th>
                      <th className="p-3">ឈ្មោះ</th>
                      <th className="p-3 text-center">ភេទ</th>
                      <th className="p-3">ជំនាញ</th>
                      <th className="p-3">ផ្នែក</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEmployees.map((emp, index) => (
                      <tr key={emp._id || index} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-center text-slate-500 font-semibold">{toKhmerDigits(index + 1)}</td>
                        <td className="p-3 text-blue-600 font-mono font-semibold">{emp.staffId || '—'}</td>
                        <td className="p-3 font-semibold text-slate-800">{emp.khmerName || emp.name || '—'}</td>
                        <td className="p-3 text-center">
                          {emp.gender === 'Male' ? 'ប្រុស' : emp.gender === 'Female' ? 'ស្រី' : emp.gender || '—'}
                        </td>
                        <td className="p-3">{emp.skill || emp.ministrySkill || '—'}</td>
                        <td className="p-3">{emp.Department_Kh || emp.department || emp.unit || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">សរុប៖ {toKhmerDigits(selectedEmployees.length)} នាក់</span>
              <button 
                onClick={() => setSelectedEmployees(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 active:scale-95 transition"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; margin: 0 !important; }
          .no-print { display: none !important; }
          table { width: 100% !important; border: 1px solid #000 !important; }
          th, td { border: 1px solid #000 !important; color: #000 !important; padding: 4px !important; }
        }
        .font-muol {
          font-family: "Khmer OS Muol Light", "Khmer OS Muol", "Noto Serif Khmer", serif;
          font-weight: normal;
        }
      `}} />
    </div>
  );

  function renderTableRow(colA, colB, key, isHeader = false, extraClass = '') {
    const row = tableRows[key] || { count25: 0, count26: 0, total: 0, base: 0, func: 0, child: 0, dep: 0, other: 0, empsPrev: [], empsTarget: [] };
    
    const click25 = row.empsPrev && row.empsPrev.length > 0 ? () => openModal(`បញ្ជីមន្ត្រី - ${colA || colB || key} (ឆ្នាំ ${toKhmerDigits(year - 1)})`, row.empsPrev) : null;
    const click26 = row.empsTarget && row.empsTarget.length > 0 ? () => openModal(`បញ្ជីមន្ត្រី - ${colA || colB || key} (ឆ្នាំ ${toKhmerDigits(year)})`, row.empsTarget) : null;

    return (
      <tr key={key} className={`border-b border-slate-300 hover:bg-slate-50 transition-colors ${isHeader ? 'font-bold text-slate-900 bg-slate-100/50' : ''} ${extraClass}`}>
        <td className="border border-slate-300 p-2 font-semibold">{colA || colB || ''}</td>
        <td 
          onClick={click25}
          className={`border border-slate-300 p-2 text-center ${click25 ? 'cursor-pointer text-blue-600 hover:underline hover:bg-blue-50 font-semibold' : ''}`}
        >
          {toKhmerDigits(row.count25)}
        </td>
        <td 
          onClick={click26}
          className={`border border-slate-300 p-2 text-center ${click26 ? 'cursor-pointer text-blue-600 hover:underline hover:bg-blue-50 font-semibold' : ''}`}
        >
          {toKhmerDigits(row.count26)}
        </td>
        <td className="border border-slate-300 p-2 text-right font-semibold">{row.total.toLocaleString()}</td>
        <td className="border border-slate-300 p-2 text-right">{row.base.toLocaleString()}</td>
        <td className="border border-slate-300 p-2 text-right">{row.func.toLocaleString()}</td>
        <td className="border border-slate-300 p-2 text-center">០</td>
        <td className="border border-slate-300 p-2 text-center">០</td>
        <td className="border border-slate-300 p-2 text-center">០</td>
        <td className="border border-slate-300 p-2 text-center">០</td>
        <td className="border border-slate-300 p-2 text-center">០</td>
        <td className="border border-slate-300 p-2 text-right">{row.child.toLocaleString()}</td>
        <td className="border border-slate-300 p-2 text-right">{row.dep.toLocaleString()}</td>
        <td className="border border-slate-300 p-2 text-right">{row.other.toLocaleString()}</td>
      </tr>
    );
  }
}
