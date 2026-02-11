const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { usersPool } = require('../config/database');

// Create sale/checkout (requires authentication)
router.post('/checkout', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, customerName, customerPhone, paymentMethod, discount = 0, tax = 0 } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = (subtotal * discount) / 100;
    const taxAmount = (subtotal * tax) / 100;
    const total = subtotal - discountAmount + taxAmount;

    // Generate unique transaction ID: TXN-YYYYMMDD-HHMMSS-XXXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0,8).replace(/:/g, '');
    const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
    const transactionId = `TXN-${dateStr}-${timeStr}-${randomStr}`;

    const [saleResult] = await usersPool.query(
      `INSERT INTO sales 
      (user_id, transaction_id, customer_name, customer_phone, subtotal, discount_amount, discount_percent, tax_amount, tax_percent, total, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, transactionId, customerName || 'Walk-in Customer', customerPhone || null, subtotal, discountAmount, discount, taxAmount, tax, total, paymentMethod || 'cash']
    );

    const saleId = saleResult.insertId;

    // Track low stock alerts and profit
    const lowStockAlerts = [];
    let totalProfit = 0;

    // Insert items and update stock
    for (const item of items) {
      // Determine if this is a medicine or custom product
      // Custom products have reg_number like "CUST-123" or explicit customProductId
      const isCustomProduct = item.customProductId || (item.reg_number && String(item.reg_number).startsWith('CUST-'));
      const customProductId = item.customProductId || (item.reg_number && String(item.reg_number).startsWith('CUST-') ? parseInt(String(item.reg_number).replace('CUST-', '')) : null);
      const medicineRegNumber = item.reg_number && !String(item.reg_number).startsWith('CUST-') ? item.reg_number : null;
      
      // Get all stock batches for this product (FIFO - oldest first)
      let stockBatches = [];
      let latestBatch = null;
      if (medicineRegNumber) {
        const [stock] = await usersPool.query(
          'SELECT id, quantity, min_stock_level, purchase_price, unit_price, created_at FROM stock WHERE user_id = ? AND medicine_reg_number = ? AND is_deleted = FALSE ORDER BY created_at ASC',
          [userId, medicineRegNumber]
        );
        stockBatches = stock || [];
        // Get latest batch for sell price (most recent created_at)
        if (stockBatches.length > 0) {
          latestBatch = stockBatches.reduce((latest, batch) => {
            return new Date(batch.created_at) > new Date(latest.created_at) ? batch : latest;
          }, stockBatches[0]);
        }
      } else if (customProductId) {
        const [stock] = await usersPool.query(
          'SELECT id, quantity, min_stock_level, purchase_price, unit_price, created_at FROM stock WHERE user_id = ? AND custom_product_id = ? AND is_deleted = FALSE ORDER BY created_at ASC',
          [userId, customProductId]
        );
        stockBatches = stock || [];
        // Get latest batch for sell price
        if (stockBatches.length > 0) {
          latestBatch = stockBatches.reduce((latest, batch) => {
            return new Date(batch.created_at) > new Date(latest.created_at) ? batch : latest;
          }, stockBatches[0]);
        }
      }

      // Calculate profit using weighted average purchase price from batches being sold
      const sellPrice = parseFloat(item.price) || 0;
      let remainingQuantity = item.quantity;
      let totalPurchaseValue = 0;
      let totalPurchaseQuantity = 0;

      // Sell from batches using FIFO (First In First Out)
      const batchesToUpdate = [];
      for (const batch of stockBatches) {
        if (remainingQuantity <= 0) break;
        
        const batchQuantity = parseInt(batch.quantity) || 0;
        if (batchQuantity <= 0) continue; // Skip empty batches

        const quantityFromBatch = Math.min(remainingQuantity, batchQuantity);
        const batchPurchasePrice = parseFloat(batch.purchase_price) || 0;
        
        totalPurchaseValue += batchPurchasePrice * quantityFromBatch;
        totalPurchaseQuantity += quantityFromBatch;
        
        batchesToUpdate.push({
          id: batch.id,
          currentQuantity: batchQuantity,
          quantityToDeduct: quantityFromBatch,
          minStockLevel: batch.min_stock_level
        });
        
        remainingQuantity -= quantityFromBatch;
      }

      // Calculate average purchase price for profit calculation
      const avgPurchasePrice = totalPurchaseQuantity > 0 ? totalPurchaseValue / totalPurchaseQuantity : 0;
      const profitPerUnit = sellPrice - avgPurchasePrice;

      // Create sales_items record for each batch (to track which batch items came from for returns)
      for (const batchUpdate of batchesToUpdate) {
        const batchProfit = profitPerUnit * batchUpdate.quantityToDeduct;
        totalProfit += batchProfit;

        // Insert sales item with batch tracking
        await usersPool.query(
          `INSERT INTO sales_items 
          (sale_id, medicine_reg_number, custom_product_id, item_name, quantity, price, total, purchase_price, profit, stock_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            medicineRegNumber,
            customProductId,
            item.product_name || item.name,
            batchUpdate.quantityToDeduct, // Quantity from this batch
            item.price,
            item.price * batchUpdate.quantityToDeduct,
            avgPurchasePrice,
            batchProfit,
            batchUpdate.id // Track which batch this came from
          ]
        );
      }

      // Update stock batches (FIFO - oldest batches first)
      let stockUpdated = false;
      for (const batchUpdate of batchesToUpdate) {
        const newQuantity = Math.max(0, batchUpdate.currentQuantity - batchUpdate.quantityToDeduct);
        
        await usersPool.query(
          'UPDATE stock SET quantity = ? WHERE id = ?',
          [newQuantity, batchUpdate.id]
        );
        stockUpdated = true;
        
        // Check if stock is now low
        if (newQuantity <= (batchUpdate.minStockLevel || 0)) {
          lowStockAlerts.push({
            product_name: item.product_name || item.name,
            reg_number: medicineRegNumber,
            custom_product_id: customProductId,
            current_quantity: newQuantity,
            min_stock_level: batchUpdate.minStockLevel || 0,
            batch_id: batchUpdate.id
          });
        }
      }

      // If we couldn't fulfill from existing batches, create negative stock record and sales_item
      if (remainingQuantity > 0) {
        let newStockId = null;
        if (medicineRegNumber) {
          const [stockResult] = await usersPool.query(
            `INSERT INTO stock (user_id, medicine_reg_number, quantity, min_stock_level, unit_price, purchase_price)
             VALUES (?, ?, ?, 0, ?, 0)`,
            [userId, medicineRegNumber, -remainingQuantity, item.price, 0]
          );
          newStockId = stockResult.insertId;
          stockUpdated = true;
        } else if (customProductId) {
          const [stockResult] = await usersPool.query(
            `INSERT INTO stock (user_id, custom_product_id, quantity, min_stock_level, unit_price, purchase_price)
             VALUES (?, ?, ?, 0, ?, 0)`,
            [userId, customProductId, -remainingQuantity, item.price, 0]
          );
          newStockId = stockResult.insertId;
          stockUpdated = true;
        }

        // Create sales_item for oversold quantity (no batch_id since it's a new negative stock)
        const oversoldProfit = profitPerUnit * remainingQuantity;
        totalProfit += oversoldProfit;
        await usersPool.query(
          `INSERT INTO sales_items 
          (sale_id, medicine_reg_number, custom_product_id, item_name, quantity, price, total, purchase_price, profit, stock_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            medicineRegNumber,
            customProductId,
            item.product_name || item.name,
            remainingQuantity,
            item.price,
            item.price * remainingQuantity,
            avgPurchasePrice,
            oversoldProfit,
            newStockId // Track the negative stock batch
          ]
        );
      }
      
      if (!stockUpdated && stockBatches.length === 0) {
        console.warn(`[Stock Update] Could not update stock for item: ${item.product_name || item.name} - missing identifiers`);
      }
    }

    // Update sale with total profit
    await usersPool.query(
      'UPDATE sales SET profit = ? WHERE id = ?',
      [totalProfit, saleId]
    );

    // Store/update daily profit for this pharmacy
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const [dailyProfit] = await usersPool.query(
        'SELECT * FROM daily_profits WHERE user_id = ? AND date = ?',
        [userId, today]
      );

      if (dailyProfit.length > 0) {
        // Update existing daily profit
        await usersPool.query(
          'UPDATE daily_profits SET total_profit = total_profit + ?, total_sales = total_sales + 1 WHERE id = ?',
          [totalProfit, dailyProfit[0].id]
        );
      } else {
        // Create new daily profit record
        await usersPool.query(
          `INSERT INTO daily_profits (user_id, date, total_profit, total_sales)
           VALUES (?, ?, ?, 1)`,
          [userId, today, totalProfit]
        );
      }
    } catch (dailyProfitError) {
      // If daily_profits table doesn't exist yet, just log the error and continue
      console.warn('Daily profit tracking failed (table may not exist yet):', dailyProfitError.message);
    }

    const [sale] = await usersPool.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    
    if (!sale || sale.length === 0) {
      return res.status(500).json({ error: 'Sale was created but could not be retrieved' });
    }
    
    const [saleItems] = await usersPool.query('SELECT * FROM sales_items WHERE sale_id = ?', [saleId]);

    // Build transaction object with all required fields
    const transaction = {
      id: sale[0].transaction_id || sale[0].id.toString(), // Use transaction_id as primary ID
      transaction_id: sale[0].transaction_id,
      transactionId: sale[0].transaction_id,
      sale_id: sale[0].id, // Database ID
      date: sale[0].created_at || new Date().toISOString(),
      created_at: sale[0].created_at,
      items: saleItems.map(item => ({
        ...item,
        product_name: item.item_name,
        reg_number: item.medicine_reg_number,
        quantity: item.quantity,
        price: parseFloat(item.price),
        total: parseFloat(item.total),
        purchase_price: parseFloat(item.purchase_price || 0),
        profit: parseFloat(item.profit || 0)
      })),
      payment: {
        method: sale[0].payment_method,
        subtotal: parseFloat(sale[0].subtotal),
        discount: parseFloat(sale[0].discount_amount),
        discountPercent: parseFloat(sale[0].discount_percent),
        tax: parseFloat(sale[0].tax_amount),
        taxPercent: parseFloat(sale[0].tax_percent),
        total: parseFloat(sale[0].total)
      },
      customer: {
        name: sale[0].customer_name,
        phone: sale[0].customer_phone
      },
      profit: parseFloat(totalProfit),
      offline: false,
      saved: true
    };

    res.json({ 
      success: true, 
      transaction: transaction,
      low_stock_alerts: lowStockAlerts.length > 0 ? lowStockAlerts : null,
      profit: parseFloat(totalProfit)
    });
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.status(500).json({ error: 'Error processing checkout', message: error.message });
  }
});

// Get sales/transactions (requires authentication)
// Optimized: Defaults to today's sales, lazy loads items, uses pagination
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, page = 1, limit = 50, includeItems = 'false' } = req.query;

    // Default to today's date if no dates provided
    const today = new Date().toISOString().split('T')[0];
    const defaultStartDate = startDate || today;
    const defaultEndDate = endDate || today;

    let query = 'SELECT * FROM sales WHERE user_id = ?';
    const params = [userId];

    // Always filter by date range (defaults to today)
    query += ' AND DATE(created_at) >= ? AND DATE(created_at) <= ?';
    params.push(defaultStartDate, defaultEndDate);

    query += ' ORDER BY created_at DESC';

    // Apply pagination at database level
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    query += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [sales] = await usersPool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM sales WHERE user_id = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?';
    const countParams = [userId, defaultStartDate, defaultEndDate];
    const [countResult] = await usersPool.query(countQuery, countParams);
    const total = countResult[0].total;

    // Get item counts in batch (much faster than individual queries)
    const saleIds = sales.map(s => s.id);
    let itemCountsMap = {};
    if (saleIds.length > 0) {
      const placeholders = saleIds.map(() => '?').join(',');
      const [itemCounts] = await usersPool.query(
        `SELECT sale_id, COUNT(*) as item_count FROM sales_items WHERE sale_id IN (${placeholders}) GROUP BY sale_id`,
        saleIds
      );
      itemCounts.forEach(count => {
        itemCountsMap[count.sale_id] = parseInt(count.item_count);
      });
    }

    // Transform sales data (NO items loaded by default - huge performance boost)
    const transactions = sales.map(sale => ({
      id: sale.transaction_id || sale.id,
      sale_id: sale.id,
      date: sale.created_at || sale.sale_date,
      created_at: sale.created_at,
      customer: {
        name: sale.customer_name || 'Walk-in Customer',
        phone: sale.customer_phone || null
      },
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      payment: {
        method: sale.payment_method || 'cash',
        subtotal: parseFloat(sale.subtotal || 0),
        discount: parseFloat(sale.discount_amount || 0),
        tax: parseFloat(sale.tax_amount || 0),
        total: parseFloat(sale.total || 0)
      },
      payment_method: sale.payment_method,
      subtotal: parseFloat(sale.subtotal || 0),
      discount_amount: parseFloat(sale.discount_amount || 0),
      tax_amount: parseFloat(sale.tax_amount || 0),
      total_amount: parseFloat(sale.total || 0),
      total: parseFloat(sale.total || 0),
      items_count: itemCountsMap[sale.id] || 0,
      items: [] // Empty by default - loaded on demand
    }));

    res.json({
      transactions: transactions,
      total: total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      startDate: defaultStartDate,
      endDate: defaultEndDate
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Error fetching sales', message: error.message });
  }
});

// Get transaction items (lazy loading - requires authentication)
router.get('/transaction/:saleId/items', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { saleId } = req.params;

    // Verify the sale belongs to the user
    const [sales] = await usersPool.query(
      'SELECT id FROM sales WHERE id = ? AND user_id = ?',
      [saleId, userId]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get items for this sale
    const [items] = await usersPool.query(
      'SELECT * FROM sales_items WHERE sale_id = ?',
      [saleId]
    );

    const formattedItems = items.map(item => ({
      ...item,
      product_name: item.item_name || item.product_name,
      name: item.item_name || item.product_name,
      quantity: item.quantity || item.qty,
      qty: item.quantity || item.qty,
      price: parseFloat(item.price || item.unit_price || 0),
      unit_price: parseFloat(item.price || item.unit_price || 0),
      total: parseFloat(item.total || item.subtotal || 0),
      subtotal: parseFloat(item.total || item.subtotal || 0)
    }));

    res.json({ items: formattedItems });
  } catch (error) {
    console.error('Error fetching transaction items:', error);
    res.status(500).json({ error: 'Error fetching transaction items', message: error.message });
  }
});

// Get sales statistics (requires authentication)
router.get('/sales-stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Don't filter by status - include all sales (status column might not exist or might be null)
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

// Get daily profit for a pharmacy (requires authentication)
router.get('/daily-profit', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let query = 'SELECT * FROM daily_profits WHERE user_id = ?';
    const params = [userId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';

    const [profits] = await usersPool.query(query, params);

    res.json(profits);
  } catch (error) {
    console.error('Error fetching daily profit:', error);
    res.status(500).json({ error: 'Error fetching daily profit', message: error.message });
  }
});

module.exports = router;

