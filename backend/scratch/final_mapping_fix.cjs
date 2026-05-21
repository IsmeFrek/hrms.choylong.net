const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

// The goal is to fix the syntax and ensure leaveTyp/checkin1/checkout1 are handled correctly.

// Fix for /monthly-data block
const monthlyBlockStart = "router.get('/monthly-data', async (req, res, next) => {";
const monthlyBlockEnd = "router.post('/monthly-data'"; // The next endpoint
const startIndexM = content.indexOf(monthlyBlockStart);
const endIndexM = content.indexOf(monthlyBlockEnd, startIndexM);

if (startIndexM !== -1 && endIndexM !== -1) {
    const monthlyReplacement = `router.get('/monthly-data', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ message: 'year and month required' });
    const y = Number(year);
    const mo = Number(month);
    
    const startDate = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));

    const dailyReports = await AttendanceDailyReport.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 }).lean();

    const map = {};
    dailyReports.forEach((rec) => {
      const sid = String(rec.staffId || '').trim();
      if (!sid) return;

      if (!map[sid]) {
        map[sid] = {
          staffId: sid,
          name: rec.staffName || '',
          khmerName: rec.staffName || '',
          dailyData: [],
          checkinLateCount: 0,
          checkinLateMinutes: 0,
          checkoutEarlyCount: 0,
          checkoutEarlyMinutes: 0,
          workTime: 0,
          plech: 0,
          attendanceCount: 0,
          absentCount: 0,
          leaveCount: 0,
          leaveType: '',
          other: '',
          totalLeaveComment: '',
          year: y,
          month: mo,
          A: 0
        };
      }
      
      const tgt = map[sid];
      if (rec.isLate) tgt.checkinLateCount += 1;
      if (rec.leftEarly) tgt.checkoutEarlyCount += 1;
      if (rec.status === 'absent') { tgt.absentCount += 1; tgt.A = (tgt.A || 0) + 1; }
      if (rec.status === 'leave') tgt.leaveCount += 1;
      if (rec.plech) tgt.plech += 1;

      // Map leave types (supporting both leaveType and leaveTyp per user request)
      const lt = (rec.leaveType || rec.leaveTyp || '').toString().trim();
      if (lt && lt !== '—') {
        if (!tgt.leaveType.includes(lt)) {
          tgt.leaveType = tgt.leaveType ? \`\${tgt.leaveType}, \${lt}\` : lt;
        }
      }
      
      const lr = (rec.leaveReason || '').toString().trim();
      if (lr && lr !== '—') {
        if (!tgt.other.includes(lr)) {
          tgt.other = tgt.other ? \`\${tgt.other}, \${lr}\` : lr;
        }
      }
      
      if (rec.workHours) tgt.workTime += Math.round(Number(rec.workHours) * 60);
      
      // User mapping request: checkin1 and checkout1
      const cin = rec.checkin1 || rec.checkIn || '';
      const cout = rec.checkout1 || rec.checkOut || '';
      if (cin || cout) tgt.attendanceCount += 1;

      tgt.dailyData.push({
        _id: rec._id,
        date: rec.date.toISOString().slice(0, 10),
        checkIn: cin,
        checkOut: cout,
        status: rec.status || '',
        isLate: !!rec.isLate,
        leftEarly: !!rec.leftEarly,
        leaveType: lt,
        leaveReason: lr
      });
    });

    res.json(Object.values(map));
  } catch (err) {
    next(err);
  }
});

`;
    content = content.slice(0, startIndexM) + monthlyReplacement + content.slice(endIndexM);
}

// Fix for /day-data block
const dayBlockStart = "router.get('/day-data', async (req, res, next) => {";
const dayBlockEnd = "// Monthly CSV report"; 
const startIndexD = content.indexOf(dayBlockStart);
const endIndexD = content.indexOf(dayBlockEnd, startIndexD);

if (startIndexD !== -1 && endIndexD !== -1) {
    const dayReplacement = `router.get('/day-data', async (req, res, next) => {
  try {
    const { date, startDate, endDate } = req.query;

    let start, end;
    if (startDate && endDate) {
      const s = startDate.split('-');
      const e = endDate.split('-');
      start = new Date(Date.UTC(s[0], s[1]-1, s[2], 0, 0, 0));
      end   = new Date(Date.UTC(e[0], e[1]-1, e[2], 23, 59, 59, 999));
    } else if (date) {
      const d = date.split('-');
      start = new Date(Date.UTC(d[0], d[1]-1, d[2], 0, 0, 0));
      end   = new Date(Date.UTC(d[0], d[1]-1, d[2], 23, 59, 59, 999));
    } else {
      return res.status(400).json({ message: 'date or startDate+endDate required' });
    }

    const dailyReports = await AttendanceDailyReport.find({
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 }).lean();

    const map = {};
    dailyReports.forEach((rec) => {
      const sid = String(rec.staffId || '').trim();
      if (!sid) return;

      if (!map[sid]) {
        map[sid] = {
          staffId: sid,
          name: rec.staffName || '',
          khmerName: rec.staffName || '',
          dailyData: [],
          checkinLateCount: 0,
          checkinLateMinutes: 0,
          checkoutEarlyCount: 0,
          checkoutEarlyMinutes: 0,
          workTime: 0,
          plech: 0,
          attendanceCount: 0,
          absentCount: 0,
          leaveCount: 0,
          leaveType: '',
          leaveReason: '',
          department: rec.department || '',
          employeeCategory: rec.employeeCategory || ''
        };
      }
      
      const tgt = map[sid];
      if (rec.isLate) tgt.checkinLateCount += 1;
      if (rec.leftEarly) tgt.checkoutEarlyCount += 1;
      if (rec.status === 'absent') tgt.absentCount += 1;
      if (rec.status === 'leave') tgt.leaveCount += 1;
      if (rec.plech) tgt.plech += 1;

      // User mapping request: leaveTyp, checkin1, checkout1
      const lt = (rec.leaveType || rec.leaveTyp || '').toString().trim();
      if (lt && lt !== '—') {
        if (!tgt.leaveType.includes(lt)) {
          tgt.leaveType = tgt.leaveType ? \`\${tgt.leaveType}, \${lt}\` : lt;
        }
      }
      
      const lr = (rec.leaveReason || '').toString().trim();
      if (lr && lr !== '—') {
        if (!tgt.leaveReason.includes(lr)) {
          tgt.leaveReason = tgt.leaveReason ? \`\${tgt.leaveReason}, \${lr}\` : lr;
        }
      }
      
      if (rec.workHours) tgt.workTime += Math.round(Number(rec.workHours) * 60);
      
      const cin = rec.checkin1 || rec.checkIn || '';
      const cout = rec.checkout1 || rec.checkOut || '';
      if (cin || cout) tgt.attendanceCount += 1;

      tgt.dailyData.push({
        _id: rec._id,
        date: rec.date.toISOString().slice(0, 10),
        checkIn: cin,
        checkOut: cout,
        status: rec.status || '',
        isLate: !!rec.isLate,
        leftEarly: !!rec.leftEarly,
        leaveType: lt,
        leaveReason: lr
      });
    });

    Object.values(map).forEach((tgt) => {
      if (tgt.dailyData.length > 0) {
        const last = tgt.dailyData[tgt.dailyData.length - 1];
        tgt.checkIn = last.checkIn;
        tgt.checkOut = last.checkOut;
        tgt.status = last.status;
      }
    });

    res.json(Object.values(map));
  } catch (err) {
    next(err);
  }
});

`;
    content = content.slice(0, startIndexD) + dayReplacement + content.slice(endIndexD);
}

fs.writeFileSync(path, content);
console.log('Successfully fixed syntax and updated field mappings for Day/Monthly reports!');
