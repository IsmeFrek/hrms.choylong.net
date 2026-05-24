import mongoose from 'mongoose';
import HR from './models/HR.js';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');

  const hr = await HR.findOne({ khmerName: /សៀក ម៉េង/ });
  if (hr) {
    if (!hr.roleHistory) hr.roleHistory = [];
    // Ensure we don't duplicate
    const exists = hr.roleHistory.find(r => r.position === 'នាយផ្នែក' && r.department === 'កុមារ');
    if (!exists) {
      hr.roleHistory.push({
        position: 'នាយផ្នែក', 
        department: 'កុមារ', 
        startDate: new Date('2020-01-01'), 
        endDate: new Date('2026-05-18T23:59:59Z') 
      });
      await hr.save();
      console.log('Fixed historical role for:', hr.khmerName);
    } else {
      console.log('Historical role already exists for:', hr.khmerName);
    }
  } else {
    console.log('Seak Meng not found.');
    const hrs = await HR.find({ khmerName: /ម៉េង/ }).select('khmerName name staffId position Department_Kh').lean();
    console.log('Other Mengs:', hrs);
  }

  process.exit(0);
}

run();
