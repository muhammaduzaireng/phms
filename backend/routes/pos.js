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

    // Transform data to consistent format
    const allProducts = [
      ...medicines.map(m => ({
        ...m,
        product_name: m.product_name,
        price_rs: parseFloat(m.price_rs),
        reg_number: m.reg_number,
        generic_name: m.generic_name,
        manufacturer: m.manufacturer,
        pack_size: m.pack_size,
        isCustom: false
      })),
      ...customProducts.map(p => ({
        ...p,
        product_name: p.name,
        price_rs: parseFloat(p.price),
        reg_number: `CUST-${p.id}`,
        generic_name: p.description,
        manufacturer: p.category,
        pack_size: p.unit,
        isCustom: true,
        custom_product_id: p.id
      }))
    ];

    res.json({ products: allProducts });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products', message: error.message });
  }
});

module.exports = router;

