import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Employee from '../models/Employee.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const emp = await Employee.findOne({ staffId: "S1064" });
    if (emp) {
      console.log('Name:', emp.khmerName);
      console.log('Degree:', emp.degree);
      console.log('Degree Level:', emp.degreeLevel);
      console.log('Civil Servant Role:', emp.civilServantRole);
      console.log('KSFH Skill (skill):', emp.skill);
    } else {
      console.log('Not found');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
