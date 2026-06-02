import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const emps = await Employee.find({
      $or: [
        { degree: { $regex: /ឆ្មប/ } },
        { degree: { $regex: /ធ្មប/ } }
      ]
    });
    console.log(`Found ${emps.length} employees with midwife degree:`);
    for (const emp of emps) {
      console.log(`${emp.staffId} | ${emp.khmerName} | degree: ${emp.degree} | degreeLevel: ${emp.degreeLevel} | skill: ${emp.skill} | role: ${emp.civilServantRole}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
