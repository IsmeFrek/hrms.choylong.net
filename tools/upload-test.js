import fs from 'fs';
import path from 'path';


(async () => {
  try {
    const filePath = path.resolve('sample.csv');
    if (!fs.existsSync(filePath)) throw new Error('sample.csv not found');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
    const url = 'http://localhost:5000/api/imports/attendance?date=2025-11-09';
    const res = await fetch(url, { method: 'POST', body: form });
    const text = await res.text();
    console.log('Status', res.status);
    console.log(text);
  } catch (e) {
    console.error('Upload failed', e);
    process.exit(1);
  }
})();
