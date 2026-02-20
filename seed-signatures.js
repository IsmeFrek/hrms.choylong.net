import mongoose from 'mongoose';
import SignSchema from './backend/models/SignSchema.js';

const testSignatures = [
  {
    name: 'sig001',
    fullNameKh: 'សម័យ រលក',
    type: 'employee',
    filePath: '/Uploads/test-sig-001.png',
    description: 'មន្ត្រីទទួលបន្ទុក',
    position: 'មន្ត្រីប្រើប្រាស់',
    department: 'ផ្នែកបច្ចេកទេស',
    status: 'active'
  },
  {
    name: 'sig002',
    fullNameKh: 'ធឿន សោភា',
    type: 'director',
    filePath: '/Uploads/test-sig-002.png',
    description: 'នាយក',
    position: 'នាយក',
    department: 'ការិយាល័យ',
    status: 'active'
  },
  {
    name: 'sig003',
    fullNameKh: 'ល៉ូក ឈឿន',
    type: 'deputy',
    filePath: '/Uploads/test-sig-003.png',
    description: 'អនុនាយក',
    position: 'អនុនាយក',
    department: 'ការិយាល័យ',
    status: 'active'
  },
  {
    name: 'sig004',
    fullNameKh: 'រ៉ូង សូត្រ',
    type: 'office',
    filePath: '/Uploads/test-sig-004.png',
    description: 'ប្រធានការិយាល័យ',
    position: 'ប្រធានការិយាល័យ',
    department: 'ការិយាល័យ',
    status: 'active'
  },
  {
    name: 'sig005',
    fullNameKh: 'គឹម សិលា',
    type: 'employee',
    filePath: '/Uploads/test-sig-005.png',
    description: 'ប្រធាននាយកដ្ឋាន',
    position: 'ប្រធាននាយកដ្ឋាន',
    department: 'នាយកដ្ឋានហិរញ្ញវត្ថុ',
    status: 'active'
  },
  {
    name: 'sig006',
    fullNameKh: 'ស៊ូ ម៉ាក់',
    type: 'employee',
    filePath: '/Uploads/test-sig-006.png',
    description: 'ប្រធាននាយកដ្ឋាន',
    position: 'ប្រធាននាយកដ្ឋាន',
    department: 'នាយកដ្ឋានផ្នែកមនុស្ស',
    status: 'active'
  }
];

async function seedSignatures() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_db';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');

    // Check existing count
    const existingCount = await SignSchema.countDocuments();
    console.log(`Current signatures in DB: ${existingCount}`);

    // Insert test signatures
    const inserted = await SignSchema.insertMany(testSignatures, { ordered: false });
    console.log(`✅ Successfully created ${inserted.length} test signatures`);
    console.log('Signatures created:');
    inserted.forEach(sig => {
      console.log(`  - ${sig.name}: ${sig.fullNameKh}`);
    });

    const newCount = await SignSchema.countDocuments();
    console.log(`Total signatures now: ${newCount}`);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️ Some signatures already exist (duplicate key)');
      console.log('Checking for existing signatures...');
      const existing = await SignSchema.find({}).select('name fullNameKh');
      console.log(`Found ${existing.length} existing signatures:`);
      existing.forEach(sig => {
        console.log(`  - ${sig.name}: ${sig.fullNameKh}`);
      });
    } else {
      console.error('❌ Error seeding signatures:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedSignatures();
