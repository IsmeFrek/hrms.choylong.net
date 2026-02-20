#!/usr/bin/env node
const axios = require('axios');
(async () => {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', { identifier: 'admin@hospital.com', password: 'admin123' });
    const token = loginRes.data && loginRes.data.token;
    if (!token) {
      console.error('No token from login'); process.exit(1);
    }
    console.log('Got token');
    const hdr = { Authorization: `Bearer ${token}` };
    const id = '698bfaece711c83574387bf0';
    console.log('Sending send-telegram for', id);
    const res = await axios.post(`http://localhost:5000/api/file-transfers/${id}/send-telegram`, { stageKey: 's' }, { headers: hdr, timeout: 20000 });
    console.log('Response status:', res.status);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('HTTP error', err.response.status, err.response.data);
    } else {
      console.error('Error', err.message);
    }
    process.exit(1);
  }
})();
