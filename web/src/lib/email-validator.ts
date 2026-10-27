/**
 * Production-Grade Dynamic Email Validator & Anti-Spam Disposable Domain Filter
 * ETHSLTD Security Suite
 *
 * Supports:
 * - RFC 5322 syntax and format validation
 * - Dynamic DNS MX & RFC 5321 fallback A-record resolution for any legitimate corporate/custom domain
 * - Zero hardcoded restrictions: genuine corporate domains (e.g., facebook.com, google.com, business.com) are validated dynamically
 * - Resilient handling of transient DNS timeouts and network delays without blocking legitimate users
 * - In-memory DNS caching (15-min TTL) to ensure sub-millisecond response times for frequent domains
 * - Comprehensive disposable and throwaway domain blacklist
 */

// Comprehensive list of known disposable and temporary email domains
const DISPOSABLE_DOMAINS = new Set<string>([
  // Popular Disposable Email Providers
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.biz",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "grr.la",
  "sharklasers.com",
  "spam4.me",
  "pokemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "20minutemail.com",
  "throwawaymail.com",
  "dispostable.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.me",
  "trashmail.de",
  "trash-mail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "nada.ltd",
  "getnada.com",
  "abovedat.com",
  "dropmail.me",
  "fakemailgenerator.com",
  "maildrop.cc",
  "inboxkitten.com",
  "mohmal.com",
  "mohmal.in",
  "emailondeck.com",
  "crazymailing.com",
  "tmail.ws",
  "burnermail.io",
  "burnermail.net",
  "fakeinbox.com",
  "tempail.com",
  "disposablemail.com",
  "tempmailaddress.com",
  "mytempmail.com",
  "discard.email",
  "spambox.us",
  "trashymail.com",
  "maildisagree.com",
  "emailfake.com",
  "minutemailbox.com",
  "mailtemp.net",
  "tempemail.net",
  "generator.email",
  "chacuo.net",
  "byom.de",
  "mytemp.email",
  "mailnesia.com",
  "tempinbox.com",
  "getairmail.com",
  "incognitomail.org",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "einrot.com",
  "zoemail.org",
  "disbox.net",
  "disbox.org",
  "trashcanmail.com",
  "fake-box.com",
  "mytempemail.com",
  "kasmail.com",
  "safemail.icu",
  "instantemailaddress.com",
  "inboxclean.com",
  "fastmail.fm", // free tier often abused
  "trashmail.ws",
  "hidemail.org",
  "boun.cr",
  "mailcatch.com",
  "spamavert.com",
  "harakirimail.com",
  "guerrillamail.de",
  "sharklasers.org",
  "spamgourmet.com",
  "mailhero.io",
  "mohmal.im",
  "luxusmail.org",
  "tempm.com",
  "crazymail.com",
  "mailforce.net",
  "boximail.com",
  "mailpoof.com",
  "zillamail.com",
  "trashymail.net",
  "guerrillamail.info",
  "anonymousemail.me",
  "throwawayemailaddress.com",
  "0-mail.com",
  "10mail.org",
  "20mail.it",
  "emailfake.org",
  "emltmp.com",
  "fakemail.net",
  "generators.email",
  "generator-email.com",
  "internetoftrash.com",
  "mytempemail.net",
  "quickinbox.com",
  "sharklasers.net",
  "spambog.com",
  "spambog.de",
  "spambog.ru",
  "temporary-mail.net",
  "throwaway.email",
  "trashmail.at",
  "trashmail.io",
  "trashmail.se",
  "yopmail.gq",
  "yopmail.tk",
  "yopmail.ml",
  "yopmail.ga",
  "yopmail.cf",
  "yopmail.org",
  "zetmail.com",
  "zippymail.info",

  // Reserved Test/Dummy Domains (Disallowed in production registration)
  "example.com",
  "example.net",
  "example.org",
  "example.edu",
  "test.com",
  "test.net",
  "test.org",
  "invalid",
  "localhost",
  "sample.com",
  "sample.net",
  "sample.org",
  "dummy.com",
  "fake.com",
]);

/**
 * Common high-volume consumer mail hosts used strictly for DNS query fast-path optimization.
 * NOTE: This is NEVER used as an exclusive whitelist. Any valid corporate, business, or custom
 * email domain (e.g. facebook.com, google.com, business.com) dynamically resolves via DNS/MX.
 */
const KNOWN_MAJOR_DOMAINS = new Set<string>([
  "ethsltd.com",
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "aol.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "web.de",
  "fastmail.com",
  "t-online.de",
  "bluewin.ch",
  "orange.fr",
  "free.fr",
  "sfr.fr",
  "libero.it",
  "virgilio.it",
  "yandex.ru",
  "yandex.com",
  "mail.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "sohu.com",
  "naver.com",
  "daum.net",
  "abdurrahman.top",
  "techilyfly.com",
]);

// Regular expression for standard email syntax compliance (RFC 5322 subset)
const EMAIL_SYNTAX_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export interface EmailValidationResult {
  isValid: boolean;
  isDisposable: boolean;
  isTestDomain: boolean;
  domain: string;
  normalizedEmail: string;
  error?: string;
  hasMxRecords?: boolean;
  transientDnsError?: boolean;
}

// In-memory DNS cache with 15-minute TTL
interface CacheEntry {
  valid: boolean;
  transient?: boolean;
  error?: string;
  timestamp: number;
}
const mxCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Checks whether a domain has valid Mail Exchange (MX) servers or fallback A/AAAA records.
 * Gracefully handles transient DNS failures without blocking genuine users.
 */
export async function checkDomainMailServers(
  domain: string
): Promise<{ valid: boolean; transient?: boolean; error?: string }> {
  const normalizedDomain = domain.toLowerCase().trim();

  // 1. Fast-path optimization for known high-volume public mail providers
  if (KNOWN_MAJOR_DOMAINS.has(normalizedDomain)) {
    return { valid: true };
  }

  // 2. Check local in-memory cache
  const cached = mxCache.get(normalizedDomain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }

  // 3. Try native Node.js DNS resolution if available
  try {
    const dns = await import("node:dns/promises");
    try {
      const mxRecords = await dns.resolveMx(normalizedDomain);
      if (mxRecords && mxRecords.length > 0) {
        const result = { valid: true, timestamp: Date.now() };
        mxCache.set(normalizedDomain, result);
        return result;
      }
    } catch (mxErr: unknown) {
      const code = (mxErr as { code?: string })?.code;
      if (code === "ENOTFOUND" || code === "NXDOMAIN") {
        const result = {
          valid: false,
          error: `The email domain '@${normalizedDomain}' does not exist.`,
          timestamp: Date.now(),
        };
        mxCache.set(normalizedDomain, result);
        return result;
      }
      if (code === "ENODATA") {
        // Fallback to A / AAAA record check per RFC 5321 Section 5.1
        try {
          const aRecords = await dns.resolve(normalizedDomain);
          if (aRecords && aRecords.length > 0) {
            const result = { valid: true, timestamp: Date.now() };
            mxCache.set(normalizedDomain, result);
            return result;
          }
        } catch (aErr: unknown) {
          const aCode = (aErr as { code?: string })?.code;
          if (aCode === "ENOTFOUND" || aCode === "ENODATA" || aCode === "NXDOMAIN") {
            const result = {
              valid: false,
              error: `No active mail exchange (MX) or host records found for domain '@${normalizedDomain}'.`,
              timestamp: Date.now(),
            };
            mxCache.set(normalizedDomain, result);
            return result;
          }
        }
      } else {
        // Transient DNS error (ETIMEDOUT, SERVFAIL, EAI_AGAIN, etc.)
        const message = mxErr instanceof Error ? mxErr.message : String(mxErr);
        console.warn(`Transient DNS resolution failure for domain ${normalizedDomain}: ${message}. Gracefully permitting registration.`);
        return { valid: true, transient: true };
      }
    }
  } catch {
    // node:dns not available in this environment; fallback to DoH below
  }

  // 4. DNS over HTTPS (DoH) via Cloudflare 1.1.1.1 (Works across all environments)
  try {
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(normalizedDomain)}&type=MX`;
    const response = await fetch(dohUrl, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn(`DoH query returned HTTP ${response.status} for domain ${normalizedDomain}. Permitting registration.`);
      return { valid: true, transient: true };
    }

    const data = (await response.json()) as { Status?: number; Answer?: Array<{ type: number; data: string }> };

    // Status 3 is NXDOMAIN (domain does not exist in DNS)
    if (data.Status === 3) {
      const result = {
        valid: false,
        error: `The email domain '@${normalizedDomain}' does not exist.`,
        timestamp: Date.now(),
      };
      mxCache.set(normalizedDomain, result);
      return result;
    }

    // Status 0 is NOERROR
    if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
      const result = { valid: true, timestamp: Date.now() };
      mxCache.set(normalizedDomain, result);
      return result;
    }

    // RFC 5321 Fallback: Check A record
    const aDohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(normalizedDomain)}&type=A`;
    const aResponse = await fetch(aDohUrl, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });

    if (aResponse.ok) {
      const aData = (await aResponse.json()) as { Status?: number; Answer?: Array<{ type: number; data: string }> };
      if (aData.Status === 0 && aData.Answer && aData.Answer.length > 0) {
        const result = { valid: true, timestamp: Date.now() };
        mxCache.set(normalizedDomain, result);
        return result;
      }
    }

    // No MX or A records configured
    const result = {
      valid: false,
      error: `No active mail exchange (MX) servers found for domain '@${normalizedDomain}'.`,
      timestamp: Date.now(),
    };
    mxCache.set(normalizedDomain, result);
    return result;
  } catch (dohErr: unknown) {
    const message = dohErr instanceof Error ? dohErr.message : String(dohErr);
    console.warn(`Transient DoH DNS failure for domain ${normalizedDomain}: ${message}. Gracefully permitting registration.`);
    return { valid: true, transient: true };
  }
}

/**
 * Validates email syntax, structure, and disposable blacklist synchronously.
 */
export function validateEmailFormat(email: string | null | undefined): EmailValidationResult {
  if (!email || typeof email !== "string") {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: "",
      normalizedEmail: "",
      error: "Email address is required.",
    };
  }

  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: "",
      normalizedEmail: trimmed,
      error: "Email address exceeds maximum length (254 characters).",
    };
  }

  if (!EMAIL_SYNTAX_REGEX.test(trimmed)) {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: "",
      normalizedEmail: trimmed,
      error: "Invalid email address format.",
    };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: "",
      normalizedEmail: trimmed,
      error: "Invalid email address format.",
    };
  }

  const localPart = parts[0];
  const domainPart = parts[1].toLowerCase();

  // Validate local part length
  if (localPart.length > 64) {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: domainPart,
      normalizedEmail: trimmed.toLowerCase(),
      error: "Email username exceeds maximum length (64 characters).",
    };
  }

  // Reject consecutive dots or invalid punctuation in local part
  if (localPart.includes("..") || localPart.startsWith(".") || localPart.endsWith(".")) {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: domainPart,
      normalizedEmail: trimmed.toLowerCase(),
      error: "Email format contains invalid dot placement.",
    };
  }

  // Extract domain parts and TLD
  const domainSegments = domainPart.split(".");
  const tld = domainSegments[domainSegments.length - 1];
  if (!tld || tld.length < 2 || /\d/.test(tld)) {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: domainPart,
      normalizedEmail: trimmed.toLowerCase(),
      error: "Email contains an invalid top-level domain.",
    };
  }

  const normalizedEmail = `${localPart}@${domainPart}`;

  // Check test / non-routable domains
  const isTest =
    domainPart === "example.com" ||
    domainPart.endsWith(".example.com") ||
    domainPart === "example.net" ||
    domainPart === "example.org" ||
    domainPart === "test.com" ||
    domainPart.endsWith(".test.com") ||
    domainPart === "invalid" ||
    domainPart === "localhost";

  if (isTest) {
    return {
      isValid: false,
      isDisposable: true,
      isTestDomain: true,
      domain: domainPart,
      normalizedEmail,
      error: `Test and non-routable domains (@${domainPart}) are not permitted for account registration.`,
    };
  }

  // Check disposable domains (including subdomains of disposable providers)
  let parentDomain = domainPart;
  while (parentDomain.includes(".")) {
    if (DISPOSABLE_DOMAINS.has(parentDomain)) {
      return {
        isValid: false,
        isDisposable: true,
        isTestDomain: false,
        domain: domainPart,
        normalizedEmail,
        error: "Temporary and disposable email addresses are not allowed. Please use a permanent email provider (e.g. Gmail, Outlook, corporate email).",
      };
    }
    const dotIndex = parentDomain.indexOf(".");
    parentDomain = parentDomain.slice(dotIndex + 1);
  }

  // Targeted heuristic patterns for temporary email providers
  const disposablePatterns = [
    /temp[-_]?mail/i,
    /dispos[-_]?mail/i,
    /fake[-_]?mail/i,
    /throwaway/i,
    /trash[-_]?mail/i,
    /10[-_]?minute/i,
    /20[-_]?minute/i,
    /burner[-_]?mail/i,
    /inbox[-_]?kitten/i,
    /generator[-_]?email/i,
    /email[-_]?ondeck/i,
  ];

  for (const pattern of disposablePatterns) {
    if (pattern.test(domainPart)) {
      return {
        isValid: false,
        isDisposable: true,
        isTestDomain: false,
        domain: domainPart,
        normalizedEmail,
        error: "Disposable email domain detected. Please use an official permanent or corporate email service.",
      };
    }
  }

  return {
    isValid: true,
    isDisposable: false,
    isTestDomain: false,
    domain: domainPart,
    normalizedEmail,
  };
}

/**
 * Validates an email address against syntax rules, disposable domain databases,
 * and automated spam heuristics, with dynamic DNS/MX mail server verification.
 *
 * Genuine corporate domains (e.g. facebook.com, google.com, business.com) and custom domains
 * are dynamically resolved and approved without requiring hardcoded list entries.
 */
export async function validateEmail(
  email: string | null | undefined,
  options?: { checkMx?: boolean }
): Promise<EmailValidationResult> {
  const formatResult = validateEmailFormat(email);
  if (!formatResult.isValid) {
    return formatResult;
  }

  // If checkMx is explicitly disabled, return format check result
  if (options?.checkMx === false) {
    return formatResult;
  }

  // Dynamic DNS/MX resolution with transient failure resilience
  const mxCheck = await checkDomainMailServers(formatResult.domain);
  if (!mxCheck.valid) {
    return {
      isValid: false,
      isDisposable: false,
      isTestDomain: false,
      domain: formatResult.domain,
      normalizedEmail: formatResult.normalizedEmail,
      hasMxRecords: false,
      error: mxCheck.error || `The email domain '@${formatResult.domain}' does not exist or has no mail exchange (MX) servers configured.`,
    };
  }

  return {
    ...formatResult,
    hasMxRecords: true,
    transientDnsError: mxCheck.transient,
  };
}

/**
 * Synchronous validation alias for lightweight callers.
 */
export const validateEmailSync = validateEmailFormat;
