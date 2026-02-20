import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Role from './models/Role.js';

dotenv.config();

async function inspect(nameOrId) {
  await mongoose.connect(process.env.MONGODB_URI);
  let user;
  if (mongoose.Types.ObjectId.isValid(nameOrId)) {
    user = await User.findById(nameOrId).populate('roles');
  } else {
    // try match by name (fullName or name) or username/email
    user = await User.findOne({ $or: [ { fullName: nameOrId }, { name: nameOrId }, { username: nameOrId }, { email: nameOrId } ] }).populate('roles');
  }
  if (!user) {
    console.error('User not found for:', nameOrId);
    process.exit(2);
  }
  const perms = new Set();
  (user.roles || []).forEach(r => (r.permissions || []).forEach(p => perms.add(p)));
  console.log('\nUser:', user.fullName || user.name);
  console.log('ID:', user._id.toString());
  console.log('Active:', user.active);
  console.log('Roles:', (user.roles || []).map(r => r.name).join(', ') || '-');
  console.log('Aggregated permissions:', Array.from(perms).join(', ') || '-');
  process.exit(0);
}

const arg = process.argv[2] || 'S0932';
inspect(arg).catch(err => { console.error('Error:', err.message); process.exit(1); });
