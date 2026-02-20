#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Role from './models/Role.js';
import fs from 'fs';

dotenv.config();

const [,, emailArg, permissionArg] = process.argv;
if (!emailArg || !permissionArg) {
  const msg = 'Usage: node grant-direct.js <email> <permission>\n';
  try { fs.mkdirSync('./tmp', { recursive: true }); fs.writeFileSync('./tmp/grant-direct-log.txt', msg); } catch(e) {}
  console.error(msg);
  process.exit(2);
}

const email = String(emailArg).trim().toLowerCase();
const permission = String(permissionArg).trim();

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app');
    const log = [];
    log.push(`Connected to DB`);
    const user = await User.findOne({ email }).populate('roles');
    if (!user) {
      log.push(`User not found for email: ${email}`);
      fs.writeFileSync('./tmp/grant-direct-log.txt', log.join('\n'));
      console.error(log.join('\n'));
      process.exit(3);
    }
    log.push(`Found user: ${user.fullName || user.email}`);

    let role = await Role.findOne({ name: `personal:${user._id.toString()}` });
    if (!role) {
      role = await Role.create({ name: `personal:${user._id.toString()}`, permissions: [permission] });
      log.push(`Created personal role ${role.name} with ${permission}`);
    } else if (!role.permissions.includes(permission)) {
      role.permissions.push(permission);
      await role.save();
      log.push(`Added permission ${permission} to existing role ${role.name}`);
    } else {
      log.push(`Role ${role.name} already has permission ${permission}`);
    }

    const hasRole = (user.roles || []).some(r => r._id.toString() === role._id.toString());
    if (!hasRole) {
      user.roles = (user.roles || []).map(r => r._id).concat([role._id]);
      await user.save();
      log.push(`Assigned personal role to user ${user.fullName || user.email}`);
    } else {
      log.push(`User already has personal role ${role.name}`);
    }

    // recompute perms
    await user.populate('roles');
    const perms = new Set();
    (user.roles || []).forEach(r => (r.permissions || []).forEach(p => perms.add(p)));
    log.push(`Aggregated permissions: ${Array.from(perms).join(', ')}`);

    fs.writeFileSync('./tmp/grant-direct-log.txt', log.join('\n'));
    console.log(log.join('\n'));
    process.exit(0);
  } catch (err) {
    try { fs.appendFileSync('./tmp/grant-direct-log.txt', `Error: ${err.message}\n`); } catch(e){}
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
