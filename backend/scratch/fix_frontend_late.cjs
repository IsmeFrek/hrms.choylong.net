const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/src/pages/AttendanceDailyReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const helperCode = `
  const isLateCheck = (checkin, scheduledTime) => {
    if (!checkin || !scheduledTime || scheduledTime === '—' || scheduledTime.includes('Day Off') || scheduledTime === 'មិនមានម៉ោង') return false;
    const timeToDec = (t) => {
      if (!t) return 0;
      const m = t.match(/(\\d{1,2}):(\\d{2})\\s*(AM|PM)?/i);
      if (!m) return 0;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h + (min / 60);
    };
    const tCheck = timeToDec(checkin);
    const startStr = scheduledTime.split('-')[0].trim();
    const tStart = timeToDec(startStr);
    if (tCheck === 0 || tStart === 0) return false;
    return tCheck > (tStart + 5/60); // 5 mins buffer
  };

  const isEarlyCheck = (checkout, scheduledTime) => {
    if (!checkout || !scheduledTime || scheduledTime === '—' || scheduledTime.includes('Day Off') || scheduledTime === 'មិនមានម៉ោង') return false;
    const timeToDec = (t) => {
      if (!t) return 0;
      const m = t.match(/(\\d{1,2}):(\\d{2})\\s*(AM|PM)?/i);
      if (!m) return 0;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h + (min / 60);
    };
    const tCheck = timeToDec(checkout);
    const endStr = scheduledTime.split('-').pop().trim();
    const tEnd = timeToDec(endStr);
    return tCheck > 0 && tEnd > 0 && tCheck < (tEnd - 2/60);
  };
`;

// Insert helpers before calculateStatusGroup
if (!content.includes('const isLateCheck =')) {
    content = content.replace('const calculateStatusGroup = (r) => {', helperCode + '\n  const calculateStatusGroup = (r) => {');
}

// Update calculateStatusGroup logic
const logicTarget = `    // Present with flags - Prioritize database flags if available
    if (r.plech === true) return 'forgot';
    if (r.isLate === true) return 'late';
    if (r.leftEarly === true) return 'early';

    // Fallback to client-side heuristics if flags are missing or for non-synced data
    if (r.isLate) return 'late';
    if (r.leftEarly) return 'early';
    if (forgotScan(r)) return 'forgot';`;

const logicReplacement = `    // Priority 1: Check if already marked "Forgot" or "Late" in DB/Scraper
    if (r.plech === true || forgotScan(r)) return 'forgot';
    if (r.isLate === true || isLateCheck(r.checkin1 || r.checkIn, r.scheduledTime)) return 'late';
    if (r.leftEarly === true || isEarlyCheck(r.checkout1 || r.checkOut, r.scheduledTime)) return 'early';`;

if (content.includes(logicTarget)) {
    content = content.replace(logicTarget, logicReplacement);
    fs.writeFileSync(path, content);
    console.log('Frontend Late Detection Logic Applied!');
} else {
    console.log('Target logic not found in AttendanceDailyReportPage.jsx');
}
