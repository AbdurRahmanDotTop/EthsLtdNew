import {
  EmailCategory,
  resolveEmailSenderName,
  getCategoryForEventType,
  formatFromHeader,
  sanitizeSenderName,
  DEFAULT_CATEGORY_SENDER_NAMES,
  DEFAULT_GENERIC_SENDER_NAME,
} from "../src/lib/email-categories";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
  }
}

console.log("===============================================================");
console.log("ETHSLTD Category-Based Email Sender Name System Verification");
console.log("===============================================================\n");

// -------------------------------------------------------------
// Test Suite 1: Standard Default Category Sender Names
// -------------------------------------------------------------
console.log("--- 1. Testing Default Display Name Resolution for All 15 Categories ---");

const expectedDefaultNames: Record<EmailCategory, string> = {
  [EmailCategory.SECURITY]: "ETHSLTD Security",
  [EmailCategory.ORDERS]: "ETHSLTD Orders",
  [EmailCategory.P2P]: "ETHSLTD P2P",
  [EmailCategory.WALLET]: "ETHSLTD Wallet",
  [EmailCategory.PAYMENTS]: "ETHSLTD Payments",
  [EmailCategory.VERIFICATION]: "ETHSLTD Verification",
  [EmailCategory.SUPPORT]: "ETHSLTD Support",
  [EmailCategory.COMPLIANCE]: "ETHSLTD Compliance",
  [EmailCategory.MARKET_ALERTS]: "ETHSLTD Market Alerts",
  [EmailCategory.ACCOUNT]: "ETHSLTD Account",
  [EmailCategory.UPDATES]: "ETHSLTD Updates",
  [EmailCategory.REWARDS]: "ETHSLTD Rewards",
  [EmailCategory.REPORTS]: "ETHSLTD Reports",
  [EmailCategory.ADMIN_ALERTS]: "ETHSLTD Admin Alerts",
  [EmailCategory.API_SECURITY]: "ETHSLTD API Security",
};

for (const [cat, expectedName] of Object.entries(expectedDefaultNames)) {
  const resolved = resolveEmailSenderName(cat as EmailCategory, {});
  assert(
    resolved === expectedName,
    `Category ${cat} resolves to "${expectedName}"`,
    `Got "${resolved}", expected "${expectedName}"`
  );
}

// -------------------------------------------------------------
// Test Suite 2: Environment Variable Precedence & Overrides
// -------------------------------------------------------------
console.log("\n--- 2. Testing Environment Variable Precedence & Overrides ---");

// Override a specific category
const customEnv = {
  EMAIL_FROM_NAME_SECURITY: "ETHSLTD Global Security Desk",
  EMAIL_FROM_NAME_ORDERS: "ETHSLTD Spot & Margin Orders",
  EMAIL_FROM_NAME: "ETHSLTD Generic Fallback",
};

assert(
  resolveEmailSenderName(EmailCategory.SECURITY, customEnv) === "ETHSLTD Global Security Desk",
  "EMAIL_FROM_NAME_SECURITY overrides default category name"
);

assert(
  resolveEmailSenderName(EmailCategory.ORDERS, customEnv) === "ETHSLTD Spot & Margin Orders",
  "EMAIL_FROM_NAME_ORDERS overrides default category name"
);

// Non-overridden category must retain its standard category name and NOT collapse to generic EMAIL_FROM_NAME
assert(
  resolveEmailSenderName(EmailCategory.P2P, customEnv) === "ETHSLTD P2P",
  "P2P retains 'ETHSLTD P2P' when only EMAIL_FROM_NAME is set in env"
);

assert(
  resolveEmailSenderName(EmailCategory.WALLET, customEnv) === "ETHSLTD Wallet",
  "WALLET retains 'ETHSLTD Wallet' when only EMAIL_FROM_NAME is set in env"
);

assert(
  resolveEmailSenderName(EmailCategory.PAYMENTS, customEnv) === "ETHSLTD Payments",
  "PAYMENTS retains 'ETHSLTD Payments' when only EMAIL_FROM_NAME is set in env"
);

// -------------------------------------------------------------
// Test Suite 3: Fallback & Unknown Category Handling
// -------------------------------------------------------------
console.log("\n--- 3. Testing Fallbacks and Unknown Category Handling ---");

// Empty / Null category falls back to EMAIL_FROM_NAME or ETHSLTD
assert(
  resolveEmailSenderName(null, { EMAIL_FROM_NAME: "ETHSLTD Platform" }) === "ETHSLTD Platform",
  "Null category falls back to configured EMAIL_FROM_NAME"
);

assert(
  resolveEmailSenderName(null, {}) === "ETHSLTD",
  "Null category with empty env falls back to default institutional 'ETHSLTD'"
);

// Unknown category falls back safely with logging
assert(
  resolveEmailSenderName("UNKNOWN_MARKETING_EVENT", { EMAIL_FROM_NAME: "ETHSLTD Custom Fallback" }) === "ETHSLTD Custom Fallback",
  "Unknown category safely falls back to configured EMAIL_FROM_NAME"
);

assert(
  resolveEmailSenderName("UNKNOWN_MARKETING_EVENT", {}) === "ETHSLTD",
  "Unknown category without env falls back to 'ETHSLTD'"
);

// -------------------------------------------------------------
// Test Suite 4: Header Injection Protection & Formatting
// -------------------------------------------------------------
console.log("\n--- 4. Testing RFC 5322 From Header Formatting & Header Injection Defense ---");

assert(
  formatFromHeader("ETHSLTD Security", "support@ethsltd.com") === '"ETHSLTD Security" <support@ethsltd.com>',
  "RFC 5322 From header formatted correctly"
);

const maliciousName = 'ETHSLTD Security\r\nBcc: attacker@evil.com\n"quoted" <injected>';
const sanitized = sanitizeSenderName(maliciousName);
assert(
  !sanitized.includes("\r") && !sanitized.includes("\n") && !sanitized.includes('"') && !sanitized.includes("<"),
  "Sanitization eliminates CRLF, quotes, and angle brackets",
  `Sanitized result: "${sanitized}"`
);

const sanitizedHeader = formatFromHeader(maliciousName, "support@ethsltd.com");
assert(
  sanitizedHeader.startsWith('"') && sanitizedHeader.endsWith("<support@ethsltd.com>"),
  "Header injection attempt safely defused in From header"
);

// -------------------------------------------------------------
// Test Suite 5: Event-to-Category Mapping
// -------------------------------------------------------------
console.log("\n--- 5. Testing System Event-to-Category Classification ---");

const eventTestCases: Array<{ event: string; context?: any; expectedCategory: EmailCategory }> = [
  { event: "WELCOME", expectedCategory: EmailCategory.SECURITY },
  { event: "RESET_PASSWORD", expectedCategory: EmailCategory.SECURITY },
  { event: "RESET_PIN", expectedCategory: EmailCategory.SECURITY },
  { event: "PASSWORD_CHANGED", expectedCategory: EmailCategory.SECURITY },
  { event: "PIN_CHANGED", expectedCategory: EmailCategory.SECURITY },
  { event: "USER_VERIFY_EMAIL_LINK", expectedCategory: EmailCategory.SECURITY },
  { event: "USER_VERIFY_EMAIL_OTP", expectedCategory: EmailCategory.SECURITY },
  { event: "USER_PASSWORD_RESET", expectedCategory: EmailCategory.SECURITY },
  { event: "ORDER_EXECUTION", expectedCategory: EmailCategory.ORDERS },
  { event: "TRADE_EXECUTION", expectedCategory: EmailCategory.ORDERS },
  { event: "P2P_ORDER_STATUS", expectedCategory: EmailCategory.P2P },
  { event: "P2P_PAYMENT_MARKED", expectedCategory: EmailCategory.P2P },
  { event: "P2P_ORDER_COMPLETED", expectedCategory: EmailCategory.P2P },
  { event: "KYC_STATUS", expectedCategory: EmailCategory.VERIFICATION },
  { event: "ADMIN_ALERT", expectedCategory: EmailCategory.ADMIN_ALERTS },
  { event: "ADMIN_NEW_USER", expectedCategory: EmailCategory.ADMIN_ALERTS },
  { event: "ADMIN_DEPOSIT", expectedCategory: EmailCategory.ADMIN_ALERTS },
  { event: "ADMIN_TRADE", expectedCategory: EmailCategory.ADMIN_ALERTS },
  { event: "DEPOSIT_STATUS", context: { asset: "BTC", isFiat: false }, expectedCategory: EmailCategory.WALLET },
  { event: "DEPOSIT_STATUS", context: { asset: "USDT", isFiat: false }, expectedCategory: EmailCategory.WALLET },
  { event: "DEPOSIT_STATUS", context: { asset: "INR", isFiat: true }, expectedCategory: EmailCategory.PAYMENTS },
  { event: "DEPOSIT_STATUS", context: { asset: "USD", isFiat: true }, expectedCategory: EmailCategory.PAYMENTS },
  { event: "WITHDRAWAL_STATUS", context: { asset: "ETH", isFiat: false }, expectedCategory: EmailCategory.WALLET },
  { event: "WITHDRAWAL_STATUS", context: { asset: "INR", isFiat: true }, expectedCategory: EmailCategory.PAYMENTS },
  { event: "SUPPORT_REPLY", expectedCategory: EmailCategory.SUPPORT },
  { event: "COMPLIANCE_REQUEST", expectedCategory: EmailCategory.COMPLIANCE },
  { event: "MARKET_ALERT", expectedCategory: EmailCategory.MARKET_ALERTS },
  { event: "ACCOUNT_UPDATE", expectedCategory: EmailCategory.ACCOUNT },
  { event: "SYSTEM_MAINTENANCE", expectedCategory: EmailCategory.UPDATES },
  { event: "REWARD_EARNED", expectedCategory: EmailCategory.REWARDS },
  { event: "ACCOUNT_STATEMENT", expectedCategory: EmailCategory.REPORTS },
  { event: "API_KEY_CREATED", expectedCategory: EmailCategory.API_SECURITY },
];

for (const tc of eventTestCases) {
  const cat = getCategoryForEventType(tc.event, tc.context);
  assert(
    cat === tc.expectedCategory,
    `Event '${tc.event}' ${tc.context ? JSON.stringify(tc.context) : ""} maps to ${tc.expectedCategory}`,
    `Got ${cat}, expected ${tc.expectedCategory}`
  );
}

// -------------------------------------------------------------
// Test Suite 6: Isolation & No Leakage Across Distinct Categories
// -------------------------------------------------------------
console.log("\n--- 6. Testing Identity Separation Across Core Crypto Exchange Categories ---");

const distinctCategories = [
  EmailCategory.SECURITY,
  EmailCategory.ORDERS,
  EmailCategory.P2P,
  EmailCategory.WALLET,
  EmailCategory.PAYMENTS,
  EmailCategory.VERIFICATION,
  EmailCategory.SUPPORT,
  EmailCategory.ADMIN_ALERTS,
];

const senderNamesSet = new Set<string>();
for (const cat of distinctCategories) {
  const name = resolveEmailSenderName(cat);
  senderNamesSet.add(name);
}

assert(
  senderNamesSet.size === distinctCategories.length,
  `All ${distinctCategories.length} core platform categories have mutually unique sender names (no accidental alias collision)`
);

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log("\n===============================================================");
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log("===============================================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
