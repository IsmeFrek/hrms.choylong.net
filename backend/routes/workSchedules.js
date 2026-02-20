import express from 'express';
import WorkSchedule from '../models/WorkSchedule.js';
import WorkScheduleEmployee from '../models/WorkScheduleEmployee.js';

const router = express.Router();

// Get schedules with filters
router.get('/', async (req, res, next) => {
  try {
    const { employeeId, startDate, endDate, month, year } = req.query;
    const filter = {};

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }

    const schedules = await WorkSchedule.find(filter)
      .populate('employeeId', 'staffId khmerName phoneNumber position')
      .sort({ date: 1 });
      
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

// Get single schedule
router.get('/:id', async (req, res, next) => {
  try {
    const schedule = await WorkSchedule.findById(req.params.id)
      .populate('employeeId', 'staffId khmerName phoneNumber position');
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

// Create or update schedule
router.post('/', async (req, res, next) => {
  try {
    const { employeeId, date, shiftTitle, shiftStart, shiftEnd, shiftColor, notes } = req.body;
    
    if (!employeeId || !date) {
      return res.status(400).json({ message: 'employeeId and date are required' });
    }

    // Verify employee exists
    const employee = await WorkScheduleEmployee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if schedule already exists for this employee and date
    let schedule = await WorkSchedule.findOne({ employeeId, date: new Date(date) });
    
    if (schedule) {
      // Update existing
      schedule.shiftTitle = shiftTitle || schedule.shiftTitle;
      schedule.shiftStart = shiftStart || schedule.shiftStart;
      schedule.shiftEnd = shiftEnd || schedule.shiftEnd;
      schedule.shiftColor = shiftColor || schedule.shiftColor;
      schedule.notes = notes !== undefined ? notes : schedule.notes;
      await schedule.save();
    } else {
      // Create new
      schedule = new WorkSchedule({
        employeeId,
        date: new Date(date),
        shiftTitle,
        shiftStart,
        shiftEnd,
        shiftColor,
        notes
      });
      await schedule.save();
    }
    
    // Populate employee data
    await schedule.populate('employeeId', 'staffId khmerName phoneNumber position');
    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

// Bulk create/update schedules
router.post('/bulk', async (req, res, next) => {
  try {
    const { schedules } = req.body;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ message: 'schedules array required' });
    }

    const results = [];
    const errors = [];

    for (const sched of schedules) {
      try {
        if (!sched.employeeId || !sched.date) {
          errors.push({ data: sched, error: 'employeeId and date required' });
          continue;
        }

        // Verify employee exists
        const employee = await WorkScheduleEmployee.findById(sched.employeeId);
        if (!employee) {
          errors.push({ data: sched, error: 'Employee not found' });
          continue;
        }

        // Check existing
        let schedule = await WorkSchedule.findOne({ 
          employeeId: sched.employeeId, 
          date: new Date(sched.date) 
        });
        
        if (schedule) {
          schedule.shiftTitle = sched.shiftTitle || schedule.shiftTitle;
          schedule.shiftStart = sched.shiftStart || schedule.shiftStart;
          schedule.shiftEnd = sched.shiftEnd || schedule.shiftEnd;
          schedule.shiftColor = sched.shiftColor || schedule.shiftColor;
          schedule.notes = sched.notes !== undefined ? sched.notes : schedule.notes;
          await schedule.save();
        } else {
          schedule = new WorkSchedule({
            employeeId: sched.employeeId,
            date: new Date(sched.date),
            shiftTitle: sched.shiftTitle,
            shiftStart: sched.shiftStart,
            shiftEnd: sched.shiftEnd,
            shiftColor: sched.shiftColor,
            notes: sched.notes
          });
          await schedule.save();
        }
        
        results.push(schedule);
      } catch (err) {
        errors.push({ data: sched, error: err.message });
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

// Delete schedule
router.delete('/:id', async (req, res, next) => {
  try {
    const schedule = await WorkSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    
    res.json({ message: 'Schedule deleted', schedule });
  } catch (err) {
    next(err);
  }
});

// Delete all schedules for an employee
router.delete('/employee/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const result = await WorkSchedule.deleteMany({ employeeId });

    res.json({ 
      message: 'All employee schedules deleted', 
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    next(err);
  }
});

// Delete schedules by date range (for cleanup)
router.delete('/range/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate required' });
    }

    const result = await WorkSchedule.deleteMany({
      employeeId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    res.json({ 
      message: 'Schedules deleted', 
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    next(err);
  }
});

export default router;
