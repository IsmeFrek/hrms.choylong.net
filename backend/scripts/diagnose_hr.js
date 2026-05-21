import mongoose from 'mongoose';
import HR from '../models/HR.js';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Diagnostic script to check why some employees are not caught by the auto-fill logic.
 */

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kshf_hospital_app');
    console.log('MongoDB connected');

    // List all unique departments to see if there are spacing issues
    const allDeps = await HR.distinct('Department_Kh');
    console.log('Unique Departments in DB:', JSON.stringify(allDeps, null, 2));

    // Check specific employees from the screenshot
    const namesToCheck = ['ជុំ ផល', 'ឡាយ វិចិត្រ', 'មាស មាន', 'ខេង ពិសិដ្ឋ', 'ហេង វិបុល'];
    const emps = await HR.find({
      $or: [
        { khmerName: { $in: namesToCheck } },
        { staffId: { $in: ['D0001', 'D0002', 'D0007', 'D0020'] } }
      ]
    }, 'khmerName staffId Department_Kh position status');

    console.log('\nEmployee Data:');
    emps.forEach(e => {
      console.log(`- ${e.khmerName} (${e.staffId}): Dept="${e.Department_Kh}", Pos="${e.position}", Status="${e.status}"`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

diagnose();
