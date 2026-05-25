import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const result = await Employee.updateOne(
      { staffId: "S0750" },
      { $set: { skill: "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)" } }
    );
    console.log('Updated:', result.modifiedCount);
    
    const emp = await Employee.findOne({ staffId: "S0750" });
    if (emp) {
      console.log('New skill:', emp.skill);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
