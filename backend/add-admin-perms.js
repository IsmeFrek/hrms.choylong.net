#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Role from './models/Role.js';

dotenv.config();
const permsToAdd = ['delete:fileTransfers','reply:fileTransfers','send:feedback'];

async function main(){
  try{
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app');
    const role = await Role.findOne({ name: 'Admin' });
    if(!role){
      console.error('Admin role not found');
      process.exit(2);
    }
    const current = new Set(role.permissions || []);
    let changed = false;
    for(const p of permsToAdd){
      if(!current.has(p)) { current.add(p); changed = true; }
    }
    if(changed){
      role.permissions = Array.from(current);
      await role.save();
      console.log('Admin role updated. Permissions now:', role.permissions.join(', '));
    } else {
      console.log('Admin role already had the permissions.');
    }
    process.exit(0);
  }catch(e){
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
