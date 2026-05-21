const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `      return {
        ...r,
        status,
        no: no || 9999,`;

const replacementStr = `      // Auto-calculate work hours for display if missing in DB
      const workHours = (r.workHours > 0) ? r.workHours : calculateDuration(r.checkin1, r.checkout1, r.checkin2, r.checkout2, r.scheduledTime);

      return {
        ...r,
        status,
        workHours,
        no: no || 9999,`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(path, content);
    console.log('On-the-fly WorkHours logic applied to GET route!');
} else {
    // Try with normalized whitespace
    const normalize = (s) => s.replace(/\s+/g, ' ').trim();
    if (normalize(content).includes(normalize(targetStr))) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('return {') && lines[i+1].includes('...r,') && lines[i+2].includes('status,')) {
                lines.splice(i + 1, 0, `      // Auto-calculate work hours for display\n      const workHours = (r.workHours > 0) ? r.workHours : calculateDuration(r.checkin1, r.checkout1, r.checkin2, r.checkout2, r.scheduledTime);`);
                // Add workHours to the return object
                for(let j=i+2; j < i+10; j++) {
                    if (lines[j].includes('status,')) {
                        lines[j] = '        status,\n        workHours,';
                        break;
                    }
                }
                break;
            }
        }
        fs.writeFileSync(path, lines.join('\n'));
        console.log('On-the-fly WorkHours logic applied (via lines)!');
    } else {
        console.log('Target string not found in attendance.js');
    }
}
