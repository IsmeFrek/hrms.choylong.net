import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const filter = {
      skill: "គិលានុបដ្ឋាកមធ្យម",
      $or: [
        { civilServantRole: "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)" },
        { degree: "បរិញ្ញាបត្រ" },
        { degreeLevel: "បរិញ្ញាបត្រ" }
      ]
    };
    const result = await Employee.updateMany(
      filter,
      { $set: { skill: "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)" } }
    );
    console.log('Updated:', result.modifiedCount);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
