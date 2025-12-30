# Admin Panel Setup Guide

## Overview
The Admin Panel allows you to manage multiple pharmacy accounts from a central location. You can create, view, edit, and deactivate pharmacy accounts.

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Admin Database Tables
Run the admin schema SQL file on your users database:

```bash
# Using MySQL command line
mysql -h srv1650.hstgr.io -u u672236642_pharmacyUsers -p u672236642_pharmacyUsers < database/admin_schema.sql
```

**Or** use phpMyAdmin:
1. Select `u672236642_pharmacyUsers` database
2. Go to SQL tab
3. Copy and paste contents of `database/admin_schema.sql`
4. Click Go

### 3. Create Default Admin User
```bash
npm run create-admin
```

This will create a default admin user:
- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `admin@pharmacy.com`

⚠️ **IMPORTANT:** Change the default password after first login!

### 4. Access Admin Panel

1. Start the server:
   ```bash
   npm start
   ```

2. Start the frontend:
   ```bash
   npm run frontend
   ```

3. Navigate to Admin Panel:
   - Click "Admin Panel" in the navigation
   - Or go directly to the admin section
   - Login with: `admin` / `admin123`

## Admin Panel Features

### 1. Dashboard
- View total pharmacies
- Active pharmacies count
- Total revenue across all pharmacies
- Total sales and purchase orders

### 2. Manage Pharmacies
- View all pharmacy accounts
- Search pharmacies
- See pharmacy statistics (sales, orders)
- Activate/deactivate pharmacies

### 3. Create Pharmacy
- Create new pharmacy accounts
- Set pharmacy information (name, owner, contact)
- Set subscription status (trial, active, expired)
- Assign license and tax information

## API Endpoints

### Admin Authentication
- `POST /api/admin/login` - Admin login
- All admin endpoints require `Authorization: Bearer <token>` header

### Pharmacy Management
- `GET /api/admin/pharmacies` - List all pharmacies
- `GET /api/admin/pharmacies/:id` - Get pharmacy details
- `POST /api/admin/pharmacies` - Create new pharmacy
- `PUT /api/admin/pharmacies/:id` - Update pharmacy
- `DELETE /api/admin/pharmacies/:id` - Deactivate pharmacy

### Dashboard
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/activity-log` - View admin activity log

## How It Works

1. **Admin Creates Pharmacy Account**
   - Admin logs into admin panel
   - Creates a new pharmacy account
   - System generates a username and account

2. **Pharmacy Uses POS**
   - Each pharmacy gets their own account
   - They can log in and use POS system
   - All data is isolated per pharmacy (user_id)

3. **Centralized Medicines Database**
   - All pharmacies share the same medicines database
   - Medicines are read-only for pharmacies
   - Admin can manage medicine data centrally

4. **User-Specific Data**
   - Each pharmacy has their own:
     - Stock/inventory
     - Sales transactions
     - Purchase orders
     - Custom products
     - Profile information

## Security Notes

1. **Change Default Password**
   - First thing after login: change admin password
   - Use strong passwords

2. **JWT Tokens**
   - Tokens expire after 24 hours
   - Store tokens securely
   - Don't share admin credentials

3. **IP Whitelisting**
   - Consider whitelisting admin panel access
   - Monitor admin activity logs

## Troubleshooting

### Can't Login
- Verify admin user exists: `npm run create-admin`
- Check password (default: `admin123`)
- Check database connection

### Can't Create Pharmacy
- Verify users database is connected
- Check admin token is valid
- Check database permissions

### Pharmacy Can't Login
- Verify pharmacy account is active (`is_active = TRUE`)
- Check subscription status
- Verify username exists in database

## Next Steps

1. Create your first pharmacy account
2. Test POS functionality with pharmacy account
3. Monitor activity through admin dashboard
4. Set up proper authentication for pharmacy users

