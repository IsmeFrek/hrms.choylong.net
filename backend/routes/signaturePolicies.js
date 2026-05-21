import express from 'express';
import SignaturePolicy from '../models/SignaturePolicy.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Get all policies
router.get('/', authRequired, async (req, res) => {
  try {
    const policies = await SignaturePolicy.find().sort({ priority: -1, createdAt: -1 });
    res.json(policies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create/Update policy
router.post('/', authRequired, async (req, res) => {
  const { keyword, leftTitle, rightTitle, priority } = req.body;
  try {
    const policy = await SignaturePolicy.findOneAndUpdate(
      { keyword },
      { leftTitle, rightTitle, priority },
      { upsert: true, new: true }
    );
    res.json(policy);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete policy
router.delete('/:id', authRequired, async (req, res) => {
  try {
    await SignaturePolicy.findByIdAndDelete(req.params.id);
    res.json({ message: 'Policy deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update policy by ID
router.put('/:id', authRequired, async (req, res) => {
  const { keyword, leftTitle, rightTitle, priority } = req.body;
  try {
    const policy = await SignaturePolicy.findByIdAndUpdate(
      req.params.id,
      { keyword, leftTitle, rightTitle, priority },
      { new: true }
    );
    if (!policy) return res.status(404).json({ message: 'Policy not found' });
    res.json(policy);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
