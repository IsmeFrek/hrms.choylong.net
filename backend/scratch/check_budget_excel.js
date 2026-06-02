import XLSX from 'xlsx';

try {
  const filePath = 'D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx';
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet names:', workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Sheet "${sheetName}" has ${rows.length} rows.`);
    console.log('First 15 rows of data:');
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      console.log(`Row ${i + 1}:`, rows[i]);
    }
  }
} catch (e) {
  console.error(e);
}
