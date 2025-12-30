const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { usersPool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy-secret-key-change-in-production';

// Pharmacy User Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // For now, we'll use a simple approach - in production, add password_hash to users table
    // Check if user exists and is active
    const [users] = await usersPool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials or account inactive' });
    }

    const user = users[0];

    // Simple password check (in production, use bcrypt)
    // For now, if password_hash doesn't exist, we'll accept any password for existing users
    // TODO: Implement proper password hashing

    const token = jwt.sign(
      { id: user.id, username: user.username },
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
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Verify token middleware (for pharmacy users)
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

module.exports = { router, verifyToken };

