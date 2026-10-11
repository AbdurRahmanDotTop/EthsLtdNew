# ETHSLTD Crypto Trading Platform — Complete Product Requirements Document (PRD)

**Document type:** Product + UX + Full-Stack Engineering PRD  
**Project:** ETHSLTD Crypto Trading  
**New project location:** `C:\Users\abdur\Downloads\Clients\TradingEthsltd\Ethsltd\newEthsltd`  
**Reference product:** MEXC crypto trading screenshots supplied by the user (visual and feature reference only)  
**Brand source:** Existing ETHSLTD project — extract branding assets and design tokens only  
**Product scope:** Standalone, full-stack cryptocurrency trading web application with user wallet and admin panel  
**Production rule:** No simulated success, fake balances, fabricated executions, or demo data presented as real trading.

---

## 1. Product Vision

Build a completely new, independent ETHSLTD-branded cryptocurrency trading platform. Its screens, information hierarchy, market terminal, charting, order book, order-entry panel, asset/wallet views, and supporting flows must be guided by every supplied MEXC screenshot. The finished product must look and behave like a polished, modern crypto exchange while using ETHSLTD's existing brand, logo, approved colors, and visual theme.

The existing project is a **brand reference only**. Do not copy its trading implementation, wallet logic, authentication logic, business rules, database, migrations, API routes, users, secrets, deployment resources, or feature modules. Build a separate codebase with its own configuration, database, migrations, tests, environment variables, and integrations.

The platform must support an end-to-end spot-trading lifecycle: authenticating a user, displaying real market data, checking available funds, placing a valid order through a configured real execution/liquidity provider, tracking actual execution results, updating the ledger and balances safely, displaying open/completed/cancelled orders, and preserving a complete transaction/trade history.

**Important production dependency:** ETHSLTD branding and UI alone do not create a real exchange. Before live trading can be enabled, the owner must select and authorize a real exchange/liquidity/execution provider and configure the required credentials, custody/deposit/withdrawal infrastructure, network settings, and legally required controls. Implement provider adapters and integration contracts; do not fake these integrations. If live credentials or approvals are missing, show a clear disabled/unavailable state and document the exact blocker rather than reporting orders as successful.

## 2. Goals and Success Criteria

### Goals
1. Deliver a standalone, responsive ETHSLTD crypto-trading website based on all supplied reference screenshots.
2. Reuse only the current ETHSLTD brand identity: logo, brand name, color palette, typography/theme tokens, and approved visual assets.
3. Deliver real spot-trading workflows backed by live market data and a real execution provider once configured.
4. Provide a safe, auditable, crypto-asset wallet with a ledger as the source of truth.
5. Provide a secure admin panel for users, markets, orders, assets, deposits, withdrawals, fees, integrations, risk settings, reconciliation, and audit trails.
6. Eliminate mock/demo trading behavior and make every loading, disabled, pending, failed, and completed state explicit.
7. Ensure responsive behavior on desktop, tablet, and mobile, including no overlaps, clipped controls, or unreachable actions.
8. Deliver automated tests, setup documentation, operational runbooks, and a verifiable production-readiness checklist.

### Success measures
- Every feature visible in the supplied screenshots is mapped to a screen/component and either implemented or documented with a specific blocker.
- A configured real provider's market data is visibly timestamped and updates through an approved stream/polling mechanism.
- A valid order can be submitted once, receives an actual provider/execution identifier, and progresses through confirmed order states without duplicate debits/credits.
- A rejected order does not create a successful trade or improperly consume funds.
- A partially filled or open limit order reserves the correct amount; canceling it releases only the unfilled reserve.
- Every balance-changing event has an immutable ledger record and can be reconciled against orders, trades, and custody/provider records.
- No production route can silently fall back to mock prices, demo fills, seeded accounts, or fake transaction success.
- Critical user and admin flows pass automated tests and responsive visual checks.

## 3. Scope and Non-Goals

### In scope
- Public landing/markets area, registration, login, logout, account settings, and configurable identity/security requirements.
- Spot market list, search, market details, trading terminal, real-time quotes, price chart/candles, order book, recent trades, and order-entry panel.
- Market and limit orders as minimum order types. Add stop/stop-limit and other order types only when supported by the chosen provider and the reference screenshots/product decision.
- Buy/sell workflows, order validation, balances, fees, order status, execution records, open orders, order history, trade history, and holdings/assets.
- Crypto wallet overview, supported-asset balances, deposit addresses/instructions, on-chain deposit status, withdrawal requests, withdrawal approval/risk controls, transaction history, and internal ledger.
- Admin panel and role-based authorization.
- Notifications for material account, security, order, deposit, and withdrawal events.
- Integration adapters for market data, execution, custody/wallet, chain monitoring, identity/KYC if required, and notifications.
- Monitoring, error handling, audit logging, reconciliation, backups, testing, environment configuration, and deployment documentation.

### Out of scope unless the supplied screenshots explicitly require them and the business owner separately approves them
- P2P marketplace, escrow, advertisements, expert services, and P2P dispute workflows.
- MT5/forex trading, CFDs, stocks, fiat forex accounts, or non-crypto products.
- Margin, leverage, perpetuals, futures, options, copy trading, staking, lending, yield products, and investment/advisory claims.
- An in-house blockchain, an in-house custody system, or a proprietary matching engine pretending to have external liquidity.
- Real deposits/withdrawals without the necessary custody/provider integration and security approval.
- Simulated/paper/demo trading in the production user interface.

Spot trading is the default MVP. If a supplied screenshot shows a non-spot product, first identify it in the screenshot inventory and mark it as an explicit scope decision; do not silently implement leverage or derivatives.

## 4. Mandatory Project Isolation

Work only in:

`C:\Users\abdur\Downloads\Clients\TradingEthsltd\Ethsltd\newEthsltd`

Before creating or changing files:
1. Inspect the parent folders and determine whether `newEthsltd` already contains work. Preserve existing content; do not delete or overwrite files blindly.
2. Inspect the existing ETHSLTD project only to identify brand-related assets and tokens. Record exactly which files/tokens are reused and why.
3. Build a fresh application structure and independent dependency/configuration setup. Do not import business logic or feature components from the existing project.
4. Create a separate database/schema, migration history, credentials, storage buckets, queues, worker names, and other resources when needed. Never point the new project at the existing app's production database or shared wallet tables.
5. Do not deploy, change DNS, modify Cloudflare Workers, edit unrelated repositories, or modify old production resources as part of this task unless explicitly authorized later.
6. Document all environment variables in `.env.example`; never place real secrets in source control.

If the target folder already contains a Git repository, inspect its status and branches before modifying anything. Do not discard user changes. If it is not a repository, initialize one only when appropriate and document the setup.

## 5. Brand and Design Requirements

### Brand-source process
- Inspect the existing ETHSLTD source solely to find the official logo, wordmark, favicon, approved brand colors, typography, dark/light theme rules, spacing, radii, and any permitted illustrations.
- Use the exact approved ETHSLTD logo/wordmark where applicable. Do not use MEXC's logo, name as the product brand, proprietary assets, or copied promotional text.
- Treat MEXC screenshots as references for layout and expected interactions, not as permission to copy third-party assets. Build an original ETHSLTD interface using the same familiar exchange information architecture.
- Avoid importing old page layouts or old feature code just because they are available in the original project.
- If the current approved palette matches the existing ETHSLTD palette, use `#121212`, `#00A070`, and `#00C087` as key brand tokens, while validating exact values against the source assets. Use approved neutral tokens for readable text/surfaces. Do not introduce an unrelated brand palette.
- Maintain adequate contrast, legible financial figures, and accessible focus states. Red/green trade outcomes must not rely on color alone; include labels/icons/signs.
- Do not add P2P messaging to the new product merely because an old logo/tagline asset may mention it. Do not alter the master logo file; avoid displaying an inappropriate standalone tagline if it misrepresents the product.

### Screenshot audit — required before implementation
Create a screenshot inventory containing, for every supplied image:
- filename/reference and apparent viewport/device size;
- page/screen being shown;
- visible navigation, panels, tabs, buttons, fields, charts, tables, status indicators, and actions;
- responsive behavior inferred from the screenshot;
- matching ETHSLTD route/page/component;
- implementation status and a visual verification checklist.

Do not claim to have inspected an image that is not actually accessible. If a supplied screenshot is absent from the workspace/context, record it as missing and continue from accessible references without inventing details. Re-check all accessible reference images throughout development.

### Design principles
- A responsive exchange terminal with a clear market selector, chart area, order book/recent trades, order-entry controls, balances, and order/activity panels when those elements appear in the references.
- Desktop density must remain organized and readable; mobile should reorganize into usable stacked panels/tabs rather than simply shrinking the desktop layout.
- Use consistent skeletons, empty states, error states, disabled states, confirmation dialogs, toasts, and form validation.
- Avoid layout shift when live prices refresh. Prices may update frequently, but actions and focus must not jump.
- Use tables with sticky headers only where useful; make wide tables horizontally scrollable or responsive without clipping key controls.
- Keep loading, no data, disconnected provider, stale price, insufficient balance, restricted asset, market closed/paused, and failed order states visibly distinct.

## 6. User Roles and Permissions

### Visitor
- Browse public market information that is permitted without authentication.
- Register or sign in.
- Cannot place orders, withdraw assets, or view private account data.

### Registered user
- Manage profile and security settings.
- View supported markets and permitted asset data.
- Place/cancel orders when account, market, and provider checks pass.
- View balances, deposits, withdrawals, orders, and trade history only for their own account.
- Submit withdrawal requests subject to configured security/KYC/risk rules.

### Support/operator
- View only the minimum customer/order/deposit information required by the assigned role.
- Cannot arbitrarily adjust balances or change privileged settings.
- Sensitive actions require explicit permissions, reason capture, and audit logging.

### Finance/operations admin
- Review deposits/withdrawals, reconcile ledger/provider records, inspect orders and execution failures, and manage operational queues.
- Any manual adjustment requires a reason, unique reference, permission check, and immutable audit trail. Prefer a paired approval for material adjustments.

### Super Admin
- Manage roles and permissions, market/asset configuration, fee schedules, risk controls, integration status, site configuration, maintenance, and admin access.
- Secret values must be masked and managed through the deployment secret store; do not expose private keys/API secrets back to the browser after saving.
- The Super Admin cannot bypass the ledger or silently overwrite financial balances.

Use server-side authorization for every protected API and resource. Hiding a button in the frontend is not authorization.

## 7. Core User Journeys

### A. Register and secure an account
1. User registers with validated details and completes email/OTP verification as configured.
2. Server creates the user and security/session records; secrets/passwords are never stored in plaintext.
3. User signs in and may be required to set up MFA and complete identity checks before trading or withdrawals depending on the configured legal/provider policy.
4. User sees account status and any remaining verification requirements clearly.

### B. Explore markets
1. User opens the market list and sees supported symbols, last price, 24-hour change/high/low/volume, and available pair filters when supported by real market data.
2. User searches by symbol/name and selects a market.
3. Market details load with live/stale state, chart/candles, order book, recent trades, and trading controls as available from the provider.
4. If market data disconnects, show the last update time and a visible stale/disconnected indicator; do not present old prices as current.

### C. Place a real spot order
1. User selects a symbol and Buy or Sell.
2. User selects supported order type and enters the required quantity/price parameters.
3. Server validates symbol status, user permissions, price/quantity precision, minimum/maximum order value, available balance, fee estimate, price-protection bounds, and provider availability.
4. The quote/fee preview clearly shows estimated quantity, spend/proceeds, applicable fees, and any price slippage warning where applicable.
5. User confirms the order.
6. Backend creates an idempotent order-intent record and applies a safe balance reservation/ledger workflow. No frontend-only balance update is accepted as financial truth.
7. Backend submits through the configured real execution adapter, stores provider identifiers and response, and processes acknowledgements/execution updates/webhooks or polling.
8. UI shows Pending/Open/Partially Filled/Filled/Cancelled/Rejected according to the actual provider state. Never show success before provider acknowledgement meets the defined acceptance condition.
9. Fills create balanced ledger entries for asset movements and fees exactly once. Balances and order/trade history refresh from authoritative backend results.
10. User can revisit history after reload or on another device and see the persisted result.

### D. Cancel an order
- User cancels an eligible open order.
- Server verifies ownership and current state, submits cancellation, waits for/records provider confirmation, and releases only the unfilled reserved amount.
- If a fill races with cancellation, record the actual fills and release only the remaining reservation. Never erase filled executions.

### E. Deposit crypto
1. User chooses a supported asset/network and views a deposit address/memo/tag when required.
2. UI clearly warns that the selected asset and network must match and displays the minimum deposit and confirmation policy supplied by the provider/configuration.
3. Chain monitoring/provider callbacks identify a deposit and track detected/confirming/credited/failed states.
4. Credit only after the configured confirmation and risk rules are satisfied. Enforce chain transaction idempotency.
5. Provide a transaction ID/hash, amount, network, timestamps, and status in history.
6. If deposit-address or monitoring infrastructure is not configured, do not display invented addresses or claim that deposits are available.

### F. Withdraw crypto
1. User selects asset/network, destination, amount, and any required tag/memo.
2. Server validates available balance, minimum/maximum, fees, network, address format where supported, withdrawal limits, authentication/MFA, account status, allowlists, and risk/velocity rules.
3. Reserve the requested amount plus applicable fee using an atomic ledger operation.
4. Apply approval policy: low-risk automated flow only if explicitly configured; otherwise queue for authorized review and, where required, dual approval.
5. Submit through configured custody/withdrawal provider only after all checks pass. Track processing, broadcast, confirmations, completion, and failure.
6. Release/adjust reservations safely on failure and prevent duplicate broadcasts/credits through idempotency keys.
7. Show the transaction hash when available. Never claim success while merely queued or pending.

## 8. Functional Requirements

### 8.1 Authentication and account security
- Registration, login, logout, password reset, verified email/OTP as configured, active sessions, session revocation, and device/session visibility where feasible.
- Strong password hashing using the framework's current recommended password-hashing implementation.
- Rate limiting for login, verification, password reset, order, withdrawal, and admin authentication endpoints.
- MFA support for privileged accounts and configurable enforcement for withdrawals.
- CSRF, secure cookies, session rotation on authentication, secure headers, server-side input validation, and safe error messages.
- Optional KYC/identity provider integration must be configurable and must not bypass applicable requirements. Store only necessary data and protect it with least privilege.

### 8.2 Market list and market detail
- Market search, sorting, watchlist/favorites if shown in reference screenshots, supported quote-asset filters, and status flags.
- Display only pairs enabled in admin configuration and actually supported by the connected provider.
- Price, change, volume, and high/low data need a source timestamp and consistent precision/formatting.
- A market may be active, paused, maintenance, delisted, or provider-disconnected. The backend must prevent new orders when the market is not tradable.
- Add caching/rate control for public data without making the data appear live when it is stale.

### 8.3 Trading terminal
- Reproduce the reference screenshots' overall terminal information hierarchy with ETHSLTD styling. Required panels depend on the screenshot inventory.
- Candlestick/line chart with selectable timeframe and historical candles from a configured market-data provider. Use a supported chart library and ensure license/usage compatibility.
- Order book with side, price, size, and cumulative depth if supplied by the provider; recent trades tape with real timestamps.
- Buy/Sell forms with quantity, price for limit orders, available balance, estimated fees, total/spend or proceeds, percentage shortcuts only if they calculate from authoritative available balance, and clear precision rules.
- Confirm/review step for high-value or materially slippage-prone orders when appropriate.
- Client-side validation is for usability; the backend revalidates every financial rule.
- Prevent accidental duplicate submission with disabled submitting state and server-side idempotency.
- Display market-data latency/staleness, provider outages, rate limits, and rejected-order reasons in user-friendly terms.
- Do not fabricate order book depth or recent trades if the provider does not supply them.

### 8.4 Order and execution lifecycle
- Minimum supported order types: Market and Limit, if the selected execution provider supports them.
- Add other types only when explicitly visible in the screenshots and fully supported by the chosen provider.
- Use a documented order state machine, for example: `created -> submitted -> acknowledged -> open -> partially_filled -> filled`, with valid branches to `cancel_requested`, `cancelled`, `rejected`, `expired`, or `failed` as appropriate. Adapt naming to the chosen provider, but never skip needed intermediate states.
- Persist internal order ID, user ID, pair, side, order type, submitted price/quantity, provider order ID, state, timestamps, fees, average fill price, executed quantity, remaining quantity, rejection/cancellation reason, and correlation/idempotency identifiers.
- Persist fills as separate immutable execution records. One order can have multiple fills.
- Process duplicate or out-of-order provider events safely and keep reconciliation tooling for discrepancies.
- `Open Orders`, `Order History`, and `Trade History` must be distinct, persisted views. If screenshots use different tab names, map to those while maintaining clear semantics.
- On spot trading, holdings are reflected in the appropriate crypto asset balance; do not invent a leveraged “position” model unless explicitly required by the screenshots.
- No order may be represented as filled based solely on an optimistic frontend response.

### 8.5 Wallet and ledger
- The ledger—not a mutable frontend field—is the source of truth for all balance changes.
- Maintain each user's balance by asset with at minimum `available`, `reserved/locked`, and `total` values. Define exact accounting rules and enforce `total = available + reserved` for the internal ledger model where applicable.
- Support assets/networks only after they are configured and integrated. Never show unsupported token/network options as working.
- Each ledger transaction has a unique ID, user, asset, amount, direction, category, status, source type/reference, idempotency key, timestamps, and metadata for permitted audit use.
- Ledger entries are append-only. Corrections use compensating entries with a reason/reference; never update or delete history to conceal a balance change.
- Use exact decimal/fixed-point arithmetic. Never use binary floating-point for financial calculations. Configure asset precision and rounding explicitly.
- All order reservation, fill settlement, fees, cancellation release, deposit credit, withdrawal reserve/release, and admin adjustment operations must be atomic or use a documented transaction/saga pattern with recovery and reconciliation.
- Available balance must never go negative due to concurrent order/withdrawal requests. Add database constraints/locking or an equivalent concurrency-safe mechanism.
- Record each fee separately or with an explicit fee ledger entry so fees can be audited and reconciled.
- Wallet overview must show balances in the relevant asset and optional estimated valuation only when a valid live/configured price source exists. Estimated value must be labelled as an estimate.
- Asset transaction history includes deposits, withdrawals, trading debits/credits, fees, and approved adjustments with correct signs, status labels, time, and references.
- Debit must display as negative (e.g. `-0.10`); credit as positive (e.g. `+0.10`). Do not show a debit using a positive sign.
- Prevent duplicate transactions through idempotency and unique source references.
- Never hardcode a balance, exchange rate, asset price, deposit address, transaction hash, provider response, or user record as production data.

### 8.6 Deposits, withdrawals, and custody
- Implement a provider interface for supported custody/wallet and chain-monitoring services. Keep provider-specific code out of business rules and UI components.
- Support each asset/network combination only if address generation or assignment, deposit monitoring, withdrawal submission, fee estimation, confirmations, and reconciliation are supported.
- Use KMS/HSM or an approved custody provider for key protection. Private keys/seed phrases must never be returned to the browser or stored in plain text in application tables, source code, logs, or `.env.example`.
- Separate development/testnet and production/mainnet configuration, credentials, addresses, and operational controls.
- Webhooks must be authenticated/verified, replay-resistant, idempotent, and logged without leaking secrets.
- Withdrawal destination allowlists, cooling-off rules, per-transaction/daily limits, velocity checks, and manual review must be configurable as required by risk policy.
- Show exact state: requested, under review, approved, submitted, broadcast, confirming, completed, rejected, or failed. Match the provider's real lifecycle.
- Admin cannot mark a deposit as blockchain-confirmed without evidence. Any permitted manual credit needs a privileged permission, evidence/reference, reason, audit log, and dual control where required.

### 8.7 Admin panel
Build a separate, role-protected `/admin` area with responsive layout and the ETHSLTD theme.

Required sections:
1. **Dashboard:** user counts, orders/executions, deposit/withdrawal queues, provider health, failed jobs/webhooks, reconciliation alerts, and operational indicators from real database/provider data. Clearly distinguish totals, time ranges, and statuses.
2. **Users:** search/filter, user profile/status, risk/verification state, account restrictions, sessions/security flags, and activity. Mask sensitive data based on role.
3. **Roles and permissions:** granular role-based access control, least privilege, protected Super Admin management, and audit trail.
4. **Markets and assets:** supported symbols, base/quote assets, network mapping, precision/minimums, trading status, deposit/withdrawal availability, and maintenance switches. Validate against provider support.
5. **Orders and trades:** searchable orders, fills/executions, provider IDs/status, failure reasons, and reconciliation detail. Admin must not change order outcomes manually without a documented, permission-gated correction workflow.
6. **Wallet/ledger:** balances derived from ledger, ledger search, linked orders/transactions, and adjustment requests. Any adjustment requires reason and immutable audit trail; material adjustments should require maker-checker approval.
7. **Deposits:** detected/confirming/credited deposits, confirmations, TX hash, matching/duplicate cases, exceptions, and permitted review workflow.
8. **Withdrawals:** screening queue, status, risk flags, destination/network, fee, approval history, provider response, TX hash, cancel/fail/retry controls only when safe and supported.
9. **Fees and limits:** configurable trading fees, deposit/withdrawal fee policy when provider supports it, precision, minimums, account tiers, and risk limits. Use effective dates/versioning and audit every change.
10. **Provider integrations:** connection status, environment, last successful sync, latency/error rate, webhook status, and masked credential configuration. Never reveal secret values after save.
11. **Reconciliation and reports:** compare internal ledger/orders/fills with provider account/order/transaction data; show mismatches and resolution states.
12. **Notifications and templates:** configurable event alerts, delivery status, retries, and safe templates.
13. **Audit/security logs:** who did what, when, target record, before/after metadata where safe, reason, IP/session context where legally appropriate; make security-sensitive logs tamper-resistant.
14. **System health/settings:** maintenance mode, queue/job health, failed jobs, storage/backup status, market-data connection status, and non-secret configuration.

Admin filters should support relevant date ranges, statuses, assets, markets, users, and references. All admin actions must be audited server-side.

### 8.8 Notifications
- Provide in-app notices for order lifecycle changes, deposit status, withdrawal status, security events, and account restrictions.
- Email/OTP notification integration may be added using deployment-configured providers. Show delivery state where operationally useful.
- Notifications are generated from authoritative backend events, not only from frontend actions.
- Retry transient delivery errors safely and avoid duplicate notifications when the event is redelivered.

### 8.9 Search, filters, pagination, and usability
- Search markets, assets, order IDs, TX hashes, and admin records where authorized.
- Use server-side pagination/filtering for large histories and admin tables.
- Preserve filter/sort context when returning to a list where feasible.
- Include empty states, loading states, errors with retry where safe, confirmation prompts for sensitive actions, and clear field-level validation.

## 9. Technical Architecture Requirements

The implementation agent must inspect the available environment and current supported framework versions, then document the chosen stack before coding. Prefer a maintainable, strongly typed frontend and a backend with explicit validation, authorization, database transactions, queues, and automated tests. A suitable default is a fresh Laravel backend using a currently supported release, React + TypeScript, and Tailwind/shadcn-style UI; use a different stack only with a documented technical reason. Never copy the existing project's feature code to achieve this.

Architecture boundaries:
- **Frontend:** ETHSLTD design system, routes, accessible components, chart, market stream client, trade forms, wallet/history, and admin UI. It never acts as the authority for balances or order status.
- **Application API:** authentication, authorization, market/trading commands, ledger, asset configuration, orders/fills/history, wallet operations, admin operations, audit trail.
- **Database:** relational persistent storage, schema/migrations, unique constraints, transaction locks, indexes, and append-only financial records.
- **Background workers/queues:** provider synchronization, webhook processing, chain monitoring, email/notifications, scheduled reconciliation, and retryable non-interactive tasks.
- **Realtime channel:** provider-backed market updates and authenticated account/order updates. Use authorization on private channels and backpressure/reconnection handling.
- **Provider adapters:** market data, order execution/liquidity, custody/wallet, blockchain monitoring, identity/KYC, and notifications. Each adapter has an interface, health checks, timeouts, retries, error normalization, and tests.
- **Observability:** structured logs, correlation IDs, metrics, traces where available, health/readiness endpoints, alertable error states, and dashboards that do not expose personal secrets.

### Provider contracts required
Document interfaces and data mapping for at least:
- `MarketDataProvider`: ticker, supported markets, candles, order book, recent trades, stream subscription, health and timestamps.
- `TradingExecutionProvider`: submit order, fetch order, cancel order, fetch fills, account/available balances if exposed, supported order types, precision/limits, health and reconciliation.
- `CustodyProvider` / `WalletProvider`: supported assets/networks, deposit address, transaction status, withdrawal validation/submission, fee/confirmation data, and health.
- `ChainMonitoringProvider`: incoming transaction detection, confirmation counts, reorg/reversal handling as supported, and unique chain references.
- `IdentityProvider` when applicable: verification start/status and provider reference, with minimal data retention.
- `NotificationProvider`: verified email/message delivery and idempotent event handling.

Do not invent a provider SDK, endpoint, credential, or API response. Use official documentation for the selected provider and document its limitations. If an adapter cannot be completed without credentials, complete the interface, validation, integration tests where possible, setup guide, and a clear blocked status; do not replace it with a fake live implementation.

## 10. Data Model — Minimum Logical Entities

Adapt names to the selected framework/database, but cover these concepts with relations, constraints, indexes, and migrations:
- `users`, `user_profiles`, `user_security_settings`, `sessions`/session store, `roles`, `permissions`, role assignments.
- `assets`, `networks`, `asset_networks`, `markets`, `market_rules`, `fee_schedules`, configuration versions.
- `wallet_accounts` or per-user/per-asset balance projections; these are derived from/kept consistent with the ledger.
- `ledger_transactions`, `ledger_entries`, `balance_reservations`, `admin_adjustment_requests`, and approval records.
- `orders`, `order_events`, `fills`/`executions`, `trading_fees`, provider submission attempts, idempotency records.
- `deposits`, `withdrawals`, `blockchain_transactions`, `provider_webhook_events`, provider sync/checkpoint records.
- `notifications`, delivery attempts, `audit_logs`, `risk_events`, provider health/integration metadata, reconciliation runs and discrepancy cases.

Financial integrity rules:
- Decimal/fixed-point types with documented precision; never floating-point money values.
- Unique constraints on provider order IDs where applicable, chain transaction/network references, webhook event IDs, idempotency keys, and ledger source references.
- Ledger entries are append-only. Status transitions and current-state projections are tracked without destroying history.
- Use database transactions and concurrency-safe reservation logic for order submission and withdrawals.
- Every ledger entry must have an explainable source event, and every financial source event must be processed idempotently.
- Define retention and access controls for personal data and financial audit data.

## 11. API and Event Requirements

Implement versioned, documented API endpoints consistent with the selected architecture. Names may differ, but equivalent operations must exist:

### Public/authenticated market data
- `GET /api/v1/markets`
- `GET /api/v1/markets/{symbol}`
- `GET /api/v1/markets/{symbol}/candles?interval=...`
- `GET /api/v1/markets/{symbol}/orderbook`
- `GET /api/v1/markets/{symbol}/trades`
- Realtime stream for ticker/order-book/trade updates where supported.

### Account and trading
- `GET /api/v1/account`
- `GET /api/v1/wallet/balances`
- `GET /api/v1/wallet/transactions`
- `POST /api/v1/orders` with an idempotency key
- `GET /api/v1/orders/open`
- `GET /api/v1/orders/history`
- `GET /api/v1/trades/history`
- `GET /api/v1/orders/{id}`
- `POST /api/v1/orders/{id}/cancel`
- Realtime private channel/events for order and balance changes with server-side authorization.

### Wallet
- `POST /api/v1/deposits/address` or a suitable read/create address operation, depending on provider design.
- `GET /api/v1/deposits`
- `POST /api/v1/withdrawals`
- `GET /api/v1/withdrawals`
- `GET /api/v1/wallet/transactions/{id}`
- Security re-authentication/MFA endpoints for high-risk actions as configured.

### Admin
- `GET /api/v1/admin/dashboard`
- User/role/asset/market/fee endpoints with explicit permissions.
- Admin deposit/withdrawal review endpoints.
- Ledger search, adjustment request/approval endpoints, reconciliation run/case endpoints, provider health/config metadata endpoints, and audit-log search.

All mutations require server-side validation, authentication/authorization, audit logging where appropriate, and idempotency when retries could create duplicate effects. Webhook endpoints must validate signatures and replay protection before processing. Return normalized errors with a stable code, safe message, and correlation ID; never expose stack traces or provider secrets in production responses.

## 12. Security, Risk, and Compliance

- Threat-model authentication, session theft, account takeover, order tampering, replay, race conditions, API abuse, admin privilege escalation, webhooks, deposit/withdrawal manipulation, provider compromise, and sensitive-data leakage.
- Apply OWASP-recommended controls appropriate to the selected stack: strict input validation, parameterized queries/ORM safety, XSS/CSRF protections, secure headers, rate limits, CORS allowlisting, secure cookie settings, and dependency scanning.
- Encrypt transport with TLS in deployed environments. Encrypt sensitive data at rest and keep key material in a managed secret store/KMS/HSM or approved custody system.
- Keep secrets out of frontend bundles, repository history, logs, screenshots, error messages, analytics, and generated documentation.
- Require least privilege for both application users and administrators. Protect Super Admin login with MFA and strict session controls.
- Record security-sensitive events and financial state changes in tamper-resistant audit logs.
- Use idempotency and atomic database operations to defend against repeated requests, double clicks, webhook retries, race conditions, and concurrent withdrawals/orders.
- Use circuit breakers/timeouts and fail closed for order placement and withdrawals if their required execution/custody dependencies are unhealthy.
- Do not let stale/invalid market data trigger unprotected orders. Apply order-price protection and documented slippage/price-band rules where supported.
- Configure KYC/AML/sanctions and jurisdictional policy based on a qualified legal/compliance assessment and provider requirements. Do not interpret this PRD as legal advice; do not launch public live trading before required approvals are complete.
- Maintain an incident-response process, backup/restore plan, key/credential rotation process, and emergency pause for trading/withdrawals.

## 13. Performance, Reliability, and Accessibility

- Responsive design from small mobile viewports through wide desktop displays; no horizontal page overflow except intentionally scrollable data regions.
- Keep common navigation and order actions usable with keyboard, visible focus, semantic labels, sufficient contrast, and accessible error announcements.
- Market data must show source time and reconnect safely. Define performance targets after selecting provider and deployment environment; baseline targets should include a fast initial shell, paginated history, bounded API latency, and no blocking full-page reload for routine updates.
- Use caching only for data whose freshness semantics are explicit. Financial balances and authorization decisions must not rely on stale caches.
- Implement retries with exponential backoff and jitter for safe transient operations; never automatically retry a non-idempotent financial request without an idempotency key.
- Queue monitoring and failed-job handling are required. Alerts should exist for provider disconnection, growing webhook/queue backlog, reconciliation mismatches, repeated withdrawal failures, and abnormal error spikes.
- Provide health and readiness checks without leaking secrets or detailed internal configuration.
- Document backup frequency, recovery-point/recovery-time targets, restore drills, and production migration rollback strategy.

## 14. Error and Empty-State Requirements

Explicitly design and test at least these states:
- market/provider connecting, live, stale, disconnected, maintenance, and unsupported;
- no markets, no orders, no trades, no wallet assets, no deposits, and no withdrawals;
- insufficient balance, amount below minimum, invalid precision, unsupported symbol/network, market paused, and account restricted;
- invalid price/quantity, price moved outside protection band, estimated fee changed, provider rejected, provider timeout with unknown final state, and duplicate submission;
- pending/open/partially-filled/filled/cancel-requested/cancelled/rejected/failed/expired order states as supported;
- deposit detected/confirming/credited/failed and withdrawal requested/review/approved/submitted/broadcast/confirming/completed/rejected/failed states as supported;
- stale session, MFA required, verification required, permission denied, rate limited, and temporary server/provider outage;
- admin operation successful, denied, awaiting second approval, or failed with a safe reason.

When an external provider times out after the order might have been accepted, do not assume failure and release all funds blindly. Query/reconcile the provider by idempotency/client order reference before choosing the final state.

## 15. Testing and Quality Gates

### Automated tests
- Unit tests for precision, fee math, rounding, validation, order state transitions, ledger direction, and provider normalization.
- Integration tests for database transactions, reservations, fills, cancellations, deposit crediting, withdrawal reserves/releases, admin permissions, and webhook idempotency.
- Concurrency tests proving two simultaneous orders/withdrawals cannot overspend one balance.
- Provider contract tests with sanitized fixtures from official documentation; label fixtures as test fixtures, never as live data.
- End-to-end user journeys: sign up/login, market viewing, valid/invalid buy and sell, open order and cancel, partial/full fill processing using provider test environment when available, wallet history, deposit/withdrawal lifecycle, and admin approvals.
- Security tests for cross-user data access, role escalation, CSRF/XSS/input abuse, rate limits, secret exposure, and unauthorized admin endpoints.
- Responsive visual checks against the supplied screenshots at matching viewport sizes and representative mobile sizes.

### Mandatory financial invariants
1. Balances are recalculated/verified from ledger and are never trusted solely from client state.
2. A rejected or never-accepted order does not create fills or a trade debit, except any explicitly documented and provider-confirmed fee rule.
3. A buy fill debits the quote asset and credits the base asset according to actual fill quantity and fees; a sell fill debits the base asset and credits the quote asset according to actual fill quantity and fees.
4. Reservations and releases match open/unfilled quantity and price/fee rules.
5. Every fill, deposit, withdrawal, and fee affects the ledger at most once.
6. Cancelling an order does not erase fills already executed.
7. Debit UI values are negative and credit values are positive; asset, amount, fee, and status labels are accurate.
8. Ledger, displayed balances, order history, and provider results reconcile or display a tracked discrepancy.
9. Production mode cannot render mocked market prices, demo orders, fabricated transactions, or success states caused only by frontend code.
10. Unauthorized users can never read another user's wallet/order/trade records or invoke admin-only actions.

### Quality gates before calling the project complete
- Formatting, linting, static analysis/type checks, migrations, unit/integration tests, and end-to-end tests pass.
- No unresolved critical/high-severity security issue or broken core trading flow.
- No secret committed to Git and no production key exposed to frontend.
- Build and start instructions work from a clean environment using `.env.example` and documented prerequisites.
- No broken links, dead buttons, placeholder actions, silent failures, unexplained sample numbers, or accidental demo-mode defaults.
- Screenshots are checked at target sizes; navigation, modals, charts, forms, and tables are not clipped or overlapping.
- Real provider integration has been tested in its approved test/sandbox environment and then in the production environment using controlled verification procedures before public launch.

## 16. Delivery Phases and Implementation Order

### Phase 0 — Repository and reference audit
- Verify target folder and preserve existing files.
- Inspect only the existing ETHSLTD brand assets/design tokens.
- Inventory all accessible MEXC reference screenshots.
- Write architecture decision record, initial screen map, provider-dependency list, and risk register.
- Decide with the owner which real execution/liquidity, custody, market-data, identity, and notification providers will be used; identify credentials/approvals needed.

**Exit gate:** No feature coding based on assumptions about unavailable screenshots or nonexistent provider APIs.

### Phase 1 — Fresh application foundation
- Create the new app and independent database/configuration.
- Implement routing, design tokens, ETHSLTD theme, responsive shell, authentication, roles, logging, validation, migrations, automated test framework, and CI checks.
- Add `.env.example`, seed only non-financial reference configuration for development, and enforce that development fixtures cannot be used in production.

**Exit gate:** New project runs independently and has no dependency on the old project's production database/resources.

### Phase 2 — Markets and trading terminal UI
- Implement screenshot-mapped market list, chart, order book, recent trades, order form, orders/history panels, mobile layout, and all visual states.
- Connect real market data through the chosen adapter.
- Add health/staleness labels and graceful provider-unavailable states.

**Exit gate:** Market figures are sourced, timestamped, and never silently simulated in production.

### Phase 3 — Ledger and wallet foundation
- Implement assets/networks/precision configuration, ledger, balance projection, reservations, transaction history, atomicity, idempotency, and invariant tests.
- Build wallet overview and deposit/withdrawal screens with actual provider capability gates.

**Exit gate:** Ledger invariants and concurrency tests pass before order submission is enabled.

### Phase 4 — Real trading execution
- Implement provider adapter, order lifecycle, actual execution IDs, fills, fees, cancellation, partial-fill handling, unknown-timeout recovery, history, account event streaming, and reconciliation.
- Enable trading only for provider-supported markets/order types and only when health/risk checks pass.

**Exit gate:** End-to-end trade flows pass in approved provider test environment; no fake success path exists.

### Phase 5 — Admin and operations
- Build admin dashboard, roles, users, markets/assets, fees/limits, deposits/withdrawals, ledger reviews, provider health, reconciliation, audit logs, and emergency controls.

**Exit gate:** Role tests, audit tests, dual-approval controls where configured, and operational runbooks pass.

### Phase 6 — Hardening and release readiness
- Security review, performance and mobile regression, restore test, log/alert verification, dependency review, error-state audit, and production configuration review.
- Run controlled real-provider integration checks only after explicit owner approval and required compliance/custody controls.
- Produce a final readiness report with passed/failed/blocked items and evidence.

**Exit gate:** Launch is blocked if real provider credentials/approvals, custody controls, reconciliation, security requirements, or applicable compliance requirements are missing.

## 17. Required Deliverables

1. Standalone application in the exact target directory.
2. Screenshot inventory and route/component mapping.
3. Brand asset and design-token inventory showing that only branding/theme items were reused.
4. Architecture diagram and architecture decision records.
5. Database schema/migrations, ERD or equivalent data model notes, and seed-data policy.
6. API documentation and provider adapter contracts.
7. User-facing trading, wallet, order-history, and transaction-history flows.
8. Admin panel with role-based permissions and audit trail.
9. Automated unit, integration, security-focused, and end-to-end tests.
10. `.env.example` with descriptions and no real credentials.
11. Setup, local development, test, migration, deployment, backup/restore, incident, and provider configuration documentation.
12. Reconciliation/operations runbook and order/deposit/withdrawal state-machine documentation.
13. Production-readiness checklist identifying every completed, uncompleted, and externally blocked item.
14. Final implementation report with changed files/modules, commands run, tests and results, known risks, required keys/accounts/approvals, and exact steps to enable live trading safely.

## 18. Definition of Done

The application is complete only when all of the following are true:
- It exists and runs from the requested `newEthsltd` folder as an independent project.
- ETHSLTD brand/logo/colors/theme are applied consistently, and MEXC identity/assets are not used as the product brand.
- Every accessible screenshot has been audited and mapped to implemented screens/interactions or an explicitly documented blocker.
- The market interface uses configured, timestamped live data; disconnected/stale states are visible.
- Real orders can be executed through the configured provider, with persisted provider IDs, correct state transitions, fills, fees, history, and wallet ledger updates.
- Deposits and withdrawals are backed by configured and verified infrastructure or clearly shown as unavailable; they are never simulated.
- The wallet ledger is append-only, precise, idempotent, atomic under concurrency, and reconcilable.
- The admin panel is fully protected by server-side roles and records sensitive operations in audit logs.
- No demo/mock values or success-only interactions are presented as production functionality.
- Core automated tests, financial invariants, security checks, responsive screenshot checks, and setup verification pass.
- The final report clearly distinguishes code that is implemented and tested from functionality blocked by missing third-party accounts, credentials, legal approval, or infrastructure.

## 19. Mandatory Instructions to the Implementation Agent

- Inspect first, plan second, implement third, verify continuously. Do not start by blindly generating pages.
- Do not modify the existing ETHSLTD project except reading it for brand assets/tokens. Never reuse its database, wallet, authentication, trading code, API secrets, Cloudflare resources, or production data.
- Do not stop after building a static UI. Wire every enabled control to a real backend operation or mark it disabled with a specific reason.
- Do not use hardcoded market values, balances, fees, deposit addresses, transaction IDs, execution results, or fake trade histories in production.
- Do not implement “successful” trading by merely writing an order to the local database. A successful execution must be supported by confirmed results from the chosen real execution provider.
- Do not blindly trust frontend balances or market prices. Revalidate financial state on the server and use atomic, idempotent operations.
- Do not invent provider endpoints or assume API keys exist. Use official provider documentation and list missing prerequisites accurately.
- Do not remove tests or disable validation to make a build pass. Fix the underlying issue and report any remaining failure.
- Do not call the system “production-ready” while core provider integration, custody, reconciliation, security review, or required compliance is still blocked.
- Avoid duplicate pages, duplicate API endpoints, duplicate ledger paths, and multiple competing sources of truth. Prefer shared services and a single authoritative ledger/order lifecycle.
- At the end, provide a precise summary of implemented modules, files changed, tests executed/results, live integrations actually verified, outstanding blockers, and how to run the project locally.

---

**Final product principle:** Build an ETHSLTD-branded crypto exchange experience inspired by the supplied MEXC screenshots, but keep the codebase independent and the financial behavior real, auditable, secure, and provider-backed. A polished interface is not evidence of real trading; the order lifecycle, wallet ledger, custody integration, and reconciliation must prove that the product is functional.
