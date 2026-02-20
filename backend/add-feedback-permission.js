import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from './models/Role.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function addFeedbackPermission() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Update User role to include send:feedback and send:telegram permissions
    const result = await Role.updateOne(
      { name: 'User' },
      { $addToSet: { permissions: { $each: ['send:feedback', 'send:telegram'] } } }
    );

    console.log('Update result:', result);
    
    const userRole = await Role.findOne({ name: 'User' });
    console.log('\nUser role permissions:', userRole ? userRole.permissions : 'Not found');

    await mongoose.disconnect();
    console.log('\n✅ បានបន្ថែម send:feedback permission ដល់ User role ដោយជោគជ័យ!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addFeedbackPermission();
