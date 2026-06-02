import XLSX from 'xlsx';

try {
  const filePath = 'D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['គម្រោងថវិការ'];
  
  // Find a cell that might have a formula, like E9, E10, etc.
  // E is col 5 (index 4)
  console.log('Cell E9:', sheet['E9']);
  console.log('Cell F9:', sheet['F9']);
  console.log('Cell G9:', sheet['G9']);
  console.log('Cell E12:', sheet['E12']);
  console.log('Cell F12:', sheet['F12']);
  
  // Print some cells with formula
  for (const key in sheet) {
    if (sheet[key] && sheet[key].f) {
      console.log(`Cell ${key} has formula: ${sheet[key].f}, value: ${sheet[key].v}`);
    }
  }
} catch (e) {
  console.error(e);
}
