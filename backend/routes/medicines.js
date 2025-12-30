const express = require('express');
const router = express.Router();
const { centralizedPool } = require('../config/database');

// Get all medicines with optional search and filters
router.get('/', async (req, res) => {
  try {
    const { search, category, manufacturer, minPrice, maxPrice, page = 1, limit = 20 } = req.query;

    let query = 'SELECT * FROM medicines WHERE 1=1';
    const params = [];

    // Search filter
    if (search) {
      query += ' AND (product_name LIKE ? OR generic_name LIKE ? OR reg_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Category filter
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    // Manufacturer filter
    if (manufacturer) {
      query += ' AND manufacturer = ?';
      params.push(manufacturer);
    }

    // Price range filter
    if (minPrice) {
      query += ' AND price_rs >= ?';
      params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      query += ' AND price_rs <= ?';
      params.push(parseFloat(maxPrice));
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await centralizedPool.query(countQuery, params);
    const total = countResult[0].total;

    // Pagination
    query += ' ORDER BY product_name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const [medicines] = await centralizedPool.query(query, params);

    res.json({
      medicines,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching medicines:', error);
    res.status(500).json({ error: 'Error fetching medicines', message: error.message });
  }
});

// Get single medicine by registration number
router.get('/:regNumber', async (req, res) => {
  try {
    const [medicines] = await centralizedPool.query(
      'SELECT * FROM medicines WHERE reg_number = ?',
      [req.params.regNumber]
    );

    if (medicines.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    res.json(medicines[0]);
  } catch (error) {
    console.error('Error fetching medicine:', error);
    res.status(500).json({ error: 'Error fetching medicine', message: error.message });
  }
});

module.exports = router;

