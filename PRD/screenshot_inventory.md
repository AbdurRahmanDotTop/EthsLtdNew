# ETHSLTD Crypto - Screenshot Inventory & Plan

## Reference Material
- **Source**: `MexcCryptoTrading.pdf` (36 pages) + individual JPEG images.
- **Scope Mandate**: User requested **ALL** features shown in screenshots must be functional, including Options, Perpetuals, and Bank functionalities, overriding the "spot trading only" default in the PRD.

## Screenshot Inventory & Mapping

| Page/Screen | Description | Key Features | Target ETHSLTD Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Page 1, 4, 5, 19, 24, 27** | Assets Dashboard | Currency, Contract, Options Accounts. Total Assets, Asset valuations, specific balances (BTC, ETH, USDT, ACH, USDC). Deposit, Withdraw, Transfer buttons. Hide small assets toggle. UID display. | `/assets` | Pending |
| **Page 2, 20** | Asset Search | Search modal for USDT, ETH, BTC, Bank. | `/assets/search` (Modal) | Pending |
| **Page 3** | Bank Deposit | Deposit Bank page. Bank name, card number, name details. Transfer amount input. Submission button. | `/assets/deposit/bank` | Pending |
| **Page 6, 9** | Home Page | Banners (200+ Airdrops). Market tickers (BTC, ETH, XRP). Gainers list (TRX, QTUM, GT, ETC, NEO, DOT, LINK). Bottom Navigation (Home, Trade, Option, Trust, Assets). | `/home` | Pending |
| **Page 7, 8** | KYC Verification | Personal ID Number input. Contact address. Front/Back ID photo upload. Verification success state. | `/profile/kyc` | Pending |
| **Page 10, 11, 12, 13, 14, 15, 16, 17, 18, 31, 32, 33, 36** | Trading Terminal (Options/Perpetual) | Real-time Candlestick chart (1min, 5min, 30min, etc.). Order types (Buy Long, Buy Short, Market order). Lot size, Multiple (Leverage x5, x100), Price input. Margin, Handling fee, Stop Profit/Loss. Transaction Records (open positions, closed positions, profits). Rise/Fall options trading. | `/trade/[symbol]` & `/perpetual/[symbol]` & `/options` | Pending |
| **Page 21** | Security / Password | Set transaction password. | `/security/password` | Pending |
| **Page 22** | Bind Bank Card | Form: Bank name, IBAN, Bank address, SWIFT, Full name. | `/security/bank-card` | Pending |
| **Page 23, 28** | Withdraw (Crypto/Bank) | Withdraw to Axis Bank. Balance, amount, fund password, handling fee. Notes & limits. | `/assets/withdraw` | Pending |
| **Page 25, 29** | Records | Deposit records, Withdrawal records. Processing vs Passed states. | `/assets/records` | Pending |
| **Page 34** | User Drawer / Menu | User profile, UID, Deposit, Withdraw, Referral, Message, KYC, Bind bank card, Security Center, Withdraw Address, Records, Help, Settings. | `Sidebar/Drawer Component` | Pending |

## Phase 0 Architectural Decisions
- **Framework**: Next.js 15 (App Router) + React + TypeScript + Tailwind CSS v4.
- **Backend/API**: Next.js API Routes (Server Actions) for all backend functionality to keep it purely full-stack in a single repo.
- **Database**: PostgreSQL (Prisma ORM) for robust relational ledger and user management.
- **State Management**: Zustand for client-side state (wallet balances, trading pairs).
- **Design System**: Shadcn UI customized with ETHSLTD brand colors (`#00A070` primary, dark mode default `#121212`).

## Next Steps (Phase 1)
1. Complete Next.js initialization.
2. Setup Prisma schema (Users, Wallets, Orders, Transactions).
3. Setup Tailwind with ETHSLTD design tokens from the legacy project.
4. Scaffold routing structure mapped above.
