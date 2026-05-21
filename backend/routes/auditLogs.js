import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/audit-logs
router.get('/', authRequired, requireRole('Admin'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = parseInt(req.query.skip) || 0;

    const query = {};
    if (q) {
      query.$or = [
        { userName: { $regex: q, $options: 'i' } },
        { action: { $regex: q, $options: 'i' } },
        { resource: { $regex: q, $options: 'i' } },
        { details: { $regex: q, $options: 'i' } }
      ];
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
      
    const total = await AuditLog.countDocuments(query);

    res.json({ logs, total });
  } catch (err) {
    console.error('Fetch audit logs failed:', err);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

export default router;
