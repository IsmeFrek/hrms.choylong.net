import express from 'express';
import Position from '../models/Position.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Public route: return list of positions without requiring auth.
// Placed BEFORE router.use(authRequired) so it's accessible without token.
router.get('/public', async (req, res) => {
  try {
    const positions = await Position.find();
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authRequired);

// Get all positions
router.get('/', requirePermission('view:positions'), async (req, res) => {
  try {
    const positions = await Position.find();
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create position
router.post('/', requirePermission('edit:positions'), async (req, res) => {
  try {
    // Accept both new and legacy payload shapes
    const {
      Position_Id,
      Position_Kh,
      Position_En,
      Other
    } = req.body;

    const legacyId = req.body.positions_id || req.body.positions_Id;
    const legacyKh = req.body.positions_Kh;
    const legacyEn = req.body.positions_En;

    const payload = {
      Position_Id: Position_Id ?? legacyId,
      Position_Kh: Position_Kh ?? legacyKh,
      Position_En: Position_En ?? legacyEn,
      Other
    };

    const position = new Position(payload);
    await position.save();
    res.status(201).json(position);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete position
// Update position
router.put('/:id', requirePermission('edit:positions'), async (req, res) => {
  try {
    const {
      Position_Id,
      Position_Kh,
      Position_En,
      Other
    } = req.body;

    const legacyId = req.body.positions_id || req.body.positions_Id;
    const legacyKh = req.body.positions_Kh;
    const legacyEn = req.body.positions_En;

    const update = {
      ...(Position_Id ?? legacyId ? { Position_Id: Position_Id ?? legacyId } : {}),
      ...(Position_Kh ?? legacyKh ? { Position_Kh: Position_Kh ?? legacyKh } : {}),
      ...(Position_En ?? legacyEn ? { Position_En: Position_En ?? legacyEn } : {}),
      ...(typeof Other !== 'undefined' ? { Other } : {}),
    };

    const position = await Position.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );
    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }
    res.json(position);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete position
router.delete('/:id', requirePermission('edit:positions'), async (req, res) => {
  try {
    await Position.findByIdAndDelete(req.params.id);
    res.json({ message: 'Position deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
