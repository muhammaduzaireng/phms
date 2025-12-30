const express = require('express');
const router = express.Router();
const { usersPool } = require('../config/database');

// Create sale/checkout (accessible as /api/pos/checkout)
router.post('/checkout', async (req, res) => {
  try {
    const { userId = 1, items, customerName, customerPhone, paymentMethod, discount = 0, tax = 0 } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = (subtotal * discount) / 100;
    const taxAmount = (subtotal * tax) / 100;
    const total = subtotal - discountAmount + taxAmount;

    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const [saleResult] = await usersPool.query(
      `INSERT INTO sales 
      (user_id, transaction_id, customer_name, customer_phone, subtotal, discount_amount, discount_percent, tax_amount, tax_percent, total, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, transactionId, customerName || 'Walk-in Customer', customerPhone || null, subtotal, discountAmount, discount, taxAmount, tax, total, paymentMethod || 'cash']
    );

    const saleId = saleResult.insertId;

    // Insert items and update stock
    for (const item of items) {
      await usersPool.query(
        `INSERT INTO sales_items 
        (sale_id, medicine_reg_number, custom_product_id, item_name, quantity, price, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          item.reg_number || null,
          item.customProductId || null,
          item.product_name || item.name,
          item.quantity,
          item.price,
          item.price * item.quantity
        ]
      );

      // Update stock (decrease quantity)
      if (item.reg_number) {
        await usersPool.query(
          'UPDATE stock SET quantity = quantity - ? WHERE user_id = ? AND medicine_reg_number = ?',
          [item.quantity, userId, item.reg_number]
        );
      } else if (item.customProductId) {
        await usersPool.query(
          'UPDATE stock SET quantity = quantity - ? WHERE user_id = ? AND custom_product_id = ?',
          [item.quantity, userId, item.customProductId]
        );
      }
    }

    const [sale] = await usersPool.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    const [saleItems] = await usersPool.query('SELECT * FROM sales_items WHERE sale_id = ?', [saleId]);

    sale[0].items = saleItems.map(item => ({
      ...item,
      product_name: item.item_name,
      reg_number: item.medicine_reg_number,
      total: parseFloat(item.total)
    }));

    sale[0].payment = {
      method: sale[0].payment_method,
      subtotal: parseFloat(sale[0].subtotal),
      discount: parseFloat(sale[0].discount_amount),
      discountPercent: parseFloat(sale[0].discount_percent),
      tax: parseFloat(sale[0].tax_amount),
      taxPercent: parseFloat(sale[0].tax_percent),
      total: parseFloat(sale[0].total)
    };

    sale[0].customer = {
      name: sale[0].customer_name,
      phone: sale[0].customer_phone
    };

    res.json({ success: true, transaction: sale[0] });
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.status(500).json({ error: 'Error processing checkout', message: error.message });
  }
});

// Get sales/transactions (accessible as /api/pos/transactions)
router.get('/transactions', async (req, res) => {
  try {
    const { userId = 1, startDate, endDate, page = 1, limit = 50 } = req.query;

    let query = 'SELECT * FROM sales WHERE user_id = ?';
    const params = [userId];

    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC';

    const [sales] = await usersPool.query(query, params);

    // Get items for each sale
    for (const sale of sales) {
      const [items] = await usersPool.query(
        'SELECT * FROM sales_items WHERE sale_id = ?',
        [sale.id]
      );
      sale.items = items;
    }

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedSales = sales.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      transactions: paginatedSales,
      total: sales.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(sales.length / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Error fetching sales', message: error.message });
  }
});

// Get sales statistics (accessible as /api/pos/sales-stats)
router.get('/sales-stats', async (req, res) => {
  try {
    const { userId = 1, startDate, endDate } = req.query;

    let query = 'SELECT * FROM sales WHERE user_id = ? AND status = "completed"';
    const params = [userId];

    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }

    const [sales] = await usersPool.query(query, params);

    const stats = {
      totalTransactions: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + parseFloat(s.total), 0),
      totalItemsSold: 0,
      averageTransactionValue: sales.length > 0 
        ? sales.reduce((sum, s) => sum + parseFloat(s.total), 0) / sales.length 
        : 0,
      paymentMethods: {}
    };

    for (const sale of sales) {
      const [items] = await usersPool.query('SELECT SUM(quantity) as total FROM sales_items WHERE sale_id = ?', [sale.id]);
      stats.totalItemsSold += items[0].total || 0;

      const method = sale.payment_method;
      stats.paymentMethods[method] = (stats.paymentMethods[method] || 0) + 1;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching sales statistics:', error);
    res.status(500).json({ error: 'Error fetching sales statistics', message: error.message });
  }
});

module.exports = router;

