import { Router } from 'express';
import https from 'https';
import path from 'path';
import fs from 'fs';
import Notification from '../models/Notification.js';
import FileTransfer from '../models/FileTransfer.js';
import SignSchema from '../models/SignSchema.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// POST /api/notifications/send-stage
// body: { signatureId, stageKey, recordId, title?, message?, link?, botNumber? }
router.post('/send-stage', async (req, res) => {
  try {
    const { signatureId, stageKey, recordId, title, message, link, botNumber, sendAsUrl, linkOnly } = req.body || {};
    if (!signatureId) return res.status(400).json({ message: 'signatureId required' });

    // Normalize stageKey to canonical keys: s/s1/s2/s3/s4/s5/s6
    // Some callers may pass Khmer role labels; if so, resolve via the record's feedbackStageRoles.
    const allowedStageKeys = new Set(['s', 's1', 's2', 's3', 's4', 's5', 's6']);
    let canonicalStageKey = null;
    try {
      const raw = (stageKey === null || stageKey === undefined) ? '' : String(stageKey);
      const lower = raw.trim().toLowerCase();
      if (allowedStageKeys.has(lower)) {
        canonicalStageKey = lower;
      } else if (recordId) {
        const ft = await FileTransfer.findById(recordId).lean().exec().catch(() => null);
        const roles = ft && ft.meta && ft.meta.feedbackStageRoles;
        if (roles && typeof roles === 'object') {
          const trimmed = raw.trim();
          const found = Object.keys(roles).find(k => {
            if (!k) return false;
            const v = roles[k];
            if (v === null || v === undefined) return false;
            return String(v).trim() === trimmed;
          });
          if (found && allowedStageKeys.has(String(found).toLowerCase())) {
            canonicalStageKey = String(found).toLowerCase();
          }
        }
      }
    } catch (e) {
      canonicalStageKey = null;
    }

    let userToNotify = null;
    let signature = null;
    
    // Strategy 1: Try as user ID directly first (for direct user selection)
    try {
      userToNotify = await User.findById(signatureId).exec();
      if (userToNotify) {
        console.log(`✅ Found user directly by ID: ${userToNotify.fullName}`);
      }
    } catch (e) {
      // Not a valid user ID, continue to next strategy
    }

    // Strategy 2: Try as signature ID and find user by createdBy
    if (!userToNotify) {
      try {
        signature = await SignSchema.findById(signatureId).exec();
        if (signature && signature.createdBy) {
          userToNotify = await User.findById(signature.createdBy).exec();
          if (userToNotify) {
            console.log(`✅ Found user via signature.createdBy: ${userToNotify.fullName}`);
          }
        }
      } catch (e) {
        // Not a valid signature ID, continue to next strategy
      }
    }
    
    // Strategy 3: Search user by signature name match (fuzzy matching)
    if (!userToNotify) {
      try {
        if (!signature) {
          signature = await SignSchema.findById(signatureId).exec();
        }
        if (signature && signature.fullNameKh) {
          // Try exact match first
          userToNotify = await User.findOne({ fullName: signature.fullNameKh }).exec();
          
          // If no exact match, try partial match
          if (!userToNotify) {
            const allUsers = await User.find({ active: true }).exec();
            userToNotify = allUsers.find(u => {
              const uName = (u.fullName || '').toLowerCase().trim();
              const sName = (signature.fullNameKh || '').toLowerCase().trim();
              return uName.includes(sName) || sName.includes(uName);
            });
          }
          
          if (userToNotify) {
            console.log(`✅ Found user via name matching: ${userToNotify.fullName} (from signature: ${signature.fullNameKh})`);
          }
        }
      } catch (e) {
        console.warn('Strategy 3 failed:', e);
      }
    }

    if (!userToNotify) {
      console.warn(`❌ Could not find user for signatureId: ${signatureId}`);
      return res.status(404).json({ 
        message: 'Could not find user/signature to notify',
        signatureId: signatureId
      });
    }

    const notif = new Notification({
      userId: userToNotify._id,
      title: title || `Feedback assigned: ${stageKey || ''}`,
      message: message || `You were assigned stage ${stageKey || ''} for record ${recordId || ''}`,
      link: link || (recordId ? `/replay-file?recordId=${recordId}` : undefined),
      unread: true
    });

    await notif.save();

    // If user has telegram chat ID for the selected bot, send notification
    // Support multiple bots: use botNumber (1 or 2) to select which bot to use
    const botTokenKey = botNumber === 2 ? 'TELEGRAM_BOT_TOKEN_2' : 'TELEGRAM_BOT_TOKEN';
    const botToken = process.env[botTokenKey] || process.env.TG_BOT_TOKEN;
    
    // Select the appropriate chat ID based on which bot is being used
    const chatIdField = botNumber === 2 ? 'telegramChatId2' : 'telegramChatId';
    const chatId = userToNotify[chatIdField] || userToNotify.telegramId; // fallback to legacy telegramId
    
    if (botToken && chatId) {
      // Use chat ID directly (should be numeric like "6716545902")
      const telegramChatId = String(chatId).trim();

      // If the request provided a link, prefer that (frontend should send absolute URL)
      const providedLink = link || notif.link;
      // Ensure absolute URL for Telegram: if link is root-relative, prefix with frontend base
      const frontendBase = (process.env.FRONTEND_BASE || process.env.FRONTEND_URL || process.env.FRONTEND || process.env.FRONTEND_HOST || 'http://localhost:5173').replace(/\/$/, '');
      let finalLink = providedLink;
      try {
        if (providedLink && providedLink.startsWith('/')) {
          finalLink = frontendBase + providedLink;
        } else if (providedLink && !/^https?:\/\//i.test(providedLink)) {
          // treat as relative path
          finalLink = frontendBase + (providedLink.startsWith('/') ? providedLink : '/' + providedLink);
        }
      } catch (e) {
        finalLink = providedLink;
      }

      // Build Telegram message text. If `linkOnly` is requested and we have a link,
      // send only the clickable anchor so Telegram displays a concise link label.
      let telegramText;
      if (linkOnly && finalLink) {
        telegramText = `<a href="${finalLink}">🔗 បើកការឆ្លើយតប</a>`;
      } else {
        telegramText = (notif.title || '') + '\n' + (notif.message || '');
        // Embed stage key marker so Telegram replies can be mapped reliably (s/s1..s6)
        if (canonicalStageKey) {
          telegramText += `\nSTAGE_KEY៖ ${canonicalStageKey}`;
        }
        if (finalLink) {
          telegramText += '\n' + `<a href="${finalLink}">🔗 បើកការឆ្លើយតប</a>`;
        }
      }

      // Try to attach the first available file/attachment as a Telegram document
      let sentViaDocument = false;
      try {
        const ft = recordId ? await FileTransfer.findById(recordId).lean().exec().catch(() => null) : null;
        const fileList = (ft && Array.isArray(ft.attachments) && ft.attachments.length > 0) ? ft.attachments : (ft && Array.isArray(ft.files) ? ft.files : []);
        if (fileList && fileList.length > 0) {
          // Determine whether the stored value points to a local file under public/
          const raw = String(fileList[0] || '').trim();
          let handled = false;
          const tryLocalSend = async () => {
            try {
              const localPathCandidates = [];
              // If value looks like an absolute URL, skip local send
              if (/^https?:\/\//i.test(raw)) return false;
              // Normalize potential leading slashes
              const rel = raw.replace(/^\/+/, '');
              // Common locations: public/<rel>, public/Uploads/<rel>, public/uploads/<rel>
              localPathCandidates.push(path.join(process.cwd(), 'public', rel));
              localPathCandidates.push(path.join(process.cwd(), 'public', 'Uploads', rel.replace(/^Uploads\/?/, '')));
              localPathCandidates.push(path.join(process.cwd(), 'public', 'uploads', rel.replace(/^uploads\/?/, '')));
              for (const p of localPathCandidates) {
                try {
                  if (fs.existsSync(p)) {
                    // Read file and upload as multipart/form-data to Telegram
                    const mimeType = (() => {
                      const ext = path.extname(p).toLowerCase();
                      if (ext === '.pdf') return 'application/pdf';
                      if (ext === '.png') return 'image/png';
                      if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
                      if (ext === '.txt') return 'text/plain';
                      return 'application/octet-stream';
                    })();

                    const fileBuffer = fs.readFileSync(p);
                    const fileName = path.basename(p);
                    const boundary = '----HRMSFormBoundary' + Date.now();
                    const CRLF = '\r\n';
                    const pre = Buffer.from(
                      `--${boundary}${CRLF}` +
                      `Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}${telegramChatId}${CRLF}` +
                      `--${boundary}${CRLF}` +
                      `Content-Disposition: form-data; name="caption"${CRLF}${CRLF}${telegramText}${CRLF}` +
                      `--${boundary}${CRLF}` +
                      `Content-Disposition: form-data; name="parse_mode"${CRLF}${CRLF}HTML${CRLF}` +
                      `--${boundary}${CRLF}` +
                      `Content-Disposition: form-data; name="document"; filename="${fileName}"${CRLF}` +
                      `Content-Type: ${mimeType}${CRLF}${CRLF}`
                    );
                    const post = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
                    const contentLength = pre.length + fileBuffer.length + post.length;

                    const docOptions = {
                      hostname: 'api.telegram.org',
                      port: 443,
                      path: `/bot${botToken}/sendDocument`,
                      method: 'POST',
                      headers: {
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': contentLength
                      }
                    };

                    const reqDoc = https.request(docOptions, (r) => {
                      let data = '';
                      r.on('data', (chunk) => { data += chunk; });
                      r.on('end', () => {
                        try {
                          const parsed = JSON.parse(data || '{}');
                          if (!parsed.ok) console.warn('Telegram sendDocument failed', parsed);
                        } catch (e) { console.warn('Telegram sendDocument parse error', e); }
                      });
                    });
                    reqDoc.on('error', (err) => { console.warn('Telegram sendDocument error', err); });
                    reqDoc.write(pre);
                    reqDoc.write(fileBuffer);
                    reqDoc.write(post);
                    reqDoc.end();

                    console.log('Sent local file to Telegram:', p);
                    return true;
                  }
                } catch (e) {
                  // ignore per-path errors and try next
                }
              }
            } catch (e) {
              // errors — fall back
            }
            return false;
          };

          let localSent = false;
          if (!sendAsUrl) {
            localSent = await tryLocalSend();
          }
          if (localSent) {
            sentViaDocument = true;
            handled = true;
          } else {
            // Fallback: prefer absolute URLs, but accept relative paths by prefixing frontendBase
            let fileUrl = raw;
            if (fileUrl && fileUrl.startsWith('/')) fileUrl = frontendBase + fileUrl;
            else if (fileUrl && !/^https?:\/\//i.test(fileUrl)) fileUrl = frontendBase + (fileUrl.startsWith('/') ? fileUrl : '/' + fileUrl);

            if (fileUrl) {
              const docPayload = JSON.stringify({ chat_id: telegramChatId, document: fileUrl, caption: telegramText, parse_mode: 'HTML' });
              const docOptions = {
                hostname: 'api.telegram.org',
                port: 443,
                path: `/bot${botToken}/sendDocument`,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(docPayload)
                }
              };

              const reqDoc = https.request(docOptions, (r) => {
                let data = '';
                r.on('data', (chunk) => { data += chunk; });
                r.on('end', () => {
                  try {
                    const parsed = JSON.parse(data || '{}');
                    if (!parsed.ok) console.warn('Telegram sendDocument failed', parsed);
                  } catch (e) {
                    console.warn('Telegram sendDocument parse error', e);
                  }
                });
              });
              reqDoc.on('error', (err) => { console.warn('Telegram sendDocument error', err); });
              reqDoc.write(docPayload);
              reqDoc.end();

              sentViaDocument = true;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to send document, falling back to text message', e);
      }

      // If no document was sent, fall back to sendMessage (text)
      if (!sentViaDocument) {
        const payload = JSON.stringify({
          chat_id: telegramChatId,
          text: telegramText,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        });

        const options = {
          hostname: 'api.telegram.org',
          port: 443,
          path: `/bot${botToken}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };

        const reqHttps = https.request(options, (r) => {
          let data = '';
          r.on('data', (chunk) => { data += chunk; });
          r.on('end', () => {
            try {
              const parsed = JSON.parse(data || '{}');
              // don't fail the request if telegram fails — just log
              if (!parsed.ok) console.warn('Telegram send failed', parsed);
            } catch (e) {
              console.warn('Telegram send parse error', e);
            }
          });
        });

        reqHttps.on('error', (err) => {
          console.warn('Telegram send error', err);
        });

        reqHttps.write(payload);
        reqHttps.end();
      }
    }

    return res.json({ ok: true, notification: notif });
  } catch (err) {
    console.error('send-stage error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

// POST /api/notifications/send-test
// body: { userId, title?, message?, link? }
router.post('/send-test', async (req, res) => {
  try {
    const { userId, title, message, link } = req.body || {};
    if (!userId) return res.status(400).json({ message: 'userId required' });
    // try to find the user
    let user = null;
    try { user = await User.findById(userId).exec(); } catch (e) { user = null; }
    if (!user) return res.status(404).json({ message: 'User not found' });

    const notif = new Notification({
      userId: user._id,
      title: title || 'Test notification',
      message: message || 'This is a test message from the system',
      link: link || undefined,
      unread: true
    });
    await notif.save();

    // reuse telegram send logic
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    if (botToken && user.telegramId) {
      let raw = String(user.telegramId || '').trim();
      let chatId = raw;
      try {
        if (/^https?:\/\//i.test(raw)) {
          const u = new URL(raw);
          const seg = (u.pathname || '').replace(/^\/+/, '');
          if (seg) chatId = seg.startsWith('@') ? seg : '@' + seg;
        } else if (!/^@/.test(raw) && !/^\d+$/.test(raw)) {
          chatId = '@' + raw;
        }
      } catch (e) {
        chatId = raw;
      }

      // For send-test: also ensure absolute link when provided
      const testProvided = link;
      let testFinal = testProvided;
      try {
        const frontendBase2 = (process.env.FRONTEND_BASE || process.env.FRONTEND_URL || process.env.FRONTEND || process.env.FRONTEND_HOST || 'http://localhost:5173').replace(/\/$/, '');
        if (testProvided && testProvided.startsWith('/')) testFinal = frontendBase2 + testProvided;
        else if (testProvided && !/^https?:\/\//i.test(testProvided)) testFinal = frontendBase2 + (testProvided.startsWith('/') ? testProvided : '/' + testProvided);
      } catch (e) { testFinal = testProvided; }

      const telegramText = (notif.title || '') + '\n' + (notif.message || '') + (testFinal ? ('\n' + `<a href="${testFinal}">🔗 បើកការឆ្លើយតប</a>`) : '');
      const payload = JSON.stringify({ chat_id: chatId, text: telegramText, parse_mode: 'HTML', disable_web_page_preview: false });

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const reqHttps = https.request(options, (r) => {
        let data = '';
        r.on('data', (chunk) => { data += chunk; });
        r.on('end', () => {
          try {
            const parsed = JSON.parse(data || '{}');
            if (!parsed.ok) console.warn('Telegram test send failed', parsed);
          } catch (e) { console.warn('Telegram test send parse error', e); }
        });
      });
      reqHttps.on('error', (err) => { console.warn('Telegram test send error', err); });
      reqHttps.write(payload);
      reqHttps.end();
    }

    return res.json({ ok: true, notification: notif });
  } catch (err) {
    console.error('send-test error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
