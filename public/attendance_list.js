function safeParseNotes(n){
  if (!n) return {};
  if (typeof n === 'object') return n;
  try { return JSON.parse(n); } catch { return {}; }
}

function toDisplayDate(iso){
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0,10);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function toIsoDate(v){
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0,10);
}

function getApprovedValue(it){
  const notes = safeParseNotes(it.notes);
  return it.approved || notes.approved || '';
}

function applyClientFilters(items, filter){
  const createdFrom = (filter.createdFrom || '').trim();
  const createdTo = (filter.createdTo || '').trim();
  const approved = (filter.approved || '').trim();
  const notesQuery = (filter.notes || '').trim().toLowerCase();

  return items.filter(it => {
    // Filter by createdAt range if provided
    if (createdFrom || createdTo) {
      const createdIso = toIsoDate(it.createdAt);
      if (!createdIso) return false;
      if (createdFrom && createdIso < createdFrom) return false;
      if (createdTo && createdIso > createdTo) return false;
    }

    // Filter by admin approval status
    if (approved) {
      const val = getApprovedValue(it);
      // When user chooses "រង់ចាំមតិ" (pending), treat both
      // empty value and explicit 'pending' as waiting status.
      if (approved === 'pending') {
        if (val === 'approved' || val === 'rejected') return false;
      } else {
        if (val !== approved) return false;
      }
    }

    // Filter by notes text (exact match from dropdown)
    if (notesQuery) {
      const notesObj = safeParseNotes(it.notes);
      const text = ((notesObj.notes || it.notes || '') + '').toLowerCase();
      // From dropdown we want exact match (e.g. only "ភ្លេច")
      if (text !== notesQuery) return false;
    }

    return true;
  });
}

async function load(filter){
  const q = new URLSearchParams();
  if (filter.staffId) q.set('staffId', filter.staffId);
  if (filter.from) q.set('from', filter.from);
  if (filter.to) q.set('to', filter.to);
  const url = '/api/attendance' + (q.toString() ? '?' + q.toString() : '');
  document.getElementById('status').textContent = 'Loading...';
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Server returned ' + r.status);
    let rawItems = await r.json();
    // Update notes dropdown with all distinct note values from raw data
    try {
      const sel = document.getElementById('filterNotes');
      if (sel) {
        const prev = sel.value;
        const set = new Set();
        rawItems.forEach(it => {
          const n = safeParseNotes(it.notes);
          const txt = (n.notes || it.notes || '').toString().trim();
          if (txt) set.add(txt);
        });
        const currentNotes = Array.from(set).sort();
        sel.innerHTML = '<option value="">កំណត់សម្គាល់ទាំងអស់</option>' +
          currentNotes.map(v => '<option value="' + v.replace(/"/g,'&quot;') + '">' + v.replace(/</g,'&lt;') + '</option>').join('');
        if (prev && currentNotes.includes(prev)) sel.value = prev;
      }
    } catch (e) {}

    let items = applyClientFilters(rawItems, filter || {});
    render(items);
    document.getElementById('status').textContent = `Loaded ${items.length} rows`;
  } catch (e) {
    document.getElementById('status').textContent = 'Error: ' + e.message;
  }
}

function render(items){
  const tb = document.querySelector('#attTable tbody');
  tb.innerHTML = '';
  items.forEach(it => {
    const notes = safeParseNotes(it.notes);
    const fullName = notes.fullName || it.fullName || '';
    const latinName = it.latinName || it.staffName || it.name || '';
    const approvedCode = it.approved || notes.approved || '';
    const tr = document.createElement('tr');
    const date = toDisplayDate(it.date);
    const created = toDisplayDate(it.createdAt);
    const id = it._id || it.id || '';
    let approveCellHtml = '';
    if (id) {
      const code = String(approvedCode || '');
      const opt = (value, label) => `<option value="${value}" ${code===value?'selected':''}>${label}</option>`;
      approveCellHtml = `<select class="approveSelectList" data-id="${escapeHtml(id)}" data-prev="${escapeHtml(code)}">
        ${opt('', 'រង់ចាំមតិ')}
        ${opt('approved', 'បានយល់ព្រម')}
        ${opt('pending', 'រង់ចាំមតិ')}
        ${opt('rejected', 'មិនព្រម')}
      </select>`;
    } else {
      // Fallback: show text only when no id
      let approvedText;
      if (!approvedCode) approvedText = 'រង់ចាំមតិ';
      else if (approvedCode === 'approved') approvedText = 'បានយល់ព្រម';
      else if (approvedCode === 'pending') approvedText = 'រង់ចាំមតិ';
      else if (approvedCode === 'rejected') approvedText = 'មិនព្រម';
      else approvedText = approvedCode;
      approveCellHtml = escapeHtml(approvedText);
    }

    tr.innerHTML = `<td>${escapeHtml(it.staffId||'')}</td>
      <td>${escapeHtml(fullName)}</td>
      <td>${escapeHtml(latinName)}</td>
      <td>${escapeHtml(date)}</td>
      <td>${escapeHtml(created)}</td>
      <td>${escapeHtml(it.checkIn||it.inTime||'')}</td>
      <td>${escapeHtml(it.checkOut||it.outTime||'')}</td>
      <td>${approveCellHtml}</td>
      <td>${escapeHtml((notes.notes || it.notes || ''))}</td>`;
    tb.appendChild(tr);
  });

  // Attach handlers to approval selects for manual update
  Array.from(document.querySelectorAll('.approveSelectList')).forEach(sel => {
    sel.onchange = async (ev) => {
      const s = ev.target;
      const id = s.getAttribute('data-id');
      const prev = s.getAttribute('data-prev') || '';
      const newVal = s.value || '';
      if (!id) return;
      s.disabled = true;
      try {
        const resp = await fetch('/api/attendance/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: newVal })
        });
        if (!resp.ok) throw new Error('Server ' + resp.status);
        s.setAttribute('data-prev', newVal);
      } catch (err) {
        // revert to previous value on error
        s.value = prev;
        alert('Failed to update approval: ' + (err.message || err));
      } finally {
        s.disabled = false;
      }
    };
  });
}

function escapeHtml(s){
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function toCSV(rows){
  // Match desired Excel layout: Staff ID, Name, Date, Timetable, Checkin, Checkout
  const header = ['Staff ID','Name','Date','Timetable','Checkin','Checkout'];
  const lines = [header.join(',')];

  const toTimeStr = (v) => {
    if (!v) return '';
    return String(v).trim();
  };

  const getTimetable = (it) => {
    const t = toTimeStr(it.checkIn || it.inTime || it.checkOut || it.outTime || '');
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return '';
    const hour = Number(m[1]);
    if (!Number.isFinite(hour)) return '';
    return hour < 12 ? 'Morning' : 'Afternoon';
  };

  rows.forEach(it=>{
    const notes = safeParseNotes(it.notes);
    const khName = notes.fullName || it.fullName || '';
    const latinName = it.latinName || it.staffName || it.name || khName || '';
    const dateDisp = toDisplayDate(it.date); // dd/mm/yyyy
    const checkIn = toTimeStr(it.checkIn || it.inTime || '');
    const checkOut = toTimeStr(it.checkOut || it.outTime || '');

    // If both check-in and check-out exist, export as two rows:
    // Morning row (check-in) and Afternoon row (check-out),
    // to match the template with separate Morning/Afternoon lines.
    if (checkIn && checkOut) {
      const rowMorning = [it.staffId||'', latinName, dateDisp, 'Morning', checkIn, ''];
      const rowAfternoon = [it.staffId||'', latinName, dateDisp, 'Afternoon', '', checkOut];
      [rowMorning, rowAfternoon].forEach(cols => {
        lines.push(cols.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','));
      });
      return;
    }

    // If only one time exists, decide Morning/Afternoon from that time
    // and place it into the most appropriate column.
    if (checkIn || checkOut) {
      const timeVal = checkIn || checkOut;
      const temp = {
        staffId: it.staffId,
        checkIn: checkIn,
        inTime: checkIn,
        checkOut: checkOut,
        outTime: checkOut
      };
      const timetable = getTimetable(temp) || '';
      let outCheckIn = '';
      let outCheckOut = '';
      if (timetable === 'Morning') {
        outCheckIn = timeVal;
      } else if (timetable === 'Afternoon') {
        outCheckOut = timeVal;
      } else {
        // Fallback: keep as check-in
        outCheckIn = timeVal;
      }
      const cols = [it.staffId||'', latinName, dateDisp, timetable, outCheckIn, outCheckOut];
      lines.push(cols.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','));
    }
  });
  return lines.join('\n');
}

(function(){
  const btn = document.getElementById('btnLoad');
  const btnCsv = document.getElementById('btnCSV');
  const staff = document.getElementById('filterStaff');
  const createdFrom = document.getElementById('createdFrom');
  const createdTo = document.getElementById('createdTo');
  const notesInput = document.getElementById('filterNotes');
  const approvedSel = document.getElementById('filterApproved');

  const doLoad = async ()=>{
    await load({
      staffId: staff.value.trim(),
      from: '',
      to: '',
      createdFrom: createdFrom.value.trim(),
      createdTo: createdTo.value.trim(),
      notes: notesInput.value.trim(),
      approved: approvedSel.value
    });
  };

  btn.addEventListener('click', doLoad);
  // initial load
  doLoad();

  btnCsv.addEventListener('click', async ()=>{
    const q = new URLSearchParams();
    if (staff.value.trim()) q.set('staffId', staff.value.trim());
    const url = '/api/attendance' + (q.toString() ? '?' + q.toString() : '');
    const r = await fetch(url);
    if (!r.ok) return alert('Failed to download CSV');
    let items = await r.json();
    items = applyClientFilters(items, {
      createdFrom: createdFrom.value.trim(),
      createdTo: createdTo.value.trim(),
      notes: notesInput.value.trim(),
      approved: approvedSel.value
    });
    // Add UTF-8 BOM so Excel shows Khmer correctly
    const csv = '\uFEFF' + toCSV(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attendance.csv';
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
