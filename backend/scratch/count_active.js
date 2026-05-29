import mongoose from 'mongoose';

const hasResignData = (hr) => {
  try {
    return Boolean(hr && (
      hr.resignDate || hr.resignReason || hr.resignDocument || hr.resignationDate || hr.resignationReason
      || hr.dateRemoved || hr.dateRemovedFromDataset || hr.removalDate || (hr.delisted && (hr.delisted.dateRemoved || hr.delisted.date_removed))
    ));
  } catch (e) { return false; }
};

const isExplicitlyRemoved = (hr) => {
  try {
    const del = hr && hr.delisted ? hr.delisted : {};
    return Boolean(hr.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || hr.dateRemovedFromDataset || hr.removalDate);
  } catch (e) { return false; }
};

const isCountedActive = (emp) => {
  if (!emp) return false;

  const parseDateSafe = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const resDate = parseDateSafe(emp.resignDate || emp.resignationDate || emp.dateRemoved);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (resDate && resDate > today) return true;

  const s = (emp.status || '').toString().toLowerCase();
  if (s === 'resigned' || s === 'deleted' || s === 'inactive') return false;
  const hasResign = hasResignData(emp);
  const hasExplicitRemoval = isExplicitlyRemoved(emp);
  const prepared = (emp.__isPreparedForDeletion) && !hasExplicitRemoval;
  if (hasResign && !prepared) return false;
  return true;
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

const demoteLevel = (lvl) => {
  const ka = ['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.៥', 'ក.១.៦', 'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤', 'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'];
  const kha = ['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'];
  const ko = ['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'];

  if (!lvl) return '';
  const s = lvl.trim();
  let idx = ka.indexOf(s);
  if (idx !== -1 && idx < ka.length - 1) return ka[idx + 1];
  idx = kha.indexOf(s);
  if (idx !== -1 && idx < kha.length - 1) return kha[idx + 1];
  idx = ko.indexOf(s);
  if (idx !== -1 && idx < ko.length - 1) return ko[idx + 1];
  return s;
};

async function run() {
  await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
  const allEmployees = await mongoose.connection.collection('hrs').find({}).toArray();
  console.log('Total in DB:', allEmployees.length);

  const active = allEmployees.filter(isCountedActive);
  console.log('Active backend count:', active.length);

  // Group by officer category
  const categories = {};
  active.forEach(emp => {
    const cat = getEmployeeCategory(emp);
    categories[cat] = (categories[cat] || 0) + 1;
  });
  console.log('Categories:', categories);

  // Calculate year 2026 counts
  const targetYear = 2026;
  const counts2025 = {};
  const counts2026 = {};

  active.forEach(emp => {
    const cat = getEmployeeCategory(emp);
    if (cat === 'civil') {
      const lvl = (emp.salaryLevel || '').toString().trim();
      if (!lvl) return;
      let lvl2025 = lvl;
      let lvl2026 = lvl;
      if (emp.salaryPromotionDate) {
        const promoYear = new Date(emp.salaryPromotionDate).getFullYear();
        if (promoYear === targetYear) {
          lvl2025 = demoteLevel(lvl);
        }
      }
      counts2025[lvl2025] = (counts2025[lvl2025] || 0) + 1;
      counts2026[lvl2026] = (counts2026[lvl2026] || 0) + 1;
    } else if (cat === 'contract_state') {
      counts2025['កិច្ចសន្យា'] = (counts2025['កិច្ចសន្យា'] || 0) + 1;
      counts2026['កិច្ចសន្យា'] = (counts2026['កិច្ចសន្យា'] || 0) + 1;
    } else {
      counts2025['អណ្ដែត'] = (counts2025['អណ្ដែត'] || 0) + 1;
      counts2026['អណ្ដែត'] = (counts2026['អណ្ដែត'] || 0) + 1;
    }
  });

  const sumCounts = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
  console.log('2025 Total active:', sumCounts(counts2025));
  console.log('2026 Total active:', sumCounts(counts2026));

  process.exit(0);
}
run();
