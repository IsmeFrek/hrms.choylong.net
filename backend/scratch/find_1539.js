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
    
    // 1. Total minus resigned
    const totalMinusResigned = await HR.countDocuments({ status: { $ne: 'Resigned' } });
    console.log('Total (not resigned):', totalMinusResigned);

    // 2. Not resigned AND has valid staffId
    const withId = await HR.countDocuments({ 
        status: { $ne: 'Resigned' }, 
        staffId: { $ne: null, $exists: true, $ne: "" } 
    });
    console.log('Total (not resigned + has staffId):', withId);

    // 3. Status is either 'Active' or null
    const targetStatus = await HR.countDocuments({ 
        status: { $in: ['Active', null] } 
    });
    console.log('Total (Active or null status):', targetStatus);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
