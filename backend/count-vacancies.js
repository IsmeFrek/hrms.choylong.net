#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';
import HR from './models/hr.js';

const DB = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGODB || 'mongodb://localhost:27017/kshf_hospital_app';

const vacancyKeywords = ['ទំនេរ','ទំនេរគ្មានបៀវត្ស','unpaid','leave without pay','leave'];

const parseDateSafe = (v) => {
  if (!v) return null;
  try { const d = new Date(v); if (isNaN(d.getTime())) return null; d.setHours(0,0,0,0); return d; } catch { return null; }
};

const daysBetween = (a, b) => { if (!a || !b) return null; return Math.round((b.getTime() - a.getTime())/(24*60*60*1000)); };

const main = async () => {
  await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', DB);

  const employees = await HR.find({}).lean().exec();
  console.log('Total HR records in DB:', employees.length);

  const isExcludedStatus = (s) => {
    if (!s) return false;
    return /resign|resigned|លាលែង|deleted|delete/i.test(String(s));
  };

  const metricEmployees = employees.filter(e => {
    if (isExcludedStatus(e.status)) return false;
    if (e.__isPreparedForDeletion) return false;
    return true;
  });

  console.log('Metric employees after filtering:', metricEmployees.length);

  const vacancyArr = [];
  const unpaidFieldNames = ['unpaid','unpaidLeave','leave','leaveWithoutPay','unpaid_leave'];
  const hasUnpaidLikeData = (hr) => {
    try {
      for (const fname of unpaidFieldNames) {
        const u = hr && hr[fname] ? hr[fname] : null;
        if (!u) continue;
        if (typeof u === 'object') {
          if (Object.keys(u).some(k => { const v = u[k]; return v !== null && typeof v !== 'undefined' && String(v).trim() !== ''; })) return true;
        } else if (String(u).trim() !== '') return true;
      }
    } catch (e) { return false; }
    return false;
  };

  metricEmployees.forEach(e => {
    const textFields = [e.civilServantReason, e.reason, e.other, e.workOther, e.civilServantRole, e.position].map(x => (x||'').toString().toLowerCase()).join(' ');
    if (hasUnpaidLikeData(e) || !(e.staffId || e.no || '').toString().trim() || !(e.position || e.civilServantRole || '').toString().trim() || vacancyKeywords.some(k => textFields.includes(k))) {
      vacancyArr.push(e);
    }
  });

  const vacancyFemale = vacancyArr.filter(e => {
    const g = (e.gender || '').toString();
    return (g === 'Female' || g === 'ស្រី');
  }).length;

  console.log('\nVacancies total:', vacancyArr.length, 'Female:', vacancyFemale);

  // Compute vacancy status breakdowns
  const today = new Date(); today.setHours(0,0,0,0);
  const vCounts = { preparing: { total:0, female:0 }, ongoing: { total:0, female:0 }, returned: { total:0, female:0 } };
  vacancyArr.forEach(e => {
    const unpaid = e.unpaid || e.unpaidLeave || e.leave || {};
    const start = parseDateSafe(unpaid.Start || unpaid.start || unpaid.startDate || unpaid.studyStart || unpaid.studyStartDate || unpaid.start_date);
    const end = parseDateSafe(unpaid.End || unpaid.end || unpaid.endDate || unpaid.studyEnd || unpaid.studyEndDate || unpaid.end_date);
    let status = 'returned';
    if (start && start > today) status = 'preparing';
    else if (start && (!end || (end && end >= today))) status = 'ongoing';
    else status = 'returned';
    const g = (e.gender || '').toString(); const isFemale = (g === 'Female' || g === 'ស្រី');
    vCounts[status].total++;
    if (isFemale) vCounts[status].female++;
  });

  const totalVac = (vCounts.preparing.total||0) + (vCounts.ongoing.total||0) + (vCounts.returned.total||0);
  const femaleVac = (vCounts.preparing.female||0) + (vCounts.ongoing.female||0) + (vCounts.returned.female||0);

  console.log('\nVacancy status counts:\n', vCounts);
  console.log('Total computed:', totalVac, 'Female total:', femaleVac);

  console.log('\nSample vacancies (up to 10):');
  vacancyArr.slice(0,10).forEach((e,i) => {
    console.log(i+1, '-', e._id || e.no || e.staffId, '|', e.name || e.khmerName || '', '| gender:', e.gender || '', '| position:', e.position || e.civilServantRole || '', '| reason:', e.civilServantReason || e.reason || '');
  });

  // Also compute retirements and category counts here for convenience
  const retireArr = [];
  const retireRegex = /(retir|និវត្ត|ចូលនិវត្ត)/i;
  employees.forEach(r => {
    const text = [r.civilServantReason, r.reason, r.other, r.workOther, r.civilServantRole, r.position, r.officerType].map(f => (f||'').toString().toLowerCase()).join(' ');
    if (retireRegex.test(text) || r.isRetiredThenContract) retireArr.push(r);
  });
  const retireTotal = retireArr.length;
  const retireFemale = retireArr.filter(r => (r.gender||'').toString() === 'Female' || (r.gender||'').toString() === 'ស្រី').length;
  console.log('\nRetirements total:', retireTotal, 'Female:', retireFemale);

  const catMap = {
    civil: ['មន្ត្រីរាជការ','Civil','civil'],
    state: ['កិច្ចសន្យារដ្ឋ','State','state'],
    hospital: ['កិច្ចសន្យាមន្ទីរពេទ្យ','hospital','hospitalPlus'],
    contract: ['កិច្ចសន្យា','contract','កម្មករកិច្ចសន្យា','WORKER']
  };
  const catCounts = { civil: { total:0, female:0 }, state: { total:0, female:0 }, hospital: { total:0, female:0 }, contract: { total:0, female:0 } };
  employees.forEach(r => {
    const ot = (r.officerType || '').toString().toLowerCase();
    const text = [r.civilServantReason, r.reason, r.other, r.workOther, r.civilServantRole, r.position, r.officerType].map(f => (f||'').toString().toLowerCase()).join(' ');
    const gender = (r.gender||'').toString();
    for (const key of Object.keys(catMap)) {
      const tokens = catMap[key];
      if (tokens.some(t => ot.includes((t||'').toString().toLowerCase()) || text.includes((t||'').toString().toLowerCase()))) {
        catCounts[key].total++;
        if (gender === 'Female' || gender === 'ស្រី') catCounts[key].female++;
        break;
      }
    }
  });
  console.log('\nCategory totals:');
  Object.keys(catCounts).forEach(k => console.log(`${k}: total=${catCounts[k].total}  female=${catCounts[k].female}`));

  await mongoose.disconnect();
  process.exit(0);
};

main().catch(err => { console.error(err); process.exit(1); });
