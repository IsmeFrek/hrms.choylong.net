import { Router } from 'express';
import ChangeRequest from '../models/ChangeRequest.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const ALLOWED_FIELDS = [
  'no',
  'staffId',
  'fullName',
  'phone',
  'email',
  'khmerName',
  'name',
  'gender',
  'dob',
  'maritalStatus',
  'bloodGroup',
  'birthPlace',
  'birthPlaceParts',
  'currentPlace',
  'currentPlaceParts',
  'Department_Kh',
  'officerType',
  'position',
  'skill',
  'officerId',
  'cardNumber',
  'nid',
  'bankAccount',
  'joinDate',
  'dateJoinedMinistry',
  'lastSalaryIncrementDate',
  'degreeLevel',
  'degree',
  'educationLevel',
  'mentorName',
  'mentorDate',

  // Extra HR tabs
  // Parents
  'fatherName',
  'fatherDob',
  'fatherOccupation',
  'fatherPhone',
  'fatherNote',
  'motherName',
  'motherDob',
  'motherOccupation',
  'motherPhone',
  'motherNote',

  // Union
  'unionName',
  'unionMemberId',
  'unionJoinDate',
  'unionRole',
  'unionPhone',
  'unionNote',

  // Lists
  'childrenList',
  'educationList',
  'documents',

  // Civil servant
  'civilServantId',
  'civilServantRole',
  'salaryLevel',
  'civilServantStartDate',
  'nominationStartDate',
  'salaryPromotionDate',
  'medalType',
  'medalReceivedDate',
  'civilServantReason',
  'isRetiredThenContract',
  'isPartTime',

  // Other
  'other',
];

const pickFields = (input) => {
  const out = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const k of ALLOWED_FIELDS) {
    if (typeof src[k] === 'undefined') continue;
    const v = src[k];
    if (v === null) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
};

// Get current onboarding fields (from latest pending ChangeRequest or user profile)
router.get('/onboarding', authRequired, async (req, res) => {
  const userId = req.auth?.user?._id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const existing = await ChangeRequest.findOne({
    targetType: 'user',
    targetId: userId,
    status: 'pending',
  }).sort({ createdAt: -1 });

  const fields = {
    fullName: req.auth.user.fullName || '',
    phone: req.auth.user.phone || '',
    ...(existing?.payload?.fields || {}),
  };

  res.json({ fields, requestId: existing?._id || null });
});

// Submit onboarding fields (create/update pending ChangeRequest)
router.post('/onboarding', authRequired, async (req, res) => {
  const userId = req.auth?.user?._id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const incoming = req.body?.fields;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ message: 'fields is required' });
  }

  const fields = pickFields(incoming);
  if (!fields.fullName) fields.fullName = req.auth.user.fullName || '';
  if (!fields.phone) fields.phone = req.auth.user.phone || '';

  const staffId = fields.phone || req.auth.user.phone || userId.toString();

  const payload = {
    titleText: 'Staff onboarding',
    subText: 'Waiting for admin approval',
    fields,
    notes: { source: 'staff_onboarding' },
    attachments: [],
    meta: { staffId },
  };

  const update = {
    $set: {
      payload,
      reason: 'Staff submitted onboarding info for HR creation',
      requestedBy: userId,
      requestedAt: new Date(),
      status: 'pending',
    },
    $setOnInsert: {
      targetType: 'user',
      targetId: userId,
    },
  };

  const cr = await ChangeRequest.findOneAndUpdate(
    { targetType: 'user', targetId: userId, status: 'pending' },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json(cr);
});

export default router;
