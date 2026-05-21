const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/services/checkinmeService.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Detect if Note column contains leave reason for people with Leave status
const logicInsert = `
        // If status is Leave but type/reason are empty, check if Note contains info
        if (status === 'leave' && !reqType && !reqReason && note) {
            reqType = 'ច្បាប់'; 
            reqReason = note;
        }
`;

if (!content.includes('if (status === \'leave\' && !reqType && !reqReason && note)')) {
    content = content.replace('let reqStatus = colIdx.statusCol !== -1 ? tdsFullText[colIdx.statusCol] : \'\';', 'let reqStatus = colIdx.statusCol !== -1 ? tdsFullText[colIdx.statusCol] : \'\';\n' + logicInsert);
}

// 2. Add extra logging for troubleshooting specific staff IDs
const logInsert = `
        if (staffCode.includes('1346') || empName.includes('យូហេង')) {
            console.log(\`[DEBUG S1346] TableType: Attend=\${isAttendancesTable}, Leave=\${isRequestLeaveTable}, Note: \${note}, Type: \${reqType}, Status: \${status}\`);
        }
`;

if (!content.includes('[DEBUG S1346]')) {
    content = content.replace('const newItem = {', logInsert + '\n        const newItem = {');
}

fs.writeFileSync(path, content);
console.log('S1346 Troubleshooting and Note-to-Reason logic added!');
