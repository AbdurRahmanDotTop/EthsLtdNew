import { validateEmail } from "../../api/src/utils/email-validator.ts";

async function runTests() {
  console.log("=== ETHSLTD API EMAIL VALIDATION SUITE ===");

  const testCases = [
    { email: "trader.john@gmail.com", expectedValid: true, desc: "Personal Gmail" },
    { email: "employee@facebook.com", expectedValid: true, desc: "Corporate Facebook" },
    { email: "partner@business.com", expectedValid: true, desc: "Corporate Business.com" },
    { email: "spambot@mailinator.com", expectedValid: false, desc: "Disposable Mailinator" },
    { email: "test@example.com", expectedValid: false, desc: "Reserved Example.com" },
    { email: "notanemail", expectedValid: false, desc: "Malformed (No @)" },
    { email: "trader@completely-fake-nonexistent-domain-9991238.com", expectedValid: false, desc: "Non-existent Fake Domain (DNS NXDOMAIN)" },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const res = await validateEmail(tc.email);
    const pass = res.isValid === tc.expectedValid;
    if (pass) {
      passed++;
      console.log(`[PASS] ${tc.desc} (${tc.email}): valid=${res.isValid}`);
    } else {
      failed++;
      console.error(`[FAIL] ${tc.desc} (${tc.email}): expected=${tc.expectedValid}, actual=${res.isValid}, error=${res.error}`);
    }
  }

  console.log(`\nAPI Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
