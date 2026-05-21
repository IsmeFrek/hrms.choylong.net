import express from 'express';
import FileTransferOut from '../models/FileTransferOut.js';
import { authRequired, requireAnyPermission } from '../middleware/auth.js';
import multer from 'multer';

const router = express.Router();

const parseKhmerDate = (s) => {
    if (!s || typeof s !== 'string') return null;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        const hour = m[4] ? parseInt(m[4], 10) : 0;
        const min = m[5] ? parseInt(m[5], 10) : 0;
        return new Date(year, month, day, hour, min);
    }
    return null;
};

// GET /file-transfers-out
router.get('/file-transfers-out', authRequired, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, type } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 10);

    const filter = {};
    if (type && type !== 'ទាំងអស់' && type !== 'សរុប') {
      filter.$or = [
        { type: type },
        { title: type },
      ];
    }

    const total = await FileTransferOut.countDocuments(filter);
    const items = await FileTransferOut.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((p - 1) * ps)
      .limit(ps)
      .lean()
      .exec();

    res.json({ items, total });
  } catch (err) {
    next(err);
  }
});

// GET /file-transfers-out/:id
router.get('/file-transfers-out/:id', authRequired,
  requireAnyPermission(['view:fileTransfers', 'edit:fileTransfers', 'send:feedback']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const item = await FileTransferOut.findById(id).lean().exec();
      if (!item) return res.status(404).json({ message: 'File transfer not found' });
      return res.json(item);
    } catch (err) {
      if (err && (err.name === 'CastError' || err.kind === 'ObjectId')) {
        return res.status(400).json({ message: 'Invalid id' });
      }
      next(err);
    }
  }
);

// POST /file-transfers-out
router.post('/file-transfers-out', authRequired,
  requireAnyPermission(['edit:fileTransfers', 'edit:documents']),
  async (req, res, next) => {
    try {
      const payload = req.body || {};
      if (payload.attachments && typeof payload.attachments === 'string') {
        payload.attachments = [payload.attachments];
      }
      ['date', 'entryDate'].forEach(f => {
        if (payload[f] && typeof payload[f] === 'string') {
          const parsed = parseKhmerDate(payload[f]);
          if (parsed && !isNaN(parsed.getTime())) payload[f] = parsed;
        }
      });

      const item = new FileTransferOut(payload);
      const saved = await item.save();
      const total = await FileTransferOut.countDocuments({});
      return res.status(201).json({ item: saved, total });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /file-transfers-out/:id
router.put('/file-transfers-out/:id', authRequired,
  requireAnyPermission(['edit:fileTransfers', 'edit:documents', 'send:feedback']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body || {};
      try { delete payload._id; delete payload.id; } catch { }

      if (payload.attachments && typeof payload.attachments === 'string') {
        payload.attachments = [payload.attachments];
      }

      const item = await FileTransferOut.findById(id).exec();
      if (!item) return res.status(404).json({ message: 'File transfer not found' });

      if (payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)) {
        item.meta = { ...(item.meta || {}), ...payload.meta };
        delete payload.meta;
      }

      for (const [key, value] of Object.entries(payload)) {
        item[key] = value;
      }

      ['date', 'entryDate'].forEach(f => {
        if (item[f] && typeof item[f] === 'string') {
          const parsed = parseKhmerDate(item[f]);
          if (parsed && !isNaN(parsed.getTime())) item[f] = parsed;
        }
      });

      const saved = await item.save();
      return res.json({ success: true, item: saved });
    } catch (err) {
      if (err && (err.name === 'CastError' || err.kind === 'ObjectId')) {
        return res.status(400).json({ message: 'Invalid id' });
      }
      next(err);
    }
  }
);

// DELETE /file-transfers-out/:id
router.delete('/file-transfers-out/:id', authRequired,
  requireAnyPermission(['edit:fileTransfers', 'edit:documents']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const deleted = await FileTransferOut.findByIdAndDelete(id).lean().exec();
      if (!deleted) return res.status(404).json({ message: 'File transfer not found' });
      const total = await FileTransferOut.countDocuments({});
      return res.json({ success: true, total });
    } catch (err) {
      if (err && (err.name === 'CastError' || err.kind === 'ObjectId')) {
        return res.status(400).json({ message: 'Invalid id' });
      }
      next(err);
    }
  }
);

export default router;
