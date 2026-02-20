#!/usr/bin/env node
// Usage: node scripts/export_department_employees.js "Department Name" [http://localhost:5000]
// Writes CSV to stdout.

const deptArg = process.argv[2] || 'មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត';
const base = process.argv[3] || 'http://localhost:5000';

async function fetchAll() {
  const url = base.replace(/\/+$/, '') + '/hr';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch ' + url + ' : ' + resp.status);
  return await resp.json();
}

function pickField(obj, keys) {
  for (const k of keys) {
    if (!obj) continue;
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return '';
}

function fmtDate(d) {
  if (!d) return '';
  try { const dt = new Date(d); if (isNaN(dt.getTime())) return String(d).slice(0,10); const dd = String(dt.getDate()).padStart(2,'0'); const mm = String(dt.getMonth()+1).padStart(2,'0'); const yyyy = dt.getFullYear(); return `${dd}/${mm}/${yyyy}`; } catch { return String(d); }
}

function toCSV(rows) {
  const hdr = ['ស.រ','ល.រ','គោត្តនាម និងនាម','ភេទ','ថ្ងៃខែឆ្នាំកំណើត','កាំប្រាក់','អត្តលេខមន្ត្រី','ជំនាញបច្ចេកទេស','តួនាទី','ផ្នែក','លេខទូរស័ព្ទ','កាលបរិច្ឆេទចូលបម្រើការងារ','ទីកន្លែងកំណើត/ទីកន្លែងបច្ចុប្បន្ន'];
  const lines = [hdr.join(',')];
  rows.forEach((r, idx) => {
    const cols = [
      String(idx+1), // ស.រ
      r.no || r.serial || '', // ល.រ (fallbacks)
      (r.fullName || r.name || r.khName || r['គោត្តនាម'] || '').replace(/"/g,'""'),
      (r.gender || r.sex || '').replace(/"/g,'""'),
      fmtDate(r.dob || r.birthDate || r['ថ្ងៃខែឆ្នាំកំណើត']),
      (r.salaryLevel || r.kamPrak || r.salaryScale || '').replace(/"/g,'""'),
      (r.staffId || r.employeeId || r.officerNo || r.id || '').replace(/"/g,'""'),
      (r.skill || r.skills || r.technicalSkill || '').replace(/"/g,'""'),
      (r.position || r.title || '').replace(/"/g,'""'),
      (r.department || r.departmentName || r.unit || '').replace(/"/g,'""'),
      (r.phone || r.mobile || r.tel || r.contact || '').replace(/"/g,'""'),
      fmtDate(pickField(r, ['joinDate','dateJoinedMinistry','nominationStartDate','startDate','joinedDate'])),
      ((r.placeOfBirth || r.birthPlace || r.address || r.currentAddress || '')).replace(/"/g,'""')
    ];
    // wrap each field in quotes
    lines.push(cols.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','));
  });
  return lines.join('\n');
}

(async ()=>{
  try {
    const all = await fetchAll();
    const arr = Array.isArray(all) ? all : (all.data || []);
    const filtered = arr.filter(hr => {
      const dept = (hr.department || hr.departmentName || hr.unit || '');
      if (!dept) return false;
      return String(dept).toLowerCase().includes(String(deptArg).toLowerCase());
    });
    if (filtered.length === 0) {
      console.error('No matches for department', deptArg, '(fetched', arr.length, 'records)');
    }
    const csv = toCSV(filtered);
    console.log(csv);
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
})();
