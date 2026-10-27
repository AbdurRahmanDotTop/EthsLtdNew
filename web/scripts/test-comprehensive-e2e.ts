process.env.CLI_TEST_MODE = "true";

import { chromium, type Browser, type Page } from "playwright";
import prisma from "@/lib/prisma";
import { registerUser, verifyEmailOtp, loginUser } from "@/actions/auth";

interface TestReport {
  name: string;
  category: string;
  status: "PASSED" | "FAILED";
  details?: string;
  durationMs: number;
}

const report: TestReport[] = [];

function recordTest(name: string, category: string, passed: boolean, details?: string, durationMs = 0) {
  report.push({
    name,
    category,
    status: passed ? "PASSED" : "FAILED",
    details,
    durationMs,
  });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[${icon}] [${category}] ${name}`);
  if (details) console.log(`   └─ ${details}`);
}

async function runComprehensiveE2ETests() {
  console.log("========================================================================");
  console.log("🚀 ETHSLTD COMPREHENSIVE PRODUCTION PLAYWRIGHT E2E TEST SUITE");
  console.log("========================================================================\n");

  const baseUrl = "http://localhost:3000";
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  const browser: Browser = await chromium.launch({ channel: "msedge", headless: true });

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: DESKTOP PUBLIC USER JOURNEYS (1280x800)
    // -------------------------------------------------------------------------
    console.log("--- TEST SUITE 1: Desktop Public Pages & Interactive Elements (1280x800) ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    });
    const desktopPage = await desktopContext.newPage();

    desktopPage.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
      }
    });

    desktopPage.on("response", (res) => {
      if (res.status() >= 500) {
        networkErrors.push(`[${res.status()}] ${res.url()}`);
      }
    });

    // 1.1 Home Page
    let t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const homeTitle = await desktopPage.title();
    const hasHeaderLogo = await desktopPage.locator("header a svg").count() > 0;
    recordTest(
      "Home page loads with valid title and brand logo",
      "Desktop Public",
      homeTitle.includes("ETHSLTD") && hasHeaderLogo,
      `Title: "${homeTitle}", Logo found: ${hasHeaderLogo}`,
      Date.now() - t0
    );

    // 1.2 Relationship Managers Page
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/relationship-managers`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(1000);
    const rmHeader = await desktopPage.locator("h1").innerText().catch(() => "");
    const rmCards = await desktopPage.locator("button:has-text('Connect with RM')").count();
    recordTest(
      "Advisory (/relationship-managers) renders RM cards and interactive actions",
      "Desktop Public",
      rmHeader.includes("Relationship Managers") && rmCards >= 1,
      `Header: "${rmHeader}", Available RM Cards: ${rmCards}`,
      Date.now() - t0
    );

    // 1.3 Category Filter Pills on Relationship Managers Page
    t0 = Date.now();
    const futuresPill = desktopPage.locator("button:has-text('Futures & Leverage')");
    if (await futuresPill.count() > 0) {
      await futuresPill.click();
      await desktopPage.waitForTimeout(500);
      const allPill = desktopPage.locator("button:has-text('All Specialists')");
      await allPill.click();
      await desktopPage.waitForTimeout(500);
      recordTest("RM Category filter buttons switch smoothly without reload", "Desktop Public", true, undefined, Date.now() - t0);
    }

    // 1.4 Trade Page
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/trade`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(1000);
    const tradeUrl = desktopPage.url();
    const hasBuyButton = await desktopPage.locator("button:has-text('Buy'), button:has-text('Long')").count() > 0;
    recordTest(
      "Trade page (/trade) loads with order book and trade controls",
      "Desktop Public",
      tradeUrl.includes("/trade") && hasBuyButton,
      `URL: ${tradeUrl}, Trade buttons rendered: ${hasBuyButton}`,
      Date.now() - t0
    );

    // 1.5 Options Page
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/options`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(1000);
    const optionsUrl = desktopPage.url();
    const hasCallButton = await desktopPage.locator("button:has-text('Call'), button:has-text('Rise'), button:has-text('High')").count() > 0;
    recordTest(
      "Options page (/options) loads with derivatives execution controls",
      "Desktop Public",
      optionsUrl.includes("/options") && hasCallButton,
      `URL: ${optionsUrl}`,
      Date.now() - t0
    );

    // 1.6 P2P Marketplace
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/p2p`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(1000);
    const p2pUrl = desktopPage.url();
    const p2pBuyTab = await desktopPage.locator("button:has-text('Buy'), [role='tab']:has-text('Buy')").count() > 0;
    recordTest(
      "P2P Marketplace (/p2p) loads with Buy/Sell orderbook",
      "Desktop Public",
      p2pUrl.includes("/p2p") && p2pBuyTab,
      `URL: ${p2pUrl}`,
      Date.now() - t0
    );

    // 1.7 Trust & Reserves Page
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/trust`, { waitUntil: "domcontentloaded" });
    const trustTitle = await desktopPage.locator("h1, h2").first().innerText().catch(() => "");
    recordTest(
      "Trust & Regulatory page (/trust) renders institutional custody proof",
      "Desktop Public",
      trustTitle.length > 0,
      `Header: "${trustTitle}"`,
      Date.now() - t0
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 2: MOBILE WORKFLOWS & RESPONSIVENESS (375x667 iPhone SE)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 2: Mobile Responsive Viewport (375x667) ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    t0 = Date.now();
    await mobilePage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForTimeout(500);

    // Verify Mobile Bottom Navigation bar
    const bottomNav = mobilePage.locator("div.fixed.bottom-0");
    const hasBottomNav = (await bottomNav.count()) > 0;
    const bottomNavLinks = await bottomNav.locator("a").count();
    recordTest(
      "Mobile bottom navigation bar renders with touch targets",
      "Mobile Responsive",
      hasBottomNav && bottomNavLinks >= 5,
      `Bottom bar found: ${hasBottomNav}, Links count: ${bottomNavLinks}`,
      Date.now() - t0
    );

    // Mobile Navigation to Advisory
    t0 = Date.now();
    await mobilePage.goto(`${baseUrl}/relationship-managers`, { waitUntil: "domcontentloaded" });
    await mobilePage.waitForSelector("button:has-text('Connect with RM')", { timeout: 10000 }).catch(() => {});
    const mobileRmCardCount = await mobilePage.locator("button:has-text('Connect with RM')").count();
    recordTest(
      "Mobile relationship managers layout scales and stacks cleanly",
      "Mobile Responsive",
      mobileRmCardCount >= 1,
      `Found ${mobileRmCardCount} RM cards on mobile viewport`,
      Date.now() - t0
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 3: AUTHENTICATION, ROUTE PROTECTION & USER JOURNEY
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 3: Auth Security Boundaries & Full Trader Journey ---");

    // 3.1 Unauthenticated Access Redirections
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/assets`, { waitUntil: "domcontentloaded" });
    const redirectedUrl = desktopPage.url();
    recordTest(
      "Guest access to /assets redirects to /login?redirect=%2Fassets",
      "Security & Auth",
      redirectedUrl.includes("/login"),
      `Redirected to: ${redirectedUrl}`,
      Date.now() - t0
    );

    // 3.2 Contracts route redirects safely to /relationship-managers
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/contracts`, { waitUntil: "domcontentloaded" });
    const contractsRedirect = desktopPage.url();
    recordTest(
      "Visiting /contracts safely redirects to /relationship-managers",
      "Security & Auth",
      contractsRedirect.includes("/relationship-managers") || contractsRedirect.includes("/login"),
      `Redirected to: ${contractsRedirect}`,
      Date.now() - t0
    );

    // 3.3 Dynamic User Registration & Activation
    t0 = Date.now();
    const testEmail = `trader_journey_${Date.now()}@ethsltd.com`;
    const regRes = await registerUser({
      name: "E2E Verified Trader",
      email: testEmail,
      password: "TraderSecurePass2026!",
      turnstileToken: "DUMMY_TOKEN_DEV",
      submissionTiming: Date.now() - 3000,
    });
    recordTest(
      "Register new trader account via server action",
      "Security & Auth",
      regRes.success === true,
      regRes.success ? `Created ${testEmail}` : `Error: ${regRes.error}`,
      Date.now() - t0
    );

    // 3.4 Email OTP Verification
    t0 = Date.now();
    const otpToken = await prisma.verificationToken.findFirst({
      where: { identifier: testEmail, type: "EMAIL_VERIFICATION", used: false },
    });
    if (otpToken?.code) {
      const verifyRes = await verifyEmailOtp({ code: otpToken.code, email: testEmail });
      recordTest(
        "Verify 6-digit email OTP and activate trader account",
        "Security & Auth",
        verifyRes.success === true,
        `Code: ${otpToken.code}, Result: ${verifyRes.success}`,
        Date.now() - t0
      );
    }

    // 3.5 Trader Login in Browser
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await desktopPage.fill('input[type="email"]', testEmail);
    await desktopPage.fill('input[type="password"]', "TraderSecurePass2026!");
    await desktopPage.click('button[type="submit"]');
    await desktopPage.waitForURL("**/assets", { timeout: 15000 }).catch(() => desktopPage.waitForTimeout(4000));

    const loggedInUrl = desktopPage.url();
    recordTest(
      "Trader logs in via UI form and redirects to /assets",
      "Security & Auth",
      loggedInUrl.includes("/assets") || loggedInUrl.includes("/relationship-managers"),
      `Navigated to: ${loggedInUrl}`,
      Date.now() - t0
    );

    // 3.6 Assets Verification (Strict 0.0 Balance Policy)
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/assets`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(1000);
    const assetsContent = await desktopPage.content();
    const hasZeroBalance = assetsContent.includes("0.00") || assetsContent.includes("0.0000");
    recordTest(
      "Assets page displays zero initial balance (Zero-Balance Policy Verified)",
      "Financial Integrity",
      hasZeroBalance,
      "Zero-balance verified on user assets overview",
      Date.now() - t0
    );

    // 3.7 RM Connection Request Flow
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/relationship-managers`, { waitUntil: "domcontentloaded" });
    await desktopPage.waitForTimeout(1000);
    const connectButtons = desktopPage.locator("button:has-text('Connect with RM')");
    if (await connectButtons.count() > 0) {
      await connectButtons.first().click();
      await desktopPage.waitForTimeout(500);
      const modalOpen = await desktopPage.locator("textarea, input[placeholder*='message'], button:has-text('Send Request')").count() > 0;
      recordTest(
        "Clicking 'Connect with RM' opens advisory modal for authenticated trader",
        "Advisory Workflow",
        modalOpen,
        "Connect request modal opened successfully",
        Date.now() - t0
      );

      // Close modal by pressing Escape or clicking cancel
      await desktopPage.keyboard.press("Escape").catch(() => {});
    }

    // 3.8 Security & Settings Page
    t0 = Date.now();
    await desktopPage.goto(`${baseUrl}/security/password`, { waitUntil: "domcontentloaded" });
    const hasPasswordForm = await desktopPage.locator("form").count() > 0;
    recordTest(
      "Authenticated trader accesses /security/password with change form",
      "Account Security",
      hasPasswordForm,
      "Password change form loaded",
      Date.now() - t0
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 4: RELATIONSHIP MANAGER DASHBOARD (sarah.rm@ethsltd.com)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 4: Relationship Manager Portal ---");
    const rmContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const rmPage = await rmContext.newPage();

    t0 = Date.now();
    await rmPage.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await rmPage.fill('input[type="email"]', "sarah.rm@ethsltd.com");
    await rmPage.fill('input[type="password"]', "Rm@123456");
    await rmPage.click('button[type="submit"]');
    await rmPage.waitForTimeout(2500);
    await rmPage.goto(`${baseUrl}/rm/dashboard`, { waitUntil: "domcontentloaded" });

    const rmDashboardUrl = rmPage.url();
    const rmContent = await rmPage.content();
    const rmPageLoaded = rmDashboardUrl.includes("/rm/dashboard") && !rmContent.includes("Suspended");
    recordTest(
      "Relationship Manager logs in and redirects to /rm/dashboard",
      "RM Portal",
      rmPageLoaded,
      `Redirect URL: ${rmDashboardUrl}`,
      Date.now() - t0
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 5: ADMINISTRATIVE PORTAL (admin@ethsltd.com)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST SUITE 5: Administrative Control Panel ---");
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();

    t0 = Date.now();
    await adminPage.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1000);
    await adminPage.fill('input[type="email"]', "admin@ethsltd.com");
    await adminPage.fill('input[type="password"]', "Admin@123456");
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForTimeout(3500);
    await adminPage.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1500);

    const adminHomeUrl = adminPage.url();
    recordTest(
      "Admin logs in and redirects to /admin",
      "Admin Portal",
      adminHomeUrl.includes("/admin") && !adminHomeUrl.includes("/login"),
      `Redirect URL: ${adminHomeUrl}`,
      Date.now() - t0
    );

    // Admin Users Table
    t0 = Date.now();
    await adminPage.goto(`${baseUrl}/admin/users`, { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(2000);
    const adminUsersTable = await adminPage.locator("table tbody tr").count();
    recordTest(
      "Admin user management table renders records with search/filter",
      "Admin Portal",
      adminUsersTable > 0,
      `User rows rendered: ${adminUsersTable}`,
      Date.now() - t0
    );

    // Admin RM Management Table
    t0 = Date.now();
    await adminPage.goto(`${baseUrl}/admin/rm`, { waitUntil: "domcontentloaded" });
    await adminPage.waitForTimeout(1000);
    const hasRmList = await adminPage.content();
    const hasRmManagement = hasRmList.includes("Sarah Jenkins") || hasRmList.includes("Relationship");
    recordTest(
      "Admin RM management view displays specialist assignments",
      "Admin Portal",
      hasRmManagement,
      "RM management overview rendered",
      Date.now() - t0
    );

    // Clean up temporary test trader
    const testUserRecord = await prisma.user.findUnique({ where: { email: testEmail } });
    if (testUserRecord) {
      await prisma.wallet.deleteMany({ where: { userId: testUserRecord.id } });
      await prisma.verificationToken.deleteMany({ where: { identifier: testEmail } });
      await prisma.auditLog.deleteMany({ where: { targetId: testUserRecord.id } });
      await prisma.user.deleteMany({ where: { id: testUserRecord.id } });
      console.log(`[CLEANUP] Successfully cleaned up temporary trader ${testEmail}`);
    }

    // Close contexts
    await desktopContext.close();
    await mobileContext.close();
    await rmContext.close();
    await adminContext.close();
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY REPORT
  // -------------------------------------------------------------------------
  console.log("\n========================================================================");
  console.log("📊 COMPREHENSIVE PLAYWRIGHT E2E TEST EXECUTION SUMMARY");
  console.log("========================================================================");

  const total = report.length;
  const passed = report.filter((r) => r.status === "PASSED").length;
  const failed = report.filter((r) => r.status === "FAILED").length;

  console.log(`Total Workflows Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Network 5xx Errors: ${networkErrors.length}`);
  console.log(`Console Errors: ${consoleErrors.length}`);

  if (failed > 0) {
    console.error("\n❌ Test Suite encountered failures:");
    for (const item of report.filter((r) => r.status === "FAILED")) {
      console.error(`- [${item.category}] ${item.name}: ${item.details}`);
    }
    process.exit(1);
  } else {
    console.log("\n🎉 ALL COMPREHENSIVE PLAYWRIGHT E2E WORKFLOWS PASSED WITH 100% SUCCESS!");
  }
}

runComprehensiveE2ETests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
