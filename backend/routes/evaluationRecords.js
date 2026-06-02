import express from 'express';
import EvaluationRecord from '../models/EvaluationRecord.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Get records by yearMonth
router.get('/', authRequired, async (req, res) => {
  try {
    const { yearMonth } = req.query;
    if (!yearMonth) {
      return res.status(400).json({ success: false, message: 'yearMonth query parameter is required' });
    }
    const records = await EvaluationRecord.find({ yearMonth });
    res.json(records);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update or create a record
router.post('/', authRequired, async (req, res) => {
  try {
    const { staffId, yearMonth, performanceResult, otherNotes } = req.body;
    if (!staffId || !yearMonth) {
      return res.status(400).json({ success: false, message: 'staffId and yearMonth are required' });
    }

    const record = await EvaluationRecord.findOneAndUpdate(
      { staffId, yearMonth },
      { performanceResult, otherNotes, updatedAt: Date.now() },
      { new: true, upsert: true }
    );

    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
