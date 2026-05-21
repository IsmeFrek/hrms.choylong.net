const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/services/checkinmeService.js';
let content = fs.readFileSync(path, 'utf8');

// The block we are looking for (normalized)
const targetPart = "exist.leaveType = exist.leaveType || newItem.leaveType;";

if (content.includes(targetPart)) {
    console.log('Found targets! Applying replacement...');
    
    // Replacement logic: Find the block between exist.leaveType and the end of the if(hasTimes) block
    const startIdx = content.indexOf("exist.leaveType = exist.leaveType || newItem.leaveType;");
    const endMarker = "exist.status = newItem.status;\r\n                 }\r\n             }\r\n        }";
    // Since whitespace is tricky, let's just find the closing braces of the else block
    
    // Actually, I'll just use a simpler regex replacement for the 2 lines and the hasTimes block
    content = content.replace(/exist\.leaveType = exist\.leaveType \|\| newItem\.leaveType;/g, "if (newItem.leaveType && newItem.leaveType !== '—') exist.leaveType = newItem.leaveType;");
    content = content.replace(/exist\.leaveReason = exist\.leaveReason \|\| newItem\.leaveReason;/g, "if (newItem.leaveReason && newItem.leaveReason !== '—') exist.leaveReason = newItem.leaveReason;");
    
    // Fix the status priority
    const statusBlockOld = /if \(hasTimes\) \{\s+\/\/ If they have times, they are 'present' unless they have a specific Leave\/Holiday status\s+if \(exist\.status !== 'leave' && exist\.status !== 'holiday' && newItem\.status !== 'leave' && newItem\.status !== 'holiday'\) \{\s+exist\.status = 'present';\s+\} else if \(newItem\.status === 'leave' \|\| newItem\.status === 'holiday'\) \{\s+exist\.status = newItem\.status;\s+\}\s+\}/;
    
    const statusBlockNew = `if (hasTimes) {
                 exist.status = 'present';
             } else {
                 const getPrio = (s) => {
                    const p = String(s || '').toLowerCase();
                    if (p === 'present') return 4;
                    if (p === 'leave') return 3;
                    if (p === 'holiday') return 2;
                    if (p === 'absent') return 1;
                    return 0;
                 };
                 if (getPrio(newItem.status) > getPrio(exist.status)) {
                    exist.status = newItem.status;
                 }
             }`;
             
    content = content.replace(statusBlockOld, statusBlockNew);
    
    fs.writeFileSync(path, content);
    console.log('Success!');
} else {
    console.log('Target not found in file');
}
