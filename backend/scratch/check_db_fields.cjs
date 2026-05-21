const mongoose = require('mongoose');
const Schema = mongoose.Schema;

async function checkFields() {
  try {
    await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
    const AttendanceDailyReport = mongoose.model('AttendanceDailyReport', new Schema({}, { strict: false }), 'attendancedailyreports');
    
    console.log('--- Fields for CheckIn/Out ---');
    const doc = await AttendanceDailyReport.findOne({ 
      $or: [
        { checkin1: { $exists: true } },
        { checkout1: { $exists: true } },
        { leaveType: { $exists: true } }
      ]
    });
    
    if (doc) {
      console.log('Found document ID:', doc._id);
      console.log('Available keys:', Object.keys(doc.toObject()));
      console.log('Sample data:');
      console.log('  checkin1:', doc.checkin1);
      console.log('  checkout1:', doc.checkout1);
      console.log('  leaveType:', doc.leaveType);
      console.log('  leaveTyp (check):', doc.leaveTyp);
    } else {
      console.log('No documents found with those fields.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkFields();
