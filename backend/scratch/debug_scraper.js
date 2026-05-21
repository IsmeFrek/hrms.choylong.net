import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

function normalizeKhmer(str) {
  if (!str) return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const html = fs.readFileSync('daily_report_debug.html', 'utf8');
const $ = cheerio.load(html);

const items = [];

$('table').each((tIdx, tbl) => {
  const $tbl = $(tbl);
  const prevText = (
    $tbl.closest('.box').find('.box-title').text().toLowerCase() || 
    $tbl.prev().text().toLowerCase() || 
    $tbl.parent().prev().text().toLowerCase() || 
    ''
  ).trim();

  let isAbsentTable = prevText.includes('absent') || prevText.includes('អវត្តមាន');
  let isHolidayTable = !isAbsentTable && (prevText.includes('holiday') || prevText.includes('សម្រាក') || prevText.includes('day off') || prevText.includes('dayoff'));
  let isRequestLeaveTable = !isAbsentTable && !isHolidayTable && (prevText.includes('leave') || prevText.includes('ច្បាប់'));
  
  if (isRequestLeaveTable) console.log(`[Test] Table ${tIdx} identified as Request Leave`);

  let colIdx = {
    staffCode: -1,
    name: -1,
    type: -1,
    reason: -1,
    statusCol: -1
  };

  const virtualHeader = [];
  $tbl.find('thead tr').each((rIdx, tr) => {
    let currentCol = 0;
    $(tr).find('th, td').each((i, el) => {
      const txt = $(el).text().trim().toLowerCase();
      const colSpan = parseInt($(el).attr('colspan') || '1');
      const rowSpan = parseInt($(el).attr('rowspan') || '1');
      while (virtualHeader[rIdx] && virtualHeader[rIdx][currentCol]) currentCol++;
      for (let r = 0; r < rowSpan; r++) {
        if (!virtualHeader[rIdx + r]) virtualHeader[rIdx + r] = [];
        for (let c = 0; c < colSpan; c++) virtualHeader[rIdx + r][currentCol + c] = txt;
      }
      currentCol += colSpan;
    });
  });

  if (virtualHeader.length > 0) {
    const columnCount = virtualHeader[0].length;
    for (let c = 0; c < columnCount; c++) {
      const labels = virtualHeader.map(row => row[c] || '').join(' ').toLowerCase();
      if ((labels.includes('staff id') || labels.includes('អត្តលេខ')) && colIdx.staffCode === -1) colIdx.staffCode = c;
      if ((labels.includes('name') || labels.includes('ឈ្មោះ')) && colIdx.name === -1) colIdx.name = c;
      if ((labels.includes('type') || labels.includes('ប្រភេទ')) && colIdx.type === -1) colIdx.type = c;
      if ((labels.includes('reason') || labels.includes('មូលហេតុ')) && colIdx.reason === -1) colIdx.reason = c;
    }
  }

  // Override check
  const headText = $tbl.find('thead').text();
  const hasSid = headText.includes('STAFF ID') || headText.includes('អត្តលេខ');
  const hasName = headText.includes('NAME') || headText.includes('ឈ្មោះ');
  const hasReason = headText.includes('REASON') || headText.includes('មូលហេតុ') || headText.includes('TYPE') || headText.includes('ប្រភេទ');

  if (isRequestLeaveTable && hasSid && hasName && hasReason) {
      colIdx.staffCode = 1; 
      colIdx.name = 2;
      colIdx.type = 5;
      colIdx.reason = 6;
  }

  const rows = $tbl.find('tbody tr');
  rows.each((i, tr) => {
    const $tds = $(tr).find('td');
    const tdsText = [];
    $tds.each((j, td) => {
      const h = $(td).html() || '';
      const lines = h.split(/<br\s*\/?>/i).map(l => l.replace(/<[^>]*>?/gm, '').trim());
      tdsText.push(lines[0] || '');
    });

    const staffId = colIdx.staffCode !== -1 ? tdsText[colIdx.staffCode] : '';
    const empName = colIdx.name !== -1 ? tdsText[colIdx.name] : '';
    
    if (staffId === 'W0032') {
      console.log(`[Test] Row W0032 found in Table ${tIdx}`);
      console.log(`[Test] ColIndices:`, colIdx);
      console.log(`[Test] Type Index ${colIdx.type} Text: "${tdsText[colIdx.type]}"`);
      console.log(`[Test] Reason Index ${colIdx.reason} Text: "${tdsText[colIdx.reason]}"`);
    }
  });
});
