import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import the HR model to ensure schema is registered
await import('../models/hr.js');
const HR = mongoose.model('HR');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

const parseLike = (v) => {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    d.setHours(0,0,0,0);
    return d;
  } catch (e) { return null; }
};

const isExplicitlyRemoved = (emp) => {
  try {
    const del = emp && emp.delisted ? emp.delisted : {};
    return Boolean(emp.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || emp.dateRemovedFromDataset || emp.removalDate);
  } catch (e) { return false; }
};

async function run() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', uri);
  const hrList = await HR.find().lean();
  console.log('Total HR records:', hrList.length);
  const today = new Date(); today.setHours(0,0,0,0);

  const enriched = (hrList || []).map(h => {
    const del = (h && h.delisted) ? h.delisted : {};
    const dateStr = del.dateDelisted || del.date || h.resignationDate || h.resignDate || h.dateLeft || h.leftDate || h.departureDate || null;
    const removedStr = h.dateRemoved || (del && (del.dateRemoved || del.date_removed)) || h.dateRemovedFromDataset || h.removalDate || null;
    const parsedDel = parseLike(dateStr);
    const parsedRemoved = parseLike(removedStr);
    const isPrepared = (parsedDel && parsedDel.getTime() > today.getTime()) || (parsedRemoved && parsedRemoved.getTime() > today.getTime());
    return { ...h, __isPreparedForDeletion: !!isPrepared };
  });

  const explicitlyRemovedList = enriched.filter(isExplicitlyRemoved);
  const preparedList = enriched.filter(emp => Boolean(emp.__isPreparedForDeletion));
  const activeByStatus = enriched.filter(e => (e.status || '').toString().toLowerCase() === 'active');
  const activeList = enriched.filter(e => {
    const s = (e.status || '').toString().toLowerCase();
    if (s !== 'active') return false;
    if (e.__isPreparedForDeletion) return false;
    if (isExplicitlyRemoved(e)) return false;
    return true;
  });

  console.log('Explicitly removed count:', explicitlyRemovedList.length);
  console.log('Prepared-for-deletion count:', preparedList.length);
  console.log('Active by status count:', activeByStatus.length);
  console.log('Active after exclusions (dashboard active):', activeList.length);

  console.log('\nSamples: explicitly removed (up to 5):');
  explicitlyRemovedList.slice(0,5).forEach(e => console.log({ _id: e._id, name: e.name, dateRemoved: e.dateRemoved || (e.delisted && (e.delisted.dateRemoved || e.delisted.date_removed)) || e.dateRemovedFromDataset || e.removalDate }));

  console.log('\nSamples: prepared-for-deletion (up to 5):');
  preparedList.slice(0,5).forEach(e => console.log({ _id: e._id, name: e.name, __isPreparedForDeletion: e.__isPreparedForDeletion, sampleDates: { delisted: e.delisted && (e.delisted.dateDelisted || e.delisted.date), resignationDate: e.resignationDate, dateRemoved: e.dateRemoved } }));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error in inspect script:', err);
  process.exit(1);
});
