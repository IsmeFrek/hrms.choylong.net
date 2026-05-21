import express from 'express';
import FileTransfer from '../models/FileTransfer.js';
import { authRequired, requireAnyPermission } from '../middleware/auth.js';
import https from 'https';
import http from 'http';
import multer from 'multer';
import User from '../models/User.js';
import { buildPrintSheetHtml } from '../services/printSheet.js';
import { buildReplayReportHtml } from '../services/replayReport.js';
import { htmlToPdfBuffer } from '../services/renderPdf.js';

const router = express.Router();

/**
 * Parses a date string in DD/MM/YYYY or DD/MM/YYYY HH:mm format.
 * Useful for sanitizing legacy or localized date strings that Mongoose fails to cast.
 */
const parseKhmerDate = (s) => {
    if (!s || typeof s !== 'string') return null;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        const hour = m[4] ? parseInt(m[4], 10) : 0;
        const min = m[5] ? parseInt(m[5], 10) : 0;
        return new Date(year, month, day, hour, min);
    }
    return null;
};

// GET /file-transfers
// Query params: page (1-based), pageSize, type
router.get('/file-transfers', authRequired, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, type } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 10);

    const filter = {};
    if (type && type !== 'ទាំងអស់' && type !== 'សរុប') {
      // Match common fields for type/title
      filter.$or = [
        { type: type },
        { title: type },
        { letter_type: type }
      ];
    }

    const total = await FileTransfer.countDocuments(filter);
    const items = await FileTransfer.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((p - 1) * ps)
      .limit(ps)
      .lean()
      .exec();

    res.json({ items, total });
  } catch (err) {
    next(err);
  }
});

// GET /file-transfers/:id - fetch a single record (used by Replayfile/Sendfeedback pages)
router.get(
    '/file-transfers/:id',
    authRequired,
    requireAnyPermission(['view:fileTransfers', 'edit:fileTransfers', 'send:feedback', 'send:telegram']),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const item = await FileTransfer.findById(id).lean().exec();
            if (!item) return res.status(404).json({ message: 'File transfer not found' });
            return res.json(item);
        } catch (err) {
            if (err && (err.name === 'CastError' || err.kind === 'ObjectId')) {
                return res.status(400).json({ message: 'Invalid id' });
            }
            next(err);
        }
    }
);

// PUT /file-transfers/:id - update a record (meta notes, attachments, etc.)
router.put(
    '/file-transfers/:id',
    authRequired,
    requireAnyPermission(['edit:fileTransfers', 'edit:documents', 'send:feedback']),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const payload = req.body || {};

            // Prevent id mutation
            try {
                delete payload._id;
                delete payload.id;
            } catch { /* ignore */ }

            // Normalize attachments if provided as single string
            if (payload.attachments && typeof payload.attachments === 'string') {
                payload.attachments = [payload.attachments];
            }

            const item = await FileTransfer.findById(id).exec();
            if (!item) return res.status(404).json({ message: 'File transfer not found' });

            // Merge meta updates to avoid wiping unrelated meta keys
            if (payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)) {
                item.meta = { ...(item.meta || {}), ...payload.meta };
                delete payload.meta;
            }

            // Apply remaining top-level fields
            for (const [key, value] of Object.entries(payload)) {
                item[key] = value;
            }

            // Sanitize dates if they are in problematic strings format (e.g. from legacy data/import)
            ['date', 'entryDate'].forEach(f => {
                if (item[f] && typeof item[f] === 'string') {
                    const parsed = parseKhmerDate(item[f]);
                    if (parsed && !isNaN(parsed.getTime())) item[f] = parsed;
                }
            });

            const saved = await item.save();
            return res.json({ success: true, item: saved });
        } catch (err) {
            if (err && (err.name === 'CastError' || err.kind === 'ObjectId')) {
                return res.status(400).json({ message: 'Invalid id' });
            }
            next(err);
        }
    }
);

// DELETE /file-transfers/:id - delete a record
router.delete(
    '/file-transfers/:id',
    authRequired,
    requireAnyPermission(['edit:fileTransfers', 'edit:documents']),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const deleted = await FileTransfer.findByIdAndDelete(id).lean().exec();
            if (!deleted) return res.status(404).json({ message: 'File transfer not found' });
            const total = await FileTransfer.countDocuments({});
            return res.json({ success: true, total });
        } catch (err) {
            if (err && (err.name === 'CastError' || err.kind === 'ObjectId')) {
                return res.status(400).json({ message: 'Invalid id' });
            }
            next(err);
        }
    }
);

// POST /file-transfers/:id/send-telegram - send a summary/feedback of the record to Telegram
router.post('/file-transfers/:id/send-telegram', authRequired, requireAnyPermission(['edit:fileTransfers','edit:documents','send:feedback']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const payload = req.body || {};
        const chatOverride = payload.chatId || null;
        const stageKey = payload.stageKey || null; // optional stage-specific send
        const preferredBotNumber = (() => {
            const raw = payload?.botNumber;
            if (raw === undefined || raw === null || raw === '') return null;
            const n = Number(raw);
            return (n === 1 || n === 2) ? n : null;
        })();

        const item = await FileTransfer.findById(id).exec();
        if (!item) return res.status(404).json({ error: 'not-found' });

        const meta = item.meta || {};

        // Determine chat id:
        // 1) explicit override (admin)
        // 2) stage assignee's linked Telegram chat (if stageKey provided)
        // 3) per-record meta.telegramChat / env default (legacy)
        let chatId = '';
        let chatMeta = null;
        if (chatOverride) {
            chatId = String(chatOverride).trim();
            chatMeta = { source: 'override', botNumber: 1 };
        } else if (stageKey) {
            try {
                const stages = meta.feedbackStages || {};
                const assigned = stages[String(stageKey).toLowerCase()];
                const user = assigned ? await resolveTelegramUserForStage(assigned) : null;
                const targets = user ? pickTelegramTargets(user, preferredBotNumber) : [];
                if (targets && targets.length) {
                    chatId = String(targets[0].chatId).trim();
                    chatMeta = { source: 'assignee', botNumber: targets[0].botNumber, field: targets[0].field, userId: user?._id?.toString?.() };
                }
            } catch (e) {
                // ignore and fall back
            }
        }
        if (!chatId) {
            chatId = String(meta.telegramChat || process.env.TELEGRAM_DEFAULT_CHAT || process.env.TELEGRAM_CHAT_ID || '').trim();
            if (chatId) chatMeta = { source: 'legacy', botNumber: 1 };
        }
        if (!chatId) return res.status(400).json({ error: 'no-chat-configured' });

        // Compose message
        const frontendBase = (process.env.FRONTEND_BASE || process.env.FRONTEND_URL || process.env.FRONTEND || 'http://localhost:5173').replace(/\/$/, '');
        const link = `${frontendBase.replace(/\/$/, '')}/replay-file?recordId=${item._id}`;
        const title = item.title || item.documentName || item.letterNo || 'ឯកសារ';
        // If a specific stage key requested, prefer that stage's saved note
        const stageToMeta = { s: 'CourseNote', s1: 'Course1Note', s2: 'Course2Note', s3: 'Course3Note', s4: 'Course4Note', s5: 'Course5Note', s6: 'Course6Note' };
        let note = '';
        if (stageKey && stageToMeta[stageKey] && meta && meta[stageToMeta[stageKey]]) {
            note = meta[stageToMeta[stageKey]];
        }
        // fallback to generic fields
        if (!note) note = (meta && (meta.CourseNote || meta.Course1Note || meta.Course2Note || meta.Course3Note)) || item.others || item.content || '';

        // Add mention of stage if provided
        const stageLabels = { s: 'វគ្គ', s1: 'វគ្គ ១', s2: 'វគ្គ ២', s3: 'វគ្គ ៣', s4: 'វគ្គ ៤', s5: 'វគ្គ ៥', s6: 'វគ្គ ៦' };
        let text = `📄 <b>${title}</b>\n`;
        if (stageKey && stageLabels[stageKey]) text += `🔖 វគ្គ ៖ ${stageLabels[stageKey]}\n`;
        // Use Khmer colon `៖` so the webhook recordId extractor can reliably match
        text += `🆔 លេខកត់ត្រា ៖ ${item._id}\n`;
        if (item.letterNo) text += `📋 លិខិតលេខ: ${item.letterNo}\n`;
        if (item.entryNo) text += `🔢 លេខចូល: ${item.entryNo}\n`;
            // Prefer explicit entryTime field when present (avoid relying on parsed dates).
            // Only fall back to `date`/`entryDate` when the stored datetime contains a
            // non-midnight time component — this avoids showing misleading 07:00 values
            // created from midnight-UTC dates that were never intended to carry a time.
            if (item.entryTime && String(item.entryTime).trim()) {
                text += `🕘 ម៉ោងចូល: ${String(item.entryTime).trim()}\n`;
            } else if (item.entryDate || item.date) {
                try {
                    const dateRaw = item.entryDate || item.date;
                    const dt = new Date(dateRaw);
                    if (!isNaN(dt.getTime())) {
                        // Detect whether the stored datetime actually included a time component
                        // by inspecting the UTC hours/minutes. Many records store a date at
                        // midnight UTC (00:00Z) which becomes 07:00 in local TZ — that is
                        // misleading, so skip showing time when UTC time is exactly 00:00.
                        const utcH = dt.getUTCHours();
                        const utcM = dt.getUTCMinutes();
                        if (!(utcH === 0 && utcM === 0)) {
                            const hh = dt.getHours();
                            const mm = dt.getMinutes();
                            const hhS = String(hh).padStart(2, '0');
                            const mmS = String(mm).padStart(2, '0');
                            text += `🕘 ម៉ោងចូល: ${hhS}:${mmS}\n`;
                        }
                    }
                } catch (e) { /* ignore */ }
        }
        if (note) text += `\n📝 មតិ / សេចក្តីអធិប្បាយ:\n${String(note).slice(0,800)}\n\n`;
        if (stageKey) text += `STAGE_KEY៖ ${String(stageKey).toLowerCase()}\n`;
        text += `<a href="${link}">🔗 បើកកំណត់ត្រាក្នុងប្រព័ន្ធ</a>`;

        // send via Telegram API
        const botToken = (chatMeta && chatMeta.botNumber === 2)
            ? (process.env.TELEGRAM_BOT_TOKEN_2 || '')
            : (process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '');
        if (!botToken) return res.status(500).json({ error: 'no-bot-token' });

        const payloadStr = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
        const options = {
            hostname: 'api.telegram.org', port: 443, path: `/bot${botToken}/sendMessage`, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payloadStr) }
        };

        const sendResult = await new Promise((resolve, reject) => {
            const r = https.request(options, (resp) => {
                let data = '';
                resp.on('data', (c) => { data += c; });
                resp.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
            });
            r.on('error', (err) => reject(err));
            r.write(payloadStr);
            r.end();
        });

        // Helper: ask Telegram to fetch and send a document by URL (JSON API)
        const sendTelegramDocumentUrl = async ({ botToken, chatId, documentUrl, caption }) => {
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
        };

        // Helper: fetch a URL into a Buffer (server-side) so we can upload to Telegram
        const fetchUrlToBuffer = async (urlStr) => {
            return await new Promise((resolve, reject) => {
                try {
                    const u = new URL(urlStr);
                    const client = u.protocol === 'http:' ? http : https;
                    const opts = { hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443), path: u.pathname + (u.search || ''), method: 'GET', headers: { 'User-Agent': 'FileTransferAgent/1.0' } };
                    const req2 = client.request(opts, (resp) => {
                        const chunks = [];
                        resp.on('data', (c) => chunks.push(c));
                        resp.on('end', () => {
                            const b = Buffer.concat(chunks || []);
                            resolve({ buffer: b, contentType: resp.headers['content-type'] || 'application/octet-stream' });
                        });
                    });
                    req2.on('error', (e) => reject(e));
                    req2.end();
                } catch (e) { reject(e); }
            });
        };

        // After sending the text message, attempt to send referenced attachments (if any)
        try {
            const collectAttachmentUrls = () => {
                const out = [];
                const push = (a) => {
                    try {
                        if (!a && a !== 0) return;
                        let s = typeof a === 'string' ? a : (a && (a.url || a.filePath || a.path || a.name || a.filename));
                        if (!s) return;
                        s = String(s).trim();
                        if (!s) return;
                        if (s.startsWith('http')) { out.push(s); return; }
                        // allow root-relative paths
                        if (s.startsWith('/')) { out.push(`${req.protocol}://${req.get('host')}${s}`); return; }
                        const idx = s.indexOf('/Uploads/');
                        if (idx >= 0) { out.push(`${req.protocol}://${req.get('host')}${s.slice(idx)}`); return; }
                        // fallback: assume filename under /Uploads/
                        out.push(`${req.protocol}://${req.get('host')}/Uploads/${encodeURIComponent(s)}`);
                    } catch (e) { /* ignore */ }
                };

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
            };

            const attachUrls = collectAttachmentUrls();
            if (attachUrls && attachUrls.length) {
                // limit to first 5 attachments to avoid flooding
                const slice = attachUrls.slice(0, 5);
                for (const u of slice) {
                    try {
                        // try JSON-based sendDocument (Telegram will fetch the URL)
                        const docRes = await sendTelegramDocumentUrl({ botToken, chatId, documentUrl: u, caption: title });
                        // ensure attachments array exists
                        try { if (!sendResult._attachments) sendResult._attachments = []; } catch (e) {}
                        // record the URL-fetch attempt
                        try { sendResult._attachments.push({ url: u, result: docRes }); } catch (e) {}

                        // If Telegram couldn't fetch the URL (common for localhost/private files),
                        // fetch the file server-side and upload binary as fallback.
                        const desc = (docRes && (docRes.description || docRes.message)) || '';
                        const failedFetch = !(docRes && docRes.ok);
                        const badUrlError = (docRes && docRes.error_code === 400) || String(desc || '').toLowerCase().includes('wrong http url');
                        if (failedFetch && badUrlError) {
                            try {
                                console.log('Telegram cannot fetch URL, attempting server-side fetch:', u);
                                const fetched = await fetchUrlToBuffer(u);
                                const rawName = (u.split('/').pop() || '') || '';
                                const decoded = rawName ? decodeURIComponent(rawName) : '';
                                const ext = (fetched.contentType || '').split('/').pop() || 'pdf';
                                let filename = decoded || `${sanitizeFilenamePart(title) || 'attachment'}_${String(item._id).slice(-6)}.${ext}`;
                                filename = sanitizeFilenamePart(filename) || `attachment_${String(item._id).slice(-6)}.${ext}`;
                                const uploadRes = await sendTelegramDocument({ botToken, chatId, filename, buffer: fetched.buffer, caption: title });
                                console.log('Server-side upload result for', u, uploadRes && uploadRes.ok ? 'OK' : uploadRes);
                                try { sendResult._attachments.push({ url: u, fetched: true, uploadResult: uploadRes }); } catch (e) {}
                            } catch (e) {
                                console.warn('Server-side fetch/upload failed for', u, e && e.message ? e.message : e);
                                try { sendResult._attachments.push({ url: u, fetched: false, error: String(e) }); } catch (ee) {}
                            }
                        }
                    } catch (e) {
                        // non-fatal
                        try { if (!sendResult._attachments) sendResult._attachments = []; sendResult._attachments.push({ url: u, error: String(e) }); } catch (ee) {}
                    }
                }
            }
        } catch (e) {
            // non-fatal - don't fail the whole request
            console.warn('Failed to send attachments to Telegram:', e);
        }

        // store send metadata
        try {
            const sendMeta = meta.telegramSends || [];
            if (sendResult && sendResult.result) {
                sendMeta.push({ chatId, sentAt: new Date(), messageId: sendResult.result.message_id });
            } else {
                sendMeta.push({ chatId, sentAt: new Date(), raw: sendResult });
            }
            item.meta = { ...(item.meta || {}), telegramSends: sendMeta };

            // If a stageKey was provided and the send succeeded, advance workflow by
            // ensuring the next stage is exposed/assigned so the UI shows the next box.
            // Only advance when client explicitly requests it via `advance: true`.
            const advanceRequested = Boolean(payload && payload.advance);
            try {
                if (stageKey && advanceRequested) {
                    const seq = ['s','s1','s2','s3','s4','s5','s6'];
                    const lower = String(stageKey).toLowerCase();
                    const idx = seq.indexOf(lower);
                    if (idx >= 0 && idx + 1 < seq.length) {
                        const nextKey = seq[idx + 1];
                        const existingStages = (item.meta && item.meta.feedbackStages) ? { ...(item.meta.feedbackStages) } : {};
                        // If next stage not already set, add a placeholder value so frontend treats it as selected
                        if (!existingStages[nextKey] || String(existingStages[nextKey]).trim() === '') {
                            existingStages[nextKey] = existingStages[nextKey] || 'assigned';
                            item.meta.feedbackStages = existingStages;
                        }
                        // mark the sent stage date if not already set
                        const dateKeyMap = { s: 'CourseDate', s1: 'Course1Date', s2: 'Course2Date', s3: 'Course3Date', s4: 'Course4Date', s5: 'Course5Date', s6: 'Course6Date' };
                        const dKey = dateKeyMap[lower];
                        if (dKey && !(item.meta && item.meta[dKey])) {
                            item.meta[dKey] = new Date().toISOString();
                        }
                    }
                }
            } catch (E) { /* non-fatal */ }

            await item.save();
        } catch (e) {
            // non-fatal
            console.warn('Failed to save telegram send meta', e);
        }

        return res.json({ success: true, chat: chatMeta, result: sendResult });
    } catch (err) {
        next(err);
    }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

function buildMultipartFormData(parts) {
    const boundary = `----tgform_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const chunks = [];
    for (const part of parts) {
        chunks.push(Buffer.from(`--${boundary}\r\n`));
        if (part.type === 'file') {
            chunks.push(
                Buffer.from(
                    `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
                    `Content-Type: ${part.contentType || 'application/octet-stream'}\r\n\r\n`
                )
            );
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

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/sendDocument`,
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
        }
    };

    return await new Promise((resolve, reject) => {
        const r = https.request(options, (resp) => {
            let data = '';
            resp.on('data', (c) => { data += c; });
            resp.on('end', () => {
                try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); }
            });
        });
        r.on('error', (err) => reject(err));
        r.write(body);
        r.end();
    });
}

async function resolveTelegramUserForStage(assignedId) {
    if (!assignedId) return null;

    // 0) Try as User id first (for direct user selection)
    try {
        const u = await User.findById(assignedId).exec().catch(() => null);
        if (u) return u;
    } catch (e) {}

    const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1) Try SignSchema -> createdBy -> User
    try {
        const Sign = await import('../models/SignSchema.js').then(m => m.default).catch(() => null);
        if (Sign) {
            const sigDoc = await Sign.findById(assignedId).exec().catch(() => null);
            if (sigDoc && sigDoc.createdBy) {
                const u = await User.findById(sigDoc.createdBy).exec().catch(() => null);
                if (u) return u;
            }

            // Some installs store signatures created by an admin account; in that case,
            // try to resolve the real user by matching signature name to User.
            const candidates = [sigDoc?.fullNameKh, sigDoc?.name]
                .map(v => String(v || '').trim())
                .filter(Boolean);
            for (const raw of candidates) {
                // exact match first
                const exact = await User.findOne({ $or: [{ fullName: raw }, { name: raw }] }).exec().catch(() => null);
                if (exact) return exact;

                // fallback: regex contains match (safe-escaped)
                const re = new RegExp(escapeRegex(raw));
                const fuzzy = await User.findOne({ $or: [{ fullName: re }, { name: re }] }).exec().catch(() => null);
                if (fuzzy) return fuzzy;
            }
        }
    } catch (e) {}

    return null;
}

function pickTelegramTarget(user, preferredBotNumber = null) {
    // Backwards compatible wrapper: returns the first viable target.
    const targets = pickTelegramTargets(user, preferredBotNumber);
    return targets[0] || null;
}

function pickTelegramTargets(user, preferredBotNumber = null) {
    if (!user) return [];
    const bot1Token = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    const bot2Token = process.env.TELEGRAM_BOT_TOKEN_2;

    const ordered = [];

    // honor preference first
    if (preferredBotNumber === 2) {
        ordered.push({ botNumber: 2, token: bot2Token, chatId: user.telegramChatId2, field: 'telegramChatId2' });
        ordered.push({ botNumber: 1, token: bot1Token, chatId: user.telegramChatId, field: 'telegramChatId' });
    } else if (preferredBotNumber === 1) {
        ordered.push({ botNumber: 1, token: bot1Token, chatId: user.telegramChatId, field: 'telegramChatId' });
        ordered.push({ botNumber: 2, token: bot2Token, chatId: user.telegramChatId2, field: 'telegramChatId2' });
    } else {
        // default preference: try bot2 first if configured, then bot1
        ordered.push({ botNumber: 2, token: bot2Token, chatId: user.telegramChatId2, field: 'telegramChatId2' });
        ordered.push({ botNumber: 1, token: bot1Token, chatId: user.telegramChatId, field: 'telegramChatId' });
    }

    const seen = new Set();
    const out = [];
    for (const t of ordered) {
        if (!t || !t.token || !t.chatId) continue;
        const chatId = String(t.chatId || '').trim();
        // Telegram chat_id must be numeric for private users/groups.
        if (!/^[-]?[0-9]+$/.test(chatId)) continue;
        // common placeholder value from setup guides
        if (chatId === '123456789') continue;
        const key = `${t.botNumber}:${chatId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...t, chatId, invalid: false });
    }
    return out;
}

function pickTelegramTargetsFromChatId(chatIdValue, preferredBotNumber = null) {
    const bot1Token = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
    const bot2Token = process.env.TELEGRAM_BOT_TOKEN_2;
    const chatId = String(chatIdValue || '').trim();
    if (!chatId) return [];
    if (!/^[-]?[0-9]+$/.test(chatId)) return [];
    if (chatId === '123456789') return [];

    const ordered = [];
    if (preferredBotNumber === 2) {
        if (bot2Token) ordered.push({ botNumber: 2, token: bot2Token, chatId, field: 'replyStage.chatId' });
        if (bot1Token) ordered.push({ botNumber: 1, token: bot1Token, chatId, field: 'replyStage.chatId' });
    } else if (preferredBotNumber === 1) {
        if (bot1Token) ordered.push({ botNumber: 1, token: bot1Token, chatId, field: 'replyStage.chatId' });
        if (bot2Token) ordered.push({ botNumber: 2, token: bot2Token, chatId, field: 'replyStage.chatId' });
    } else {
        // default: try bot1 first because reply stages are currently collected from bot1 webhook
        if (bot1Token) ordered.push({ botNumber: 1, token: bot1Token, chatId, field: 'replyStage.chatId' });
        if (bot2Token) ordered.push({ botNumber: 2, token: bot2Token, chatId, field: 'replyStage.chatId' });
    }
    return ordered;
}

function sanitizeFilenamePart(input, { maxLen = 80 } = {}) {
    try {
        let s = input === undefined || input === null ? '' : String(input);
        s = s.replace(/[\r\n\t]+/g, ' ');
        // Windows reserved characters: \ / : * ? " < > |
        s = s.replace(/[\\/:*?"<>|]/g, ' ');
        // Control chars
        s = s.replace(/[\x00-\x1F\x7F]/g, ' ');
        s = s.replace(/\s+/g, ' ').trim();
        // avoid trailing dot/space (Windows)
        s = s.replace(/[.\s]+$/g, '').trim();
        if (!s) return '';
        if (s.length > maxLen) s = s.slice(0, maxLen).trim();
        return s;
    } catch (e) {
        return '';
    }
}

function buildReportPdfFilename(item) {
    const idSuffix = String(item?._id || '').slice(-6) || 'REPORT';
    const subject =
        item?.content ||
        item?.description ||
        item?.summary ||
        item?.subject ||
        item?.title ||
        item?.documentName ||
        item?.letterNo ||
        '';

    const subjectPart = sanitizeFilenamePart(subject, { maxLen: 70 });
    const base = subjectPart ? `REPORT_${subjectPart}_${idSuffix}` : `REPORT_${idSuffix}`;
    return `${base}.pdf`;
}

// POST /file-transfers/:id/send-telegram-report - send a generated REPORT PDF to Telegram users per stage
router.post(
    '/file-transfers/:id/send-telegram-report',
    authRequired,
    requireAnyPermission(['edit:fileTransfers', 'edit:documents', 'send:feedback']),
    upload.single('report'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const file = req.file;
            const stageKeysRaw = req.body?.stageKeys;

            const generateMode = String(req.body?.generate || '').toLowerCase();
            const wantServerPdf = !file?.buffer && (generateMode === 'server' || generateMode === '1' || generateMode === 'true');

            if (!stageKeysRaw) return res.status(400).json({ error: 'missing-stageKeys' });

            let stageKeys = [];
            try {
                stageKeys = Array.isArray(stageKeysRaw) ? stageKeysRaw : JSON.parse(stageKeysRaw);
            } catch (e) {
                return res.status(400).json({ error: 'invalid-stageKeys' });
            }

            const allowed = new Set(['s', 's1', 's2', 's3', 's4', 's5', 's6']);
            stageKeys = (stageKeys || []).map(k => String(k).toLowerCase()).filter(k => allowed.has(k));
            if (stageKeys.length === 0) return res.status(400).json({ error: 'no-valid-stageKeys' });

            const item = await FileTransfer.findById(id).exec();
            if (!item) return res.status(404).json({ error: 'not-found' });

            let pdfBuffer = file?.buffer;
            let pdfFilename = file?.originalname || `REPORT_${String(item._id).slice(-6)}.pdf`;
            if (!pdfBuffer) {
                if (!wantServerPdf) return res.status(400).json({ error: 'missing-report-file', hint: 'send generate=server to let backend render PDF' });

                const fontSize = (() => {
                    const n = Number(req.body?.fontSize);
                    return Number.isFinite(n) && n > 6 && n < 64 ? n : 15;
                })();
                const lineHeight = (() => {
                    const n = Number(req.body?.lineHeight);
                    return Number.isFinite(n) && n > 0.8 && n < 3.5 ? n : 1.8;
                })();
                const paddingTopMm = (() => {
                    const n = Number(req.body?.paddingTopMm);
                    return Number.isFinite(n) && n >= 0 && n <= 40 ? n : 5;
                })();
                const paraBeforePx = (() => {
                    const n = Number(req.body?.paraBeforePx);
                    return Number.isFinite(n) && n >= 0 && n <= 40 ? n : 1;
                })();
                const paraAfterPx = (() => {
                    const n = Number(req.body?.paraAfterPx);
                    return Number.isFinite(n) && n >= 0 && n <= 40 ? n : 1;
                })();

                const template = String(req.body?.template || 'replay').toLowerCase();
                const obj = item.toObject ? item.toObject() : item;
                const html = (template === 'print' || template === 'printsheet' || template === 'sheet')
                    ? buildPrintSheetHtml(obj, { fontSize, lineHeight, autoprint: 'false' })
                    : await buildReplayReportHtml(obj, { fontSize, lineHeight, paddingTopMm, paraBeforePx, paraAfterPx });
                try {
                    pdfBuffer = await htmlToPdfBuffer(html, {
                        // Replayfile UI already has internal padding; keep PDF margins at 0.
                        margin: (template === 'print' || template === 'printsheet' || template === 'sheet')
                            ? { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }
                            : { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
                    });
                } catch (e) {
                    return res.status(500).json({ error: 'pdf-generate-failed', message: e?.message || String(e) });
                }
                // Name the report using the "កម្មវត្ថុ" field (content/subject)
                pdfFilename = buildReportPdfFilename(item);
            }

            const preferredBotNumber = (() => {
                const raw = req.body?.botNumber;
                if (raw === undefined || raw === null || raw === '') return null;
                const n = Number(raw);
                return (n === 1 || n === 2) ? n : null;
            })();

            const meta = item.meta || {};
            const stages = meta.feedbackStages || {};
            const replyStages = meta.telegramReplyStages || {};
            const title = item.title || item.documentName || item.letterNo || 'ឯកសារ';
            const stageLabels = { s: 'វគ្គ', s1: 'វគ្គ ១', s2: 'វគ្គ ២', s3: 'វគ្គ ៣', s4: 'វគ្គ ៤', s5: 'វគ្គ ៥', s6: 'វគ្គ ៦' };
            const frontendBase = (process.env.FRONTEND_BASE || process.env.FRONTEND_URL || process.env.FRONTEND || 'http://localhost:5173').replace(/\/$/, '');
            const link = `${frontendBase}/replay-file?recordId=${item._id}`;

            const results = [];
            for (const stageKey of stageKeys) {
                const assigned = stages[stageKey];
                if (!assigned) {
                    results.push({ stageKey, ok: false, reason: 'no-assignee' });
                    continue;
                }

                const replyStage = replyStages && replyStages[stageKey] ? replyStages[stageKey] : null;
                const replyChatId = replyStage && replyStage.chatId ? replyStage.chatId : null;

                const user = await resolveTelegramUserForStage(assigned);

                let targets = [];
                let userIdForResult = undefined;
                if (user) {
                    userIdForResult = user._id?.toString?.();
                    targets = pickTelegramTargets(user, preferredBotNumber);
                }

                // Fallback: if assigned user is missing/unlinked but we have a reply chatId captured for this stage,
                // send the report back to the replier.
                if (!targets.length && replyChatId) {
                    targets = pickTelegramTargetsFromChatId(replyChatId, preferredBotNumber);
                }

                if (!targets.length) {
                    if (!user) {
                        results.push({ stageKey, ok: false, reason: 'no-user', hint: replyChatId ? 'replyStage.chatId-present-but-invalid' : 'no-replyStage.chatId' });
                    } else {
                        results.push({ stageKey, ok: false, reason: 'no-telegram-chat', userId: userIdForResult, hint: replyChatId ? 'try-link-user-or-fix-placeholder' : undefined });
                    }
                    continue;
                }

                const caption =
                    `📄 <b>${title}</b>\n` +
                    `🔖 វគ្គ ៖ ${stageLabels[stageKey] || stageKey}\n` +
                    `🆔 លេខកត់ត្រា ៖ ${item._id}\n` +
                    `STAGE_KEY៖ ${stageKey}\n` +
                    `<a href="${link}">🔗 បើកកំណត់ត្រាក្នុងប្រព័ន្ធ</a>`;

                const attempts = [];
                let sentOk = false;
                for (const target of targets) {
                    const sendResult = await sendTelegramDocument({
                        botToken: target.token,
                        chatId: String(target.chatId),
                        filename: pdfFilename,
                        buffer: pdfBuffer,
                        caption,
                    });
                    attempts.push({ botNumber: target.botNumber, field: target.field, chatId: target.chatId, result: sendResult });
                    if (sendResult && sendResult.ok) {
                        results.push({ stageKey, ok: true, botNumber: target.botNumber, field: target.field, userId: user._id?.toString?.(), result: { messageId: sendResult?.result?.message_id } });
                        sentOk = true;
                        break;
                    }
                }

                if (!sentOk) {
                    const last = attempts[attempts.length - 1];
                    const lastResult = last ? last.result : null;
                    const lastDesc = lastResult && (lastResult.description || lastResult.message);
                    const reason = lastResult && lastResult.error_code === 400 ? 'chat-not-found' : 'send-failed';
                    results.push({
                        stageKey,
                        ok: false,
                        reason,
                        userId: userIdForResult,
                        attempts: attempts.map(a => ({ botNumber: a.botNumber, field: a.field, chatId: a.chatId, ok: !!a.result?.ok, error_code: a.result?.error_code, description: a.result?.description })),
                        result: lastResult || { message: lastDesc || 'Unknown Telegram send failure' },
                    });
                }
            }

            const okCount = results.filter(r => r.ok).length;
            return res.json({ success: true, okCount, total: results.length, results });
        } catch (err) {
            next(err);
        }
    }
);

// POST /file-transfers - create new file transfer
router.post('/file-transfers', authRequired, requireAnyPermission(['edit:fileTransfers', 'edit:documents']), async (req, res, next) => {
  try {
    const payload = req.body || {};
        const creator = req.auth?.user;
        if (creator) {
            const creatorName = creator.fullName || creator.name || creator.email || creator.username;
            if (creatorName) payload.creatorName = creatorName;
        }
    // Normalize attachments if provided as single string
    if (payload.attachments && typeof payload.attachments === 'string') {
      payload.attachments = [payload.attachments];
    }

    const created = await FileTransfer.create(payload);

    // Return created item and updated total
    const total = await FileTransfer.countDocuments({});
    res.status(201).json({ item: created, total });
  } catch (err) {
    next(err);
  }
});

// GET /file-transfers/:id/print-sheet - get file transfer for print-only view
router.get('/file-transfers/:id/print-sheet', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fontSize = 14, lineHeight = 1.6, autoprint = 'true' } = req.query;
    const item = await FileTransfer.findById(id).lean().exec();
    if (!item) return res.status(404).json({ message: 'File transfer not found' });

    const fs = (() => {
      const n = Number(fontSize);
      return Number.isFinite(n) && n > 6 && n < 64 ? n : 14;
    })();
    const lh = (() => {
      const n = Number(lineHeight);
      return Number.isFinite(n) && n > 0.8 && n < 3.5 ? n : 1.6;
    })();

    const html = buildPrintSheetHtml(item, { fontSize: fs, lineHeight: lh, autoprint });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET /file-transfers/:id/replay-report - Replayfile-style HTML report (for PDF preview/debug)
router.get('/file-transfers/:id/replay-report', authRequired, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fontSize = 15, lineHeight = 1.8, paddingTopMm = 5, paraBeforePx = 1, paraAfterPx = 1 } = req.query;
        const item = await FileTransfer.findById(id).lean().exec();
        if (!item) return res.status(404).json({ message: 'File transfer not found' });

        const fs = (() => {
            const n = Number(fontSize);
            return Number.isFinite(n) && n > 6 && n < 64 ? n : 15;
        })();
        const lh = (() => {
            const n = Number(lineHeight);
            return Number.isFinite(n) && n > 0.8 && n < 3.5 ? n : 1.8;
        })();

        const pt = (() => {
            const n = Number(paddingTopMm);
            return Number.isFinite(n) && n >= 0 && n <= 40 ? n : 5;
        })();
        const pb = (() => {
            const n = Number(paraBeforePx);
            return Number.isFinite(n) && n >= 0 && n <= 40 ? n : 1;
        })();
        const pa = (() => {
            const n = Number(paraAfterPx);
            return Number.isFinite(n) && n >= 0 && n <= 40 ? n : 1;
        })();

        const html = await buildReplayReportHtml(item, { fontSize: fs, lineHeight: lh, paddingTopMm: pt, paraBeforePx: pb, paraAfterPx: pa });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (err) {
        next(err);
    }
});

// GET /file-transfers/:id/print-data - get file transfer data optimized for printing
router.get('/file-transfers/:id/print-data', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await FileTransfer.findById(id).lean().exec();
    if (!item) return res.status(404).json({ message: 'File transfer not found' });
        const entryDateRaw = item.entryDate || item.entry_date || null;
        const entryDateObj = entryDateRaw ? new Date(entryDateRaw) : null;
        const hasEntryDate = entryDateObj && !isNaN(entryDateObj.getTime());
        const entryDateDisplay = hasEntryDate ? entryDateObj.toLocaleDateString('km-KH') : null;
        const entryTimeFromDate = hasEntryDate ? entryDateObj.toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }) : null;
        const entryTimeValue = (item.entryTime || '').trim() || entryTimeFromDate;
        const creatorLabel = item.creatorName || item.owner || item.handler || item.current_handler || null;
    
    // Return cleaned data optimized for print
        const letterNoValue = item.letterNo || item.letter_no || item.number || item.no || null;
        const sourceValue = item.source || item.origin || item.from || null;
        const qtyValue = (item.qty !== undefined && item.qty !== null) ? item.qty : (item.count !== undefined && item.count !== null) ? item.count : null;
        const contentValue = item.content || item.description || item.summary || item.subject || null;
        const dateRaw = item.date || item.created_at || item.createdAt || item.created || null;
        const dateObj = dateRaw ? new Date(dateRaw) : null;
        const dateDisplay = (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toLocaleDateString('km-KH') : new Date().toLocaleDateString('km-KH');

        const localizeMaybe = (raw) => {
            if (!raw && raw !== 0) return '';
            const s = String(raw);
            // YYYY-MM-DD -> date-only
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                const d = new Date(s);
                if (!isNaN(d.getTime())) return d.toLocaleDateString('km-KH');
            }
            const d = new Date(raw);
            if (isNaN(d.getTime())) return '';
            // If the date corresponds to UTC midnight, avoid showing converted local time (which becomes 07:00 in +7 timezone).
            if (d.getUTCHours && d.getUTCHours() === 0 && d.getUTCMinutes && d.getUTCMinutes() === 0) {
                return d.toLocaleDateString('km-KH');
            }
            return d.toLocaleString('km-KH');
        };

        const printData = {
            id: item._id,
            title: item.title || 'ឯកសារបញ្ជូន',
            // New/primary fields
            letterNo: letterNoValue,
            entryNo: item.entryNo || item.entry_no || null,
            source: sourceValue,
            qty: qtyValue,
            content: contentValue,

            // Backward-compatible aliases (some UIs may still read these)
            number: item.number || letterNoValue || 'មិនកំណត់',
            date: dateDisplay,
            type: item.type || item.title || 'មិនកំណត់',
            from: item.from || sourceValue || 'មិនកំណត់',
            to: item.to || 'មិនកំណត់',
            subject: item.subject || contentValue || 'មិនកំណត់',
            summary: item.summary || contentValue || 'មិនមានសេចក្តីសង្ខេប',

            attachments: item.attachments || [],
            entryDate: entryDateDisplay,
            entryTime: entryTimeValue,
            creatorName: creatorLabel,
            meta: item.meta || {},
            createdAt: localizeMaybe(item.createdAt || Date.now()),
            updatedAt: item.updatedAt ? localizeMaybe(item.updatedAt) : null,
            printTimestamp: localizeMaybe(new Date())
        };
    
    res.json({ success: true, data: printData });
    
  } catch (err) {
    next(err);
  }
});

export default router;
