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
    console.log('Fetching record', id);
    try {
      const getRes = await axios.get(`http://localhost:5000/api/file-transfers/${id}`, { headers: hdr });
      console.log('Record fetched');
      try { console.log('meta:', JSON.stringify(getRes.data.meta || getRes.data.item?.meta || getRes.data || {}, null, 2)); } catch(e) {}
    } catch (gE) {
      console.error('Failed to fetch record:', gE && (gE.response ? gE.response.data : gE.message));
    }
    console.log('Sending send-telegram for', id);
    try {
      // include chatId override provided by user
      const res = await axios.post(`http://localhost:5000/api/file-transfers/${id}/send-telegram`, { stageKey: 's', chatId: '776393689' }, { headers: hdr, timeout: 20000 });
      console.log('Response status:', res.status);
      console.log(JSON.stringify(res.data, null, 2));
    } catch (postErr) {
      console.error('POST error:', postErr && postErr.toString());
      if (postErr && postErr.response) {
        try { console.error('POST response data:', JSON.stringify(postErr.response.data, null, 2)); } catch (e) {}
      }
      throw postErr;
    }
  } catch (err) {
    if (err.response) {
      console.error('HTTP error', err.response.status, err.response.data);
    } else {
      console.error('Error', err.message);
    }
    process.exit(1);
  }
})();
