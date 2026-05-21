const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/src/pages/AttendanceDailyReportPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = 'return tCheck > (tStart + 5/60); // 5 mins buffer';
const replacement = 'return tCheck > (tStart + 15/60); // 15 mins buffer';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log('Frontend Late Buffer Updated to 15m!');
} else {
    console.log('Target for late buffer not found in frontend.');
}
