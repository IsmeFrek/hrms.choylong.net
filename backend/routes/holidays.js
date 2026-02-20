import express from 'express';
import https from 'https';

const router = express.Router();

// Simple in-memory cache: { year: { fetchedAt, data } }
const cache = new Map();

function fetchKHolidays(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900 || y > 3000) {
    return Promise.reject(new Error('Invalid year'));
  }
  // Return cached if available within 24h
  const existing = cache.get(y);
  const now = Date.now();
  if (existing && now - existing.fetchedAt < 24 * 60 * 60 * 1000) {
    return Promise.resolve(existing.data);
  }
  const url = `https://date.nager.at/api/v3/PublicHolidays/${y}/KH`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Upstream responded ${res.statusCode}`));
        res.resume();
        return;
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const arr = JSON.parse(raw);
          if (!Array.isArray(arr)) return resolve([]);
          const mapped = arr.map((h) => ({
            date: String(h.date || '').slice(0, 10),
            name: h.localName || h.name || '',
          })).filter(x => x.date);
          cache.set(y, { fetchedAt: now, data: mapped });
          resolve(mapped);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

// GET /api/holidays?year=YYYY or /api/holidays/:year
router.get('/', async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const data = await fetchKHolidays(year);
    res.json({ year, country: 'KH', data });
  } catch (err) {
    res.status(502).json({ message: 'Failed to fetch holidays', error: String(err && err.message || err) });
  }
});

router.get('/:year', async (req, res) => {
  try {
    const year = Number(req.params.year);
    const data = await fetchKHolidays(year);
    res.json({ year, country: 'KH', data });
  } catch (err) {
    res.status(502).json({ message: 'Failed to fetch holidays', error: String(err && err.message || err) });
  }
});

export default router;
