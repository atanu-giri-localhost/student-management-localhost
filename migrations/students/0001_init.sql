-- ============================================================================
-- Migration: migrations/students/0001_init.sql
-- Database:  DB_STUDENTS (sms-d1-students)
-- Purpose:   Student identities, session enrollments, parent profiles & links,
--            R2 file metadata, and critical-event audit_outbox.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS file_objects (
  id TEXT PRIMARY KEY,
  r2_object_key TEXT NOT NULL UNIQUE CHECK (
    r2_object_key NOT LIKE '/%' AND instr(r2_object_key, '..') = 0
  ),
  category TEXT NOT NULL CHECK (category IN ('STUDENT_PHOTO', 'TEACHER_PHOTO', 'DOCUMENT')),
  mime_type TEXT NOT NULL CHECK (
    mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  owner_entity_type TEXT CHECK (
    owner_entity_type IS NULL
    OR owner_entity_type IN ('STUDENT', 'TEACHER', 'PARENT', 'INVOICE', 'PAYMENT', 'GENERAL')
  ),
  owner_entity_id TEXT,
  uploaded_by_user_id TEXT,
  created_at TEXT NOT NULL,
  CHECK (
    (owner_entity_type IS NULL AND owner_entity_id IS NULL)
    OR (owner_entity_type IS NOT NULL AND owner_entity_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
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
  user_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone_normalized TEXT NOT NULL CHECK (phone_normalized LIKE '+%'),
  email TEXT,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('Father', 'Mother', 'Guardian')),
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

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  academic_session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  roll_number TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    enrollment_status IN ('ACTIVE', 'PROMOTED', 'REPEATED', 'TRANSFERRED', 'LEFT')
  ),
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (student_id, academic_session_id)
);

CREATE TABLE IF NOT EXISTS audit_outbox (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL CHECK (
    action IN ('CREATE', 'UPDATE', 'DELETE', 'CORRECTION', 'ALLOCATION', 'REVERSAL', 'REVOKE', 'UNLINK')
  ),
  entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) > 0),
  entity_id TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  request_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_file_objects_category_created
  ON file_objects(category, created_at);

CREATE INDEX IF NOT EXISTS idx_file_objects_owner
  ON file_objects(owner_entity_type, owner_entity_id)
  WHERE owner_entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_objects_uploader
  ON file_objects(uploaded_by_user_id);

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

CREATE INDEX IF NOT EXISTS idx_enrollments_session_class_status
  ON enrollments(academic_session_id, class_id, enrollment_status, roll_number);

CREATE INDEX IF NOT EXISTS idx_enrollments_class_session
  ON enrollments(class_id, academic_session_id);

CREATE INDEX IF NOT EXISTS idx_audit_outbox_pending
  ON audit_outbox(status, created_at)
  WHERE status = 'PENDING';
