// Print all dailyData for D0033 in Jan 2026 from AttendanceDayData
import mongoose from 'mongoose';
import AttendanceDayData from '../models/AttendanceDayData.js';

const MONGO_URI = 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 0, 31, 23, 59, 59, 999);
  const rows = await AttendanceDayData.find({ staffId: 'D0033', date: { $gte: start, $lte: end } }).lean();
  console.log(`AttendanceDayData for D0033 Jan 2026: count=${rows.length}`);
  for (const r of rows) {
    console.log(`${r.date.toISOString().slice(0,10)}: checkIn=${r.checkIn} checkOut=${r.checkOut} workTime=${r.workTime}`);
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
