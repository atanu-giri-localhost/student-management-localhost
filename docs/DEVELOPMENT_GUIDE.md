# Development & Setup Guide

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**Approved Stack:** Next.js App Router (JavaScript) · Cloudflare Workers · Cloudflare D1 · Drizzle ORM  
**Document Version:** 2.0 (Phase 0 Aligned)  

---

## 1. Prerequisites

* **Node.js:** `v20.x` or later (LTS)
* **Package Manager:** `pnpm` (recommended, `v8.x+` or `v9.x+`)
* **Cloudflare CLI:** `wrangler` (`v3.x+`)
* **Git:** `2.30+`

---

## 2. Quick Start (Local Setup)

### Step 1: Clone Repository & Install Dependencies
```bash
git clone <repository_url> student-management
cd student-management

pnpm install
```

### Step 2: Configure Environment Variables
```bash
cp .env.example .env.local
```
*(In development, `WHATSAPP_PROVIDER="MOCK"` is set by default, which outputs OTP codes directly to the terminal console).*

### Step 3: Initialize Local Cloudflare D1 Database & Run Migrations
Wrangler emulates Cloudflare D1 locally in `.wrangler/state/v3/d1`:
```bash
# Generate migrations from Drizzle schema
pnpm exec drizzle-kit generate

# Apply migrations to local D1 SQLite database
pnpm exec wrangler d1 execute sms-coaching-d1 --local --file=./drizzle/migrations/0000_initial_schema.sql
```

### Step 4: Seed Initial Synthetic Demo Data
```bash
pnpm exec wrangler d1 execute sms-coaching-d1 --local --file=./drizzle/seed.sql
```

### Step 5: Start the Development Server
```bash
pnpm dev
```
* **Application URL:** [http://localhost:3000](http://localhost:3000)

---

## 3. Demo Credentials (Local Development Mode)

When `WHATSAPP_PROVIDER="MOCK"` is enabled, any registered phone number can use OTP `123456` or check the console logs:

| Role | Normalized Phone Number | Initial Landing Portal |
| :--- | :--- | :--- |
| **Super Admin** | `+919999900001` | `/admin/dashboard` |
| **Coaching Admin** | `+919999900002` | `/admin/dashboard` |
| **Teacher (Class 10 Lead)** | `+919876500001` | `/teacher/dashboard` |
| **Teacher (Regular Math)** | `+919876500002` | `/teacher/dashboard` |
| **Student** | `+919876510001` | `/student/dashboard` |
| **Parent (Multi-Child)** | `+919876520001` | `/parent/dashboard` |

---

## 4. Phase 0 Compatibility Spike Checklist

Before writing application features, the team must complete and sign off the Phase 0 compatibility spike:

1. [ ] **Deployment Adapter Spike:** Validate **vinext** with Next.js App Router, Server Components, Route Handlers, and session cookies on Workers. (Evaluate OpenNext if any incompatibility arises).
2. [ ] **D1 & Drizzle JavaScript Compatibility:** Confirm Drizzle ORM loads schemas and configurations written purely in JavaScript (`.js`).
3. [ ] **Request-Scoped Binding Access:** Verify `env.DB` and `env.STORAGE` are accessed cleanly per request without global singleton leaks.
4. [ ] **Atomic D1 Batch Workflow:** Test multi-statement financial write rollback using `db.batch([...])`. Verify that if one statement fails, the entire transaction rolls back.
5. [ ] **WhatsApp OTP Mock Adapter:** Confirm phone normalization, OTP hash storage, attempt limits (3 max), and 60-second resend throttling.

---

## 5. Development Scripts

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts local Next.js development server with local bindings. |
| `pnpm build` | Compiles application via Cloudflare adapter (`vinext` / `open-next`). |
| `pnpm preview` | Runs Cloudflare Workers local preview via Wrangler. |
| `pnpm db:generate` | Uses Drizzle Kit to generate SQL migration files. |
| `pnpm db:migrate:local` | Applies migrations to local D1 database. |
| `pnpm db:migrate:prod` | Applies reviewed migrations to production D1 database. |
| `pnpm test` | Runs unit and integration test suite via Vitest. |
| `pnpm lint` | Runs ESLint and accessibility lint checks. |

---

## 6. Testing Strategy & Quality Requirements

* **Financial Integrity Tests:** Prove that payment allocations never exceed payment amounts and partial payments update invoice status accurately.
* **RBAC & Isolation Tests:**
  * Verify that parents cannot access unlinked students (`403 Forbidden`).
  * Verify that students cannot access any `/api/v1/finance/*` routes (`403 Forbidden`).
  * Verify that teachers cannot view fee data for students outside their assigned classes.
* **OTP Rate-Limiting Tests:** Verify attempt throttling, resend cooldowns, and hash verification.
