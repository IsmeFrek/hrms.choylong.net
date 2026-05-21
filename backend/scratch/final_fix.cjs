const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/services/checkinmeService.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Better table type detection (between line 828 and 840)
const detectionTarget = "      // If it has checkin/out columns, it's definitely Attendances even if preceding text missed it";
const detectionReplacement = `      // If a table has Reason or Type columns and NO checkin columns, it's very likely a Request Leave table
      if (colIdx.checkin1 === -1 && (colIdx.reason !== -1 || colIdx.type !== -1)) {
        isRequestLeaveTable = true;
        isAttendancesTable = false;
        isHolidayTable = false;
        isAbsentTable = false;
        isPendingTable = false;
      }

      // If it has checkin/out columns, it's definitely Attendances even if preceding text missed it`;

content = content.replace(detectionTarget, detectionReplacement);

// 2. Better ID matching (around line 946)
const idLogicTarget = "if (!resolvedStaffId || isNaN(resolvedStaffId) || String(resolvedStaffId).length < 5 || String(resolvedStaffId) === empName) {";
const idLogicReplacement = "const isEmpCode = (s) => /^[A-Z]\\d+/.test(String(s).toUpperCase());\n        if (!resolvedStaffId || (isNaN(resolvedStaffId) && !isEmpCode(resolvedStaffId)) || String(resolvedStaffId).length < 4 || String(resolvedStaffId) === empName) {";

content = content.replace(idLogicTarget, idLogicReplacement);

// 3. Status priority fix (already done in previous turn but let's double check merging)
// The previous merging logic:
// if (getPrio(newItem.status) > getPrio(exist.status)) { exist.status = newItem.status; }

fs.writeFileSync(path, content);
console.log('Final Scraper Strengthening Success!');
