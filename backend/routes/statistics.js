const express = require('express');
const router = express.Router();
const { centralizedPool } = require('../config/database');

// Get statistics
router.get('/', async (req, res) => {
  try {
    const [totalResult] = await centralizedPool.query('SELECT COUNT(*) as total FROM medicines');
    const [categoryResult] = await centralizedPool.query('SELECT COUNT(*) as total FROM categories');
    const [manufacturerResult] = await centralizedPool.query('SELECT COUNT(*) as total FROM manufacturers');
    const [priceResult] = await centralizedPool.query(
      'SELECT AVG(price_rs) as avg, MIN(price_rs) as min, MAX(price_rs) as max FROM medicines'
    );

    const stats = {
      totalMedicines: totalResult[0].total,
      totalCategories: categoryResult[0].total,
      totalManufacturers: manufacturerResult[0].total,
      averagePrice: parseFloat(priceResult[0].avg) || 0,
      minPrice: parseFloat(priceResult[0].min) || 0,
      maxPrice: parseFloat(priceResult[0].max) || 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Error fetching statistics', message: error.message });
  }
});

module.exports = router;

