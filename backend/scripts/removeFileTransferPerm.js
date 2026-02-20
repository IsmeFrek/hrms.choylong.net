import mongoose from 'mongoose';
import Role from '../models/Role.js';
import dotenv from 'dotenv';

dotenv.config();

async function removePerms() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const permsToRemove = ['view:fileTransfers', 'edit:fileTransfers'];

    const res = await Role.updateMany(
      { name: { $ne: 'Admin' } },
      { $pull: { permissions: { $in: permsToRemove } } }
    );

    console.log('Update result:', res);
    console.log(`Removed fileTransfer permissions from ${res.modifiedCount || res.nModified || 0} role(s).`);

    // show roles that still have these perms (if any)
    const remaining = await Role.find({ permissions: { $in: permsToRemove } }).select('name permissions').lean();
    if (remaining.length) {
      console.log('Roles still containing fileTransfer permissions:');
      remaining.forEach(r => console.log('-', r.name, r.permissions.filter(p => permsToRemove.includes(p))));
    } else {
      console.log('No roles contain fileTransfer permissions anymore (except Admin).');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error removing permissions:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) removePerms();

export default removePerms;
