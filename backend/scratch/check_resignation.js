import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HRSchema = new mongoose.Schema({ status: String }, { strict: false });
const HR = mongoose.model('HR', HRSchema, 'hrs');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check for records with resignationDate but NO Resigned status
    const list = await HR.find({ 
        status: { $ne: 'Resigned' }
    }).lean();

    const withResignationDate = list.filter(r => r.resignationDate || r.resignedDate);
    console.log('Records with a resignation date but NOT marked as Resigned:', withResignationDate.length);
    
    if (withResignationDate.length > 0) {
        console.log('Samples:', withResignationDate.map(r => ({ id: r.staffId, date: r.resignationDate || r.resignedDate })).slice(0, 15));
    }

    // Check for records where status is 'Deleted'
    const deleted = list.filter(r => String(r.status).toLowerCase() === 'deleted');
    console.log('Records with Deleted status:', deleted.length);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
