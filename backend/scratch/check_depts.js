import mongoose from 'mongoose';

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/kshf_hospital_app');
    console.log('Connected to MongoDB');

    const HR = mongoose.model('HR', new mongoose.Schema({}, { strict: false }), 'hrs');
    
    const count = await HR.countDocuments();
    console.log('Total HR records:', count);

    const departments = await HR.distinct('Department_Kh');
    console.log('Unique Department_Kh values:', JSON.stringify(departments, null, 2));

    const sample = await HR.findOne({ Department_Kh: { $exists: true, $ne: '' } });
    if (sample) {
      console.log('Sample record with Department_Kh:', {
        _id: sample._id,
        khmerName: sample.khmerName,
        Department_Kh: sample.Department_Kh
      });
    } else {
      console.log('No records found with non-empty Department_Kh');
      // Let's check some keys of the first record
      const first = await HR.findOne();
      if (first) {
        console.log('First record keys:', Object.keys(first.toObject()));
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
