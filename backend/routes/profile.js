const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { usersPool } = require('../config/database');

// Get profile (for pharmacy users - requires authentication)
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await usersPool.query(
      'SELECT id, pharmacy_name, owner_name, address, city, phone, email, license_number, tax_id, logo_url FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      // Create default user if not exists
      const [result] = await usersPool.query(
        `INSERT INTO users (id, username, pharmacy_name) VALUES (?, ?, ?)`,
        [userId, `user_${userId}`, 'Pharmacy Management System']
      );
      return res.json({
        pharmacyName: 'Pharmacy Management System',
        ownerName: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        licenseNumber: '',
        taxId: '',
        logo: ''
      });
    }

    const user = users[0];
    res.json({
      pharmacyName: user.pharmacy_name || '',
      ownerName: user.owner_name || '',
      address: user.address || '',
      city: user.city || '',
      phone: user.phone || '',
      email: user.email || '',
      licenseNumber: user.license_number || '',
      taxId: user.tax_id || '',
      logo: user.logo_url || ''
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Error fetching profile', message: error.message });
  }
});

// Update profile (for pharmacy users - requires authentication)
router.put('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { pharmacyName, ownerName, address, city, phone, email, licenseNumber, taxId, logo } = req.body;

    // Check if user exists
    const [users] = await usersPool.query('SELECT id FROM users WHERE id = ?', [userId]);

    if (users.length === 0) {
      // Create user
      await usersPool.query(
        `INSERT INTO users 
        (id, username, pharmacy_name, owner_name, address, city, phone, email, license_number, tax_id, logo_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, `user_${userId}`, pharmacyName, ownerName, address, city, phone, email, licenseNumber, taxId, logo]
      );
    } else {
      // Update user
      await usersPool.query(
        `UPDATE users SET 
          pharmacy_name = ?, owner_name = ?, address = ?, city = ?, phone = ?, 
          email = ?, license_number = ?, tax_id = ?, logo_url = ?
        WHERE id = ?`,
        [pharmacyName, ownerName, address, city, phone, email, licenseNumber, taxId, logo, userId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error updating profile', message: error.message });
  }
});

module.exports = router;

