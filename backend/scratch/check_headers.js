import XLSX from 'xlsx';

try {
  const filePath = 'D:\\Gitdb\\skill.xlsx';
  const workbook = XLSX.readFile(filePath, { sheetRows: 5 }); // Only read top 5 rows
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log('Headers from first few rows:', Object.keys(rows[0] || {}));
  console.log('Sample Row 0:', rows[0]);
} catch (e) {
  console.error(e);
}
