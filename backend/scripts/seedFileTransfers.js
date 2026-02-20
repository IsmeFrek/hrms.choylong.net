import mongoose from 'mongoose';
import FileTransfer from '../models/FileTransfer.js';
import dotenv from 'dotenv';

dotenv.config();

// Single sample record (ទិន្នន័យ១)
const sample = {
  title: 'លិខិតចូល',
  type: 'លិខិតចូល',
  letterNo: 'LC-SEED-001',
  entryNo: 'E-SEED-001',
  date: new Date('2025-11-19'),
  source: 'សាកលវិទ្យាល័យ',
  qty: 1,
  attachments: ['/Uploads/seed-scan.pdf'],
  content: 'សំណើរសុំរួមចំណែក',
  others: '-',
  status: 'pending',
  is_new: true,
  handler: 'ស Test',
  meta: { seededBy: 'seedFileTransfers.js' }
};

const seedOne = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Insert sample record if it doesn't already exist (by letterNo)
    const exists = await FileTransfer.findOne({ letterNo: sample.letterNo });
    if (exists) {
      console.log('Sample record already exists. Skipping insert.');
      console.log('Existing record id:', exists._id.toString());
      process.exit(0);
    }

    const created = await FileTransfer.create(sample);
    console.log('Inserted sample FileTransfer with id:', created._id.toString());

    process.exit(0);
  } catch (err) {
    console.error('Error inserting sample FileTransfer:', err);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  seedOne();
}

export default seedOne;
