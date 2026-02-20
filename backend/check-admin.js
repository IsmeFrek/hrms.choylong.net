#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Role from './models/Role.js';
import fs from 'fs';

dotenv.config();
(async()=>{
  try{
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app');
    const r = await Role.findOne({ name: 'Admin' });
    if(!r) {
      fs.writeFileSync('./tmp/check-admin.txt','Admin role not found');
      console.log('Admin role not found');
      process.exit(2);
    }
    fs.writeFileSync('./tmp/check-admin.txt', r.permissions.join('\n'));
    console.log('Wrote tmp/check-admin.txt');
    process.exit(0);
  }catch(e){
    fs.writeFileSync('./tmp/check-admin.txt','Error: '+e.message);
    console.error('Error:', e);
    process.exit(1);
  }
})();
