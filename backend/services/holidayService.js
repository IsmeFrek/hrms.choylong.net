import https from 'https';
import Holiday from '../models/Holiday.js';

const cache = new Map();

/**
 * Manual fallback for Cambodian Public Holidays (2026)
 * Includes both fixed and major lunar-based holidays.
 */
const KH_2026_FALLBACK = [
  { day: 1, month: 1, name: "International New Year's Day" },
  { day: 7, month: 1, name: 'Victory over Genocide Day' },
  { day: 8, month: 3, name: "International Women's Day" },
  { day: 14, month: 4, name: 'Khmer New Year' },
  { day: 15, month: 4, name: 'Khmer New Year' },
  { day: 16, month: 4, name: 'Khmer New Year' },
  { day: 1, month: 5, name: 'International Labour Day' },
  { day: 5, month: 5, name: 'Royal Ploughing Ceremony' },
  { day: 13, month: 5, name: "King's Birthday" },
  { day: 14, month: 5, name: "King's Birthday" },
  { day: 15, month: 5, name: "King's Birthday" },
  { day: 31, month: 5, name: 'Visak Bochea Day' },
  { day: 18, month: 6, name: "Queen's Birthday" },
  { day: 24, month: 9, name: 'Constitution Day' },
  { day: 6, month: 10, name: 'Pchum Ben Festival' },
  { day: 7, month: 10, name: 'Pchum Ben Festival' },
  { day: 8, month: 10, name: 'Pchum Ben Festival' },
  { day: 15, month: 10, name: "Commemoration Day of King's Father" },
  { day: 29, month: 10, name: "Coronation Day of King Sihamoni" },
  { day: 9, month: 11, name: 'Independence Day' },
  { day: 23, month: 11, name: 'Water Festival' },
  { day: 24, month: 11, name: 'Water Festival' },
  { day: 25, month: 11, name: 'Water Festival' }
];

/**
 * Fetches Cambodian public holidays from external API and caches the results.
 * @param {number} year 
 * @returns {Promise<Array>}
 */
export async function fetchKHolidays(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900 || y > 3000) {
    throw new Error('Invalid year');
  }

  // 1. Fetch from Database
  let dbHolidays = [];
  try {
    dbHolidays = await Holiday.find({
      date: { $regex: new RegExp(`^${y}-`) }
    });
  } catch (err) {
    console.error('Error fetching holidays from DB:', err);
  }

  const existing = cache.get(y);
  const now = Date.now();
  
  // If we have cached data and it's less than 24h old, use it but merge with DB
  if (existing && now - existing.fetchedAt < 24 * 60 * 60 * 1000) {
    return mergeHolidays(existing.data, dbHolidays);
  }

  // Fallback for 2026
  const fallback = y === 2026 ? KH_2026_FALLBACK.map(h => ({
    date: `2026-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
    day: h.day,
    month: h.month,
    name: h.name
  })) : [];

  const url = `https://date.nager.at/api/v3/PublicHolidays/${y}/KH`;

  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        console.warn(`Upstream responded ${res.statusCode}, using fallback.`);
        return resolve(mergeHolidays(fallback, dbHolidays));
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          if (!raw) return resolve(mergeHolidays(fallback, dbHolidays));
          const arr = JSON.parse(raw);
          if (!Array.isArray(arr)) return resolve(mergeHolidays(fallback, dbHolidays));
          
          const mapped = arr.map((h) => ({
            date: String(h.date || '').slice(0, 10),
            day: parseInt(String(h.date || '').slice(8, 10)),
            month: parseInt(String(h.date || '').slice(5, 7)),
            name: h.localName || h.name || '',
          })).filter(x => x.date);

          const mergedWithFallback = [...fallback];
          mapped.forEach(m => {
            if (!mergedWithFallback.find(f => f.day === m.day && f.month === m.month)) {
              mergedWithFallback.push(m);
            }
          });

          cache.set(y, { fetchedAt: now, data: mergedWithFallback });
          resolve(mergeHolidays(mergedWithFallback, dbHolidays));
        } catch (e) {
          console.error(`Error parsing holiday data for year ${y}:`, e.message);
          resolve(mergeHolidays(fallback, dbHolidays));
        }
      });
    });
    req.on('error', (err) => {
      console.error(`Error fetching holidays for year ${y}:`, err.message);
      resolve(mergeHolidays(fallback, dbHolidays));
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(mergeHolidays(fallback, dbHolidays));
    });
  });
}

function mergeHolidays(standard, db) {
  const result = [...standard];
  db.forEach(d => {
    const existingIdx = result.findIndex(r => r.date === d.date);
    if (d.isDeleted || d.name === 'DELETED') {
      if (existingIdx >= 0) {
        result.splice(existingIdx, 1);
      }
      return;
    }
    if (existingIdx >= 0) {
      result[existingIdx] = {
        date: d.date,
        day: parseInt(d.date.split('-')[2]),
        month: parseInt(d.date.split('-')[1]),
        name: d.name,
        isManual: true,
        _id: d._id
      };
    } else {
      result.push({
        date: d.date,
        day: parseInt(d.date.split('-')[2]),
        month: parseInt(d.date.split('-')[1]),
        name: d.name,
        isManual: true,
        _id: d._id
      });
    }
  });
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
