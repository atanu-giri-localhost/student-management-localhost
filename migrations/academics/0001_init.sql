-- ============================================================================
-- Migration: migrations/academics/0001_init.sql
-- Database:  DB_ACADEMICS (sms-d1-academics)
-- Purpose:   Academic sessions, classes, subjects, curriculum mapping,
--            teacher profiles, and session-scoped teacher assignments.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academic_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL CHECK (end_date >= start_date),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS teacher_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  qualification TEXT,
  specialization TEXT,
  joining_date TEXT NOT NULL,
  employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    employment_status IN ('ACTIVE', 'INACTIVE', 'LEFT')
  ),
  photo_file_id TEXT,
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
  UNIQUE (teacher_profile_id, academic_session_id, class_id, subject_id, responsibility_category)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_sessions_single_active
  ON academic_sessions(is_active)
  WHERE is_active = 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_name_no_section
  ON classes(name)
  WHERE section IS NULL;

CREATE INDEX IF NOT EXISTS idx_classes_grade_name
  ON classes(grade_level, name);

CREATE INDEX IF NOT EXISTS idx_class_subjects_session_class
  ON class_subjects(academic_session_id, class_id);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_status
  ON teacher_profiles(employment_status);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher_session
  ON teacher_assignments(teacher_profile_id, academic_session_id, responsibility_category);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_session_class_subject
  ON teacher_assignments(academic_session_id, class_id, subject_id);
