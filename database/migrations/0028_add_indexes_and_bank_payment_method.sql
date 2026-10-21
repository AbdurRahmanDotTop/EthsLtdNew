-- Indexes for performance and resource limit protection on Cloudflare D1
CREATE INDEX IF NOT EXISTS idx_deposit_request_status ON "DepositRequest" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS idx_deposit_request_user ON "DepositRequest" ("userId");
CREATE INDEX IF NOT EXISTS idx_deposit_request_ref ON "DepositRequest" ("referenceNumber");
CREATE INDEX IF NOT EXISTS idx_payment_method_enabled ON "PaymentMethod" ("enabled", "displayOrder");
CREATE INDEX IF NOT EXISTS idx_transaction_user_status ON "Transaction" ("userId", "status", "type");

-- Insert primary bank payment method into PaymentMethod table if not already present
INSERT OR IGNORE INTO "PaymentMethod" (
  "id",
  "name",
  "type",
  "bankName",
  "accountHolder",
  "accountNumber",
  "ifscOrSwift",
  "minAmount",
  "instructions",
  "enabled",
  "displayOrder",
  "createdAt",
  "updatedAt"
) VALUES (
  'pm_bank_axis_primary',
  'Axis Bank (Direct Transfer)',
  'BANK',
  'Axis Bank Ltd',
  'ETHSLTD TRADING CORP',
  '921020048192384',
  'UTIB0000004',
  50.0,
  'Transfer funds using IMPS, NEFT, or RTGS. Branch: Mumbai Central Branch. Ensure transaction UTR reference number and payment proof screenshot are submitted.',
  1,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
