#!/usr/bin/env node
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const FileTransfer = (await import('../models/FileTransfer.js')).default;
    const docs = await FileTransfer.find({ 'meta.telegramFeedback': { $exists: true } }).lean().exec();
    if (!docs || docs.length === 0) {
      console.log('No records with telegramFeedback found.');
      await mongoose.disconnect();
      return;
    }
    for (const d of docs) {
      console.log('=== Record:', d._id, '===');
      console.log(JSON.stringify(d.meta || {}, null, 2));
      console.log('');
    }
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
