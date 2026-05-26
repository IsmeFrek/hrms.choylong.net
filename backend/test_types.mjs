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
  
  const records = await AttendanceSummary.find({}).lean();
  console.log(`Total records: ${records.length}`);
  
  let stringCount = 0;
  for (const r of records) {
    if (typeof r.year !== 'number' || typeof r.month !== 'number') {
      stringCount++;
      console.log('Non-number year/month:', r.staffId, r.year, r.month);
    }
  }

  console.log(`Non-number year/month records: ${stringCount}`);
  process.exit(0);
}

main().catch(console.error);
