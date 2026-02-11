-- Migration: Add batch management and soft delete to stock table
-- This migration adds purchase_price, is_deleted, and deletion_comment columns

USE `u672236642_pharmacyUsers`;

-- Add purchase_price column if it doesn't exist
ALTER TABLE `stock` 
ADD COLUMN IF NOT EXISTS `purchase_price` DECIMAL(10, 2) DEFAULT 0 AFTER `unit_price`;

-- Add soft delete columns
ALTER TABLE `stock` 
ADD COLUMN IF NOT EXISTS `is_deleted` BOOLEAN DEFAULT FALSE AFTER `location`,
ADD COLUMN IF NOT EXISTS `deletion_comment` TEXT NULL AFTER `is_deleted`,
ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL AFTER `deletion_comment`;

-- Create index for filtering active stocks
CREATE INDEX IF NOT EXISTS `idx_user_product_active` ON `stock` (`user_id`, `medicine_reg_number`, `custom_product_id`, `is_deleted`);
CREATE INDEX IF NOT EXISTS `idx_batch_order` ON `stock` (`user_id`, `created_at`, `is_deleted`);

-- Add stock_batch_id to sales_items to track which batch items were sold from (for returns)
ALTER TABLE `sales_items` 
ADD COLUMN IF NOT EXISTS `stock_batch_id` INT NULL AFTER `profit`;

-- Add foreign key for stock_batch_id (if not exists)
-- Note: IF NOT EXISTS doesn't work for foreign keys, so we'll skip it if it exists
ALTER TABLE `sales_items` 
ADD INDEX IF NOT EXISTS `idx_stock_batch_id` (`stock_batch_id`);

-- Note: Foreign key constraint should be added manually if needed:
-- ALTER TABLE `sales_items` ADD FOREIGN KEY (`stock_batch_id`) REFERENCES `stock`(`id`) ON DELETE SET NULL;
