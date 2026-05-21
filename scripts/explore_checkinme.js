import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

async function loginToCheckinme() {
  const code = '023217384';
  const phone = '070838383';
  const password = '070838383';
  const baseUrl = 'https://hospital.checkinme.app';

  const jar = new CookieJar();
  const client = wrapper(axios.create({ 
    jar, 
    withCredentials: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }));

  const loginPageRes = await client.get(`${baseUrl}/login`);
  const $login = cheerio.load(loginPageRes.data);
  const csrfToken = $login('input[name="_token"]').val();

  await client.post(`${baseUrl}/login`, new URLSearchParams({
    _token: csrfToken,
    code,
    phone,
    password
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return { client, baseUrl };
}

(async () => {
  try {
    const { client, baseUrl } = await loginToCheckinme();
    console.log('Logged in. Fetching Daily Report page...');
    
    // Just fetch the page without parameters to get the dropdown list
    const res = await client.get(`${baseUrl}/admin/reports/daily`);
    const $ = cheerio.load(res.data);
    
    console.log('--- Employee Categories Dropdown ---');
    $('select[name="employee_category_type_id"] option, select[name="employee_category"] option, select[id*="category"] option').each((i, el) => {
      const val = $(el).val();
      const txt = $(el).text().trim();
      if (val) {
        console.log(`ID: ${val} -> Name: ${txt}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
})();
