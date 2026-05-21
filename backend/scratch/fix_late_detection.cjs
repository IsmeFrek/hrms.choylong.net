const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const helpers = `
function isLateCheck(checkin, scheduledStart) {
  if (!checkin || !scheduledStart || scheduledStart === '—') return false;
  const tCheckin = timeToDecimal(checkin);
  // Extract only the start part if it's a range
  const startPart = scheduledStart.split('-')[0].trim();
  const tStart = timeToDecimal(startPart);
  if (tCheckin === 0 || tStart === 0) return false;
  // Late if checkin is more than 5 minutes past start
  return tCheckin > (tStart + 5/60);
}

function isEarlyCheck(checkout, scheduledEnd) {
  if (!checkout || !scheduledEnd || scheduledEnd === '—') return false;
  const tCheckout = timeToDecimal(checkout);
  const endPart = scheduledEnd.split('-').pop().trim();
  const tEnd = timeToDecimal(endPart);
  if (tCheckout === 0 || tEnd === 0) return false;
  
  // Handling overnight is tricky, but let's assume if checkout is AM and end is PM, it's definitely early leave
  // Special: if it's the same day and checkout < tEnd
  const tStartPart = timeToDecimal(scheduledEnd.split('-')[0].trim());
  if (tStartPart < tEnd) {
    // Standard same day shift
    return tCheckout < (tEnd - 2/60); // 2 mins buffer
  }
  return false;
}
`;

// Insert helpers
if (!content.includes('function isLateCheck')) {
    content = content.replace('function calculateDuration', helpers + '\nfunction calculateDuration');
}

// Update consolidation
const targetLate = 'isLate: !!r.isLate,';
const targetEarly = 'leftEarly: !!r.leftEarly,';
const replacementLate = 'isLate: r.isLate === true || isLateCheck(currentCheckin, r.scheduledTime),';
const replacementEarly = 'leftEarly: r.leftEarly === true || isEarlyCheck(currentCheckout, r.scheduledTime),';

if (content.includes(targetLate)) {
    content = content.replace(targetLate, replacementLate);
    content = content.replace(targetEarly, replacementEarly);
    fs.writeFileSync(path, content);
    console.log('Late/Early Detection Logic Added to Backend!');
} else {
    console.log('Targets not found in attendance.js');
}
