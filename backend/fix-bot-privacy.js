// Fix Telegram Bot Permissions
// Usage: node backend/fix-bot-privacy.js

import 'dotenv/config';
import https from 'https';

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env file');
  process.exit(1);
}

console.log('🔧 Checking Telegram Bot Configuration...\n');

// Get bot info
const getBotInfo = () => {
  return new Promise((resolve, reject) => {
    https.get(`https://api.telegram.org/bot${botToken}/getMe`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

// Get webhook info
const getWebhookInfo = () => {
  return new Promise((resolve, reject) => {
    https.get(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

(async () => {
  try {
    // Check bot info
    const botInfo = await getBotInfo();
    if (botInfo.ok) {
      console.log('✅ Bot Info:');
      console.log(`   Name: ${botInfo.result.username}`);
      console.log(`   ID: ${botInfo.result.id}`);
      console.log(`   Can Join Groups: ${botInfo.result.can_join_groups || false}`);
      console.log(`   Can Read Messages: ${botInfo.result.can_read_all_group_messages || false}`);
      console.log('');
    }

    // Check webhook
    const webhookInfo = await getWebhookInfo();
    if (webhookInfo.ok) {
      console.log('📡 Webhook Info:');
      console.log(`   URL: ${webhookInfo.result.url || 'Not set'}`);
      console.log(`   Pending Updates: ${webhookInfo.result.pending_update_count || 0}`);
      if (webhookInfo.result.last_error_message) {
        console.log(`   ⚠️ Last Error: ${webhookInfo.result.last_error_message}`);
      }
      console.log('');
    }

    // Instructions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 FIX INSTRUCTIONS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🔧 ជំហានទី 1: Disable Privacy Mode');
    console.log('   1. Open Telegram');
    console.log('   2. Search for @BotFather');
    console.log('   3. Send command: /mybots');
    console.log(`   4. Select your bot: @${botInfo.result?.username || 'YourBot'}`);
    console.log('   5. Click "Bot Settings"');
    console.log('   6. Click "Group Privacy"');
    console.log('   7. Click "Turn off" (បិទ Privacy Mode)');
    console.log('   8. You should see: "Privacy mode is disabled"');
    console.log('');

    console.log('🔧 ជំហានទី 2: Give Admin Permissions');
    console.log('   1. Add bot to a group (optional, for testing)');
    console.log('   2. Make bot admin in the group');
    console.log('   3. Enable "All Messages" permission');
    console.log('');

    console.log('🔧 ជំហានទី 3: Test Receiving Messages');
    console.log('   1. Send a message to your bot directly');
    console.log('   2. Check backend logs for:');
    console.log('      "Telegram webhook received: {...}"');
    console.log('   3. If you see the log → Working! ✅');
    console.log('   4. If no log → Privacy mode still on ❌');
    console.log('');

    console.log('🔧 ជំហានទី 4: Commands to Test');
    console.log('   Send these to your bot:');
    console.log('   • /start');
    console.log('   • /help');
    console.log('   • Any text message');
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️ COMMON ISSUES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('❌ "Bot can\'t read messages"');
    console.log('   → Privacy mode is ON. Disable it via @BotFather\n');

    console.log('❌ "Webhook not receiving updates"');
    console.log('   → Check if ngrok is running');
    console.log('   → Verify webhook URL is correct');
    console.log('   → Run: node backend/setup-telegram-webhook.js https://YOUR-NGROK-URL/api/telegram/webhook\n');

    console.log('❌ "Bot doesn\'t respond to /start"');
    console.log('   → Check backend server is running');
    console.log('   → Check logs for errors\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
