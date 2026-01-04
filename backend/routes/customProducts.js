const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { usersPool } = require('../config/database');

// Get custom products for a user (requires authentication)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [products] = await usersPool.query(
      'SELECT * FROM custom_products WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(products);
  } catch (error) {
    console.error('Error fetching custom products:', error);
    res.status(500).json({ error: 'Error fetching custom products', message: error.message });
  }
});

// Create custom product (requires authentication)
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, category, unit, barcode, price } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const [result] = await usersPool.query(
      `INSERT INTO custom_products 
      (user_id, name, description, category, unit, barcode, price)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, description || null, category || 'General', unit || 'piece', barcode || null, price]
    );

    const [product] = await usersPool.query('SELECT * FROM custom_products WHERE id = ?', [result.insertId]);
    res.json({ success: true, product: product[0] });
  } catch (error) {
    console.error('Error creating custom product:', error);
    res.status(500).json({ error: 'Error creating custom product', message: error.message });
  }
});

// Update custom product (requires authentication)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, category, unit, barcode, price } = req.body;

    await usersPool.query(
      `UPDATE custom_products SET 
        name = ?, description = ?, category = ?, unit = ?, barcode = ?, price = ?
      WHERE id = ? AND user_id = ?`,
      [name, description, category, unit, barcode, price, req.params.id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating custom product:', error);
    res.status(500).json({ error: 'Error updating custom product', message: error.message });
  }
});

// Delete custom product (requires authentication)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await usersPool.query(
      'DELETE FROM custom_products WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting custom product:', error);
    res.status(500).json({ error: 'Error deleting custom product', message: error.message });
  }
});

module.exports = router;

