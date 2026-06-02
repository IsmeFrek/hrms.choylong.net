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
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app');
  
  const records = await AttendanceSummary.find({ year: 2026, month: 5 }).lean();
  
  const names = {};
  for (const r of records) {
    const n = r.name.trim().toLowerCase();
    if (!names[n]) names[n] = [];
    names[n].push(r.staffId);
  }

  let dupCount = 0;
  for (const [name, ids] of Object.entries(names)) {
    if (ids.length > 1) {
      dupCount++;
      console.log(`Duplicate name: ${name} -> StaffIds:`, ids);
    }
  }

  console.log(`Total duplicate names: ${dupCount}`);
  process.exit(0);
}

main().catch(console.error);
