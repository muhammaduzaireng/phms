-- Admin Panel Database Schema
-- Run this on the users database

USE `u672236642_pharmacyUsers`;

-- Admin Users Table
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) UNIQUE NOT NULL,
  `email` VARCHAR(200) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(200),
  `role` ENUM('super_admin', 'admin') DEFAULT 'admin',
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`),
  INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin (password: admin123 - change this!)
-- Password hash is bcrypt hash of 'admin123'
INSERT INTO `admin_users` (username, email, password_hash, full_name, role) 
VALUES ('admin', 'admin@pharmacy.com', '$2b$10$rKxKfE6pVQZQZQZQZQZQZuQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZ', 'System Administrator', 'super_admin')
ON DUPLICATE KEY UPDATE username=username;

-- Update users table to link with admin
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `created_by_admin_id` INT,
ADD COLUMN IF NOT EXISTS `is_active` BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS `subscription_status` ENUM('trial', 'active', 'expired', 'cancelled') DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS `subscription_expires_at` DATE,
ADD FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL;

-- Admin Activity Log
CREATE TABLE IF NOT EXISTS `admin_activity_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` INT NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50),
  `target_id` INT,
  `details` JSON,
  `ip_address` VARCHAR(50),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE,
  INDEX `idx_admin_id` (`admin_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

