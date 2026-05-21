const fs = require('fs');
const path = 'd:/202026/web_2026_HomeV4/backend/services/checkinmeService.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update header detection to check for headers in tbody if thead is missing
const headerDetectionTarget = "$tbl.find('thead tr').each((rIdx, tr) => {";
const headerDetectionReplacement = `
      // Detect headers in thead OR first row of tbody if thead is empty
      let headerRows = $tbl.find('thead tr');
      if (headerRows.length === 0) {
          // If no thead, check the first row of tbody if it contains th tags
          const firstRow = $tbl.find('tbody tr').first();
          if (firstRow.find('th').length > 0) {
              headerRows = firstRow;
          }
      }

      headerRows.each((rIdx, tr) => {`;

if (content.includes(headerDetectionTarget)) {
    content = content.replace(headerDetectionTarget, headerDetectionReplacement);
}

// 2. Adjust row skipping logic: If we find headers in tbody, we MUST skip that first row when processing data
const rowSkipTarget = "const rows = $tbl.find('tbody tr');";
const rowSkipReplacement = `
      let rows = $tbl.find('tbody tr');
      // If we used the first row as headers, skip it
      if ($tbl.find('thead tr').length === 0 && rows.first().find('th').length > 0) {
          rows = rows.slice(1);
      }
`;

if (content.includes(rowSkipTarget)) {
    content = content.replace(rowSkipTarget, rowSkipReplacement);
    fs.writeFileSync(path, content);
    console.log('Fixed Header Detection for tbody-based tables (S1346 fix)!');
} else {
    console.log('Row skip target not found.');
}
