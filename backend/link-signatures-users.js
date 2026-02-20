import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import SignSchema from './models/SignSchema.js';

dotenv.config();

async function linkSignaturesToUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n🔗 ភ្ជាប់ Signatures ជាមួយ Users\n');
    
    const signatures = await SignSchema.find({}).limit(100);
    const users = await User.find({}).limit(100);
    
    console.log(`រកឃើញ ${signatures.length} signatures និង ${users.length} users\n`);
    
    let linked = 0;
    let skipped = 0;
    
    for (const sig of signatures) {
      // ប្រើឈ្មោះ signature ដើម្បីរកឈ្មោះ user ដែលប្រហាក់ប្រហែល
      const sigName = sig.fullNameKh || sig.name || '';
      
      if (!sigName) {
        skipped++;
        continue;
      }
      
      // ស្វែងរក user ដែលមានឈ្មោះដូចគ្នា
      const matchingUser = users.find(u => {
        const userName = u.fullName || u.name || '';
        return userName.toLowerCase().includes(sigName.toLowerCase()) || 
               sigName.toLowerCase().includes(userName.toLowerCase());
      });
      
      if (matchingUser && !sig.createdBy) {
        sig.createdBy = matchingUser._id;
        await sig.save();
        console.log(`✅ ភ្ជាប់: "${sigName}" → User: "${matchingUser.fullName || matchingUser.name}"`);
        linked++;
      } else if (sig.createdBy) {
        console.log(`⏭️  រំលង: "${sigName}" (មានភ្ជាប់រួចហើយ)`);
        skipped++;
      } else {
        console.log(`⚠️  មិនរកឃើញ user សម្រាប់: "${sigName}"`);
        skipped++;
      }
    }
    
    console.log(`\n📊 សង្ខេប:`);
    console.log(`   ភ្ជាប់បានជោគជ័យ: ${linked}`);
    console.log(`   រំលង: ${skipped}`);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

linkSignaturesToUsers();
