const http = require('http');
const fs = require('fs');
const login = JSON.stringify({ identifier: 'admin@hospital.com', password: 'admin123' });
function req(opt, body) {
  return new Promise((res, rej) => {
    const r = http.request(opt, resp => {
      let b = '';
      resp.on('data', c => (b += c));
      resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', e => rej(e));
    if (body) r.write(body);
    r.end();
  });
}
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function norm(v) {
  try {
    return String(v || '').trim().toLowerCase();
  } catch (e) {
    return '';
  }
}
function isHospitalType(v) {
  const n = norm(v);
  return n.includes('hospital') || n.includes('មន្ទីរ') || n.includes('clinic');
}
function isWorkerType(v) {
  const n = norm(v);
  return n.includes('worker') || n.includes('កម្មករ');
}
function isActiveAsOf(hr, asOf) {
  if (!hr) return false;
  const s = (hr.status || '').toString().toLowerCase();
  if (s === 'deleted' || s === 'resigned' || s === 'resign' || s === 'left' || s === 'terminated') return false;
  if (s !== 'active') return false;
  const as = parseDate(asOf);
  if (as) {
    const join = parseDate(hr.joinDate) || parseDate(hr.dateJoined) || (hr.nominationStartDate ? parseDate(hr.nominationStartDate) : null);
    if (join && join > as) return false;
    const resign = parseDate(hr.resignDate) || parseDate(hr.retireDate) || parseDate(hr.retiredDate) || parseDate(hr.retirementDate) || parseDate(hr.leaveDate) || null;
    if (resign && resign <= as) return false;
  }
  return true;
}
function ageOf(hr, asOf) {
  const b = hr.birthDate || hr.dob || hr.dateOfBirth || hr.birthdate;
  const bd = parseDate(b);
  if (!bd) return null;
  const a = new Date(asOf);
  let age = a.getFullYear() - bd.getFullYear();
  const m = a.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && a.getDate() < bd.getDate())) age--;
  return age;
}
(async () => {
  try {
    const L = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(login) } }, login);
    const tok = JSON.parse(L.body).token;
    const H = await req({ hostname: 'localhost', port: 5000, path: '/api/hr', method: 'GET', headers: { 'Authorization': 'Bearer ' + tok } });
    const list = JSON.parse(H.body || '[]');
    const asOf = '2026-01-21';
    const active = list.filter(hr => isActiveAsOf(hr, asOf));
    const hospital = active.filter(hr => isHospitalType(hr.officerType));
    const worker = active.filter(hr => isWorkerType(hr.officerType));
    const union = (function () {
      const seen = new Set();
      const out = [];
      for (const hr of hospital.concat(worker)) {
        const key = hr._id || hr.staffId || hr.officerId || hr.cardNumber || (hr.name ? hr.name.trim() : JSON.stringify(hr));
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(hr);
      }
      return out;
    })();
    const countAge = (arr, cond) => arr.reduce((s, hr) => { const age = ageOf(hr, asOf); if (age === null) return s; return cond(age) ? s + 1 : s; }, 0);
    const retiredContinued = union.filter(hr => (hr.retireDate || hr.retiredDate || hr.retirementDate || hr.retire_on || hr.resignDate) && (hr.status || '').toString().toLowerCase() === 'active');
    const result = {
      asOf,
      activeTotal: active.length,
      hospitalCount: hospital.length,
      workerCount: worker.length,
      unionDedup: union.length,
      unionAgeOver60: countAge(union, a => a > 60),
      unionAge60OrBelow: countAge(union, a => a <= 60),
      unionNoAge: union.filter(hr => ageOf(hr, asOf) === null).length,
      retiredThenContinuedCount: retiredContinued.length,
      retiredThenContinuedSamples: retiredContinued.slice(0, 30).map(hr => ({ id: hr._id || hr.staffId || hr.officerId || null, name: hr.name, age: ageOf(hr, asOf), retireDate: hr.retireDate || hr.retiredDate || hr.retirementDate || hr.retire_on || hr.resignDate, officerType: hr.officerType }))
    };
    fs.writeFileSync('scripts/debug_totals_result.json', JSON.stringify(result, null, 2));
    console.log('Wrote scripts/debug_totals_result.json');
  } catch (e) {
    console.error('Error:', e && (e.stack || e.message || e));
    process.exitCode = 2;
  }
})();
