import express from 'express';
import { fetchKHolidays } from '../services/holidayService.js';
import Holiday from '../models/Holiday.js';

const router = express.Router();

// GET /api/holidays?year=YYYY
router.get('/', async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  try {
    const data = await fetchKHolidays(year);
    res.json({ year, country: 'KH', data });
  } catch (err) {
    console.error('Holiday Route Error (GET /):', err);
    res.status(200).json({ year, country: 'KH', data: [], message: err.message });
  }
});

// POST /api/holidays - Add a manual holiday
router.post('/', async (req, res) => {
  try {
    const { date, name, description, isDeleted } = req.body;
    if (!date || !name) return res.status(400).json({ message: 'Date and name are required' });
    
    const existing = await Holiday.findOne({ date });
    if (existing) {
      existing.name = name;
      existing.description = description;
      if (isDeleted !== undefined) existing.isDeleted = isDeleted;
      await existing.save();
      return res.json(existing);
    }

    const h = new Holiday({ date, name, description, isDeleted: isDeleted || false });
    await h.save();
    res.status(201).json(h);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/holidays/:id - Delete a manual holiday
router.delete('/:id', async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:year', async (req, res) => {
  const year = Number(req.params.year);
  try {
    const data = await fetchKHolidays(year);
    res.json({ year, country: 'KH', data });
  } catch (err) {
    console.error('Holiday Route Error (GET /:year):', err);
    res.status(200).json({ year, country: 'KH', data: [], message: err.message });
  }
});

export default router;
