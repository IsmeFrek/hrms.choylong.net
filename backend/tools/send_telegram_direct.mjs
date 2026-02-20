#!/usr/bin/env node
import fs from 'fs';
import https from 'https';
import path from 'path';

// Read backend .env to get token if not in process.env
const envPath = path.resolve(process.cwd(), 'backend', '.env');
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const k = m[1];
      let v = m[2] || '';
      // strip surrounding quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  });
}

const BOT = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
if (!BOT) {
  console.error('No bot token available');
  process.exit(1);
}

const CHAT_ID = process.argv[2] || '776393689';
const RECORD_ID = process.argv[3] || '698eb749e71e298ea4df59d6';
const STAGE = process.argv[4] || 's';

const title = '📄 មានឯកសាររង់ចាំការពិនិត្យ';
let message = `${title}\n`;
message += `📋 ឈ្មោះ៖ Test Document\n`;
message += `🆔 លេខកត់ត្រា : ${RECORD_ID}\n`;
message += `STAGE_KEY៖ ${STAGE}\n`;
message += `💬 សូមចុច Reply នៅលើសារនេះ ដើម្បីផ្ញើមតិ\n`;

const payload = JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' });
const options = { hostname: 'api.telegram.org', port: 443, path: `/bot${BOT}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try { console.log('Telegram send result:', JSON.parse(data)); } catch (e) { console.log('Result:', data); }
  });
});
req.on('error', (e) => { console.error('Send error', e); });
req.write(payload);
req.end();
