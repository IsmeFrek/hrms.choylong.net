import mongoose from 'mongoose';
import AttendanceDayData from '../models/AttendanceDayData.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB:', MONGODB_URI);

    const cursor = AttendanceDayData.find().cursor();
    let changed = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const wt = Number(doc.workTime) || 0;
      // Heuristic: if workTime > 24 assume it's minutes and convert to hours
      if (wt > 24) {
        const hours = Math.round((wt / 60) * 100) / 100;
        doc.workTime = hours;
        await doc.save();
        console.log('Converted', doc.staffId, 'date', doc.date ? doc.date.toISOString().slice(0,10) : '', '->', hours);
        changed++;
      }
    }
    console.log('Done. Documents changed:', changed);
    await mongoose.disconnect();
  } catch (e) {
    console.error('Migration failed', e);
    try { await mongoose.disconnect(); } catch (e2) {}
    process.exit(1);
  }
}

main();
