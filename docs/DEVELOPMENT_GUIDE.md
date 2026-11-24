# Development & Setup Guide

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**Approved Stack:** Next.js App Router (JavaScript) · Cloudflare Workers (`vinext`) · Cloudflare D1 (Direct `env.DB` Bindings & Native SQL Migrations)  
**Document Version:** 2.1 (Phase 1 Verified)  

---

## 1. Prerequisites

* **Node.js:** `v20.x` or later LTS (verified on `v24.14.1`)
* **Package Manager:** `npm` (`v10.x+` / verified on `v11.11.0`)
* **Cloudflare CLI:** `wrangler` (`v4.x`, installed as a devDependency and invoked via `npx wrangler`)
* **Git:** `2.30+`

---

## 2. Quick Start (Local Setup)

### Step 1: Clone Repository & Install Dependencies
```bash
git clone <repository_url> student-management
cd student-management

npm install
```

### Step 2: Configure Environment Variables & Worker Secrets
```bash
cp .env.example .env.local
cp .dev.vars.example .dev.vars
```
*(In development, `WHATSAPP_PROVIDER="MOCK"` is set by default for local testing without external WhatsApp API calls).*

### Step 3: Initialize Local Cloudflare D1 Database & Run Migrations
Wrangler emulates Cloudflare D1 locally in `.wrangler/state/v3/d1`:
```bash
# Apply versioned SQL migrations (migrations/*.sql) to local D1 SQLite database
npm run db:migrate:local

# Verify applied migrations and foreign-key enforcement
npx wrangler d1 migrations list sms-coaching-d1 --local
npx wrangler d1 execute sms-coaching-d1 --local --command="PRAGMA foreign_keys = ON; SELECT name FROM sqlite_master WHERE type='table';"
```

*(When adding schema changes later, scaffold a new file with `npm run db:migration:create -- <migration_name>` and author pure SQLite DDL in `migrations/`.)*

### Step 4: Seed Initial Synthetic Demo Data
```bash
npm run db:seed:local
```

### Step 5: Start the Development Server
```bash
npm run dev
```
* **Application URL:** [http://localhost:3000](http://localhost:3000)

---

## 3. Demo Credentials (Local Development Mode)

When `WHATSAPP_PROVIDER="MOCK"` is enabled, seeded demo phone numbers (`seeds/seed.sql`) support local development testing:

| Role | Normalized Phone Number | Initial Landing Portal |
| :--- | :--- | :--- |
| **Super Admin** | `+919999900001` | `/admin/dashboard` |
| **Coaching Admin** | `+919999900002` | `/admin/dashboard` |
| **Teacher (Class 10 Lead)** | `+919876500001` | `/teacher/dashboard` |
| **Teacher (Regular Math)** | `+919876500002` | `/teacher/dashboard` |
| **Student** | `+919876510001` | `/student/dashboard` |
| **Parent (Multi-Child)** | `+919876520001` | `/parent/dashboard` |

---

## 4. Phase 0 / Phase 1 Compatibility Spike Checklist

Before writing domain features (Phase 2+), verify these foundation checks:

1. [x] **Deployment Adapter Spike:** Validated `vinext` (`vinext@1.4.6` + `@cloudflare/vite-plugin`) with App Router pages, Tailwind CSS v4, and `/api/v1/health` Route Handler on Workers (`npm run build && npm run preview` passed; OpenNext fallback not required).
2. [x] **Native D1 Migrations & Foreign Keys:** Verified clean database initialization via `npx wrangler d1 migrations apply sms-coaching-d1 --local` (`0001_initial_schema.sql`, 36 tables), `PRAGMA foreign_keys = ON;`, and parameterized `env.DB.prepare(...).bind(...)` queries in standard JavaScript (`.js`).
3. [x] **Request-Scoped Binding Access:** Verified `resolveWorkerEnv()`, `getDb(env)`, and `getStorage(env)` in `src/lib/cloudflare/bindings.js` without global singleton leaks.
4. [x] **Atomic D1 Batch Workflow:** Verified multi-statement financial write commit and full rollback via `env.DB.batch([...])` in `tests/integration/d1-batch.test.js`.
5. [ ] **WhatsApp OTP Mock & Provider Adapter (Phase 2 Gate):** Confirm phone normalization, HMAC/SHA-256 OTP hash storage, attempt limits (3 max), 60-second resend cooldown, and 5/hour IP throttling once Phase 2 auth endpoints are built.

---

## 5. Development Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts local `vinext dev` server with local bindings. |
| `npm run build` | Compiles application via `vinext build` into `dist/client` and `dist/server`. |
| `npm run preview` | Runs Cloudflare Workers local preview via `vite preview` (`@cloudflare/vite-plugin`). |
| `npm run db:migration:create -- <name>` | Runs `wrangler d1 migrations create sms-coaching-d1 <name>` to create a numbered SQL migration in `migrations/`. |
| `npm run db:migrate:local` | Applies pending `migrations/*.sql` files to local D1 via `wrangler d1 migrations apply sms-coaching-d1 --local`. |
| `npm run db:migrate:prod` | Applies reviewed pending migrations to production D1 via `wrangler d1 migrations apply sms-coaching-d1 --remote`. |
| `npm run db:seed:local` | Executes synthetic `seeds/seed.sql` against local D1 via `wrangler d1 execute sms-coaching-d1 --local --file=./seeds/seed.sql`. |
| `npm test` | Runs unit and integration test suite via `vitest run`. |
| `npm run lint` | Runs ESLint (`eslint .`) including React, Hooks, and JSX accessibility (`jsx-a11y`) checks. |

---

## 6. Testing Strategy & Quality Requirements

* **Financial Integrity Tests:** Prove that payment allocations never exceed payment amounts and partial payments update invoice status accurately.
* **RBAC & Isolation Tests:**
  * Verify that parents cannot access unlinked students (`403 Forbidden`).
  * Verify that students cannot access any `/api/v1/finance/*` routes (`403 Forbidden`).
  * Verify that teachers cannot view fee data for students outside their assigned classes.
* **OTP Rate-Limiting Tests:** Verify attempt throttling, resend cooldowns, and hash verification.
* **D1 Migration & SQL Safety Tests:** Verify clean migrations from an empty local D1 database, `PRAGMA foreign_keys = ON` enforcement, `env.DB.batch([...])` rollback on constraint failures, parameterized `.prepare().bind()` queries (no SQL string interpolation), and zero ORM packages installed.
