# ETHSLTD Platform (New Architecture)

Official repository for the redesigned ETHSLTD Digital Asset & Derivatives Trading Platform.

## 🚀 Architecture & Deployments

| Component | Target Name | Cloudflare URL | Production Domain |
|-----------|-------------|----------------|-------------------|
| **Frontend Worker** | `ethsltd-new` | `https://ethsltd-new.ethsltd.workers.dev` | `https://ethsltd.com` / `https://www.ethsltd.com` |
| **API Worker** | `api-ethsltd-new` | `https://api-ethsltd-new.ethsltd.workers.dev` | N/A (Direct Worker API) |
| **Database** | `ethsltd-new` | Cloudflare D1 (`ce1856dc-dfc5-4831-8208-5c8646458f61`) | APAC (Singapore) |

---

## 📁 Repository Structure

```
newEthsltd/
├── web/              # Next.js 16 Web Application (OpenNext Cloudflare Worker)
│   ├── src/          # Application source (App Router, Server Actions, Components)
│   ├── prisma/       # Prisma schema & D1 SQL definitions
│   ├── open-next.config.ts # OpenNext build configuration
│   └── wrangler.jsonc# Frontend Worker configuration
├── api/              # Cloudflare Worker API (Hono, WebSockets, Risk Engine)
│   ├── src/          # API route handlers & middleware
│   └── wrangler.toml # API Worker configuration
├── database/         # D1 database migrations & schemas
├── packages/         # Shared TypeScript types & libraries
├── PRD/              # Product requirements & specifications
├── media/            # Platform visual assets & documentation
├── .env.example      # Environment variable template
└── DEPLOYMENT.md     # Production deployment report & verification
```

---

## 🛠️ Local Development

### 1. Frontend Web App
```bash
cd web
npm install
npx prisma generate
npm run dev
```
Access at `http://localhost:3000`.

### 2. API Worker
```bash
cd api
npm install
npx wrangler dev
```
Access at `http://localhost:8787`.

---

## 🚢 Deployment to Cloudflare

### 1. Database Migrations
```bash
cd web
npx wrangler d1 execute ethsltd-new --file=./prisma/schema.sql --remote
```

### 2. Deploy API Worker
```bash
cd api
npx wrangler deploy
```

### 3. Deploy Frontend Worker
```bash
cd web
npm run build:worker
npx wrangler deploy
```

---

## 🔒 Security & Policies

- **Zero Default Wallet Balance**: All new Relationship Managers, Admins, and User accounts initialize strictly with a `0.0` wallet balance.
- **Strict Role Isolation**: Admin and Relationship Manager panels enforce strict authorization checks.
- **Cloudflare Edge Protection**: Full SSL/TLS termination, DDoS mitigation, and HTTP/3 support via Cloudflare Workers.
