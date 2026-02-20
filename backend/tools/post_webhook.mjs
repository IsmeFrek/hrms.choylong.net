#!/usr/bin/env node
import http from 'http';

const payload = {
  update_id: 2000000,
  message: {
    message_id: 3000,
    from: { id: 776393689, is_bot: false, first_name: 'TesterUser' },
    chat: { id: 776393689, type: 'private' },
    date: Math.floor(Date.now() / 1000),
    text: 'អនុម័ត',
    reply_to_message: {
      message_id: 2999,
      text: '📄 <b>ឯកសារថ្មី</b>\n🆔 លេខកត់ត្រា ៖ 698eb749e71e298ea4df59d6\nSTAGE_KEY៖ s\n💬 <i>សូមចុច Reply នៅលើសារនេះ ដើម្បីផ្ញើមតិរបស់អ្នក</i>'
    }
  }
};

const data = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/telegram/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Webhook response status:', res.statusCode);
    try { console.log('Body:', JSON.parse(body)); } catch (e) { console.log('Body:', body); }
  });
});

req.on('error', (e) => { console.error('Request error:', e); process.exit(2); });
req.write(data);
req.end();
