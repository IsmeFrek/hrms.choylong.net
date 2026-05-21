import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HRSchema = new mongoose.Schema({ status: String, staffId: String }, { strict: false });
const HR = mongoose.model('HR', HRSchema, 'hrs');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // 1. Check for 'Deleted' status
    const deletedCount = await HR.countDocuments({ status: 'Deleted' });
    console.log('Status: Deleted count:', deletedCount);

    // 2. Check for duplicate staffIds among non-resigned
    const dupes = await HR.aggregate([
      { $match: { status: { $ne: 'Resigned' } } },
      { $group: { _id: '$staffId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    let totalDupesCount = 0;
    dupes.forEach(d => { totalDupesCount += (d.count - 1); });
    console.log('Total duplicate records to exclude:', totalDupesCount);
    console.log('Duplicate examples:', JSON.stringify(dupes.slice(0, 5), null, 2));

    // 3. Check for specific exclusion of 10 if we include null
    const baseCount = await HR.countDocuments({ status: { $ne: 'Resigned' } });
    console.log('Base count (not Resigned):', baseCount);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
