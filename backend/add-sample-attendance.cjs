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

// Generate daily data for date range
function generateDailyData(startDay, startMonth, startYear, endDay, endMonth, endYear) {
  const data = [];
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  
  let current = new Date(start);
  while (current <= end) {
    const day = current.getDate();
    const month = current.getMonth() + 1;
    const year = current.getFullYear();
    
    // Skip weekends
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      data.push({
        day,
        checkIn: '08:00',
        checkOut: '17:00'
      });
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return data;
}

const employeeData = [
  {
    staffId: 'EMP001',
    name: 'ឯម ចាន់ដា',
    dailyData: generateDailyData(21, 12, 2025, 22, 1, 2026)
  },
  {
    staffId: 'EMP002',
    name: 'លី សុខ',
    dailyData: generateDailyData(21, 12, 2025, 22, 1, 2026)
  }
];

async function insertData() {
  try {
    await mongoose.connect(uri);
    
    // Insert for December 2025
    for (const emp of employeeData) {
      const record = {
        ...emp,
        year: 2025,
        month: 12,
        dayWorkCount: emp.dailyData.filter(d => d.day >= 21).length,
        attendanceCount: emp.dailyData.filter(d => d.day >= 21).length,
        workTime: String(emp.dailyData.filter(d => d.day >= 21).length * 8),
        clock: '0',
        clockCount: 0,
        checkinLateMinutes: 0,
        checkinLateCount: 0,
        checkoutEarlyMinutes: 0,
        checkoutEarlyCount: 0,
        checkoutOvertimeMinutes: 0,
        checkoutOvertimeCount: 0,
        absentCount: 0,
        leaveCount: 0,
        dailyData: emp.dailyData.filter(d => d.day >= 21)
      };
      
      await Model.deleteMany({staffId: emp.staffId, year: 2025, month: 12});
      await Model.create(record);
      console.log(`✓ ${emp.name} - December 2025 (${record.dayWorkCount} days)`);
    }
    
    // Insert for January 2026
    for (const emp of employeeData) {
      const record = {
        ...emp,
        year: 2026,
        month: 1,
        dayWorkCount: emp.dailyData.filter(d => d.day <= 22).length,
        attendanceCount: emp.dailyData.filter(d => d.day <= 22).length,
        workTime: String(emp.dailyData.filter(d => d.day <= 22).length * 8),
        clock: '0',
        clockCount: 0,
        checkinLateMinutes: 0,
        checkinLateCount: 0,
        checkoutEarlyMinutes: 0,
        checkoutEarlyCount: 0,
        checkoutOvertimeMinutes: 0,
        checkoutOvertimeCount: 0,
        absentCount: 0,
        leaveCount: 0,
        dailyData: emp.dailyData.filter(d => d.day <= 22)
      };
      
      await Model.deleteMany({staffId: emp.staffId, year: 2026, month: 1});
      await Model.create(record);
      console.log(`✓ ${emp.name} - January 2026 (${record.dayWorkCount} days)`);
    }
    
    console.log('\n✅ All data inserted successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

insertData();
