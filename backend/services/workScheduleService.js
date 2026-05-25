import WorkSchedule from '../models/WorkSchedule.js';
import ShiftGroup from '../models/ShiftGroup.js';
import HR from '../models/HR.js';
import Department from '../models/Department.js';
import { fetchKHolidays } from '../services/holidayService.js';

/**
 * Syncs ShiftGroup configurations to the WorkSchedule collection.
 * This effectively "materializes" the dynamic preview into persistent records.
 * 
 * @param {Object} params
 * @param {number} params.month
 * @param {number} params.year
 * @param {string} [params.shiftGroupId] - If provided, only sync employees in this specific group
 * @param {string} [params.department] - If provided, only sync employees in this department
 */
export async function syncShiftGroupsToSchedules({ month, year, shiftGroupId, department }) {
  console.log(`[WorkScheduleService] Starting sync for ${month}/${year}`, { shiftGroupId, department });

  const cleanDept = (name) => (name || '').toString().replace(/\s+/g, ' ').trim();

  // 1. Fetch relevant ShiftGroups
  const sgFilter = { month: Number(month), year: Number(year), isActive: true };
  if (shiftGroupId) sgFilter._id = shiftGroupId;
  if (department) sgFilter.department = department;

  const shiftGroups = await ShiftGroup.find(sgFilter);

  // Fetch departments with custom pattern
  const depts = await Department.find({ customPattern: { $ne: null } });
  const deptPatternMap = new Map();
  depts.forEach(d => {
    if (d.Department_Kh && d.customPattern) {
      deptPatternMap.set(d.Department_Kh.trim(), d.customPattern);
    }
  });

  // If there are no ShiftGroups AND no custom patterns at all, we can return early.
  const employeesWithPatternCount = await HR.countDocuments({ customPattern: { $ne: null } });

  if (shiftGroups.length === 0 && depts.length === 0 && employeesWithPatternCount === 0) {
    console.log('[WorkScheduleService] No matching ShiftGroups or Custom Patterns found to sync.');
    return { success: true, processedCount: 0, totalSchedules: 0 };
  }

  // 2. Build mapping and collect metadata for ShiftGroups
  const employeeShiftGroupMap = new Map();
  const customHolidays = new Set();
  shiftGroups.forEach(sg => {
    (sg.subgroups || []).forEach(sub => {
      (sub.employees || []).forEach(empRef => {
        const key = String(empRef).trim();
        if (key) employeeShiftGroupMap.set(key, { subgroup: sub, shiftGroup: sg });
      });
    });
    (sg.holidayDates || []).forEach(d => customHolidays.add(d));
  });

  // 3. Fetch holidays and setup date range
  const allYearHolidays = await fetchKHolidays(year).catch(() => []);
  const monthHolidays = allYearHolidays
    .filter(h => h.month === parseInt(month))
    .map(h => h.day);

  const daysInMonth = new Date(year, month, 0).getDate();

  // 4. Determine which employees to process
  const inactiveStatuses = ['Resigned', 'Deleted', 'resigned', 'deleted'];
  const targetMonthStart = new Date(Date.UTC(year, month - 1, 1));
  
  const hrFilter = {
    $or: [
      { status: { $nin: inactiveStatuses } },
      {
        status: { $in: inactiveStatuses },
        $or: [
          { resignationDate: { $gte: targetMonthStart } },
          { dateRemoved: { $gte: targetMonthStart } }
        ]
      }
    ]
  };
  
  if (department) hrFilter.Department_Kh = department;

  const employees = await HR.find(hrFilter);
  const employeesToProcess = [];

  for (const emp of employees) {
    const staffId = String(emp.staffId || emp.cardNumber || '').trim();
    const empId = String(emp._id || '').trim();
    
    // Check ShiftGroup first
    const sgData = employeeShiftGroupMap.get(staffId) || (empId && employeeShiftGroupMap.get(empId));
    if (sgData) {
      employeesToProcess.push({ emp, type: 'shiftgroup', sgData });
      continue;
    }

    // Check Employee direct customPattern
    if (emp.customPattern) {
      employeesToProcess.push({ emp, type: 'custompattern', pattern: emp.customPattern, source: 'Employee Timetable' });
      continue;
    }

    // Check Department customPattern
    const deptPattern = deptPatternMap.get(String(emp.Department_Kh || '').trim());
    if (deptPattern) {
      // Check exclusion
      const exclusions = deptPattern.excludedStaffIds || [];
      if (!exclusions.includes(staffId) && !exclusions.includes(empId)) {
        employeesToProcess.push({ emp, type: 'custompattern', pattern: deptPattern, source: `Department Timetable (${emp.Department_Kh})` });
      }
    }
  }

  console.log(`[WorkScheduleService] Processing ${employeesToProcess.length} employees for ${month}/${year}`);

  // 5. Batch process and save to WorkSchedules
  let totalSchedules = 0;
  const batchSize = 50;
  
  for (let i = 0; i < employeesToProcess.length; i += batchSize) {
    const batch = employeesToProcess.slice(i, i + batchSize);
    const ops = [];
    
    for (const item of batch) {
      const { emp, type } = item;
      const staffId = String(emp.staffId || emp.cardNumber || '').trim();
      const empId = String(emp._id || '').trim();
      
      if (type === 'shiftgroup') {
        const { subgroup, shiftGroup } = item.sgData;
        const categoryId = subgroup.categoryId;
        
        let groupShifts = (shiftGroup.shifts || []).filter(s => String(s.categoryId || '') === String(categoryId || ''));
        if (groupShifts.length === 0 && (shiftGroup.shifts || []).length > 0) groupShifts = shiftGroup.shifts;
        const shiftsLen = groupShifts.length;

        if (shiftsLen === 0) continue;

        const sameCatSubgroups = (shiftGroup.subgroups || []).filter(s => String(s.categoryId || '') === String(categoryId || ''));
        const subgroupIndex = sameCatSubgroups.findIndex(s => String(s.name || '').trim() === String(subgroup.name || '').trim());
        
        // Use explicit startShiftIndex if available, otherwise fallback to index within the category
        let startShiftIndex = 0;
        if (typeof subgroup.startShiftIndex === 'number') {
          startShiftIndex = subgroup.startShiftIndex;
        } else if (subgroupIndex >= 0) {
          startShiftIndex = subgroupIndex;
        }

        // EXTRA FORCE: If name contains Khmer or Arabic numerals 1-5, use them as offset
        const gName = String(subgroup.name || '');
        if (gName.includes('១') || gName.includes('1')) startShiftIndex = 0;
        else if (gName.includes('២') || gName.includes('2')) startShiftIndex = 1;
        else if (gName.includes('៣') || gName.includes('3')) startShiftIndex = 2;
        else if (gName.includes('៤') || gName.includes('4')) startShiftIndex = 3;
        else if (gName.includes('៥') || gName.includes('5')) startShiftIndex = 4;

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(Date.UTC(year, month - 1, day));
          
          const isInactive = ['Resigned', 'Deleted', 'resigned', 'deleted'].includes(emp.status);
          if (isInactive) {
            const endDate = emp.resignationDate || emp.dateRemoved;
            if (endDate && date > endDate) {
              continue;
            }
          }

          const isoDate = date.toISOString().split('T')[0];
          const dayIndex = day - 1;
          
          const overrideKeyStaff = `${staffId}-${dayIndex}`;
          const overrideKeyId = `${empId}-${dayIndex}`;
          const manualOverride = (shiftGroup.manualOverrides || {})[overrideKeyStaff] || (shiftGroup.manualOverrides || {})[overrideKeyId];

          let shiftTitle, shiftStart, shiftEnd, shiftColor;

          if (manualOverride) {
            shiftTitle = manualOverride.title;
            shiftStart = manualOverride.start;
            shiftEnd = manualOverride.end;
            shiftColor = manualOverride.color;
          } else {
            const shiftIdx = (startShiftIndex + dayIndex) % shiftsLen;
            const baseShift = groupShifts[shiftIdx];

            const isHoliday = monthHolidays.includes(day) || customHolidays.has(isoDate);
            const isSaturday = date.getUTCDay() === 6;
            const isSunday = date.getUTCDay() === 0;

            if (isHoliday) {
              if (baseShift.holidayWork) {
                shiftTitle = baseShift.title; shiftStart = baseShift.start; shiftEnd = baseShift.end;
              } else {
                shiftTitle = 'Day Off'; shiftStart = ''; shiftEnd = '';
              }
            } else if (isSaturday) {
              if (baseShift.weekendWorkSaturday) {
                shiftTitle = baseShift.title; shiftStart = baseShift.start; shiftEnd = baseShift.end;
              } else {
                shiftTitle = 'Day Off'; shiftStart = ''; shiftEnd = '';
              }
            } else if (isSunday) {
              if (baseShift.weekendWorkSunday) {
                shiftTitle = baseShift.title; shiftStart = baseShift.start; shiftEnd = baseShift.end;
              } else {
                shiftTitle = 'Day Off'; shiftStart = ''; shiftEnd = '';
              }
            } else {
              shiftTitle = baseShift.title; shiftStart = baseShift.start; shiftEnd = baseShift.end;
            }
            shiftColor = baseShift.color || (shiftTitle === 'Day Off' ? '#ff0000' : '#0b74de');
          }

          ops.push({
            updateOne: {
              filter: { employeeId: emp._id, date },
              update: {
                $set: { 
                  shiftTitle,
                  shiftStart,
                  shiftEnd,
                  shiftColor,
                  notes: `Auto-generated from Shift Group: ${shiftGroup.name}`,
                  updatedAt: new Date()
                }
              },
              upsert: true
            }
          });
        }
      } else if (type === 'custompattern') {
        const { pattern, source } = item;
        
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(Date.UTC(year, month - 1, day));
          
          const isInactive = ['Resigned', 'Deleted', 'resigned', 'deleted'].includes(emp.status);
          if (isInactive) {
            const endDate = emp.resignationDate || emp.dateRemoved;
            if (endDate && date > endDate) {
              continue;
            }
          }

          const utcDay = date.getUTCDay();
          const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayOfWeek = weekdays[utcDay];
          const isHoliday = monthHolidays.includes(day);

          let shiftTitle, shiftStart, shiftEnd, shiftColor;

          if (pattern.mode === 'flexible') {
            const dayConfig = pattern.flexible ? pattern.flexible[dayOfWeek] : null;
            if (dayConfig && dayConfig.work) {
              if (isHoliday) {
                shiftTitle = 'Day Off'; shiftStart = ''; shiftEnd = ''; shiftColor = '#ff0000';
              } else {
                shiftTitle = 'Standard';
                shiftStart = dayConfig.start || '07:30';
                shiftEnd = dayConfig.end || '15:30';
                shiftColor = '#0b74de';
              }
            } else {
              shiftTitle = 'Day Off'; shiftStart = ''; shiftEnd = ''; shiftColor = '#ff0000';
            }
          } else {
            // standard or fallback standard
            const stdConfig = pattern.standard || {};
            const dayWorks = stdConfig.days ? stdConfig.days[dayOfWeek] : (dayOfWeek !== 'saturday' && dayOfWeek !== 'sunday');
            if (dayWorks) {
              if (isHoliday) {
                shiftTitle = 'Day Off'; shiftStart = ''; shiftEnd = ''; shiftColor = '#ff0000';
              } else {
                shiftTitle = 'Standard';
                shiftStart = stdConfig.start || '07:30';
                shiftEnd = stdConfig.end || '15:30';
                shiftColor = '#0b74de';
              }
            } else {
              shiftTitle = 'Day Off'; shiftStart = ''; shiftEnd = ''; shiftColor = '#ff0000';
            }
          }

          ops.push({
            updateOne: {
              filter: { employeeId: emp._id, date },
              update: {
                $set: {
                  shiftTitle,
                  shiftStart,
                  shiftEnd,
                  shiftColor,
                  notes: `Auto-generated from ${source}`,
                  updatedAt: new Date()
                }
              },
              upsert: true
            }
          });
        }
      }
    }

    if (ops.length > 0) {
      const result = await WorkSchedule.bulkWrite(ops, { ordered: false });
      totalSchedules += (result.upsertedCount || 0) + (result.modifiedCount || 0);
    }
  }

  return {
    success: true,
    processedCount: employeesToProcess.length,
    totalSchedules
  };
}
