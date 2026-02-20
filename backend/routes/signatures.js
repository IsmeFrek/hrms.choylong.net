import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import SignSchema from '../models/SignSchema.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for signature uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/Uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving original name structure
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('ត្រឹមតែឯកសាររូបភាពប៉ុណ្ណោះ'), false);
    }
  }
});

// GET /api/signatures - ទទួលបានបញ្ជីហត្ថលេខាទាំងអស់
// Note: Allow all authenticated users to view signatures (for feedback form use)
// Detailed access control for create/edit/delete handled separately
router.get('/', authRequired, async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 50 } = req.query;
    
    // Build filter object
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fullNameKh: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get signatures with pagination
    const signatures = await SignSchema.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    // Get total count for pagination
    const total = await SignSchema.countDocuments(filter);
    
    res.json({
      signatures,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching signatures:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការទាញយកបញ្ជីហត្ថលេខា', error: error.message });
  }
});

// GET /api/signatures/search/:name - ស្វែងរកហត្ថលេខាតាមឈ្មោះ
router.get('/search/:name', authRequired, async (req, res) => {
  try {
    const { name } = req.params;
    const signature = await SignSchema.findByName(name);
    
    if (!signature) {
      return res.status(404).json({ message: 'រកមិនឃើញហត្ថលេខាសម្រាប់ឈ្មោះនេះ' });
    }
    
    // Record usage
    await signature.recordUsage();
    
    res.json(signature);
  } catch (error) {
    console.error('Error searching signature:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការស្វែងរកហត្ថលេខា', error: error.message });
  }
});

// GET /api/signatures/type/:type - ទទួលបានហត្ថលេខាតាមប្រភេទ
router.get('/type/:type', authRequired, async (req, res) => {
  try {
    const { type } = req.params;
    const signatures = await SignSchema.findByType(type);
    res.json(signatures);
  } catch (error) {
    console.error('Error fetching signatures by type:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការទាញយកហត្ថលេខាតាមប្រភេទ', error: error.message });
  }
});

// GET /api/signatures/:id - ទទួលបានហត្ថលេខាតាម ID
router.get('/:id', authRequired, async (req, res) => {
  try {
    const signature = await SignSchema.findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');
      
    if (!signature) {
      return res.status(404).json({ message: 'រកមិនឃើញហត្ថលេខា' });
    }
    
    res.json(signature);
  } catch (error) {
    console.error('Error fetching signature:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការទាញយកហត្ថលេខា', error: error.message });
  }
});

// POST /api/signatures - បង្កើតហត្ថលេខាថ្មី
router.post('/', authRequired, requirePermission('create:signSchemas'), upload.single('signatureFile'), async (req, res) => {
  try {
    const {
      name,
      fullNameKh,
      type,
      description,
      position,
      department,
      notes,
      expiryDate
    } = req.body;
    
    // Check if signature with this name already exists
    const existingSignature = await SignSchema.findOne({ name: name.trim() });
    if (existingSignature) {
      // Delete uploaded file if signature name already exists
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      return res.status(400).json({ message: 'ឈ្មោះ ឬ លេខកូដនេះមានរួចហើយ' });
    }
    
    let filePath = null;
    let originalFileName = null;
    let mimeType = null;
    let fileSize = null;
    
    if (req.file) {
      filePath = `/Uploads/${req.file.filename}`;
      originalFileName = req.file.originalname;
      mimeType = req.file.mimetype;
      fileSize = req.file.size;
    } else if (req.body.filePath) {
      // Allow manual file path entry
      filePath = req.body.filePath;
    }
    
    if (!filePath) {
      return res.status(400).json({ message: 'ត្រូវតែមានឯកសារហត្ថលេខា ឬ ផ្លូវឯកសារ' });
    }
    
    const signatureData = {
      name: name.trim(),
      fullNameKh,
      type: type || 'employee',
      filePath,
      originalFileName,
      mimeType,
      fileSize,
      description,
      position,
      department,
      notes,
      createdBy: req.auth.user.id || req.auth.user._id
    };
    
    if (expiryDate) {
      signatureData.expiryDate = new Date(expiryDate);
    }
    
    const signature = new SignSchema(signatureData);
    await signature.save();
    
    // Populate user info for response
    await signature.populate('createdBy', 'fullName email');
    
    res.status(201).json({
      message: 'បង្កើតហត្ថលេខាបានជោគជ័យ',
      signature
    });
  } catch (error) {
    // Delete uploaded file if there's an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    console.error('Error creating signature:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការបង្កើតហត្ថលេខា', error: error.message });
  }
});

// PUT /api/signatures/:id - កែប្រែហត្ថលេខា
router.put('/:id', authRequired, requirePermission('edit:signSchemas'), upload.single('signatureFile'), async (req, res) => {
  try {
    const signature = await SignSchema.findById(req.params.id);
    if (!signature) {
      // Delete uploaded file if signature not found
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      return res.status(404).json({ message: 'រកមិនឃើញហត្ថលេខា' });
    }
    
    const {
      name,
      fullNameKh,
      type,
      description,
      position,
      department,
      status,
      notes,
      expiryDate
    } = req.body;
    
    // Check if new name conflicts with existing signatures (except current one)
    if (name && name.trim() !== signature.name) {
      const existingSignature = await SignSchema.findOne({ 
        name: name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingSignature) {
        // Delete uploaded file if name conflict
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
        return res.status(400).json({ message: 'ឈ្មោះ ឬ លេខកូដនេះមានរួចហើយ' });
      }
    }
    
    // Update fields
    if (name) signature.name = name.trim();
    if (fullNameKh !== undefined) signature.fullNameKh = fullNameKh;
    if (type) signature.type = type;
    if (description !== undefined) signature.description = description;
    if (position !== undefined) signature.position = position;
    if (department !== undefined) signature.department = department;
    if (status) signature.status = status;
    if (notes !== undefined) signature.notes = notes;
    if (expiryDate) signature.expiryDate = new Date(expiryDate);
    
    // Handle file update
    if (req.file) {
      // Delete old file if it exists
      if (signature.filePath && signature.filePath.startsWith('/Uploads/')) {
        const oldFilePath = path.join('public', signature.filePath);
        fs.unlink(oldFilePath, (err) => {
          if (err) console.error('Error deleting old file:', err);
        });
      }
      
      // Update with new file
      signature.filePath = `/Uploads/${req.file.filename}`;
      signature.originalFileName = req.file.originalname;
      signature.mimeType = req.file.mimetype;
      signature.fileSize = req.file.size;
    } else if (req.body.filePath && req.body.filePath !== signature.filePath) {
      // Manual file path update
      signature.filePath = req.body.filePath;
    }
    
    signature.updatedBy = req.auth.user.id || req.auth.user._id;
    await signature.save();
    
    // Populate user info for response
    await signature.populate('createdBy', 'fullName email');
    await signature.populate('updatedBy', 'fullName email');
    
    res.json({
      message: 'កែប្រែហត្ថលេខាបានជោគជ័យ',
      signature
    });
  } catch (error) {
    // Delete uploaded file if there's an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    console.error('Error updating signature:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការកែប្រែហត្ថលេខា', error: error.message });
  }
});

// DELETE /api/signatures/:id - លុបហត្ថលេខា
router.delete('/:id', authRequired, requirePermission('delete:signSchemas'), async (req, res) => {
  try {
    const signature = await SignSchema.findById(req.params.id);
    if (!signature) {
      return res.status(404).json({ message: 'រកមិនឃើញហត្ថលេខា' });
    }
    
    // Delete associated file
    if (signature.filePath && signature.filePath.startsWith('/Uploads/')) {
      const filePath = path.join('public', signature.filePath);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    
    // Delete from database
    await SignSchema.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'លុបហត្ថលេខាបានជោគជ័យ' });
  } catch (error) {
    console.error('Error deleting signature:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការលុបហត្ថលេខា', error: error.message });
  }
});

// POST /api/signatures/bulk-import - នាំចូលហត្ថលេខាច្រើនដដែលគ្នា
router.post('/bulk-import', authRequired, requirePermission('create:signSchemas'), async (req, res) => {
  try {
    const { signatures } = req.body;
    
    if (!Array.isArray(signatures) || signatures.length === 0) {
      return res.status(400).json({ message: 'ត្រូវតែមានបញ្ជីហត្ថលេខាសម្រាប់នាំចូល' });
    }
    
    const results = {
      success: [],
      errors: []
    };
    
    for (const sigData of signatures) {
      try {
        // Check if signature already exists
        const existing = await SignSchema.findOne({ name: sigData.name?.trim() });
        if (existing) {
          results.errors.push({
            name: sigData.name,
            error: 'ឈ្មោះនេះមានរួចហើយ'
          });
          continue;
        }
        
        const signature = new SignSchema({
          ...sigData,
          name: sigData.name?.trim(),
          createdBy: req.auth.user.id || req.auth.user._id
        });
        
        await signature.save();
        results.success.push(signature);
      } catch (error) {
        results.errors.push({
          name: sigData.name || 'Unknown',
          error: error.message
        });
      }
    }
    
    res.json({
      message: `នាំចូលបានជោគជ័យ ${results.success.length} ហត្ថលេខា`,
      results
    });
  } catch (error) {
    console.error('Error bulk importing signatures:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការនាំចូលហត្ថលេខា', error: error.message });
  }
});

// GET /api/signatures/stats - ស្ថិតិហត្ថលេខា
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await SignSchema.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } }
        }
      }
    ]);
    
    const typeStats = await SignSchema.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      overview: stats[0] || { total: 0, active: 0, inactive: 0, archived: 0 },
      byType: typeStats
    });
  } catch (error) {
    console.error('Error fetching signature stats:', error);
    res.status(500).json({ message: 'មានបញ្ហាក្នុងការទាញយកស្ថិតិ', error: error.message });
  }
});

export default router;