import express from 'express';
import ScheduleOverride from '../models/ScheduleOverride.js';

const router = express.Router();

// Create or update a schedule override for a specific employee and date
router.post('/', async (req, res, next) => {
  try {
    const { employeeRef, date, shiftTitle, shiftStart, shiftEnd, shiftColor, notes } = req.body;
    
    if (!employeeRef || !date || !shiftTitle) {
      return res.status(400).json({ message: 'employeeRef, date, and shiftTitle are required' });
    }

    const dateObj = new Date(date);
    
    // Check if override already exists
    let override = await ScheduleOverride.findOne({ employeeRef, date: dateObj });
    
    if (override) {
      // Update existing override
      override.shiftTitle = shiftTitle;
      override.shiftStart = shiftStart || '';
      override.shiftEnd = shiftEnd || '';
      override.shiftColor = shiftColor || '#0b74de';
      override.notes = notes || '';
      await override.save();
    } else {
      // Create new override
      override = new ScheduleOverride({
        employeeRef,
        date: dateObj,
        shiftTitle,
        shiftStart: shiftStart || '',
        shiftEnd: shiftEnd || '',
        shiftColor: shiftColor || '#0b74de',
        notes: notes || ''
      });
      await override.save();
    }
    
    res.json(override);
  } catch (err) { 
    next(err); 
  }
});

// Bulk create/update schedule overrides
router.post('/bulk', async (req, res, next) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'items array required' });

    const ops = items.map(it => {
      const dateObj = new Date(it.date);
      return {
        updateOne: {
          filter: { employeeRef: it.employeeRef, date: dateObj },
          update: { $set: { shiftTitle: it.shiftTitle, shiftStart: it.shiftStart || '', shiftEnd: it.shiftEnd || '', shiftColor: it.shiftColor || '#0b74de', notes: it.notes || '', isActive: true } },
          upsert: true,
        }
      };
    });

    const result = await ScheduleOverride.bulkWrite(ops, { ordered: false });
    return res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

// Get schedule overrides for a date range
router.get('/', async (req, res, next) => {
  try {
    const { from, to, employeeRef } = req.query;
    const query = { isActive: true };
    
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    
    if (employeeRef) {
      query.employeeRef = employeeRef;
    }
    
    const overrides = await ScheduleOverride.find(query).sort({ date: 1 });
    res.json(overrides);
  } catch (err) { 
    next(err); 
  }
});

// Delete a schedule override
router.delete('/:id', async (req, res, next) => {
  try {
    await ScheduleOverride.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Schedule override deleted' });
  } catch (err) { 
    next(err); 
  }
});

// Get override for specific employee and date
router.get('/employee/:employeeRef/date/:date', async (req, res, next) => {
  try {
    const { employeeRef, date } = req.params;
    const override = await ScheduleOverride.findOne({ 
      employeeRef, 
      date: new Date(date),
      isActive: true 
    });
    
    if (!override) {
      return res.status(404).json({ message: 'No override found' });
    }
    
    res.json(override);
  } catch (err) { 
    next(err); 
  }
});

export default router;