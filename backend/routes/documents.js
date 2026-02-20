import express from 'express';
import DocumentStaff from '../models/DocumentStaff.js';
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
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
const uploadSingle = (req, res, next) =>
  upload.single('attachment')(req, res, (err) => {
    if (err) {
      console.error('Multer error (documents):', err);
      return res.status(400).json({ message: err.message || 'Upload error' });
    }
    next();
  });

router.use(authRequired);

// Get all documents for a staff member
router.get('/staff/:staffId', requirePermission('view:documents'), async (req, res) => {
  try {
    const documents = await DocumentStaff.find({ staffId: req.params.staffId });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new document with file upload
router.post('/upload', requirePermission('edit:documents'), uploadSingle, async (req, res) => {
  try {
    const docData = req.body;
    if (req.file) {
      docData.attachment = req.file.filename;
    }
    const document = new DocumentStaff(docData);
    const savedDocument = await document.save();
    res.status(201).json({ document: savedDocument });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update document
router.put('/:id', requirePermission('edit:documents'), async (req, res) => {
  try {
    const updatedDocument = await DocumentStaff.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedDocument) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(updatedDocument);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete document
router.delete('/:id', requirePermission('edit:documents'), async (req, res) => {
  try {
    const deletedDocument = await DocumentStaff.findByIdAndDelete(req.params.id);
    if (!deletedDocument) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
