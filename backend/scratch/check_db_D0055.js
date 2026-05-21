import mongoose from 'mongoose';
import AttendanceDailyReport from '../models/AttendanceDailyReport.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkRecord() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kshf_hospital_app';
  console.log("Connecting to:", uri);
  try {
    await mongoose.connect(uri);
    const record = await AttendanceDailyReport.findOne({ staffId: 'D0055' });
    console.log("Record D0055 Details:");
    console.log(JSON.stringify(record, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

checkRecord();
