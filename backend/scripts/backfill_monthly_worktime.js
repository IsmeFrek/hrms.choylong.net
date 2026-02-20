// Script: backfill_monthly_worktime.js
// Sums workTime from dailyData for each monthly summary and updates workTime (in minutes)
import mongoose from 'mongoose';
import MonthlySummary from '../models/MonthlySummary.js';

const MONGO_URI = 'mongodb://localhost:27017/kshf_hospital_app';

function sumWorkMinutes(dailyData) {
  let total = 0;
  if (!Array.isArray(dailyData)) return 0;
  for (const d of dailyData) {
    if (d.workTime && !isNaN(Number(d.workTime))) {
      let v = Number(d.workTime);
      if (v < 24 && String(d.workTime).indexOf('.') !== -1) {
        total += Math.round(v * 60);
      } else {
        total += Math.round(v);
      }
    } else if (d.checkIn && d.checkOut) {
      const parseHM = (s) => {
        if (!s) return null;
        const m = String(s).match(/^(\d{1,2}):(\d{2})$/);
        if (m) return Number(m[1]) * 60 + Number(m[2]);
        const dt = new Date(s);
        if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
        return null;
      };
      const inMin = parseHM(d.checkIn);
      const outMin = parseHM(d.checkOut);
      if (inMin !== null && outMin !== null && outMin > inMin) {
        total += outMin - inMin;
      }
    }
  }
  return total;
}

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const all = await MonthlySummary.find({}).lean();
  let updated = 0;
  for (const row of all) {
    if (Array.isArray(row.dailyData) && row.dailyData.length > 0) {
      const total = sumWorkMinutes(row.dailyData);
      if (typeof total === 'number' && total !== row.workTime) {
        await MonthlySummary.updateOne({ _id: row._id }, { $set: { workTime: total } });
        updated++;
      }
    }
  }
  console.log(`Updated ${updated} monthly summaries with new workTime.`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
