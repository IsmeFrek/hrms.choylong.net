const mongoose = require('mongoose');
const uri = 'mongodb+srv://Admin:admin123@clusters.ixvjm.mongodb.net/test?retryWrites=true&w=majority';

const schema = new mongoose.Schema({
  staffId: String,
  name: String,
  year: Number,
  month: Number,
  dailyData: [{day: Number, checkIn: String, checkOut: String}],
  dayWorkCount: Number,
  attendanceCount: Number,
  workTime: String,
  clock: String,
  clockCount: Number,
  checkinLateMinutes: Number,
  checkinLateCount: Number,
  checkoutEarlyMinutes: Number,
  checkoutEarlyCount: Number,
  checkoutOvertimeMinutes: Number,
  checkoutOvertimeCount: Number,
  absentCount: Number,
  leaveCount: Number
}, {collection: 'attendanceMonthlyData'});

const Model = mongoose.model('AttendanceMonthly', schema);

const testData = {
  staffId: 'EMP001',
  name: 'John Smith',
  year: 2026,
  month: 1,
  dailyData: [
    {day: 1, checkIn: '08:00', checkOut: '17:00'},
    {day: 2, checkIn: '08:15', checkOut: '17:30'},
    {day: 5, checkIn: '08:00', checkOut: '17:00'},
    {day: 6, checkIn: '08:00', checkOut: '17:00'}
  ],
  dayWorkCount: 4,
  attendanceCount: 4,
  workTime: '32',
  clock: '120',
  clockCount: 2,
  checkinLateMinutes: 15,
  checkinLateCount: 1,
  checkoutEarlyMinutes: 0,
  checkoutEarlyCount: 0,
  checkoutOvertimeMinutes: 30,
  checkoutOvertimeCount: 1,
  absentCount: 0,
  leaveCount: 0
};

mongoose.connect(uri).then(async () => {
  try {
    await Model.deleteMany({staffId: 'EMP001', year: 2026, month: 1});
    const result = await Model.create(testData);
    console.log('✓ Test data inserted:', result.name);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}).catch(err => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
