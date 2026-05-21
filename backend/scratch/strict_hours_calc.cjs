const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const targetLine = "workHours: (currentCheckin && currentCheckout)";
const replacementLine = "workHours: (currentCheckin && currentCheckout) "; // keeping it for matching later

// I'll rewrite the ternary to be more strict about only counting completed pairs
const targetConsolidation = `      workHours: (currentCheckin && currentCheckout) 
        ? calculateDuration(currentCheckin, currentCheckout, (r.checkin2 || r.checkIn2) || '', (r.checkout2 || r.checkOut2) || '', r.scheduledTime)
        : (parseFloat(r.workHours) || 0),`;

const replacementConsolidation = `      workHours: calculateDuration(currentCheckin, currentCheckout, (r.checkin2 || r.checkIn2) || '', (r.checkout2 || r.checkOut2) || '', r.scheduledTime),`;

// Note: calculateDuration already returns 0 if checkin or checkout is missing for a pair.
// So calling it unconditionally is safer and follows "only scanned in AND out".

const targetGet = `      const workHours = (r.checkin1 && r.checkout1) 
        ? calculateDuration(r.checkin1, r.checkout1, r.checkin2, r.checkout2, r.scheduledTime) 
        : (r.workHours || 0);`;

const replacementGet = `      const workHours = calculateDuration(r.checkin1, r.checkout1, r.checkin2, r.checkout2, r.scheduledTime);`;

if (content.includes(targetConsolidation)) {
    content = content.replace(targetConsolidation, replacementConsolidation);
}
if (content.includes(targetGet)) {
    content = content.replace(targetGet, replacementGet);
}

fs.writeFileSync(path, content);
console.log('WorkHours restricted to completed scan pairs only!');
