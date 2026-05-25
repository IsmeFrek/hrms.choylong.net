import ExcelJS from 'exceljs';

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx');
  const sheet = workbook.getWorksheet('គម្រោងថវិការ');
  
  sheet.eachRow((row, rowNumber) => {
    const colA = row.getCell(1).value;
    const colB = row.getCell(2).value;
    if (colA || colB) {
      console.log(`Row ${rowNumber}: Col A = "${colA || ''}", Col B = "${colB || ''}"`);
    }
  });
}
main();
