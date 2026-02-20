import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import SignSchema from './models/SignSchema.js';

dotenv.config();

async function checkMatching() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n🔍 ពិនិត្យការផ្គូផ្គង Signatures និង Users\n');
    
    const signatures = await SignSchema.find({}).limit(20);
    const users = await User.find({}).limit(20);
    
    console.log('='.repeat(80));
    console.log('ការផ្គូផ្គង:');
    console.log('='.repeat(80) + '\n');
    
    signatures.forEach(sig => {
      const sigName = sig.fullNameKh || sig.name || '';
      
      // ស្វែងរក user ដែលមានឈ្មោះដូចគ្នា
      const matchingUser = users.find(u => {
        const userName = u.fullName || u.name || '';
        return userName.toLowerCase().includes(sigName.toLowerCase()) ||
               sigName.toLowerCase().includes(userName.toLowerCase());
      });
      
      if (matchingUser) {
        const hasTelegram = matchingUser.telegramId ? '✅ 📱' : '❌';
        console.log(`✓ Signature: "${sigName}"`);
        console.log(`  → User: "${matchingUser.fullName || matchingUser.name}"`);
        console.log(`     User ID: ${matchingUser._id}`);
        console.log(`     Telegram: ${hasTelegram} ${matchingUser.telegramId || 'NOT SET'}`);
        console.log('');
      } else {
        console.log(`✗ Signature: "${sigName}" → មិនរកឃើញ user`);
        console.log('');
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkMatching();
