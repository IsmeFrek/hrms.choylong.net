import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const emps = await Employee.find({ skill: "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)" });
    console.log(`សរុបអ្នកមាន ksfhSkill "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)": ${emps.length} នាក់`);
    
    // Group by department
    const byDept = {};
    emps.forEach(e => {
      const dept = e.Department_Kh || 'មិនមានផ្នែក';
      byDept[dept] = (byDept[dept] || 0) + 1;
    });
    
    const sorted = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
    for (const [dept, count] of sorted) {
      console.log(`- ${dept}: ${count} នាក់`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
