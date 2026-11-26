# AGENTS.md — Student Management System

## Project identity

Build a secure, maintainable Student Management System (SMS) for one coaching institution with mess fee charging. Mess is a fee component only; do not implement hostel, kitchen, meal, or inventory operations in the initial MVP.

## Approved stack

- Next.js App Router
- JavaScript / JSX (`.js` and `.jsx` only; not TypeScript for application code)
- Cloudflare Workers deployment (`vinext` baseline; `OpenNext` as evaluated fallback if a required feature is incompatible)
- Cloudflare D1 (SQLite) — **8-D1 modular architecture** (`DB_IDENTITY`, `DB_STUDENTS`, `DB_ACADEMICS`, `DB_ATTENDANCE`, `DB_PERFORMANCE`, `DB_FINANCE`, `DB_TIMETABLE`, `DB_AUDIT`) accessed directly via request-scoped Workers bindings (`db.prepare(...).bind(...).all()/first()/run()` and `db.batch([...])`, where `db = getDomainDb(env, D1_BINDINGS.<DOMAIN>)`)
- Native Wrangler D1 SQL migrations (`migrations/<domain>/*.sql`, `wrangler d1 migrations apply <db-name>`)
- Cloudflare R2 (private object storage via `env.STORAGE`; metadata in D1 `file_objects`)
- Tailwind CSS + shadcn/ui
- Zod (external input validation) + React Hook Form
- WhatsApp OTP provider abstraction (`META`, `TWILIO`, or `MOCK`)

Do not introduce Drizzle, Prisma, TypeORM, Kysely, or any ORM, and do not introduce NestJS, Express, PostgreSQL, MongoDB, microservices, or TypeScript application files without explicit approval.

## Canonical documentation & skills

Read the relevant specification documents before planning or modifying code:

- `@docs/DEVELOPMENT_ROADMAP.md` — Phase 0 through Phase 10 step-by-step execution blueprint, file targets, `npm`/`wrangler` commands, and exit gates.
- `@docs/ARCHITECTURE.md` — Modular monolith structure (`src/app`, `src/modules`, `src/lib`), Workers request-scoped `env.DB`/`env.STORAGE` bindings, D1 concurrency, and security layers.
- `@docs/DATABASE_SCHEMA.md` — D1 (SQLite) logical schema, UUID v4 keys, integer paise (`amount_paise`), session-scoped `enrollments`, dual attendance registers, and `file_objects`.
- `@docs/SQL_DDL_BLUEPRINT.md` — Physical 36-table SQLite DDL reference (`migrations/0001_initial_schema.sql`), 50 explicit indexes, `EXPLAIN QUERY PLAN` hot paths, and `seeds/seed.sql` reference.
- `@docs/SECURITY_AND_RBAC_SPEC.md` — Server-side request pipeline, Origin/CSRF checks, Web Crypto WhatsApp OTP state machine, exact SQL isolation predicates (`parent_students`, `teacher_assignments`, student fee wall), R2 access control, and `audit_logs`.
- `@docs/API_SPECIFICATION.md` — Next.js App Router Route Handlers (`/api/v1/*`), JSON response/error envelopes (`data`, `pagination`, `meta.requestId`, `error`), Zod boundaries, and CSRF/origin checks.
- `@docs/BUSINESS_RULES_AND_LOGIC.md` — RBAC permissions matrix, WhatsApp OTP lifecycle, teacher assignment scoping, dual attendance rules, integer paise finance formulas, parent-student linking, and the 15 explicitly unresolved **OPEN** decisions.
- `@docs/OPEN_DECISIONS.md` — Stakeholder sign-off register mapping all 15 canonical `OPEN` decisions (`OD-01`..`OD-15`) to blocking phases, D1 tables, API routes, and unapproved proposed pilot defaults.
- `@docs/CONFIGURATION_AND_ENV.md` — `wrangler.toml` (`vinext/server/fetch-handler`, `DB` with `migrations_dir = "migrations"`, `STORAGE`, `ASSETS`), `vite.config.js`, `.env.local` / `.dev.vars`, cookie directives, rate limits, and R2 upload constraints.
- `@docs/DEVELOPMENT_GUIDE.md` — Local `npm` and Wrangler D1 setup, `npx wrangler d1 migrations` & synthetic seeding, verified Phase 1 `vinext` spike checklist, and `npm` scripts.
- `@docs/FRONTEND_AND_UI_SPEC.md` — Tailwind CSS v4 + shadcn/ui tokens, `formatINR(amountPaise)`, OTP login flow, role portals, Parent Child Switcher, and Rapid Attendance Sheet.
- `Student_Management_System_Phase_0_Architecture_Pack/phase0/PHASE_0_SIGNOFF_CHECKLIST.md` & `Student_Management_System_Phase_0_Architecture_Pack/phase0/docs/PRD_v1.2.md` — Phase 0 sign-off gates and baseline PRD (note: historical Phase 0 references to an ORM are superseded by the direct Workers `env.DB` + Wrangler SQL migrations rule above).

Use project and platform skills when working on implementation or verification:

- `.agents/skills/sms-cloudflare-stack/SKILL.md` — Stack invariants, Workers/D1 direct `env.DB` & R2 patterns, native Wrangler SQL migrations, integer paise ledger, OTP auth, and RBAC rules.
- `.agents/skills/sms-phase0-verification/SKILL.md` — Phase 0 compatibility spikes, clean `wrangler d1 migrations apply --local` + synthetic seed checks, `env.DB.batch()` rollback tests, SQL injection/ORM audits, OTP/RBAC verification, and OPEN-decision guards.
- `~/.gemini/config/skills/cloudflare/SKILL.md` — Global Cloudflare platform skill (consult `references/d1/`, `references/r2/`, `references/workers/`, `references/wrangler/`, `references/bindings/`, `references/static-assets/`, and `references/miniflare/`).

## Before changing code

1. Inspect the existing repository and relevant module.
2. Read the relevant requirements and `@docs/...` architecture specs.
3. Identify dependencies and callers.
4. Explain the planned file changes briefly.
5. Do not rewrite unrelated modules or replace working architecture without approval.

## Architecture rules

- Use a **modular monolith** (`src/modules/*` with `*.service.js`, `*.repository.js`, `*.schemas.js`, `*.permissions.js`).
- Keep UI components separate from business logic.
- Route Handlers (`src/app/api/v1/*`) must validate input (Zod), authenticate, authorize, call domain services, and shape responses; do not put complex business logic in route files.
- Put domain logic in module services and keep SQL queries behind module repositories (`*.repository.js`) using request-scoped domain D1 bindings (`env.DB_<DOMAIN>`).
- Avoid circular module dependencies and direct cross-module table manipulation from UI code.
- Use request-scoped Cloudflare bindings (`env.DB_*`, `env.STORAGE`); never capture request-specific D1 or R2 bindings in global singletons.
- Cross-D1 references are soft UUIDs without SQL `REFERENCES`; validate cross-D1 references in services before writing, and use bounded `IN (...)` (`<= 100` bind params) for hydration.
- Critical mutations in `DB_IDENTITY`, `DB_STUDENTS`, `DB_ATTENDANCE`, and `DB_FINANCE` write to domain-local `audit_outbox` atomically inside the same `batch()` (reconciled to `DB_AUDIT.audit_logs` via `INSERT OR IGNORE` in Phase B+); routine events remain best-effort.
- Use only APIs supported by the selected Workers runtime and deployment adapter; do not assume Node.js APIs are available without `nodejs_compat` and spike verification.

## Database rules

- D1 is SQLite. Never write PostgreSQL-specific SQL.
- Do not use any ORM or query-builder abstraction (no Drizzle, Prisma, TypeORM, Kysely). Use `env.DB.prepare(sql).bind(...).all() / .first() / .run()` and `env.DB.batch([...])` directly.
- Always use parameterized prepared statements (`?` placeholders with `.bind(...)`); never interpolate values or unvalidated identifiers into SQL strings.
- Store SQLite booleans as `INTEGER` (`0` or `1`) and bind `1`/`0` explicitly (not raw JS `true`/`false`).
- Author reviewed SQL migrations in `migrations/<domain>/*.sql` (with `migrations_dir = "migrations/<domain>"` in `wrangler.toml`) and apply via `npm run db:migrate:local` / `wrangler d1 migrations apply <db-name>`. Keep synthetic seed SQL (`seeds/01_*.sql`..`08_*.sql`) outside `migrations/` (legacy single-D1 files are archived in `docs/archive/single-d1/`).
- Never use destructive schema pushes against production; keep deployed migrations immutable and fix mistakes with follow-up migrations.
- Enable and verify foreign-key enforcement (`PRAGMA foreign_keys = ON;`) in local and production D1 setups for intra-DB FKs.
- Preserve historical `enrollments`, `attendance_days`/`daily_attendance_records`, `period_attendance_registers`/`period_attendance_records`, `exam_marks`, `invoices`, `invoice_items`, `payments`, `payment_allocations`, `fee_adjustments`, `payment_reversals`, and `receipts`. Do not cascade-delete historical academic or financial records.
- Use integer paise (`INTEGER NOT NULL`, `amount_paise` / `amountPaise`) for all INR monetary amounts; floating-point money arithmetic is forbidden. `fee_adjustments` uses explicit signed `amount_paise` (`WAIVER`/`DISCOUNT` < 0, `LATE_FINE` > 0, `CORRECTION` != 0) and is invoice-scoped in MVP; `payment_reversals` supports full-only reversals (`1:1`), preserving allocations and voiding receipts (`receipts.status = 'VOIDED'`), and all paid-balance queries must filter `payments.status = 'POSTED'`.
- Use database constraints for uniqueness and referential integrity within each D1 where practical (e.g., `admission_number`, `invoice_number`, `receipt_number`, `(student_id, academic_session_id)`).
- Never store uploaded binary files in D1; store objects in private Cloudflare R2 and metadata in `DB_STUDENTS.file_objects`.
- For multi-statement finance writes (invoice + items; payment + allocations + receipt + status update; adjustments; reversals + outbox), use atomic `DB_FINANCE.batch([...])` and test rollback.

## Security rules

- Enforce authentication and resource-level authorization on the server for every protected operation. UI hiding is not authorization.
- Deny by default; reject unauthenticated or unauthorized requests without leaking resource existence.
- Parent access must join through `parent_students` matching `parent_profile_id` and `verification_status = 'VERIFIED'`; parents have read-only fee access.
- Teacher access must be scoped via `teacher_assignments` (`REGULAR_TEACHER` vs `CLASS_TEACHER`) for the active academic session and approved historical rules. Teachers cannot generate invoices or record payments.
- Student access must be scoped to own records only. Never expose student fees to students in the MVP (`403 Forbidden` on `/api/v1/finance/*`).
- WhatsApp OTP: normalize phones to E.164 (`+91...`), return generic anti-enumeration responses on OTP request, store only OTP hashes (`otp_challenges`), enforce 5-minute expiry, max 3 attempts, single-use (`consumed_at`), 60-second per-phone cooldown, and 5/hour per-IP rate limits.
- Sessions (`sessions` with `token_hash`): issue signed `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookies; revoke on logout, deactivation, or sensitive changes.
- Never log OTP values, session tokens, passwords, or sensitive student data.
- Validate file uploads (allowed MIME `image/jpeg`, `image/png`, `image/webp`, `application/pdf`; max 5 MB), sanitize keys, and authorize every R2 object access on the server.

## Coding conventions

- Use `.js` and `.jsx` for all application code.
- Use descriptive names, small single-purpose functions, and Zod validation at external input boundaries.
- Use JSDoc for important service, repository, and API contracts; avoid unvalidated `any`-style data.
- Keep UI components accessible and responsive (Tailwind + shadcn/ui), providing loading, empty, error, and success states.
- Use consistent error codes, `meta.requestId`, standard response envelopes, and `formatINR(amountPaise)` for currency display.
- Do not add dependencies without explaining why they are needed.

## Testing requirements

- Add unit tests for business rules (integer paise math, invoice allocation/status transitions, OTP validation, dual attendance segregation).
- Add integration tests for direct `env.DB` D1 queries, `PRAGMA foreign_keys = ON`, parameterized query safety, and server-side authorization.
- Add isolation tests for parent (`parent_students`), teacher (`teacher_assignments`), and student (`403` on fees and other students) boundaries.
- Test `wrangler d1 migrations apply --local` from an empty local database and seed only synthetic development data (never commit real student data).
- Test financial `env.DB.batch([...])` rollback and duplicate submission prevention.
- Test OTP expiry, replay (`consumed_at`), attempt limits, and resend/IP throttling.
- Run lint, tests, and production Worker build before claiming completion.

## Antigravity operating rules

- Work only on the assigned task; do not modify unrelated files.
- Do not silently change requirements, schema decisions, or technology choices.
- Do not invent missing business rules: the 15 items in `@docs/BUSINESS_RULES_AND_LOGIC.md` (Section 8) and `PRD_v1.2.md` (Section 11) are **OPEN** until approved—mark affected assumptions `OPEN` and ask stakeholders.
- Do not create a migration without describing its effect.
- Do not claim tests passed unless they were actually run after the final edit.
- Summarize changed files, migrations, tests, and known limitations at task completion.
- Stop and request human review for authentication, authorization, financial logic, data deletion, production migrations, and secrets handling.
