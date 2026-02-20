import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../public/Uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const base = path.parse(file.originalname).name
      .replace(/[^\p{L}\p{N}\-_\.]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 80) || 'file';
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${unique}${ext}`);
  }
});
const upload = multer({
  storage: storage,
  // Increase default limit to 20MB to accommodate PDFs
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isImage = (file.mimetype || '').startsWith('image/');
    const isPdfMime = (file.mimetype || '').toLowerCase() === 'application/pdf';
    const isPdfExt = (path.extname(file.originalname) || '').toLowerCase() === '.pdf';
    if (isImage || isPdfMime || isPdfExt) return cb(null, true);
    return cb(new Error('Only images or PDF files are allowed!'));
  }
});

// POST /api/upload
router.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return URL for client with original filename
    const url = `/Uploads/${req.file.filename}`;
    res.json({ 
      url, 
      filename: req.file.filename, 
      originalName: req.file.originalname,
      size: req.file.size 
    });
  });
});

export default router;
