const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetRegex = /router\.get\('\/day-data', async \(req, res, next\) => \{[\s\S]+?res\.json\(Object\.values\(map\)\);\n  \} catch \(err\) \{[\s\S]+?next\(err\);\n  \}\n\}\);/;

const replacement = `router.get('/day-data', async (req, res, next) => {
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

    // Connect to the consolidated source of truth: AttendanceDailyReport
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
          leaveCount: 0
        };
      }
      
      const tgt = map[sid];
      
      // Update Counts
      if (rec.isLate) tgt.checkinLateCount += 1;
      if (rec.leftEarly) tgt.checkoutEarlyCount += 1;
      if (rec.status === 'absent') tgt.absentCount += 1;
      if (rec.status === 'leave') tgt.leaveCount += 1;
      if (rec.plech) tgt.plech += 1;
      
      // Minutes and Hours (Daily report stores workHours in hours, monthly expects minutes)
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

    // Final mapping for consistency with frontend expectation of top-level checkIn/checkOut
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
});`;

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync(path, content);
    console.log('Successfully connected Monthly Report to AttendanceDailyReport data!');
} else {
    console.log('Could not find target day-data block.');
}
