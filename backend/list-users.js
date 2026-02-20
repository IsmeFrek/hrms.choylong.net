import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n📋 បញ្ជីអ្នកប្រើប្រាស់:\n');
    
    const users = await User.find({}).select('fullName name email phone telegramId active').limit(20);
    
    if (users.length === 0) {
      console.log('❌ មិនមានអ្នកប្រើប្រាស់ក្នុងប្រព័ន្ធទេ\n');
      process.exit(0);
    }
    
    const usersWithTelegram = users.filter(u => u.telegramId);
    const usersWithoutTelegram = users.filter(u => !u.telegramId);
    
    console.log(`✅ មាន Telegram ID: ${usersWithTelegram.length} នាក់`);
    console.log(`⚠️  គ្មាន Telegram ID: ${usersWithoutTelegram.length} នាក់\n`);
    
    console.log('='.repeat(80));
    console.log('បញ្ជីអ្នកប្រើប្រាស់ទាំងអស់:');
    console.log('='.repeat(80));
    
    users.forEach((u, index) => {
      const name = u.fullName || u.name || 'N/A';
      const email = u.email || '-';
      const phone = u.phone || '-';
      const telegram = u.telegramId || '❌ NOT SET';
      const status = u.active ? '✓' : '✗';
      
      console.log(`${index + 1}. [${status}] ${name}`);
      console.log(`   ID: ${u._id}`);
      console.log(`   Email: ${email}`);
      console.log(`   Phone: ${phone}`);
      console.log(`   Telegram: ${telegram}`);
      console.log('');
    });
    
    if (usersWithoutTelegram.length > 0) {
      console.log('\n💡 ដើម្បីបន្ថែម Telegram ID:');
      console.log('   1. ចូលទៅ Users page: http://localhost:5173/users');
      console.log('   2. Edit user');
      console.log('   3. បញ្ចូល Telegram ID (Chat ID, @username, or t.me link)');
      console.log('   4. រក្សាទុក\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listUsers();
