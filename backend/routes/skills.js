import express from 'express';
import Skill from '../models/Skill.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Public route: return list of skills without requiring auth.
// Placed BEFORE router.use(authRequired) so it's accessible without token.
router.get('/public', async (req, res) => {
  try {
    const skills = await Skill.find();
    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authRequired);

// Get all skills
router.get('/', requirePermission('view:skills'), async (req, res) => {
  try {
    const skills = await Skill.find();
    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create skill
router.post('/', requirePermission('edit:skills'), async (req, res) => {
  try {
    const { skills_Id, skills_Kh, ministryFunction, skills_En, other } = req.body;
    const skill = new Skill({ skills_Id, skills_Kh, ministryFunction, skills_En, other });
    await skill.save();
    res.status(201).json(skill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete skill
router.delete('/:id', requirePermission('edit:skills'), async (req, res) => {
  try {
    await Skill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Skill deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update skill
router.put('/:id', requirePermission('edit:skills'), async (req, res) => {
  try {
    const { skills_Id, skills_Kh, ministryFunction, skills_En, other } = req.body;
    const skill = await Skill.findByIdAndUpdate(
      req.params.id,
      { skills_Id, skills_Kh, ministryFunction, skills_En, other },
      { new: true, runValidators: true }
    );
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    res.json(skill);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
