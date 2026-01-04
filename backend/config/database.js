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
    console.error('❌ Centralized Database connection error:', error.message);
    console.error('   Please check: database exists, credentials, IP whitelist');
  }

  try {
    const usersConnection = await usersPool.getConnection();
    console.log('✅ Connected to Users Database');
    usersConnection.release();
    usersOk = true;
  } catch (error) {
    console.error('❌ Users Database connection error:', error.message);
    console.error('   Common issues:');
    console.error('   1. Database/user not created in hosting panel');
    console.error('   2. Password incorrect');
    console.error('   3. IP address not whitelisted');
    console.error('   4. User does not have permission to access database');
    console.error('   Note: Users database can be created later if needed');
  }

  if (centralizedOk && usersOk) {
    console.log('\n✅ All database connections successful!');
    return true;
  } else if (centralizedOk) {
    console.log('\n⚠️  Centralized database connected, but users database failed.');
    console.log('   Server will continue, but user-specific features may not work.');
    console.log('   Please set up the users database to enable all features.');
    return true; // Allow server to start with just centralized DB
  } else {
    console.log('\n❌ Critical: Centralized database connection failed!');
    console.log('   Please fix database connection before starting server.');
    return false;
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

