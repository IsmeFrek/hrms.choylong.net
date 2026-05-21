const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/src/pages/AttendanceDailyReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `          if (sh >= eh) {
            // Overnight or 24h shift (e.g. 07:30-07:30 or 19:00-07:00) ends on the NEXT day
            cutoffTime.setDate(cutoffTime.getDate() + 1);
          }`;

const replacement = `          // Overnight detection: 1. Start >= End (e.g. 19:00-07:00) 
          // 2. Very short same-day duration (e.g. 07:30-08:00) which in this hospital are 24.5h guards
          const durationMins = (eh * 60 + em) - (sh * 60); 
          if (sh >= eh || (durationMins > 0 && durationMins < 180)) {
            cutoffTime.setDate(cutoffTime.getDate() + 1);
          }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log('Short-Duration Overnight Logic Applied!');
} else {
    // Try normalized match if direct match fails
    const normalize = (s) => s.replace(/\s+/g, ' ').trim();
    if (normalize(content).includes(normalize(target))) {
        // Find indices manually
        const marker = "if (sh >= eh) {";
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(marker)) {
                lines[i] = `          const durationMins = (eh * 60 + em) - (sh * 60); `;
                lines[i+1] = `          if (sh >= eh || (durationMins > 0 && durationMins < 180)) {`;
                // lines[i+2] is cutoffTime.setDate...
                // lines[i+3] is }
                break;
            }
        }
        fs.writeFileSync(path, lines.join('\n'));
        console.log('Short-Duration Overnight Logic Applied (via lines)!');
    } else {
        console.log('Target not found for overnight adjustment.');
    }
}
