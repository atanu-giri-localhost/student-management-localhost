-- ============================================================================
-- Synthetic Development Seed: seeds/07_timetable.sql
-- Target DB: DB_TIMETABLE (sms-d1-timetable)
-- WARNING: SYNTHETIC DEVELOPMENT FIXTURES ONLY. NEVER run against production.
-- ============================================================================

PRAGMA foreign_keys = ON;

INSERT INTO rooms (id, name, code, capacity, floor_or_building, is_active, created_at) VALUES
  ('26000000-0000-4000-8000-000000000001', 'Room 101', 'R-101', 40, 'First Floor', 1, '2026-04-01T08:00:00.000Z'),
  ('26000000-0000-4000-8000-000000000002', 'Science Lab', 'SCI-LAB', 30, 'Ground Floor', 1, '2026-04-01T08:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO timetable_slots (
  id, academic_session_id, class_id, subject_id, teacher_profile_id,
  room_id, room_name, day_of_week, period_number, start_time, end_time, created_at
) VALUES
  ('27000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', '1b000000-0000-4000-8000-000000000002', '26000000-0000-4000-8000-000000000001', 'Room 101', 1, 1, '09:00', '09:50', '2026-04-01T08:30:00.000Z'),
  ('27000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000002', '1b000000-0000-4000-8000-000000000001', '26000000-0000-4000-8000-000000000002', 'Science Lab', 1, 2, '10:00', '10:50', '2026-04-01T08:30:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO academic_calendar (
  id, academic_session_id, calendar_date, day_type, title, notes, created_at
) VALUES
  ('31000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '2026-08-15', 'HOLIDAY', 'Independence Day', 'Institutional holiday', '2026-04-01T08:00:00.000Z')
ON CONFLICT DO NOTHING;
