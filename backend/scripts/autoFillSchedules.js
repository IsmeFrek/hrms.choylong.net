import mongoose from 'mongoose';
import HR from '../models/HR.js';
import WorkSchedule from '../models/WorkSchedule.js';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Script to automatically fill the work schedule for March 2026
 * for specific administrative and technical departments.
 */

const targetDepartments = [
  'ថ្នាក់ដឹកនាំ',
  'ការិយាល័យរដ្ឋបាល និងបុគ្គលិក',
  'ការិយាល័យហិរញ្ញវត្ថុ',
  'ការិយាល័យបច្ចេកទេស',
  'ផ្នែកព័ត៌មានវិទ្យា',
  'ផ្នែកជួសជុលថែទាំសម្ភារបរិក្ខារ អគ្គិសនី និងទឹក',
  'ផ្នែកថែទាំ'
];

async function autoFill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kshf_hospital_app');
    console.log('MongoDB connected');

    const year = 2026;
    const month = 3; // 3 = April (0-indexed in JS Date)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 14-16 April are Khmer New Year
    const holidays = [14, 15, 16];

    // Find all employees in target departments
    const employees = await HR.find({
      Department_Kh: { $in: targetDepartments },
      status: 'Active'
    });

    console.log(`Found ${employees.length} employees in standard departments.`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const emp of employees) {
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d, 0, 0, 0);
        const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat

        // Check if schedule already exists
        const existing = await WorkSchedule.findOne({ employeeId: emp._id, date });
        if (existing) {
          skippedCount++;
          continue;
        }

        let shiftTitle = 'Work';
        let shiftStart = '07:30';
        let shiftEnd = '15:30';
        let shiftColor = '#0b74de';

        // Weekend or Holiday
        if (dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(d)) {
          shiftTitle = 'Day Off';
          shiftStart = '';
          shiftEnd = '';
          shiftColor = '#ff0000';
        }

        await new WorkSchedule({
          employeeId: emp._id,
          date,
          shiftTitle,
          shiftStart,
          shiftEnd,
          shiftColor
        }).save();

        createdCount++;
      }
    }

    console.log(`Auto-fill complete!`);
    console.log(`Created: ${createdCount} records`);
    console.log(`Skipped: ${skippedCount} existing records`);

    process.exit(0);
  } catch (err) {
    console.error('Error during auto-fill:', err);
    process.exit(1);
  }
}

autoFill();
