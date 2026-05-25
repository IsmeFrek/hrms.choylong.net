const mongoose = require('mongoose');

async function checkD0020() {
  try {
    await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
    const db = mongoose.connection.db;
    
    const collections = await db.listCollections().toArray();
    let found = false;
    for (let col of collections) {
       const docs = await db.collection(col.name).find({ 
         $or: [
           { staffId: { $regex: 'D0020', $options: 'i' } },
           { no: { $regex: 'D0020', $options: 'i' } },
           { cardNumber: { $regex: 'D0020', $options: 'i' } },
           { khmerName: { $regex: 'ចាន់.*វិចិត្រ', $options: 'i' } },
           { name: { $regex: 'ចាន់.*វិចិត្រ', $options: 'i' } }
         ]
       }).toArray();
       
       if (docs.length > 0) {
         console.log(`\n--- Found in ${col.name} ---`);
         for (let h of docs) {
           console.log('ID:', h._id);
           console.log('Name:', h.name || h.khmerName);
           console.log('staffId:', h.staffId || h.no || h.cardNumber);
           console.log('Status:', h.status);
           console.log('Resign Date:', h.resignDate || h.resignationDate || h.dateRemoved || h.date_removed || h.endDate || h.leaveDate);
           console.log('Resign Reason:', h.resignReason || h.resignationReason);
           if (h.delisted) {
              console.log('Delisted Info:', h.delisted);
           }
           console.log('Fields with resign/remove/end/leave:', Object.keys(h).filter(k => 
             k.toLowerCase().includes('resign') || 
             k.toLowerCase().includes('remov') ||
             k.toLowerCase().includes('end') ||
             k.toLowerCase().includes('leave')
           ).map(k => `${k}: ${h[k]}`));
         }
         found = true;
       }
    }
    
    if (!found) {
      console.log('D0020 not found anywhere.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkD0020();
