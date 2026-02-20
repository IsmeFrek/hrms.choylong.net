const http = require('http');
const login = JSON.stringify({ identifier: 'admin@hospital.com', password: 'admin123' });
function req(opt, body) {
  return new Promise((res, rej) => {
    const r = http.request(opt, resp => {
      let b = '';
      resp.on('data', c => b += c);
      resp.on('end', () => res({ status: resp.statusCode, body: b }));
    });
    r.on('error', e => rej(e));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  try {
    const L = await req({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(login) } }, login);
    const tok = JSON.parse(L.body).token;
    const H = await req({ hostname: 'localhost', port: 5000, path: '/api/hr', method: 'GET', headers: { 'Authorization': 'Bearer ' + tok } });
    const list = JSON.parse(H.body);
    const parseDate = (v) => { if (!v) return null; const d = new Date(v); if (isNaN(d.getTime())) return null; return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
    const asOf = '2026-01-21';
    const normOfficerType = (v) => { if (!v) return ''; try { return String(v).trim().toLowerCase(); } catch { return ''; } };
    const isStateType = (v) => { const n = normOfficerType(v); return n === 'កិច្ចសន្យារដ្ឋ' || n.includes('រដ្ឋ') || n.includes('state'); };
    const isHospitalType = (v) => { const n = normOfficerType(v); return n === 'កិច្ចសន្យាមន្ទីរពេទ្យ' || n.includes('មន្ទីរពេទ្យ') || n.includes('hospital'); };
    const isPartTimeType = (v) => { const n = normOfficerType(v); return n === 'កិច្ចសន្យាក្រៅម៉ោង' || n.includes('ក្រៅម៉ោង') || n.includes('part'); };
    const isWorkerType = (v) => { const n = normOfficerType(v); return n === 'កម្មករកិច្ចសន្យា' || n.includes('កម្មករ') || n.includes('worker'); };
    const isActiveAsOf = (hr, asOf) => {
      if (!hr) return false;
      if (((hr.status || '').toString().toLowerCase()) !== 'active') return false;
      if (((hr.status || '').toString().toLowerCase()) === 'deleted') return false;
      const asDate = parseDate(asOf);
      if (asDate) {
        const join = parseDate(hr.joinDate) || parseDate(hr.dateJoinedMinistry) || parseDate(hr.nominationStartDate) || null;
        if (join && join > asDate) return false;
        const resign = parseDate(hr.resignDate) || null;
        if (resign && resign <= asDate) return false;
      }
      return true;
    };
    const asOfFiltered = list.filter(hr => isActiveAsOf(hr, asOf));
    const count = (arr) => ({ total: arr.length, male: arr.filter(x => x.gender === 'Male' || x.gender === 'ប្រុស').length, female: arr.filter(x => x.gender === 'Female' || x.gender === 'ស្រី').length });
    const civil = asOfFiltered.filter(hr => !isStateType(hr.officerType) && !isHospitalType(hr.officerType) && !isPartTimeType(hr.officerType) && !isWorkerType(hr.officerType));
    const state = asOfFiltered.filter(hr => isStateType(hr.officerType));
    const hospital = asOfFiltered.filter(hr => isHospitalType(hr.officerType));
    const partTime = asOfFiltered.filter(hr => isPartTimeType(hr.officerType));
    const worker = asOfFiltered.filter(hr => isWorkerType(hr.officerType));
    const hospitalPlusItems = (function () { const seen = new Set(); const items = []; for (const hr of hospital.concat(partTime, worker)) { const key = hr._id || hr.staffId || hr.officerId || hr.cardNumber || (hr.name ? hr.name.trim() : null) || JSON.stringify(hr); if (seen.has(key)) continue; seen.add(key); items.push(hr); } return items; })();
    const grandAll = count(asOfFiltered);
    console.log('ACTIVE AS-OF:', asOf);
    console.log('grandAll', grandAll, '\ncomponents:', { civil: count(civil), state: count(state), hospitalPlus: count(hospitalPlusItems) }, '\nsum=', (count(civil).total + count(state).total + count(hospitalPlusItems).total));
  } catch (e) { console.error(e); }
})();
