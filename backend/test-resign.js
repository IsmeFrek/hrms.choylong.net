import mongoose from 'mongoose';
import HR from './models/hr.js';

const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kshf_hospital_app';

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');
  console.log('HR schema status enum ->', HR.schema.path('status')?.enumValues);
  const hr = await HR.findOne().exec();
  if (!hr) {
    console.log('No HR records found');
    process.exit(0);
  }
  console.log('Found HR id=', hr._id.toString(), 'current status=', hr.status);
  hr.status = 'Resigned';
  hr.resignationDate = new Date();
  try {
    await hr.save();
    console.log('Saved successfully with status=', hr.status);
  } catch (err) {
    console.error('Save error:', err && err.message);
    if (err && err.errors) console.error('Errors:', err.errors);
  }
  process.exit(0);
}

run().catch(err=>{ console.error(err); process.exit(1); });
