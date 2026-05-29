import mongoose from 'mongoose';
mongoose.connect('mongodb://localhost:27017/kshf_hospital_app').then(async () => {
  const HR = mongoose.model('HR', new mongoose.Schema({staffId: String, joinDate: Date}));
  const WorkSchedule = mongoose.model('WorkSchedule', new mongoose.Schema({employeeId: mongoose.Schema.Types.ObjectId, date: Date, shiftStart: String, shiftEnd: String, shiftTitle: String}));
  const hr = await HR.findOne({staffId: 'S1452'});
  if (hr && hr.joinDate) {
    const res = await WorkSchedule.deleteMany({employeeId: hr._id, date: {$lt: hr.joinDate}});
    console.log('Deleted for S1452:', res.deletedCount);
  }
  process.exit(0);
});
