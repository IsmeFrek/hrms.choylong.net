import XLSX from 'xlsx';
import fs from 'fs';

try {
  const filePath = 'D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['គម្រោងថវិការ'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  fs.writeFileSync('backend/scratch/budget_dump.json', JSON.stringify(rows, null, 2), 'utf-8');
  console.log('Successfully written to JSON file!');
} catch (e) {
  console.error(e);
}
