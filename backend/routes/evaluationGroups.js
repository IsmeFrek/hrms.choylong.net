import express from 'express';
import EvaluationGroup from '../models/EvaluationGroup.js';
const router = express.Router();

// Get all groups
router.get('/', async (req, res) => {
  try {
    const groups = await EvaluationGroup.find().sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create or Update a group
router.post('/', async (req, res) => {
  const { name, members, description } = req.body;
  try {
    let group = await EvaluationGroup.findOne({ name });
    if (group) {
      group.members = members;
      group.description = description;
      await group.save();
    } else {
      group = new EvaluationGroup({ name, members, description });
      await group.save();
    }
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a group
router.delete('/:name', async (req, res) => {
  try {
    await EvaluationGroup.findOneAndDelete({ name: req.params.name });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
