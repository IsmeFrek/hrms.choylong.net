import mongoose from 'mongoose';
import dotenv from 'dotenv';
import HR from '../models/HR.js';

dotenv.config();

async function audit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- LEADERSHIP HR AUDIT ---');

    // Find all employees that we suspect are in leadership
    const keywords = ['ងី ម៉េង', 'ចាន់ វិចិត្រ', 'លឹម តាំង', 'អ៊ុំ សោភារិទ្ធិ', 'សៅ សីហា', 'ស៊ាន វិចិត្រ'];
    
    // Search by names to see their ACTUAL department string
    const employees = await HR.find({
      $or: [
        { khmerName: { $in: keywords } },
        { staffId: { $in: ['D0001', 'D0002', 'D0007', 'D0020', 'D0019', 'D0196', 'P0010', 'D0432', 'D0539'] } }
      ]
    });

    console.log(`Found ${employees.length} employees to audit.`);

    for (const emp of employees) {
      console.log(`- Name: ${emp.khmerName}, ID: ${emp.staffId}, Dept_Kh: "${emp.Department_Kh}", Status: ${emp.status}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

audit();
