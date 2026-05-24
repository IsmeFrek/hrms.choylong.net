import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/hrms');
  const hr = await mongoose.connection.collection('hrs').find({ khmerName: /សៀក ម៉េង/ }).toArray();
  console.log('HR Record:', JSON.stringify(hr, null, 2));

  const change = await mongoose.connection.collection('changerequests').find({ staffId: hr[0]?.staffId }).toArray();
  console.log('Change Requests:', JSON.stringify(change, null, 2));
  
  process.exit(0);
}
run();
