import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Notification from './models/Notification.js';
import User from './models/User.js';

dotenv.config();

async function checkNotifications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n📬 ពិនិត្យការជូនដំណឹង\n');
    
    const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(10).populate('userId');
    
    if (notifications.length === 0) {
      console.log('❌ មិនមានការជូនដំណឹងក្នុង database\n');
      process.exit(0);
    }
    
    console.log(`រកឃើញ ${notifications.length} ការជូនដំណឹង:\n`);
    console.log('='.repeat(80));
    
    notifications.forEach((n, i) => {
      const userName = n.userId ? (n.userId.fullName || n.userId.name || 'N/A') : 'N/A';
      const unread = n.unread ? '🔔 UNREAD' : '✓ Read';
      
      console.log(`${i + 1}. ${unread}`);
      console.log(`   User: ${userName} (ID: ${n.userId?._id || 'N/A'})`);
      console.log(`   Title: ${n.title || 'N/A'}`);
      console.log(`   Message: ${(n.message || '').substring(0, 100)}...`);
      console.log(`   Link: ${n.link || 'N/A'}`);
      console.log(`   Created: ${n.createdAt}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkNotifications();
