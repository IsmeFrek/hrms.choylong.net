const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Simple endpoint to save schedule overrides to a JSON file in backend/public for demo
router.post('/', (req, res) => {
  try {
    const { overrides, month } = req.body || {};
    if (!overrides || typeof overrides !== 'object') return res.status(400).json({ error: 'Missing overrides' });
    const iso = month || (`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);
    const destDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const filename = path.join(destDir, `overrides-${iso}.json`);
    fs.writeFileSync(filename, JSON.stringify({ savedAt: new Date().toISOString(), overrides }, null, 2), 'utf8');
    return res.json({ ok: true, file: `/public/overrides-${iso}.json` });
  } catch (err) {
    console.error('Failed to save overrides', err);
    return res.status(500).json({ error: 'failed' });
  }
});

module.exports = router;
