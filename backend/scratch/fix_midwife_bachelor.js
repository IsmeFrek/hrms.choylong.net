import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const result1 = await Employee.updateOne(
      { staffId: "S1064" },
      { $set: { skill: "គិលានុបដ្ឋាក-ឆ្មប (បរិញ្ញាបត្រ)" } }
    );
    const result2 = await Employee.updateOne(
      { staffId: "S1154" },
      { $set: { skill: "គិលានុបដ្ឋាក-ឆ្មប (បរិញ្ញាបត្រ)" } }
    );
    console.log('Updated S1064 and S1154');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
