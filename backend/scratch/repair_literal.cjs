const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

// Fix the template literal pollution from PowerShell
content = content.replace(/\\\$tgt\.leaveType, \\\$lt\\/g, '`${tgt.leaveType}, ${lt}`');
content = content.replace(/\\\$tgt\.leaveReason, \\\$lr\\/g, '`${tgt.leaveReason}, ${lr}`');

// Also fix the other template literal in monthlyData if I had already applied it (I haven't successfully yet)

fs.writeFileSync(path, content);
console.log('Fixed template literal pollution!');
