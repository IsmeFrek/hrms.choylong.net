import axios from 'axios';
import AttendanceDailyReport from '../models/AttendanceDailyReport.js';
import HR from '../models/HR.js';
import ReportSetting from '../models/ReportSetting.js';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxMeoZRsZDu-bD94AX9oXY3gIv8_TJzPqBZRXwErk36Ov9C12wXaIhV53O2OgF9mIEOrw/exec";

/**
 * Formats a date as (DD/MM/YYYY) for Google Sheets
 */
function formatSheetDate(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `(${dd}/${mm}/${yyyy})`;
}

/**
 * Formats gender to short Khmer version
 */
function fmtGender(g) {
  const v = String(g || '').toLowerCase().trim();
  if (v === 'male' || v === 'm' || v === 'ប្រុស') return 'ប';
  if (v === 'female' || v === 'f' || v === 'ស្រី') return 'ស';
  return g;
}

/**
 * Main function to sync attendance data to Google Sheets
 */
export async function syncAttendanceToGoogleSheets(targetDate = null) {
  try {
    // 1. Check if enabled
    const settingsDoc = await ReportSetting.find({ groupName: 'attendance_day_sync' }).lean();
    const settings = {};
    settingsDoc.forEach(d => { settings[d.key] = d.value; });

    if (settings.google_sheets_sync_enabled === false) {
      console.log('[GoogleSheetsSync] Disabled in settings.');
      return;
    }

    const date = targetDate ? new Date(targetDate) : new Date();
    date.setHours(0, 0, 0, 0);

    const start = new Date(date);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const dateStr = date.toISOString().slice(0, 10);
    console.log(`[GoogleSheetsSync] Starting sync for ${dateStr}...`);

    // 2. Fetch Daily Reports
    const dailyReports = await AttendanceDailyReport.find({
      date: { $gte: start, $lte: end }
    }).sort({ no: 1, staffId: 1 }).lean();

    if (dailyReports.length === 0) {
      console.log('[GoogleSheetsSync] No daily reports found for this date.');
      return;
    }

    // 3. Fetch HR data for enrichment (position, etc.)
    const hrList = await HR.find({}, 'staffId khmerName name position Department_Kh gender').lean();
    const hrMap = new Map();
    hrList.forEach(h => hrMap.set(String(h.staffId), h));

    // 4. Format Rows (Match AttendanceDayReportPage.jsx default columns)
    // Column order: ល.រ, អត្តលេខ, គោត្តនាម និងនាម, ភេទ, តួនាទី, ម៉ោងត្រូវធ្វើការ, ចូល, ចេញ, មកយឺត, ចេញមុន, ច្បាប់, អវត្តមាន, ផ្នែក, ផ្សេងៗ

    const dataRows = dailyReports.map((rec, idx) => {
      const hr = hrMap.get(String(rec.staffId)) || {};

      const row = [];
      row.push(idx + 1); // ល.រ
      row.push(rec.staffName || hr.khmerName || hr.name || ''); // គោត្តនាម និងនាម
      row.push(fmtGender(hr.gender)); // ភេទ
      row.push(hr.position || ''); // តួនាទី

      row.push(rec.checkin1 || rec.checkIn || ''); // ចូល
      row.push(rec.checkout1 || rec.checkOut || ''); // ចេញ

      row.push(rec.isLate ? 1 : ''); // មកយឺត
      row.push(rec.leftEarly ? 1 : ''); // ចេញមុន

      const leave = (rec.status === 'leave' || rec.leaveType) ? (rec.leaveType || 1) : '';
      row.push(leave); // ច្បាប់

      row.push(rec.status === 'absent' ? 1 : ''); // អវត្តមាន

      // Other logic
      let other = '';
      if (rec.status === 'holiday') other = 'សម្រាក';
      else if (rec.plech) other = 'ភ្លេចស្កេន';
      else if (rec.status === 'absent' && !leave) other = 'អវត្តមាន';
      row.push(other); // ផ្សេងៗ

      row.push(rec.scheduledTime || ''); // ម៉ោងត្រូវធ្វើការ
      row.push(rec.department || hr.Department_Kh || ''); // ផ្នែក
      row.push(rec.staffId || ''); // អត្តលេខ

      return row;
    });

    const headers = [
      'ល.រ', 'គោត្តនាម និងនាម', 'ភេទ', 'តួនាទី', 'ចូល', 'ចេញ',
      'មកយឺត', 'ចេញមុន', 'ច្បាប់', 'អវត្តមាន', 'ផ្សេងៗ', 'ម៉ោងត្រូវធ្វើការ', 'ផ្នែក', 'អត្តលេខ'
    ];

    const sheetName = formatSheetDate(date);

    const payload = {
      sheetName,
      header: headers,
      data: dataRows
    };

    console.log(`[GoogleSheetsSync] POSTing ${dataRows.length} rows to Google Script...`);

    // Use no-cors equivalent or just a standard POST
    // Since it's server-side, we don't have CORS issues
    await axios.post(SCRIPT_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log(`[GoogleSheetsSync] Success! Synced for ${sheetName}`);
    return true;
  } catch (err) {
    console.error('[GoogleSheetsSync] Failed:', err.message);
    if (err.response) {
      console.error('[GoogleSheetsSync] Response data:', err.response.data);
    }
    return false;
  }
}
