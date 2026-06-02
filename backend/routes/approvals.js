import { Router } from 'express';
import mongoose from 'mongoose';
import ChangeRequest from '../models/ChangeRequest.js';
import HR from '../models/HR.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Letter from '../models/Letter.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = Router();

// Create a change request (any authenticated user with edit permission for the target)
router.post('/', authRequired, async (req, res) => {
  const { targetType, targetId, payload, reason } = req.body || {};
  if (!targetType || !targetId || !payload) {
    return res.status(400).json({ message: 'targetType, targetId and payload are required' });
  }
  if (!mongoose.isValidObjectId(targetId)) {
    return res.status(400).json({ message: 'Invalid targetId' });
  }

  const cr = await ChangeRequest.create({
    targetType,
    targetId,
    payload,
    reason: reason || '',
    requestedBy: req.auth.user.id || req.auth.user._id,
  });

  res.status(201).json(cr);
});

// List change requests (admins/approvers)
router.get('/', authRequired, requirePermission('approve:hr'), async (req, res) => {
  const { status, targetType, targetId, hasAttachments, minAttachments, source } = req.query || {};
  const filter = {};
  if (status && String(status).toLowerCase() !== 'all') filter.status = status;
  if (targetType && String(targetType).toLowerCase() !== 'all') filter.targetType = targetType;
  if (targetId && mongoose.isValidObjectId(targetId)) filter.targetId = targetId;

  // Filter: payload.notes.source (e.g. staff_onboarding)
  if (source) {
    filter['payload.notes.source'] = String(source);
  }

  // Filter: has attachments
  if (hasAttachments === 'true' || hasAttachments === '1') {
    // Prefer attachmentsCount, but include fallback for legacy payloads
    filter.$or = [
      { attachmentsCount: { $gt: 0 } },
      { 'payload.attachments.0': { $exists: true } },
      { 'payload.files.0': { $exists: true } }
    ];
  } else if (typeof minAttachments !== 'undefined') {
    const n = Number(minAttachments);
    if (!Number.isNaN(n)) {
      filter.attachmentsCount = { $gte: n };
    }
  }

  let list = await ChangeRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('requestedBy', 'fullName email')
    .populate('reviewedBy', 'fullName email');

  // Convert list from Mongoose documents to plain objects so we can push letters
  list = list.map(item => item.toObject ? item.toObject() : item);

  // New logic: fetch Letters and format them as pseudo-ChangeRequests
  if ((!targetType || targetType === 'all' || targetType === 'letter') && !source && (!hasAttachments || hasAttachments === '0' || hasAttachments === 'false')) {
    const letterFilter = { type: 'instruction' };
    if (status && String(status).toLowerCase() !== 'all') {
      letterFilter.status = status; // pending, completed (approved), rejected
      if (status === 'approved') letterFilter.status = 'completed';
    }
    const letters = await Letter.find(letterFilter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'fullName email')
      .populate('approvedByAdminId', 'fullName email');

    for (const l of letters) {
      list.push({
        _id: l._id.toString(),
        targetType: 'letter',
        targetId: l._id.toString(),
        status: l.status === 'completed' ? 'approved' : l.status,
        requestedBy: l.createdBy,
        reviewedBy: l.approvedByAdminId,
        requestedAt: l.createdAt,
        reviewedAt: l.approvedAt,
        reason: l.subject || 'លិខិតបង្គាប់ការ',
        reviewerNote: l.note || '',
        payload: {
          fields: {
            templateType: l.templateType,
            officer: l.officer,
            officerId: l.officerId,
            newRole: l.newRole,
            currentRole: l.currentRole,
            department: l.department,
            letterNo: l.letterNo
          },
          attachments: l.attachments || []
        }
      });
    }
    list.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }

  res.json(list);
});

// Approve a change request (does not auto-apply to target here)
router.post('/:id/approve', authRequired, requirePermission('approve:hr'), async (req, res) => {
  const { id } = req.params;
  const { reviewerNote } = req.body || {};
  const cr = await ChangeRequest.findById(id);
  if (!cr) {
    const letter = await Letter.findById(id);
    if (!letter) return res.status(404).json({ message: 'Request or Letter not found' });
    if (letter.status !== 'pending') return res.status(400).json({ message: 'Letter already processed' });

    letter.status = 'completed';
    letter.approvedByAdmin = true;
    letter.approvedByAdminId = req.auth.user.id || req.auth.user._id;
    letter.approvedAt = new Date();
    await letter.save();

    // HR Sync
    if (['appointment', 'termination', 'adjustment'].includes(letter.templateType) && letter.officerId) {
      const query = { $or: [{ staffId: letter.officerId }, { civilServantId: letter.officerId }, { cardNumber: letter.officerId }, { nationalId: letter.officerId }] };
      const employee = await HR.findOne(query);
      if (employee) {
        if (letter.templateType === 'appointment' || letter.templateType === 'adjustment') {
          if (letter.newRole) { employee.civilServantRole = letter.newRole; employee.position = letter.newRole; }
          if (letter.department) { employee.Department_Kh = letter.department; employee.department = letter.department; }
        } else if (letter.templateType === 'termination') {
          employee.civilServantRole = ''; employee.position = '';
        }
        await employee.save();
      }
    }
    return res.json({ message: 'Letter approved', letter });
  }
  if (cr.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });
  let applied = [];
  let prev = null;
  // If the target type is HR, attempt to apply the proposed fields directly
  if (cr.targetType === 'hr' && cr.targetId && mongoose.isValidObjectId(cr.targetId)) {
    const p = cr.payload || {};
    const fields = p.fields || {};
    if (fields && typeof fields === 'object') {
      try {
        // Load doc, assign fields, then save to trigger schema setters/validators
        const doc = await HR.findById(cr.targetId);
        if (doc) {
          // capture previous values for changed keys
          prev = {};
          for (const k of Object.keys(fields)) prev[k] = doc[k];
          Object.assign(doc, fields);
          await doc.save();
          applied = Object.keys(fields);
        }
      } catch (e) {
        // If validation fails, keep request approved but report that apply failed
        // eslint-disable-next-line no-console
        console.error('Apply to HR failed:', e.message);
      }
    }
  }

  // If the target type is User, mark as approved by swapping roles
  if (cr.targetType === 'user' && cr.targetId && mongoose.isValidObjectId(cr.targetId)) {
    try {
      const user = await User.findById(cr.targetId).populate('roles');
      if (user) {
        const fields = (cr.payload && cr.payload.fields && typeof cr.payload.fields === 'object') ? cr.payload.fields : {};

        let userRole = await Role.findOne({ name: 'Viewer' });
        const basePerms = ['view:my-hr', 'print:hr', 'view:fileTransfers', 'send:feedback', 'send:telegram', 'view:attendance'];
        
        if (!userRole) {
          userRole = await Role.create({ name: 'Viewer', permissions: basePerms });
        } else {
          // Force reset permissions to ensure view:hr and view:employees are removed
          userRole.permissions = basePerms;
          await userRole.save();
        }
        const pendingRole = await Role.findOne({ name: 'Pending' });
        const existing = (user.roles || []).map((r) => r._id?.toString?.() || r.toString());
        const next = new Set(existing);
        next.add(userRole._id.toString());
        if (pendingRole) next.delete(pendingRole._id.toString());
        user.roles = Array.from(next);

        // Ensure username is set for staff accounts so they can fetch their own HR record
        if (!user.username) {
          const staffIdCandidate = String(fields.staffId || cr.payload?.meta?.staffId || fields.phone || user.phone || '').trim();
          if (staffIdCandidate) user.username = staffIdCandidate.toLowerCase();
        }
        user.active = true;
        await user.save();

        // Auto-create HR entry if missing (so staff is added to HR dataset)
        try {
          const staffId = String(fields.staffId || cr.payload?.meta?.staffId || fields.phone || user.phone || '').trim();
          if (staffId) {
            const existingHR = await HR.findOne({ staffId }).lean();
            if (!existingHR) {
              await HR.create({
                staffId,
                phone: fields.phone || user.phone || undefined,
                email: fields.email || undefined,
                khmerName: fields.khmerName || fields.fullName || user.fullName || undefined,
                name: fields.name || undefined,
                gender: fields.gender || undefined,
                dob: fields.dob || undefined,
                maritalStatus: fields.maritalStatus || undefined,
                bloodGroup: fields.bloodGroup || undefined,
                birthPlace: fields.birthPlace || undefined,
                currentPlace: fields.currentPlace || undefined,
                Department_Kh: fields.Department_Kh || undefined,
                officerType: fields.officerType || undefined,
                position: fields.position || undefined,
                skill: fields.skill || undefined,
                joinDate: fields.joinDate || undefined,
                dateJoinedMinistry: fields.dateJoinedMinistry || undefined,
                lastSalaryIncrementDate: fields.lastSalaryIncrementDate || undefined,
                degreeLevel: fields.degreeLevel || undefined,
                degree: fields.degree || undefined,
                educationLevel: fields.educationLevel || undefined,
                officerId: fields.officerId || undefined,
                cardNumber: fields.cardNumber || undefined,
                nid: fields.nid || undefined,
                bankAccount: fields.bankAccount || undefined,
                mentorName: fields.mentorName || undefined,
                mentorDate: fields.mentorDate || undefined,

                // Parents
                fatherName: fields.fatherName || undefined,
                fatherDob: fields.fatherDob || undefined,
                fatherOccupation: fields.fatherOccupation || undefined,
                fatherPhone: fields.fatherPhone || undefined,
                fatherNote: fields.fatherNote || undefined,
                motherName: fields.motherName || undefined,
                motherDob: fields.motherDob || undefined,
                motherOccupation: fields.motherOccupation || undefined,
                motherPhone: fields.motherPhone || undefined,
                motherNote: fields.motherNote || undefined,

                // Union
                unionName: fields.unionName || undefined,
                unionMemberId: fields.unionMemberId || undefined,
                unionJoinDate: fields.unionJoinDate || undefined,
                unionRole: fields.unionRole || undefined,
                unionPhone: fields.unionPhone || undefined,
                unionNote: fields.unionNote || undefined,

                // Lists
                childrenList: Array.isArray(fields.childrenList) ? fields.childrenList : undefined,
                educationList: Array.isArray(fields.educationList) ? fields.educationList : undefined,
                documents: Array.isArray(fields.documents) ? fields.documents : undefined,

                // Civil servant
                civilServantId: fields.civilServantId || undefined,
                civilServantRole: fields.civilServantRole || undefined,
                salaryLevel: fields.salaryLevel || undefined,
                civilServantStartDate: fields.civilServantStartDate || undefined,
                nominationStartDate: fields.nominationStartDate || undefined,
                salaryPromotionDate: fields.salaryPromotionDate || undefined,
                medalType: fields.medalType || undefined,
                medalReceivedDate: fields.medalReceivedDate || undefined,
                civilServantReason: fields.civilServantReason || undefined,
                isRetiredThenContract: (typeof fields.isRetiredThenContract === 'boolean') ? fields.isRetiredThenContract : undefined,
                isPartTime: (typeof fields.isPartTime === 'boolean') ? fields.isPartTime : undefined,
                // Other
                other: fields.other || undefined,
              });
              applied = ['roles', 'active', 'hr:create'];
            } else {
              applied = ['roles', 'active'];
            }
          } else {
            applied = ['roles', 'active'];
          }
        } catch (e2) {
          console.error('Auto-create HR failed:', e2?.message || e2);
          applied = ['roles', 'active'];
        }
      }
    } catch (e) {
      console.error('Apply to User failed:', e?.message || e);
    }
  }

  cr.status = 'approved';
  cr.reviewedBy = req.auth.user.id || req.auth.user._id;
  cr.reviewedAt = new Date();
  if (reviewerNote) cr.reviewerNote = reviewerNote;
  if (prev) cr.prev = prev;
  await cr.save();

  res.json({ ...cr.toObject(), applied });
});

// Reject a change request
router.post('/:id/reject', authRequired, requirePermission('approve:hr'), async (req, res) => {
  const { id } = req.params;
  const { reviewerNote } = req.body || {};
  const cr = await ChangeRequest.findById(id);
  if (!cr) {
    const letter = await Letter.findById(id);
    if (!letter) return res.status(404).json({ message: 'Request or Letter not found' });
    if (letter.status !== 'pending') return res.status(400).json({ message: 'Letter already processed' });

    letter.status = 'rejected';
    if (reviewerNote) letter.note = reviewerNote;
    await letter.save();
    return res.json({ message: 'Letter rejected', letter });
  }
  if (cr.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });

  cr.status = 'rejected';
  cr.reviewedBy = req.auth.user.id || req.auth.user._id;
  cr.reviewedAt = new Date();
  if (reviewerNote) cr.reviewerNote = reviewerNote;
  await cr.save();

  // If rejected user signup, deactivate the user to prevent login
  if (cr.targetType === 'user' && cr.targetId && mongoose.isValidObjectId(cr.targetId)) {
    try {
      await User.findByIdAndUpdate(cr.targetId, { $set: { active: false } });
    } catch (e) {
      console.error('Deactivate user failed:', e?.message || e);
    }
  }

  res.json(cr);
});

export default router;
