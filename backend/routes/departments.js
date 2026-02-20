import express from 'express';
import Department from '../models/Department.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Public route: return list of departments without requiring auth.
// Placed BEFORE router.use(authRequired) so it's accessible without token.
router.get('/public', async (req, res) => {
  try {
    const departments = await Department.find();
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authRequired);

// Get all departments
router.get('/', requirePermission('view:departments'), async (req, res) => {
  try {
    const departments = await Department.find();
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create department
router.post('/', requirePermission('edit:departments'), async (req, res) => {
  try {
    const { Department_Id, Department_En, Department_Kh, Other } = req.body;
    const department = new Department({ Department_Id, Department_En, Department_Kh, Other });
    await department.save();
    res.status(201).json(department);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update department
router.put('/:id', requirePermission('edit:departments'), async (req, res) => {
  try {
    const { Department_Id, Department_En, Department_Kh, Other } = req.body;
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { Department_Id, Department_En, Department_Kh, Other },
      { new: true, runValidators: true }
    );
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json(department);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete department
router.delete('/:id', requirePermission('edit:departments'), async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
