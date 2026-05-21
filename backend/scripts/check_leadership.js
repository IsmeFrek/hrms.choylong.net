import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HR from '../models/HR.js';
import WorkSchedule from '../models/WorkSchedule.js';

dotenv.config();

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    const year = 2026;
    const month = 4;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    console.log(`Diagnosing for ${year}-${month}...`);

    // 1. Find the 9 employees in "ថ្នាក់ដឹកនាំ"
    const leadershipEmps = await HR.find({
      Department_Kh: /ថ្នាក់ដឹកនាំ/,
      status: 'Active'
    });

    console.log(`Found ${leadershipEmps.length} active employees in Leadership.`);

    for (const emp of leadershipEmps) {
      const schedules = await WorkSchedule.find({
        employeeId: emp._id,
        date: { $gte: startDate, $lte: endDate }
      });

      console.log(`- ${emp.khmerName} (${emp.staffId || emp.cardNumber}): _id=${emp._id}, Schedules Count=${schedules.length}`);
      
      if (schedules.length > 0) {
        const first = schedules[0];
        console.log(`  Sample: Date=${first.date.toISOString()}, Title="${first.shiftTitle}", Start="${first.shiftStart}", End="${first.shiftEnd}"`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

diagnose();
