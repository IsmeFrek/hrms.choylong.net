import mongoose from 'mongoose';
import HR from '../models/hr.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

(async () => {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

    const orig = await HR.findOne({ staffId: /W0009/i }).lean();
    if (!orig) {
      console.error('Original record W0009 not found');
      process.exitCode = 2;
      return;
    }

    // compute retirement date as dob + 60 years
    let resignDate = null;
    if (orig.dob) {
      const d = new Date(orig.dob);
      resignDate = new Date(Date.UTC(d.getFullYear() + 60, d.getMonth(), d.getDate()));
    } else {
      // fallback to 2010-01-01
      resignDate = new Date(Date.UTC(2010,0,1));
    }

    const newStaffId = String(orig.staffId) + '-retired';

    const newDoc = new HR({
      staffId: newStaffId,
      khmerName: orig.khmerName,
      name: orig.name,
      dob: orig.dob,
      position: orig.position,
      officerType: 'មន្រ្តីរាជការ',
      status: 'Resigned',
      resignationDate: resignDate.toISOString().slice(0,10),
      resignationReason: 'ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)'
    });

    await newDoc.save();
    console.log('Created new civil-servant retired record with staffId:', newStaffId);
    const inserted = await HR.findOne({ staffId: newStaffId }).lean();
    console.log(JSON.stringify(inserted, null, 2));
  } catch (e) {
    console.error('Error creating retired record:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try { await mongoose.disconnect(); } catch(_){}
  }
})();
