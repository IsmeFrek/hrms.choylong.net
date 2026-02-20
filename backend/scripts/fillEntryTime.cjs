/* fillEntryTime.cjs
 * Safe migration: populate `entryTime` from `date` when the stored date has a
 * non-midnight UTC time component and `entryTime` is missing or empty.
 *
 * Usage: node backend/scripts/fillEntryTime.cjs [--dry-run]
 *
 * Will print matched records and ask for confirmation unless --dry-run is used.
 */

const mongoose = require('mongoose');
const path = require('path');
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  // Import model using dynamic import to support ESM-style export default
  const { pathToFileURL } = require('url');
  const mf = await import(pathToFileURL(path.join(__dirname, '..', 'models', 'FileTransfer.js')).href);
  const FileTransfer = mf && mf.default ? mf.default : mf;

  // Find records where entryTime is missing/null/empty
  const query = {
    $or: [ { entryTime: { $exists: false } }, { entryTime: null }, { entryTime: '' } ]
  };

  // Project only needed fields
  const candidates = await FileTransfer.find(query).select('date entryDate entryTime _id title').lean().exec();
  console.log('Found', candidates.length, 'candidates');
  const toUpdate = [];

  for (const c of candidates) {
    const raw = c.entryDate || c.date;
    if (!raw) continue;
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) continue;
    // if UTC time is exactly midnight, skip (no real time recorded)
    const uh = dt.getUTCHours();
    const um = dt.getUTCMinutes();
    if (uh === 0 && um === 0) continue;
    // otherwise, compute local time HH:MM
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const entryTime = `${hh}:${mm}`;
    toUpdate.push({ id: c._id.toString(), oldDate: raw, entryTime });
  }

  if (!toUpdate.length) {
    console.log('No records to update.');
    process.exit(0);
  }

  console.log('Records to set entryTime for:', toUpdate.length);
  toUpdate.slice(0, 50).forEach((u, i) => console.log(i+1, u.id, u.entryTime, u.oldDate));
  if (toUpdate.length > 50) console.log('... plus', toUpdate.length - 50, 'more');

  if (dryRun) {
    console.log('--dry-run specified; exiting without changes');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Ask for confirmation via stdin
  process.stdout.write('Proceed to update these records? (type YES to confirm): ');
  const stdin = process.stdin;
  stdin.setEncoding('utf8');
  const answer = await new Promise((resolve) => {
    stdin.once('data', (d) => resolve(d.trim()));
  });
  if (answer !== 'YES') {
    console.log('Aborted by user.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Perform updates
  let changed = 0;
  for (const u of toUpdate) {
    try {
      const doc = await FileTransfer.findById(u.id).exec();
      if (!doc) continue;
      // set entryTime only if still missing
      if (!doc.entryTime || String(doc.entryTime).trim() === '') {
        doc.entryTime = u.entryTime;
        await doc.save();
        changed++;
        console.log('Updated', u.id, '->', u.entryTime);
      }
    } catch (e) {
      console.warn('Failed to update', u.id, e && e.message ? e.message : e);
    }
  }

  console.log('Done. Updated', changed, 'records.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
