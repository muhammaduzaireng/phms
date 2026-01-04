const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { usersPool } = require('../config/database');

// Get purchase orders (requires authentication)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 50 } = req.query;

    let query = 'SELECT * FROM purchase_orders WHERE user_id = ?';
    const params = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const [orders] = await usersPool.query(query, params);

    // Get items for each order
    for (const order of orders) {
      const [items] = await usersPool.query(
        'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOrders = orders.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      orders: paginatedOrders,
      total: orders.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(orders.length / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Error fetching purchase orders', message: error.message });
  }
});

// Get single purchase order (requires authentication)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [orders] = await usersPool.query(
      'SELECT * FROM purchase_orders WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const [items] = await usersPool.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
      [req.params.id]
    );

    orders[0].items = items;
    res.json(orders[0]);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Error fetching purchase order', message: error.message });
  }
});

// Create purchase order (requires authentication)
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, supplierName, supplierContact, expectedDate, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const [orderResult] = await usersPool.query(
      `INSERT INTO purchase_orders 
      (user_id, po_number, supplier_name, supplier_contact, expected_date, notes, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, poNumber, supplierName, supplierContact || null, expectedDate || null, notes || null, subtotal]
    );

    const orderId = orderResult.insertId;

    // Insert items
    for (const item of items) {
      await usersPool.query(
        `INSERT INTO purchase_order_items 
        (purchase_order_id, medicine_reg_number, custom_product_id, item_name, quantity, price, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.medicineRegNumber || null,
          item.customProductId || null,
          item.name,
          item.quantity,
          item.price,
          item.price * item.quantity
        ]
      );
    }

    const [order] = await usersPool.query('SELECT * FROM purchase_orders WHERE id = ?', [orderId]);
    const [orderItems] = await usersPool.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [orderId]);

    order[0].items = orderItems;
    res.json({ success: true, order: order[0] });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Error creating purchase order', message: error.message });
  }
});

// Update purchase order status (requires authentication)
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, receivedDate } = req.body;

    const validStatuses = ['pending', 'approved', 'received', 'cancelled', 'returned', 'partial'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };
    if (status === 'received' && receivedDate) {
      updateData.received_date = receivedDate;
    }

    await usersPool.query(
      `UPDATE purchase_orders SET status = ?, received_date = ? WHERE id = ? AND user_id = ?`,
      [status, receivedDate || null, req.params.id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({ error: 'Error updating purchase order status', message: error.message });
  }
});

module.exports = router;

