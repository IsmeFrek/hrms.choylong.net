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
    
    // Find all unique keys
    const keys = new Set();
    all.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
    console.log('Unique keys:', Array.from(keys));

    // Check for specific exclusion-like keys
    const potentialKeys = ['deleted', 'isDeleted', 'inactive', 'hidden', 'exclude', 'isExclude', 'test'];
    potentialKeys.forEach(k => {
        const count = all.filter(r => r[k] === true || r[k] === 'true' || r[k] === 1 || r[k] === '1').length;
        if (count > 0) console.log(`Key "${k}" has ${count} positive values.`);
    });

    // Check for records with staffId that are not properly formatted (e.g. they don't start with a letter)
    const malformedId = all.filter(r => !/^[A-Za-z]/.test(String(r.staffId)));
    console.log('Malformed staffId count:', malformedId.length);
    if (malformedId.length > 0) {
        console.log('Malformed samples:', malformedId.map(m => m.staffId).slice(0, 5));
    }

    // Check for records whose ID is in a specific range or prefix
    const prefixed = all.filter(r => String(r.staffId).startsWith('EXT'));
    console.log('EXT prefixed count:', prefixed.length);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
