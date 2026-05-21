const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/services/checkinmeService.js';
let content = fs.readFileSync(path, 'utf8');

// Refine Late and Early detection to avoid false positives from "In: early"
// 1. Fixing Late detection (only if it refers to "In")
const lateTarget = `const isLate = isAttendancesTable && (noteL.includes('late') || checkin1L.includes('late') || noteL.includes('យឺត') || checkin1L.includes('យឺត'));`;
const lateReplacement = `const isLate = isAttendancesTable && (
          (noteL.includes('in') && noteL.includes('late')) || 
          checkin1L.includes('late') || 
          noteL.includes('ចូលយឺត') || 
          (noteL.includes('late') && !noteL.includes('out') && !noteL.includes('early'))
        );`;

// 2. Fixing Early Leave detection (only if it refers to "Out")
const earlyTarget = `const leftEarly = isAttendancesTable && (noteL.includes('early') || checkout1L.includes('early') || noteL.includes('មុន') || checkout1L.includes('មុន'));`;
const earlyReplacement = `const leftEarly = isAttendancesTable && (
          (noteL.includes('out') && noteL.includes('early')) || 
          checkout1L.includes('early') || 
          noteL.includes('ចេញមុន') ||
          (noteL.includes('early') && !noteL.includes('in') && !noteL.includes('late'))
        );`;

if (content.includes(lateTarget)) content = content.replace(lateTarget, lateReplacement);
if (content.includes(earlyTarget)) content = content.replace(earlyTarget, earlyReplacement);

fs.writeFileSync(path, content);
console.log('Late/Early False Positives Fixed!');
