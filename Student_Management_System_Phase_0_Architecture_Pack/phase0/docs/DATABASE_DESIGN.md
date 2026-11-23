# Database Design Plan — Cloudflare D1 + Drizzle

## 1. Database conventions

- Database: Cloudflare D1 (SQLite).
- ORM: Drizzle ORM.
- IDs: application-generated UUID strings (or another single consistent opaque ID strategy).
- Timestamps: UTC ISO-8601 strings or integer epoch values; choose one convention in the schema spike and use it consistently.
- Calendar dates: ISO `YYYY-MM-DD` strings for dates such as admission date, attendance date and invoice due date.
- Money: integer paise (`amount_paise INTEGER`).
- Boolean: SQLite integer boolean (`0` / `1`) through Drizzle boolean mapping.
- Statuses: constrained text values, validated in Zod and protected with database CHECK constraints where practical.
- Deletion: prefer status/archive fields for historical business records; do not cascade-delete academic or financial history.
- Foreign keys: enable and verify foreign-key enforcement in local and production D1 configuration.
- Unique constraints: enforce admission number, session name/code where appropriate, invoice number, receipt number and relevant natural keys.
- Every table should have a documented owner module.

## 2. Entity catalogue

### Identity and access
- `users`: login identity, normalized phone number, account status and timestamps.
- `roles`: system role definitions.
- `user_roles`: user-to-role assignments.
- `otp_challenges`: phone, OTP hash, expiry, attempts, consumed timestamp and delivery status.
- `sessions`: hashed session token, user, expiry, revocation and device metadata.
- `parent_profiles`: guardian-specific profile fields.
- `parent_students`: many-to-many parent/guardian to student relationship, relationship type and verification status.

### Student and academic
- `students`: permanent student identity, unique admission number, personal/contact fields and lifecycle status.
- `academic_sessions`: academic year/session name, start/end dates and status.
- `classes`: class/grade definitions.
- `subjects`: subject definitions.
- `class_subjects`: subjects offered for a class in an academic session.
- `enrollments`: student, academic session, class, roll number, start/end dates and enrollment status.
- `student_guardian_contacts`: optional non-login emergency/guardian contact records if needed separately from portal accounts.

### Teacher
- `teacher_profiles`: qualification, specialization, joining date and employment status.
- `teacher_assignments`: teacher, academic session, class, subject, responsibility category, validity dates and permissions/scope.

### Attendance and performance
- `attendance_days`: one class/date attendance register for daily attendance.
- `daily_attendance_records`: one student status per daily register.
- `class_periods` or `timetable_slots`: scheduled teaching session definitions.
- `period_attendance_registers`: class/subject/date/period register.
- `period_attendance_records`: one student status per period register.
- `performance_records`: student, teacher, session, class, optional subject, date, category, optional score and remarks.

### Examination
- `examinations`: name, type, academic session, dates and status.
- `exam_subjects`: examination, class/subject and maximum/passing marks.
- `exam_marks`: student enrollment, exam subject, obtained marks, absent/exempt status and entered-by metadata.
- `grading_scales`: configurable grade boundaries and pass rules, versioned/effective-dated if required.

### Timetable
- `rooms`: optional classroom/room definitions.
- `timetable_slots`: session, class, day, start/end, subject, teacher and optional room.
- Consider conflict uniqueness/indexes for teacher, class and room/time ranges; application-level conflict validation is still required.

### Finance
- `fee_components`: Coaching, Mess and Other Charges.
- `fee_structures`: standard course/class/session fee definitions and effective dates.
- `student_fee_assignments`: student enrollment-specific overrides/concessions and effective dates.
- `invoices`: student/enrollment, invoice number, billing period, issue date, due date, currency and immutable totals/status snapshot.
- `invoice_items`: invoice, component, description, quantity, unit amount and line total snapshots.
- `payments`: received amount, method, reference, received date, recorded-by and status.
- `payment_allocations`: payment-to-invoice allocation amount.
- `receipts`: receipt number and payment reference/snapshot.
- Optional future entities: `credit_notes`, `payment_reversals`, `discount_rules`, `fee_adjustments`.

### Audit and storage
- `audit_logs`: actor, action, entity type/id, timestamp, request ID and redacted before/after summary.
- `file_objects`: R2 key, owner, category, MIME type, size, checksum and status.

## 3. Critical relationships and constraints

- `users` 1:many `user_roles`.
- `users` 1:1 optional `teacher_profiles` or `parent_profiles`; student account linkage should be explicit if students have login accounts.
- `parents` many:many `students` through `parent_students`.
- `students` 1:many `enrollments`.
- `academic_sessions` 1:many `enrollments`.
- `classes` 1:many `enrollments`.
- `teachers` 1:many `teacher_assignments`.
- `teacher_assignments` scope teacher access to class/subject/session.
- Attendance records reference an enrollment or a student plus the exact session/class context; prefer enrollment references to prevent ambiguity.
- Exam marks reference a specific exam subject and student enrollment.
- Invoice references the enrollment/session and stores immutable billing snapshots.
- Payment allocations connect payments to invoices; total allocations must not exceed the payment amount unless a deliberate credit/unallocated balance design is approved.
- Prevent duplicate attendance records for the same student/register.
- Prevent duplicate marks for the same student/exam subject.
- Prevent duplicate invoice number within the institution.
- Do not physically delete payments, invoices, exam results or attendance history through normal UI workflows.

## 4. Attendance modeling decision

Daily and period-wise attendance must not be stored in one ambiguous row type.

Daily register unique key: `(class_id, attendance_date, academic_session_id, mode)` or equivalent, with one student record per register.

Period register unique key: `(timetable_slot_id, attendance_date)` or a stable scheduled-period identifier, with one student record per register.

**OPEN:** confirm whether daily and period-wise attendance can both be entered for the same class/date and define which report is authoritative for overall attendance percentage.

## 5. Finance modeling rules

- Invoice totals are snapshots; never recalculate a historical invoice from today's fee structure.
- Invoice item stores component label/description and amount snapshot.
- Payment is a receipt of money, not an invoice status.
- Payment allocation maps money received to one or more invoices.
- Outstanding = invoice total - valid allocations applied to that invoice, adjusted only through approved credit/reversal workflows.
- Overdue is derived when due date has passed and outstanding is greater than zero.
- Partial payments are supported.
- Payment method values initially: CASH, UPI, BANK_TRANSFER.
- Store external UPI/bank reference as text, not as a payment gateway assumption.
- Use integer paise and explicit currency code (`INR`).
- Payment correction should use a reversal/void workflow with audit history, not destructive deletion.

**OPEN:** refunds, overpayments, unallocated credits, discounts, concessions, late fines and receipt numbering policy.

## 6. Indexing plan

At minimum evaluate indexes for:
- `users.phone_normalized` (unique where appropriate)
- `students.admission_number` (unique)
- `enrollments(student_id, academic_session_id)`
- `enrollments(class_id, academic_session_id, status)`
- `teacher_assignments(teacher_id, academic_session_id, class_id)`
- Attendance register date/class/session and attendance record register/student
- `exam_marks(exam_subject_id, enrollment_id)` unique
- `invoices(student_id, billing_period, status)`
- `invoices(due_date, status)`
- `payments(student_id, received_at)`
- `payment_allocations(invoice_id, payment_id)`
- `audit_logs(entity_type, entity_id, created_at)`
- `file_objects(owner_type, owner_id, category)`

Use EXPLAIN QUERY PLAN and representative data to validate indexes. Avoid adding every possible index because indexes increase write cost and storage.

## 7. Migration strategy

1. Define tables and relations in Drizzle schema.
2. Generate SQL migration files with Drizzle Kit.
3. Review generated SQL manually.
4. Apply to local D1 using Wrangler.
5. Run migration tests and seed synthetic data.
6. Apply to staging D1.
7. Verify application behavior and data integrity.
8. Apply to production through a controlled release.
9. Never edit a migration already applied to shared/staging/production environments; create a follow-up migration.
10. Keep a documented rollback/forward-fix plan. SQLite schema rollback may require careful table rebuilds.

## 8. JavaScript compatibility gate

Drizzle ORM is often documented with TypeScript examples. The project decision is JavaScript. During Phase 1, prove that the pinned Drizzle ORM/Kit versions can load the chosen `.js` schema and configuration. If a tooling-only TypeScript config is unavoidable, obtain explicit team approval and document the narrow exception before adding it. Application code remains JavaScript.

## 9. Database design sign-off required

Before final schema implementation, approve:
- Student account/profile relationship.
- Whether a parent may have multiple separate guardian accounts per student.
- Session and promotion lifecycle.
- Attendance register model and percentage rules.
- Exam grading and absent/exempt representation.
- Fee discounts, refunds, reversals and unallocated payments.
- Invoice/receipt numbering.
- Data retention and archival.
