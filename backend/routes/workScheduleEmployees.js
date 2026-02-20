import express from 'express';
import WorkScheduleEmployee from '../models/WorkScheduleEmployee.js';

const router = express.Router();

// Get all employees
router.get('/', async (req, res, next) => {
  try {
    const { limit = 10000, page = 1 } = req.query;
    const employees = await WorkScheduleEmployee.find({ isActive: true })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ staffId: 1 });
    res.json(employees);
  } catch (err) {
    next(err);
  }
});

// Get single employee
router.get('/:id', async (req, res, next) => {
  try {
    const employee = await WorkScheduleEmployee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

// Create or update employee
router.post('/', async (req, res, next) => {
  try {
    const { staffId, khmerName, phoneNumber, position, department } = req.body;
    
    if (!staffId || !khmerName) {
      return res.status(400).json({ message: 'staffId and khmerName are required' });
    }

    // Check if exists
    let employee = await WorkScheduleEmployee.findOne({ staffId });
    
    if (employee) {
      // Update existing
      employee.khmerName = khmerName;
      employee.phoneNumber = phoneNumber;
      employee.position = position;
      employee.department = department;
      await employee.save();
    } else {
      // Create new
      employee = new WorkScheduleEmployee({
        staffId,
        khmerName,
        phoneNumber,
        position,
        department
      });
      await employee.save();
    }
    
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

// Fix existing employees to set isActive: true
router.post('/fix-active', async (req, res, next) => {
  try {
    const result = await WorkScheduleEmployee.updateMany(
      { isActive: { $ne: true } }, // Find records where isActive is not true
      { $set: { isActive: true } }
    );
    
    res.json({
      success: true,
      message: 'Fixed isActive field for existing employees',
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    next(err);
  }
});

// Bulk create/update employees
router.post('/bulk', async (req, res, next) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ message: 'employees array required' });
    }

    const results = [];
    const errors = [];

    for (const emp of employees) {
      try {
        if (!emp.staffId || !emp.khmerName) {
          errors.push({ data: emp, error: 'staffId and khmerName required' });
          continue;
        }

        let employee = await WorkScheduleEmployee.findOne({ staffId: emp.staffId });
        
        if (employee) {
          employee.khmerName = emp.khmerName;
          employee.phoneNumber = emp.phoneNumber || '';
          employee.position = emp.position || '';
          employee.department = emp.department || '';
          employee.isActive = true;
          await employee.save();
        } else {
          employee = new WorkScheduleEmployee({
            staffId: emp.staffId,
            khmerName: emp.khmerName,
            phoneNumber: emp.phoneNumber || '',
            position: emp.position || '',
            department: emp.department || '',
            isActive: true
          });
          await employee.save();
        }
        
        results.push(employee);
      } catch (err) {
        errors.push({ data: emp, error: err.message });
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

// Delete employee (soft delete)
router.delete('/:id', async (req, res, next) => {
  try {
    const employee = await WorkScheduleEmployee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    
    employee.isActive = false;
    await employee.save();
    
    res.json({ message: 'Employee deleted', employee });
  } catch (err) {
    next(err);
  }
});

export default router;
