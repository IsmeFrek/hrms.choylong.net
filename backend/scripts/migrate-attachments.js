import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // import model after connection
  const { default: FileTransfer } = await import('../models/FileTransfer.js');

  const cursor = FileTransfer.find({ $or: [ { attachments: { $exists: true } }, { files: { $exists: true } } ] }).cursor();
  let updated = 0;
  let total = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    total++;
    try {
      const r = doc.toObject();
      let arr = [];
      if (Array.isArray(r.attachments) && r.attachments.length) arr = r.attachments.slice();
      else if (typeof r.attachments === 'string' && r.attachments.trim()) {
        if (r.attachments.indexOf(',') >= 0) arr = r.attachments.split(',').map(s => s.trim()).filter(Boolean);
        else arr = [r.attachments.trim()];
      }
      if ((!arr || arr.length === 0) && Array.isArray(r.files) && r.files.length) arr = r.files.slice();

      // normalize entries
      const norm = arr.map(a => {
        if (!a) return null;
        const s = String(a).trim();
        // If it's already a URL or starts with /Uploads, keep as-is but ensure it starts with '/'
        if (s.startsWith('http://') || s.startsWith('https://')) return s;
        const name = path.basename(s.replace(/^\\/g, '/'));
        if (!name) return null;
        return `/Uploads/${encodeURIComponent(name)}`;
      }).filter(Boolean);

      // If norm differs from existing attachments, update
      const existing = Array.isArray(doc.attachments) ? doc.attachments.map(String) : (typeof doc.attachments === 'string' ? doc.attachments.split(',').map(s => s.trim()) : []);
      const same = norm.length === existing.length && norm.every((v,i) => v === existing[i]);
      if (!same) {
        doc.attachments = norm;
        await doc.save();
        updated++;
        console.log('Updated doc', doc._id, '->', norm);
      }
    } catch (err) {
      console.error('Failed to process doc', doc._id, err);
    }
  }

  console.log(`Done. Processed ${total} docs, updated ${updated} docs.`);
  await mongoose.disconnect();
  console.log('Disconnected.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
