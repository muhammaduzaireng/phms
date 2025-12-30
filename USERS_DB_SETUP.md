# Users Database Setup Guide

## Issue: Access Denied Error

If you're seeing:
```
❌ Database connection error: Access denied for user 'u672236642_pharmacyUsers'@'YOUR_IP'
```

## Solution Steps

### Step 1: Create Database and User in Hosting Panel

1. Log in to your hosting control panel (cPanel, Plesk, etc.)
2. Go to **MySQL Databases** or **Database** section
3. Create a new database: `u672236642_pharmacyUsers`
4. Create a new MySQL user: `u672236642_pharmacyUsers`
5. Set the password to: `pharmacyUsers@5512`
6. **Grant ALL privileges** to the user on the database

### Step 2: Whitelist Your IP Address

1. In your hosting panel, find **Remote MySQL** or **MySQL Remote Access**
2. Add your current IP address: `182.186.66.247` (or use `%` for all IPs - less secure)
3. Save the changes

### Step 3: Create Database Tables

After creating the database, run the SQL schema:

```bash
# Option 1: Using MySQL command line
mysql -h srv1650.hstgr.io -u u672236642_pharmacyUsers -p u672236642_pharmacyUsers < database/users_db_schema.sql
```

**Or** use phpMyAdmin:
1. Go to phpMyAdmin
2. Select `u672236642_pharmacyUsers` database
3. Click SQL tab
4. Copy and paste contents of `database/users_db_schema.sql`
5. Click Go

### Step 4: Verify Connection

```bash
npm run test-db
```

Expected output:
```
✅ Connected to Centralized Database
✅ Connected to Users Database
✅ All database connections successful!
```

## Alternative: Run Server Without Users DB (Temporary)

If you need to run the server immediately while setting up the users database:

1. Open `backend/config/database.js`
2. Change line: `const ENABLE_USERS_DB = true;` to `const ENABLE_USERS_DB = false;`
3. Restart server

**Note:** This will disable user-specific features like:
- Stock management
- Purchase orders
- Sales tracking
- Custom products
- Profile management

But you can still browse medicines from the centralized database.

## Verify Database Credentials

Double-check these credentials in your hosting panel:

### Users Database
- **Host:** srv1650.hstgr.io
- **Username:** u672236642_pharmacyUsers
- **Password:** pharmacyUsers@5512
- **Database:** u672236642_pharmacyUsers

If any of these are different, update them in `backend/config/database.js`

## Common Issues

### Issue 1: User Doesn't Exist
**Solution:** Create the MySQL user in your hosting panel

### Issue 2: Wrong Password
**Solution:** Reset password in hosting panel and update `backend/config/database.js`

### Issue 3: IP Not Whitelisted
**Solution:** Add your IP to Remote MySQL access in hosting panel

### Issue 4: Database Doesn't Exist
**Solution:** Create the database in hosting panel first

### Issue 5: User Has No Permissions
**Solution:** Grant ALL privileges to the user on the database

## Test Database Connection Manually

You can test the connection using MySQL command line:

```bash
mysql -h srv1650.hstgr.io -u u672236642_pharmacyUsers -p
# Enter password: pharmacyUsers@5512

# Then try:
USE u672236642_pharmacyUsers;
SHOW TABLES;
```

If this works, the credentials are correct and the issue might be with the Node.js connection pool settings.

## Still Having Issues?

1. Check hosting panel for any database connection limits
2. Verify database server is running
3. Contact your hosting provider to verify:
   - Database exists
   - User exists and has correct password
   - IP is whitelisted
   - User has proper permissions

