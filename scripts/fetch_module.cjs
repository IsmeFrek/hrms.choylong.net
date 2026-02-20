const https = require('https');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const url = 'https://localhost:5173/src/pages/DailyReportsPage.jsx';
https.get(url, { rejectUnauthorized: false }, (res) => {
  console.log('STATUS', res.statusCode);
  console.log('CT', res.headers['content-type']);
  let d='';
  res.on('data', c => d += c.toString());
  res.on('end', () => {
    console.log('LEN', d.length);
    console.log(d.slice(0, 200));
    process.exit(res.statusCode === 200 ? 0 : 2);
  });
}).on('error', (e) => { console.error('ERR', e.message); process.exit(3); });
