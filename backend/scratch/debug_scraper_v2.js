import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('daily_report_debug.html', 'utf8');
const $ = cheerio.load(html);

$('table').each((tIdx, tbl) => {
  const $tbl = $(tbl);
  const prevText = (
    $tbl.closest('.box').find('.box-title').text().toLowerCase() || 
    $tbl.prev().text().toLowerCase() || 
    $tbl.parent().prev().text().toLowerCase() || 
    ''
  ).trim();

  let isRequestLeaveTable = prevText.includes('leave') || prevText.includes('ច្បាប់');
  if (!isRequestLeaveTable) return;

  console.log(`[Test] Table ${tIdx} identified as Request Leave. PrevText: "${prevText}"`);

  let colIdx = {
      staffCode: 1, 
      name: 2,
      type: 5,
      reason: 6
  };

  const rows = $tbl.find('tbody tr');
  console.log(`[Test] Found ${rows.length} rows in Table ${tIdx}`);
  
  rows.each((i, tr) => {
    const $tds = $(tr).find('td');
    const tdsText = $tds.map((j, td) => $(td).text().trim()).get();

    console.log(`[Row ${i}] Cols: ${JSON.stringify(tdsText)}`);
  });
});
