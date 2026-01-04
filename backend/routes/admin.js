const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { usersPool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-admin-secret-key-change-in-production';

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [admins] = await usersPool.query(
      'SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = admins[0];
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log activity
    await usersPool.query(
      'INSERT INTO admin_activity_log (admin_id, action, ip_address) VALUES (?, ?, ?)',
      [admin.id, 'login', req.ip]
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const [admins] = await usersPool.query(
      'SELECT * FROM admin_users WHERE id = ? AND is_active = TRUE',
      [decoded.id]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.admin = admins[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token', message: error.message });
  }
};

// Get all pharmacies/users
router.get('/pharmacies', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;

    let query = `
      SELECT u.*, 
        a.full_name as created_by_name,
        COUNT(DISTINCT s.id) as total_sales,
        COUNT(DISTINCT po.id) as total_purchase_orders
      FROM users u
      LEFT JOIN admin_users a ON u.created_by_admin_id = a.id
      LEFT JOIN sales s ON u.id = s.user_id
      LEFT JOIN purchase_orders po ON u.id = po.user_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (u.pharmacy_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      query += ' AND u.is_active = ?';
      params.push(status === 'active');
    }

    query += ' GROUP BY u.id ORDER BY u.created_at DESC';

    const [users] = await usersPool.query(query, params);

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedUsers = users.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      pharmacies: paginatedUsers,
      total: users.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(users.length / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching pharmacies:', error);
    res.status(500).json({ error: 'Error fetching pharmacies', message: error.message });
  }
});

// Get single pharmacy
router.get('/pharmacies/:id', verifyAdmin, async (req, res) => {
  try {
    const [users] = await usersPool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    // Get statistics
    const [salesCount] = await usersPool.query(
      'SELECT COUNT(*) as total, SUM(total) as revenue FROM sales WHERE user_id = ?',
      [req.params.id]
    );

    const [ordersCount] = await usersPool.query(
      'SELECT COUNT(*) as total FROM purchase_orders WHERE user_id = ?',
      [req.params.id]
    );

    res.json({
      ...users[0],
      statistics: {
        totalSales: salesCount[0].total || 0,
        totalRevenue: parseFloat(salesCount[0].revenue) || 0,
        totalPurchaseOrders: ordersCount[0].total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({ error: 'Error fetching pharmacy', message: error.message });
  }
});

// Create pharmacy/user
router.post('/pharmacies', verifyAdmin, async (req, res) => {
  try {
    const {
      username,
      pharmacyName,
      ownerName,
      address,
      city,
      phone,
      email,
      licenseNumber,
      taxId,
      subscriptionStatus = 'trial',
      subscriptionExpiresAt
    } = req.body;

    if (!username || !pharmacyName) {
      return res.status(400).json({ error: 'Username and pharmacy name are required' });
    }

    // Check if username exists
    const [existing] = await usersPool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Generate default password (pharmacy owner should change it)
    const defaultPassword = 'password123';
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const [result] = await usersPool.query(
      `INSERT INTO users 
      (username, password_hash, pharmacy_name, owner_name, address, city, phone, email, license_number, tax_id, 
       created_by_admin_id, subscription_status, subscription_expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        username,
        passwordHash,
        pharmacyName,
        ownerName || null,
        address || null,
        city || null,
        phone || null,
        email || null,
        licenseNumber || null,
        taxId || null,
        req.admin.id,
        subscriptionStatus,
        subscriptionExpiresAt || null
      ]
    );

    // Log password for admin (in production, send via secure email)
    console.log(`\n📋 Pharmacy Account Created:`);
    console.log(`   Username: ${username}`);
    console.log(`   Default Password: ${defaultPassword}`);
    console.log(`   ⚠️  Pharmacy owner should change password after first login\n`);

    // Log activity
    await usersPool.query(
      'INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.admin.id, 'create_pharmacy', 'user', result.insertId, JSON.stringify({ pharmacyName })]
    );

    const [newUser] = await usersPool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.json({ success: true, pharmacy: newUser[0] });
  } catch (error) {
    console.error('Error creating pharmacy:', error);
    res.status(500).json({ error: 'Error creating pharmacy', message: error.message });
  }
});

// Update pharmacy
router.put('/pharmacies/:id', verifyAdmin, async (req, res) => {
  try {
    const {
      pharmacyName,
      ownerName,
      address,
      city,
      phone,
      email,
      licenseNumber,
      taxId,
      isActive,
      subscriptionStatus,
      subscriptionExpiresAt
    } = req.body;

    await usersPool.query(
      `UPDATE users SET 
        pharmacy_name = ?, owner_name = ?, address = ?, city = ?, phone = ?, 
        email = ?, license_number = ?, tax_id = ?, is_active = ?,
        subscription_status = ?, subscription_expires_at = ?
      WHERE id = ?`,
      [
        pharmacyName,
        ownerName,
        address,
        city,
        phone,
        email,
        licenseNumber,
        taxId,
        isActive !== undefined ? isActive : true,
        subscriptionStatus,
        subscriptionExpiresAt,
        req.params.id
      ]
    );

    // Log activity
    await usersPool.query(
      'INSERT INTO admin_activity_log (admin_id, action, target_type, target_id) VALUES (?, ?, ?, ?)',
      [req.admin.id, 'update_pharmacy', 'user', req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating pharmacy:', error);
    res.status(500).json({ error: 'Error updating pharmacy', message: error.message });
  }
});

// Delete/deactivate pharmacy
router.delete('/pharmacies/:id', verifyAdmin, async (req, res) => {
  try {
    // Soft delete - set is_active to false
    await usersPool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [req.params.id]);

    // Log activity
    await usersPool.query(
      'INSERT INTO admin_activity_log (admin_id, action, target_type, target_id) VALUES (?, ?, ?, ?)',
      [req.admin.id, 'delete_pharmacy', 'user', req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pharmacy:', error);
    res.status(500).json({ error: 'Error deleting pharmacy', message: error.message });
  }
});

// Get admin dashboard statistics
router.get('/dashboard', verifyAdmin, async (req, res) => {
  try {
    const [totalPharmacies] = await usersPool.query('SELECT COUNT(*) as total FROM users');
    const [activePharmacies] = await usersPool.query('SELECT COUNT(*) as total FROM users WHERE is_active = TRUE');
    const [totalSales] = await usersPool.query('SELECT COUNT(*) as total, SUM(total) as revenue FROM sales');
    const [totalOrders] = await usersPool.query('SELECT COUNT(*) as total FROM purchase_orders');

    res.json({
      totalPharmacies: totalPharmacies[0].total || 0,
      activePharmacies: activePharmacies[0].total || 0,
      totalSales: totalSales[0].total || 0,
      totalRevenue: parseFloat(totalSales[0].revenue) || 0,
      totalPurchaseOrders: totalOrders[0].total || 0
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Error fetching dashboard', message: error.message });
  }
});

// Get activity log
router.get('/activity-log', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const [logs] = await usersPool.query(
      `SELECT al.*, a.username as admin_username 
       FROM admin_activity_log al
       LEFT JOIN admin_users a ON al.admin_id = a.id
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]
    );

    res.json(logs);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Error fetching activity log', message: error.message });
  }
});

module.exports = router;

