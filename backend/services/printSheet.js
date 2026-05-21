export function buildPrintSheetHtml(item, options = {}) {
  const { fontSize = 14, lineHeight = 1.6, autoprint = 'true' } = options || {};

  const escapeHtml = (value) => {
    const s = value === undefined || value === null ? '' : String(value);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const nl2br = (value) => {
    const s = value === undefined || value === null ? '' : String(value);
    return escapeHtml(s).replace(/\r\n|\r|\n/g, '<br>');
  };

  const localizeMaybe = (raw) => {
    if (!raw && raw !== 0) return '';
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('km-KH');
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    // If this represents an ISO / stored midnight (UTC), treat as date-only to avoid showing timezone-shifted 07:00
    if (d.getUTCHours && d.getUTCHours() === 0 && d.getUTCMinutes && d.getUTCMinutes() === 0) {
      return d.toLocaleDateString('km-KH');
    }
    return d.toLocaleString('km-KH');
  };

  const meta = item.meta || {};
  const stages = meta.feedbackStages || {};

  // Build buckets and determine which should be visible according to
  // the same sequential rules used by the frontend ReplayfilePage.jsx.
  const buckets = [
    { key: 'S', variants: ['s', 'S'], metaKey: 'CourseNote' },
    { key: 'S1', variants: ['s1', 'S1'], metaKey: 'Course1Note' },
    { key: 'S2', variants: ['s2', 'S2'], metaKey: 'Course2Note' },
    { key: 'S3', variants: ['sd', 'SD', 's3', 'S3'], metaKey: 'Course3Note' },
    { key: 'S4', variants: ['sdr', 'SDR', 's4', 'S4'], metaKey: 'Course4Note' },
    { key: 'S5', variants: ['s5', 'S5', 'dir', 'DIR', 'sdir', 'SDIR'], metaKey: 'Course5Note' },
    { key: 'S6', variants: ['s6', 'S6', 'ho', 'HO'], metaKey: 'Course6Note' },
  ];

  const variantSelected = (variants) => {
    try {
      for (const k of (variants || [])) {
        const v = stages[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return true;
      }
    } catch (e) { }
    return false;
  };

  const hasNote = (metaKey) => {
    try {
      const v = meta && meta[metaKey];
      return v !== undefined && v !== null && String(v).trim() !== '';
    } catch (e) {
      return false;
    }
  };

  const present = buckets
    .map((b) => ({ bucket: b, present: variantSelected(b.variants) || hasNote(b.metaKey) }))
    .filter((x) => x.present)
    .map((x) => x.bucket);

  // Determine ordering: use CourseXDate if any saved note exists, otherwise canonical
  const withDates = present.map((b) => {
    const dateKey = String(b.metaKey).replace(/Note$/i, 'Date');
    let ts = null;
    try {
      const raw = meta && meta[dateKey];
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) ts = d.getTime();
      }
    } catch (e) {
      ts = null;
    }
    return { key: b.key, ts, bucket: b };
  });

  const anySavedNote = present.some((b) => hasNote(b.metaKey));
  const orderKeys = buckets.map((b) => b.key);
  if (anySavedNote) {
    withDates.sort((a, z) => {
      if (a.ts !== null && z.ts !== null) return a.ts - z.ts;
      if (a.ts !== null && z.ts === null) return -1;
      if (a.ts === null && z.ts !== null) return 1;
      return orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key);
    });
  } else {
    withDates.sort((a, z) => orderKeys.indexOf(a.key) - orderKeys.indexOf(z.key));
  }

  const orderedBuckets = withDates.map((x) => x.bucket);

  // sequential reveal: show up to last noted and the immediate next assigned stage
  let lastNotedIndex = -1;
  for (let i = 0; i < orderedBuckets.length; i++) {
    const b = orderedBuckets[i];
    if (hasNote(b.metaKey)) lastNotedIndex = i;
  }

  const visibleKeys = new Set();
  if (orderedBuckets.length > 0) {
    if (lastNotedIndex >= 0) {
      for (let i = 0; i <= lastNotedIndex; i++) visibleKeys.add(orderedBuckets[i].key);
      if (lastNotedIndex + 1 < orderedBuckets.length) visibleKeys.add(orderedBuckets[lastNotedIndex + 1].key);
    } else {
      visibleKeys.add(orderedBuckets[0].key);
    }
  }

  // Prepare visible stages HTML block
  const visibleStagesHtml = orderedBuckets
    .filter((b) => visibleKeys.has(b.key))
    .map((b) => {
      const metaVal = meta[b.metaKey] || '';
      return `<div style="margin:8px 0; padding:8px; border:1px dashed #ccc;"><strong>${escapeHtml(b.key)}:</strong><div style="margin-top:6px;">${metaVal ? nl2br(metaVal) : '&nbsp;'}</div></div>`;
    })
    .join('');

  // Prepare Telegram send info HTML (so the printed sheet shows if it was forwarded)
  let telegramSendsHtml = '';
  try {
    const sends = meta && Array.isArray(meta.telegramSends) ? meta.telegramSends : [];
    if (sends.length > 0) {
      const localizeMaybe = (raw) => {
        if (!raw && raw !== 0) return '';
        const s = String(raw);
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          const d = new Date(s);
          if (!isNaN(d.getTime())) return d.toLocaleDateString('km-KH');
        }
        const d = new Date(raw);
        if (isNaN(d.getTime())) return '';
        if (d.getUTCHours && d.getUTCHours() === 0 && d.getUTCMinutes && d.getUTCMinutes() === 0) {
          return d.toLocaleDateString('km-KH');
        }
        return d.toLocaleString('km-KH');
      };

      const rows = sends
        .map((s) => {
          const ts = s.sentAt ? localizeMaybe(s.sentAt) : '';
          const mid = s.messageId ? ` (msg ${escapeHtml(s.messageId)})` : '';
          return `<div style="margin-bottom:6px;">• ${escapeHtml(ts)}${mid}</div>`;
        })
        .join('');
      telegramSendsHtml = `<div style="padding:8px;margin-top:10px;border:1px solid #dfe6ef;border-radius:6px;background:#f3faf8"><strong>Telegram sends:</strong>${rows}</div>`;
    }
  } catch (e) {
    telegramSendsHtml = '';
  }

  const entryDateRaw = item.entryDate || item.entry_date || null;
  const entryDateObj = entryDateRaw ? new Date(entryDateRaw) : null;
  const hasEntryDate = entryDateObj && !isNaN(entryDateObj.getTime());
  const entryDateDisplay = hasEntryDate ? entryDateObj.toLocaleDateString('km-KH') : '';
  const entryTimeFromDate = hasEntryDate ? entryDateObj.toLocaleTimeString('km-KH', { hour: '2-digit', minute: '2-digit' }) : '';
  const entryTimeDisplay = (item.entryTime || item.entry_time || '').trim() || entryTimeFromDate;
  const creatorLabel = item.creatorName || item.owner || item.handler || item.current_handler || 'មិនបានកំណត់';

  // Prefer FileTransfer schema fields, but keep backward-compatible fallbacks.
  const letterNoDisplay = item.letterNo || item.letter_no || item.number || item.no || 'មិនកំណត់';
  const entryNoDisplay = item.entryNo || item.entry_no || '';
  const sourceDisplay = item.source || item.origin || item.from || 'មិនកំណត់';
  const qtyValue = (item.qty !== undefined && item.qty !== null) ? item.qty : (item.count !== undefined && item.count !== null) ? item.count : '';
  const dateRaw = item.date || item.created_at || item.createdAt || item.created || null;
  const dateObj = dateRaw ? new Date(dateRaw) : null;
  const dateDisplay = (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toLocaleDateString('km-KH') : new Date().toLocaleDateString('km-KH');

  const typeDisplay = item.type || item.title || 'មិនកំណត់';
  const contentRaw = item.content || item.description || item.summary || item.subject || '';
  const contentDisplay = contentRaw ? nl2br(contentRaw) : 'មិនមានខ្លឹមសារ';

  const html = `
<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Print Sheet - ${escapeHtml(item.title || 'File Transfer')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Khmer+OS+Siemreap&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 10mm 15mm; }
    @media print {
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: 100%;
        height: auto;
        background: #fff !important;
        font-family: 'Khmer OS Siemreap', 'Inter', Arial, sans-serif !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body > * { display: none; }
      .sheet {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: 100% !important;
        height: auto !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        page-break-after: auto;
      }
      .sheet * { visibility: visible !important; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }

    body {
      font-family: 'Khmer OS Siemreap', 'Inter', Arial, sans-serif;
      line-height: ${lineHeight};
      color: #333;
      font-size: ${fontSize}px;
      background-color: #f8f9fa;
    }

    .sheet {
      max-width: 210mm;
      margin: 20px auto;
      padding: 30px;
      background: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px double #333;
      padding-bottom: 25px;
    }

    .header h1 {
      font-size: ${parseInt(fontSize, 10) + 6}px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #1a202c;
    }

    .header-info {
      font-size: ${parseInt(fontSize, 10) - 1}px;
      color: #4a5568;
      margin-top: 10px;
    }

    .field-group { margin-bottom: 25px; }

    .field {
      margin: 12px 0;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .field.full-width { flex-direction: column; }

    .field .label {
      font-weight: 600;
      color: #2d3748;
      min-width: 140px;
      margin-right: 15px;
      font-size: ${parseInt(fontSize, 10) - 1}px;
    }

    .field.full-width .label { margin-bottom: 8px; }

    .field .value {
      flex: 1;
      color: #1a202c;
      word-wrap: break-word;
    }

    .field .value-content {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background-color: #f8f9fa;
      min-height: 40px;
    }

    .field.full-width .value-content {
      min-height: 80px;
      line-height: ${parseFloat(lineHeight) + 0.2};
    }

    .attachments-list { list-style: none; padding: 0; }
    .attachments-list li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .attachments-list li:last-child { border-bottom: none; }
    .attachments-list li:before { content: "📎 "; margin-right: 8px; }

    .signature-section {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
    }

    .signature-box { text-align: center; width: 200px; }

    .signature-line {
      border-top: 1px solid #333;
      margin-top: 60px;
      padding-top: 8px;
      font-size: ${parseInt(fontSize, 10) - 2}px;
    }

    .print-controls {
      margin: 20px 0;
      text-align: center;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }

    .print-btn {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      margin: 0 10px;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    .print-btn:hover { background: #4338ca; }

    .print-btn.secondary { background: #6b7280; }
    .print-btn.secondary:hover { background: #4b5563; }

    .metadata {
      background: #f1f5f9;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      border-left: 4px solid #3b82f6;
    }

    .timestamp {
      font-size: ${parseInt(fontSize, 10) - 2}px;
      color: #6b7280;
      text-align: right;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="no-print print-controls">
    <button class="print-btn" onclick="window.print()">🖨️ Print Sheet</button>
    <button class="print-btn secondary" onclick="window.close()">✕ Close</button>
    <div style="margin-top: 15px; font-size: 13px; color: #6b7280;">
      Click Print Sheet to print only this document content
    </div>
  </div>

  <div class="sheet">
    <div class="header">
      <h1>${escapeHtml(item.title || 'ឯកសារបញ្ជូន')}</h1>
      <div class="header-info">
        <strong>លេខលិខិត:</strong> ${escapeHtml(letterNoDisplay)}${entryNoDisplay ? ` | <strong>លេខចូល:</strong> ${escapeHtml(entryNoDisplay)}` : ''} |
        <strong>កាលបរិច្ឆេទ:</strong> ${escapeHtml(dateDisplay)}
      </div>
    </div>

    <div class="field-group">
      <div class="field">
        <span class="label">ប្រភេទឯកសារ:</span>
        <div class="value"><div class="value-content">${escapeHtml(typeDisplay)}</div></div>
      </div>

      <div class="field">
        <span class="label">លេខលិខិត:</span>
        <div class="value"><div class="value-content">${escapeHtml(letterNoDisplay)}</div></div>
      </div>

      <div class="field">
        <span class="label">ប្រភពឯកសារ:</span>
        <div class="value"><div class="value-content">${escapeHtml(sourceDisplay)}</div></div>
      </div>

      ${qtyValue !== '' ? `
      <div class="field">
        <span class="label">ចំនួន:</span>
        <div class="value"><div class="value-content">${escapeHtml(qtyValue)}</div></div>
      </div>
      ` : ''}

      <div class="field">
        <span class="label">ថ្ងៃចូល:</span>
        <div class="value"><div class="value-content">${escapeHtml(entryDateDisplay || 'មិនបានកំណត់')}</div></div>
      </div>

      <div class="field">
        <span class="label">ម៉ោងចូល:</span>
        <div class="value"><div class="value-content">${escapeHtml(entryTimeDisplay || 'មិនបានកំណត់')}</div></div>
      </div>

      <div class="field">
        <span class="label">អ្នកបង្កើត:</span>
        <div class="value"><div class="value-content">${escapeHtml(creatorLabel)}</div></div>
      </div>

      <div class="field full-width">
        <span class="label">កម្មវត្ថុ/ខ្លឹមសារ:</span>
        <div class="value"><div class="value-content">${contentDisplay}</div></div>
      </div>

      ${item.attachments && item.attachments.length > 0 ? `
      <div class="field full-width">
        <span class="label">ឯកសារភ្ជាប់:</span>
        <div class="value">
          <div class="value-content">
            <ul class="attachments-list">
              ${(item.attachments || []).map((att) => `<li>${escapeHtml(att)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
      ` : ''}

      ${meta.priority ? `
      <div class="field">
        <span class="label">អាទិភាព:</span>
        <div class="value"><div class="value-content">${escapeHtml(meta.priority)}</div></div>
      </div>
      ` : ''}
    </div>

    ${visibleStagesHtml && visibleStagesHtml.length > 0 ? `
    <div class="metadata">
      <strong>ព័ត៌មានបន្ថែម:</strong>
      ${visibleStagesHtml}
      ${telegramSendsHtml || ''}
    </div>
    ` : ''}

    <div class="signature-section">
      <div class="signature-box"><div class="signature-line"><div>អ្នកបញ្ជូន</div></div></div>
      <div class="signature-box"><div class="signature-line"><div>អ្នកទទួល</div></div></div>
    </div>

    <div class="timestamp">
      បានបង្កើតនៅ: ${escapeHtml(localizeMaybe(item.createdAt || Date.now()))}
      ${item.updatedAt && item.updatedAt !== item.createdAt ? ` | បានកែប្រែនៅ: ${escapeHtml(localizeMaybe(item.updatedAt))}` : ''}
    </div>
  </div>

  <script>
    window.onload = function () {
      const autoprint = '${String(autoprint)}' === 'true';
      if (autoprint) {
        setTimeout(() => { window.print(); }, 800);
      }
      window.focus();
    };

    window.addEventListener('beforeprint', function () {
      document.title = 'Printing - ${escapeHtml(item.title || 'File Transfer')}';
    });

    window.addEventListener('afterprint', function () {
      document.title = 'Print Sheet - ${escapeHtml(item.title || 'File Transfer')}';
    });

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
      if (e.key === 'Escape') {
        window.close();
      }
    });
  </script>
</body>
</html>`;

  return html;
}
