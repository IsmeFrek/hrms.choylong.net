const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/routes/attendance.js';
let content = fs.readFileSync(path, 'utf8');

// Fix the corrupted em-dash and add leaveTyp support
// Target: the day-data and monthly-data blocks

// Helper function to replace the logic safely
function clarifyMapping(text) {
    let t = text;
    // Fix corruption and add leaveTyp / leaveReason robustly
    // Replace: if (rec.leaveType && rec.leaveType !== '')
    // We'll use a simpler check: rec.leaveType || rec.leaveTyp
    
    const leaveLogicRegex = /if \(rec\.leaveType && rec\.leaveType !== '.*?'\) \{([\s\S]+?)\}/g;
    t = t.replace(leaveLogicRegex, (match, body) => {
        return `if ((rec.leaveType || rec.leaveTyp) && (rec.leaveType !== '—' && rec.leaveTyp !== '—')) {
        const lt = (rec.leaveType || rec.leaveTyp || '').trim();
        if (lt && !tgt.leaveType.includes(lt)) {
          tgt.leaveType = tgt.leaveType ? \`\${tgt.leaveType}, \${lt}\` : lt;
        }
      }`;
    });

    const reasonLogicRegex = /if \(rec\.leaveReason && rec\.leaveReason !== '.*?'\) \{([\s\S]+?)\}/g;
    t = t.replace(reasonLogicRegex, (match, body) => {
        return `if (rec.leaveReason && rec.leaveReason !== '—') {
        const lr = rec.leaveReason.trim();
        if (lr && !tgt.leaveReason.includes(lr)) {
          tgt.leaveReason = tgt.leaveReason ? \`\${tgt.leaveReason}, \${lr}\` : lr;
        }
      }`;
    });

    // Ensure checkin1 / checkout1 priority (already there, but reinforcing)
    t = t.replace(/const cin = rec\.checkin1 \|\| rec\.checkIn \|\| '';/g, "const cin = rec.checkin1 || rec.checkIn || '';");
    t = t.replace(/const cout = rec\.checkout1 \|\| rec\.checkOut \|\| '';/g, "const cout = rec.checkout1 || rec.checkOut || '';");

    return t;
}

content = clarifyMapping(content);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated backend mapping for checkin1, checkout1, and leaveTyp!');
