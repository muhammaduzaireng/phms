const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { usersPool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-secret-key-change-in-production';

// Verify token middleware (for pharmacy users) - Must be defined before use
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const [users] = await usersPool.query(
      'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid token or user inactive' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token', message: error.message });
  }
};

// Pharmacy User Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user exists and is active
    const [users] = await usersPool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials or account inactive' });
    }

    const user = users[0];

    // Check password
    if (!user.password_hash) {
      // If no password hash exists, allow login with default password 'password123' (for first-time setup)
      if (password === 'password123') {
        // Hash and save password for next time
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersPool.query(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [hashedPassword, user.id]
        );
      } else {
        return res.status(401).json({ error: 'Invalid credentials. Please contact admin for initial password.' });
      }
    } else {
      // Verify password with bcrypt
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Check subscription status
    if (user.subscription_status === 'expired' || user.subscription_status === 'cancelled') {
      return res.status(403).json({ 
        error: 'Account subscription expired or cancelled',
        subscriptionStatus: user.subscription_status
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, type: 'pharmacy' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        pharmacyName: user.pharmacy_name,
        email: user.email,
        subscriptionStatus: user.subscription_status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Pharmacy User Registration (only if admin creates account)
router.post('/register', async (req, res) => {
  try {
    const { username, password, pharmacyName, ownerName, email, phone } = req.body;

    if (!username || !password || !pharmacyName) {
      return res.status(400).json({ error: 'Username, password, and pharmacy name are required' });
    }

    // Check if username exists
    const [existing] = await usersPool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (admin_id will be null for self-registered, should be set by admin)
    const [result] = await usersPool.query(
      `INSERT INTO users 
      (username, password_hash, pharmacy_name, owner_name, email, phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [username, passwordHash, pharmacyName, ownerName || null, email || null, phone || null]
    );

    // Auto-login after registration
    const token = jwt.sign(
      { id: result.insertId, username, type: 'pharmacy' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: result.insertId,
        username,
        pharmacyName,
        email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

// Change password (requires authentication)
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    // Verify current password
    if (req.user.password_hash) {
      const isValidPassword = await bcrypt.compare(currentPassword, req.user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await usersPool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, userId]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password', message: error.message });
  }
});

module.exports = { router, verifyToken };

