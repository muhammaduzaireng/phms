const express = require('express');
const cors = require('cors');
const { testConnections } = require('./config/database');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// Get all network interfaces
function getAllNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (const alias of iface) {
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        ips.push({
          interface: devName,
          address: alias.address,
          mac: alias.mac
        });
      }
    }
  }
  return ips;
}

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5001',
      'http://phms.devzytic.com',
      'https://phms.devzytic.com',
      /\.github\.io$/, // If using GitHub Pages
    ];
    
    // Add your network IPs dynamically
    const networkIPs = getAllNetworkIPs();
    networkIPs.forEach(ip => {
      allowedOrigins.push(`http://${ip.address}:3000`);
      allowedOrigins.push(`http://${ip.address}:5001`);
    });
    
    // Check if origin is allowed
    if (allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(origin);
      return pattern === origin;
    })) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Test database connections
testConnections().catch(err => {
  console.error('Database connection test failed:', err);
});

// Routes (same as before)
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/manufacturers', require('./routes/manufacturers'));
app.use('/api/statistics', require('./routes/statistics'));

const posRouter = require('./routes/pos');
const salesRouter = require('./routes/sales');
app.use('/api/pos', posRouter);
app.use('/api/pos', salesRouter);
// Also register sales routes at /api/sales for compatibility
app.use('/api/sales', salesRouter);

app.use('/api/stock', require('./routes/stock'));
app.use('/api/custom-products', require('./routes/customProducts'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth').router);

// Health check with more info
app.get('/api/health', (req, res) => {
  const networkIPs = getAllNetworkIPs();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: {
      port: PORT,
      hostname: os.hostname(),
      platform: os.platform()
    },
    network: networkIPs,
    public_ip: req.ip,
    headers: req.headers
  });
});

// Network diagnostics endpoint
app.get('/api/network', (req, res) => {
  const networkIPs = getAllNetworkIPs();
  const publicIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  res.json({
    local_ips: networkIPs,
    public_ip: publicIP,
    client_ip: req.ip,
    access_urls: networkIPs.map(ip => `http://${ip.address}:${PORT}`),
    client_headers: req.headers
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Serve React app (catch-all handler must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Start server with ALL interfaces
const HOST = '0.0.0.0'; // Bind to ALL network interfaces
const networkIPs = getAllNetworkIPs();

app.listen(PORT, HOST, () => {
  console.clear();
  console.log('='.repeat(70));
  console.log('🚀 PHMS SERVER STARTED');
  console.log('='.repeat(70));
  
  console.log(`\n📊 SERVER INFORMATION:`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Host: ${HOST}`);
  console.log(`   Time: ${new Date().toLocaleString()}`);
  
  console.log(`\n🔌 NETWORK INTERFACES:`);
  networkIPs.forEach((ip, index) => {
    console.log(`   ${index + 1}. ${ip.interface}: ${ip.address} (${ip.mac})`);
  });
  
  console.log(`\n🔗 ACCESS URLs:`);
  console.log(`   1. Localhost:    http://localhost:${PORT}`);
  networkIPs.forEach((ip, index) => {
    console.log(`   ${index + 2}. Network (${ip.interface}): http://${ip.address}:${PORT}`);
  });
  
  console.log(`\n📡 PUBLIC ACCESS:`);
  console.log(`   • Get your public IP: curl ifconfig.me`);
  console.log(`   • Your current public IP: 72.255.26.111`);
  console.log(`   • Public URL: http://72.255.26.111:${PORT} (if port forwarded)`);
  
  console.log(`\n🛡️  FIREWALL CONFIGURATION:`);
  console.log(`   • Port ${PORT} must be allowed in macOS Firewall`);
  console.log(`   • Port ${PORT} must be forwarded on your router`);
  
  console.log(`\n🌐 API ENDPOINTS:`);
  console.log(`   • Health:     http://localhost:${PORT}/api/health`);
  console.log(`   • Network:    http://localhost:${PORT}/api/network`);
  console.log(`   • Medicines:  http://localhost:${PORT}/api/medicines`);
  
  console.log('\n💡 TROUBLESHOOTING:');
  console.log('   1. Test locally: curl http://localhost:5001/api/health');
  console.log('   2. Test on network: curl http://[YOUR_LOCAL_IP]:5001/api/health');
  console.log('   3. Configure port forwarding on router for port 5001');
  console.log('   4. Check firewall: sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps');
  
  console.log('='.repeat(70));
});