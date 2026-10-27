# Security Audit & Anti-Spam Protection Report: ETHSLTD Platform

**Application:** newEthsltd (`web` + `api`)  
**Audit & Remediation Date:** October 27, 2026  
**Status:** Completed & Validated with Playwright MCP & API Integration Tests  
**Classification:** Critical Security Hardening & Bot Abuse Prevention  

---

## Executive Summary

An in-depth security audit and anti-spam overhaul was conducted across the `newEthsltd` codebase (spanning the Next.js frontend, Server Actions, Hono Cloudflare Worker API, Prisma SQLite database, Cloudflare D1 database, and Brevo notification infrastructure).

### Problem Statement
Automated scripts and bots were able to create active user accounts on the platform without physically loading or completing the website registration form. These automated registrations utilized disposable and non-routable email addresses, immediately triggering automated welcome and administrator notification emails via the Brevo API, causing severe email quota exhaustion (email bombing), database pollution, and security exposure.

### Primary Root Causes Identified
1. **Unprotected Direct API Endpoints:** The Cloudflare Worker API endpoint (`POST /api/v1/auth/register`) accepted raw JSON payloads with zero CAPTCHA / bot verification token, zero IP rate limiting, and zero disposable domain verification.
2. **Missing Token Verification in Next.js Server Actions:** The Next.js `registerUser` server action allowed direct programmatic RPC invocation without verifying a Cloudflare Turnstile CAPTCHA token, client-side submission timing, or honeypot fields.
3. **Immediate Account Activation Without Email Verification:** New registrations were immediately marked with `status: "ACTIVE"` without requiring confirmation that the registrant possessed or could access the registered email address.
4. **Immediate Outbound Email Dispatch:** Every registration immediately triggered Brevo API outbound calls (`sendWelcomeNotification`, `sendAdminEventNotification`), enabling third-party malicious actors to weaponize the platform as an email bombing relay.
5. **Absence of Disposable & Temporary Domain Filtering:** Neither the frontend nor backend validated domains against known disposable email providers (e.g., Mailinator, TempMail, 10MinuteMail, GuerrillaMail, Sharklasers).

---

## 1. Deep Security Audit & Technical Root Cause Analysis

### Vulnerability Vector 1: Cloudflare Worker API Registration (`api/src/routes/auth.ts`)
* **Endpoint:** `POST http://127.0.0.1:8787/api/v1/auth/register`
* **Defect:** Prior to remediation, the endpoint extracted `email`, `password`, `name`, and `referralCode` directly from `c.req.json()`, performed basic string length checks, and immediately inserted the record into D1 with `status: 'ACTIVE'`.
* **Super Admin Escalation Risk:** Because the D1 database was freshly initialized without seed accounts, the first account registered via this open API automatically received the `SUPER_ADMIN` role via `const role = userCount === 0 ? 'SUPER_ADMIN' : 'USER';`. Any external bot making the first request immediately hijacked super-administrator rights.
* **Reproduction Demonstration:**
  ```bash
  # Before remediation: This command succeeded immediately and created an active account
  curl -X POST http://127.0.0.1:8787/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"spambot_test@mailinator.com","password":"SpamPassword123!","name":"Spam Bot"}'
  # Result: HTTP 201 Created -> Super Admin created, Brevo emails dispatched!
  ```

### Vulnerability Vector 2: Next.js Server Action (`web/src/actions/auth.ts`)
* **Function:** `export async function registerUser(...)`
* **Defect:** While the frontend form at `web/src/app/register/page.tsx` had client-side UI inputs, any script sending an HTTP `POST` request to the Next.js Server Action endpoint (`/register` with action ID header) completely bypassed all UI constraints.
* **Absence of Rate Limiting:** A bot could fire hundreds of requests per second against the Server Action endpoint from a single IP address without throttling.

### Vulnerability Vector 3: Email Bombing & Brevo Quota Exhaustion
* **Mechanism:** Upon registration, the application executed:
  1. `sendWelcomeNotification({ to: email, name, ... })`
  2. `sendAdminEventNotification({ type: 'USER_REGISTERED', ... })`
* **Consequence:** Malicious actors targeting arbitrary victims could register those victims' emails repeatedly, flooding victim inboxes with ETHSLTD branded messages and rapidly depleting the production Brevo monthly API send quota.

---

## 2. Architecture & Security Controls Implemented

To eliminate these vulnerabilities without introducing demo data or breaking legitimate trader onboarding, the following layered security controls were designed, implemented, and verified across both `web` and `api`.

```
               [ Incoming Registration Request ]
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 1. IP Sliding-Window Limiter │ ──> Over limit? ──> 429 Too Many Requests
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 2. Turnstile CAPTCHA Token   │ ──> Missing/Invalid? ──> 403 Forbidden
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 3. Honeypot & Timing Check   │ ──> Bot detected? ──> 400 Bad Request
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 4. Disposable Domain Engine  │ ──> Disposable? ──> 400 Bad Request
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 5. Create User Record as     │
               │    PENDING_VERIFICATION      │
               │    (isEmailVerified = false) │
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 6. Generate 6-Digit OTP &    │
               │    Dispatch Verification Email│
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 7. Redirect to /verify-email │
               └──────────────┬───────────────┘
                              │
               [ User Enters Valid 6-Digit OTP ]
                              │
                              ▼
               ┌──────────────────────────────┐
               │ 8. Mark isEmailVerified=true │
               │    Update status to ACTIVE   │
               │    Record AuditLog Security  │
               │    Dispatch Welcome Email    │
               └──────────────────────────────┘
```

### 1. Cloudflare Turnstile Token Validation
* **Backend Utilities:**
  * `web/src/lib/turnstile.ts`: Validates tokens against `https://challenges.cloudflare.com/turnstile/v0/siteverify` using standard `TURNSTILE_SECRET_KEY`. Supports official Cloudflare development/test secret keys (`1x0000000000000000000000000000000AA` / `2x0000000000000000000000000000000AA`).
  * `api/src/utils/turnstile.ts`: Cloudflare Worker-native implementation with timeout handling.
* **Frontend Widget:**
  * `web/src/components/ui/turnstile-widget.tsx`: Non-intrusive Turnstile widget embedded into `web/src/app/register/page.tsx` with automatic script loading and reset on submit failure.

### 2. Disposable & Temporary Email Domain Engine
* **Engines:**
  * `web/src/lib/email-validator.ts`
  * `api/src/utils/email-validator.ts`
* **Features:**
  * Over 350+ known disposable, temporary, and throwaway domain definitions (including `mailinator.com`, `guerrillamail.com`, `10minutemail.com`, `tempmail.com`, `sharklasers.com`, `throwawaymail.com`, `yopmail.com`, `dispostable.com`, `fakeinbox.com`, `trashmail.com`, etc.).
  * Pattern-based heuristic checks for domain names containing `tempmail`, `disposable`, `throwaway`, `fakeinbox`, etc.
  * Non-routable and RFC reserved domain blocking (`example.com`, `test.com`, `invalid.test`, `localhost`).
  * RFC 5322 syntax validation and character length restrictions.
  * Allowlisting for major enterprise and public providers (`gmail.com`, `outlook.com`, `ethsltd.com`, `yahoo.com`, `icloud.com`).

### 3. Sliding-Window IP Rate Limiters
* **Modules:**
  * `web/src/lib/rate-limiter.ts`
  * `api/src/utils/rate-limiter.ts`
* **Limits Enforced:**
  * Max **5 registration attempts per 15-minute window** per IP address.
  * Max **3 OTP resend requests per 10-minute window** per email address, with an absolute **60-second cooldown** between successive resend requests.

### 4. Honeypot & Submission Timing Protections
* **Fields in Registration Form:**
  * Hidden `website_url_hp` honeypot field: Hidden from legitimate human view via CSS. If filled by an automated autofill script or headless scraper, registration is instantly rejected with `400 Bad Request`.
  * Encrypted timestamp token: Generated on form mount. Submissions completed in under **2.5 seconds** (superhuman bot speeds) are rejected.

### 5. Mandatory Two-Step Email Verification Workflow
* **Database Schema Changes:**
  * Added `isEmailVerified Boolean @default(false)` to `User` model in `web/prisma/schema.prisma`.
  * Synchronized database schema with `npx prisma db push` and generated client with `npx prisma generate`.
* **State Transition Logic:**
  * New accounts are registered with `status: "PENDING_VERIFICATION"` and `isEmailVerified: false`.
  * A cryptographic 6-digit verification code is generated, stored in `VerificationToken`, and set to expire in 15 minutes.
  * **Email Bombing Prevention:** Only a single verification email is dispatched at registration. Welcome emails, RM assignments, and administrative notifications are deferred until *after* the email OTP is confirmed.
  * Built dedicated verification UI at `web/src/app/verify-email/page.tsx` featuring real-time 60-second resend countdown and OTP validation.
  * Upon correct OTP entry, user transitions to `status: "ACTIVE"` and `isEmailVerified: true`, an immutable `EMAIL_VERIFICATION_SUCCESS` entry is added to `AuditLog`, and the welcome email is triggered.

---

## 3. Audit & Resolution of Existing Suspicious Database Accounts

An exhaustive review of all 31 existing accounts in `web/prisma/dev.db` was conducted.

### Findings
* **11 Accounts Identified as Automated Test Scripts:**
  * `test1@test.com` (UID: 116333)
  * `test2@test.com` (UID: 442651)
  * `test3@test.com` (UID: 225042)
  * `test4@test.com` (UID: 928392)
  * `test5@test.com` (UID: 201192)
  * `test6@test.com` (UID: 301293)
  * `test7@test.com` (UID: 401394)
  * `test8@test.com` (UID: 501495)
  * `test9@test.com` (UID: 601596)
  * `test10@test.com` (UID: 701697)
  * `test_recovery_1791713528208@example.com` (UID: 435254)
* **1 Account Identified with Unverified Dummy Domain:**
  * `test@example.com` (UID: 621154)
* **19 Legitimate Accounts Preserved:**
  * All administrator accounts (`admin@ethsltd.com`, `superadmin@ethsltd.com`), staff, Relationship Managers, and legitimate trader accounts were preserved in `ACTIVE` state.

### Safe Audit Remediation
Rather than permanently deleting rows (which destroys financial auditability, KYC history, and order logs), an automated remediation script (`web/scripts/audit_and_flag_suspicious_accounts.js`) was executed:
1. The 11 non-routable automated script test accounts were transitioned to `status: "FLAGGED_SPAM"`.
2. The 1 dummy domain account was transitioned to `status: "PENDING_VERIFICATION"`.
3. For each flagged account, an immutable `AuditLog` entry was created with action `ACCOUNT_FLAGGED_BY_SECURITY_AUDIT`, recording the exact domain rationale, timestamp, and target UID without leaking credentials.

---

## 4. D1 Cloudflare Worker Migration 0028 Resolution

During the audit, the Cloudflare D1 local database was found to be stalled at migration `0027` due to a table naming syntax error in `database/migrations/0028_add_indexes_and_bank_payment_method.sql`.

* **Root Cause:** Migration 0028 referenced PascalCase table names (`DepositRequest`, `PaymentMethod`, `LedgerTransaction`), whereas D1 schema definitions in migrations 0000–0027 use snake_case (`real_manual_deposits`, `payment_methods`, `ledger_transactions`).
* **Correction Applied:** Updated SQL script with correct table and column identifiers:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
  CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);
  CREATE INDEX IF NOT EXISTS idx_real_manual_deposits_user_id ON real_manual_deposits(user_id);
  CREATE INDEX IF NOT EXISTS idx_real_manual_deposits_status ON real_manual_deposits(status);
  CREATE INDEX IF NOT EXISTS idx_ledger_transactions_user_id ON ledger_transactions(user_id);
  ```
* **Status:** Successfully applied via `npx wrangler d1 migrations apply ethsltd-new --local`. Local D1 is now fully up to date with migration 0028.

---

## 5. Admin Monitoring & Audit Trail Enhancements

The administrative console was upgraded to provide real-time visibility into security events:

1. **User Management Interface (`web/src/app/admin/users/page.tsx`):**
   * Added visual status badges and select dropdown options for `FLAGGED_SPAM` (Rose/Red) and `PENDING_VERIFICATION` (Amber/Yellow).
   * Updated `updateUserStatus` server action in `web/src/actions/admin.ts` to support administrative status adjustments to/from `FLAGGED_SPAM` and `PENDING_VERIFICATION`.
2. **Administrative Audit Trail (`web/src/app/admin/audit-logs/page.tsx`):**
   * Added a dedicated **"Security & Anti-Spam"** filter button alongside financial and KYC filters.
   * Visual badge styling for `EMAIL_VERIFICATION_SUCCESS`, `USER_REGISTERED_PENDING_VERIFICATION`, and `ACCOUNT_FLAGGED_BY_SECURITY_AUDIT`.
   * **Confidentiality Maintained:** Audit log entries record operator, target UID, IP address, and descriptive reason. **No passwords, OTP codes, session tokens, or transaction PINs are ever written to audit logs.**

---

## 6. Verification & Testing Evidence

Testing was performed across multiple vectors:

### Test Case 1: Direct API Registration Without Turnstile Token
* **Request:** `POST http://127.0.0.1:8787/api/v1/auth/register` without Turnstile token.
* **Result:** **HTTP 403 Forbidden** (`{"success":false,"error":"Security check failed. Please refresh and try again."}`).
* **Verdict:** PASSED. Automated bots cannot register via direct HTTP API requests.

### Test Case 2: Direct API Registration With Disposable Email
* **Request:** `POST http://127.0.0.1:8787/api/v1/auth/register` with Turnstile token and email `badbot@mailinator.com`.
* **Result:** **HTTP 400 Bad Request** (`{"success":false,"error":"Disposable and temporary email addresses are not permitted. Please use a permanent email address."}`).
* **Verdict:** PASSED. Disposable email domains are rejected at the API level.

### Test Case 3: Direct API Rapid Registration (Rate Limit)
* **Request:** 6 rapid registration requests within 5 seconds from the same IP.
* **Result:** **HTTP 429 Too Many Requests** (`{"success":false,"error":"Too many registration attempts. Please wait 15 minutes before trying again."}`).
* **Verdict:** PASSED. Sliding-window rate limiter prevents mass registration script bursts.

### Test Case 4: Playwright End-to-End Browser Test
* **Tool:** Playwright MCP browser automation.
* **Steps:**
  1. Navigated to `http://localhost:3000/register`.
  2. Attempted registration with disposable email `bot_trader@tempmail.com` -> Blocked with notification: *"Disposable and temporary email addresses are not permitted."*
  3. Registered legitimate user `trader_legit_test@gmail.com`.
  4. Form successfully submitted with Turnstile widget, user created with `status: "PENDING_VERIFICATION"`.
  5. Browser automatically redirected to `http://localhost:3000/verify-email`.
  6. Tested resend cooldown timer: Countdown active with 60s cooldown.
  7. Entered valid 6-digit OTP code into the verification form.
  8. User status transitioned to `ACTIVE`, `isEmailVerified: true`.
  9. Browser redirected automatically to `http://localhost:3000/assets`.
  10. Logged out, logged in as Super Admin (`admin@ethsltd.com`), and verified `admin/audit-logs` displayed `EMAIL_VERIFICATION_SUCCESS` and `USER_REGISTERED_PENDING_VERIFICATION`.
* **Verdict:** PASSED. Complete user onboarding is secure, intuitive, and verified end-to-end.

---

## 7. Modified & Created Files Summary

| File Path | Type | Action / Purpose |
|---|---|---|
| `web/src/lib/turnstile.ts` | Backend Util | Cloudflare Turnstile token validation via `siteverify` API |
| `api/src/utils/turnstile.ts` | Worker Util | Cloudflare Worker Turnstile verification with timeout handling |
| `web/src/components/ui/turnstile-widget.tsx` | React Component | Turnstile client widget with auto-rendering and reset support |
| `web/src/lib/email-validator.ts` | Backend Util | 350+ disposable email domains blocklist, pattern checks, syntax validation |
| `api/src/utils/email-validator.ts` | Worker Util | Cloudflare Worker compatible disposable domain validator |
| `web/src/lib/rate-limiter.ts` | Backend Util | In-memory sliding-window IP and email rate limiter |
| `api/src/utils/rate-limiter.ts` | Worker Util | Worker in-memory sliding-window rate limiter |
| `web/src/lib/email.ts` | Service | Added `sendEmailVerificationOtpNotification` with Brevo category tag |
| `web/prisma/schema.prisma` | Database | Added `isEmailVerified Boolean @default(false)` to `User` model |
| `web/src/actions/auth.ts` | Server Action | Hardened `registerUser`, added `verifyEmailOtp` and `requestEmailVerificationOtp` |
| `web/src/app/register/page.tsx` | Frontend Page | Added Turnstile widget, honeypot field, submission timing token |
| `web/src/app/verify-email/page.tsx` | Frontend Page | Built 6-digit OTP verification page with resend cooldown timer |
| `web/src/app/admin/users/page.tsx` | Admin UI | Added `FLAGGED_SPAM` and `PENDING_VERIFICATION` status display and filters |
| `web/src/actions/admin.ts` | Server Action | Updated `updateUserStatus` to support spam and pending verification states |
| `web/src/app/admin/audit-logs/page.tsx` | Admin UI | Added "Security & Anti-Spam" filter tab and action badge styling |
| `api/src/routes/auth.ts` | Worker Route | Hardened `POST /register` with Turnstile, rate limit, disposable email check |
| `database/migrations/0028_add_indexes_and_bank_payment_method.sql` | D1 Migration | Fixed table names to snake_case and applied cleanly to local D1 |
| `web/scripts/audit_and_flag_suspicious_accounts.js` | Admin Tool | Audited 31 accounts and safely flagged 12 suspicious accounts with audit trails |

---

## 8. Production Deployment & Cloudflare Configuration Recommendations

When deploying to Cloudflare and production hosting:

1. **Environment Variables:**
   * Ensure `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are configured in production environments. (Replace development test keys `1x00000000000000000000AA` with production Cloudflare Turnstile widget keys created in the Cloudflare Dashboard under *Turnstile*).
2. **Cloudflare WAF Rules (Recommended):**
   * **Rule 1 (Bot Management / Managed Challenge):** Apply Managed Challenge to URI path `/api/v1/auth/register` and `/register` when `cf.bot_management.score < 30`.
   * **Rule 2 (Rate Limiting Rule):** Limit `POST /api/v1/auth/*` and Next.js RPC calls to 10 requests per minute per client IP.
3. **Brevo Notification Monitoring:**
   * Configure a webhook or alert in the Brevo dashboard if daily send volumes spike abnormally above typical trader onboarding rates.

---

## 9. Next.js Runtime Advisory

* During local execution, the Next.js runtime issued an automated recommendation regarding Next.js security patch updates (`16.0.7` -> `16.0.10`). It is recommended to perform a standard package dependency update (`npm install next@latest`) in a scheduled release cycle.
