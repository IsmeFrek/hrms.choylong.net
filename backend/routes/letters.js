import express from 'express';
import Letter from '../models/Letter.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/letters - list letters (requires view:documents)
router.get('/', authRequired, async (req, res, next) => {
  try {
    const perms = req.auth?.permissions || [];
    let letters;
    if (perms.includes('view:documents')) {
      letters = await Letter.find().sort({ createdAt: -1 });
    } else {
      // Non-privileged users can only see their own letters
      letters = await Letter.find({ createdBy: req.auth.user._id }).sort({ createdAt: -1 });
    }
    res.json(letters);
  } catch (err) {
    next(err);
  }
});

// GET /api/letters/:id - get one letter
router.get('/:id', authRequired, async (req, res, next) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Letter not found' });
    const perms = req.auth?.permissions || [];
    if (perms.includes('view:documents') || (letter.createdBy && String(letter.createdBy) === String(req.auth.user._id))) {
      return res.json(letter);
    }
    return res.status(403).json({ message: 'Forbidden' });
  } catch (err) {
    next(err);
  }
});

// POST /api/letters - save a letter (requires edit:documents)
// Anyone authenticated can create a letter (they become the owner)
router.post('/', authRequired, async (req, res, next) => {
  try {
    const payload = req.body || {};
    // simple validation
    if (!payload.subject || !payload.body) return res.status(400).json({ message: 'subject and body are required' });

  const letter = new Letter({
      letterNo: payload.letterNo,
      dateText: payload.dateText,
      ministry: payload.ministry,
      department: payload.department,
      subject: payload.subject,
      recipient: payload.recipient,
      body: payload.body,
      signPlace: payload.signPlace,
      signTitle: payload.signTitle,
      signName: payload.signName,
  // auth middleware attaches req.auth.user
  createdBy: req.auth?.user?._id || req.auth?.user?.id || undefined,
    });

    await letter.save();
    res.status(201).json({ letter });
  } catch (err) {
    next(err);
  }
});

// PUT /api/letters/:id - update letter (edit allowed for admins, owner, or specific field perms)
router.put('/:id', authRequired, async (req, res, next) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Letter not found' });
    const perms = req.auth?.permissions || [];
    const isAdmin = perms.includes('edit:documents');
    const isOwner = letter.createdBy && String(letter.createdBy) === String(req.auth.user._id);

    // If admin or owner, allow full update
    if (isAdmin || isOwner) {
      Object.assign(letter, req.body);
      await letter.save();
      return res.json(letter);
    }

    // Not admin and not owner: enforce per-field permissions
    const incoming = req.body || {};
    const changedKeys = Object.keys(incoming).filter(k => incoming[k] !== undefined);
    // fields that require special per-field perms (workflow fields)
    const workflowFields = new Set([
      'officer','deputyAdmin','officeHead','deputyDirector1','deputyDirector2','deputyDirector3','deputyDirector4','deputyDirector5','deputyDirector6','deputyDirector7','deputyDirector8','deputyDirector9','director'
    ]);

    const forbidden = [];
    for (const k of changedKeys) {
      if (workflowFields.has(k)) {
        if (!perms.includes(`edit:letters.${k}`)) forbidden.push(k);
      } else {
        // non-workflow fields: only allow if user has a matching generic permission
        // default: disallow changes to other fields for non-owner/non-admin
        forbidden.push(k);
      }
    }

    if (forbidden.length) {
      return res.status(403).json({ message: 'Forbidden to edit fields: ' + forbidden.join(', ') });
    }

    // All changed fields are allowed by per-field perms
    Object.assign(letter, incoming);
    await letter.save();
    res.json(letter);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/letters/:id - delete letter (allowed for admins or the creator)
router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Letter not found' });
    const perms = req.auth?.permissions || [];
    if (!perms.includes('edit:documents') && !(letter.createdBy && String(letter.createdBy) === String(req.auth.user._id))) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await letter.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/letters/:id/approve-admin - mark as admin-approved
router.patch('/:id/approve-admin', authRequired, requirePermission('manage:users'), async (req, res, next) => {
  try {
    const letter = await Letter.findById(req.params.id);
    if (!letter) return res.status(404).json({ message: 'Letter not found' });
    letter.approvedByAdmin = true;
    letter.approvedByAdminId = req.auth.user._id;
    letter.approvedAt = new Date();
    await letter.save();
    res.json({ message: 'Approved', letter });
  } catch (err) {
    next(err);
  }
});

export default router;
