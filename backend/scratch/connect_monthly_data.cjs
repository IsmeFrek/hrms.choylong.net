const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetRegex = /router\.get\('\/monthly-data', async \(req, res, next\) => \{[\s\S]+?res\.json\(rows\);\n  \} catch \(err\) \{[\s\S]+?next\(err\);\n  \}\n\}\);/;

const replacement = `router.get('/monthly-data', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ message: 'year and month required' });
    const y = Number(year);
    const mo = Number(month);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return res.status(400).json({ message: 'invalid year/month' });

    const startDate = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));

    // Connect to the consolidated source of truth: AttendanceDailyReport
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
      
      // Update Counts
      if (rec.isLate) tgt.checkinLateCount += 1;
      if (rec.leftEarly) tgt.checkoutEarlyCount += 1;
      if (rec.status === 'absent') { tgt.absentCount += 1; tgt.A += 1; }
      if (rec.status === 'leave') tgt.leaveCount += 1;
      if (rec.plech) tgt.plech += 1;
      
      // Aggregate Leave Strings
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

      // Minutes and Hours
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
});`;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync(path, content);
    console.log('Successfully connected monthly-data to AttendanceDailyReport data!');
} else {
    console.log('Could not find target monthly-data block.');
}
