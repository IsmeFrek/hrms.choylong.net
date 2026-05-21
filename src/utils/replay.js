/**
 * Form HTML Builder for Document Flow
 * Extracted from DocumentFlowPage.jsx for easier maintenance (DocumentFlowPage has been removed)
 */

export function buildFormHTML(it, editable = false) {
  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const candidateNames = unique([
    it.assigneeName,
    it.officeHeadName,
    it.deputyName1,
    it.deputyName2,
    it.directorName,
    ...(Array.isArray(it.approvals) ? it.approvals.map(a => a.byName) : [])
  ]);

  const fmtDate = (d) => {
    try {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(+dt)) return '';
      return dt.toISOString().slice(0, 10);
    } catch { return ''; }
  };

  // Khmer numerals and month names
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  const khmerMonths = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

  const toKhmerNumber = (num) => {
    return num.toString().split('').map(c => (c >= '0' && c <= '9') ? khmerDigits[+c] : c).join('');
  };

  const fmtDateKh = (d) => {
    try {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(+dt)) return '';
      const day = dt.getDate();
      const month = dt.getMonth();
      const year = dt.getFullYear();
      return `ចុះថ្ងៃទី ${toKhmerNumber(day)} ខែ ${khmerMonths[month]} ឆ្នាំ ${toKhmerNumber(year)}`;
    } catch (e) { return ''; }
  };

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>បែបបទឯកសារ</title>
        <style>
          @page { size: A4; margin: 14mm; }
          html, body { height: 100%; }
          body { font-family: 'Khmer OS Siemreap','Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif; color: #000; background: #eee; margin: 0; }
          .toolbar { position: sticky; top: 0; padding: 5px 0; background: #fff; border-bottom: 1px solid #ddd; margin-bottom: 5px; }
          .btn { padding: 6px 10px; border: 1px solid #444; background: #f5f5f5; cursor: pointer; }
          /* A4 sheet preview */
          .sheet { width: 210mm; height: 297mm; margin: 12px auto; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.25); position: relative; }
          .page-content { padding: 14mm; box-sizing: border-box; }
          .margin-guide { position: absolute; inset: 1mm; border: 1px dashed #faf8f8ff; pointer-events: none; }
          .title { font-weight: 400; font-size: 18px; margin-bottom: 1px; }
          .field { margin: 6px 0; display: flex; align-items: flex-end; gap: 6px; }
          .label { width: 160px; color: #000; font-weight: 700; }
          .value { flex: 1; display: block; padding: 0 4px; box-sizing: border-box; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; white-space: normal; }
          .value-plain { flex: 1; display: block; padding: 0 4px; box-sizing: border-box; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; white-space: normal; }
          .value-lines { border-bottom: none; line-height: 1.6; min-height: 1.6em; padding-bottom: 2px; box-sizing: border-box; max-width: 100%; overflow-wrap: anywhere; word-break: break-word; white-space: normal; }
          .content-wrap { border: none; padding: 10px 0; margin: 6px 0 10px; min-height: 140px; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
          .section-title { font-weight: 700; margin: 6px 0 6px; padding-top: 0; }
          .editable { outline: 1px dashed #bbb; padding: 8px; min-height: 110px; }
          .meta-row { display:flex; gap: 12px; margin-top: 8px; }
          .meta-line { white-space: nowrap; }
          .uline { display:inline-block; min-width: 160px; padding: 0 4px; }
          table.opinions { width:100%; border-collapse: collapse; margin-top: 6px; }
          table.opinions td { vertical-align: top; padding: 8px; }
          .labelbox { font-weight: 700; margin-bottom: 6px; text-align:center }
          .control-row { display:flex; gap: 12px; align-items:center; justify-content: center; flex-wrap: wrap; margin-top: 8px; text-align: center; }
          .control-col { display:flex; flex-direction: column; align-items:center; gap: 6px; margin-top: 8px; text-align:center; }
          .sign-block { display:flex; flex-direction: column; align-items:center; gap: 4px; }
          .sign-box { width: 180px; height: 70px; display:flex; align-items:flex-end; justify-content:center; }
          .sign-img { max-height: 64px; max-width: 100%; object-fit: contain; }
          .print-hide { }
          .control-row label { white-space:nowrap; }
          input[type="date"], select.sig-select { border: 1px solid #888; padding: 4px 6px; font: inherit; }
          .note-reply { text-align:center; margin: 6px 0 10px; font-weight:600; }
          @media print {
            body { background: #fff; }
            .toolbar { display: none; }
            .sheet { box-shadow: none; width: auto; height: auto; margin: 0; }
            .page-content { padding: 0; }
            .margin-guide { display: none; }
            .editable { outline: none; padding: 0; }
            input[type="date"], select.sig-select { border: none; padding: 0; appearance: none; -webkit-appearance: none; background: transparent; }
            .print-hide { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button class="btn" onclick="window.print()">ព្រីន</button>
          <button class="btn" onclick="window.parent.postMessage({type:'close-form'},window.location.origin)">បិទផ្ទាំង</button>
        </div>
        <div class="sheet">
          <div class="margin-guide"></div>
          <div class="page-content">
          <div class="title" style="text-align:center;font-family:'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif;font-weight:normal;font-size:18px;">ព្រះរាជាណាចក្រកម្ពុជា</div>
          <div class="title" style="text-align:center;font-family:'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif;font-weight:normal;font-size:18px;">ជាតិ សាសនា ព្រះមហាក្សត្រ</div>
          <div class="title" style="text-align:left;font-family:'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif;font-weight:normal;font-size:18px;">ក្រសួងសុខាភិបាល</div>
            <div class="title" style="text-align:left;font-family:'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif;font-weight:normal;font-size:16px;">មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត</div>
            <div class="title" style="text-align:center;font-family:'Khmer OS Muol Light','Noto Sans Khmer','Khmer OS','Hanuman',Arial,sans-serif;font-weight:normal;font-size:16px;">កំណត់បង្ហាញ</div>
            <div class="field"><span class="label">លេខលិខិតចូល:</span> <span class="value">${it.letterNumber || ''} ${it.date ? fmtDateKh(it.date) : ''}</span></div>
            <div class="field"><span class="label">មកពី:</span> <span class="value">${it.source || ''}</span></div>
            <div class="field"><span class="label">កម្មវត្ថុ:</span> <span class="value-plain">${it.content || ''}</span></div>
            <div class="section-title" style="text-align:center;">យោបល់ការិយាល័យជំនាญ</div>
            <table class="opinions">
              <tr>
                <td colspan="2">
                  <div class="content-wrap${editable ? ' editable' : ''}" ${editable ? 'contenteditable="true"' : ''}>${(it.officeOpinion || it.content || '&nbsp;')}</div>
                  <div class="control-row">
                     <label>ថ្ងៃខែឆ្នាំ:</label>
                      ${editable ? `<input type="date" value="${fmtDate(it.officeDate)}" />` : `<span class=\"uline\">${it.officeDate ? fmtDateKh(it.officeDate) : ''}</span>`}
                    <div class="sign-block">
                      <label>ហត្ថលេខា:</label>
                      <div class="sign-box">
                        <img id="sign-office" class="sign-img" src="${it.officeSignUrl || ''}" alt="" />
                      </div>
                      ${editable ? `<input id="file-office" class="print-hide" type="file" accept="image/*" />` : ''}
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td>
                  <div class="labelbox">យោបល់នាយករងទទួលបន្ទុក</div>
                  <div class="${editable ? 'editable' : ''}" ${editable ? 'contenteditable="true"' : ''}>${it.deputyOpinion1 || '&nbsp;'}</div>
                  <div class="control-col">
                    <div>
                      <label>ថ្ងៃខែឆ្នាំ:</label>
                      ${editable ? `<input type="date" value="${fmtDate(it.deputyDate1)}" />` : `<span class=\"uline\">${it.deputyDate1 ? fmtDateKh(it.deputyDate1) : ''}</span>`}
                    </div>
                    <div class="sign-block">
                      <label>ហត្ថលេខា:</label>
                      <div class="sign-box">
                        <img id="sign-deputy1" class="sign-img" src="${it.deputySign1Url || ''}" alt="" />
                      </div>
                      ${editable ? `<input id="file-deputy1" class="print-hide" type="file" accept="image/*" />` : ''}
                    </div>
                  </div>
                </td>
                <td>
                  <div class="labelbox">យោបល់នាយករងទទួលបន្ទុក</div>
                  <div class="${editable ? 'editable' : ''}" ${editable ? 'contenteditable="true"' : ''}>${it.deputyOpinion2 || '&nbsp;'}</div>
                  <div class="control-col">
                    <div>
                      <label>ថ្ងៃខែឆ្នាំ:</label>
                      ${editable ? `<input type="date" value="${fmtDate(it.deputyDate2)}" />` : `<span class=\"uline\">${it.deputyDate2 ? fmtDateKh(it.deputyDate2) : ''}</span>`}
                    </div>
                    <div class="sign-block">
                      <label>ហត្ថលេខា:</label>
                      <div class="sign-box">
                        <img id="sign-deputy2" class="sign-img" src="${it.deputySign2Url || ''}" alt="" />
                      </div>
                      ${editable ? `<input id="file-deputy2" class="print-hide" type="file" accept="image/*" />` : ''}
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td colspan="2">
                  <div class="labelbox">យោបល់នាយកមន្ទីរពេទ្យ</div>
                  <div class="${editable ? 'editable' : ''}" ${editable ? 'contenteditable="true"' : ''}>${it.directorOpinion || '&nbsp;'}</div>
                  <div class="control-col">
                    <div>
                      <label>ថ្ងៃខែឆ្នាំ:</label>
                      ${editable ? `<input type="date" value="${fmtDate(it.directorDate)}" />` : `<span class=\"uline\">${it.directorDate ? fmtDateKh(it.directorDate) : ''}</span>`}
                    </div>
                    <div class="sign-block">
                      <label>ហត្ថលេខា:</label>
                      <div class="sign-box">
                        <img id="sign-director" class="sign-img" src="${it.directorSignUrl || ''}" alt="" />
                      </div>
                      ${editable ? `<input id="file-director" class="print-hide" type="file" accept="image/*" />` : ''}
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          ${editable ? `
          <script>
            (function(){
              var ids = ['office','deputy1','deputy2','director'];
              ids.forEach(function(k){
                var file = document.getElementById('file-' + k);
                var img = document.getElementById('sign-' + k);
                if (!file || !img) return;
                file.addEventListener('change', function(e){
                  var f = e.target.files && e.target.files[0];
                  if (!f) return;
                  var r = new FileReader();
                  r.onload = function(ev){ img.src = ev.target.result; };
                  r.readAsDataURL(f);
                });
              });
            })();
          </script>
          ` : ''}
          </div>
        </div>
      </body>
    </html>`;
}
