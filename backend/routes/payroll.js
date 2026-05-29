import express from 'express';
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const filePath = 'D:\\Gitdb\\PAYROLL_MOH_CENTRAL_April2026.xlsx';
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'រកមិនឃើញឯកសារ Excel ទេ (File not found)' });
    }

    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    
    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to 2D Array
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    res.json({
      data,
      filename: path.basename(filePath)
    });
  } catch (error) {
    console.error('Error reading payroll excel:', error);
    res.status(500).json({ error: 'Failed to read excel file' });
  }
});

router.post('/save', async (req, res) => {
  try {
    const { edits } = req.body;
    const filePath = 'D:\\Gitdb\\PAYROLL_MOH_CENTRAL_April2026.xlsx';
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Excel file not found.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Apply edits
    if (edits) {
      for (const [key, value] of Object.entries(edits)) {
        const [rowStr, colStr] = key.split('-');
        // exceljs is 1-based index
        const row = parseInt(rowStr) + 1;
        const col = parseInt(colStr) + 1;
        
        const cell = worksheet.getCell(row, col);
        cell.value = value;
      }
    }

    await workbook.xlsx.writeFile(filePath);

    res.json({ message: 'Saved successfully' });
  } catch (error) {
    console.error('Error saving excel:', error);
    res.status(500).json({ error: 'Failed to save excel file' });
  }
});

export default router;
