import mongoose from 'mongoose';
import HR from '../models/hr.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';
const AS_OF = process.env.AS_OF_DATE || new Date().toISOString().slice(0,10); // yyyy-mm-dd

function ageOn(dateStr, dob) {
  if (!dob) return null;
  const ref = new Date(dateStr + 'T00:00:00Z');
  const b = new Date(dob);
  let a = ref.getUTCFullYear() - b.getUTCFullYear();
  if (ref.getUTCMonth() < b.getUTCMonth() || (ref.getUTCMonth() === b.getUTCMonth() && ref.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

(async () => {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

    const docs = await HR.find({}).select('staffId khmerName name officerType status resignationDate resignationReason civilServantReason dob gender').lean();

    const groups = new Map();

    for (const d of docs) {
      let key = null;
      if (d.staffId && String(d.staffId).trim()) {
        key = String(d.staffId).replace(/-retired$/i, '').trim().toUpperCase();
      } else {
        const n = (d.name || d.khmerName || '').toString().trim().toUpperCase();
        key = n || '_UNKNOWN_';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }

    let totalGroups = 0;
    const result = { total: 0, male: 0, female: 0, over60: { total:0, male:0, female:0 }, under60: { total:0, male:0, female:0 } };
    const matched = [];

    for (const [k, arr] of groups.entries()) {
      totalGroups++;
      // determine flags
      const hasRetired = arr.some(x => {
        const ot = x.officerType || '';
        if (/មន្រ/.test(ot) || /civil/i.test(ot)) return true;
        if (x.status && String(x.status).toLowerCase() === 'resigned') return true;
        if (x.resignationDate) return true;
        if (x.civilServantReason && /និវត្ត|ចូលនិវត្ត/i.test(x.civilServantReason)) return true;
        if (x.resignationReason && /និវត្ត|ចូលនិវត្ត/i.test(x.resignationReason)) return true;
        return false;
      });
      const hasContract = arr.some(x => {
        const ot = x.officerType || '';
        return /កិច្ចសន្យ|កម្មករ|contract/i.test(ot);
      });
      if (hasRetired && hasContract) {
        // choose representative gender and dob
        const rep = arr.find(x => x.gender) || arr[0] || {};
        const gender = (rep.gender || '').toString();
        const dob = arr.find(x => x.dob && x.dob.toString())?.dob || rep.dob;
        const a = ageOn(AS_OF, dob);
        // increment
        result.total++;
        if (gender.toLowerCase() === 'male' || gender === 'ប្រុស') result.male++;
        if (gender.toLowerCase() === 'female' || gender === 'ស្រី') result.female++;
        // over60/under60: unknown counts as under60 per existing UI logic
        if (a !== null && a >= 60) {
          result.over60.total++;
          if (gender.toLowerCase() === 'male' || gender === 'ប្រុស') result.over60.male++;
          if (gender.toLowerCase() === 'female' || gender === 'ស្រី') result.over60.female++;
        } else {
          result.under60.total++;
          if (gender.toLowerCase() === 'male' || gender === 'ប្រុស') result.under60.male++;
          if (gender.toLowerCase() === 'female' || gender === 'ស្រី') result.under60.female++;
        }
        matched.push({ key: k, items: arr.map(i => ({ staffId: i.staffId, officerType: i.officerType, status: i.status })) });
      }
    }

    console.log('AS_OF_DATE:', AS_OF);
    console.log('totalGroupsScanned:', totalGroups);
    console.log('retiredThenContract summary:');
    console.log(JSON.stringify(result, null, 2));
    console.log('matched sample list (keys and roles):');
    console.log(JSON.stringify(matched, null, 2));

  } catch (e) {
    console.error('Error running report:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try { await mongoose.disconnect(); } catch(_){}
  }
})();
