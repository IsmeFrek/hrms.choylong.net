import mongoose from 'mongoose';

mongoose.connect('mongodb://localhost:27017/kshf_hospital_app').then(async () => {
  const HR = mongoose.model('HR', new mongoose.Schema({}, {strict: false}));
  const AttendanceDailyReport = mongoose.model('AttendanceDailyReport', new mongoose.Schema({}, {strict: false}));
  const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, {strict: false}));
  const MonthlySummary = mongoose.model('MonthlySummary', new mongoose.Schema({}, {strict: false}));

  console.log('--- Attendance ---');
  const att = await Attendance.find({ 
    $or: [ {staffId: /1452/i}, {staffName: /HUL THAI/i}, {staffName: /ហ៊ុល ថៃ/i} ],
    date: { $gte: new Date('2026-05-01'), $lte: new Date('2026-05-31') }
  });
  const attGroups = {};
  att.forEach(r => {
    const key = r.staffId + ' | ' + r.staffName;
    if(!attGroups[key]) attGroups[key] = 0;
    attGroups[key]++;
  });
  console.log(attGroups);

  console.log('--- MonthlySummary ---');
  const ms = await MonthlySummary.find({ 
    $or: [ {staffId: /1452/i}, {name: /HUL THAI/i}, {khmerName: /ហ៊ុល ថៃ/i} ],
    year: 2026, month: 5
  });
  console.log(ms.map(m => m.staffId + ' | ' + m.name));

  process.exit(0);
});
