import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';

dotenv.config();

async function quickAddTelegram() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // បន្ថែម Telegram ID ឧទាហរណ៍សម្រាប់អ្នកប្រើប្រាស់ទីមួយ (Administrator)
    const admin = await User.findOne({ email: 'admin@hospital.com' });
    
    if (!admin) {
      console.log('❌ មិនរកឃើញ admin user');
      process.exit(1);
    }
    
    console.log('\n📝 ឧទាហរណ៍: បន្ថែម Telegram ID សម្រាប់ Administrator\n');
    console.log('💡 ដើម្បីទទួលបាន Chat ID របស់អ្នក:');
    console.log('   1. ស្វែងរក @userinfobot នៅក្នុង Telegram');
    console.log('   2. ចុច /start');
    console.log('   3. Bot នឹងបង្ហាញ Chat ID របស់អ្នក (ឧទាហរណ៍: 123456789)');
    console.log('   4. Copy លេខនោះ និងបញ្ចូលខាងក្រោម\n');
    
    // ឧទាហរណ៍: ប្រើ Chat ID សាកល្បង (អ្នកត្រូវផ្លាស់ប្តូរវា)
    const exampleChatId = '123456789'; // ផ្លាស់ប្តូរលេខនេះជា Chat ID ពិតរបស់អ្នក
    
    admin.telegramId = exampleChatId;
    await admin.save();
    
    console.log(`✅ បានកំណត់ Telegram ID សាកល្បង: ${exampleChatId}`);
    console.log(`   សម្រាប់អ្នកប្រើប្រាស់: ${admin.fullName || admin.name}\n`);
    
    console.log('⚠️  សំខាន់: នេះគ្រាន់តែជាឧទាហរណ៍ប៉ុណ្ណោះ!');
    console.log('   ដើម្បីប្រើជាមួយ Telegram ពិតប្រាកដ:');
    console.log('   1. ទទួល Chat ID ពិតរបស់អ្នកពី @userinfobot');
    console.log('   2. Run: npm run add:telegram');
    console.log('   3. ជ្រើសរើសអ្នកប្រើប្រាស់ និងបញ្ចូល Chat ID\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

quickAddTelegram();
