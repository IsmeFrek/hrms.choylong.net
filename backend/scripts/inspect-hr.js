import mongoose from 'mongoose';
import HR from '../models/hr.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

(async () => {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    const q = {
      $or: [
        { staffId: { $regex: 'W0009', $options: 'i' } },
        { khmerName: { $regex: 'CHOU|SOKBORN', $options: 'i' } },
        { name: { $regex: 'CHOU|SOKBORN', $options: 'i' } }
      ]
    };
    const docs = await HR.find(q)
      .select('_id no staffId khmerName name officerType status resignDate resignationDate resignationReason resignationDocument note position dob')
      .lean();
    console.log(JSON.stringify(docs, null, 2));
  } catch (e) {
    console.error('Inspect script error:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try { await mongoose.disconnect(); } catch(_){}
  }
})();
