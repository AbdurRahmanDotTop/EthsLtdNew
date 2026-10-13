/**
 * ETHSLTD Centralized Email Categories and Sender Name Resolution
 *
 * Implements category-based sender display identities for a global crypto exchange
 * and P2P trading platform adhering to institutional security standards.
 */

export enum EmailCategory {
  SECURITY = "SECURITY",
  ORDERS = "ORDERS",
  P2P = "P2P",
  WALLET = "WALLET",
  PAYMENTS = "PAYMENTS",
  VERIFICATION = "VERIFICATION",
  SUPPORT = "SUPPORT",
  COMPLIANCE = "COMPLIANCE",
  MARKET_ALERTS = "MARKET_ALERTS",
  ACCOUNT = "ACCOUNT",
  UPDATES = "UPDATES",
  REWARDS = "REWARDS",
  REPORTS = "REPORTS",
  ADMIN_ALERTS = "ADMIN_ALERTS",
  API_SECURITY = "API_SECURITY",
}

export const DEFAULT_CATEGORY_SENDER_NAMES: Record<EmailCategory, string> = {
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

export const DEFAULT_GENERIC_SENDER_NAME = "ETHSLTD";

export const CATEGORY_ENV_VARIABLE_MAP: Record<EmailCategory, string> = {
  [EmailCategory.SECURITY]: "EMAIL_FROM_NAME_SECURITY",
  [EmailCategory.ORDERS]: "EMAIL_FROM_NAME_ORDERS",
  [EmailCategory.P2P]: "EMAIL_FROM_NAME_P2P",
  [EmailCategory.WALLET]: "EMAIL_FROM_NAME_WALLET",
  [EmailCategory.PAYMENTS]: "EMAIL_FROM_NAME_PAYMENTS",
  [EmailCategory.VERIFICATION]: "EMAIL_FROM_NAME_VERIFICATION",
  [EmailCategory.SUPPORT]: "EMAIL_FROM_NAME_SUPPORT",
  [EmailCategory.COMPLIANCE]: "EMAIL_FROM_NAME_COMPLIANCE",
  [EmailCategory.MARKET_ALERTS]: "EMAIL_FROM_NAME_MARKET_ALERTS",
  [EmailCategory.ACCOUNT]: "EMAIL_FROM_NAME_ACCOUNT",
  [EmailCategory.UPDATES]: "EMAIL_FROM_NAME_UPDATES",
  [EmailCategory.REWARDS]: "EMAIL_FROM_NAME_REWARDS",
  [EmailCategory.REPORTS]: "EMAIL_FROM_NAME_REPORTS",
  [EmailCategory.ADMIN_ALERTS]: "EMAIL_FROM_NAME_ADMIN_ALERTS",
  [EmailCategory.API_SECURITY]: "EMAIL_FROM_NAME_API_SECURITY",
};

export const FIAT_CURRENCIES = new Set(["INR", "USD", "EUR", "AED", "GBP", "CAD", "AUD", "JPY"]);

/**
 * Resolves the appropriate sender display name based on email category and environment.
 * Precedence:
 * 1. Explicit Category Environment Variable (e.g., EMAIL_FROM_NAME_SECURITY)
 * 2. Dedicated Category Standard Default (e.g., "ETHSLTD Security")
 * 3. Generic Fallback Environment Variable (EMAIL_FROM_NAME) if category unknown
 * 4. Institutional Global Fallback ("ETHSLTD")
 */
export function resolveEmailSenderName(
  category?: EmailCategory | string | null,
  env?: Record<string, string | undefined>
): string {
  if (!category) {
    const genericEnv =
      env?.EMAIL_FROM_NAME ||
      (typeof process !== "undefined" ? process.env?.EMAIL_FROM_NAME || process.env?.MAIL_FROM_NAME : undefined);
    return sanitizeSenderName(genericEnv?.trim() || DEFAULT_GENERIC_SENDER_NAME);
  }

  const normalizedCategory = String(category).toUpperCase().trim() as EmailCategory;
  const envKey = CATEGORY_ENV_VARIABLE_MAP[normalizedCategory];

  // 1. Check category-specific environment variable override
  if (envKey) {
    const explicitEnvValue =
      env?.[envKey] ||
      (typeof process !== "undefined" ? process.env?.[envKey] : undefined);
    if (explicitEnvValue && explicitEnvValue.trim().length > 0) {
      return sanitizeSenderName(explicitEnvValue.trim());
    }
  }

  // 2. Check dedicated standard category default
  if (normalizedCategory in DEFAULT_CATEGORY_SENDER_NAMES) {
    return DEFAULT_CATEGORY_SENDER_NAMES[normalizedCategory];
  }

  // 3. Category unknown: log warning and fall back safely to generic
  console.warn(`[ETHSLTD Email] Unknown email category "${category}", safely falling back to generic sender identity.`);
  const genericEnv =
    env?.EMAIL_FROM_NAME ||
    (typeof process !== "undefined" ? process.env?.EMAIL_FROM_NAME || process.env?.MAIL_FROM_NAME : undefined);
  return sanitizeSenderName(genericEnv?.trim() || DEFAULT_GENERIC_SENDER_NAME);
}

export function sanitizeSenderName(name: string): string {
  return name.replace(/[\r\n"<>]/g, "").trim();
}

export function formatFromHeader(senderName: string, senderEmail: string = "support@ethsltd.com"): string {
  const cleanName = sanitizeSenderName(senderName);
  const cleanEmail = senderEmail.replace(/[\r\n<>]/g, "").trim();
  return `"${cleanName}" <${cleanEmail}>`;
}

export function getCategoryForEventType(
  eventType: string,
  context?: { asset?: string; isFiat?: boolean; role?: string }
): EmailCategory {
  const normalized = (eventType || "").toUpperCase().trim();

  switch (normalized) {
    case "WELCOME":
    case "RESET_PASSWORD":
    case "RESET_PIN":
    case "PASSWORD_CHANGED":
    case "PIN_CHANGED":
    case "USER_VERIFY_EMAIL_LINK":
    case "USER_VERIFY_EMAIL_OTP":
    case "USER_PASSWORD_RESET":
    case "LOGIN_ALERT":
    case "2FA_CHANGED":
    case "SECURITY_ALERT":
      return EmailCategory.SECURITY;

    case "ORDER_EXECUTION":
    case "TRADE_EXECUTION":
    case "ORDER_PLACED":
    case "ORDER_CANCELLED":
    case "ORDER_FILLED":
      return EmailCategory.ORDERS;

    case "P2P_ORDER_STATUS":
    case "P2P_ORDER_CREATED":
    case "P2P_PAYMENT_MARKED":
    case "P2P_ORDER_COMPLETED":
    case "P2P_ORDER_CANCELLED":
    case "P2P_DISPUTE":
    case "P2P_APPEAL":
      return EmailCategory.P2P;

    case "DEPOSIT_STATUS":
    case "DEPOSIT": {
      const isFiat =
        context?.isFiat === true ||
        (context?.asset && FIAT_CURRENCIES.has(context.asset.toUpperCase()));
      return isFiat ? EmailCategory.PAYMENTS : EmailCategory.WALLET;
    }

    case "WITHDRAWAL_STATUS":
    case "WITHDRAWAL": {
      const isFiat =
        context?.isFiat === true ||
        (context?.asset && FIAT_CURRENCIES.has(context.asset.toUpperCase()));
      return isFiat ? EmailCategory.PAYMENTS : EmailCategory.WALLET;
    }

    case "INTERNAL_TRANSFER":
    case "BALANCE_UPDATE":
      return EmailCategory.WALLET;

    case "FIAT_PAYMENT":
    case "BANK_TRANSFER":
      return EmailCategory.PAYMENTS;

    case "KYC_STATUS":
    case "KYC_VERIFICATION":
    case "KYC_DOCUMENT_REQUEST":
      return EmailCategory.VERIFICATION;

    case "SUPPORT_TICKET":
    case "SUPPORT_REPLY":
    case "SUPPORT_CASE_CLOSED":
      return EmailCategory.SUPPORT;

    case "COMPLIANCE_REQUEST":
    case "AML_ALERT":
    case "SOURCE_OF_FUNDS":
      return EmailCategory.COMPLIANCE;

    case "MARKET_ALERT":
    case "PRICE_ALERT":
      return EmailCategory.MARKET_ALERTS;

    case "ACCOUNT_UPDATE":
    case "PROFILE_UPDATE":
      return EmailCategory.ACCOUNT;

    case "SYSTEM_MAINTENANCE":
    case "SERVICE_UPDATE":
    case "PLATFORM_ANNOUNCEMENT":
      return EmailCategory.UPDATES;

    case "REWARD_EARNED":
    case "REFERRAL_BONUS":
    case "PROMOTION":
      return EmailCategory.REWARDS;

    case "ACCOUNT_STATEMENT":
    case "TRADING_REPORT":
      return EmailCategory.REPORTS;

    case "ADMIN_ALERT":
    case "ADMIN_NEW_USER":
    case "ADMIN_DEPOSIT":
    case "ADMIN_WITHDRAWAL":
    case "ADMIN_P2P":
    case "ADMIN_TRADE":
    case "ADMIN_TRANSFER":
    case "ADMIN_KYC":
    case "TEST_EMAIL":
      return EmailCategory.ADMIN_ALERTS;

    case "API_KEY_CREATED":
    case "API_KEY_REVOKED":
    case "API_CREDENTIALS":
      return EmailCategory.API_SECURITY;

    default:
      if (normalized.startsWith("ADMIN_")) return EmailCategory.ADMIN_ALERTS;
      if (normalized.startsWith("P2P_")) return EmailCategory.P2P;
      if (normalized.startsWith("ORDER_") || normalized.startsWith("TRADE_")) return EmailCategory.ORDERS;
      if (normalized.startsWith("KYC_")) return EmailCategory.VERIFICATION;
      if (normalized.startsWith("WALLET_")) return EmailCategory.WALLET;
      if (normalized.startsWith("PAYMENT_")) return EmailCategory.PAYMENTS;
      if (normalized.startsWith("SECURITY_") || normalized.startsWith("AUTH_")) return EmailCategory.SECURITY;
      if (normalized.startsWith("SUPPORT_")) return EmailCategory.SUPPORT;
      if (normalized.startsWith("COMPLIANCE_")) return EmailCategory.COMPLIANCE;
      return EmailCategory.SECURITY;
  }
}
