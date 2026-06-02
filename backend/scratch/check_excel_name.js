import XLSX from 'xlsx';

try {
  const filePath = 'D:\\Gitdb\\skill.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // Look for ណុល សុផាន់ណា
  const row = rows.find(r => {
    return Object.values(r).some(v => String(v).includes('ណុល សុផាន់ណា'));
  });

  if (row) {
    console.log('Found ណុល សុផាន់ណា:');
    console.log('ID:', row['staffId'] || row['Staff ID'] || row['StaffID'] || row['ID']);
    console.log('KSFH Skill:', row['KSFH Skills other'] || row['ksfhSkillOther']);
  } else {
    console.log('ណុល សុផាន់ណា not found in excel file by name.');
  }

} catch (e) {
  console.error(e);
}
