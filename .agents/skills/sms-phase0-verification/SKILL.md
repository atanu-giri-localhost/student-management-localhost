---
name: sms-phase0-verification
description: >-
  Phase 0 compatibility spike and verification runbook for the Student Management
  System: validates vinext/OpenNext on Cloudflare Workers, direct env.DB D1
  bindings and parameterized queries (zero ORMs), native Wrangler SQL migrations
  from a clean DB plus synthetic seed, atomic finance env.DB.batch() rollback and
  duplicate submission, WhatsApp OTP throttling/replay, server RBAC isolation, and
  enforcement of the 15 OPEN decisions rule. Use when running Phase 0 spikes,
  reviewing PRs, or verifying auth, finance, and database changes.
---

# SMS Phase 0 Verification & Spike Runbook

Step-by-step verification gate for the SMS Phase 0 baseline (`Student_Management_System_Phase_0_Architecture_Pack/phase0/PHASE_0_SIGNOFF_CHECKLIST.md` and `@docs/DEVELOPMENT_GUIDE.md`).

**Mandatory rule:** Never claim any check passed unless it was actually executed after your final edit and observed passing without skipped or relaxed assertions.

---

## 1. Gate Zero: Enforce the 15 OPEN Decisions Rule

Before approving or implementing domain behavior, check `Student_Management_System_Phase_0_Architecture_Pack/phase0/docs/PRD_v1.2.md` (Section 11) and `@docs/BUSINESS_RULES_AND_LOGIC.md` (Section 8).

The following 15 areas remain **OPEN** until stakeholder sign-off — **never silently invent answers**:
1. Exact `SUPER_ADMIN` vs `COACHING_ADMIN` permissions (user management, deletion, audit logs).
2. WhatsApp Business provider choice (`META` / `TWILIO` / `Infobip`), approved templates, and OTP recovery/SMS fallback.
3. Teacher and student account provisioning/activation workflow.
4. Parent account invitation and guardian-phone verification workflow.
5. Whether multiple separate parent/guardian accounts (e.g., father + mother) may link to one student.
6. Academic calendar, session naming, term boundaries, and rollover dates.
7. Student promotion, repeat, transfer, and leaving approval workflows.
8. Attendance late-arrival thresholds, formal leave approvals, daily vs period applicability, and correction/lock overrides.
9. Exam grading scales, rounding rules, absent/exempt treatment, and pilot PDF report-card scope.
10. Fee discounts, sibling/scholarship concessions, late fines, refunds, overpayments/credits, and payment reversal/void flows.
11. Bulk monthly invoice generation rules and invoice/receipt numbering format.
12. Teacher fee visibility for historical/departed students.
13. Expected student, teacher, and concurrent user volumes.
14. Cloudflare Workers paid/free plan budget and RPO/RTO backup targets.
15. Data retention, alumni archival, privacy notice, and consent policy.

**Action:** If code or tests depend on an unresolved item, stop, mark it `OPEN`, and request human sign-off.

---

## 2. Static Stack, No-ORM & SQL-Safety Audit

Verify zero stack drift, zero ORM dependencies, and parameterized SQL safety before running runtime checks:
1. **No TypeScript app code & no ORMs or forbidden frameworks/DBs:**
   ```bash
   find src -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null
   grep -rnE "drizzle|prisma|typeorm|kysely|sequelize|express|nestjs|mongoose|mongodb|\bpg\b|mysql2" src migrations package.json 2>/dev/null
   ```
   Expected: zero `.ts`/`.tsx` application files and zero ORM/forbidden-package matches.
2. **Parameterized query & SQL-injection check:**
   ```bash
   grep -rnE "\.prepare\s*\(\s*\`[^\`]*\\\$\{" src 2>/dev/null
   ```
   Inspect every `env.DB.prepare(...)` call in `src/modules/*/*.repository.js` to confirm values are bound exclusively via `?` placeholders and `.bind(...)` (dynamic `WHERE` clauses assemble static `"col = ?"` snippets only; booleans bind `1` or `0`, never raw JS `true`/`false`).
3. **No global binding singletons:** Confirm `env.DB` and `env.STORAGE` are passed per request (never cached at module scope).
4. **No secrets or real student PII in Git:** Confirm `.env.local` and `.dev.vars` are gitignored and only synthetic seed fixtures exist.

---

## 3. Cloudflare Workers Deployment Spike (`vinext` / `OpenNext`)

Validate the Next.js App Router runtime target locally under Wrangler/Miniflare (`~/.gemini/config/skills/cloudflare/references/{workers,wrangler,miniflare,static-assets}/`):
1. Build and preview via the pinned adapter (`pnpm build && pnpm preview`).
2. Verify in the Worker preview runtime:
   - App Router pages/layouts and Server Components render without Node-only runtime errors.
   - Route Handlers under `/api/v1/*` parse JSON with Zod and return `{ data, meta: { requestId } }`.
   - `HttpOnly`, `SameSite=Lax` session cookies set, survive requests, and clear on logout.
   - Request-scoped `env.DB` executes `.prepare().bind().all()/.first()/.run()` and `env.STORAGE` puts/gets a private R2 object.
3. **Fallback rule:** Validate `vinext` first. Only if a required Next.js feature fails on Workers, evaluate `OpenNext`, document the incompatibility and trade-off as an ADR update, and record the pinned adapter versions.

---

## 4. Wrangler D1 SQL Migrations & DDL Verification

1. Verify `wrangler.toml` defines `[[d1_databases]]` with `binding = "DB"` and `migrations_dir = "migrations"`.
2. Verify all schema migrations live under `migrations/*.sql` (numbered `0001_*.sql`, `0002_*.sql`, ...) and that **no seed/test SQL files live inside `migrations/`** (Wrangler tracks all `migrations/*.sql` in `d1_migrations`).
3. Manually inspect every SQL file under `migrations/*.sql`:
   - Pure SQLite syntax only (`TEXT`, `INTEGER`, `REAL` only for non-money exam marks).
   - Every monetary column is `INTEGER NOT NULL` in paise (`*_paise`).
   - Boolean columns are `INTEGER NOT NULL DEFAULT 0|1`.
   - Required uniqueness and collision constraints exist: `users(phone_normalized)`, `students(admission_number)`, `enrollments(student_id, academic_session_id)`, `attendance_days(academic_session_id, class_id, attendance_date)`, `period_attendance_registers(academic_session_id, class_id, subject_id, attendance_date, period_number)`, `timetable_slots` class and teacher collision keys, `invoices(student_id, billing_month, billing_year, invoice_type)`, `receipts(payment_id)`.
   - Historical academic/financial FKs use `ON DELETE RESTRICT` or `SET NULL`, never destructive `ON DELETE CASCADE`.
   - Deployed migrations remain immutable; schema fixes use a new numbered migration created via `wrangler d1 migrations create`.

---

## 5. Clean Local D1 Migration, FK & Synthetic Seed Test

Prove migrations work from an empty local SQLite state (`.wrangler/state/v3/d1`):
1. Clear local D1 state, then apply committed migrations cleanly with Wrangler:
   ```bash
   rm -rf .wrangler/state/v3/d1
   pnpm exec wrangler d1 migrations apply sms-coaching-d1 --local
   pnpm exec wrangler d1 migrations list sms-coaching-d1 --local
   ```
2. Verify foreign-key enforcement (`PRAGMA foreign_keys = ON;`) rejects an insert referencing a non-existent parent row:
   ```bash
   pnpm exec wrangler d1 execute sms-coaching-d1 --local --command="PRAGMA foreign_keys = ON; PRAGMA foreign_keys;"
   ```
3. Load synthetic seed data from outside `migrations/` (e.g. `seeds/seed.sql` — never real student PII):
   ```bash
   pnpm exec wrangler d1 execute sms-coaching-d1 --local --file=./seeds/seed.sql
   ```
4. Verify seeded roles (`SUPER_ADMIN`, `COACHING_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`), sample `enrollments`, and run `EXPLAIN QUERY PLAN` via `wrangler d1 execute --local` on student roster, daily attendance, and outstanding invoice queries to confirm index usage (`USING INDEX` / `SEARCH`, avoiding full table scans).

---

## 6. Financial `env.DB.batch()` Rollback & Duplicate-Submission Tests

Run integration tests against local D1 proving financial atomicity via `env.DB.batch([...])`:
1. **Atomic rollback proof:** Trigger a failure in the final statement of a multi-statement `env.DB.batch([...])` (e.g., inserting into `payments` + `payment_allocations` + `receipts` + updating `invoices.status` where `receipts.receipt_number` collides or an FK fails). Assert **zero** committed rows in `payments`, `payment_allocations`, `receipts`, and unchanged `invoices.status`.
2. **Duplicate submission prevention:**
   - Re-generating the same `(student_id, billing_month, billing_year, invoice_type)` catches `UNIQUE constraint failed` and returns `409 Conflict` without creating duplicate invoices/items.
   - Duplicate `receipt_number` or concurrent duplicate payment submission rejects cleanly without double allocation.
3. **Integer paise & balance invariants:**
   - Reject negative, zero, or non-integer `amountPaise` values at Zod boundaries.
   - Reject allocations where `SUM(allocated_amount_paise) > amount_paid_paise` or exceeding invoice outstanding balance.
   - Verify transitions: `UNPAID` -> `PARTIALLY_PAID` -> `PAID`, and derived `OVERDUE` when `outstanding > 0 && today > due_date`.

---

## 7. WhatsApp OTP Security & Throttling Tests

Verify `/api/v1/auth/otp/request`, `/api/v1/auth/otp/verify`, and `/api/v1/auth/logout`:
1. **Storage & logging:** `otp_challenges.otp_hash` stores a hash (never plaintext); logs contain zero OTP codes or session tokens.
2. **Anti-enumeration:** Unregistered phone returns the identical generic `200` message and status as a registered phone.
3. **Expiry:** OTP past 5 minutes (`expires_at`) fails verification.
4. **Replay:** Once verified (`consumed_at` set), re-submitting the same OTP fails.
5. **Attempt limit:** After 3 failed guesses (`attempts >= 3`), the 4th attempt is rejected even with the correct code.
6. **Throttling:** Resending within 60 seconds for the same phone is rejected/cooldown-enforced; >5 requests/hour from one IP is throttled (`429`).
7. **Session revocation:** Logout marks `sessions.revoked_at` and clears the `HttpOnly` cookie; subsequent requests with the old cookie return `401`.

---

## 8. Server-Side RBAC & R2 Isolation Tests

Test every boundary directly against Route Handlers / services (never rely on UI-only checks):
1. **Parent isolation (`parent_students`):**
   - Parent A querying an unlinked Student B (or `verification_status != 'VERIFIED'`) receives `403 Forbidden`.
   - Parent calling `POST /api/v1/payments`, `POST /api/v1/invoices/generate`, or any write route receives `403 Forbidden`.
2. **Teacher assignment scoping (`teacher_assignments`):**
   - `REGULAR_TEACHER` attempting to mark `attendance_days` (reserved for `CLASS_TEACHER` / Admin) receives `403 Forbidden`.
   - Teacher querying/marking unassigned classes, subjects, or non-assigned students' fees receives `403 Forbidden`.
   - Teacher calling `POST /api/v1/invoices/generate` or `POST /api/v1/payments` receives `403 Forbidden`.
3. **Student isolation & fee wall:**
   - Student querying another student's profile, attendance, or results receives `403 Forbidden`.
   - Student calling any `/api/v1/finance/*` route or fee endpoint receives `403 Forbidden`.
4. **R2 upload/download authorization:**
   - Reject unsupported MIME types, >5 MB files, and `..` / `/` key paths.
   - Verify unauthenticated or unauthorized users get `401`/`403` when requesting another student's `file_objects` R2 asset.

---

## 9. Final Verification & Human-Review Gate

Run after the final edit:
```bash
pnpm lint && pnpm test && pnpm build
```
Stop and request explicit human review before merging or deploying changes touching authentication, RBAC permissions, financial calculations/`env.DB.batch()` mutations, data deletion, production D1 migrations, or Wrangler secrets.
