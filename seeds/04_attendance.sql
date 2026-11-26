-- ============================================================================
-- Synthetic Development Seed: seeds/04_attendance.sql
-- Target DB: DB_ATTENDANCE (sms-d1-attendance)
-- WARNING: SYNTHETIC DEVELOPMENT FIXTURES ONLY. NEVER run against production.
-- ============================================================================

PRAGMA foreign_keys = ON;

INSERT INTO attendance_days (
  id, academic_session_id, class_id, attendance_date, marked_by_teacher_id, is_locked, created_at
) VALUES
  ('1d000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '2026-11-23', '1b000000-0000-4000-8000-000000000001', 0, '2026-11-23T03:30:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO daily_attendance_records (
  id, attendance_day_id, enrollment_id, status, remarks, created_at
) VALUES
  ('1e000000-0000-4000-8000-000000000001', '1d000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000002', 'PRESENT', NULL, '2026-11-23T03:30:00.000Z'),
  ('1e000000-0000-4000-8000-000000000002', '1d000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000004', 'LATE', 'Arrived 10 minutes late', '2026-11-23T03:30:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO period_attendance_registers (
  id, academic_session_id, class_id, subject_id, attendance_date, period_number, marked_by_teacher_id, is_locked, created_at
) VALUES
  ('1f000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', '2026-11-23', 1, '1b000000-0000-4000-8000-000000000002', 0, '2026-11-23T04:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO period_attendance_records (
  id, register_id, enrollment_id, status, remarks, created_at
) VALUES
  ('20000000-0000-4000-8000-000000000001', '1f000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000002', 'PRESENT', NULL, '2026-11-23T04:00:00.000Z'),
  ('20000000-0000-4000-8000-000000000002', '1f000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000004', 'PRESENT', NULL, '2026-11-23T04:00:00.000Z')
ON CONFLICT DO NOTHING;
