process.env.CLI_TEST_MODE = "true";

import { PrismaClient } from "@prisma/client";
import { registerUser } from "../src/actions/auth";
import { createRmAdmin, updateUserRole, adjustUserBalance } from "../src/actions/admin";

const prisma = new PrismaClient();

async function runRegressionTests() {
  console.log("==================================================================");
  console.log("🔒 COMPREHENSIVE ZERO-WALLET BALANCE POLICY & REGRESSION VERIFICATION");
  console.log("==================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${testName}`);
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  const timestamp = Date.now();
  const testUserEmail = `zero_user_${timestamp}@ethsltd.com`;
  const testRmEmail = `zero_rm_${timestamp}@ethsltd.com`;

  let createdUserId: string | null = null;
  let createdRmId: string | null = null;

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: Normal User Registration Zero-Balance Enforcement
    // -------------------------------------------------------------
    console.log("TEST SUITE 1: Normal User Registration Zero-Balance Enforcement");
    const regRes = await registerUser({
      email: testUserEmail,
      password: "ZeroPassword123!",
      name: "Zero Normal User",
      transactionPin: "123456",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });

    assert(regRes.success === true, "User registration succeeds without error", regRes.error);

    const createdUser = await prisma.user.findUnique({
      where: { email: testUserEmail },
      include: { wallets: true, transactions: true },
    });

    if (createdUser) {
      createdUserId = createdUser.id;
      assert(createdUser.wallets.length >= 6, "All 6 standard wallet accounts (USDT, BTC, ETH, USDC, Contract, Options) initialized");
      
      const nonZeroWallets = createdUser.wallets.filter(w => w.balance !== 0.0);
      assert(nonZeroWallets.length === 0, "All newly created user wallets have strictly 0.0 initial balance", 
        nonZeroWallets.map(w => `${w.asset} (${w.type}): ${w.balance}`).join(", "));

      assert(createdUser.transactions.length === 0, "No unauthorized transaction records created on registration");
    }

    // -------------------------------------------------------------
    // TEST SUITE 2: Relationship Manager (RM) Creation Zero-Balance Enforcement
    // -------------------------------------------------------------
    console.log("\nTEST SUITE 2: Relationship Manager (RM) Creation Zero-Balance Enforcement");
    const rmRes = await createRmAdmin({
      email: testRmEmail,
      name: "Zero RM Specialist",
      password: "ZeroRmPassword123!",
      rmCode: `RM-${Math.floor(100000 + Math.random() * 900000)}`,
      designation: "Portfolio Risk Manager",
      department: "Private Client Advisory",
    });

    assert(rmRes.success === true, "RM creation succeeds via Admin");

    const createdRm = await prisma.user.findUnique({
      where: { email: testRmEmail },
      include: { wallets: true, transactions: true, rmProfile: true },
    });

    if (createdRm) {
      createdRmId = createdRm.id;
      assert(createdRm.role === "RM", "Account role properly assigned as RM");
      assert(createdRm.rmProfile !== null, "RmProfile correctly generated and linked");
      assert(createdRm.wallets.length >= 6, "All 6 standard wallet accounts initialized for RM");

      const nonZeroRmWallets = createdRm.wallets.filter(w => w.balance !== 0.0);
      assert(nonZeroRmWallets.length === 0, 
        "CRITICAL: New RM account has strictly 0.0 initial balance across all assets (No 100,000 USDT or crypto bonus)",
        nonZeroRmWallets.map(w => `${w.asset} (${w.type}): ${w.balance}`).join(", "));

      assert(createdRm.transactions.length === 0, "No unauthorized credit transaction records created during RM setup");
    }

    // -------------------------------------------------------------
    // TEST SUITE 3: Role Conversion Invariant
    // -------------------------------------------------------------
    console.log("\nTEST SUITE 3: Role Conversion Invariant");
    if (createdUserId) {
      const roleRes = await updateUserRole(createdUserId, "RM");
      assert(roleRes.success === true, "Super Admin role conversion executes successfully");

      const userAfterRole = await prisma.user.findUnique({
        where: { id: createdUserId },
        include: { wallets: true, transactions: true },
      });

      const nonZeroAfterRole = userAfterRole?.wallets.filter(w => w.balance !== 0.0) || [];
      assert(nonZeroAfterRole.length === 0, "Role conversion to RM does NOT inject automatic funds or modify existing balances");
    }

    // -------------------------------------------------------------
    // TEST SUITE 4: Authorized Transactions Only (Ledger Verification)
    // -------------------------------------------------------------
    console.log("\nTEST SUITE 4: Authorized Transactions Only (Ledger Verification)");
    if (createdUserId) {
      const creditRes = await adjustUserBalance({
        userId: createdUserId,
        asset: "USDT",
        amount: 500.0,
        type: "CREDIT",
        reason: "Compliance authorized deposit test",
      });

      assert(creditRes.success === true, "Explicit admin balance adjustment succeeds");

      const userWithCredit = await prisma.user.findUnique({
        where: { id: createdUserId },
        include: { wallets: true, transactions: true },
      });

      const usdtWallet = userWithCredit?.wallets.find(w => w.asset === "USDT" && w.type === "Currency");
      assert(usdtWallet?.balance === 500.0, "Wallet balance precisely matches authorized credited amount (500 USDT)");
      assert(userWithCredit?.transactions.length === 1, "Exactly one valid transaction record created in ledger");
      assert(userWithCredit?.transactions[0]?.status === "Passed", "Transaction status properly marked as Passed");
    }

    // -------------------------------------------------------------
    // TEST SUITE 5: Existing Accounts Audit & Ledger Consistency
    // -------------------------------------------------------------
    console.log("\nTEST SUITE 5: Existing Accounts Audit & Ledger Consistency");
    const allRms = await prisma.user.findMany({
      where: { role: "RM" },
      include: { wallets: true, deposits: true, transactions: true },
    });

    for (const rm of allRms) {
      if (rm.id === createdRmId) continue;
      const totalBalance = rm.wallets.reduce((acc, w) => acc + w.balance, 0);
      assert(
        totalBalance === 0.0 || rm.transactions.length > 0 || rm.deposits.length > 0,
        `RM ${rm.name} (${rm.email}) has zero unbacked automatic balance`
      );
    }

  } catch (err: any) {
    console.error("FATAL ERROR IN TEST EXECUTION:", err);
  } finally {
    // Cleanup temporary test accounts
    console.log("\n[CLEANUP] Cleaning up temporary test artifacts...");
    const testIds = [createdUserId, createdRmId].filter(Boolean) as string[];
    if (testIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { userId: { in: testIds } } });
      await prisma.wallet.deleteMany({ where: { userId: { in: testIds } } });
      await prisma.rmProfile.deleteMany({ where: { userId: { in: testIds } } });
      await prisma.auditLog.deleteMany({ where: { targetId: { in: testIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testIds } } });
    }
    console.log("  ✓ Temporary test accounts cleaned up.");
    await prisma.$disconnect();

    console.log("\n==================================================================");
    console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
    console.log("==================================================================");

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  }
}

runRegressionTests();
