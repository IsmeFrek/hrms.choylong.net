import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const AttendanceSummarySchema = new mongoose.Schema({
  staffId: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  year: { type: Number, default: 0, index: true },
  month: { type: Number, default: 0, index: true },
}, { strict: false });

const AttendanceSummary = mongoose.model('AttendanceSummary', AttendanceSummarySchema, 'attendance-summary');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
  console.log('Connected to DB');

  const records = await AttendanceSummary.find({}).lean();
  const map = {};
  for (const r of records) {
    const key = `${r.staffId.toLowerCase()}-${r.year}-${r.month}`;
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(r);
  }

  let dupCount = 0;
  for (const [key, list] of Object.entries(map)) {
    if (list.length > 1) {
      dupCount++;
      console.log(`Duplicate found for key ${key}:`);
      console.log(list.map(x => ({ _id: x._id, staffId: x.staffId, name: x.name, year: x.year, month: x.month })));
    }
  }
  
  console.log(`Total duplicate groups: ${dupCount}`);
  process.exit(0);
}

main().catch(console.error);
