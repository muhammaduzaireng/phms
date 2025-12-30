const fs = require('fs');
const path = require('path');
const { centralizedPool } = require('../config/database');

const migrateDataToDB = async () => {
  try {
    console.log('🔄 Starting data migration...');

    // Read JSON file
    const jsonPath = path.join(__dirname, '../../drap_all.json');
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const medicines = JSON.parse(jsonData);

    console.log(`📦 Found ${medicines.length} medicines to migrate`);

    const connection = await centralizedPool.getConnection();

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await connection.query('TRUNCATE TABLE medicines');
    // await connection.query('TRUNCATE TABLE categories');
    // await connection.query('TRUNCATE TABLE manufacturers');

    let inserted = 0;
    let skipped = 0;
    const categories = new Set();
    const manufacturers = new Set();

    for (const medicine of medicines) {
      try {
        // Insert medicine
        await connection.query(
          `INSERT INTO medicines 
          (product_name, generic_name, reg_number, manufacturer, dsl_dml, category, pack_size, price_rs, effective_from)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          product_name = VALUES(product_name),
          generic_name = VALUES(generic_name),
          manufacturer = VALUES(manufacturer),
          dsl_dml = VALUES(dsl_dml),
          category = VALUES(category),
          pack_size = VALUES(pack_size),
          price_rs = VALUES(price_rs),
          effective_from = VALUES(effective_from)`,
          [
            medicine.product_name || '',
            medicine.generic_name || null,
            medicine.reg_number || '',
            medicine.manufacturer || null,
            medicine.dsl_dml || null,
            medicine.category || null,
            medicine.pack_size || null,
            medicine.price_rs || 0,
            medicine.effective_from || null
          ]
        );
        inserted++;

        // Collect categories and manufacturers
        if (medicine.category) categories.add(medicine.category);
        if (medicine.manufacturer) manufacturers.add(medicine.manufacturer);

        if (inserted % 1000 === 0) {
          console.log(`✅ Processed ${inserted} medicines...`);
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          console.error(`❌ Error inserting medicine ${medicine.reg_number}:`, error.message);
        }
      }
    }

    // Insert categories
    console.log('📋 Inserting categories...');
    for (const category of categories) {
      try {
        await connection.query(
          'INSERT IGNORE INTO categories (name) VALUES (?)',
          [category]
        );
      } catch (error) {
        console.error(`Error inserting category ${category}:`, error.message);
      }
    }

    // Insert manufacturers
    console.log('🏭 Inserting manufacturers...');
    for (const manufacturer of manufacturers) {
      try {
        await connection.query(
          'INSERT IGNORE INTO manufacturers (name) VALUES (?)',
          [manufacturer]
        );
      } catch (error) {
        console.error(`Error inserting manufacturer ${manufacturer}:`, error.message);
      }
    }

    connection.release();

    console.log('\n✨ Migration completed!');
    console.log(`✅ Inserted/Updated: ${inserted} medicines`);
    console.log(`⏭️  Skipped (duplicates): ${skipped}`);
    console.log(`📋 Categories: ${categories.size}`);
    console.log(`🏭 Manufacturers: ${manufacturers.size}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateDataToDB();

