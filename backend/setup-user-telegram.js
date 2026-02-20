import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import SignSchema from './models/SignSchema.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function setupUserTelegram() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB\n');

    // Get all signatures with telegram info
    const signatures = await SignSchema.find().lean();
    
    console.log('=== Linking Signatures to Users for Telegram ===\n');
    
    let updatedCount = 0;
    
    for (const sig of signatures) {
      if (!sig.telegramId && !sig.telegramChatId) {
        continue; // Skip signatures without telegram info
      }
      
      // Try to find matching user
      let user = null;
      
      // Strategy 1: Match by createdBy
      if (sig.createdBy) {
        user = await User.findById(sig.createdBy);
      }
      
      // Strategy 2: Match by name
      if (!user && sig.fullNameKh) {
        user = await User.findOne({ fullName: sig.fullNameKh });
        
        // Try fuzzy match if exact match fails
        if (!user) {
          const allUsers = await User.find();
          user = allUsers.find(u => {
            const uName = (u.fullName || '').toLowerCase().trim();
            const sName = (sig.fullNameKh || '').toLowerCase().trim();
            return uName.includes(sName) || sName.includes(uName);
          });
        }
      }
      
      if (user) {
        let updated = false;
        
        // Update telegramChatId if signature has it and user doesn't
        if (sig.telegramChatId && !user.telegramChatId) {
          user.telegramChatId = sig.telegramChatId;
          updated = true;
        }
        
        // Update telegramId if signature has it and user doesn't
        if (sig.telegramId && !user.telegramId) {
          user.telegramId = sig.telegramId;
          updated = true;
        }
        
        if (updated) {
          await user.save();
          updatedCount++;
          console.log(`✅ Updated ${user.fullName}`);
          console.log(`   - telegramChatId: ${user.telegramChatId || 'N/A'}`);
          console.log(`   - telegramId: ${user.telegramId || 'N/A'}`);
          console.log('');
        }
      } else {
        console.log(`⚠️  Could not find user for signature: ${sig.fullNameKh || sig.fullName || 'Unknown'}`);
      }
    }
    
    console.log(`\n✅ បានធ្វើបច្ចុប្បន្នភាព ${updatedCount} users with Telegram info`);
    
    // Show summary of all users with telegram
    console.log('\n=== Summary: Users with Telegram ===\n');
    const usersWithTelegram = await User.find({
      $or: [
        { telegramChatId: { $exists: true, $ne: null, $ne: '' } },
        { telegramId: { $exists: true, $ne: null, $ne: '' } }
      ]
    }).select('fullName email telegramChatId telegramId');
    
    usersWithTelegram.forEach(u => {
      console.log(`👤 ${u.fullName}`);
      console.log(`   Email: ${u.email || 'N/A'}`);
      console.log(`   telegramChatId: ${u.telegramChatId || 'N/A'}`);
      console.log(`   telegramId: ${u.telegramId || 'N/A'}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('✅ រួចរាល់!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setupUserTelegram();
