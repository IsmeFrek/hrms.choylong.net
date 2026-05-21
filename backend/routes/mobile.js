import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import HR from '../models/HR.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';

const router = express.Router();

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// 1. Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate user
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    }).populate('roles');
    
    if (!user || !user.active) {
      return res.status(400).json({ error: 'Invalid username or password, or account is disabled.' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Determine Role
    const isAdmin = user.roles.some(r => r.name === 'Admin');
    const role = isAdmin ? 'manager' : 'staff';

    // Find linked HR profile (if any)
    const hrProfile = await HR.findOne({ staffId: user.username }); // Assuming username is staffId, adjust if needed

    // Generate token
    const token = jwt.sign(
      { _id: user._id, role: role, hrId: hrProfile?._id, staffId: hrProfile?.staffId }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: role,
        staffId: hrProfile?.staffId,
        department: hrProfile?.Department_Kh
      }
    });
  } catch (error) {
    console.error('Mobile Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    if (!req.user.hrId) {
       // Return basic user info if not linked to HR
       const u = await User.findById(req.user._id);
       return res.json({ name: u.fullName, email: u.email, role: req.user.role });
    }
    const hr = await HR.findById(req.user.hrId);
    res.json(hr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Attendance Today (Staff)
router.get('/attendance/today', authMiddleware, async (req, res) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: 'No linked staff profile.' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const att = await Attendance.findOne({
      officerId: req.user.staffId,
      date: { $gte: today, $lt: tomorrow }
    });

    res.json(att || { status: 'Not Checked In' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Check-in (Staff)
router.post('/attendance/checkin', authMiddleware, async (req, res) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: 'No linked staff profile.' });
    
    const { type, location, qrData } = req.body; // type: 'IN' or 'OUT'
    const hr = await HR.findOne({ staffId: req.user.staffId });
    if (!hr) return res.status(404).json({ error: 'HR not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let att = await Attendance.findOne({
      officerId: req.user.staffId,
      date: { $gte: today, $lt: tomorrow }
    });

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (!att) {
      if (type === 'OUT') return res.status(400).json({ error: 'Cannot check out before checking in.' });
      
      att = new Attendance({
        officerId: req.user.staffId,
        date: today,
        shift1_in: timeStr,
        status: 'Present',
        locationIn: location,
        name: hr.name,
        department: hr.Department_Kh
      });
    } else {
      if (type === 'IN') {
         if (!att.shift1_in) att.shift1_in = timeStr;
         else if (!att.shift2_in) att.shift2_in = timeStr;
         else return res.status(400).json({ error: 'Already checked in' });
      } else if (type === 'OUT') {
         if (!att.shift1_out) att.shift1_out = timeStr;
         else if (!att.shift2_out) att.shift2_out = timeStr;
         else return res.status(400).json({ error: 'Already checked out' });
      }
      att.locationOut = location;
    }

    await att.save();
    res.json({ message: `Successfully checked ${type}`, record: att });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Submit Leave Request (Staff)
router.post('/leave/request', authMiddleware, async (req, res) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: 'No linked staff profile.' });
    
    const { leaveType, startDate, endDate, reason } = req.body;
    // Handle image upload logic later using multer or base64

    const newRequest = new LeaveRequest({
      staffId: req.user.staffId,
      leaveType,
      startDate,
      endDate,
      reason,
      status: 'Pending',
      createdAt: new Date()
    });

    await newRequest.save();
    res.json({ message: 'Leave request submitted successfully', request: newRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Leave History (Staff)
router.get('/leave/history', authMiddleware, async (req, res) => {
  try {
    if (!req.user.staffId) return res.status(400).json({ error: 'No linked staff profile.' });
    
    const requests = await LeaveRequest.find({ staffId: req.user.staffId }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get Pending Leaves (Manager)
router.get('/manager/leaves', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Manager access required.' });
    
    // In a real app, filter by manager's department
    const requests = await LeaveRequest.find({ status: 'Pending' }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Approve/Reject Leave (Manager)
router.put('/manager/leaves/:id/status', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Manager access required.' });
    
    const { status } = req.body; // 'Approved' or 'Rejected'
    const request = await LeaveRequest.findByIdAndUpdate(req.params.id, { status, updatedAt: new Date() }, { new: true });
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json({ message: `Leave request ${status}`, request });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
