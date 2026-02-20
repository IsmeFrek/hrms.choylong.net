import mongoose from 'mongoose';
import HR from './models/HR.js';

async function checkHRCount() {
  try {
    await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
    console.log('Connected to MongoDB');
    
    const count = await HR.countDocuments();
    console.log('\n=================================');
    console.log(`Total HR records: ${count}`);
    console.log('=================================\n');
    
    if (count > 0) {
      console.log('Sample records (first 10):');
      const samples = await HR.find()
        .limit(10)
        .select('khmerName staffId Department_Kh')
        .lean();
      
      samples.forEach((hr, i) => {
        console.log(`${i + 1}. ${hr.khmerName || 'N/A'} (ID: ${hr.staffId || hr._id}) - ${hr.Department_Kh || 'N/A'}`);
      });
      
      console.log('\n=================================');
      console.log(`Total shown: 10 / ${count}`);
      console.log('=================================');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkHRCount();
