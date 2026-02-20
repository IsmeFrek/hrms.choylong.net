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
function norm(v) { try { return String(v || '').trim().toLowerCase(); } catch(e){ return ''; } }
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
function normSkill(s) { try { return String(s || '').trim().replace(/\s+/g,' ').toLowerCase(); } catch { return ''; } }
(async () => {
  try {
    const L = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(login) } }, login);
    const tok = JSON.parse(L.body).token;
    const H = await req({ hostname: 'localhost', port: 5000, path: '/api/hr', method: 'GET', headers: { 'Authorization': 'Bearer ' + tok } });
    const list = JSON.parse(H.body || '[]');
    const asOf = '2026-01-21';
    const active = list.filter(hr => isActiveAsOf(hr, asOf));
    // technical if skill/technicalRole/specialty present and non-empty after normalization
    const technical = active.filter(hr => {
      const s = normSkill(hr.skill || hr.technicalRole || hr.specialty || '');
      return !!s;
    });
    // dedupe by primary id fields
    const seen = new Set();
    const union = [];
    for (const hr of technical) {
      const key = hr._id || hr.staffId || hr.officerId || hr.cardNumber || (hr.name ? hr.name.trim() : JSON.stringify(hr));
      if (seen.has(key)) continue; seen.add(key); union.push(hr);
    }
    const result = { asOf, technicalTotal: union.length };
    fs.writeFileSync('scripts/technical_count_result.json', JSON.stringify(result, null, 2));
    console.log('Wrote scripts/technical_count_result.json');
  } catch (e) {
    console.error('Error:', e && (e.stack || e.message || e));
    process.exitCode = 2;
  }
})();
