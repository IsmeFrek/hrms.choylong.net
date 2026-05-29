import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: './.env'});
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const Skill = db.collection('skills');
  const skills = await Skill.find({}).toArray();
  console.log('Found: ' + skills.length);
  skills.forEach(s => {
    console.log(s.skills_Kh + ' - ' + s.skills_En);
  });
  process.exit(0);
});
