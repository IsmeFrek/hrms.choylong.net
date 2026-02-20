// Migration: copy master/category shifts into the top-level `shifts` array
// Usage: node backend/migrations/migrate-copy-master-shifts.js

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import ShiftGroup from '../../backend/models/ShiftGroup.js';
import fs from 'fs';
import path from 'path';

// Load env from backend/.env
const envPath = path.resolve(process.cwd(), 'backend', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('.env not found at', envPath);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function run() {
  console.log('Connecting to', MONGODB_URI);
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const groups = await ShiftGroup.find({}).lean();
    console.log('Found', groups.length, 'shift group documents');

    let updated = 0;
    for (const g of groups) {
      const docId = g._id;
      const existingShifts = Array.isArray(g.shifts) ? g.shifts : [];
      if (existingShifts.length > 0) continue; // already has shifts

      // Try to find master shifts in several places
      let master = [];
      // 1) top-level `categories` field (if present as saved by frontend) -> categories[0].shifts
      if (Array.isArray(g.categories) && g.categories.length > 0) {
        const cat0 = g.categories[0];
        if (cat0 && Array.isArray(cat0.shifts) && cat0.shifts.length > 0) {
          master = cat0.shifts.map((s) => ({ title: s.title || s.name || s, start: s.start || '', end: s.end || '' }));
        }
      }

      // 2) top-level `shifts` fallback (shouldn't be here since existingShifts was empty)
      if (master.length === 0 && Array.isArray(g.shifts) && g.shifts.length > 0) {
        master = g.shifts.map((s) => ({ title: s.title || s.name || s, start: s.start || '', end: s.end || '' }));
      }

      // 3) look for raw fields in document that might contain shifts (best-effort)
      if (master.length === 0 && g?.categories) {
        // try scan all categories to find any shifts
        for (const cat of g.categories) {
          if (cat && Array.isArray(cat.shifts) && cat.shifts.length > 0) { master = cat.shifts.map(s=>({ title: s.title||s.name||s, start: s.start||'', end: s.end||'' })); break; }
        }
      }

      if (master.length === 0) {
        console.log('No master shifts found for', docId, 'skipping');
        continue;
      }

      // Prepare update payload to match ShiftGroup model
      const payloadShifts = master.map(s => ({ title: s.title || 'Shift', start: s.start || '', end: s.end || '' }));
      try {
        await ShiftGroup.findByIdAndUpdate(docId, { shifts: payloadShifts }, { new: true });
        updated++;
        console.log('Updated', docId, 'with', payloadShifts.length, 'shifts');
      } catch (err) {
        console.error('Failed update for', docId, err.message || err);
      }
    }

    console.log('Migration done. Updated documents:', updated);
  } catch (err) {
    console.error('Migration error', err);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
