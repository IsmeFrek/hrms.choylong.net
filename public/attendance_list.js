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
    const items = await r.json();
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
    const approved = it.approved || notes.approved || '';
    const tr = document.createElement('tr');
    const date = toDisplayDate(it.date);
    tr.innerHTML = `<td>${escapeHtml(it.staffId||'')}</td>
      <td>${escapeHtml(fullName)}</td>
      <td>${escapeHtml(date)}</td>
      <td>${escapeHtml(it.checkIn||it.inTime||'')}</td>
      <td>${escapeHtml(it.checkOut||it.outTime||'')}</td>
      <td>${escapeHtml(approved)}</td>
      <td>${escapeHtml((notes.notes || it.notes || ''))}</td>`;
    tb.appendChild(tr);
  });
}

function escapeHtml(s){
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function toCSV(rows){
  const header = ['staffId','fullName','date','checkIn','checkOut','approved','notes'];
  const lines = [header.join(',')];
  rows.forEach(it=>{
    const notes = safeParseNotes(it.notes);
    const fullName = notes.fullName || it.fullName || '';
    const approved = it.approved || notes.approved || '';
    const date = it.date ? it.date.slice(0,10) : '';
    const cols = [it.staffId||'', fullName, date, it.checkIn||it.inTime||'', it.checkOut||it.outTime||'', approved, notes.notes||it.notes||''];
    lines.push(cols.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','));
  });
  return lines.join('\n');
}

(function(){
  const btn = document.getElementById('btnLoad');
  const btnCsv = document.getElementById('btnCSV');
  const staff = document.getElementById('filterStaff');
  const from = document.getElementById('fromDate');
  const to = document.getElementById('toDate');

  const doLoad = async ()=>{
    await load({ staffId: staff.value.trim(), from: from.value.trim(), to: to.value.trim() });
  };

  btn.addEventListener('click', doLoad);
  // initial load
  doLoad();

  btnCsv.addEventListener('click', async ()=>{
    const q = new URLSearchParams();
    if (staff.value.trim()) q.set('staffId', staff.value.trim());
    if (from.value.trim()) q.set('from', from.value.trim());
    if (to.value.trim()) q.set('to', to.value.trim());
    const url = '/api/attendance' + (q.toString() ? '?' + q.toString() : '');
    const r = await fetch(url);
    if (!r.ok) return alert('Failed to download CSV');
    const items = await r.json();
    const csv = toCSV(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'attendance.csv';
    document.body.appendChild(a); a.click(); a.remove();
  });
})();
