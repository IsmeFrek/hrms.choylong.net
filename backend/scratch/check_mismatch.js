import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const emps = await Employee.find({ 
      skill: "គិលានុបដ្ឋាកមធ្យម",
      $or: [
        { civilServantRole: "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)" },
        { degree: "បរិញ្ញាបត្រ" },
        { degreeLevel: "បរិញ្ញាបត្រ" }
      ]
    });
    console.log('Found:', emps.length);
    emps.forEach(e => console.log(e.khmerName, e.staffId, e.civilServantRole, e.skill, e.degreeLevel, e.degree));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
