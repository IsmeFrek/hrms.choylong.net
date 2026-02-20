// Setup Telegram Webhook
// Usage: node backend/setup-telegram-webhook.js [webhook-url]

import 'dotenv/config';
import https from 'https';

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env file');
  process.exit(1);
}

// Get webhook URL from command line or .env
const webhookUrl = process.argv[2] || process.env.TELEGRAM_WEBHOOK_URL;

if (!webhookUrl) {
  console.log('📚 របៀបប្រើប្រាស់:');
  console.log('  node backend/setup-telegram-webhook.js https://your-domain.com/api/telegram/webhook');
  console.log('');
  console.log('ឬដាក់ក្នុង .env:');
  console.log('  TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook');
  console.log('');
  console.log('ឧទាហរណ៍ ngrok:');
  console.log('  1. Run: ngrok http 5000');
  console.log('  2. Copy URL: https://abc123.ngrok.io');
  console.log('  3. Run: node backend/setup-telegram-webhook.js https://abc123.ngrok.io/api/telegram/webhook');
  process.exit(1);
}

console.log('🔧 Setting up Telegram webhook...');
console.log(`📡 Webhook URL: ${webhookUrl}`);

const apiUrl = `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

https.get(apiUrl, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.ok) {
        console.log('✅ Webhook setup successful!');
        console.log('📋 Result:', JSON.stringify(result, null, 2));
        console.log('');
        console.log('🧪 Test webhook:');
        console.log('  Send any message to your bot in Telegram');
        console.log('  Check backend logs for webhook received');
      } else {
        console.error('❌ Webhook setup failed:', result);
      }
    } catch (e) {
      console.error('❌ Parse error:', e);
    }
  });
}).on('error', (err) => {
  console.error('❌ Request error:', err);
});
