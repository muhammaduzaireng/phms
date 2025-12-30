const express = require('express');
const router = express.Router();
const { usersPool } = require('../config/database');

// Get stock for a user
router.get('/', async (req, res) => {
  try {
    const { userId = 1, medicineRegNumber, customProductId } = req.query;

    let query = `
      SELECT s.*, 
        m.product_name as medicine_name,
        cp.name as custom_product_name
      FROM stock s
      LEFT JOIN medicines m ON s.medicine_reg_number = m.reg_number
      LEFT JOIN custom_products cp ON s.custom_product_id = cp.id
      WHERE s.user_id = ?
    `;
    const params = [userId];

    if (medicineRegNumber) {
      query += ' AND s.medicine_reg_number = ?';
      params.push(medicineRegNumber);
    }

    if (customProductId) {
      query += ' AND s.custom_product_id = ?';
      params.push(customProductId);
    }

    const [stock] = await usersPool.query(query, params);
    res.json(stock);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Error fetching stock', message: error.message });
  }
});

// Update stock
router.post('/update', async (req, res) => {
  try {
    const { userId = 1, medicineRegNumber, customProductId, quantity, minStockLevel, maxStockLevel, unitPrice, expiryDate, batchNumber, location } = req.body;

    // Check if stock record exists
    const [existing] = await usersPool.query(
      'SELECT * FROM stock WHERE user_id = ? AND (medicine_reg_number = ? OR custom_product_id = ?)',
      [userId, medicineRegNumber || null, customProductId || null]
    );

    if (existing.length > 0) {
      // Update existing
      await usersPool.query(
        `UPDATE stock SET 
          quantity = ?, 
          min_stock_level = ?,
          max_stock_level = ?,
          unit_price = ?,
          expiry_date = ?,
          batch_number = ?,
          location = ?
        WHERE id = ?`,
        [quantity, minStockLevel, maxStockLevel, unitPrice, expiryDate, batchNumber, location, existing[0].id]
      );
      res.json({ success: true, id: existing[0].id });
    } else {
      // Create new
      const [result] = await usersPool.query(
        `INSERT INTO stock 
        (user_id, medicine_reg_number, custom_product_id, quantity, min_stock_level, max_stock_level, unit_price, expiry_date, batch_number, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, medicineRegNumber || null, customProductId || null, quantity, minStockLevel, maxStockLevel, unitPrice, expiryDate, batchNumber, location]
      );
      res.json({ success: true, id: result.insertId });
    }
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Error updating stock', message: error.message });
  }
});

// Get low stock items
router.get('/low-stock', async (req, res) => {
  try {
    const { userId = 1 } = req.query;

    const [stock] = await usersPool.query(
      `SELECT s.*, 
        COALESCE(m.product_name, cp.name) as product_name
      FROM stock s
      LEFT JOIN medicines m ON s.medicine_reg_number = m.reg_number
      LEFT JOIN custom_products cp ON s.custom_product_id = cp.id
      WHERE s.user_id = ? AND s.quantity <= s.min_stock_level`,
      [userId]
    );

    res.json(stock);
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ error: 'Error fetching low stock', message: error.message });
  }
});

module.exports = router;

