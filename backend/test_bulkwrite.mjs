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
  
  const ops = [
    {
      updateOne: {
        filter: { staffId: 'TEST_DUP', year: 2026, month: 5 },
        update: { $set: { name: 'First' } },
        upsert: true
      }
    },
    {
      updateOne: {
        filter: { staffId: 'TEST_DUP', year: 2026, month: 5 },
        update: { $set: { name: 'Second' } },
        upsert: true
      }
    }
  ];

  try {
    await AttendanceSummary.bulkWrite(ops, { ordered: false });
    console.log('Bulk write success');
  } catch (err) {
    console.error('Bulk write error:', err.message);
  }

  // Cleanup
  await AttendanceSummary.deleteMany({ staffId: 'TEST_DUP' });
  process.exit(0);
}

main().catch(console.error);
