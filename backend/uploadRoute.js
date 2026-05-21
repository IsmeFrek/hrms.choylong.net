import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadToR2, sanitizeFilename } from './services/r2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Memory storage — file buffer is sent directly to Cloudflare R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const isImage = (file.mimetype || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.originalname);
    const isPdf   = (file.mimetype || '').toLowerCase() === 'application/pdf' || ext === '.pdf';
    const isDoc   = /\.(docx?|xlsx?|pptx?|txt|csv)$/i.test(file.originalname);
    if (isImage || isPdf || isDoc) return cb(null, true);
    return cb(new Error('Only images, PDFs, or office document files are allowed!'));
  }
});

// POST /api/upload — upload a file to Cloudflare R2
router.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const ext      = path.extname(req.file.originalname).toLowerCase();
      const baseName = path.basename(req.file.originalname, ext);
      const safeName = sanitizeFilename(baseName);
      const filename = `${safeName}-${Date.now()}${ext}`;

      // Upload buffer to R2 — returns full public URL
      const url = await uploadToR2(req.file.buffer, filename, req.file.mimetype);

      res.json({
        url,
        filename,
        originalName: req.file.originalname,
        size: req.file.size,
      });
    } catch (uploadErr) {
      console.error('[R2] Upload failed:', uploadErr.message);
      res.status(500).json({ error: 'File upload to cloud storage failed' });
    }
  });
});

export default router;
