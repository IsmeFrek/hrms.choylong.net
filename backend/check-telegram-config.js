/**
 * Telegram Bot Configuration Checker
 * ឧបករណ៍ពិនិត្យការកំណត់រចនាសម្ព័ន្ធ Telegram Bot
 * 
 * Usage: node check-telegram-config.js
 */

import dotenv from 'dotenv';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

console.log('\n🔍 ពិនិត្យការកំណត់រចនាសម្ព័ន្ធ Telegram Bot...\n');
console.log('='.repeat(60));

// Check if bot token is configured
const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;

if (!botToken) {
  console.log('❌ TELEGRAM_BOT_TOKEN មិនបានកំណត់ក្នុង .env file');
  console.log('\n📝 ជំហានបន្ទាប់:');
  console.log('   1. បើកឯកសារ backend/.env');
  console.log('   2. បន្ថែមបន្ទាត់: TELEGRAM_BOT_TOKEN=YOUR_TOKEN_HERE');
  console.log('   3. ទទួល token ពី @BotFather លើ Telegram');
  console.log('\n📖 អានលម្អិតនៅ: TELEGRAM_SETUP_GUIDE.md\n');
  process.exit(1);
}

console.log('✅ TELEGRAM_BOT_TOKEN បានរកឃើញ');
console.log(`   Token: ${botToken.substring(0, 20)}...`);
console.log('');

// Test bot token by calling Telegram API
console.log('🔄 កំពុងធ្វើតេស្ត bot token ជាមួយ Telegram API...\n');

const testBotToken = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/getMe`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.description || 'Unknown error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
};

testBotToken()
  .then((botInfo) => {
    console.log('✅ Bot token ដំណើរការបានល្អ!\n');
    console.log('📱 ព័ត៌មាន Bot:');
    console.log(`   ID: ${botInfo.id}`);
    console.log(`   Name: ${botInfo.first_name}`);
    console.log(`   Username: @${botInfo.username}`);
    console.log(`   Can Join Groups: ${botInfo.can_join_groups ? 'បាទ/ចាស' : 'ទេ'}`);
    console.log(`   Can Read Messages: ${botInfo.can_read_all_group_messages ? 'បាទ/ចាស' : 'ទេ'}`);
    console.log('');
    console.log('='.repeat(60));
    console.log('\n✅ ការកំណត់រចនាសម្ព័ន្ធត្រឹមត្រូវ!');
    console.log('\n📝 ជំហានបន្ទាប់:');
    console.log('   1. ចុច /start លើ bot: https://t.me/' + botInfo.username);
    console.log('   2. ទទួលបាន Chat ID ពី @userinfobot');
    console.log('   3. កំណត់ Telegram ID នៅក្នុង Users page');
    console.log('   4. ធ្វើតេស្តនៅ: http://localhost:5173/telegram-test');
    console.log('');
  })
  .catch((err) => {
    console.log('❌ មិនអាចតភ្ជាប់ទៅ Telegram API បានទេ\n');
    console.log('Error:', err.message);
    console.log('\n🔍 ពិនិត្យ:');
    console.log('   1. Token ត្រឹមត្រូវទេ? (ទទួលពី @BotFather)');
    console.log('   2. អ៊ីនធឺណិតដំណើរការបានទេ?');
    console.log('   3. Firewall block api.telegram.org ទេ?');
    console.log('');
    process.exit(1);
  });
