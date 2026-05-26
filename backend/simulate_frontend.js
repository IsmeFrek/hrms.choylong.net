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
  const join = parseDate(hr.joinDate) || parseDate(hr.dateJoinedMinistry) || parseDate(hr.nominationStartDate) || null;
  if (join && join > asDate) return false;
  const removed = parseDate(hr.dateRemoved) || (hr.delisted && (parseDate(hr.delisted.dateRemoved) || parseDate(hr.delisted.date_removed))) || parseDate(hr.dateRemovedFromDataset) || parseDate(hr.removalDate) || null;
  if (removed && removed <= asDate) return false;
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
  
  const allHr = await HR.find({});
  const sourceList = allHr.filter(hr => isActiveAsOf(hr, new Date()));
  const skills = await Skill.find({}).sort({ skills_Id: 1 }).lean();
  let skillGroups = [];
  try { skillGroups = await SkillGroup.find({}).sort({ order: 1 }).lean(); } catch(e){}
  
  const groupNormSets = (skillGroups || []).map(g => new Set((g.members || []).map(m => normSkill(m))));
  const memberToGroup = new Map();
  (skillGroups || []).forEach((g, gi) => {
    (g.members || []).forEach(m => memberToGroup.set(normSkill(m), gi));
  });

  const rows = [];
  const emittedGroups = new Set();
  const processedSkills = new Set();

  for (const skill of skills) {
    const skillName = (skill.skills_Kh || '').toString();
    const skillNorm = normSkill(skillName);
    if (!skillNorm) continue;
    if (processedSkills.has(skillNorm)) continue;

    if (memberToGroup.has(skillNorm)) {
      const gi = memberToGroup.get(skillNorm);
      if (!emittedGroups.has(gi)) {
        const groupSet = groupNormSets[gi] || new Set();
        let male = 0, female = 0, civil = 0, contract = 0;
        for (const hr of sourceList || []) {
          const hs = normSkill(hr.skill || '');
          if (!hs) continue;
          if (!groupSet.has(hs)) continue;
          if (isCivil(hr)) civil++; else contract++;
          if (hr.gender === 'Male' || hr.gender === 'ប្រុស') male++;
          else if (hr.gender === 'Female' || hr.gender === 'ស្រី') female++;
        }
        rows.push({ name: (skillGroups[gi].name || `Group ${gi + 1}`), male, female, total: male + female, civil, contract, isGroup: true });
        emittedGroups.add(gi);
      }
      processedSkills.add(skillNorm);
      continue;
    }

    let male = 0, female = 0, civil = 0, contract = 0;
    for (const hr of sourceList || []) {
      const hs = normSkill(hr.skill || '');
      if (!hs) continue;
      if (hs !== skillNorm) continue;
      if (isCivil(hr)) civil++; else contract++;
      if (hr.gender === 'Male' || hr.gender === 'ប្រុស') male++;
      else if (hr.gender === 'Female' || hr.gender === 'ស្រី') female++;
    }
    rows.push({ name: skillName, male, female, total: male + female, civil, contract });
    processedSkills.add(skillNorm);
  }

  for (let gi = 0; gi < (skillGroups || []).length; gi++) {
    if (emittedGroups.has(gi)) continue;
    const groupSet = groupNormSets[gi] || new Set();
    let male = 0, female = 0, civil = 0, contract = 0;
    let groupHasMembersInData = false;
    for (const hr of sourceList || []) {
      const hs = normSkill(hr.skill || '');
      if (!hs) continue;
      if (!groupSet.has(hs)) continue;
      groupHasMembersInData = true;
      if (isCivil(hr)) civil++; else contract++;
      if (hr.gender === 'Male' || hr.gender === 'ប្រុស') male++;
      else if (hr.gender === 'Female' || hr.gender === 'ស្រី') female++;
      processedSkills.add(hs);
    }
    if (groupHasMembersInData) {
      rows.push({ name: (skillGroups[gi].name || `Group ${gi + 1}`), male, female, total: male + female, civil, contract, isGroup: true });
      emittedGroups.add(gi);
    }
  }

  let otherMale = 0, otherFemale = 0, otherCivil = 0, otherContract = 0;
  let hasOthers = false;
  for (const hr of sourceList || []) {
    const hs = normSkill(hr.skill || '');
    // THIS IS THE MODIFIED PART
    if (hs && processedSkills.has(hs)) continue;
    if (hs && memberToGroup.has(hs)) continue; 

    hasOthers = true;
    if (isCivil(hr)) otherCivil++; else otherContract++;
    if (hr.gender === 'Male' || hr.gender === 'ប្រុស') otherMale++;
    else if (hr.gender === 'Female' || hr.gender === 'ស្រី') otherFemale++;
  }

  if (hasOthers) {
    const existingOther = rows.find(r => r.name === 'ផ្សេងៗ');
    if (existingOther) {
      existingOther.male += otherMale;
      existingOther.female += otherFemale;
      existingOther.total += (otherMale + otherFemale);
      existingOther.civil += otherCivil;
      existingOther.contract += otherContract;
    } else {
      rows.push({ name: 'ផ្សេងៗ', male: otherMale, female: otherFemale, total: otherMale + otherFemale, civil: otherCivil, contract: otherContract, isGroup: false });
    }
  }

  const totals = rows.reduce((acc, r) => ({
    male: acc.male + (r.male || 0),
    female: acc.female + (r.female || 0),
    total: acc.total + (r.total || 0),
    civil: (acc.civil || 0) + (r.civil || 0),
    contract: (acc.contract || 0) + (r.contract || 0),
  }), { male: 0, female: 0, total: 0, civil: 0, contract: 0 });

  console.log('Final Totals:', totals);
  process.exit(0);
}

run().catch(console.error);
