// Simple importer test script
// Usage: node tools/test-import.js <path-to-xlsx>
import fs from 'fs';
import * as XLSX from 'xlsx';

const argv = process.argv.slice(2);
if (!argv[0]) {
  console.error('Usage: node tools/test-import.js <file.xlsx>');
  process.exit(1);
}
const file = argv[0];
if (!fs.existsSync(file)) { console.error('File not found:', file); process.exit(1); }
const data = fs.readFileSync(file);
const wb = XLSX.read(data, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sheet, { header:1, defval: '' });
if (!raw || !raw.length) { console.error('No rows found'); process.exit(1); }
let headerRowIdx = raw.findIndex(row => Array.isArray(row) && row.some(cell => {
  const s = String(cell||'').toLowerCase();
  return /លេខកាត/.test(s) || /staff\s*id/.test(s) || /card/.test(s) || /staffid/.test(s);
}));
if (headerRowIdx === -1) headerRowIdx = 0;
let headerRowsCount = 1;
const nextRow = raw[headerRowIdx + 1];
if (Array.isArray(nextRow)) {
  const nonEmptyCells = nextRow.filter(c => String(c||'').toString().trim() !== '');
  if (nonEmptyCells.length >= 3) {
    const headerLikeCount = nonEmptyCells.filter(c => {
      const s = String(c).trim();
      if (/[A-Za-z\u1780-\u17FF]/.test(s)) return true;
      if (/\s|-/.test(s) && s.length > 1 && !/^\d+$/.test(s)) return true;
      return false;
    }).length;
    if (headerLikeCount >= Math.ceil(nonEmptyCells.length / 2)) headerRowsCount = 2;
  }
}
const maxCols = Math.max(...raw.slice(headerRowIdx, headerRowIdx + headerRowsCount).map(r => r.length));
const headers = [];
for (let c = 0; c < maxCols; c++) {
  const parts = [];
  for (let r = 0; r < headerRowsCount; r++) {
    const v = raw[headerRowIdx + r] && raw[headerRowIdx + r][c] ? String(raw[headerRowIdx + r][c]).trim() : '';
    if (v) parts.push(v);
  }
  headers.push(parts.join(' ').trim() || `col${c}`);
}
let dataRows = raw.slice(headerRowIdx + headerRowsCount);

// If headers themselves contain embedded values (e.g. "Staff ID E001"),
// split them into label + value and treat the values as the first data row.
const headerContainsValue = headers.some(h => /\d|\d{1,2}:\d{2}/.test(String(h)));
if (headerContainsValue) {
  const splitLabels = [];
  const firstRowValues = [];
  let foundAny = false;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '');
      // prefer known header prefixes (longest match) to split label vs value
      const candidates = ['staff id','staff','card','name','check in','check out','checkin','checkout','status','note','notes','លេខកាត','ចូល','ចេញ'];
      candidates.sort((a,b) => b.length - a.length);
      const lower = h.toLowerCase();
      let matched = null;
      for (const c of candidates) {
        if (lower.startsWith(c)) { matched = c; break; }
      }
      if (matched) {
        const label = h.substring(0, matched.length).trim();
        const value = h.substring(matched.length).trim();
        splitLabels.push(label || matched);
        firstRowValues.push(value);
        if (value) foundAny = true;
      } else {
        // fallback: split by last space so "Name John Doe" -> ['Name', 'John Doe']
        const m = h.match(/^(.*\S)\s+(\S.*)$/);
        if (m) {
          splitLabels.push(m[1].trim());
          firstRowValues.push(m[2]);
          foundAny = true;
        } else {
          splitLabels.push(h);
          firstRowValues.push('');
        }
      }
  }
  if (foundAny) {
    // replace headers with cleaned labels and prepend firstRowValues
    headers.splice(0, headers.length, ...splitLabels);
    dataRows = [firstRowValues, ...dataRows];
  }
}

const rows = dataRows.map(r => {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ''; });
  return obj;
});
console.log('Detected headers:', headers);
console.log('First 5 parsed rows:');
console.log(rows.slice(0,5));

// exit
process.exit(0);
