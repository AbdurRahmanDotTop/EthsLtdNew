-- Link orders to positions for traceability (MT5 ticket-style linkage)
ALTER TABLE `orders` ADD `position_id` text REFERENCES `positions`(`id`);

-- Link positions back to their creating order
ALTER TABLE `positions` ADD `order_id` text REFERENCES `orders`(`id`);

-- Track when a position was closed and at what price
ALTER TABLE `positions` ADD `closed_at` integer;
ALTER TABLE `positions` ADD `close_price` text;

-- Idempotency key to prevent duplicate order/position creation on retries
ALTER TABLE `orders` ADD `idempotency_key` text;
CREATE INDEX IF NOT EXISTS `idx_orders_idempotency_key` ON `orders`(`idempotency_key`);
