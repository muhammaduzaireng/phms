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
      customQuery += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      customParams.push(searchTerm, searchTerm);
    }

    if (category) {
      customQuery += ' AND category = ?';
      customParams.push(category);
    }

    const [customProducts] = await usersPool.query(customQuery, customParams);

    // Get stock prices for this user (to override default prices)
    const [stockItems] = await usersPool.query(
      'SELECT medicine_reg_number, custom_product_id, unit_price FROM stock WHERE user_id = ?',
      [userId]
    );

    // Create a map of stock prices
    const stockPriceMap = {};
    stockItems.forEach(item => {
      if (item.medicine_reg_number) {
        stockPriceMap[`MED-${item.medicine_reg_number}`] = parseFloat(item.unit_price);
      }
      if (item.custom_product_id) {
        stockPriceMap[`CUST-${item.custom_product_id}`] = parseFloat(item.unit_price);
      }
    });

    // Transform data to consistent format with stock prices
    const allProducts = [
      ...medicines.map(m => {
        const stockKey = `MED-${m.reg_number}`;
        const price = stockPriceMap[stockKey] !== undefined 
          ? stockPriceMap[stockKey] 
          : parseFloat(m.price_rs);
        
        return {
          ...m,
          product_name: m.product_name,
          price_rs: price,
          reg_number: m.reg_number,
          generic_name: m.generic_name,
          manufacturer: m.manufacturer,
          pack_size: m.pack_size,
          isCustom: false
        };
      }),
      ...customProducts.map(p => {
        const stockKey = `CUST-${p.id}`;
        const price = stockPriceMap[stockKey] !== undefined 
          ? stockPriceMap[stockKey] 
          : parseFloat(p.price);
        
        return {
          ...p,
          product_name: p.name,
          price_rs: price,
          reg_number: `CUST-${p.id}`,
          generic_name: p.description,
          manufacturer: p.category,
          pack_size: p.unit,
          isCustom: true,
          custom_product_id: p.id
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

