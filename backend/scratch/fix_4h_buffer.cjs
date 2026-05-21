const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/src/pages/AttendanceDailyReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `  const forgotScan = (r) => {
    const ci = r.checkin1 || r.checkIn || '';
    const co = r.checkout1 || r.checkOut || '';

    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);
    const now = new Date();
    
    // Default cutoff: If no schedule, assume 5:30 PM + 4h buffer = 9:30 PM
    let cutoffTime = new Date(reportDate);
    cutoffTime.setHours(17, 30, 0, 0);
    cutoffTime.setTime(cutoffTime.getTime() + 4 * 60 * 60 * 1000);

    if (r.scheduledTime && r.scheduledTime !== '—' && r.scheduledTime.includes(' - ')) {
      const parts = r.scheduledTime.split(' - ');
      const startTimeStr = parts[0]?.trim();
      const endTimeStr = parts[1]?.trim();
      
      if (startTimeStr && endTimeStr && startTimeStr.includes(':') && endTimeStr.includes(':')) {
        const [sh] = startTimeStr.split(':').map(Number);
        const [eh, em] = endTimeStr.split(':').map(Number);
        
        if (!isNaN(sh) && !isNaN(eh)) {
          cutoffTime = new Date(reportDate);
          cutoffTime.setHours(eh, em || 0, 0, 0);
          
          if (sh >= eh) {
            // Overnight or 24h shift (e.g. 07:30-07:30 or 19:00-07:00) ends on the NEXT day
            cutoffTime.setDate(cutoffTime.getDate() + 1);
          }
          
          // Apply the user's requested 4-hour buffer
          cutoffTime.setTime(cutoffTime.getTime() + 4 * 60 * 60 * 1000);
        }
      }
    }

    // Only mark as "Forgot" if the current time has passed the cutoff (Shift End + 4 Hours)
    if (now < cutoffTime) return false;

    return ci && !co && r.status !== 'absent' && r.status !== 'leave' && r.status !== 'pending';
  };`;

// Find the existing forgotScan function block
const lines = content.split('\n');
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const forgotScan = (r) => {')) {
        startIdx = i;
        let braceCount = 0;
        for (let j = startIdx; j < lines.length; j++) {
            if (lines[j].includes('{')) braceCount++;
            if (lines[j].includes('}')) braceCount--;
            if (braceCount === 0 && j > startIdx) {
                endIdx = j;
                break;
            }
        }
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx, endIdx - startIdx + 1, replacement);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('4-Hour Buffer Logic Applied Successfully!');
} else {
    console.log(`Could not find forgotScan function: start=${startIdx}, end=${endIdx}`);
}
