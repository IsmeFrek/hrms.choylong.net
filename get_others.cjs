const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('kshf_hospital_app');
  const employees = await db.collection('hrs').find({}).toArray();
  const skills = await db.collection('skills').find({}).toArray();
  const skillSet = new Set(skills.map(s => (s.skills_Kh || '').toString().trim().toLowerCase()));
  
  const isWorkerType = (v) => { const n = (v||'').trim(); return n === 'កម្មករកិច្ចសន្យា' || n.includes('កម្មករ') || n.includes('worker'); };
  const isCivil = (hr) => { 
    const n=(hr.officerType||'').trim(); 
    return n!=='កិច្ចសន្យារដ្ឋ' && n!=='កិច្ចសន្យាមន្ទីរពេទ្យ' && !n.includes('hospital') && n!=='កិច្ចសន្យាក្រៅម៉ោង' && !n.includes('part-time') && !isWorkerType(n); 
  };
  
  for(const hr of employees) {
    if(hr.status && (hr.status.toLowerCase().includes('resign')||hr.status.toLowerCase().includes('left')) || hr.resignDate) continue;
    if(!isCivil(hr)) continue;
    const hs = (hr.skill||'').trim().toLowerCase();
    if(!hs || (!skillSet.has(hs) && hs !== 'ផ្សេងៗ')) {
      console.log(hr.name + ' - ' + hr.khmerName + ' - ' + hr.officerType + ' - Skill: ' + hr.skill);
    }
  }
  await client.close();
}
run();
