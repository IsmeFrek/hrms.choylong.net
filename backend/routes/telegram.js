import { Router } from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import FileTransfer from '../models/FileTransfer.js';
import User from '../models/User.js';
import fs from 'fs';
import { verifyLinkCode } from './telegramLink.js';

const router = Router();

function formatTime(t, fallbackDate) {
  const tz = process.env.TELEGRAM_TIMEZONE || process.env.DEFAULT_TIMEZONE || 'Asia/Phnom_Phn';
  try {
    if (fallbackDate) {
      const dt = new Date(fallbackDate);
      if (!isNaN(dt.getTime())) {
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(dt);
      }
    }
  } catch (e) { }
  return t || '';
}

// POST /api/telegram/webhook - Receive updates from Telegram
router.post('/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    console.log('Telegram webhook received:', JSON.stringify(update, null, 2));

    // 1. Handle Callback Queries
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;

      if (data && data.startsWith('edit_feedback:')) {
        const recordId = data.replace('edit_feedback:', '');
        await sendTelegramMessage(
          chatId,
          `✏️ <b>កែប្រែមតិ</b>\n\n` +
          `📄 ឯកសារ៖ <code>${recordId}</code>\n\n` +
          `សូមឆ្លើយតប (Reply) សារនេះដើម្បីបញ្ចូលមតិថ្មី៖`,
          { inline_keyboard: [[{ text: '❌ បោះបង់', callback_data: 'cancel_edit' }]] }
        );
        await answerCallbackQuery(callbackQuery.id, 'សូមឆ្លើយតបសារខាងលើ');
      } else if (data === 'cancel_edit') {
        await answerCallbackQuery(callbackQuery.id, 'បានបោះបង់');
      }
      return res.json({ ok: true });
    }

    // 2. Handle Text Messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const messageText = update.message.text;
      const replyToMessage = update.message.reply_to_message;
      const originalText = replyToMessage ? (replyToMessage.text || replyToMessage.caption || '') : '';
      const originalIsCaption = replyToMessage && !replyToMessage.text && replyToMessage.caption;

      // --- PHASE 1: General Commands (No Link Required) ---
      const webAppUrl = process.env.TELEGRAM_WEB_APP_URL || (process.env.SERVER_BASE_URL ? `${process.env.SERVER_BASE_URL}/telegram` : 'https://localhost:5173/telegram');

      if (messageText.startsWith('/start')) {
        await sendTelegramMessage(
          chatId,
          `សូមស្វាគមន៍មកកាន់ <b>Y&J PORTAL</b>! 👋\n\n` +
          `លោកអ្នកអាចឆែកវត្តមាន ស្នើសុំច្បាប់ និងមើលកាលវិភាគការងារបានយ៉ាងងាយស្រួល។`,
          { inline_keyboard: [[{ text: '🚀 បើកកម្មវិធី KSFH', web_app: { url: webAppUrl } }]] }
        );
        return res.json({ ok: true });
      }

      if (messageText.startsWith('/link')) {
        const code = messageText.split(' ')[1]?.trim();
        if (!code) {
          await sendTelegramMessage(chatId, `⚠️ <b>សូមបញ្ជាក់លេខកូដ</b>\n\nប្រើប្រាស់បញ្ជា៖ <code>/link ១២៣៤៥៦</code>`);
        } else {
          const result = await verifyLinkCode(code, chatId, {
            first_name: update.message.from?.first_name,
            last_name: update.message.from?.last_name,
            username: update.message.from?.username
          });
          if (result.success) {
            await sendTelegramMessage(
              chatId,
              `✅ <b>ភ្ជាប់គណនីបានជោគជ័យ!</b>\n\nស្វាគមន៍លោកអ្នក <b>${result.userName}</b> មកកាន់ KSFH Bot។`,
              { inline_keyboard: [[{ text: '🚀 បើកកម្មវិធី KSFH', web_app: { url: webAppUrl } }]] }
            );
          } else {
            await sendTelegramMessage(chatId, `❌ <b>បរាជ័យ៖</b> ${result.message || 'លេខកូដមិនត្រឹមត្រូវ'}`);
          }
        }
        return res.json({ ok: true });
      }

      if (messageText.startsWith('/help') || messageText.startsWith('/app')) {
        await sendTelegramMessage(
          chatId,
          `📚 <b>ជំនួយ</b>\n• /start - ចាប់ផ្តើម\n• /link - ភ្ជាប់គណនី\n• /app - បើកកម្មវិធី`,
          { inline_keyboard: [[{ text: '📱 បើកកម្មវិធី', web_app: { url: webAppUrl } }]] }
        );
        return res.json({ ok: true });
      }

      // --- PHASE 2: User-Specific (Requires Link) ---
      let user = await User.findOne({ telegramChatId: String(chatId) }).exec();
      if (!user) user = await User.findOne({ telegramId: String(chatId) }).exec();

      if (!user) {
        await sendTelegramMessage(chatId, `⚠️ លោកអ្នកមិនទាន់បានភ្ជាប់គណនីនៅឡើយទេ។ សូមប្រើប្រាស់បញ្ជា <code>/link</code> ដើម្បីភ្ជាប់។`);
        return res.json({ ok: true });
      }

      // Handle Replies (Feedback)
      if (replyToMessage) {
        const isEdit = originalText.includes('✏️') || originalText.includes('កែប្រែ');
        let recordIdMatch = originalText.match(/(?:លេខកត់ត្រា|ឯកសារ)\s*[:៖]\s*([a-f0-9]{24})/i);
        if (!recordIdMatch) recordIdMatch = originalText.match(/\b([a-f0-9]{24})\b/i);

        if (recordIdMatch) {
          const recordId = recordIdMatch[1];
          const fileTransfer = await FileTransfer.findById(recordId).exec();

          if (fileTransfer) {
            const meta = fileTransfer.meta || {};
            if (!meta.telegramFeedback) meta.telegramFeedback = [];

            if (isEdit) {
              const fbIdx = meta.telegramFeedback.findLastIndex(f => f.userId?.toString() === user._id.toString());
              if (fbIdx !== -1) {
                meta.telegramFeedback[fbIdx].message = messageText;
                meta.telegramFeedback[fbIdx].timestamp = new Date();
                meta.telegramFeedback[fbIdx].edited = true;
              }
            } else {
              meta.telegramFeedback.push({
                userId: user._id,
                userName: user.fullName || user.name,
                message: messageText,
                timestamp: new Date(),
                chatId: String(chatId),
                originalMessageId: replyToMessage.message_id
              });
            }

            // Sync with Stage Note (Default to 's' / CourseNote)
            const stageMatch = originalText.match(/(?:STAGE_KEY|វគ្គ)\s*[:៖]?\s*(s[0-6]?)/i);
            const stageKey = stageMatch ? stageMatch[1].toLowerCase() : 's';
            const metaMapping = { s: 'CourseNote', s1: 'Course1Note', s2: 'Course2Note', s3: 'Course3Note', s4: 'Course4Note', s5: 'Course5Note', s6: 'Course6Note' };
            const dateMapping = { s: 'CourseDate', s1: 'Course1Date', s2: 'Course2Date', s3: 'Course3Date', s4: 'Course4Date', s5: 'Course5Date', s6: 'Course6Date' };

            if (metaMapping[stageKey]) {
              meta[metaMapping[stageKey]] = messageText;
              meta[dateMapping[stageKey]] = new Date().toISOString();
            }

            fileTransfer.meta = meta;
            fileTransfer.markModified('meta');
            await fileTransfer.save();

            // Update UI
            try {
              const feedbackStatus = `\n\n<b>✅ បាន reply មតិ${isEdit ? ' (កែប្រែ)' : ''}</b>\n📝 មតិ៖ "${messageText}"`;
              const opts = { inline_keyboard: [[{ text: '✏️ កែប្រែមតិ', callback_data: `edit_feedback:${recordId}` }]] };
              if (originalIsCaption) {
                await editTelegramCaption(chatId, replyToMessage.message_id, (replyToMessage.caption || '') + feedbackStatus, opts);
              } else {
                await editTelegramMessage(chatId, replyToMessage.message_id, (replyToMessage.text || '') + feedbackStatus, opts);
              }
              await sendTelegramMessage(chatId, `✅ <b>បានរក្សាទុកមតិ</b>`);
            } catch (e) {
              await sendTelegramMessage(chatId, `✅ មតិត្រូវបានរក្សាទុក`);
            }
          } else {
            await sendTelegramMessage(chatId, `⚠️ រកមិនឃើញឯកសារលេខ ${recordId}`);
          }
        } else {
          await sendTelegramMessage(chatId, `⚠️ សូម Reply លើសារដែលមានលេខកត់ត្រាត្រឹមត្រូវ។`);
        }
      } else {
        await sendTelegramMessage(chatId, `លោកអ្នកអាចបើកកម្មវិធី ឬ Reply លើសារជូនដំណឹងដើម្បីផ្ញើមតិ។`, {
          inline_keyboard: [[{ text: '🌐 បើកកម្មវិធី', web_app: { url: webAppUrl } }]]
        });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return res.json({ ok: true });
  }
});

// --- HELPER FUNCTIONS ---

async function sendTelegramMessage(chatId, text, replyMarkup = null, customToken = null) {
  const token = customToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: replyMarkup });
  return callTelegram(token, 'sendMessage', payload);
}

async function editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const payload = JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup: replyMarkup });
  return callTelegram(token, 'editMessageText', payload).catch(() => ({ ok: true }));
}

async function editTelegramCaption(chatId, messageId, caption, replyMarkup = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const payload = JSON.stringify({ chat_id: chatId, message_id: messageId, caption, parse_mode: 'HTML', reply_markup: replyMarkup });
  return callTelegram(token, 'editMessageCaption', payload).catch(() => ({ ok: true }));
}

async function answerCallbackQuery(callbackQueryId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const payload = JSON.stringify({ callback_query_id: callbackQueryId, text });
  return callTelegram(token, 'answerCallbackQuery', payload);
}

async function callTelegram(token, method, payload) {
  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${token}/${method}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        try {
          const p = JSON.parse(data || '{}');
          if (p.ok) resolve(p); else reject(p);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// GET /api/telegram/set-webhook - Setup webhook URL
router.get('/telegram/set-webhook', async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = req.query.url || process.env.TELEGRAM_WEBHOOK_URL;
    if (!botToken || !webhookUrl) return res.status(400).json({ error: 'Missing token or URL' });
    const result = await callTelegram(botToken, 'setWebhook', JSON.stringify({ url: webhookUrl }));
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
