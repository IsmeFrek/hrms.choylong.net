import mongoose from 'mongoose';
import HR from '../models/hr.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

(async () => {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

    const q = {
      $and: [
        { officerType: { $regex: 'កម្មករកិច្ចសន្យា|កិច្ចសន្យ', $options: 'i' } },
        { $or: [
          { resignationReason: { $regex: 'ចូលនិវត្ត|មន្រ្តីដែលចូលនិវត្តន៍', $options: 'i' } },
          { note: { $regex: 'ចូលនិវត្ត|មន្រ្តីដែលចូលនិវត្តន៍', $options: 'i' } },
          { resignationReason: { $regex: '\\(បន្តជា.*កិច្ចសន្យា', $options: 'i' } }
        ] }
      ]
    };

    const count = await HR.countDocuments(q);
    const docs = await HR.find(q)
      .select('_id staffId no name khmerName officerType resignationReason note dob')
      .lean();

    console.log(JSON.stringify({ count, docs }, null, 2));
  } catch (e) {
    console.error('Error querying HR:', e && e.message ? e.message : e);
    process.exitCode = 2;
  } finally {
    try { await mongoose.disconnect(); } catch (_) {}
  }
})();
