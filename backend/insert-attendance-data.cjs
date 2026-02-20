const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function run() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB:', uri);
  const col = mongoose.connection.collection('attendances');

  const staff = [
    { staffId: 'EMP001', name: 'ឯម ចាន់ដា' },
    { staffId: 'EMP002', name: 'លី សុខ' }
  ];

  const start = new Date(2025, 11, 22); // Dec 22, 2025 (month is 0-based)
  const end = new Date(2026, 0, 21); // Jan 21, 2026

  for (const s of staff) {
    // Remove existing attendance for this staff in range
    await col.deleteMany({ staffId: s.staffId, date: { $gte: start, $lte: end } });

    const docs = [];
    let cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      // Skip weekends
      if (dow !== 0 && dow !== 6) {
        docs.push({
          staffId: s.staffId,
          staffName: s.name,
          date: new Date(cur),
          status: 'present',
          checkIn: '08:00',
          checkOut: '17:00',
          inTime: '08:00',
          outTime: '17:00',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (docs.length) {
      const res = await col.insertMany(docs);
      console.log(`Inserted ${res.insertedCount} attendance docs for ${s.staffId}`);
    } else {
      console.log(`No docs to insert for ${s.staffId}`);
    }
  }

  console.log('Done');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
