import mongoose from 'mongoose';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import Employee from '../models/Employee.js';

async function importSkills() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Please provide the path to the Excel file as an argument.');
    console.error('Example: node import_skills.js "path/to/excel.xlsx"');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected.');

    console.log(`Reading Excel file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      console.error('Excel file is empty or could not be parsed.');
      process.exit(1);
    }

    let updatedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    for (const [index, row] of rows.entries()) {
      const staffId = row['staffId'] || row['Staff ID'] || row['StaffID'] || '';
      const ministrySkill = row['Ministry Skills'] || row['ministrySkill'] || '';
      const ksfhSkillOther = row['KSFH Skills other'] || row['ksfhSkillOther'] || '';

      if (!staffId) {
        console.warn(`Row ${index + 2}: Missing staffId, skipping...`);
        continue;
      }

      try {
        const updateData = {};
        if (ministrySkill !== '') updateData.civilServantRole = ministrySkill;
        if (ksfhSkillOther !== '') updateData.skill = ksfhSkillOther;

        if (Object.keys(updateData).length === 0) {
            console.log(`Row ${index + 2}: No skills provided for staffId ${staffId}, skipping.`);
            continue;
        }

        const result = await Employee.updateOne(
          { staffId: String(staffId).trim() },
          { $set: updateData }
        );

        if (result.matchedCount > 0) {
          updatedCount++;
          console.log(`Updated skills for staffId: ${staffId}`);
        } else {
          notFoundCount++;
          console.warn(`Staff ID not found: ${staffId}`);
        }
      } catch (err) {
        errorCount++;
        console.error(`Error updating staffId ${staffId}:`, err.message);
      }
    }

    console.log('--- Import Summary ---');
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Staff IDs not found: ${notFoundCount}`);
    console.log(`Errors: ${errorCount}`);

    process.exit(0);
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

importSkills();
