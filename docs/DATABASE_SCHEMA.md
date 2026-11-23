# Database Schema & Data Models Specification

**Project:** Student Management System (Coaching Institute + Mess Fee Management)  
**Database Engine:** Cloudflare D1 (SQLite)  
**ORM:** Drizzle ORM (JavaScript)  
**Document Version:** 2.0 (Phase 0 Aligned)  

---

## 1. Database Conventions & SQLite Specifics

1. **Database:** Cloudflare D1 (SQLite). Strict adherence to SQLite types and limitations.
2. **Primary Keys:** Application-generated UUID v4 strings (`TEXT PRIMARY KEY`).
3. **Monetary Values:** **Integer Paise** (`INTEGER NOT NULL`). ₹1,500.00 is stored as `150000`. Floating-point values for money are strictly forbidden.
4. **Timestamps:** UTC ISO-8601 strings (`TEXT`) or Unix epoch milliseconds. Recommended: ISO-8601 strings (e.g., `2026-11-23T18:15:00.000Z`).
5. **Dates:** ISO-8601 calendar date strings `YYYY-MM-DD` (e.g., `2026-11-23`).
6. **Booleans:** SQLite integer booleans (`0` for false, `1` for true).
7. **Referential Integrity:** Foreign keys are explicitly defined and enabled in D1 configuration. No cascading deletions on historical academic or financial ledger records.
8. **Historical Immutability:** Student enrollment records, invoice snapshots, payment allocations, exam marks, and attendance registers preserve history across academic sessions.

---

## 2. Conceptual Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : assigned
    USERS ||--o| TEACHER_PROFILES : may_have
    USERS ||--o| PARENT_PROFILES : may_have
    PARENT_PROFILES ||--o{ PARENT_STUDENTS : links
    STUDENTS ||--o{ PARENT_STUDENTS : linked_to
    
    STUDENTS ||--o{ ENROLLMENTS : has
    ACADEMIC_SESSIONS ||--o{ ENROLLMENTS : contains
    CLASSES ||--o{ ENROLLMENTS : places
    
    ACADEMIC_SESSIONS ||--o{ CLASS_SUBJECTS : offers
    CLASSES ||--o{ CLASS_SUBJECTS : has
    SUBJECTS ||--o{ CLASS_SUBJECTS : included
    
    TEACHER_PROFILES ||--o{ TEACHER_ASSIGNMENTS : receives
    ACADEMIC_SESSIONS ||--o{ TEACHER_ASSIGNMENTS : scopes
    CLASSES ||--o{ TEACHER_ASSIGNMENTS : assigned
    SUBJECTS ||--o{ TEACHER_ASSIGNMENTS : teaches
    
    ATTENDANCE_DAYS ||--o{ DAILY_ATTENDANCE_RECORDS : contains
    ENROLLMENTS ||--o{ DAILY_ATTENDANCE_RECORDS : recorded_for
    
    PERIOD_ATTENDANCE_REGISTERS ||--o{ PERIOD_ATTENDANCE_RECORDS : contains
    ENROLLMENTS ||--o{ PERIOD_ATTENDANCE_RECORDS : recorded_for
    
    ENROLLMENTS ||--o{ PERFORMANCE_RECORDS : has
    TEACHER_PROFILES ||--o{ PERFORMANCE_RECORDS : evaluates
    
    ACADEMIC_SESSIONS ||--o{ EXAMINATIONS : schedules
    EXAMINATIONS ||--o{ EXAM_SUBJECTS : contains
    EXAM_SUBJECTS ||--o{ EXAM_MARKS : records
    ENROLLMENTS ||--o{ EXAM_MARKS : earns
    
    CLASSES ||--o{ TIMETABLE_SLOTS : schedules
    SUBJECTS ||--o{ TIMETABLE_SLOTS : covers
    TEACHER_PROFILES ||--o{ TIMETABLE_SLOTS : teaches
    
    ENROLLMENTS ||--o{ STUDENT_FEE_ASSIGNMENTS : has
    STUDENTS ||--o{ INVOICES : billed
    INVOICES ||--|{ INVOICE_ITEMS : contains
    STUDENTS ||--o{ PAYMENTS : makes
    PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : allocated
    INVOICES ||--o{ PAYMENT_ALLOCATIONS : receives
    PAYMENTS ||--o| RECEIPTS : documented
    
    USERS ||--o{ AUDIT_LOGS : performs
    USERS ||--o{ FILE_OBJECTS : owns
```

---

## 3. Entity Catalogue & Table Specifications

### 3.1 Identity, Users & WhatsApp Authentication

#### `users`
* `id`: `TEXT PRIMARY KEY` (UUID v4)
* `phone_normalized`: `TEXT NOT NULL UNIQUE` (e.g., `+919876543210`)
* `email`: `TEXT` (Nullable, unique where provided)
* `is_active`: `INTEGER NOT NULL DEFAULT 1`
* `created_at`: `TEXT NOT NULL`
* `updated_at`: `TEXT NOT NULL`

#### `roles`
* `id`: `TEXT PRIMARY KEY`
* `name`: `TEXT NOT NULL UNIQUE` (`SUPER_ADMIN`, `COACHING_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`)
* `description`: `TEXT`

#### `user_roles`
* `id`: `TEXT PRIMARY KEY`
* `user_id`: `TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
* `role_id`: `TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE`
* *Unique:* `(user_id, role_id)`

#### `otp_challenges`
* `id`: `TEXT PRIMARY KEY`
* `phone_normalized`: `TEXT NOT NULL`
* `otp_hash`: `TEXT NOT NULL` (Argon2 / SHA-256 hash of random 6-digit OTP)
* `expires_at`: `TEXT NOT NULL` (5-minute lifetime)
* `attempts`: `INTEGER NOT NULL DEFAULT 0` (Max 3 attempts)
* `consumed_at`: `TEXT` (Nullable; set on successful verification)
* `delivery_status`: `TEXT NOT NULL DEFAULT 'PENDING'` (`PENDING`, `DELIVERED`, `FAILED`)
* `created_at`: `TEXT NOT NULL`

#### `sessions`
* `id`: `TEXT PRIMARY KEY`
* `user_id`: `TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
* `token_hash`: `TEXT NOT NULL UNIQUE` (Hashed session identifier)
* `expires_at`: `TEXT NOT NULL` (e.g. 7-day rolling expiry)
* `revoked_at`: `TEXT` (Nullable)
* `user_agent`: `TEXT`
* `ip_address`: `TEXT`
* `created_at`: `TEXT NOT NULL`

---

### 3.2 Students, Parents & Academic Life-Cycle

#### `students`
Permanent institutional identity of the student.
* `id`: `TEXT PRIMARY KEY`
* `user_id`: `TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL` (Optional student portal login)
* `admission_number`: `TEXT NOT NULL UNIQUE` (e.g., `ADM-2026-0001`)
* `full_name`: `TEXT NOT NULL`
* `date_of_birth`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `gender`: `TEXT NOT NULL` (`Male`, `Female`, `Other`)
* `blood_group`: `TEXT`
* `photo_file_id`: `TEXT REFERENCES file_objects(id) ON DELETE SET NULL`
* `contact_phone`: `TEXT`
* `residential_address`: `TEXT`
* `emergency_contact_name`: `TEXT NOT NULL`
* `emergency_contact_phone`: `TEXT NOT NULL`
* `lifecycle_status`: `TEXT NOT NULL DEFAULT 'ACTIVE'` (`ACTIVE`, `INACTIVE`, `ALUMNI`, `LEFT`)
* `admission_date`: `TEXT NOT NULL`
* `created_at`: `TEXT NOT NULL`

#### `parent_profiles`
* `id`: `TEXT PRIMARY KEY`
* `user_id`: `TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`
* `full_name`: `TEXT NOT NULL`
* `phone_normalized`: `TEXT NOT NULL`
* `email`: `TEXT`
* `relationship_type`: `TEXT NOT NULL` (`Father`, `Mother`, `Guardian`)
* `created_at`: `TEXT NOT NULL`

#### `parent_students`
Many-to-many relationship supporting multi-child families.
* `id`: `TEXT PRIMARY KEY`
* `parent_profile_id`: `TEXT NOT NULL REFERENCES parent_profiles(id) ON DELETE CASCADE`
* `student_id`: `TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE`
* `is_primary`: `INTEGER NOT NULL DEFAULT 1`
* `verification_status`: `TEXT NOT NULL DEFAULT 'VERIFIED'` (`VERIFIED`, `PENDING`)
* *Unique:* `(parent_profile_id, student_id)`

#### `academic_sessions`
Represents an academic year or coaching batch session (e.g., "2026-2027").
* `id`: `TEXT PRIMARY KEY`
* `name`: `TEXT NOT NULL UNIQUE` (e.g., `2026-2027`)
* `start_date`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `end_date`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `is_active`: `INTEGER NOT NULL DEFAULT 0`
* `created_at`: `TEXT NOT NULL`

#### `classes`
* `id`: `TEXT PRIMARY KEY`
* `name`: `TEXT NOT NULL` (e.g., `Class 10`)
* `grade_level`: `INTEGER NOT NULL` (e.g., `10`)
* `section`: `TEXT` (e.g., `A`)
* *Unique:* `(name, section)`

#### `subjects`
* `id`: `TEXT PRIMARY KEY`
* `name`: `TEXT NOT NULL`
* `code`: `TEXT NOT NULL UNIQUE` (e.g., `MATH-10`)
* `created_at`: `TEXT NOT NULL`

#### `class_subjects`
Subjects offered for a class in a specific academic session.
* `id`: `TEXT PRIMARY KEY`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
* `subject_id`: `TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT`
* *Unique:* `(academic_session_id, class_id, subject_id)`

#### `enrollments`
Historical placement linking a student to a class for a specific academic session.
* `id`: `TEXT PRIMARY KEY`
* `student_id`: `TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT`
* `roll_number`: `TEXT`
* `enrollment_status`: `TEXT NOT NULL DEFAULT 'ACTIVE'` (`ACTIVE`, `PROMOTED`, `REPEATED`, `TRANSFERRED`, `LEFT`)
* `start_date`: `TEXT NOT NULL`
* `end_date`: `TEXT`
* *Unique:* `(student_id, academic_session_id)`

---

### 3.3 Teachers & Scoped Assignments

#### `teacher_profiles`
* `id`: `TEXT PRIMARY KEY`
* `user_id`: `TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`
* `employee_code`: `TEXT NOT NULL UNIQUE` (e.g., `TCH-001`)
* `full_name`: `TEXT NOT NULL`
* `qualification`: `TEXT`
* `specialization`: `TEXT`
* `joining_date`: `TEXT NOT NULL`
* `employment_status`: `TEXT NOT NULL DEFAULT 'ACTIVE'` (`ACTIVE`, `INACTIVE`, `LEFT`)
* `photo_file_id`: `TEXT REFERENCES file_objects(id) ON DELETE SET NULL`
* `created_at`: `TEXT NOT NULL`

#### `teacher_assignments`
Scopes a teacher's responsibilities to a class and subject for an academic session.
* `id`: `TEXT PRIMARY KEY`
* `teacher_profile_id`: `TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
* `subject_id`: `TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT`
* `responsibility_category`: `TEXT NOT NULL` (`REGULAR_TEACHER`, `CLASS_TEACHER`)
* *Unique:* `(teacher_profile_id, academic_session_id, class_id, subject_id, responsibility_category)`

---

### 3.4 Attendance & Daily Performance

#### `attendance_days` (Daily Institutional Register)
* `id`: `TEXT PRIMARY KEY`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
* `attendance_date`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `marked_by_teacher_id`: `TEXT REFERENCES teacher_profiles(id) ON DELETE SET NULL`
* `is_locked`: `INTEGER NOT NULL DEFAULT 0`
* `created_at`: `TEXT NOT NULL`
* *Unique:* `(academic_session_id, class_id, attendance_date)`

#### `daily_attendance_records`
* `id`: `TEXT PRIMARY KEY`
* `attendance_day_id`: `TEXT NOT NULL REFERENCES attendance_days(id) ON DELETE CASCADE`
* `enrollment_id`: `TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE`
* `status`: `TEXT NOT NULL` (`PRESENT`, `ABSENT`, `LATE`, `LEAVE`)
* `remarks`: `TEXT`
* `created_at`: `TEXT NOT NULL`
* *Unique:* `(attendance_day_id, enrollment_id)`

#### `period_attendance_registers` (Period-Wise Register)
* `id`: `TEXT PRIMARY KEY`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
* `subject_id`: `TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT`
* `attendance_date`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `period_number`: `INTEGER NOT NULL`
* `marked_by_teacher_id`: `TEXT REFERENCES teacher_profiles(id) ON DELETE SET NULL`
* `created_at`: `TEXT NOT NULL`
* *Unique:* `(academic_session_id, class_id, subject_id, attendance_date, period_number)`

#### `period_attendance_records`
* `id`: `TEXT PRIMARY KEY`
* `register_id`: `TEXT NOT NULL REFERENCES period_attendance_registers(id) ON DELETE CASCADE`
* `enrollment_id`: `TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE`
* `status`: `TEXT NOT NULL` (`PRESENT`, `ABSENT`, `LATE`, `LEAVE`)
* `remarks`: `TEXT`
* *Unique:* `(register_id, enrollment_id)`

#### `performance_records` (Daily Class Tests, Homework, Remarks)
* `id`: `TEXT PRIMARY KEY`
* `enrollment_id`: `TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE`
* `teacher_profile_id`: `TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT`
* `subject_id`: `TEXT REFERENCES subjects(id) ON DELETE RESTRICT`
* `evaluation_date`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `category`: `TEXT NOT NULL` (`CLASS_TEST`, `HOMEWORK`, `CLASSWORK`, `GENERAL`)
* `marks_obtained`: `REAL` (Optional numeric score)
* `max_marks`: `REAL` (Optional maximum score)
* `remarks`: `TEXT NOT NULL`
* `created_at`: `TEXT NOT NULL`

---

### 3.5 Examinations & Results

#### `examinations`
* `id`: `TEXT PRIMARY KEY`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT`
* `name`: `TEXT NOT NULL` (e.g., `Half-Yearly Examination 2026`)
* `exam_type`: `TEXT NOT NULL` (`UNIT_TEST`, `MONTHLY_TEST`, `HALF_YEARLY`, `FINAL`)
* `start_date`: `TEXT NOT NULL`
* `end_date`: `TEXT NOT NULL`
* `is_published`: `INTEGER NOT NULL DEFAULT 0`
* `created_at`: `TEXT NOT NULL`

#### `exam_subjects`
* `id`: `TEXT PRIMARY KEY`
* `examination_id`: `TEXT NOT NULL REFERENCES examinations(id) ON DELETE CASCADE`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
* `subject_id`: `TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT`
* `exam_date`: `TEXT NOT NULL`
* `max_marks`: `REAL NOT NULL` (e.g., `100.0`)
* `passing_marks`: `REAL NOT NULL` (e.g., `35.0`)
* *Unique:* `(examination_id, class_id, subject_id)`

#### `exam_marks`
* `id`: `TEXT PRIMARY KEY`
* `exam_subject_id`: `TEXT NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE`
* `enrollment_id`: `TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE`
* `marks_obtained`: `REAL`
* `is_absent`: `INTEGER NOT NULL DEFAULT 0`
* `remarks`: `TEXT`
* `entered_by_teacher_id`: `TEXT REFERENCES teacher_profiles(id) ON DELETE SET NULL`
* `created_at`: `TEXT NOT NULL`
* *Unique:* `(exam_subject_id, enrollment_id)`

---

### 3.6 Timetable

#### `timetable_slots`
* `id`: `TEXT PRIMARY KEY`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
* `subject_id`: `TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT`
* `teacher_profile_id`: `TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT`
* `day_of_week`: `INTEGER NOT NULL` (1 = Monday, ..., 7 = Sunday)
* `period_number`: `INTEGER NOT NULL`
* `start_time`: `TEXT NOT NULL` (`HH:MM`)
* `end_time`: `TEXT NOT NULL` (`HH:MM`)
* `room_name`: `TEXT`
* *Uniqueness & Collision Constraints:*
  * Unique Class Slot: `(academic_session_id, class_id, day_of_week, period_number)`
  * Unique Teacher Slot: `(academic_session_id, teacher_profile_id, day_of_week, period_number)`

---

### 3.7 Finance & Integer Paise Ledger

#### `fee_components`
Master definition of fee heads.
* `id`: `TEXT PRIMARY KEY`
* `code`: `TEXT NOT NULL UNIQUE` (`COACHING`, `MESS`, `OTHER`)
* `name`: `TEXT NOT NULL`
* `description`: `TEXT`

#### `fee_structures`
Standard fee amounts per class and session.
* `id`: `TEXT PRIMARY KEY`
* `academic_session_id`: `TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE`
* `class_id`: `TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE`
* `fee_component_id`: `TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT`
* `default_amount_paise`: `INTEGER NOT NULL` (e.g., `150000` = ₹1,500.00)
* *Unique:* `(academic_session_id, class_id, fee_component_id)`

#### `student_fee_assignments`
Student enrollment-specific overrides or concessions.
* `id`: `TEXT PRIMARY KEY`
* `enrollment_id`: `TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE`
* `fee_component_id`: `TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT`
* `custom_amount_paise`: `INTEGER NOT NULL`
* `reason`: `TEXT`
* `effective_from`: `TEXT NOT NULL`
* *Unique:* `(enrollment_id, fee_component_id)`

#### `invoices`
Snapshot bill generated for a student.
* `id`: `TEXT PRIMARY KEY`
* `invoice_number`: `TEXT NOT NULL UNIQUE` (e.g., `INV-202611-0001`)
* `student_id`: `TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT`
* `enrollment_id`: `TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT`
* `billing_month`: `INTEGER NOT NULL` (1–12)
* `billing_year`: `INTEGER NOT NULL` (e.g., 2026)
* `invoice_type`: `TEXT NOT NULL` (`COMBINED`, `SEPARATE_COACHING`, `SEPARATE_MESS`)
* `total_amount_paise`: `INTEGER NOT NULL`
* `due_date`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `status`: `TEXT NOT NULL DEFAULT 'UNPAID'` (`PAID`, `PARTIALLY_PAID`, `UNPAID`)
* `created_at`: `TEXT NOT NULL`
* *Unique:* `(student_id, billing_month, billing_year, invoice_type)`

#### `invoice_items`
Itemized line snapshot of fee components included in an invoice.
* `id`: `TEXT PRIMARY KEY`
* `invoice_id`: `TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE`
* `fee_component_id`: `TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT`
* `description`: `TEXT NOT NULL`
* `amount_paise`: `INTEGER NOT NULL`

#### `payments`
Record of money received.
* `id`: `TEXT PRIMARY KEY`
* `student_id`: `TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT`
* `amount_paid_paise`: `INTEGER NOT NULL`
* `payment_method`: `TEXT NOT NULL` (`CASH`, `UPI`, `BANK_TRANSFER`)
* `transaction_reference`: `TEXT` (UPI reference ID or bank UTR)
* `payment_date`: `TEXT NOT NULL` (`YYYY-MM-DD`)
* `notes`: `TEXT`
* `recorded_by_user_id`: `TEXT REFERENCES users(id) ON DELETE SET NULL`
* `created_at`: `TEXT NOT NULL`

#### `payment_allocations`
Maps payments to specific invoices. Supports partial payments and multiple invoices.
* `id`: `TEXT PRIMARY KEY`
* `payment_id`: `TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE`
* `invoice_id`: `TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT`
* `allocated_amount_paise`: `INTEGER NOT NULL`
* `created_at`: `TEXT NOT NULL`
* *Rule:* $\sum \text{allocated\_amount\_paise} \le \text{payment.amount\_paid\_paise}$

#### `receipts`
Formal printable receipt record.
* `id`: `TEXT PRIMARY KEY`
* `receipt_number`: `TEXT NOT NULL UNIQUE` (e.g., `REC-202611-0001`)
* `payment_id`: `TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT`
* `issued_date`: `TEXT NOT NULL`
* `created_at`: `TEXT NOT NULL`

---

### 3.8 Audit Logs & R2 File Metadata

#### `audit_logs`
* `id`: `TEXT PRIMARY KEY`
* `actor_user_id`: `TEXT REFERENCES users(id) ON DELETE SET NULL`
* `action`: `TEXT NOT NULL` (`CREATE`, `UPDATE`, `CORRECTION`, `ALLOCATION`, `REVERSAL`)
* `entity_type`: `TEXT NOT NULL` (`DAILY_ATTENDANCE`, `EXAM_MARKS`, `PAYMENT`, `INVOICE`)
* `entity_id`: `TEXT NOT NULL`
* `old_values`: `TEXT` (JSON serialized before-state)
* `new_values`: `TEXT` (JSON serialized after-state)
* `ip_address`: `TEXT`
* `created_at`: `TEXT NOT NULL`

#### `file_objects`
Metadata for binary assets stored in Cloudflare R2.
* `id`: `TEXT PRIMARY KEY`
* `r2_object_key`: `TEXT NOT NULL UNIQUE`
* `category`: `TEXT NOT NULL` (`STUDENT_PHOTO`, `TEACHER_PHOTO`, `DOCUMENT`)
* `mime_type`: `TEXT NOT NULL`
* `size_bytes`: `INTEGER NOT NULL`
* `uploaded_by_user_id`: `TEXT REFERENCES users(id) ON DELETE SET NULL`
* `created_at`: `TEXT NOT NULL`

---

## 4. Drizzle ORM Schema Snippet (`drizzle/schema/finance.js`)

```javascript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  studentId: text('student_id').notNull(),
  enrollmentId: text('enrollment_id').notNull(),
  billingMonth: integer('billing_month').notNull(),
  billingYear: integer('billing_year').notNull(),
  invoiceType: text('invoice_type').notNull(), // COMBINED, SEPARATE_COACHING, SEPARATE_MESS
  totalAmountPaise: integer('total_amount_paise').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('UNPAID'), // PAID, PARTIALLY_PAID, UNPAID
  createdAt: text('created_at').notNull(),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  amountPaidPaise: integer('amount_paid_paise').notNull(),
  paymentMethod: text('payment_method').notNull(), // CASH, UPI, BANK_TRANSFER
  transactionReference: text('transaction_reference'),
  paymentDate: text('payment_date').notNull(),
  notes: text('notes'),
  recordedByUserId: text('recorded_by_user_id'),
  createdAt: text('created_at').notNull(),
});

export const paymentAllocations = sqliteTable('payment_allocations', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull().references(() => payments.id),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  allocatedAmountPaise: integer('allocated_amount_paise').notNull(),
  createdAt: text('created_at').notNull(),
});
```
