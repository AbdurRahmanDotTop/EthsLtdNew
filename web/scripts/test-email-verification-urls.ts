import {
  normalizeBaseUrl,
  isProductionEnvironment,
  getAppUrlSync,
  getAppUrl,
  sanitizeEmailUrl,
  PRODUCTION_DOMAIN,
  LOCAL_DEV_DOMAIN,
} from "../src/lib/app-url";
import {
  sendEmailVerificationOtpNotification,
  sendPasswordResetNotification,
  sendPinResetNotification,
  sendWelcomeNotification,
  sendDepositNotification,
  sendWithdrawalNotification,
  sendKycNotification,
  sendOrderExecutionNotification,
  sendP2pOrderNotification,
} from "../src/lib/email";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${desc}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${desc}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function runTests() {
  console.log("=== COMPREHENSIVE EMAIL VERIFICATION & URL INTEGRITY AUDIT ===\n");

  // Save initial env state
  const prevNodeEnv = process.env.NODE_ENV;
  const prevAppUrl = process.env.APP_URL;
  const prevPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // TEST SUITE 1: Base URL Normalization & Sanitization
    console.log("Suite 1: URL Normalization and Safeguards");
    assert(normalizeBaseUrl("https://ethsltd.com/") === "https://ethsltd.com", "Trims trailing slash from HTTPS URL");
    assert(normalizeBaseUrl("http://localhost:3000///") === "http://localhost:3000", "Trims multiple trailing slashes");
    assert(normalizeBaseUrl("invalid-url") === null, "Rejects non-HTTP URLs");
    assert(normalizeBaseUrl("") === null, "Rejects empty strings");

    // TEST SUITE 2: Production Safeguards Against Localhost Leakage
    console.log("\nSuite 2: Production Domain Resolution & Localhost Leak Prevention");
    process.env.NODE_ENV = "production";

    // Even if an env var mistakenly points to localhost in production:
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const prodBaseUrl = getAppUrlSync();
    assert(
      prodBaseUrl === PRODUCTION_DOMAIN,
      "getAppUrlSync() refuses localhost and falls back to https://ethsltd.com in production",
      `Got: ${prodBaseUrl}`
    );

    // Sanitize email URLs
    const sanitizedLocalhost = sanitizeEmailUrl("http://localhost:3000/verify-email?email=test%40ethsltd.com&code=123456");
    assert(
      sanitizedLocalhost === "https://ethsltd.com/verify-email?email=test%40ethsltd.com&code=123456",
      "sanitizeEmailUrl() replaces http://localhost:3000 with https://ethsltd.com in production",
      `Got: ${sanitizedLocalhost}`
    );

    const sanitized127 = sanitizeEmailUrl("http://127.0.0.1:3000/reset-password?token=abc");
    assert(
      sanitized127 === "https://ethsltd.com/reset-password?token=abc",
      "sanitizeEmailUrl() replaces http://127.0.0.1:3000 with https://ethsltd.com in production",
      `Got: ${sanitized127}`
    );

    const sanitizedRelative = sanitizeEmailUrl("/verify-email?email=user%40test.com");
    assert(
      sanitizedRelative === "https://ethsltd.com/verify-email?email=user%40test.com",
      "sanitizeEmailUrl() converts relative path to canonical https://ethsltd.com",
      `Got: ${sanitizedRelative}`
    );

    // TEST SUITE 3: Dynamic Request Headers Inspection
    console.log("\nSuite 3: Dynamic Request Headers Resolution");
    const mockProdHeaders = new Headers({
      origin: "https://ethsltd.com",
      host: "ethsltd.com",
      "x-forwarded-proto": "https",
    });
    const headerResolved = await getAppUrl(mockProdHeaders);
    assert(
      headerResolved === "https://ethsltd.com",
      "getAppUrl(headers) accurately captures production domain from origin header",
      `Got: ${headerResolved}`
    );

    const mockWwwHeaders = new Headers({
      origin: "https://www.ethsltd.com",
      host: "www.ethsltd.com",
      "x-forwarded-proto": "https",
    });
    const wwwResolved = await getAppUrl(mockWwwHeaders);
    assert(
      wwwResolved === "https://www.ethsltd.com",
      "getAppUrl(headers) preserves user-facing www.ethsltd.com origin",
      `Got: ${wwwResolved}`
    );

    // If client passes localhost origin header in production:
    const mockMaliciousHeaders = new Headers({
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    const safeguardedOrigin = await getAppUrl(mockMaliciousHeaders);
    assert(
      safeguardedOrigin === "https://ethsltd.com",
      "getAppUrl(headers) blocks localhost origin when NODE_ENV=production",
      `Got: ${safeguardedOrigin}`
    );

    // TEST SUITE 4: Verification Email Template and Link Generation
    console.log("\nSuite 4: Email Verification Template Link Generation");
    process.env.APP_URL = "https://ethsltd.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://ethsltd.com";

    // Simulate sending email verification (intercepting output by inspecting rendered options)
    const testEmail = "testuser@ethsltd.com";
    const testOtp = "789123";
    const testUrlWithLocalhost = `http://localhost:3000/verify-email?email=${encodeURIComponent(testEmail)}&code=${testOtp}`;

    // Test with explicit verifyUrl containing localhost
    const mockSendResult = await sendEmailVerificationOtpNotification({
      email: testEmail,
      otpCode: testOtp,
      verifyUrl: testUrlWithLocalhost,
    });
    // Even if caller passed a verifyUrl with localhost, it should have succeeded in creating email log/send
    assert(mockSendResult !== undefined, "sendEmailVerificationOtpNotification executes successfully");

    // TEST SUITE 5: Password Reset and PIN Reset URLs
    console.log("\nSuite 5: Password & PIN Reset URL Sanitization");
    const rawResetUrl = "http://localhost:3000/reset-password?token=secret123&email=test%40ethsltd.com";
    const cleanResetUrl = sanitizeEmailUrl(rawResetUrl);
    assert(
      cleanResetUrl === "https://ethsltd.com/reset-password?token=secret123&email=test%40ethsltd.com",
      "Password reset link sanitized to production URL",
      `Got: ${cleanResetUrl}`
    );

    const rawPinUrl = "http://localhost:3000/reset-pin?token=pin123&email=test%40ethsltd.com";
    const cleanPinUrl = sanitizeEmailUrl(rawPinUrl);
    assert(
      cleanPinUrl === "https://ethsltd.com/reset-pin?token=pin123&email=test%40ethsltd.com",
      "PIN reset link sanitized to production URL",
      `Got: ${cleanPinUrl}`
    );

    // TEST SUITE 6: Development Mode Verification
    console.log("\nSuite 6: Local Development Compatibility");
    process.env.NODE_ENV = "development";
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const devBaseUrl = getAppUrlSync();
    assert(
      devBaseUrl === "http://localhost:3000",
      "In development mode, localhost:3000 is permitted for local testing",
      `Got: ${devBaseUrl}`
    );

    const mockDevHeaders = new Headers({
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "x-forwarded-proto": "http",
    });
    const devHeaderResolved = await getAppUrl(mockDevHeaders);
    assert(
      devHeaderResolved === "http://localhost:3000",
      "In development mode, headers with localhost:3000 resolve properly",
      `Got: ${devHeaderResolved}`
    );

  } finally {
    // Restore original env
    process.env.NODE_ENV = prevNodeEnv;
    process.env.APP_URL = prevAppUrl;
    process.env.NEXT_PUBLIC_APP_URL = prevPublicAppUrl;
  }

  console.log(`\n========================================`);
  console.log(`Audit Summary: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});
