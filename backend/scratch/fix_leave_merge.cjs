const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/services/checkinmeService.js';
let content = fs.readFileSync(path, 'utf8');

// 1. More aggressive column detection keywords
const typeTarget = "labels.includes('request types'))";
const typeReplacement = "labels.includes('request types') || labels.includes('ច្បាប់'))";

const reasonTarget = "labels.includes('reasons'))";
const reasonReplacement = "labels.includes('reasons') || labels.includes('មូលហេតុ'))";

if (content.includes(typeTarget)) content = content.replace(typeTarget, typeReplacement);
if (content.includes(reasonTarget)) content = content.replace(reasonTarget, reasonReplacement);

// 2. Improve merging logic for leave details
const mergeTarget = `             if (newItem.leaveType && newItem.leaveType !== '—') exist.leaveType = newItem.leaveType;
             if (newItem.leaveReason && newItem.leaveReason !== '—') exist.leaveReason = newItem.leaveReason;`;

const mergeReplacement = `             // Robustly merge leave details - prioritize any non-empty value
             if (newItem.leaveType && newItem.leaveType !== '—' && newItem.leaveType !== '') {
               if (!exist.leaveType || exist.leaveType === '—' || exist.leaveType === '') exist.leaveType = newItem.leaveType;
             }
             if (newItem.leaveReason && newItem.leaveReason !== '—' && newItem.leaveReason !== '') {
               if (!exist.leaveReason || exist.leaveReason === '—' || exist.leaveReason === '') exist.leaveReason = newItem.leaveReason;
             }`;

if (content.includes(mergeTarget)) {
    content = content.replace(mergeTarget, mergeReplacement);
    fs.writeFileSync(path, content);
    console.log('Leave Merging Logic and Keywords Updated!');
} else {
    // If not found, it might be slightly different. Use a broader match.
    console.log('Merge target not found, trying multi-line match...');
    const broadTarget = /if\s*\(newItem\.leaveType\s*&&\s*newItem\.leaveType\s*!==\s*'—'\)\s*exist\.leaveType\s*=\s*newItem\.leaveType;/;
    if (broadTarget.test(content)) {
        content = content.replace(broadTarget, `if (newItem.leaveType && newItem.leaveType !== '—' && newItem.leaveType !== '') exist.leaveType = newItem.leaveType;`);
        content = content.replace(/if\s*\(newItem\.leaveReason\s*&&\s*newItem\.leaveReason\s*!==\s*'—'\)\s*exist\.leaveReason\s*=\s*newItem\.leaveReason;/, `if (newItem.leaveReason && newItem.leaveReason !== '—' && newItem.leaveReason !== '') exist.leaveReason = newItem.leaveReason;`);
        fs.writeFileSync(path, content);
        console.log('Leave Merging Logic Updated (broad)!');
    } else {
        console.log('Could not find any merging logic to update.');
    }
}
