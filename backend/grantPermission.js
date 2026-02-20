#!/usr/bin/env node
// Uses global fetch (Node 18+). No external dependencies required.

// Usage: node backend/grantPermission.js <fullName> <permission>
const [,, fullName = 'S0932', permission = 'edit:files'] = process.argv;
const BASE = process.env.API_BASE || 'http://localhost:5000';

async function main() {
  try {
    // Login as seeded admin
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@hospital.com', password: 'admin123' })
    });
    if (!loginRes.ok) {
      const t = await loginRes.text();
      throw new Error(`Login failed: ${loginRes.status} ${t}`);
    }
    const loginJson = await loginRes.json();
    const token = loginJson.token;
    console.log('Got token. Granting permission...');

    const grantRes = await fetch(`${BASE}/api/users/grant-by-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fullName, permission })
    });
    const grantJson = await grantRes.json();
    if (!grantRes.ok) {
      console.error('Grant failed:', grantRes.status, grantJson);
      process.exit(2);
    }
    console.log('Grant result:', JSON.stringify(grantJson, null, 2));
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
