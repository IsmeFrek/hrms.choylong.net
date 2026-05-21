import mongoose from 'mongoose';
import LeaveRequest from '../models/LeaveRequest.js'; // Assuming this is the model name
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';
  await mongoose.connect(uri);
  
  const id = 'D0534';
  console.log('--- Checking LeaveRequest for:', id, ' ---');
  
  const leaves = await mongoose.model('LeaveRequest').find({ staffId: id });
  console.log(`Found ${leaves.length} records for ${id}`);
  leaves.forEach(l => {
    console.log(`- Start: ${l.startDate.toISOString().slice(0, 10)}, End: ${l.endDate.toISOString().slice(0, 10)}, Status: ${l.status}, Type: ${l.type}`);
  });
  
  process.exit(0);
}

run();
