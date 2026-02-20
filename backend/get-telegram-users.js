import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;

if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
  process.exit(1);
}

console.log('Fetching recent Telegram updates...\n');

const options = {
  hostname: 'api.telegram.org',
  port: 443,
  path: `/bot${botToken}/getUpdates`,
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.ok || !parsed.result || parsed.result.length === 0) {
        console.log('⚠️  No recent updates found. Users need to send /start to the bot first.\n');
        console.log('📱 Instructions:');
        console.log('   1. Open Telegram');
        console.log('   2. Search for your bot');
        console.log('   3. Click Start or send /start');
        console.log('   4. Run this script again\n');
        return;
      }
      
      console.log('=== Users who have interacted with the bot ===\n');
      
      const users = new Map();
      parsed.result.forEach(update => {
        const msg = update.message || update.edited_message;
        if (msg && msg.from) {
          const chatId = msg.chat.id;
          const user = msg.from;
          users.set(chatId, {
            chatId: chatId,
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            username: user.username || '',
            fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim()
          });
        }
      });
      
      users.forEach((user, chatId) => {
        console.log(`👤 ${user.fullName || user.firstName}`);
        console.log(`   Chat ID: ${chatId}`);
        if (user.username) console.log(`   Username: @${user.username}`);
        console.log('');
      });
      
      console.log(`\n✅ Found ${users.size} unique users`);
      console.log('\n📋 Copy the Chat ID and use it to update User.telegramChatId in database');
      
    } catch (e) {
      console.error('Failed to parse response:', e);
    }
  });
});

req.on('error', (err) => {
  console.error('Request failed:', err);
});

req.end();
