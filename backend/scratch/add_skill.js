import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

import Skill from '../models/Skill.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const existing = await Skill.findOne({ skills_Kh: "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)" });
    if (!existing) {
      const lastSkill = await Skill.findOne().sort({ ID_skills: -1 });
      let nextId = 1;
      if (lastSkill && lastSkill.ID_skills) {
        const parsed = parseInt(lastSkill.ID_skills, 10);
        if (!isNaN(parsed)) {
          nextId = parsed + 1;
        }
      }
      
      const newSkill = new Skill({
        ID_skills: String(nextId),
        skills_Kh: "គិលានុបដ្ឋាក (បរិញ្ញាបត្រ)",
        skills_En: "Nurse (Bachelor)",
      });
      await newSkill.save();
      console.log('Added គិលានុបដ្ឋាក (បរិញ្ញាបត្រ) to skills');
    } else {
      console.log('Skill already exists');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
