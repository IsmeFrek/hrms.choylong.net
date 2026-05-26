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
  
  const y = 2026;
  const mo = 5; // Or try month 4, etc.

  const records = await AttendanceSummary.find({ year: y, month: mo }).lean();
  
  const map = {};
  const dups = [];
  
  for (const r of records) {
    const sid = String(r.staffId || '').trim().toLowerCase();
    if (map[sid]) {
      dups.push(sid);
      console.log('Duplicate in query response for staffId:', sid, 'records:', map[sid], r);
    } else {
      map[sid] = r;
    }
  }

  console.log(`Found ${dups.length} duplicates for ${y}-${mo}. Total records: ${records.length}`);
  process.exit(0);
}

main().catch(console.error);
