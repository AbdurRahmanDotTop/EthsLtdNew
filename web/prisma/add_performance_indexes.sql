-- Performance indexes for Cloudflare D1
CREATE INDEX IF NOT EXISTS User_role_status_idx ON User(role, status);
CREATE INDEX IF NOT EXISTS InvestmentContract_connectionId_idx ON InvestmentContract(connectionId);
CREATE INDEX IF NOT EXISTS InvestmentContract_connectionId_status_idx ON InvestmentContract(connectionId, status);
CREATE INDEX IF NOT EXISTS RmMessage_conversationId_isRead_idx ON RmMessage(conversationId, isRead);
CREATE INDEX IF NOT EXISTS Order_userId_status_idx ON "Order"(userId, status);
CREATE INDEX IF NOT EXISTS Order_category_status_idx ON "Order"(category, status);
CREATE INDEX IF NOT EXISTS WithdrawalRequest_userId_status_idx ON WithdrawalRequest(userId, status);
