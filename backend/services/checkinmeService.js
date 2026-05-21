import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import fs from 'fs';
import path from 'path';

// Global cache for Staff ID mapping to speed up repeated syncs
let staffIdMapCache = null;
let staffIdMapCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Shared helper to login to Checkinme and return an axios client with cookie jar
 */
async function loginToCheckinme(options = {}) {
  const {
    code = '023217384',
    phone = '070838383',
    password = '070838383',
    baseUrl = 'https://hospital.checkinme.app'
  } = options;

  const jar = new CookieJar();
  const client = wrapper(axios.create({ 
    jar, 
    withCredentials: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }));

  try {
    console.log('[Checkinme] Fetching login page...');
    const loginPageRes = await client.get(`${baseUrl}/login`);
    const $login = cheerio.load(loginPageRes.data);
    const csrfToken = $login('input[name="_token"]').val();

    if (!csrfToken) {
      throw new Error('Could not find CSRF token on login page');
    }
    console.log('[Checkinme] CSRF token found. Logging in...');

    await client.post(`${baseUrl}/login`, new URLSearchParams({
      _token: csrfToken,
      code,
      phone,
      password
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('[Checkinme] Login successful.');
    return { client, baseUrl };
  } catch (error) {
    console.error('[Checkinme] Login Error:', error.message);
    throw error;
  }
}

/**
 * Service to scrape leave requests from Checkinme admin panel
 * Supports multi-page scraping to ensure all records are captured.
 */
export async function scrapeCheckinmeLeaves(options = {}) {
  const { fromDate, toDate, limit = 100 } = options;

  try {
    const { client, baseUrl } = await loginToCheckinme(options);
    
    // 1. Build Staff ID map (from cache or pre-fetch)
    const staffIdMap = await buildStaffIdMapFromEmployees(client, baseUrl);
    
    console.log('[Checkinme] Fetching leaves...');

    const items = [];
    let page = 1;
    let hasMore = true;
    const seenIds = new Set();
    const maxPages = 100; // Safety limit to prevent infinite loops

    // Column mapping indices (dynamic)
    let colIdx = {
      name: 1,
      date: 2,
      amount: 3,
      reason: 4,
      type: 6,
      manager: 7,
      department: 8,
      status: 10,
      comment: -1,
      mark: -1
    };

    while (hasMore && page <= maxPages) {
      const leavesUrl = new URL(`${baseUrl}/admin/leaves`);
      leavesUrl.searchParams.set('limit', limit);
      leavesUrl.searchParams.set('page', page);
      leavesUrl.searchParams.set('status', ''); // All statuses
      leavesUrl.searchParams.set('is_deleted', '0'); // Exclude deleted (0 = No)
      if (fromDate) leavesUrl.searchParams.set('from_date', fromDate);
      if (toDate) leavesUrl.searchParams.set('to_date', toDate);

      console.log(`[Checkinme] Requesting Leaves Page ${page} (limit ${limit})...`);
      const leavesPageRes = await client.get(leavesUrl.toString());
      const $ = cheerio.load(leavesPageRes.data);

      // Detect column indices on page 1
      if (page === 1) {
        // Detect column indices robustly across all header rows
        $('table thead tr').each((rIdx, tr) => {
          $(tr).find('th, td').each((i, el) => {
            const txt = $(el).text().trim().toLowerCase();
            if (txt.includes('employee') || txt.includes('ឈ្មោះ')) colIdx.name = i;
            if (txt.includes('date') || txt.includes('កាលបរិច្ឆេទ')) colIdx.date = i;
            if (txt.includes('amount') || txt.includes('ចំនួន')) colIdx.amount = i;
            if (txt.includes('reason') || txt.includes('មូលហេតុ')) colIdx.reason = i;
            if (txt.includes('type') || txt.includes('ប្រភេទ')) colIdx.type = i;
            if (txt.includes('manager') || txt.includes('អ្នកអនុម័ត')) colIdx.manager = i;
            if (txt.includes('department') || txt.includes('ផ្នែក')) colIdx.department = i;
            if (txt.includes('status') || txt.includes('ស្ថានភាព')) colIdx.status = i;
            if (txt.includes('comment') || txt.includes('មតិ')) colIdx.comment = i;
            if (txt.includes('mark') || txt.includes('remark') || txt.includes('ចំណាំ')) colIdx.mark = i;
          });
        });

        // Fallback: if Mark is still -1, try to find it by looking for the string "Deleted" in ANY row on the first page
        if (colIdx.mark === -1) {
          const firstPageRows = $('table tbody tr');
          firstPageRows.each((rIdx, tr) => {
            if (colIdx.mark !== -1) return false; // stop outer each
            $(tr).find('td').each((i, td) => {
              const val = $(td).text().trim();
              if (/deleted/i.test(val)) {
                console.log(`[Checkinme] Fallback: Found "Deleted" at index ${i} in row ${rIdx} - assuming this is the Mark column`);
                colIdx.mark = i;
                return false; // stop inner each
              }
            });
          });
        }
        
        console.log('[Checkinme] Final Column Mapping:', colIdx);
      }

      const pageRows = $('table tbody tr');
      // If no rows or "No data available" message, we're done
      if (pageRows.length === 0 || pageRows.text().includes('No data available')) {
        console.log(`[Checkinme] No more rows found on page ${page}. Finishing.`);
        break;
      }

      console.log(`[Checkinme] Processing ${pageRows.length} rows from page ${page}.`);
      let newRecordsFoundOnPage = false;

      pageRows.each((i, tr) => {
        const $td = $(tr).find('td');
        if ($td.length < 5) return; // Basic check

        const name = $td.eq(colIdx.name).text().trim();
        const rawDate = $td.eq(colIdx.date).text().trim();
        const amount = $td.eq(colIdx.amount).text().trim();
        const reason = $td.eq(colIdx.reason).text().trim();
        const type = $td.eq(colIdx.type).text().trim();
        const manager = $td.eq(colIdx.manager).text().trim();
        const department = $td.eq(colIdx.department).text().trim();
        const statusText = $td.eq(colIdx.status).text().trim();
        const statusRaw = statusText.toLowerCase();
        const requestedAtRaw = colIdx.requestedAt !== undefined ? $td.eq(colIdx.requestedAt).text().trim() : '';
        const approvedAtRaw = colIdx.approvedAt !== undefined ? $td.eq(colIdx.approvedAt).text().trim() : '';
        
        // Pick whichever is non-empty: Mark or Comment
        const c1 = colIdx.comment !== -1 ? $td.eq(colIdx.comment).text().trim() : '';
        const c2 = colIdx.mark !== -1 ? $td.eq(colIdx.mark).text().trim() : '';
        let comment = c2 || c1; // Prioritize Mark (c2) over Comment (c1)

        // FINAL FALLBACK: If "Deleted" is not in comment, search ALL cells in this row
        if (!/deleted/i.test(comment)) {
          $td.each((idx, cell) => {
            const cellText = $(cell).text().trim();
            if (/deleted/i.test(cellText)) {
              comment = cellText;
            }
          });
        }

        // SKIP if it's a deleted record
        if (/deleted/i.test(comment)) {
          console.log(`[Checkinme] Skipping deleted record for ${name} (${rawDate})`);
          return;
        }

        // Extract a unique ID from the Edit/Delete links if possible
        const editHref = $(tr).find('a[href*="/edit"]').attr('href') || '';
        const deleteHref = $(tr).find('form[action*="/admin/leaves/"]').attr('action') || '';
        const idMatch = (editHref || deleteHref).match(/\/leaves\/(\d+)/);
        const checkinmeId = idMatch ? idMatch[1] : null;

        if (checkinmeId) {
          if (seenIds.has(checkinmeId)) {
            return; // Skip duplicate ID
          }
          seenIds.add(checkinmeId);
          newRecordsFoundOnPage = true;
        } else {
          // If no ID, we check name+date+reason to avoid exact duplicate rows on the same page
          const fallbackId = `${name}-${rawDate}-${reason}`;
          if (seenIds.has(fallbackId)) return;
          seenIds.add(fallbackId);
          newRecordsFoundOnPage = true;
        }

        if (!name || name === 'Employee Name') return;

        const lookupName = normalizeKhmer(name);
        const lookupResult = staffIdMap[lookupName];
        // Handle both single object and array of objects from name mapping
        const staffId = Array.isArray(lookupResult) ? lookupResult[0]?.staffId : lookupResult?.staffId || null;

        let status = statusText || 'pending';

        // Parse timestamps
        const parseTS = (ts) => {
          if (!ts || ts === '---') return null;
          const d = new Date(ts);
          return isNaN(d.getTime()) ? null : d;
        };

        const requestedAt = parseTS(requestedAtRaw);
        const approvedAt = parseTS(approvedAtRaw);

        let startDate = null;
        let endDate = null;
        const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
        
        const cleanRaw = rawDate.split('|')[0].trim();
        const durationMatch = amount.match(/(\d+)/);
        const durationDays = durationMatch ? parseInt(durationMatch[1]) : 1;

        if (cleanRaw.includes('-')) {
          const parts = cleanRaw.split('-').map(p => p.trim());
          const yearInPart1 = parts[0].match(/(\d{4})/);
          const yearInPart2 = parts[1].match(/(\d{4})/);
          
          // Latest found year or current year
          const defaultYear = (yearInPart2 ? yearInPart2[1] : (yearInPart1 ? yearInPart1[1] : new Date().getFullYear()));

          const parseP = (p, fallbackYear) => {
            const yM = p.match(/(\d{4})/);
            const curY = yM ? yM[1] : fallbackYear;
            const mM = p.match(/(\d{1,2})\s+([A-Za-z]{3})/);
            if (mM) return new Date(`${curY}-${months[mM[2]] || '01'}-${mM[1].padStart(2, '0')}`);
            return null;
          };

          let startObj = parseP(parts[0], defaultYear);
          let endObj = parseP(parts[1], defaultYear);

          // Correct logic for long ranges: 
          // If Duration is high (e.g. 732 days) but our parsed dates are close,
          // the year at the end likely refers to the END date.
          if (startObj && endObj && durationDays > 30) {
            const diffDays = Math.round(Math.abs(endObj - startObj) / (1000 * 60 * 60 * 24));
            if (diffDays < durationDays - 5) {
               // The end year is known, but the start year must be earlier
               startObj = new Date(endObj.getTime());
               startObj.setDate(endObj.getDate() - (durationDays - 1));
            }
          }

          if (startObj) startDate = startObj.toISOString().split('T')[0];
          if (endObj) endDate = endObj.toISOString().split('T')[0];
        } else {
          const dm = cleanRaw.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
          if (dm) {
            startDate = `${dm[dm.length-1]}-${months[dm[2]] || '01'}-${dm[1].padStart(2, '0')}`;
            endDate = startDate;
          }
        }

        items.push({ 
          checkinmeId,
          staffId, 
          name, 
          date: startDate, 
          startDate, 
          endDate, 
          rawDate, 
          amount, 
          reason, 
          type, 
          manager,
          department,
          status,
          comment
        });
      });

      // If we found NO new records on this page, it means let's stop (reached the end or looping)
      if (!newRecordsFoundOnPage) {
        console.log(`[Checkinme] No new records found on page ${page}. Breaking pagination.`);
        hasMore = false;
      } else {
        page++;
      }
    }

    console.log(`[Checkinme] Scraped TOTAL ${items.length} leave items.`);
    return items;
  } catch (error) {
    console.error('[Checkinme] Leaves Scraper Error:', error.message);
    throw error;
  }
}

/**
 * Service to scrape attendance records from Checkinme admin panel
 */
export async function scrapeCheckinmeAttendances(options = {}) {
  const { date, limit = 1000 } = options;

  try {
    const { client, baseUrl } = await loginToCheckinme(options);
    console.log('[Checkinme] Fetching attendances for date:', date || 'All');

    const attUrl = new URL(`${baseUrl}/admin/attendances`);
    attUrl.searchParams.set('limit', limit);
    if (date) attUrl.searchParams.set('date', date);

    console.log('[Checkinme] Requesting:', attUrl.toString());
    const attPageRes = await client.get(attUrl.toString());
    const $ = cheerio.load(attPageRes.data);

    const items = [];
    const rows = $('table tbody tr');
    console.log('[Checkinme] Found table rows:', rows.length);

    rows.each((i, tr) => {
      const $td = $(tr).find('td');
      if ($td.length < 8) return;

      const name = $td.eq(1).text().trim();
      const checkIn = $td.eq(2).text().trim();
      const checkOut = $td.eq(3).text().trim();
      const checkIn2 = $td.eq(4).text().trim();
      const checkOut2 = $td.eq(5).text().trim();
      const service = $td.eq(6).text().trim();
      const note = $td.eq(7).text().trim();

      if (!name || name === 'Employee Name') return;

      items.push({
        name,
        date: date, // Default to requested date if provided
        checkIn,
        checkOut,
        checkIn2,
        checkOut2,
        service,
        note
      });
    });

    console.log('[Checkinme] Parsed attendances:', items.length);
    return items;
  } catch (error) {
    console.error('[Checkinme] Attendance Scraper Error:', error.message);
    throw error;
  }
}

/**
 * Helper to normalize Khmer text for comparison (remove ZWSP, normalize spaces)
 */
function normalizeKhmer(str) {
  if (!str) return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/\s+/g, ' ')                  // Normalize spaces
    .trim()
    .toLowerCase();
}

/**
 * Fuzzy matches Latin names to handle spelling variations (e.g. i vs y, swap first/last names)
 */
function fuzzyMatchLatinNames(name1, name2) {
  if (!name1 || !name2) return false;
  
  const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Replace commonly swapped vowels: i <-> y, ie <-> y
  const norm = (s) => s.replace(/y/g, 'i').replace(/ee/g, 'i').replace(/ea/g, 'a');
  if (norm(n1) === norm(n2)) return true;
  
  // Check if name parts match in any order
  const parts1 = name1.toLowerCase().split(/\s+/).filter(Boolean);
  const parts2 = name2.toLowerCase().split(/\s+/).filter(Boolean);
  if (parts1.length > 0 && parts2.length > 0) {
    const allParts1Match = parts1.every(p => parts2.some(p2 => p2.includes(p) || p.includes(p2)));
    const allParts2Match = parts2.every(p2 => parts1.some(p => p.includes(p2) || p2.includes(p)));
    if (allParts1Match || allParts2Match) return true;
  }
  
  return false;
}

/**
 * Helper to build a Name -> Staff ID map by scraping the Checkinme Employee List.
 */
async function buildStaffIdMapFromEmployees(client, baseUrl) {
  // Check memory cache first (TTL 1 hour)
  const now = Date.now();
  if (staffIdMapCache && (now - staffIdMapCacheTime < CACHE_TTL)) {
    console.log('[Checkinme] Using CACHED Staff ID mappings.');
    return staffIdMapCache;
  }

  const map = {};
  let page = 1;
  let hasMore = true;
  let nameColIndex = 3; // Best guess default
  let idColIndex = 2; // Best guess default

  console.log('[Checkinme] Cache miss or expired. Building Staff ID mappings from Checkinme list...');
  try {
    while (hasMore) {
      const empUrl = new URL(`${baseUrl}/admin/employees`);
      empUrl.searchParams.set('limit', 100);
      empUrl.searchParams.set('page', page);

      const res = await client.get(empUrl.toString());
      const $ = cheerio.load(res.data);

      if (page === 1) {
        // Detect column indices dynamically
        $('table thead tr th, table thead tr td').each((i, el) => {
          const thText = $(el).text().trim().toLowerCase();
          if (thText.includes('name') || thText.includes('ឈ្មោះ')) nameColIndex = i;
          if (thText.includes('id') || thText.includes('code') || thText.includes('ល.រ') || thText.includes('អត្តលេខ')) idColIndex = i;
        });
      }

      const rows = $('table tbody tr');
      if (rows.length === 0 || rows.text().includes('No data available')) {
        break;
      }

      rows.each((i, tr) => {
        const tds = $(tr).find('td');
        if (tds.length > Math.max(nameColIndex, idColIndex)) {
          const empNameRaw = tds.eq(nameColIndex).text().trim();
          const empId = tds.eq(idColIndex).text().trim();
          const empName = normalizeKhmer(empNameRaw);
          
          if (empName && empId && empName !== normalizeKhmer('Employee Name')) {
            const item = { staffId: empId, checkinmeId: null };
            
            // Try to extract the internal Checkinme ID from Edit links
            const editHref = $(tr).find('a[href*="/edit"]').attr('href') || '';
            const idMatch = editHref.match(/\/employees\/(\d+)/);
            if (idMatch) item.checkinmeId = idMatch[1];

            if (map[empName]) {
              // Existing name handling
              if (!Array.isArray(map[empName])) {
                map[empName] = [map[empName]];
              }
              const exists = map[empName].some(existing => existing.staffId === empId);
              if (!exists) map[empName].push(item);
            } else {
              map[empName] = item;
            }
          }
        }
      });

      if (page >= 100 || rows.length < 5) hasMore = false;
      page++;
    }
    
    // Update global cache
    staffIdMapCache = map;
    staffIdMapCacheTime = Date.now();
    
    console.log(`[Checkinme] Successfully mapped ${Object.keys(map).length} Employees.`);
    return map;
  } catch (err) {
    console.error('[Checkinme] Pre-fetch mapping failed:', err.message);
    return map; // Return what we have
  }
}

/**
 * Service to scrape monthly Day Off matrix from Checkinme admin panel
 */
export async function scrapeCheckinmeDayOffs(options = {}) {
  const { month, fromDate, toDate, serviceId, branchId, filterStaffId, filterName } = options; 

  try {
    const { client, baseUrl } = await loginToCheckinme(options);
    console.log('[Checkinme] Fetching day offs:', { month, fromDate, toDate, serviceId, branchId, filterName, filterStaffId });

    // 1. Determine date range
    let targetFromDate = fromDate;
    let targetToDate = toDate;
    
    // Fallback to month if fromDate/toDate not provided
    if (!targetFromDate && month) {
      targetFromDate = `${month}-01`;
    }
    
    // We'll use targetFromDate's YYYY-MM for local matching if month not provided
    const localMonth = targetFromDate ? targetFromDate.slice(0, 7) : (month || new Date().toISOString().slice(0, 7));

    const dateIndices = [];
    let isFirstPage = true;
    const items = [];
    
    // 2. Build global Staff ID map from employees page BEFORE scraping schedules
    const staffIdMap = await buildStaffIdMapFromEmployees(client, baseUrl);
    
    let page = 1;
    let hasMore = true;
    let useFallbackNoFilter = false; 

    while (hasMore) {
      const dayOffUrl = new URL(`${baseUrl}/admin/employee_dayoff`);
      
      if (!useFallbackNoFilter) {
        if (targetFromDate) dayOffUrl.searchParams.set('filter_from_date', targetFromDate);
        if (targetToDate) dayOffUrl.searchParams.set('filter_to_date', targetToDate);
        if (serviceId) dayOffUrl.searchParams.set('department_id', serviceId); // 'department_id' in Checkinme is 'Service'
        if (branchId) dayOffUrl.searchParams.set('branch_id', branchId); // 'branch_id' in Checkinme is 'Department'
      }
      
      if (filterName) {
        dayOffUrl.searchParams.set('filter_name', filterName);
      }
      
      dayOffUrl.searchParams.set('limit', 100); 
      dayOffUrl.searchParams.set('page', page);

      console.log(`[Checkinme] Requesting Page ${page}:`, dayOffUrl.toString());
      let pageRes;
      try {
        pageRes = await client.get(dayOffUrl.toString());
      } catch (fetchErr) {
        // If filter causes 500 (common for historical months), retry without filters
        if (!useFallbackNoFilter && (fetchErr?.response?.status === 500 || fetchErr?.message?.includes('500'))) {
          console.warn(`[Checkinme] Filters caused 500. Retrying without filters (will filter locally)...`);
          useFallbackNoFilter = true;
          page = 1;
          isFirstPage = true;
          continue;
        }
        throw fetchErr;
      }
      const $ = cheerio.load(pageRes.data);

      if (isFirstPage) {
        // Identify date columns in thead
        $('table thead tr').first().find('td.sticky-header').each((i, td) => {
          const bText = $(td).find('b').text().trim();
          if (bText.match(/^\d+$/)) {
            dateIndices.push({
              index: $(td).index(),
              day: bText.padStart(2, '0')
            });
          }
        });

        if (dateIndices.length === 0) {
          console.warn('[Checkinme] No date columns found in thead matrix');
        }

        isFirstPage = false;
      }

      const rows = $('table tbody tr');
      console.log(`[Checkinme] Found ${rows.length} rows on page ${page}`);
      
      if (rows.length === 0 || rows.text().includes('No data available')) {
        hasMore = false;
        break;
      }

      rows.each((i, tr) => {
        const $tds = $(tr).find('td');
        const $nameLink = $tds.filter('.sticky-column').find('a');
        if ($nameLink.length === 0) return;

        const name = $nameLink.text().trim();
        const href = $nameLink.attr('href') || '';
        
        // 1. Resolve Staff ID
        const lookupName = normalizeKhmer(name);
        let staffId = null;

        const checkinmeIdMatch = href.match(/employee_id=(\d+)/);
        const checkinmeId = checkinmeIdMatch ? checkinmeIdMatch[1] : null;

        // Try to match by checkinmeId first (most reliable)
        if (checkinmeId) {
          // Flatten the map to find by checkinmeId
          const allMappedEmployees = Object.values(staffIdMap).flat();
          const match = allMappedEmployees.find(e => e.checkinmeId === checkinmeId);
          if (match) {
            staffId = match.staffId;
          }
        }

        // Fallback to name matching
        if (!staffId) {
          const lookupResult = staffIdMap[lookupName];
          if (Array.isArray(lookupResult)) {
            // Multiple employees with same name
            console.warn(`[Checkinme] Duplicate name found for "${name}". Using first match or trying to disambiguate...`);
            staffId = lookupResult[0]?.staffId || null;
          } else {
            staffId = lookupResult?.staffId || null;
          }

          // Fuzzy fallback if not resolved exactly
          if (!staffId) {
            const scrapedNameLatin = name;
            for (const [key, value] of Object.entries(staffIdMap)) {
              if (fuzzyMatchLatinNames(scrapedNameLatin, key)) {
                const item = Array.isArray(value) ? value[0] : value;
                staffId = item?.staffId || null;
                console.log(`[Checkinme] Fuzzy matched scraped name "${scrapedNameLatin}" to employee "${key}" (Staff ID: ${staffId})`);
                break;
              }
            }
          }
        }

        if (!staffId) {
          console.warn(`[Checkinme] Could not resolve Staff ID for: ${name} (CheckinmeID: ${checkinmeId})`);
        }

        // 2. Apply Filters Early
        if (name) {
          const normalizedScrapedName = lookupName;
          const normalizedFilterName = filterName ? normalizeKhmer(filterName) : null;
          
          if (filterStaffId) {
            if (staffId !== filterStaffId) return;
          } else if (normalizedFilterName) {
            if (!normalizedScrapedName.includes(normalizedFilterName) && !fuzzyMatchLatinNames(name, filterName)) {
              return;
            }
          }
          
          // If we are looking for a specific Staff ID or Name and we found it, we can stop pagination soon
          if (filterStaffId && staffId === filterStaffId) {
             hasMore = false;
          }
          if (normalizedFilterName && (normalizedScrapedName === normalizedFilterName || fuzzyMatchLatinNames(name, filterName))) {
             hasMore = false;
          }
        }

        const schedules = [];
        dateIndices.forEach(dateInfo => {
          const $cell = $tds.eq(dateInfo.index);
          const statusText = $cell.text().trim();
          const fullTitle = $cell.attr('title') || '';
          const status = fullTitle && fullTitle.length > statusText.length ? fullTitle : statusText;

          const isDayOff = status.toLowerCase().includes('day off') || status.includes('ឈប់') || status.includes('សម្រាក');
          
          // In fallback mode or when spanning multiple months, we need to know the actual month of this column
          // Note: employee_dayoff usually shows columns for a specific month. 
          // If the page headers don't specify the month, we use targetFromDate's month.
          const schedDate = `${localMonth}-${dateInfo.day}`;
          
          // Local range filtering
          if (targetFromDate && schedDate < targetFromDate) return;
          if (targetToDate && schedDate > targetToDate) return;

          if (isDayOff || status.trim().length > 0) {
            schedules.push({
              date: schedDate,
              status: isDayOff ? 'OFF' : status.trim()
            });
          }
        });

        items.push({ 
          name, 
          staffId,
          checkinmeId, 
          schedules 
        });
      });
      
      if (!hasMore) break;

      const maxPages = (filterName || filterStaffId) ? 3 : 100;

      if (page >= maxPages || rows.length < 5) {
        hasMore = false; 
      } else {
        page++;
      }
    }

    console.log('[Checkinme] Parsed day off matrix for', items.length, 'employees');
    return items;
  } catch (error) {
    console.error('[Checkinme] Day Off Scraper Error:', error.message);
    throw error;
  }
}

/**
 * Service to scrape the Checkinme Daily Report
 * URL: /admin/reports/daily?date=YYYY-MM-DD&branch_id=&employee_category_type_id=
 */
export async function scrapeCheckinmeDailyReport(options = {}) {
  const { date, branchId = '', categoryTypeId = '' } = options;

  try {
    const { client, baseUrl } = await loginToCheckinme(options);
    console.log('[Checkinme] Fetching Daily Report for date:', date || 'today');

    // Build the staffId map first for name resolution (Skip in fast mode)
    let staffIdMap = {};
    if (!options.fast) {
      staffIdMap = await buildStaffIdMapFromEmployees(client, baseUrl);
    }

    const reportUrl = new URL(`${baseUrl}/admin/reports/daily`);
    if (date) reportUrl.searchParams.set('date', date);
    if (branchId) reportUrl.searchParams.set('branch_id', branchId);
    
    // Only set category if it's a specific ID (not 'all')
    const finalCatId = (categoryTypeId === 'all' || !categoryTypeId) ? '' : categoryTypeId;
    if (finalCatId) reportUrl.searchParams.set('employee_category_type_id', finalCatId);

    console.log('[Checkinme] Requesting Daily Report:', reportUrl.toString());
    
    let pageRes;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        pageRes = await client.get(reportUrl.toString());
        break; // Success!
      } catch (err) {
        attempts++;
        const status = err.response?.status;
        if ((status === 500 || status === 503 || !status) && attempts < maxAttempts) {
          console.warn(`[Checkinme] Attempt ${attempts} failed with status ${status}. Retrying in ${attempts * 2}s...`);
          await new Promise(r => setTimeout(r, attempts * 2000));
          continue;
        }
        throw err; // Permanent error or out of retries
      }
    }

    const $ = cheerio.load(pageRes.data);
    
    // EMERGENCY DEBUG: Save HTML to see structure
    try {
        fs.writeFileSync(path.join(process.cwd(), 'daily_report_debug.html'), pageRes.data);
        console.log('[Checkinme] DEBUG: Full page HTML saved to daily_report_debug.html');
    } catch(err) {}

    const items = [];

    // Loop through ALL tables on the page
    $('table').each((tIdx, tbl) => {
      const $tbl = $(tbl);
      // detect table type from headers or preceding text (Box Title in CheckinMe)
      const prevText = (
        $tbl.closest('.box').find('.box-title').text().toLowerCase() || 
        $tbl.prev().text().toLowerCase() || 
        $tbl.parent().prev().text().toLowerCase() || 
        ''
      ).trim();
      
      // Order matters: 'អវត្តមាន' contains 'វត្តមាន', so check 'អវត្តមាន' first
      let isAbsentTable = prevText.includes('absent') || prevText.includes('អវត្តមាន');
      let isHolidayTable = !isAbsentTable && (prevText.includes('holiday') || prevText.includes('សម្រាក') || prevText.includes('day off') || prevText.includes('dayoff'));
      let isRequestLeaveTable = !isAbsentTable && !isHolidayTable && (prevText.includes('leave') || prevText.includes('ច្បាប់'));
      let isAttendancesTable = !isAbsentTable && !isHolidayTable && !isRequestLeaveTable && (prevText.includes('attendances') || prevText.includes('វត្តមាន'));
      let isPendingTable = !isAbsentTable && !isHolidayTable && !isRequestLeaveTable && !isAttendancesTable && (prevText.includes('មិនទាន់ដល់ម៉ោង') || prevText.includes('not yet') || prevText.includes('pending'));
      
      // If we see check-in/out headers, it's definitely an attendance table regardless of box-title
      const headerText = $tbl.find('thead tr').text().toLowerCase();
      if (headerText.includes('ចូល') || headerText.includes('ចេញ') || headerText.includes('in') || headerText.includes('out')) {
        isAttendancesTable = true;
        isAbsentTable = false;
        isHolidayTable = false;
        isRequestLeaveTable = false;
        isPendingTable = false;
      }

      // Detect table column indices from thead
      let colIdx = {
        id: 0,
        staffCode: 1,
        name: 2,
        checkin1: -1,
        checkout1: -1,
        checkin2: -1,
        checkout2: -1,
        workHours: -1,
        note: -1,
        department: -1,
        type: -1,
        reason: -1,
        statusCol: -1
      };

      // Robust header detection using virtual column mapping (handling rowspan/colspan)
      const virtualHeader = [];
      
      // Detect headers in thead OR first row of tbody if thead is empty
      let headerRows = $tbl.find('thead tr');
      if (headerRows.length === 0) {
          // If no thead, check the first row of tbody if it contains th tags
          const firstRow = $tbl.find('tbody tr').first();
          if (firstRow.find('th').length > 0) {
              headerRows = firstRow;
          }
      }

      headerRows.each((rIdx, tr) => {
        let colIdx = 0;
        $(tr).find('th, td').each((i, el) => {
          const txt = $(el).text().trim().toLowerCase();
          const colSpan = parseInt($(el).attr('colspan') || '1');
          const rowSpan = parseInt($(el).attr('rowspan') || '1');
          
          // Skip already occupied virtual cells
          while (virtualHeader[rIdx] && virtualHeader[rIdx][colIdx]) {
            colIdx++;
          }
          
          // Fill virtual cells
          for (let r = 0; r < rowSpan; r++) {
            if (!virtualHeader[rIdx + r]) virtualHeader[rIdx + r] = [];
            for (let c = 0; c < colSpan; c++) {
              virtualHeader[rIdx + r][colIdx + c] = txt;
            }
          }
          colIdx += colSpan;
        });
      });

      // Map the final column indices based on normalized virtual header (collapsed across rows)
      if (virtualHeader.length > 0) {
          const columnCount = virtualHeader[0].length;
          for (let c = 0; c < columnCount; c++) {
              const labels = virtualHeader.map(row => row[c] || '').join(' ').toLowerCase();

              if ((labels.includes('staff id') || labels.includes('អត្តលេខ') || labels.includes('លេខកូដ') || labels.includes('code') || labels.includes('id')) && colIdx.staffCode === -1) colIdx.staffCode = c;
              if ((labels.includes('name') || labels.includes('ឈ្មោះ') || labels.includes('បុគ្គលិក')) && colIdx.name === -1) colIdx.name = c;
              
              if ((labels.includes('checkin') || labels.includes('check-in') || labels.includes('ចូល') || (labels.includes('in') && !labels.includes('out') && !labels.includes('work'))) && !labels.includes('2')) {
                if (colIdx.checkin1 === -1) colIdx.checkin1 = c;
              }
              if ((labels.includes('checkout') || labels.includes('check-out') || labels.includes('ចេញ')) && !labels.includes('2')) {
                if (colIdx.checkout1 === -1) colIdx.checkout1 = c;
              }
              if ((labels.includes('checkin') || labels.includes('check-in') || labels.includes('ចូល')) && labels.includes('2')) {
                if (colIdx.checkin2 === -1) colIdx.checkin2 = c;
              }
              if ((labels.includes('checkout') || labels.includes('check-out') || labels.includes('ចេញ')) && labels.includes('2')) {
                if (colIdx.checkout2 === -1) colIdx.checkout2 = c;
              }

              if ((labels.includes('hour') || labels.includes('ម៉ោង') || labels.includes('សរុប') || labels.includes('work')) && colIdx.workHours === -1) colIdx.workHours = c;
              if ((labels.includes('status') || labels.includes('ស្ថានភាព')) && colIdx.statusCol === -1) colIdx.statusCol = c;
              if ((labels.includes('type') || labels.includes('ប្រភេទ') || labels.includes('ច្បាប់')) && colIdx.type === -1) colIdx.type = c;
              if ((labels.includes('reason') || labels.includes('មូលហេតុ')) && colIdx.reason === -1) colIdx.reason = c;
              if ((labels.includes('department') || labels.includes('ផ្នែក')) && colIdx.department === -1) colIdx.department = c;
          }
      }

      // ONLY treat as attendance table if we found BOTH ID and at least one scan column
      if (colIdx.staffCode !== -1 && (colIdx.checkin1 !== -1 || colIdx.checkout1 !== -1)) {
          isAttendancesTable = true;
          isAbsentTable = false;
          isHolidayTable = false;
          isRequestLeaveTable = false;
          isPendingTable = false;
      }

      console.log(`[Checkinme] Table ${tIdx} (${prevText}): Detected Columns:`, colIdx, "isAttendance:", isAttendancesTable);

      // HIGH PRIORITY OVERRIDE for the Hospital structure
      const headText = $tbl.find('thead').text();
      // Detect both English AND Khmer ID/Name/In/Out patterns
      const hasSid = headText.includes('STAFF ID') || headText.includes('អត្តលេខ');
      const hasName = headText.includes('NAME') || headText.includes('ឈ្មោះ');
      const hasCheckin = headText.includes('CHECKIN') || headText.includes('ចូល');
      const hasReason = headText.includes('REASON') || headText.includes('មូលហេតុ') || headText.includes('TYPE') || headText.includes('ប្រភេទ');

      // Specific override for Request Leave Table (8-column variant: No|ID|Name|Dept|Mgr|Type|Reason|Status)
      // Prefer automatic virtualHeader detection if it found the columns
      // [Removed hardcoded overrides to allow the flexible detection to work across different table layouts]

      if (isAttendancesTable && hasSid && hasName && hasCheckin) {
          colIdx.staffCode = 1; 
          colIdx.name = 2;
          colIdx.checkin1 = 3;
          colIdx.checkout1 = 4;
          colIdx.checkin2 = 5;
          colIdx.checkout2 = 6;
          colIdx.note = 7;
          if (colIdx.department === -1) colIdx.department = -1; // Not in this table view (Image A)
      }
      // Alternate Hospital structure (with Gender/Service) as seen in dump_html
      else if (isAttendancesTable && (headText.includes('Employee') || headText.includes('ឈ្មោះ')) && (headText.includes('Gender') || headText.includes('Service'))) {
          colIdx.staffCode = 1; 
          colIdx.name = 1;      // In this version, ID and Name are often in the same column 1
          if (colIdx.department === -1) colIdx.department = 3;
          colIdx.checkin1 = 4;
          colIdx.checkout1 = 5;
          colIdx.checkin2 = 6;
          colIdx.checkout2 = 7;
          colIdx.workHours = -1; // Let it be detected or ignored if not clear
      }

      // If a table has Reason or Type columns and NO checkin columns, it's very likely a Request Leave table
      if (colIdx.checkin1 === -1 && (colIdx.reason !== -1 || colIdx.type !== -1)) {
        isRequestLeaveTable = true;
        isAttendancesTable = false;
        isHolidayTable = false;
        isAbsentTable = false;
        isPendingTable = false;
      }

      // If it has checkin/out columns, it's definitely Attendances even if preceding text missed it
      if (colIdx.checkin1 !== -1 && colIdx.checkout1 !== -1) {
        isAttendancesTable = true;
        isHolidayTable = false;
        isRequestLeaveTable = false;
        isAbsentTable = false;
        isPendingTable = false;
      } else {
        // We cannot rely purely on missing checkins to flag as absent.
        // If we don't know what it is, we'll try to infer from the tab or index (1=Attendances, 2=Holiday, etc.)
        // For now, if we can't detect, keep it false and don't overwrite.
      }

      // DEBUG: write headers to file so we can see what Checkinme actually outputs
      try {
         const debugStr = `TIME: ${new Date().toISOString()}\nDETECTED TYPE: Absent=${isAbsentTable}, Attendances=${isAttendancesTable}\nHEADERS: ${headersFound.join(' | ')}\nCOLS: ${JSON.stringify(colIdx)}\n-------------------\n`;
         fs.appendFileSync(path.join(process.cwd(), 'checkinme_heads.txt'), debugStr);
      } catch(err) {}

      
      let rows = $tbl.find('tbody tr');
      // If we used the first row as headers, skip it
      if ($tbl.find('thead tr').length === 0 && rows.first().find('th').length > 0) {
          rows = rows.slice(1);
      }

      
      rows.each((i, tr) => {
        const $tds = $(tr).find('td');
        if ($tds.length < 3) return;

        const tdsText = [];
        const tdsStatuses = []; // Capture second lines (Early/Late)
        const tdsFullText = []; // Capture all lines joined for reasons/names

        $tds.each((j, td) => {
          const $td = $(td);
          const rawHtml = $td.html() || '';
          const rawText = $td.text().trim();
          
          // Robustly get lines split by <br>
          const lines = rawHtml.split(/<br\s*\/?>/i).map(l => l.replace(/<[^>]*>?/gm, '').trim());
          
          // Primary: first line (usually time or ID)
          let line1 = lines[0] || '';
          // Secondary: second line (usually status info like Early/Late)
          let line2 = lines[1] || '';
          
          // Full text: all lines joined (best for Name, Dept, Type, Reason, Note)
          const allText = lines.filter(Boolean).join(' ');
          
          // Fallback: if line1 is empty but the cell HAS text
          if (!line1 && rawText) {
             line1 = rawText;
          }

          tdsText.push(line1);
          tdsStatuses.push(line2);
          tdsFullText.push(allText); // New array for comprehensive data
        });

        let staffCode = colIdx.staffCode !== -1 ? tdsText[colIdx.staffCode] : '';
        let empName = colIdx.name !== -1 ? tdsFullText[colIdx.name] : ''; // Capture multi-line name/job/dept
        let checkin1 = colIdx.checkin1 !== -1 ? tdsText[colIdx.checkin1] : '';
        let checkout1 = colIdx.checkout1 !== -1 ? tdsText[colIdx.checkout1] : '';
        let checkin2 = colIdx.checkin2 !== -1 ? tdsText[colIdx.checkin2] : '';
        let checkout2 = colIdx.checkout2 !== -1 ? tdsText[colIdx.checkout2] : '';
        let workHours = colIdx.workHours !== -1 ? tdsText[colIdx.workHours] : '';
        let note = colIdx.note !== -1 ? tdsFullText[colIdx.note] : ''; // Capture multi-line note
        let department = colIdx.department !== -1 ? tdsFullText[colIdx.department] : ''; 
        let reqType = colIdx.type !== -1 ? tdsFullText[colIdx.type] : ''; // Capture multi-line leave type
        let reqReason = colIdx.reason !== -1 ? tdsFullText[colIdx.reason] : ''; // Capture multi-line reason
        let reqStatus = colIdx.statusCol !== -1 ? tdsFullText[colIdx.statusCol] : '';


        // Capture statuses from Checkin/Out columns
        const colStatuses = [];
        if (colIdx.checkin1 !== -1 && tdsStatuses[colIdx.checkin1]) colStatuses.push(`In1: ${tdsStatuses[colIdx.checkin1]}`);
        if (colIdx.checkout1 !== -1 && tdsStatuses[colIdx.checkout1]) colStatuses.push(`Out1: ${tdsStatuses[colIdx.checkout1]}`);
        if (colIdx.checkin2 !== -1 && tdsStatuses[colIdx.checkin2]) colStatuses.push(`In2: ${tdsStatuses[colIdx.checkin2]}`);
        if (colIdx.checkout2 !== -1 && tdsStatuses[colIdx.checkout2]) colStatuses.push(`Out2: ${tdsStatuses[colIdx.checkout2]}`);

        if (colStatuses.length > 0) {
           const statusNote = colStatuses.join(', ');
           note = note ? `${note}; ${statusNote}` : statusNote;
        }

        // Safely combine type and reason if found explicitly
        if (reqType || reqReason) {
           const combined = (reqType ? reqType + (reqReason ? ' - ' : '') : '') + reqReason;
           if (combined) {
             note = note ? `${note}; ${combined}` : combined;
             if (reqStatus) note += ` (${reqStatus})`;
           }
        }

        // Detect severe CheckinMe HTML misalignment where tbody has more columns than thead (injected Gender & Branch)
        if (isAttendancesTable) {
           const maleFem2 = String(tdsText[2]).toLowerCase();
           const maleFem1 = String(tdsText[1]).toLowerCase();
           
           if (maleFem2 === 'female' || maleFem2 === 'male') {
               // Normal hospital case where Gender is at index 2
               // 0=No, 1=StaffId/Name, 2=Gender, 3=Branch, 4=In, 5=Out...
               staffCode = tdsText[1] || ''; 
               empName = tdsText[1] || ''; 
               department = tdsText[3] || ''; 
               checkin1 = tdsText[4] || '';
               checkout1 = tdsText[5] || '';
               checkin2 = tdsText[6] || '';
               checkout2 = tdsText[7] || '';
               workHours = tdsText[8] || '';
           } else if (maleFem1 === 'female' || maleFem1 === 'male') {
               // Rare case where Gender is at index 1
               // 0=StaffName, 1=Gender, 2=Branch, 3=In, 4=Out...
               staffCode = tdsText[0] || ''; 
               empName = tdsText[0] || ''; 
               department = tdsText[2] || ''; 
               checkin1 = tdsText[3] || '';
               checkout1 = tdsText[4] || '';
               checkin2 = tdsText[5] || '';
               checkout2 = tdsText[6] || '';
               workHours = tdsText[7] || '';
           }
        }

        // Skip header-like rows or empty
        if (!empName || empName.toLowerCase().includes('name') || empName.toLowerCase().includes('ឈ្មោះ')) return;
        if (!empName && !staffCode) return;

        // Resolve staffId
        let resolvedStaffId = staffCode || null;
        // If the staff code is missing, not a number, or looks like CheckinMe's internal numbers, fall back to lookup
        const isEmpCode = (s) => /^[A-Z]\d+/.test(String(s).toUpperCase());
        if (!resolvedStaffId || (isNaN(resolvedStaffId) && !isEmpCode(resolvedStaffId)) || String(resolvedStaffId).length < 4 || String(resolvedStaffId) === empName) {
          const lookupName = normalizeKhmer(empName);
          const lookupResult = staffIdMap[lookupName];
          if (lookupResult) {
            resolvedStaffId = Array.isArray(lookupResult) ? lookupResult[0]?.staffId : lookupResult?.staffId;
          }
        }

        // If after all that, we still have a non-numeric or non-code string, null it
        if (resolvedStaffId === empName) resolvedStaffId = null;

        // Clean time strings - robustly extract only the time part
        const cleanTime = (t) => {
          if (!t || t === '--' || t === '---' || t === '...') return '';
          // Remove hidden characters and whitespace
          const cleaned = String(t).replace(/[^\x20-\x7E]/g, '').trim();
          const m = cleaned.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
          return m ? m[1].toUpperCase().trim() : (cleaned.length < 20 ? cleaned : '');
        };

        const parseWorkHours = (wh) => {
          if (!wh) return null;
          const m = String(wh).match(/([\d.]+)/);
          return m ? parseFloat(m[1]) : null;
        };

        const parsedCheckin1 = (colIdx.checkin1 !== -1) ? cleanTime(checkin1) : '';
        const parsedCheckout1 = (colIdx.checkout1 !== -1) ? cleanTime(checkout1) : '';
        const parsedCheckin2 = (colIdx.checkin2 !== -1) ? cleanTime(checkin2) : '';
        const parsedCheckout2 = (colIdx.checkout2 !== -1) ? cleanTime(checkout2) : '';
        const parsedWorkHours = (colIdx.workHours !== -1) ? parseWorkHours(workHours) : null;

        let status = 'present';
        const noteL = (note || '').toLowerCase();
        
        if (isHolidayTable || noteL.includes('holiday') || noteL.includes('day off') || noteL.includes('dayoff') || noteL.includes('សម្រាក')) {
          status = 'holiday';
        } else if (isRequestLeaveTable || noteL.includes('leave') || noteL.includes('ច្បាប់')) {
          status = 'leave';
        } else if (isPendingTable) {
          status = 'pending';
        } else if (isAbsentTable || noteL.includes('absent') || noteL.includes('អវត្តមាន')) {
          status = 'absent';
          // Force present if times were found, regardless of table identification
          if (parsedCheckin1 || parsedCheckin2 || parsedCheckout1 || parsedCheckout2) {
            status = 'present';
          }
        } else if (!parsedCheckin1 && !parsedCheckin2 && !parsedCheckout1 && !parsedCheckout2) {
          // If no times found and NOT a specific table, default to absent
          status = 'absent';
        } else {
          // If ANY valid time exists, it MUST be 'present'
          status = 'present';
        }
        // If status is Leave but type/reason are empty, check if Note contains info
        if (status === 'leave' && !reqType && !reqReason && note) {
            reqType = 'ច្បាប់'; 
            reqReason = note;
        }

        
        const checkin1L = String(checkin1).toLowerCase();
        const checkout1L = String(checkout1).toLowerCase();
        
        const isLate = isAttendancesTable && (
          (noteL.includes('in') && noteL.includes('late')) || 
          checkin1L.includes('late') || 
          noteL.includes('ចូលយឺត') || 
          (noteL.includes('late') && !noteL.includes('out') && !noteL.includes('early'))
        );
        const leftEarly = isAttendancesTable && (
          (noteL.includes('out') && noteL.includes('early')) || 
          checkout1L.includes('early') || 
          noteL.includes('ចេញមុន') ||
          (noteL.includes('early') && !noteL.includes('in') && !noteL.includes('late'))
        );
        const isPastDate = date && new Date(date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
        const plech = isAttendancesTable && (
          noteL.includes('forgot') || 
          noteL.includes('ភ្លេច') || 
          noteL.includes('plech') || 
          (parsedCheckin1 && !parsedCheckout1 && isPastDate && !isHolidayTable && !isRequestLeaveTable)
        );

        let reqManager = '';
        
        $tbl.find('thead tr').last().find('th, td').each((i, el) => {
          if ($(el).text().trim().toLowerCase().includes('manager') || $(el).text().trim().toLowerCase().includes('អ្នកគ្រប់គ្រង')) {
            reqManager = tdsText[i] || '';
          }
        });

        // Capture all potential name variants (English, Khmer, or aliases)
        const nameVariants = $tds.eq(colIdx.name).html()
          ? $tds.eq(colIdx.name).html().split(/<br\s*\/?>/i)
              .map(l => l.replace(/<[^>]*>?/gm, '').trim())
              .filter(l => l.length > 0)
          : [empName];

        
        if (staffCode.includes('1346') || empName.includes('យូហេង')) {
            console.log(`[DEBUG S1346] TableType: Attend=${isAttendancesTable}, Leave=${isRequestLeaveTable}, Note: ${note}, Type: ${reqType}, Status: ${status}`);
        }

        const newItem = {
          staffCode,
          staffId: resolvedStaffId,
          name: empName,
          nameVariants, // New: all lines from the name cell
          date: date || new Date().toISOString().slice(0, 10),
          checkin1: parsedCheckin1,
          checkout1: parsedCheckout1,
          checkin2: parsedCheckin2,
          checkout2: parsedCheckout2,
          workHours: parsedWorkHours,
          department: department,
          manager: reqManager,
          leaveType: reqType,
          leaveReason: reqReason,
          note: note || '',
          rawCheckin1: checkin1,
          rawCheckout1: checkout1,
          status,
          isLate,
          leftEarly,
          plech,
        };

        // [LOGGING] Trace every extraction to the terminal
        if (newItem.staffId || newItem.name) {
          const leaveInfo = status === 'leave' ? ` | Type: ${newItem.leaveType || '--'}, Reason: ${newItem.leaveReason || '--'}` : '';
          console.log(`[Scraper] Found: ${staffCode} | ${empName} | Status: ${status}${leaveInfo}${note ? ' | Note: ' + note : ''}`);
        }

        const existingIdx = items.findIndex(x => {
            const sidMatch = (x.staffId && newItem.staffId && String(x.staffId).toUpperCase().replace(/^([a-zA-Z]+)0+/, '$1') === String(newItem.staffId).toUpperCase().replace(/^([a-zA-Z]+)0+/, '$1'));
            const nameMatch = (x.name && newItem.name && normalizeKhmer(x.name) === normalizeKhmer(newItem.name));
            return sidMatch || nameMatch;
        });
        
        if (existingIdx === -1) {
             items.push(newItem);
        } else {
             const exist = items[existingIdx];
             // Merge, preferring actual times over blank
             exist.checkin1 = exist.checkin1 || newItem.checkin1;
             exist.checkout1 = exist.checkout1 || newItem.checkout1;
             exist.checkin2 = exist.checkin2 || newItem.checkin2;
             exist.checkout2 = exist.checkout2 || newItem.checkout2;
             exist.workHours = exist.workHours || newItem.workHours;
             exist.department = exist.department || newItem.department;
             // Robustly merge leave details - prioritize any non-empty value
             if (newItem.leaveType && newItem.leaveType !== '—' && newItem.leaveType !== '') {
               if (!exist.leaveType || exist.leaveType === '—' || exist.leaveType === '') exist.leaveType = newItem.leaveType;
             }
             if (newItem.leaveReason && newItem.leaveReason !== '—' && newItem.leaveReason !== '') {
               if (!exist.leaveReason || exist.leaveReason === '—' || exist.leaveReason === '') exist.leaveReason = newItem.leaveReason;
             }
             exist.note = (exist.note && exist.note !== newItem.note) ? `${exist.note}; ${newItem.note}` : (exist.note || newItem.note);
             
             const hasTimes = !!(exist.checkin1 || exist.checkout1 || exist.checkin2 || exist.checkout2);
             
             if (hasTimes) {
                 exist.status = 'present';
             } else {
                 const getPrio = (s) => {
                    const p = String(s || '').toLowerCase();
                    if (p === 'present') return 4;
                    if (p === 'leave') return 3;
                    if (p === 'holiday') return 2;
                    if (p === 'absent') return 1;
                    return 0;
                 };
                 if (getPrio(newItem.status) > getPrio(exist.status)) {
                    exist.status = newItem.status;
                 }
             }
        }
      });
    });

    console.log('[Checkinme] Daily Report parsed:', items.length, 'employees combined across all tables');
    return items;
  } catch (error) {
    console.error('[Checkinme] Daily Report Scraper Error:', error.message);
    throw error;
  }
}

/**
 * Service to scrape the Detail Report (scan logs) from Checkinme
 * URL: /admin/reports/detail?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&branch_id=&employee_category_type_id=
 */
export async function scrapeCheckinmeDetailReport(options = {}) {
  const { fromDate, toDate, branchId = '', categoryTypeId = '' } = options;

  try {
    const { client, baseUrl } = await loginToCheckinme(options);
    console.log('[Checkinme] Fetching Detail Report for range:', fromDate || 'today', 'to', toDate || 'today');

    // Build the staffId map first for name resolution
    const staffIdMap = await buildStaffIdMapFromEmployees(client, baseUrl);

    const reportUrl = new URL(`${baseUrl}/admin/reports/detail`);
    if (fromDate) reportUrl.searchParams.set('from_date', fromDate);
    if (toDate) reportUrl.searchParams.set('to_date', toDate);
    if (branchId) reportUrl.searchParams.set('branch_id', branchId);
    if (categoryTypeId) reportUrl.searchParams.set('employee_category_type_id', categoryTypeId);
    reportUrl.searchParams.set('limit', '500'); // Bring as many as possible

    console.log('[Checkinme] Requesting Detail Report:', reportUrl.toString());
    const pageRes = await client.get(reportUrl.toString());
    const $ = cheerio.load(pageRes.data);

    const items = [];
    const tbl = $('table').first();
    const rows = tbl.find('tbody tr');

    // Column detection from header
    let colIdx = {
      staffCode: 1,
      name: 2,
      branch: 3,
      department: 4,
      mode: 5,
      date: 6,
      time: 7,
      device: 8
    };

    const headerCells = tbl.find('thead tr').last().find('th, td');
    headerCells.each((i, el) => {
      const txt = $(el).text().trim().toLowerCase();
      if (txt.includes('code') || txt.includes('id') || txt.includes('អត្តលេខ') || txt.includes('បាកូដ') || txt.includes('លេខកាត')) colIdx.staffCode = i;
      else if (txt.includes('name') || txt.includes('ឈ្មោះ') || txt.includes('បុគ្គលិក')) colIdx.name = i;
      else if (txt.includes('branch') || txt.includes('សាខា')) colIdx.branch = i;
      else if (txt.includes('depart') || txt.includes('ផ្នែក')) colIdx.department = i;
      else if (txt.includes('mode') || txt.includes('ស្ថានភាព') || txt.includes('របៀប')) colIdx.mode = i;
      else if (txt.includes('date') || txt.includes('កាលបរិច្ឆេទ')) colIdx.date = i;
      else if (txt.includes('time') || txt.includes('ម៉ោង')) colIdx.time = i;
      else if (txt.includes('device') || txt.includes('ម៉ាស៊ីន')) colIdx.device = i;
    });

    rows.each((i, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 5) return;

      const tdsText = [];
      tds.each((j, td) => tdsText.push($(td).text().trim()));

      const staffCode = tdsText[colIdx.staffCode] || '';
      const name = tdsText[colIdx.name] || '';
      const mode = tdsText[colIdx.mode] || '';
      const branch = tdsText[colIdx.branch] || '';
      const department = tdsText[colIdx.department] || '';
      const rowDateString = tdsText[colIdx.date] || '';
      const timeStr = tdsText[colIdx.time] || '';
      const device = tdsText[colIdx.device] || '';

      // Skip empty
      if (!name && !staffCode) return;

      // Resolve staffId
      let resolvedStaffId = staffCode || null;
      if (!resolvedStaffId || isNaN(resolvedStaffId) || String(resolvedStaffId).length < 5 || String(resolvedStaffId) === name) {
        const lookupResult = staffIdMap[normalizeKhmer(name)];
        if (lookupResult) {
          resolvedStaffId = Array.isArray(lookupResult) ? lookupResult[0]?.staffId : lookupResult?.staffId;
        }
      }

      // Convert date string (often DD/MM/YYYY) to Date object
      let parsedDate = new Date();
      if (rowDateString.includes('/')) {
        const [d, m, y] = rowDateString.split('/');
        parsedDate = new Date(Date.UTC(y, m - 1, d));
      } else if (fromDate) {
        const parts = fromDate.split('-');
        parsedDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      }

      items.push({
        staffId: resolvedStaffId || staffCode,
        staffName: name,
        date: parsedDate,
        checkTime: timeStr,
        mode,
        branch,
        department,
        device
      });
    });

    console.log('[Checkinme] Detail Report parsed:', items.length, 'logs');
    return items;
  } catch (error) {
    console.error('[Checkinme] Detail Report Scraper Error:', error.message);
    throw error;
  }
}
