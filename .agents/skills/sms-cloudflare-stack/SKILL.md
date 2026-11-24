---
name: sms-cloudflare-stack
description: >-
  Implementation runbook for the Student Management System Phase 0 stack: Next.js
  App Router in JavaScript/JSX, Cloudflare Workers (vinext/OpenNext), direct
  env.DB D1 SQLite prepared statements and env.DB.batch(), native Wrangler SQL
  migrations, R2 private storage, integer paise finance ledger, WhatsApp OTP auth,
  session-scoped enrollments, dual attendance registers, and server RBAC. Use
  when designing, writing, refactoring, or reviewing any SMS application code, API
  route, SQL migration, repository query, or Cloudflare binding integration.
---

# SMS Cloudflare Stack Runbook

Enforces the approved Phase 0 technical baseline for the single-institution Student Management System (coaching + mess fee component only; no hostel/meal/inventory operations).

## 1. Hard Stack Boundaries & Forbidden Technologies

**Approved baseline:**
- **Framework & UI:** Next.js App Router, React, Tailwind CSS, shadcn/ui (Radix), React Hook Form, Zod.
- **Language:** Plain JavaScript & JSX (`.js`, `.jsx`) ONLY for all application code, with JSDoc typing and Zod runtime validation.
- **Runtime & Storage:** Cloudflare Workers (`vinext` primary deployment adapter; `OpenNext` documented fallback), Cloudflare D1 (SQLite) via direct `env.DB` Workers bindings, native Wrangler SQL migrations (`migrations/*.sql`), Cloudflare R2 (`env.STORAGE`), WhatsApp OTP provider abstraction.

**Explicitly Forbidden (never introduce without explicit architectural approval):**
- **Any ORM or query-builder library:** Drizzle, Prisma, TypeORM, Kysely, Sequelize, Mongoose.
- NestJS, Express, Fastify, or standalone backend API servers / microservices.
- PostgreSQL, MySQL, MongoDB, or PostgreSQL-specific SQL (`SERIAL`, `JSONB`, `ILIKE`, `TIMESTAMPTZ`).
- TypeScript application files (`.ts`, `.tsx`).

Canonical references: `@docs/ARCHITECTURE.md`, `@docs/DATABASE_SCHEMA.md`, `@docs/API_SPECIFICATION.md`, `@docs/BUSINESS_RULES_AND_LOGIC.md`, `@docs/CONFIGURATION_AND_ENV.md`, and `~/.gemini/config/skills/cloudflare/SKILL.md`.

---

## 2. Modular Monolith & Route Handler Pattern

Organize code strictly under `src/` and `migrations/`:
- `src/app/(auth|admin|teacher|student|parent)/` — Role-scoped UI layouts and Server/Client Components.
- `src/app/api/v1/*` — Route Handlers. Keep them thin: parse/validate via Zod, resolve session, obtain request-scoped `env`, call domain service, return standard JSON envelope (`{ data, meta: { requestId } }`, `{ data, pagination, meta }`, or `{ error: { code, message, details }, meta }`). Validate origin/CSRF on `POST`, `PUT`, `PATCH`, `DELETE`.
- `src/modules/<domain>/` — Domain modules (`<domain>.service.js`, `<domain>.repository.js`, `<domain>.schemas.js`, `<domain>.permissions.js`). Repositories accept `db` (`env.DB`) as an explicit parameter and hold parameterized SQL queries; services hold business rules; UI components never execute SQL or import repositories directly. Avoid circular module imports.
- `src/lib/` — Shared utilities (`cloudflare/`, `auth/`, `whatsapp/`, `money/`, `validation/`, `dates/`).

---

## 3. Cloudflare Workers & Request-Scoped Bindings

1. **No Global Singletons:** Workers isolates execute per request. NEVER cache `env.DB` or `env.STORAGE` in module-level globals. Pass request-scoped bindings from the request handler into services and repositories:
   ```javascript
   // src/lib/cloudflare/bindings.js
   /** @param {{ DB?: unknown, STORAGE?: unknown }} env */
   export function requireDb(env) {
     if (!env?.DB) {
       throw new Error('Cloudflare D1 binding (env.DB) is unavailable.');
     }
     return env.DB;
   }
   ```
2. **Workers Runtime Safety:** Use Web Standard APIs or `nodejs_compat`-verified packages only. Never store rate-limit or session state in process memory across requests.
3. **Config (`wrangler.toml`):** Bind `DB` (`[[d1_databases]]`, `migrations_dir = "migrations"`), `STORAGE` (`[[r2_buckets]]`), `[assets]`, and `compatibility_flags = ["nodejs_compat"]`. Put production secrets (`SESSION_SECRET`, `WHATSAPP_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`) in `wrangler secret put` (`.dev.vars` / `.env.local` locally).
4. **Platform Details:** Check `~/.gemini/config/skills/cloudflare/references/{workers,bindings,wrangler,static-assets}/`.

---

## 4. Direct Cloudflare D1 (`env.DB`) & Native Wrangler Migrations

Consult `~/.gemini/config/skills/cloudflare/references/d1/{api.md,patterns.md,gotchas.md,configuration.md}`:

1. **Parameterized Prepared Statements ONLY:**
   - ALWAYS bind parameters with `?` and `.bind(...)`. NEVER interpolate user input or values with template literals (`SELECT ... ${id}`).
   - Build conditional filters using static column clauses + bound parameter arrays:
     ```javascript
     // src/modules/students/students.repository.js
     /** @param {any} db @param {{ status?: string, search?: string, limit: number, offset: number }} filters */
     export async function listStudents(db, filters) {
       const where = [];
       const params = [];
       if (filters.status) {
         where.push('lifecycle_status = ?');
         params.push(filters.status);
       }
       if (filters.search) {
         where.push('(full_name LIKE ? OR admission_number LIKE ?)');
         params.push(`%${filters.search}%`, `%${filters.search}%`);
       }
       const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
       const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM students ${clause}`).bind(...params);
       const rowsStmt = db
         .prepare(`SELECT id, admission_number, full_name, lifecycle_status FROM students ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
         .bind(...params, filters.limit, filters.offset);
       const [countRes, rowsRes] = await db.batch([countStmt, rowsStmt]);
       return { total: countRes.results[0]?.total ?? 0, rows: rowsRes.results };
     }
     ```
2. **D1 Query Methods & Constraint Mapping:**
   - `.all()` -> `{ results, success, meta }` for row lists; `.first()` / `.first('col')` -> single row/scalar or `null`; `.run()` -> `INSERT`/`UPDATE`/`DELETE` (`result.meta.changes`); `.raw()` -> compact array of arrays.
   - Catch SQLite constraint errors (`error.message?.includes('UNIQUE constraint failed')` -> return `409 Conflict`; `'FOREIGN KEY constraint failed'` -> return `400`/`409` cleanly).
3. **SQLite Type & FK Conventions:**
   - Primary keys: application-generated UUID v4 (`TEXT PRIMARY KEY`).
   - Timestamps: UTC ISO-8601 strings (`TEXT`); Calendar dates: `YYYY-MM-DD` (`TEXT`).
   - Booleans: `INTEGER NOT NULL` (`0` / `1`). Always bind `1` or `0` in `.bind(...)` (never raw JS `true`/`false`).
   - Foreign keys: enforce `PRAGMA foreign_keys = ON;`; never cascade-delete historical academic or financial records (`enrollments`, `invoices`, `payments`, `exam_marks`, attendance registers).
4. **Native Wrangler Migrations (`migrations/*.sql`):**
   - Set `migrations_dir = "migrations"` in `wrangler.toml`.
   - Create migrations with `wrangler d1 migrations create sms-coaching-d1 <name>`, author clean SQLite DDL (`migrations/0001_initial_schema.sql`), review manually, and apply via `wrangler d1 migrations apply sms-coaching-d1 --local` (then `--remote` for staging/prod).
   - Wrangler tracks applied files in `d1_migrations`. Never edit an applied migration (issue a follow-up migration), never run destructive pushes against production, and keep synthetic seed SQL outside `migrations/` (e.g. `seeds/seed.sql` executed via `wrangler d1 execute ... --local --file=...`).
5. **D1 Limits & Indexing:** Respect 1 MB max row size, 1,000-statement free-tier / 10,000-statement paid-tier `batch()` limits, 30s query timeout, and single-threaded writes. Avoid N+1 loops (use `JOIN`s or `env.DB.batch([...])`), paginate all lists, avoid `SELECT *`, and inspect hot paths with `EXPLAIN QUERY PLAN`.

---

## 5. Integer Paise Finance Ledger & Atomic `env.DB.batch([...])`

1. **Zero Floating-Point Money:** Store and transmit all monetary values as integer paise (`INTEGER NOT NULL`, `amount_paise` / `amountPaise`, `1 INR = 100 paise`). Format on the UI exclusively with `formatINR(amountPaise)`.
2. **Pricing Precedence & Snapshot Billing:**
   - Charge resolves from `student_fee_assignments(enrollment_id, fee_component_id)` override if present, else `fee_structures(academic_session_id, class_id, fee_component_id)`.
   - Monthly `invoices` (`COMBINED`, `SEPARATE_COACHING`, `SEPARATE_MESS`, unique on `(student_id, billing_month, billing_year, invoice_type)`) write immutable line snapshots into `invoice_items`.
3. **Decoupled Payments & Allocations:**
   - `payments` (`CASH`, `UPI`, `BANK_TRANSFER`) record received funds; `payment_allocations` map funds to invoices with invariant `SUM(allocated_amount_paise) <= payment.amount_paid_paise`.
   - Derive status (`PAID`, `PARTIALLY_PAID`, `UNPAID`) from `total_amount_paise - allocated_paise`; `OVERDUE` is derived (`outstanding > 0 && today > due_date`).
   - Issue formal `receipts` (`1:1` with `payments`).
4. **Atomic `env.DB.batch([...])`:** D1 executes `env.DB.batch([...])` sequentially as an atomic transaction (all succeed or all roll back). Every multi-statement finance write (invoice + items; payment + allocations + receipt + invoice status update; reversals + `audit_logs`) MUST execute in one `env.DB.batch([...])`:
   ```javascript
   await db.batch([
     db.prepare('INSERT INTO payments (...) VALUES (...)').bind(...),
     db.prepare('INSERT INTO payment_allocations (...) VALUES (...)').bind(...),
     db.prepare('INSERT INTO receipts (...) VALUES (...)').bind(...),
     db.prepare('UPDATE invoices SET status = ? WHERE id = ?').bind(nextStatus, invoiceId),
   ]);
   ```

---

## 6. Cloudflare R2 Private Objects & `file_objects`

- Store student/teacher photos and documents in private R2 (`env.STORAGE`); store only metadata (`r2_object_key`, `category`, `mime_type`, `size_bytes`, `uploaded_by_user_id`, `created_at`) in D1 `file_objects`.
- Validate MIME (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) and size (max 5 MB) on the server; reject keys containing `..` or leading `/`.
- Buffer or supply `Content-Length` on `env.STORAGE.put()` (never stream unknown-length bodies silently).
- Never trust client-supplied R2 keys as authorization proof; stream via an authorization-checked Route Handler or short-lived signed URL. Check `~/.gemini/config/skills/cloudflare/references/r2/gotchas.md`.

---

## 7. WhatsApp OTP Auth & Session Invariants

- **Provider Abstraction (`src/lib/whatsapp/`):** Isolate template dispatch (`META`, `TWILIO`, `MOCK`) from challenge/session logic.
- **Anti-Enumeration & Hashing:** Normalize phone to E.164 (`+91...`). `POST /api/v1/auth/otp/request` must return the exact same `200` response whether the number is registered or not. Persist only a cryptographic hash (`otp_hash`) in `otp_challenges`.
- **Lifecycle Controls:** 5-minute TTL (`expires_at`), max 3 attempts (`attempts`), single-use (`consumed_at`), 60-second per-phone resend cooldown, and max 5 requests/hour per IP.
- **Sessions (`sessions`):** Persist `token_hash`; set signed `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie (`sms_session`). Never log OTPs, session tokens, or PII.

---

## 8. Session-Scoped Enrollments & Dual Attendance

- **Academic History:** `students` holds permanent identity (`admission_number`); `enrollments` binds `(student_id, academic_session_id)` to `class_id` and `enrollment_status` (`ACTIVE`, `PROMOTED`, `REPEATED`, `TRANSFERRED`, `LEFT`). Attendance, performance, exam marks, and fee overrides reference `enrollment_id` so session rollover never overwrites past classes.
- **Dual Attendance Segregation:**
  - `attendance_days` + `daily_attendance_records`: official institutional register (marked by `CLASS_TEACHER` or Admin) — sole source for official attendance %.
  - `period_attendance_registers` + `period_attendance_records`: subject-period register (marked by `REGULAR_TEACHER`).
  - Never merge tables or double-count absences across daily and period registers. Lock edits after 24h (`is_locked = 1`) unless Admin approves with an `audit_logs` entry.

---

## 9. Server-Side RBAC Invariants (Deny by Default)

Enforce authorization inside services/Route Handlers on every request:
- **Parent:** Every student, academic, or fee query MUST join `parent_students` with `parent_profile_id = session.parentProfileId` and `verification_status = 'VERIFIED'`. Strictly read-only (no edits or payment actions).
- **Teacher:** Responsibilities (`CLASS_TEACHER` vs `REGULAR_TEACHER`) live on `teacher_assignments` per session, not on `teacher_profiles`. Teachers view fees read-only solely for currently enrolled students in their assigned classes and CANNOT generate invoices or record payments.
- **Student:** Scoped to own records (`session.studentId`) only. **Zero fee access** — all `/api/v1/finance/*` routes and fee payloads return `403 Forbidden`.
- **Open Policies:** Never guess answers to the 15 **OPEN** items in `@docs/BUSINESS_RULES_AND_LOGIC.md` (e.g., `SUPER_ADMIN` vs `COACHING_ADMIN` differences, concessions, reversals, report cards). Mark them `OPEN` and escalate.
