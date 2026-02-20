import mongoose from 'mongoose';
import ShiftGroup from '../models/ShiftGroup.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function normalizeShiftObject(sh) {
  if (!sh) return null;
  const metaObj = sh.meta || (typeof sh === 'object' ? sh : null);
  const resolvedNote = (sh && (sh.notes || sh.note)) || (metaObj && (metaObj.notes || metaObj.note)) || sh?.shortTitle || '';
  const resolvedColor = (sh && sh.color) || (metaObj && metaObj.color) || (sh?.dayOffOnWeekendOrHoliday ? '#c92a2a' : '');
  return {
    ...sh,
    meta: metaObj || undefined,
    note: resolvedNote,
    notes: resolvedNote,
    color: resolvedColor || sh?.color || undefined,
  };
}

async function run() {
  console.log('normalize-shifts: connecting to', MONGODB_URI);
  await mongoose.connect(MONGODB_URI, { dbName: undefined });
  try {
    const cursor = ShiftGroup.find({}).cursor();
    let updatedCount = 0;
    let total = 0;
    for await (const doc of cursor) {
      total++;
      let changed = false;
      const s = doc.toObject();
      const newShifts = Array.isArray(s.shifts) ? await Promise.all(s.shifts.map(async (sh) => {
        const norm = await normalizeShiftObject(sh);
        // if norm differs from original shallowly, mark changed
        if (JSON.stringify(norm) !== JSON.stringify(sh)) changed = true;
        return norm;
      })) : s.shifts;

      if (changed) {
        try {
          await ShiftGroup.findByIdAndUpdate(doc._id, { shifts: newShifts }, { new: true });
          updatedCount++;
          console.log(`updated ${doc._id}`);
        } catch (err) {
          console.error('failed updating', doc._id, err.message || err);
        }
      }
    }
    console.log(`normalize-shifts: processed ${total} documents, updated ${updatedCount}`);
  } catch (err) {
    console.error('normalize-shifts: error', err);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
