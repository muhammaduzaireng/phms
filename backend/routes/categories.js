const express = require('express');
const router = express.Router();
const { centralizedPool } = require('../config/database');

// Get all unique categories
router.get('/', async (req, res) => {
  try {
    const [categories] = await centralizedPool.query(
      'SELECT DISTINCT name FROM categories ORDER BY name'
    );
    res.json(categories.map(c => c.name));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Error fetching categories', message: error.message });
  }
});

module.exports = router;

