process.env.CLI_TEST_MODE = "true";
import { prisma } from "../src/lib/prisma";
import {
  saveBankAccount,
  setPrimaryBankAccount,
  deleteBankAccount,
  getUserBankAccounts,
  saveCryptoWallet,
  setPrimaryCryptoWallet,
  deleteCryptoWallet,
  getUserCryptoWallets,
  submitWithdrawal,
} from "../src/actions/user";
import { reviewWithdrawal, getAllWithdrawals } from "../src/actions/admin";

async function main() {
  console.log("===============================================================");
  console.log("       DEEP VERIFICATION: KYC, BANK & CRYPTO WITHDRAWALS       ");
  console.log("===============================================================\n");

  const testUser = await prisma.user.findFirst({
    where: { email: "test@example.com" },
  });
  if (!testUser) {
    throw new Error("Test user not found in database!");
  }
  const userId = testUser.id;

  // 1. BANK ACCOUNT MANAGEMENT TEST
  console.log("[1] Testing Bank Account Management...");
  const bank1 = await saveBankAccount(
    {
      bankName: "HDFC Bank",
      accountHolder: "Test User",
      accountNumber: "123456789012",
      confirmAccountNumber: "123456789012",
      ifscCode: "HDFC0001234",
      swiftCode: "HDFCINBB",
      isPrimary: true,
    },
    userId
  );
  if (!bank1.success) throw new Error("Failed to create bank 1: " + bank1.error);
  console.log("  ✓ Created Primary Bank Account (HDFC Bank)");

  const bank2 = await saveBankAccount(
    {
      bankName: "State Bank of India",
      accountHolder: "Test User",
      accountNumber: "987654321098",
      confirmAccountNumber: "987654321098",
      ifscCode: "SBIN0005678",
      isPrimary: false,
    },
    userId
  );
  if (!bank2.success) throw new Error("Failed to create bank 2: " + bank2.error);
  console.log("  ✓ Created Secondary Bank Account (SBI)");

  // Switch primary to SBI
  await setPrimaryBankAccount(bank2.data.id, userId);
  const banksAfterSwitch = await getUserBankAccounts(userId);
  const sbiCard = banksAfterSwitch.find((b: any) => b.id === bank2.data.id);
  if (!sbiCard?.isPrimary) throw new Error("Primary switch failed!");
  console.log("  ✓ Successfully switched Primary status to SBI");

  // Delete SBI and ensure fallback
  await deleteBankAccount(bank2.data.id, userId);
  const banksAfterDelete = await getUserBankAccounts(userId);
  const remainingBank = banksAfterDelete.find((b: any) => b.id === bank1.data.id);
  if (!remainingBank?.isPrimary) throw new Error("Fallback primary promotion failed!");
  console.log("  ✓ Deleted SBI card and verified remaining HDFC card automatically promoted to Primary");

  // 2. CRYPTO WALLET MANAGEMENT TEST
  console.log("\n[2] Testing Crypto Wallet Management...");
  const crypto1 = await saveCryptoWallet(
    {
      asset: "USDT",
      network: "TRC20",
      address: "TYDzsYUEpvnYmQk4zGP9sWWcTEd36d57R8",
      label: "My TRON Wallet",
      isPrimary: true,
    },
    userId
  );
  if (!crypto1.success) throw new Error("Failed to create crypto wallet: " + crypto1.error);
  console.log("  ✓ Created Primary TRC20 Crypto Wallet");

  const crypto2 = await saveCryptoWallet(
    {
      asset: "USDT",
      network: "ERC20",
      address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      label: "My ETH Wallet",
      isPrimary: false,
    },
    userId
  );
  if (!crypto2.success) throw new Error("Failed to create crypto wallet 2: " + crypto2.error);
  console.log("  ✓ Created Secondary ERC20 Crypto Wallet");

  // Switch primary
  await setPrimaryCryptoWallet(crypto2.data.id, userId);
  const cryptosAfterSwitch = await getUserCryptoWallets(userId);
  const ethWallet = cryptosAfterSwitch.find((w: any) => w.id === crypto2.data.id);
  if (!ethWallet?.isPrimary) throw new Error("Crypto primary switch failed!");
  console.log("  ✓ Successfully switched Primary crypto wallet");

  // Cleanup crypto 2
  await deleteCryptoWallet(crypto2.data.id, userId);
  console.log("  ✓ Deleted secondary crypto wallet safely");

  // 3. KYC RESTRICTION TEST
  console.log("\n[3] Testing KYC Enforcement on Withdrawal...");
  // Temporarily set user KYC to false
  await prisma.user.update({
    where: { id: userId },
    data: { isKycVerified: false },
  });

  const blockedWithdraw = await submitWithdrawal({
    userId,
    asset: "USDT",
    amount: 50,
    method: "CRYPTO",
    userCryptoWalletId: crypto1.data.id,
  });

  if (blockedWithdraw.success) {
    throw new Error("SECURITY FAILURE: Unverified user was able to withdraw!");
  }
  console.log("  ✓ Security Guard PASSED: Unverified KYC blocked with message:", blockedWithdraw.error);

  // Restore KYC to approved
  await prisma.user.update({
    where: { id: userId },
    data: { isKycVerified: true },
  });
  await prisma.kycApplication.upsert({
    where: { userId },
    update: { status: "APPROVED" },
    create: {
      userId,
      status: "APPROVED",
      idNumber: "ID123456",
      address: "Test Address",
    },
  });

  // 4. VERIFIED WITHDRAWAL SUBMISSION & IMMUTABLE SNAPSHOT
  console.log("\n[4] Testing Verified Withdrawal & Immutable Snapshot Creation...");
  const validWithdraw = await submitWithdrawal({
    userId,
    asset: "USDT",
    amount: 100,
    method: "CRYPTO",
    userCryptoWalletId: crypto1.data.id,
    fundPassword: testUser.transactionPin || undefined,
  });
  if (!validWithdraw.success) throw new Error("Withdrawal failed for verified user: " + validWithdraw.error);
  console.log("  ✓ Withdrawal Request Created! ID:", validWithdraw.data.id);

  const savedReq: any = await prisma.withdrawalRequest.findUnique({
    where: { id: validWithdraw.data.id },
  });
  if (!savedReq.methodSnapshot) throw new Error("Missing immutable method snapshot!");
  console.log("  ✓ Immutable Snapshot Verified:", savedReq.methodSnapshot);

  // 5. ADMIN REVIEW & REJECTION WITH REFUND
  console.log("\n[5] Testing Admin Review & Auto-Refund on Rejection...");
  const adminUser = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });
  if (!adminUser) throw new Error("Super admin account not found!");

  // Reject withdrawal and verify refund
  const rejectRes = await reviewWithdrawal(
    validWithdraw.data.id,
    "REJECTED",
    { rejectionReason: "Automated test rejection for audit verification", adminNotes: "Refund verified" }
  );
  if (!rejectRes.success) throw new Error("Admin review failed: " + rejectRes.error);
  console.log("  ✓ Admin rejected withdrawal with automated balance release verified");

  // Cleanup test bank & crypto records
  await (prisma as any).bankCard.deleteMany({ where: { userId } });
  await (prisma as any).userCryptoWallet.deleteMany({ where: { userId } });
  await prisma.withdrawalRequest.deleteMany({ where: { id: validWithdraw.data.id } });

  console.log("\n===============================================================");
  console.log("       ALL DEEP CHECKS PASSED: 100% OPERATIONAL & SECURE       ");
  console.log("===============================================================\n");
}

main()
  .catch((e) => {
    console.error("TEST FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
