-- ============================================================================
-- Synthetic Development Seed: seeds/02_students.sql
-- Target DB: DB_STUDENTS (sms-d1-students)
-- WARNING: SYNTHETIC DEVELOPMENT FIXTURES ONLY. NEVER run against production.
-- ============================================================================

PRAGMA foreign_keys = ON;

INSERT INTO students (
  id, user_id, admission_number, full_name, date_of_birth, gender, blood_group,
  photo_file_id, contact_phone, residential_address, emergency_contact_name,
  emergency_contact_phone, lifecycle_status, admission_date, created_at, updated_at
) VALUES
  (
    '14000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000005',
    'ADM-2026-0001',
    'Aarav Sharma',
    '2011-05-14',
    'Male',
    'B+',
    NULL,
    '+919876510001',
    '42 MG Road, Sector 4, Jaipur',
    'Sunita Sharma',
    '+919876520001',
    'ACTIVE',
    '2025-04-01',
    '2025-04-01T09:00:00.000Z',
    '2026-04-01T09:20:00.000Z'
  ),
  (
    '14000000-0000-4000-8000-000000000002',
    NULL,
    'ADM-2026-0002',
    'Diya Sharma',
    '2012-08-22',
    'Female',
    'O+',
    NULL,
    NULL,
    '42 MG Road, Sector 4, Jaipur',
    'Sunita Sharma',
    '+919876520001',
    'ACTIVE',
    '2026-04-01',
    '2026-04-01T09:25:00.000Z',
    '2026-04-01T09:25:00.000Z'
  ),
  (
    '14000000-0000-4000-8000-000000000003',
    NULL,
    'ADM-2026-0003',
    'Kabir Patel',
    '2011-02-10',
    'Male',
    'A+',
    NULL,
    NULL,
    '18 Station Road, Jaipur',
    'Ramesh Patel',
    '+919876520099',
    'ACTIVE',
    '2026-04-01',
    '2026-04-01T09:30:00.000Z',
    '2026-04-01T09:30:00.000Z'
  )
ON CONFLICT DO NOTHING;

INSERT INTO parent_profiles (
  id, user_id, full_name, phone_normalized, email, relationship_type, created_at
) VALUES
  (
    '13000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000006',
    'Sunita Sharma',
    '+919876520001',
    'sunita.sharma@apexcoaching.example',
    'Mother',
    '2026-04-01T09:25:00.000Z'
  )
ON CONFLICT DO NOTHING;

INSERT INTO parent_students (
  id, parent_profile_id, student_id, is_primary, verification_status, created_at
) VALUES
  ('15000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 1, 'VERIFIED', '2026-04-01T09:26:00.000Z'),
  ('15000000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 1, 'VERIFIED', '2026-04-01T09:27:00.000Z')
ON CONFLICT DO NOTHING;

INSERT INTO enrollments (
  id, student_id, academic_session_id, class_id, roll_number, enrollment_status, start_date, end_date, created_at
) VALUES
  ('1a000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000001', '09A-01', 'PROMOTED', '2025-04-01', '2026-03-31', '2025-04-01T09:00:00.000Z'),
  ('1a000000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '10A-01', 'ACTIVE', '2026-04-01', NULL, '2026-04-01T09:20:00.000Z'),
  ('1a000000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000002', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', '09A-01', 'ACTIVE', '2026-04-01', NULL, '2026-04-01T09:25:00.000Z'),
  ('1a000000-0000-4000-8000-000000000004', '14000000-0000-4000-8000-000000000003', '16000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', '10A-02', 'ACTIVE', '2026-04-01', NULL, '2026-04-01T09:30:00.000Z')
ON CONFLICT DO NOTHING;
