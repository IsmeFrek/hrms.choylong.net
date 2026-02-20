
// CRUD API for DepartmentUnit (អង្គភាព)
import express from 'express';
import DepartmentUnit from '../models/DepartmentUnit.js';
const router = express.Router();

// Create
router.post('/', async (req, res) => {
  try {
    // Set order to max+1
    const maxOrderUnit = await DepartmentUnit.findOne().sort({ order: -1 });
    const nextOrder = maxOrderUnit ? (maxOrderUnit.order || 0) + 1 : 1;
    const unit = new DepartmentUnit({ ...req.body, order: nextOrder });
    await unit.save();
    res.status(201).json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Read all (sorted by order)
router.get('/', async (req, res) => {
  try {
    const units = await DepartmentUnit.find().sort({ order: 1, createdAt: 1 });
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: update order (move up/down)
router.patch('/:id/order', async (req, res) => {
  try {
    const { newOrder } = req.body;
    if (typeof newOrder !== 'number') return res.status(400).json({ error: 'newOrder required' });
    const unit = await DepartmentUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Not found' });
    // Find the unit currently at newOrder
    const swapUnit = await DepartmentUnit.findOne({ order: newOrder });
    if (swapUnit) {
      swapUnit.order = unit.order;
      await swapUnit.save();
    }
    unit.order = newOrder;
    await unit.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read one
router.get('/:id', async (req, res) => {
  try {
    const unit = await DepartmentUnit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Not found' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const unit = await DepartmentUnit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!unit) return res.status(404).json({ error: 'Not found' });
    res.json(unit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    const unit = await DepartmentUnit.findByIdAndDelete(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
