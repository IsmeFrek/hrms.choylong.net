#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';
import HR from './models/hr.js';

const DB = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGODB || 'mongodb://localhost:27017/kshf_hospital_app';

const parseText = (hr) => {
  const fields = [hr.civilServantReason, hr.reason, hr.other, hr.workOther, hr.civilServantRole, hr.position, hr.officerType];
  return fields.map(f => (f || '').toString().toLowerCase()).join(' ');
};

const main = async () => {
  await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', DB);
  const rows = await HR.find({}).lean().exec();
  console.log('Total HR documents:', rows.length);

  // Retirement detection
  const retireRegex = /(retir|និវត្ត|ចូលនិវត្ត)/i;
  let retireArr = [];
  rows.forEach(r => {
    const text = parseText(r);
    if (retireRegex.test(text) || r.isRetiredThenContract) retireArr.push(r);
  });
  const retireTotal = retireArr.length;
  const retireFemale = retireArr.filter(r => (r.gender || '').toString() === 'Female' || (r.gender || '').toString() === 'ស្រី').length;

  // Category counts using same map as Dashboard
  const catMap = {
    civil: ['មន្ត្រីរាជការ','Civil','civil'],
    state: ['កិច្ចសន្យារដ្ឋ','State','state'],
    hospital: ['កិច្ចសន្យាមន្ទីរពេទ្យ','hospital','hospitalPlus'],
    contract: ['កិច្ចសន្យា','contract','កម្មករកិច្ចសន្យា','WORKER']
  };
  const counts = { civil: { total:0, female:0 }, state: { total:0, female:0 }, hospital: { total:0, female:0 }, contract: { total:0, female:0 } };
  rows.forEach(r => {
    const ot = (r.officerType || '').toString() || '';
    const lc = ot.toString().toLowerCase();
    const gender = (r.gender || '').toString();
    for (const key of Object.keys(catMap)) {
      const tokens = catMap[key];
      const matches = tokens.some(t => {
        const tt = (t || '').toString().toLowerCase();
        return lc.includes(tt) || parseText(r).includes(tt);
      });
      if (matches) {
        counts[key].total++;
        if (gender === 'Female' || gender === 'ស្រី') counts[key].female++;
        break;
      }
    }
  });

  console.log('\nRetirement totals:');
  console.log('Total retired:', retireTotal);
  console.log('Female retired:', retireFemale);

  console.log('\nCategory counts:');
  for (const k of Object.keys(counts)) {
    console.log(`${k}: total=${counts[k].total}  female=${counts[k].female}`);
  }

  // Show small samples
  console.log('\nSample retired rows (up to 10):');
  retireArr.slice(0,10).forEach((r,i) => {
    console.log(i+1, '-', r._id || r.no || r.staffId, '|', r.khmerName || r.name || '', '| gender:', r.gender || '', '| officerType:', r.officerType || r.position || '', '| reason:', r.civilServantReason || r.reason || '');
  });

  await mongoose.disconnect();
  process.exit(0);
};

main().catch(e => { console.error(e); process.exit(1); });
