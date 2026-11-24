# SQL DDL Blueprint — Cloudflare D1 Physical Schema & Seed Reference

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**Target Engine:** Cloudflare D1 (SQLite 3.x)  
**Data Access:** Direct Workers `env.DB` Bindings (`prepare().bind()`, `env.DB.batch([...])`) — Zero ORM  
**Canonical Schema Migration:** [0001_initial_schema.sql](file:///home/atanu/Desktop/student-management/migrations/0001_initial_schema.sql)  
**Synthetic Development Seed:** [seed.sql](file:///home/atanu/Desktop/student-management/seeds/seed.sql)

---

## 1. Physical D1 Design Principles

This blueprint documents the physical SQLite DDL implementing all **36 tables** specified in [DATABASE_SCHEMA.md](file:///home/atanu/Desktop/student-management/docs/DATABASE_SCHEMA.md) plus the Phase 0 configuration tables (`grading_scales`, `rooms`) from `Student_Management_System_Phase_0_Architecture_Pack/phase0/docs/DATABASE_DESIGN.md`.

1. **Zero ORM & Pure SQLite Syntax:** Every DDL file under `migrations/*.sql` uses standard SQLite types (`TEXT`, `INTEGER`, `REAL` strictly for non-money academic scores/percentages). PostgreSQL types (`SERIAL`, `JSONB`, `TIMESTAMPTZ`, `UUID`, `BOOLEAN`) are forbidden.
2. **Wrangler D1 Transaction Rules:** Never place `BEGIN TRANSACTION;` or `COMMIT;` inside `migrations/*.sql` or `seeds/*.sql`; Wrangler D1 manages migration transactions automatically, and runtime multi-statement writes execute atomically via `env.DB.batch([...])`.
3. **Foreign-Key Enforcement:** `PRAGMA foreign_keys = ON;` is declared at the top of `migrations/0001_initial_schema.sql` and `seeds/seed.sql`, and verified in integration tests and repository connections.
4. **Historical Record Preservation:** Academic and financial ledger records (`enrollments`, `attendance_days`, `daily_attendance_records`, `period_attendance_registers`, `period_attendance_records`, `performance_records`, `examinations`, `exam_subjects`, `exam_marks`, `invoices`, `invoice_items`, `payments`, `payment_allocations`, `receipts`, `student_fee_assignments`) use `ON DELETE RESTRICT` or `ON DELETE SET NULL` — never destructive `ON DELETE CASCADE`.
5. **Integer Paise Money:** Every monetary column uses `*_paise INTEGER NOT NULL` (`1 INR = 100 paise`) with non-negative or strictly positive `CHECK` constraints. Floating-point money is forbidden.
6. **Integer Booleans:** Every boolean flag is `INTEGER NOT NULL DEFAULT 0|1` with `CHECK (<col> IN (0, 1))`. Repositories must bind `1` or `0`, never JS `true`/`false`.
7. **UUID v4 & ISO-8601 Strings:** Primary keys are application-generated RFC 4122 UUID v4 `TEXT` values. Timestamps are UTC ISO-8601 strings (`YYYY-MM-DDTHH:MM:SS.sssZ`), calendar dates are `YYYY-MM-DD`, and timetable times are `HH:MM`.
8. **R2 Binary Separation:** Binary files (photos, PDFs) live in private Cloudflare R2 (`env.STORAGE`); D1 `file_objects` stores validated metadata only (`<= 5 MB`), keeping D1 rows far below the 1 MB row limit.

---

## 2. Complete 36-Table Inventory & Module Ownership

| # | Table | Domain / Owner Module | Primary Key | Historical FK Policy |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `users` | `users` / `auth` | `id` (UUID v4) | Account deactivation via `is_active = 0` |
| 2 | `roles` | `users` | `id` (UUID v4) | Static RBAC role lookup |
| 3 | `user_roles` | `users` | `id` (UUID v4) | `user_id` CASCADE, `role_id` RESTRICT |
| 4 | `otp_challenges` | `auth` | `id` (UUID v4) | Ephemeral OTP hashes + IP/phone throttling |
| 5 | `sessions` | `auth` | `id` (UUID v4) | `user_id` CASCADE (`revoked_at` preferred) |
| 6 | `file_objects` | `storage` | `id` (UUID v4) | `uploaded_by_user_id` SET NULL |
| 7 | `students` | `students` | `id` (UUID v4) | `user_id` SET NULL, `photo_file_id` SET NULL |
| 8 | `parent_profiles` | `parents` | `id` (UUID v4) | `user_id` RESTRICT |
| 9 | `parent_students` | `parents` | `id` (UUID v4) | `parent_profile_id` / `student_id` RESTRICT |
| 10 | `academic_sessions` | `academics` | `id` (UUID v4) | Single active session partial unique index |
| 11 | `classes` | `academics` | `id` (UUID v4) | Handles nullable `section` uniqueness |
| 12 | `subjects` | `academics` | `id` (UUID v4) | Master subject catalog (`code` unique) |
| 13 | `class_subjects` | `academics` | `id` (UUID v4) | All FKs RESTRICT |
| 14 | `enrollments` | `academics` | `id` (UUID v4) | All FKs RESTRICT (session history preserved) |
| 15 | `teacher_profiles` | `teachers` | `id` (UUID v4) | `user_id` RESTRICT, `photo_file_id` SET NULL |
| 16 | `teacher_assignments` | `teachers` | `id` (UUID v4) | All FKs RESTRICT |
| 17 | `attendance_days` | `attendance` | `id` (UUID v4) | Session/Class RESTRICT, marker SET NULL |
| 18 | `daily_attendance_records` | `attendance` | `id` (UUID v4) | Register/Enrollment RESTRICT |
| 19 | `period_attendance_registers` | `attendance` | `id` (UUID v4) | Session/Class/Subject RESTRICT, marker SET NULL |
| 20 | `period_attendance_records` | `attendance` | `id` (UUID v4) | Register/Enrollment RESTRICT |
| 21 | `performance_records` | `performance` | `id` (UUID v4) | Enrollment/Teacher/Subject RESTRICT |
| 22 | `examinations` | `examinations` | `id` (UUID v4) | `academic_session_id` RESTRICT |
| 23 | `exam_subjects` | `examinations` | `id` (UUID v4) | Exam/Class/Subject RESTRICT |
| 24 | `exam_marks` | `examinations` | `id` (UUID v4) | ExamSubject/Enrollment RESTRICT, marker SET NULL |
| 25 | `grading_scales` | `examinations` | `id` (UUID v4) | `academic_session_id` RESTRICT (OPEN #9) |
| 26 | `rooms` | `timetable` | `id` (UUID v4) | Classroom catalog (conflict rule OPEN) |
| 27 | `timetable_slots` | `timetable` | `id` (UUID v4) | Core FKs RESTRICT, `room_id` SET NULL |
| 28 | `fee_components` | `finance` | `id` (UUID v4) | `COACHING`, `MESS`, `OTHER` |
| 29 | `fee_structures` | `finance` | `id` (UUID v4) | Session/Class/Component RESTRICT |
| 30 | `student_fee_assignments` | `finance` | `id` (UUID v4) | Enrollment/Component RESTRICT |
| 31 | `invoices` | `finance` | `id` (UUID v4) | Student/Enrollment RESTRICT |
| 32 | `invoice_items` | `finance` | `id` (UUID v4) | Invoice/Component RESTRICT (immutable snapshot) |
| 33 | `payments` | `finance` | `id` (UUID v4) | Student RESTRICT, recorder SET NULL |
| 34 | `payment_allocations` | `finance` | `id` (UUID v4) | Payment/Invoice RESTRICT |
| 35 | `receipts` | `finance` | `id` (UUID v4) | Payment RESTRICT (1:1) |
| 36 | `audit_logs` | `audit` | `id` (UUID v4) | `actor_user_id` SET NULL |

---

## 3. Domain-by-Domain Schema Details & Constraints

### 3.1 Identity, Authentication & R2 File Metadata
* **`users`**: Enforces `phone_normalized LIKE '+%'` (E.164) and uniqueness. Nullable `email` enforces uniqueness for non-null rows via partial index `idx_users_email_unique` and rejects blank strings.
* **`roles` & `user_roles`**: Restricts `roles.name` to `('SUPER_ADMIN', 'COACHING_ADMIN', 'TEACHER', 'STUDENT', 'PARENT')`. `user_roles` guarantees `(user_id, role_id)` uniqueness.
* **`otp_challenges`**: Persists `otp_hash` (never plaintext), `expires_at`, `attempts >= 0`, `consumed_at`, `delivery_status IN ('PENDING', 'DELIVERED', 'FAILED')`, and nullable `request_ip` so D1 can enforce the 60-second phone cooldown (`idx_otp_challenges_phone_created`) and 5/hour per-IP rate limit (`idx_otp_challenges_ip_created`) across stateless Workers isolates.
* **`sessions`**: Persists `token_hash` (`UNIQUE`), `expires_at`, `revoked_at`, `user_agent`, and `ip_address`. Active session checks filter `revoked_at IS NULL` via `idx_sessions_user_active`.
* **`file_objects`**: Placed prior to `students` and `teacher_profiles` in DDL dependency order. Rejects path traversal (`r2_object_key NOT LIKE '/%' AND instr(r2_object_key, '..') = 0`), enforces allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), caps `size_bytes` at `5242880` (5 MB), and supports optional `(owner_entity_type, owner_entity_id)` scoping for `DOCUMENT` uploads.

### 3.2 Students, Parents & Academic Life-Cycle
* **`students`**: Permanent student record keyed by `admission_number` (`UNIQUE`), `gender IN ('Male', 'Female', 'Other')`, `lifecycle_status IN ('ACTIVE', 'INACTIVE', 'ALUMNI', 'LEFT')`, and optional `user_id` (`UNIQUE`, `ON DELETE SET NULL`).
* **`parent_profiles` & `parent_students`**: Supports multi-child families via `UNIQUE (parent_profile_id, student_id)`. Server-side parent RBAC queries filter `parent_profile_id = ? AND verification_status = 'VERIFIED'` backed by `idx_parent_students_parent_verified`.
* **`academic_sessions`**: `CHECK (end_date >= start_date)` plus partial unique index `idx_academic_sessions_single_active` (`WHERE is_active = 1`) guaranteeing at most one active session at a time. Rollovers must deactivate the old session and activate the new session inside a single `env.DB.batch([...])`.
* **`classes`, `subjects`, `class_subjects`**: Because SQLite treats `NULL` values as distinct inside `UNIQUE (name, section)`, `idx_classes_name_no_section` (`WHERE section IS NULL`) prevents duplicate sectionless classes with the same `name`.
* **`enrollments`**: `UNIQUE (student_id, academic_session_id)` preserves historical class placement (`ACTIVE`, `PROMOTED`, `REPEATED`, `TRANSFERRED`, `LEFT`) across sessions.

### 3.3 Teachers & Scoped Assignments
* **`teacher_profiles`**: Linked `1:1` to `users(id)` (`ON DELETE RESTRICT`), with unique `employee_code` and `employment_status IN ('ACTIVE', 'INACTIVE', 'LEFT')`.
* **`teacher_assignments`**: Encodes `responsibility_category IN ('REGULAR_TEACHER', 'CLASS_TEACHER')` per `(teacher_profile_id, academic_session_id, class_id, subject_id)` rather than on `teacher_profiles`.

### 3.4 Dual Attendance Registers & Daily Performance
* **`attendance_days` & `daily_attendance_records`**: Official institutional register marked by `CLASS_TEACHER` or Admin. Unique on `(academic_session_id, class_id, attendance_date)` and `(attendance_day_id, enrollment_id)`. Sole source for official attendance percentages.
* **`period_attendance_registers` & `period_attendance_records`**: Subject-period register marked by `REGULAR_TEACHER`. Unique on `(academic_session_id, class_id, subject_id, attendance_date, period_number)` and `(register_id, enrollment_id)`. Includes `is_locked` (`0`/`1`) for post-24h lock enforcement.
* **`performance_records`**: Links `enrollment_id`, `teacher_profile_id`, optional `subject_id`, `category IN ('CLASS_TEST', 'HOMEWORK', 'CLASSWORK', 'GENERAL')`, and `CHECK (marks_obtained IS NULL OR max_marks IS NULL OR marks_obtained <= max_marks)`.

### 3.5 Examinations, Marks & Grading Scales
* **`examinations`**: `exam_type IN ('UNIT_TEST', 'MONTHLY_TEST', 'HALF_YEARLY', 'FINAL')`, `CHECK (end_date >= start_date)`, and `is_published` (`0`/`1`).
* **`exam_subjects`**: `UNIQUE (examination_id, class_id, subject_id)` with `max_marks > 0` and `0 <= passing_marks <= max_marks`.
* **`exam_marks`**: `UNIQUE (exam_subject_id, enrollment_id)` with `is_absent` (`0`/`1`) and nullable `marks_obtained >= 0`.
* **`grading_scales`**: Stores grade band rules (`grade_label`, `min_percentage`, `max_percentage`, optional `grade_point`, `is_passing`, `effective_from`, `is_active`, optional `academic_session_id`) with `UNIQUE (name, grade_label, effective_from)`.

### 3.6 Rooms & Timetable
* **`rooms`**: Optional room master (`name` unique, `code` unique, `capacity > 0`, `is_active` `0`/`1`).
* **`timetable_slots`**: Enforces `day_of_week BETWEEN 1 AND 7`, `period_number >= 1`, `end_time > start_time`, class collision uniqueness `(academic_session_id, class_id, day_of_week, period_number)`, and teacher collision uniqueness `(academic_session_id, teacher_profile_id, day_of_week, period_number)`. Optional `room_id` (`ON DELETE SET NULL`) is indexed via `idx_timetable_slots_room_slot` for room-conflict queries/warnings.

### 3.7 Finance Ledger (Integer Paise) & Atomic `env.DB.batch([...])`
* **`fee_components`**: Constrained to `('COACHING', 'MESS', 'OTHER')`.
* **`fee_structures`**: `UNIQUE (academic_session_id, class_id, fee_component_id)` with `default_amount_paise >= 0`.
* **`student_fee_assignments`**: Enrollment-specific override `UNIQUE (enrollment_id, fee_component_id)` with `custom_amount_paise >= 0`.
* **`invoices` & `invoice_items`**: Enforces `billing_month BETWEEN 1 AND 12`, `invoice_type IN ('COMBINED', 'SEPARATE_COACHING', 'SEPARATE_MESS')`, `status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID')`, and `UNIQUE (student_id, billing_month, billing_year, invoice_type)` to prevent duplicate monthly generation. `invoice_items` preserves an immutable snapshot at generation time.
* **`payments`, `payment_allocations` & `receipts`**:
  * `payments.amount_paid_paise > 0` and `payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER')`.
  * `payment_allocations.allocated_amount_paise > 0` and `UNIQUE (payment_id, invoice_id)`.
  * `receipts` enforces `1:1` linkage via `payment_id UNIQUE` and `receipt_number UNIQUE`.
  * Service layer guarantees $\sum \text{allocated\_amount\_paise} \le \text{amount\_paid\_paise}$ and executes invoice/item inserts or payment/allocation/receipt/invoice-status updates in a single atomic `env.DB.batch([...])`.

### 3.8 Audit Logs
* **`audit_logs`**: Records `actor_user_id` (`ON DELETE SET NULL`), `action IN ('CREATE', 'UPDATE', 'DELETE', 'CORRECTION', 'ALLOCATION', 'REVERSAL', 'REVOKE', 'UNLINK')`, `entity_type`, `entity_id`, JSON `old_values`/`new_values`, `ip_address`, `request_id`, and `created_at`.

---

## 4. Index Strategy & `EXPLAIN QUERY PLAN` Hot Paths

`migrations/0001_initial_schema.sql` defines **50 explicit indexes** (47 lookup/composite/partial indexes + 3 partial unique indexes) in addition to **72 SQLite autoindexes** generated for `TEXT PRIMARY KEY` and inline `UNIQUE` constraints.

Key hot-path indexes verified via `EXPLAIN QUERY PLAN`:
1. **Student Roster (`idx_enrollments_session_class_status`):**
   `enrollments(academic_session_id, class_id, enrollment_status, roll_number)` supports filtered class rosters ordered by `roll_number` via `SEARCH e USING INDEX idx_enrollments_session_class_status` without full table scans.
2. **Daily Attendance Lookup (`sqlite_autoindex_attendance_days_2` + `idx_daily_attendance_enrollment_status`):**
   Register lookup by `(academic_session_id, class_id, attendance_date)` resolves via `SEARCH attendance_days USING INDEX sqlite_autoindex_attendance_days_2`; student monthly attendance history resolves via `idx_daily_attendance_enrollment_status`.
3. **Outstanding & Overdue Invoices (`idx_invoices_student_status_due` + `idx_invoices_due_date`):**
   Student fee summaries use `idx_invoices_student_status_due`; institutional overdue defaulters reports use the partial index `idx_invoices_due_date ON invoices(due_date) WHERE status != 'PAID'` (`SEARCH invoices USING INDEX idx_invoices_due_date`).
4. **Parent & Teacher RBAC Scoping:**
   - Parent verification check resolves via `SEARCH parent_students USING INDEX sqlite_autoindex_parent_students_2` (`idx_parent_students_parent_verified` additionally supports parent-level `VERIFIED` list queries).
   - Teacher scoping resolves via `SEARCH teacher_assignments USING COVERING INDEX sqlite_autoindex_teacher_assignments_2` (`idx_teacher_assignments_teacher_session` additionally supports category-filtered queries).
5. **OTP Rate Limiting & Cooldowns:**
   - Phone cooldown uses `idx_otp_challenges_phone_created(phone_normalized, created_at)`.
   - IP hourly rate limiting uses `idx_otp_challenges_ip_created(request_ip, created_at) WHERE request_ip IS NOT NULL`.

---

## 5. Alignment with the 15 OPEN Decisions

Schema support is in place without prematurely hard-coding unresolved stakeholder policies (see [BUSINESS_RULES_AND_LOGIC.md](file:///home/atanu/Desktop/student-management/docs/BUSINESS_RULES_AND_LOGIC.md) Section 8):
* **OPEN #1 (`SUPER_ADMIN` vs `COACHING_ADMIN`):** Both roles exist in `roles`; destructive deletion is blocked at DB level via `ON DELETE RESTRICT`.
* **OPEN #5 (Dual Parent Accounts):** `parent_students` is many-to-many with `is_primary` and `verification_status` so either single- or dual-parent policies can be configured without DDL rewrites.
* **OPEN #9 (Grading Scales & Report Cards):** `grading_scales` provides versioned, effective-dated percentage bands; exact cutoffs, rounding, and absent/exempt behavior remain **OPEN**.
* **OPEN #10 (Concessions, Fines, Reversals):** `student_fee_assignments` supports overrides, `audit_logs` includes `'REVERSAL'`, and `payment_allocations` supports partial payments, while refund/credit/late-fine rules remain **OPEN**.
* **OPEN #11 (Bulk Invoicing & Numbering):** `invoices(invoice_number)` and `receipts(receipt_number)` enforce uniqueness without baking in rigid prefix triggers before approval.
* **OPEN Timetable Room Conflicts:** `rooms` + `timetable_slots.room_id` use a non-unique lookup index (`idx_timetable_slots_room_slot`) so warning-only vs blocking conflict policies remain configurable.

---

## 6. Synthetic Development Seed (`seeds/seed.sql`)

`seeds/seed.sql` lives strictly outside `migrations/` so `wrangler d1 migrations apply --remote` never inserts test fixtures in production. All rows use deterministic RFC 4122 UUID v4 identifiers and `ON CONFLICT DO NOTHING` (preserving FK/CHECK failure reporting on re-runs).

### Seeded Demo Logins (`WHATSAPP_PROVIDER="MOCK"`)

| Role | Phone (`phone_normalized`) | Name | Scope / Notes |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | `+919999900001` | Ananya Verma | Full institutional access |
| `COACHING_ADMIN` | `+919999900002` | Rajesh Kulkarni | Admin & finance recording |
| `TEACHER` | `+919876500001` | Priya Nair | `CLASS_TEACHER` (Class 10-A, `SCI-10`), `REGULAR_TEACHER` (Class 9-A, `SCI-09`) |
| `TEACHER` | `+919876500002` | Vikram Mehta | `REGULAR_TEACHER` (Class 10-A, `MATH-10`), `CLASS_TEACHER` (Class 9-A, `MATH-09`) |
| `STUDENT` | `+919876510001` | Aarav Sharma | `ADM-2026-0001`; `2025-2026` `PROMOTED` (9-A), `2026-2027` `ACTIVE` (10-A) |
| `PARENT` | `+919876520001` | Sunita Sharma | `VERIFIED` multi-child links to Aarav Sharma (10-A) & Diya Sharma (9-A); unlinked peer Kabir Patel (10-A) exists for isolation testing |

### Seeded Academic & Financial Fixtures
* **Sessions:** `2025-2026` (`is_active = 0`) and `2026-2027` (`is_active = 1`).
* **Fee Components:** `COACHING`, `MESS`, `OTHER`.
* **Fee Structures (`2026-2027`):** Class 10-A (`150000` + `200000` + `10000` = `360000` paise / ₹3,600.00); Class 9-A (`120000` + `200000` + `10000` = `330000` paise / ₹3,300.00).
* **Override & Ledger:** Diya Sharma has a synthetic `COACHING` override (`100000` paise); November 2026 invoices cover all 3 statuses: `PAID` (`INV-202611-0001`, Aarav, `360000` paise via `UPI`, `REC-202611-0001`), `PARTIALLY_PAID` (`INV-202611-0002`, Kabir, `200000` of `360000` paise via `CASH`, `REC-202611-0002`), and `UNPAID` (`INV-202611-0003`, Diya, `310000` paise).

---

## 7. Local Wrangler & SQLite Verification Commands

```bash
# Apply migration from a clean local D1 database
npx wrangler d1 migrations apply sms-coaching-d1 --local

# Verify FK enforcement and schema tables
npx wrangler d1 execute sms-coaching-d1 --local --command="PRAGMA foreign_keys = ON; SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations';"

# Load synthetic development fixtures locally (NEVER use --remote)
npx wrangler d1 execute sms-coaching-d1 --local --file=./seeds/seed.sql
```
