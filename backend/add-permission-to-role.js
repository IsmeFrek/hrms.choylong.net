#!/usr/bin/env node
// Usage: node add-permission-to-role.js [RoleName]
// Adds the permission 'addattendance:approve' to the given role.

import mongoose from 'mongoose';
import Role from './models/Role.js';
import { PERMISSIONS } from './permissions.js';

const DB = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendancedb';
const ROLE_NAME = process.argv[2] || 'Admin';
const PERM = 'addattendance:approve';

async function main(){
  if (!PERMISSIONS.includes(PERM)){
    console.error('Permission not present in backend/permissions.js:', PERM);
    process.exit(2);
  }
  await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', DB);
  const role = await Role.findOne({ name: ROLE_NAME });
  if (!role){
    console.error('Role not found:', ROLE_NAME);
    process.exit(3);
  }
  const current = Array.isArray(role.permissions) ? new Set(role.permissions) : new Set();
  if (current.has(PERM)){
    console.log('Role already has permission:', ROLE_NAME, PERM);
    await mongoose.disconnect();
    process.exit(0);
  }
  current.add(PERM);
  role.permissions = Array.from(current);
  await role.save();
  console.log('Added permission to role:', ROLE_NAME, PERM);
  console.log('New permissions:', role.permissions);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
