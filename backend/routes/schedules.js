import express from 'express';
import ShiftSchedule from '../models/ShiftSchedule.js';

const router = express.Router();

// create or update schedule for a date
router.post('/', async (req, res, next) => {
  try {
    const { date, scheduledStart, scheduledEnd, scheduledGraceMinutes, scheduledEndGraceMinutes, department, notes } = req.body;
    if (!date) return res.status(400).json({ message: 'date required' });
    const d = new Date(date);
    let rec = await ShiftSchedule.findOne({ date: d });
    if (rec) {
      rec.scheduledStart = scheduledStart;
      rec.scheduledEnd = scheduledEnd;
      rec.scheduledGraceMinutes = scheduledGraceMinutes;
      rec.scheduledEndGraceMinutes = scheduledEndGraceMinutes;
      rec.department = department;
      rec.notes = notes;
      await rec.save();
    } else {
      rec = new ShiftSchedule({ date: d, scheduledStart, scheduledEnd, scheduledGraceMinutes, scheduledEndGraceMinutes, department, notes });
      await rec.save();
    }
    res.json(rec);
  } catch (err) { next(err); }
});

// list schedules in a date range
router.get('/', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const q = {};
    if (from || to) q.date = {};
    if (from) q.date.$gte = new Date(from);
    if (to) q.date.$lte = new Date(to);
    const items = await ShiftSchedule.find(q).sort({ date: 1 });
    res.json(items);
  } catch (err) { next(err); }
});

// get by id
router.get('/:id', async (req, res, next) => {
  try {
    const rec = await ShiftSchedule.findById(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Not found' });
    res.json(rec);
  } catch (err) { next(err); }
});

// create multiple schedules at once (bulk operation)
router.post('/bulk', async (req, res, next) => {
  try {
    const { schedules } = req.body;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ message: 'schedules array required' });
    }

    const results = [];
    const errors = [];

    for (const scheduleData of schedules) {
      try {
        const { date, scheduledStart, scheduledEnd, scheduledGraceMinutes, scheduledEndGraceMinutes, department, notes } = scheduleData;
        if (!date) {
          errors.push({ data: scheduleData, error: 'date required' });
          continue;
        }

        const d = new Date(date);
        let rec = await ShiftSchedule.findOne({ date: d });
        
        if (rec) {
          // Update existing
          rec.scheduledStart = scheduledStart;
          rec.scheduledEnd = scheduledEnd;
          rec.scheduledGraceMinutes = scheduledGraceMinutes;
          rec.scheduledEndGraceMinutes = scheduledEndGraceMinutes;
          rec.department = department;
          rec.notes = notes;
          await rec.save();
        } else {
          // Create new
          rec = new ShiftSchedule({ 
            date: d, 
            scheduledStart, 
            scheduledEnd, 
            scheduledGraceMinutes, 
            scheduledEndGraceMinutes, 
            department, 
            notes 
          });
          await rec.save();
        }
        results.push(rec);
      } catch (err) {
        errors.push({ data: scheduleData, error: err.message });
      }
    }

    res.json({ 
      success: true, 
      created: results.length, 
      results, 
      errors: errors.length > 0 ? errors : undefined 
    });
  } catch (err) { 
    next(err); 
  }
});

// delete
router.delete('/:id', async (req, res, next) => {
  try {
    await ShiftSchedule.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
