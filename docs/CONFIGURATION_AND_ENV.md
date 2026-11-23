# Configuration & Environment Specification

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**Deployment Platform:** Cloudflare Workers · Cloudflare D1 · Cloudflare R2  
**Document Version:** 2.0 (Phase 0 Aligned)  

---

## 1. Cloudflare Workers Configuration (`wrangler.toml`)

The root `wrangler.toml` defines edge worker bindings, D1 databases, R2 buckets, and compatibility flags:

```toml
name = "student-management-system"
main = ".open-next/worker.js" # or vinext entrypoint
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Static asset serving for Next.js build output
[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# ==========================================
# CLOUDFLARE D1 DATABASE (SQLite)
# ==========================================
[[d1_databases]]
binding = "DB"
database_name = "sms-coaching-d1"
database_id = "00000000-0000-0000-0000-000000000000" # Replace with production ID
migrations_dir = "drizzle/migrations"

# ==========================================
# CLOUDFLARE R2 OBJECT STORAGE
# ==========================================
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "sms-coaching-uploads"

# ==========================================
# ENVIRONMENT VARIABLES & SECRETS
# ==========================================
[vars]
ENVIRONMENT = "production"
APP_NAME = "Apex Coaching Institute SMS"
DEFAULT_ACADEMIC_SESSION = "2026-2027"
DEFAULT_DUE_DAY_OF_MONTH = 10
WHATSAPP_PROVIDER = "META" # META, TWILIO, or MOCK

# Non-committed production secrets managed via `wrangler secret put`:
# - SESSION_SECRET
# - WHATSAPP_API_KEY
# - WHATSAPP_PHONE_NUMBER_ID
# - WHATSAPP_TEMPLATE_NAME
```

---

## 2. Local Environment Variables (`.env.local` / `.env.example`)

Create `.env.local` for local development:

```bash
# ==========================================
# APPLICATION & RUNTIME
# ==========================================
NODE_ENV=development
APP_NAME="Apex Student Management System"
NEXT_PUBLIC_INSTITUTE_NAME="Apex Coaching Institute"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ==========================================
# SESSION & SECURITY
# ==========================================
# Generate with: openssl rand -base64 32
SESSION_SECRET="dev_session_secret_at_least_32_characters_long_for_signing"
COOKIE_SECURE=false # Set true in production (HTTPS)
COOKIE_NAME="sms_session"

# ==========================================
# WHATSAPP OTP CONFIGURATION
# ==========================================
WHATSAPP_PROVIDER="MOCK" # In local dev: "MOCK" logs OTP to console
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

---

## 3. Drizzle Kit Configuration (`drizzle.config.js`)

In accordance with ADR-003, Drizzle configuration is standard JavaScript:

```javascript
/** @type {import('drizzle-kit').Config} */
export default {
  schema: './drizzle/schema/index.js',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
  },
};
```

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
