import headerBg from '../assets/3.JPG';

export function buildGroupReportHtml({
  groupName,
  department = '',
  labelMap = {},
  displayRows = [],
  monthMeta = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
  monthDays = 31,
  displayTotalDays = null,
  previewRange = null,
  debug = false,
  scheduleByDay = null,
  printableHeaderHtml = '',
  displayMonthLabel = '',
  exampleLayout = false,
  // how to display shift labels in the report: 'short' (short code), 'time' (start-end or title), or 'both'
  displayShiftLabel = 'short',
  resolveShiftForDay = () => null,
  shortCodeForShift = () => '',
  normalizedHolidaySet = new Set(),
  legendItems = [],
  // optional map { [code]: color } provided by UI to override legendItems
  customColorMap = {},
  // optional map { [code]: label } to override displayed badge characters
  customBadgeLabelMap = {},
  footerLeft = '',
  footerCenter = '',
  footerRight = '',
  footerLetters = null,
}) {
  try {
    const selectedCategory = String(groupName).trim();
    const groupRows = (displayRows || []).filter(r =>
      (String(r.category || '')).trim() === selectedCategory ||
      String(r.category || '').trim() === String(selectedCategory)
    );

    const toKhmerDigits = (numStr) => {
      const kh = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
      return String(numStr).split('').map(ch =>
        (ch >= '0' && ch <= '9') ? kh[parseInt(ch, 10)] : ch
      ).join('');
    };

    const formatSubgroupLabel = (name) => {
      if (!name) return '';
      const s = String(name);
      const m = s.match(/[0-9០-៩]+/);
      if (m && m[0]) {
        const token = m[0];
        const hasKhmer = /[០-៩]/.test(token);
        return `ទី${hasKhmer ? token : toKhmerDigits(token)}`;
      }
      if (s.includes('ទី')) return s;
      return s;
    };

    const totalDays = (Number.isFinite(Number(displayTotalDays)) && Number(displayTotalDays) > 0) ? Number(displayTotalDays) : Number(monthDays || 0);

    const rowsData = groupRows.map((r, idx) => {
      const emp = r.employee || null;
      const subgroup = r.groupName || (r.group && r.group.name) || '';
      const subgroupDisplay = formatSubgroupLabel(subgroup);
      // subgroupKey: prefer display label, otherwise use groupIndex if available
      const subgroupKey = (subgroupDisplay && String(subgroupDisplay).trim()) || (typeof r.groupIndex === 'number' ? `ក្រុមទី${String(r.groupIndex + 1)}` : (subgroup || ''));
      const name = emp ? (emp.khmerName || emp.fullName || emp.name || '') : String(r.employeeRef || '');
      // Normalize phone: ensure a single leading zero (add if missing, collapse multiple zeros)
      const _rawPhone = emp ? (emp.phone || emp.phoneNumber || emp.tel || r.mobile || r.contact || '') : '';
      let phone = String(_rawPhone || '').trim();
      // remove non-digit characters
      phone = phone.replace(/\D/g, '');
      // collapse multiple leading zeros to a single zero
      phone = phone.replace(/^0+/, '0');
      // ensure there's a leading zero when there's any digits
      if (phone && !phone.startsWith('0')) phone = '0' + phone;
      // if result is just a single '0' (no real digits), treat as empty
      if (phone === '0') phone = '';
      const debugPerDay = [];
      const codes = Array.from({ length: totalDays }).map((_, di) => {
        // gather possible sources for debugging: group pattern, schedule snapshot, resolver
        let groupObj = null;
        if (r.groupShifts && Array.isArray(r.groupShifts) && r.groupShifts.length) {
          // Align with SchedulePreview.resolveShiftForDay logic: respect group.startDayIndex, startShiftIndex/startShift
          try {
            const shifts = r.groupShifts || [];
            const shiftsLen = Math.max(1, shifts.length);
            const startDayIndex = Math.max(0, Number((r.group && r.group.startDayIndex) ?? r.groupIndex ?? 0));
            let desiredStartIndex = null;
            try {
              if (r.group) {
                if (typeof r.group.startShiftIndex === 'number' && Number.isFinite(r.group.startShiftIndex)) {
                  desiredStartIndex = Number(r.group.startShiftIndex);
                } else if (typeof r.group.startShift === 'string' && r.group.startShift.trim()) {
                  const want = r.group.startShift.trim().toLowerCase();
                  const found = shifts.findIndex(s => {
                    const label = (s && ((s.start || s.end) ? `${s.start || ''}-${s.end || ''}` : (s.title || ''))).toString().trim().toLowerCase();
                    return label === want || (s.title || '').toString().trim().toLowerCase() === want || (s.shortTitle || '').toString().trim().toLowerCase() === want;
                  });
                  if (found >= 0) desiredStartIndex = found;
                }
              }
            } catch (e) { desiredStartIndex = null; }

            let baseIndex;
            if (desiredStartIndex !== null && Number.isFinite(desiredStartIndex)) {
              baseIndex = ((desiredStartIndex - startDayIndex) % shiftsLen + shiftsLen) % shiftsLen;
            } else {
              baseIndex = Math.max(0, r.groupIndex || 0) % shiftsLen;
            }

            const shiftIndex = (baseIndex + di) % shiftsLen;
            groupObj = shifts[shiftIndex] || null;
          } catch (e) {
            groupObj = r.groupShifts[di % r.groupShifts.length];
          }
        }
        let snapshotObj = null;
        if (scheduleByDay) {
          try {
            const date = new Date(monthMeta.year, monthMeta.month - 1, di + 1);
            const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const list = scheduleByDay[iso] || [];
            snapshotObj = list.find(x => String(x.employeeRef) === String(r.employeeRef) || String(x.employeeId) === String((r.employee && (r.employee.staffId || r.employee.id)) || '')) || null;
          } catch (e) { snapshotObj = null; }
        }
        // always compute resolver (may reflect overrides/weekend/holiday rules)
        let resolverObj = null;
        try { resolverObj = resolveShiftForDay(r, di); } catch (e) { resolverObj = null; }

        // decide which source is considered "used" by the report:
        // prefer group pattern only if it yields a meaningful short code or label; otherwise fall back to snapshot or resolver
        // prefer the schedule snapshot (preview) when it contains usable data, otherwise fall back to group pattern, then resolver
        const snapshotHasData = Boolean(snapshotObj && snapshotObj.shift && (shortCodeForShift(snapshotObj.shift) || (snapshotObj.shift.title || snapshotObj.shift.start || snapshotObj.shift.end)));
        const groupHasData = Boolean(groupObj && (shortCodeForShift(groupObj) || (function (sh) { try { return (sh && (sh.title || sh.start || sh.end)); } catch (e) { return false; } })(groupObj)));
        const usedSource = snapshotHasData ? 'snapshot' : (groupHasData ? 'group' : 'resolver');
        const usedObj = (snapshotHasData ? (snapshotObj && snapshotObj.shift) : (groupHasData ? groupObj : resolverObj)) || null;

        // Prefer explicit `notes` from the shift object (Shift Group notes) for report badges,
        // otherwise fall back to code/id or the shortCodeForShift mapper.
        const groupCode = (groupObj && (groupObj.notes || groupObj.code || groupObj.id)) ? String(groupObj.notes || groupObj.code || groupObj.id) : (shortCodeForShift(groupObj) || '');
        const snapshotCode = (snapshotObj && snapshotObj.shift && (snapshotObj.shift.notes || snapshotObj.shift.code || snapshotObj.shift.id)) ? String(snapshotObj.shift.notes || snapshotObj.shift.code || snapshotObj.shift.id) : (shortCodeForShift(snapshotObj && snapshotObj.shift) || '');
        const resolverCode = (resolverObj && (resolverObj.notes || resolverObj.code || resolverObj.id)) ? String(resolverObj.notes || resolverObj.code || resolverObj.id) : (shortCodeForShift(resolverObj) || '');
        let usedCode = (usedObj && (usedObj.notes || usedObj.code || usedObj.id)) ? String(usedObj.notes || usedObj.code || usedObj.id) : (shortCodeForShift(usedObj) || '');
        // Detect Day Off similar to WorkCalendarPage logic: scheduledStart/End === 'OFF' or notes include 'day off',
        // or explicit 'R' code/title. If detected, show 'R' in the report.
        try {
          const uc = String(usedCode || '').trim();
          const title = usedObj && usedObj.title ? String(usedObj.title).trim() : '';
          const notesLower = usedObj && usedObj.notes ? String(usedObj.notes).toLowerCase() : '';
          const isDayOff = Boolean(
            (usedObj && (usedObj.scheduledStart === 'OFF' || usedObj.scheduledEnd === 'OFF')) ||
            (notesLower && notesLower.indexOf('day off') >= 0) ||
            uc.toUpperCase() === 'R' ||
            (title && String(title).toUpperCase() === 'R')
          );
          if (isDayOff) {
            usedCode = 'R';
          }
        } catch (e) { /* ignore */ }
        // build a human-readable label (time/title) for the used object
        const labelFor = (sh) => {
          try {
            if (!sh) return '';
            if (sh.title && String(sh.title).trim() && !/^\s*$/.test(String(sh.title))) {
              // if title is a generic short code like 'R' prefer times if present
              if ((sh.start || sh.end) && !/^[A-Z]{1,3}$/.test(String(sh.title).trim())) return String(sh.title).trim();
              if (sh.start || sh.end) return `${String(sh.start || '').trim()}-${String(sh.end || '').trim()}`.trim();
              return String(sh.title || '').trim();
            }
            if (sh.start || sh.end) return `${String(sh.start || '').trim()}-${String(sh.end || '').trim()}`.trim();
            return '';
          } catch (e) { return ''; }
        };
        const groupLabel = labelFor(groupObj) || '';
        const snapshotLabel = labelFor(snapshotObj && snapshotObj.shift) || '';
        const resolverLabel = labelFor(resolverObj) || '';
        const usedLabel = labelFor(usedObj) || usedCode || '';
        // try to capture a short-title from the used shift object (various property names)
        const usedShort = (usedObj && (usedObj.shortTitle || usedObj.short || usedObj.short_code || usedObj.shortTitle)) || '';

        debugPerDay.push({ dayIndex: di, groupCode, groupLabel, snapshotCode, snapshotLabel, resolverCode, resolverLabel, usedSource, usedCode, usedLabel, usedShort });
        return usedCode || '';
      });
      // compute displayLabels parallel to codes for rendering text by preference
      const displayLabels = (codes || []).map((c, i) => {
        const dd = debugPerDay[i] || {};
        if (displayShiftLabel === 'time') return dd.usedLabel || c || '';
        if (displayShiftLabel === 'both') return (dd.usedCode ? `${dd.usedCode} / ${dd.usedLabel || ''}` : dd.usedLabel || c || '');
        return c || '';
      });
      return { idx: idx + 1, subgroup, subgroupDisplay, subgroupKey, name, phone, codes, displayLabels, debugPerDay };
    });

    const grouped = (() => {
      const map = new Map();
      rowsData.forEach(r => {
        const key = (r.subgroupDisplay || r.subgroup || '').trim() || '-';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
      });
      return Array.from(map.entries()).map(([key, rows]) => {
        const bySig = new Map();
        rows.forEach(r => {
          const sig = (r.codes || []).join('|');
          if (!bySig.has(sig)) bySig.set(sig, { nameList: [], phoneList: [], codes: r.codes });
          bySig.get(sig).nameList.push(r.name || '');
          const phoneVal = (r.phone || '').toString().trim();
          if (phoneVal) bySig.get(sig).phoneList.push(phoneVal);
        });


        const combined = Array.from(bySig.values()).map(x => ({
          names: x.nameList,
          phone: Array.from(new Set(x.phoneList)).join(', '),
          codes: x.codes
        }));
        combined.sort((a, b) =>
          String(a.names[0] || '').localeCompare(String(b.names[0] || ''))
        );
        return { key, combined };
      });
    })();

    const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMeta = Array.from({ length: totalDays }).map((_, i) => {
      const d = new Date(monthMeta.year, monthMeta.month - 1, i + 1);
      const dow = d.getDay();
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isHoliday = normalizedHolidaySet.has(iso);
      const bg = dow === 0 ? '#fde2e2' : (dow === 6 ? '#e9c8fcff' : (isHoliday ? '#fee2e2' : '#ffffff'));
      return { label: String(i + 1).padStart(2, '0'), dowLabel: weekdayShort[dow], bg };
    });

    // Build subgroup summary (one row per subgroup showing codes per day)
    const subgroupKeys = Array.from(new Set(rowsData.map(r => (r.subgroupKey || r.subgroupDisplay || r.subgroup || '').toString()))).filter(s => s && s !== '-');
    const buildSummaryRows = () => {
      if (!subgroupKeys.length) return '';
      return subgroupKeys.map(sg => {
        const left = `<td class="col-subgroup" style="text-align:left;font-weight:600">${sg}</td>`;
        const cells = Array.from({ length: totalDays }).map((_, di) => {
          // collect all unique codes for this subgroup/day
          const codes = rowsData.reduce((acc, r) => {
            if ((r.subgroupKey || r.subgroupDisplay || r.subgroup || '') === sg) {
              const code = (r.codes && r.codes[di]) ? String(r.codes[di]) : '';
              if (code && !acc.includes(code)) acc.push(code);
            }
            return acc;
          }, []);
          const cellText = codes.join('/');
          let bg = '#9ca3af';
          let textColor = '#ffffff';
          if (codes.length === 1) {
            const codeKey = String(codes[0]);
            // prefer explicit custom color map when provided by UI
            const custom = (customColorMap && (customColorMap[codeKey] || customColorMap[String(codeKey).toUpperCase()] || customColorMap[String(codeKey).toLowerCase()]));
            const legendItem = custom ? null : (legendItems || []).find(li => String(li.code) === codeKey);
            bg = custom ? (custom) : (legendItem ? (legendItem.color || '#9ca3af') : '#9ca3af');
            try { const cc = String(bg || '').replace('#', ''); const rr = parseInt(cc.substring(0, 2), 16); const gg = parseInt(cc.substring(2, 4), 16); const bb = parseInt(cc.substring(4, 6), 16); const lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255; textColor = lum > 0.6 ? '#111827' : '#ffffff'; } catch (e) { textColor = '#ffffff'; }
          } else if (codes.length > 1) {
            // neutral background for multiple codes
            bg = '#6b7280'; // gray
            textColor = '#ffffff';
          } else {
            bg = '#ffffff';
            textColor = '#111827';
          }
          return `<td class="col-day" style="text-align:center"><span data-code="${codes.length === 1 ? String(codes[0]) : ''}" class="shift-badge" style="background:${bg};color:${textColor}">${String(cellText || '')}</span></td>`;
        }).join('');
        return `<tr>${left}${cells}</tr>`;
      }).join('');
    };

    const summaryHtml = subgroupKeys.length ? (`<table class="summary" style="width:100%;border-collapse:collapse;margin-bottom:6px"><thead><tr><th style="width:160px;border:1px solid #bbb;background:#fff"></th>${dayMeta.map(d => `<th style="border:1px solid #bbb;padding:2px 4px;background:#f3f4f6">${d.label}</th>`).join('')}</tr></thead><tbody>${buildSummaryRows()}</tbody></table>`) : '';



    // Resolve display month label: prefer provided `displayMonthLabel`, otherwise build English + Khmer form
    const engMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const khMonths = ['មករា', 'កុម្ភៈ', 'មិនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
    const monthIndex = Math.max(1, (monthMeta && monthMeta.month) || (new Date().getMonth() + 1)) - 1;
    const engMonth = engMonths[monthIndex] || 'Month';
    const khMonth = khMonths[monthIndex] || '';
    const resolvedDisplayMonthLabel = (displayMonthLabel && String(displayMonthLabel).trim()) ? String(displayMonthLabel) : `${engMonth} ${monthMeta.year} — ខែ ${khMonth} ឆ្នាំ ${toKhmerDigits(monthMeta.year)}`;

    const khMonthName = khMonth || '';
    const khYear = toKhmerDigits(monthMeta.year);
    const groupLabel = (labelMap && labelMap[groupName]) ? labelMap[groupName] : (`ក្រុម ${groupName}`);
    const previewRangeText = (previewRange && previewRange.start) ? ` ${previewRange.start} → ${previewRange.end}` : '';
    const title = `តារាងវេនប្រចាំការ ${groupLabel} ប្រចាំខែ ${khMonthName} ឆ្នាំ ${khYear}`;
    // simple location label 'H' that can be rendered below the title in the report
    // Make the phone editable and persistable (saved per group in localStorage)
    const hotlineDefault = '070839345';
    const locationH = `លេខទូរស័ព្ទ Hotline ${groupLabel} ប្រចាំការ២៤ម៉ោង <span id="hotlineField" contenteditable="true" style="display:inline-block;min-width:80px;padding:0px 6px;border-bottom:1px dashed #222;font-weight:700;">${hotlineDefault}</span><span id="hotlineSaved" style="margin-left:6px;color:green;display:none;font-size:12px;">Saved</span>`;

    // Left headers with default widths
    const leftHeaders = [
      { text: 'ក្រុម', width: '30px' },
      { text: 'គោត្តនាម និងនាម', width: '120px' },
      { text: 'លេខទូរស័ព្ទ', width: '80px' }
    ];
    const leftHeadHtml = leftHeaders.map((h, i) => `<th class="col-${i} resizable" style="width:${h.width}" rowspan="2">${h.text}</th>`).join('');
    const dowHtml = dayMeta.map(d => `<th class="col-day resizable" style="background:${d.bg}">${d.dowLabel}</th>`).join('');
    const dayNumHtml = dayMeta.map(d => `<th class="col-day resizable">${d.label}</th>`).join('');
    const theadHtml = `<tr>${leftHeadHtml}${dowHtml}</tr><tr>${dayNumHtml}</tr>`;

    const buildRowsWithRowspan = () => {
      const rows = [];
      grouped.forEach(g => {
        const span = g.combined.length;
        g.combined.forEach((r, i) => {
          const leftCells = [];
          if (i === 0) {
            leftCells.push(`<td class="col-card" rowspan="${span}" style="text-align:center">${String(g.key || '')}</td>`);
          }
          const nameHtml = r.names.map(n => `<div>${String(n || '')}</div>`).join('');
          leftCells.push(`<td class="col-name" style="text-align:left">${nameHtml}</td>`);
          leftCells.push(`<td class="col-phone" style="text-align:center">${String(r.phone || '')}</td>`);
          const dayCells = r.codes.map((c, idx) => {
            // choose display text based on displayLabels (falls back to short code c)
            const displayText = (r.displayLabels && r.displayLabels[idx]) ? String(r.displayLabels[idx]) : String(c || '');
            const codeKey = String(c || '');
            const custom = (customColorMap && (customColorMap[codeKey] || customColorMap[String(codeKey).toUpperCase()] || customColorMap[String(codeKey).toLowerCase()]));
            const legendItem = custom ? null : (legendItems || []).find(li => String(li.code) === String(c));
            const bg = custom ? custom : (legendItem ? (legendItem.color || '#9ca3af') : '#9ca3af');
            const textColor = (() => {
              try {
                const cc = String(bg || '').replace('#', '');
                const rr = parseInt(cc.substring(0, 2), 16);
                const gg = parseInt(cc.substring(2, 4), 16);
                const bb = parseInt(cc.substring(4, 6), 16);
                const lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255;
                return lum > 0.6 ? '#111827' : '#ffffff';
              } catch (e) { return '#ffffff'; }
            })();
            return `<td class="col-day" style="text-align:center"><span data-code="${codeKey || ''}" class="shift-badge" style="background:${bg};color:${textColor}">${String(displayText || '')}</span></td>`;
          }).join('');
          rows.push(`<tr>${leftCells.join('')}${dayCells}</tr>`);
        });
      });
      return rows.join('');
    };

    const rowsHtml = buildRowsWithRowspan();

    // Build legend HTML from actual codes used in the table. Prefer labels
    // derived from the table's debug data (usedLabel) so codes like "NG"
    // can show their time ranges (e.g. "07:30-07:30"). Fall back to
    // customBadgeLabelMap, legendItems, or 'Day Off' for R.
    const usedCodeSet = new Set();
    const codeLabelMap = {}; // code -> label (from debugPerDay.usedLabel when available)
    const codeShortMap = {}; // code -> shortTitle (from debugPerDay.usedShort when available)
    (rowsData || []).forEach(r => {
      (r.codes || []).forEach((c, idx) => { if (c !== undefined && c !== null && String(c).trim() !== '') usedCodeSet.add(String(c)); });
      (r.debugPerDay || []).forEach(dp => {
        try {
          const code = String(dp.usedCode || '').trim();
          const lab = String(dp.usedLabel || '').trim();
          const short = String(dp.usedShort || '').trim();
          if (code && lab && !codeLabelMap[code]) codeLabelMap[code] = lab;
          if (code && short && !codeShortMap[code]) codeShortMap[code] = short;
        } catch (e) { /* ignore */ }
      });
    });
    const usedCodes = Array.from(usedCodeSet);
    const legendHtml = (usedCodes.length ? usedCodes.map(codeKey => {
      const custom = (customColorMap && (customColorMap[codeKey] || customColorMap[String(codeKey).toUpperCase()] || customColorMap[String(codeKey).toLowerCase()]));
      const legendItem = (legendItems || []).find(li => String(li.code) === String(codeKey));
      const bg = custom ? custom : (legendItem ? (legendItem.color || '#9ca3af') : '#9ca3af');
      let text = '#fff';
      try { const cc = String(bg || '').replace('#', ''); const rr = parseInt(cc.substring(0, 2), 16); const gg = parseInt(cc.substring(2, 4), 16); const bb = parseInt(cc.substring(4, 6), 16); const lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255; text = lum > 0.6 ? '#111827' : '#ffffff'; } catch (e) { }
      let labelFromDebug = codeLabelMap[codeKey];
      const shortFromDebug = codeShortMap[codeKey];
      if (labelFromDebug && shortFromDebug) labelFromDebug = `${labelFromDebug} ${shortFromDebug}`;
      // For R, always show English + Khmer to avoid duplicate or missing translations
      if (String(codeKey) === 'R') {
        const label = 'Day Off / ថ្ងៃសម្រាក់';
        var labelText = ` = ${label}`;
      } else {
        const label = (customBadgeLabelMap && (customBadgeLabelMap[codeKey] || customBadgeLabelMap[String(codeKey).toUpperCase()] || customBadgeLabelMap[String(codeKey).toLowerCase()])) || labelFromDebug || (legendItem && (legendItem.label || legendItem.name || legendItem.title || legendItem.description)) || '';
        var labelText = label ? ` = ${label}` : '';
      }
      return `<span class="legend-entry">` +
        `<span class="legend-swatch" data-code="${codeKey}" style="width:7mm;background:${bg};color:${text};font-weight:700;">${codeKey}</span>${labelText}` +
        `</span>`;
    }).join('') : ((legendItems || []).map(li => {
      const bg = li.color || '#9ca3af';
      const cc = String(bg || '').replace('#', '');
      let text = '#fff';
      try { const rr = parseInt(cc.substring(0, 2), 16); const gg = parseInt(cc.substring(2, 4), 16); const bb = parseInt(cc.substring(4, 6), 16); const lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255; text = lum > 0.6 ? '#111827' : '#ffffff'; } catch (e) { }
      const label = li.label || li.name || li.title || '';
      const labelText = label ? ` = ${label}` : (li.code === 'R' ? ' = Day Off ថ្ងៃសម្រាក់' : '');
      return `<span class="legend-entry">` +
        `<span class="legend-swatch" data-code="${li.code}" style="width:7mm;background:${bg};color:${text};font-weight:700;">${li.code}</span>${labelText}` +
        `</span>`;
    }).join('')));

    const defaultFooterLeft = footerLeft || `បានឃើញ និងឯកភាព\nនាយករងមន្ទីរពេទ្យ`;
    const defaultFooterCenter = footerCenter || `បានឃើញ និងពិនិត្យត្រឹមត្រូវ\nប្រធានការិយាល័យរដ្ឋបាល និងបុគ្គលិក`;
    // Format footer right as: រាជធានីភ្នំពេញ ថ្ងៃទី<#> ខែ<KhMonth> ឆ្នាំ <KhYear>
    let defaultFooterRight;
    try {
      const _now = new Date();
      const _khMonths = ['មករា', 'កុម្ភៈ', 'មិនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
      const _day = _now.getDate();
      const _monthName = _khMonths[_now.getMonth()] || '';
      const _year = _now.getFullYear();
      // derive role label from department prefix when possible
      let _derivedRole = 'នាយផ្នែក';
      try {
        const _dep = String(department || '').trim();
        if (/^\s*ផ្នែក/.test(_dep)) _derivedRole = 'នាយផ្នែក';
        else if (/^\s*មណ្ឌល/.test(_dep)) _derivedRole = 'នាយមណ្ឌល';
        else if (/^\s*ការិយាល័យ/.test(_dep)) _derivedRole = 'ប្រធាន/អនុ ការិយាល័យ';
      } catch (e) { /* ignore */ }
      defaultFooterRight = footerRight || `រាជធានីភ្នំពេញ ថ្ងៃទី${toKhmerDigits(_day)} ខែ${_monthName} ឆ្នាំ ${toKhmerDigits(_year)}\n${_derivedRole}`;
    } catch (e) {
      defaultFooterRight = footerRight || `រាជធានីភ្នំពេញ ${new Date().toLocaleDateString()}\nនាយផ្នែក`;
    }

    // Use the provided printable header as-is (trimmed). Removing the previous sanitization
    // because caller may wish to include phone numbers or labels in the printable header.
    const safeHeaderHtml = (printableHeaderHtml && String(printableHeaderHtml).trim()) ? String(printableHeaderHtml).trim() : '';

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Group Report</title>
  <style>
@page { size: A4 landscape; margin: 5mm; }
body { margin: 0; font-family: 'Khmer OS seamreap'; font-size: 10px; color: rgba(7, 7, 7, 1); }
.page { width: calc(297mm - 16mm); margin: 0 auto; position: relative; }
h2.title { text-align: center; margin: 6mm 0 1mm 0; font-size: 17px; }
 .top-header { text-align: center; font-size: 15px; font-weight: 700; margin-bottom: 0px; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
th, td { border: 1px solid #050505ff; padding: 0px; font-size: 13px; word-wrap: break-word; }
thead th { background: #f0f2f7ff; position: relative; }
.resizable::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
}
tr.resizable-row { position: relative; }
tr.resizable-row::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5px;
  cursor: row-resize;
}
  .legend { font-family: 'Khmer OS seamreap';font-size: 15px; margin-top: 3mm; display:flex; flex-wrap:nowrap; gap:14px; align-items:center; justify-content:center; width:100%; overflow:hidden; }
  .legend-entry { white-space:nowrap; display:inline-flex; align-items:center; gap:8px; margin-right:1cm; }
  .legend-swatch { display:inline-flex; justify-content:center; align-items:center; padding:0 1px; border-radius:3px; min-width:7mm; height:1.2em; }
/* Compact badge used for per-day shift codes (narrower width + smaller padding) */
.shift-badge {
  display: inline-block;
  min-width: 4mm;
  min-height: 5mm;
  padding: 0px;
  border-radius: 0px;
  font-weight: 700;
  font-family: 'Times New Roman';
  font-size: 13px;
  line-height: 2;
  letter-spacing: -0px;
  box-sizing: border-box;
  text-align: center;
}

/* Small stacked letters (A, B, C) shown at the top-left of the page for reference */
.side-letters {
  position: absolute;
  left: 0mm;
  top: 18mm;
  display: flex;
  flex-direction: column;
  gap: 2mm;
  z-index: 20;
}
.side-letters .side-letter {
  font-size: 13px;
  font-family: 'Khmer OS Muol Light';
  font-weight: 300;
  color: #080808ff; /* a deep purple similar to the screenshot */
  line-height: 1.1;
  transform: none;
  -webkit-print-color-adjust: exact;
}
.location-h {
  text-align: center;
  font-weight: 600;
  margin-top: 0px;
  font-family: 'Khmer OS seamreap';
  font-size: 16px;
  font-weight: 600;
  color: #080808ff;
}
  /* Header image placed between top header and title (centered). */
  .header-image { text-align: center; margin: 4px 0 40px 0; }
  /* Fix decorative ornament to a consistent physical size so print matches view */
  .header-image img { width: 45mm !important; max-width: none !important; height: auto; display: inline-block; border-radius: 1px; }
  /* Left columns: use Khmer OS seamreap at size 17 for Group / Name / Phone */
  th.col-0, th.col-1, th.col-2, td.col-card, td.col-name, td.col-phone {
    font-family: 'Khmer OS seamreap', 'Khmer OS System', 'Noto Sans Khmer', sans-serif;
    font-weight: 600;
    font-size: 14px;
    line-height: 1.8;
  }
  /* Display phone like the name column: allow wrapping and left-align so long numbers show similarly */
  td.col-phone { white-space: normal; word-break: break-word; overflow-wrap: anywhere; text-align: left; }
/* Print-specific adjustments: try to keep the entire report on a single printed page */
@media print {
  html, body { height: 100%; }
  body { -webkit-print-color-adjust: exact; color-adjust: exact; }
  /* Slightly reduce spacing and font to help fit large tables on one page */
  .page { width: 100%; margin: 0; transform-origin: top center; }
  /* Ensure ornament prints at same physical size as screen view */
  .header-image img { width: 45mm !important; max-width: none !important; }
  table { page-break-inside: avoid; border-collapse: collapse; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  th, td { padding: 2px; font-size: 10px; }
  .legend, .report-footer { page-break-inside: avoid; }
  /* make legend more compact when printing to try to keep it on one line */
  .legend { font-size: 10px !important; gap:8px !important; }
  .legend-swatch { min-width:6mm !important; }
  /* If content still overflows, slightly scale down to try and keep everything on one page */
  @page { size: A4 landscape; margin: 6mm; }
  body > .page { transform: none; }
}
/* Hide floating color editor when printing */
@media print {
  #report-color-editor { display: none !important; }
}
/* Footer signature area */
.report-footer { width: 100%; margin-top: 0mm; }
/* Center the three signature boxes and bring side boxes closer to center */
.report-footer .sign-row { display: flex; justify-content: center; align-items: flex-end; margin-top: 0mm; gap:32mm; }
.report-footer .sign-box { width: auto; flex: 0 0 auto; text-align: center; padding: 2mm 6mm; box-sizing: border-box; }
 /* Slightly reduce label spacing so signatures sit closer to the table */
  .report-footer .sign-box .label { font-size: 12px; margin-bottom: 0mm; font-weight: 600; }
 /* Hide the long horizontal signature lines (user requested) by removing the top border.
   Keep the .line element for layout/spacing but without the visible border. */
.report-footer .sign-box .letters { margin-top: 0mm; margin-bottom: 0mm; font-family: 'Khmer OS Muol Light'; font-size: 13px; color: #070707ff; }
/* Ensure footer uses smaller font on print and keeps three columns */
.report-footer .sign-box { font-size: 17px; }
.report-footer .sign-box .label { font-size: 15px; font-weight: 700; }
</style>
<script>
document.addEventListener('DOMContentLoaded', () => {
  // Column resize
  const table = document.querySelector('table');
  let startX, startWidth, currentTh;
  table.querySelectorAll('th.resizable').forEach(th => {
    th.addEventListener('mousedown', e => {
      if (e.offsetX > th.offsetWidth - 10) {
        startX = e.pageX;
        startWidth = th.offsetWidth;
        currentTh = th;
        document.addEventListener('mousemove', resizeColumn);
        document.addEventListener('mouseup', stopResize);
      }
    });
  });
  function resizeColumn(e) {
    if (currentTh) {
      const diff = e.pageX - startX;
      currentTh.style.width = (startWidth + diff) + 'px';
    }
  }
  function stopResize() {
    document.removeEventListener('mousemove', resizeColumn);
    document.removeEventListener('mouseup', stopResize);
    currentTh = null;
  }

  // Row resize affecting all rows
  const tbodyRows = Array.from(document.querySelectorAll('tbody tr'));
  tbodyRows.forEach(tr => tr.classList.add('resizable-row'));

  tbodyRows.forEach(tr => {
    tr.addEventListener('mousedown', e => {
      if (e.offsetY > tr.offsetHeight - 5) {
        let startY = e.pageY;
        let startHeight = tr.offsetHeight;

        function resizeAllRows(ev) {
          const newHeight = startHeight + (ev.pageY - startY);
          tbodyRows.forEach(r => {
            r.style.height = newHeight + 'px';
          });
        }

        function stopResizeAll() {
          document.removeEventListener('mousemove', resizeAllRows);
          document.removeEventListener('mouseup', stopResizeAll);
        }

        document.addEventListener('mousemove', resizeAllRows);
        document.addEventListener('mouseup', stopResizeAll);
      }
    });
  });

});
</script>
</head>
<body>
<div class="preview-container">
  <div class="page">
  <div class="side-letters" aria-hidden="true"><div class="side-letter">ក្រសួងសុខាភិបាល</div><div class="side-letter">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div><div class="side-letter">${String(department)}</div></div>
  <div class="top-header">${safeHeaderHtml}</div>
  <div class="header-image"><img src="${headerBg}" alt="" style="width:45mm; height:auto; opacity:0.85; pointer-events:none;" /></div>
<div class="title" style="text-align: center;margin-top: 0px;font-family: 'Khmer OS seamreap';font-size: 17px;font-weight: 600;color: #050505ff;">${title}</div>
  <div class="location-h">${locationH}</div>
<table>
<thead>${theadHtml}</thead>
<tbody>${rowsHtml}</tbody>
</table>
<div class="legend">
${legendHtml}
</div>
${debug ? debugHtml : ''}
<script>
(function(){
  try{
    const storageKey = 'reportColorOverrides_v1';
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    function hexToRgb(hex){
      try{
        const h = String(hex||'').replace('#','').trim();
        if(h.length===3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
        return { r: parseInt(h.substring(0,2),16), g: parseInt(h.substring(2,4),16), b: parseInt(h.substring(4,6),16) };
      }catch(e){ return { r:156,g:163,b:175 }; }
    }
    function applyOverrides(map){
      Object.keys(map||{}).forEach(code => {
        const v = map[code];
        if(!v) return;
        const c = v.color || '#9ca3af';
        const op = (typeof v.opacity === 'number') ? v.opacity : 1;
        const { r,g,b } = hexToRgb(c);
        const rgba = 'rgba(' + [r,g,b,op].join(',') + ')';
        document.querySelectorAll('[data-code="'+code+'"]').forEach(el => {
          el.style.background = rgba;
          try{ const lum = (0.299*r + 0.587*g + 0.114*b)/255; el.style.color = lum > 0.6 ? '#111827' : '#ffffff'; }catch(e){}
        });
        const leg = Array.from(document.querySelectorAll('.legend-swatch')).find(s => s.textContent.trim() === String(code));
        if(leg) leg.style.background = rgba;
      });
    }
    applyOverrides(saved);

    // Hotline field persistence (per-group) — load/save the editable hotline value
    try {
      const reportGroupKey = ${JSON.stringify(String(groupName))};
      const hotlineStorageKey = 'reportHotline_' + encodeURIComponent(reportGroupKey || 'default');
      const hotlineEl = document.getElementById('hotlineField');
      const hotlineSavedEl = document.getElementById('hotlineSaved');
      if (hotlineEl) {
        const savedHotline = localStorage.getItem(hotlineStorageKey);
        // Prefer server value if available, otherwise fall back to localStorage
        (function tryLoadServer(){
          try {
            fetch('/api/report-settings/' + encodeURIComponent(reportGroupKey), { credentials: 'same-origin' }).then(r => r.json()).then(j => {
              if (j && j.ok && j.hotline && String(j.hotline).trim()) {
                hotlineEl.textContent = String(j.hotline);
              } else if (savedHotline && String(savedHotline).trim()) {
                hotlineEl.textContent = savedHotline;
              }
            }).catch(() => { if (savedHotline && String(savedHotline).trim()) hotlineEl.textContent = savedHotline; });
          } catch(e) { if (savedHotline && String(savedHotline).trim()) hotlineEl.textContent = savedHotline; }
        })();

        function saveHotlineToLocalAndServer(v){
          try { localStorage.setItem(hotlineStorageKey, v); } catch(e){}
          if (hotlineSavedEl) { hotlineSavedEl.style.display = 'inline'; setTimeout(()=>{ hotlineSavedEl.style.display = 'none'; }, 1400); }
          try {
            fetch('/api/report-settings/' + encodeURIComponent(reportGroupKey), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hotline: v }),
              credentials: 'same-origin'
            }).catch(()=>{});
          } catch(e){}
        }

        hotlineEl.addEventListener('blur', function() {
          try { const v = String(hotlineEl.textContent || '').trim(); saveHotlineToLocalAndServer(v); } catch(e){}
        });
        hotlineEl.addEventListener('keydown', function(e) {
          try {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); const v = String(hotlineEl.textContent || '').trim(); saveHotlineToLocalAndServer(v); }
          } catch(e){}
        });
      }
    } catch(e) {}

    // build floating editor
    const legendCodes = Array.from(document.querySelectorAll('.legend-swatch')).map(s => s.textContent.trim()).filter(Boolean);
    if(!legendCodes.length) return;
  const container = document.createElement('div');
  container.id = 'report-color-editor';
  container.style.position = 'fixed'; container.style.right = '8px'; container.style.top = '8px'; container.style.zIndex = 9999;
    container.style.background = '#fff'; container.style.border = '1px solid #f7f2f2ff'; container.style.padding = '8px'; container.style.borderRadius = '6px';
    container.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)'; container.style.fontFamily = 'Arial, sans-serif'; container.style.fontSize = '12px';
    const title = document.createElement('div'); title.style.fontWeight = 700; title.style.marginBottom = '6px'; title.textContent = 'Customize colors'; container.appendChild(title);
    legendCodes.forEach(code => {
      const entry = saved[code] || {};
      const row = document.createElement('div'); row.style.marginBottom = '6px';
      const color = entry.color || '#9ca3af'; const opacity = (typeof entry.opacity === 'number')? entry.opacity : 1;
      row.innerHTML = '<div style="display:flex;align-items:center;gap:6px"><div style="width:36px;text-align:center;font-weight:700">'+code+'</div><input type="color" value="'+color+'" data-code="'+code+'" class="rc-color"/><input type="range" min="0" max="100" value="'+Math.round(opacity*100)+'" data-code="'+code+'" class="rc-opacity" style="width:84px"/></div>';
      container.appendChild(row);
    });
    const btRow = document.createElement('div'); btRow.style.display='flex'; btRow.style.gap='8px'; btRow.style.marginTop='6px';
    const saveBtn = document.createElement('button'); saveBtn.textContent='Save'; saveBtn.style.padding='6px 8px'; saveBtn.style.background='#2563eb'; saveBtn.style.color='#fff'; saveBtn.style.border='none'; saveBtn.style.borderRadius='4px';
    const resetBtn = document.createElement('button'); resetBtn.textContent='Reset'; resetBtn.style.padding='6px 8px'; resetBtn.style.background='#ef4444'; resetBtn.style.color='#fff'; resetBtn.style.border='none'; resetBtn.style.borderRadius='4px';
    btRow.appendChild(saveBtn); btRow.appendChild(resetBtn); container.appendChild(btRow);
    document.body.appendChild(container);

    function readUI(){ const m = {}; container.querySelectorAll('.rc-color').forEach(inp => { const code = inp.getAttribute('data-code'); const color = inp.value; const opEl = container.querySelector('.rc-opacity[data-code="'+code+'"]'); const op = opEl ? Number(opEl.value)/100 : 1; m[code] = { color, opacity: op }; }); return m; }
    saveBtn.addEventListener('click', function(){ const map = readUI(); localStorage.setItem(storageKey, JSON.stringify(map)); applyOverrides(map); });
    resetBtn.addEventListener('click', function(){ localStorage.removeItem(storageKey); location.reload(); });
  }catch(e){ console.error(e); }
})();
</script>
</div>
<!-- Footer signatures -->
<div class="report-footer">
  <div class="sign-row">
    <div class="sign-box" style="transform: translateX(2cm) translateY(4mm);">
      <div class="label">${defaultFooterLeft.split('\n')[0]}</div>
      <div class="line"></div>
      <div class="letters">${defaultFooterLeft.split('\n').slice(1).join('<br/>')}</div>
    </div>
    <div class="sign-box" style="transform: translateX(2cm)translateY(2mm);">
      <div class="label">${defaultFooterCenter.split('\n')[0]}</div>
      <div class="line"></div>
      <div class="letters">${defaultFooterCenter.split('\n').slice(1).join('<br/>')}</div>
    </div>
    <div class="sign-box">
      <div class="label">${defaultFooterRight.split('\n')[0]}</div>
      <div class="line"></div>
      <div class="letters">${defaultFooterRight.split('\n').slice(1).join('<br/>')}</div>
    </div>
  </div>
</div>
  </div>
</div>
</body>
</html>`;

    return html;
  } catch (err) {
    return `<html><body><pre>Failed to build report: ${String(err || '')}</pre></body></html>`;
  }
}

export default buildGroupReportHtml;
