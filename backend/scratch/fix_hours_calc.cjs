const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

const helperCode = `
function timeToDecimal(t) {
  if (!t || typeof t !== 'string') return 0;
  const match = t.match(/(\\d{1,2}):(\\d{2})\\s*(AM|PM)?/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h + (m / 60);
}

function calculateDuration(in1, out1, in2, out2, scheduledRange) {
  let total = 0;
  const tIn1 = timeToDecimal(in1);
  const tOut1 = timeToDecimal(out1);
  const tIn2 = timeToDecimal(in2);
  const tOut2 = timeToDecimal(out2);

  if (tIn1 > 0 && tOut1 > 0) {
    if (tOut1 >= tIn1) {
      total += (tOut1 - tIn1);
    } else {
      // Overnight
      total += (24 - tIn1) + tOut1;
    }
  }
  if (tIn2 > 0 && tOut2 > 0) {
    if (tOut2 >= tIn2) {
      total += (tOut2 - tIn2);
    } else {
      total += (24 - tIn2) + tOut2;
    }
  }
  return parseFloat(total.toFixed(2));
}
`;

// Insert helper at the top or before use
if (!content.includes('function timeToDecimal')) {
    content = content.replace("const router = express.Router();", "const router = express.Router();\n" + helperCode);
}

// Update consolidation logic (around line 125 in original, now shifted)
// We need to find where workHours is assigned.
const targetLine = "workHours: parseFloat(r.workHours) || 0,";
const replacementLine = "workHours: parseFloat(r.workHours) || calculateDuration(currentCheckin, currentCheckout, r.checkin2, r.checkout2, r.scheduledTime),";

if (content.includes(targetLine)) {
    content = content.replace(targetLine, replacementLine);
    fs.writeFileSync(path, content);
    console.log('WorkHours Calculation Logic Added to Backend!');
} else {
    console.log('Could not find workHours assignment in attendance.js');
}
