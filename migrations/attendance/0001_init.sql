-- ============================================================================
-- Migration: migrations/attendance/0001_init.sql
-- Database:  DB_ATTENDANCE (sms-d1-attendance)
-- Purpose:   Daily institutional register, period-wise register, post-lock
--            attendance corrections, and critical-event audit_outbox.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS attendance_days (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  marked_by_teacher_id TEXT,
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (academic_session_id, class_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS daily_attendance_records (
  id TEXT PRIMARY KEY,
  attendance_day_id TEXT NOT NULL REFERENCES attendance_days(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')),
  remarks TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (attendance_day_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS period_attendance_registers (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  period_number INTEGER NOT NULL CHECK (period_number >= 1),
  marked_by_teacher_id TEXT,
  is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
  created_at TEXT NOT NULL,
  UNIQUE (academic_session_id, class_id, subject_id, attendance_date, period_number)
);

CREATE TABLE IF NOT EXISTS period_attendance_records (
  id TEXT PRIMARY KEY,
  register_id TEXT NOT NULL REFERENCES period_attendance_registers(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')),
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (register_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id TEXT PRIMARY KEY,
  register_type TEXT NOT NULL CHECK (register_type IN ('DAILY', 'PERIOD')),
  register_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')),
  new_status TEXT NOT NULL CHECK (
    new_status IN ('PRESENT', 'ABSENT', 'LATE', 'LEAVE')
    AND new_status != previous_status
  ),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  corrected_by_user_id TEXT NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_record
  ON attendance_corrections(register_type, record_id, created_at);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_register
  ON attendance_corrections(register_type, register_id, created_at);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_enrollment
  ON attendance_corrections(enrollment_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_outbox_pending
  ON audit_outbox(status, created_at)
  WHERE status = 'PENDING';
