#!/usr/bin/env node
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const id = process.argv[2];
if (!id) {
  console.error('Usage: node backend/tools/check_meta.mjs <recordId>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const FileTransfer = (await import('../models/FileTransfer.js')).default;
    const doc = await FileTransfer.findById(id).lean().exec();
    if (!doc) {
      console.error('Record not found:', id);
      process.exit(2);
    }
    console.log('--- meta for', id, '---');
    console.log(JSON.stringify(doc.meta || {}, null, 2));
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(3);
  }
}

main();
