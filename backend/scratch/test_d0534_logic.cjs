const cheerio = require('cheerio');

// Mock HTML based on the user's latest screenshot
const html = `
<div class="report-title">Request Leave</div>
<table>
  <thead>
    <tr>
      <th>No</th>
      <th>STAFF ID</th>
      <th>NAME</th>
      <th>DEPARTMENT</th>
      <th>MANAGER</th>
      <th>TYPE</th>
      <th>REASON</th>
      <th>STATUS</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>D0534</td>
      <td>KHORN SENGKHEANG<br>ខន សេងឃាង</td>
      <td>ផ្នែកសម្ភព និងរោគស្ត្រី</td>
      <td>UY KYNA</td>
      <td>ច្បាប់ឈប់រយៈពេលខ្លី</td>
      <td>ធ្វើពិធីបុណ្យខួប</td>
      <td>Approved</td>
    </tr>
  </tbody>
</table>
`;

function normalizeKhmer(text) {
    if (!text) return '';
    return text.replace(/[​]/g, '').trim(); 
}

function scrapeMock(html) {
    const $ = cheerio.load(html);
    const items = [];
    
    $('table').each((idx, tbl) => {
        const $tbl = $(tbl);
        const prevText = $tbl.prev().text().toUpperCase() || '';
        const isRequestLeaveTable = prevText.includes('LEAVE');
        
        console.log('Testing table with title:', prevText, 'isLeave:', isRequestLeaveTable);
        
        const colIdx = { staffCode: -1, name: -1, department: -1, type: -1, reason: -1, statusCol: -1 };
        $tbl.find('thead th').each((j, th) => {
            const h = $(th).text().trim().toUpperCase();
            if (h === 'STAFF ID') colIdx.staffCode = j;
            if (h === 'NAME') colIdx.name = j;
            if (h === 'TYPE') colIdx.type = j;
            if (h === 'REASON') colIdx.reason = j;
        });
        
        console.log('Detected Col indices:', colIdx);
        
        $tbl.find('tbody tr').each((i, tr) => {
            const $tds = $(tr).find('td');
            const tdsFullText = [];
            $tds.each((j, td) => {
               const rawHtml = $(td).html() || '';
               const lines = rawHtml.split(/<br\s*\/?>/i).map(l => l.replace(/<[^>]*>?/gm, '').trim());
               tdsFullText.push(lines.filter(Boolean).join(' '));
            });
            
            const staffCode = colIdx.staffCode !== -1 ? tdsFullText[colIdx.staffCode] : '';
            const empName = colIdx.name !== -1 ? tdsFullText[colIdx.name] : '';
            const reqType = colIdx.type !== -1 ? tdsFullText[colIdx.type] : '';
            const reqReason = colIdx.reason !== -1 ? tdsFullText[colIdx.reason] : '';
            
            console.log('Extracted:', { staffCode, empName, reqType, reqReason });
            
            let resolvedStaffId = staffCode || null;
            // The problematic logic:
            if (!resolvedStaffId || (isNaN(resolvedStaffId) && !/^[A-Z]\d+/.test(resolvedStaffId))) {
                 console.log('Entering fallback for:', resolvedStaffId);
            } else {
                 console.log('Keeping staffId:', resolvedStaffId);
            }
        });
    });
}

scrapeMock(html);
