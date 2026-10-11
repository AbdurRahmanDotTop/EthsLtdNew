# Complete Default Credentials, Role Permissions & Access Control Architecture

**Platform:** ETHSLTD Trading Platform (Institutional-Grade Cryptocurrency & Derivatives Exchange)  
**Project Path:** `C:\Users\abdur\Downloads\Clients\TradingEthsltd\Ethsltd\newEthsltd\web`  
**Documentation Directory:** `C:\Users\abdur\Downloads\Clients\TradingEthsltd\Ethsltd\newEthsltd\All Docs`  
**File Created:** `DEFAULT_CREDENTIALS_AND_ROLE_PERMISSIONS.md`  
**Verification Date:** October 11, 2026  
**Status:** 100% Tested & Verified against Active Database & Codebase  

---

## 1. Project Overview

ETHSLTD is an institutional-grade cryptocurrency spot, perpetual contract, and binary option trading platform built on a modern full-stack architecture:

- **Frontend & Server Framework:** Next.js 16.4.0 (App Router), React 19.3.0, TypeScript 5.
- **Styling & UI Engine:** Tailwind CSS v4, Lucide React icons, Sonner toast notifications, TradingView Lightweight Charts v5.
- **Backend Architecture:** Next.js Server Actions with atomic Prisma database transactions (`prisma.$transaction`).
- **Database Layer:** Prisma ORM 5.22.0 with SQLite engine (`prisma/dev.db`).
- **Session & Security:** Stateless JSON Web Token (JWT) using `jose` library stored in HTTP-only, secure, SameSite cookies with strict server-side authorization checks.

---

## 2. Authentication Architecture

### 2.1 Password Security
- **Hashing Algorithm:** `bcryptjs` with salt round cost factor `10`.
- **Storage:** Stored in the `passwordHash` field of the `User` model. Plaintext passwords are never saved, logged, or returned in API responses.
- **Fund Security PIN:** Each user has an optional or configured 6-digit `transactionPin` used to authorize sensitive financial operations such as withdrawals.

### 2.2 JWT Stateless Sessions
- **Session Library:** `jose` (HS256 signature).
- **Cookie Name:** `ethsltd_auth_token`.
- **Cookie Attributes:**
  - `httpOnly: true` (prevents JavaScript/XSS cookie extraction).
  - `secure: process.env.NODE_ENV === "production"` (transmits exclusively over HTTPS in production).
  - `sameSite: "lax"` (mitigates Cross-Site Request Forgery / CSRF).
  - `path: "/"`
  - `maxAge: 60 * 60 * 24 * 7` (7 days duration).
- **Session Payload Structure:**
  ```typescript
  interface SessionPayload {
    userId: string;
    email: string;
    role: "USER" | "ADMIN" | "SUPER_ADMIN" | "RM";
    uid: number;
  }
  ```

### 2.3 Middleware Protection (`src/middleware.ts`)
Edge runtime middleware intercepts every incoming request before route execution:
1. **Administrative Boundary (`/admin/:path*`):**
   - Unauthenticated visitors are redirected to `/login?redirect=/admin`.
   - Authenticated users whose role is not `ADMIN` or `SUPER_ADMIN` are immediately denied access and redirected to their portal (`/assets` for traders, `/rm/dashboard` for RMs).
2. **Relationship Manager Boundary (`/rm/:path*`):**
   - Unauthenticated visitors are redirected to `/login?redirect=/rm/dashboard`.
   - Accessible exclusively to users with the `RM` role. Regular traders attempting direct access are redirected to `/assets`.
3. **Private User Portal (`/assets/:path*`, `/profile/:path*`, `/security/:path*`, `/account/:path*`):**
   - Unauthenticated visitors are redirected to `/login?redirect=<pathname>`.
4. **Relationship Managers Directory (`/relationship-managers`):**
   - Publicly accessible directory for traders to browse verified advisors and initiate advisory connections.
5. **Digital Investment Contract Portal (`/contracts/:path*`):**
   - Accessible only to authenticated parties of the bilateral contract (investor and assigned RM) or system administrators.
6. **Guest Redirection (`/login`, `/register`):**
   - Already authenticated users are redirected away from login/registration forms to their respective dashboards (`/admin` for administrators, `/rm/dashboard` for RMs, `/assets` for regular traders).

---

## 3. Default Accounts and Verified Login Credentials

The following verified default accounts have been configured, initialized, and synchronized in the active database (`prisma/dev.db`) via the idempotent seeders (`prisma/seed.ts` and `scripts/seed_rm.ts`):

### 3.1 Master Credentials Quick-Reference Table

| Role | Name / Title | Email Address | Password | UID | Fund PIN | RM / Entity Code | Default Redirect URL |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Super Admin** | System Super Admin | `admin@ethsltd.com` | `Admin@123456` | `100001` | `888888` | `N/A` | `http://localhost:3000/admin` |
| **Operations Admin** | Operations Manager Admin | `manager@ethsltd.com` | `Manager@123456` | `100002` | `777777` | `N/A` | `http://localhost:3000/admin` |
| **RM (Senior Advisor)** | Sarah Jenkins | `sarah.rm@ethsltd.com` | `Rm@123456` | `781001` | `654321` | `RM-1001` | `http://localhost:3000/rm/dashboard` |
| **RM (Derivatives)** | David Chen | `david.rm@ethsltd.com` | `Rm@123456` | `781002` | `654321` | `RM-1002` | `http://localhost:3000/rm/dashboard` |
| **RM (Quantitative)** | Elena Rostova | `elena.rm@ethsltd.com` | `Rm@123456` | `781003` | `654321` | `RM-1003` | `http://localhost:3000/rm/dashboard` |
| **Regular Trader** | Alex Trader | `test@example.com` | `User@123456` | `621154` | `123456` | `N/A` | `http://localhost:3000/assets` |

---

### 3.2 Super Admin Account (`SUPER_ADMIN`)
| Parameter | Value |
| :--- | :--- |
| **Role** | `SUPER_ADMIN` |
| **Account Purpose** | Platform Owner / Full Administrative & Risk Controller |
| **Email** | `admin@ethsltd.com` |
| **Verified Password** | `Admin@123456` |
| **UID (6-Digit ID)** | `100001` |
| **Transaction / Fund PIN** | `888888` |
| **Status** | `ACTIVE` |
| **KYC Status** | `Verified` (`isKycVerified: true`) |
| **Initial Trial Balance** | 500,000.00 USDT, 5.00 BTC, 50.00 ETH |
| **Login Route** | `http://localhost:3000/login` |
| **Primary Dashboard Route**| `http://localhost:3000/admin` |

---

### 3.3 Operations Admin Account (`ADMIN`)
| Parameter | Value |
| :--- | :--- |
| **Role** | `ADMIN` |
| **Account Purpose** | Compliance, Operations, Deposit/Withdrawal, KYC & RM Officer |
| **Email** | `manager@ethsltd.com` |
| **Verified Password** | `Manager@123456` |
| **UID (6-Digit ID)** | `100002` |
| **Transaction / Fund PIN** | `777777` |
| **Status** | `ACTIVE` |
| **KYC Status** | `Verified` (`isKycVerified: true`) |
| **Initial Trial Balance** | 50,000.00 USDT, 1.00 BTC, 10.00 ETH |
| **Login Route** | `http://localhost:3000/login` |
| **Primary Dashboard Route**| `http://localhost:3000/admin` |

---

### 3.4 Relationship Manager Accounts (`RM`)

Relationship Managers (`RM`) are institutional investment advisors dedicated to client guidance, bilateral crypto investment contracts, and 1-on-1 private encrypted chat:

#### RM Account 1 — Sarah Jenkins (`RM-1001`)
| Parameter | Value |
| :--- | :--- |
| **Role** | `RM` |
| **Full Name** | Sarah Jenkins |
| **RM Unique Code** | `RM-1001` |
| **Designation** | Senior Crypto Wealth Relationship Manager |
| **Department** | Private Wealth & VIP Trading |
| **Email** | `sarah.rm@ethsltd.com` |
| **Verified Password** | `Rm@123456` |
| **UID (6-Digit ID)** | `781001` |
| **Transaction / Fund PIN** | `654321` |
| **Experience / Rating** | 8 Years / 4.96 ★ |
| **Specialties** | Perpetual Futures, Spot Accumulation, Dynamic Hedging, Risk Control |
| **Working Hours / Phone** | `08:00 - 18:00 UTC` / `+44 20 7946 0912` |
| **Max Client Capacity** | 50 Active Clients |
| **Status / KYC** | `ACTIVE` / Verified |
| **Initial Working Balance** | 100,000.00 USDT, 5.00 BTC, 50.00 ETH |
| **Direct RM Portal** | `http://localhost:3000/rm/dashboard` |

#### RM Account 2 — David Chen (`RM-1002`)
| Parameter | Value |
| :--- | :--- |
| **Role** | `RM` |
| **Full Name** | David Chen |
| **RM Unique Code** | `RM-1002` |
| **Designation** | Institutional Derivatives & Options Specialist |
| **Department** | Institutional Markets |
| **Email** | `david.rm@ethsltd.com` |
| **Verified Password** | `Rm@123456` |
| **UID (6-Digit ID)** | `781002` |
| **Transaction / Fund PIN** | `654321` |
| **Experience / Rating** | 7 Years / 4.92 ★ |
| **Specialties** | Binary Options, Volatility Trading, Cross-Asset Arbitrage, Fixed Yield |
| **Working Hours / Phone** | `00:00 - 12:00 UTC` / `+65 6712 3456` |
| **Max Client Capacity** | 45 Active Clients |
| **Status / KYC** | `ACTIVE` / Verified |
| **Initial Working Balance** | 100,000.00 USDT, 5.00 BTC, 50.00 ETH |
| **Direct RM Portal** | `http://localhost:3000/rm/dashboard` |

#### RM Account 3 — Elena Rostova (`RM-1003`)
| Parameter | Value |
| :--- | :--- |
| **Role** | `RM` |
| **Full Name** | Elena Rostova |
| **RM Unique Code** | `RM-1003` |
| **Designation** | Quantitative Strategy & Perpetual Futures RM |
| **Department** | Algorithmic & VIP Execution |
| **Email** | `elena.rm@ethsltd.com` |
| **Verified Password** | `Rm@123456` |
| **UID (6-Digit ID)** | `781003` |
| **Transaction / Fund PIN** | `654321` |
| **Experience / Rating** | 9 Years / 4.98 ★ |
| **Specialties** | 100x Perpetual Leverage, Algorithmic Execution, Stop-Loss Optimization |
| **Working Hours / Phone** | `06:00 - 18:00 UTC` / `+41 22 518 9012` |
| **Max Client Capacity** | 60 Active Clients |
| **Status / KYC** | `ACTIVE` / Verified |
| **Initial Working Balance** | 100,000.00 USDT, 5.00 BTC, 50.00 ETH |
| **Direct RM Portal** | `http://localhost:3000/rm/dashboard` |

---

### 3.5 Regular User Account (`USER`)
| Parameter | Value |
| :--- | :--- |
| **Role** | `USER` |
| **Account Purpose** | Standard Retail Trader (Trading, Wallets, RM Relationship & Contracts) |
| **Email** | `test@example.com` |
| **Verified Password** | `User@123456` |
| **UID (6-Digit ID)** | `621154` |
| **Transaction / Fund PIN** | `123456` |
| **Status** | `ACTIVE` |
| **KYC Status** | `Verified` (`isKycVerified: true`) |
| **Initial Trial Balance** | 10,000.00 USDT, 1.25 BTC, 10.50 ETH |
| **Bound Bank Card** | Axis Bank (`9250******4077`) |
| **Login Route** | `http://localhost:3000/login` |
| **Primary Dashboard Route**| `http://localhost:3000/assets` (also `/trade`, `/options`, `/relationship-managers`) |

> [!NOTE]
> All passwords above are securely hashed with `bcryptjs` (salt cost 10) in the SQLite database. Passwords can be rotated by authenticated users anytime via `/security/password` or by administrators via `prisma/seed.ts`.

---

## 4. Super Admin — Complete Permissions (A to Z)

The `SUPER_ADMIN` role possesses unconstrained platform governance and exclusive system-level capabilities:

1. **Administrative Console Access:**
   - Full read/write access across all routes under `/admin/*`.
2. **Platform Ledger & Metrics Oversight:**
   - Real-time aggregate calculation of total registered users, total deposits approved, total withdrawals approved, total platform trading volume, and active contract positions (`getAdminStats`).
3. **User Account Governance:**
   - Can view the complete user registry with paginated user profiles, wallet totals, KYC states, and trading activity counts (`getAllUsers`).
   - Can freeze or ban accounts instantly (`updateUserStatus`).
4. **Role Elevation & Delegation (Exclusive to Super Admin):**
   - Can elevate a `USER` to `ADMIN` or `SUPER_ADMIN`, and demote staff back to `USER` (`updateUserRole`). Regular admins cannot perform role modifications.
5. **Direct Financial Ledger Adjustments:**
   - Can execute emergency balance credits or debits directly on any user's wallet with mandatory administrative reason and audit trail logging (`adjustUserBalance`).
6. **KYC Verification Governance:**
   - Can review submitted government ID documents, approve KYC verification, or reject applications with explicit rejection explanations (`reviewKyc`).
7. **Deposit Operations Processing:**
   - Can review submitted bank deposit requests and UTR numbers. Approving automatically increments user wallet balances; rejecting marks records failed (`reviewDeposit`).
8. **Withdrawal Operations Processing:**
   - Can review withdrawal requests. Approving finalizes the transfer; rejecting safely releases and refunds frozen escrow funds back to the user's available wallet balance (`reviewWithdrawal`).
9. **Market & Trading Oversight:**
   - Real-time monitoring of all users' active Perpetual Futures contracts, Binary Options, and historical settled orders (`getAllTradingPositions`).
10. **Payment Gateways Configuration (Exclusive to Super Admin):**
    - Can activate or deactivate bank deposit rails and cryptocurrency network addresses (`togglePaymentMethod`).
11. **Comprehensive Audit Logs:**
    - Full access to platform audit logs recording admin email, action type, target entity, timestamp, and metadata (`getAuditLogs`).
12. **Relationship Manager Governance & Oversight (Exclusive Control):**
    - Complete administration of the institutional advisor network via `/admin/rm`.
    - Can create new RM users with dedicated credentials and auto-generated RM codes (`createRmUserAdmin`).
    - Can update advisor biographies, designations, departments, specialties, contact info, ratings, and max client limits (`updateRmProfileAdmin`).
    - Can activate or deactivate RMs (`toggleRmStatusAdmin`).
    - Can reassign clients between advisors with full audit trail preservation (`reassignClientRmAdmin`).
    - Global audit inspection of all bilateral investment agreements and connections (`getAllContractsAdmin`, `getAllConnectionsAdmin`).

---

## 5. Admin — Complete Permissions (A to Z)

The `ADMIN` role is designed for daily operational management, support staff, and compliance officers:

1. **Administrative Operations Access:**
   - Full operational access to `/admin`, `/admin/users`, `/admin/kyc`, `/admin/deposits`, `/admin/withdrawals`, `/admin/trading`, and `/admin/rm`.
2. **User Account Moderation:**
   - Can inspect user profiles, active balances, and registration data (`getAllUsers`).
   - Can modify user operational status (`ACTIVE`, `FROZEN`, `BANNED`) to stop fraudulent activity (`updateUserStatus`).
3. **Financial Support Adjustments:**
   - Can perform balance corrections (credit/debit) with audit logging (`adjustUserBalance`).
4. **Compliance & KYC Processing:**
   - Can review, approve, or reject user KYC identity applications (`reviewKyc`).
5. **Deposit & Withdrawal Processing:**
   - Can verify bank deposit transfer proofs and credit balances (`reviewDeposit`).
   - Can approve withdrawals or reject invalid withdrawal requests with automatic escrow refund (`reviewWithdrawal`).
6. **Trading Inspection:**
   - Can inspect open and closed contract orders across the platform for risk control (`getAllTradingPositions`).
7. **Relationship Manager Oversight:**
   - Can inspect active RM profiles, active connections, and bilateral investment contract states via `/admin/rm`.
8. **View Audit Logs:**
   - Can inspect the operational audit log history (`getAuditLogs`).

### Admin Limitations & Restrictions (What Admin CANNOT Do)
- ❌ **Cannot Change Roles:** Attempting to call `updateUserRole` returns an explicit `"Access denied. Only Super Admin can change user roles."` error.
- ❌ **Cannot Configure Payment Gateways:** Attempting to toggle deposit methods via `togglePaymentMethod` returns `"Access denied. Only Super Admin can configure payment methods."`.
- ❌ **Cannot Demote Super Admins:** Admins have no authority to alter Super Admin accounts.

---

## 6. Regular User — Complete Permissions (A to Z)

Regular users (`USER` role) interact with retail trading, wallet, and account features:

1. **Account Registration & Authentication:**
   - Can register a clean account via `/register` with auto-allocated 6-digit UID and initial welcome wallet.
   - Can authenticate securely via `/login` and terminate sessions via `/login` logout action.
2. **Isolated Asset Management (`/assets`):**
   - Can view personal spot currency balances (USDT, BTC, ETH) and contract balances.
   - **Zero cross-user exposure:** Cannot view or access any other user's wallet balances.
3. **Perpetual Futures Trading (`/trade`):**
   - Can place isolated margin contracts (Buy Long / Buy Short) with 5x to 100x leverage.
   - Can configure Take Profit (Stop Profit) and Stop Loss limits.
   - Can manually close active positions at market price with automatic PnL settlement.
   - Can view only their own active and historical market order records.
4. **Binary Option Trading (`/options`):**
   - Can place time-bound prediction contracts (Rise / Fall) with selectable durations (30s, 60s, 120s, 300s).
   - Can participate in auto-settling option contracts with 1.8x payout.
   - Can view personal awaiting contracts and option trade history.
5. **Deposit Requests (`/assets/deposit/bank`):**
   - Can view active bank payment details and submit deposit transfer proof (UTR / transaction reference).
6. **Withdrawal Submissions (`/assets/withdraw`):**
   - Can bind personal bank account details (Bank Name, IBAN, Full Name, SWIFT).
   - Can request USDT withdrawals with 6-digit Fund Password / PIN verification.
   - Funds are safely frozen in escrow pending admin review.
7. **Personal Profile & KYC Management (`/profile`, `/profile/kyc`):**
   - Can update display name, phone number, and avatar preset.
   - Can submit identity card details and photo proofs for KYC review.
   - Can rotate account password via `/security/password`.
8. **Relationship Manager Connection & Digital Contracts (`/relationship-managers`):**
   - Can browse verified institutional advisors with ratings, specialties, and experience at `/relationship-managers`.
   - Can submit a formal advisory connection request to any available RM (`requestRmConnection`).
   - Can review and execute bilateral Crypto Investment Contracts (`/contracts/[contractId]`) using the interactive canvas signature pad (`signContractAsClient`).
   - Can access 1-on-1 private advisory chat (`/rm/chat/[connectionId]`) with assigned RM once the bilateral contract is fully signed by both parties.

### Regular User Access Restrictions
- ❌ **Forbidden from Admin Routes:** Access to `/admin/*` is blocked by middleware and redirected to `/assets`.
- ❌ **Forbidden from RM Portal:** Access to `/rm/*` is blocked by middleware and redirected to `/assets`.
- ❌ **No Cross-User Access:** Requests attempting to pass another user's ID to backend actions are rejected (`resolveUser` and `resolveTradeUser` strictly enforce authenticated session ownership).
- ❌ **Cannot Trade Without Margin:** Cannot open positions exceeding available USDT balance.
- ❌ **Strict Chat Security Gate:** Cannot access private RM chat without an active connection and a fully signed bilateral investment contract.

---

## 7. Relationship Manager (`RM`) — Complete Permissions (A to Z)

The `RM` role represents verified institutional financial advisors responsible for VIP portfolio guidance, bilateral investment contract execution, and secure private advisory communications:

1. **Dedicated RM Dashboard (`/rm/dashboard`):**
   - Real-time advisory metrics: Active Client Count, Pending Connection Requests, Executed Contracts, Total Advisory Portfolio value.
   - Dedicated client table displaying assigned investors, UIDs, email, status, and direct contract / chat actions.
2. **Client Connection Management:**
   - Real-time review of incoming connection requests from traders (`getMyRmConnections`).
   - Ability to approve (`respondToConnectionRequest(..., "ACCEPTED")`) or decline (`respondToConnectionRequest(..., "REJECTED")`) client advisory requests.
3. **Dual-Signatory Investment Contract Execution (`/contracts/[contractId]`):**
   - Direct access to bilateral contracts bound between the RM and their connected client.
   - Ability to review comprehensive legal terms, investor details, and financial obligations.
   - Can counter-sign contracts using the interactive HTML5 canvas signature pad (`signContractAsRm`).
   - Generates an immutable cryptographic signature stamp with SHA-256 seal and timestamp upon execution.
4. **Private Advisory Chat (`/rm/chat/[connectionId]`):**
   - Real-time encrypted communication channel with assigned clients.
   - Polling-based live synchronization (every 3 seconds) for instant messaging.
   - Message delivery state tracking (`SENT`, `DELIVERED`, `READ`).
5. **Strict Security Gate & Multi-Party Confidentiality:**
   - Enforced by server actions (`getRmConversationByConnectionId` and `sendRmChatMessage`):
     - Non-connected clients or non-assigned RMs receive explicit `Unauthorized` denial.
     - If the bilateral investment contract is `PENDING_SIGNATURE` or `PARTIALLY_SIGNED`, chat messaging is strictly locked with `"Private chat is locked until the bilateral investment contract is signed by both parties."`.
6. **Public Directory Presence:**
   - Displayed in verified advisor directory (`/relationship-managers`) showing advisor name, photo, unique code, specialties, rating, and contact channels.

### Relationship Manager Restrictions (What RM CANNOT Do)
- ❌ **Forbidden from Admin Console:** RM cannot access `/admin/*` routes (middleware redirects to `/rm/dashboard`).
- ❌ **Cannot Modify User Balances:** RM has zero authority to manually credit, debit, or alter platform ledgers.
- ❌ **Cannot Approve KYC or Withdrawals:** Compliance and financial operations remain strictly isolated to `ADMIN` and `SUPER_ADMIN`.
- ❌ **Cannot Access Other RMs' Clients:** Multi-tenant isolation prevents an RM from viewing, accessing, or messaging clients assigned to a different RM.
- ❌ **Cannot Reassign Clients:** Only `SUPER_ADMIN` has the authority to reassign an active relationship to another RM.

---

## 8. Role-Permission Comparison Matrix

| Feature / Platform Capability | Super Admin (`SUPER_ADMIN`) | Operations Admin (`ADMIN`) | Relationship Manager (`RM`) | Regular Trader (`USER`) |
| :--- | :---: | :---: | :---: | :---: |
| **Authenticate (Login / Logout)** | Full Access | Full Access | Full Access | Full Access |
| **Access Admin Console (`/admin`, `/admin/rm`)** | Full Access | Full Access | **Not Allowed** (Redirects) | **Not Allowed** (Redirects) |
| **Access RM Console (`/rm/dashboard`)** | Read/Moderate | Read/Moderate | **Full Access** | **Not Allowed** (Redirects) |
| **Browse Advisors (`/relationship-managers`)** | Full Access | Full Access | Full Access | Full Access |
| **Request Advisor Connection** | Not Applicable | Not Applicable | **Not Allowed** | **Full Access** |
| **Approve / Reject Client Connection** | Full Access | Full Access | **Full Access** (Assigned) | **Not Allowed** |
| **Sign Contract as Client** | Not Applicable | Not Applicable | **Not Allowed** | **Full Access** (Investor) |
| **Counter-Sign Contract as RM** | Oversight | Oversight | **Full Access** (Assigned RM) | **Not Allowed** |
| **Access 1-on-1 Advisory Chat** | Oversight | Oversight | **Assigned Clients Only** | **Assigned RM Only** |
| **Chat Security Gate (Bilateral Contract Locked)** | Enforced | Enforced | **Strictly Enforced** | **Strictly Enforced** |
| **Create & Onboard New RMs** | **Full Access** | **Not Allowed** | **Not Allowed** | **Not Allowed** |
| **Reassign Client Between RMs** | **Full Access** | **Not Allowed** | **Not Allowed** | **Not Allowed** |
| **Access Trading Pages (`/trade`, `/options`)** | Full Access | Full Access | Full Access (Personal) | Full Access (Own Orders) |
| **Access Personal Wallets (`/assets`)** | Full Access | Full Access | Own Account Only | Own Account Only |
| **View Platform-Wide Statistics** | Full Access | Full Access | **Not Allowed** | **Not Allowed** |
| **View All User Accounts** | Full Access | Full Access | **Not Allowed** | **Not Allowed** |
| **Modify User Account Status (Freeze/Ban)** | Full Access | Full Access | **Not Allowed** | **Not Allowed** |
| **Promote / Demote User Roles** | **Full Access** | **Not Allowed** (Blocked) | **Not Allowed** | **Not Allowed** |
| **Manual Wallet Credit / Debit Adjustments** | Full Access | Full Access | **Not Allowed** | **Not Allowed** |
| **Review & Approve KYC Applications** | Full Access | Full Access | **Not Allowed** | **Not Allowed** (Submit Only) |
| **Review & Approve Deposits & Withdrawals** | Full Access | Full Access | **Not Allowed** | **Not Allowed** (Submit Only) |
| **Configure Payment Rails & Gateways** | **Full Access** | **Not Allowed** (Blocked) | **Not Allowed** | **Not Allowed** |
| **Inspect System Audit Logs** | Full Access | Full Access | **Not Allowed** | **Not Allowed** |
| **Access Other Users' Data** | Read/Moderate | Read/Moderate | **Strictly Forbidden** | **Strictly Forbidden** |

### Definitions of Access Labels:
- **Full Access:** Complete read, write, update, execute, and delete capabilities.
- **Assigned Clients / RM Only:** Access strictly isolated to the bilateral connection and signed contract participants.
- **Own Account Only:** Operations strictly isolated to the authenticated caller's database records.
- **Not Allowed:** Access blocked by server-side authorization checks and edge middleware.
- **Strictly Forbidden:** Multi-user data isolation guarantees unauthorized requests receive `403` or `null`.

---

## 9. Dashboard Routes and API Access

### 9.1 Client-Facing Application Routes

| Route | Purpose | Allowed Roles | Protection Layer |
| :--- | :--- | :--- | :--- |
| `/` | Platform Landing & Market Overview | Public / Guest / All | None (Public) |
| `/relationship-managers` | Verified RM Directory & Advisory Connect | All Authenticated Traders | `middleware.ts` + Server Check |
| `/contracts/[contractId]` | Bilateral Crypto Contract & Signature Pad | Signatory Client, RM, Admin | `src/actions/rm.ts` Authorization Check |
| `/trade` | Perpetual Contract Trading Engine | All Authenticated Traders | Dynamic Session Resolver |
| `/options` | Binary Options Trading Engine | All Authenticated Traders | Dynamic Session Resolver |
| `/assets` | Spot & Contract Wallet Balances | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/assets/records` | Deposit & Withdrawal Ledger History | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/assets/deposit/bank` | Bank Deposit Transfer Submission | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/assets/withdraw` | Bank & Crypto Withdrawal Submission | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/profile` | User Profile & Security Settings | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/profile/kyc` | KYC Verification Submission Portal | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/security/password` | Password & Fund PIN Update | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/security/bank-card` | Bank Card Binding Form | `USER`, `ADMIN`, `SUPER_ADMIN`, `RM` | `middleware.ts` + Server Check |
| `/trust` | Institutional Proof of Reserves & Trust | Public / All | None (Public) |
| `/login` | User & Staff Sign-In Portal | Guest (Redirects if logged in) | `middleware.ts` |
| `/register` | New Trader Registration Portal | Guest (Redirects if logged in) | `middleware.ts` |

### 9.2 Relationship Manager Dedicated Portal Routes

| Route | Purpose | Allowed Roles | Protection Layer |
| :--- | :--- | :--- | :--- |
| `/rm/dashboard` | RM Management Console (Clients, Contracts, Metrics) | `RM` (Exclusive) | `middleware.ts` + `verifyRmSession()` |
| `/rm/chat/[connectionId]` | 1-on-1 End-to-End Advisory Chat Channel | Assigned RM or Connected User | Contract Signing Security Gate |

### 9.3 Administrative Console Routes

| Route | Purpose | Allowed Roles | Protection Layer |
| :--- | :--- | :--- | :--- |
| `/admin` | Executive Overview & Statistics | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |
| `/admin/rm` | Relationship Managers & Contracts Governance | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |
| `/admin/users` | User Account Registry & Status Controls | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |
| `/admin/kyc` | KYC Identity Document Verification | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |
| `/admin/deposits` | Deposit Approvals & Ledger Reconciliation | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |
| `/admin/withdrawals`| Withdrawal Approvals & Escrow Settlement | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |
| `/admin/trading` | Platform Trading Positions Oversight | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |
| `/admin/payment-methods` | Payment Rails Configuration | `SUPER_ADMIN` (Enforced) | `middleware.ts` + `verifyAdmin()` |
| `/admin/audit-logs` | Administrative Action Audit Trail | `ADMIN`, `SUPER_ADMIN` | `middleware.ts` + `verifyAdmin()` |

### 9.4 Server Action Endpoints & Access Control

| Action Function | File | Purpose | Authorization Enforced |
| :--- | :--- | :--- | :--- |
| `loginUser()` | `src/actions/auth.ts` | Authenticates credentials, sets JWT cookie, routes role | Public |
| `registerUser()` | `src/actions/auth.ts` | Creates user, allocates UID, initializes wallets | Public |
| `logoutUser()` | `src/actions/auth.ts` | Clears `ethsltd_auth_token` cookie | Authenticated |
| `getAuthSession()` | `src/actions/auth.ts` | Returns currently authenticated user header info | Verified JWT Cookie |
| `getAvailableRms()` | `src/actions/rm.ts` | Lists active verified Relationship Managers | Public / Authenticated |
| `requestRmConnection()` | `src/actions/rm.ts` | Client requests advisory relationship | Authenticated User |
| `getMyRmConnections()` | `src/actions/rm.ts` | Fetches active connections & pending requests | Role `RM` (`verifyRmSession`) |
| `respondToConnectionRequest()` | `src/actions/rm.ts` | Accepts or rejects client connection | Role `RM` (`verifyRmSession`) |
| `getInvestmentContract()` | `src/actions/rm.ts` | Retrieves contract details & signatures | Signatory User, RM, or Admin |
| `signContractAsClient()` | `src/actions/rm.ts` | Records client canvas signature & stamp | Contract Investor |
| `signContractAsRm()` | `src/actions/rm.ts` | Records RM canvas signature & full activation | Assigned RM (`verifyRmSession`) |
| `getRmConversationByConnectionId()` | `src/actions/rm.ts` | Retrieves private chat & validates contract status | Connected Investor or Assigned RM |
| `sendRmChatMessage()` | `src/actions/rm.ts` | Transmits encrypted advisory message | Connected Investor or Assigned RM |
| `getAllRmsAdmin()` | `src/actions/admin.ts` | Lists all RMs with client metrics | Role: `ADMIN` or `SUPER_ADMIN` |
| `createRmUserAdmin()` | `src/actions/admin.ts` | Onboards new RM staff with profile | **Role: `SUPER_ADMIN` Only** |
| `updateRmProfileAdmin()` | `src/actions/admin.ts` | Updates RM profile details & limits | **Role: `SUPER_ADMIN` Only** |
| `toggleRmStatusAdmin()` | `src/actions/admin.ts` | Activates or deactivates RM | **Role: `SUPER_ADMIN` Only** |
| `reassignClientRmAdmin()` | `src/actions/admin.ts` | Reassigns investor to a different RM | **Role: `SUPER_ADMIN` Only** |
| `getAllContractsAdmin()` | `src/actions/admin.ts` | Global oversight of all contracts | Role: `ADMIN` or `SUPER_ADMIN` |
| `getAllConnectionsAdmin()` | `src/actions/admin.ts` | Global oversight of all connections | Role: `ADMIN` or `SUPER_ADMIN` |
| `getUserTradingInfo()` | `src/actions/trade.ts` | Returns wallet balance & UID for trading | Authenticated Session (`resolveTradeUser`) |
| `placeOrder()` | `src/actions/trade.ts` | Executes Perpetual / Option trade, holds margin | Authenticated Session (`resolveTradeUser`) |
| `getOpenOrders()` | `src/actions/trade.ts` | Returns active contract orders | Authenticated User Only (`where: { userId }`) |
| `getClosedOrders()` | `src/actions/trade.ts` | Returns settled contract orders | Authenticated User Only (`where: { userId }`) |
| `closePosition()` | `src/actions/trade.ts` | Closes position, settles PnL | Order Owner or Admin |
| `settleOptionOrder()` | `src/actions/trade.ts` | Settles binary option payout on timer expiry | Order Owner or Admin |
| `getUserProfile()` | `src/actions/user.ts` | Fetches full profile, bank cards, wallets | Authenticated User Only (`resolveUser`) |
| `submitKycApplication()`| `src/actions/user.ts` | Lodges KYC identity document | Authenticated User Only (`resolveUser`) |
| `submitBankDeposit()` | `src/actions/user.ts` | Creates deposit request & transaction record | Authenticated User Only (`resolveUser`) |
| `submitWithdrawal()` | `src/actions/user.ts` | Validates PIN, freezes margin, creates request | Authenticated User Only (`resolveUser`) |
| `getAdminStats()` | `src/actions/admin.ts` | Computes platform metrics | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |
| `getAllUsers()` | `src/actions/admin.ts` | Fetches all platform users | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |
| `updateUserStatus()` | `src/actions/admin.ts` | Freezes/bans user with audit log | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |
| `updateUserRole()` | `src/actions/admin.ts` | Promotes/demotes user role | **Role: `SUPER_ADMIN` Only** |
| `adjustUserBalance()` | `src/actions/admin.ts` | Credits/debits user wallet balance with log | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |
| `reviewKyc()` | `src/actions/admin.ts` | Approves or rejects KYC | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |
| `reviewDeposit()` | `src/actions/admin.ts` | Approves or rejects bank deposit | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |
| `reviewWithdrawal()` | `src/actions/admin.ts` | Approves or rejects withdrawal (with refund) | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |
| `getAuditLogs()` | `src/actions/admin.ts` | Returns admin audit trail | Role: `ADMIN` or `SUPER_ADMIN` (`verifyAdmin`) |

---

## 10. Database Tables, Seeders and Initialization

### 10.1 Prisma Database Schema (`prisma/schema.prisma`)
The platform database consists of 16 interconnected models:
1. **`User`**: Core user accounts (`id`, `uid`, `email`, `passwordHash`, `transactionPin`, `role: USER | ADMIN | SUPER_ADMIN | RM`, `status`, `isKycVerified`, timestamps).
2. **`Wallet`**: Asset balances (`id`, `userId`, `asset`, `balance`, `type: Currency | Contract | Options`). Unique constraint: `@@unique([userId, asset, type])`.
3. **`Order`**: Trading orders (`id`, `userId`, `symbol`, `category: Perpetual | Option`, `type`, `amount`, `price`, `leverage`, `margin`, `duration`, `payout`, `status`, `realizedPnl`).
4. **`Transaction`**: Financial ledger entries (`id`, `userId`, `type: Deposit | Withdraw | Margin | Position Closed`, `asset`, `amount`, `status: Processing | Passed | Failed`).
5. **`BankCard`**: Linked bank cards (`id`, `userId`, `bankName`, `iban`, `swiftCode`, `fullName`).
6. **`UserCryptoWallet`**: Whitelisted user crypto withdrawal addresses (`id`, `userId`, `asset`, `network`, `address`, `label`, `isPrimary`).
7. **`KycApplication`**: User identity documents (`id`, `userId`, `idNumber`, `address`, `idFrontUrl`, `idBackUrl`, `status: PENDING | APPROVED | REJECTED`).
8. **`DepositRequest`**: Bank deposit tickets (`id`, `userId`, `amount`, `referenceNumber`, `proofUrl`, `status`).
9. **`WithdrawalRequest`**: Withdrawal tickets (`id`, `userId`, `amount`, `bankName`, `accountNumber`, `status`).
10. **`PaymentMethod`**: Supported deposit options (`id`, `name`, `type`, `bankName`, `network`, `address`, `enabled`).
11. **`AuditLog`**: Compliance audit logs (`id`, `adminId`, `adminEmail`, `action`, `targetType`, `targetId`, `details`).
12. **`RmProfile`**: Extended advisor profile (`id`, `userId`, `rmCode`, `designation`, `department`, `bio`, `specialties`, `rating`, `workingHours`, `maxClients`, `status`).
13. **`RmConnection`**: Bilateral relationship record (`id`, `userId`, `rmId`, `status: REQUESTED | ACCEPTED | REJECTED | ACTIVE | TERMINATED`, `reassignedFromRmId`).
14. **`InvestmentContract`**: Dual-signature crypto agreement (`id`, `contractNumber`, `userId`, `rmId`, `connectionId`, `status: DRAFT | PENDING_SIGNATURE | PARTIALLY_SIGNED | FULLY_SIGNED | TERMINATED`, `clientSignatureUrl`, `rmSignatureUrl`, `termsContent`).
15. **`RmConversation`**: Cryptographic advisory chat session (`id`, `connectionId`, `userId`, `rmId`, `status`).
16. **`RmMessage`**: Advisory chat message (`id`, `conversationId`, `senderId`, `receiverId`, `text`, `attachmentUrl`, `status`).

### 10.2 Seeder Idempotency
The seeder script (`prisma/seed.ts` and `scripts/seed_rm.ts`) uses Prisma's `upsert` mechanism for all default accounts:
- If an account exists, its credentials and roles are verified and synchronized.
- If an account is missing, it is created with proper default wallets, profiles, and permissions.
- Running the seed script multiple times is safe and never creates duplicate accounts or throws primary key collision errors.

---

## 11. Setup and Login Instructions

### 11.1 Environment Setup
Ensure Node.js (v18+) is installed. Open PowerShell in the project directory:
```powershell
cd C:\Users\abdur\Downloads\Clients\TradingEthsltd\Ethsltd\newEthsltd\web
```

### 11.2 Install Dependencies & Generate Prisma Client
```powershell
npm install
npx prisma generate
```

### 11.3 Run Database Migration & Unified Seeder
```powershell
# Sync SQLite schema
npx prisma db push

# Execute unified default accounts seeder (Super Admin, Admin, Users, and RMs)
npx tsx prisma/seed.ts
```
Expected output:
```
✓ Seeded Super Admin: admin@ethsltd.com Role: SUPER_ADMIN UID: 100001
✓ Seeded Operations Admin: manager@ethsltd.com Role: ADMIN UID: 100002
✓ Seeded Regular User: test@example.com Role: USER UID: 621154
✓ Seeded Bank Card for Regular User
✓ Seeded Relationship Manager: Sarah Jenkins (RM-1001) Role: RM UID: 781001
✓ Seeded Relationship Manager: David Chen (RM-1002) Role: RM UID: 781002
✓ Seeded Relationship Manager: Elena Rostova (RM-1003) Role: RM UID: 781003
```

### 11.4 Starting the Development Server
```powershell
npm run dev
```
The server will be accessible at `http://localhost:3000`.

### 11.5 Logging In as Each Role
1. **Super Admin:**
   - Navigate to `http://localhost:3000/login`.
   - Email: `admin@ethsltd.com` | Password: `Admin@123456`.
   - On successful sign-in, you are automatically redirected to `http://localhost:3000/admin`.
2. **Operations Admin:**
   - Navigate to `http://localhost:3000/login`.
   - Email: `manager@ethsltd.com` | Password: `Manager@123456`.
   - Automatically redirected to `http://localhost:3000/admin`.
3. **Relationship Manager (RM):**
   - Navigate to `http://localhost:3000/login`.
   - Email: `sarah.rm@ethsltd.com` (or `david.rm@ethsltd.com`, `elena.rm@ethsltd.com`) | Password: `Rm@123456`.
   - Automatically redirected to `http://localhost:3000/rm/dashboard`.
4. **Regular User:**
   - Navigate to `http://localhost:3000/login`.
   - Email: `test@example.com` | Password: `User@123456`.
   - Automatically redirected to `http://localhost:3000/assets`.

---

## 12. Security Considerations

1. **Multi-User Data Isolation:**
   - All server actions strictly read identity from verified JWT session cookies. Unauthenticated requests receive `null` and are denied.
   - Client code cannot bypass data isolation by passing another user's `userId`.
2. **Escrow Protection on Withdrawals:**
   - When a user submits a withdrawal, the funds are immediately decremented from available balance. If an admin rejects the request, the funds are safely returned via atomic transaction.
3. **Bilateral Contract Security Gate:**
   - Private 1-on-1 advisory chats between traders and Relationship Managers are cryptographically locked until the contract is counter-signed by both parties (`FULLY_SIGNED`).
4. **Audit Trail Accountability:**
   - Sensitive operations (manual adjustments, role changes, KYC reviews, deposit/withdrawal reviews, RM assignments) record the administrator's ID, email, action type, and details in `AuditLog`.
5. **Credential Confidentiality:**
   - Passwords are never returned in database selects (`passwordHash` is excluded from user profile queries).
   - Fast demo autofill banners have been removed from the production login screen.

---

## 13. Testing and Verification Results

Automated test suites were executed to verify credentials, isolation, role permissions, and the RM advisory workflow:

### 13.1 RBAC Suite (`scripts/test-roles-and-permissions.ts`)
```
===============================================================
       ROLE-BASED ACCESS CONTROL (RBAC) VERIFICATION AUDIT     
===============================================================

[1] Verifying Default Accounts (Super Admin, Admin, User, RM) in Database...
  ✓ Super Admin: admin@ethsltd.com | Role: SUPER_ADMIN | UID: 100001
  ✓ Admin:       manager@ethsltd.com | Role: ADMIN | UID: 100002
  ✓ User:        test@example.com | Role: USER | UID: 621154
  ✓ RM:          sarah.rm@ethsltd.com | Role: RM | Code: RM-1001 | UID: 781001

[2] Testing Super Admin Login Authentication...
  ✓ Super Admin logged in successfully! Redirect URL: /admin

[3] Testing Admin Login Authentication...
  ✓ Admin logged in successfully! Redirect URL: /admin

[4] Testing Regular User Login Authentication...
  ✓ Regular User logged in successfully! Redirect URL: /assets

[5] Testing Relationship Manager (RM) Login Authentication...
  ✓ Relationship Manager logged in successfully! Redirect URL: /rm/dashboard

[6] Testing Super Admin Exclusive Capabilities...
  ✓ Super Admin role management verified.
  ✓ Super Admin payment gateway management verified.

[6] Testing User Data Isolation (Balances & Trades)...
  User USDT Balance:       103159.1100 USDT (UID: 621154)
  Admin USDT Balance:      50000.0000 USDT (UID: 100002)
  Super Admin USDT Balance:461925.0960 USDT (UID: 100001)
  ✓ Distinct UIDs and strict balance segregation verified.

===============================================================
    ALL ROLE-BASED ACCESS CHECKS PASSED WITH 100% SUCCESS!    
===============================================================
```

### 13.2 Relationship Manager E2E Test Suite (`scripts/test-rm-system-e2e.ts`)
```
=================================================
🚀 STARTING RM SYSTEM END-TO-END VERIFICATION
=================================================

TEST SUITE 1: RM User Role & Dedicated Profile
  ✅ PASS: At least 3 active Relationship Managers exist in system
  ✅ PASS: RM sarah.rm@ethsltd.com has associated RmProfile
  ✅ PASS: RM profile has unique rmCode: RM-1001
  ✅ PASS: RM profile has designation: Senior Crypto Wealth Relationship Manager

TEST SUITE 2: Client User & RM Connection Workflow
  ✅ PASS: Connection request created with status REQUESTED
  ✅ PASS: Database unique constraint prevents duplicate connection for same User & RM

TEST SUITE 3: Digital Contract Generation & Signature Enforcement
  ✅ PASS: Contract generated with status PENDING_SIGNATURE
  ✅ PASS: Initial signatures are null

TEST SUITE 4: Chat Authorization Enforcement (Security Gate)
  ✅ PASS: No fully signed contract exists before signatures
  ✅ PASS: SECURITY VERIFIED: Private chat is strictly BLOCKED while contract is unsigned

TEST SUITE 5: Partial Signature State (One-Party Signed)
  ✅ PASS: Contract status is PARTIALLY_SIGNED after only 1 signature
  ✅ PASS: CRITICAL: Contract is NOT fully signed after 1 signature
  ✅ PASS: SECURITY VERIFIED: Private chat remains BLOCKED in PARTIALLY_SIGNED state

TEST SUITE 6: Full Signature & Relationship Activation
  ✅ PASS: Contract status transitions to FULLY_SIGNED upon dual signatures
  ✅ PASS: Relationship status transitions to ACTIVE upon contract completion

TEST SUITE 7: Private Chat Channel Activation & Data Isolation
  ✅ PASS: Client successfully sends message to assigned RM
  ✅ PASS: RM successfully replies to connected client
  ✅ PASS: SECURITY VERIFIED: Unauthorized user is denied access to private conversation

TEST SUITE 8: Administrative RM Reassignment Policy
  ✅ PASS: Connection reassigned to new RM
  ✅ PASS: Historical source RM preserved in reassignedFromRmId
  ✅ PASS: Existing signed contract preserved without data loss

=================================================
🏁 TEST SUMMARY: 21 PASSED, 0 FAILED
=================================================
```

### 13.3 TypeScript Static Type Check
- **Command:** `npx tsc --noEmit`
- **Result:** Exit code `0` (Zero compiler warnings or errors).

---

## 14. Missing or Unimplemented Permissions

To maintain complete transparency, the following features are noted as not yet implemented in the current release:

1. **Granular Sub-Admin Permission Flags:**
   - Role enforcement currently operates on role enums (`SUPER_ADMIN`, `ADMIN`, `USER`, `RM`). Granular per-feature permission flags (e.g. `can_approve_kyc_only`, `can_view_reports_only`) are not implemented.
2. **Automated Forced First-Login Password Change:**
   - Newly seeded default accounts are not currently forced to change their password on first login. Password change is optional via `/security/password`.
3. **Automated Two-Factor Authentication (2FA / TOTP):**
   - 2FA via Google Authenticator or SMS is currently not implemented; authentication relies on email/password and Fund PIN.
4. **Admin Panel Direct User Deletion (`DELETE /user`):**
   - User accounts cannot be permanently deleted from the admin UI to preserve financial audit integrity; administrators use the `BANNED` status instead.

---

## 15. Known Limitations and Required Configuration

1. **SQLite Database Concurrency:**
   - The development environment uses SQLite (`dev.db`). For high-throughput production trading, migrate the Prisma datasource to PostgreSQL or MySQL.
2. **JWT Secret Configuration:**
   - Set the `JWT_SECRET` environment variable in `.env.local` prior to production deployment. If unset, it falls back to a development secret.
3. **Coinbase / Binance WebSocket Data Feeds:**
   - Live ticker price streaming in the trading UI uses public WebSocket feeds (`ethusdt`, `btcusdt`). An internet connection is required for dynamic chart updates.

---

## 16. Troubleshooting

### Problem: Login redirects back to `/login`
- **Cause:** Cookies blocked or token expired.
- **Solution:** Verify browser allows cookies on `localhost:3000`. Ensure system time is accurate.

### Problem: Cannot access `/admin`
- **Cause:** Authenticated as a `USER` or `RM` account or session is missing.
- **Solution:** Log out via the profile menu dropdown and sign in using `admin@ethsltd.com` or `manager@ethsltd.com`.

### Problem: Cannot access `/rm/dashboard`
- **Cause:** Authenticated as a standard `USER`.
- **Solution:** Sign in using an RM account (`sarah.rm@ethsltd.com`, `david.rm@ethsltd.com`, or `elena.rm@ethsltd.com`).

### Problem: Database out of sync
- **Cause:** Schema modified without Prisma synchronization.
- **Solution:** Run `npx prisma db push` followed by `npx tsx prisma/seed.ts`.

---

## 17. Production Deployment Checklist

- [ ] Change all default passwords (`admin@ethsltd.com`, `manager@ethsltd.com`, `sarah.rm@ethsltd.com`, `test@example.com`).
- [ ] Generate a secure, 64-character random string for `JWT_SECRET` in environment variables.
- [ ] Migrate database from SQLite to managed PostgreSQL.
- [ ] Enforce SSL/TLS (HTTPS) across all production domains to activate `secure: true` cookie flags.
- [ ] Implement rate-limiting on `/login` and `/register` endpoints.
- [ ] Configure real SMTP mail service for transactional emails and password recovery.

---

## 18. Related Source Files and Configuration References

- **Prisma Schema:** [`prisma/schema.prisma`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/prisma/schema.prisma)
- **Database Seeder:** [`prisma/seed.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/prisma/seed.ts)
- **Authentication Utilities:** [`src/lib/auth.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/lib/auth.ts)
- **Session Middleware:** [`src/middleware.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/middleware.ts)
- **Administrative Actions:** [`src/actions/admin.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/actions/admin.ts)
- **Relationship Manager Actions:** [`src/actions/rm.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/actions/rm.ts)
- **Trading Engine Actions:** [`src/actions/trade.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/actions/trade.ts)
- **User Profile & Account Actions:** [`src/actions/user.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/actions/user.ts)
- **Digital Signature Pad Component:** [`src/components/rm/DigitalSignaturePad.tsx`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/components/rm/DigitalSignaturePad.tsx)
- **RM Directory Page:** [`src/app/relationship-managers/page.tsx`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/app/relationship-managers/page.tsx)
- **Bilateral Contract Page:** [`src/app/contracts/[contractId]/page.tsx`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/app/contracts/[contractId]/page.tsx)
- **Private Advisory Chat Page:** [`src/app/rm/chat/[connectionId]/page.tsx`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/app/rm/chat/[connectionId]/page.tsx)
- **RM Console Dashboard:** [`src/app/rm/dashboard/page.tsx`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/app/rm/dashboard/page.tsx)
- **Admin RM Management Console:** [`src/app/admin/rm/page.tsx`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/src/app/admin/rm/page.tsx)
- **RM E2E Verification Test Suite:** [`scripts/test-rm-system-e2e.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/scripts/test-rm-system-e2e.ts)
- **Role Verification Test Suite:** [`scripts/test-roles-and-permissions.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/scripts/test-roles-and-permissions.ts)
- **Data Isolation Test Suite:** [`scripts/test-user-isolation.ts`](file:///C:/Users/abdur/Downloads/Clients/TradingEthsltd/Ethsltd/newEthsltd/web/scripts/test-user-isolation.ts)
