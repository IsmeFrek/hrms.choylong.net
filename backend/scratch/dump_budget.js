import XLSX from 'xlsx';

try {
  const filePath = 'D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['គម្រោងថវិការ'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  rows.forEach((row, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(row));
  });
} catch (e) {
  console.error(e);
}
