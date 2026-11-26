-- ============================================================================
-- Migration: migrations/timetable/0001_init.sql
-- Database:  DB_TIMETABLE (sms-d1-timetable)
-- Purpose:   Classrooms, weekly timetable slots, and academic/holiday calendar.
-- ============================================================================

PRAGMA foreign_keys = ON;

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
  academic_session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  teacher_profile_id TEXT NOT NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  room_name TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  period_number INTEGER NOT NULL CHECK (period_number >= 1),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL CHECK (end_time > start_time),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (academic_session_id, class_id, day_of_week, period_number),
  UNIQUE (academic_session_id, teacher_profile_id, day_of_week, period_number)
);

CREATE TABLE IF NOT EXISTS academic_calendar (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL,
  calendar_date TEXT NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('WORKING', 'HOLIDAY', 'EXAM_DAY', 'SPECIAL_EVENT')),
  title TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (academic_session_id, calendar_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_active
  ON rooms(is_active, name);

CREATE INDEX IF NOT EXISTS idx_timetable_slots_room_slot
  ON timetable_slots(academic_session_id, room_id, day_of_week, period_number)
  WHERE room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timetable_slots_teacher_day
  ON timetable_slots(academic_session_id, teacher_profile_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_session_type
  ON academic_calendar(academic_session_id, day_type, calendar_date);
