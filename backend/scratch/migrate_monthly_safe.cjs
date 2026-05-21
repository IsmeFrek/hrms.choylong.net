const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

// The block starts around router.get('/monthly-data'
const startToken = "router.get('/monthly-data', async (req, res, next) => {";
const startIndex = content.indexOf(startToken);

if (startIndex !== -1) {
    // Find the end of this block (look for the next endpoint or end of function)
    const endToken = "router.post('/monthly-data'"; 
    const endIndex = content.indexOf(endToken, startIndex);
    
    if (endIndex !== -1) {
        const migrationCode = `router.get('/monthly-data', async (req, res, next) => {
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

      if (rec.leaveType && rec.leaveType !== '—') {
        const lt = rec.leaveType.trim();
        if (!tgt.leaveType.includes(lt)) {
          tgt.leaveType = tgt.leaveType ? \`\${tgt.leaveType}, \${lt}\` : lt;
        }
      }
      if (rec.leaveReason && rec.leaveReason !== '—') {
        const lr = rec.leaveReason.trim();
        if (!tgt.other.includes(lr)) {
          tgt.other = tgt.other ? \`\${tgt.other}, \${lr}\` : lr;
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
        leaveType: rec.leaveType || '',
        leaveReason: rec.leaveReason || ''
      });
    });

    res.json(Object.values(map));
  } catch (err) {
    next(err);
  }
});

\n\n`;
        
        const newContent = content.slice(0, startIndex) + migrationCode + content.slice(endIndex);
        fs.writeFileSync(path, newContent);
        console.log('Successfully migrated /monthly-data via index replacement!');
    } else {
        console.log('Could not find end of monthly-data block.');
    }
} else {
    console.log('Could not find start of monthly-data block.');
}
