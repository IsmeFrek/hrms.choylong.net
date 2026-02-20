import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Attendance from '../models/Attendance.js';
import HR from '../models/HR.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../public/Uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const base = path.parse(file.originalname).name.replace(/[^\p{L}\p{N}\-_\.]+/gu, '-').replace(/-+/g, '-').slice(0,80) || 'img';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

// POST /api/attendance/identify
// Accepts multipart/form-data with field 'file' (image). Saves file and attempts a best-effort match
router.post('/identify', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return next(err);
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
      const url = `/Uploads/${req.file.filename}`;

      // Try exact image filename match on HR.image
      const imgName = req.file.filename;
      let hr = await HR.findOne({ image: new RegExp(imgName.replace(/[-\\.]/g, '\\$&'), 'i') }).lean();

      // Fallback: try to parse staffId/card number from filename (e.g. s0932, 12345)
      if (!hr) {
        const maybe = imgName.match(/[A-Za-z0-9_-]{3,20}/g);
        if (maybe && maybe.length > 0) {
          for (const token of maybe) {
            const byStaff = await HR.findOne({ $or: [ { staffId: token }, { cardNumber: token }, { cardNo: token }, { no: token } ] }).lean();
            if (byStaff) { hr = byStaff; break; }
          }
        }
      }

      // If matched, create or update attendance for today for that staffId
      let attendance = null;
      if (hr && hr.staffId) {
        const today = new Date().toISOString().slice(0,10);
        // Check existing
        attendance = await Attendance.findOne({ staffId: hr.staffId, date: new Date(today) });
        const now = new Date().toISOString();
        if (attendance) {
          if (!attendance.checkIn) attendance.checkIn = now;
          else if (!attendance.checkOut) attendance.checkOut = now;
          else attendance.checkOut2 = now;
          attendance.notes = (attendance.notes || '') + ' (face-scan)';
          await attendance.save();
        } else {
          const payload = { staffId: hr.staffId, date: today, status: 'present', checkIn: now, notes: 'face-scan' };
          attendance = await Attendance.create(payload);
        }
      }

      res.json({ url, matched: !!hr, hr, attendance });
    } catch (e) { next(e); }
  });
});

export default router;
