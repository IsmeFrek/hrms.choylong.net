#!/usr/bin/env node
import mongoose from 'mongoose';

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/kshf_hospital_app';
const year = Number(process.argv[2] || process.env.YEAR || 2026);
const month = Number(process.argv[3] || process.env.MONTH || 1);

const AttendanceSchema = new mongoose.Schema({}, { strict: false });
const MonthlySchema = new mongoose.Schema({}, { strict: false });

function parseHMtoMin(s) {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.getHours() * 60 + dt.getMinutes();
  return null;
}

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGO);

  const Attendance = mongoose.model('AttendanceAgg', AttendanceSchema, 'addattendances');
  const Monthly = mongoose.model('MonthlyAgg', MonthlySchema, 'attendance-monthly-data');

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const recs = await Attendance.find({ date: { $gte: start, $lte: end } }).lean();
  console.log('Found', recs.length, 'addattendances for', year + '-' + month);

  const map = {};
  for (const r of recs) {
    const sid = r.staffId || r.staff || r.staffID || 'UNKNOWN';
    if (!map[sid]) map[sid] = { staffId: sid, name: r.staffName || (r.staff && r.staff.fullName) || r.name || '', dailyData: [], dayWorkCount: 0, attendanceCount: 0, totalMinutes: 0, absentCount: 0, leaveCount: 0 };
    const day = new Date(r.date).getDate();
    const checkIn = r.checkIn || r.inTime || '';
    const checkOut = r.checkOut || r.outTime || '';
    map[sid].dailyData.push({ day, checkIn, checkOut });

    if (r.status === 'absent') {
      map[sid].absentCount++;
    } else if (r.status === 'leave') {
      map[sid].leaveCount++;
    } else {
      map[sid].attendanceCount++;
    }

    const inMin = parseHMtoMin(checkIn);
    const outMin = parseHMtoMin(checkOut);
    if (inMin !== null && outMin !== null && outMin > inMin) {
      const diff = outMin - inMin;
      map[sid].totalMinutes += diff;
      map[sid].dayWorkCount += 1;
    }
  }

  let upserted = 0;
  for (const sid of Object.keys(map)) {
    const doc = map[sid];
    try {
      await Monthly.findOneAndUpdate(
        { staffId: doc.staffId, year: year, month: month },
        {
          $set: {
            staffId: doc.staffId,
            name: doc.name,
            year: year,
            month: month,
            dailyData: doc.dailyData,
            dayWorkCount: doc.dayWorkCount,
            attendanceCount: doc.attendanceCount,
            workTime: doc.totalMinutes,
            absentCount: doc.absentCount,
            leaveCount: doc.leaveCount,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      upserted++;
    } catch (e) {
      console.error('Failed upserting', sid, e.message);
    }
  }

  console.log('Upserted monthly docs:', upserted);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
