// Script to set unique 'order' field for all DepartmentUnit documents
import mongoose from 'mongoose';
import DepartmentUnit from './models/DepartmentUnit.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';

async function fixDepartmentUnitOrder() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const units = await DepartmentUnit.find().sort({ createdAt: 1 });
  for (let i = 0; i < units.length; i++) {
    units[i].order = i + 1;
    await units[i].save();
  }
  console.log('Order field updated for all DepartmentUnit documents.');
  await mongoose.disconnect();
}

fixDepartmentUnitOrder();
