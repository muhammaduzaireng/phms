# Database Setup Guide

## Overview
This system uses **two MySQL databases**:
1. **Centralized Database** (`u672236642_pharmacy`) - Stores all medicines data
2. **Users Database** (`u672236642_pharmacyUsers`) - Stores user-specific data (stocks, orders, sales)

## Setup Steps

### 1. Install MySQL Dependencies
```bash
npm install
```

### 2. Create Database Tables

#### Option A: Using MySQL Command Line
```bash
# Connect to MySQL server
mysql -h srv1650.hstgr.io -u u672236642_pharmacy -p

# Run the centralized database schema
source database/centralized_db_schema.sql

# Connect to users database
mysql -h srv1650.hstgr.io -u u672236642_pharmacyUsers -p

# Run the users database schema
source database/users_db_schema.sql
```

#### Option B: Using phpMyAdmin or MySQL Workbench
1. Log in to your hosting control panel
2. Open phpMyAdmin
3. Select the database (`u672236642_pharmacy` or `u672236642_pharmacyUsers`)
4. Go to SQL tab
5. Copy and paste the contents of:
   - `database/centralized_db_schema.sql` for medicines database
   - `database/users_db_schema.sql` for users database
6. Click "Go" to execute

### 3. Test Database Connection
```bash
npm run test-db
```

Expected output:
```
✅ Connected to Centralized Database
✅ Connected to Users Database
✅ All database connections successful!
```

### 4. Migrate JSON Data to Database
```bash
npm run migrate
```

This will:
- Read `drap_all.json`
- Insert all medicines into the centralized database
- Create categories and manufacturers entries

Expected output:
```
🔄 Starting data migration...
📦 Found XXXX medicines to migrate
✅ Processed 1000 medicines...
...
✨ Migration completed!
✅ Inserted/Updated: XXXX medicines
```

### 5. Start the Server
```bash
npm start
```

## Database Credentials

### Centralized Database
- **Host:** srv1650.hstgr.io (or 193.203.168.148)
- **Username:** u672236642_pharmacy
- **Password:** Pharmacy@5512
- **Database:** u672236642_pharmacy

### Users Database
- **Host:** srv1650.hstgr.io (or 193.203.168.148)
- **Username:** u672236642_pharmacyUsers
- **Password:** pharmacyUsers@5512
- **Database:** u672236642_pharmacyUsers

## Database Structure

### Centralized Database Tables
- `medicines` - All medicine information
- `categories` - Medicine categories
- `manufacturers` - Medicine manufacturers

### Users Database Tables
- `users` - Pharmacy/user information
- `stock` - User inventory/stock levels
- `custom_products` - Products not in centralized DB
- `purchase_orders` - Purchase orders
- `purchase_order_items` - Items in purchase orders
- `purchase_returns` - Return records for purchases
- `sales` - Sales transactions
- `sales_items` - Items sold
- `sale_returns` - Return records for sales
- `stock_movements` - Track all stock changes
- `sync_log` - For offline/online sync (future use)

## Troubleshooting

### Connection Errors
- Verify your IP address is whitelisted in hosting control panel
- Check database credentials
- Ensure databases exist and user has proper permissions

### Migration Errors
- Ensure JSON file exists: `drap_all.json`
- Check database tables are created
- Verify user has INSERT/UPDATE permissions

### Port Already in Use
- Change PORT in `.env` or `server.js`
- Kill process using the port: `lsof -ti:5001 | xargs kill`

## Next Steps
1. Set up Electron.js desktop application for offline mode
2. Implement return functionality for purchases and sales
3. Add stock management features
4. Create sync mechanism for offline/online data

