import cron from 'node-cron';
import ExcelJS from 'exceljs';
import axios from 'axios';
import FileTransfer from '../models/FileTransfer.js';
import { autoSyncAttendance } from './attendanceSyncService.js';
import { autoSyncLeaves } from './leaveSyncService.js';
import { syncAttendanceToGoogleSheets } from './googleSheetsSyncService.js';
import ReportSetting from '../models/ReportSetting.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to format date
const formatISOToDisplay = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Generate Excel file for today's file transfers
 */
async function generateDailyReport() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch today's records
  const records = await FileTransfer.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  }).sort({ no: 1 });

  if (records.length === 0) {
    console.log('No records found for today. Skipping report.');
    return null;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Today File Transfers');

  // Define columns
  worksheet.columns = [
    { header: 'ល.រ', key: 'no', width: 8 },
    { header: 'ប្រភេទលិខិត', key: 'type', width: 25 },
    { header: 'លេខលិខិត', key: 'letterNo', width: 25 },
    { header: 'កាលបរិច្ឆេទលិខិត', key: 'date', width: 20 },
    { header: 'លេខចូល', key: 'entryNo', width: 15 },
    { header: 'កាលបរិច្ឆេទចូល', key: 'entryDate', width: 20 },
    { header: 'ប្រភពឯកសារ', key: 'source', width: 30 },
    { header: 'ចំនួន', key: 'qty', width: 10 },
    { header: 'ខ្លឹមសារ', key: 'content', width: 50 },
    { header: 'ផ្សេងៗ', key: 'others', width: 30 },
    { header: 'តំណភ្ជាប់', key: 'link', width: 40 } // New Link Column
  ];

  const serverBase = process.env.SERVER_BASE_URL || 'http://localhost:5000';

  // Add rows
  records.forEach((r, index) => {
    const rowData = {
      no: index + 1,
      type: r.type || r.title || '-',
      letterNo: r.letterNo ?? r.letter_no ?? '-',
      date: r.date ? formatISOToDisplay(r.date) : '-',
      entryNo: r.entryNo ?? r.entry_no ?? '-',
      entryDate: r.entryDate ? formatISOToDisplay(r.entryDate) : '-',
      source: r.source ?? r.origin ?? '-',
      qty: r.qty ?? r.count ?? '-',
      content: r.content ?? r.description ?? '-',
      others: r.others || r.notes || '-'
    };

    const row = worksheet.addRow(rowData);

    // Add hyperlink if attachments exist
    if (r.attachments && r.attachments.length > 0) {
      const fileName = r.attachments[0];
      const fileUrl = `${serverBase}/Uploads/${fileName}`;
      row.getCell('link').value = {
        text: 'ចុចទីនេះដើម្បីមើល',
        hyperlink: fileUrl,
        tooltip: 'Click to view file'
      };
      row.getCell('link').font = { underline: true, color: { argb: 'FF0000FF' } };
    } else {
      row.getCell('link').value = '-';
    }
  });

  // Apply styling
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.font = cell.font || {};
      cell.font.name = 'Khmer OS Siemreap';
      cell.font.size = 12;
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: rowNumber === 1 ? 'center' : 'left',
        wrapText: true
      };
      if (rowNumber === 1) {
        cell.font.bold = true;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Send the report to Telegram
 */
async function sendReportToTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_REPORT_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('Telegram bot token or chat ID not configured.');
    return;
  }

  try {
    const buffer = await generateDailyReport();
    if (!buffer) return;

    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const fileName = `Daily_FileTransfer_Report_${dateStr}.xlsx`;
    
    // Create form data using a Buffer
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', buffer, { filename: fileName });
    form.append('caption', `📊 របាយការណ៍បញ្ជូនឯកសារប្រចាំថ្ងៃ (${dateStr})`);

    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendDocument`, form, {
      headers: form.getHeaders(),
    });

    if (response.data.ok) {
      console.log('Daily report sent to Telegram successfully.');
    } else {
      console.error('Failed to send Telegram report:', response.data);
    }
  } catch (err) {
    console.error('Error sending daily report:', err.message);
  }
}

let attendanceSyncJobs = [];
let leaveSyncJobs = [];
let googleSheetsSyncJobs = [];

/**
 * Schedule or re-schedule the attendance sync job based on DB settings
 */
export async function scheduleAttendanceSync() {
  try {
    const docs = await ReportSetting.find({ groupName: 'attendance_sync' }).lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    
    // Support both single sync_time (legacy) and sync_times array
    let times = settings.sync_times;
    if (!Array.isArray(times)) {
      times = [settings.sync_time || '09:35'];
    }
    
    const enabled = typeof settings.auto_sync_enabled !== 'undefined' ? settings.auto_sync_enabled : true;

    // Stop all existing jobs
    attendanceSyncJobs.forEach(job => job.stop());
    attendanceSyncJobs = [];

    if (!enabled) {
      console.log('[AutoSync] Attendance sync is currently disabled in settings.');
      return;
    }

    times.forEach(time => {
      if (!time) return;
      const parts = time.split(':');
      const hour = parts[0] || '00';
      const minute = parts[1] || '00';
      const cronExpression = `${minute} ${hour} * * *`;

      const job = cron.schedule(cronExpression, () => {
        console.log(`[AutoSync] Executing scheduled attendance sync at ${time}...`);
        autoSyncAttendance();
      }, {
        timezone: "Asia/Phnom_Penh"
      });
      attendanceSyncJobs.push(job);
    });

    console.log(`[AutoSync] Attendance sync scheduled at times: ${times.join(', ')} Asia/Phnom_Penh`);
  } catch (err) {
    console.error('[AutoSync] Error scheduling jobs:', err.message);
    if (attendanceSyncJobs.length === 0) {
      const job = cron.schedule('35 9 * * *', () => autoSyncAttendance(), { timezone: "Asia/Phnom_Penh" });
      attendanceSyncJobs.push(job);
    }
  }
}

/**
 * Schedule or re-schedule the leave sync job based on DB settings
 */
export async function scheduleLeaveSync() {
  try {
    const docs = await ReportSetting.find({ groupName: 'leave_sync' }).lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    
    // Support both single sync_time (legacy) and sync_times array
    let times = settings.sync_times;
    if (!Array.isArray(times)) {
      times = [settings.sync_time || '09:40'];
    }
    
    const enabled = typeof settings.auto_sync_enabled !== 'undefined' ? settings.auto_sync_enabled : true;

    // Stop all existing jobs
    leaveSyncJobs.forEach(job => job.stop());
    leaveSyncJobs = [];

    if (!enabled) {
      console.log('[AutoSyncLeaves] Leave sync is currently disabled in settings.');
      return;
    }

    times.forEach(time => {
      if (!time) return;
      const parts = time.split(':');
      const hour = parts[0] || '00';
      const minute = parts[1] || '00';
      const cronExpression = `${minute} ${hour} * * *`;

      const job = cron.schedule(cronExpression, () => {
        console.log(`[AutoSyncLeaves] Executing scheduled leave sync at ${time}...`);
        autoSyncLeaves();
      }, {
        timezone: "Asia/Phnom_Penh"
      });
      leaveSyncJobs.push(job);
    });

    console.log(`[AutoSyncLeaves] Leave sync scheduled at times: ${times.join(', ')} Asia/Phnom_Penh`);
  } catch (err) {
    console.error('[AutoSyncLeaves] Error scheduling jobs:', err.message);
    if (leaveSyncJobs.length === 0) {
      const job = cron.schedule('40 9 * * *', () => autoSyncLeaves(), { timezone: "Asia/Phnom_Penh" });
      leaveSyncJobs.push(job);
    }
  }
}

/**
 * Schedule or re-schedule the Google Sheets sync job based on DB settings
 */
export async function scheduleGoogleSheetsSync() {
  try {
    const docs = await ReportSetting.find({ groupName: 'attendance_day_sync' }).lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    
    let times = settings.google_sheets_sync_times;
    if (!Array.isArray(times)) {
      times = [settings.google_sheets_sync_time || '10:00'];
    }
    
    const enabled = typeof settings.google_sheets_sync_enabled !== 'undefined' ? settings.google_sheets_sync_enabled : false;

    // Stop all existing jobs
    googleSheetsSyncJobs.forEach(job => job.stop());
    googleSheetsSyncJobs = [];

    if (!enabled) {
      console.log('[GoogleSheetsSync] Sync is currently disabled in settings.');
      return;
    }

    times.forEach(time => {
      if (!time) return;
      const parts = time.split(':');
      const hour = parts[0] || '00';
      const minute = parts[1] || '00';
      const cronExpression = `${minute} ${hour} * * *`;

      const job = cron.schedule(cronExpression, () => {
        console.log(`[GoogleSheetsSync] Executing scheduled sync at ${time}...`);
        syncAttendanceToGoogleSheets();
      }, {
        timezone: "Asia/Phnom_Penh"
      });
      googleSheetsSyncJobs.push(job);
    });

    console.log(`[GoogleSheetsSync] Scheduled at times: ${times.join(', ')} Asia/Phnom_Penh`);
  } catch (err) {
    console.error('[GoogleSheetsSync] Error scheduling jobs:', err.message);
  }
}

/**
 * Initialize all cron jobs
 */
export function initCronJobs() {
  // Schedule: 0 21 * * * (9:00 PM every day)
  cron.schedule('0 21 * * *', () => {
    console.log('Running daily File Transfer report job at 9:00 PM...');
    sendReportToTelegram();
  }, {
    timezone: "Asia/Phnom_Penh"
  });

  // Dynamic Sync Jobs
  scheduleAttendanceSync();
  scheduleLeaveSync();
  scheduleGoogleSheetsSync();

  console.log('Cron jobs initialized: Daily report at 21:00 (Asia/Phnom_Penh)');
}

// Export for manual testing via an API
export { sendReportToTelegram };
