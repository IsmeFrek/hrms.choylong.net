#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Role from './models/Role.js';
import fs from 'fs';

dotenv.config();

const [,, emailArg, permissionArg] = process.argv;
if (!emailArg || !permissionArg) {
  console.error('Usage: node grant-by-email.js <email> <permission>');
  process.exit(2);
}

const email = String(emailArg).trim().toLowerCase();
const permission = String(permissionArg).trim();

async function main() {
  const startMsg = `grant-by-email starting for ${email} permission: ${permission}\n`;
  try { fs.mkdirSync('./tmp', { recursive: true }); fs.appendFileSync('./tmp/grant-log.txt', startMsg); } catch(e) {}
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app');
  const user = await User.findOne({ email }).populate('roles');
  if (!user) {
    const msg = `User not found for email: ${email}\n`;
    try { fs.appendFileSync('./tmp/grant-log.txt', msg); } catch(e) {}
    process.exit(3);
  }
  let role = await Role.findOne({ name: `personal:${user._id.toString()}` });
  if (!role) {
    role = await Role.create({ name: `personal:${user._id.toString()}`, permissions: [permission] });
    console.log('Created personal role', role.name);
  } else if (!role.permissions.includes(permission)) {
    role.permissions.push(permission);
    await role.save();
    console.log('Added permission to existing personal role', role.name);
  } else {
    console.log('Personal role already has permission');
  }
  // ensure user has role
  const hasRole = (user.roles || []).some(r => r._id.toString() === role._id.toString());
  if (!hasRole) {
    user.roles = (user.roles || []).map(r => r._id).concat([role._id]);
    await user.save();
    try { fs.appendFileSync('./tmp/grant-log.txt', `Assigned personal role to user ${user.fullName || email}\n`); } catch(e) {}
  }
  const perms = new Set();
  (user.roles || []).forEach(r => (r.permissions || []).forEach(p => perms.add(p)));
  try { fs.appendFileSync('./tmp/grant-log.txt', `User aggregated permissions (partial): ${Array.from(perms).slice(0,50).join(', ')}\n`); } catch(e) {}
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
