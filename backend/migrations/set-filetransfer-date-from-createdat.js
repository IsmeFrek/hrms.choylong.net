#!/usr/bin/env node
/*
  Usage: node backend/migrations/set-filetransfer-date-from-createdat.js <fileTransferId>
  This script will update a FileTransfer record's `date` field to the record's
  `createdAt` value and set `entryTime` to the local HH:MM (Asia/Phnom_Penh by default)
  derived from `createdAt` if the record's `date` currently is midnight UTC
  (commonly produced by imports). It prints a before/after summary.
*/

import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const id = process.argv[2];
if (!id) {
  console.error('Usage: node backend/migrations/set-filetransfer-date-from-createdat.js <fileTransferId>');
  process.exit(1);
}

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  const { pathToFileURL } = await import('url');
  const fileUrl = pathToFileURL(path.join(__dirname, '..', 'models', 'FileTransfer.js')).href;
  const mod = await import(fileUrl).then(m => m.default || m).catch(e => { console.error('Import model failed', e); process.exit(2); });
  const FileTransfer = mod;

  const doc = await FileTransfer.findById(id).exec();
  if (!doc) {
    console.error('Record not found:', id);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('Before:');
  console.log('  id:', doc._id.toString());
  console.log('  date:', doc.date);
  console.log('  entryTime:', doc.entryTime || doc.entry_time);
  console.log('  createdAt:', doc.createdAt || doc._doc && doc._doc.createdAt);

  const rawDate = doc.date || doc.entryDate;
  const dt = rawDate ? new Date(rawDate) : null;

  // Only modify when date exists and is midnight UTC OR if date is missing
  let shouldUpdate = false;
  if (!rawDate) shouldUpdate = true;
  else if (dt && dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0) shouldUpdate = true;

  if (!shouldUpdate && doc.entryTime) {
    console.log('No update needed: date appears to include non-midnight time and entryTime exists.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const created = doc.createdAt || (doc._doc && doc._doc.createdAt);
  if (!created) {
    console.error('No createdAt available to derive time from. Aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const tz = process.env.TELEGRAM_TIMEZONE || process.env.DEFAULT_TIMEZONE || 'Asia/Phnom_Penh';
  // Build local time string HH:MM in the target timezone
  const localTime = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(created));
  // localTime in format like "07:00" or "10:38"

  // Set date to createdAt (full ISO) so timezone-aware formatting works later
  doc.date = new Date(created);
  doc.entryTime = localTime;
  await doc.save();

  console.log('After:');
  console.log('  date:', doc.date);
  console.log('  entryTime:', doc.entryTime);
  await mongoose.disconnect();
  console.log('Migration complete for', id);
}

main().catch(e => { console.error('Migration failed:', e); process.exit(2); });
