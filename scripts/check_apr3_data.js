import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function check() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}), 'attendances');
  const AttendanceDayData = mongoose.model('AttendanceDayData', new mongoose.Schema({}), 'attendancedaydatas');

  const targetDateStr = '2026-04-03';
  const start = new Date(targetDateStr);
  const end = new Date(targetDateStr);
  end.setHours(23, 59, 59, 999);

  console.log('Searching between (local server time):', start.toISOString(), 'to', end.toISOString());

  const raws = await Attendance.find({ date: { $gte: start, $lte: end } }).lean();
  console.log('Found in Attendance (raw):', raws.length);

  const imported = await AttendanceDayData.find({ date: { $gte: start, $lte: end } }).lean();
  console.log('Found in AttendanceDayData (imported):', imported.length);

  // Check UTC range too
  const startUTC = new Date(Date.UTC(2026, 3, 3));
  const endUTC = new Date(Date.UTC(2026, 3, 3, 23, 59, 59, 999));
  console.log('Searching between (UTC):', startUTC.toISOString(), 'to', endUTC.toISOString());

  const rawsUTC = await Attendance.find({ date: { $gte: startUTC, $lte: endUTC } }).lean();
  console.log('Found in Attendance (UTC):', rawsUTC.length);

  const importedUTC = await AttendanceDayData.find({ date: { $gte: startUTC, $lte: endUTC } }).lean();
  console.log('Found in AttendanceDayData (UTC):', importedUTC.length);

  if (rawsUTC.length > 0) {
      console.log('Sample Attendance record date:', rawsUTC[0].date);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
