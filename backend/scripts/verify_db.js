import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HR from '../models/HR.js';
import WorkSchedule from '../models/WorkSchedule.js';

dotenv.config();

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- DB VERIFICATION ---');

    const year = 2026;
    const month = 4;
    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59);

    const depts = ['ថ្នាក់ដឹកនាំ'];
    const employees = await HR.find({ 
      Department_Kh: { $in: [/^.*ថ្នាក់ដឹកនាំ.*$/i] },
      status: 'Active' 
    });

    console.log(`Found ${employees.length} leadership employees.`);

    for (const emp of employees) {
      const count = await WorkSchedule.countDocuments({
        employeeId: emp._id,
        date: { $gte: start, $lte: end }
      });
      console.log(`- ${emp.khmerName} (${emp.staffId}): ${count} records`);
    }

    const totalInMonth = await WorkSchedule.countDocuments({
      date: { $gte: start, $lte: end }
    });
    console.log(`Total schedules in April 2026: ${totalInMonth}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verify();
