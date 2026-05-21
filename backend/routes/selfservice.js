import express from 'express';
import { authRequired } from '../middleware/auth.js';
import LeaveRequest from '../models/LeaveRequest.js';
import User from '../models/User.js';
import HR from '../models/HR.js';

const router = express.Router();

// Helper for staff normalization
const norm = (s) => String(s || '').trim().replace(/^0+/, '');

// GET /api/self/hr/me
// Used by staff to see their own HR profile
router.get('/hr/me', authRequired, async (req, res) => {
  try {
    const requester = req.auth.user;
    const query = {};
    
    if (requester.staffId) {
      query.staffId = requester.staffId;
    } else if (requester.phone) {
      query.phone = requester.phone;
    } else {
      return res.status(404).json({ message: 'User profile missing Staff ID or Phone' });
    }

    const hr = await HR.findOne(query);
    if (!hr) {
      return res.status(404).json({ message: 'HR record not found' });
    }
    res.json(hr);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/self/leave-requests
// Used by staff to see their own history
router.get('/leave-requests', authRequired, async (req, res) => {
  try {
    const requester = req.auth.user;
    if (!requester.staffId) {
      return res.status(400).json({ message: 'User profile missing Staff ID' });
    }
    const requests = await LeaveRequest.find({
      staffId: norm(requester.staffId)
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/self/leave-requests
// Create a new request
router.post('/leave-requests', authRequired, async (req, res) => {
  try {
    const requester = req.auth.user;
    if (!requester.staffId) {
      return res.status(400).json({ message: 'User profile missing Staff ID' });
    }
    const { startDate, endDate, amount, type, reason, attachments } = req.body;
    const newRequest = new LeaveRequest({
      staffId: norm(requester.staffId),
      name: requester.fullName || requester.username,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      date: new Date(startDate),
      amount: Number(amount) || 1,
      type,
      reason,
      attachments: attachments || [],
      status: 'pending',
      requestedAt: new Date()
    });
    await newRequest.save();
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
