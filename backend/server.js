const express = require('express');
const cors = require('cors');
const { testConnections } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware - CORS configuration for network access
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow localhost origins
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    
    // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const localNetworkPattern = /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
    if (localNetworkPattern.test(origin)) {
      return callback(null, true);
    }
    
    // Allow all origins in development (you can restrict this in production)
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

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

// Get local IP address for network access
const os = require('os');
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

const HOST = process.env.HOST || '0.0.0.0'; // Bind to all network interfaces
const LOCAL_IP = getLocalIPAddress();

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 API available at:`);
  console.log(`   - Local: http://localhost:${PORT}/api`);
  console.log(`   - Network: http://${LOCAL_IP}:${PORT}/api`);
  console.log(`\n💡 To access from another device on the same network:`);
  console.log(`   Update frontend API_BASE_URL to: http://${LOCAL_IP}:${PORT}`);
});
