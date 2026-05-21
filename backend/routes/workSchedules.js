import express from 'express';
import mongoose from 'mongoose';
import WorkSchedule from '../models/WorkSchedule.js';
import HR from '../models/HR.js';
import ShiftGroup from '../models/ShiftGroup.js';
import WorkScheduleEmployee from '../models/WorkScheduleEmployee.js';
import { scrapeCheckinmeDayOffs } from '../services/checkinmeService.js';
import { fetchKHolidays } from '../services/holidayService.js';
import { authRequired, requireAnyPermission } from '../middleware/auth.js';
import { syncShiftGroupsToSchedules } from '../services/workScheduleService.js';

const router = express.Router();

router.use(authRequired);

// Get schedules with filters
router.get('/', requireAnyPermission(['view:work-schedule', 'edit:work-schedule']), async (req, res, next) => {
  try {
    const { employeeId, startDate, endDate, month, year } = req.query;
    const filter = {};

    const perms = req.auth?.permissions || [];
    const isAdmin = perms.includes('Admin') || perms.includes('Administrator') || req.auth?.user?.email === 'admin@hospital.com';
    let userDept = req.auth?.user?.department;

    // Fallback: if userDept is missing but fullName contains 'ផ្នែក', use fullName
    if (!userDept && req.auth?.user?.fullName && req.auth.user.fullName.includes('ផ្នែក')) {
      userDept = req.auth.user.fullName;
    }

    console.log('[WorkSchedule] GET / user:', req.auth?.user?.email, 'isAdmin:', isAdmin, 'userDept:', userDept);

    if (!isAdmin && userDept) {
      // Find all employees in this department or matching part of the name
      const allEmps = await HR.find({}, '_id Department_Kh');
      const employeeIds = allEmps
        .filter(e => e.Department_Kh && (e.Department_Kh === userDept || userDept.includes(e.Department_Kh)))
        .map(e => e._id);
      
      if (employeeId) {
        // If query already has employeeId, check if it's in the department
        if (!employeeIds.map(id => id.toString()).includes(employeeId)) {
          return res.json([]); // Not in department
        }
        filter.employeeId = employeeId;
      } else {
        filter.employeeId = { $in: employeeIds };
      }
    } else if (employeeId) {
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
      .populate('employeeId', 'staffId khmerName phone position')
      .sort({ date: 1 });
      
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

// Get single schedule
router.get('/:id', requireAnyPermission(['view:work-schedule', 'edit:work-schedule']), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    const schedule = await WorkSchedule.findById(req.params.id)
      .populate('employeeId', 'staffId khmerName phone position');
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

// Create or update schedule
router.post('/', requireAnyPermission(['edit:work-schedule']), async (req, res, next) => {
  try {
    const { employeeId, date, shiftTitle, shiftStart, shiftEnd, shiftColor, notes } = req.body;
    
    if (!employeeId || !date) {
      return res.status(400).json({ message: 'employeeId and date are required' });
    }

    const employee = await HR.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    let schedule = await WorkSchedule.findOne({ employeeId, date: new Date(date) });
    
    if (schedule) {
      schedule.shiftTitle = shiftTitle || schedule.shiftTitle;
      schedule.shiftStart = shiftStart || schedule.shiftStart;
      schedule.shiftEnd = shiftEnd || schedule.shiftEnd;
      schedule.shiftColor = shiftColor || schedule.shiftColor;
      schedule.notes = notes !== undefined ? notes : schedule.notes;
      await schedule.save();
    } else {
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
    
    await schedule.populate('employeeId', 'staffId khmerName phone position');
    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

// Bulk create/update schedules
router.post('/bulk', requireAnyPermission(['edit:work-schedule']), async (req, res, next) => {
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

        const employee = await HR.findById(sched.employeeId);
        if (!employee) {
          errors.push({ data: sched, error: 'Employee not found' });
          continue;
        }

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

/**
 * Helper to process and save work schedule items to database
 */
async function processWorkScheduleSyncItems(schedules) {
  const results = [];
  const errors = [];
  const hrCache = {};

  for (const item of schedules) {
    try {
      let { staffId, name, date, status, notes, checkinmeId } = item;
      if (!date) {
        errors.push({ data: item, error: 'date required' });
        continue;
      }

      let hr = null;
      
      // 1. Priority: Match by checkinmeId
      if (checkinmeId) {
        hr = await HR.findOne({ checkinmeId });
      }

      // 2. Secondary: Match by staffId (and link checkinmeId if found)
      if (!hr && staffId) {
        hr = await HR.findOne({ staffId });
        if (hr && checkinmeId) {
          hr.checkinmeId = checkinmeId;
          await hr.save();
          console.log(`[Sync] Linked Checkinme ID ${checkinmeId} to Employee ${staffId}`);
        }
      }

      // 3. Fallback: Match by name (and link checkinmeId if found)
      if (!hr && name) {
        const cleanName = name.replace(/\s+/g, ' ').trim();
        const nameRegex = new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const matchedHRs = await HR.find({ 
          $or: [
            { name: { $regex: nameRegex } }, 
            { khmerName: { $regex: nameRegex } },
            { fullName: { $regex: nameRegex } },
            { nameLatin: { $regex: nameRegex } }
          ]
        });

        if (matchedHRs.length === 1) {
          hr = matchedHRs[0];
          if (hr && checkinmeId) {
            hr.checkinmeId = checkinmeId;
            await hr.save();
            console.log(`[Sync] Linked Checkinme ID ${checkinmeId} to Employee ${hr.staffId} (Found by Name)`);
          }
        } else if (matchedHRs.length > 1) {
          errors.push({ 
            name: name, 
            error: `Duplicate names detected (${matchedHRs.length} matches). Please use Staff ID to sync correctly.` 
          });
          continue;
        }
      }

      if (!hr) {
        errors.push({ name: name || staffId, error: `Employee ${name || staffId} not found in HR` });
        continue;
      }

      const resolvedStaffId = hr.staffId;
      let wsEmp = await WorkScheduleEmployee.findOne({ staffId: resolvedStaffId });
      if (!wsEmp) {
        wsEmp = new WorkScheduleEmployee({
          staffId: hr.staffId,
          khmerName: hr.khmerName,
          phoneNumber: hr.phone,
          position: hr.position,
          department: hr.Department_Kh,
          isActive: true
        });
        await wsEmp.save();
      }

      const isDayOff = status && (status.toUpperCase() === 'OFF' || status.includes('ឈប់') || status.includes('សម្រាក') || status.toLowerCase().includes('day off'));
      let shiftTitle = isDayOff ? 'Day Off' : 'Work';
      const shiftColor = isDayOff ? '#ef4444' : '#3b82f6';
      
      let shiftStart = '';
      let shiftEnd = '';

      if (!isDayOff && status) {
        // Normalize status: replace newlines and multiple spaces with a single space
        const normalizedStatus = status.replace(/\s+/g, ' ').trim();
        console.log(`[Sync] Processing status for ${name}: "${normalizedStatus}"`);
        
        // Extremely permissive time regex to catch almost any range
        // Matches HH:mm with optional AM/PM, then some kind of separator, then another HH:mm with optional AM/PM
        // We use the normalized status so newlines don't break the regex
        const timeMatch = normalizedStatus.match(/(\d{1,2}:\d{2})\s*(AM|PM)?\s*[\-\~ដល់ទៅto]+\s*(\d{1,2}:\d{2})\s*(AM|PM)?/i) ||
                          normalizedStatus.match(/(\d{1,2}:\d{2})\s*(AM|PM)?\s+(\d{1,2}:\d{2})\s*(AM|PM)?/i);
        
        if (timeMatch) {
          // Identify indices based on which regex matched (match vs spaces)
          const startIdx = 1;
          const startPIdx = 2;
          const endIdx = timeMatch[3] ? 3 : 2; // if space-based, group 2 might be end time if no PM
          const endPIdx = timeMatch[3] ? 4 : 3;

          const sTimeStr = timeMatch[startIdx];
          const sP = timeMatch[startPIdx]?.toUpperCase();
          const eTimeStr = timeMatch[3] || timeMatch[2]; // handle both regex variations
          const eP = (timeMatch[3] ? timeMatch[4] : timeMatch[3])?.toUpperCase();
          
          let sH = sTimeStr.split(':')[0];
          let sM = sTimeStr.split(':')[1];
          let eH = eTimeStr.split(':')[0];
          let eM = eTimeStr.split(':')[1];

          // It's a time range, extract prefix as title (e.g. "វេនព្រឹក 07:00-11:00" -> "វេនព្រឹក")
          const prefix = status.split(timeMatch[0])[0].trim().replace(/[:\-]$|^\-/, '').trim();
          if (prefix && prefix.length > 1) {
            shiftTitle = prefix;
          }
          
          let startHour = parseInt(sH);
          let endHour = parseInt(eH);

          if (sP === 'PM' && startHour < 12) startHour += 12;
          if (sP === 'AM' && startHour === 12) startHour = 0;
          if (eP === 'PM' && endHour < 12) endHour += 12;
          if (eP === 'AM' && endHour === 12) endHour = 0;

          if (!sP && !eP && endHour < startHour && endHour < 12) {
            endHour += 12;
          }

          shiftStart = `${String(startHour).padStart(2, '0')}:${sM}`;
          shiftEnd = `${String(endHour).padStart(2, '0')}:${eM}`;
          console.log(`[Sync] Successfully parsed: ${shiftStart} - ${shiftEnd}`);
        } else {
          // If not a time range, use the status text as the title (e.g. "វេនយប់")
          shiftTitle = status;
          shiftStart = '';
          shiftEnd = '';
          console.log(`[Sync] No time range found, using text as title: "${shiftTitle}"`);
        }
      }

      const scheduleDate = new Date(date);
      let schedule = await WorkSchedule.findOne({ 
        employeeId: hr._id, 
        date: scheduleDate 
      });

      if (schedule) {
        schedule.shiftTitle = shiftTitle;
        schedule.shiftColor = shiftColor;
        schedule.shiftStart = shiftStart || schedule.shiftStart;
        schedule.shiftEnd = shiftEnd || schedule.shiftEnd;
        schedule.notes = notes || schedule.notes;
        await schedule.save();
      } else {
        schedule = new WorkSchedule({
          employeeId: hr._id,
          date: scheduleDate,
          shiftTitle,
          shiftStart,
          shiftEnd,
          shiftColor,
          notes: notes || 'Auto Synced'
        });
        await schedule.save();
      }

      results.push({ staffId: resolvedStaffId, date, status: shiftTitle });
    } catch (err) {
      errors.push({ data: item, error: err.message });
    }
  }

  return { results, errors };
}

// Auto Sync from Checkinme (Backend-to-Backend scraping)
router.post('/auto-sync-checkinme', requireAnyPermission(['edit:work-schedule']), async (req, res, next) => {
  try {
    const { month, startDate, endDate, staffId, name, serviceId, branchId } = req.body;
    
    // Determine range
    let targetFromDate = startDate;
    let targetToDate = endDate;

    let checkinmeFilterName = name;
    if (staffId) {
      const hrRecord = await HR.findOne({ staffId });
      if (hrRecord && hrRecord.name) {
        checkinmeFilterName = hrRecord.name;
        console.log(`[Sync] Resolved Khmer name "${name}" to Latin name "${checkinmeFilterName}" using staffId ${staffId} for Checkinme query`);
      }
    } else if (name) {
      const isKhmer = /[^\x00-\x7F]/.test(name);
      if (isKhmer) {
        const hrRecord = await HR.findOne({
          $or: [
            { khmerName: name },
            { fullName: name }
          ]
        });
        if (hrRecord && hrRecord.name) {
          checkinmeFilterName = hrRecord.name;
          console.log(`[Sync] Resolved Khmer name "${name}" to Latin name "${checkinmeFilterName}" using name lookup for Checkinme query`);
        }
      }
    }

    const scrapedEmployees = await scrapeCheckinmeDayOffs({ 
      month,
      fromDate: targetFromDate,
      toDate: targetToDate,
      serviceId,
      branchId,
      filterStaffId: staffId, 
      filterName: checkinmeFilterName 
    });
    
    if (!scrapedEmployees || scrapedEmployees.length === 0) {
      return res.json({ success: true, synced: 0, message: 'No data found on Checkinme' });
    }

    const allSchedules = [];
    scrapedEmployees.forEach(emp => {
      emp.schedules.forEach(sched => {
        // If range provided, filter by range
        if (startDate && endDate) {
          if (sched.date < startDate || sched.date > endDate) return;
        }

        allSchedules.push({
          name: emp.name,
          staffId: emp.staffId,
          checkinmeId: emp.checkinmeId, // Critical for avoiding duplicate name issues
          date: sched.date,
          status: sched.status,
          notes: 'Auto Synced from Checkinme'
        });
      });
    });

    const { results, errors } = await processWorkScheduleSyncItems(allSchedules);

    res.json({
      success: true,
      synced: results.length,
      results: results, // Added for single/bulk sync feedback
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
});

// Sync for a specific day
router.post('/auto-sync-checkinme-daily', requireAnyPermission(['edit:work-schedule']), async (req, res, next) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    console.log(`[Sync] Daily sync triggered for: ${date}`);
    const scrapedEmployees = await scrapeCheckinmeDayOffs({ 
      fromDate: date,
      toDate: date
    });
    
    if (!scrapedEmployees || scrapedEmployees.length === 0) {
      return res.json({ success: true, synced: 0, message: 'No data found' });
    }

    const allSchedules = [];
    scrapedEmployees.forEach(emp => {
      emp.schedules.forEach(sched => {
        if (sched.date !== date) return;
        allSchedules.push({
          name: emp.name,
          staffId: emp.staffId,
          checkinmeId: emp.checkinmeId,
          date: sched.date,
          status: sched.status,
          notes: 'Daily Auto Sync from Checkinme'
        });
      });
    });

    const { results, errors } = await processWorkScheduleSyncItems(allSchedules);
    res.json({ success: true, synced: results.length, results, errors });
  } catch (err) {
    next(err);
  }
});

// Clear all schedules for a specific month
router.delete('/month-clear', requireAnyPermission(['edit:work-schedule']), async (req, res, next) => {
  try {
    const { month } = req.query; // Expected: YYYY-MM
    
    if (!month) {
      return res.status(400).json({ message: 'Month parameter (YYYY-MM) is required' });
    }

    const [year, m] = month.split('-').map(Number);
    const startDate = new Date(year, m - 1, 1);
    const endDate = new Date(year, m, 0, 23, 59, 59);

    const result = await WorkSchedule.deleteMany({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} schedules for ${month}`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    next(err);
  }
});

// Clear all schedules for a specific range
router.delete('/range-clear', requireAnyPermission(['edit:work-schedule']), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const result = await WorkSchedule.deleteMany({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    });

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} schedules from ${startDate} to ${endDate}`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    next(err);
  }
});

// Auto-fill standard schedule for admin/technical departments AND custom patterns
router.post('/auto-fill-standard', requireAnyPermission(['edit:work-schedule', 'edit:shift-groups']), async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const result = await syncShiftGroupsToSchedules({ month, year });

    res.json({
      success: true,
      message: result.message || `បំពេញម៉ោងអូតូបានជោគជ័យសម្រាប់បុគ្គលិកចំនួន ${result.processedCount} នាក់! (សរុប ${result.totalSchedules} កំណត់ត្រា)។`,
      processedCount: result.processedCount,
      totalSchedules: result.totalSchedules
    });
  } catch (err) {
    next(err);
  }
});

// Delete individual schedule entry
router.delete('/:id', requireAnyPermission(['edit:work-schedule']), async (req, res, next) => {
  try {
    const schedule = await WorkSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    res.json({ message: 'Schedule deleted', schedule });
  } catch (err) {
    next(err);
  }
});

export default router;
