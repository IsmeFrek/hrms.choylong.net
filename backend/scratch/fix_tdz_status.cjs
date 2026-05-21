const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/services/checkinmeService.js';
let content = fs.readFileSync(path, 'utf8');

// The problematic block I added
const problematicBlock = `
        // If status is Leave but type/reason are empty, check if Note contains info
        if (status === 'leave' && !reqType && !reqReason && note) {
            reqType = 'ច្បាប់'; 
            reqReason = note;
        }
`;

// Clean it up from where it is now (before status initialization)
content = content.replace(problematicBlock, '');

// Re-insert it after status is calculated
const targetAfterStatus = "status = 'present';\n        }";
const replacementAfterStatus = targetAfterStatus + problematicBlock;

if (content.includes(targetAfterStatus)) {
    content = content.replace(targetAfterStatus, replacementAfterStatus);
    fs.writeFileSync(path, content);
    console.log('Fixed Initialization Error (Status before TDZ)!');
} else {
    // If exact match fails, try a broader one
    const broadTarget = /status\s*=\s*'present';\s*\n\s*}/;
    if (broadTarget.test(content)) {
        content = content.replace(broadTarget, (match) => match + problematicBlock);
        fs.writeFileSync(path, content);
        console.log('Fixed Initialization Error (broad match)!');
    } else {
        console.log('Could not find status initialization to fix.');
    }
}
