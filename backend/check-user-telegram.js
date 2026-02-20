import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function checkUserTelegram() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB\n');

    // List all users with their telegram info
    const users = await User.find().select('fullName email telegramId telegramChatId telegramChatId2').lean();
    
    console.log('=== ពត៌មាន Telegram របស់អ្នកប្រើប្រាស់ទាំងអស់ ===\n');
    
    users.forEach(user => {
      console.log(`👤 ${user.fullName || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   telegramId: ${user.telegramId || '❌ មិនមាន'}`);
      console.log(`   telegramChatId (Bot 1): ${user.telegramChatId || '❌ មិនមាន'}`);
      console.log(`   telegramChatId2 (Bot 2): ${user.telegramChatId2 || '❌ មិនមាន'}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('\n✅ រួចរាល់!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserTelegram();
