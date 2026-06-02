import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/hrms');
  const hr = await mongoose.connection.collection('hrs').find({ 
    $or: [{ khmerName: /សៀក/ }, { khmerName: /ម៉េង/ }, { name: /meng/i }] 
  }).toArray();
  
  console.log('HR Record:', JSON.stringify(hr.map(r => ({ name: r.khmerName, latinName: r.name, no: r.no, staffId: r.staffId, department: r.Department_Kh })), null, 2));
  process.exit(0);
}
run().catch(console.error);
