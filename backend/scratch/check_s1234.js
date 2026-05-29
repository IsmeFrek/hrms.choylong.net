import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const emp = await Employee.findOne({ staffId: "S1234" });
    if (emp) console.log(emp.staffId, emp.skill, emp.degreeLevel);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
