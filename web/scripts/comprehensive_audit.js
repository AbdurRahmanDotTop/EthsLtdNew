const { chromium } = require("playwright");
const { SignJWT } = require("jose");

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ethsltd_super_secret_jwt_key_2026_production"
);

async function createToken(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

const VIEWPORTS = [
  // Mobile
  { name: "Mobile 320px", width: 320, height: 600 },
  { name: "Mobile 360px", width: 360, height: 740 },
  { name: "Mobile 375px (iPhone SE)", width: 375, height: 667 },
  { name: "Mobile 390px (iPhone 14)", width: 390, height: 844 },
  { name: "Mobile 430px (iPhone 14 Pro Max)", width: 430, height: 932 },
  // Tablet
  { name: "Tablet 768px (iPad Mini)", width: 768, height: 1024 },
  { name: "Tablet 1024px (iPad Pro)", width: 1024, height: 1366 },
  // Desktop
  { name: "Desktop 1280px", width: 1280, height: 800 },
  { name: "Desktop 1440px", width: 1440, height: 900 },
  { name: "Desktop 1920px (FHD)", width: 1920, height: 1080 },
];

const USER_ROUTES = [
  { path: "/profile", name: "User Profile (Requirement 1)" },
  { path: "/assets", name: "User Assets Overview" },
  { path: "/assets/deposit", name: "User Deposit" },
  { path: "/assets/withdraw", name: "User Withdraw" },
  { path: "/assets/records", name: "User Records" },
  { path: "/profile/kyc", name: "User KYC Verification" },
  { path: "/p2p", name: "P2P Marketplace" },
  { path: "/p2p/orders", name: "P2P Orders" },
  { path: "/relationship-managers", name: "Relationship Managers" },
  { path: "/trust", name: "Trust & Security" },
  { path: "/trade", name: "Trading Terminal" },
  { path: "/options", name: "Options Trading" },
  { path: "/", name: "Homepage" },
];

const ADMIN_ROUTES = [
  { path: "/admin", name: "Admin Dashboard (Requirement 2)" },
  { path: "/admin/users", name: "Admin Users Table" },
  { path: "/admin/deposits", name: "Admin Deposits Table" },
  { path: "/admin/withdrawals", name: "Admin Withdrawals Table" },
  { path: "/admin/kyc", name: "Admin KYC Table" },
  { path: "/admin/trading", name: "Admin Trading Oversight" },
  { path: "/admin/markets", name: "Admin Markets Config" },
  { path: "/admin/payment-methods", name: "Admin Payment Methods" },
  { path: "/admin/email-settings", name: "Admin Email Settings" },
  { path: "/admin/audit-logs", name: "Admin Audit Logs" },
  { path: "/admin/hero-slider", name: "Admin Hero Slider" },
  { path: "/admin/sitemap", name: "Admin Sitemap" },
  { path: "/admin/rm", name: "Admin RM Hub" },
];

async function runAudit() {
  console.log("=================================================");
  console.log("ETHSLTD COMPLETE RESPONSIVENESS AUDIT SUITE");
  console.log("Testing 26 Routes across 10 Viewport Breakpoints");
  console.log("=================================================\n");

  const userToken = await createToken({
    userId: "usr_test_audit_001",
    email: "abdurrahmanibnghufran@gmail.com",
    role: "USER",
    name: "abdurrahmanibnghufran",
    uid: 978613,
  });

  const adminToken = await createToken({
    userId: "adm_test_audit_001",
    email: "admin@ethsltd.com",
    role: "SUPER_ADMIN",
    name: "Platform Administrator",
    uid: 100001,
  });

  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const totalResults = {
    passed: 0,
    failed: 0,
    details: [],
  };

  try {
    // 1. Audit User Routes
    console.log(">>> AUDITING USER-FACING ROUTES (Authenticated User Session)...");
    const userContext = await browser.newContext();
    await userContext.addCookies([
      {
        name: "ethsltd_auth_token",
        value: userToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    const userPage = await userContext.newPage();

    for (const r of USER_ROUTES) {
      console.log(`\nRoute: ${r.path} (${r.name})`);
      for (const vp of VIEWPORTS) {
        await userPage.setViewportSize({ width: vp.width, height: vp.height });
        await userPage.goto(`http://localhost:3000${r.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 25000,
        });
        await userPage.waitForTimeout(400);

        const metrics = await userPage.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const innerW = window.innerWidth;
          const hasWindowOverflow = scrollW > innerW + 1;

          // Check if any visible element exceeds window width horizontally (excluding legitimate table scrollers)
          const allEls = Array.from(document.querySelectorAll("body *"));
          const overflowing = [];
          for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              rect.width === 0 ||
              rect.height === 0
            ) {
              continue;
            }
            if (rect.right > innerW + 2 && !el.closest(".overflow-x-auto")) {
              overflowing.push({
                tag: el.tagName,
                cls: el.className?.toString().slice(0, 60),
                right: Math.round(rect.right),
                excess: Math.round(rect.right - innerW),
              });
              if (overflowing.length >= 3) break;
            }
          }

          return {
            scrollW,
            innerW,
            hasWindowOverflow,
            overflowingCount: overflowing.length,
            sampleOverflow: overflowing[0] || null,
          };
        });

        const status =
          !metrics.hasWindowOverflow && metrics.overflowingCount === 0
            ? "PASS"
            : "FAIL";

        if (status === "PASS") {
          totalResults.passed++;
          process.stdout.write(` [${vp.width}px: PASS]`);
        } else {
          totalResults.failed++;
          process.stdout.write(
            ` [${vp.width}px: FAIL(scroll:${metrics.scrollW}px, inner:${metrics.innerW}px)]`
          );
          totalResults.details.push({
            route: r.path,
            viewport: vp.name,
            metrics,
          });
        }
      }
    }
    await userContext.close();

    // 2. Audit Admin Routes
    console.log("\n\n>>> AUDITING ADMIN CONSOLE ROUTES (Super Admin Session)...");
    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      {
        name: "ethsltd_auth_token",
        value: adminToken,
        domain: "localhost",
        path: "/",
      },
    ]);

    const adminPage = await adminContext.newPage();

    for (const r of ADMIN_ROUTES) {
      console.log(`\nRoute: ${r.path} (${r.name})`);
      for (const vp of VIEWPORTS) {
        await adminPage.setViewportSize({ width: vp.width, height: vp.height });
        await adminPage.goto(`http://localhost:3000${r.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 25000,
        });
        await adminPage.waitForTimeout(400);

        const metrics = await adminPage.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const innerW = window.innerWidth;
          const hasWindowOverflow = scrollW > innerW + 1;

          // Check if any visible element exceeds window width horizontally (excluding legitimate table scrollers)
          const allEls = Array.from(document.querySelectorAll("body *"));
          const overflowing = [];
          for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              rect.width === 0 ||
              rect.height === 0
            ) {
              continue;
            }
            if (rect.right > innerW + 2 && !el.closest(".overflow-x-auto")) {
              overflowing.push({
                tag: el.tagName,
                cls: el.className?.toString().slice(0, 60),
                right: Math.round(rect.right),
                excess: Math.round(rect.right - innerW),
              });
              if (overflowing.length >= 3) break;
            }
          }

          return {
            scrollW,
            innerW,
            hasWindowOverflow,
            overflowingCount: overflowing.length,
            sampleOverflow: overflowing[0] || null,
          };
        });

        const status =
          !metrics.hasWindowOverflow && metrics.overflowingCount === 0
            ? "PASS"
            : "FAIL";

        if (status === "PASS") {
          totalResults.passed++;
          process.stdout.write(` [${vp.width}px: PASS]`);
        } else {
          totalResults.failed++;
          process.stdout.write(
            ` [${vp.width}px: FAIL(scroll:${metrics.scrollW}px, inner:${metrics.innerW}px)]`
          );
          totalResults.details.push({
            route: r.path,
            viewport: vp.name,
            metrics,
          });
        }
      }
    }
    await adminContext.close();

    console.log("\n\n=================================================");
    console.log("AUDIT RESULTS SUMMARY");
    console.log("=================================================");
    console.log(`Total Checks Executed : ${totalResults.passed + totalResults.failed}`);
    console.log(`Checks Passed         : ${totalResults.passed}`);
    console.log(`Checks Failed         : ${totalResults.failed}`);
    if (totalResults.failed > 0) {
      console.log("\nFailures Details:");
      console.log(JSON.stringify(totalResults.details, null, 2));
    } else {
      console.log("\nALL 260 VIEWPORT AND ROUTE TESTS PASSED WITH ZERO HORIZONTAL OVERFLOW!");
    }
  } finally {
    await browser.close();
  }
}

runAudit().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
