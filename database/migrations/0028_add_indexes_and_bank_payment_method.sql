-- Indexes for performance and resource limit protection on Cloudflare D1
CREATE INDEX IF NOT EXISTS idx_deposit_request_status ON real_manual_deposits (status, created_at);
CREATE INDEX IF NOT EXISTS idx_deposit_request_user ON real_manual_deposits (user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_request_ref ON real_manual_deposits (payment_reference);
CREATE INDEX IF NOT EXISTS idx_payment_method_enabled ON payment_methods (enabled, display_order);
CREATE INDEX IF NOT EXISTS idx_transaction_user_status ON ledger_transactions (status, created_at);

-- Insert primary bank payment method into payment_methods table if not already present
INSERT OR IGNORE INTO payment_methods (
  id,
  environment,
  method,
  enabled,
  maintenance_mode,
  display_order,
  min_amount,
  max_amount,
  fee_type,
  fee_value,
  instructions,
  created_at,
  updated_at
) VALUES (
  'pm_bank_axis_primary',
  'REAL',
  'BANK_TRANSFER',
  1,
  0,
  1,
  50.0,
  100000.0,
  'ZERO',
  0.0,
  'Transfer funds using IMPS, NEFT, or RTGS. Axis Bank Ltd, ETHSLTD TRADING CORP, A/C: 921020048192384, IFSC: UTIB0000004. Branch: Mumbai Central Branch. Ensure transaction UTR reference number and payment proof screenshot are submitted.',
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000
);

