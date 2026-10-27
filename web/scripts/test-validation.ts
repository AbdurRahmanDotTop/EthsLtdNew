import { validateEmail } from "../src/lib/email-validator";

async function runTests() {
  console.log("=== ETHSLTD EMAIL VALIDATION SUITE ===");

  const testCases = [
    // 1. Legitimate Personal Emails
    { email: "trader.john@gmail.com", expectedValid: true, desc: "Personal Gmail" },
    { email: "investor.alex@yahoo.com", expectedValid: true, desc: "Personal Yahoo" },
    { email: "user.pro@outlook.com", expectedValid: true, desc: "Personal Outlook" },
    { email: "privacy.fan@proton.me", expectedValid: true, desc: "Personal Proton" },

    // 2. Legitimate Corporate Emails (NOT on old trusted list)
    { email: "employee@facebook.com", expectedValid: true, desc: "Corporate Facebook" },
    { email: "staff@google.com", expectedValid: true, desc: "Corporate Google" },
    { email: "partner@business.com", expectedValid: true, desc: "Corporate Business.com" },
    { email: "engineer@microsoft.com", expectedValid: true, desc: "Corporate Microsoft" },
    { email: "trader@apple.com", expectedValid: true, desc: "Corporate Apple" },
    { email: "compliance@amazon.com", expectedValid: true, desc: "Corporate Amazon" },

    // 3. Known Disposable Emails
    { email: "spambot@mailinator.com", expectedValid: false, desc: "Disposable Mailinator" },
    { email: "throwaway@tempmail.com", expectedValid: false, desc: "Disposable TempMail" },
    { email: "bot@sharklasers.com", expectedValid: false, desc: "Disposable Sharklasers" },
    { email: "temp@guerrillamail.com", expectedValid: false, desc: "Disposable GuerrillaMail" },
    { email: "scammer@subdomain.mailinator.com", expectedValid: false, desc: "Disposable Subdomain Mailinator" },

    // 4. Test & Non-Routable Domains
    { email: "test@example.com", expectedValid: false, desc: "Reserved Example.com" },
    { email: "user@test.com", expectedValid: false, desc: "Reserved Test.com" },
    { email: "admin@localhost", expectedValid: false, desc: "Non-routable Localhost" },

    // 5. Malformed Emails
    { email: "notanemail", expectedValid: false, desc: "Malformed (No @)" },
    { email: "@domain.com", expectedValid: false, desc: "Malformed (No local part)" },
    { email: "user@", expectedValid: false, desc: "Malformed (No domain)" },
    { email: "user@.com", expectedValid: false, desc: "Malformed (Dot after @)" },
    { email: "user..name@gmail.com", expectedValid: false, desc: "Malformed (Consecutive dots)" },

    // 6. Non-existent Fake Domain
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

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
