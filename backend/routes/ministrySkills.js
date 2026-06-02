import express from 'express';
import MinistrySkill from '../models/MinistrySkill.js';
import { authRequired, requirePermission } from '../middleware/auth.js';

const router = express.Router();

router.use(authRequired);

// Get all ministry skills
router.get('/', requirePermission('view:skills'), async (req, res) => {
  try {
    const skills = await MinistrySkill.find();
    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create ministry skill
router.post('/', requirePermission('edit:skills'), async (req, res) => {
  try {
    const { ID_skills, ministryFunction, amount, total, male, female, other, Other } = req.body;
    const final_Other = Other || other;
    
    const existing = await MinistrySkill.findOne({ ID_skills });
    if (existing) {
      return res.status(400).json({ error: `លេខសម្គាល់ ${ID_skills} មានរួចហើយនៅក្នុងប្រព័ន្ធ` });
    }

    const skill = new MinistrySkill({ 
      ID_skills, 
      ministryFunction, 
      amount, 
      total,
      male,
      female,
      Other: final_Other 
    });
    await skill.save();
    res.status(201).json(skill);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: `លេខសម្គាល់ ${req.body.ID_skills} មានរួចហើយនៅក្នុងប្រព័ន្ធ` });
    }
    res.status(400).json({ error: err.message });
  }
});

// Delete ministry skill
router.delete('/:id', requirePermission('edit:skills'), async (req, res) => {
  try {
    await MinistrySkill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ministry Skill deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update ministry skill
router.put('/:id', requirePermission('edit:skills'), async (req, res) => {
  try {
    const { ID_skills, ministryFunction, amount, total, male, female, other, Other } = req.body;
    const final_Other = Other || other;
    
    const skill = await MinistrySkill.findByIdAndUpdate(
      req.params.id,
      { ID_skills, ministryFunction, amount, total, male, female, Other: final_Other },
      { new: true, runValidators: true }
    );
    if (!skill) {
      return res.status(404).json({ message: 'Ministry Skill not found' });
    }
    res.json(skill);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: `លេខសម្គាល់ ${req.body.ID_skills} មានរួចហើយនៅក្នុងប្រព័ន្ធ` });
    }
    res.status(400).json({ error: err.message });
  }
});

export default router;
