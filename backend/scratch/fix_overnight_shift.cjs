const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/src/pages/AttendanceDailyReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `    let isPastEndOfShift = false;
    if (reportDate === todayDate) {
      if (r.scheduledTime && r.scheduledTime !== '—' && r.scheduledTime.includes(' - ')) {
        const parts = r.scheduledTime.split(' - ');
        const endTimeStr = parts[1]?.trim();
        if (endTimeStr && endTimeStr.includes(':')) {
          const [h, m] = endTimeStr.split(':').map(Number);
          if (!isNaN(h)) {
            // Give 30 mins buffer after shift ends before marking as "Forgot"
            const endTotalMinutes = h * 60 + (m || 0) + 30;
            isPastEndOfShift = currentTotalMinutes >= endTotalMinutes;
          }
        }
      } else {
        // Fallback: 5:30 PM (17:30)
        isPastEndOfShift = now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() >= 30);
      }
    }`;

const replacement = `    let isPastEndOfShift = false;
    if (reportDate === todayDate) {
      if (r.scheduledTime && r.scheduledTime !== '—' && r.scheduledTime.includes(' - ')) {
        const parts = r.scheduledTime.split(' - ');
        const startTimeStr = parts[0]?.trim();
        const endTimeStr = parts[1]?.trim();
        
        if (startTimeStr && endTimeStr && startTimeStr.includes(':')) {
          const [sh] = startTimeStr.split(':').map(Number);
          const [eh, em] = endTimeStr.split(':').map(Number);
          
          if (!isNaN(sh) && !isNaN(eh)) {
            // Overnight shift (e.g. 19:00 - 07:00) OR 24h shift (07:30 - 07:30)
            // These shifts only end on the NEXT day, so isPastEndOfShift is always false for today.
            if (sh >= eh) {
              isPastEndOfShift = false;
            } else {
              // Standard same-day shift: check if current time is past end time + 30m
              const endTotalMinutes = eh * 60 + (em || 0) + 30;
              isPastEndOfShift = currentTotalMinutes >= endTotalMinutes;
            }
          }
        }
      } else {
        // Fallback: 5:30 PM (17:30)
        isPastEndOfShift = now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() >= 30);
      }
    }`;

// Normalize whitespace for matching
const normalize = (s) => s.replace(/\s+/g, ' ').trim();

if (normalize(content).includes(normalize(target))) {
    // Custom find-and-replace using content splitting to avoid complex regex
    // We already know it contains the normalized target, so we can use a simpler marker
    const marker = "if (r.scheduledTime && r.scheduledTime !== '—' && r.scheduledTime.includes(' - ')) {";
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(marker) && lines[i-1].includes("if (reportDate === todayDate)")) {
            startIdx = i - 1; // if (reportDate === todayDate)
            // Find the closing brace of this block
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
        console.log('Final Overnight/24h Shift Logic Applied!');
    } else {
        console.log(`Markers not found: start=${startIdx}, end=${endIdx}`);
    }
} else {
    console.log('Target not found via normalization in AttendanceDailyReportPage.jsx');
}
