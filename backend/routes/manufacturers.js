const express = require('express');
const router = express.Router();
const { centralizedPool } = require('../config/database');

// Get all unique manufacturers
router.get('/', async (req, res) => {
  try {
    const [manufacturers] = await centralizedPool.query(
      'SELECT DISTINCT name FROM manufacturers ORDER BY name'
    );
    res.json(manufacturers.map(m => m.name));
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ error: 'Error fetching manufacturers', message: error.message });
  }
});

module.exports = router;

