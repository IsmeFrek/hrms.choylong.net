import mongoose from 'mongoose';
import SignSchema from './models/SignSchema.js';
import dotenv from 'dotenv';

dotenv.config();

const quickTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app');
    
    const count = await SignSchema.countDocuments();
    console.log(`Found ${count} signatures in database`);
    
    if (count > 0) {
      const samples = await SignSchema.find().limit(5);
      console.log('\nSample signatures:');
      samples.forEach(sig => {
        console.log(`- ${sig.name}: ${sig.filePath} (${sig.type})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

quickTest();