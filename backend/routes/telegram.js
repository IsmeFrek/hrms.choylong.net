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
  // Prefer using an explicit date (fallbackDate) so we can format using a timezone.
  // If fallbackDate is provided, format that date's time in the configured timezone.
  const tz = process.env.TELEGRAM_TIMEZONE || process.env.DEFAULT_TIMEZONE || 'Asia/Phnom_Penh';
  try {
    if (fallbackDate) {
      const fallbackStr = String(fallbackDate);
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(fallbackStr);

      // Build a Date object from the fallback. If it's a Date already, clone it.
      let dt;
      if (fallbackDate instanceof Date) {
        dt = new Date(fallbackDate);
      } else {
        dt = new Date(fallbackStr);
      }
      if (!isNaN(dt.getTime())) {
        // If an explicit time string `t` is provided, try to merge it into the fallback date
        // so that timezone-aware formatting uses the intended hour/minute.
        if (t) {
          // Accept forms like "7", "7:00", "07:00:00" etc.
          const m = String(t).match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?/);
          if (m) {
            const hh = parseInt(m[1], 10);
            const mm = parseInt(m[2] || '0', 10);
            dt.setHours(hh, mm, 0, 0);
          } else {
            // Fallback: try to parse a combined string (may succeed for '7 AM' etc.)
            const tryDt = new Date(fallbackStr + ' ' + String(t));
            if (!isNaN(tryDt.getTime())) dt.setTime(tryDt.getTime());
          }
        } else {
          // No explicit time: if fallback was a date-only string or an ISO midnight (UTC) value,
          // don't show a time (avoid showing 07:00 due to timezone conversion).
          const isIsoMidnightUtc = (dt.getUTCHours && dt.getUTCHours() === 0 && dt.getUTCMinutes && dt.getUTCMinutes() === 0);
          if (isDateOnly || isIsoMidnightUtc) return '';
        }

        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(dt);
      }
    }
  } catch (e) {
    // fall through to string parsing
  }

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

// POST /api/telegram/webhook - Receive updates from Telegram
router.post('/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    console.log('Telegram webhook received:', JSON.stringify(update, null, 2));
    try { fs.appendFileSync('backend/telegram_debug.log', `ENTER_WEBHOOK ${new Date().toISOString()} updateId=${update.update_id}\n`); } catch (e) {}

    // Handle callback queries (inline button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;

      // Parse callback data: edit_feedback:recordId:feedbackIndex
      if (data && data.startsWith('edit_feedback:')) {
        const parts = data.replace('edit_feedback:', '').split(':');
        const recordId = parts[0];
        const feedbackIndex = parts[1] ? parseInt(parts[1]) : -1;
        
        // Find user: prefer numeric chat id fields, fallback to legacy telegramId
        let user = await User.findOne({ telegramChatId: String(chatId) }).exec();
        if (!user) user = await User.findOne({ telegramId: String(chatId) }).exec();
        if (!user) {
          await answerCallbackQuery(callbackQuery.id, '❌ រកមិនឃើញអ្នកប្រើប្រាស់');
          return res.json({ ok: true });
        }

        // Auto-migrate legacy linkage (telegramId == chatId) into telegramChatId for Bot 1
        try {
          if (!user.telegramChatId && /^[-]?[0-9]+$/.test(String(chatId))) {
            user.telegramChatId = String(chatId);
            await user.save().catch(() => null);
          }
        } catch (e) {}
        
        // Store edit session in a temporary message that will be replied to
        const editMessage = await sendTelegramMessage(
          chatId,
          `✏️ <b>កែប្រែមតិ</b>\n\n` +
          `📄 ឯកសារ៖ ${recordId}\n\n` +
          `សូមឆ្លើយតប (Reply) សារនេះដើម្បីបញ្ចូលមតិថ្មី៖`,
          {
            inline_keyboard: [[
              { text: '❌ បោះបង់', callback_data: 'cancel_edit' }
            ]]
          }
        );
        
        // Store edit context in message (we'll extract recordId from reply later)
        
        // Answer callback query
        await answerCallbackQuery(callbackQuery.id, 'សូមឆ្លើយតបសារខាងលើ');
      } else if (data === 'cancel_edit') {
        await answerCallbackQuery(callbackQuery.id, 'បានបោះបង់');
        // Optionally delete the edit message
      }
      
      return res.json({ ok: true });
    }

    // Handle text messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const messageText = update.message.text;
      const replyToMessage = update.message.reply_to_message;
      try {
        if (replyToMessage && replyToMessage.caption) {
          const dbg = `DBG ${new Date().toISOString()} chatId=${chatId} from=${JSON.stringify(update.message.from || {})} replyTo.message_id=${replyToMessage.message_id} captionLen=${String(replyToMessage.caption || '').length}\n`;
          try { fs.appendFileSync('backend/telegram_debug.log', dbg); } catch (e) { /* ignore */ }
        }
      } catch (e) {}
      // Determine original message text or caption (support replies to document captions)
      const originalIsCaption = replyToMessage && !replyToMessage.text && replyToMessage.caption;
      const originalTextForParsing = replyToMessage ? (replyToMessage.text || replyToMessage.caption || '') : '';

      // Handle /link command for account linking
      if (messageText.startsWith('/link ')) {
        const code = messageText.replace('/link ', '').trim();
        const userData = {
          username: update.message.from.username,
          firstName: update.message.from.first_name,
          lastName: update.message.from.last_name
        };
        
        const result = await verifyLinkCode(code, chatId, userData);
        
        if (result.success) {
          await sendTelegramMessage(
            chatId,
            `✅ <b>បានភ្ជាប់ដោយជោគជ័យ!</b>\n\n` +
            `👤 គណនី៖ ${result.userName}\n` +
            `💬 Chat ID៖ ${chatId}\n\n` +
            `ឥឡូវអ្នកនឹងទទួលបានការជូនដំណឹងពីប្រព័ន្ធ។`
          );
        } else {
          await sendTelegramMessage(
            chatId,
            `❌ <b>មិនអាចភ្ជាប់បានទេ</b>\n\n` +
            `${result.message}\n\n` +
            `សូមស្នើរកូដថ្មីពីប្រព័ន្ធ។`
          );
        }
        
        return res.json({ ok: true });
      }

      // Find user by telegram chat ID (Bot 1 webhook)
      // Prefer telegramChatId, fallback to legacy telegramId.
      let user = null;
      try {
        user = await User.findOne({ telegramChatId: String(chatId) }).exec();
        if (!user) user = await User.findOne({ telegramId: String(chatId) }).exec();
      } catch (e) {
        try { fs.appendFileSync('backend/telegram_debug.log', `USR_LOOKUP_ERR ${new Date().toISOString()} ${String(e)}\n`); } catch (e2) {}
      }
      try { fs.appendFileSync('backend/telegram_debug.log', `USR_LOOKUP ${new Date().toISOString()} chatId=${chatId} found=${!!user}\n`); } catch (e) {}
      if (!user) {
        console.warn('User not found for chat ID:', chatId);
        try { fs.appendFileSync('backend/telegram_debug.log', `USR_NOTFOUND ${new Date().toISOString()} chatId=${chatId}\n`); } catch (e) {}
        return res.json({ ok: true }); // Still return ok to Telegram
      }

      // Auto-migrate legacy linkage (telegramId == chatId) into telegramChatId for Bot 1
      try {
        if (!user.telegramChatId && /^[-]?[0-9]+$/.test(String(chatId))) {
          user.telegramChatId = String(chatId);
          await user.save().catch(() => null);
        }
      } catch (e) {}

      // Check if this is a reply to a notification message (support replies to captions)
      if (replyToMessage) {
        // Use the original text/caption for parsing and edit-detection
        const isEditRequest = String(originalTextForParsing || '').includes('✏️') && String(originalTextForParsing || '').includes('កែប្រែមតិ');
        
        // Extract record ID from the original message (support Khmer colon `៖` and ASCII `:`)
        let recordIdMatch = String(originalTextForParsing || '').match(/(?:លេខកត់ត្រា|ឯកសារ)\s*[:៖]\s*([a-f0-9]{24})/i);
        // Fallback: match any 24-hex sequence in the original text/caption
        if (!recordIdMatch) {
          recordIdMatch = String(originalTextForParsing || '').match(/\b([a-f0-9]{24})\b/i);
        }

        if (recordIdMatch) {
          const recordId = recordIdMatch[1];
          try { fs.appendFileSync('backend/telegram_debug.log', `RECORD_ID ${new Date().toISOString()} recordId=${recordId}\n`); } catch (e) {}
          
          // Update the FileTransfer record with the feedback
          const fileTransfer = await FileTransfer.findById(recordId).exec();
          if (fileTransfer) {
            try { fs.appendFileSync('backend/telegram_debug.log', `RECORD_FOUND ${new Date().toISOString()} id=${fileTransfer._id}\n`); } catch (e) {}
            const meta = fileTransfer.meta || {};
            
            // Initialize telegramFeedback array if needed
            if (!meta.telegramFeedback) {
              meta.telegramFeedback = [];
            }
            
            if (isEditRequest) {
              // This is an EDIT - find and update the user's latest feedback
              const userFeedbackIndex = meta.telegramFeedback.findLastIndex(
                fb => fb.userId && fb.userId.toString() === user._id.toString()
              );
              
              if (userFeedbackIndex !== -1) {
                const oldMessageId = meta.telegramFeedback[userFeedbackIndex].originalMessageId;
                
                // Update existing feedback in database
                meta.telegramFeedback[userFeedbackIndex].message = messageText;
                meta.telegramFeedback[userFeedbackIndex].timestamp = new Date();
                meta.telegramFeedback[userFeedbackIndex].edited = true;
                
                fileTransfer.meta = meta;
                // `meta` is a Mixed type; ensure Mongoose persists nested changes
                try { fileTransfer.markModified('meta'); } catch (e) {}
                await fileTransfer.save();
                
                // Update the original notification message in Telegram
                if (oldMessageId) {
                  try {
                    // Get document details for updated message
                    const docName = fileTransfer.documentName || fileTransfer.title || 'គ្មានឈ្មោះ';
                    const sender = fileTransfer.sender || 'គ្មានឈ្មោះ';
                    
                    // Get existing feedback to display
                    const existingFeedback = [];
                    const metaFields = ['CourseNote', 'CourseDate', 'ApprovedNote', 'ApprovedDate', 
                                       'CoordinationNote', 'CoordinationDate', 'ReturnNote', 'ReturnDate'];
                    
                    for (let i = 0; i < metaFields.length; i += 2) {
                      const noteField = metaFields[i];
                      const dateField = metaFields[i + 1];
                      if (meta[noteField]) {
                        const stageName = noteField.replace('Note', '').replace('Course', 'នាយកដ្ឋាន')
                          .replace('Approved', 'អនុម័ត').replace('Coordination', 'សម្របសម្រួល')
                          .replace('Return', 'ត្រឡប់មកវិញ');
                        existingFeedback.push(
                          `${stageName}: ${meta[noteField]}` +
                          (meta[dateField] ? ` (${new Date(meta[dateField]).toLocaleDateString('km-KH')})` : '')
                        );
                      }
                    }
                    
                    // Build updated message with edited feedback
                    let updatedMessage = `📄 <b>ឯកសារថ្មី</b>\n\n` +
                      `📋 ឈ្មោះ៖ ${docName}\n` +
                      `👤 អ្នកផ្ញើ៖ ${sender}\n` +
                      `🆔 លេខកត់ត្រា៖ ${recordId}\n\n`;
                    
                    if (existingFeedback.length > 0) {
                      updatedMessage += `📝 <b>មតិវគ្គមុនៗ៖</b>\n` +
                        existingFeedback.map(f => `  • ${f}`).join('\n') + '\n\n';
                    }
                    
                    updatedMessage += `<b>✅ បាន reply មតិ (កែប្រែ)</b>\n` +
                      `💬 មតិ៖ "${messageText}"\n` +
                      `🔄 កែប្រែនៅ៖ ${new Date().toLocaleString('km-KH')}`;
                    
                    // Update with edit button still available
                    const inlineKeyboard = {
                      inline_keyboard: [[
                        { text: '✏️ កែប្រែមតិ', callback_data: `edit_feedback:${recordId}` }
                      ]]
                    };
                    
                    // If original notification used a document caption, edit the caption instead.
                    if (originalIsCaption) {
                      await editTelegramCaption(chatId, oldMessageId, updatedMessage, inlineKeyboard);
                    } else {
                      await editTelegramMessage(chatId, oldMessageId, updatedMessage, inlineKeyboard);
                    }
                  } catch (updateErr) {
                    console.warn('Failed to update original message:', updateErr);
                  }
                }
                
                // Send confirmation
                await sendTelegramMessage(
                  chatId,
                  `✅ <b>មតិរបស់អ្នកត្រូវបានកែប្រែរួចរាល់</b>\n\n` +
                  `📄 ឯកសារ៖ ${recordId}\n` +
                  `💬 មតិថ្មី៖ "${messageText}"\n` +
                  `⏰ ពេលវេលា៖ ${new Date().toLocaleString('km-KH')}\n\n` +
                  `ℹ️ សារដើមក៏ត្រូវបាន update ផងដែរ`
                );
                
                console.log(`Feedback edited for record ${recordId} from user ${user.fullName}`);
              } else {
                await sendTelegramMessage(chatId, '⚠️ រកមិនឃើញមតិចាស់របស់អ្នក');
              }
            } else {
              // This is a NEW feedback
              console.log('[TelegramFeedback] About to push feedback:', {
                userId: user._id,
                userName: user.fullName || user.name,
                message: messageText,
                timestamp: new Date(),
                chatId: String(chatId),
                originalMessageId: replyToMessage.message_id
              });
              meta.telegramFeedback.push({
                userId: user._id,
                userName: user.fullName || user.name,
                message: messageText,
                timestamp: new Date(),
                chatId: String(chatId),
                originalMessageId: replyToMessage.message_id  // Store for future edits
              });
              console.log('[TelegramFeedback] Feedback array after push:', meta.telegramFeedback);

              // Determine stage key for this reply.
              // Preferred: read an explicit marker embedded in the notification message.
              // Support both canonical keys (s/s1..s6) and older markers that used Khmer role labels.
              const replyText = String(originalTextForParsing || '');
              const stageMarkerKeyMatch = replyText.match(/(?:STAGE_KEY|StageKey|#stage)\s*[:៖]?\s*(s[0-6]?)/i);
              const stageMarkerAnyMatch = replyText.match(/(?:STAGE_KEY|StageKey|#stage)\s*[:៖]?\s*([^\n\r]+)/i);
              let stageMarkerRaw = stageMarkerAnyMatch ? String(stageMarkerAnyMatch[1] || '').trim() : '';
              // Some messages may contain literal "\\n" text; trim anything after newline markers.
              if (stageMarkerRaw) {
                stageMarkerRaw = stageMarkerRaw.split(/\r?\n|\\n/)[0].trim();
              }
              let stageFromMarker = stageMarkerKeyMatch ? String(stageMarkerKeyMatch[1]).toLowerCase() : null;

              // If marker is not a canonical key, try mapping from role label to stage key via feedbackStageRoles
              try {
                if (!stageFromMarker && stageMarkerRaw && meta && meta.feedbackStageRoles && typeof meta.feedbackStageRoles === 'object') {
                  const roles = meta.feedbackStageRoles;
                  const found = Object.keys(roles).find(k => {
                    if (!k) return false;
                    const v = roles[k];
                    if (v === null || v === undefined) return false;
                    return String(v).trim() === stageMarkerRaw;
                  });
                  if (found) stageFromMarker = String(found).toLowerCase();
                }
              } catch (e) {}

              // If STAGE_KEY is missing, try inferring from the "វគ្គ" line in the message.
              // Example lines can be: "វគ្គ ៖ s1" or "វគ្គ ៖ ប្រធានការិយាល័យ".
              try {
                if (!stageFromMarker) {
                  const stageLineMatch = replyText.match(/(?:🔖\s*)?វគ្គ\s*[:៖]\s*([^\n\r]+)/i);
                  let stageLineRaw = stageLineMatch ? String(stageLineMatch[1] || '').trim() : '';
                  if (stageLineRaw) stageLineRaw = stageLineRaw.split(/\r?\n|\\n/)[0].trim();

                  // If it already contains a canonical key, use it.
                  const keyInLine = stageLineRaw.match(/\b(s[0-6]?)\b/i);
                  if (keyInLine) {
                    stageFromMarker = String(keyInLine[1]).toLowerCase();
                  } else if (stageLineRaw && meta && meta.feedbackStageRoles && typeof meta.feedbackStageRoles === 'object') {
                    // Map role label -> stage key
                    const roles = meta.feedbackStageRoles;
                    const found = Object.keys(roles).find(k => {
                      if (!k) return false;
                      const v = roles[k];
                      if (v === null || v === undefined) return false;
                      return String(v).trim() === stageLineRaw;
                    });
                    if (found) stageFromMarker = String(found).toLowerCase();
                  }
                }
              } catch (e) {}

              console.log('[TelegramFeedback] Stage marker raw:', stageMarkerRaw, '=> stageFromMarker:', stageFromMarker);

              // Determine which stage this user corresponds to (if any)
              const stages = meta.feedbackStages || {};
              const stageKeys = ['s','s1','s2','s3','s4','s5','s6'];
              const metaMapping = { s: 'CourseNote', s1: 'Course1Note', s2: 'Course2Note', s3: 'Course3Note', s4: 'Course4Note', s5: 'Course5Note', s6: 'Course6Note' };
              const dateMapping = { s: 'CourseDate', s1: 'Course1Date', s2: 'Course2Date', s3: 'Course3Date', s4: 'Course4Date', s5: 'Course5Date', s6: 'Course6Date' };

              let currentStageKey = stageFromMarker || null;
              for (const k of stageKeys) {
                if (currentStageKey) break;
                const assigned = stages[k];
                if (!assigned) continue;
                try {
                  // If assigned points to a signature id, check signature.createdBy
                  const SignModel = await import('../models/SignSchema.js').then(m => m.default).catch(() => null);
                  if (SignModel) {
                    const sig = await SignModel.findById(assigned).exec().catch(() => null);
                    if (sig && sig.createdBy && String(sig.createdBy) === String(user._id)) { currentStageKey = k; break; }
                  }
                } catch (e) {}
                // Or if assigned equals user id
                if (String(assigned) === String(user._id)) { currentStageKey = k; break; }
              }
              console.log('Telegram reply matched stage:', currentStageKey, 'for user:', user._id?.toString());


              // Save feedback into the correct meta field for this stage
              // If we cannot determine the stage, default to s (CourseNote)
              let saveKey = currentStageKey;
              if (!saveKey || !metaMapping[saveKey]) {
                saveKey = 's';
              }
              const metaNoteKey = metaMapping[saveKey] || 'CourseNote';
              const metaDateKey = dateMapping[saveKey] || 'CourseDate';

              meta[metaNoteKey] = messageText;
              meta[metaDateKey] = new Date().toISOString();

              // Also store a clear per-stage Telegram reply structure (requested: s/s1/s2/s3/s4/s5/s6)
              // This avoids relying on `others` for structured data.
              if (!meta.telegramReplyStages || typeof meta.telegramReplyStages !== 'object') {
                meta.telegramReplyStages = { s: null, s1: null, s2: null, s3: null, s4: null, s5: null, s6: null };
              }
              // Ensure keys exist
              for (const k of ['s','s1','s2','s3','s4','s5','s6']) {
                if (!(k in meta.telegramReplyStages)) meta.telegramReplyStages[k] = null;
              }
              meta.telegramReplyStages[saveKey] = {
                message: messageText,
                timestamp: new Date(),
                userId: user._id,
                userName: user.fullName || user.name,
                chatId: String(chatId),
                originalMessageId: replyToMessage.message_id
              };

              console.log(`[TelegramFeedback] Saved reply to meta field: ${metaNoteKey}`);
              console.log(`[TelegramFeedback] Saved reply to meta.telegramReplyStages.${saveKey}`);

              // Avoid polluting `others` with Telegram logs (kept in meta.telegramFeedback/meta.telegramReplyStages).
              // For backward compatibility, enable append via TELEGRAM_APPEND_TO_OTHERS=1
              const shouldAppendToOthers = String(process.env.TELEGRAM_APPEND_TO_OTHERS || '').trim() === '1';
              if (shouldAppendToOthers) {
                const feedbackText = `[Telegram - ${user.fullName}]: ${messageText}`;
                if (fileTransfer.others) {
                  fileTransfer.others += '\n' + feedbackText;
                } else {
                  fileTransfer.others = feedbackText;
                }
              }

              fileTransfer.meta = meta;
              try {
                // `meta` is a Mixed type; ensure Mongoose persists nested changes
                try { fileTransfer.markModified('meta'); } catch (e) {}
                await fileTransfer.save();
                console.log('[TelegramFeedback] fileTransfer saved successfully for record', recordId);
              } catch (err) {
                console.error('[TelegramFeedback] Error saving fileTransfer:', err);
              }

              // After saving, attempt to send notification to the next stage (sequential flow)
              try {
                // Find the index of the current stage in order
                const idx = stageKeys.indexOf(currentStageKey || 's');
                // Find next stage that has an assigned signature/user and no feedback saved yet
                let nextStage = null;
                for (let i = idx + 1; i < stageKeys.length; i++) {
                  const k = stageKeys[i];
                  const assigned = stages[k];
                  const noteKey = metaMapping[k];
                  const hasNote = noteKey && meta[noteKey];
                  if (assigned && !hasNote) { nextStage = k; break; }
                }

                if (nextStage) {
                  console.log('Next stage to notify:', nextStage);
                  const assigned = stages[nextStage];
                  // Resolve assigned (could be signature id or user id)
                  let notifyUser = null;
                  try {
                    const Sign = await import('../models/SignSchema.js').then(m => m.default).catch(() => null);
                    if (Sign) {
                      const sigDoc = await Sign.findById(assigned).exec().catch(() => null);
                      if (sigDoc && sigDoc.createdBy) {
                        notifyUser = await User.findById(sigDoc.createdBy).exec().catch(() => null);
                      }
                    }
                  } catch (e) {}
                  if (!notifyUser) {
                    // try as direct user id
                    try { notifyUser = await User.findById(assigned).exec().catch(() => null); } catch (e) { notifyUser = null; }
                  }

                  const pickNotifyTargets = (u) => {
                    const bot1Token = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
                    const bot2Token = process.env.TELEGRAM_BOT_TOKEN_2;
                    const raw = [
                      { botNumber: 2, token: bot2Token, chatId: u?.telegramChatId2, field: 'telegramChatId2' },
                      { botNumber: 1, token: bot1Token, chatId: u?.telegramChatId, field: 'telegramChatId' },
                    ];
                    const out = [];
                    const seen = new Set();
                    for (const t of raw) {
                      if (!t.token || t.chatId === null || t.chatId === undefined || t.chatId === '') continue;
                      const chatId = String(t.chatId).trim();
                      if (!/^[-]?[0-9]+$/.test(chatId)) continue;
                      if (chatId === '123456789') continue;
                      const key = `${t.botNumber}:${chatId}`;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      out.push({ ...t, chatId });
                    }
                    return out;
                  };

                  const notifyTargets = notifyUser ? pickNotifyTargets(notifyUser) : [];
                  if (notifyUser && notifyTargets.length) {
                    console.log('Will notify user:', notifyUser._id?.toString(), 'targets:', notifyTargets.map(t => `${t.field}:${t.chatId}`).join(', '));
                    // Build a simple notification message for next stage
                    const personName = notifyUser.fullName || notifyUser.name || '';
                    const stageLabel = nextStage;
                    const title = `📄 មានឯកសាររង់ចាំការពិនិត្យ`; 
                    const rawEntryTime = fileTransfer.entryTime || fileTransfer.entry_time || (fileTransfer._doc && fileTransfer._doc.entry_time) || '';

                    // Build a more detailed HTML message with bold labels
                    const letterNo = fileTransfer.letterNo || fileTransfer.letter_no || 'NA';
                    const source = fileTransfer.source || fileTransfer.origin || '';
                    const subject = fileTransfer.content || fileTransfer.description || fileTransfer.title || '';
                    const createdAt = fileTransfer.createdAt || fileTransfer._doc && fileTransfer._doc.createdAt || null;
                    const createdDateStr = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                    const createdTimeStr = createdAt ? formatTime(null, createdAt) : '';
                    const recipient = personName || '';
                    const entryDateStr = fileTransfer.date ? new Date(fileTransfer.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
                    const entryTime = formatTime(null, createdAt) || '';

                    const msgLines = [];
                    msgLines.push('📄 <b>មានឯកសាររង់ចាំការពិនិត្យនិងមានមតិយោប់</b>');
                    msgLines.push('');
                    msgLines.push(`<b>លេខលិខិត ៖</b> ${letterNo}`);
                    msgLines.push(`<b>ប្រភពឯកសារ ៖</b> ${source}`);
                    msgLines.push(`<b>កម្មវត្ថុ ៖</b> ${subject}`);
                    msgLines.push(`<b>ថ្ងៃខ岳ឆ្នាំផ្ញើមតិ ៖</b> ${createdDateStr}`);
                    if (createdTimeStr) msgLines.push(`🕘<b>វេលាម៉ោង ៖</b> ${createdTimeStr}`);
                    msgLines.push(`<b>អ្នកទទួល ៖</b> ${recipient}`);
                    msgLines.push(`<b>វគ្គ ៖</b> ${stageLabel}`);
                    msgLines.push(`<b>មតិ ៖</b> មិនទាន់ reply មតិបាន`);
                    msgLines.push(`<b>ឯកសារ ៖</b> ${fileTransfer._id}`);
                    msgLines.push('');
                    msgLines.push(`<b>ចូលថ្ងៃទី ៖</b> ${entryDateStr}`);
                    if (entryTime) msgLines.push(`<b>វេលាម៉ោង ៖</b> ${entryTime}`);
                    msgLines.push(`<b>លេខកត់ត្រា ៖</b> ${fileTransfer._id}`);
                    msgLines.push('💬 សូមចុច Reply នៅលើសារនេះ ដើម្បីផ្ញើមតិរបស់អ្នក');
                    msgLines.push(`STAGE_KEY៖ ${nextStage}`);
                    const msg = msgLines.join('\n');

                    // Build absolute link
                    const frontendBase = (process.env.FRONTEND_BASE || process.env.FRONTEND_URL || process.env.FRONTEND || process.env.FRONTEND_HOST || 'http://localhost:5173').replace(/\/$/, '');
                    const finalLink = frontendBase + `/replay-file?recordId=${fileTransfer._id}`;

                    // Save notification document
                    const Notification = await import('../models/Notification.js').then(m => m.default).catch(() => null);
                    if (Notification) {
                      const n = new Notification({ userId: notifyUser._id, title, message: msg, link: `/replay-file?recordId=${fileTransfer._id}`, unread: true });
                      await n.save().catch(() => null);
                      console.log('Saved notification record id:', n._id?.toString());
                    }

                    // Send Telegram message
                    const telegramText = msg + '\n' + `<a href="${finalLink}">🔗 បើកការឆ្លើយតប</a>`;
                    let sentOk = false;
                    for (const t of notifyTargets) {
                      try {
                        const sent = await sendTelegramMessage(String(t.chatId), telegramText, null, t.token);
                        if (sent && sent.ok) {
                          // Attempt to auto-attach documents (if any)
                          try {
                            const reqBase = (process.env.FRONTEND_BASE || process.env.FRONTEND_URL || process.env.FRONTEND || process.env.FRONTEND_HOST || '') || '';
                            const attachUrls = collectAttachmentUrls(fileTransfer, reqBase);
                            if (attachUrls && attachUrls.length) {
                              // limit to first 5 files
                              const slice = attachUrls.slice(0, 5);
                              for (const u of slice) {
                                try {
                                  const docRes = await sendTelegramDocumentUrl({ botToken: t.token, chatId: String(t.chatId), documentUrl: u, caption: title });
                                  const desc = (docRes && (docRes.description || docRes.message)) || '';
                                  const failedFetch = !(docRes && docRes.ok);
                                  const badUrlError = (docRes && docRes.error_code === 400) || String(desc || '').toLowerCase().includes('wrong http url');
                                  if (failedFetch && badUrlError) {
                                    // server-side fetch and upload as fallback
                                    try {
                                      console.log('Telegram cannot fetch URL, attempting server-side fetch:', u);
                                      const fetched = await fetchUrlToBuffer(u);
                                      const rawName = (u.split('/').pop() || '') || '';
                                      const decoded = rawName ? decodeURIComponent(rawName) : '';
                                      const ext = (fetched.contentType || '').split('/').pop() || 'pdf';
                                      let filename = decoded || `${(title || 'attachment').slice(0,60).replace(/[^a-z0-9_.-]/ig,'_')}_${String(fileTransfer._id).slice(-6)}.${ext}`;
                                      filename = filename || `attachment_${String(fileTransfer._id).slice(-6)}.${ext}`;
                                      const uploadRes = await sendTelegramDocument({ botToken: t.token, chatId: String(t.chatId), filename, buffer: fetched.buffer, caption: title });
                                      // no-op: uploadRes recorded in logs
                                    } catch (e) {
                                      console.warn('Server-side fetch/upload failed for', u, e && e.message ? e.message : e);
                                    }
                                  }
                                } catch (e) {
                                  console.warn('Attachment send failed for', u, e && e.message ? e.message : e);
                                }
                              }
                            }
                          } catch (e) {
                            console.warn('Auto-attach docs failed:', e && e.message ? e.message : e);
                          }

                          sentOk = true;
                          break;
                        }
                      } catch (e) {
                        console.warn('Telegram notify send failed:', { botNumber: t.botNumber, field: t.field, chatId: t.chatId, error: e?.message || String(e) });
                      }
                    }
                    if (!sentOk) {
                      console.warn('Telegram notify ultimately failed for next stage', nextStage, 'user', notifyUser._id?.toString());
                    }
                  }
                }
              } catch (notifyErr) {
                console.warn('Failed to auto-notify next stage:', notifyErr);
              }

              // Send confirmation AND update the original message to show feedback received
                try {
                // Update original message to show "បាន reply មតិ"
                const originalMessageId = replyToMessage.message_id;
                const inlineKeyboard = {
                  inline_keyboard: [[
                    { text: '✏️ កែប្រែមតិ', callback_data: `edit_feedback:${recordId}` }
                  ]]
                };

                try {
                  if (originalIsCaption) {
                    const updatedCaption = String(replyToMessage.caption || '').replace(
                      /<b>មិនទាន់ reply មតិបាន<\/b>/,
                      `<b>✅ បាន reply មតិ</b>\n📝 មតិ៖ "${messageText}"`
                    );
                    await editTelegramCaption(chatId, originalMessageId, updatedCaption, inlineKeyboard);
                  } else {
                    const updatedText = String(replyToMessage.text || '').replace(
                      /<b>មិនទាន់ reply មតិបាន<\/b>/,
                      `<b>✅ បាន reply មតិ</b>\n📝 មតិ៖ "${messageText}"`
                    );
                    await editTelegramMessage(chatId, originalMessageId, updatedText, inlineKeyboard);
                  }

                  // Edited original notification — send short confirmation
                  try {
                    await sendTelegramMessage(chatId, '✅ <b>បានរក្សាទុក</b>');
                  } catch (e) {
                    // ignore confirmation send errors
                  }
                } catch (editErr) {
                  // If edit fails, just send confirmation
                  console.warn('Failed to edit original message:', editErr);
                  await sendTelegramMessage(chatId, '✅ មតិរបស់អ្នកត្រូវបានរក្សាទុកក្នុងប្រព័ន្ធ');
                }
              } catch (editErr) {
                // If edit fails, just send confirmation
                console.warn('Failed to edit original message:', editErr);
                await sendTelegramMessage(chatId, '✅ មតិរបស់អ្នកត្រូវបានរក្សាទុកក្នុងប្រព័ន្ធ');
              }
              
              console.log(`Feedback saved for record ${recordId} from user ${user.fullName}`);
            }
          } else {
            await sendTelegramMessage(chatId, '⚠️ រកមិនឃើញឯកសារនេះ');
          }
        } else {
          // Reply without record ID but is a reply-to message: send short warning
          if (replyToMessage) {
            await sendTelegramMessage(chatId, '⚠️ មិនអាចរកលេខកត់ត្រាបាន — សូម Reply លើសារជូនដំណឹងដែលមានលេខកត់ត្រា');
          } else {
            // Not a reply - general instruction
            await sendTelegramMessage(chatId, 'សូមឆ្លើយតបដោយផ្ទាល់នៅលើសារជូនដំណឹងដើម្បីភ្ជាប់មតិទៅឯកសារ');
          }
        }
      } else {
        // Not a reply - could be a command or general message
        if (messageText.startsWith('/start')) {
          await sendTelegramMessage(
            chatId, 
            `សូមស្វាគមន៍! 👋\n\n` +
            `អ្នកបានភ្ជាប់ Telegram ជាមួយប្រព័ន្ធរបស់យើង។\n\n` +
            `ដើម្បីផ្ញើមតិ៖ សូមឆ្លើយតប (Reply) នៅលើសារជូនដំណឹងដែលអ្នកទទួលបាន`
          );
        } else if (messageText.startsWith('/help')) {
          await sendTelegramMessage(
            chatId,
            `📚 ជំនួយ\n\n` +
            `/start - ចាប់ផ្តើម bot\n` +
            `/help - បង្ហាញជំនួយ\n\n` +
            `ដើម្បីផ្ញើមតិអំពីឯកសារ៖\n` +
            `១. រង់ចាំសារជូនដំណឹង\n` +
            `២. ចុច "Reply" នៅលើសារនោះ\n` +
            `៣. សរសេរមតិរបស់អ្នក\n` +
            `៤. ផ្ញើ - មតិនឹងត្រូវរក្សាទុកក្នុងប្រព័ន្ធ`
          );
        } else {
          // General message - instruct to reply to notification
          await sendTelegramMessage(
            chatId,
            `សូមឆ្លើយតប (Reply) នៅលើសារជូនដំណឹងដើម្បីភ្ជាប់មតិទៅឯកសារ`
          );
        }
      }
    }

    // Always return 200 OK to Telegram
    return res.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    // Still return ok to prevent Telegram from retrying
    return res.json({ ok: true });
  }
});

// POST /api/telegram/webhook2 - Receive updates from Bot 2 (@frek_automatebot)
router.post('/telegram/webhook2', async (req, res) => {
  try {
    const update = req.body;
    console.log('Telegram Bot 2 webhook received:', JSON.stringify(update, null, 2));

    // Use same webhook logic but with Bot 2 token
    // For now, just acknowledge - full implementation would duplicate the above logic
    // Or refactor to shared function
    
    // Simple acknowledgment for now
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const messageText = update.message.text;
      
      if (messageText.startsWith('/start')) {
        await sendTelegramMessage(
          chatId,
          `សូមស្វាគមន៍! 👋 (Bot 2)\n\nអ្នកកំពុងប្រើ @frek_automatebot`,
          null,
          process.env.TELEGRAM_BOT_TOKEN_2
        );
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Telegram Bot 2 webhook error:', err);
    return res.json({ ok: true });
  }
});

// Helper function to send Telegram message
async function sendTelegramMessage(chatId, text, replyMarkup = null, customBotToken = null) {
  const botToken = customBotToken || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
  if (!botToken) {
    console.warn('No Telegram bot token configured');
    return;
  }

  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  const payloadStr = JSON.stringify(payload);

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadStr)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (parsed.ok) {
            resolve(parsed);
          } else {
            console.warn('Telegram send failed:', parsed);
            const code = parsed?.error_code;
            const desc = parsed?.description;
            reject(new Error(`Telegram API error${code ? ` (${code})` : ''}${desc ? `: ${desc}` : ''}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('Telegram request error:', err);
      reject(err);
    });

    req.write(payloadStr);
    req.end();
  });
}

// Helpers for sending documents (used to auto-attach files when notifying)
function collectAttachmentUrls(item, reqBase) {
  const out = [];
  const push = (a) => {
    try {
      if (!a && a !== 0) return;
      let s = typeof a === 'string' ? a : (a && (a.url || a.filePath || a.path || a.name || a.filename));
      if (!s) return;
      s = String(s).trim();
      if (!s) return;
      if (/^https?:\/\//i.test(s)) { out.push(s); return; }
      // allow root-relative paths using frontend/base host if provided
      if (s.startsWith('/')) {
        if (reqBase) out.push(`${reqBase.replace(/\/$/, '')}${s}`);
        return;
      }
      const idx = s.indexOf('/Uploads/');
      if (idx >= 0) { if (reqBase) out.push(`${reqBase.replace(/\/$/, '')}${s.slice(idx)}`); return; }
      // fallback: assume filename under /Uploads/ on reqBase host
      if (reqBase) out.push(`${reqBase.replace(/\/$/, '')}/Uploads/${encodeURIComponent(s)}`);
    } catch (e) {}
  };

  if (!item) return out;
  if (item.attachments && Array.isArray(item.attachments)) item.attachments.forEach(a => push(a));
  if (item.files && Array.isArray(item.files)) item.files.forEach(a => push(a));
  const singleFields = ['filePath','file','attachment','url','document','letterFile','filename','ref_url','reference','letterFilePath','letterFileUrl'];
  singleFields.forEach(k => { if (item[k]) push(item[k]); });
  if (item.meta && typeof item.meta === 'object') {
    const m = item.meta;
    if (m.attachments && Array.isArray(m.attachments)) m.attachments.forEach(a => push(a));
    if (m.files && Array.isArray(m.files)) m.files.forEach(a => push(a));
    if (m.file) push(m.file);
    if (m.ref_url) push(m.ref_url);
  }

  // dedupe
  const uniq = [];
  const seen = new Set();
  for (const u of out) {
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    uniq.push(u);
  }
  return uniq;
}

async function sendTelegramDocumentUrl({ botToken, chatId, documentUrl, caption }) {
  try {
    const body = JSON.stringify({ chat_id: chatId, document: documentUrl, caption: String(caption || ''), parse_mode: 'HTML' });
    const opts = { hostname: 'api.telegram.org', port: 443, path: `/bot${botToken}/sendDocument`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    return await new Promise((resolve, reject) => {
      const r = https.request(opts, (resp) => {
        let data = '';
        resp.on('data', (c) => { data += c; });
        resp.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
      });
      r.on('error', (err) => reject(err));
      r.write(body);
      r.end();
    });
  } catch (e) { return { ok: false, error: e?.message || String(e) }; }
}

async function fetchUrlToBuffer(urlStr) {
  return await new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr);
      const client = u.protocol === 'http:' ? http : https;
      const opts = { hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443), path: u.pathname + (u.search || ''), method: 'GET', headers: { 'User-Agent': 'FileTransferAgent/1.0' } };
      const req2 = client.request(opts, (resp) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => { const b = Buffer.concat(chunks || []); resolve({ buffer: b, contentType: resp.headers['content-type'] || 'application/octet-stream' }); });
      });
      req2.on('error', (e) => reject(e));
      req2.end();
    } catch (e) { reject(e); }
  });
}

function buildMultipartFormData(parts) {
  const boundary = `----tgform_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.type === 'file') {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: ${part.contentType || 'application/octet-stream'}\r\n\r\n`));
      chunks.push(part.data);
      chunks.push(Buffer.from(`\r\n`));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
      chunks.push(Buffer.from(String(part.value ?? '')));
      chunks.push(Buffer.from(`\r\n`));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(chunks) };
}

async function sendTelegramDocument({ botToken, chatId, filename, buffer, caption }) {
  const { boundary, body } = buildMultipartFormData([
    { type: 'field', name: 'chat_id', value: String(chatId) },
    { type: 'field', name: 'caption', value: String(caption || '') },
    { type: 'field', name: 'parse_mode', value: 'HTML' },
    { type: 'file', name: 'document', filename, contentType: 'application/pdf', data: buffer }
  ]);

  const options = { hostname: 'api.telegram.org', port: 443, path: `/bot${botToken}/sendDocument`, method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length } };
  return await new Promise((resolve, reject) => {
    const r = https.request(options, (resp) => {
      let data = '';
      resp.on('data', (c) => { data += c; });
      resp.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    });
    r.on('error', (err) => reject(err));
    r.write(body);
    r.end();
  });
}

// Helper function to edit Telegram message
async function editTelegramMessage(chatId, messageId, newText, replyMarkup = null) {
  const tokens = [process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN, process.env.TELEGRAM_BOT_TOKEN_2].filter(Boolean);
  if (!tokens.length) {
    console.warn('No Telegram bot token configured');
    return;
  }

  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: newText,
    parse_mode: 'HTML'
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  const payloadStr = JSON.stringify(payload);

  for (const botToken of tokens) {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/editMessageText`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr)
      }
    };

    try {
      const result = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data || '{}');
              if (parsed.ok) resolve(parsed);
              else reject(parsed);
            } catch (e) { reject(e); }
          });
        });
        req.on('error', (err) => reject(err));
        req.write(payloadStr);
        req.end();
      });
      return result;
    } catch (err) {
      const desc = err && (err.description || err.message) ? (err.description || err.message) : String(err);
      // If Telegram reports the message is not modified, treat as success (no-op)
      if (String(desc).toLowerCase().includes('message is not modified')) {
        return { ok: true, result: 'not_modified' };
      }
      // Try next token
      console.warn('Telegram edit attempt failed for one token, trying next if available:', desc);
      continue;
    }
  }

  throw new Error('Telegram edit failed for all configured tokens');
}

// Helper function to edit Telegram message caption (for media messages)
async function editTelegramCaption(chatId, messageId, newCaption, replyMarkup = null) {
  const tokens = [process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN, process.env.TELEGRAM_BOT_TOKEN_2].filter(Boolean);
  if (!tokens.length) {
    console.warn('No Telegram bot token configured');
    return;
  }

  const payload = { chat_id: chatId, message_id: messageId, caption: newCaption, parse_mode: 'HTML' };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  const payloadStr = JSON.stringify(payload);

  for (const botToken of tokens) {
    const options = {
      hostname: 'api.telegram.org', port: 443, path: `/bot${botToken}/editMessageCaption`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payloadStr) }
    };

    try {
      const result = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data || '{}');
              if (parsed.ok) resolve(parsed); else reject(parsed);
            } catch (e) { reject(e); }
          });
        });
        req.on('error', (err) => reject(err));
        req.write(payloadStr);
        req.end();
      });
      return result;
    } catch (err) {
      const desc = err && (err.description || err.message) ? (err.description || err.message) : String(err);
      if (String(desc).toLowerCase().includes('message is not modified')) {
        return { ok: true, result: 'not_modified' };
      }
      console.warn('Telegram edit caption attempt failed for one token, trying next if available:', desc);
      continue;
    }
  }

  throw new Error('Telegram edit caption failed for all configured tokens');
}

// Helper function to answer callback query
async function answerCallbackQuery(callbackQueryId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
  if (!botToken) {
    console.warn('No Telegram bot token configured');
    return;
  }

  const payload = JSON.stringify({
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: false
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/answerCallbackQuery`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
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
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    const webhookUrl = req.query.url || process.env.TELEGRAM_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(400).json({ 
        error: 'Webhook URL required',
        usage: '/api/telegram/set-webhook?url=https://your-domain.com/api/telegram/webhook'
      });
    }

    const apiUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    
    const result = await new Promise((resolve, reject) => {
      https.get(apiUrl, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    return res.json(result);
  } catch (err) {
    console.error('Set webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/telegram/webhook-info - Get current webhook info
router.get('/telegram/webhook-info', async (req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    if (!botToken) {
      return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    const apiUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
    
    const result = await new Promise((resolve, reject) => {
      https.get(apiUrl, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    return res.json(result);
  } catch (err) {
    console.error('Get webhook info error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
