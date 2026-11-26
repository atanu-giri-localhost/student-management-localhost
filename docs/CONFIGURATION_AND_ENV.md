# Configuration & Environment Specification

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**Deployment Platform:** Cloudflare Workers (`vinext`) · Cloudflare D1 · Cloudflare R2  
**Document Version:** 2.1 (Phase 1 Verified)  

---

## 1. Cloudflare Workers & Build Configuration (`wrangler.toml`, `vite.config.js`)

The root `wrangler.toml` defines edge worker entrypoints (`vinext`), static asset routing, D1 databases, R2 buckets, and compatibility flags:

```toml
name = "student-management-system"
main = "vinext/server/fetch-handler"
compatibility_date = "2025-11-17"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "dist/client"
binding = "ASSETS"
html_handling = "none"
not_found_handling = "none"
run_worker_first = ["/*", "!/_next/static/*", "!/*/_next/static/*"]

# ==========================================
# CLOUDFLARE D1 DATABASES (8 Domain SQLite DBs)
# ==========================================
[[d1_databases]]
binding = "DB_IDENTITY"
database_name = "sms-d1-identity"
database_id = "00000000-0000-0000-0000-000000000001"
migrations_dir = "migrations/identity"

[[d1_databases]]
binding = "DB_STUDENTS"
database_name = "sms-d1-students"
database_id = "00000000-0000-0000-0000-000000000002"
migrations_dir = "migrations/students"

[[d1_databases]]
binding = "DB_ACADEMICS"
database_name = "sms-d1-academics"
database_id = "00000000-0000-0000-0000-000000000003"
migrations_dir = "migrations/academics"

[[d1_databases]]
binding = "DB_ATTENDANCE"
database_name = "sms-d1-attendance"
database_id = "00000000-0000-0000-0000-000000000004"
migrations_dir = "migrations/attendance"

[[d1_databases]]
binding = "DB_PERFORMANCE"
database_name = "sms-d1-performance"
database_id = "00000000-0000-0000-0000-000000000005"
migrations_dir = "migrations/performance"

[[d1_databases]]
binding = "DB_FINANCE"
database_name = "sms-d1-finance"
database_id = "00000000-0000-0000-0000-000000000006"
migrations_dir = "migrations/finance"

[[d1_databases]]
binding = "DB_TIMETABLE"
database_name = "sms-d1-timetable"
database_id = "00000000-0000-0000-0000-000000000007"
migrations_dir = "migrations/timetable"

[[d1_databases]]
binding = "DB_AUDIT"
database_name = "sms-d1-audit"
database_id = "00000000-0000-0000-0000-000000000008"
migrations_dir = "migrations/audit"

# ==========================================
# CLOUDFLARE R2 OBJECT STORAGE
# ==========================================
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "sms-coaching-uploads"

# ==========================================
# RUNTIME VARIABLES
# ==========================================
[vars]
ENVIRONMENT = "development" # Set "production" for production deploy
APP_NAME = "Apex Coaching Institute SMS"
DEFAULT_ACADEMIC_SESSION = "2026-2027"
DEFAULT_DUE_DAY_OF_MONTH = 10
WHATSAPP_PROVIDER = "MOCK" # META, TWILIO, or MOCK

# Non-committed production secrets managed via `npx wrangler secret put`:
# - SESSION_SECRET
# - WHATSAPP_API_KEY
# - WHATSAPP_PHONE_NUMBER_ID
# - WHATSAPP_TEMPLATE_NAME
```

### Supporting Root Tooling Configuration
* **`vite.config.js`:** Configures `vinext()` alongside `@cloudflare/vite-plugin` (`cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } })`) and maps `@` -> `./src`.
* **`next.config.mjs`:** Sets `images: { unoptimized: true }` for Workers execution.
* **`postcss.config.mjs` & `src/app/globals.css`:** Configures Tailwind CSS v4 (`@tailwindcss/postcss` and `@import "tailwindcss";`).
* **`jsconfig.json`:** Enforces JavaScript-only (`checkJs: false`) across `src/**/*.js`, `src/**/*.jsx`, and `tests/**/*.js` with `@/*` -> `./src/*`.

---

## 2. Local Environment Variables (`.env.local` & `.dev.vars`)

Copy `.env.example` to `.env.local` and `.dev.vars.example` to `.dev.vars` (for local Wrangler/Miniflare Worker previews; never commit either file):

```bash
# ==========================================
# APPLICATION & RUNTIME (.env.local)
# ==========================================
NODE_ENV=development
APP_NAME="Apex Student Management System"
NEXT_PUBLIC_INSTITUTE_NAME="Apex Coaching Institute"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ==========================================
# SESSION & SECURITY
# ==========================================
# Generate production secret with: openssl rand -base64 32
SESSION_SECRET="dev_session_secret_at_least_32_characters_long_for_signing"
COOKIE_SECURE=false # Set true in production (HTTPS)
COOKIE_NAME="sms_session"

# ==========================================
# WHATSAPP OTP CONFIGURATION (Transport by Ogensync / MOCK)
# ==========================================
WHATSAPP_PROVIDER="MOCK" # "MOCK" (local/CI) or "OGENSYNC" (https://transport.ogensync.com)
OGENSYNC_BASE_URL="https://transport.ogensync.com"
WHATSAPP_API_KEY="mock_whatsapp_key" # Bearer token with messages:send scope
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_RESEND_COOLDOWN_SECONDS=60

# ==========================================
# CLOUDFLARE LOCAL BINDINGS (WRANGLER)
# ==========================================
# Local D1 SQLite file managed automatically in .wrangler/state/v3/d1
D1_DATABASE_NAME="sms-coaching-d1"
```

```bash
# ==========================================
# WORKER PREVIEW SECRETS (.dev.vars)
# ==========================================
SESSION_SECRET=dev_session_secret_at_least_32_characters_long_for_signing
COOKIE_SECURE=false
WHATSAPP_PROVIDER=MOCK
OGENSYNC_BASE_URL=https://transport.ogensync.com
WHATSAPP_API_KEY=mock_whatsapp_key
```

---

## 3. Native 8-D1 Migrations & Wrangler Workflow (`migrations/<domain>/*.sql`)

This project uses **no ORM or external schema-generation tool**. Database schema changes are authored directly as reviewed SQLite DDL files in `migrations/<domain>/` (matching each `migrations_dir` in `wrangler.toml`) and managed with Wrangler's built-in migration tracker (`d1_migrations`):

```bash
# 1. Create a new numbered SQL migration file in a domain track
npx wrangler d1 migrations create sms-d1-finance add_feature_table

# 2. Apply pending migrations across all 8 local D1s (.wrangler/state/v3/d1)
npm run db:migrate:local

# 3. Apply pending migrations to remote production D1s (requires explicit safety guard)
CONFIRM_REMOTE_D1_MIGRATE=true npm run db:migrate:prod

# 4. Seed and verify all 8 local D1s
npm run db:seed:local
npm run db:verify:local

# 5. Reset local D1 state only (never remote)
npm run db:reset:local
```

**Migration & Seed Rules:**
1. Include `PRAGMA foreign_keys = ON;` and explicit intra-DB `REFERENCES ... ON DELETE RESTRICT/CASCADE`, `UNIQUE`, and `CHECK` constraints directly in `migrations/<domain>/*.sql`. Never create cross-D1 foreign keys, and never put `BEGIN`/`COMMIT` inside migration or seed files.
2. Keep applied migrations immutable; fix mistakes with follow-up numbered migrations (`0002_*.sql`). Legacy single-D1 files are archived in `docs/archive/single-d1/`.
3. Keep synthetic development fixtures in `seeds/01_identity.sql`..`seeds/08_audit.sql` outside `migrations/` and apply locally via `npm run db:seed:local` so `npm run db:migrate:prod` never runs seed data in production.

---

## 4. Security, Cookie & CORS Configuration

1. **Session Cookie Directives:**
   * `HttpOnly: true` (inaccessible to client JavaScript to eliminate XSS token theft).
   * `SameSite: 'Lax'` (protects against CSRF on state-changing requests).
   * `Secure: true` in production (enforced over HTTPS).
   * `Path: '/'`.
2. **Rate Limiting Policy:**
   * OTP Requests: Max 5 requests per hour per IP. 60-second cooldown per phone number.
   * OTP Verification: Max 3 failed attempts per challenge before invalidation.
3. **Storage Security (R2):**
   * Uploads are validated for allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
   * Maximum file size: 5 MB.
   * R2 objects are private by default; access is mediated through authorized Next.js route handlers.
