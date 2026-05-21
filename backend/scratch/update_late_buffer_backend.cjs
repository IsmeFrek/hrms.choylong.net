const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const target = 'return tCheckin > (tStart + 5/60);';
const replacement = 'return tCheckin > (tStart + 15/60); // Late if > 15 mins buffer';

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log('Backend Late Buffer Updated to 15m!');
} else {
    console.log('Target for late buffer not found in backend.');
}
