import mongoose from 'mongoose';
import ExcelJS from 'exceljs';

const mongoURI = 'mongodb://127.0.0.1:27017/kshf_hospital_app';

const ka = ['ក.១.១', 'ក.១.២', 'ក.១.៣', 'ក.១.៤', 'ក.១.五', 'ក.១.៦', 'ក.២.១', 'ក.២.២', 'ក.២.៣', 'ក.២.៤', 'ក.៣.១', 'ក.៣.២', 'ក.៣.៣', 'ក.៣.៤'];
const kha = ['ខ.១.១', 'ខ.១.២', 'ខ.១.៣', 'ខ.១.៤', 'ខ.១.៥', 'ខ.១.៦', 'ខ.២.១', 'ខ.២.២', 'ខ.២.៣', 'ខ.២.៤', 'ខ.៣.១', 'ខ.៣.២', 'ខ.៣.៣', 'ខ.៣.៤'];
const ko = ['គ.១', 'គ.២', 'គ.៣', 'គ.៤', 'គ.៥', 'គ.៦', 'គ.៧', 'គ.៨', 'គ.៩', 'គ.១០'];

function demoteLevel(lvl) {
  if (!lvl) return '';
  const s = lvl.trim();
  let idx = ka.indexOf(s);
  if (idx !== -1 && idx < ka.length - 1) return ka[idx + 1];
  idx = kha.indexOf(s);
  if (idx !== -1 && idx < kha.length - 1) return kha[idx + 1];
  idx = ko.indexOf(s);
  if (idx !== -1 && idx < ko.length - 1) return ko[idx + 1];
  return s;
}

function getEmployeeCategory(emp) {
  const ot = (emp.officerType || '').toString().trim();
  if (ot.includes('រាជការ') || ot.includes('ក្របខណ្ឌ')) {
    return 'civil';
  }
  if (ot.includes('កិច្ចសន្យារដ្ឋ') || ot === 'កិច្ចសន្យា') {
    return 'contract_state';
  }
  return 'floating'; // 'អណ្ដែត'
}

async function main() {
  try {
    await mongoose.connect(mongoURI);
    const db = mongoose.connection.db;
    const hrs = db.collection('hrs');
    
    // 1. Get active employees
    const allEmployees = await hrs.find({
      status: { $ne: 'Inactive' }
    }).toArray();
    
    const activeEmployees = allEmployees.filter(emp => {
      const st = (emp.status || '').toString().toLowerCase();
      if (st === 'deleted' || st === 'resigned' || st === 'retired') return false;
      const hasResign = !!(
        emp.resignDate || emp.resignReason || emp.resignationDate || emp.resignationReason ||
        emp.dateRemoved || emp.dateRemovedFromDataset || emp.removalDate ||
        (emp.delisted && (emp.delisted.dateRemoved || emp.delisted.date_removed))
      );
      return !hasResign;
    });

    console.log('Total active employees in DB:', activeEmployees.length);
    
    // 2. Count for 2025 and 2026 by salaryLevel / category
    const counts2025 = {};
    const counts2026 = {};
    
    activeEmployees.forEach(emp => {
      const cat = getEmployeeCategory(emp);
      
      if (cat === 'civil') {
        const lvl = (emp.salaryLevel || '').toString().trim();
        if (!lvl) return;
        
        let lvl2025 = lvl;
        let lvl2026 = lvl;
        
        if (emp.salaryPromotionDate) {
          const promoYear = new Date(emp.salaryPromotionDate).getFullYear();
          if (promoYear === 2026) {
            lvl2025 = demoteLevel(lvl);
          }
        }
        
        counts2025[lvl2025] = (counts2025[lvl2025] || 0) + 1;
        counts2026[lvl2026] = (counts2026[lvl2026] || 0) + 1;
      } else if (cat === 'contract_state') {
        counts2025['កិច្ចសន្យា'] = (counts2025['កិច្ចសន្យា'] || 0) + 1;
        counts2026['កិច្ចសន្យា'] = (counts2026['កិច្ចសន្យា'] || 0) + 1;
      } else {
        counts2025['អណ្ដែត'] = (counts2025['អណ្ដែត'] || 0) + 1;
        counts2026['អណ្ដែត'] = (counts2026['អណ្ដែត'] || 0) + 1;
      }
    });
    
    // 3. Load Excel template
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦.xlsx');
    const sheet = workbook.getWorksheet('គម្រោងថវិការ');
    
    // Rows to update
    const leafRowMapping = {
      // ក.១
      13: 'ក.១.១', 14: 'ក.១.២', 15: 'ក.១.៣', 16: 'ក.១.៤', 17: 'ក.១.៥', 18: 'ក.១.៦',
      // ក.២
      20: 'ក.២.១', 21: 'ក.២.២', 22: 'ក.២.៣', 23: 'ក.២.៤',
      // ក.៣
      25: 'ក.៣.១', 26: 'ក.៣.២', 27: 'ក.៣.៣', 28: 'ក.៣.៤',
      // ខ.១
      31: 'ខ.១.១', 32: 'ខ.១.២', 33: 'ខ.១.៣', 34: 'ខ.១.៤', 35: 'ខ.១.៥', 36: 'ខ.១.៦',
      // ខ.២
      38: 'ខ.២.១', 39: 'ខ.២.២', 40: 'ខ.២.៣', 41: 'ខ.២.៤',
      // ខ.៣
      43: 'ខ.៣.១', 44: 'ខ.៣.២', 45: 'ខ.៣.៣', 46: 'ខ.៣.៤',
      // គ
      48: 'គ.១', 49: 'គ.២', 50: 'គ.៣', 51: 'គ.៤', 52: 'គ.៥', 53: 'គ.៦', 54: 'គ.៧', 55: 'គ.៨', 56: 'គ.៩', 57: 'គ.១០',
      // បុគ្គលិកមិនអចិន្ត្រៃយ៍
      59: 'កិច្ចសន្យា', 60: 'អណ្ដែត'
    };
    
    // First, read template values and compute rates before modifying the sheet
    const leafRates = {};
    Object.keys(leafRowMapping).forEach(rNoKey => {
      const rNo = Number(rNoKey);
      const row = sheet.getRow(rNo);
      const tempCount26 = Number(row.getCell(4).value) || 0; // Col D is 4
      
      leafRates[rNo] = {};
      for (let colIdx = 6; colIdx <= 16; colIdx++) {
        const tempVal = Number(row.getCell(colIdx).value) || 0;
        leafRates[rNo][colIdx] = tempCount26 > 0 ? (tempVal / tempCount26) : 0;
      }
    });
    
    // Now apply updates to Leaf rows
    Object.keys(leafRowMapping).forEach(rNoKey => {
      const rNo = Number(rNoKey);
      const code = leafRowMapping[rNoKey];
      const row = sheet.getRow(rNo);
      
      const count25 = counts2025[code] || 0;
      const count26 = counts2026[code] || 0;
      
      row.getCell(3).value = count25; // Col C is 3
      row.getCell(4).value = count26; // Col D is 4
      
      let rowTotal = 0;
      for (let colIdx = 6; colIdx <= 16; colIdx++) {
        const cell = row.getCell(colIdx);
        const rate = leafRates[rNo][colIdx] || 0;
        const newVal = Math.round(rate * count26);
        cell.value = newVal;
        rowTotal += newVal;
      }
      row.getCell(5).value = rowTotal; // Col E is 5 (Total Amount)
    });
    
    // Sum function for parent rows
    function sumRows(targetRowNo, sourceRowNos) {
      const targetRow = sheet.getRow(targetRowNo);
      let count25 = 0;
      let count26 = 0;
      let moneyCols = Array(12).fill(0); // Col 5 to 16
      
      sourceRowNos.forEach(rNo => {
        const r = sheet.getRow(rNo);
        count25 += Number(r.getCell(3).value) || 0;
        count26 += Number(r.getCell(4).value) || 0;
        for (let colIdx = 5; colIdx <= 16; colIdx++) {
          moneyCols[colIdx - 5] += Number(r.getCell(colIdx).value) || 0;
        }
      });
      
      targetRow.getCell(3).value = count25;
      targetRow.getCell(4).value = count26;
      for (let colIdx = 5; colIdx <= 16; colIdx++) {
        targetRow.getCell(colIdx).value = moneyCols[colIdx - 5];
      }
    }
    
    // Perform summations bottom-up
    // 1. Sub-totals for ក
    sumRows(12, [13, 14, 15, 16, 17, 18]); // ក.១
    sumRows(19, [20, 21, 22, 23]);         // ក.២
    sumRows(24, [25, 26, 27, 28]);         // ក.៣
    sumRows(11, [12, 19, 24]);             // សរុប ក
    
    // 2. Sub-totals for ខ
    sumRows(30, [31, 32, 33, 34, 35, 36]); // ខ.១
    sumRows(37, [38, 39, 40, 41]);         // ខ.២
    sumRows(42, [43, 44, 45, 46]);         // ខ.៣
    sumRows(29, [30, 37, 42]);             // សរុប ខ
    
    // 3. Sub-totals for គ
    sumRows(47, [48, 49, 50, 51, 52, 53, 54, 55, 56, 57]); // សរុប គ
    
    // 4. Grand totals
    sumRows(10, [11, 29, 47]);             // បុគ្គលិកអចិន្ត្រៃយ៍
    sumRows(58, [59, 60]);                 // បុគ្គលិកមិនអចិន្ត្រៃយ៍
    sumRows(9, [10, 58]);                  // សរុបរួម
    
    // Save to file
    await workbook.xlsx.writeFile('D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦_updated.xlsx');
    console.log('Successfully generated D:\\Gitdb\\គម្រោងថវិកាឆ្នាំ២០២៦_updated.xlsx!');
    
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}
main();
