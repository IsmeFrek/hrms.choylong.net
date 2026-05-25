import mongoose from 'mongoose';
import XLSX from 'xlsx';

const mongoURI = 'mongodb://127.0.0.1:27017/kshf_hospital_app';

async function main() {
  try {
    await mongoose.connect(mongoURI);
    const db = mongoose.connection.db;
    const hrs = db.collection('hrs');
    
    // Load Excel template to get its structure
    const workbook = XLSX.readFile('D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx');
    const sheet = workbook.Sheets['គម្រោងថវិការ'];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('--- COMPARING COUNTS ---');
    
    // We want to count active civil servants in the DB for each salaryLevel
    // Active civil servant means: status !== 'Inactive' and officerType === 'មន្រ្តីរាជការ' or status is empty/Active
    // Let's get counts of active employees by salaryLevel
    const activeCivilServants = await hrs.find({
      status: { $ne: 'Inactive' },
      // officerType: 'មន្រ្តីរាជការ'
    }).toArray();
    
    console.log('Total active in DB:', activeCivilServants.length);
    
    // Let's count by salaryLevel
    const dbCounts = {};
    activeCivilServants.forEach(emp => {
      const lvl = (emp.salaryLevel || '').toString().trim();
      if (lvl) {
        dbCounts[lvl] = (dbCounts[lvl] || 0) + 1;
      }
    });
    
    console.log('DB Counts by Salary Level:', dbCounts);
    
    // Let's scan the Excel rows and look at columns:
    // Col 1 (index 1): scale code (like 'ក.១.១')
    // Col 2 (index 2): 2025 Count from Excel
    // Col 3 (index 3): 2026 Count from Excel
    rows.forEach((row, i) => {
      const code = row[1];
      if (code && typeof code === 'string' && (code.startsWith('ក') || code.startsWith('ខ') || code.startsWith('គ'))) {
        const xlCount2025 = row[2];
        const xlCount2026 = row[3];
        const dbCount = dbCounts[code] || 0;
        console.log(`Row ${i+1} [${code}]: Excel 2025 = ${xlCount2025}, Excel 2026 = ${xlCount2026}, DB Active = ${dbCount}`);
      }
    });
    
    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
}

main();
