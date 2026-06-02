import express from 'express';
import Letter from '../models/Letter.js';
import HR from '../models/HR.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/letters - list letters (requires view:documents)
router.get('/', authRequired, async (req, res, next) => {
  try {
    const perms = req.auth?.permissions || [];
    let query;
    const typeFilter = req.query.type;
    
    console.log('[GET /api/letters] perms:', perms, 'typeFilter:', typeFilter);
    
    if (perms.includes('view:documents')) {
      // If type filter is specified, include docs that have that type OR have no type (default to 'instruction')
      if (typeFilter) {
        query = Letter.find({
          $or: [
            { type: typeFilter },
            { type: { $exists: false } }
          ]
        }).sort({ createdAt: -1 });
      } else {
        query = Letter.find().sort({ createdAt: -1 });
      }
    } else {
      // Non-privileged users can only see their own letters
      const filter = { createdBy: req.auth.user._id };
      if (typeFilter) {
        filter.$or = [
          { type: typeFilter },
          { type: { $exists: false } }
        ];
        query = Letter.find({
          createdBy: req.auth.user._id,
          $or: [
            { type: typeFilter },
            { type: { $exists: false } }
          ]
        }).sort({ createdAt: -1 });
      } else {
        query = Letter.find(filter).sort({ createdAt: -1 });
      }
    }
    
    const letters = await query;
    console.log('[GET /api/letters] Found', letters.length, 'letters');
    res.json(letters);
  } catch (err) {
    console.error('[GET /api/letters] Error:', err);
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
    console.log('[POST /api/letters] payload type:', payload.type, 'templateType:', payload.templateType);
    // simple validation
    if (!payload.subject || !payload.body) return res.status(400).json({ message: 'subject and body are required' });

    const { _id, ...cleanPayload } = payload;
    const letter = new Letter({
      ...cleanPayload,
      createdBy: req.auth?.user?._id || req.auth?.user?.id || undefined,
    });

    await letter.save();

    // Automate HR update if status is 'completed' and it's an appointment, termination, or adjustment
    if (letter.status === 'completed' && ['appointment', 'termination', 'adjustment'].includes(letter.templateType) && letter.officerId) {
      const query = { 
        $or: [{ staffId: letter.officerId }, { civilServantId: letter.officerId }, { cardNumber: letter.officerId }, { nationalId: letter.officerId }] 
      };
      const employee = await HR.findOne(query);
      
      if (employee) {
        if (letter.templateType === 'appointment' || letter.templateType === 'adjustment') {
          if (letter.newRole) {
            employee.civilServantRole = letter.newRole;
            employee.position = letter.newRole;
          }
          if (letter.department) {
            employee.Department_Kh = letter.department;
            employee.department = letter.department;
          }
        } else if (letter.templateType === 'termination') {
          employee.civilServantRole = '';
          employee.position = '';
        }
        await employee.save();
        console.log(`[HR Sync] Updated employee ${employee._id} based on newly created Letter ${letter._id}`);
      }
    }

    console.log('[POST /api/letters] Saved letter with type:', letter.type, '_id:', letter._id);
    res.status(201).json(letter);
  } catch (err) {
    console.error('[POST /api/letters] Error:', err);
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

    let allowed = false;

    // If admin or owner, allow full update
    if (isAdmin || isOwner) {
      Object.assign(letter, req.body);
      allowed = true;
    } else {
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
      Object.assign(letter, incoming);
      allowed = true;
    }

    if (allowed) {
      await letter.save();

      // Automate HR update if status is 'completed' and it's an appointment, termination, or adjustment
      if (letter.status === 'completed' && ['appointment', 'termination', 'adjustment'].includes(letter.templateType) && letter.officerId) {
        const query = { 
          $or: [{ staffId: letter.officerId }, { civilServantId: letter.officerId }, { cardNumber: letter.officerId }, { nationalId: letter.officerId }] 
        };
        const employee = await HR.findOne(query);
        
        if (employee) {
          if (letter.templateType === 'appointment' || letter.templateType === 'adjustment') {
            if (letter.newRole) {
              employee.civilServantRole = letter.newRole;
              employee.position = letter.newRole;
            }
            if (letter.department) {
              employee.Department_Kh = letter.department;
              employee.department = letter.department;
            }
          } else if (letter.templateType === 'termination') {
            employee.civilServantRole = '';
            employee.position = '';
            // we leave department as is, or maybe clear it? The user specifically asked to clear roles.
          }
          await employee.save();
          console.log(`[HR Sync] Updated employee ${employee._id} based on Letter ${letter._id}`);
        }
      }

      return res.json(letter);
    }
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
    letter.status = 'completed'; // Ensure status matches the new dropdown
    letter.approvedByAdminId = req.auth.user._id;
    letter.approvedAt = new Date();
    await letter.save();

    // Automate HR update if it's an appointment, termination, or adjustment
    if (['appointment', 'termination', 'adjustment'].includes(letter.templateType) && letter.officerId) {
      const query = { 
        $or: [{ staffId: letter.officerId }, { civilServantId: letter.officerId }, { cardNumber: letter.officerId }, { nationalId: letter.officerId }] 
      };
      const employee = await HR.findOne(query);
      
      if (employee) {
        if (letter.templateType === 'appointment' || letter.templateType === 'adjustment') {
          if (letter.newRole) {
            employee.civilServantRole = letter.newRole;
            employee.position = letter.newRole;
          }
          if (letter.department) {
            employee.Department_Kh = letter.department;
            employee.department = letter.department;
          }
        } else if (letter.templateType === 'termination') {
          employee.civilServantRole = '';
          employee.position = '';
        }
        await employee.save();
        console.log(`[HR Sync] Updated employee ${employee._id} based on Admin Approval of Letter ${letter._id}`);
      }
    }

    res.json({ message: 'Approved', letter });
  } catch (err) {
    next(err);
  }
});

export default router;
