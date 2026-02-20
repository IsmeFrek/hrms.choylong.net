import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = Router();

router.use(authRequired);

// GET /api/notifications - list my notifications (latest first)
router.get('/', async (req, res) => {
  const userId = req.auth?.user?._id;
  const list = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(100);
  res.json(list);
});

// POST /api/notifications/:id/read - mark one as read
router.post('/:id/read', async (req, res) => {
  const userId = req.auth?.user?._id;
  const n = await Notification.findOne({ _id: req.params.id, userId });
  if (!n) return res.status(404).json({ message: 'Not found' });
  n.unread = false;
  await n.save();
  res.json(n);
});

// POST /api/notifications/read-all - mark all as read
router.post('/read-all', async (req, res) => {
  const userId = req.auth?.user?._id;
  await Notification.updateMany({ userId, unread: true }, { $set: { unread: false } });
  res.json({ ok: true });
});

export default router;
