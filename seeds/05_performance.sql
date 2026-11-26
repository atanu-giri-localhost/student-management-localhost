-- ============================================================================
-- Synthetic Development Seed: seeds/05_performance.sql
-- Target DB: DB_PERFORMANCE (sms-d1-performance)
-- WARNING: SYNTHETIC DEVELOPMENT FIXTURES ONLY. NEVER run against production.
-- ============================================================================

PRAGMA foreign_keys = ON;

INSERT INTO performance_records (
  id, enrollment_id, teacher_profile_id, subject_id, evaluation_date,
  category, marks_obtained, max_marks, remarks, created_at
) VALUES
  (
    '21000000-0000-4000-8000-000000000001',
    '1a000000-0000-4000-8000-000000000002',
    '1b000000-0000-4000-8000-000000000002',
    '18000000-0000-4000-8000-000000000001',
    '2026-11-22',
    'CLASS_TEST',
    18.0,
    20.0,
    'Strong grasp of quadratic equations.',
    '2026-11-22T10:30:00.000Z'
  )
ON CONFLICT DO NOTHING;

INSERT INTO examinations (
  id, academic_session_id, name, exam_type, start_date, end_date, is_published, created_at
) VALUES
  ('22000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', 'Unit Test 1 - 2026', 'UNIT_TEST', '2026-08-10', '2026-08-14', 1, '2026-08-01T08:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO exam_subjects (
  id, examination_id, class_id, subject_id, exam_date, max_marks, passing_marks
) VALUES
  ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', '2026-08-10', 50.0, 18.0)
ON CONFLICT DO NOTHING;

INSERT INTO exam_marks (
  id, exam_subject_id, enrollment_id, marks_obtained, is_absent, remarks, entered_by_teacher_id, created_at
) VALUES
  ('24000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', '1a000000-0000-4000-8000-000000000002', 44.0, 0, 'Consistent problem-solving accuracy.', '1b000000-0000-4000-8000-000000000002', '2026-08-18T11:00:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO grading_scales (
  id, academic_session_id, name, grade_label, min_percentage, max_percentage,
  grade_point, is_passing, effective_from, is_active, created_at
) VALUES
  ('25000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'A+', 90.0, 100.0, 10.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'A', 80.0, 89.99, 9.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'B', 65.0, 79.99, 8.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000004', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'C', 50.0, 64.99, 7.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000005', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'D', 35.0, 49.99, 6.0, 1, '2026-04-01', 1, '2026-04-01T08:00:00.000Z'),
  ('25000000-0000-4000-8000-000000000006', '16000000-0000-4000-8000-000000000002', 'Draft Standard Scale 2026', 'F', 0.0, 34.99, 0.0, 0, '2026-04-01', 1, '2026-04-01T08:00:00.000Z')
ON CONFLICT DO NOTHING;
