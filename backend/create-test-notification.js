import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Notification from './models/Notification.js';
import User from './models/User.js';

dotenv.config();

async function createTestNotification() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n📬 បង្កើតការជូនដំណឹងសាកល្បង\n');
    
    // Find admin user
    const admin = await User.findOne({ email: 'admin@hospital.com' });
    
    if (!admin) {
      console.log('❌ មិនរកឃើញ admin user');
      process.exit(1);
    }
    
    const notif = new Notification({
      userId: admin._id,
      title: '🧪 សាកល្បងការជូនដំណឹង',
      message: 'នេះជាសារសាកល្បងដើម្បីពិនិត្យប្រព័ន្ធការជូនដំណឹង។ ប្រសិនបើអ្នកឃើញសារនេះ មានន័យថាប្រព័ន្ធដំណើរការបានល្អ!',
      link: '/send-feedback',
      unread: true
    });
    
    await notif.save();
    
    console.log(`✅ បានបង្កើតការជូនដំណឹងសម្រាប់: ${admin.fullName || admin.name}`);
    console.log(`   User ID: ${admin._id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Notification ID: ${notif._id}`);
    console.log('\n💡 Login ជា admin@hospital.com ហើយពិនិត្យមើល notification bell!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createTestNotification();
