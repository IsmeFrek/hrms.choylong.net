const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const errorBlock = `      return {
      // Auto-calculate work hours for display
      const workHours = (r.workHours > 0) ? r.workHours : calculateDuration(r.checkin1, r.checkout1, r.checkin2, r.checkout2, r.scheduledTime);
        ...r,
        status,
        workHours,`;

const fixedBlock = `      // Auto-calculate work hours for display
      const workHours = (r.workHours > 0) ? r.workHours : calculateDuration(r.checkin1, r.checkout1, r.checkin2, r.checkout2, r.scheduledTime);

      return {
        ...r,
        status,
        workHours,`;

if (content.includes(errorBlock)) {
    content = content.replace(errorBlock, fixedBlock);
    fs.writeFileSync(path, content);
    console.log('Syntax Error Fixed Correctly!');
} else {
    console.log('Could not find the error block for direct replacement.');
}
