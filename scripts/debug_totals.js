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
    const list = JSON.parse(H.body) || [];
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

    const active = list.filter(hr => isActiveAsOf(hr, asOf));
    const civil = active.filter(hr => !isStateType(hr.officerType) && !isHospitalType(hr.officerType) && !isPartTimeType(hr.officerType) && !isWorkerType(hr.officerType));
    const state = active.filter(hr => isStateType(hr.officerType));
    const hospital = active.filter(hr => isHospitalType(hr.officerType));
    const partTime = active.filter(hr => isPartTimeType(hr.officerType));
    const worker = active.filter(hr => isWorkerType(hr.officerType));

    const keyOf = (hr) => (hr._id || hr.staffId || hr.officerId || hr.cardNumber || (hr.name ? hr.name.trim() : null) || JSON.stringify(hr));

    // build sets
    const setActive = new Set(active.map(keyOf));
    const setCivil = new Set(civil.map(keyOf));
    const setState = new Set(state.map(keyOf));
    const setHospital = new Set(hospital.map(keyOf));
    const setPartTime = new Set(partTime.map(keyOf));
    const setWorker = new Set(worker.map(keyOf));

    // hospitalPlus union
    const hospitalPlusList = [];
    const seen = new Set();
    for (const hr of hospital.concat(partTime, worker)) {
      const k = keyOf(hr);
      if (seen.has(k)) continue; seen.add(k); hospitalPlusList.push(hr);
    }
    const setHospitalPlus = new Set(hospitalPlusList.map(keyOf));

    const sumComponents = setCivil.size + setState.size + setHospitalPlus.size;

    console.log('\nACTIVE total:', setActive.size);
    console.log('civil:', setCivil.size, 'state:', setState.size, 'hospitalPlus:', setHospitalPlus.size, 'sumComponents:', sumComponents);

    const extra = sumComponents - setActive.size;
    console.log('difference (components - active):', extra);

    // find overlaps between sets (should be zero)
    const intersect = (A, B) => Array.from(A).filter(x => B.has(x));
    const civ_hp = intersect(setCivil, setHospitalPlus);
    const state_hp = intersect(setState, setHospitalPlus);
    const civ_state = intersect(setCivil, setState);

    console.log('\noverlaps: civil∩hospitalPlus:', civ_hp.length, 'state∩hospitalPlus:', state_hp.length, 'civil∩state:', civ_state.length);

    // list sample of overlapping records (with officerType and staffId/name)
    const idToHr = new Map(); for (const hr of active) idToHr.set(keyOf(hr), hr);
    const sample = (arr) => arr.slice(0,10).map(k => ({ key: k, staffId: idToHr.get(k)?.staffId || idToHr.get(k)?._id || null, name: idToHr.get(k)?.name || idToHr.get(k)?.khmerName || null, officerType: idToHr.get(k)?.officerType || null }));
    console.log('\nSample civil∩hospitalPlus:', JSON.stringify(sample(civ_hp), null, 2));
    console.log('\nSample state∩hospitalPlus:', JSON.stringify(sample(state_hp), null, 2));
    console.log('\nSample civil∩state:', JSON.stringify(sample(civ_state), null, 2));

    // find active items not present in union of components
    const unionComp = new Set([...setCivil, ...setState, ...setHospitalPlus]);
    const missing = Array.from(setActive).filter(k => !unionComp.has(k));
    console.log('\nactive items not in components (should be 0):', missing.length, JSON.stringify(sample(missing), null, 2));

    // if extra > 0, show which keys are duplicated across components
    if (extra !== 0) {
      // duplicates counted multiple times: find keys appearing in more than one component
      const counts = new Map();
      for (const k of setCivil) counts.set(k, (counts.get(k) || 0) + 1);
      for (const k of setState) counts.set(k, (counts.get(k) || 0) + 1);
      for (const k of setHospitalPlus) counts.set(k, (counts.get(k) || 0) + 1);
      const duplicated = Array.from(counts.entries()).filter(([k,v]) => v > 1).map(([k,v]) => ({ key:k, times:v, hr: idToHr.get(k)}));
      console.log('\nduplicated entries across components (sample 20):', JSON.stringify(duplicated.slice(0,20), null, 2));
    }

  } catch (e) { console.error('ERROR', e && e.stack ? e.stack : e); }
})();
