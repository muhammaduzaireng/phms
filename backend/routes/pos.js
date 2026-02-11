const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { centralizedPool, usersPool } = require('../config/database');

// Get all products (medicines + custom products) for POS (requires authentication)
router.get('/products', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, category } = req.query;
    const searchQuery = (search || '').toString().trim();
    const categoryQuery = (category || '').toString().trim();
    // Allow higher limit for inventory table (up to 50000), default to 200 for search
    const requestedLimit = parseInt(req.query.limit, 10);
    const isInventoryRequest = requestedLimit && requestedLimit > 200;
    // For inventory table (no search query and high limit), allow up to 50000
    const LIMIT = isInventoryRequest 
      ? Math.min(requestedLimit, 50000) 
      : Math.max(1, Math.min(requestedLimit || 50, 10000));

    // Stock info (used both for enrichment and for stock-first search)
    // Get only non-deleted items, ordered by created_at to get latest batch prices
    const [stockItems] = await usersPool.query(
      'SELECT medicine_reg_number, custom_product_id, unit_price, quantity, min_stock_level, created_at FROM stock WHERE user_id = ? AND is_deleted = FALSE ORDER BY created_at DESC',
      [userId]
    );

    // Create maps for stock prices and quantities
    // Use latest batch price (first in DESC order) and sum quantities from all batches
    const stockPriceMap = {};
    const stockQuantityMap = {};
    const stockMinLevelMap = {};
    const stockedMedicineRegNumbers = [];
    stockItems.forEach(item => {
      if (item.medicine_reg_number) {
        const key = `MED-${item.medicine_reg_number}`;
        // Set price only if not already set (first = latest batch)
        if (stockPriceMap[key] === undefined) {
          stockPriceMap[key] = parseFloat(item.unit_price);
        }
        // Sum quantities from all batches
        stockQuantityMap[key] = (stockQuantityMap[key] || 0) + (parseInt(item.quantity) || 0);
        stockMinLevelMap[key] = parseInt(item.min_stock_level) || 0;
        if (!stockedMedicineRegNumbers.includes(item.medicine_reg_number)) {
          stockedMedicineRegNumbers.push(item.medicine_reg_number);
        }
      }
      if (item.custom_product_id) {
        const key = `CUST-${item.custom_product_id}`;
        // Set price only if not already set (first = latest batch)
        if (stockPriceMap[key] === undefined) {
          stockPriceMap[key] = parseFloat(item.unit_price);
        }
        // Sum quantities from all batches
        stockQuantityMap[key] = (stockQuantityMap[key] || 0) + (parseInt(item.quantity) || 0);
        stockMinLevelMap[key] = parseInt(item.min_stock_level) || 0;
      }
    });

    const enrichMedicine = (m) => {
      const stockKey = `MED-${m.reg_number}`;
      const price = stockPriceMap[stockKey] !== undefined
        ? stockPriceMap[stockKey]
        : parseFloat(m.price_rs);
      const stockQuantity = stockQuantityMap[stockKey] !== undefined
        ? stockQuantityMap[stockKey]
        : 0;
      const minStockLevel = stockMinLevelMap[stockKey] !== undefined
        ? stockMinLevelMap[stockKey]
        : 0;

      return {
        ...m,
        product_name: m.product_name,
        price_rs: price,
        reg_number: m.reg_number,
        generic_name: m.generic_name,
        manufacturer: m.manufacturer,
        pack_size: m.pack_size,
        isCustom: false,
        stock_quantity: stockQuantity,
        min_stock_level: minStockLevel,
        in_stock: stockQuantity > 0,
        low_stock: stockQuantity > 0 && stockQuantity <= minStockLevel && minStockLevel > 0
      };
    };

    const enrichCustom = (p) => {
      const stockKey = `CUST-${p.id}`;
      const price = stockPriceMap[stockKey] !== undefined
        ? stockPriceMap[stockKey]
        : parseFloat(p.price);
      const stockQuantity = stockQuantityMap[stockKey] !== undefined
        ? stockQuantityMap[stockKey]
        : 0;
      const minStockLevel = stockMinLevelMap[stockKey] !== undefined
        ? stockMinLevelMap[stockKey]
        : 0;

      return {
        ...p,
        product_name: p.name,
        price_rs: price,
        reg_number: `CUST-${p.id}`,
        generic_name: p.description,
        manufacturer: p.category,
        pack_size: p.unit,
        isCustom: true,
        custom_product_id: p.id,
        stock_quantity: stockQuantity,
        min_stock_level: minStockLevel,
        in_stock: stockQuantity > 0,
        low_stock: stockQuantity > 0 && stockQuantity <= minStockLevel && minStockLevel > 0
      };
    };

    const sortForPOS = (a, b) => {
      // Prefer in-stock, then higher quantity, then name
      const ai = a.in_stock ? 1 : 0;
      const bi = b.in_stock ? 1 : 0;
      if (ai !== bi) return bi - ai;
      const aq = parseInt(a.stock_quantity) || 0;
      const bq = parseInt(b.stock_quantity) || 0;
      if (aq !== bq) return bq - aq;
      return (a.product_name || '').localeCompare(b.product_name || '');
    };

    // ----------------------------
    // INVENTORY TABLE MODE (ALL PRODUCTS IN STOCK)
    // ----------------------------
    // When no search/category and high limit requested, return ALL products in stock
    if (!searchQuery && !categoryQuery && isInventoryRequest) {
      // Get all custom products in stock (use DISTINCT to avoid duplicates from multiple batches)
      const stockCustomQuery = `
        SELECT DISTINCT cp.*, "custom" as product_type
        FROM stock s
        INNER JOIN custom_products cp ON cp.id = s.custom_product_id
        WHERE s.user_id = ? AND cp.user_id = ? AND s.is_deleted = FALSE AND s.quantity > 0
        ORDER BY cp.name ASC
      `;
      const [stockCustomProducts] = await usersPool.query(stockCustomQuery, [userId, userId]);

      // Get all medicines in stock (chunked IN list, no limit)
      const stockMedicines = [];
      const seenMedicines = new Set(); // Track to avoid duplicates
      if (stockedMedicineRegNumbers.length > 0) {
        const chunkSize = 800;
        for (let i = 0; i < stockedMedicineRegNumbers.length; i += chunkSize) {
          const chunk = stockedMedicineRegNumbers.slice(i, i + chunkSize);
          const medQuery = 'SELECT *, "medicine" as product_type FROM medicines WHERE reg_number IN (?) ORDER BY product_name ASC';
          const [rows] = await centralizedPool.query(medQuery, [chunk]);
          // Filter out duplicates
          rows.forEach(row => {
            if (!seenMedicines.has(row.reg_number)) {
              stockMedicines.push(row);
              seenMedicines.add(row.reg_number);
            }
          });
        }
      }

      const allStockProducts = [
        ...stockMedicines.map(enrichMedicine),
        ...stockCustomProducts.map(enrichCustom)
      ].sort(sortForPOS);

      return res.json({ products: allStockProducts });
    }

    // ----------------------------
    // STOCK-FIRST SEARCH (FAST)
    // ----------------------------
    // 1) Search custom products that are IN STOCK (users DB join)
    // 2) Search medicines that are IN STOCK (centralized DB, filtered by reg_numbers list)
    // If we find anything in stock, return immediately (no centralized full search).
    if (searchQuery || categoryQuery) {
      // Custom products in stock
      let stockCustomQuery = `
        SELECT cp.*, "custom" as product_type
        FROM stock s
        INNER JOIN custom_products cp ON cp.id = s.custom_product_id
        WHERE s.user_id = ? AND cp.user_id = ?
      `;
      const stockCustomParams = [userId, userId];

      if (searchQuery) {
        stockCustomQuery += ' AND (cp.name LIKE ? OR cp.description LIKE ? OR cp.barcode = ?)';
        const like = `%${searchQuery}%`;
        stockCustomParams.push(like, like, searchQuery);
      }

      if (categoryQuery) {
        stockCustomQuery += ' AND cp.category = ?';
        stockCustomParams.push(categoryQuery);
      }

      stockCustomQuery += ' AND s.is_deleted = FALSE ORDER BY s.quantity > 0 DESC, s.quantity DESC, cp.name ASC LIMIT ?';
      stockCustomParams.push(LIMIT);

      const [stockCustomProducts] = await usersPool.query(stockCustomQuery, stockCustomParams);

      // Medicines in stock (chunked IN list)
      const stockMedicines = [];
      if (stockedMedicineRegNumbers.length > 0) {
        const chunkSize = 800;
        for (let i = 0; i < stockedMedicineRegNumbers.length; i += chunkSize) {
          if (stockMedicines.length >= LIMIT) break;
          const chunk = stockedMedicineRegNumbers.slice(i, i + chunkSize);

          let medQuery = 'SELECT *, "medicine" as product_type FROM medicines WHERE reg_number IN (?)';
          const medParams = [chunk];

          if (searchQuery) {
            medQuery += ' AND (product_name LIKE ? OR generic_name LIKE ? OR reg_number LIKE ?)';
            const like = `%${searchQuery}%`;
            medParams.push(like, like, like);
          }

          if (categoryQuery) {
            medQuery += ' AND category = ?';
            medParams.push(categoryQuery);
          }

          medQuery += ' LIMIT ?';
          medParams.push(LIMIT - stockMedicines.length);

          const [rows] = await centralizedPool.query(medQuery, medParams);
          stockMedicines.push(...rows);
        }
      }

      const stockFirstProducts = [
        ...stockMedicines.map(enrichMedicine),
        ...stockCustomProducts.map(enrichCustom)
      ].sort(sortForPOS).slice(0, LIMIT);

      if (stockFirstProducts.length > 0) {
        return res.json({ products: stockFirstProducts });
      }
    }

    // ----------------------------
    // FALLBACK SEARCH (LIMITED)
    // ----------------------------
    // If nothing in stock matches, search centralized DB + all custom products, but limit results for speed.

    // Medicines (centralized DB)
    let medicineQuery = 'SELECT *, "medicine" as product_type FROM medicines WHERE 1=1';
    const medicineParams = [];
    if (searchQuery) {
      medicineQuery += ' AND (product_name LIKE ? OR generic_name LIKE ? OR reg_number LIKE ?)';
      const like = `%${searchQuery}%`;
      medicineParams.push(like, like, like);
    }
    if (categoryQuery) {
      medicineQuery += ' AND category = ?';
      medicineParams.push(categoryQuery);
    }
    medicineQuery += ' LIMIT ?';
    medicineParams.push(LIMIT);
    const [medicines] = await centralizedPool.query(medicineQuery, medicineParams);

    // Custom products (users DB)
    let customQuery = 'SELECT *, "custom" as product_type FROM custom_products WHERE user_id = ?';
    const customParams = [userId];
    if (searchQuery) {
      customQuery += ' AND (name LIKE ? OR description LIKE ? OR barcode = ?)';
      const like = `%${searchQuery}%`;
      customParams.push(like, like, searchQuery);
    }
    if (categoryQuery) {
      customQuery += ' AND category = ?';
      customParams.push(categoryQuery);
    }
    customQuery += ' LIMIT ?';
    customParams.push(LIMIT);
    const [customProducts] = await usersPool.query(customQuery, customParams);

    const allProducts = [
      ...medicines.map(enrichMedicine),
      ...customProducts.map(enrichCustom)
    ].sort(sortForPOS).slice(0, LIMIT);

    res.json({ products: allProducts });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products', message: error.message });
  }
});

module.exports = router;

