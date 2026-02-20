import mongoose from 'mongoose';
import AttendanceDayData from '../models/AttendanceDayData.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB:', MONGODB_URI);
    const count = await AttendanceDayData.countDocuments();
    console.log('AttendanceDayData count:', count);
    const samples = await AttendanceDayData.find().sort({ date: -1 }).limit(20).lean();
    console.log('Samples (up to 20):');
    samples.forEach(s => {
      console.log({ staffId: s.staffId, name: s.name, date: s.date ? s.date.toISOString().slice(0,10) : null, checkIn: s.checkIn, checkOut: s.checkOut, workTime: s.workTime });
    });
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error listing attendance day data:', e);
    try { await mongoose.disconnect(); } catch (e2) {}
    process.exit(1);
  }
}

main();
