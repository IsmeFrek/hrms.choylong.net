const http = require('http');
const url = 'http://localhost:5000/api/attendance/day-data?date=2026-02-05';
http.get(url, (res) => {
  console.log('STATUS', res.statusCode);
  console.log('HEADERS', res.headers['content-type']);
  let data='';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try { console.log('BODY:', data.slice(0, 200)); }
    catch(e) { console.log('BODY (binary)'); }
    process.exit(res.statusCode === 200 ? 0 : 2);
  });
}).on('error', (e) => {
  console.error('ERR', e.message);
  process.exit(3);
});
