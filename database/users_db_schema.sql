-- Users Database Schema
-- Database: u672236642_pharmacyUsers
-- This database stores user-specific data (stocks, orders, sales, custom products)

CREATE DATABASE IF NOT EXISTS `u672236642_pharmacyUsers` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `u672236642_pharmacyUsers`;

-- Users/Pharmacies Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) UNIQUE NOT NULL,
  `pharmacy_name` VARCHAR(500),
  `owner_name` VARCHAR(200),
  `address` TEXT,
  `city` VARCHAR(200),
  `phone` VARCHAR(50),
  `email` VARCHAR(200),
  `license_number` VARCHAR(100),
  `tax_id` VARCHAR(100),
  `logo_url` VARCHAR(500),
  `password_hash` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock Table - User's inventory (supports multiple batches per product)
CREATE TABLE IF NOT EXISTS `stock` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `medicine_reg_number` VARCHAR(100),
  `custom_product_id` INT,
  `quantity` INT NOT NULL DEFAULT 0,
  `min_stock_level` INT DEFAULT 0,
  `max_stock_level` INT DEFAULT 0,
  `unit_price` DECIMAL(10, 2),
  `purchase_price` DECIMAL(10, 2) DEFAULT 0,
  `expiry_date` DATE,
  `batch_number` VARCHAR(100),
  `location` VARCHAR(200),
  `is_deleted` BOOLEAN DEFAULT FALSE,
  `deletion_comment` TEXT NULL,
  `deleted_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_medicine` (`user_id`, `medicine_reg_number`),
  INDEX `idx_user_custom` (`user_id`, `custom_product_id`),
  INDEX `idx_user_product_active` (`user_id`, `medicine_reg_number`, `custom_product_id`, `is_deleted`),
  INDEX `idx_batch_order` (`user_id`, `created_at`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Custom Products Table - Products not in centralized DB
CREATE TABLE IF NOT EXISTS `custom_products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `name` VARCHAR(500) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(200),
  `unit` VARCHAR(50) DEFAULT 'piece',
  `barcode` VARCHAR(100),
  `price` DECIMAL(10, 2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `po_number` VARCHAR(100) UNIQUE NOT NULL,
  `supplier_name` VARCHAR(500) NOT NULL,
  `supplier_contact` VARCHAR(200),
  `expected_date` DATE,
  `received_date` DATE,
  `notes` TEXT,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('pending', 'approved', 'received', 'cancelled', 'returned') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_po_number` (`po_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase Order Items Table
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_order_id` INT NOT NULL,
  `medicine_reg_number` VARCHAR(100),
  `custom_product_id` INT,
  `item_name` VARCHAR(500) NOT NULL,
  `quantity` INT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `total` DECIMAL(10, 2) NOT NULL,
  `received_quantity` INT DEFAULT 0,
  `returned_quantity` INT DEFAULT 0,
  FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`custom_product_id`) REFERENCES `custom_products`(`id`) ON DELETE SET NULL,
  INDEX `idx_po_id` (`purchase_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase Returns Table
CREATE TABLE IF NOT EXISTS `purchase_returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `purchase_order_id` INT NOT NULL,
  `return_number` VARCHAR(100) UNIQUE NOT NULL,
  `return_date` DATE NOT NULL,
  `reason` TEXT,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('pending', 'approved', 'completed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_po_id` (`purchase_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase Return Items Table
CREATE TABLE IF NOT EXISTS `purchase_return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_return_id` INT NOT NULL,
  `purchase_order_item_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `total` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales/Transactions Table
CREATE TABLE IF NOT EXISTS `sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `transaction_id` VARCHAR(100) UNIQUE NOT NULL,
  `customer_name` VARCHAR(200) DEFAULT 'Walk-in Customer',
  `customer_phone` VARCHAR(50),
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `discount_amount` DECIMAL(10, 2) DEFAULT 0,
  `discount_percent` DECIMAL(5, 2) DEFAULT 0,
  `tax_amount` DECIMAL(10, 2) DEFAULT 0,
  `tax_percent` DECIMAL(5, 2) DEFAULT 0,
  `total` DECIMAL(10, 2) NOT NULL,
  `payment_method` ENUM('cash', 'card', 'bank_transfer', 'mobile_payment') DEFAULT 'cash',
  `status` ENUM('completed', 'cancelled', 'returned') DEFAULT 'completed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_transaction_id` (`transaction_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales Items Table
CREATE TABLE IF NOT EXISTS `sales_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `medicine_reg_number` VARCHAR(100),
  `custom_product_id` INT,
  `item_name` VARCHAR(500) NOT NULL,
  `quantity` INT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `total` DECIMAL(10, 2) NOT NULL,
  `purchase_price` DECIMAL(10, 2) DEFAULT 0,
  `profit` DECIMAL(10, 2) DEFAULT 0,
  `returned_quantity` INT DEFAULT 0,
  FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`custom_product_id`) REFERENCES `custom_products`(`id`) ON DELETE SET NULL,
  INDEX `idx_sale_id` (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sale Returns Table
CREATE TABLE IF NOT EXISTS `sale_returns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `sale_id` INT NOT NULL,
  `return_number` VARCHAR(100) UNIQUE NOT NULL,
  `return_date` DATE NOT NULL,
  `customer_name` VARCHAR(200),
  `reason` TEXT,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('pending', 'approved', 'completed') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_sale_id` (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sale Return Items Table
CREATE TABLE IF NOT EXISTS `sale_return_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_return_id` INT NOT NULL,
  `sale_item_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `total` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`sale_return_id`) REFERENCES `sale_returns`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sale_item_id`) REFERENCES `sales_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock Movements Table - Track all stock changes
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `medicine_reg_number` VARCHAR(100),
  `custom_product_id` INT,
  `movement_type` ENUM('purchase', 'sale', 'return_in', 'return_out', 'adjustment', 'transfer') NOT NULL,
  `quantity_change` INT NOT NULL,
  `reference_id` INT,
  `reference_type` VARCHAR(50),
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_product` (`user_id`, `medicine_reg_number`, `custom_product_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sync Log Table - For tracking offline/online sync
CREATE TABLE IF NOT EXISTS `sync_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `table_name` VARCHAR(100) NOT NULL,
  `record_id` INT NOT NULL,
  `operation` ENUM('create', 'update', 'delete') NOT NULL,
  `data` JSON,
  `synced` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `synced_at` TIMESTAMP NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_synced` (`user_id`, `synced`),
  INDEX `idx_table_record` (`table_name`, `record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

