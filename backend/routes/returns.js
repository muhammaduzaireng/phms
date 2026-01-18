const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { usersPool } = require('../config/database');

// Get transaction by transaction ID (for returns)
router.get('/transaction/:transactionId', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId } = req.params;

    // Find sale by transaction_id
    const [sales] = await usersPool.query(
      'SELECT * FROM sales WHERE user_id = ? AND transaction_id = ?',
      [userId, transactionId]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const sale = sales[0];

    // Get sale items
    const [items] = await usersPool.query(
      'SELECT * FROM sales_items WHERE sale_id = ?',
      [sale.id]
    );

    const transaction = {
      id: sale.transaction_id || sale.id,
      sale_id: sale.id,
      transaction_id: sale.transaction_id,
      date: sale.created_at || sale.sale_date,
      created_at: sale.created_at,
      customer: {
        name: sale.customer_name || 'Walk-in Customer',
        phone: sale.customer_phone || null
      },
      payment: {
        method: sale.payment_method || 'cash',
        subtotal: parseFloat(sale.subtotal || 0),
        discount: parseFloat(sale.discount_amount || 0),
        discountPercent: parseFloat(sale.discount_percent || 0),
        tax: parseFloat(sale.tax_amount || 0),
        taxPercent: parseFloat(sale.tax_percent || 0),
        total: parseFloat(sale.total || 0)
      },
      items: items.map(item => ({
        id: item.id,
        sale_item_id: item.id,
        product_name: item.item_name || item.product_name,
        reg_number: item.medicine_reg_number,
        custom_product_id: item.custom_product_id,
        quantity: item.quantity,
        returned_quantity: item.returned_quantity || 0,
        available_to_return: item.quantity - (item.returned_quantity || 0), // Quantity that can still be returned
        price: parseFloat(item.price || item.unit_price || 0),
        total: parseFloat(item.total || item.subtotal || 0)
      }))
    };

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Error fetching transaction', message: error.message });
  }
});

// Process return (create return record)
router.post('/process', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionId, items, reason } = req.body;

    if (!transactionId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Transaction ID and items are required' });
    }

    // Find the original sale
    const [sales] = await usersPool.query(
      'SELECT * FROM sales WHERE user_id = ? AND transaction_id = ?',
      [userId, transactionId]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const sale = sales[0];
    const saleId = sale.id;

    // Validate return items
    const [saleItems] = await usersPool.query(
      'SELECT * FROM sales_items WHERE sale_id = ?',
      [saleId]
    );

    const saleItemsMap = {};
    saleItems.forEach(item => {
      saleItemsMap[item.id] = item;
    });

    let totalReturnAmount = 0;
    const returnItemsToProcess = [];

    for (const returnItem of items) {
      const saleItem = saleItemsMap[returnItem.sale_item_id];
      if (!saleItem) {
        return res.status(400).json({ error: `Sale item ${returnItem.sale_item_id} not found` });
      }

      const alreadyReturned = saleItem.returned_quantity || 0;
      const availableToReturn = saleItem.quantity - alreadyReturned;
      
      if (returnItem.return_quantity > availableToReturn) {
        return res.status(400).json({ 
          error: `Cannot return ${returnItem.return_quantity} of ${saleItem.item_name}. Only ${availableToReturn} available to return.` 
        });
      }

      if (returnItem.return_quantity <= 0) {
        continue; // Skip items with 0 or negative quantity
      }

      const itemTotal = parseFloat(saleItem.price) * returnItem.return_quantity;
      totalReturnAmount += itemTotal;

      returnItemsToProcess.push({
        saleItem,
        returnQuantity: returnItem.return_quantity,
        itemTotal
      });
    }

    if (returnItemsToProcess.length === 0) {
      return res.status(400).json({ error: 'No valid items to return' });
    }

    // Generate return number
    const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Start transaction
    const connection = await usersPool.getConnection();
    await connection.beginTransaction();

    try {
      // Create return record
      const [returnResult] = await connection.query(
        `INSERT INTO sale_returns 
        (user_id, sale_id, return_number, return_date, customer_name, reason, total_amount, status)
        VALUES (?, ?, ?, CURDATE(), ?, ?, ?, 'completed')`,
        [userId, saleId, returnNumber, sale.customer_name, reason || null, totalReturnAmount]
      );

      const returnId = returnResult.insertId;

      // Track total profit to reverse from returns
      let totalProfitToReverse = 0;

      // Create return items and update stock
      for (const { saleItem, returnQuantity, itemTotal } of returnItemsToProcess) {
        // Calculate profit that needs to be reversed for this item
        // profit_per_unit = (sell_price - purchase_price) or use stored profit
        const sellPrice = parseFloat(saleItem.price || saleItem.unit_price || 0);
        const purchasePrice = parseFloat(saleItem.purchase_price || 0);
        const originalQuantity = parseFloat(saleItem.quantity || 1);
        const storedProfit = parseFloat(saleItem.profit || 0);
        
        // Calculate profit per unit: either from stored profit or calculate from prices
        let profitPerUnit = 0;
        if (storedProfit > 0 && originalQuantity > 0) {
          // Use stored profit per unit
          profitPerUnit = storedProfit / originalQuantity;
        } else {
          // Calculate from sell price and purchase price
          profitPerUnit = sellPrice - purchasePrice;
        }
        
        // Profit to reverse = profit per unit * returned quantity
        const profitToReverse = profitPerUnit * returnQuantity;
        totalProfitToReverse += profitToReverse;

        // Insert return item
        await connection.query(
          `INSERT INTO sale_return_items 
          (sale_return_id, sale_item_id, quantity, price, total)
          VALUES (?, ?, ?, ?, ?)`,
          [returnId, saleItem.id, returnQuantity, saleItem.price, itemTotal]
        );

        // Update returned_quantity in sales_items
        await connection.query(
          'UPDATE sales_items SET returned_quantity = returned_quantity + ? WHERE id = ?',
          [returnQuantity, saleItem.id]
        );

        // Update stock - restore to original batch if possible
        if (saleItem.stock_batch_id) {
          // Return to the original batch it was sold from
          const [batchStock] = await connection.query(
            'SELECT id, quantity, is_deleted FROM stock WHERE id = ? AND user_id = ?',
            [saleItem.stock_batch_id, userId]
          );

          if (batchStock.length > 0 && !batchStock[0].is_deleted) {
            // Batch exists and is not deleted - restore to original batch
            await connection.query(
              'UPDATE stock SET quantity = quantity + ? WHERE id = ?',
              [returnQuantity, saleItem.stock_batch_id]
            );
          } else {
            // Original batch no longer exists or was deleted - create new batch or restore to first available
            if (saleItem.medicine_reg_number) {
              const [existingStock] = await connection.query(
                'SELECT id, quantity FROM stock WHERE user_id = ? AND medicine_reg_number = ? AND is_deleted = FALSE ORDER BY created_at ASC LIMIT 1',
                [userId, saleItem.medicine_reg_number]
              );

              if (existingStock.length > 0) {
                // Restore to first available batch for this product
                await connection.query(
                  'UPDATE stock SET quantity = quantity + ? WHERE id = ?',
                  [returnQuantity, existingStock[0].id]
                );
              } else {
                // Create new batch
                await connection.query(
                  `INSERT INTO stock (user_id, medicine_reg_number, quantity, unit_price, purchase_price)
                   VALUES (?, ?, ?, ?, ?)`,
                  [userId, saleItem.medicine_reg_number, returnQuantity, saleItem.price, saleItem.purchase_price || 0]
                );
              }
            } else if (saleItem.custom_product_id) {
              const [existingStock] = await connection.query(
                'SELECT id, quantity FROM stock WHERE user_id = ? AND custom_product_id = ? AND is_deleted = FALSE ORDER BY created_at ASC LIMIT 1',
                [userId, saleItem.custom_product_id]
              );

              if (existingStock.length > 0) {
                // Restore to first available batch for this product
                await connection.query(
                  'UPDATE stock SET quantity = quantity + ? WHERE id = ?',
                  [returnQuantity, existingStock[0].id]
                );
              } else {
                // Create new batch
                await connection.query(
                  `INSERT INTO stock (user_id, custom_product_id, quantity, unit_price, purchase_price)
                   VALUES (?, ?, ?, ?, ?)`,
                  [userId, saleItem.custom_product_id, returnQuantity, saleItem.price, saleItem.purchase_price || 0]
                );
              }
            }
          }
        } else {
          // No batch_id tracked - fall back to original logic
          if (saleItem.medicine_reg_number) {
            const [existingStock] = await connection.query(
              'SELECT id, quantity FROM stock WHERE user_id = ? AND medicine_reg_number = ? AND is_deleted = FALSE ORDER BY created_at ASC LIMIT 1',
              [userId, saleItem.medicine_reg_number]
            );

            if (existingStock.length > 0) {
              await connection.query(
                'UPDATE stock SET quantity = quantity + ? WHERE id = ?',
                [returnQuantity, existingStock[0].id]
              );
            } else {
              await connection.query(
                `INSERT INTO stock (user_id, medicine_reg_number, quantity, unit_price, purchase_price)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, saleItem.medicine_reg_number, returnQuantity, saleItem.price, saleItem.purchase_price || 0]
              );
            }
          } else if (saleItem.custom_product_id) {
            const [existingStock] = await connection.query(
              'SELECT id, quantity FROM stock WHERE user_id = ? AND custom_product_id = ? AND is_deleted = FALSE ORDER BY created_at ASC LIMIT 1',
              [userId, saleItem.custom_product_id]
            );

            if (existingStock.length > 0) {
              await connection.query(
                'UPDATE stock SET quantity = quantity + ? WHERE id = ?',
                [returnQuantity, existingStock[0].id]
              );
            } else {
              await connection.query(
                `INSERT INTO stock (user_id, custom_product_id, quantity, unit_price, purchase_price)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, saleItem.custom_product_id, returnQuantity, saleItem.price, saleItem.purchase_price || 0]
              );
            }
          }
        }
      }

      // Reverse profit from the original sale
      // Subtract the returned profit from the sale's total profit
      if (totalProfitToReverse > 0) {
        const currentSaleProfit = parseFloat(sale.profit || 0);
        const newSaleProfit = Math.max(0, currentSaleProfit - totalProfitToReverse);
        
        await connection.query(
          'UPDATE sales SET profit = ? WHERE id = ?',
          [newSaleProfit, saleId]
        );
      }

      // Reverse profit from daily_profits for the date of the original sale
      // Get the original sale date
      const saleDate = sale.created_at ? new Date(sale.created_at).toISOString().split('T')[0] : null;
      
      if (saleDate && totalProfitToReverse > 0) {
        try {
          // Find daily profit record for the sale date
          const [dailyProfit] = await connection.query(
            'SELECT * FROM daily_profits WHERE user_id = ? AND date = ?',
            [userId, saleDate]
          );

          if (dailyProfit.length > 0) {
            // Subtract the returned profit from daily profit
            const currentDailyProfit = parseFloat(dailyProfit[0].total_profit || 0);
            const newDailyProfit = currentDailyProfit - totalProfitToReverse;
            
            await connection.query(
              'UPDATE daily_profits SET total_profit = ? WHERE id = ?',
              [newDailyProfit, dailyProfit[0].id]
            );
          } else {
            // If daily profit record doesn't exist for that date, create one with negative profit
            // This handles cases where returns happen on a different day
            await connection.query(
              `INSERT INTO daily_profits (user_id, date, total_profit, total_sales)
               VALUES (?, ?, ?, 0)`,
              [userId, saleDate, -totalProfitToReverse]
            );
          }
        } catch (dailyProfitError) {
          // Log error but don't fail the return transaction
          console.error('Error updating daily profit for return:', dailyProfitError);
        }
      }

      await connection.commit();

      // Fetch the created return with items
      const [returnRecord] = await connection.query(
        'SELECT * FROM sale_returns WHERE id = ?',
        [returnId]
      );

      const [returnItems] = await connection.query(
        `SELECT sri.*, si.item_name, si.medicine_reg_number, si.custom_product_id
         FROM sale_return_items sri
         JOIN sales_items si ON sri.sale_item_id = si.id
         WHERE sri.sale_return_id = ?`,
        [returnId]
      );

      connection.release();

      res.json({
        success: true,
        return: {
          ...returnRecord[0],
          items: returnItems.map(item => ({
            ...item,
            product_name: item.item_name,
            quantity: item.quantity,
            price: parseFloat(item.price),
            total: parseFloat(item.total)
          }))
        }
      });

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ error: 'Error processing return', message: error.message });
  }
});

// Get returns list
router.get('/list', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT sr.*, s.transaction_id, s.customer_name as original_customer_name
      FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      WHERE sr.user_id = ?
    `;
    const params = [userId];

    if (startDate) {
      query += ' AND DATE(sr.return_date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(sr.return_date) <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const [returns] = await usersPool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM sale_returns WHERE user_id = ?';
    const countParams = [userId];
    if (startDate) {
      countQuery += ' AND DATE(return_date) >= ?';
      countParams.push(startDate);
    }
    if (endDate) {
      countQuery += ' AND DATE(return_date) <= ?';
      countParams.push(endDate);
    }
    const [countResult] = await usersPool.query(countQuery, countParams);
    const total = countResult[0].total;

    // Get items for each return
    for (const returnRecord of returns) {
      const [items] = await usersPool.query(
        `SELECT sri.*, si.item_name, si.medicine_reg_number, si.custom_product_id
         FROM sale_return_items sri
         JOIN sales_items si ON sri.sale_item_id = si.id
         WHERE sri.sale_return_id = ?`,
        [returnRecord.id]
      );

      returnRecord.items = items.map(item => ({
        id: item.id,
        sale_return_id: item.sale_return_id,
        sale_item_id: item.sale_item_id,
        product_name: item.item_name || 'Unknown Product',
        item_name: item.item_name,
        quantity: parseInt(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        total: parseFloat(item.total) || 0,
        medicine_reg_number: item.medicine_reg_number,
        custom_product_id: item.custom_product_id
      }));
    }

    res.json({
      returns: returns.map(ret => ({
        id: ret.id,
        return_number: ret.return_number,
        return_date: ret.return_date,
        transaction_id: ret.transaction_id,
        customer_name: ret.customer_name || ret.original_customer_name,
        reason: ret.reason,
        total_amount: parseFloat(ret.total_amount),
        status: ret.status,
        created_at: ret.created_at,
        items: ret.items
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ error: 'Error fetching returns', message: error.message });
  }
});

module.exports = router;

