#!/usr/bin/env node
const axios = require('axios');
(async () => {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', { identifier: 'admin@hospital.com', password: 'admin123' });
    const token = loginRes.data && loginRes.data.token;
    console.log('Got token:', !!token);
    const hdr = { Authorization: `Bearer ${token}` };
    const res = await axios.get('http://localhost:5000/kshf_hospital_app/file-transfers?page=1&pageSize=5', { headers: hdr });
    console.log('File transfers response status:', res.status);
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
