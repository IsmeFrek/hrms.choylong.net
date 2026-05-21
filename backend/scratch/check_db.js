import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script is in backend/scratch/
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HRSchema = new mongoose.Schema({ status: String }, { strict: false });
const HR = mongoose.model('HR', HRSchema, 'hrs');

async function check() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    
    const stats = await HR.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('Status breakdown:', JSON.stringify(stats, null, 2));
    
    const total = await HR.countDocuments();
    console.log('Total count:', total);

    const activeCount = await HR.countDocuments({ status: 'Active' });
    console.log('Active count:', activeCount);

    const activeCaseCount = await HR.countDocuments({ status: /active/i });
    console.log('Active (case-insensitive) count:', activeCaseCount);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
