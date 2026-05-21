const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/src/pages/AttendanceDailyReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `    // Determine if it's considered "past the time to leave"
    // Since we don't have individual shift times here, we assume 17:30 (5:30 PM) is the standard latest shift end for a live day.
    const reportDate = new Date(date).setHours(0, 0, 0, 0);
    const todayDate = new Date().setHours(0, 0, 0, 0);
    const currentHour = new Date().getHours();

    const isPastDate = reportDate < todayDate;
    const isPastEndOfShift = reportDate === todayDate && currentHour >= 17; // 5:XX PM onwards`;

const replacement = `    // Determine if it's considered "past the time to leave"
    const reportDate = new Date(date).setHours(0, 0, 0, 0);
    const todayDate = new Date().setHours(0, 0, 0, 0);
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const isPastDate = reportDate < todayDate;
    
    let isPastEndOfShift = false;
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

// Normalize whitespace for matching
const normalize = (s) => s.replace(/\s+/g, ' ').trim();

if (normalize(content).includes(normalize(target))) {
    // Find where target starts and ends roughly by searching for the first 3 lines
    const searchPart = `// Since we don't have individual shift times here`;
    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchPart)) {
            startIdx = i - 1; // "Determine if..." line
            endIdx = i + 6;   // "isPastEndOfShift..." line
            break;
        }
    }
    
    if (startIdx !== -1) {
        lines.splice(startIdx, endIdx - startIdx + 1, replacement);
        fs.writeFileSync(path, lines.join('\n'));
        console.log('Success!');
    } else {
        console.log('Could not find startIdx');
    }
} else {
    console.log('Target not found via normalization');
}
