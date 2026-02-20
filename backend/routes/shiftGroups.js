import express from 'express';
import ShiftGroup from '../models/ShiftGroup.js';

const router = express.Router();

// GET all shift groups
router.get('/', async (req, res) => {
  try {
    const { department } = req.query;

    let filter = {};
    if (department) filter.department = department;
    // default to only active groups unless caller explicitly requests otherwise
    let isActiveFilter = true;
    if (req.query.isActive !== undefined) {
      isActiveFilter = req.query.isActive === 'true';
    }
    filter.isActive = isActiveFilter;

    const shiftGroups = await ShiftGroup.find(filter)
      .sort({ createdAt: -1 });

    console.log('shiftGroups GET / -> found', Array.isArray(shiftGroups) ? shiftGroups.length : typeof shiftGroups);
    if (Array.isArray(shiftGroups) && shiftGroups.length > 0) {
      console.log('  first item id:', shiftGroups[0]._id.toString());
    }

    res.json(shiftGroups);
  } catch (error) {
    console.error('Error fetching shift groups:', error);
    res.status(500).json({ message: 'Error fetching shift groups', error: error.message });
  }
});

  // DEBUG: return count and ids (temporary)
  router.get('/_debug/count', async (req, res) => {
    try {
      const count = await ShiftGroup.countDocuments();
      const ids = await ShiftGroup.find({}, { _id: 1 }).limit(50).lean();
      res.json({ count, ids });
    } catch (err) {
      console.error('debug count error', err);
      res.status(500).json({ error: err.message });
    }
  });

// GET shift group by ID
router.get('/:id', async (req, res) => {
  try {
    const shiftGroup = await ShiftGroup.findById(req.params.id);
    
    if (!shiftGroup) {
      return res.status(404).json({ message: 'Shift group not found' });
    }
    
    res.json(shiftGroup);
  } catch (error) {
    console.error('Error fetching shift group:', error);
    res.status(500).json({ message: 'Error fetching shift group', error: error.message });
  }
});

// CREATE new shift group
router.post('/', async (req, res) => {
  try {
    const {
      name,
      department,
      startDate,
      endDate,
      subgroups = [],
      shifts = [],
      createdBy = 'system'
    } = req.body;

    // Validate required fields
    if (!name || !department) {
      return res.status(400).json({ 
        message: 'Name and department are required' 
      });
    }

    // Debug: log a brief summary of incoming shifts to help trace missing times
    try {
      console.debug('shiftGroups POST received:', {
        department,
        shiftsCount: Array.isArray(shifts) ? shifts.length : 0,
        shiftsSample: (Array.isArray(shifts) ? shifts.slice(0, 6) : []).map(s => ({ title: s?.title, start: s?.start, end: s?.end, categoryId: s?.categoryId }))
      });
    } catch (e) {}

    // Calculate total employees
    const totalEmployees = subgroups.reduce((sum, subgroup) => {
      return sum + (subgroup.employees ? subgroup.employees.length : 0);
    }, 0);

    // Update employee count for each subgroup
    const updatedSubgroups = subgroups.map(subgroup => ({
      ...subgroup,
      employeeCount: subgroup.employees ? subgroup.employees.length : 0
    }));

    const shiftGroup = new ShiftGroup({
      name,
      department,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      subgroups: updatedSubgroups,
      shifts,
      totalEmployees,
      createdBy
    });

    const savedShiftGroup = await shiftGroup.save();
    
    res.status(201).json({
      message: 'Shift group created successfully',
      data: savedShiftGroup
    });
  } catch (error) {
    console.error('Error creating shift group:', error);
    res.status(500).json({ message: 'Error creating shift group', error: error.message });
  }
});

// UPDATE shift group
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      department,
      startDate,
      endDate,
      subgroups = [],
      shifts = [],
      isActive,
      updatedBy = 'system'
    } = req.body;

    // Debug: log brief summary of incoming shifts on update
    try {
      console.debug('shiftGroups PUT received for id', req.params.id, {
        department,
        shiftsCount: Array.isArray(shifts) ? shifts.length : 0,
        shiftsSample: (Array.isArray(shifts) ? shifts.slice(0, 6) : []).map(s => ({ title: s?.title, start: s?.start, end: s?.end, categoryId: s?.categoryId }))
      });
    } catch (e) {}

    // Calculate total employees
    const totalEmployees = subgroups.reduce((sum, subgroup) => {
      return sum + (subgroup.employees ? subgroup.employees.length : 0);
    }, 0);

    // Update employee count for each subgroup
    const updatedSubgroups = subgroups.map(subgroup => ({
      ...subgroup,
      employeeCount: subgroup.employees ? subgroup.employees.length : 0
    }));

    const updateData = {
      name,
      department,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      subgroups: updatedSubgroups,
      shifts,
      totalEmployees,
      updatedBy
    };

    if (isActive !== undefined) updateData.isActive = isActive;

    const shiftGroup = await ShiftGroup.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!shiftGroup) {
      return res.status(404).json({ message: 'Shift group not found' });
    }

    res.json({
      message: 'Shift group updated successfully',
      data: shiftGroup
    });
  } catch (error) {
    console.error('Error updating shift group:', error);
    res.status(500).json({ message: 'Error updating shift group', error: error.message });
  }
});

// DELETE shift group (soft delete by setting isActive to false)
router.delete('/:id', async (req, res) => {
  try {
    const { permanent = false } = req.query;
    
    if (permanent === 'true') {
      // Permanent delete
      const shiftGroup = await ShiftGroup.findByIdAndDelete(req.params.id);
      if (!shiftGroup) {
        return res.status(404).json({ message: 'Shift group not found' });
      }
      res.json({ message: 'Shift group permanently deleted' });
    } else {
      // Soft delete
      const shiftGroup = await ShiftGroup.findByIdAndUpdate(
        req.params.id,
        { isActive: false, updatedBy: 'system' },
        { new: true }
      );
      
      if (!shiftGroup) {
        return res.status(404).json({ message: 'Shift group not found' });
      }
      
      res.json({ 
        message: 'Shift group deactivated successfully',
        data: shiftGroup 
      });
    }
  } catch (error) {
    console.error('Error deleting shift group:', error);
    res.status(500).json({ message: 'Error deleting shift group', error: error.message });
  }
});

// GET shift groups by department
router.get('/department/:department', async (req, res) => {
  try {
    const { department } = req.params;
    const { isActive = true } = req.query;
    
    const filter = { department };
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const shiftGroups = await ShiftGroup.find(filter)
      .sort({ createdAt: -1 });
    
    res.json(shiftGroups);
  } catch (error) {
    console.error('Error fetching shift groups by department:', error);
    res.status(500).json({ message: 'Error fetching shift groups by department', error: error.message });
  }
});

// ACTIVATE/DEACTIVATE shift group
router.patch('/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (isActive === undefined) {
      return res.status(400).json({ message: 'isActive field is required' });
    }
    
    const shiftGroup = await ShiftGroup.findByIdAndUpdate(
      req.params.id,
      { isActive, updatedBy: 'system' },
      { new: true }
    );
    
    if (!shiftGroup) {
      return res.status(404).json({ message: 'Shift group not found' });
    }
    
    res.json({
      message: `Shift group ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: shiftGroup
    });
  } catch (error) {
    console.error('Error updating shift group status:', error);
    res.status(500).json({ message: 'Error updating shift group status', error: error.message });
  }
});

export default router;