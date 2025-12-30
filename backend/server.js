const express = require('express');
const cors = require('cors');
const { testConnections } = require('./config/database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://172.20.10.3:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Test database connections on startup
testConnections().catch(err => {
  console.error('Database connection test failed:', err);
});

// Routes
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/manufacturers', require('./routes/manufacturers'));
app.use('/api/statistics', require('./routes/statistics'));
const posRouter = require('./routes/pos');
const salesRouter = require('./routes/sales');

// POS routes
app.use('/api/pos', posRouter);
app.use('/api/pos', salesRouter); // Sales routes also accessible via /api/pos

app.use('/api/stock', require('./routes/stock'));
app.use('/api/custom-products', require('./routes/customProducts'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth').router);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
});
