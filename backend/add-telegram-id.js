import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function addTelegramId() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n🔧 បន្ថែម Telegram ID ទៅអ្នកប្រើប្រាស់\n');
    
    const users = await User.find({ active: true }).select('_id fullName name email phone telegramId').limit(50);
    
    if (users.length === 0) {
      console.log('❌ មិនមានអ្នកប្រើប្រាស់ទេ\n');
      process.exit(0);
    }
    
    console.log('អ្នកប្រើប្រាស់:');
    users.forEach((u, i) => {
      const name = u.fullName || u.name || 'N/A';
      const telegram = u.telegramId ? `✓ ${u.telegramId}` : '❌';
      console.log(`${i + 1}. ${name} - Telegram: ${telegram}`);
    });
    
    console.log('\n');
    const indexStr = await question('ជ្រើសរើសលេខអ្នកប្រើប្រាស់ (1-' + users.length + ') ឬវាយ "q" ដើម្បីចាកចេញ: ');
    
    if (indexStr.toLowerCase() === 'q') {
      console.log('បោះបង់។');
      rl.close();
      process.exit(0);
    }
    
    const index = parseInt(indexStr) - 1;
    if (isNaN(index) || index < 0 || index >= users.length) {
      console.log('❌ លេខមិនត្រឹមត្រូវ');
      rl.close();
      process.exit(1);
    }
    
    const selectedUser = users[index];
    console.log(`\nបានជ្រើសរើស: ${selectedUser.fullName || selectedUser.name}`);
    
    console.log('\n💡 Telegram ID អាចជា:');
    console.log('   - Chat ID (លេខ): 123456789');
    console.log('   - Username: @yourusername ឬ yourusername');
    console.log('   - Profile link: https://t.me/yourusername');
    console.log('');
    
    const telegramId = await question('បញ្ចូល Telegram ID: ');
    
    if (!telegramId || telegramId.trim() === '') {
      console.log('❌ Telegram ID មិនអាចទទេបានទេ');
      rl.close();
      process.exit(1);
    }
    
    selectedUser.telegramId = telegramId.trim();
    await selectedUser.save();
    
    console.log(`\n✅ បានបន្ថែម Telegram ID "${telegramId.trim()}" ទៅអ្នកប្រើប្រាស់ "${selectedUser.fullName || selectedUser.name}"`);
    console.log('\n💡 ឥឡូវអ្នកអាចធ្វើតេស្តនៅ: http://localhost:5173/telegram-test\n');
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

addTelegramId();
