import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HR from '../models/HR.js';
import WorkSchedule from '../models/WorkSchedule.js';

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- DATABASE CHECK ---');

    const year = 2026;
    const month = 4;
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59);

    // 1. Check target employees
    const targetDepts = ['ថ្នាក់ដឹកនាំ'];
    const regex = new RegExp(`^\\s*ថ្នាក់ដឹកនាំ\\s*$`, 'i');
    const employees = await HR.find({ Department_Kh: regex, status: 'Active' });

    console.log(`Employees Found in "ថ្នាក់ដឹកនាំ": ${employees.length}`);
    
    for (const emp of employees) {
      const count = await WorkSchedule.countDocuments({
        employeeId: emp._id,
        date: { $gte: start, $lte: end }
      });
      console.log(`- ${emp.khmerName} (${emp.staffId}): ID=${emp._id}, Records=${count}`);
      
      if (count > 0) {
        const sample = await WorkSchedule.findOne({ employeeId: emp._id, date: { $gte: start, $lte: end } });
        console.log(`  Sample: ${sample.date.toISOString()} -> ${sample.shiftTitle}`);
      }
    }

    console.log('----------------------');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
