import mongoose from 'mongoose';
import HR from './models/HR.js';
import Skill from './models/Skill.js';


function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d;
}

function isActiveAsOf(hr, asOfDate) {
  if (!hr) return false;
  const asDate = asOfDate ? new Date(asOfDate) : new Date();
  if (isNaN(asDate.getTime())) return true;
  // Exclude if joinDate is after asOfDate
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

function normOfficerType(v) {
  if (!v) return '';
  try { return String(v).trim().toLowerCase(); } catch { return ''; }
}
function isStateType(v) { const n = normOfficerType(v); return n === 'កិច្ចសន្យារដ្ឋ' || n.includes('រដ្ឋ') || n.includes('state'); }
function isHospitalType(v) { const n = normOfficerType(v); return n === 'កិច្ចសន្យាមន្ទីរពេទ្យ' || n.includes('មន្ទីរពេទ្យ') || n.includes('hospital'); }
function isPartTimeType(v) { const n = normOfficerType(v); return n === 'កិច្ចសន្យាក្រៅម៉ោង' || n.includes('ក្រៅម៉ោង') || n.includes('part'); }
function isWorkerType(v) { const n = normOfficerType(v); return n === 'កម្មករកិច្ចសន្យា' || n.includes('កម្មករ') || n.includes('worker'); }

function isCivil(hr) {
  if (!hr) return false;
  return !isStateType(hr.officerType) && !isHospitalType(hr.officerType) && !isPartTimeType(hr.officerType) && !isWorkerType(hr.officerType);
}

function normSkill(s) {
  try { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); } catch { return ''; }
}

async function run() {
  await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
  
  const hrs = await HR.find({});
  const activeHrs = hrs.filter(hr => isActiveAsOf(hr, new Date()));
  console.log('Total active HRs:', activeHrs.length);
  
  const hrsWithSkill = activeHrs.filter(hr => normSkill(hr.skill || '') !== '');
  console.log('Active HRs with skill:', hrsWithSkill.length);
  
  const hrsWithoutSkill = activeHrs.filter(hr => normSkill(hr.skill || '') === '');
  console.log('Active HRs without skill:', hrsWithoutSkill.length);
  
  // also check how many are civil vs contract in the without skill group
  const noSkillCivil = hrsWithoutSkill.filter(isCivil);
  console.log('Without skill, Civil:', noSkillCivil.length);
  const noSkillContract = hrsWithoutSkill.filter(hr => !isCivil(hr));
  console.log('Without skill, Contract:', noSkillContract.length);

  process.exit(0);
}

run().catch(console.error);
