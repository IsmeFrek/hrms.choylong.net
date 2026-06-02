import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/kshf_hospital_app').then(async () => {
  const HR = mongoose.model('HR', new mongoose.Schema({staffId: String}));
  const WorkSchedule = mongoose.model('WorkSchedule', new mongoose.Schema({employeeId: mongoose.Schema.Types.ObjectId, date: Date, shiftStart: String, shiftEnd: String, shiftTitle: String, shiftColor: String}));
  
  const hr = await HR.findOne({staffId: 'S1452'});
  if (!hr) {
    console.log('S1452 not found');
    process.exit(1);
  }

  const startDate = new Date(Date.UTC(2026, 3, 22)); // April 22, 2026
  const endDate = new Date(Date.UTC(2026, 4, 3));    // May 3, 2026

  let count = 0;
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    await WorkSchedule.updateOne(
      { employeeId: hr._id, date: new Date(d) },
      { 
        $set: {
          shiftTitle: 'Day Off',
          shiftStart: '',
          shiftEnd: '',
          shiftColor: '#ff0000'
        }
      },
      { upsert: true }
    );
    count++;
  }

  console.log(`Inserted ${count} Day Off records for S1452 from 2026-04-22 to 2026-05-03`);
  process.exit(0);
});
