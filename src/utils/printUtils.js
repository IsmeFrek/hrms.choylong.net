import { API_BASE } from '../config';

/**
 * Print utilities for handling different types of document printing
 */

/**
 * Open a dedicated print-only window for a file transfer document
 * @param {string} recordId - The file transfer record ID
 * @param {Object} options - Print options
 * @param {number} options.fontSize - Font size for print
 * @param {number} options.lineHeight - Line height for print
 * @param {boolean} options.autoprint - Whether to auto-trigger print dialog
 * @param {string} options.windowFeatures - Window features for popup
 */
export const openPrintSheet = (recordId, options = {}) => {
  if (!recordId) {
    console.error('Record ID is required for printing');
    return;
  }

  const {
    fontSize = 14,
    lineHeight = 1.6,
    autoprint = true,
    windowFeatures = 'width=1000,height=800,scrollbars=yes,resizable=yes,menubar=no,toolbar=no'
  } = options;

  const url = `${API_BASE}/file-transfers/${recordId}/print-sheet?fontSize=${fontSize}&lineHeight=${lineHeight}&autoprint=${autoprint}`;

  const printWindow = window.open(url, 'printSheet', windowFeatures);

  if (!printWindow) {
    alert('សូមអនុញ្ញាតការបើកផ្ទាំងថ្មីសម្រាប់ការព្រីន');
    return;
  }

  // Focus the print window
  printWindow.focus();

  return printWindow;
};

/**
 * Get print-optimized data for a file transfer
 * @param {string} recordId - The file transfer record ID
 * @returns {Promise<Object>} Print data
 */
export const getPrintData = async (recordId) => {
  if (!recordId) {
    throw new Error('Record ID is required');
  }

  try {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/file-transfers/${recordId}/print-data`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch print data: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching print data:', error);
    throw error;
  }
};

/**
 * Generate a printable HTML string from file transfer data
 * @param {Object} data - File transfer data
 * @param {Object} styles - Custom styles for print
 * @returns {string} HTML string ready for print
 */
export const generatePrintHTML = (data, styles = {}) => {
  const {
    fontSize = 14,
    lineHeight = 1.6,
    fontFamily = "'Khmer OS Siemreap', 'Inter', Arial, sans-serif"
  } = styles;
  const entryTimestampParts = [];
  if (data.entryDate) entryTimestampParts.push(data.entryDate);
  if (data.entryTime) entryTimestampParts.push(data.entryTime);
  const entryTimestamp = entryTimestampParts.join(' | ');
  const creatorDisplay = data.creatorName || 'មិនបានកំណត់';

  return `
<!DOCTYPE html>
<html lang="km">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Print - ${data.title}</title>
    <style>
        @page { size: A4; margin: 10mm 15mm; }
        @media print {
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { 
                width: 100%; 
                height: auto; 
                background: #fff !important; 
                font-family: ${fontFamily} !important;
            }
            .no-print { display: none !important; }
        }
        body {
            font-family: ${fontFamily};
            line-height: ${lineHeight};
            color: #333;
            font-size: ${fontSize}px;
        }
        .sheet {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .field {
            margin: 15px 0;
            display: flex;
        }
        .field .label {
            font-weight: bold;
            min-width: 120px;
            margin-right: 15px;
        }
        .field .value {
            flex: 1;
        }
        .full-width {
            flex-direction: column;
        }
        .full-width .value {
            margin-top: 8px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f9f9f9;
        }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="header">
            <h2>${data.title}</h2>
            <p>លេខឯកសារ: ${data.number} | កាលបរិច្ឆេទ: ${data.date}</p>
        </div>
        
        <div class="field">
            <span class="label">ប្រភេទ:</span>
            <span class="value">${data.type}</span>
        </div>
        
        <div class="field">
            <span class="label">ចេញពី:</span>
            <span class="value">${data.from}</span>
        </div>
        
        <div class="field">
            <span class="label">ទៅកាន់:</span>
            <span class="value">${data.to}</span>
        </div>
        
        <div class="field">
            <span class="label">មុខងារ:</span>
            <span class="value">${data.subject}</span>
        </div>
          <div class="field">
            <span class="label">ថ្ងៃ/ម៉ោងចូល:</span>
            <span class="value">${entryTimestamp || 'មិនបានកំណត់'}</span>
          </div>
          <div class="field">
            <span class="label">អ្នកបង្កើត:</span>
            <span class="value">${creatorDisplay}</span>
          </div>
        
        <div class="field full-width">
            <span class="label">សេចក្តីសង្ខេប:</span>
            <div class="value">${data.summary.replace(/\n/g, '<br>')}</div>
        </div>
        
        ${data.attachments && data.attachments.length > 0 ? `
        <div class="field full-width">
            <span class="label">ឯកសារភ្ជាប់:</span>
            <div class="value">
                ${data.attachments.map(att => `<div>• ${att}</div>`).join('')}
            </div>
        </div>
        ` : ''}
        
        <div style="margin-top: 40px; text-align: right; font-size: 12px; color: #666;">
            បានព្រីននៅ: ${data.printTimestamp}
        </div>
    </div>
</body>
</html>`;
};

/**
 * Print content directly in current window
 * @param {string} htmlContent - HTML content to print
 */
export const printDirectly = (htmlContent) => {
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'absolute';
  printFrame.style.top = '-10000px';
  printFrame.style.left = '-10000px';

  document.body.appendChild(printFrame);

  const printDoc = printFrame.contentDocument || printFrame.contentWindow.document;
  printDoc.open();
  printDoc.write(htmlContent);
  printDoc.close();

  printFrame.contentWindow.focus();
  printFrame.contentWindow.print();

  // Clean up after printing
  setTimeout(() => {
    document.body.removeChild(printFrame);
  }, 1000);
};

/**
 * Enhanced print functionality with multiple options
 * @param {string} recordId - File transfer record ID
 * @param {string} method - Print method: 'window', 'direct', 'download'
 * @param {Object} options - Additional options
 */
export const printFileTransfer = async (recordId, method = 'window', options = {}) => {
  try {
    switch (method) {
      case 'window':
        return openPrintSheet(recordId, options);

      case 'direct':
        const data = await getPrintData(recordId);
        const html = generatePrintHTML(data, options);
        return printDirectly(html);

      case 'download':
        const printData = await getPrintData(recordId);
        const printHTML = generatePrintHTML(printData, options);
        const blob = new Blob([printHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${printData.title || 'file-transfer'}-print.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;

      default:
        throw new Error(`Unknown print method: ${method}`);
    }
  } catch (error) {
    console.error('Print operation failed:', error);
    throw error;
  }
};

export default {
  openPrintSheet,
  getPrintData,
  generatePrintHTML,
  printDirectly,
  printFileTransfer
};