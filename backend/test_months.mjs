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
  
  const records = await AttendanceSummary.find({}).lean();
  
  const byMonth = {};
  for (const r of records) {
    const k = `${r.year}-${r.month}`;
    byMonth[k] = (byMonth[k] || 0) + 1;
  }

  console.log('Records per month:', byMonth);
  process.exit(0);
}

main().catch(console.error);
