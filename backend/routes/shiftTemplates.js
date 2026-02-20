import express from 'express';
import ShiftTemplate from '../models/ShiftTemplate.js';

const router = express.Router();

// list
router.get('/', async (req, res) => {
  try {
    const items = await ShiftTemplate.find({}).sort({ createdAt: 1 });
    res.json(items);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// create
router.post('/', async (req, res) => {
  try {
    const cur = new ShiftTemplate(req.body);
    await cur.save();
    res.status(201).json(cur);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// update
router.put('/:id', async (req, res) => {
  try {
    const updated = await ShiftTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (e) { res.status(400).json({ message: e.message }); }
});

// delete
router.delete('/:id', async (req, res) => {
  try {
    await ShiftTemplate.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ message: e.message }); }
});

export default router;
