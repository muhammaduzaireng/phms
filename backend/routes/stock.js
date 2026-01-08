const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { usersPool, centralizedPool } = require('../config/database');

// Get stock for a user (requires authentication)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineRegNumber, customProductId } = req.query;

    // Get stock from users database
    let stockQuery = 'SELECT * FROM stock WHERE user_id = ?';
    const stockParams = [userId];

    if (medicineRegNumber) {
      stockQuery += ' AND medicine_reg_number = ?';
      stockParams.push(medicineRegNumber);
    }

    if (customProductId) {
      stockQuery += ' AND custom_product_id = ?';
      stockParams.push(customProductId);
    }

    const [stock] = await usersPool.query(stockQuery, stockParams);

    // Enrich stock data with medicine and custom product names
    const enrichedStock = await Promise.all(stock.map(async (item) => {
      let medicineName = null;
      let customProductName = null;

      // Get medicine name from centralized database
      if (item.medicine_reg_number) {
        try {
          const [medicines] = await centralizedPool.query(
            'SELECT product_name FROM medicines WHERE reg_number = ?',
            [item.medicine_reg_number]
          );
          if (medicines.length > 0) {
            medicineName = medicines[0].product_name;
          }
        } catch (err) {
          // Medicine not found in centralized DB, continue
        }
      }

      // Get custom product name from users database
      if (item.custom_product_id) {
        try {
          const [customProducts] = await usersPool.query(
            'SELECT name FROM custom_products WHERE id = ? AND user_id = ?',
            [item.custom_product_id, userId]
          );
          if (customProducts.length > 0) {
            customProductName = customProducts[0].name;
          }
        } catch (err) {
          // Custom product not found, continue
        }
      }

      return {
        ...item,
        medicine_name: medicineName,
        custom_product_name: customProductName
      };
    }));

    res.json(enrichedStock);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Error fetching stock', message: error.message });
  }
});

// Update stock (requires authentication)
router.post('/update', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineRegNumber, customProductId, quantity, minStockLevel, maxStockLevel, unitPrice, purchasePrice, expiryDate, batchNumber, location } = req.body;

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
          purchase_price = ?,
          expiry_date = ?,
          batch_number = ?,
          location = ?
        WHERE id = ?`,
        [quantity, minStockLevel, maxStockLevel, unitPrice, purchasePrice || 0, expiryDate, batchNumber, location, existing[0].id]
      );
      res.json({ success: true, id: existing[0].id });
    } else {
      // Create new
      const [result] = await usersPool.query(
        `INSERT INTO stock 
        (user_id, medicine_reg_number, custom_product_id, quantity, min_stock_level, max_stock_level, unit_price, purchase_price, expiry_date, batch_number, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, medicineRegNumber || null, customProductId || null, quantity, minStockLevel, maxStockLevel, unitPrice, purchasePrice || 0, expiryDate, batchNumber, location]
      );
      res.json({ success: true, id: result.insertId });
    }
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Error updating stock', message: error.message });
  }
});

// Get low stock items (requires authentication)
router.get('/low-stock', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get low stock items
    const [stock] = await usersPool.query(
      `SELECT * FROM stock WHERE user_id = ? AND quantity <= min_stock_level`,
      [userId]
    );

    // Enrich with product names
    const enrichedStock = await Promise.all(stock.map(async (item) => {
      let productName = null;

      if (item.medicine_reg_number) {
        try {
          const [medicines] = await centralizedPool.query(
            'SELECT product_name FROM medicines WHERE reg_number = ?',
            [item.medicine_reg_number]
          );
          if (medicines.length > 0) {
            productName = medicines[0].product_name;
          }
        } catch (err) {
          // Medicine not found
        }
      }

      if (item.custom_product_id && !productName) {
        try {
          const [customProducts] = await usersPool.query(
            'SELECT name FROM custom_products WHERE id = ? AND user_id = ?',
            [item.custom_product_id, userId]
          );
          if (customProducts.length > 0) {
            productName = customProducts[0].name;
          }
        } catch (err) {
          // Custom product not found
        }
      }

      return {
        ...item,
        product_name: productName
      };
    }));

    res.json(enrichedStock);
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ error: 'Error fetching low stock', message: error.message });
  }
});

module.exports = router;

