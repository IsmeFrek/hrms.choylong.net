import mongoose from 'mongoose';
import HR from './models/HR.js';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
  const hrs = await HR.find({
    khmerName: { $in: ['វ៉ាត សាវ៉ាន់', 'ណយ ពិសី', 'វ៉ា វ៉ាន់ធី', 'ហ៊ុយ ស្រ៊ុយ', 'ឃឹម ប្រពៃ', 'គា រតនា'] }
  });
  console.log(`Found ${hrs.length} employees`);
  hrs.forEach(hr => {
    console.log(`- ${hr.khmerName}: skill="${hr.skill}", civilServantRole="${hr.civilServantRole}"`);
  });
  process.exit(0);
}
run().catch(console.error);
