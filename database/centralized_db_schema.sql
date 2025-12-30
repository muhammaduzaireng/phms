-- Centralized Database Schema
-- Database: u672236642_pharmacy
-- This database stores all medicines information (read-only for most operations)

CREATE DATABASE IF NOT EXISTS `u672236642_pharmacy` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `u672236642_pharmacy`;

-- Medicines Table - Stores all medicines from JSON data
CREATE TABLE IF NOT EXISTS `medicines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_name` VARCHAR(500) NOT NULL,
  `generic_name` TEXT,
  `reg_number` VARCHAR(100) UNIQUE NOT NULL,
  `manufacturer` VARCHAR(500),
  `dsl_dml` VARCHAR(100),
  `category` VARCHAR(200),
  `pack_size` VARCHAR(200),
  `price_rs` DECIMAL(10, 2),
  `effective_from` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_reg_number` (`reg_number`),
  INDEX `idx_product_name` (`product_name`(255)),
  INDEX `idx_category` (`category`),
  INDEX `idx_manufacturer` (`manufacturer`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories Table - For faster category filtering
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) UNIQUE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Manufacturers Table - For faster manufacturer filtering
CREATE TABLE IF NOT EXISTS `manufacturers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(500) UNIQUE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

