import express from 'express';
import https from 'https';
import MeetingRoomBooking from '../models/MeetingRoomBooking.js';
import MeetingRoomImage from '../models/MeetingRoomImage.js';

const router = express.Router();

const normalizeDateStr = (dateStr) => {
  if (!dateStr) return '';
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  let norm = dateStr.toString();
  khmerDigits.forEach((khmer, eng) => {
    norm = norm.replaceAll(khmer, eng.toString());
  });
  
  const partsSlash = norm.split('/');
  if (partsSlash.length === 3) {
    let part1 = parseInt(partsSlash[0], 10);
    let part2 = parseInt(partsSlash[1], 10);
    const year = partsSlash[2].trim();
    
    let month = part1;
    let day = part2;
    
    // If part1 is > 12, then it must be DD/MM/YYYY
    if (part1 > 12) {
      day = part1;
      month = part2;
    } else if (part2 > 12) {
      // If part2 > 12, then it must be MM/DD/YYYY
      month = part1;
      day = part2;
    } else {
      // Both are <= 12. Default to MM/DD/YYYY since the sheet is October-based
      month = part1;
      day = part2;
    }
    
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  }
  
  const partsHyphen = norm.split('-');
  if (partsHyphen.length === 3) {
    const first = partsHyphen[0].trim();
    if (first.length === 4) {
      return `${first}-${partsHyphen[1].padStart(2, '0')}-${partsHyphen[2].padStart(2, '0')}`;
    } else {
      let part1 = parseInt(partsHyphen[0], 10);
      let part2 = parseInt(partsHyphen[1], 10);
      const year = partsHyphen[2].trim();
      let month = part1;
      let day = part2;
      if (part1 > 12) {
        day = part1;
        month = part2;
      } else {
        month = part1;
        day = part2;
      }
      const mStr = String(month).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }
  return norm;
};

const downloadCSV = (url) => {
  return new Promise((resolve, reject) => {
    const fetchUrl = (targetUrl, depth = 0) => {
      if (depth > 5) {
        return reject(new Error("Too many redirects"));
      }
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const redirectUrl = res.headers.location;
          if (!redirectUrl) {
            return reject(new Error("Redirect header location missing"));
          }
          return fetchUrl(redirectUrl, depth + 1);
        }
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', reject);
    };
    
    fetchUrl(url);
  });
};

// GET /api/meeting-rooms - fetch all or specific date
router.get('/', async (req, res) => {
  try {
    // Automatically wipe the old seeded mock bookings if they exist
    await MeetingRoomBooking.deleteMany({
      title: { 
        $in: [
          "ប្រជុំគណៈកម្មការនាយកប្រចាំសប្តាហ៍", 
          "សម្ភាសន៍ជ្រើសរើសបុគ្គលិកជាន់ខ្ពស់", 
          "Marketing Strategy 2026", 
          "ប្រជុំពិភាក្សាប្រព័ន្ធ Checkin Me"
        ] 
      }
    });

    const { dateStr } = req.query;
    const query = dateStr ? { dateStr } : {};
    const bookings = await MeetingRoomBooking.find(query);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/meeting-rooms/diagnostic - Trace CSV parse results row-by-row
router.get('/diagnostic', async (req, res) => {
  try {
    const csvUrl = "https://docs.google.com/spreadsheets/d/1f0PrCuBMOfr363vUzsSEbAOJkMWrNAsCAMYkC7kvNaM/export?format=csv&sheet=Form_KSFH";
    const csvData = await downloadCSV(csvUrl);

    if (csvData.trim().startsWith('<!DOCTYPE html') || csvData.trim().toLowerCase().includes('<html')) {
      return res.type('text/plain').send("FAILED: ឯកសារ Google Sheet នេះត្រូវបានកំណត់ជា Private (ឯកជន)។\nសូមចងចាំថា៖\n1. បើកឯកសារ Google Sheet របស់បង\n2. ចុចប៊ូតុង 'Share' (ចែករំលែក) នៅខាងលើខាងស្តាំ\n3. ប្តូរ 'General access' (ការចូលប្រើប្រាស់ទូទៅ) ពី 'Restricted' ទៅជា 'Anyone with the link' (អ្នកណាដែលមានតំណភ្ជាប់ក៏អាចមើលបាន)\n4. រួចព្យាយាមទាញយកទិន្នន័យម្តងទៀតបាទ!");
    }

    const lines = csvData.split(/\r?\n/);
    
    const logs = [];
    logs.push(`Total CSV lines downloaded: ${lines.length}`);
    
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        logs.push(`Row ${i}: Empty line`);
        continue;
      }
      const cols = parseCSVLine(line);
      if (i === 0) {
        logs.push(`Row 0 (Header, columns count ${cols.length}): ${JSON.stringify(cols)}`);
        continue;
      }
      
      const title = cols[1];
      const user = cols[2];
      const dateRaw = cols[5];
      const dateStr = normalizeDateStr(dateRaw);
      
      if (!title && !user && !dateRaw) {
        logs.push(`Row ${i}: Skipped because title, user, and date are all empty (empty spreadsheet row).`);
        continue;
      }
      
      if (!title || !user || !dateStr) {
        logs.push(`Row ${i}: Skipped due to missing required field. Title="${title || ''}", User="${user || ''}", DateRaw="${dateRaw || ''}", ParsedDate="${dateStr || ''}"`);
        continue;
      }
      
      logs.push(`Row ${i}: Valid. Title="${title}", User="${user}", Date="${dateStr}". Raw columns: ${JSON.stringify(cols)}`);
    }
    
    res.type('text/plain').send(logs.join('\n'));
  } catch (err) {
    res.status(500).send(`Diagnostic Error: ${err.message}`);
  }
});

// GET /api/meeting-rooms/db-check - Quick list of all entries in DB
router.get('/db-check', async (req, res) => {
  try {
    const bookings = await MeetingRoomBooking.find({});
    let out = `Total bookings found in MongoDB 'meetingroombookings': ${bookings.length}\n\n`;
    bookings.forEach((b, idx) => {
      out += `Booking #${idx}:\n`;
      out += `  Title: "${b.title}"\n`;
      out += `  User: "${b.user}"\n`;
      out += `  RoomId: "${b.roomId}"\n`;
      out += `  DateStr: "${b.dateStr}"\n`;
      out += `  Slot: "${b.slot}"\n`;
      out += `  StartTime: "${b.startTime}"\n`;
      out += `  EndTime: "${b.endTime}"\n`;
      out += `  Raw: ${JSON.stringify(b)}\n\n`;
    });
    res.type('text/plain').send(out);
  } catch (err) {
    res.status(500).send(`DB Check Error: ${err.message}`);
  }
});

// GET /api/meeting-rooms/images - Fetch all custom room images (MUST be before /:id)
router.get('/images', async (req, res) => {
  try {
    const images = await MeetingRoomImage.find({});
    // Convert to object with roomId as key
    const result = {};
    images.forEach(img => {
      result[img.roomId] = img.imageUrl;
    });
    res.json(result);
  } catch (err) {
    console.error('Error fetching room images:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meeting-rooms/images - Save or update a room's custom image (MUST be before /:id)
router.post('/images', async (req, res) => {
  try {
    const { roomId, imageUrl } = req.body;
    if (!roomId || !imageUrl) {
      return res.status(400).json({ message: 'roomId and imageUrl are required' });
    }

    // Use findOneAndUpdate with upsert to save or update
    const updated = await MeetingRoomImage.findOneAndUpdate(
      { roomId },
      { 
        roomId,
        imageUrl,
        uploadedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error('Error saving room image:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meeting-rooms - Create a new booking
router.post('/', async (req, res) => {
  try {
    const booking = new MeetingRoomBooking(req.body);
    await booking.save();
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/meeting-rooms/:id - Update booking
router.put('/:id', async (req, res) => {
  try {
    const booking = await MeetingRoomBooking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/meeting-rooms/:id - Delete booking
router.delete('/:id', async (req, res) => {
  try {
    const booking = await MeetingRoomBooking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/meeting-rooms/sync-google-sheet - Sync bookings from Google Sheet
router.post('/sync-google-sheet', async (req, res) => {
  try {
    const csvUrl = "https://docs.google.com/spreadsheets/d/1f0PrCuBMOfr363vUzsSEbAOJkMWrNAsCAMYkC7kvNaM/export?format=csv&sheet=Form_KSFH";
    const csvData = await downloadCSV(csvUrl);
    
    if (csvData.trim().startsWith('<!DOCTYPE html') || csvData.trim().toLowerCase().includes('<html')) {
      return res.status(400).json({
        success: false,
        message: "ឯកសារ Google Sheet នេះត្រូវបានកំណត់ជា Private (ឯកជន)។ សូម Share ឯកសារនេះទៅជា 'Anyone with the link' (អ្នកណាដែលមានតំណភ្ជាប់ក៏អាចមើលបាន) នៅក្នុង Google Sheet រួចព្យាយាមម្តងទៀតបាទ!"
      });
    }

    // Split into lines
    const lines = csvData.split(/\r?\n/);
    if (lines.length <= 1) {
      return res.json({ success: true, message: "គ្មានទិន្នន័យនៅក្នុងកម្រងបញ្ជីឡើយ!", importedCount: 0 });
    }

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // Helper functions
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const normalizeTime = (timeStr) => {
      if (!timeStr) return '08:00 AM';
      let norm = timeStr.trim();
      if (norm.toUpperCase().includes('AM') || norm.toUpperCase().includes('PM')) {
        return norm;
      }
      const parts = norm.split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1].slice(0, 2).padStart(2, '0');
        const suffix = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${suffix}`;
      }
      return norm;
    };

    const matchRoomId = (locationName) => {
      if (!locationName) return 'bayon';
      const name = locationName.toLowerCase();
      if (name.includes('បាយ័ន') || name.includes('bayon')) return 'bayon';
      if (name.includes('នាគព័ន្ធ') || name.includes('neakpoan') || name.includes('neak')) return 'neakpoan';
      if (name.includes('បន្ទាយស្រី') || name.includes('banteaysrei') || name.includes('banteay')) return 'banteaysrei';
      if (name.includes('ព្រះខ័ន') || name.includes('preahkhan') || name.includes('preah')) return 'preahkhan';
      if (name.includes('រដ្ឋបាល') || name.includes('administration') || name.includes('admin')) return 'administration';
      if (name.includes('រង់ចាំ') || name.includes('waiting') || name.includes('wait')) return 'waiting';
      return 'bayon';
    };

    const getRoomDisplayName = (roomId) => {
      switch(roomId) {
        case 'bayon': return 'បន្ទប់បាយ័ន';
        case 'neakpoan': return 'បន្ទប់នាគព័ន្ធ';
        case 'banteaysrei': return 'បន្ទប់បន្ទាយស្រី';
        case 'preahkhan': return 'បន្ទប់ព្រះខ័ណ';
        case 'administration': return 'បន្ទប់រដ្ឋបាល';
        case 'waiting': return 'បន្ទប់រង់ចាំ';
        default: return 'បន្ទប់បាយ័ន';
      }
    };

    const getSlotFromTime = (timeStr) => {
      if (!timeStr) return "08:00 - 10:00";
      const parts = timeStr.split(':');
      let hour = parseInt(parts[0], 10);
      if (timeStr.toUpperCase().includes('PM') && hour !== 12) {
        hour += 12;
      } else if (timeStr.toUpperCase().includes('AM') && hour === 12) {
        hour = 0;
      }
      if (hour < 10) return "08:00 - 10:00";
      if (hour < 12) return "10:00 - 12:00";
      if (hour < 14) return "12:00 - 14:00";
      if (hour < 16) return "14:00 - 16:00";
      return "16:00 - 18:00";
    };

    const normalizeParticipants = (p) => {
      if (!p) return '5 នាក់';
      let val = p.toString().trim();
      if (!val.includes('នាក់')) {
        return `${val} នាក់`;
      }
      return val;
    };

    let importedCount = 0;
    const processedKeys = new Set();

    // Skip the header row (index 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCSVLine(line);
      if (columns.length < 9) continue;

      const title = columns[1];
      const user = columns[2];
      const amenities = columns[3];
      const technician = columns[4];
      const dateStr = normalizeDateStr(columns[5]);
      const startTime = normalizeTime(columns[6]);
      const endTime = normalizeTime(columns[7]);
      const roomId = matchRoomId(columns[8]);
      const roomName = getRoomDisplayName(roomId);
      const participants = normalizeParticipants(columns[9]);
      
      let note = columns[10] || '';
      if (technician && technician.toLowerCase() !== 'មិនមាន' && technician.toLowerCase() !== 'no') {
        note = `អ្នកបច្ចេកទេស៖ ${technician}. ${note}`.trim();
      }

      if (!title || !user || !dateStr) continue;

      // Prevent duplicate processing of duplicate rows within the CSV itself
      const uniqueKey = `${roomId}_${dateStr}_${startTime}_${endTime}`.toLowerCase();
      if (processedKeys.has(uniqueKey)) continue;
      processedKeys.add(uniqueKey);

      const slot = getSlotFromTime(startTime);

      // Check if duplicate already exists (same room, date, and time slot)
      const duplicate = await MeetingRoomBooking.findOne({
        roomId,
        dateStr,
        startTime,
        endTime
      });

      if (!duplicate) {
        const newBooking = new MeetingRoomBooking({
          title,
          user,
          roomId,
          slot,
          roomName,
          dateStr,
          dateText: dateStr === todayStr ? "ថ្ងៃនេះ" : "",
          startTime,
          endTime,
          participants,
          amenities,
          note,
          isCancelled: false
        });
        await newBooking.save();
        importedCount++;
      }
    }

    res.json({ success: true, message: `ទាញយកទិន្នន័យបានសម្រេច! នាំចូលថ្មីចំនួន ${importedCount} កំណត់ត្រា។`, importedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const autoSyncMeetingRooms = async () => {
  try {
    const csvUrl = "https://docs.google.com/spreadsheets/d/1f0PrCuBMOfr363vUzsSEbAOJkMWrNAsCAMYkC7kvNaM/export?format=csv&sheet=Form_KSFH";
    const csvData = await downloadCSV(csvUrl);
    
    if (csvData.trim().startsWith('<!DOCTYPE html') || csvData.trim().toLowerCase().includes('<html')) {
      return;
    }

    const lines = csvData.split(/\r?\n/);
    if (lines.length <= 1) return;

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const normalizeTime = (timeStr) => {
      if (!timeStr) return '08:00 AM';
      let norm = timeStr.trim();
      if (norm.toUpperCase().includes('AM') || norm.toUpperCase().includes('PM')) {
        return norm;
      }
      const parts = norm.split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1].slice(0, 2).padStart(2, '0');
        const suffix = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${suffix}`;
      }
      return norm;
    };

    const matchRoomId = (locationName) => {
      if (!locationName) return 'bayon';
      const name = locationName.toLowerCase();
      if (name.includes('បាយ័ន') || name.includes('bayon')) return 'bayon';
      if (name.includes('នាគព័ន្ធ') || name.includes('neakpoan') || name.includes('neak')) return 'neakpoan';
      if (name.includes('បន្ទាយស្រី') || name.includes('banteaysrei') || name.includes('banteay')) return 'banteaysrei';
      if (name.includes('ព្រះខ័ន') || name.includes('preahkhan') || name.includes('preah')) return 'preahkhan';
      if (name.includes('រដ្ឋបាល') || name.includes('administration') || name.includes('admin')) return 'administration';
      if (name.includes('រង់ចាំ') || name.includes('waiting') || name.includes('wait')) return 'waiting';
      return 'bayon';
    };

    const getRoomDisplayName = (roomId) => {
      switch(roomId) {
        case 'bayon': return 'បន្ទប់បាយ័ន';
        case 'neakpoan': return 'បន្ទប់នាគព័ន្ធ';
        case 'banteaysrei': return 'បន្ទប់បន្ទាយស្រី';
        case 'preahkhan': return 'បន្ទប់ព្រះខ័ណ';
        case 'administration': return 'បន្ទប់រដ្ឋបាល';
        case 'waiting': return 'បន្ទប់រង់ចាំ';
        default: return 'បន្ទប់បាយ័ន';
      }
    };

    const getSlotFromTime = (timeStr) => {
      if (!timeStr) return "08:00 - 10:00";
      const parts = timeStr.split(':');
      let hour = parseInt(parts[0], 10);
      if (timeStr.toUpperCase().includes('PM') && hour !== 12) {
        hour += 12;
      } else if (timeStr.toUpperCase().includes('AM') && hour === 12) {
        hour = 0;
      }
      if (hour < 10) return "08:00 - 10:00";
      if (hour < 12) return "10:00 - 12:00";
      if (hour < 14) return "12:00 - 14:00";
      if (hour < 16) return "14:00 - 16:00";
      return "16:00 - 18:00";
    };

    const normalizeParticipants = (p) => {
      if (!p) return '5 នាក់';
      let val = p.toString().trim();
      if (!val.includes('នាក់')) {
        return `${val} នាក់`;
      }
      return val;
    };

    const processedKeys = new Set();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCSVLine(line);
      if (columns.length < 9) continue;

      const title = columns[1];
      const user = columns[2];
      const amenities = columns[3];
      const technician = columns[4];
      const dateStr = normalizeDateStr(columns[5]);
      const startTime = normalizeTime(columns[6]);
      const endTime = normalizeTime(columns[7]);
      const roomId = matchRoomId(columns[8]);
      const roomName = getRoomDisplayName(roomId);
      const participants = normalizeParticipants(columns[9]);
      
      let note = columns[10] || '';
      if (technician && technician.toLowerCase() !== 'មិនមាន' && technician.toLowerCase() !== 'no') {
        note = `អ្នកបច្គេកទេស៖ ${technician}. ${note}`.trim();
      }

      if (!title || !user || !dateStr) continue;

      // Prevent duplicate processing of duplicate rows within the CSV itself
      const uniqueKey = `${roomId}_${dateStr}_${startTime}_${endTime}`.toLowerCase();
      if (processedKeys.has(uniqueKey)) continue;
      processedKeys.add(uniqueKey);

      const slot = getSlotFromTime(startTime);

      // Check if duplicate already exists (same room, date, and time slot)
      const duplicate = await MeetingRoomBooking.findOne({
        roomId,
        dateStr,
        startTime,
        endTime
      });

      if (!duplicate) {
        const newBooking = new MeetingRoomBooking({
          title,
          user,
          roomId,
          slot,
          roomName,
          dateStr,
          dateText: dateStr === todayStr ? "ថ្ងៃនេះ" : "",
          startTime,
          endTime,
          participants,
          amenities,
          note,
          isCancelled: false
        });
        await newBooking.save();
      }
    }
    console.log('[AutoSync-MeetingRooms] Successfully auto-synced from Google Sheet!');
  } catch (err) {
    console.error('[AutoSync-MeetingRooms] Auto-sync failed:', err.message);
  }
};

// Start the automatic sync running every 10 minutes (600,000 ms)
setInterval(autoSyncMeetingRooms, 600000);

// One-time cleanup of legacy duplicate bookings already in the DB
setTimeout(async () => {
  try {
    const bookings = await MeetingRoomBooking.find({});
    const uniqueKeys = new Set();
    let deletedCount = 0;
    for (const booking of bookings) {
      const key = `${booking.roomId}_${booking.dateStr}_${booking.startTime}_${booking.endTime}`.toLowerCase();
      if (uniqueKeys.has(key)) {
        await MeetingRoomBooking.findByIdAndDelete(booking._id);
        deletedCount++;
      } else {
        uniqueKeys.add(key);
      }
    }
    if (deletedCount > 0) {
      console.log(`[AutoSync-MeetingRooms] Removed ${deletedCount} legacy duplicate bookings from database.`);
    }
  } catch (err) {
    console.error('Error cleaning up duplicate bookings:', err.message);
  }
}, 5000);

// Run an initial sync 10 seconds after server startup so it updates immediately
setTimeout(autoSyncMeetingRooms, 10000);

export default router;
