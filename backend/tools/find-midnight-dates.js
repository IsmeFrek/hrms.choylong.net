#!/usr/bin/env node
/*
  Usage: node backend/tools/find-midnight-dates.js [--limit N]
  Prints count and sample IDs of FileTransfer docs where `date` exists and is midnight UTC (00:00:00Z).
*/

import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const args = process.argv.slice(2);
let limit = 50;
for (let i=0;i<args.length;i++) {
  if (args[i] === '--limit' && args[i+1]) { limit = Number(args[i+1]) || limit; }
}

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  const { pathToFileURL } = await import('url');
  const FileTransfer = (await import(pathToFileURL(path.join(__dirname, '..', 'models', 'FileTransfer.js')).href)).default;

  // query for documents with a date field
  const cursor = FileTransfer.find({ date: { $exists: true, $ne: null } }).cursor();
  let count = 0;
  const samples = [];
  for await (const doc of cursor) {
    const dt = new Date(doc.date);
    if (!isNaN(dt.getTime())) {
      if (dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0) {
        count++;
        if (samples.length < limit) samples.push({ id: String(doc._id), date: doc.date, entryTime: doc.entryTime || doc.entry_time || null, createdAt: doc.createdAt || null });
      }
    }
  }

  console.log('Found midnight-UTC date records:', count);
  console.log('Sample (limit', limit + '):');
  console.table(samples);

  await mongoose.disconnect();
}

main().catch(e => { console.error('Failed:', e); process.exit(2); });
