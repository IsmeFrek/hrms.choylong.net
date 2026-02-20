import mongoose from 'mongoose';
import HR from '../models/hr.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

const targetNames = [
  {k: 'ជូ សុខប៊ន', e: 'ចូលនិវត្តន៍ (បន្តជា​កិច្ចសន្យា)', id: 'W0009'}
];

(async () => {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    for (const t of targetNames) {
      console.log('Searching for:', t);
      const q = {
        $or: [
          { staffId: { $regex: (t.id||''), $options: 'i' } },
          { khmerName: { $regex: (t.k||''), $options: 'i' } },
          { name: { $regex: (t.e||''), $options: 'i' } }
        ]
      };
      const docs = await HR.find(q)
        .select('_id no staffId khmerName name officerType status resignDate resignationDate resignationReason resignationDocument note position dob')
        .lean();
      console.log(JSON.stringify(docs, null, 2));
    }
  } catch (e) {
    console.error('Error', e && e.message);
    process.exitCode = 2;
  } finally {
    try { await mongoose.disconnect(); } catch(_){}
  }
})();
