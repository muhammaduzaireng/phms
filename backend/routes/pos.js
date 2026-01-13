const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { centralizedPool, usersPool } = require('../config/database');

// Get all products (medicines + custom products) for POS (requires authentication)
router.get('/products', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, category } = req.query;

    // Get medicines from centralized DB
    let medicineQuery = 'SELECT *, "medicine" as product_type FROM medicines WHERE 1=1';
    const medicineParams = [];

    if (search) {
      medicineQuery += ' AND (product_name LIKE ? OR generic_name LIKE ? OR reg_number LIKE ?)';
      const searchTerm = `%${search}%`;
      medicineParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      medicineQuery += ' AND category = ?';
      medicineParams.push(category);
    }

    const [medicines] = await centralizedPool.query(medicineQuery, medicineParams);

    // Get custom products from users DB
    let customQuery = 'SELECT *, "custom" as product_type FROM custom_products WHERE user_id = ?';
    const customParams = [userId];

    if (search) {
      customQuery += ' AND (name LIKE ? OR description LIKE ? OR barcode = ?)';
      const searchTerm = `%${search}%`;
      customParams.push(searchTerm, searchTerm, search);
    }

    if (category) {
      customQuery += ' AND category = ?';
      customParams.push(category);
    }

    const [customProducts] = await usersPool.query(customQuery, customParams);

    // Get stock information (prices and quantities) for this user
    const [stockItems] = await usersPool.query(
      'SELECT medicine_reg_number, custom_product_id, unit_price, quantity, min_stock_level FROM stock WHERE user_id = ?',
      [userId]
    );

    // Create maps for stock prices and quantities
    const stockPriceMap = {};
    const stockQuantityMap = {};
    const stockMinLevelMap = {};
    stockItems.forEach(item => {
      if (item.medicine_reg_number) {
        const key = `MED-${item.medicine_reg_number}`;
        stockPriceMap[key] = parseFloat(item.unit_price);
        stockQuantityMap[key] = parseInt(item.quantity) || 0;
        stockMinLevelMap[key] = parseInt(item.min_stock_level) || 0;
      }
      if (item.custom_product_id) {
        const key = `CUST-${item.custom_product_id}`;
        stockPriceMap[key] = parseFloat(item.unit_price);
        stockQuantityMap[key] = parseInt(item.quantity) || 0;
        stockMinLevelMap[key] = parseInt(item.min_stock_level) || 0;
      }
    });

    // Transform data to consistent format with stock prices and quantities
    const allProducts = [
      ...medicines.map(m => {
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
      }),
      ...customProducts.map(p => {
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
      })
    ];

    res.json({ products: allProducts });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products', message: error.message });
  }
});

module.exports = router;

