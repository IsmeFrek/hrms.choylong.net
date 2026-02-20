import mongoose from 'mongoose';
import Role from '../models/Role.js';

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

(async () => {
  await mongoose.connect(MONGO);
  const userRole = await Role.findOne({ name: 'User' }).lean();
  const pendingRole = await Role.findOne({ name: 'Pending' }).lean();
  console.log('User role:', userRole);
  console.log('Pending role:', pendingRole);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
