import mongoose from 'mongoose';
import AttendanceDailyReport from '../models/AttendanceDailyReport.js';
import HR from '../models/HR.js';
import WorkSchedule from '../models/WorkSchedule.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  
  const ids = ['D0287', 'D0516', 'D0534', 'S0896', 'S0762', 'S0894'];
  console.log('--- Checking IDs:', ids.join(', '), ' ---');
  
  for (const id of ids) {
    const hr = await HR.findOne({ staffId: id });
    console.log(`\n[${id}] HR Record:`, hr ? `Found (ID: ${hr._id}, Category: ${hr.officerType})` : 'NOT FOUND');
    
    if (hr) {
      const schedule = await WorkSchedule.findOne({ employeeId: hr._id });
      console.log(`[${id}] WorkSchedule:`, schedule ? `Found (${schedule.shiftStart} - ${schedule.shiftEnd})` : 'NOT FOUND');
    }
    
    const daily = await AttendanceDailyReport.findOne({ staffId: id }).sort({ date: -1 });
    if (daily) {
      console.log(`[${id}] Daily Report (${daily.date.toISOString().slice(0, 10)}): Status: ${daily.status}, Type: "${daily.leaveType}", Reason: "${daily.leaveReason}"`);
    } else {
      console.log(`[${id}] Daily Report: NOT FOUND`);
    }
  }
  
  process.exit(0);
}

run();
