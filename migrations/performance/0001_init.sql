-- ============================================================================
-- Migration: migrations/performance/0001_init.sql
-- Database:  DB_PERFORMANCE (sms-d1-performance)
-- Purpose:   Daily class tests/homework/remarks, examinations, exam subjects,
--            exam marks, and grading scales.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS performance_records (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  teacher_profile_id TEXT NOT NULL,
  subject_id TEXT,
  evaluation_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('CLASS_TEST', 'HOMEWORK', 'CLASSWORK', 'GENERAL')),
  marks_obtained REAL CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  max_marks REAL CHECK (max_marks IS NULL OR max_marks > 0),
  remarks TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (marks_obtained IS NULL OR max_marks IS NULL OR marks_obtained <= max_marks)
);

CREATE TABLE IF NOT EXISTS examinations (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL CHECK (exam_type IN ('UNIT_TEST', 'MONTHLY_TEST', 'HALF_YEARLY', 'FINAL')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL CHECK (end_date >= start_date),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_subjects (
  id TEXT PRIMARY KEY,
  examination_id TEXT NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  max_marks REAL NOT NULL CHECK (max_marks > 0),
  passing_marks REAL NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= max_marks),
  UNIQUE (examination_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS exam_marks (
  id TEXT PRIMARY KEY,
  exam_subject_id TEXT NOT NULL REFERENCES exam_subjects(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL,
  marks_obtained REAL CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  is_absent INTEGER NOT NULL DEFAULT 0 CHECK (is_absent IN (0, 1)),
  remarks TEXT,
  entered_by_teacher_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (exam_subject_id, enrollment_id),
  CHECK (is_absent = 0 OR marks_obtained IS NULL)
);

CREATE TABLE IF NOT EXISTS grading_scales (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT,
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_performance_records_enrollment_date
  ON performance_records(enrollment_id, evaluation_date);

CREATE INDEX IF NOT EXISTS idx_performance_records_teacher_date
  ON performance_records(teacher_profile_id, evaluation_date);

CREATE INDEX IF NOT EXISTS idx_examinations_session_published
  ON examinations(academic_session_id, is_published, start_date);

CREATE INDEX IF NOT EXISTS idx_exam_subjects_class_subject
  ON exam_subjects(class_id, subject_id);

CREATE INDEX IF NOT EXISTS idx_exam_marks_enrollment
  ON exam_marks(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_grading_scales_session_active
  ON grading_scales(academic_session_id, is_active, effective_from);
