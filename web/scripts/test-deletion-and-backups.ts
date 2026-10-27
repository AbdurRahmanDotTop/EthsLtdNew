/**
 * Automated Verification Suite for:
 * 1. Complete User Deletion & Cascade Purge
 * 2. Super Admin Safeguards & Protected Accounts
 * 3. Full Database Export, Manifest, and SHA-256 Checksum Verification
 * 4. Website Configuration Export & Restoration
 * 5. Media Archive Export & Validation
 * 6. Clean Project Source Code ZIP Generation
 */

import prisma from "../src/lib/prisma";
import {
  adminDeleteUser,
} from "../src/actions/admin";
import {
  generateFullDatabaseExport,
  generateWebsiteConfigExport,
  generateMediaArchiveExport,
  generateProjectSourceExport,
  validateBackupPackage,
  restoreWebsiteConfiguration,
} from "../src/lib/backup-service";

async function runTests() {
  console.log("===============================================================");
  console.log("🚀 STARTING COMPLETE USER DELETION & BACKUP/RESTORE TEST SUITE");
  console.log("===============================================================\n");

  // Mock CLI test mode
  process.env.CLI_TEST_MODE = "true";

  // Find or verify Super Admin exists
  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });
  if (!superAdmin) {
    throw new Error("No Super Admin found in database for test execution.");
  }
  console.log(`✅ Verified Super Admin: ${superAdmin.email} (UID: ${superAdmin.uid})`);

  // --------------------------------------------------------------------------
  // TEST 1: SAFEGUARD - PREVENT DELETION OF PROTECTED SUPER ADMIN
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 1: Protected Account Safeguards ---");
  const protectResult = await adminDeleteUser(superAdmin.id);
  console.log("Attempted Super Admin deletion response:", protectResult);
  if (protectResult.success) {
    throw new Error("❌ FAIL: Protected Super Admin account was deleted! Safeguard failed.");
  }
  console.log("✅ PASS: Protected Super Admin account deletion was blocked successfully.");

  // --------------------------------------------------------------------------
  // TEST 2: CREATE TEST USER WITH COMPLETE MULTI-MODEL RELATIONS
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Seed Test User with Full Relational Ecosystem ---");
  const testEmail = `test_purge_${Date.now()}@testeths.com`;
  const testUid = Math.floor(100000 + Math.random() * 900000);

  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      uid: testUid,
      passwordHash: "hash_test_123",
      name: "Deletable Test User",
      role: "USER",
      status: "ACTIVE",
    },
  });
  console.log(`Created test user: ID ${testUser.id}, UID ${testUser.uid}, Email: ${testUser.email}`);

  // Seed wallets
  await prisma.wallet.createMany({
    data: [
      { userId: testUser.id, asset: "USDT", balance: 500.0, type: "Currency" },
      { userId: testUser.id, asset: "BTC", balance: 0.05, type: "Currency" },
      { userId: testUser.id, asset: "USDT", balance: 100.0, type: "Contract" },
    ],
  });

  // Seed bank card & crypto wallet
  await prisma.bankCard.create({
    data: {
      userId: testUser.id,
      bankName: "HDFC Bank",
      accountHolder: "Test User",
      accountNumber: "9876543210",
      fullName: "Test User",
    },
  });

  await prisma.userCryptoWallet.create({
    data: {
      userId: testUser.id,
      asset: "USDT",
      network: "TRC20",
      address: "TTestAddressPurge1234567890",
      label: "Personal Test Wallet",
    },
  });

  // Seed order & transaction
  await prisma.order.create({
    data: {
      userId: testUser.id,
      symbol: "BTC/USDT",
      type: "Buy Long",
      amount: 100.0,
      price: 65000.0,
      status: "Closed",
    },
  });

  await prisma.transaction.create({
    data: {
      userId: testUser.id,
      type: "Deposit",
      asset: "USDT",
      amount: 500.0,
      status: "Passed",
    },
  });

  // Seed KYC application
  await prisma.kycApplication.create({
    data: {
      userId: testUser.id,
      documentType: "GOVERNMENT_ID",
      idNumber: "ID-PURGE-9999",
      address: "123 Test Street",
      status: "PENDING",
    },
  });

  // Seed deposit & withdrawal request
  await prisma.depositRequest.create({
    data: {
      userId: testUser.id,
      amount: 250.0,
      asset: "USDT",
      referenceNumber: "DEP-PURGE-1234",
      status: "PENDING",
    },
  });

  await prisma.withdrawalRequest.create({
    data: {
      userId: testUser.id,
      amount: 50.0,
      receiveAmount: 49.0,
      asset: "USDT",
      status: "PENDING",
    },
  });

  // Seed verification token
  await prisma.verificationToken.create({
    data: {
      identifier: testUser.email,
      token: `token_${Date.now()}`,
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  // Seed P2P Ad & Payment Method
  const testAd = await prisma.p2pAd.create({
    data: {
      userId: testUser.id,
      type: "BUY",
      asset: "USDT",
      fiat: "INR",
      price: "90.5",
      totalAmount: "500",
      availableAmount: "500",
      minLimit: "1000",
      maxLimit: "50000",
      paymentMethods: JSON.stringify(["UPI", "IMPS"]),
      status: "ACTIVE",
    },
  });

  await prisma.p2pPaymentMethod.create({
    data: {
      userId: testUser.id,
      type: "UPI",
      name: "Google Pay",
      details: JSON.stringify({ upiId: "test@okaxis" }),
    },
  });

  console.log("✅ Seeded complete relational profile across 10+ models for test user.");

  // Verify records exist before purge
  const preWallets = await prisma.wallet.count({ where: { userId: testUser.id } });
  const preOrders = await prisma.order.count({ where: { userId: testUser.id } });
  const preKyc = await prisma.kycApplication.count({ where: { userId: testUser.id } });
  const preTokens = await prisma.verificationToken.count({ where: { identifier: testUser.email } });
  console.log(`Pre-purge count verification: Wallets=${preWallets}, Orders=${preOrders}, KYC=${preKyc}, Tokens=${preTokens}`);

  if (preWallets === 0 || preOrders === 0 || preKyc === 0) {
    throw new Error("❌ Seed data verification failed.");
  }

  // --------------------------------------------------------------------------
  // TEST 3: EXECUTE COMPLETE USER PERMANENT DELETION
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Executing adminDeleteUser ---");
  const deleteResult = await adminDeleteUser(testUser.id);
  console.log("Deletion result:", deleteResult);

  if (!deleteResult.success) {
    throw new Error(`❌ User deletion failed: ${deleteResult.error}`);
  }
  console.log("✅ adminDeleteUser returned success.");

  // Verify all records are deleted
  const postUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  const postWallets = await prisma.wallet.count({ where: { userId: testUser.id } });
  const postOrders = await prisma.order.count({ where: { userId: testUser.id } });
  const postTxs = await prisma.transaction.count({ where: { userId: testUser.id } });
  const postKyc = await prisma.kycApplication.count({ where: { userId: testUser.id } });
  const postDeposits = await prisma.depositRequest.count({ where: { userId: testUser.id } });
  const postWithdrawals = await prisma.withdrawalRequest.count({ where: { userId: testUser.id } });
  const postBankCards = await prisma.bankCard.count({ where: { userId: testUser.id } });
  const postCryptoWallets = await prisma.userCryptoWallet.count({ where: { userId: testUser.id } });
  const postAds = await prisma.p2pAd.count({ where: { userId: testUser.id } });
  const postTokens = await prisma.verificationToken.count({ where: { identifier: testUser.email } });

  console.log(`Post-purge count verification:
    User: ${postUser ? "EXISTS (FAIL)" : "NULL (PURGED)"}
    Wallets: ${postWallets} (expected 0)
    Orders: ${postOrders} (expected 0)
    Transactions: ${postTxs} (expected 0)
    KYC: ${postKyc} (expected 0)
    Deposits: ${postDeposits} (expected 0)
    Withdrawals: ${postWithdrawals} (expected 0)
    Bank Cards: ${postBankCards} (expected 0)
    Crypto Wallets: ${postCryptoWallets} (expected 0)
    P2P Ads: ${postAds} (expected 0)
    Verification Tokens: ${postTokens} (expected 0)
  `);

  if (
    postUser !== null ||
    postWallets > 0 ||
    postOrders > 0 ||
    postTxs > 0 ||
    postKyc > 0 ||
    postDeposits > 0 ||
    postWithdrawals > 0 ||
    postBankCards > 0 ||
    postCryptoWallets > 0 ||
    postAds > 0 ||
    postTokens > 0
  ) {
    throw new Error("❌ FAIL: Orphaned records found after user deletion!");
  }
  console.log("✅ PASS: 100% of user data and dependent records were permanently and cleanly purged.");

  // Verify Audit Log was recorded
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      action: "USER_PERMANENT_DELETION",
      targetId: testUser.id,
    },
  });
  if (!auditLog) {
    throw new Error("❌ FAIL: Administrative audit log was not recorded for user deletion.");
  }
  console.log(`✅ PASS: Audit log recorded: "${auditLog.details}"`);

  // --------------------------------------------------------------------------
  // TEST 4: FULL DATABASE EXPORT & VALIDATION
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Full Database Export & Checksum Verification ---");
  const fullExport = await generateFullDatabaseExport(superAdmin.email);
  console.log("Full export manifest:", fullExport.manifest);

  if (fullExport.manifest.type !== "FULL_DATABASE") {
    throw new Error("❌ Invalid manifest type.");
  }
  if (!fullExport.manifest.checksum || fullExport.manifest.checksum.length !== 64) {
    throw new Error("❌ Checksum is invalid or missing.");
  }
  if (fullExport.manifest.totalRecords === 0) {
    throw new Error("❌ Full database export returned zero records.");
  }

  // Validate the generated package
  const validation = validateBackupPackage(fullExport);
  console.log("Validation result:", {
    valid: validation.valid,
    checksumValid: validation.checksumValid,
    totalRecords: validation.totalRecords,
  });

  if (!validation.valid || !validation.checksumValid) {
    throw new Error(`❌ Package validation failed: ${validation.errors.join(", ")}`);
  }
  console.log("✅ PASS: Full database export generated and cryptographically verified.");

  // --------------------------------------------------------------------------
  // TEST 5: WEBSITE CONFIGURATION EXPORT & RESTORE
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Website Configuration Export & Restoration ---");
  const configExport = await generateWebsiteConfigExport(superAdmin.email);
  console.log("Config export manifest:", configExport.manifest);

  const configValidation = validateBackupPackage(configExport);
  if (!configValidation.valid || !configValidation.checksumValid) {
    throw new Error(`❌ Config package validation failed: ${configValidation.errors.join(", ")}`);
  }
  console.log("✅ Config package checksum verified.");

  // Test restoration
  const restoreRes = await restoreWebsiteConfiguration(configExport.data, {
    id: superAdmin.id,
    email: superAdmin.email,
  });
  console.log("Restoration response:", restoreRes);
  if (!restoreRes.success) {
    throw new Error(`❌ Restoration failed: ${restoreRes.error}`);
  }
  console.log("✅ PASS: Website configuration restored successfully.");

  // --------------------------------------------------------------------------
  // TEST 6: MEDIA ARCHIVE EXPORT & VALIDATION
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Media Archive Export ---");
  const mediaExport = await generateMediaArchiveExport(superAdmin.email);
  console.log("Media export manifest:", mediaExport.manifest);
  const mediaValidation = validateBackupPackage(mediaExport);
  if (!mediaValidation.valid || !mediaValidation.checksumValid) {
    throw new Error("❌ Media package validation failed.");
  }
  console.log("✅ PASS: Media archive generated and validated.");

  // --------------------------------------------------------------------------
  // TEST 7: PROJECT SOURCE CODE ZIP EXPORT
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Clean Project Source Code ZIP Export ---");
  const zipBuffer = await generateProjectSourceExport();
  console.log(`Generated Source Code ZIP buffer size: ${(zipBuffer.length / 1024).toFixed(1)} KB`);

  if (!zipBuffer || zipBuffer.length < 1000) {
    throw new Error("❌ Source code ZIP buffer is suspiciously small or empty.");
  }
  console.log("✅ PASS: Clean project source ZIP bundle generated successfully.");

  console.log("\n===============================================================");
  console.log("🎉 ALL TESTS PASSED: COMPLETE USER DELETION & BACKUP RESTORE VERIFIED!");
  console.log("===============================================================");
}

runTests()
  .catch((e) => {
    console.error("FATAL TEST FAILURE:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
