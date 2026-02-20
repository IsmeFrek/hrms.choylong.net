#!/usr/bin/env node
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function main() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const User = (await import('../models/User.js')).default;
  const users = await User.find({ $or: [{ telegramChatId: { $exists: true, $ne: '' } }, { telegramId: { $exists: true, $ne: '' } }] }).limit(10).lean().exec();
  if (!users || users.length === 0) {
    console.log('No users with telegramChatId/telegramId found.');
  } else {
    console.log('Users with telegram IDs:');
    users.forEach(u => {
      console.log('-', u._id?.toString?.(), '| telegramChatId:', u.telegramChatId || '-', '| telegramId:', u.telegramId || '-', '| fullName:', u.fullName || u.name || '');
    });
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(2); });
