import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const emps = await Employee.find({ skill: { $regex: /គិលានុបដ្ឋាក-ឆ្មប/ } });
    console.log(`Found ${emps.length} with គិលានុបដ្ឋាក-ឆ្មប in skill:`);
    for (const emp of emps) {
      console.log(`${emp.staffId} | skill: ${emp.skill}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
