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
# CLOUDFLARE D1 DATABASE (SQLite)
# ==========================================
[[d1_databases]]
binding = "DB"
database_name = "sms-coaching-d1"
database_id = "00000000-0000-0000-0000-000000000000" # Replace with remote D1 ID
migrations_dir = "migrations" # Native Wrangler D1 SQL migrations tracked in d1_migrations

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
# WHATSAPP OTP CONFIGURATION
# ==========================================
WHATSAPP_PROVIDER="MOCK" # In local dev: "MOCK" logs OTP to server console
WHATSAPP_API_KEY="mock_whatsapp_key"
WHATSAPP_PHONE_NUMBER_ID="mock_phone_id"
WHATSAPP_TEMPLATE_NAME="sms_auth_otp"
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
WHATSAPP_API_KEY=mock_whatsapp_key
WHATSAPP_PHONE_NUMBER_ID=mock_phone_id
WHATSAPP_TEMPLATE_NAME=sms_auth_otp
```

---

## 3. Native D1 Migrations & Wrangler Workflow (`migrations/*.sql`)

This project uses **no ORM or external schema-generation tool**. Database schema changes are authored directly as reviewed SQLite DDL files in `migrations/` (matching `migrations_dir = "migrations"` in `wrangler.toml`) and managed with Wrangler's built-in migration tracker (`d1_migrations`):

```bash
# 1. Create a new numbered SQL migration file in migrations/
npm run db:migration:create -- add_feature_table
# Or directly: npx wrangler d1 migrations create sms-coaching-d1 add_feature_table

# 2. Apply pending migrations to local D1 (.wrangler/state/v3/d1)
npm run db:migrate:local
# Or: npx wrangler d1 migrations apply sms-coaching-d1 --local

# 3. Apply pending migrations to remote production D1
npm run db:migrate:prod
# Or: npx wrangler d1 migrations apply sms-coaching-d1 --remote

# 4. Inspect applied vs pending migrations
npx wrangler d1 migrations list sms-coaching-d1 --local
npx wrangler d1 migrations list sms-coaching-d1 --remote
```

**Migration & Seed Rules:**
1. Include `PRAGMA foreign_keys = ON;` and explicit `REFERENCES ... ON DELETE RESTRICT/CASCADE`, `UNIQUE`, and `CHECK` constraints directly in `migrations/*.sql`. Never put `BEGIN`/`COMMIT` inside migration or seed files.
2. Keep applied migrations immutable; fix mistakes with follow-up numbered migrations (`0002_*.sql`).
3. Keep synthetic development fixtures in `seeds/seed.sql` outside `migrations/` and apply locally via `npm run db:seed:local` (`npx wrangler d1 execute sms-coaching-d1 --local --file=./seeds/seed.sql`) so `npm run db:migrate:prod` never runs seed data in production.

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
