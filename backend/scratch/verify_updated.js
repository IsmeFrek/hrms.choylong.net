import ExcelJS from 'exceljs';

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦_updated.xlsx');
  console.log('Sheets in updated:', workbook.worksheets.map(w => w.name));
  
  const sheet = workbook.getWorksheet('គម្រោងថវិការ');
  console.log('Total rows in updated sheet:', sheet.rowCount);
  
  // Print row 9, 10, 11, 12, 13
  for (let r = 9; r <= 15; r++) {
    const row = sheet.getRow(r);
    console.log(`Row ${r}:`, {
      colA: row.getCell(1).value,
      colB: row.getCell(2).value,
      colC: row.getCell(3).value,
      colD: row.getCell(4).value,
      colE: row.getCell(5).value,
      colF: row.getCell(6).value,
    });
  }
}
main();
