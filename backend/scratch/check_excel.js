import XLSX from 'xlsx';

try {
  const filePath = 'D:\\Gitdb\\skill.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log('Total rows:', rows.length);
  
  // Look for S0099
  const row = rows.find(r => {
    const id = r['staffId'] || r['Staff ID'] || r['StaffID'] || '';
    return String(id).trim().toUpperCase() === 'S0099';
  });

  if (row) {
    console.log('Found S0099:');
    console.log(row);
  } else {
    console.log('S0099 not found in excel file.');
  }

} catch (e) {
  console.error(e);
}
