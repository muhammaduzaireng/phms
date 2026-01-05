const mysql = require('mysql2/promise');

// Centralized Database Configuration (Medicines)
const centralizedDbConfig = {
  host: '193.203.168.148', // Using IP address (DNS might not resolve locally)
  port: 3306, // Explicit port
  user: 'u672236642_pharmacy',
  password: 'Pharmacy@5512',
  database: 'u672236642_pharmacy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  connectTimeout: 30000 // 30 second timeout
};

// Users Database Configuration (User-specific data)
const usersDbConfig = {
  host: '193.203.168.148', // Using IP address (DNS might not resolve locally)
  port: 3306, // Explicit port
  user: 'u672236642_pharmacyUsers',
  password: 'pharmacyUsers@5512',
  database: 'u672236642_pharmacyUsers',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  connectTimeout: 30000 // 30 second timeout
};

// Create connection pools
const centralizedPool = mysql.createPool(centralizedDbConfig);
const usersPool = mysql.createPool(usersDbConfig);

// Test connections
const testConnections = async () => {
  let centralizedOk = false;
  let usersOk = false;

  try {
    const centralizedConnection = await centralizedPool.getConnection();
    console.log('✅ Connected to Centralized Database');
    centralizedConnection.release();
    centralizedOk = true;
  } catch (error) {
    console.warn('⚠️  Centralized Database: Not accessible from this network');
    console.warn('   Error:', error.message);
    console.warn('   Server will continue - frontend uses production API');
  }

  try {
    const usersConnection = await usersPool.getConnection();
    console.log('✅ Connected to Users Database');
    usersConnection.release();
    usersOk = true;
  } catch (error) {
    console.warn('⚠️  Users Database: Not accessible from this network');
    console.warn('   Error:', error.message);
    console.warn('   Server will continue - frontend uses production API');
  }

  if (centralizedOk && usersOk) {
    console.log('\n✅ All database connections successful!');
    return true;
  } else if (centralizedOk) {
    console.log('\n⚠️  Centralized database connected, but users database failed.');
    console.log('   Server will continue - using production API instead.');
    return true;
  } else {
    console.log('\n⚠️  Database connections not available from this network.');
    console.log('   This is normal if your network/firewall blocks database connections.');
    console.log('   Server will continue running - frontend uses production API.');
    console.log('   Production API: https://api.phms.devzytic.com\n');
    return true; // Always allow server to start
  }
};

// Helper function to get connection based on database type
const getConnection = (dbType = 'centralized') => {
  return dbType === 'users' ? usersPool : centralizedPool;
};

module.exports = {
  centralizedPool,
  usersPool,
  getConnection,
  testConnections
};

