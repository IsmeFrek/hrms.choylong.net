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
    const list = await HR.find({ status: { $ne: 'Resigned' } }).lean();
    
    console.log('Total non-resigned:', list.length);

    const testRecords = list.filter(r => 
        String(r.name || r.khmerName || '').toLowerCase().includes('test') ||
        String(r.staffId || '').toLowerCase().includes('test')
    );
    console.log('Test records count:', testRecords.length);

    const emptyIdRecords = list.filter(r => !String(r.staffId || '').trim());
    console.log('Empty staffId records count:', emptyIdRecords.length);

    const deletedStatus = list.filter(r => r.status === 'Deleted');
    console.log('Deleted status count:', deletedStatus.length);

    const inactiveStatus = list.filter(r => r.status === 'Inactive');
    console.log('Inactive status count:', inactiveStatus.length);

    // If we can't find 10, let's look at the first 20 and last 20
    console.log('Sample of records without Active status and not Resigned (limit 10):');
    const samples = list.filter(r => r.status !== 'Active').slice(0, 10);
    console.log(JSON.stringify(samples.map(s => ({ id: s.staffId, name: s.khmerName || s.name, status: s.status })), null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
