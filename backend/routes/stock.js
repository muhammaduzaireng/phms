const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { usersPool, centralizedPool } = require('../config/database');

// Stock summary for a user (requires authentication)
// Returns counts + total stock value (purchase & selling)
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await usersPool.query(
      `
      SELECT
        COUNT(*) AS total_rows,
        COUNT(*) AS total_products,
        SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END) AS products_in_stock_rows,
        COUNT(DISTINCT CASE WHEN quantity > 0 AND medicine_reg_number IS NOT NULL THEN medicine_reg_number END) AS medicines_in_stock,
        COUNT(DISTINCT CASE WHEN quantity > 0 AND custom_product_id IS NOT NULL THEN custom_product_id END) AS custom_products_in_stock,
        SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) AS total_units_in_stock,
        SUM(CASE WHEN quantity > 0 THEN quantity * COALESCE(purchase_price, 0) ELSE 0 END) AS total_purchase_value,
        SUM(CASE WHEN quantity > 0 THEN quantity * COALESCE(unit_price, 0) ELSE 0 END) AS total_selling_value
      FROM stock
      WHERE user_id = ? AND is_deleted = FALSE AND quantity > 0
      `,
      [userId]
    );

    const r = rows?.[0] || {};
    res.json({
      total_products: parseInt(r.medicines_in_stock || 0, 10) + parseInt(r.custom_products_in_stock || 0, 10),
      medicines_in_stock: parseInt(r.medicines_in_stock || 0, 10),
      custom_products_in_stock: parseInt(r.custom_products_in_stock || 0, 10),
      total_units_in_stock: parseInt(r.total_units_in_stock || 0, 10),
      total_purchase_value: parseFloat(r.total_purchase_value || 0),
      total_selling_value: parseFloat(r.total_selling_value || 0)
    });
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({ error: 'Error fetching stock summary', message: error.message });
  }
});

// Get stock for a user (requires authentication)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineRegNumber, customProductId, page = 1, limit = 50, sortBy = 'low_stock_first' } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Build base query with JOINs to avoid N+1 queries
    // Note: medicines table is in centralized DB, so we'll fetch those separately in batch
    let stockQuery = `
      SELECT 
        s.*,
        cp.name as custom_product_name
      FROM stock s
      LEFT JOIN custom_products cp ON s.custom_product_id = cp.id AND cp.user_id = ?
      WHERE s.user_id = ? AND s.is_deleted = FALSE AND s.quantity > 0
    `;
    const stockParams = [userId, userId];

    if (medicineRegNumber) {
      stockQuery += ' AND s.medicine_reg_number = ?';
      stockParams.push(medicineRegNumber);
    }

    if (customProductId) {
      stockQuery += ' AND s.custom_product_id = ?';
      stockParams.push(customProductId);
    }

    // Sorting: low stock first, then by product name
    if (sortBy === 'low_stock_first') {
      stockQuery += ` ORDER BY 
        CASE WHEN s.quantity <= s.min_stock_level AND s.min_stock_level > 0 THEN 0 ELSE 1 END,
        cp.name ASC,
        s.created_at ASC`;
    } else if (sortBy === 'name') {
      stockQuery += ' ORDER BY cp.name ASC, s.created_at ASC';
    } else {
      stockQuery += ' ORDER BY s.created_at ASC';
    }

    // Get total count for pagination
    const countQuery = stockQuery.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await usersPool.query(countQuery, stockParams);
    const total = countResult[0]?.total || 0;

    // Add pagination
    stockQuery += ` LIMIT ? OFFSET ?`;
    stockParams.push(limitNum, offset);

    const [stock] = await usersPool.query(stockQuery, stockParams);

    // Fetch medicine names in batch to avoid N+1 queries
    const medicineRegNumbers = [...new Set(stock.filter(s => s.medicine_reg_number).map(s => s.medicine_reg_number))];
    const medicineNamesMap = {};
    
    if (medicineRegNumbers.length > 0) {
      // Query in chunks to avoid query size limits
      const chunkSize = 500;
      for (let i = 0; i < medicineRegNumbers.length; i += chunkSize) {
        const chunk = medicineRegNumbers.slice(i, i + chunkSize);
        try {
          const [medicines] = await centralizedPool.query(
            'SELECT reg_number, product_name FROM medicines WHERE reg_number IN (?)',
            [chunk]
          );
          medicines.forEach(m => {
            medicineNamesMap[m.reg_number] = m.product_name;
          });
        } catch (err) {
          console.error('Error fetching medicine names:', err);
        }
      }
    }

    // Enrich stock with medicine names
    const enrichedStock = stock.map(item => ({
      ...item,
      medicine_name: item.medicine_reg_number ? (medicineNamesMap[item.medicine_reg_number] || null) : null
    }));

    res.json({
      stock: enrichedStock,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Error fetching stock', message: error.message });
  }
});

// Update stock - Always creates a new batch (requires authentication)
// This allows multiple batches per product
router.post('/update', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { medicineRegNumber, customProductId, quantity, minStockLevel, maxStockLevel, unitPrice, purchasePrice, expiryDate, batchNumber, location, stockId } = req.body;

    // If stockId is provided, update that specific batch (for editing existing batch)
    if (stockId) {
      const [existing] = await usersPool.query(
        'SELECT * FROM stock WHERE id = ? AND user_id = ? AND is_deleted = FALSE',
        [stockId, userId]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Stock batch not found' });
      }

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
        [quantity, minStockLevel, maxStockLevel, unitPrice, purchasePrice || 0, expiryDate, batchNumber, location, stockId]
      );
      res.json({ success: true, id: stockId });
    } else {
      // Create new batch (always create new batch, don't merge with existing)
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

    // Get low stock items (only non-deleted with quantity > 0)
    // Batches with 0 quantity don't appear in low stock either
    const [stock] = await usersPool.query(
      `SELECT * FROM stock WHERE user_id = ? AND is_deleted = FALSE AND quantity > 0 AND quantity <= min_stock_level`,
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

// Delete stock batch (soft delete - requires comment)
router.post('/delete', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { stockId, comment } = req.body;

    if (!stockId) {
      return res.status(400).json({ error: 'Stock ID is required' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Deletion comment is required' });
    }

    // Soft delete: mark as deleted with comment
    await usersPool.query(
      `UPDATE stock SET 
        is_deleted = TRUE,
        deletion_comment = ?,
        deleted_at = NOW()
      WHERE id = ? AND user_id = ? AND is_deleted = FALSE`,
      [comment.trim(), stockId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stock:', error);
    res.status(500).json({ error: 'Error deleting stock', message: error.message });
  }
});

module.exports = router;

