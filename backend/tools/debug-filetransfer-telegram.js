import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import FileTransfer from '../models/FileTransfer.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const recordId = process.argv[2];
if (!recordId) {
  console.log('Usage: node tools/debug-filetransfer-telegram.js <fileTransferId>');
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/kshf_hospital_app';

function asStr(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

async function resolveTelegramUserForStage(assignedId) {
  if (!assignedId) return null;

  // 1) Try SignSchema -> createdBy -> User
  try {
    const Sign = await import('../models/SignSchema.js').then(m => m.default).catch(() => null);
    if (Sign) {
      const sig = await Sign.findById(assignedId).exec().catch(() => null);
      if (sig && sig.createdBy) {
        const u = await User.findById(sig.createdBy).exec().catch(() => null);
        if (u) return { user: u, via: 'signature.createdBy' };
      }
    }
  } catch (e) {}

  // 2) Try as User id
  const u = await User.findById(assignedId).exec().catch(() => null);
  if (u) return { user: u, via: 'userId' };

  return null;
}

function isNumericChatId(v) {
  const s = asStr(v).trim();
  if (!s) return false;
  if (s === '123456789') return false;
  return /^[-]?[0-9]+$/.test(s);
}

function formatTime(t, fallbackDate) {
  const tz = process.env.TELEGRAM_TIMEZONE || process.env.DEFAULT_TIMEZONE || 'Asia/Phnom_Penh';
  try {
    if (fallbackDate) {
      const dt = new Date(fallbackDate);
      if (!isNaN(dt.getTime())) {
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(dt);
      }
    }
  } catch (e) {}

  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${min} ${ampm}`;
  }
  return t;
}

async function main() {
  await mongoose.connect(mongoUri);

  const ft = await FileTransfer.findById(recordId).lean().exec();
  if (!ft) {
    console.log('FileTransfer not found:', recordId);
    process.exit(0);
  }

  const stages = (ft.meta && ft.meta.feedbackStages) ? ft.meta.feedbackStages : {};
  console.log('Record:', recordId);
  console.log('Title:', ft.title ?? ft.letterNo ?? ft.entryNo ?? '');
  console.log('EntryTime:', ft.entryTime);
  console.log('EntryTime (snake_case):', ft.entry_time);
  console.log('Date:', ft.date);
  console.log('feedbackStages:', stages);

  const stageKeys = ['s', 's1', 's2', 's3', 's4', 's5', 's6'];
  for (const k of stageKeys) {
    const assigned = stages[k];
    if (!assigned) continue;

    const resolved = await resolveTelegramUserForStage(assigned);
    console.log('\nStage:', k);
    console.log('  assigned:', assigned);

    if (!resolved) {
      console.log('  user: NOT FOUND');
      continue;
    }

    const u = resolved.user;
    console.log('  via:', resolved.via);
    console.log('  user:', u.fullName ?? u.name ?? u.email ?? '', '(' + asStr(u._id) + ')');
    console.log('  telegramChatId:', asStr(u.telegramChatId), isNumericChatId(u.telegramChatId) ? '(OK)' : '(missing/invalid)');
    console.log('  telegramChatId2:', asStr(u.telegramChatId2), isNumericChatId(u.telegramChatId2) ? '(OK)' : '(missing/invalid)');
    console.log('  telegramId (legacy):', asStr(u.telegramId));

    // Simulate the notification message to verify content
    const letterNo = ft.letterNo || ft.letter_no || 'NA';
    const source = ft.source || ft.origin || '';
    const subject = ft.content || ft.description || ft.title || '';
    const createdAt = ft.createdAt || (ft._doc && ft._doc.createdAt) || null;
    const createdDateStr = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const createdTimeStr = createdAt ? formatTime(null, createdAt) : '';
    const entryDateStr = ft.date ? new Date(ft.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const entryTimeStr = formatTime(ft.entryTime || ft.entry_time, ft.date);

    const msg = `📄 <b>មានឯកសាររង់ចាំការពិនិត្យនិងមានមតិយោប់</b>\n` +
          `\n` +
          `<b>លេខលិខិត ៖</b> ${letterNo}\n` +
          `<b>ប្រភពឯកសារ ៖</b> ${source}\n` +
          `<b>កម្មវត្ថុ ៖</b> ${subject}\n` +
          `<b>ថ្ងៃខែឆ្នាំផ្ញើមតិ ៖</b> ${createdDateStr}\n` +
          `<b>វេលាម៉ោង ៖</b> ${createdTimeStr}\n` +
          `<b>អ្នកទទួល ៖</b> ${asStr(u.fullName)}\n` +
          `<b>វគ្គ ៖</b> ${k}\n` +
          `<b>មតិ ៖</b> មិនទាន់ reply មតិបាន\n` +
          `<b>ឯកសារ ៖</b> ${ft._id}\n` +
          `\n` +
          `<b>ចូលថ្ងៃទី ៖</b> ${entryDateStr}\n` +
          `🕘<b>វេលាម៉ោង ៖</b> ${entryTimeStr}\n` +
          `<b>លេខកត់ត្រា ៖</b> ${ft._id}\n` +
          `💬 សូមចុច Reply នៅលើសារនេះ ដើម្បីផ្ញើមតិរបស់អ្នក\n` +
          `STAGE_KEY៖ ${k}`;
    console.log('  [Preview Message]:\n', msg.replace(/^/gm, '    '));
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Debug failed:', e);
  process.exit(1);
});
