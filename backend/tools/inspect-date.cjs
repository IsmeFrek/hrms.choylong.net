#!/usr/bin/env node
/* inspect-date.cjs
 * Usage: node backend/tools/inspect-date.cjs <fileTransferId>
 * Connects to MongoDB and prints the raw `date`/`entryDate` and their
 * UTC/local breakdowns for investigation.
 */

const mongoose = require('mongoose');
const path = require('path');
const { pathToFileURL } = require('url');

const id = process.argv[2];
if (!id) {
  console.error('Usage: node backend/tools/inspect-date.cjs <fileTransferId>');
  process.exit(1);
}

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

  const mf = await import(pathToFileURL(path.join(__dirname, '..', 'models', 'FileTransfer.js')).href).catch((e) => {
    console.error('Failed to import FileTransfer model:', e && e.message ? e.message : e);
    process.exit(2);
  });
  const FileTransfer = mf && mf.default ? mf.default : mf;

  const doc = await FileTransfer.findById(id).lean().exec().catch((e) => { console.error('DB find error', e && e.message); return null; });
  if (!doc) {
    console.error('Record not found:', id);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('--- Document fields ---');
  console.log('id:', doc._id.toString());
  console.log('title:', doc.title || doc.letterNo || doc.entryNo || '');
  console.log('entryTime:', doc.entryTime);
  console.log('entry_time:', doc.entry_time);
  console.log('entryDate:', doc.entryDate);
  console.log('date:', doc.date);

  const raw = doc.entryDate || doc.date;
  if (!raw) {
    console.log('No raw date value to inspect');
    await mongoose.disconnect();
    process.exit(0);
  }

  const dt = new Date(raw);
  console.log('\n--- Parsed Date ---');
  console.log('raw input:', raw);
  console.log('toISOString:', dt.toISOString());
  console.log('toString:', dt.toString());
  console.log('getTime:', dt.getTime());
  console.log('timezone offset (minutes):', dt.getTimezoneOffset());
  console.log('UTC hh:mm:ss:', `${dt.getUTCHours()}:${dt.getUTCMinutes()}:${dt.getUTCSeconds()}`);
  console.log('Local hh:mm:ss:', `${dt.getHours()}:${dt.getMinutes()}:${dt.getSeconds()}`);

  // Also show what the migration script would have produced
  const uh = dt.getUTCHours();
  const um = dt.getUTCMinutes();
  console.log('\nUTC hours/minutes check:', uh, um);
  if (!(uh === 0 && um === 0)) {
    const hh_local = String(dt.getHours()).padStart(2, '0');
    const mm_local = String(dt.getMinutes()).padStart(2, '0');
    console.log('migration would set entryTime ->', `${hh_local}:${mm_local}`);
  } else {
    console.log('migration would skip (midnight UTC)');
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error('Inspect failed:', e && e.message ? e.message : e); process.exit(2); });
