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
    const all = await HR.find().lean();
    
    // Group by status
    const statusGroups = {};
    all.forEach(r => {
        const s = String(r.status || 'null').trim();
        statusGroups[s] = (statusGroups[s] || 0) + 1;
    });
    console.log('Status breakdown (inclusive):', statusGroups);

    // Group by staffId cleaning
    const idMap = new Map();
    const duplicates = [];
    all.forEach(r => {
        if (r.status === 'Resigned') return;
        const sid = String(r.staffId || '').trim().toUpperCase();
        if (!sid) return;
        if (idMap.has(sid)) {
            duplicates.push({ sid, original: idMap.get(sid), current: r });
        } else {
            idMap.set(sid, r);
        }
    });

    console.log('Duplicate count (non-resigned):', duplicates.length);
    if (duplicates.length > 0) {
        console.log('Duplicate sample:', duplicates.slice(0, 5).map(d => d.sid));
    }

    // Check for "Deleted" status case-insensitive
    const deleted = all.filter(r => String(r.status).toLowerCase() === 'deleted');
    console.log('Deleted status count:', deleted.length);

    // Check for "Inactive" status
    const inactive = all.filter(r => String(r.status).toLowerCase() === 'inactive');
    console.log('Inactive status count:', inactive.length);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
