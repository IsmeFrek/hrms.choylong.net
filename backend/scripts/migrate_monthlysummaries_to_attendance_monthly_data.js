#!/usr/bin/env node
import mongoose from 'mongoose';

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGO);

  const oldSchema = new mongoose.Schema({}, { strict: false });
  const newSchema = new mongoose.Schema({}, { strict: false });

  const Old = mongoose.model('OldMonthlySummary', oldSchema, 'monthlysummaries');
  const New = mongoose.model('NewMonthlySummary', newSchema, 'attendance-monthly-data');

  const docs = await Old.find().lean();
  console.log('Found', docs.length, 'documents in monthlysummaries');

  let migrated = 0;
  for (const d of docs) {
    try {
      const filter = { staffId: d.staffId, year: d.year, month: d.month };
      const toSet = { ...d };
      delete toSet._id;
      toSet.updatedAt = new Date();
      await New.findOneAndUpdate(filter, { $set: toSet }, { upsert: true });
      migrated++;
    } catch (e) {
      console.error('Failed migrating', d?._id, e.message);
    }
  }

  console.log('Migrated', migrated, 'documents to attendance-monthly-data');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
