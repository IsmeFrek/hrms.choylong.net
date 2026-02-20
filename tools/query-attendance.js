#!/usr/bin/env node
import mongoose from 'mongoose';
import Attendance from '../backend/models/Attendance.js';

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  console.log('Connecting to', MONGO);
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  } catch (e) {
    console.error('Failed to connect to MongoDB:', e.message || e);
    process.exit(1);
  }

  try {
    const docs = await Attendance.find({}).sort({ date: -1 }).limit(20).lean();
    if (!docs || docs.length === 0) {
      console.log('No attendance documents found.');
    } else {
      console.log(`Found ${docs.length} attendance documents (most recent first):`);
      docs.forEach((d, i) => {
        console.log(`\n#${i+1} staffId=${d.staffId} date=${d.date ? new Date(d.date).toISOString().slice(0,19).replace('T',' ') : ''}`);
        console.log(JSON.stringify(d, null, 2));
      });
    }
  } catch (e) {
    console.error('Query failed:', e.message || e);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
