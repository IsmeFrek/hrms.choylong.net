import mongoose from 'mongoose';
import HR from '../models/hr.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';
const reason = 'ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)';

(async () => {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

    const ids = ['W0009-retired', 'W0009'];
    for (const id of ids) {
      const res = await HR.findOneAndUpdate({ staffId: new RegExp(`^${id}$`, 'i') }, { $set: { civilServantReason: reason } }, { new: true }).lean();
      if (res) {
        console.log(`Updated ${res.staffId} -> civilServantReason set`);
      } else {
        console.log(`No record found for ${id}`);
      }
    }

    // Show both records
    const docs = await HR.find({ staffId: /W0009/i }).select('_id staffId officerType status resignationDate resignationReason civilServantReason').lean();
    console.log(JSON.stringify(docs, null, 2));
  } catch (e) {
    console.error('Error setting civilServantReason:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try { await mongoose.disconnect(); } catch(_){}
  }
})();
