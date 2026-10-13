-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "transactionPin" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0.0,
    "type" TEXT NOT NULL DEFAULT 'Currency',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL DEFAULT '',
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "iban" TEXT,
    "bankAddress" TEXT,
    "swiftCode" TEXT,
    "ifscCode" TEXT,
    "branchName" TEXT,
    "country" TEXT DEFAULT 'India',
    "fullName" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCryptoWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "memo" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserCryptoWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Perpetual',
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "price" REAL NOT NULL,
    "leverage" REAL,
    "margin" REAL,
    "duration" INTEGER,
    "payout" REAL,
    "closePrice" REAL,
    "realizedPnl" REAL,
    "status" TEXT NOT NULL,
    "stopProfit" REAL,
    "stopLoss" REAL,
    "clientOrderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KycApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "idFrontUrl" TEXT,
    "idBackUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KycApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepositRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "method" TEXT NOT NULL DEFAULT 'BANK',
    "bankName" TEXT,
    "referenceNumber" TEXT NOT NULL,
    "proofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepositRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0.0,
    "receiveAmount" REAL NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "method" TEXT NOT NULL DEFAULT 'BANK',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountHolder" TEXT,
    "fullName" TEXT,
    "ifscCode" TEXT,
    "branchName" TEXT,
    "country" TEXT,
    "network" TEXT,
    "walletAddress" TEXT,
    "walletLabel" TEXT,
    "memo" TEXT,
    "methodSnapshot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "txHash" TEXT,
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "accountHolder" TEXT,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "ifscOrSwift" TEXT,
    "address" TEXT,
    "network" TEXT,
    "instructions" TEXT,
    "minAmount" REAL NOT NULL DEFAULT 10.0,
    "maxAmount" REAL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "badge" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "bgType" TEXT NOT NULL DEFAULT 'GRADIENT',
    "bgValue" TEXT NOT NULL DEFAULT 'from-blue-900 via-blue-800 to-indigo-900',
    "badgeColor" TEXT NOT NULL DEFAULT '#FACC15',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "subtitleColor" TEXT NOT NULL DEFAULT '#BFDBFE',
    "btnText" TEXT,
    "btnLink" TEXT,
    "btnEnabled" BOOLEAN NOT NULL DEFAULT true,
    "btnBgColor" TEXT NOT NULL DEFAULT '#00A070',
    "btnTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL,
    "quoteAsset" TEXT NOT NULL DEFAULT 'USDT',
    "displayName" TEXT NOT NULL,
    "binanceSymbol" TEXT NOT NULL,
    "iconUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'CRYPTO',
    "tradingModes" TEXT NOT NULL DEFAULT 'ALL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "pricePrecision" INTEGER NOT NULL DEFAULT 2,
    "qtyPrecision" INTEGER NOT NULL DEFAULT 4,
    "minOrderQty" REAL NOT NULL DEFAULT 0.001,
    "maxOrderQty" REAL NOT NULL DEFAULT 1000000,
    "minMargin" REAL NOT NULL DEFAULT 1.0,
    "maxLeverage" INTEGER NOT NULL DEFAULT 100,
    "payoutRate" REAL NOT NULL DEFAULT 1.8,
    "isListedOnHome" BOOLEAN NOT NULL DEFAULT true,
    "isTopTicker" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmailConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT,
    "port" INTEGER DEFAULT 587,
    "encryption" TEXT DEFAULT 'TLS',
    "username" TEXT,
    "password" TEXT,
    "apiKey" TEXT,
    "fromEmail" TEXT NOT NULL DEFAULT 'support@ethsltd.com',
    "fromName" TEXT NOT NULL DEFAULT 'ETHSLTD Security',
    "replyTo" TEXT,
    "adminEmails" TEXT,
    "notifyOnRegistration" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnDeposit" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnWithdrawal" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnKyc" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "messageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RmProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rmCode" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT 'Senior Crypto Relationship Manager',
    "department" TEXT NOT NULL DEFAULT 'Private Wealth & Institutional Trading',
    "bio" TEXT DEFAULT 'Experienced digital asset advisor specializing in crypto spot, perpetual futures and options risk management.',
    "specialties" TEXT NOT NULL DEFAULT 'Perpetual Futures, Hedging, Options, Portfolio Allocation',
    "avatarUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "workingHours" TEXT NOT NULL DEFAULT '09:00 - 21:00 UTC',
    "rating" REAL NOT NULL DEFAULT 4.9,
    "experienceYears" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "maxClients" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RmProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RmConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "rmId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestMessage" TEXT,
    "responseNotes" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "activatedAt" DATETIME,
    "terminatedAt" DATETIME,
    "reassignedFromRmId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RmConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RmConnection_rmId_fkey" FOREIGN KEY ("rmId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvestmentContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNumber" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rmId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'ETH Investment Contract',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "partyAName" TEXT NOT NULL,
    "partyARole" TEXT NOT NULL DEFAULT 'Platform Relationship Manager (Party A)',
    "partyASignature" TEXT,
    "partyASignedAt" DATETIME,
    "partyASignerIp" TEXT,
    "partyASignerUid" INTEGER,
    "partyBName" TEXT NOT NULL,
    "partyBRole" TEXT NOT NULL DEFAULT 'Investor / Client (Party B)',
    "partyBSignature" TEXT,
    "partyBSignedAt" DATETIME,
    "partyBSignerIp" TEXT,
    "partyBSignerUid" INTEGER,
    "termsText" TEXT NOT NULL,
    "companyLegalName" TEXT NOT NULL DEFAULT 'ETHSLTD Financial Technology Research Group',
    "websiteUrl" TEXT NOT NULL DEFAULT 'https://www.ethsltd.com',
    "jurisdiction" TEXT NOT NULL DEFAULT 'Virtual Currency International Investment Contract Law',
    "effectiveDate" DATETIME,
    "expiresAt" DATETIME,
    "auditTrail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvestmentContract_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "RmConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentContract_rmId_fkey" FOREIGN KEY ("rmId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RmConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rmId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RmConversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "RmConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RmConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RmConversation_rmId_fkey" FOREIGN KEY ("rmId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RmMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RmMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RmConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RmMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RmNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RmNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_asset_type_key" ON "Wallet"("userId", "asset", "type");

-- CreateIndex
CREATE INDEX "Order_userId_clientOrderId_idx" ON "Order"("userId", "clientOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "KycApplication_userId_key" ON "KycApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_symbol_key" ON "Market"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE INDEX "VerificationToken_identifier_type_idx" ON "VerificationToken"("identifier", "type");

-- CreateIndex
CREATE INDEX "EmailLog_recipient_idx" ON "EmailLog"("recipient");

-- CreateIndex
CREATE INDEX "EmailLog_eventType_idx" ON "EmailLog"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "RmProfile_userId_key" ON "RmProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RmProfile_rmCode_key" ON "RmProfile"("rmCode");

-- CreateIndex
CREATE INDEX "RmConnection_userId_status_idx" ON "RmConnection"("userId", "status");

-- CreateIndex
CREATE INDEX "RmConnection_rmId_status_idx" ON "RmConnection"("rmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RmConnection_userId_rmId_key" ON "RmConnection"("userId", "rmId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentContract_contractNumber_key" ON "InvestmentContract"("contractNumber");

-- CreateIndex
CREATE INDEX "InvestmentContract_userId_status_idx" ON "InvestmentContract"("userId", "status");

-- CreateIndex
CREATE INDEX "InvestmentContract_rmId_status_idx" ON "InvestmentContract"("rmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RmConversation_connectionId_key" ON "RmConversation"("connectionId");

-- CreateIndex
CREATE INDEX "RmConversation_userId_idx" ON "RmConversation"("userId");

-- CreateIndex
CREATE INDEX "RmConversation_rmId_idx" ON "RmConversation"("rmId");

-- CreateIndex
CREATE INDEX "RmMessage_conversationId_createdAt_idx" ON "RmMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "RmMessage_senderId_isRead_idx" ON "RmMessage"("senderId", "isRead");

-- CreateIndex
CREATE INDEX "RmNotification_userId_isRead_idx" ON "RmNotification"("userId", "isRead");

-- P2P Marketplace Tables
CREATE TABLE IF NOT EXISTS "P2pAd" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayId" TEXT UNIQUE,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "fiat" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "isFloating" BOOLEAN NOT NULL DEFAULT false,
    "priceMargin" TEXT,
    "totalAmount" TEXT NOT NULL,
    "availableAmount" TEXT NOT NULL,
    "minLimit" TEXT NOT NULL,
    "maxLimit" TEXT NOT NULL,
    "paymentWindow" INTEGER NOT NULL DEFAULT 15,
    "paymentMethods" TEXT NOT NULL,
    "terms" TEXT,
    "autoReply" TEXT,
    "countryRestrictions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "P2pAd_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "P2pOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayId" TEXT UNIQUE,
    "adId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "cryptoAmount" TEXT NOT NULL,
    "fiatAmount" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "paymentMethod" TEXT NOT NULL,
    "paymentDetails" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "P2pOrder_adId_fkey" FOREIGN KEY ("adId") REFERENCES "P2pAd" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "P2pOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "P2pOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "P2pMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "attachmentUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "P2pMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "P2pOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "P2pMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "P2pDispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayId" TEXT UNIQUE,
    "orderId" TEXT NOT NULL,
    "openerId" TEXT NOT NULL,
    "assignedAdminId" TEXT,
    "reason" TEXT NOT NULL,
    "evidenceUrls" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "P2pDispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "P2pOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "P2pDispute_openerId_fkey" FOREIGN KEY ("openerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "P2pDispute_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "P2pPaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "P2pPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "P2pFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "P2pFeedback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "P2pOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "P2pFeedback_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "P2pFeedback_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "P2pAd_userId_status_idx" ON "P2pAd"("userId", "status");
CREATE INDEX IF NOT EXISTS "P2pAd_type_asset_fiat_status_idx" ON "P2pAd"("type", "asset", "fiat", "status");
CREATE INDEX IF NOT EXISTS "P2pOrder_buyerId_status_idx" ON "P2pOrder"("buyerId", "status");
CREATE INDEX IF NOT EXISTS "P2pOrder_sellerId_status_idx" ON "P2pOrder"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "P2pOrder_adId_idx" ON "P2pOrder"("adId");
CREATE INDEX IF NOT EXISTS "P2pMessage_orderId_createdAt_idx" ON "P2pMessage"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "P2pDispute_orderId_idx" ON "P2pDispute"("orderId");
CREATE INDEX IF NOT EXISTS "P2pDispute_openerId_status_idx" ON "P2pDispute"("openerId", "status");
CREATE INDEX IF NOT EXISTS "P2pDispute_status_idx" ON "P2pDispute"("status");
CREATE INDEX IF NOT EXISTS "P2pPaymentMethod_userId_isActive_idx" ON "P2pPaymentMethod"("userId", "isActive");

