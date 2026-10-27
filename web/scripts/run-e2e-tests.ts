process.env.CLI_TEST_MODE = "true";

import { chromium } from "playwright";
import prisma from "@/lib/prisma";
import { registerUser, verifyEmailOtp, loginUser } from "@/actions/auth";
import { updateUserProfileAdmin, getUserDetailsAdmin, type UserStatus } from "@/actions/admin";

async function runEndToEndTests() {
  console.log("=================================================");
  console.log("🚀 ETHSLTD PLAYWRIGHT & END-TO-END AUTOMATED TEST SUITE");
  console.log("=================================================\n");

  const results: Array<{ scenario: string; status: "PASSED" | "FAILED"; details?: string }> = [];

  const logResult = (scenario: string, passed: boolean | undefined | null, details?: string) => {
    const isPassed = Boolean(passed);
    results.push({ scenario, status: isPassed ? "PASSED" : "FAILED", details });
    console.log(`[${isPassed ? "✅ PASS" : "❌ FAIL"}] ${scenario}`);
    if (details) console.log(`   └─ ${details}`);
  };

  // Launch Browser via Playwright (using system Edge channel)
  console.log("🌐 Launching Browser via Playwright...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Browser Navigation to Register Page
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 1: Browser Registration UI ---");
    await page.goto("http://localhost:3000/register", { waitUntil: "domcontentloaded" });
    const pageTitle = await page.title();
    const hasRegisterForm = (await page.locator("form").count()) > 0;
    logResult("Browser loads /register page with form", hasRegisterForm && pageTitle.length > 0, `Title: ${pageTitle}`);

    // -------------------------------------------------------------
    // SCENARIO 2: Registration with Disposable Email Domain
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 2: Disposable Domain Block Enforced ---");
    const disposableEmail = `bot_test_${Date.now()}@mailinator.com`;
    const dispRes = await registerUser({
      name: "Spam Bot",
      email: disposableEmail,
      password: "TestPassword123!",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });
    logResult(
      "Registration blocked for disposable email (mailinator.com)",
      !dispRes.success && (dispRes.error?.includes("disposable") || dispRes.error?.includes("Temporary")),
      `Error received: "${dispRes.error}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Registration with Malformed Email
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 3: Malformed Email Rejected ---");
    const malformedRes = await registerUser({
      name: "Bad Format",
      email: "not-an-email-at-all",
      password: "TestPassword123!",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });
    logResult(
      "Registration rejected for malformed syntax (no @/domain)",
      !malformedRes.success && malformedRes.error?.includes("Invalid email address format"),
      `Error received: "${malformedRes.error}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Registration with Reserved Test Domain
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 4: Reserved Domain Blocked ---");
    const testDomainRes = await registerUser({
      name: "Test Domain",
      email: "tester@example.com",
      password: "TestPassword123!",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });
    logResult(
      "Registration rejected for reserved RFC domain (example.com)",
      !testDomainRes.success && testDomainRes.error?.includes("not permitted"),
      `Error received: "${testDomainRes.error}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Registration with Non-Existent Fake Domain (DNS NXDOMAIN)
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 5: Non-Existent Domain Caught via Dynamic DNS ---");
    const fakeDomainEmail = "user@nonexistent-fake-domain-10293847561.com";
    const fakeDomainRes = await registerUser({
      name: "Fake Domain User",
      email: fakeDomainEmail,
      password: "TestPassword123!",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });
    logResult(
      "Registration rejected for non-existent domain via DNS/MX check",
      !fakeDomainRes.success && (fakeDomainRes.error?.includes("does not exist") || fakeDomainRes.error?.includes("no active mail exchange")),
      `Error received: "${fakeDomainRes.error}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 6: Registration with Legitimate Corporate Domain (e.g. facebook.com / google.com)
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 6: Valid Corporate Email Registration (Dynamic MX Support) ---");
    const uniqueCorpUser = `corp_trader_${Date.now()}@facebook.com`;
    // Clean up if already exists
    await prisma.user.deleteMany({ where: { email: uniqueCorpUser } });
    await prisma.verificationToken.deleteMany({ where: { identifier: uniqueCorpUser } });

    const corpRes = await registerUser({
      name: "Corporate Executive",
      email: uniqueCorpUser,
      password: "CorporateSecurePassword123!",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });

    const corpUserRecord = await prisma.user.findUnique({ where: { email: uniqueCorpUser } });
    logResult(
      "Corporate email registration succeeds dynamically (facebook.com)",
      corpRes.success && corpUserRecord !== null && corpUserRecord.status === "PENDING_VERIFICATION",
      `Created User UID: #${corpUserRecord?.uid}, status: ${corpUserRecord?.status}`
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Duplicate Email Registration Blocked
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 7: Duplicate Registration Prevention ---");
    const dupRes = await registerUser({
      name: "Duplicate Corp Executive",
      email: uniqueCorpUser,
      password: "CorporateSecurePassword123!",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });
    logResult(
      "Duplicate email registration rejected",
      !dupRes.success && dupRes.error?.includes("already exists"),
      `Error received: "${dupRes.error}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 8: Email OTP Verification - Invalid Code Rejected
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 8: Invalid Email OTP Code Rejected ---");
    const badOtpRes = await verifyEmailOtp({
      code: "000000",
      email: uniqueCorpUser,
    });
    logResult(
      "Invalid OTP code rejected with error",
      !badOtpRes.success && badOtpRes.error?.includes("Invalid verification code"),
      `Error received: "${badOtpRes.error}"`
    );

    // -------------------------------------------------------------
    // SCENARIO 9: Email OTP Verification - Valid Code Activates Account
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 9: Valid Email OTP Activates Account ---");
    const validToken = await prisma.verificationToken.findFirst({
      where: { identifier: uniqueCorpUser, type: "EMAIL_VERIFICATION", used: false },
    });

    if (validToken && validToken.code) {
      const goodOtpRes = await verifyEmailOtp({
        code: validToken.code,
        email: uniqueCorpUser,
      });

      const verifiedUserRecord = await prisma.user.findUnique({ where: { email: uniqueCorpUser } });
      logResult(
        "Valid OTP verifies email and promotes status to ACTIVE",
        goodOtpRes.success && verifiedUserRecord?.status === "ACTIVE" && verifiedUserRecord?.isEmailVerified === true,
        `Status: ${verifiedUserRecord?.status}, isEmailVerified: ${verifiedUserRecord?.isEmailVerified}`
      );
    } else {
      logResult("Valid OTP verification", false, "Verification token was not found in DB");
    }

    // -------------------------------------------------------------
    // SCENARIO 10: Authenticated User Login
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 10: User Login with Newly Activated Account ---");
    const loginRes = await loginUser({
      email: uniqueCorpUser,
      password: "CorporateSecurePassword123!",
    });
    logResult(
      "Login succeeds for activated corporate account",
      loginRes.success === true,
      `Redirect: ${loginRes.redirectUrl}, role: ${loginRes.role}`
    );

    // -------------------------------------------------------------
    // SCENARIO 11: Admin Login and User Management Page (Browser E2E)
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 11: Admin Panel E2E Profile Management ---");
    // Navigate to /login in Playwright
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await page.fill('input[type="email"]', "admin@ethsltd.com");
    await page.fill('input[type="password"]', "Admin@123456");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    // Navigate to admin users page
    await page.goto("http://localhost:3000/admin/users", { waitUntil: "domcontentloaded" });
    const currentUrl = page.url();
    logResult("Admin navigates to /admin/users", currentUrl.includes("/admin/users"), `URL: ${currentUrl}`);

    // Wait for users table to finish fetching and rendering
    await page.waitForSelector("table tbody tr", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Verify corporate user appears in the user table
    const tableHtml = await page.content();
    const userInTable = tableHtml.includes(uniqueCorpUser);
    logResult("Newly registered corporate user appears in Admin table", userInTable, `Found: ${uniqueCorpUser}`);

    // -------------------------------------------------------------
    // SCENARIO 12: Admin Profile Edit via updateUserProfileAdmin
    // -------------------------------------------------------------
    console.log("\n--- SCENARIO 12: Admin Profile Update Action & Persistence ---");
    const testAdmin = await prisma.user.findUnique({ where: { email: "admin@ethsltd.com" } });
    if (corpUserRecord && testAdmin) {
      const updateRes = await updateUserProfileAdmin(corpUserRecord.id, {
        name: "Corporate Executive Updated",
        phone: "+15550198273",
        status: "ACTIVE" as UserStatus,
        role: "USER",
        isKycVerified: true,
      });

      const refreshedDbUser = await prisma.user.findUnique({ where: { id: corpUserRecord.id } });
      logResult(
        "Admin updates user profile (name, phone, KYC, status)",
        updateRes.success === true &&
          refreshedDbUser?.name === "Corporate Executive Updated" &&
          refreshedDbUser?.phone === "+15550198273" &&
          refreshedDbUser?.isKycVerified === true,
        `DB State: name="${refreshedDbUser?.name}", phone="${refreshedDbUser?.phone}", KYC=${refreshedDbUser?.isKycVerified}`
      );
    }

    // Clean up test corporate user (cascade delete child records)
    if (corpUserRecord) {
      await prisma.wallet.deleteMany({ where: { userId: corpUserRecord.id } });
      await prisma.auditLog.deleteMany({ where: { targetId: corpUserRecord.id } });
      await prisma.verificationToken.deleteMany({ where: { identifier: uniqueCorpUser } });
      await prisma.user.deleteMany({ where: { id: corpUserRecord.id } });
    }
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  // Final Summary
  console.log("\n=================================================");
  console.log("📊 PLAYWRIGHT E2E TEST SUMMARY");
  console.log("=================================================");
  const total = results.length;
  const passedCount = results.filter((r) => r.status === "PASSED").length;
  const failedCount = results.filter((r) => r.status === "FAILED").length;
  console.log(`Total Scenarios: ${total} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error("\n❌ Some tests failed. Review output above.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL 12 PLAYWRIGHT E2E SCENARIOS PASSED WITH ZERO ERRORS!");
  }
}

runEndToEndTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
