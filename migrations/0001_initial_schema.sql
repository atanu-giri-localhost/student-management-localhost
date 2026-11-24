-- ============================================================================
-- Migration: 0001_initial_schema.sql
-- Project:   Student Management System (Coaching Institute + Mess Fee Ledger)
-- Database:  Cloudflare D1 (SQLite) — Direct env.DB bindings (Zero ORM)
-- Rules:
--   1. Pure SQLite DDL only (no PostgreSQL types, no BEGIN/COMMIT statements).
--   2. PRAGMA foreign_keys = ON; enforced on every connection.
--   3. All monetary amounts stored as INTEGER NOT NULL in paise (*_paise).
--   4. All booleans stored as INTEGER NOT NULL DEFAULT 0|1 with CHECK (0|1).
--   5. Historical academic and financial records use ON DELETE RESTRICT or
--      ON DELETE SET NULL (never cascade-delete enrollments, attendance,
--      exam_marks, invoices, invoice_items, payments, allocations, receipts).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. Identity, Users, WhatsApp OTP Authentication & R2 File Metadata
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_normalized TEXT NOT NULL UNIQUE CHECK (phone_normalized LIKE '+%'),
  email TEXT CHECK (email IS NULL OR length(trim(email)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (
    name IN ('SUPER_ADMIN', 'COACHING_ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  ),
  description TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  phone_normalized TEXT NOT NULL CHECK (phone_normalized LIKE '+%'),
  otp_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    delivery_status IN ('PENDING', 'DELIVERED', 'FAILED')
  ),
  request_ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_objects (
  id TEXT PRIMARY KEY,
  r2_object_key TEXT NOT NULL UNIQUE CHECK (
    r2_object_key NOT LIKE '/%' AND instr(r2_object_key, '..') = 0
  ),
  category TEXT NOT NULL CHECK (
    category IN ('STUDENT_PHOTO', 'TEACHER_PHOTO', 'DOCUMENT')
  ),
  mime_type TEXT NOT NULL CHECK (
    mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  owner_entity_type TEXT CHECK (
    owner_entity_type IS NULL OR
    owner_entity_type IN ('STUDENT', 'TEACHER', 'PARENT', 'INVOICE', 'PAYMENT', 'GENERAL')
  ),
  owner_entity_id TEXT,
  uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. Students, Parents & Academic Life-Cycle
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  admission_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group TEXT,
  photo_file_id TEXT REFERENCES file_objects(id) ON DELETE SET NULL,
  contact_phone TEXT,
  residential_address TEXT,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    lifecycle_status IN ('ACTIVE', 'INACTIVE', 'ALUMNI', 'LEFT')
  ),
  admission_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS parent_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  phone_normalized TEXT NOT NULL CHECK (phone_normalized LIKE '+%'),
  email TEXT,
  relationship_type TEXT NOT NULL CHECK (
    relationship_type IN ('Father', 'Mother', 'Guardian')
  ),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parent_students (
  id TEXT PRIMARY KEY,
  parent_profile_id TEXT NOT NULL REFERENCES parent_profiles(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  verification_status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (
    verification_status IN ('VERIFIED', 'PENDING')
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (parent_profile_id, student_id)
);

CREATE TABLE IF NOT EXISTS academic_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level >= 1),
  section TEXT,
  UNIQUE (name, section)
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_subjects (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  UNIQUE (academic_session_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  roll_number TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    enrollment_status IN ('ACTIVE', 'PROMOTED', 'REPEATED', 'TRANSFERRED', 'LEFT')
  ),
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (student_id, academic_session_id)
);

-- ----------------------------------------------------------------------------
-- 3. Teachers & Session-Scoped Assignments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS teacher_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  qualification TEXT,
  specialization TEXT,
  joining_date TEXT NOT NULL,
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    employment_status IN ('ACTIVE', 'INACTIVE', 'LEFT')
  ),
  photo_file_id TEXT REFERENCES file_objects(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id TEXT PRIMARY KEY,
  teacher_profile_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  responsibility_category TEXT NOT NULL CHECK (
    responsibility_category IN ('REGULAR_TEACHER', 'CLASS_TEACHER')
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (
    teacher_profile_id,
    academic_session_id,
    class_id,
    subject_id,
    responsibility_category
  )
);

-- ----------------------------------------------------------------------------
-- 4. Dual Attendance Registers & Daily Performance
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance_days (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  attendance_date TEXT NOT NULL,
  marked_by_teacher_id TEXT REFERENCES teacher_profiles(id) ON DELETE SET NULL,
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (academic_session_id, class_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS daily_attendance_records (
  id TEXT PRIMARY KEY,
  attendance_day_id TEXT NOT NULL REFERENCES attendance_days(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')),
  remarks TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (attendance_day_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS period_attendance_registers (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  attendance_date TEXT NOT NULL,
  period_number INTEGER NOT NULL CHECK (period_number >= 1),
  marked_by_teacher_id TEXT REFERENCES teacher_profiles(id) ON DELETE SET NULL,
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (academic_session_id, class_id, subject_id, attendance_date, period_number)
);

CREATE TABLE IF NOT EXISTS period_attendance_records (
  id TEXT PRIMARY KEY,
  register_id TEXT NOT NULL REFERENCES period_attendance_registers(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')),
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (register_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS performance_records (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  teacher_profile_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
  subject_id TEXT REFERENCES subjects(id) ON DELETE RESTRICT,
  evaluation_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('CLASS_TEST', 'HOMEWORK', 'CLASSWORK', 'GENERAL')
  ),
  marks_obtained REAL CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  max_marks REAL CHECK (max_marks IS NULL OR max_marks > 0),
  remarks TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (marks_obtained IS NULL OR max_marks IS NULL OR marks_obtained <= max_marks)
);

-- ----------------------------------------------------------------------------
-- 5. Examinations, Marks & Grading Scales
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS examinations (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (
    exam_type IN ('UNIT_TEST', 'MONTHLY_TEST', 'HALF_YEARLY', 'FINAL')
  ),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS exam_subjects (
  id TEXT PRIMARY KEY,
  examination_id TEXT NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  exam_date TEXT NOT NULL,
  max_marks REAL NOT NULL CHECK (max_marks > 0),
  passing_marks REAL NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= max_marks),
  UNIQUE (examination_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS exam_marks (
  id TEXT PRIMARY KEY,
  exam_subject_id TEXT NOT NULL REFERENCES exam_subjects(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  marks_obtained REAL CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  is_absent INTEGER NOT NULL DEFAULT 0 CHECK (is_absent IN (0, 1)),
  remarks TEXT,
  entered_by_teacher_id TEXT REFERENCES teacher_profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (exam_subject_id, enrollment_id)
);

-- Grading rules remain subject to stakeholder sign-off (OPEN Decision #9).
CREATE TABLE IF NOT EXISTS grading_scales (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  min_percentage REAL NOT NULL CHECK (min_percentage >= 0 AND min_percentage <= 100),
  max_percentage REAL NOT NULL CHECK (
    max_percentage >= 0 AND max_percentage <= 100 AND max_percentage >= min_percentage
  ),
  grade_point REAL CHECK (grade_point IS NULL OR grade_point >= 0),
  is_passing INTEGER NOT NULL DEFAULT 1 CHECK (is_passing IN (0, 1)),
  effective_from TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (name, grade_label, effective_from)
);

-- ----------------------------------------------------------------------------
-- 6. Rooms & Timetable
-- ----------------------------------------------------------------------------

-- Classroom/room definitions (room conflict blocking vs warning is OPEN).
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  floor_or_building TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timetable_slots (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_profile_id TEXT NOT NULL REFERENCES teacher_profiles(id) ON DELETE RESTRICT,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  room_name TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  period_number INTEGER NOT NULL CHECK (period_number >= 1),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (end_time > start_time),
  UNIQUE (academic_session_id, class_id, day_of_week, period_number),
  UNIQUE (academic_session_id, teacher_profile_id, day_of_week, period_number)
);

-- ----------------------------------------------------------------------------
-- 7. Finance & Integer Paise Ledger
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fee_components (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('COACHING', 'MESS', 'OTHER')),
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  fee_component_id TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT,
  default_amount_paise INTEGER NOT NULL CHECK (default_amount_paise >= 0),
  effective_from TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d', 'now')),
  UNIQUE (academic_session_id, class_id, fee_component_id)
);

CREATE TABLE IF NOT EXISTS student_fee_assignments (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  fee_component_id TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT,
  custom_amount_paise INTEGER NOT NULL CHECK (custom_amount_paise >= 0),
  reason TEXT,
  effective_from TEXT NOT NULL,
  UNIQUE (enrollment_id, fee_component_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE RESTRICT,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INTEGER NOT NULL CHECK (billing_year >= 2000 AND billing_year <= 2100),
  invoice_type TEXT NOT NULL CHECK (
    invoice_type IN ('COMBINED', 'SEPARATE_COACHING', 'SEPARATE_MESS')
  ),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (
    status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID')
  ),
  created_at TEXT NOT NULL,
  UNIQUE (student_id, billing_month, billing_year, invoice_type)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  fee_component_id TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  amount_paid_paise INTEGER NOT NULL CHECK (amount_paid_paise > 0),
  payment_method TEXT NOT NULL CHECK (
    payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER')
  ),
  transaction_reference TEXT,
  payment_date TEXT NOT NULL,
  notes TEXT,
  recorded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  allocated_amount_paise INTEGER NOT NULL CHECK (allocated_amount_paise > 0),
  created_at TEXT NOT NULL,
  UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  issued_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 8. Immutable Audit Trail
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (
    action IN (
      'CREATE',
      'UPDATE',
      'DELETE',
      'CORRECTION',
      'ALLOCATION',
      'REVERSAL',
      'REVOKE',
      'UNLINK'
    )
  ),
  entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) > 0),
  entity_id TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);

-- ============================================================================
-- Indexes & Partial Unique Constraints
-- ============================================================================

-- Identity, OTP & Sessions
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(is_active, created_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_created
  ON otp_challenges(phone_normalized, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_ip_created
  ON otp_challenges(request_ip, created_at) WHERE request_ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON sessions(user_id, revoked_at, expires_at);

-- R2 File Metadata
CREATE INDEX IF NOT EXISTS idx_file_objects_category_created
  ON file_objects(category, created_at);
CREATE INDEX IF NOT EXISTS idx_file_objects_owner
  ON file_objects(owner_entity_type, owner_entity_id)
  WHERE owner_entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_objects_uploader
  ON file_objects(uploaded_by_user_id);

-- Students, Parents & Academics
CREATE INDEX IF NOT EXISTS idx_students_lifecycle_created
  ON students(lifecycle_status, created_at);
CREATE INDEX IF NOT EXISTS idx_students_full_name
  ON students(full_name);
CREATE INDEX IF NOT EXISTS idx_parent_profiles_phone
  ON parent_profiles(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_parent_students_parent_verified
  ON parent_students(parent_profile_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_parent_students_student
  ON parent_students(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_sessions_single_active
  ON academic_sessions(is_active) WHERE is_active = 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_name_no_section
  ON classes(name) WHERE section IS NULL;
CREATE INDEX IF NOT EXISTS idx_classes_grade_name
  ON classes(grade_level, name);
CREATE INDEX IF NOT EXISTS idx_class_subjects_session_class
  ON class_subjects(academic_session_id, class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_session_class_status
  ON enrollments(academic_session_id, class_id, enrollment_status, roll_number);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_session
  ON enrollments(class_id, academic_session_id);

-- Teachers & Scoped Assignments
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_status
  ON teacher_profiles(employment_status);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher_session
  ON teacher_assignments(teacher_profile_id, academic_session_id, responsibility_category);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_session_class_subject
  ON teacher_assignments(academic_session_id, class_id, subject_id);

-- Dual Attendance & Daily Performance
CREATE INDEX IF NOT EXISTS idx_attendance_days_date_session
  ON attendance_days(attendance_date, academic_session_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_enrollment_status
  ON daily_attendance_records(enrollment_id, status);
CREATE INDEX IF NOT EXISTS idx_period_registers_session_class_date
  ON period_attendance_registers(academic_session_id, class_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_period_registers_teacher_date
  ON period_attendance_registers(marked_by_teacher_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_period_attendance_enrollment_status
  ON period_attendance_records(enrollment_id, status);
CREATE INDEX IF NOT EXISTS idx_performance_records_enrollment_date
  ON performance_records(enrollment_id, evaluation_date);
CREATE INDEX IF NOT EXISTS idx_performance_records_teacher_date
  ON performance_records(teacher_profile_id, evaluation_date);

-- Examinations & Grading
CREATE INDEX IF NOT EXISTS idx_examinations_session_published
  ON examinations(academic_session_id, is_published, start_date);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_class_subject
  ON exam_subjects(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_enrollment
  ON exam_marks(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_grading_scales_session_active
  ON grading_scales(academic_session_id, is_active, effective_from);

-- Rooms & Timetable
CREATE INDEX IF NOT EXISTS idx_rooms_active
  ON rooms(is_active, name);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_room_slot
  ON timetable_slots(academic_session_id, room_id, day_of_week, period_number)
  WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timetable_slots_teacher_day
  ON timetable_slots(academic_session_id, teacher_profile_id, day_of_week);

-- Finance Ledger
CREATE INDEX IF NOT EXISTS idx_fee_structures_session_class
  ON fee_structures(academic_session_id, class_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_enrollment
  ON student_fee_assignments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student_status_due
  ON invoices(student_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_enrollment_period
  ON invoices(enrollment_id, billing_year, billing_month);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON invoices(due_date) WHERE status != 'PAID';
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_date
  ON payments(student_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_date
  ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice
  ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_issued_date
  ON receipts(issued_date);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
  ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON audit_logs(actor_user_id, created_at);
