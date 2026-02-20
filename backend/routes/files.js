import express from 'express';
import File from '../models/File.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authRequired, requirePermission } from '../middleware/auth.js';
const router = express.Router();

// Multer config (store under public/Uploads so files are served at /Uploads/*)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../public/Uploads');
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
const uploadSingle = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error (files):', err);
      return res.status(400).json({ message: err.message || 'Upload error' });
    }
    next();
  });

router.use(authRequired);

// Get all files
// allow either 'view:documents' (legacy) or 'view:files'
router.get('/', (req, res, next) => {
  const perms = req.auth?.permissions || [];
  if (perms.includes('view:documents') || perms.includes('view:files')) return next();
  return res.status(403).json({ message: 'Forbidden' });
}, async (req, res) => {
  try {
    const files = await File.find().sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new file with upload
// allow either 'edit:documents' (legacy) or 'edit:files'
router.post('/', (req, res, next) => {
  const perms = req.auth?.permissions || [];
  if (perms.includes('edit:documents') || perms.includes('edit:files')) return next();
  return res.status(403).json({ message: 'Forbidden' });
}, uploadSingle, async (req, res) => {
  try {
    const fileData = { ...req.body };
    // normalize common fields
    // trim strings
    ['letterType','no','documentName','incomingLetterNo','letterRefNo','documentSource','comment','stage'].forEach(k => {
      if (k in fileData && typeof fileData[k] === 'string') fileData[k] = fileData[k].trim();
    });
    // drop empty optionals
    ['documentName','incomingLetterNo','letterRefNo','comment','stage'].forEach(k => { if (fileData[k] === '') delete fileData[k]; });
    // quantity
    if (fileData.quantity === '' || fileData.quantity == null) {
      delete fileData.quantity; // let default 1 or undefined
    } else {
      const q = Number(fileData.quantity);
      if (!Number.isFinite(q)) delete fileData.quantity; else fileData.quantity = q;
    }
    // date (accept dd/mm/yyyy or yyyy-mm-dd)
    if (typeof fileData.date === 'string' && fileData.date.trim()) {
      const s = fileData.date.trim();
      const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmY) {
        const dd = dmY[1].padStart(2,'0');
        const mm = dmY[2].padStart(2,'0');
        const yyyy = dmY[3];
        fileData.date = `${yyyy}-${mm}-${dd}`;
      }
    } else {
      delete fileData.date;
    }
    // required checks
    if (!fileData.letterType) return res.status(400).json({ message: 'letterType is required' });
    if (!fileData.no) return res.status(400).json({ message: 'no is required' });
    if (!fileData.documentSource) return res.status(400).json({ message: 'documentSource is required' });
    if (req.file) {
      fileData.filename = req.file.filename;
      if (!fileData.documentName) {
        fileData.documentName = req.file.originalname || req.file.filename;
      }
    }
  const file = new File(fileData);
    const savedFile = await file.save();
    res.status(201).json(savedFile);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update file with upload
router.put('/:id', (req, res, next) => {
  const perms = req.auth?.permissions || [];
  if (perms.includes('edit:documents') || perms.includes('edit:files')) return next();
  return res.status(403).json({ message: 'Forbidden' });
}, uploadSingle, async (req, res) => {
  try {
    const updateData = { ...req.body };
    ['letterType','no','documentName','incomingLetterNo','letterRefNo','documentSource','comment','stage'].forEach(k => {
      if (k in updateData && typeof updateData[k] === 'string') updateData[k] = updateData[k].trim();
    });
    ['documentName','incomingLetterNo','letterRefNo','comment','stage'].forEach(k => { if (updateData[k] === '') delete updateData[k]; });
    if (updateData.quantity === '' || updateData.quantity == null) {
      delete updateData.quantity;
    } else {
      const q = Number(updateData.quantity);
      if (!Number.isFinite(q)) delete updateData.quantity; else updateData.quantity = q;
    }
    if (typeof updateData.date === 'string' && updateData.date.trim()) {
      const s = updateData.date.trim();
      const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmY) {
        const dd = dmY[1].padStart(2,'0');
        const mm = dmY[2].padStart(2,'0');
        const yyyy = dmY[3];
        updateData.date = `${yyyy}-${mm}-${dd}`;
      }
    } else if (updateData.date === '') {
      delete updateData.date;
    }
    if (req.file) {
      updateData.filename = req.file.filename;
      if (!updateData.documentName) {
        updateData.documentName = req.file.originalname || req.file.filename;
      }
    }
    const updatedFile = await File.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedFile) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.json(updatedFile);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete file
router.delete('/:id', (req, res, next) => {
  const perms = req.auth?.permissions || [];
  if (perms.includes('edit:documents') || perms.includes('edit:files')) return next();
  return res.status(403).json({ message: 'Forbidden' });
}, async (req, res) => {
  try {
    const deletedFile = await File.findByIdAndDelete(req.params.id);
    if (!deletedFile) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
