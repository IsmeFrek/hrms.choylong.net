import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const HRSchema = new mongoose.Schema({}, { strict: false });
const HR = mongoose.model('HR', HRSchema, 'hrs');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const all = await HR.find({ status: { $ne: 'Resigned' } }).lean();
    
    console.log('Total Non-Resigned:', all.length);

    // 1. Check for any record with 'Deleted' or 'Inactive' in ANY case
    const deleted = all.filter(r => /deleted/i.test(r.status));
    console.log('Case-insensitive Deleted status count:', deleted.length);

    const inactive = all.filter(r => /inactive/i.test(r.status));
    console.log('Case-insensitive Inactive status count:', inactive.length);

    // 2. Check for records without a staffId or with a very short one
    const shortId = all.filter(r => !r.staffId || String(r.staffId).length < 2);
    console.log('Short or empty staffId count:', shortId.length);

    // 3. Check for specific staffId patterns that might be test/extra
    const testPatterns = all.filter(r => 
        /test/i.test(r.staffId) || 
        /test/i.test(r.name) || 
        /test/i.test(r.khmerName)
    );
    console.log('Test pattern count:', testPatterns.length);

    // 4. Check for any field that might indicate "extra" or "duplicate"
    // Let's check for records where 'no' is null or 0?
    const noNo = all.filter(r => !r.no);
    console.log('Records without "no" field:', noNo.length);

    // 5. Check if there are 10 records with a specific category
    const categories = {};
    all.forEach(r => {
        const cat = r.officerType || r.employeeCategory || 'Unknown';
        categories[cat] = (categories[cat] || 0) + 1;
    });
    console.log('Categories breakdown:', categories);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
