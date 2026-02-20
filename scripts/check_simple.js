const fs = require('fs');
const p = 'd:/DB/web_V4/src/pages/ReplayfilePage.jsx';
try{
  const s = fs.readFileSync(p,'utf8');
  console.log('OK length', s.length);
} catch(e){
  console.error('ERR', e && e.message);
  process.exit(2);
}
