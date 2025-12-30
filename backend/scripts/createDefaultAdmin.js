const bcrypt = require('bcryptjs');
const { usersPool } = require('../config/database');

const createDefaultAdmin = async () => {
  try {
    console.log('🔧 Creating default admin user...');

    // Check if admin table exists
    await usersPool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(200),
        role ENUM('super_admin', 'admin') DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Default admin credentials
    const username = 'admin';
    const password = 'admin123';
    const email = 'admin@pharmacy.com';
    const fullName = 'System Administrator';

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if admin exists
    const [existing] = await usersPool.query(
      'SELECT id FROM admin_users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      // Update password
      await usersPool.query(
        'UPDATE admin_users SET password_hash = ? WHERE username = ?',
        [passwordHash, username]
      );
      console.log('✅ Admin user password updated');
    } else {
      // Create admin
      await usersPool.query(
        `INSERT INTO admin_users (username, email, password_hash, full_name, role) 
         VALUES (?, ?, ?, ?, ?)`,
        [username, email, passwordHash, fullName, 'super_admin']
      );
      console.log('✅ Default admin user created');
    }

    console.log('\n📋 Admin Credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Email: ${email}`);
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
};

createDefaultAdmin();

