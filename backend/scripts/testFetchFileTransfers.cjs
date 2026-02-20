(async () => {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@hospital.com', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error('Login failed', loginRes.status, loginData);
      process.exit(1);
    }
    const token = loginData.token;
    console.log('Got token:', !!token);
    const res = await fetch('http://localhost:5000/kshf_hospital_app/file-transfers?page=1&pageSize=5', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('File transfers response status:', res.status);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
