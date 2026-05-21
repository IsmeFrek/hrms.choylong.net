import express from 'express';
import Employee from '../models/Employee.js';
import upload from '../multer-config.js';
import path from 'path';
import { authRequired, requirePermission } from '../middleware/auth.js';
const router = express.Router();

// All employee routes require auth
router.use(authRequired);

// Lightweight metadata endpoints
// ------------------------------

// Distinct department names from employees, used by several reports.
router.get('/meta/departments', requirePermission('view:employees'), async (req, res) => {
  try {
    const docs = await Employee.find({}, { department: 1, Department_Kh: 1, Department_En: 1 }).lean();
    const set = new Set();
    for (const d of docs || []) {
      const name = (d.department || d.Department_Kh || d.Department_En || '').toString().trim();
      if (name) set.add(name);
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'km'));
    res.json(list);
  } catch (error) {
    console.error('Error in GET /api/employees/meta/departments:', error);
    res.status(500).json({ message: error.message });
  }
});

// Distinct positions from employees.
router.get('/meta/positions', requirePermission('view:employees'), async (req, res) => {
  try {
    const docs = await Employee.find({}, { position: 1 }).lean();
    const set = new Set();
    for (const d of docs || []) {
      const name = (d.position || '').toString().trim();
      if (name) set.add(name);
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, 'km'));
    res.json(list);
  } catch (error) {
    console.error('Error in GET /api/employees/meta/positions:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET all employees
router.get('/', async (req, res) => {
  const perms = req.auth?.permissions || [];
  const roles = (req.auth?.user?.roles || []).map((r) => r.name);
  const email = req.auth?.user?.email || '';
  const cleanEmail = String(email).trim().toLowerCase();
  const isAdmin = roles.includes('Admin') || roles.includes('Administrator') || cleanEmail === 'admin@hospital.com' || cleanEmail.includes('admin@hospital07.com');
  const hasViewPerm = perms.includes('view:employees');
  const hasDept = !!req.auth?.user?.department;
  
  if (!isAdmin && !hasViewPerm && !hasDept) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = {
        $or: [
          { khmerName: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { staffId: { $regex: search, $options: 'i' } }
        ]
      };
    }

    if (!isAdmin && hasDept) {
      const deptQuery = {
        $or: [
          { Department_Kh: req.auth.user.department },
          { department: req.auth.user.department }
        ]
      };
      if (query.$or) {
        query = { $and: [query, deptQuery] };
      } else {
        query = deptQuery;
      }
    }

    if (req.query.Department_Kh) query.Department_Kh = req.query.Department_Kh;
    if (req.query.Department_Id) query.Department_Id = req.query.Department_Id;
    if (req.query.status) query.status = req.query.status;

    console.log('[API] GET /api/employees');
    console.log('Query:', query);
    const totalEmployees = await Employee.countDocuments(query);
    const totalPages = Math.ceil(totalEmployees / limit);
    const employees = await Employee.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ no: 1 });
    console.log('Employees found:', employees.length);
    res.json({
      employees,
      currentPage: page,
      totalPages,
      totalEmployees
    });
  } catch (error) {
    console.error('Error in GET /api/employees:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET single employee by ID
router.get('/:id', requirePermission('view:employees'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE new employee with image upload
router.post('/', requirePermission('edit:employees'), upload.single('image'), async (req, res) => {
  try {
    console.log('[API] POST /api/employees');
    console.log('req.body:', req.body); // Debug payload
    let employeeData = req.body;
    // Handle image upload
    if (req.file) {
      employeeData.image = '/uploads/' + req.file.filename;
    }

    // Handle documents (multiple files)
    // documents[0][type], documents[0][name], documents[0][file], ...
    let documents = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file, idx) => {
        documents.push({
          type: req.body[`documents[${idx}][type]`],
          name: req.body[`documents[${idx}][name]`],
          file: '/uploads/' + file.filename
        });
      });
    } else {
      // If files not handled by multer, get info from body only
      let idx = 0;
      while (req.body[`documents[${idx}][type]`]) {
        documents.push({
          type: req.body[`documents[${idx}][type]`],
          name: req.body[`documents[${idx}][name]`],
          file: req.body[`documents[${idx}][file]`] || ''
        });
        idx++;
      }
    }
    if (documents.length > 0) {
      employeeData.documents = documents;
    }

    // Children info
    if (employeeData.childrenList) {
      try {
        employeeData.childrenList = JSON.parse(employeeData.childrenList);
      } catch (e) {
        employeeData.childrenList = [];
      }
    }

    const employee = new Employee(employeeData);
    const savedEmployee = await employee.save();
    res.status(201).json(savedEmployee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// UPDATE employee

// UPDATE employee with image upload
router.put('/:id', requirePermission('edit:employees'), upload.single('image'), async (req, res) => {
  try {
    let updateData = req.body;
    if (req.file) {
      updateData.image = '/uploads/' + req.file.filename;
    }
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE employee
router.delete('/:id', requirePermission('edit:employees'), async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create uploads directory if it doesn't exist
import fs from 'fs';
const uploadsDir = path.join(path.resolve(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads directory created:', uploadsDir);
} else {
  console.log('Uploads directory already exists:', uploadsDir);
}

export default router;

